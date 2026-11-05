export type PatternSlot = string | { name: string; description?: string; hint?: string }

export function patternSlotLabel(slot: unknown): string {
  if (typeof slot === 'string') return slot
  if (!slot || typeof slot !== 'object') return ''
  const value = slot as { name?: unknown; description?: unknown; hint?: unknown }
  for (const candidate of [value.name, value.description, value.hint]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return ''
}

export function patternSlotDescription(slot: unknown): string | undefined {
  if (!slot || typeof slot !== 'object') return undefined
  const value = slot as { description?: unknown; hint?: unknown }
  const description = value.description ?? value.hint
  return typeof description === 'string' && description.trim() ? description.trim() : undefined
}
