/** Lean insight / immersive playlist: append pages, hydrate detail on demand. */

export const INSIGHT_LIST_PAGE_SIZE = 100
export const INSIGHT_LIST_REMAINING = 20

export type InsightListItem = {
  id: string
  kind: 'word' | 'chunk' | 'pattern'
  title: string
  meaning?: string
}

/** Absolute offset that covers `absoluteIndex` when loading a page from the start of that page. */
export function insightListPageOffset(absoluteIndex: number, pageSize = INSIGHT_LIST_PAGE_SIZE) {
  const size = Math.max(1, pageSize)
  const index = Math.max(0, absoluteIndex)
  return Math.floor(index / size) * size
}

/**
 * True when the visible/active index is within `remaining` of the loaded end
 * (e.g. near item 80 of a 100-item page) and more rows exist.
 */
export function shouldLoadMoreInsightList(input: {
  loadedCount: number
  total: number
  /** Absolute index the user is at or scrolling near. */
  nearIndex: number
  remaining?: number
}) {
  if (input.loadedCount <= 0 || input.loadedCount >= input.total) return false
  const remaining = input.remaining ?? INSIGHT_LIST_REMAINING
  return input.loadedCount - input.nearIndex <= remaining
}

export function appendUniqueInsightList(
  existing: InsightListItem[],
  next: InsightListItem[],
): InsightListItem[] {
  if (next.length === 0) return existing
  const seen = new Set(existing.map((item) => item.id))
  const merged = existing.slice()
  for (const item of next) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  return merged
}

export function insightTitleOf(item: {
  kind: InsightListItem['kind']
  title?: string
  word?: string
  text?: string
  pattern?: string
}) {
  if (item.title) return item.title
  if (item.kind === 'word') return item.word ?? ''
  if (item.kind === 'chunk') return item.text ?? ''
  return item.pattern ?? ''
}

/** Minimal Full stub so dialogs can render list rows before detail hydrate. */
export function stubInsightFromLean(item: InsightListItem): {
  kind: InsightListItem['kind']
  id: string
  word?: string
  text?: string
  pattern?: string
  meaning?: string
} {
  if (item.kind === 'word') {
    return { kind: 'word', id: item.id, word: item.title, meaning: item.meaning }
  }
  if (item.kind === 'chunk') {
    return { kind: 'chunk', id: item.id, text: item.title, meaning: item.meaning ?? '' }
  }
  return { kind: 'pattern', id: item.id, pattern: item.title, meaning: item.meaning }
}
