import {describe,expect,it} from 'vitest'
import { initializeOfflineSchema } from '../sqlite/schema'
import {statisticsDb} from './statistics-sqlite.fixture'
describe('hourly read model',()=>{
 it('restores existing timed facts once without double-counting daily totals',async()=>{
  const {store,db,queryRows}=await statisticsDb()
  await store.put('daily_practice_runs',{id:'existing',date:'2026-11-14',attemptHistory:[{stepId:'q',date:'2026-11-14',hour:9,createdAt:'2026-11-14T01:00:00.000Z'}]})
  await store.saveLearningActivity({date:'2026-11-14',sourceId:'timer:existing:h09',scope:'learning',activeSeconds:90})
  db.run("DELETE FROM learning_stat_question_times; DELETE FROM learning_stat_hours; DELETE FROM kv WHERE id='schema:hourly-statistics:v1'")
  await initializeOfflineSchema(async sql=>{db.run(sql)},queryRows)
  const stats=await store.readLearningStatistics('2026-11-14','2026-11-14','2026-11-14')
  expect(stats.hourlyStats).toEqual([{hour:9,questionCount:1,activeSeconds:90}])
  expect(stats.dailyStats[0]).toMatchObject({questionCount:1,activeSeconds:90})
  expect(stats.hourlyComplete).toBe(true)
  // A retry after an interrupted initialization is also idempotent.
  db.run("DELETE FROM kv WHERE id='schema:hourly-statistics:v1'")
  await initializeOfflineSchema(async sql=>{db.run(sql)},queryRows)
  expect((await store.readLearningStatistics('2026-11-14','2026-11-14','2026-11-14')).hourlyStats).toEqual(stats.hourlyStats)
  const executed:string[]=[]
  await initializeOfflineSchema(async sql=>{executed.push(sql);db.run(sql)},queryRows)
  expect(executed.some(sql=>sql.includes('FROM daily_practice_runs runs'))).toBe(false)
 })
 it('counts a repeated question in its earliest hour, even with out-of-order device sync',async()=>{
  const {store}=await statisticsDb()
  await store.put('daily_practice_runs',{id:'r',date:'2026-11-14',attemptHistory:[{stepId:'a',date:'2026-11-14',hour:14,createdAt:'2026-11-14T06:00:00.000Z'}]})
  await store.applyStatisticsRuns([{date:'2026-11-14',attemptHistory:[{stepId:'a',date:'2026-11-14',hour:13,createdAt:'2026-11-14T05:00:00.000Z'}]}])
  const stats=await store.readLearningStatistics('2026-11-14','2026-11-14','2026-11-14')
  expect(stats.dailyStats[0].questionCount).toBe(1)
  expect(stats.hourlyStats.find(h=>h.hour===13)?.questionCount).toBe(1)
  expect(stats.hourlyStats.find(h=>h.hour===14)?.questionCount??0).toBe(0)
  expect(stats.hourlyComplete).toBe(true)
 })
 it('keeps duration retries idempotent and queries at most 24 hours',async()=>{
  const {store,queryRows}=await statisticsDb()
  await store.saveLearningActivity({date:'2026-11-14',sourceId:'timer:one:h09',scope:'learning',activeSeconds:60})
  await store.saveLearningActivity({date:'2026-11-14',sourceId:'timer:one:h09',scope:'learning',activeSeconds:90})
  await store.applyStatisticsRuns([{date:'2026-11-14',stats:{activity:{'timer:one:h09':{activeSeconds:60},'timer:two:h10':{activeSeconds:30}}}}])
  const stats=await store.readLearningStatistics('2026-11-14','2026-11-14','2026-11-14')
  expect(stats.dailyStats[0].activeSeconds).toBe(120)
  expect(stats.hourlyStats.reduce((n,h)=>n+h.activeSeconds,0)).toBe(120)
  expect(stats.hourlyStats.length).toBeLessThanOrEqual(24)
  expect((await queryRows<any>('EXPLAIN QUERY PLAN SELECT * FROM learning_stat_hours WHERE date=?',['2026-11-14'])).some(row=>/SEARCH.*INDEX/.test(row.detail))).toBe(true)
 })
 it('does not invent an hour for an earlier untimed answer or daily-only duration',async()=>{
  const {store}=await statisticsDb()
  await store.applyStatisticsRuns([{date:'2026-11-14',attemptHistory:[{stepId:'a',date:'2026-11-14',hour:14,createdAt:'2026-11-14T06:00:00.000Z'}]}])
  await store.applyStatisticsRuns([{date:'2026-11-14',attemptHistory:[{stepId:'a',date:'2026-11-14',createdAt:'2026-11-14T05:00:00.000Z'}],stats:{activity:{old:{activeSeconds:60}}}}])
  const stats=await store.readLearningStatistics('2026-11-14','2026-11-14','2026-11-14')
  expect(stats.hourlyStats.reduce((n,h)=>n+h.questionCount,0)).toBe(0)
  expect(stats.hourlyComplete).toBe(false)
  expect(stats.dailyStats[0].questionCount).toBe(1)
 })
})
