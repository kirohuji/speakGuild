const CONTENT_FIELDS = [
  'word', 'text', 'pattern', 'meaning', 'description', 'definitionEn', 'partOfSpeech',
  'phoneticUs', 'phoneticUk', 'audioUsUrl', 'audioUkUrl', 'difficulty', 'example', 'slots',
] as const

export function hasContentText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function contentSnapshotScore(snapshot: unknown): number {
  if (!snapshot || typeof snapshot !== 'object') return 0
  const record = snapshot as Record<string, unknown>
  let score = 0
  if (hasContentText(record.meaning)) score += 2
  if (hasContentText(record.description)) score += 2
  if (hasContentText(record.definitionEn)) score += 1
  if (hasContentText(record.example)) score += 2
  const examples = record.examples
  if (Array.isArray(examples) && examples.length > 0) score += 4 + examples.length
  else if (hasContentText(examples)) score += 4
  if (hasContentText(record.phoneticUs) || hasContentText(record.phoneticUk)) score += 1
  if (hasContentText(record.audioUsUrl) || hasContentText(record.audioUkUrl)) score += 1
  return score
}

export function looksLikeContentSnapshot(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false
  const record = snapshot as Record<string, unknown>
  return hasContentText(record.meaning)
    || hasContentText(record.description)
    || hasContentText(record.definitionEn)
    || hasContentText(record.example)
    || hasContentText(record.word)
    || hasContentText(record.text)
    || hasContentText(record.pattern)
    || (Array.isArray(record.examples) && record.examples.length > 0)
}

/** 以更完整的一份为底，只用另一份填上仍然为空的释义、例句和发音。 */
export function mergeContentSnapshots<T>(current: T, incoming: unknown): T {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return current
  if (!current || typeof current !== 'object' || Array.isArray(current)) return incoming as T
  const currentRecord = current as Record<string, unknown>
  const incomingRecord = incoming as Record<string, unknown>
  const [base, extra] = contentSnapshotScore(incomingRecord) > contentSnapshotScore(currentRecord)
    ? [incomingRecord, currentRecord]
    : [currentRecord, incomingRecord]
  const merged: Record<string, unknown> = { ...base }
  for (const field of CONTENT_FIELDS) {
    if (!hasContentText(merged[field]) && hasContentText(extra[field])) merged[field] = extra[field]
  }
  const baseExamples = merged.examples
  const extraExamples = extra.examples
  const baseHasExamples = Array.isArray(baseExamples) ? baseExamples.length > 0 : hasContentText(baseExamples)
  const extraHasExamples = Array.isArray(extraExamples) ? extraExamples.length > 0 : hasContentText(extraExamples)
  if (!baseHasExamples && extraHasExamples) merged.examples = extraExamples
  if ((!Array.isArray(merged.synonyms) || merged.synonyms.length === 0) && Array.isArray(extra.synonyms) && extra.synonyms.length > 0) {
    merged.synonyms = extra.synonyms
  }
  return merged as T
}

export function keepRicher<T>(current: T | undefined, incoming: T): T {
  if (!current) return incoming
  return contentSnapshotScore(incoming) > contentSnapshotScore(current) ? incoming : current
}
