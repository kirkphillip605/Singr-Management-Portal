-- Globally unique OpenKJ venue IDs and request snapshot column.
--
-- This migration is idempotent so it can also be rerun as a manual repair.
-- It assumes the previous schema where `venues.openkj_venue_id` was unique
-- only per-user via the `(user_id, openkj_venue_id)` composite constraint
-- and where `requests` had no `openkj_venue_id` column.

-- 1) Backing sequence for the global venue id.
CREATE SEQUENCE IF NOT EXISTS venues_openkj_venue_id_seq AS integer;

-- 2) Drop the old per-user composite uniqueness so a global one can take over.
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_user_id_openkj_venue_id_key;

-- 3) Advance the sequence past the current max BEFORE reseating duplicates,
--    so that any nextval() handed to a duplicate row is guaranteed not to
--    collide with an existing non-duplicate row.
SELECT setval(
  'venues_openkj_venue_id_seq',
  GREATEST(COALESCE((SELECT MAX(openkj_venue_id) FROM venues), 0), 1),
  true
);

-- 4) Resolve any pre-existing collisions across users by reseating duplicates
--    onto fresh sequence values. The earliest row (oldest created_at, then
--    smallest uuid) keeps its current id; later duplicates are renumbered.
WITH dups AS (
  SELECT id,
         openkj_venue_id,
         ROW_NUMBER() OVER (
           PARTITION BY openkj_venue_id
           ORDER BY created_at, id
         ) AS rn
  FROM venues
)
UPDATE venues v
SET openkj_venue_id = nextval('venues_openkj_venue_id_seq')
FROM dups
WHERE v.id = dups.id
  AND dups.rn > 1;

-- 5) Add the global unique constraint (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_openkj_venue_id_key'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_openkj_venue_id_key UNIQUE (openkj_venue_id);
  END IF;
END$$;

-- 6) Tie the sequence to the column and re-prime it after any reseating so
--    new inserts pick up where the renumbered ids left off.
ALTER SEQUENCE venues_openkj_venue_id_seq OWNED BY venues.openkj_venue_id;
SELECT setval(
  'venues_openkj_venue_id_seq',
  GREATEST(COALESCE((SELECT MAX(openkj_venue_id) FROM venues), 0), 1),
  true
);

-- 7) Make the column auto-assign on insert.
ALTER TABLE venues
  ALTER COLUMN openkj_venue_id
  SET DEFAULT nextval('venues_openkj_venue_id_seq'::regclass);

-- 7) Add a snapshot of the venue's openkj_venue_id to each request row so
--    historical lookups stay correct even if a venue is later deleted.
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS openkj_venue_id integer;

-- 8) Backfill the snapshot from the related venue.
UPDATE requests r
SET openkj_venue_id = v.openkj_venue_id
FROM venues v
WHERE r.venue_id = v.id
  AND r.openkj_venue_id IS NULL;

-- 9) Enforce non-null going forward.
ALTER TABLE requests
  ALTER COLUMN openkj_venue_id SET NOT NULL;

-- 10) Index that supports OpenKJ getRequests lookups by snapshot id.
CREATE INDEX IF NOT EXISTS requests_openkj_venue_id_processed_idx
  ON requests (openkj_venue_id, processed);
