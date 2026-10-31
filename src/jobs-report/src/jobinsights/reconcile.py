"""Update one board's spans from one complete response (PLAN.md §5.3).

Call this only for a snapshot board whose fetch succeeded. A failed fetch tells
us nothing, so it never gets here (CLAUDE.md rule 9). The caller owns the
transaction, so a board's postings and spans commit together.
"""

import sqlite3
from collections import Counter
from collections.abc import Collection
from dataclasses import dataclass
from datetime import date

from jobinsights.config import ReconcileSettings
from jobinsights.store import repo
from jobinsights.store.repo import SpanEvent


@dataclass(frozen=True, slots=True)
class ReconcileResult:
    events: Counter[SpanEvent]
    # A board with many open postings returned no jobs at all, and that's not yet believed.
    held: bool = False
    # That drop was believed on this run, so the held postings were closed.
    released: bool = False


def reconcile_board(
    conn: sqlite3.Connection,
    *,
    board_id: int,
    present_ids: Collection[int],
    response_items: int,
    run_date: date,
    settings: ReconcileSettings,
    hold_absences: bool = False,
) -> ReconcileResult:
    """Mark `present_ids` present and the board's other open postings absent.

    `response_items` counts every job in the response, stored or not. Only a
    response with no jobs at all can be a glitch: one with jobs, none of them
    software engineering, shows the API working, so its absences count as usual.

    `hold_absences` keeps the absences out, for a response that had jobs we
    couldn't parse: a missing posting might be one of those.
    """
    open_ids = repo.open_posting_ids(conn, board_id)
    events: Counter[SpanEvent] = Counter(
        repo.mark_present(conn, posting_id, run_date) for posting_id in present_ids
    )
    if hold_absences:
        return ReconcileResult(events)

    absent_ids = open_ids - set(present_ids)
    if response_items == 0 and len(open_ids) > settings.suspicious_drop_min_open:
        zero_days = [*repo.zero_job_streak(conn, board_id, before=run_date), run_date]
        if len(zero_days) < settings.zero_job_runs_to_release:
            return ReconcileResult(events, held=True)
        # Believed. The jobs went missing on the first zero day, so that's their
        # close date; the existing state machine gets there from these two absences.
        for posting_id in absent_ids:
            first = repo.mark_absent(conn, posting_id, zero_days[0])
            second = repo.mark_absent(conn, posting_id, run_date)
            # A posting that was already pending closes on the first call.
            events[first if second is SpanEvent.UNCHANGED else second] += 1
        return ReconcileResult(events, released=True)

    events.update(repo.mark_absent(conn, posting_id, run_date) for posting_id in absent_ids)
    return ReconcileResult(events)
