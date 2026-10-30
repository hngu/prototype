# Job Insights — Phase 1 Plan: Daily Collection

> **How to use this file with Claude Code:** put this file and `CLAUDE.md` in an empty repo, start `claude`, and say:
> *"Read CLAUDE.md and PLAN.md. Plan Milestone 0, then implement it."*
> Repeat milestone by milestone. Tick the checkboxes as items are done.

---

## 1. Goal and scope

Build a free, reliable pipeline that collects software-engineering job postings **every day**, keeps their history, and stores it in SQLite, with DuckDB and Parquet copies for analysis.

The end product is a public project that:
1. answers our own questions about the job market, and
2. is worth showing off.

**In scope for Phase 1:** collection, storage, a 90-day raw archive for reprocessing, company discovery, daily scheduling, health checks, and a written question bank for Phase 2.

**Out of scope for Phase 1:**
- Title, seniority, location and technology normalization
- Deduplicating postings across sources
- Charts, reports and a public dashboard

Phase 1 stores everything those later phases need.

**Why start now:** company job boards only show jobs that are open today. History can't be backfilled, so getting a minimal daily run going early (Milestone 2.5) matters more than anything else. The raw archive (§5.4) starts the same day for the same reason: a response that wasn't archived when it was fetched can never be re-parsed.

---

## 2. Key design decisions

| Decision | Choice | Why |
|---|---|---|
| Storage | **Two write targets:** the raw archive (`data/archive.sqlite`, what each source returned) and SQLite (`data/jobs.sqlite`, the parsed system of record). DuckDB and Parquet are rebuilt from SQLite after every run. | One write path for parsed data means the analysis copies can never drift from SQLite. SQLite handles row-level upserts well; DuckDB is fast for the aggregations Phase 2 needs. DuckDB reads SQLite directly via `ATTACH ... (TYPE sqlite)`. |
| Backbone sources | Company job-board APIs: Greenhouse, Lever, Ashby (more later) | Free, official and complete per company, with full descriptions. One request returns a whole board. |
| Breadth and discovery | Free feeds: Adzuna, The Muse, Remotive, Remote OK, USAJOBS, HN "Who is hiring?" | Wider coverage. Their apply links reveal new companies whose job boards we can then track directly. |
| Snapshot vs. feed | Each source declares whether one fetch returns a company's complete board (`snapshot=True`) or a partial list (`snapshot=False`). | Closed jobs can only be inferred from complete snapshots. For feeds, a job missing from today's results tells us nothing. |
| History model | `first_seen_date` / `last_seen_date` per posting, plus **open spans** (`posting_spans`) and a **change log** (`posting_versions`) | Spans give exact "open on day X" counts and catch reposts. They're far smaller than a row per posting per day. |
| False closures | A posting closes only after it's **absent from 2 consecutive successful fetches** of its board. `close_date` = first absent date. | Protects against API hiccups and partial responses. |
| Fixed company panel | Every board records `first_tracked_date` and `discovered_via` | As discovery adds companies, total job counts rise even if nobody is hiring more. Phase 2 measures trends on a fixed set of companies. |
| Descriptions | Stored once per unique text (`sha256` hash), as zlib-compressed plain text in SQLite. The DuckDB build decompresses them. | Most text repeats day to day. Compression keeps the database small enough for free storage tiers. |
| Raw archive | Every fetch is archived **before parsing**: each job object as the source returned it, stored once per content hash, plus a daily manifest of which objects each fetch returned and whether it succeeded. Kept **90 days** (configurable). Parsers are versioned, and `jobs reprocess` re-parses archived data after a parser fix or schema change (§5.4). | Most jobs look the same every day, so storing each object once keeps 90 days small. Manifests record failed fetches too, so a replay can't turn an outage into fake closures. Data older than 90 days survives only as parsed rows, an accepted trade-off for now. |
| Hosting | **Local scheduled runs first** (Milestone 2.5), then GitHub Actions with data in Cloudflare R2 (Milestone 6) | Local is free and immediate. The cloud version runs even when the laptop is off. Only one of the two is ever the primary writer. |
| Cost | $0 | Every source, the runner and the storage are on free tiers. |

---

## 3. Sources

**Verify before building each adapter (CLAUDE.md, rule 2):** confirm the endpoint, parameters, limits and terms in official docs. Record the doc URL and the check date in `config/sources.yaml`.

### 3.1 Company job boards (complete snapshots, closures inferable)

| Source | Endpoint (verify) | Auth | Notes |
|---|---|---|---|
| greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | none | Returns the whole board in one request. **Structured pay ranges** come only from the single-job endpoint `GET .../jobs/{id}?pay_transparency=true` (field `pay_input_ranges`). Call it only for *new* postings, with a per-run cap; the range text often appears inside `content` too. EU-hosted boards exist (`job-boards.eu.greenhouse.io`), so check their API host. |
| lever | `GET https://api.lever.co/v0/postings/{slug}?mode=json` | none | Has a structured `salaryRange` when the employer publishes one. Check the EU host (`api.eu.lever.co`). |
| ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` | none | Compensation is included when published. |
| workable | `GET https://www.workable.com/api/accounts/{slug}?details=true` | none | Optional, after Milestone 4. Documented public endpoint, one response per account. |
| smartrecruiters | `GET https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=&offset=` | unclear | Optional, after Milestone 4. Paginated. Docs mention API key / OAuth; confirm unauthenticated listing with a live probe. |
| recruitee | `GET https://{slug}.recruitee.com/api/offers/` | none until 2027-02-10 | Optional. From 2027-02-10 every call needs a token generated inside the company's own account, which rules out third-party collection. Don't build unless that changes. |

`native_id` for these sources is `"{slug}:{job_id}"`, so it's unique within the source.

### 3.2 Feeds (partial; closures NOT inferable)

| Source | Endpoint (verify) | Auth | Limits and terms |
|---|---|---|---|
| adzuna | `GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}` with `app_id`, `app_key`, `category=it-jobs`, `results_per_page=50`, `max_days_old=1`, `sort_by=date` | free app_id + app_key | The public docs give no numbers: the free tier "is intended for evaluating the API" and limits "are shown in your account", so read the budget from the developer dashboard before enabling. Max results per page, `category`, `max_days_old` and `sort_by` are in the interactive reference; confirm them there. Pull only new jobs each day and enforce a monthly call budget. **Terms:** permitted uses include "personal and academic research"; commercial analysis or resale needs Adzuna's written agreement, and displayed ads must credit and link to Adzuna. Don't put Adzuna data in a published dataset without rechecking. Start with `us`; make countries configurable. |
| themuse | `GET https://www.themuse.com/api/public/jobs?page=N&category=...` | `api_key` (registration "required for any use beyond testing") | 500 requests/hour without a key, 3,600 with one. 20 results per page. Category names are listed in the docs (e.g. "Software Engineering", "Data and Analytics"). Has a native `level` field; keep it raw. **Terms:** link back to The Muse; no redistributing its content, so keep it out of any published dataset. |
| remotive | `GET https://remotive.com/api/remote-jobs?category=software-dev` | none | **Fetch at most 4 times a day; more than 2 requests a minute is blocked.** Listings are delayed 24h. Any public display must link back and credit Remotive. Fetch once per run. |
| remoteok | `GET https://remoteok.com/api` | none | The first array element is a legal notice; skip it. Public display must link back. |
| usajobs | `GET https://data.usajobs.gov/api/Search?JobCategoryCode=2210&...` | free key, sent in the `Authorization-Key` and `User-Agent` (email) headers | Federal IT (job series 2210). Keep the pay grade raw. |
| hn | Algolia HN Search API (`hn.algolia.com/api/v1`) to find the current month's "Ask HN: Who is hiring?" thread by user `whoishiring`; comments via Algolia items or the HN Firebase API | none | Store raw top-level comments in `hn_comments`. Turning them into postings is Phase 2. Fetch incrementally; the thread grows all month. |
| jsearch (optional, **off by default**) | RapidAPI JSearch | RapidAPI key | Free-plan quota is small; check it. If enabled, use it only for company discovery. |

### 3.3 Excluded

| Source | Reason |
|---|---|
| We Work Remotely | Its API terms prohibit building a job search service on its data. |
| LinkedIn, Indeed, Glassdoor, ZipRecruiter (and JobSpy-style scrapers) | Terms-of-service risk, and this repo is public. |

---

## 4. Repo layout

```
job-insights/
├── CLAUDE.md
├── PLAN.md
├── README.md
├── pyproject.toml
├── .env.example                 # ADZUNA_APP_ID, ADZUNA_APP_KEY, USAJOBS_API_KEY, CONTACT_EMAIL, THEMUSE_API_KEY (optional), R2_* (M6)
├── config/
│   ├── sources.yaml             # enabled, kind, snapshot, rate limits, quotas, terms notes, doc_url, verified_at
│   ├── seeds.yaml               # hand-picked companies: {ats, slug, name}, verified live
│   └── settings.yaml            # archive retention (90 days), backup count, per-run caps
├── src/jobinsights/
│   ├── cli.py                   # typer app: `jobs ...`
│   ├── config.py
│   ├── http.py                  # shared polite async client
│   ├── models.py                # PostingRecord, BoardRef, etc.
│   ├── sources/
│   │   ├── base.py              # Source protocol
│   │   ├── greenhouse.py  lever.py  ashby.py
│   │   └── adzuna.py  themuse.py  remotive.py  remoteok.py  usajobs.py  hn.py
│   ├── discovery.py             # URL → (ats, region, slug), validation
│   ├── archive.py               # write, read and prune the raw archive (§5.4)
│   ├── reconcile.py             # spans, versions, closures
│   ├── reprocess.py             # re-parse archived data with current parsers (§5.4)
│   ├── pipeline.py              # `jobs daily` orchestration
│   ├── health.py                # checks + run summary
│   └── store/
│       ├── db.py                # connection, PRAGMAs, migration runner
│       ├── repo.py              # upserts and queries
│       ├── duckdb_build.py      # rebuild jobs.duckdb + Parquet exports
│       └── migrations/
│           ├── 001_initial.sql
│           └── archive/001_initial.sql
├── tests/
│   ├── fixtures/<source>/...    # recorded, trimmed real responses
│   └── test_*.py
├── sql/readiness.sql            # data readiness queries (§10)
├── ops/                         # local schedule templates: cron line, launchd plist (M2.5)
├── .github/workflows/daily.yml  # cloud schedule (M6)
├── status/latest.json           # committed each cloud run (M6)
└── data/                        # gitignored
    ├── jobs.sqlite              # parsed system of record
    ├── archive.sqlite           # raw archive, last 90 days (§5.4)
    ├── jobs.duckdb
    ├── exports/*.parquet
    ├── reports/run-{run_date}.md
    ├── backups/
    └── logs/
```

---

## 5. Data model

### 5.1 `PostingRecord`

This is what every adapter yields.

```
source, native_id, snapshot: bool
board: BoardRef | None            # (ats, region, slug) for board sources
company_name_raw
title
department_raw
locations_raw: list[str]
workplace_raw                     # remote / hybrid / onsite text as given
employment_type_raw
salary_min, salary_max, salary_currency, salary_period, salary_raw
description_html | description_text
apply_url, source_url
posted_at, source_updated_at      # as reported by the source
extra: dict                       # source-specific fields worth keeping (e.g., Muse levels, USAJOBS grade)
```

Each adapter also:
- splits every response into **items** (one per job, as returned) and an **envelope** (everything else), which are what the archive stores (§5.4)
- parses from an item plus its envelope and board alone. Parsing is a pure function, so it can be re-run from the archive without refetching.
- declares a `PARSER_VERSION`, bumped whenever its output changes for the same input

### 5.2 SQLite schema (starting point for `001_initial.sql`; refine as needed)

Use `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;` and `STRICT` tables.

```sql
CREATE TABLE runs (
  run_id        INTEGER PRIMARY KEY,
  run_date      TEXT NOT NULL,          -- UTC YYYY-MM-DD
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  status        TEXT NOT NULL,          -- running | ok | partial | failed
  git_sha       TEXT,
  summary_json  TEXT
) STRICT;

CREATE TABLE companies (
  company_id        INTEGER PRIMARY KEY,
  name              TEXT NOT NULL,
  name_norm         TEXT NOT NULL UNIQUE,   -- lowercased, punctuation/suffix stripped
  website           TEXT,
  first_tracked_date TEXT NOT NULL
) STRICT;

CREATE TABLE boards (
  board_id             INTEGER PRIMARY KEY,
  company_id           INTEGER REFERENCES companies(company_id),
  ats                  TEXT NOT NULL,        -- greenhouse | lever | ashby | ...
  region               TEXT NOT NULL DEFAULT 'default',  -- e.g. 'eu' hosts
  slug                 TEXT NOT NULL,
  status               TEXT NOT NULL,        -- candidate | active | inactive | invalid
  discovered_via       TEXT NOT NULL,        -- seed | adzuna | themuse | hn | manual | ...
  discovered_date      TEXT NOT NULL,
  first_tracked_date   TEXT,                 -- first successful fetch
  last_ok_date         TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  UNIQUE (ats, region, slug)
) STRICT;

CREATE TABLE fetches (
  fetch_id     INTEGER PRIMARY KEY,
  run_id       INTEGER NOT NULL REFERENCES runs(run_id),
  source       TEXT NOT NULL,
  target       TEXT NOT NULL,               -- slug, query or page
  board_id     INTEGER REFERENCES boards(board_id),
  started_at   TEXT NOT NULL,
  http_status  INTEGER,
  ok           INTEGER NOT NULL,            -- 1 = complete and parsed
  item_count   INTEGER,
  duration_ms  INTEGER,
  error        TEXT
) STRICT;  -- every fetch also has an archive manifest with the same fetch_id (§5.4)

CREATE TABLE descriptions (
  description_hash TEXT PRIMARY KEY,        -- sha256 of normalized plain text
  text_zlib        BLOB NOT NULL
) STRICT;

CREATE TABLE postings (
  posting_id          INTEGER PRIMARY KEY,
  source              TEXT NOT NULL,
  native_id           TEXT NOT NULL,
  snapshot            INTEGER NOT NULL,     -- 1 = closures inferable
  board_id            INTEGER REFERENCES boards(board_id),
  company_id          INTEGER REFERENCES companies(company_id),
  company_name_raw    TEXT,
  title               TEXT NOT NULL,
  department_raw      TEXT,
  locations_raw       TEXT,                 -- JSON array
  workplace_raw       TEXT,
  employment_type_raw TEXT,
  salary_min REAL, salary_max REAL, salary_currency TEXT, salary_period TEXT, salary_raw TEXT,
  description_hash    TEXT REFERENCES descriptions(description_hash),
  apply_url           TEXT,
  source_url          TEXT,
  ats_ref             TEXT,                 -- 'greenhouse:stripe:12345' parsed from any URL; links feed jobs to board jobs
  extra_json          TEXT,
  parser_version      TEXT NOT NULL,        -- adapter PARSER_VERSION that produced this row
  archive_hash        TEXT,                 -- archived item this row was last parsed from (§5.4)
  posted_at           TEXT,
  source_updated_at   TEXT,
  first_seen_date     TEXT NOT NULL,
  last_seen_date      TEXT NOT NULL,
  UNIQUE (source, native_id)
) STRICT;

CREATE TABLE posting_spans (
  posting_id  INTEGER NOT NULL REFERENCES postings(posting_id),
  open_date   TEXT NOT NULL,
  close_date  TEXT,                         -- first date confirmed absent; NULL = open
  pending_absent_date TEXT,                 -- first absence, awaiting confirmation
  PRIMARY KEY (posting_id, open_date)
) STRICT;

CREATE TABLE posting_versions (
  posting_id       INTEGER NOT NULL REFERENCES postings(posting_id),
  observed_date    TEXT NOT NULL,
  title            TEXT NOT NULL,
  description_hash TEXT,
  locations_raw    TEXT,
  salary_raw       TEXT,
  PRIMARY KEY (posting_id, observed_date)
) STRICT;  -- inserted only when one of these fields changes

CREATE TABLE hn_comments (
  comment_id    INTEGER PRIMARY KEY,
  thread_id     INTEGER NOT NULL,
  thread_month  TEXT NOT NULL,              -- YYYY-MM
  author        TEXT,
  posted_at     TEXT,
  text_html     TEXT,
  is_deleted    INTEGER NOT NULL DEFAULT 0,
  first_seen_date TEXT NOT NULL
) STRICT;

CREATE TABLE quota_usage (
  source     TEXT NOT NULL,
  period     TEXT NOT NULL,                 -- YYYY-MM
  calls      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source, period)
) STRICT;
```

### 5.3 Reconcile rules (snapshot sources only)

For each board whose fetch **succeeded** this run:

| Case | Action |
|---|---|
| Posting seen, no open span | Open a new span (`open_date = run_date`). A previously closed posting is a **repost**. |
| Posting seen, open span | Update `last_seen_date` and clear `pending_absent_date`. |
| Posting absent, `pending_absent_date` is NULL | Set `pending_absent_date = run_date`. |
| Posting absent, `pending_absent_date` already set from an earlier successful fetch | Close the span (`close_date = pending_absent_date`). |
| Board returns 0 jobs but had more than 20 open the run before | Record it and flag it in health checks, but **don't** apply closures this run. |

If the board's fetch **failed**, touch nothing.

The confirming absence must come from a **later `run_date`**. A same-day re-run (`--force`) never confirms a closure.

Feeds (`snapshot=0`) only update `first_seen_date` and `last_seen_date`.

### 5.4 Raw archive (`data/archive.sqlite`)

The archive is a separate SQLite file, which keeps the main database small. It's written for **every** fetch, successful or not, **before** parsing, so a parser crash still leaves the raw data behind.

Order for each fetch:
1. Create the `fetches` row, to get a `fetch_id`.
2. Write the manifest and its objects.
3. Parse and upsert.
4. Mark the fetch `ok`.

```sql
CREATE TABLE raw_objects (
  hash                 TEXT PRIMARY KEY,     -- sha256 of canonical JSON (sorted keys, no whitespace)
  source               TEXT NOT NULL,
  kind                 TEXT NOT NULL,        -- item | detail | response
  body_zlib            BLOB NOT NULL,        -- canonical JSON, zlib-compressed
  first_stored_date    TEXT NOT NULL,
  last_referenced_date TEXT NOT NULL         -- latest manifest pointing here; drives pruning
) STRICT;

CREATE TABLE manifests (
  fetch_id        INTEGER PRIMARY KEY,       -- same id as fetches.fetch_id in jobs.sqlite
  run_date        TEXT NOT NULL,
  source          TEXT NOT NULL,
  target          TEXT NOT NULL,             -- slug, query or page
  request_url     TEXT NOT NULL,             -- API keys redacted
  ok              INTEGER NOT NULL,
  http_status     INTEGER,
  envelope_zlib   BLOB,                      -- the response minus its items (counts, board metadata)
  items_zlib      BLOB,                      -- JSON list of [native_id, hash], in response order
  error_body_zlib BLOB                       -- first 64 KB of the body for failed fetches
) STRICT;
CREATE INDEX manifests_run_date ON manifests (run_date);
```

**Rules:**
- **Object kinds.** Each job in a response is an `item`. Greenhouse pay-enrichment responses are `detail` objects. If a response can't be split into items (unexpected shape, not JSON), the whole body is archived as one `response` object and the fetch is marked failed.
- **Volatile fields.** If a source changes a field on every request (a timestamp, a tracking parameter), dedupe suffers. Measure the dedupe ratio in the first week. If needed, list the field under `hash_exclude` for that source in `sources.yaml`; it's left out of the hash only, and the stored body keeps it.
- **Retention: 90 days** (`archive.retention_days` in `config/settings.yaml`).
  - Each run deletes manifests with a `run_date` outside the window, then objects whose `last_referenced_date` is outside it.
  - An object referenced inside the window is kept however long ago it was first stored, so every manifest in the window can still be replayed.
  - Run `VACUUM` weekly to reclaim space.
- **No secrets.** Redact API keys from request URLs and headers before writing.
- **Private.** The archive holds full job descriptions, so it's never committed or published.

**What reprocessing can and can't do:**

| Change | How to apply it | Reach |
|---|---|---|
| Phase 2 normalization, DuckDB views, metric tables | Rebuild from SQLite (happens every run) | Full history |
| Parser fix or a newly extracted field | `jobs reprocess --from --to` re-parses archived items with the current parsers. For each posting in the window, it re-parses the latest archived item and updates the posting's fields, `parser_version` and `posting_versions` rows within the window. | Last 90 days. Postings last seen before the window keep their old values; new columns stay NULL for them. |
| Presence or closure logic | `jobs reprocess --rebuild-spans` replays the manifests day by day, starting from the span state at the window's start | Last 90 days |

`jobs reprocess`:
- **Dry run by default.** It writes to a scratch copy of `jobs.sqlite` and prints a diff: rows changed per source and field, with samples. `--apply` swaps the result in after taking a backup.
- **No refetching.** It never calls the sources.
- **Weekly self-check.** Re-parse the last 7 days when no parser has changed. Any difference means the archive is incomplete or parsing isn't deterministic, and it's flagged in health checks.

---

## 6. The daily pipeline (`jobs daily`)

1. Start a `runs` row. If a run for today already finished, exit unless `--force`.
2. **Feeds:** fetch each enabled feed, archive each response (§5.4), then upsert postings. Quota guards apply.
3. **Discovery:** extract ATS URLs from today's feed postings and new HN comments, then validate candidates (§7, Milestone 3).
4. **Boards:** fetch every `active` board (including newly validated ones) with per-host concurrency limits, archiving each response before parsing.
5. **Reconcile:** apply the spans and versions rules (§5.3).
6. **Greenhouse pay enrichment:** request detail with `pay_transparency=true` for today's new Greenhouse postings, up to a per-run cap. Detail responses are archived too.
7. **Build:** rebuild `jobs.duckdb` from SQLite and write Parquet exports.
8. **Health:** run the checks (§8) and write `data/reports/run-{date}.md` and `status/latest.json`.
9. **Housekeeping:**
   - prune the archive to the last 90 days (`VACUUM` weekly)
   - keep 7 daily gzipped backups of `jobs.sqlite`
   - run the weekly reprocess self-check (§5.4)
10. **Exit code:** 0 = ok, 1 = partial (some sources failed), 2 = failed.

Target runtime: under 30 minutes at a few thousand boards.

---

## 7. Milestones

### Milestone 0 — Scaffold
- [x] `uv` project with src layout and a typer CLI `jobs`. Stub subcommands: `db init|migrate|build-duckdb|export`, `collect`, `discover`, `daily`, `reprocess`, `status`
- [x] ruff and pytest config; `live` marker skipped by default
- [x] `config/sources.yaml`, with every source from §3 and `enabled`, `snapshot`, `rate_limit`, `quota`, `terms_notes`, `doc_url`, `verified_at` and (optional) `hash_exclude` fields
- [x] `config/seeds.yaml` (empty for now) and `config/settings.yaml` (`archive.retention_days: 90`, `backups.keep: 7`, per-run caps)
- [x] `.env.example` and a `.gitignore` covering `data/` and `.env`
- [x] README skeleton: purpose, sources and attribution, how to run
- [x] One smoke test (the CLI loads and `--help` exits 0), so pytest has something to collect

**Acceptance criteria:** `uv run jobs --help` works; `uv run pytest` passes; ruff is clean.

### Milestone 1 — Storage layer
- [ ] Migration runner plus `001_initial.sql` (§5.2)
- [ ] Repo functions:
  - start and finish a run, record a fetch
  - upsert company and board
  - upsert a posting along with its description and a version-on-change
  - span operations
- [ ] Description handling: HTML → plain text, sha256, zlib
- [ ] Raw archive (§5.4): `data/archive.sqlite` with its own migrations, plus functions to:
  - write a manifest and its objects
  - read a fetch back as items + envelope
  - prune by retention
- [ ] `jobs db build-duckdb`: `INSTALL sqlite; LOAD sqlite; ATTACH 'data/jobs.sqlite' AS src (TYPE sqlite)`, then:
  - copy the tables
  - decompress descriptions into a text column
  - create views: `v_open_postings_by_day`, `v_new_postings_by_day`
- [ ] `jobs db export`: one Parquet file per table in `data/exports/`

**Acceptance criteria:**
- Tests cover upsert idempotency, version-on-change only, and span open/pending/close/reopen.
- Archive tests:
  - writing the same item twice stores one object and updates its `last_referenced_date`
  - pruning removes expired manifests but keeps any object still referenced inside the window
- DuckDB row counts match SQLite.

### Milestone 2 — Shared HTTP client, company job-board adapters, reconcile (the core)
- [ ] `http.py` with:
  - per-host rate limit and concurrency
  - timeouts
  - retries with backoff and jitter on 429/5xx, honoring `Retry-After`
  - a User-Agent that includes `CONTACT_EMAIL`
- [ ] Adapters `greenhouse`, `lever`, `ashby`, with fixtures recorded from 2–3 real boards each. Each one splits responses into items + envelope, parses from items alone and declares `PARSER_VERSION` (§5.1).
- [ ] Parse `ats_ref` from apply and source URLs
- [ ] `config/seeds.yaml`: 30–50 companies spread across the three systems, each verified live (a mix of big tech, scale-ups and AI startups)
- [ ] `reconcile.py` implementing §5.3
- [ ] Greenhouse pay enrichment (capped)
- [ ] `jobs collect --source greenhouse|lever|ashby|boards`, which archives every response before parsing

**Acceptance criteria:**
- Running twice on the same day changes nothing the second time.
- A simulated failed fetch causes no closures.
- A job missing from 2 successful fetches closes, with the right `close_date`.
- A job that returns gets a new span.
- A parser that raises on one item still leaves that fetch's manifest and objects in the archive.
- Every row in `fetches` has a matching manifest.
- A live smoke run over the seeds completes and prints a summary.

### Milestone 2.5 — Start collecting now
- [ ] A minimal `jobs daily`: company boards (archived), then reconcile, then build-duckdb
- [ ] Schedule it locally once a day at a fixed UTC time: cron on Linux, launchd on macOS (generate the file and show how to load it). Log to `data/logs/`.
- [ ] Document the catch-up path: if the machine was asleep or off, running `jobs daily` manually later the same UTC day is safe.
- [ ] `jobs status`: last run, counts per source, and active boards

**Acceptance criteria:** two consecutive scheduled runs are recorded in `runs`.

### Milestone 3 — Company discovery
- [ ] URL extractor returning `(ats, region, slug, job_id?)`. It must handle at least:
  - `boards.greenhouse.io/{slug}`
  - `job-boards.greenhouse.io/{slug}` and its EU variant
  - `boards.greenhouse.io/embed/job_board?for={slug}`
  - `jobs.lever.co/{slug}` and `jobs.eu.lever.co/{slug}`
  - `jobs.ashbyhq.com/{slug}`
- [ ] Validator: probe a candidate's API. A valid response makes it `active`; a 404 makes it `invalid`. A board with zero jobs is still valid.
- [ ] `jobs discover --from-db` scans stored URLs and HN text; `jobs discover --from-file urls.txt` takes manual additions.
- [ ] Optional: probe by company name (slug variants on each system). Results stay `candidate` until confirmed, because name collisions are common.
- [ ] Record `discovered_via` and `discovered_date`. `first_tracked_date` is set on the first successful fetch.

**Acceptance criteria:**
- Extractor tests cover at least 20 real URL shapes, including tracking parameters.
- Newly discovered boards appear in the next run.

### Milestone 4 — Feed sources
- [ ] `adzuna`: US first, countries configurable. Monthly call budget enforced via `quota_usage`.
- [ ] `themuse`: engineering categories, confirmed via the API
- [ ] `remotive`: at most once per run, keeping it to 4 or fewer fetches a day
- [ ] `remoteok`
- [ ] `usajobs`: series 2210
- [ ] `hn`: find this month's thread and add new top-level comments to `hn_comments`. Also refresh last month's thread during the first 3 days of a month.
- [ ] Every feed passes its URLs (and HN comment text) to discovery

**Acceptance criteria:**
- Each source has fixture tests.
- The quota guard blocks calls past the budget.
- All feeds are stored with `snapshot=0`.
- Discovery finds ATS links in feed data.

### Milestone 5 — Full daily orchestration, health checks, retention
- [ ] `jobs daily` runs the full §6 pipeline
- [ ] Run report in Markdown plus `status/latest.json` (date, status, counts per source, new/closed postings, active boards, quota use)
- [ ] Health checks (§8)
- [ ] Archive retention (90 days, weekly `VACUUM`) and `jobs.sqlite` backups (7 days)
- [ ] `jobs reprocess --from --to [--rebuild-spans] [--apply]` (§5.4), plus the weekly self-check
- [ ] Exit codes as in §6

**Acceptance criteria:**
- One command runs everything.
- A forced failure in one source produces `partial`, with that source named in the report.
- `jobs reprocess` over the last 7 days shows no differences when no parser has changed.
- After a deliberate parser change in a test, `jobs reprocess` shows exactly the expected field changes, and `--apply` writes them.

### Milestone 6 — Free cloud schedule
- [ ] GitHub Actions workflow with:
  - a daily `schedule` (avoid minute 0; top-of-hour runs are often delayed)
  - `workflow_dispatch` for manual runs
  - a `concurrency` group so runs never overlap
- [ ] Each run downloads `jobs.sqlite` and `archive.sqlite` from Cloudflare R2 (S3-compatible), runs `jobs daily`, then uploads both databases, `jobs.duckdb`, the Parquet exports and backups
- [ ] Commit `status/latest.json` each run. In public repos, scheduled workflows are automatically disabled after 60 days without repo activity, and this commit keeps the repo active.
- [ ] Secrets in repo settings: API keys, `CONTACT_EMAIL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- [ ] Switch over: upload the local database to R2, disable the local schedule, and make the cloud the single writer
- [ ] `jobs sync pull|push` for working locally against the cloud copy (read-only by default)

**Acceptance criteria:**
- Three consecutive scheduled cloud runs succeed.
- R2 usage stays within the free tier: 10 GB-month of storage, 1M Class A and 10M Class B operations per month, free egress.

### Milestone 7 — Phase 1 wrap-up
- [ ] Run the data readiness checks (§10) after at least 14 days of collection
- [ ] README:
  - architecture diagram
  - sources and attribution
  - data dictionary
  - how to reproduce
  - "what this data can and can't tell you" (sample bias toward tech companies and startups)
- [ ] Review the question bank (§9) and mark each question supported, needs Phase 2, or not feasible

---

## 8. Health checks (every run)

- **Item count per source:** warn when it falls below 50% of the trailing 7-run median.
- **Board failures:** list boards with `consecutive_failures >= 3`. Mark a board `inactive` after 7 consecutive 404s; a board with zero jobs stays active.
- **Suspicious drops:** flag any board that went from more than 20 open postings to 0 (closures are held).
- **Closures:** flag runs where closures exceed 30% of a board's open postings.
- **Parse errors:** count of records that failed `PostingRecord` validation, per source.
- **Quotas:** usage vs. budget per source.
- **Archive coverage:** every fetch this run has a manifest; the counts must match.
- **Archive size:** total size, daily growth and dedupe ratio (objects stored vs. items fetched). Warn when everything stored in R2 is projected to pass 8 GB: both databases, DuckDB, exports and backups. That leaves headroom under the 10 GB free tier.
- **Reprocess self-check (weekly):** any difference is a failure (§5.4).
- **Freshness:** last successful run date. `jobs status` shows a warning when it's more than 36 hours old.

---

## 9. Phase 2 question bank

Phase 1 must capture the fields in the **Needs** column. The **Phase 2 work** column lists what has to be built later.

| # | Question | Definition | Needs from Phase 1 | Phase 2 work |
|---|---|---|---|---|
| 1 | Who is hiring the most? | New postings per company (day/week/month) **and** open postings per company; engineering roles and all roles | postings, spans, companies, title, department_raw | Engineering-role classifier |
| 2 | Who is ramping up or slowing down? | Week-over-week and month-over-month change in open postings, **fixed company panel only** | spans, boards.first_tracked_date | Panel cohorts |
| 3 | Who went quiet? | Companies whose open roles dropped to 0 or fell by more than 50% | spans | — |
| 4 | How does engineering compare to other functions per company? | Engineering share of a company's openings | department_raw, title | Department normalization |
| 5 | Most common roles | Counts by normalized title and role family (backend, frontend, mobile, infra/platform, data, ML/AI, product engineer, …) | title | Title normalization |
| 6 | Trending and emerging titles | Fastest-growing share of new postings month over month (with a minimum count); titles first seen this period (e.g., "AI engineer," "product engineer," "forward deployed engineer") | title, first_seen_date | Title normalization |
| 7 | Seniority mix | Share of junior, mid, senior, staff+ and manager postings; junior share as a read on the entry-level market | title, extra_json (Muse levels, USAJOBS grade) | Seniority classifier |
| 8 | Most requested technologies | Share of postings mentioning each language, framework, cloud or database (counted once per posting) | descriptions | Technology dictionary with aliases |
| 9 | Rising and falling technologies | Month-over-month change in share | descriptions, first_seen_date | Same |
| 10 | AI in non-AI roles | Share of backend, frontend and product roles mentioning LLMs or AI tooling | descriptions, title | Role family + technology dictionary |
| 11 | Technology co-occurrence and company stacks | Pairs that appear together; top technologies per company | descriptions | Same |
| 12 | Where are the jobs? | Top metros and countries; remote vs. hybrid vs. onsite share; remote with region limits | locations_raw, workplace_raw | Location parser |
| 13 | What does it pay? | Share of postings with disclosed pay; ranges by role family, seniority and metro | salary_* fields, salary_raw, descriptions | Salary text parser, currency/period normalization |
| 14 | Market churn | New vs. closed postings per day; net change | spans | — |
| 15 | How long do roles stay open? | Median days open by role and company; repost rate; roles open unusually long ("ghost" candidates) | spans | — |
| 16 | Visa sponsorship | Share of postings mentioning sponsorship, positively or negatively | descriptions | Phrase rules |
| 17 | Data coverage | Postings by source; unique contribution of each source; duplicate rate; panel growth | postings, ats_ref, boards | Cross-source dedupe |

---

## 10. Data readiness checks (end of Phase 1)

Run these as DuckDB queries and keep them in `sql/readiness.sql`:
- Runs per day over the last 14 days, all `ok` or `partial`
- Active boards by ATS, and growth by `discovered_via`
- New postings per day by source
- Field fill rates by source: description, locations, workplace, salary, department
- Closures per day, and the share of spans that later reopened
- HN comments captured for the current and previous month
- Number of feed postings whose `ats_ref` matches a tracked board (an early measure of overlap)
- Archive: a manifest for every fetch in the window, objects stored per day, and the dedupe ratio
- A dry-run `jobs reprocess` over the last 7 days shows no differences

---

## 11. Later phases (not now)

- **Phase 2 — Normalize and measure:**
  - classifiers for title, role family and seniority
  - technology extraction
  - location and salary parsing
  - cross-source dedupe clusters
  - metric tables for §9
- **Phase 3 — Show it off:**
  - daily digest and monthly report
  - public dashboard (e.g., static site built from the Parquet exports)
  - published dataset with source attribution

---

## 12. References (checked October 2026)

Each source's checked endpoint, limits and terms, with the date checked, are in `config/sources.yaml`.

- Greenhouse Job Board API (incl. `pay_transparency`): https://docs.greenhouse.io/job-board.html (moved from developers.greenhouse.io)
- Workable public endpoint: https://workable.readme.io/reference/jobs-1
- SmartRecruiters Posting API: https://developers.smartrecruiters.com/docs/posting-api
- Recruitee Careers Site API: https://docs.recruitee.com/reference/intro-to-careers-site-api
- HN Firebase API: https://github.com/HackerNews/API
- Lever Postings API: https://github.com/lever/postings-api
- Ashby Job Posting API: https://developers.ashbyhq.com/docs/public-job-posting-api
- Adzuna API: https://developer.adzuna.com/overview
- The Muse API v2 (rate limits): https://www.themuse.com/developers/api/v2
- Remotive API and terms: https://github.com/remotive-com/remote-jobs-api
- USAJOBS Search API: https://developer.usajobs.gov/api-reference/get-api-Search
- HN Search API (Algolia): https://hn.algolia.com/api
- GitHub Actions, auto-disabling of scheduled workflows: https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow
- Cloudflare R2 pricing and free tier: https://developers.cloudflare.com/r2/pricing/
