/** Frontend projection; the server has its own implementation and transaction logic. */
export interface LearningDay { date: string; questionCount: number; activeSeconds: number; active: boolean }
export interface StatisticsStatement { sql: string; values: any[] }
export function projectStatisticsRuns(runs: any[]): StatisticsStatement[] {
  const statements: StatisticsStatement[] = []
  for (const run of runs) {
    for (const event of run.attemptHistory ?? []) {
      if (!event?.stepId || !/^\d{4}-\d{2}-\d{2}$/.test(event.date ?? '')) continue
      statements.push({ sql: 'INSERT OR IGNORE INTO learning_stat_day_questions(id,date,question_id) VALUES (?,?,?)', values: [JSON.stringify([event.date, event.stepId]), event.date, event.stepId] })
    }
    const date = String(run.date).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const datedIds = new Set((run.attemptHistory ?? []).filter((event: any) => /^\d{4}-\d{2}-\d{2}$/.test(event?.date ?? '')).map((event: any) => event.stepId))
    for (const id of new Set<string>([...(run.attemptedItemIds ?? []), ...(run.completedItemIds ?? [])])) {
      if (!id || datedIds.has(id)) continue
      statements.push({ sql: 'INSERT INTO learning_stat_day_questions(id,date,question_id) VALUES (?,?,?) ON CONFLICT(date,question_id) DO NOTHING', values: [JSON.stringify([date, id]), date, id] })
    }
    for (const [sourceId, activity] of Object.entries(run.stats?.activity ?? {}) as Array<[string, any]>) {
      const seconds = Math.max(0, Math.min(14400, Math.floor(Number(activity?.activeSeconds) || 0)))
      if (!seconds) continue
      statements.push({ sql: `INSERT INTO learning_stat_sources(id,date,source_id,seconds) VALUES (?,?,?,?)
        ON CONFLICT(date,source_id) DO UPDATE SET seconds=excluded.seconds WHERE excluded.seconds > learning_stat_sources.seconds`, values: [JSON.stringify([date, sourceId]), date, sourceId, seconds] })
    }
  }
  return statements
}
