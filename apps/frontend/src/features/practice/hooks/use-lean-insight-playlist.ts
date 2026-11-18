import { useCallback, useMemo, useRef, useState } from 'react'
import type { LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import {
  INSIGHT_LIST_PAGE_SIZE,
  appendUniqueInsightList,
  shouldLoadMoreInsightList,
  stubInsightFromLean,
  type InsightListItem,
} from '@/lib/offline/insight-playlist'
import { mapInsightItemToImmersiveItem } from '@/features/learning/components/immersive-player/immersive-player.mapper'
import type { ImmersivePlayerItem } from '@/features/learning/components/immersive-player'
import { insightListDiag } from '@/lib/offline/insight-list-diag'

export type LeanInsightPageFetcher = (input: {
  offset: number
  limit: number
}) => Promise<{ items: InsightListItem[]; total: number }>

export type LeanInsightDetailFetcher = (id: string) => Promise<LearningInsightItem | null>

function asInsightStub(lean: InsightListItem): LearningInsightItem {
  return stubInsightFromLean(lean) as LearningInsightItem
}

/**
 * Lean append playlist for Insight / Immersive:
 * list grows from offset 0; detail hydrates for current ±1.
 */
export function useLeanInsightPlaylist(options: {
  fetchPage: LeanInsightPageFetcher
  fetchDetail: LeanInsightDetailFetcher
}) {
  const fetchPageRef = useRef(options.fetchPage)
  const fetchDetailRef = useRef(options.fetchDetail)
  fetchPageRef.current = options.fetchPage
  fetchDetailRef.current = options.fetchDetail

  const [leanItems, setLeanItems] = useState<InsightListItem[]>([])
  const [total, setTotal] = useState(0)
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const detailByIdRef = useRef(new Map<string, LearningInsightItem>())
  const [detailEpoch, setDetailEpoch] = useState(0)
  const loadingMoreRef = useRef(false)
  const leanItemsRef = useRef(leanItems)
  leanItemsRef.current = leanItems
  const totalRef = useRef(total)
  totalRef.current = total

  const displayItems = useMemo(
    () => leanItems.map((lean) => detailByIdRef.current.get(lean.id) ?? asInsightStub(lean)),
    [leanItems, detailEpoch],
  )

  const immersiveItems: ImmersivePlayerItem[] = useMemo(
    () => displayItems
      .map(mapInsightItemToImmersiveItem)
      .filter((item): item is ImmersivePlayerItem => Boolean(item.title.trim())),
    [displayItems],
  )

  const ensureDetail = useCallback(async (id: string | undefined) => {
    if (!id) return null
    const cached = detailByIdRef.current.get(id)
    if (cached) {
      insightListDiag('detail.cache_hit', { id, detailCacheSize: detailByIdRef.current.size })
      return cached
    }
    insightListDiag('detail.fetch', { id, detailCacheSize: detailByIdRef.current.size })
    const detail = await fetchDetailRef.current(id)
    if (!detail) {
      insightListDiag('detail.miss', { id })
      return null
    }
    detailByIdRef.current.set(id, detail)
    setDetailEpoch((n) => n + 1)
    insightListDiag('detail.hydrated', {
      id,
      kind: detail.kind,
      detailCacheSize: detailByIdRef.current.size,
    })
    return detail
  }, [])

  const ensureDetailsAround = useCallback(async (absoluteIndex: number, items: InsightListItem[]) => {
    const ids = [items[absoluteIndex]?.id, items[absoluteIndex - 1]?.id, items[absoluteIndex + 1]?.id]
    insightListDiag('detail.prefetch_pm1', {
      absoluteIndex,
      ids: ids.filter(Boolean),
      loadedCount: items.length,
    })
    await Promise.all(ids.map((id) => ensureDetail(id)))
  }, [ensureDetail])

  const appendFromOffset = useCallback(async (offset: number, replace = false) => {
    insightListDiag('lean.fetch_page', {
      offset,
      limit: INSIGHT_LIST_PAGE_SIZE,
      replace,
      loadedBefore: leanItemsRef.current.length,
    })
    const page = await fetchPageRef.current({
      offset,
      limit: INSIGHT_LIST_PAGE_SIZE,
    })
    setTotal(page.total)
    totalRef.current = page.total
    const nextItems = replace ? page.items : appendUniqueInsightList(leanItemsRef.current, page.items)
    const appended = nextItems.length - leanItemsRef.current.length
    leanItemsRef.current = nextItems
    setLeanItems(nextItems)
    insightListDiag(replace ? 'lean.replace' : 'lean.append', {
      offset,
      fetched: page.items.length,
      appended: replace ? page.items.length : appended,
      loadedCount: nextItems.length,
      total: page.total,
      remainingToEnd: Math.max(page.total - nextItems.length, 0),
      sample: page.items.slice(0, 2).map((item) => ({ id: item.id, title: item.title })),
    })
    return page
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) {
      insightListDiag('lean.load_more_skip', { reason: 'in_flight' })
      return
    }
    const loaded = leanItemsRef.current.length
    if (loaded >= totalRef.current) {
      insightListDiag('lean.load_more_skip', { reason: 'complete', loaded, total: totalRef.current })
      return
    }
    loadingMoreRef.current = true
    setLoadingMore(true)
    insightListDiag('lean.load_more', { offset: loaded, total: totalRef.current })
    try {
      await appendFromOffset(loaded, false)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [appendFromOffset])

  const ensureCoverage = useCallback(async (absoluteIndex: number) => {
    if (leanItemsRef.current.length === 0) {
      await appendFromOffset(0, true)
    }
    while (
      absoluteIndex >= leanItemsRef.current.length
      && leanItemsRef.current.length < totalRef.current
    ) {
      const before = leanItemsRef.current.length
      insightListDiag('lean.ensure_coverage', {
        absoluteIndex,
        loadedBefore: before,
        total: totalRef.current,
      })
      await appendFromOffset(before, false)
      if (leanItemsRef.current.length <= before) break
    }
    return leanItemsRef.current
  }, [appendFromOffset])

  const openAt = useCallback(async (absoluteIndex: number) => {
    insightListDiag('playlist.open', { absoluteIndex, pageSize: INSIGHT_LIST_PAGE_SIZE })
    detailByIdRef.current = new Map()
    setDetailEpoch((n) => n + 1)
    leanItemsRef.current = []
    setLeanItems([])
    totalRef.current = 0
    setTotal(0)

    const items = await ensureCoverage(absoluteIndex)
    if (items.length === 0) {
      insightListDiag('playlist.open_empty', { absoluteIndex })
      return false
    }
    const clamped = Math.min(Math.max(absoluteIndex, 0), Math.max(items.length - 1, 0))
    setIndex(clamped)
    await ensureDetailsAround(clamped, items)
    setOpen(true)
    insightListDiag('playlist.open_ready', {
      index: clamped,
      loadedCount: items.length,
      total: totalRef.current,
      windowOffset: 0,
      detailCacheSize: detailByIdRef.current.size,
    })
    return true
  }, [ensureCoverage, ensureDetailsAround])

  const handleIndexChange = useCallback(async (absoluteIndex: number) => {
    const nearEnd = shouldLoadMoreInsightList({
      loadedCount: leanItemsRef.current.length,
      total: totalRef.current,
      nearIndex: absoluteIndex,
    })
    insightListDiag('playlist.index_change', {
      absoluteIndex,
      loadedCount: leanItemsRef.current.length,
      total: totalRef.current,
      nearEnd,
      remaining: leanItemsRef.current.length - absoluteIndex,
    })
    if (nearEnd) {
      await loadMore()
    }
    await ensureCoverage(absoluteIndex)
    const items = leanItemsRef.current
    if (items.length === 0) return
    const clamped = Math.min(
      Math.max(absoluteIndex, 0),
      Math.max(Math.min(totalRef.current, items.length) - 1, 0),
    )
    setIndex(clamped)
    await ensureDetailsAround(clamped, items)
  }, [ensureCoverage, ensureDetailsAround, loadMore])

  const reset = useCallback(() => {
    insightListDiag('playlist.reset', {
      loadedCount: leanItemsRef.current.length,
      detailCacheSize: detailByIdRef.current.size,
    })
    setOpen(false)
    leanItemsRef.current = []
    setLeanItems([])
    totalRef.current = 0
    setTotal(0)
    setIndex(0)
    detailByIdRef.current = new Map()
    setDetailEpoch((n) => n + 1)
  }, [])

  return {
    open,
    setOpen,
    index,
    total,
    leanItems,
    displayItems,
    immersiveItems,
    loadingMore,
    openAt,
    loadMore,
    handleIndexChange,
    reset,
    windowOffset: 0 as const,
  }
}
