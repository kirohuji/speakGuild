/** Windowed playlist helpers for Insight / Immersive — keep memory to ±1 page. */

export function computePlaylistWindow(input: {
  absoluteIndex: number
  total: number
  pageSize: number
}) {
  const pageSize = Math.max(1, input.pageSize)
  const absoluteIndex = Math.max(0, Math.min(input.absoluteIndex, Math.max(input.total - 1, 0)))
  const windowStart = Math.max(0, absoluteIndex - pageSize)
  const windowSize = pageSize * 3
  return {
    absoluteIndex,
    windowStart,
    windowSize,
    indexInWindow: absoluteIndex - windowStart,
  }
}

/** Reload when outside the window or within 2 items of either edge. */
export function shouldReloadPlaylistWindow(inWindow: number, windowLength: number) {
  if (windowLength <= 0) return true
  return inWindow < 0 || inWindow >= windowLength || inWindow <= 1 || inWindow >= windowLength - 2
}

export function expressionDisplayTitle(
  expr: {
    original?: string | null
    chunkText?: string | null
    corrected?: string | null
    vocabulary?: { word?: string | null } | null
    contentData?: { pattern?: string | null; text?: string | null } | null
  },
  apiType: 'word' | 'scene_phrase' | string,
): string {
  if (apiType === 'word') return String(expr.vocabulary?.word || expr.original || '')
  if (apiType === 'scene_phrase') {
    return String(expr.contentData?.pattern || expr.chunkText || expr.corrected || '')
  }
  return String(expr.contentData?.text || expr.chunkText || expr.corrected || '')
}

export function hasExpressionTitle(
  expr: Parameters<typeof expressionDisplayTitle>[0],
  apiType: Parameters<typeof expressionDisplayTitle>[1],
) {
  return Boolean(expressionDisplayTitle(expr, apiType).trim())
}
