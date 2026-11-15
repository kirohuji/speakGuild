import type { WarmupTurnJudgeInput } from './warmup-local-judge'

// Small language checks complement MiniLM's relatedness score; they do not grade by themselves.
const forms: Partial<Record<string, string>> = {
  used: 'use', got: 'get', gotten: 'get', getting: 'get', took: 'take', taken: 'take', taking: 'take',
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  did: 'do', does: 'do', done: 'do', has: 'have', had: 'have', having: 'have',
  went: 'go', gone: 'go', going: 'go', came: 'come', coming: 'come', made: 'make', making: 'make',
  saw: 'see', seen: 'see', seeing: 'see', gave: 'give', given: 'give', giving: 'give',
  bought: 'buy', brought: 'bring', thought: 'think', said: 'say', told: 'tell',
  met: 'meet', found: 'find', left: 'leave', leaving: 'leave', felt: 'feel',
  wrote: 'write', written: 'write', writing: 'write', ran: 'run', running: 'run',
  ate: 'eat', eaten: 'eat', knew: 'know', known: 'know', cut: 'cut', read: 'read',
}
const participles = new Set(['been', 'done', 'got', 'gotten', 'taken', 'gone', 'come', 'made', 'seen', 'given', 'bought', 'brought', 'thought', 'said', 'told', 'met', 'found', 'left', 'felt', 'written', 'run', 'eaten', 'known', 'cut', 'read'])
export function englishText(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'")
    .replace(/\bcan't\b/g, 'can not').replace(/\bcannot\b/g, 'can not')
    .replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not')
    .replace(/\bi'm\b/g, 'i am').replace(/\b(you|we|they)'re\b/g, '$1 are')
    .replace(/\b(\w+)'ll\b/g, '$1 will').replace(/\b(\w+)'ve\b/g, '$1 have')
}
export function wordRoot(word: string): string {
  const known = forms[word]
  if (known) return known
  if (/ies$/.test(word)) return word.slice(0, -3) + 'y'
  if (/ing$/.test(word) && word.length > 4) return word.slice(0, -3).replace(/([b-df-hj-np-tv-z])\1$/, '$1')
  if (/ied$/.test(word)) return word.slice(0, -3) + 'y'
  if (/ed$/.test(word) && word.length > 4) return word.slice(0, -2).replace(/([b-df-hj-np-tv-z])\1$/, '$1')
  if (/s$/.test(word) && !/(ss|us|is)$/.test(word) && word.length > 3) return word.slice(0, -1)
  return word
}
function words(text: string): string[] { return englishText(text).match(/[a-z]+|\d+(?:\.\d+)?/g) ?? [] }
function comparable(word: string) { return wordRoot(word).replace(/e+$/, '') }
const determiners = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those'])
function contentWords(text: string) { return words(text).filter(w => !determiners.has(w)) }

type Part = { fixed: string } | { slot: string }
function template(target: string): Part[] {
  const parts: Part[] = []
  for (const fragment of englishText(target).split(/(\[[^\]]+\]|_{2,}|\.{2,}|…)/).filter(Boolean)) {
    if (/^(\[|__|\.\.|…)/.test(fragment)) parts.push({ slot: fragment.replace(/[\[\]]/g, '') })
    else parts.push(...contentWords(fragment).map(fixed => ({ fixed })))
  }
  // A concrete sample sentence embeds its reusable phrase in a larger sentence.
  if (!parts.some(p => 'slot' in p)) {
    if ('fixed' in (parts[0] ?? {}) && /^(i|you|we|they|he|she)$/.test((parts[0] as { fixed: string }).fixed)) parts.shift()
    if ('fixed' in (parts[0] ?? {}) && (parts[0] as { fixed: string }).fixed === 'will') parts.shift()
    const prepositions = new Set(['to', 'from', 'with', 'for', 'of', 'in', 'at', 'on'])
    let lastPrep = -1
    parts.forEach((p, i) => { if ('fixed' in p && prepositions.has(p.fixed)) lastPrep = i })
    if (lastPrep > 0 && lastPrep < parts.length - 1) {
      const tail = (parts[lastPrep + 1] as { fixed: string }).fixed
      parts.splice(lastPrep + 1, parts.length, { slot: tail.endsWith('ing') ? 'v-ing' : 'content' })
    } else if (parts.length >= 3 && 'fixed' in parts.at(-1)! && (parts.at(-1) as { fixed: string }).fixed.endsWith('ly')) {
      parts.splice(1, parts.length - 2, { slot: 'content' })
    }
  }
  return parts
}
function matchTemplate(text: string, parts: Part[], reference?: string): boolean {
  const tokens = contentWords(text)
  function visit(pi: number, ti: number): boolean {
    if (pi === parts.length) return true
    const p = parts[pi]
    if ('fixed' in p) {
      if (ti >= tokens.length) return false
      if (/^(usually|often|always|sometimes|still|really|finally|already|gradually)$/.test(tokens[ti])
        && comparable(p.fixed) !== comparable(tokens[ti]) && visit(pi, ti + 1)) return true
      // Directional adverbs occupy a destination slot without a preposition.
      if (p.fixed === 'to' && 'slot' in (parts[pi + 1] ?? {}) && /place/.test((parts[pi + 1] as { slot: string }).slot)
        && /^(home|here|there|abroad|upstairs|downstairs)$/.test(tokens[ti])) return visit(pi + 2, ti + 1)
      if (p.fixed === 'to' && 'slot' in (parts[pi + 1] ?? {}) && /place/.test((parts[pi + 1] as { slot: string }).slot)
        && tokens[ti] === 'to' && /^(home|here|there|abroad|upstairs|downstairs)$/.test(tokens[ti + 1] ?? '')) return false
      if (/(ed|en)$/.test(p.fixed) && !/(ed|en)$/.test(tokens[ti]) && comparable(p.fixed) === comparable(tokens[ti])) return false
      return comparable(p.fixed) === comparable(tokens[ti]) && visit(pi + 1, ti + 1)
    }
    for (let end = ti + 1; end <= tokens.length; end++) {
      const first = tokens[ti]
      const next = parts[pi + 1]
      if (next && 'fixed' in next && tokens.slice(ti, end).some(t => comparable(t) === comparable(next.fixed))) continue
      if (/^(v-ing|doing)$/.test(p.slot) && !first.endsWith('ing')) continue
      if (/past participle/.test(p.slot) && !(/(ed|en)$/.test(first) || participles.has(first))) continue
      if (/^(do|verb phrase|verb)$/.test(p.slot) && (/(ing|ed)$/.test(first) || (/s$/.test(first) && wordRoot(first) !== first))) continue
      if (/noun.*(doing|v-ing)/.test(p.slot) && reference) {
        const referenceGerunds = words(reference).filter(w => w.endsWith('ing'))
        if (!first.endsWith('ing') && referenceGerunds.some(w => comparable(w) === comparable(first))) continue
      }
      if (visit(pi + 1, end)) return true
    }
    return false
  }
  if (parts.length > 0 && tokens.some((_, start) => visit(0, start))) return true
  // Duration frames have a conventional interrogative form with the time slot questioned.
  if (parts.length === 6 && 'fixed' in parts[0] && parts[0].fixed === 'it'
    && 'fixed' in parts[1] && comparable(parts[1].fixed) === 'tak'
    && 'slot' in parts[2] && 'slot' in parts[3] && /time/.test(parts[3].slot)
    && reference && /^how long/i.test(reference)) {
    return ['do', 'will', 'would'].some(aux => matchTemplate(text,
      [{ fixed: 'how' }, { fixed: 'long' }, { fixed: aux }, parts[0], parts[1], parts[2], parts[4], parts[5]]))
  }
  return false
}
function alternatives(target: string): string[] {
  let depth = 0, current = ''; const result: string[] = []
  for (const char of target) {
    if (char === '[') depth++
    if (char === ']') depth--
    if (!depth && /[/|]/.test(char)) { result.push(current.trim()); current = '' } else current += char
  }
  result.push(current.trim())
  if (result.length > 1) {
    const suffix = result.at(-1)!.match(/^\S+(\s+.+)$/)?.[1]
    if (suffix) return result.map(r => /^\S+$/.test(r) ? r + suffix : r)
  }
  return result.filter(Boolean)
}
export function targetIsUsed(input: WarmupTurnJudgeInput) {
  if (input.direction === 'en_to_zh') return true
  const targets = [...(input.requiredWords ?? [])]
  if (input.targetText) targets.push(...(input.stepType === 'vocab_drill' ? input.targetText.split(/[,，、;]/) : [input.targetText]))
  return targets.filter(t => t.trim()).every(target => alternatives(target).some(t => matchTemplate(input.userAnswer, template(t), input.expectedAnswer)))
}

function negative(text: string): boolean {
  const normalized = englishText(text).replace(/not (only|bad|late)|no problem|without fail|能不能|可不可以|会不会|要不要|有没有|是不是|没关系|不错|不差|不用谢|不好意思|不得不|不能不/g, '')
  return /\b(not|never|nobody|nothing|neither|unable|hardly)\b/.test(normalized)
    || /不|没|未能|未曾|尚未|并未|从未|无人|别/.test(normalized)
}
const numbers: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]; row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const old = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + Number(a[i - 1] !== b[j - 1]))
      previous = old
    }
  }
  return row[b.length]
}
function quantities(text: string) {
  let normalized = englishText(text).replace(/half an? hour/g, '30 minutes').replace(/a couple of/g, 'two')
  const han: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  normalized = normalized.replace(/(?:[一二两三四五六七八九]?十[一二三四五六七八九]?|[一二两三四五六七八九])(?=个|本|名|位|件|次|天|年|月|小时|钟头|分钟|周|点|岁|元|块|杯|把|辆|双)/g, token => {
    const [a, b] = token.split('十')
    return String(token.includes('十') ? (han[a] ?? 1) * 10 + (han[b] ?? 0) : han[token])
  })
  normalized = normalized.replace(new RegExp('\\b(' + Object.keys(numbers).join('|') + ')\\b', 'g'), token => String(numbers[token]))
  normalized = normalized.replace(/\b(\d+)[ -]+(\d+)\b/g, (_, a, b) => Number(a) >= 20 && Number(b) < 10 ? String(Number(a) + Number(b)) : `${a} ${b}`)
  normalized = normalized.replace(/(\d+)\s+([a-z]{4,})/g, (match, number, unit) => {
    const equivalent = ['minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks'].find(u => editDistance(u, unit) <= 1)
    return equivalent ? `${number} ${equivalent}` : match
  })
  const result: string[] = []
  for (const m of normalized.matchAll(/(\d+(?:\.\d+)?)\s*(?:个)?\s*(hours?|minutes?|days?|weeks?|小时|钟头|分钟|天|周)?/g)) {
    const unit = m[2] ?? ''; const value = Number(m[1])
    const multiplier = /hour|小时|钟头/.test(unit) ? 60 : /day|天/.test(unit) ? 1440 : /week|周/.test(unit) ? 10080 : 1
    result.push(`${value * multiplier}:${unit ? 'duration' : 'count'}`)
  }
  return result.sort()
}
function subjectAndObject(text: string): string[] {
  const normalized = englishText(text)
  if (/\bby\b/.test(normalized)) return [] // Passive paraphrases need semantic comparison.
  const aliases: Record<string, string> = { i: 'i', me: 'i', he: 'he', him: 'he', she: 'she', her: 'she', we: 'we', us: 'we', they: 'they', them: 'they', you: 'you' }
  return (normalized.match(/\b(i|me|he|him|she|her|we|us|they|them|you)\b/g) ?? normalized.match(/[我你他她]/g) ?? []).map(w => aliases[w] ?? w)
}
export function meaningConflict(input: WarmupTurnJudgeInput): string | null {
  const reference = input.expectedAnswer?.trim()
  if (!reference) return null
  const answer = input.userAnswer
  if (negative(reference) !== negative(answer)) return '肯定或否定的意思变了。'
  const expectedNumbers = quantities(reference), actualNumbers = quantities(answer)
  if (expectedNumbers.length && JSON.stringify(expectedNumbers) !== JSON.stringify(actualNumbers)) return '数量或时间长度与题目不一致。'
  for (const [a, b] of [['按时', '迟到'], ['准时', '迟到'], ['before', 'after'], ['之前', '之后'], ['午饭前', '午饭后'], ['昨天', '明天'], ['yesterday', 'tomorrow']]) {
    if ((reference.includes(a) && answer.includes(b)) || (reference.includes(b) && answer.includes(a))) return '时间先后关系与题目不一致。'
  }
  const timeRelations = (text: string) => [...text.matchAll(/([\p{Script=Han}]{1,6})(前|后)/gu)]
    .map(m => [m[1].replace(/[之以]$/, '').slice(-2), m[2]])
  const expectedTime = timeRelations(reference), actualTime = timeRelations(answer)
  if (expectedTime.some(([event, relation]) => actualTime.some(([other, value]) => event === other && relation !== value))) return '时间先后关系与题目不一致。'
  const modal = (text: string) => /\b(can|could|able to)\b/.test(englishText(text)) ? 'ability'
    : /\b(must|have to|has to|need to)\b/.test(englishText(text)) ? 'obligation' : null
  if (modal(reference) && modal(answer) && modal(reference) !== modal(answer)) return '能力或义务的意思变了。'
  const expectedRoles = subjectAndObject(reference), actualRoles = subjectAndObject(answer)
  if (expectedRoles.length >= 2 && actualRoles.length >= 2 && expectedRoles[0] !== expectedRoles.at(-1)
    && expectedRoles[0] === actualRoles.at(-1) && expectedRoles.at(-1) === actualRoles[0]) return '动作的双方关系颠倒了。'
  const head = words(input.targetText ?? '')[0]
  if (head) {
    const roleWords = (text: string) => {
      const tokens = contentWords(text), index = tokens.findIndex(t => comparable(t) === comparable(head))
      return index > 0 && index < tokens.length - 1 ? [tokens[index - 1], tokens[index + 1]] : []
    }
    const a = roleWords(reference), b = roleWords(answer)
    if (a.length && b.length && a[0] !== a[1] && a[0] === b[1] && a[1] === b[0]) return '动作的双方关系颠倒了。'
  }
  const expectedSymbols = reference.match(/[$€£%]/g)?.join('') ?? '', actualSymbols = answer.match(/[$€£%]/g)?.join('') ?? ''
  if (expectedSymbols !== actualSymbols) return '金额或百分比的单位发生了变化。'
  return null
}
