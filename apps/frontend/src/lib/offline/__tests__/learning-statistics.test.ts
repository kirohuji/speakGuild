import { describe, expect, it } from 'vitest'
import { statisticsDb } from './statistics-sqlite.fixture'
const run = (id: string, date: string, ids: string[]) => ({ id, date, attemptHistory: ids.map(stepId => ({ id: `${id}:${stepId}`, date, stepId })) })
describe('incremental SQLite learning statistics', () => {
  it('deduplicates retries, runs, and remote echoes without reading history', async () => {
    const { store, queries } = await statisticsDb()
    await store.put('daily_practice_runs', run('one', '2026-11-13', ['a', 'a', 'b']))
    await store.applyStatisticsRuns([run('echo', '2026-11-13', ['a', 'b'])])
    await store.saveLearningActivity({ date: '2026-11-13', sourceId: 'source', scope: 'learning', activeSeconds: 60 })
    await store.applyStatisticsRuns([{ date: '2026-11-13', stats: { activity: { source: { activeSeconds: 30 }, another: { activeSeconds: 20 } } } }])
    queries.length = 0
    const stats = await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')
    expect(stats.uniqueQuestionsAnswered).toBe(2)
    expect(stats.activeSeconds).toBe(80)
    expect(stats.currentStreakDays).toBe(1)
    expect(stats.dailyStats).toEqual([{ date: '2026-11-13', active: true, questionCount: 2, activeSeconds: 80 }])
    expect(queries.some(sql => /daily_practice_runs|daily_activity|expression_entries/.test(sql))).toBe(false)
  })
  it('counts the same question once per day and once over its lifetime', async () => {
    const { store } = await statisticsDb()
    await store.putMany('daily_practice_runs', [run('one', '2026-11-13', ['a']), run('two', '2026-11-14', ['a'])])
    const stats = await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')
    expect(stats.uniqueQuestionsAnswered).toBe(1)
    expect(stats.dailyStats.map(day => day.questionCount)).toEqual([1, 1])
    expect(stats.currentStreakDays).toBe(2)
    expect(stats.avgDailyQuestions).toBe(1)
  })
  it('keeps source, summary and outbox atomic on persistence failure', async () => {
    const { store, failOutbox } = await statisticsDb()
    failOutbox(true)
    await expect(store.saveLearningActivity({ date: '2026-11-13', sourceId: 'source', scope: 'learning', activeSeconds: 60 })).rejects.toThrow('disk full')
    expect((await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')).activeSeconds).toBe(0)
    expect(await store.listDueOutbox('2026-12-31', 100)).toEqual([])
    failOutbox(false)
    await store.saveLearningActivity({ date: '2026-11-13', sourceId: 'source', scope: 'learning', activeSeconds: 60 })
    expect((await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')).activeSeconds).toBe(60)
  })
  it('keeps answer, summary and queue atomic, including later queue revisions', async () => {
    const { store, failOutbox } = await statisticsDb()
    const facts = run('one', '2026-11-14', ['a'])
    const warmup = { id: 'today-warmup:one', topicId: 'topic', items: [{ stepId: 'a', userAnswer: 'original answer' }] }
    const payload = { run: facts, warmupRecord: { topicId: 'topic', items: warmup.items } }
    failOutbox(true)
    await expect(store.saveRunFacts(facts, payload, warmup)).rejects.toThrow()
    expect(await store.get('daily_practice_runs', 'one')).toBeNull()
    expect(await store.get('warmup_records', warmup.id)).toBeNull()
    failOutbox(false)
    await store.saveRunFacts(facts, payload, warmup)
    expect((await store.get<any>('warmup_records', warmup.id)).items[0].userAnswer).toBe('original answer')
    const [firstUpload] = await store.listDueOutbox('2099-01-01', 100) as any[]
    expect(firstUpload.payload.warmupRecord.items[0].userAnswer).toBe('original answer')
    await store.saveRunFacts({ ...facts, attemptHistory: [...facts.attemptHistory, { id: 'new', date: '2026-11-14', stepId: 'b' }] }, { run: facts })
    const [queued] = await store.listDueOutbox('2099-01-01', 100)
    expect((queued as any).revision).toBe(2)
    expect((await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')).uniqueQuestionsAnswered).toBe(2)
  })
  it('preserves richer queued facts and rejects an acknowledgement of an older revision', async () => {
    const { store } = await statisticsDb()
    const first = run('one', '2026-11-14', ['a'])
    await store.saveDailyPracticeOutbox('one', 'update', { run: first, attempts: [{ clientAttemptId: 'srs-one' }], warmupRecord: { items: [{ stepId: 'a', userAnswer: 'answer' }] } })
    const second = run('one', '2026-11-14', ['b'])
    await store.saveRunFacts(second, { run: second, attempts: [] })
    const [queued] = await store.listDueOutbox('2099-01-01', 100) as any[]
    expect(queued.payload.run.attemptHistory.map((event: any) => event.stepId).sort()).toEqual(['a', 'b'])
    expect(queued.payload.warmupRecord.items[0].userAnswer).toBe('answer')
    expect(queued.payload.attempts).toHaveLength(1)
    expect(await store.patchOutbox(queued.id, 1, 'synced')).toBe(false)
    expect((await store.get<any>('outbox', queued.id)).status).toBe('pending')
    expect(await store.patchOutbox(queued.id, queued.revision, 'synced')).toBe(true)
  })
  it('does not lose newer answer text or SRS attempts when a slower snapshot arrives', async () => {
    const { store } = await statisticsDb()
    const facts = run('one', '2026-11-14', ['a', 'b'])
    await store.saveDailyPracticeOutbox('one', 'update', {
      run: facts, attempts: [{ clientAttemptId: 'srs-a' }, { clientAttemptId: 'srs-b' }],
      warmupRecord: { items: [{ stepId: 'a', userAnswer: 'new a', practiceCount: 2 }, { stepId: 'b', userAnswer: 'new b', practiceCount: 1 }] },
    })
    await store.saveDailyPracticeOutbox('one', 'update', {
      run: run('one', '2026-11-14', ['a']), attempts: [{ clientAttemptId: 'srs-a' }],
      warmupRecord: { items: [{ stepId: 'a', userAnswer: 'old a', practiceCount: 1 }] },
    })
    const queued = (await store.listDueOutbox('2099-01-01', 100))[0] as any
    expect(queued.payload.attempts.map((attempt: any) => attempt.clientAttemptId).sort()).toEqual(['srs-a', 'srs-b'])
    expect(queued.payload.warmupRecord.items.find((item: any) => item.stepId === 'a').userAnswer).toBe('new a')
    expect(queued.payload.warmupRecord.items.find((item: any) => item.stepId === 'b').userAnswer).toBe('new b')
  })
  it('attributes a midnight answer to the event day rather than the plan day', async () => {
    const { store } = await statisticsDb()
    await store.put('daily_practice_runs', { id: 'midnight', date: '2026-11-13', attemptedItemIds: ['a'], attemptHistory: [{ id: 'event', date: '2026-11-14', stepId: 'a' }] })
    const stats = await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')
    expect(stats.dailyStats.map(day => day.date)).toEqual(['2026-11-14'])
  })
  it('uses an indexed range and bounds the returned data with decades of history', async () => {
    const { db, store, queryRows } = await statisticsDb()
    db.run(`WITH RECURSIVE days(day) AS (SELECT '2000-01-01' UNION ALL SELECT date(day,'+1 day') FROM days WHERE day<'2026-12-31')
      INSERT INTO learning_stat_sources(id,date,source_id,seconds) SELECT day,day,'seed',10 FROM days`)
    const month = await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-30')
    const year = await store.readLearningStatistics('2026-01-01', '2026-12-31', '2026-11-30')
    expect(month.dailyStats).toHaveLength(30)
    expect(year.dailyStats).toHaveLength(365)
    const plan = await queryRows<any>('EXPLAIN QUERY PLAN SELECT * FROM learning_stat_days WHERE id >= ? AND id <= ?', ['2026-11-01', '2026-11-30'])
    expect(plan.some(row => /SEARCH.*INDEX/.test(row.detail))).toBe(true)
  })
  it('maintains favorite and word counts without reading expression payloads', async () => {
    const { store } = await statisticsDb()
    await store.put('expression_entries', { id: 'one', kind: 'word', type: 'word' })
    await store.put('expression_entries', { id: 'one', kind: 'chunk', type: 'chunk' })
    const stats = await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')
    expect(stats.favoriteCount).toBe(1)
    expect(stats.wordCount).toBe(0)
    await store.delete('expression_entries', 'one')
    expect((await store.readLearningStatistics('2026-11-01', '2026-11-30', '2026-11-14')).favoriteCount).toBe(0)
  })
})
