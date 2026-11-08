export type WordMeaningGroup = {
  posKey: string
  fallback: string
  glosses: string[]
}

const POS_KEYS: Record<string, string> = {
  'v.': 'verb',
  'verb': 'verb',
  'modal v.': 'verb',
  'n.': 'noun',
  'noun': 'noun',
  'adj.': 'adj',
  'adjective': 'adj',
  'adv.': 'adv',
  'adverb': 'adv',
  'pron.': 'pronoun',
  'pronoun': 'pronoun',
  'prep.': 'preposition',
  'preposition': 'preposition',
  'conj.': 'conjunction',
  'conjunction': 'conjunction',
  'interj.': 'interjection',
  'int.': 'interjection',
  'interjection': 'interjection',
  'det.': 'determiner',
  'determiner': 'determiner',
  'art.': 'article',
  'article': 'article',
  'phr.': 'phr',
  'num.': 'num',
}

const POS_TOKEN = /^(modal\s+v\.|interjection|adjective|adverb|pronoun|preposition|conjunction|determiner|article|noun|verb|int\.|interj\.|adj\.|adv\.|pron\.|prep\.|conj\.|det\.|art\.|phr\.|num\.|n\.|v\.)\s*(.+)$/i

function splitGlosses(value: string) {
  const seen = new Set<string>()
  const glosses: string[] = []
  for (const piece of value.split(/[;；]/)) {
    const gloss = piece.trim()
    if (!gloss || seen.has(gloss)) continue
    seen.add(gloss)
    glosses.push(gloss)
  }
  return glosses
}

function splitPos(segment: string) {
  const match = segment.trim().match(POS_TOKEN)
  if (!match) return null
  const token = match[1].toLowerCase().replace(/\s+/g, ' ')
  const posKey = POS_KEYS[token]
  if (!posKey) return null
  const glosses = splitGlosses(match[2])
  if (glosses.length === 0) return null
  return { posKey, fallback: token.endsWith('.') ? token : `${token}.`, glosses }
}

/** 把「v.得到 / v.变得」收成按词性分组的释义。不像词性前缀的原文返回 null。 */
export function parseWordMeaningGroups(raw?: string | null): WordMeaningGroup[] | null {
  const text = raw?.trim() ?? ''
  if (!text) return null
  const segments = text.split(/\s*\/\s*/).map((segment) => segment.trim()).filter(Boolean)
  if (segments.length === 0) return null

  const groups: WordMeaningGroup[] = []
  let matched = false
  for (const segment of segments) {
    const parsed = splitPos(segment)
    if (!parsed) {
      if (groups.length === 0) return null
      const last = groups[groups.length - 1]
      for (const gloss of splitGlosses(segment)) {
        if (!last.glosses.includes(gloss)) last.glosses.push(gloss)
      }
      continue
    }
    matched = true
    const last = groups[groups.length - 1]
    if (last && last.posKey === parsed.posKey) {
      for (const gloss of parsed.glosses) {
        if (!last.glosses.includes(gloss)) last.glosses.push(gloss)
      }
      continue
    }
    groups.push(parsed)
  }

  return matched ? groups.filter((group) => group.glosses.length > 0) : null
}
