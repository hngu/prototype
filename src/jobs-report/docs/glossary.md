# Glossary

Plain-language definitions of the terms used in this project's code and docs, in alphabetical
order. When a change introduces a new term, it adds the term here too.

In `PLAN.md` and code comments, **§** means "section": §5.3 is section 5.3 of `PLAN.md`.

### Adapter

The code that knows one [source](#source)'s format, with one module per source in
`src/jobinsights/sources/`. It says what URL to call, splits a response into [items](#item) and an
[envelope](#envelope), and parses an item into a [posting](#posting).

### Archive

A private database (`data/archive.sqlite`) of what each source returned, saved before any parsing
and kept for 90 days. If a parser turns out to have a bug, the data can be parsed again from here
without calling the source. See [reprocess](#reprocess).

### ATS

Applicant tracking system: the software a company uses to publish jobs. Greenhouse, Lever and Ashby
are the three we use first. They have free public APIs that return a company's whole job list.

### `ats_ref`

A shared label for one job, such as `greenhouse:stripe:12345`. The same job can reach us from
Stripe's board and from a [feed](#feed) that links to it, and matching labels show they're one job.
Built in Milestone 3.

### Board

One company's job list on one ATS. Stripe's Greenhouse jobs are one board. Identified by its ATS,
region and [slug](#slug).

### Closure

Deciding a job is no longer open, which ends its [span](#span). A job closes only after it's missing
from 2 successful [fetches](#fetch) on different days. Its `close_date` is the first day it was
missing, not the day we became sure.

### Collection

One use of `jobs collect`. It fetches boards, retries the ones that failed, then parses the saved
responses. A [run](#run) can have several collections in a day, for example if a later one picks up
boards that failed earlier.

### Discovery

Finding new company boards to track, by spotting ATS links in other data. Built in Milestone 3.

### Envelope

The part of a response that isn't the jobs themselves, such as Greenhouse's `meta: {total: 744}`.
Parsers can read it, so the [archive](#archive) keeps it alongside the [items](#item).

### Feed

A [source](#source) that returns a partial list of jobs from many companies, such as Adzuna. A job
missing from a feed tells us nothing, so feed jobs never [close](#closure). The opposite of a
[snapshot](#snapshot) source.

### Fetch

One recorded attempt to get a board or feed page. Each has a row in the `fetches` table and a
[manifest](#manifest) in the archive, whether it worked or not. Quick retries inside the HTTP client
are part of one fetch; each retry round of a [run](#run) is a new fetch.

### Fixture

A saved, trimmed copy of a real response in `tests/fixtures/<source>/`. Tests read fixtures instead
of calling the network. Recorded with `scripts/record_fixtures.py`.

### Hold

Not applying closures to a board this time, because the data looks wrong. Example: a board with 100
open jobs suddenly returns 0, which is more likely an API glitch than 100 jobs ending overnight. See
[zero-job run](#zero-job-run).

### Item

One job in a response, exactly as the source returned it. Parsers turn one item into one
[posting](#posting).

### Manifest

The archive's record of one [fetch](#fetch): when it happened, whether it worked, its
[envelope](#envelope), and which [raw objects](#raw-object) it returned. A failed fetch has one too,
so a replay can tell an outage from an empty board.

### Milestone and Phase

The stages of `PLAN.md`. Written M2 for Milestone 2. Phase 1 (Milestones 0–7) is collecting and
storing data. Phase 2 is making sense of it.

### Parser version

A label on each parser (`PARSER_VERSION`), changed whenever the parser's output changes. Each
[posting](#posting) records the version that produced it.

### Pay lookup

An extra request for one Greenhouse job, to get its structured pay range, which the board's job list
leaves out. Also called pay enrichment. Limited per [run](#run), and any open posting without a
successful lookup is eligible, newest first, so a backlog drains over several days. Each posting is
looked up once, so later pay changes aren't noticed.

### Pending absence

A job missing for the first time. It's recorded in `pending_absent_date` but the job stays open. If
the job is seen again the mark is cleared, and if it's missing on a later day too, it
[closes](#closure).

### Posting

One job as we store it: a row in the `postings` table, identified by its [source](#source) and that
source's id for the job.

### Posting version

A row in `posting_versions`, recording a posting's title, description, locations and pay text. A new
one is added only when one of those changes, so it's the job's change history.

### Raw object

One [item](#item) stored in the archive. Identical content is stored once, however many days it's
returned, which keeps the archive small.

### Reconcile

Comparing today's response for a board with the jobs we have open, then updating [spans](#span):
open new ones, record [pending absences](#pending-absence) and [close](#closure) what's confirmed
gone. Only ever done for boards whose fetch succeeded.

### Repost

A job that closed and later came back. It keeps its posting row and gets a new [span](#span).

### Reprocess

Parsing archived responses again with the current parsers (`jobs reprocess`), to fix a parser bug
without calling any source. Built in Milestone 5.

### Role filter

The rule deciding which jobs count as software engineering, from the title alone
(`src/jobinsights/role_filter.py`). Only matching jobs are stored as [postings](#posting), while the
[archive](#archive) keeps them all. It's strict on purpose, so it misses some real software roles,
such as "Data Scientist" or "Tech Lead", rather than storing a "Sales Engineer".

### Run

One day's collection, with one row in the `runs` table per UTC day. Running `jobs collect` again the
same day continues that run: boards that already succeeded aren't fetched again, and only failed
ones are retried.

### `run_date`

The UTC date a [run](#run) belongs to, written `YYYY-MM-DD`.

### Seed

A company board we chose by hand to track from day one, listed in `config/seeds.yaml`. Added only
after its API has returned a valid response.

### Slug

A company's short name in an ATS's URLs and APIs. Stripe's Greenhouse slug is `stripe`, from
`boards-api.greenhouse.io/v1/boards/stripe/jobs`.

### Snapshot

A [source](#source) where one request returns a company's complete job list. A job missing from a
snapshot may really be gone, so closures can be inferred. All board sources are snapshots.

### Source

Somewhere we get jobs from, listed in `config/sources.yaml`: an ATS such as Greenhouse, or a
[feed](#feed) such as Adzuna.

### Span

One continuous stretch of time a job was open, with an open date and a close date. A job open March
1–10 that comes back on March 20 has two spans: March 1 → March 10, and March 20 → still open.
Counting the spans that cover a date tells you how many jobs were open that day, and takes far less
space than a row per job per day.

### Upsert

Insert a row, or update it if it already exists. Upserting the same job twice leaves one row.

### Zero-job run

A successful fetch where a board returned no jobs. For a board with more than 20 open jobs, the first
2 such days are [held](#hold). On the 3rd the drop is believed, and the jobs close, dated to the first
zero day. Example: Monday 0 (held), Tuesday 0 (held), Wednesday 0 → they close with a `close_date` of
Monday.
