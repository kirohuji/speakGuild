import {describe,expect,it} from 'vitest'
import {dailyChartData} from '../daily-activity-chart'
import {getRestrainedChartDomainMax} from '../activity-chart'
describe('day chart data',()=>{
 it('shows a zero baseline for a day with no practice',()=>{
  const rows=dailyChartData([])
  expect(rows).toHaveLength(24)
  expect(rows.every(row=>row.minutes===0&&row.questions===0)).toBe(true)
 })
 it('keeps a continuous zero baseline between recorded hours',()=>{
  const rows=dailyChartData([{hour:9,activeSeconds:90,questionCount:2}],12)
  expect(rows[9]).toMatchObject({minutes:1.5,questions:2})
  expect(rows[8].minutes).toBe(0)
  expect(rows[8].questions).toBe(0)
 })
 it('has exactly 24 hours and leaves future hours empty',()=>{
  const rows=dailyChartData([{hour:9,activeSeconds:90,questionCount:2}],12)
  expect(rows).toHaveLength(24)
  expect(rows[9]).toMatchObject({minutes:1.5,questions:2})
  expect(rows[12].minutes).toBe(0)
  expect(rows[13].minutes).toBeNull()
  expect(rows[13].questions).toBeNull()
 })
})

describe('expanded chart scaling',()=>{
 it('keeps ordinary values at or below half height',()=>{
  expect(getRestrainedChartDomainMax([0,30,60],60)).toBe(120)
 })
 it('lets unusually large values use the upper half with headroom',()=>{
  expect(getRestrainedChartDomainMax([180],60)).toBe(207)
 })
})
