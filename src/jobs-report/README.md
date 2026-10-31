# Job Insights

A daily collector of software-engineering job postings from free, official sources: company
job-board APIs (Greenhouse, Lever, Ashby, …) plus a few public feeds. Company job boards only
show what is open today, so history can't be backfilled. This project records it, every day,
so questions like "who is hiring?", "which technologies are rising?" and "how long do roles stay
open?" can be answered later.

- **Phase 1 (in progress):** reliable daily collection and storage.
- **Phase 2 (later):** normalizing titles, seniority, locations, technologies and pay, then
  answering the question bank in [PLAN.md](PLAN.md#9-phase-2-question-bank).

**Status:** Milestone 2 is done: `jobs collect` fetches about 50 company job boards from
Greenhouse, Lever and Ashby, and keeps each posting's history. Scheduling it daily is next. See
[PLAN.md](PLAN.md) for the roadmap.

## How it works

1. Every API response is saved first to a raw archive (`data/archive.sqlite`, last 90 days),
   so it can be re-parsed after a parser fix. Boards that fail are retried a few times.
2. It's then parsed into SQLite (`data/jobs.sqlite`), the system of record, which keeps each
   posting's open spans and change history. A posting closes only after it's missing from 2
   successful fetches on different days, so an outage can't look like closed jobs.
3. A DuckDB database and Parquet exports are rebuilt from SQLite for analysis.

New to the vocabulary (spans, manifests, snapshots)? See the [glossary](docs/glossary.md).

## Sources

Only free, official endpoints are used, and each is checked against its docs before an adapter
is written. Endpoints, limits, terms and the date they were checked are in
[`config/sources.yaml`](config/sources.yaml).

| Source | Type | Attribution and terms |
|---|---|---|
| [Greenhouse](https://docs.greenhouse.io/job-board.html) | Company job boards | Public job board data |
| [Lever](https://github.com/lever/postings-api) | Company job boards | Published postings are public |
| [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api) | Company job boards | Public job board data |
| [Adzuna](https://developer.adzuna.com/) | Feed | Personal and academic research use; displayed ads must credit and link to Adzuna |
| [The Muse](https://www.themuse.com/developers/api/v2) | Feed | Link back to The Muse; no redistribution of its content |
| [Remotive](https://remotive.com/) | Feed | Link back to the job on Remotive and credit Remotive as the source |
| [Remote OK](https://remoteok.com/) | Feed | Link back to the job on Remote OK and credit Remote OK as the source |
| [USAJOBS](https://developer.usajobs.gov/) | Feed | Open license; USAJOBS credited as the source |
| [Hacker News](https://github.com/HackerNews/API) "Who is hiring?" | Feed | Public HN data |

Not used, by design: LinkedIn, Indeed, Glassdoor, ZipRecruiter and We Work Remotely (terms of
service), and scraping tools such as JobSpy.

## Running it

Requires [uv](https://docs.astral.sh/uv/) (pinned in the monorepo's `.tool-versions`; run
`asdf install`) and Python 3.12.

```sh
uv sync                    # create .venv and install dependencies
cp .env.example .env       # then set CONTACT_EMAIL (and API keys as sources are enabled)
uv run jobs --help         # list commands
uv run jobs db init        # create data/ and both databases
uv run jobs collect --source boards   # fetch every board and store what changed
```

Running `jobs collect` again the same day only retries the boards that failed. It exits 0 if the
whole day is fine, 1 if some boards failed and 2 if all of them did.

Development:

```sh
uv run pytest                   # unit tests, no network
uv run pytest -m integration    # opt-in: real DuckDB (see below)
uv run pytest -m live           # opt-in: calls the real job-source APIs
uv run ruff check . && uv run ruff format .
```

Unit tests never touch the network. The two opt-in suites are kept separate so the default run
stays fast and offline:

- **`integration`** needs real infrastructure but calls no job source. Today that's DuckDB:
  the first run downloads DuckDB's sqlite extension once and caches it in `~/.duckdb`.
- **`live`** calls the real job-source APIs, and needs `CONTACT_EMAIL` set. Any other test that
  tries to use the network fails.

## Data

Everything under `data/` is local and gitignored. The raw archive holds full job descriptions
and is never published.

| File | What it holds |
|---|---|
| `data/jobs.sqlite` | The system of record: runs, fetches, companies, boards, postings, their open spans and change history, and deduplicated compressed descriptions |
| `data/archive.sqlite` | Raw API responses for the last 90 days: each job object stored once per content hash, plus a manifest per fetch |
| `data/jobs.duckdb` | An analysis copy rebuilt from SQLite (`jobs db build-duckdb`), with plain-text descriptions and the views `v_open_postings_by_day` and `v_new_postings_by_day` |
| `data/exports/*.parquet` | One Parquet file per table (`jobs db export`) |

Schema changes go through numbered migrations in `src/jobinsights/store/migrations/`, run by
`jobs db migrate`.
