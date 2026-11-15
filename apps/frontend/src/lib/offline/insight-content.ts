import { localDb, type LocalWrite } from './unified-storage'
import { serializeNotebookWrite } from './notebook-mutations'
import { notifyLearningLibraryChanged } from './learning-content.repository'

export type InsightContentPatch = { description?: string; examples?: unknown }
export type InsightContentKind = 'word' | 'chunk' | 'pattern'
const tables = { word: 'offline_vocabularies', chunk: 'offline_chunks', pattern: 'offline_patterns' } as const
const bareId = (id: unknown) => String(id ?? '').replace(/^(word|chunk|pattern):/, '')
const key = (kind: InsightContentKind, id: string) => `content-regeneration:${kind}:${bareId(id)}`

export async function resolveInsightContentId(kind: InsightContentKind, id: string, text?: string): Promise<string> {
  const direct = await localDb.get<any>(tables[kind], bareId(id))
  if (direct) return direct.id
  if (!text?.trim()) return id
  const matches = await localDb.findByIndex<any>(tables[kind], 'normalized_text', text.trim().toLowerCase())
  return matches.length === 1 ? matches[0].id : id
}

export async function readInsightContentPatch(kind: InsightContentKind, id: string): Promise<InsightContentPatch> {
  return (await localDb.get<{ patch: InsightContentPatch }>('kv', key(kind, id)))?.patch ?? {}
}

/** Replace one canonical field everywhere it is cached, preserving user state. */
export async function cacheInsightContentPatch(kind: InsightContentKind, id: string, patch: InsightContentPatch) {
  return serializeNotebookWrite(async () => {
    const contentId = bareId(id)
    const writes: LocalWrite[] = []
    const rewrite = (value: any): any => {
      if (!value || typeof value !== 'object') return value
      if (Array.isArray(value)) {
        const next = value.map(rewrite)
        return next.some((v, i) => v !== value[i]) ? next : value
      }
      let next = value
      for (const [name, child] of Object.entries(value)) {
        const updated = rewrite(child)
        if (updated !== child) next = { ...next, [name]: updated }
      }
      if (bareId(value.id) === contentId) next = { ...next, ...patch }
      return next
    }
    // Shared content index, package/topic caches and current task snapshots.
    for (const table of ['downloaded_unit_details', 'daily_practice_items'] as const) {
      for (const row of await localDb.list<any>(table)) {
        const next = rewrite(row)
        if (next !== row) writes.push({ table, value: next })
      }
    }
    const table = tables[kind]
    const indexed = await localDb.get<any>(table, contentId)
    if (indexed) writes.push({ table, value: { ...indexed, data: { ...indexed.data, ...patch } } })
    for (const entry of await localDb.list<any>('expression_entries')) {
      if (entry.kind !== kind) continue
      const sourceId = bareId(entry.sourceId || entry.contentSnapshot?.id)
      const text = String(kind === 'word' ? entry.original : entry.chunkText).trim().toLowerCase()
      const canonicalText = String(indexed?.data?.word ?? indexed?.data?.text ?? indexed?.data?.pattern ?? '').trim().toLowerCase()
      const legacyId = !sourceId || sourceId.toLowerCase() === text || (kind === 'pattern' && /^\d+$/.test(sourceId))
      if (sourceId !== contentId && !(legacyId && text && text === canonicalText)) continue
      writes.push({ table: 'expression_entries', value: { ...entry,
        contentSnapshot: { ...entry.contentSnapshot, ...patch }, sourceSnapshot: { ...entry.sourceSnapshot, ...patch },
      } })
    }
    const previous = await localDb.get<any>('kv', key(kind, contentId))
    // Only the administrator dialog reads this small snapshot on reopening.
    writes.push({ table: 'kv', value: { id: key(kind, contentId),
      patch: { ...previous?.patch, ...patch } } })
    await localDb.commitLocalWrites(writes)
    notifyLearningLibraryChanged()
  })
}
