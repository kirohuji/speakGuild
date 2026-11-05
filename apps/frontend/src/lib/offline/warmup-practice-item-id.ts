/**
 * Stable IDs for offline warm-up items. These IDs are persisted in SQLite and
 * sent to the API, so every consumer must derive them from the downloaded
 * package with exactly the same algorithm.
 */
function stableStringify(value: any): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

export function stableHash(value: any): string {
  const input = stableStringify(value)
  let hash = 5381
  for (let index = 0; index < input.length; index += 1) hash = ((hash << 5) + hash) ^ input.charCodeAt(index)
  return (hash >>> 0).toString(36)
}

function compactKey(value: any, fallback: string) {
  if (value == null) return fallback
  return String(value).trim() || fallback
}

function warmupItemIdentity(item: any) {
  return {
    type: item?.type,
    title: item?.title,
    kind: item?.kind,
    direction: item?.direction,
    chunk: item?.chunk,
    chunkMeaning: item?.chunkMeaning,
    pattern: item?.pattern,
    patternMeaning: item?.patternMeaning,
    vocabWord: item?.vocabWord,
    vocabMeaning: item?.vocabMeaning,
    fullSentence: item?.fullSentence,
    levels: item?.levels,
  }
}

export function createWarmupPracticeItemId(params: {
  packId: string
  topicId: string
  type: string
  item: any
  prompt: any
  pattern?: any
}) {
  const itemKey = compactKey(params.item?.id, `item-${stableHash(warmupItemIdentity(params.item))}`)
  const patternPart = params.pattern
    ? `:p-${compactKey(params.pattern.id, stableHash({
      chunk: params.pattern.chunk,
      meaning: params.pattern.meaning,
      chunkMeaning: params.pattern.chunkMeaning,
      pattern: params.pattern.pattern,
    }))}`
    : ''
  const promptKey = compactKey(
    params.prompt?.id ?? params.prompt?.vocabId,
    `prompt-${stableHash({
      zh: params.prompt?.zh,
      answer: params.prompt?.answer,
      promptZh: params.prompt?.promptZh,
      suggestedAnswer: params.prompt?.suggestedAnswer,
      targetWords: params.prompt?.targetWords,
      fullSentence: params.prompt?.fullSentence,
      levels: params.prompt?.levels,
    })}`,
  )
  return `${params.packId}:${params.topicId}:${itemKey}:${params.type}${patternPart}:i-${promptKey}`
}

export function buildWarmupPracticeItemIds(packId: string, topics: Array<{ id: string; metadata?: any }>) {
  const itemIds: string[] = []
  for (const topic of topics) {
    const metadata = topic.metadata ?? {}
    const pipeline = metadata.outputTraining?.enabled === false
      ? []
      : Array.isArray(metadata.outputTraining?.pipeline)
        ? metadata.outputTraining.pipeline
        : metadata.enabled === false
          ? []
          : Array.isArray(metadata.pipeline)
            ? metadata.pipeline
            : []
    for (const item of pipeline) {
      const type = item?.type
      if (!type) continue
      const push = (prompt: any, pattern?: any) => itemIds.push(createWarmupPracticeItemId({
        packId,
        topicId: topic.id,
        type,
        item,
        prompt,
        pattern,
      }))
      if (type === 'chunk_substitution' || type === 'pattern_drill') {
        for (const prompt of Array.isArray(item.items) ? item.items : []) push(prompt)
      } else if (type === 'vocab_drill') {
        for (const prompt of Array.isArray(item.vocabs) ? item.vocabs : []) push(prompt)
      } else if (type === 'vocab_sentence_building') {
        for (const pattern of Array.isArray(item.patterns) ? item.patterns : []) {
          for (const prompt of Array.isArray(pattern?.items) ? pattern.items : []) push({ ...prompt, pattern }, pattern)
        }
      } else if (type === 'sentence_decomposition') {
        push({ levels: item.levels, fullSentence: item.fullSentence })
      }
    }
  }
  return itemIds
}
