import { create } from 'zustand'
import { localDb } from '@/lib/offline/unified-storage'
export type PracticeActivityScope = 'daily' | 'dialogue' | 'learning'
export type PracticeActivityRecord = { date: string; sourceId: string; scope: PracticeActivityScope; activeSeconds: number; updatedAt: string }
const dirty = new Map<string, PracticeActivityRecord>()
const timerOwners: string[] = []
export function claimPracticeTimer(source: string) { for (const commit of activityCommitters) commit(); timerOwners.push(source); return () => { for (const commit of activityCommitters) commit(); const index = timerOwners.indexOf(source); if (index >= 0) timerOwners.splice(index, 1) } }
export function ownsPracticeTimer(source: string) { return timerOwners.at(-1) === source }
const activityCommitters = new Set<() => void>()
let writeChain: Promise<void> = Promise.resolve()
let generation = 0
const keyFor = (date: string, source: string) => `${date}:${source}`
function save(record: PracticeActivityRecord) {
  const epoch = generation
  writeChain = writeChain.catch(() => undefined).then(async () => {
    if (epoch !== generation) return
    await localDb.saveLearningActivity(record)
    const key = keyFor(record.date, record.sourceId)
    if (dirty.get(key) === record) dirty.delete(key)
  })
  return writeChain
}
export function registerPracticeActivityCommitter(commit: () => void) { activityCommitters.add(commit); return () => { activityCommitters.delete(commit) } }
export async function flushPracticeActivityRecords() {
  for (const commit of activityCommitters) commit()
  await writeChain.catch(() => undefined)
  for (const record of [...dirty.values()]) await save(record)
}
export const usePracticeActivityStore = create<{
  records: Record<string, PracticeActivityRecord>
  addActiveSeconds: (input: { date: string; sourceId: string; scope: PracticeActivityScope; seconds: number }) => void
  getRecord: (date: string, source: string) => PracticeActivityRecord | null
  releaseSource: (source: string) => void
  reset: () => void
}>((set, get) => ({
  records: {},
  addActiveSeconds({ date, sourceId, scope, seconds }) {
    const delta = Math.max(0, Math.min(60, Math.floor(seconds)))
    if (!delta) return
    const key = keyFor(date, sourceId)
    const previous = get().records[key]?.activeSeconds ?? 0
    const activeSeconds = Math.min(14400, previous + delta)
    if (activeSeconds === previous) return
    const record = { date, sourceId, scope, activeSeconds, updatedAt: new Date().toISOString() }
    set(s => ({ records: { ...s.records, [key]: record } }))
    dirty.set(key, record)
    void save(record).catch(error => console.warn('[learning-activity] local save failed:', error))
  },
  getRecord(date, source) { return get().records[keyFor(date, source)] ?? null },
  releaseSource(source) {
    // Keep failed increments in dirty until retry; completed sessions leave runtime state.
    set(s => ({ records: Object.fromEntries(Object.entries(s.records).filter(([, record]) => record.sourceId !== source)) }))
  },
  reset() { generation++; dirty.clear(); set({ records: {} }) },
}))
export async function waitForActivityWrites() { await writeChain }
export function getPracticeActivityGeneration() { return generation }
