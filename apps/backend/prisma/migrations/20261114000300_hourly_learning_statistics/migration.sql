CREATE TABLE learning_stat_hours (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,date DATE NOT NULL,hour INTEGER NOT NULL CHECK(hour BETWEEN 0 AND 23),
 question_count INTEGER NOT NULL DEFAULT 0,active_seconds INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,date,hour));
CREATE TABLE learning_stat_question_times (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,date DATE NOT NULL,question_id TEXT NOT NULL,
 first_at TIMESTAMPTZ NOT NULL,hour INTEGER CHECK(hour BETWEEN 0 AND 23),PRIMARY KEY(user_id,date,question_id));
CREATE FUNCTION learning_stat_hour_question_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.hour IS NOT DISTINCT FROM OLD.hour THEN RETURN NEW; END IF;
   UPDATE learning_stat_hours SET question_count=question_count-1 WHERE user_id=OLD.user_id AND date=OLD.date AND hour=OLD.hour;
 END IF;
 IF NEW.hour IS NULL THEN RETURN NEW; END IF;
 INSERT INTO learning_stat_hours(user_id,date,hour) VALUES(NEW.user_id,NEW.date,NEW.hour) ON CONFLICT DO NOTHING;
 UPDATE learning_stat_hours SET question_count=question_count+1 WHERE user_id=NEW.user_id AND date=NEW.date AND hour=NEW.hour;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_stat_hour_question_changed AFTER INSERT OR UPDATE ON learning_stat_question_times FOR EACH ROW EXECUTE FUNCTION learning_stat_hour_question_changed();
CREATE FUNCTION learning_stat_hour_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE hour_value INTEGER;
BEGIN
 IF NEW.source_id !~ ':h([01][0-9]|2[0-3])$' THEN RETURN NEW; END IF;
 hour_value=right(NEW.source_id,2)::integer;
 INSERT INTO learning_stat_hours(user_id,date,hour) VALUES(NEW.user_id,NEW.date,hour_value) ON CONFLICT DO NOTHING;
 UPDATE learning_stat_hours SET active_seconds=active_seconds+NEW.seconds-CASE WHEN TG_OP='UPDATE' THEN OLD.seconds ELSE 0 END
 WHERE user_id=NEW.user_id AND date=NEW.date AND hour=hour_value;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_stat_hour_source_changed AFTER INSERT OR UPDATE ON learning_stat_sources FOR EACH ROW EXECUTE FUNCTION learning_stat_hour_source_changed();
CREATE OR REPLACE FUNCTION learning_stat_project_run() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE question TEXT; event JSONB; source RECORD; seconds_value INTEGER;
BEGIN
  -- Lock order is consistent for answer and timer transactions on this account.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."userId" || ':learning-statistics',0));
  FOR event IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW."attemptHistory")='array' THEN NEW."attemptHistory" ELSE '[]'::jsonb END) LOOP
    IF event->>'date' ~ '^\d{4}-\d{2}-\d{2}$' AND length(event->>'stepId')>0 THEN
      INSERT INTO learning_stat_day_questions(user_id,date,question_id)
        VALUES(NEW."userId",(event->>'date')::date,event->>'stepId') ON CONFLICT DO NOTHING;
    END IF;
    IF event->>'date' ~ '^\d{4}-\d{2}-\d{2}$' AND length(event->>'stepId')>0 AND event->>'createdAt' IS NOT NULL THEN
      INSERT INTO learning_stat_question_times(user_id,date,question_id,first_at,hour)
        VALUES(NEW."userId",(event->>'date')::date,event->>'stepId',(event->>'createdAt')::timestamptz,CASE WHEN event->>'hour' ~ '^([0-9]|1[0-9]|2[0-3])$' THEN (event->>'hour')::integer ELSE NULL END)
      ON CONFLICT(user_id,date,question_id) DO UPDATE SET first_at=EXCLUDED.first_at,hour=EXCLUDED.hour
        WHERE EXCLUDED.first_at<learning_stat_question_times.first_at OR (EXCLUDED.first_at=learning_stat_question_times.first_at AND EXCLUDED.hour IS NOT NULL AND (learning_stat_question_times.hour IS NULL OR EXCLUDED.hour<learning_stat_question_times.hour));
    END IF;
  END LOOP;
  FOREACH question IN ARRAY (COALESCE(NEW."attemptedItemIds",ARRAY[]::text[]) || COALESCE(NEW."completedItemIds",ARRAY[]::text[])) LOOP
    IF length(question)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW."attemptHistory")='array' THEN NEW."attemptHistory" ELSE '[]'::jsonb END) e WHERE e->>'stepId'=question AND e->>'date' ~ '^\d{4}-\d{2}-\d{2}$') THEN
      INSERT INTO learning_stat_day_questions(user_id,date,question_id) VALUES(NEW."userId",NEW.date,question) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  FOR source IN SELECT key,value FROM jsonb_each(CASE WHEN jsonb_typeof(NEW.stats->'activity')='object' THEN NEW.stats->'activity' ELSE '{}'::jsonb END) LOOP
    seconds_value=FLOOR(LEAST(14400,GREATEST(0,COALESCE((source.value->>'activeSeconds')::numeric,0))))::integer;
    IF seconds_value>0 THEN
      INSERT INTO learning_stat_sources(user_id,date,source_id,seconds) VALUES(NEW."userId",NEW.date,source.key,seconds_value)
        ON CONFLICT(user_id,date,source_id) DO UPDATE SET seconds=EXCLUDED.seconds WHERE EXCLUDED.seconds>learning_stat_sources.seconds;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

-- The new triggers do not see facts that existed before this migration.
-- Re-project them once; the daily projections and earliest-answer upserts are idempotent.
UPDATE user_daily_practice_run SET stats=stats;
INSERT INTO learning_stat_hours(user_id,date,hour,active_seconds)
SELECT user_id,date,right(source_id,2)::integer,SUM(seconds)::integer FROM learning_stat_sources
WHERE source_id ~ ':h([01][0-9]|2[0-3])$'
GROUP BY user_id,date,right(source_id,2)::integer
ON CONFLICT(user_id,date,hour) DO UPDATE SET active_seconds=EXCLUDED.active_seconds;
