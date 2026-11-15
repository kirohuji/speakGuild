import { beforeEach, expect, it, vi } from 'vitest'
import { statisticsDb } from './statistics-sqlite.fixture'
const state = vi.hoisted(() => ({ db: null as any }))
vi.mock('../unified-storage', () => ({ localDb: new Proxy({}, { get: (_, name) => state.db[name] }) }))
import { cacheInsightContentPatch, readInsightContentPatch, resolveInsightContentId } from '../insight-content'
beforeEach(async () => { state.db = (await statisticsDb()).store })

it('resolves legacy display IDs locally while preserving exact canonical IDs and rejecting ambiguous matches', async () => {
  await state.db.put('offline_vocabularies', { id: 'real-id', normalizedText: 'test', data: { id: 'real-id', word: 'test' } })
  await state.db.put('expression_entries', { id: 'legacy', kind: 'word', sourceId: 'word:test', original: 'test', contentSnapshot: { id: 'word:test', description: 'old' } })
  expect(await resolveInsightContentId('word', 'word:test', 'test')).toBe('real-id')
  await cacheInsightContentPatch('word', 'real-id', { description: 'new' })
  expect((await state.db.get('expression_entries', 'legacy')).contentSnapshot.description).toBe('new')
  await state.db.put('offline_vocabularies', { id: 'other-id', normalizedText: 'test', data: { id: 'other-id', word: 'test' } })
  expect(await resolveInsightContentId('word', 'word:real-id', 'test')).toBe('real-id')
  expect(await resolveInsightContentId('word', 'word:test', 'test')).toBe('word:test')
})

it.each(['word', 'chunk', 'pattern'] as const)('replaces only the selected field across %s caches, preserving user state and historical answers', async kind => {
  const table = { word: 'offline_vocabularies', chunk: 'offline_chunks', pattern: 'offline_patterns' }[kind] as any
  const content = { id: 'target', description: 'old', examples: [{ en: 'Keep', zh: '保留' }] }
  await state.db.put(table, { id: content.id, data: content })
  await state.db.put('downloaded_unit_details', { id: 'topic:one', detail: { vocabularies: [content, { ...content, id: 'other' }] } })
  await state.db.put('expression_entries', { id: 'saved', kind, sourceId: `${kind}:target`, syncStatus: 'pending', contentSnapshot: content })
  await state.db.put('learning_notebook_items', { id: 'link', notebookId: 'book', expressionEntryId: 'saved', masteryStatus: 'mastered' })
  await state.db.put('warmup_records', { id: 'history', items: [content] })
  await cacheInsightContentPatch(kind, 'target', { description: 'new' })
  expect((await state.db.get(table, 'target')).data).toEqual({ ...content, description: 'new' })
  const topic = await state.db.get('downloaded_unit_details', 'topic:one')
  expect(topic.detail.vocabularies[0].description).toBe('new')
  expect(topic.detail.vocabularies[1].description).toBe('old')
  const saved = await state.db.get('expression_entries', 'saved')
  expect(saved.syncStatus).toBe('pending'); expect(saved.contentSnapshot.description).toBe('new')
  expect((await state.db.get('learning_notebook_items', 'link')).masteryStatus).toBe('mastered')
  expect((await state.db.get('warmup_records', 'history')).items[0].description).toBe('old')
  await cacheInsightContentPatch(kind, 'target', { examples: [{ en: 'New', zh: '新' }] })
  expect(await readInsightContentPatch(kind, 'target')).toEqual({ description: 'new', examples: [{ en: 'New', zh: '新' }] })
})
