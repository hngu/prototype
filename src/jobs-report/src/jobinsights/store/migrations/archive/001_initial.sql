-- Raw archive schema for data/archive.sqlite (PLAN.md §5.4).

CREATE TABLE raw_objects (
  hash                 TEXT PRIMARY KEY,        -- sha256 of canonical JSON (sorted keys, no whitespace)
  source               TEXT NOT NULL,
  kind                 TEXT NOT NULL CHECK (kind IN ('item', 'detail', 'response')),
  body_zlib            BLOB NOT NULL,           -- canonical JSON, zlib-compressed
  first_stored_date    TEXT NOT NULL,
  last_referenced_date TEXT NOT NULL,           -- latest manifest pointing here; drives pruning
  CHECK (last_referenced_date >= first_stored_date)
) STRICT;
CREATE INDEX raw_objects_last_referenced_date ON raw_objects (last_referenced_date);

CREATE TABLE manifests (
  fetch_id        INTEGER PRIMARY KEY,          -- same id as fetches.fetch_id in jobs.sqlite
  run_date        TEXT NOT NULL,
  source          TEXT NOT NULL,
  target          TEXT NOT NULL,                -- slug, query or page
  request_url     TEXT NOT NULL,                -- API keys redacted
  ok              INTEGER NOT NULL CHECK (ok IN (0, 1)),
  http_status     INTEGER,
  envelope_zlib   BLOB,                         -- the response minus its items
  items_zlib      BLOB,                         -- JSON list of [native_id, hash], in response order
  error_body_zlib BLOB                          -- first 64 KB of the body for failed fetches
) STRICT;
CREATE INDEX manifests_run_date ON manifests (run_date);
