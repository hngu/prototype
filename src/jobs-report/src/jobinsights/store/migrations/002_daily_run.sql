-- One run per UTC day: running `jobs collect` again continues that day's run.
DROP INDEX runs_run_date;
CREATE UNIQUE INDEX runs_run_date ON runs (run_date);

-- When a saved response was parsed into postings; NULL until then.
ALTER TABLE fetches ADD COLUMN processed_at TEXT;
