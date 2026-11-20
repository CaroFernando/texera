-- Seed the LOCAL dev database with public hub workflows (users, likes, clones).
-- Datasets and models need real LakeFS repos, so seed-hub.mjs creates those via
-- the API and runs this file first. Run that script, not this file directly:
--   node scripts/seed-hub.mjs
-- A fresh local-dev DB has 0 workflows/datasets/models, so the landing page
-- would render empty without this.
--
-- Re-runnable: everything is owned by users with an @seed.local email, and the
-- first block deletes whatever a previous run created. Never run this against a
-- shared or production database.

SET search_path TO texera_db;
BEGIN;

-- 1. remove a previous seed -------------------------------------------------
CREATE TEMP TABLE seed_uids ON COMMIT DROP AS
  SELECT uid FROM "user" WHERE email LIKE '%@seed.local';
CREATE TEMP TABLE seed_wids ON COMMIT DROP AS
  SELECT wid FROM workflow_of_user WHERE uid IN (SELECT uid FROM seed_uids);

DELETE FROM workflow_user_likes  WHERE wid IN (SELECT wid FROM seed_wids) OR uid IN (SELECT uid FROM seed_uids);
DELETE FROM workflow_user_clones WHERE wid IN (SELECT wid FROM seed_wids) OR uid IN (SELECT uid FROM seed_uids);
DELETE FROM workflow_user_access WHERE wid IN (SELECT wid FROM seed_wids) OR uid IN (SELECT uid FROM seed_uids);
DELETE FROM workflow_of_user     WHERE wid IN (SELECT wid FROM seed_wids);
DELETE FROM workflow             WHERE wid IN (SELECT wid FROM seed_wids);
DELETE FROM dataset_user_likes   WHERE uid IN (SELECT uid FROM seed_uids)
  OR did IN (SELECT did FROM dataset WHERE owner_uid IN (SELECT uid FROM seed_uids));
DELETE FROM dataset_user_access  WHERE uid IN (SELECT uid FROM seed_uids)
  OR did IN (SELECT did FROM dataset WHERE owner_uid IN (SELECT uid FROM seed_uids));
DELETE FROM dataset              WHERE owner_uid IN (SELECT uid FROM seed_uids);
DELETE FROM model_user_likes     WHERE uid IN (SELECT uid FROM seed_uids)
  OR mid IN (SELECT mid FROM model WHERE owner_uid IN (SELECT uid FROM seed_uids));
DELETE FROM model_user_access    WHERE uid IN (SELECT uid FROM seed_uids)
  OR mid IN (SELECT mid FROM model WHERE owner_uid IN (SELECT uid FROM seed_uids));
DELETE FROM model                WHERE owner_uid IN (SELECT uid FROM seed_uids);
DELETE FROM "user"               WHERE uid IN (SELECT uid FROM seed_uids);

-- 2. owners (no login; they only own content) -------------------------------
INSERT INTO "user" (name, email, role) VALUES
  ('alice',    'alice@seed.local',    'REGULAR'),
  ('bob',      'bob@seed.local',      'REGULAR'),
  ('carolina', 'carolina@seed.local', 'REGULAR'),
  ('dmitri',   'dmitri@seed.local',   'REGULAR'),
  -- extra users so like/clone counts can differ (a user likes an item at most once)
  ('erin',     'erin@seed.local',     'REGULAR'),
  ('farah',    'farah@seed.local',    'REGULAR'),
  ('gus',      'gus@seed.local',      'REGULAR'),
  ('hana',     'hana@seed.local',     'REGULAR'),
  ('ivan',     'ivan@seed.local',     'REGULAR');

CREATE TEMP TABLE u ON COMMIT DROP AS
  SELECT name, uid FROM "user" WHERE email LIKE '%@seed.local';

-- 3. public workflows -------------------------------------------------------
CREATE TEMP TABLE wf_seed (name text, descr text, owner text, likes int, clones int, age_days int) ON COMMIT DROP;
INSERT INTO wf_seed VALUES
  ('Tweet sentiment pipeline',     'Classifies tweets with a pretrained model and aggregates sentiment per hour.', 'alice',    9, 3, 2),
  ('NYC taxi trip analysis',       'Joins trip records with weather data and plots demand by borough.',            'bob',      7, 6, 5),
  ('Genomics variant filtering',   'Filters VCF records by quality and annotates variants with gene names.',       'carolina', 6, 1, 9),
  ('Wildfire risk dashboard',      NULL,                                                                            'dmitri',   5, 4, 12),
  ('Customer churn prediction',    'Feature engineering plus a gradient-boosted classifier, with a holdout set and a confusion matrix at the end so you can compare runs.', 'alice', 4, 7, 20),
  ('Air quality time series',      'Resamples sensor readings and detects anomalies with a rolling z-score.',      'bob',      3, 2, 31),
  ('Paper citation graph',         'Builds a citation network and ranks papers with PageRank.',                    'carolina', 2, 5, 45),
  ('Sales forecasting (Prophet)',  'Weekly sales forecast per store using a Python UDF.',                          'dmitri',   1, 0, 60);

CREATE TEMP TABLE wf ON COMMIT DROP AS
WITH ins AS (
  INSERT INTO workflow (name, description, content, is_public, creation_time, last_modified_time)
  SELECT s.name, s.descr,
         '{"operators":[],"operatorPositions":{},"links":[],"commentBoxes":[],"settings":{"dataTransferBatchSize":400}}',
         true, now() - make_interval(days => s.age_days + 30), now() - make_interval(days => s.age_days)
  FROM wf_seed s
  RETURNING wid, name
)
SELECT ins.wid, s.*, u.uid AS owner_uid FROM ins JOIN wf_seed s USING (name) JOIN u ON u.name = s.owner;

INSERT INTO workflow_of_user (uid, wid) SELECT owner_uid, wid FROM wf;
INSERT INTO workflow_user_access (uid, wid, privilege) SELECT owner_uid, wid, 'WRITE' FROM wf;
-- likes/clones come from the other seed users plus the default admin (uid 1), cycling as needed
INSERT INTO workflow_user_likes (uid, wid)
  SELECT DISTINCT liker.uid, wf.wid FROM wf
  CROSS JOIN LATERAL (SELECT uid FROM (SELECT uid FROM u UNION SELECT 1) all_u ORDER BY uid LIMIT wf.likes) liker;
INSERT INTO workflow_user_clones (uid, wid)
  SELECT DISTINCT cl.uid, wf.wid FROM wf
  CROSS JOIN LATERAL (SELECT uid FROM (SELECT uid FROM u UNION SELECT 1) all_u ORDER BY uid DESC LIMIT wf.clones) cl;

-- 4. give the admin (uid 1) access to one workflow, so its card links to /user/... when signed in
INSERT INTO workflow_user_access (uid, wid, privilege)
  SELECT 1, wid, 'READ' FROM wf WHERE name = 'NYC taxi trip analysis';

COMMIT;

SELECT 'workflows' AS kind, count(*) FROM workflow WHERE is_public
UNION ALL SELECT 'datasets', count(*) FROM dataset WHERE is_public
UNION ALL SELECT 'models', count(*) FROM model WHERE is_public;
