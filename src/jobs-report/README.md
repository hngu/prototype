# Job Insights

A daily collector of software-engineering job postings from free, official sources: company
job-board APIs (Greenhouse, Lever, Ashby, …) plus a few public feeds. Company job-board APIs return
every role, so a title filter keeps the software-engineering ones. Company job boards only
show what is open today, so history can't be backfilled. This project records it, every day,
so questions like "who is hiring?", "which technologies are rising?" and "how long do roles stay
open?" can be answered later.

- **Phase 1 (in progress):** reliable daily collection and storage.
- **Phase 2 (later):** normalizing titles, seniority, locations, technologies and pay, then
  answering the question bank in [PLAN.md](PLAN.md#9-phase-2-question-bank).

**Status:** Milestone 2.5 is running: `jobs daily` fetches about 50 company job boards from
Greenhouse, Lever and Ashby on a local schedule, and keeps each posting's history. Finding more
companies is next. See [PLAN.md](PLAN.md) for the roadmap.

## How it works

1. Every API response is saved first to a raw archive (`data/archive.sqlite`, last 90 days),
   so it can be re-parsed after a parser fix. Boards that fail are retried a few times.
2. It's then parsed into SQLite (`data/jobs.sqlite`), the system of record, which stores only
   software-engineering roles and keeps each posting's open spans and change history. A posting
   closes only after it's missing from 2
   successful fetches on different days, so an outage can't look like closed jobs.
3. A DuckDB database and Parquet exports are rebuilt from SQLite for analysis.

New to the vocabulary (spans, manifests, snapshots)? See the [glossary](docs/glossary.md).

### What counts as software engineering

The filter in [`src/jobinsights/role_filter.py`](src/jobinsights/role_filter.py) looks at the title
alone, and is strict on purpose.

- **Kept:** software, backend, frontend, data, machine learning, security and site reliability
  engineers, engineering managers, forward deployed engineers, Members of Technical Staff, and
  interns in those roles.
- **Dropped:** sales, solutions, support and customer engineers, hardware and manufacturing roles,
  and anything without an engineering word in the title.

So the data describes engineering hiring, not a company's hiring overall, and it misses some real
software roles, such as a "Tech Lead" or a title in another language. About a third of the jobs on
the current boards are kept. A job already stored stays tracked if its title changes later, so a
few non-engineering titles can appear.

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
uv run jobs daily          # fetch every board, store what changed, rebuild DuckDB
uv run jobs status         # did it work?
```

Running `jobs daily` again the same UTC day only retries the boards that failed. It exits 0 if the
whole day is fine, 1 if some boards failed or the DuckDB rebuild did, and 2 if every board failed.
`jobs collect --source <name>` does the collection alone, for one source or all of them.

### Run it every day

```sh
uv run jobs schedule       # writes the launchd file or crontab line, and prints how to load it
```

On macOS, this generates a launchd job that fires every 4 hours, with output in
`data/logs/daily.log`. The first firing in a UTC day does the work (7pm to 7pm in New York during
winter). Later firings find nothing to do unless a board failed, in which case they retry it.

- **The Mac was asleep:** launchd starts the missed firing on wake.
- **The Mac was off:** the job runs when you log in.
- **You want to run it by hand:** `uv run jobs daily` is safe at any time. If a run is already in
  progress, it says so and stops.
- **The Mac was off or asleep for a whole UTC day:** that day is lost, because job boards only show
  what's open now. Milestone 6 moves the schedule to the cloud to fix this.
- **A migration is waiting:** scheduled runs refuse to start until you run `uv run jobs db migrate`,
  and retry at the next firing.
- **Something stops working:** nothing alerts you yet. `uv run jobs status` warns when the last good
  run finished more than 36 hours ago.

Idle sleep can't interrupt a scheduled run, but closing the lid can. The next firing picks up what's
left. On Linux, `jobs schedule` generates a crontab line instead, and cron doesn't catch up on missed
firings.

#### Managing the launchd job

Run these from the project root. `jobs schedule` only writes the file, so nothing is scheduled until
you load it.

```sh
# Turn the schedule on. Loading it also starts a run straight away.
cp data/schedule/com.jobinsights.daily.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jobinsights.daily.plist

# Check it: `state` says whether it's running now, `runs` counts its starts since
# loading, and `last exit code` is 0 for ok, 1 for partial and 2 for failed.
launchctl print gui/$(id -u)/com.jobinsights.daily

# Start a run now, without waiting for the next firing.
launchctl kickstart gui/$(id -u)/com.jobinsights.daily

# Read what scheduled runs did.
tail -f data/logs/daily.log

# Stop the schedule until you load it again. The file stays in place, but launchd
# loads it again at your next login, so remove it to stop for good (below).
launchctl bootout gui/$(id -u)/com.jobinsights.daily

# Stop for good.
launchctl bootout gui/$(id -u)/com.jobinsights.daily
rm ~/Library/LaunchAgents/com.jobinsights.daily.plist
```

To change the firing times, edit `schedule` in `config/settings.yaml`, then apply it. launchd reads
the file only when it's loaded, so the job has to be unloaded first:

```sh
uv run jobs schedule
launchctl bootout gui/$(id -u)/com.jobinsights.daily
cp data/schedule/com.jobinsights.daily.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jobinsights.daily.plist
```

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
| `data/jobs.sqlite` | The system of record: runs, fetches, companies, boards, software-engineering postings, their open spans and change history, and deduplicated compressed descriptions |
| `data/archive.sqlite` | Raw API responses for the last 90 days, all roles included: each job object stored once per content hash, plus a manifest per fetch |
| `data/jobs.duckdb` | An analysis copy rebuilt from SQLite (`jobs db build-duckdb`), with plain-text descriptions and the views `v_open_postings_by_day` and `v_new_postings_by_day` |
| `data/exports/*.parquet` | One Parquet file per table (`jobs db export`) |
| `data/logs/daily.log` | Output of scheduled runs, as JSON lines plus a summary |
| `data/schedule/` | The generated launchd file or crontab line |

Schema changes go through numbered migrations in `src/jobinsights/store/migrations/`, run by
`jobs db migrate`.
