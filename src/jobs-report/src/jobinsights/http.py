"""The shared polite HTTP client: every request to a source goes through here (CLAUDE.md rule 4).

Each host gets its own rate limit and concurrency limit, and a host that isn't
configured is refused, so a disabled source can't be called by accident
(rule 1). HTTP and network failures come back as a FetchedResponse instead of
raising, because callers must record them and carry on (rule 10).
"""

import asyncio
import logging
import random
import time
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from importlib.metadata import version
from types import TracebackType
from typing import Self
from urllib.parse import urlsplit

import httpx

from jobinsights.archive import redact_url
from jobinsights.config import HttpSettings, RateLimit, SourceConfig

logger = logging.getLogger(__name__)


class HostNotAllowedError(ValueError):
    """The URL's host has no configured rate limit, so it may not be called."""


@dataclass(frozen=True, slots=True)
class FetchedResponse:
    url: str  # secrets redacted, safe to log and archive
    status: int | None  # None if no HTTP response was received
    body: bytes | None
    error: str | None  # None only for a 2xx response
    started_at: datetime  # when the first attempt was sent
    duration_ms: int  # from the first attempt to the last response, retries included
    attempts: int  # 0 if the host was paused and nothing was sent

    @property
    def ok(self) -> bool:
        return self.error is None

    @property
    def retryable(self) -> bool:
        """Whether trying again later might work: an outage or a limit, not a wrong URL."""
        return self.status is None or self.status == 429 or self.status >= 500


def host_limits(sources: Iterable[SourceConfig]) -> dict[str, RateLimit]:
    """The rate limit for each host the given sources call."""
    return {
        host: source.rate_limit
        for source in sources
        for endpoint in (source.endpoint, source.eu_endpoint, source.detail_endpoint)
        if endpoint is not None and (host := urlsplit(endpoint).hostname) is not None
    }


class _Host:
    """The limiter state for one host."""

    def __init__(self, limit: RateLimit) -> None:
        self.semaphore = asyncio.Semaphore(limit.concurrency)
        self.interval = 60 / limit.requests_per_minute if limit.requests_per_minute else 0.0
        self.next_slot = 0.0  # earliest time the next request may start
        self.not_before = 0.0  # set by Retry-After; pauses the whole host


class PoliteClient:
    """Use as `async with PoliteClient(...) as client`.

    `clock`, `now`, `sleep` and `rng` can be replaced so tests never really wait.
    """

    def __init__(
        self,
        settings: HttpSettings,
        contact_email: str,
        limits: Mapping[str, RateLimit],
        *,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        rng: random.Random | None = None,
    ) -> None:
        self._settings = settings
        self._hosts = {host: _Host(limit) for host, limit in limits.items()}
        self._clock = clock
        self._now = now
        self._sleep = sleep
        self._rng = rng or random.Random()
        self._client = httpx.AsyncClient(
            headers={
                "User-Agent": f"job-insights/{version('job-insights')} (contact: {contact_email})"
            },
            timeout=httpx.Timeout(settings.timeout_seconds),
            follow_redirects=False,  # a moved board is a recorded failure, not a silent change
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        await self._client.aclose()

    async def get(self, url: str, *, headers: Mapping[str, str] | None = None) -> FetchedResponse:
        """GET `url`, retrying 429s, 5xx and network errors.

        Raises only HostNotAllowedError; every other failure is in the result.
        """
        host = self._host_for(url)
        safe_url = redact_url(url)
        started_at = self._now()
        started = self._clock()
        attempts = 0

        while True:
            async with host.semaphore:
                if not await self._take_slot(host):
                    logger.warning("host is paused by Retry-After", extra={"url": safe_url})
                    return FetchedResponse(
                        url=safe_url,
                        status=None,
                        body=None,
                        error="host is paused by an earlier Retry-After",
                        started_at=started_at,
                        duration_ms=self._elapsed_ms(started) if attempts else 0,
                        attempts=attempts,
                    )
                if attempts == 0:
                    started_at = self._now()
                    started = self._clock()
                attempts += 1
                response: httpx.Response | None = None
                try:
                    response = await self._client.get(url, headers=headers)
                    status, body = response.status_code, response.content
                    error = None if response.is_success else f"HTTP {status}"
                except httpx.RequestError as exc:
                    status, body = None, None
                    # The exception text may quote the URL, keys included.
                    error = f"{type(exc).__name__}: {exc}".replace(url, safe_url)

            result = FetchedResponse(
                url=safe_url,
                status=status,
                body=body,
                error=error,
                started_at=started_at,
                duration_ms=self._elapsed_ms(started),
                attempts=attempts,
            )
            if not result.retryable:
                return result

            retry_after = (
                _retry_after_seconds(response.headers.get("Retry-After"), self._now())
                if response is not None
                else None
            )
            if retry_after is not None:
                host.not_before = max(host.not_before, self._clock() + retry_after)
                if retry_after > self._settings.backoff_max_seconds:
                    # Giving up keeps the pause in place; calling early would ignore the request.
                    logger.warning(
                        "giving up: Retry-After is too long",
                        extra={"url": safe_url, "retry_after_seconds": retry_after},
                    )
                    return result
            if attempts > self._settings.max_retries:
                return result

            delay = retry_after if retry_after is not None else self._backoff(attempts)
            logger.warning(
                "retrying request",
                extra={
                    "url": safe_url,
                    "error": error,
                    "attempt": attempts,
                    "delay_seconds": delay,
                },
            )
            if retry_after is None:  # with Retry-After, _take_slot does the waiting
                await self._sleep(delay)

    def _host_for(self, url: str) -> _Host:
        name = urlsplit(url).hostname
        host = self._hosts.get(name) if name is not None else None
        if host is None:
            raise HostNotAllowedError(f"no rate limit is configured for host {name!r}")
        return host

    async def _take_slot(self, host: _Host) -> bool:
        """Wait until this host may be called. False if it's paused for too long to wait."""
        while True:
            now = self._clock()
            if host.not_before - now > self._settings.backoff_max_seconds:
                return False
            ready_at = max(host.next_slot, host.not_before)
            if ready_at <= now:
                host.next_slot = now + host.interval
                return True
            await self._sleep(ready_at - now)

    def _backoff(self, attempts: int) -> float:
        """Full jitter: a random wait up to an exponentially growing ceiling."""
        ceiling = self._settings.backoff_base_seconds * 2 ** (attempts - 1)
        return self._rng.uniform(0, min(ceiling, self._settings.backoff_max_seconds))

    def _elapsed_ms(self, started: float) -> int:
        return round((self._clock() - started) * 1000)


def _retry_after_seconds(value: str | None, now: datetime) -> float | None:
    """A Retry-After header as seconds from `now`: either form, None if absent or invalid."""
    if value is None:
        return None
    value = value.strip()
    if value.isdecimal():
        return float(value)
    try:
        when = parsedate_to_datetime(value)
    except ValueError:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    return max(0.0, (when - now).total_seconds())
