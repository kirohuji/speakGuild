/** Indexed projections maintained inside the same SQLite transaction as their facts. */
export const STATISTICS_TABLES = ['learning_stat_days', 'learning_stat_questions', 'learning_stat_day_questions', 'learning_stat_sources', 'learning_stat_totals'] as const
export const STATISTICS_DDL = {
  learning_stat_days: `CREATE TABLE IF NOT EXISTS learning_stat_days (
    id TEXT PRIMARY KEY, question_count INTEGER NOT NULL DEFAULT 0, active_seconds INTEGER NOT NULL DEFAULT 0
  )`,
  learning_stat_questions: `CREATE TABLE IF NOT EXISTS learning_stat_questions (id TEXT PRIMARY KEY)`,
  learning_stat_day_questions: `CREATE TABLE IF NOT EXISTS learning_stat_day_questions (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, question_id TEXT NOT NULL, UNIQUE(date, question_id)
  )`,
  learning_stat_sources: `CREATE TABLE IF NOT EXISTS learning_stat_sources (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, source_id TEXT NOT NULL, seconds INTEGER NOT NULL, UNIQUE(date, source_id)
  )`,
  learning_stat_totals: `CREATE TABLE IF NOT EXISTS learning_stat_totals (
    id TEXT PRIMARY KEY, active_days INTEGER NOT NULL DEFAULT 0, unique_questions INTEGER NOT NULL DEFAULT 0,
    question_days INTEGER NOT NULL DEFAULT 0, active_seconds INTEGER NOT NULL DEFAULT 0,
    favorite_count INTEGER NOT NULL DEFAULT 0, word_count INTEGER NOT NULL DEFAULT 0
  )`,
}
const ensureTotal = `INSERT INTO learning_stat_totals(id) VALUES ('total') ON CONFLICT(id) DO NOTHING;`
const dayActive = (row: string) => `CASE WHEN ${row}.question_count > 0 OR ${row}.active_seconds > 0 THEN 1 ELSE 0 END`
export const STATISTICS_TRIGGERS = [
  `CREATE INDEX IF NOT EXISTS idx_stat_day_questions_date ON learning_stat_day_questions(date)`,
  `CREATE TRIGGER IF NOT EXISTS stat_day_update AFTER UPDATE ON learning_stat_days BEGIN
    ${ensureTotal}
    UPDATE learning_stat_totals SET active_days = active_days + ${dayActive('NEW')} - ${dayActive('OLD')},
      question_days = question_days + NEW.question_count - OLD.question_count,
      active_seconds = active_seconds + NEW.active_seconds - OLD.active_seconds WHERE id = 'total';
  END`,
  `CREATE TRIGGER IF NOT EXISTS stat_question_insert AFTER INSERT ON learning_stat_questions BEGIN
    ${ensureTotal} UPDATE learning_stat_totals SET unique_questions = unique_questions + 1 WHERE id = 'total';
  END`,
  `CREATE TRIGGER IF NOT EXISTS stat_day_question_insert AFTER INSERT ON learning_stat_day_questions BEGIN
    INSERT INTO learning_stat_questions(id) VALUES (NEW.question_id) ON CONFLICT(id) DO NOTHING;
    INSERT INTO learning_stat_days(id) VALUES (NEW.date) ON CONFLICT(id) DO NOTHING;
    UPDATE learning_stat_days SET question_count = question_count + 1 WHERE id = NEW.date;
  END`,
  `CREATE TRIGGER IF NOT EXISTS stat_source_insert AFTER INSERT ON learning_stat_sources BEGIN
    INSERT INTO learning_stat_days(id) VALUES (NEW.date) ON CONFLICT(id) DO NOTHING;
    UPDATE learning_stat_days SET active_seconds = active_seconds + NEW.seconds WHERE id = NEW.date;
  END`,
  `CREATE TRIGGER IF NOT EXISTS stat_source_update AFTER UPDATE ON learning_stat_sources BEGIN
    UPDATE learning_stat_days SET active_seconds = active_seconds + NEW.seconds - OLD.seconds WHERE id = NEW.date;
  END`,
]
// Only the changed run is inspected. No trigger scans historical runs.
const projectRun = `
  INSERT INTO learning_stat_day_questions(id, date, question_id)
  SELECT json_array(json_extract(value, '$.date'), json_extract(value, '$.stepId')),
    json_extract(value, '$.date'), json_extract(value, '$.stepId')
  FROM json_each(NEW.data, '$.attemptHistory')
  WHERE length(json_extract(value, '$.date')) = 10 AND length(json_extract(value, '$.stepId')) > 0 ON CONFLICT(date, question_id) DO NOTHING;
`
const projectUndatedItems = `
  INSERT INTO learning_stat_day_questions(id,date,question_id)
  SELECT json_array(NEW.date, items.value), NEW.date, items.value
  FROM (SELECT value FROM json_each(NEW.data,'$.attemptedItemIds') UNION SELECT value FROM json_each(NEW.data,'$.completedItemIds')) items
  WHERE length(NEW.date)=10 AND length(items.value)>0 AND NOT EXISTS (
    SELECT 1 FROM json_each(NEW.data,'$.attemptHistory') events WHERE json_extract(events.value,'$.stepId')=items.value AND length(json_extract(events.value,'$.date'))=10
  ) ON CONFLICT(date,question_id) DO NOTHING;
`
for (const action of ['INSERT', 'UPDATE']) {
  STATISTICS_TRIGGERS.push(`CREATE TRIGGER IF NOT EXISTS stat_run_${action.toLowerCase()} AFTER ${action} ON daily_practice_runs BEGIN ${projectRun} ${projectUndatedItems} END`)
}

STATISTICS_TRIGGERS.push(
  `CREATE TRIGGER IF NOT EXISTS stat_expression_insert AFTER INSERT ON expression_entries BEGIN
    ${ensureTotal} UPDATE learning_stat_totals SET favorite_count=favorite_count+1,
      word_count=word_count+CASE WHEN NEW.expression_type='word' THEN 1 ELSE 0 END WHERE id='total'; END`,
  `CREATE TRIGGER IF NOT EXISTS stat_expression_delete AFTER DELETE ON expression_entries BEGIN
    ${ensureTotal} UPDATE learning_stat_totals SET favorite_count=favorite_count-1,
      word_count=word_count-CASE WHEN OLD.expression_type='word' THEN 1 ELSE 0 END WHERE id='total'; END`,
  `CREATE TRIGGER IF NOT EXISTS stat_expression_update AFTER UPDATE ON expression_entries BEGIN
    ${ensureTotal} UPDATE learning_stat_totals SET word_count=word_count+
      CASE WHEN NEW.expression_type='word' THEN 1 ELSE 0 END-CASE WHEN OLD.expression_type='word' THEN 1 ELSE 0 END WHERE id='total'; END`,
)
