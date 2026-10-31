-- Finding postings with no pay lookup yet checks fetches by source and target.
CREATE INDEX fetches_source_target ON fetches (source, target);
