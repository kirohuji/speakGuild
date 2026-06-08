import { useState, useEffect, useCallback } from 'react'
import { syncOutbox } from '@/lib/offline'
import { expressionApi } from '@/features/practice/api/english-practice-api'

// ---------- 带日期的生词条目 ----------
export interface WordEntry {
  word: string
  addedAt: string // ISO date string
}

/** 内存缓存 */
let _entriesCache: WordEntry[] | null = null

async function _loadEntries(): Promise<WordEntry[]> {
  if (_entriesCache) return _entriesCache

  // 合并本地 outbox（待同步）+ 服务端（已同步）→ 去重
  const [pending, serverRes] = await Promise.all([
    syncOutbox.listPending().catch(() => [] as any[]),
    expressionApi.list({ type: 'word' }).catch(() => [] as any),
  ])

  const serverItems = Array.isArray(serverRes)
    ? serverRes
    : (serverRes as any)?.items ?? []

  const localWords = new Set(
    pending
      .filter((item) => item.entityType === 'word_entry' && item.operation === 'create')
      .map((item) => (item.payload as any)?.word ?? item.entityId?.toLowerCase())
  )

  const serverWords = serverItems.map((item: any) => ({
    word: item.original ?? item.chunkText ?? '',
    addedAt: item.createdAt ?? new Date().toISOString(),
  }))

  const localWordSet = new Set(serverWords.map((e: any) => e.word.toLowerCase()))
  for (const w of localWords) {
    if (!localWordSet.has(w.toLowerCase())) {
      serverWords.push({ word: w, addedAt: new Date().toISOString() })
    }
  }

  _entriesCache = serverWords
  return _entriesCache
}

function _bustCache() {
  _entriesCache = null
}

/**
 * 本地生词本 Hook — 从 outbox + 服务端合并读取，变更写入 outbox。
 */
export function useWordsStore() {
  const [entries, setEntries] = useState<WordEntry[]>([])

  useEffect(() => {
    _loadEntries().then(setEntries)
  }, [])

  const addWord = useCallback(async (word: string) => {
    if (entries.some((e) => e.word === word)) return
    const now = new Date().toISOString()
    const next = [...entries, { word, addedAt: now }]
    setEntries(next)
    _entriesCache = next

    await syncOutbox.enqueue({
      entityType: 'word_entry',
      entityId: word.toLowerCase(),
      operation: 'create',
      payload: { word, addedAt: now },
    })
  }, [entries])

  const removeWord = useCallback(async (word: string) => {
    const next = entries.filter((e) => e.word !== word)
    setEntries(next)
    _bustCache()

    await syncOutbox.enqueue({
      entityType: 'word_entry',
      entityId: word.toLowerCase(),
      operation: 'delete',
      payload: { word, deletedAt: new Date().toISOString() },
    })
  }, [entries])

  const hasWord = useCallback(
    (word: string) => entries.some((e) => e.word === word),
    [entries],
  )

  return {
    entries,
    words: entries.map((e) => e.word),
    addWord,
    removeWord,
    hasWord,
  }
}
