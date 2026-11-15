import { expect, it, vi } from 'vitest'
const session = vi.hoisted(() => ({ current: { user: { id: 'user', role: 'admin' } } }))
vi.mock('../../../../../../backend/src/modules/auth/session.util', () => ({ requireAuthSession: async () => session.current }))
const source = new URL('../../../../../../backend/src/modules/admin/insight-content.service.ts', import.meta.url).href
const { InsightContentService } = await import(/* @vite-ignore */ source)
const controllerSource = new URL('../../../../../../backend/src/modules/admin/insight-content.controller.ts', import.meta.url).href
const { InsightContentController } = await import(/* @vite-ignore */ controllerSource)
const description = '**核心含义：**意思。\n\n**用法提示：**用法。\n\n**易错点：**注意。\n\n**常见搭配：**`a b`。'
function fixture() {
  const row = { id: 'target', word: 'test', text: 'test out', pattern: '__ works', meaning: '测试', description: 'old', examples: [{ en: 'Old', zh: '旧' }], updatedAt: new Date() }
  const delegate = { findUnique: vi.fn(async () => row), updateMany: vi.fn(async () => ({ count: 1 })) }
  const tx: any = { vocabulary: delegate, chunk: delegate, sentencePattern: delegate, chunkExample: {
    deleteMany: vi.fn(async () => {}), createMany: vi.fn(async () => {}), findMany: vi.fn(async () => [{ id: 'new-example', en: 'New', zh: '新' }]),
  } }
  tx.$transaction = async work => work(tx)
  const generated = { description, generatedExamples: [{ en: 'New', zh: '新' }], examples: [{ en: 'New', zh: '新' }] }
  const ai = { regenerateLearningFields: vi.fn(async () => generated) }
  return { service: new InsightContentService(tx, ai as any, { syncPersistentAssetReferences: vi.fn(async () => {}) } as any), delegate, tx, generated, ai }
}
it.each(['word', 'chunk', 'pattern'])('persists only the explanation field for %s', async kind => {
  const { service, delegate, tx } = fixture()
  const result = await service.regenerate(kind, 'target', 'description', 'admin')
  expect(result.patch).toEqual({ description })
  expect(delegate.updateMany.mock.calls[0][0].data).toEqual({ description })
  expect(tx.chunkExample.deleteMany).not.toHaveBeenCalled()
})
it.each(['word', 'chunk', 'pattern'])('replaces only examples for %s', async kind => {
  const { service, delegate, tx } = fixture()
  const result = await service.regenerate(kind, 'target', 'examples', 'admin')
  expect(result.patch.examples).toHaveLength(1)
  expect(delegate.updateMany.mock.calls[0][0].data).not.toHaveProperty('description')
  expect(tx.chunkExample.deleteMany).toHaveBeenCalledTimes(kind === 'chunk' ? 1 : 0)
})
it('preserves old data on invalid generation, and rejects unsupported fields and stale writes', async () => {
  const { service, delegate, ai } = fixture()
  await expect(service.regenerate('word', 'target', 'dictionary', 'admin')).rejects.toThrow('仅支持')
  ai.regenerateLearningFields.mockRejectedValueOnce(new Error('原内容已保留'))
  await expect(service.regenerate('word', 'target', 'description', 'admin')).rejects.toThrow('原内容已保留')
  expect(delegate.updateMany).not.toHaveBeenCalled()
  delegate.updateMany.mockResolvedValueOnce({ count: 0 })
  await expect(service.regenerate('word', 'target', 'examples', 'admin')).rejects.toThrow('其他操作')
})
it('rejects regular users before invoking generation and permits only an administrator', async () => {
  const regenerate = vi.fn(async () => ({ patch: { description } }))
  const controller = new InsightContentController({ regenerate } as any)
  session.current.user.role = 'user'
  await expect(controller.regenerate({} as any, 'word', 'target', { field: 'description' })).rejects.toThrow('仅管理员')
  expect(regenerate).not.toHaveBeenCalled()
  session.current.user.role = 'admin'
  await controller.regenerate({} as any, 'word', 'target', { field: 'description' })
  expect(regenerate).toHaveBeenCalledWith('word', 'target', 'description', 'user')
})
