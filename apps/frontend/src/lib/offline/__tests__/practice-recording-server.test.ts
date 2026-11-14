import { expect, it, vi } from 'vitest'
// Execute the backend service with its own TS transform; do not pull Nest DTOs into the frontend typecheck.
const backendModule = new URL('../../../../../backend/src/modules/practice-ai/daily-practice.service.ts', import.meta.url).href
const { DailyPracticeService } = await import(/* @vite-ignore */ backendModule)

it('protects recording assets in the same transaction as the saved warmup record', async () => {
  const tx = { practiceWarmupRecord: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }) => ({ id: 'record', ...data })) } }
  const prisma = { $transaction: vi.fn(async work => work(tx)) }
  const files = { syncPersistentAssetReferences: vi.fn(async () => {}) }
  const service = new DailyPracticeService(prisma as any, files as any)
  const items = [{ stepId: 'one', audioUrl: 'asset://voice', userAnswer: 'Hello' }]
  const result = await (service as any).mergeWarmupRecord('user', 'run', { topicId: 'topic', items })
  expect(files.syncPersistentAssetReferences).toHaveBeenCalledWith(tx, 'user', 'practice_warmup_record', 'record', items)
  expect(result.items[0].audioUrl).toBe('asset://voice')
})
it('does not acknowledge a warmup write if asset binding fails', async () => {
  const tx = { practiceWarmupRecord: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'record' })) } }
  const prisma = { $transaction: vi.fn(async work => work(tx)) }
  const files = { syncPersistentAssetReferences: vi.fn(async () => { throw new Error('missing asset') }) }
  const service = new DailyPracticeService(prisma as any, files as any)
  await expect((service as any).mergeWarmupRecord('user', 'run', { topicId: 'topic', items: [{ stepId: 'one', audioUrl: 'asset://voice' }] })).rejects.toThrow('missing asset')
})
