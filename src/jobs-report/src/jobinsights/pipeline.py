"""Collect company job boards for one UTC day (PLAN.md §6).

A collection has three phases:

1. Fetch every board that has no good response today, and archive each response.
2. Retry only the failed boards, with waits between rounds.
3. Parse the saved responses from the archive, keep the software-engineering jobs,
   then upsert and reconcile, in one transaction per board.

Nothing is parsed until fetching ends, so the day is processed as one run. Running
it again the same day continues that run: boards with a good response aren't
fetched again, and a response saved before a crash is processed without refetching.

SQLite calls are synchronous and nothing awaits inside a transaction, so one
connection per database is safe across the concurrent fetches.
"""

import asyncio
import json
import logging
import random
import sqlite3
from collections.abc import Awaitable, Callable, Collection, Mapping
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any

from jobinsights import archive
from jobinsights.archive import ArchiveItem
from jobinsights.config import SeedBoard, Settings, SourceConfig
from jobinsights.http import FetchedResponse, PoliteClient
from jobinsights.models import PostingRecord
from jobinsights.reconcile import reconcile_board
from jobinsights.role_filter import ROLE_FILTER_VERSION, is_software_engineering
from jobinsights.sources import greenhouse
from jobinsights.sources.base import BoardAdapter
from jobinsights.store import repo
from jobinsights.store.repo import ActiveBoard, BoardFetch, PayCandidate, RunStatus, SpanEvent

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SourceCounts:
    boards_ok: int = 0
    boards_failed: int = 0
    boards_already_done: int = 0
    retries: int = 0
    items: int = 0  # every job in the responses
    skipped: int = 0  # not software engineering, so archived but not stored
    objects_stored: int = 0
    new: int = 0
    changed: int = 0
    opened: int = 0
    reopened: int = 0
    pending: int = 0
    closed: int = 0
    held: int = 0
    released: int = 0
    parse_errors: int = 0
    pay_lookups: int = 0
    pay_found: int = 0
    pay_failed: int = 0


@dataclass(slots=True)
class CollectResult:
    run_date: date
    status: RunStatus
    nothing_to_do: bool = False
    sources: dict[str, SourceCounts] = field(default_factory=dict)
    failed_boards: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class _Outcome:
    saved: bool  # a good response is now in the archive
    retryable: bool


def sync_seeds(conn: sqlite3.Connection, seeds: Collection[SeedBoard], run_date: date) -> None:
    """Add seed companies and boards. Ones already known are left as they are."""
    with conn:
        for seed in seeds:
            company_id = repo.upsert_company(conn, seed.name, run_date)
            repo.upsert_board(
                conn,
                seed.ref,
                status="active",
                discovered_via="seed",
                discovered_date=run_date,
                company_id=company_id,
            )


async def collect_boards(
    *,
    jobs_conn: sqlite3.Connection,
    archive_conn: sqlite3.Connection,
    client: PoliteClient,
    adapters: Mapping[str, BoardAdapter],
    sources: Mapping[str, SourceConfig],
    settings: Settings,
    run_date: date,
    now: Callable[[], datetime],
    force: bool = False,
    git_sha: str | None = None,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    rng: random.Random | None = None,
) -> CollectResult:
    """Collect today's boards for the sources in `adapters`.

    `force` fetches every board again. It stays in the same run, and same-day
    absences still never close anything.
    """
    collection = _Collection(
        jobs_conn=jobs_conn,
        archive_conn=archive_conn,
        client=client,
        adapters=adapters,
        sources=sources,
        settings=settings,
        run_date=run_date,
        now=now,
        sleep=sleep,
        rng=rng or random.Random(),
    )
    return await collection.run(force=force, git_sha=git_sha)


class _Collection:
    def __init__(
        self,
        *,
        jobs_conn: sqlite3.Connection,
        archive_conn: sqlite3.Connection,
        client: PoliteClient,
        adapters: Mapping[str, BoardAdapter],
        sources: Mapping[str, SourceConfig],
        settings: Settings,
        run_date: date,
        now: Callable[[], datetime],
        sleep: Callable[[float], Awaitable[None]],
        rng: random.Random,
    ) -> None:
        self.jobs = jobs_conn
        self.archive = archive_conn
        self.client = client
        self.adapters = adapters
        self.sources = sources
        self.settings = settings
        self.run_date = run_date
        self.now = now
        self.sleep = sleep
        self.rng = rng
        self.counts = {name: SourceCounts() for name in adapters}
        self.run_id = 0  # set in run(), before anything uses it

    async def run(self, *, force: bool, git_sha: str | None) -> CollectResult:
        boards = [
            board for ats in self.adapters for board in repo.active_boards(self.jobs, ats=ats)
        ]
        existing_run = repo.find_run(self.jobs, self.run_date)
        earlier = repo.board_fetches(self.jobs, existing_run) if existing_run else []
        saved_ids = self._saved_fetch_ids()
        has_response = {fetch.board_id for fetch in earlier if fetch.fetch_id in saved_ids}

        to_fetch = boards if force else [b for b in boards if b.board_id not in has_response]
        board_ids = {board.board_id for board in boards}
        leftovers = [
            fetch
            for fetch in earlier
            if fetch.fetch_id in saved_ids
            and fetch.processed_at is None
            and fetch.board_id in board_ids
        ]
        if not to_fetch and not leftovers and not self._pay_candidates(existing_run):
            return self._nothing_to_do(boards, existing_run)

        with self.jobs:
            self.run_id = repo.get_or_start_run(self.jobs, self.run_date, self.now(), git_sha)
        objects_before = {name: archive.count_objects(self.archive, name) for name in self.adapters}
        already_done = {b.board_id for b in boards} - {b.board_id for b in to_fetch}
        for board in boards:
            if board.board_id in already_done:
                self.counts[board.ref.ats].boards_already_done += 1

        try:
            failed = await self._fetch_with_retries(to_fetch)
            self._process_saved_responses(boards)
            self._record_failures(failed, earlier)
            await self._look_up_pay()
            for name, before in objects_before.items():
                stored = archive.count_objects(self.archive, name) - before
                self.counts[name].objects_stored = stored
            status = self._run_status()
        except BaseException:
            # A crash isn't a clean finish; the next collection continues from the archive.
            with self.jobs:
                repo.finish_run(self.jobs, self.run_id, "failed", self.now(), self._summary())
            raise

        with self.jobs:
            repo.finish_run(self.jobs, self.run_id, status, self.now(), self._summary())
        return CollectResult(
            run_date=self.run_date,
            status=status,
            sources=self.counts,
            failed_boards=[_board_name(board) for board in failed],
        )

    def _nothing_to_do(self, boards: list[ActiveBoard], run_id: int | None) -> CollectResult:
        for board in boards:
            self.counts[board.ref.ats].boards_already_done += 1
        status: RunStatus = "ok"
        if run_id is not None:
            self.run_id = run_id
            status = self._run_status()
        return CollectResult(
            run_date=self.run_date, status=status, nothing_to_do=True, sources=self.counts
        )

    def _saved_fetch_ids(self) -> set[int]:
        """Today's fetches whose complete response is in the archive."""
        manifests = archive.iter_manifests(self.archive, self.run_date, self.run_date)
        return {manifest.fetch_id for manifest in manifests if manifest.ok}

    def _pay_candidates(self, run_id: int | None) -> list[PayCandidate]:
        """Postings to look up pay for, up to what's left of today's cap."""
        if greenhouse.NAME not in self.adapters:
            return []
        cap = self.settings.caps.greenhouse_pay_enrichment_per_run
        used = repo.pay_lookups_in_run(self.jobs, greenhouse.NAME, run_id) if run_id else 0
        if used >= cap:
            return []
        return repo.pay_candidates(self.jobs, greenhouse.NAME, cap - used, run_id)

    # --- fetching ------------------------------------------------------------------

    async def _fetch_with_retries(self, boards: list[ActiveBoard]) -> list[ActiveBoard]:
        """Fetch and archive each board, retrying failures. Returns the boards still failing."""
        gave_up: list[ActiveBoard] = []
        waiting = boards
        for attempt in range(self.settings.collect.retries + 1):
            if not waiting:
                break
            if attempt > 0:
                await self._wait_before_retry(attempt, waiting)
            outcomes = await asyncio.gather(*(self._fetch_board(board) for board in waiting))
            results = list(zip(waiting, outcomes, strict=True))
            gave_up += [board for board, o in results if not o.saved and not o.retryable]
            waiting = [board for board, o in results if not o.saved and o.retryable]
        return gave_up + waiting

    async def _wait_before_retry(self, attempt: int, boards: list[ActiveBoard]) -> None:
        for board in boards:
            self.counts[board.ref.ats].retries += 1
        base = self.settings.collect.retry_backoff_seconds * 2 ** (attempt - 1)
        delay = base * self.rng.uniform(1, 1.25)
        logger.warning(
            "retrying failed boards",
            extra={
                "run_id": self.run_id,
                "attempt": attempt,
                "boards": [_board_name(board) for board in boards],
                "delay_seconds": round(delay, 1),
            },
        )
        await self.sleep(delay)

    async def _fetch_board(self, board: ActiveBoard) -> _Outcome:
        ats = board.ref.ats
        started_at = self.now()
        url = ""
        try:
            url = self.adapters[ats].request_url(board.ref, self.sources[ats])
            response = await self.client.get(url)
            return self._save_response(board, response)
        except Exception as exc:
            # A bug in one board must not stop the others (CLAUDE.md rule 10).
            error = f"{type(exc).__name__}: {exc}"
            logger.exception(
                "fetch failed unexpectedly",
                extra={"run_id": self.run_id, "source": ats, "board": board.ref.slug},
            )
            self._save_fetch(
                board,
                url=url,
                started_at=started_at,
                ok=False,
                http_status=None,
                duration_ms=0,
                error=error,
                error_body=error.encode(),
            )
            return _Outcome(saved=False, retryable=False)

    def _save_response(self, board: ActiveBoard, response: FetchedResponse) -> _Outcome:
        """Archive a response, whatever it is, before anything parses it (CLAUDE.md rule 6)."""
        ats = board.ref.ats
        common = {
            "url": response.url,
            "started_at": response.started_at,
            "http_status": response.status,
            "duration_ms": response.duration_ms,
        }
        if not response.ok:
            self._save_fetch(
                board,
                **common,
                ok=False,
                error=response.error,
                error_body=response.body or (response.error or "").encode(),
            )
            logger.warning(
                "fetch failed",
                extra={
                    "run_id": self.run_id,
                    "source": ats,
                    "board": board.ref.slug,
                    "error": response.error,
                },
            )
            return _Outcome(saved=False, retryable=response.retryable)

        payload = _decode(response.body or b"")
        try:
            split = self.adapters[ats].split(payload, board.ref)
        except Exception as exc:
            # Unexpected or incomplete: keep the whole body, and it counts as a failure.
            error = f"{type(exc).__name__}: {exc}"
            self._save_fetch(
                board,
                **common,
                ok=False,
                items=[ArchiveItem(native_id=None, body=payload, kind="response")],
                error=error,
                error_body=error.encode(),
            )
            logger.warning(
                "response was malformed",
                extra={
                    "run_id": self.run_id,
                    "source": ats,
                    "board": board.ref.slug,
                    "error": error,
                },
            )
            return _Outcome(saved=False, retryable=True)

        self._save_fetch(board, **common, ok=True, envelope=split.envelope, items=split.items)
        logger.info(
            "fetched",
            extra={
                "run_id": self.run_id,
                "source": ats,
                "board": board.ref.slug,
                "items": len(split.items),
            },
        )
        return _Outcome(saved=True, retryable=False)

    def _save_fetch(
        self,
        board: ActiveBoard,
        *,
        target: str | None = None,
        url: str,
        started_at: datetime,
        ok: bool,
        http_status: int | None,
        duration_ms: int,
        envelope: Any = None,
        items: list[ArchiveItem] | None = None,
        error: str | None = None,
        error_body: bytes | None = None,
    ) -> int:
        """Record one fetch: its row, then its manifest and objects. Returns its id.

        The row's `ok` stays 0 even for a good response, until it has been parsed.
        """
        ats = board.ref.ats
        target = target or board.ref.slug
        with self.jobs:
            fetch_id = repo.start_fetch(
                self.jobs, self.run_id, ats, target, started_at, board_id=board.board_id
            )
        archive.write_manifest(
            self.archive,
            fetch_id=fetch_id,
            run_date=self.run_date,
            source=ats,
            target=target,
            request_url=url,
            ok=ok,
            http_status=http_status,
            envelope=envelope,
            items=items or [],
            error_body=error_body,
            hash_exclude=self.sources[ats].hash_exclude,
        )
        with self.jobs:
            repo.finish_fetch(
                self.jobs,
                fetch_id,
                ok=False,
                http_status=http_status,
                item_count=None,
                duration_ms=duration_ms,
                error=error,
            )
        return fetch_id

    # --- processing ------------------------------------------------------------------

    def _process_saved_responses(self, boards: list[ActiveBoard]) -> None:
        by_id = {board.board_id: board for board in boards}
        saved_ids = self._saved_fetch_ids()
        for fetch in repo.board_fetches(self.jobs, self.run_id):
            if (
                fetch.fetch_id in saved_ids
                and fetch.processed_at is None
                and fetch.board_id in by_id
            ):
                self._process_fetch(fetch, by_id[fetch.board_id])

    def _process_fetch(self, fetch: BoardFetch, board: ActiveBoard) -> None:
        ats = board.ref.ats
        counts = self.counts[ats]
        log_context = {"run_id": self.run_id, "source": ats, "board": board.ref.slug}
        try:
            archived = archive.read_fetch(self.archive, fetch.fetch_id)
            if archived is None:
                raise archive.ArchiveError(f"fetch {fetch.fetch_id} has no manifest")

            adapter = self.adapters[ats]
            parsed: list[tuple[PostingRecord, str]] = []
            parse_errors = 0
            for item in archived.items:
                try:
                    parsed.append(
                        (adapter.parse(item.body, archived.envelope, board.ref), item.hash)
                    )
                except Exception:
                    # A bad job isn't a closed job; see `hold_absences` below.
                    parse_errors += 1
                    logger.exception(
                        "job failed to parse", extra={**log_context, "native_id": item.native_id}
                    )

            new = changed = skipped = 0
            with self.jobs:
                present = set()
                stored = repo.stored_native_ids(self.jobs, ats, board.board_id)
                for record, object_hash in parsed:
                    # Once stored, a job stays tracked whatever its title becomes, because
                    # dropping it now would look like it had closed. The archive keeps the rest.
                    if record.native_id not in stored and not is_software_engineering(record.title):
                        skipped += 1
                        continue
                    result = repo.upsert_posting(
                        self.jobs,
                        record,
                        run_date=self.run_date,
                        parser_version=adapter.PARSER_VERSION,
                        archive_hash=object_hash,
                        board_id=board.board_id,
                        company_id=board.company_id,
                        keep_if_none=adapter.KEEP_IF_NONE,
                    )
                    present.add(result.posting_id)
                    new += int(result.is_new)
                    changed += int(result.changed)
                reconciled = reconcile_board(
                    self.jobs,
                    board_id=board.board_id,
                    present_ids=present,
                    response_items=len(archived.items),
                    run_date=self.run_date,
                    settings=self.settings.reconcile,
                    hold_absences=parse_errors > 0,
                )
                repo.record_board_success(self.jobs, board.board_id, self.run_date)
                error = None
                if parse_errors:
                    error = f"parse errors: {parse_errors} of {len(archived.items)}"
                elif reconciled.held:
                    error = "held: the board dropped to 0 jobs, so closures weren't applied"
                elif reconciled.released:
                    error = "released: the board's drop to 0 jobs was believed, so its jobs closed"
                repo.mark_fetch_processed(
                    self.jobs,
                    fetch.fetch_id,
                    ok=parse_errors == 0,
                    item_count=len(archived.items),
                    processed_at=self.now(),
                    error=error,
                )
        except Exception as exc:
            logger.exception("processing failed", extra=log_context)
            with self.jobs:
                repo.mark_fetch_processed(
                    self.jobs,
                    fetch.fetch_id,
                    ok=False,
                    item_count=None,
                    processed_at=self.now(),
                    error=f"{type(exc).__name__}: {exc}",
                )
            counts.boards_failed += 1
            return

        counts.boards_ok += 1
        counts.items += len(archived.items)
        counts.skipped += skipped
        counts.new += new
        counts.changed += changed
        counts.parse_errors += parse_errors
        counts.opened += reconciled.events[SpanEvent.OPENED]
        counts.reopened += reconciled.events[SpanEvent.REOPENED]
        counts.pending += reconciled.events[SpanEvent.PENDING]
        counts.closed += reconciled.events[SpanEvent.CLOSED]
        counts.held += int(reconciled.held)
        counts.released += int(reconciled.released)
        if error:
            logger.warning(error, extra=log_context)

    def _record_failures(self, failed: list[ActiveBoard], earlier: list[BoardFetch]) -> None:
        """Count each failing board once per day, however many attempts it took."""
        already_tried = {fetch.board_id for fetch in earlier}
        for board in failed:
            self.counts[board.ref.ats].boards_failed += 1
            logger.error(
                "board still failing after retries",
                extra={"run_id": self.run_id, "source": board.ref.ats, "board": board.ref.slug},
            )
            if board.board_id not in already_tried:
                with self.jobs:
                    repo.record_board_failure(self.jobs, board.board_id)

    # --- pay lookups ----------------------------------------------------------------

    async def _look_up_pay(self) -> None:
        """Ask Greenhouse for pay on postings that haven't had a lookup yet.

        These are extras: a failure is counted and tried again another day, and
        never affects the run's status, its boards or their closures.
        """
        candidates = self._pay_candidates(self.run_id)
        boards = {b.ref: b for b in repo.active_boards(self.jobs, ats=greenhouse.NAME)}
        await asyncio.gather(*(self._look_up_one(c, boards[c.board]) for c in candidates))

    async def _look_up_one(self, candidate: PayCandidate, board: ActiveBoard) -> None:
        counts = self.counts[greenhouse.NAME]
        counts.pay_lookups += 1
        try:
            await self._fetch_pay(candidate, board)
        except Exception:
            counts.pay_failed += 1
            logger.exception(
                "pay lookup failed unexpectedly",
                extra={
                    "run_id": self.run_id,
                    "source": greenhouse.NAME,
                    "native_id": candidate.native_id,
                },
            )

    async def _fetch_pay(self, candidate: PayCandidate, board: ActiveBoard) -> None:
        counts = self.counts[greenhouse.NAME]
        target = f"{repo.PAY_TARGET_PREFIX}{candidate.native_id}"
        job_id = candidate.native_id.removeprefix(f"{board.ref.slug}:")
        source = self.sources[greenhouse.NAME]
        log_context = {
            "run_id": self.run_id,
            "source": greenhouse.NAME,
            "native_id": candidate.native_id,
        }
        response = await self.client.get(greenhouse.detail_url(board.ref, job_id, source))
        common = {
            "target": target,
            "url": response.url,
            "started_at": response.started_at,
            "http_status": response.status,
            "duration_ms": response.duration_ms,
        }
        if not response.ok:
            counts.pay_failed += 1
            logger.warning("pay lookup failed", extra={**log_context, "error": response.error})
            self._save_fetch(
                board,
                **common,
                ok=False,
                error=response.error,
                error_body=response.body or (response.error or "").encode(),
            )
            return

        payload = _decode(response.body or b"")
        if not isinstance(payload, dict):
            counts.pay_failed += 1
            error = f"expected an object, got {type(payload).__name__}"
            logger.warning("pay lookup failed", extra={**log_context, "error": error})
            self._save_fetch(
                board,
                **common,
                ok=False,
                items=[ArchiveItem(native_id=None, body=payload, kind="response")],
                error=error,
                error_body=error.encode(),
            )
            return

        fetch_id = self._save_fetch(
            board,
            **common,
            ok=True,
            items=[ArchiveItem(native_id=candidate.native_id, body=payload, kind="detail")],
        )
        try:
            pay = greenhouse.parse_pay_detail(payload, None, board.ref)
            with self.jobs:
                repo.set_posting_pay(self.jobs, candidate.posting_id, pay, self.run_date)
                repo.mark_fetch_processed(
                    self.jobs, fetch_id, ok=True, item_count=1, processed_at=self.now()
                )
        except Exception as exc:
            counts.pay_failed += 1
            logger.exception("pay lookup failed to parse", extra=log_context)
            with self.jobs:
                repo.mark_fetch_processed(
                    self.jobs,
                    fetch_id,
                    ok=False,
                    item_count=1,
                    processed_at=self.now(),
                    error=f"{type(exc).__name__}: {exc}",
                )
            return
        counts.pay_found += int(pay.salary_raw is not None)

    # --- results ---------------------------------------------------------------------

    def _run_status(self) -> RunStatus:
        """The status of the whole day, including earlier collections."""
        fetches = repo.board_fetches(self.jobs, self.run_id)
        saved_ids = self._saved_fetch_ids()
        boards = {fetch.board_id for fetch in fetches}
        good = {fetch.board_id for fetch in fetches if fetch.ok}
        if good == boards:
            return "ok"
        if not any(fetch.fetch_id in saved_ids for fetch in fetches):
            return "failed"
        return "partial"

    def _summary(self) -> dict[str, Any]:
        """Every collection of the day so far, oldest first."""
        row = self.jobs.execute(
            "SELECT summary_json FROM runs WHERE run_id = ?", (self.run_id,)
        ).fetchone()
        previous = json.loads(row["summary_json"]) if row["summary_json"] else {"collections": []}
        sources = {name: asdict(counts) for name, counts in self.counts.items()}
        this_one = {"role_filter_version": ROLE_FILTER_VERSION, "sources": sources}
        return {"collections": [*previous["collections"], this_one]}


def _board_name(board: ActiveBoard) -> str:
    return f"{board.ref.ats}/{board.ref.slug}"


def _decode(body: bytes) -> Any:
    """Parsed JSON, or the text itself when the body isn't JSON."""
    try:
        return json.loads(body)
    except ValueError:
        return body.decode("utf-8", errors="replace")
