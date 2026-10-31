import asyncio
import itertools
import logging
import random
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from email.utils import format_datetime
from typing import Any

import httpx
import pytest
import respx

from jobinsights.config import HttpSettings, RateLimit, SourceConfig
from jobinsights.http import FetchedResponse, HostNotAllowedError, PoliteClient, host_limits

URL = "https://api.test/jobs"
OTHER_URL = "https://other.test/jobs"
START = datetime(2026, 10, 30, 6, 0, tzinfo=UTC)
SETTINGS = HttpSettings(
    timeout_seconds=30, max_retries=2, backoff_base_seconds=1.0, backoff_max_seconds=60
)
NO_LIMIT = RateLimit(concurrency=10)


class FakeTime:
    """Time that only moves when someone sleeps, so tests never really wait."""

    def __init__(self) -> None:
        self.elapsed = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return 1000.0 + self.elapsed

    def now(self) -> datetime:
        return START + timedelta(seconds=self.elapsed)

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.elapsed += seconds
        await asyncio.sleep(0)  # let other tasks run, as a real sleep would


class HighestJitter(random.Random):
    """Backoff always picks the top of its range, which makes the waits predictable."""

    def uniform(self, a: float, b: float) -> float:
        return b


def make_client(
    fake: FakeTime,
    limits: dict[str, RateLimit] | None = None,
    settings: HttpSettings = SETTINGS,
) -> PoliteClient:
    return PoliteClient(
        settings,
        "jobs@acme.test",
        limits if limits is not None else {"api.test": NO_LIMIT, "other.test": NO_LIMIT},
        clock=fake.clock,
        now=fake.now,
        sleep=fake.sleep,
        rng=HighestJitter(),
    )


def fetch(fake: FakeTime, url: str = URL, **kwargs: Any) -> FetchedResponse:
    async def go() -> FetchedResponse:
        async with make_client(fake) as client:
            return await client.get(url, **kwargs)

    return asyncio.run(go())


def test_success_returns_the_body(respx_mock: respx.MockRouter) -> None:
    respx_mock.get(URL).mock(return_value=httpx.Response(200, content=b'{"jobs": []}'))

    result = fetch(FakeTime())

    assert result.ok
    assert result.status == 200
    assert result.body == b'{"jobs": []}'
    assert result.error is None
    assert result.attempts == 1
    assert result.started_at == START


def test_user_agent_includes_the_contact_email(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.get(URL).mock(return_value=httpx.Response(200))

    fetch(FakeTime())

    user_agent = route.calls.last.request.headers["user-agent"]
    assert user_agent.startswith("job-insights/")
    assert "contact: jobs@acme.test" in user_agent


def test_a_source_can_override_the_user_agent(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.get(URL).mock(return_value=httpx.Response(200))

    fetch(FakeTime(), headers={"User-Agent": "jobs@acme.test"})

    assert route.calls.last.request.headers["user-agent"] == "jobs@acme.test"


def test_the_configured_timeout_is_used(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.get(URL).mock(return_value=httpx.Response(200))

    fetch(FakeTime())

    assert route.calls.last.request.extensions["timeout"]["read"] == 30


# --- retries ------------------------------------------------------------------


@pytest.mark.parametrize("status", [429, 500, 503])
def test_retryable_status_then_success(respx_mock: respx.MockRouter, status: int) -> None:
    route = respx_mock.get(URL).mock(
        side_effect=[httpx.Response(status), httpx.Response(200, content=b"ok")]
    )

    result = fetch(FakeTime())

    assert result.ok
    assert result.body == b"ok"
    assert result.attempts == 2
    assert route.call_count == 2


def test_network_error_then_success(respx_mock: respx.MockRouter) -> None:
    respx_mock.get(URL).mock(side_effect=[httpx.ConnectError("down"), httpx.Response(200)])

    result = fetch(FakeTime())

    assert result.ok
    assert result.attempts == 2


def test_retries_exhausted_returns_the_last_failure(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.get(URL).mock(return_value=httpx.Response(503, content=b"maintenance"))

    result = fetch(FakeTime())

    assert not result.ok
    assert result.retryable
    assert result.status == 503
    assert result.body == b"maintenance"  # kept for the archive's error_body
    assert result.error == "HTTP 503"
    assert result.attempts == 3  # max_retries=2 means 3 tries in all
    assert route.call_count == 3


def test_timeouts_exhausted_returns_an_error_without_raising(
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(URL).mock(side_effect=httpx.ReadTimeout("too slow"))

    result = fetch(FakeTime())

    assert not result.ok
    assert result.retryable
    assert result.status is None
    assert result.body is None
    assert result.error == "ReadTimeout: too slow"


@pytest.mark.parametrize("status", [400, 401, 403, 404, 410])
def test_other_client_errors_are_not_retried(respx_mock: respx.MockRouter, status: int) -> None:
    route = respx_mock.get(URL).mock(return_value=httpx.Response(status, content=b"nope"))

    result = fetch(FakeTime())

    assert not result.ok
    assert not result.retryable
    assert result.status == status
    assert result.body == b"nope"
    assert route.call_count == 1


def test_redirects_are_recorded_and_not_followed(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.get(URL).mock(
        return_value=httpx.Response(301, headers={"Location": OTHER_URL})
    )

    result = fetch(FakeTime())

    assert not result.ok
    assert not result.retryable
    assert result.error == "HTTP 301"
    assert route.call_count == 1


def test_backoff_doubles_up_to_the_ceiling(respx_mock: respx.MockRouter) -> None:
    respx_mock.get(URL).mock(return_value=httpx.Response(500))
    fake = FakeTime()
    settings = HttpSettings(
        timeout_seconds=30, max_retries=4, backoff_base_seconds=1.0, backoff_max_seconds=5
    )

    async def go() -> None:
        async with make_client(fake, settings=settings) as client:
            await client.get(URL)

    asyncio.run(go())

    assert fake.sleeps == [1, 2, 4, 5]


def test_duration_covers_the_retries(respx_mock: respx.MockRouter) -> None:
    respx_mock.get(URL).mock(side_effect=[httpx.Response(500), httpx.Response(200)])

    result = fetch(FakeTime())

    assert result.duration_ms == 1000  # one 1-second backoff


# --- Retry-After ---------------------------------------------------------------


def test_retry_after_seconds_is_waited_for(respx_mock: respx.MockRouter) -> None:
    respx_mock.get(URL).mock(
        side_effect=[httpx.Response(429, headers={"Retry-After": "7"}), httpx.Response(200)]
    )
    fake = FakeTime()

    result = fetch(fake)

    assert result.ok
    assert fake.sleeps == [7]  # exactly the requested wait, with no jitter on top


def test_retry_after_http_date_is_waited_for(respx_mock: respx.MockRouter) -> None:
    when = format_datetime(START + timedelta(seconds=20), usegmt=True)
    respx_mock.get(URL).mock(
        side_effect=[httpx.Response(503, headers={"Retry-After": when}), httpx.Response(200)]
    )
    fake = FakeTime()

    result = fetch(fake)

    assert result.ok
    assert fake.sleeps == [20]


@pytest.mark.parametrize("value", ["soon", "", "-5"])
def test_an_invalid_retry_after_falls_back_to_backoff(
    respx_mock: respx.MockRouter, value: str
) -> None:
    respx_mock.get(URL).mock(
        side_effect=[httpx.Response(429, headers={"Retry-After": value}), httpx.Response(200)]
    )
    fake = FakeTime()

    result = fetch(fake)

    assert result.ok
    assert fake.sleeps == [1]


def test_retry_after_pauses_the_whole_host_but_not_others(respx_mock: respx.MockRouter) -> None:
    fake = FakeTime()
    sent_at: dict[str, float] = {}

    def record(name: str) -> Callable[[httpx.Request], httpx.Response]:
        def handler(request: httpx.Request) -> httpx.Response:
            sent_at[name] = fake.elapsed
            return httpx.Response(200)

        return handler

    respx_mock.get(URL).mock(return_value=httpx.Response(429, headers={"Retry-After": "10"}))
    respx_mock.get("https://api.test/second").mock(side_effect=record("same host"))
    respx_mock.get(OTHER_URL).mock(side_effect=record("other host"))
    no_retries = SETTINGS.model_copy(update={"max_retries": 0})

    async def go() -> None:
        async with make_client(fake, settings=no_retries) as client:
            await client.get(URL)  # returns at once, leaving api.test paused
            await client.get(OTHER_URL)
            await client.get("https://api.test/second")

    asyncio.run(go())

    assert sent_at == {"other host": 0, "same host": 10}


def test_an_oversized_retry_after_gives_up_without_calling_early(
    respx_mock: respx.MockRouter,
) -> None:
    route = respx_mock.get(URL).mock(
        return_value=httpx.Response(429, headers={"Retry-After": "120"}, content=b"slow down")
    )
    fake = FakeTime()

    async def go() -> list[FetchedResponse]:
        async with make_client(fake) as client:
            first = await client.get(URL)
            second = await client.get(URL)  # the host is still paused, so nothing is sent
            fake.elapsed += 60  # 60 seconds left, which is short enough to wait out
            route.return_value = httpx.Response(200)
            third = await client.get(URL)
            return [first, second, third]

    first, second, third = asyncio.run(go())

    assert (first.status, first.attempts, first.body) == (429, 1, b"slow down")
    assert first.retryable
    assert (second.status, second.attempts, second.duration_ms) == (None, 0, 0)
    assert second.retryable
    assert "Retry-After" in (second.error or "")
    assert third.ok
    assert fake.elapsed == 120  # the third request waited out the rest of the pause
    assert route.call_count == 2


# --- rate and concurrency limits ------------------------------------------------


def test_requests_to_a_host_are_spaced_by_its_rate_limit(respx_mock: respx.MockRouter) -> None:
    fake = FakeTime()
    sent_at: list[float] = []

    def record(request: httpx.Request) -> httpx.Response:
        sent_at.append(fake.elapsed)
        return httpx.Response(200)

    respx_mock.get(URL).mock(side_effect=record)
    limits = {"api.test": RateLimit(requests_per_minute=30, concurrency=4)}

    async def go() -> None:
        async with make_client(fake, limits) as client:
            for _ in range(3):
                await client.get(URL)

    asyncio.run(go())

    assert sent_at == [0, 2, 4]


def test_concurrent_requests_keep_the_rate_limit(respx_mock: respx.MockRouter) -> None:
    fake = FakeTime()
    sent_at: list[float] = []

    def record(request: httpx.Request) -> httpx.Response:
        sent_at.append(fake.elapsed)
        return httpx.Response(200)

    respx_mock.get(URL).mock(side_effect=record)
    limits = {"api.test": RateLimit(requests_per_minute=60, concurrency=4)}

    async def go() -> None:
        async with make_client(fake, limits) as client:
            await asyncio.gather(*(client.get(URL) for _ in range(5)))

    asyncio.run(go())

    assert len(sent_at) == 5
    gaps = [later - earlier for earlier, later in itertools.pairwise(sent_at)]
    assert all(gap >= 1 for gap in gaps)


def test_rate_limits_are_per_host(respx_mock: respx.MockRouter) -> None:
    respx_mock.get(URL).mock(return_value=httpx.Response(200))
    respx_mock.get(OTHER_URL).mock(return_value=httpx.Response(200))
    fake = FakeTime()
    limit = RateLimit(requests_per_minute=1, concurrency=1)

    async def go() -> None:
        async with make_client(fake, {"api.test": limit, "other.test": limit}) as client:
            await client.get(URL)
            await client.get(OTHER_URL)

    asyncio.run(go())

    assert fake.sleeps == []


def test_concurrency_limit_is_never_exceeded(respx_mock: respx.MockRouter) -> None:
    in_flight = 0
    peak = 0

    async def slow(request: httpx.Request) -> httpx.Response:
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        for _ in range(3):
            await asyncio.sleep(0)
        in_flight -= 1
        return httpx.Response(200)

    respx_mock.get(URL).mock(side_effect=slow)
    limits = {"api.test": RateLimit(concurrency=2)}

    async def go() -> None:
        async with make_client(FakeTime(), limits) as client:
            await asyncio.gather(*(client.get(URL) for _ in range(6)))

    asyncio.run(go())

    assert peak == 2


def test_backoff_does_not_hold_a_concurrency_slot(respx_mock: respx.MockRouter) -> None:
    fake = FakeTime()
    order: list[str] = []

    def first(request: httpx.Request) -> httpx.Response:
        order.append("first")
        return httpx.Response(500) if order.count("first") == 1 else httpx.Response(200)

    def second(request: httpx.Request) -> httpx.Response:
        order.append("second")
        return httpx.Response(200)

    respx_mock.get(URL).mock(side_effect=first)
    respx_mock.get("https://api.test/second").mock(side_effect=second)

    async def go() -> None:
        async with make_client(fake, {"api.test": RateLimit(concurrency=1)}) as client:
            await asyncio.gather(client.get(URL), client.get("https://api.test/second"))

    asyncio.run(go())

    assert order == ["first", "second", "first"]


# --- allowed hosts ---------------------------------------------------------------


@pytest.mark.parametrize("url", [OTHER_URL, "not-a-url"])
def test_a_host_without_a_limit_is_refused(url: str) -> None:
    async def go() -> None:
        async with make_client(FakeTime(), {"api.test": NO_LIMIT}) as client:
            await client.get(url)

    with pytest.raises(HostNotAllowedError):
        asyncio.run(go())


def test_host_limits_cover_every_endpoint_of_a_source() -> None:
    limit = RateLimit(requests_per_minute=60, concurrency=4)
    source = SourceConfig(
        enabled=True,
        kind="board",
        snapshot=True,
        endpoint="https://api.lever.co/v0/postings/{slug}?mode=json",
        eu_endpoint="https://api.eu.lever.co/v0/postings/{slug}?mode=json",
        detail_endpoint="https://details.lever.test/{slug}",
        rate_limit=limit,
        hash_exclude=[],
    )

    assert host_limits([source]) == {
        "api.lever.co": limit,
        "api.eu.lever.co": limit,
        "details.lever.test": limit,
    }


def test_host_limits_skip_a_source_with_no_endpoint() -> None:
    source = SourceConfig(
        enabled=False,
        kind="feed",
        snapshot=False,
        endpoint=None,
        rate_limit=NO_LIMIT,
        hash_exclude=[],
    )

    assert host_limits([source]) == {}


# --- secrets ---------------------------------------------------------------------


def test_secrets_stay_out_of_results_and_logs(
    respx_mock: respx.MockRouter, caplog: pytest.LogCaptureFixture
) -> None:
    url = "https://api.test/jobs?app_key=hunter2&page=1"
    respx_mock.get(url__startswith="https://api.test/jobs").mock(
        side_effect=httpx.ConnectError(f"could not reach {url}")
    )
    caplog.set_level(logging.DEBUG, logger="jobinsights.http")

    result = fetch(FakeTime(), url, headers={"Authorization-Key": "header-secret"})

    assert "app_key=REDACTED" in result.url
    assert "hunter2" not in result.url
    assert "hunter2" not in (result.error or "")
    assert caplog.records  # the retries were logged
    for record in caplog.records:
        logged = str(vars(record))
        assert "hunter2" not in logged
        assert "header-secret" not in logged


def test_unit_tests_cannot_reach_the_real_network() -> None:
    limits = {"api.test": NO_LIMIT}

    async def go() -> None:
        async with PoliteClient(SETTINGS, "jobs@acme.test", limits) as client:
            await client.get(URL)

    with pytest.raises(BaseException, match="tried to connect"):
        asyncio.run(go())
