// 验证 irregular-verbs-mastery 包的数据一致性
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'apps', 'backend', 'prisma', 'data', 'packages', 'irregular-verbs-mastery')

function readCsv(name) {
  const raw = fs.readFileSync(path.join(DIR, name), 'utf8').trim().split('\n')
  const header = raw[0].split(',')
  return raw.slice(1).map(line => {
    const cells = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { cells.push(cur); cur = ''; continue }
      cur += ch
    }
    cells.push(cur)
    const obj = {}
    header.forEach((h, i) => { obj[h.trim()] = (cells[i] || '').trim() })
    return obj
  })
}

const scenes = readCsv('scenes.csv')
const topics = readCsv('training_topics.csv')
const vocab = readCsv('scene_vocabulary.csv')
const chunks = readCsv('chunks.csv')
const patterns = readCsv('sentence_patterns.csv')

let ok = true
const check = (cond, msg) => { if (!cond) { ok = false; console.log('  ❌ ' + msg) } }

console.log('=== 数量核对 ===')
check(scenes.length === 4, `Scenes 应为 4，实际 ${scenes.length}`)
check(topics.length === 8, `Topics 应为 8，实际 ${topics.length}`)
check(chunks.length === 64, `Chunks 应为 64，实际 ${chunks.length}`)
check(patterns.length === 32, `Patterns 应为 32，实际 ${patterns.length}`)
check(vocab.length === 167, `Vocab 应为 167，实际 ${vocab.length}`)
console.log(`  scenes=${scenes.length} topics=${topics.length} chunks=${chunks.length} patterns=${patterns.length} vocab=${vocab.length}`)

console.log('=== 每 Topic 句块/句型/词汇数量 ===')
const perTopic = {}
for (const v of vocab) {
  (perTopic[v.topic_title] = perTopic[v.topic_title] || { vocab: 0, core: 0, ext: 0, chunk: 0, pattern: 0 })
  perTopic[v.topic_title].vocab++
  v.description.startsWith('核心') ? perTopic[v.topic_title].core++ : perTopic[v.topic_title].ext++
}
for (const c of chunks) perTopic[c.topic_title].chunk++
for (const p of patterns) perTopic[p.topic_title].pattern++
for (const [t, n] of Object.entries(perTopic)) {
  check(n.chunk === 8 && n.pattern === 4, `${t}: chunk=${n.chunk} pattern=${n.pattern} core=${n.core} ext=${n.ext} vocab=${n.vocab}`)
  console.log(`  ${t}: 句块=${n.chunk} 句型=${n.pattern} 核心=${n.core} 扩展=${n.ext} 词汇=${n.vocab}`)
}

console.log('=== 127 核心动词唯一性 ===')
const coreVerbs = vocab.filter(v => v.description.startsWith('核心'))
const words = coreVerbs.map(v => v.word)
const dup = words.filter((w, i) => words.indexOf(w) !== i)
check(new Set(words).size === 127, `核心动词应 127 个唯一，实际 ${new Set(words).size}（重复: ${[...new Set(dup)].join(', ') || '无'}）`)
console.log(`  唯一核心动词数: ${new Set(words).size}`)

console.log('=== 覆盖：每个核心动词进入 ≥1 句块 + ≥1 句型 ===')
// 句块：从 description 中提取 "a→b→c" 三形式组的原形（句块文本本身是过去式输出）
const chunkCovered = new Set()
for (const c of chunks) {
  for (const grp of (c.description || '').split('/')) {
    const base = grp.trim().split('→')[0].trim()
    if (base) chunkCovered.add(base)
  }
}
// 句型：检查动词任意形式（原形/过去式/过去分词）是否出现在 pattern/slots/example 中
function verbForms(desc) {
  const forms = []
  // description 形如 "核心：wake→woke→woken（ABC）" / "核心：be→was/were→been（超特殊·ABC）"
  const m = desc.match(/：([^（]+)（/)
  if (m) {
    const triple = m[1].trim()
    for (const part of triple.split('→')) {
      for (const f of part.split('/')) if (f.trim()) forms.push(f.trim())
    }
  }
  return forms
}
const patternText = patterns.map(p => p.pattern + ' ' + p.example + ' ' + p.slots).join(' ')
const missingChunk = coreVerbs.filter(v => !chunkCovered.has(v.word)).map(v => v.word)
const missingPattern = []
for (const v of coreVerbs) {
  const forms = verbForms(v.description)
  if (!forms.some(f => patternText.includes(f))) missingPattern.push(v.word)
}
check(missingChunk.length === 0, `未进入句块的动词: ${missingChunk.join(', ')}`)
check(missingPattern.length === 0, `未进入句型的动词: ${missingPattern.join(', ')}`)
if (missingChunk.length === 0 && missingPattern.length === 0) console.log('  ✅ 127 个核心动词全部进入句块与句型')

console.log('=== Topic 标题与 scenes 场景一致性 ===')
const topicScenes = new Set(topics.map(t => t.scene_title))
const sceneTitles = new Set(scenes.map(s => s.title))
for (const s of topicScenes) check(sceneTitles.has(s), `Topic 场景 ${s} 不在 scenes.csv`)
console.log(`  Topics 覆盖场景: ${[...topicScenes].join(' / ')}`)

console.log('=== 变化家族速查核对（CSV 分类 vs 权威口径） ===')
const famCount = { AAA: 0, ABA: 0, AAB: 0, ABB: 0, ABC: 0 }
for (const v of coreVerbs) {
  const m = v.description.match(/（([^）]+)）/)
  if (m) {
    let fam = m[1].trim()
    fam = fam.replace(/^超特殊[··]?/, '').replace(/·超特殊$/, '')
    if (fam === '超特殊') fam = 'ABC' // be/do 归入 ABC 特殊组
    if (famCount[fam] !== undefined) famCount[fam]++
  }
}
const famSum = Object.values(famCount).reduce((a, b) => a + b, 0)
check(famSum === 127, `变化家族合计应为 127，实际 ${famSum}`)
check(famCount.AAA === 15 && famCount.ABA === 3 && famCount.AAB === 1 && famCount.ABB === 63 && famCount.ABC === 45,
  `家族计数不符：AAA=${famCount.AAA} ABA=${famCount.ABA} AAB=${famCount.AAB} ABB=${famCount.ABB} ABC=${famCount.ABC}`)
console.log(`  AAA=${famCount.AAA} ABA=${famCount.ABA} AAB=${famCount.AAB} ABB=${famCount.ABB} ABC=${famCount.ABC}（合计 ${famSum}）`)

console.log(ok ? '\n✅ 全部通过' : '\n❌ 存在未通过项')
process.exit(ok ? 0 : 1)
