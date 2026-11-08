const ALIAS: Record<string, string> = {
  核心含义: '核心含义',
  含义: '核心含义',
  意思: '核心含义',
  句式解析: '核心含义',
  用法提示: '用法提示',
  用法: '用法提示',
  使用场景: '用法提示',
  场景: '用法提示',
  易错点: '易错点',
  注意: '易错点',
  辨析: '易错点',
  常见搭配: '常见搭配',
  搭配: '常见搭配',
  类似表达: '常见搭配',
  同义词: '常见搭配',
  替换练习: '常见搭配',
}

const ORDER = ['核心含义', '用法提示', '易错点', '常见搭配']
const HEADING_SOURCE = Object.keys(ALIAS).sort((left, right) => right.length - left.length).join('|')
const HEADING_RE = new RegExp(
  `(?:^|\\n)\\s*(?:\\*\\*)?\\s*(${HEADING_SOURCE})\\s*(?:[：:]\\s*\\*\\*|\\*\\*\\s*[：:]|[：:])\\s*`,
  'g',
)

function stripStrayBold(body: string): string {
  return body.replace(/^(?:\*\*\s*)+/, '').trim()
}

function normalizeBody(body: string): string {
  return stripStrayBold(body)
    .split('\n')
    .map((line) => stripStrayBold(line.trim()).replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean)
    .join('')
}

function flattenCollocations(body: string): string {
  const lines = stripStrayBold(body).split('\n').map((line) => stripStrayBold(line.trim())).filter(Boolean)
  if (!lines.some((line) => /^[-*•]\s+/.test(line))) return lines.join('')
  const prose = lines
    .map((line) => line.replace(/^[-*•]\s+/, '').replace(/\(([^)]*)\)/g, '（$1）').replace(/[。；;，,、]\s*$/, '').trim())
    .filter(Boolean)
    .join('、')
  return prose ? (prose.endsWith('。') ? prose : `${prose}。`) : ''
}

function collapsePlain(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, '').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** 预览与批量写回使用同一套讲解小节，避免词与词之间标题和空行对不齐。 */
export function alignDescriptionLayout(raw: string): string {
  const text = raw.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
  if (!text) return ''
  const matches = [...text.matchAll(new RegExp(HEADING_RE.source, 'g'))]
  if (!matches.length) return collapsePlain(text)

  const sections = new Map<string, string[]>()
  const push = (name: string, body: string) => {
    if (!body) return
    const list = sections.get(name) ?? []
    list.push(body)
    sections.set(name, list)
  }

  const lead = text.slice(0, matches[0].index ?? 0).trim()
  if (lead) push('核心含义', normalizeBody(lead))
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length
    const name = ALIAS[match[1]] ?? match[1]
    const body = text.slice(start, end)
    push(name, name === '常见搭配' ? flattenCollocations(body) : normalizeBody(body))
  })

  const parts: string[] = []
  const used = new Set<string>()
  for (const name of ORDER) {
    const bodies = sections.get(name)
    if (!bodies?.length) continue
    used.add(name)
    parts.push(`**${name}：** ${bodies.join(bodies.some((body) => body.includes('\n')) ? '\n' : '')}`)
  }
  for (const [name, bodies] of sections) {
    if (used.has(name) || !bodies.length) continue
    parts.push(`**${name}：** ${bodies.join(bodies.some((body) => body.includes('\n')) ? '\n' : '')}`)
  }
  return parts.join('\n\n')
}
