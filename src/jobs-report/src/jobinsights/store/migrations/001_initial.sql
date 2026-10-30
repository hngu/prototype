-- Phase 1 schema for data/jobs.sqlite (PLAN.md §5.2).
-- Dates are UTC 'YYYY-MM-DD'; timestamps are UTC ISO-8601.

CREATE TABLE runs (
  run_id        INTEGER PRIMARY KEY,
  run_date      TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('running', 'ok', 'partial', 'failed')),
  git_sha       TEXT,
  summary_json  TEXT
) STRICT;
CREATE INDEX runs_run_date ON runs (run_date);

CREATE TABLE companies (
  company_id         INTEGER PRIMARY KEY,
  name               TEXT NOT NULL,
  name_norm          TEXT NOT NULL UNIQUE,      -- identity key: lowercased, punctuation and legal suffix stripped
  website            TEXT,
  first_tracked_date TEXT NOT NULL
) STRICT;

CREATE TABLE boards (
  board_id             INTEGER PRIMARY KEY,
  company_id           INTEGER REFERENCES companies (company_id),
  ats                  TEXT NOT NULL,           -- greenhouse | lever | ashby | ...
  region               TEXT NOT NULL DEFAULT 'default',
  slug                 TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('candidate', 'active', 'inactive', 'invalid')),
  discovered_via       TEXT NOT NULL,           -- seed | adzuna | themuse | hn | manual | ...
  discovered_date      TEXT NOT NULL,
  first_tracked_date   TEXT,                    -- first successful fetch
  last_ok_date         TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  UNIQUE (ats, region, slug)
) STRICT;
CREATE INDEX boards_company_id ON boards (company_id);

-- Every fetch also has an archive manifest with the same fetch_id (§5.4).
CREATE TABLE fetches (
  fetch_id     INTEGER PRIMARY KEY,
  run_id       INTEGER NOT NULL REFERENCES runs (run_id),
  source       TEXT NOT NULL,
  target       TEXT NOT NULL,                   -- slug, query or page
  board_id     INTEGER REFERENCES boards (board_id),
  started_at   TEXT NOT NULL,
  http_status  INTEGER,
  ok           INTEGER NOT NULL CHECK (ok IN (0, 1)),  -- 1 = complete and parsed
  item_count   INTEGER CHECK (item_count >= 0),
  duration_ms  INTEGER CHECK (duration_ms >= 0),
  error        TEXT
) STRICT;
CREATE INDEX fetches_run_id ON fetches (run_id);
CREATE INDEX fetches_board_id ON fetches (board_id);

CREATE TABLE descriptions (
  description_hash TEXT PRIMARY KEY,            -- sha256 of normalized plain text
  text_zlib        BLOB NOT NULL
) STRICT;

CREATE TABLE postings (
  posting_id          INTEGER PRIMARY KEY,
  source              TEXT NOT NULL,
  native_id           TEXT NOT NULL,
  snapshot            INTEGER NOT NULL CHECK (snapshot IN (0, 1)),  -- 1 = closures inferable
  board_id            INTEGER REFERENCES boards (board_id),
  company_id          INTEGER REFERENCES companies (company_id),
  company_name_raw    TEXT,
  title               TEXT NOT NULL,
  department_raw      TEXT,
  locations_raw       TEXT,                     -- JSON array
  workplace_raw       TEXT,
  employment_type_raw TEXT,
  salary_min          REAL,
  salary_max          REAL,
  salary_currency     TEXT,
  salary_period       TEXT,
  salary_raw          TEXT,
  description_hash    TEXT REFERENCES descriptions (description_hash),
  apply_url           TEXT,
  source_url          TEXT,
  ats_ref             TEXT,                     -- 'greenhouse:stripe:12345' parsed from any URL
  extra_json          TEXT,
  parser_version      TEXT NOT NULL,            -- adapter PARSER_VERSION that produced this row
  archive_hash        TEXT,                     -- archived item this row was last parsed from
  posted_at           TEXT,
  source_updated_at   TEXT,
  first_seen_date     TEXT NOT NULL,
  last_seen_date      TEXT NOT NULL CHECK (last_seen_date >= first_seen_date),
  UNIQUE (source, native_id)
) STRICT;
CREATE INDEX postings_board_id ON postings (board_id);
CREATE INDEX postings_company_id ON postings (company_id);
CREATE INDEX postings_last_seen_date ON postings (last_seen_date);

CREATE TABLE posting_spans (
  posting_id          INTEGER NOT NULL REFERENCES postings (posting_id),
  open_date           TEXT NOT NULL,
  close_date          TEXT,                     -- first date confirmed absent; NULL = open
  pending_absent_date TEXT,                     -- first absence, awaiting confirmation
  PRIMARY KEY (posting_id, open_date),
  CHECK (close_date IS NULL OR close_date >= open_date),
  CHECK (close_date IS NULL OR pending_absent_date IS NULL)
) STRICT;
-- A posting has at most one open span.
CREATE UNIQUE INDEX posting_spans_one_open ON posting_spans (posting_id) WHERE close_date IS NULL;

-- Inserted on first sight and then only when one of these fields changes.
CREATE TABLE posting_versions (
  posting_id       INTEGER NOT NULL REFERENCES postings (posting_id),
  observed_date    TEXT NOT NULL,
  title            TEXT NOT NULL,
  description_hash TEXT REFERENCES descriptions (description_hash),
  locations_raw    TEXT,
  salary_raw       TEXT,
  PRIMARY KEY (posting_id, observed_date)
) STRICT;

CREATE TABLE hn_comments (
  comment_id      INTEGER PRIMARY KEY,
  thread_id       INTEGER NOT NULL,
  thread_month    TEXT NOT NULL,                -- YYYY-MM
  author          TEXT,
  posted_at       TEXT,
  text_html       TEXT,
  is_deleted      INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  first_seen_date TEXT NOT NULL
) STRICT;
CREATE INDEX hn_comments_thread_id ON hn_comments (thread_id);

CREATE TABLE quota_usage (
  source TEXT NOT NULL,
  period TEXT NOT NULL,                         -- YYYY-MM
  calls  INTEGER NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (source, period)
) STRICT;
