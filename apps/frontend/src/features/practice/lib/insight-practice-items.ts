type KnowledgePoint = { kind: 'word' | 'chunk' | 'pattern'; id: string; word?: string; text?: string; pattern?: string }
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()
const bare = (value: unknown) => normalize(value).replace(/^(word|chunk|pattern):/, '')

/** Match target references and English exercise content, excluding Chinese translations. */
export function filterInsightPracticeItems(pipeline: any[], point: KnowledgePoint): any[] {
  const text = normalize(point.word ?? point.text ?? point.pattern)
  const escape = (value: string) => [...value].map(char => '\\^$.*+?()[]{}|'.includes(char) ? `\\${char}` : char).join('')
  const parts = text.split(/_{2,}|\.{3}|…/).map(part => part.trim()).filter(Boolean)
  const expression = parts.length ? new RegExp(`(?:^|[^a-z0-9])${parts.map(escape).join('.+?')}(?=$|[^a-z0-9])`, 'i') : null
  const matches = (node: any) => {
    if (!node) return false
    const ids = point.kind === 'word' ? [node.vocabId, node.wordId, ...(node.vocabIds ?? [])]
      : point.kind === 'chunk' ? [node.chunkId, ...(node.chunkIds ?? [])]
        : [node.patternId, node.sentencePatternId, ...(node.patternIds ?? [])]
    if (ids.some(id => id && bare(id) === bare(point.id))) return true
    const values = point.kind === 'word' ? [node.vocabWord, node.word, ...(node.targetWords ?? [])]
      : point.kind === 'chunk' ? [node.chunk] : [node.pattern]
    return Boolean(text) && (values.some(value => normalize(value) === text)
      || [node.en, node.answer, node.suggestedAnswer, node.fullSentence, node.chunk].some(value =>
        typeof value === 'string' && expression?.test(normalize(value))))
  }
  return pipeline.flatMap(item => {
    const whole = matches(item)
    if (['chunk_substitution', 'pattern_drill'].includes(item.type)) {
      const items = (item.items ?? []).filter(prompt => whole || matches(prompt))
      return items.length ? [{ ...item, items }] : []
    }
    if (item.type === 'vocab_drill') {
      const vocabs = (item.vocabs ?? []).filter(prompt => whole || matches(prompt))
      return vocabs.length ? [{ ...item, vocabs }] : []
    }
    if (item.type === 'vocab_sentence_building') {
      const patterns = (item.patterns ?? []).flatMap(pattern => {
        const items = (pattern.items ?? []).filter(prompt => whole || matches(pattern) || matches(prompt))
        return items.length ? [{ ...pattern, items }] : []
      })
      return patterns.length ? [{ ...item, patterns }] : []
    }
    if (item.type === 'sentence_decomposition') {
      return whole || (item.levels ?? []).some(matches) ? [item] : []
    }
    return []
  })
}
