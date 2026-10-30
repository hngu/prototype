# Job Insights

A daily collector of software-engineering job postings from free, official sources: company
job-board APIs (Greenhouse, Lever, Ashby, …) plus a few public feeds. Company job boards only
show what is open today, so history can't be backfilled. This project records it, every day,
so questions like "who is hiring?", "which technologies are rising?" and "how long do roles stay
open?" can be answered later.

- **Phase 1 (in progress):** reliable daily collection and storage.
- **Phase 2 (later):** normalizing titles, seniority, locations, technologies and pay, then
  answering the question bank in [PLAN.md](PLAN.md#9-phase-2-question-bank).

**Status:** Milestone 0, scaffold. The CLI commands exist but are stubs. See [PLAN.md](PLAN.md)
for the roadmap.

## How it works

1. Every API response is saved first to a raw archive (`data/archive.sqlite`, last 90 days),
   so it can be re-parsed after a parser fix.
2. It's then parsed into SQLite (`data/jobs.sqlite`), the system of record, which keeps each
   posting's open spans and change history.
3. A DuckDB database and Parquet exports are rebuilt from SQLite for analysis.

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
```

Development:

```sh
uv run pytest              # unit tests, no network
uv run pytest -m live      # opt-in live smoke tests
uv run ruff check . && uv run ruff format .
```

## Data

Everything under `data/` is local and gitignored. The raw archive holds full job descriptions
and is never published.
