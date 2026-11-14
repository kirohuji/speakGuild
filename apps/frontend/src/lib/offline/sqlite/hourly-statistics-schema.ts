export const HOURLY_TABLES = ['learning_stat_hours', 'learning_stat_question_times'] as const
export const HOURLY_DDL = {
  learning_stat_hours: `CREATE TABLE IF NOT EXISTS learning_stat_hours (
    date TEXT NOT NULL,hour INTEGER NOT NULL CHECK(hour BETWEEN 0 AND 23),question_count INTEGER NOT NULL DEFAULT 0,
    active_seconds INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(date,hour))`,
  learning_stat_question_times: `CREATE TABLE IF NOT EXISTS learning_stat_question_times (
    date TEXT NOT NULL,question_id TEXT NOT NULL,first_at TEXT NOT NULL,hour INTEGER CHECK(hour BETWEEN 0 AND 23),PRIMARY KEY(date,question_id))`,
}
export const HOURLY_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS stat_hour_question_insert AFTER INSERT ON learning_stat_question_times WHEN NEW.hour IS NOT NULL BEGIN
    INSERT INTO learning_stat_hours(date,hour) SELECT NEW.date,NEW.hour WHERE NEW.hour IS NOT NULL ON CONFLICT(date,hour) DO NOTHING;
    UPDATE learning_stat_hours SET question_count=question_count+1 WHERE date=NEW.date AND hour=NEW.hour; END`,
  `CREATE TRIGGER IF NOT EXISTS stat_hour_question_update AFTER UPDATE ON learning_stat_question_times WHEN NEW.hour IS NOT OLD.hour BEGIN
    UPDATE learning_stat_hours SET question_count=question_count-1 WHERE date=OLD.date AND hour=OLD.hour;
    INSERT INTO learning_stat_hours(date,hour) SELECT NEW.date,NEW.hour WHERE NEW.hour IS NOT NULL ON CONFLICT(date,hour) DO NOTHING;
    UPDATE learning_stat_hours SET question_count=question_count+1 WHERE date=NEW.date AND hour=NEW.hour; END`,
]
for (const action of ['INSERT','UPDATE']) {
  HOURLY_TRIGGERS.push(`CREATE TRIGGER IF NOT EXISTS stat_hour_source_${action.toLowerCase()} AFTER ${action} ON learning_stat_sources
    WHEN substr(NEW.source_id,-4,2)=':h' AND substr(NEW.source_id,-2) GLOB '[0-2][0-9]' AND CAST(substr(NEW.source_id,-2) AS INTEGER)<24 BEGIN
    INSERT INTO learning_stat_hours(date,hour) VALUES(NEW.date,CAST(substr(NEW.source_id,-2) AS INTEGER)) ON CONFLICT(date,hour) DO NOTHING;
    UPDATE learning_stat_hours SET active_seconds=active_seconds+NEW.seconds${action==='UPDATE'?'-OLD.seconds':''}
      WHERE date=NEW.date AND hour=CAST(substr(NEW.source_id,-2) AS INTEGER); END`)
  HOURLY_TRIGGERS.push(`CREATE TRIGGER IF NOT EXISTS stat_hour_run_${action.toLowerCase()} AFTER ${action} ON daily_practice_runs BEGIN
    INSERT INTO learning_stat_question_times(date,question_id,first_at,hour)
    SELECT json_extract(value,'$.date'),json_extract(value,'$.stepId'),json_extract(value,'$.createdAt'),CASE WHEN json_type(value,'$.hour')='integer' AND json_extract(value,'$.hour') BETWEEN 0 AND 23 THEN json_extract(value,'$.hour') ELSE NULL END
      FROM json_each(NEW.data,'$.attemptHistory') WHERE length(json_extract(value,'$.date'))=10
      AND length(json_extract(value,'$.stepId'))>0 AND length(json_extract(value,'$.createdAt'))>0
    ON CONFLICT(date,question_id) DO UPDATE SET first_at=excluded.first_at,hour=excluded.hour
      WHERE excluded.first_at<learning_stat_question_times.first_at OR (excluded.first_at=learning_stat_question_times.first_at AND excluded.hour IS NOT NULL AND (learning_stat_question_times.hour IS NULL OR excluded.hour<learning_stat_question_times.hour));
  END`)
}

// Run once when the hourly projection is introduced. Repeating after interruption
// is safe: answer attribution takes the earliest event and durations are assigned.
export const HOURLY_BACKFILL = [
  `INSERT INTO learning_stat_question_times(date,question_id,first_at,hour)
    SELECT json_extract(events.value,'$.date'),json_extract(events.value,'$.stepId'),json_extract(events.value,'$.createdAt'),
      CASE WHEN json_type(events.value,'$.hour')='integer' AND json_extract(events.value,'$.hour') BETWEEN 0 AND 23 THEN json_extract(events.value,'$.hour') ELSE NULL END
    FROM daily_practice_runs runs, json_each(runs.data,'$.attemptHistory') events
    WHERE length(json_extract(events.value,'$.date'))=10 AND length(json_extract(events.value,'$.stepId'))>0 AND length(json_extract(events.value,'$.createdAt'))>0
    ON CONFLICT(date,question_id) DO UPDATE SET first_at=excluded.first_at,hour=excluded.hour
      WHERE excluded.first_at<learning_stat_question_times.first_at OR (excluded.first_at=learning_stat_question_times.first_at AND excluded.hour IS NOT NULL AND (learning_stat_question_times.hour IS NULL OR excluded.hour<learning_stat_question_times.hour))`,
  `INSERT INTO learning_stat_hours(date,hour,active_seconds)
    SELECT date,CAST(substr(source_id,-2) AS INTEGER),SUM(seconds) FROM learning_stat_sources
    WHERE substr(source_id,-4,2)=':h' AND substr(source_id,-2) GLOB '[0-2][0-9]' AND CAST(substr(source_id,-2) AS INTEGER)<24
    GROUP BY date,CAST(substr(source_id,-2) AS INTEGER)
    ON CONFLICT(date,hour) DO UPDATE SET active_seconds=excluded.active_seconds`,
]
