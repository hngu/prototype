# Job Insights — instructions for Claude Code

## What this project is

A daily collector of software-engineering job postings from **free, official sources**: company job-board APIs (Greenhouse, Lever, Ashby, …) plus a few public aggregators and feeds. Every response is first saved to a **raw archive** (`data/archive.sqlite`, last 90 days), then parsed into **SQLite** (`data/jobs.sqlite`, the system of record). A **DuckDB** copy plus Parquet exports are rebuilt from SQLite for analysis.

- **Phase 1 (now):** reliable daily collection and storage.
- **Phase 2 (later):** normalization and the question bank at the bottom of PLAN.md.

The repo is public and meant to be shown off, so clean code, tests and a clear README matter.

**PLAN.md is the roadmap.** Work one milestone at a time, in order. Tick the checkboxes in PLAN.md as items are done, and don't start the next milestone until the current one's acceptance criteria pass.

## Stack

- Python 3.12, managed with `uv`
- `httpx` (async) for HTTP, `pydantic` v2 for models, `typer` for the CLI (`jobs`)
- `sqlite3` (stdlib) for the system of record, `duckdb` for analytics (plus `numpy`, which DuckDB's Python UDFs require)
- `pytest` + `respx` for tests, `ruff` for lint and format
- `PyYAML` for config, `python-dotenv` for secrets
- `selectolax` for HTML → plain text
- `boto3` for Cloudflare R2 (Milestone 6 only)

Ask before adding any other dependency.

## Commands

Keep this list current as commands are added.

- `uv run jobs --help`
- `uv run jobs db init`: create `data/` and both databases, applying all migrations
- `uv run jobs db migrate`: apply pending migrations to both databases
- `uv run jobs db build-duckdb`: rebuild `data/jobs.duckdb` from SQLite
- `uv run jobs db export`: write one Parquet file per table to `data/exports/`
- `uv run jobs daily`: the full daily pipeline
- `uv run jobs reprocess --from YYYY-MM-DD --to YYYY-MM-DD`: re-parse archived data with the current parsers. It's a dry run that prints a diff by default; add `--apply` to write.
- `uv run pytest`: unit tests, no network
- `uv run pytest -m live`: opt-in live smoke tests (the default pytest config deselects `live`; passing `-m live` overrides it)
- `uv run pytest -m integration`: opt-in tests that need real infrastructure but call no job source (DuckDB and its sqlite extension, downloaded once to `~/.duckdb`)
- `uv run ruff check . && uv run ruff format .`
- `uv run python scripts/record_fixtures.py <source> <slug>... [--jobs N]`: record trimmed test fixtures from real boards; needs `CONTACT_EMAIL`, and checks that every job on the board parses

## Hard rules

1. **Free and permitted sources only.** Use only the sources enabled in `config/sources.yaml`.
   - Do not scrape LinkedIn, Indeed, Glassdoor, ZipRecruiter or We Work Remotely.
   - Do not add JobSpy or similar scrapers.
   - Paid APIs stay disabled by default.
2. **Verify, don't guess.** Before writing an adapter, read the source's official docs. Confirm the endpoint, parameters, limits and terms, and record what you found (doc URL + date checked) in `config/sources.yaml`. If the docs disagree with PLAN.md, follow the docs and update PLAN.md.
3. **Never invent an ATS slug.** A board is added only after its API returns a valid response.
4. **Be polite.** Every HTTP call goes through the shared client in `src/jobinsights/http.py`. It handles:
   - per-host rate limits and timeouts
   - retries with backoff and jitter on 429/5xx, honoring `Retry-After`
   - a User-Agent that includes the contact email from `.env`

   Respect each source's stated limits (for example, Remotive: at most 4 fetches a day).
5. **No live network calls in unit tests.** Use recorded, trimmed fixtures in `tests/fixtures/<source>/`. Live checks are marked `@pytest.mark.live` and skipped by default. Tests that need real infrastructure but no job source (DuckDB) are marked `@pytest.mark.integration`, live in `tests/integration/`, and are skipped by default too; don't stub that infrastructure.
6. **Two write targets, in this order.** For every fetch, successful or not:
   1. write the raw archive entry (`data/archive.sqlite`, PLAN.md §5.4)
   2. then parse into SQLite (`data/jobs.sqlite`)

   Creating the `fetches` row first to get a `fetch_id` is fine. What matters is that the raw data is saved before parsing starts.

   DuckDB, Parquet and reports are derived from SQLite; collectors never write to them.
7. **Store raw, derive later.** Keep fields as the source gave them (`*_raw` columns). Normalizing titles, seniority, locations and technologies is Phase 2; don't put it in collectors.
   - Parsing must be a pure function of an archived item, its envelope and its board, so it can be re-run from the archive alone.
   - Bump an adapter's `PARSER_VERSION` whenever its output changes. Fix parser bugs with `jobs reprocess`, never with ad-hoc SQL updates.
8. **Idempotent runs.** A run is keyed by its UTC date. Re-running the same day must not duplicate rows or create false closures.
9. **A failed fetch is not a closed job.** Only close postings for a board whose fetch succeeded in that run (see the closure rules in PLAN.md).
10. **One source failing must not fail the run.** Record the error in the `fetches` table and its archive manifest, then continue.
11. **Secrets live in `.env`**, which is never committed. Keep `.env.example` up to date. Redact API keys from request URLs and headers before anything is archived or logged. Everything under `data/` is gitignored, and the archive is never published.
12. **Schema changes go through numbered migrations** in `src/jobinsights/store/migrations/` (and `migrations/archive/` for the archive). Never edit a migration that has already been applied.
13. **Archive retention is 90 days**, set in `config/settings.yaml`. Don't shorten it, or delete archive data outside the pruning step, without asking.

## Conventions

- Type hints everywhere and small modules. One adapter per source in `src/jobinsights/sources/`.
- Each adapter:
  - yields `PostingRecord` objects (defined in PLAN.md)
  - declares `snapshot=True` if one fetch returns a company's complete board (so closures can be inferred), or `snapshot=False` for partial feeds
- All timestamps are UTC ISO-8601. `run_date` is `YYYY-MM-DD`.
- Log structured JSON lines to stdout. Each log line includes `run_id` and `source` where relevant.
- Prefer clear SQL over clever ORMs; no ORM.
- `docs/glossary.md` defines the project's terms in plain language. A change that introduces a new term adds it there too.
