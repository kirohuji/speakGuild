-- Derived, indexed read models. Facts and projections commit in one transaction.
CREATE TABLE learning_stat_totals (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  active_days INTEGER NOT NULL DEFAULT 0, unique_questions INTEGER NOT NULL DEFAULT 0,
  question_days INTEGER NOT NULL DEFAULT 0, active_seconds INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE learning_stat_days (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, date DATE NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0, active_seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,date)
);
CREATE TABLE learning_stat_questions (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, question_id TEXT NOT NULL,
  PRIMARY KEY(user_id,question_id)
);
CREATE TABLE learning_stat_day_questions (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, date DATE NOT NULL, question_id TEXT NOT NULL,
  PRIMARY KEY(user_id,date,question_id)
);
CREATE TABLE learning_stat_sources (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, date DATE NOT NULL, source_id TEXT NOT NULL,
  seconds INTEGER NOT NULL, PRIMARY KEY(user_id,date,source_id)
);
CREATE FUNCTION learning_stat_day_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO learning_stat_totals(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
  UPDATE learning_stat_totals SET
    active_days=active_days+(CASE WHEN NEW.question_count>0 OR NEW.active_seconds>0 THEN 1 ELSE 0 END)
      -(CASE WHEN OLD.question_count>0 OR OLD.active_seconds>0 THEN 1 ELSE 0 END),
    question_days=question_days+NEW.question_count-OLD.question_count,
    active_seconds=active_seconds+NEW.active_seconds-OLD.active_seconds WHERE user_id=NEW.user_id;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_stat_day_changed AFTER UPDATE ON learning_stat_days FOR EACH ROW EXECUTE FUNCTION learning_stat_day_changed();
CREATE FUNCTION learning_stat_question_added() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO learning_stat_totals(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
  UPDATE learning_stat_totals SET unique_questions=unique_questions+1 WHERE user_id=NEW.user_id;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_stat_question_added AFTER INSERT ON learning_stat_questions FOR EACH ROW EXECUTE FUNCTION learning_stat_question_added();
CREATE FUNCTION learning_stat_day_question_added() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO learning_stat_questions(user_id,question_id) VALUES(NEW.user_id,NEW.question_id) ON CONFLICT DO NOTHING;
  INSERT INTO learning_stat_days(user_id,date) VALUES(NEW.user_id,NEW.date) ON CONFLICT DO NOTHING;
  UPDATE learning_stat_days SET question_count=question_count+1 WHERE user_id=NEW.user_id AND date=NEW.date;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_stat_day_question_added AFTER INSERT ON learning_stat_day_questions FOR EACH ROW EXECUTE FUNCTION learning_stat_day_question_added();
CREATE FUNCTION learning_stat_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO learning_stat_days(user_id,date) VALUES(NEW.user_id,NEW.date) ON CONFLICT DO NOTHING;
  UPDATE learning_stat_days SET active_seconds=active_seconds+NEW.seconds-CASE WHEN TG_OP='UPDATE' THEN OLD.seconds ELSE 0 END
    WHERE user_id=NEW.user_id AND date=NEW.date;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_stat_source_changed AFTER INSERT OR UPDATE ON learning_stat_sources FOR EACH ROW EXECUTE FUNCTION learning_stat_source_changed();
CREATE FUNCTION learning_stat_project_run() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE question TEXT; event JSONB; source RECORD; seconds_value INTEGER;
BEGIN
  -- Lock order is consistent for answer and timer transactions on this account.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."userId" || ':learning-statistics',0));
  FOR event IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW."attemptHistory")='array' THEN NEW."attemptHistory" ELSE '[]'::jsonb END) LOOP
    IF event->>'date' ~ '^\d{4}-\d{2}-\d{2}$' AND length(event->>'stepId')>0 THEN
      INSERT INTO learning_stat_day_questions(user_id,date,question_id)
        VALUES(NEW."userId",(event->>'date')::date,event->>'stepId') ON CONFLICT DO NOTHING;
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
CREATE TRIGGER learning_stat_project_run AFTER INSERT OR UPDATE ON user_daily_practice_run FOR EACH ROW EXECUTE FUNCTION learning_stat_project_run();
