/** Recover legacy group-level answers only when exactly one child has no answer. */
export function sentenceBuildingPrompts<T extends { answer?: string }>(pattern: { items?: T[]; answer?: unknown }): T[] {
  const items = pattern.items ?? []
  const answer = typeof pattern.answer === 'string' ? pattern.answer.trim() : ''
  if (!answer || items.filter(item => !item.answer?.trim()).length !== 1) return items
  return items.map(item => item.answer?.trim() ? item : { ...item, answer })
}
