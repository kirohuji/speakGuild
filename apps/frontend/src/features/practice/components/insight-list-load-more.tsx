import { useEffect, useRef } from 'react'
import { INSIGHT_LIST_REMAINING } from '@/lib/offline/insight-playlist'
import { insightListDiag } from '@/lib/offline/insight-list-diag'

/** Fires `onLoadMore` when the user scrolls within ~REMAINING rows of the loaded end. */
export function InsightListLoadMoreSentinel({
  enabled,
  itemCount,
  onLoadMore,
  remaining = INSIGHT_LIST_REMAINING,
}: {
  enabled: boolean
  itemCount: number
  onLoadMore?: () => void
  remaining?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const firedForCountRef = useRef(-1)

  useEffect(() => {
    if (!enabled || !onLoadMore || itemCount <= 0) return
    const node = ref.current
    if (!node) return
    const root = node.closest('[data-radix-scroll-area-viewport]') as Element | null
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (firedForCountRef.current === itemCount) return
        firedForCountRef.current = itemCount
        insightListDiag('ui.sentinel_load_more', {
          itemCount,
          remaining,
          afterIndex: Math.max(0, itemCount - remaining - 1),
        })
        onLoadMore()
      },
      { root: root ?? null, rootMargin: '0px', threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, itemCount, onLoadMore, remaining])

  if (!enabled || !onLoadMore) return null
  // Parent places this after item index `itemCount - remaining - 1` (~80 of 100).
  return <div ref={ref} data-insight-load-more aria-hidden className="h-px w-full shrink-0" />
}

/** Insert after row index `itemCount - remaining - 1` (i.e. near ~80 of 100). */
export function insightLoadMoreAfterIndex(itemCount: number, remaining = INSIGHT_LIST_REMAINING) {
  if (itemCount <= 0) return -1
  return Math.max(0, itemCount - remaining - 1)
}
