#!/usr/bin/env node
/**
 * 校验 .learning.md 的结构完整性与练习覆盖度。
 *
 *   node scripts/validate-learning-docs.cjs [文件或目录...] [选项]
 *
 * 选项:
 *   --min-items <n>   每个题组至少多少题，默认 3
 *   --json <path>     额外写出完整 JSON 报告
 *   --strict          把警告也当作失败
 *   --quiet           只输出汇总与问题
 *
 * 退出码:
 *   0  没有 error（加 --strict 时没有 error 且没有 warning）
 *   1  存在结构错误，或 --strict 下存在警告
 *
 * 校验内容:
 *   - frontmatter 能否解析、exercises 结构是否合法
 *   - 题组 key 是否唯一、题型是否受支持
 *   - 各题型必需字段、方向与题目语言是否匹配
 *   - 每组题目数量（默认 >= 3）、拆句层级是否 >= 3
 *   - 重复题干/重复答案
 *   - chunks / chunk_models / vocabulary 的练习覆盖率与逐动词完成率
 */
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

const DEFAULT_ROOT = path.resolve(__dirname, '../../docs-md')
const SUPPORTED_TYPES = new Set([
  'chunk_substitution',
  'vocab_drill',
  'vn_dialogue',
  'vocab_sentence_building',
  'sentence_decomposition',
  'pattern_drill',
])

const IRREGULAR = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  become: ['became'],
  begin: ['began', 'begun'],
  break: ['broke', 'broken'],
  bring: ['brought'],
  build: ['built'],
  buy: ['bought'],
  catch: ['caught'],
  choose: ['chose', 'chosen'],
  come: ['came'],
  cost: ['cost'],
  cut: ['cut'],
  do: ['did', 'done'],
  draw: ['drew', 'drawn'],
  drink: ['drank', 'drunk'],
  drive: ['drove', 'driven'],
  eat: ['ate', 'eaten'],
  fall: ['fell', 'fallen'],
  feed: ['fed'],
  feel: ['felt'],
  fight: ['fought'],
  find: ['found'],
  fly: ['flew', 'flown'],
  forget: ['forgot', 'forgotten'],
  get: ['got', 'gotten'],
  give: ['gave', 'given'],
  go: ['went', 'gone'],
  grow: ['grew', 'grown'],
  have: ['has', 'had'],
  hear: ['heard'],
  hide: ['hid', 'hidden'],
  hit: ['hit'],
  hold: ['held'],
  hurt: ['hurt'],
  keep: ['kept'],
  know: ['knew', 'known'],
  lead: ['led'],
  leave: ['left'],
  lend: ['lent'],
  let: ['let'],
  lose: ['lost'],
  make: ['made'],
  mean: ['meant'],
  meet: ['met'],
  pay: ['paid'],
  put: ['put'],
  read: ['read'],
  ride: ['rode', 'ridden'],
  run: ['ran'],
  say: ['said'],
  see: ['saw', 'seen'],
  sell: ['sold'],
  send: ['sent'],
  set: ['set'],
  shake: ['shook', 'shaken'],
  show: ['showed', 'shown'],
  sing: ['sang', 'sung'],
  sit: ['sat'],
  sleep: ['slept'],
  speak: ['spoke', 'spoken'],
  spend: ['spent'],
  stand: ['stood'],
  take: ['took', 'taken'],
  teach: ['taught'],
  tell: ['told'],
  think: ['thought'],
  throw: ['threw', 'thrown'],
  understand: ['understood'],
  wake: ['woke', 'woken'],
  wear: ['wore', 'worn'],
  win: ['won'],
  write: ['wrote', 'written'],
}

function parseArgs(argv) {
  const options = { paths: [], minItems: 3, json: null, strict: false, quiet: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--min-items') {
      options.minItems = Number(argv[(i += 1)])
      if (!Number.isFinite(options.minItems) || options.minItems < 1) {
        throw new Error('--min-items 需要一个 >= 1 的数字')
      }
    } else if (arg === '--json') {
      options.json = argv[(i += 1)]
    } else if (arg === '--strict') {
      options.strict = true
    } else if (arg === '--quiet') {
      options.quiet = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg.startsWith('--')) {
      throw new Error(`未知选项: ${arg}`)
    } else {
      options.paths.push(arg)
    }
  }
  return options
}

function walk(target) {
  const stat = fs.statSync(target)
  if (stat.isFile()) return /\.learning\.md$/i.test(target) ? [target] : []
  return fs
    .readdirSync(target, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const child = path.join(target, entry.name)
      return entry.isDirectory() ? walk(child) : /\.learning\.md$/i.test(child) ? [child] : []
    })
}

function splitFrontmatter(raw) {
  const lines = raw.split(/\r?\n/)
  if (lines[0].trim() !== '---') return null
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (end < 0) return null
  return { yaml: lines.slice(1, end).join('\n'), bodyAt: end + 1 }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function variants(word) {
  const out = new Set([word])
  const irregular = IRREGULAR[word]
  if (irregular) irregular.forEach((form) => out.add(form))
  out.add(`${word}s`)
  out.add(`${word}es`)
  out.add(`${word}ed`)
  out.add(`${word}d`)
  out.add(`${word}ing`)
  if (word.endsWith('e')) out.add(`${word.slice(0, -1)}ing`)
  if (/[^aeiou]y$/.test(word)) {
    out.add(`${word.slice(0, -1)}ies`)
    out.add(`${word.slice(0, -1)}ied`)
  }
  return [...out].sort((a, b) => b.length - a.length)
}

function phraseRegex(phrase) {
  const words = String(phrase).toLowerCase().match(/[a-z0-9]+/g) || []
  if (!words.length) return null
  const body = words.map((word) => `(?:${variants(word).map(escapeRegExp).join('|')})`)
  if (words.length === 2) {
    // 双词短语（动词 + 小品词）允许中间插入代词或名词宾语，如 held me up / bring this up
    return new RegExp(`${body[0]}(?:[^a-z0-9]+[a-z0-9']+){0,3}[^a-z0-9]+${body[1]}`)
  }
  if (words.length === 3 && ['a', 'an', 'the'].includes(words[1])) {
    // 含冠词的搭配允许插入宾语，如 give a hand / give him a hand
    return new RegExp(
      `${body[0]}(?:[^a-z0-9]+[a-z0-9']+){0,3}[^a-z0-9]+${body[1]}[^a-z0-9]+${body[2]}`,
    )
  }
  return new RegExp(body.join('[^a-z0-9]+'))
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .trim()
}

function itemCount(group) {
  if (Array.isArray(group.items)) return group.items.length
  if (Array.isArray(group.levels)) return group.levels.length
  if (Array.isArray(group.patterns)) {
    return group.patterns.reduce(
      (sum, pattern) => sum + (Array.isArray(pattern.items) ? pattern.items.length : 0),
      0,
    )
  }
  return 0
}

function allItems(group) {
  if (Array.isArray(group.items)) return group.items
  if (Array.isArray(group.patterns)) {
    return group.patterns.flatMap((pattern) => (Array.isArray(pattern.items) ? pattern.items : []))
  }
  return []
}

function createReport(file) {
  return {
    file,
    issues: [],
    metrics: {
      groups: 0,
      items: 0,
      levels: 0,
      groupsMeetingMinItems: 0,
      types: {},
      directions: {},
      chunks: { total: 0, prototype: 0, anywhere: 0 },
      models: { total: 0, drilled: 0, anywhere: 0 },
      vocabulary: { total: 0, anywhere: 0 },
      verbs: {},
      duplicates: { answers: [], prompts: [] },
    },
  }
}

function report(report, level, code, where, message) {
  report.issues.push({ level, code, where, message })
}

function verbBucket(metrics, verb) {
  if (!metrics.verbs[verb]) {
    metrics.verbs[verb] = { groups: 0, items: 0, chunks: 0, chunksCovered: 0, models: 0, modelsDrilled: 0 }
  }
  return metrics.verbs[verb]
}

function validateItems(group, items, ctx, label) {
  const { report, file } = ctx
  const where = `${file} :: ${group.key ?? '(no key)'}`
  if (!Array.isArray(items) || items.length === 0) {
    report.error(`题组没有题目${label ? `（${label}）` : ''}`, 'items-empty', where)
    return 0
  }
  for (const [index, item] of items.entries()) {
    const at = `${where} #${index + 1}`
    const prompt = item.zh ?? item.en
    if (!prompt) report.error('题目缺少 zh 或 en 题干', 'item-prompt', at)
    if (!item.answer) report.error('题目缺少 answer', 'item-answer', at)
    if (!item.hint) report.warn('题目缺少 hint', 'item-hint', at)
    if (group.direction === 'zh_to_en' && !item.zh) {
      report.error('zh_to_en 题组的题目缺少 zh', 'item-direction', at)
    }
    if (group.direction === 'en_to_zh' && !item.en) {
      report.error('en_to_zh 题组的题目缺少 en', 'item-direction', at)
    }
  }
  return items.length
}

function validateGroup(group, index, ctx) {
  const { report, file, options } = ctx
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    report.error('题组不是对象', 'group-shape', `${file} :: #${index + 1}`)
    return
  }
  const where = `${file} :: ${group.key ?? `#${index + 1}`}`
  if (typeof group.key !== 'string' || !group.key.trim()) {
    report.error('题组缺少稳定 key', 'key-missing', where)
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.key)) {
    report.warn(`key 建议使用小写短横线：${group.key}`, 'key-format', where)
  }
  if (!SUPPORTED_TYPES.has(group.type)) {
    report.error(`不支持的题型：${group.type}`, 'type-unknown', where)
  }
  if (!group.title) report.warn('题组缺少 title', 'title-missing', where)
  if (group.direction && !['zh_to_en', 'en_to_zh'].includes(group.direction)) {
    report.warn(`未知 direction：${group.direction}`, 'direction-unknown', where)
  }

  let items = 0
  if (group.type === 'chunk_substitution') {
    if (!group.chunk) report.error('chunk_substitution 缺少 chunk', 'chunk-missing', where)
    if (!group.chunkMeaning) report.error('chunk_substitution 缺少 chunkMeaning', 'chunk-meaning', where)
    items = validateItems(group, group.items, ctx)
  } else if (group.type === 'pattern_drill') {
    if (!group.pattern) report.error('pattern_drill 缺少 pattern', 'pattern-missing', where)
    if (!group.patternMeaning) report.error('pattern_drill 缺少 patternMeaning', 'pattern-meaning', where)
    items = validateItems(group, group.items, ctx)
  } else if (group.type === 'vocab_sentence_building') {
    if (!group.vocabWord) report.error('vocab_sentence_building 缺少 vocabWord', 'vocab-missing', where)
    if (!group.vocabMeaning) report.error('vocab_sentence_building 缺少 vocabMeaning', 'vocab-meaning', where)
    if (!Array.isArray(group.patterns) || group.patterns.length === 0) {
      report.error('vocab_sentence_building 缺少 patterns', 'patterns-missing', where)
    } else {
      for (const [patternIndex, pattern] of group.patterns.entries()) {
        if (!pattern.chunk) report.error('patterns 项缺少 chunk', 'pattern-chunk', `${where} patterns[${patternIndex}]`)
        items += validateItems(group, pattern.items, ctx, `patterns[${patternIndex}]`)
      }
    }
  } else if (group.type === 'sentence_decomposition') {
    for (const field of ['sourceKind', 'sourceText', 'fullSentence', 'fullSentenceZh']) {
      if (!group[field]) report.error(`sentence_decomposition 缺少 ${field}`, 'decomposition-field', where)
    }
    if (!Array.isArray(group.levels) || group.levels.length < 3) {
      report.error('sentence_decomposition 至少需要 3 个 levels', 'levels-thin', where)
    } else {
      for (const [levelIndex, level] of group.levels.entries()) {
        const at = `${where} levels[${levelIndex}]`
        if (!level.label) report.warn('level 缺少 label', 'level-label', at)
        if (!level.en) report.error('level 缺少 en', 'level-en', at)
        if (!level.zh) report.error('level 缺少 zh', 'level-zh', at)
      }
      const last = group.levels[group.levels.length - 1]
      if (group.fullSentence && last.en !== group.fullSentence) {
        report.warn('最后一层 en 与 fullSentence 不一致', 'decomposition-drift', where)
      }
    }
    items = Array.isArray(group.levels) ? group.levels.length : 0
  } else {
    items = validateItems(group, group.items, ctx)
  }

  if (items < options.minItems) {
    report.warn(`题目数量 ${items} 少于 ${options.minItems}`, 'items-thin', where)
  } else {
    report.metrics.groupsMeetingMinItems += 1
  }
}

function collectText(group) {
  const parts = []
  const push = (value) => {
    if (typeof value === 'string') parts.push(value)
  }
  for (const item of allItems(group)) {
    push(item.zh)
    push(item.en)
    push(item.answer)
  }
  if (Array.isArray(group.levels)) {
    for (const level of group.levels) {
      push(level.en)
      push(level.zh)
    }
  }
  push(group.fullSentence)
  push(group.fullSentenceZh)
  return parts.join('\n').toLowerCase()
}

function analyzeFile(file, options) {
  const ctx = { report: createReport(file), file, options }
  const { report: r } = ctx
  const raw = fs.readFileSync(file, 'utf8')
  const frontmatter = splitFrontmatter(raw)
  if (!frontmatter) {
    report(r, 'error', 'frontmatter-missing', file, '文件缺少 --- 包裹的 frontmatter')
    return r
  }
  let doc
  try {
    doc = yaml.load(frontmatter.yaml)
  } catch (error) {
    report(r, 'error', 'yaml-invalid', file, `YAML 解析失败：${error.message}`)
    return r
  }
  const learning = doc && typeof doc === 'object' ? doc.learning : null
  if (!learning || typeof learning !== 'object') {
    report(r, 'error', 'learning-missing', file, 'frontmatter 缺少 learning 节点')
    return r
  }

  const vocabulary = Array.isArray(learning.vocabulary) ? learning.vocabulary : []
  const chunks = Array.isArray(learning.chunks) ? learning.chunks : []
  const patterns = Array.isArray(learning.patterns) ? learning.patterns : []
  const models = Array.isArray(learning.chunk_models) ? learning.chunk_models : []
  const exercises = learning.exercises && typeof learning.exercises === 'object' ? learning.exercises : null

  r.metrics.vocabulary.total = vocabulary.length
  r.metrics.chunks.total = chunks.length
  r.metrics.models.total = models.length

  if (!exercises) {
    report(r, 'warn', 'exercises-missing', file, '没有 exercises 节点，只校验材料')
    return r
  }
  if (typeof exercises.enabled !== 'boolean') {
    report(r, 'warn', 'enabled-missing', file, 'exercises.enabled 不是布尔值')
  }
  const pipeline = Array.isArray(exercises.pipeline) ? exercises.pipeline : null
  if (!pipeline) {
    report(r, 'error', 'pipeline-missing', file, 'exercises.pipeline 不是数组')
    return r
  }

  const keyCounts = new Map()
  const answerCounts = new Map()
  const promptCounts = new Map()
  const chunkLabels = []
  const patternLabels = []
  const texts = []
  const verbUniverse = new Set()
  const VERB_ALIASES = {
    used: 'use',
    using: 'use',
    "can't": 'help',
    made: 'make',
    took: 'take',
    got: 'get',
    gave: 'give',
    held: 'hold',
    left: 'leave',
    brought: 'bring',
    kept: 'keep',
    meant: 'mean',
    spent: 'spend',
    paid: 'pay',
  }
  const verbOf = (text) => {
    const words = String(text ?? '').toLowerCase().match(/[a-z']+/g) || []
    for (const word of words) {
      const forms = [word]
      for (const suffix of ['s', 'es', 'ed', 'd', 'ing']) {
        if (word.endsWith(suffix) && word.length > suffix.length + 2) {
          forms.push(word.slice(0, -suffix.length))
        }
      }
      for (const form of forms) {
        const candidate = VERB_ALIASES[form] ?? form
        if (verbUniverse.has(candidate)) return candidate
      }
    }
    return 'phrase'
  }

  for (const model of models) {
    const first = String((model && model.structure) || '').toLowerCase().match(/[a-z']+/)
    if (!first) continue
    // 只有句型首词才可以映射；避免短语里的 to be 被当成 use
    verbUniverse.add(first[0] === 'be' ? 'use' : VERB_ALIASES[first[0]] ?? first[0])
  }
  for (const verb of verbUniverse) verbBucket(r.metrics, verb)

  for (const [index, group] of pipeline.entries()) {
    validateGroup(group, index, ctx)
    if (!group || typeof group !== 'object') continue
    r.metrics.groups += 1
    r.metrics.items += itemCount(group)
    if (Array.isArray(group.levels)) r.metrics.levels += group.levels.length
    if (group.type) r.metrics.types[group.type] = (r.metrics.types[group.type] ?? 0) + 1
    if (group.direction) {
      r.metrics.directions[group.direction] = (r.metrics.directions[group.direction] ?? 0) + 1
    }
    if (typeof group.key === 'string') keyCounts.set(group.key, (keyCounts.get(group.key) ?? 0) + 1)
    if (group.chunk) chunkLabels.push(String(group.chunk))
    if (group.pattern) patternLabels.push(String(group.pattern))
    if (Array.isArray(group.patterns)) {
      for (const pattern of group.patterns) {
        if (pattern && pattern.chunk) chunkLabels.push(String(pattern.chunk))
      }
    }
    texts.push(collectText(group))

    const keyPrefix = String(group.key ?? '').split('-')[0]
    const anchorText =
      group.chunk ??
      group.pattern ??
      (group.patterns && group.patterns[0] && group.patterns[0].chunk) ??
      group.sourceText ??
      ''
    const verb = verbUniverse.has(keyPrefix) ? keyPrefix : verbOf(anchorText)
    const bucket = verbBucket(r.metrics, verb)
    bucket.groups += 1
    bucket.items += itemCount(group)

    const dupeKey = (text) => `${group.direction ?? 'na'}|${normalizeText(text)}`
    for (const item of allItems(group)) {
      if (item.answer) {
        const key = dupeKey(item.answer)
        const entry = answerCounts.get(key) ?? { text: normalizeText(item.answer), count: 0 }
        entry.count += 1
        answerCounts.set(key, entry)
      }
      const prompt = item.zh ?? item.en
      if (prompt) {
        const key = dupeKey(prompt)
        const entry = promptCounts.get(key) ?? { text: normalizeText(prompt), count: 0 }
        entry.count += 1
        promptCounts.set(key, entry)
      }
    }
    if (Array.isArray(group.levels)) {
      for (const level of group.levels) {
        if (level.en) {
          const key = dupeKey(level.en)
          const entry = answerCounts.get(key) ?? { text: normalizeText(level.en), count: 0 }
          entry.count += 1
          answerCounts.set(key, entry)
        }
        if (level.zh) {
          const key = dupeKey(level.zh)
          const entry = promptCounts.get(key) ?? { text: normalizeText(level.zh), count: 0 }
          entry.count += 1
          promptCounts.set(key, entry)
        }
      }
    }
  }

  for (const [key, count] of keyCounts) {
    if (count > 1) report(r, 'error', 'key-duplicate', `${file} :: ${key}`, `key 重复 ${count} 次`)
  }

  const textBlob = texts.join('\n').toLowerCase()
  const nestedBlob = `${textBlob}\n${chunkLabels.join('\n').toLowerCase()}\n${patternLabels.join('\n').toLowerCase()}`
  const pending = new Map()
  const pendingOf = (verb) => {
    if (!pending.has(verb)) pending.set(verb, { chunks: 0, models: 0, vocabulary: 0 })
    return pending.get(verb)
  }

  const normalizedLabels = new Set([...chunkLabels, ...patternLabels].map(normalizeText))

  for (const chunk of chunks) {
    const chunkText = String(chunk)
    const verb = verbOf(chunkText)
    const bucket = verbBucket(r.metrics, verb)
    bucket.chunks += 1
    const normalized = normalizeText(chunkText)
    const prototype = chunkLabels.some((label) => normalizeText(label) === normalized)
    const regex = phraseRegex(chunkText)
    const anywhere = Boolean(regex && regex.test(nestedBlob))
    // 完整交际句（以句号结尾）只要求出现在例句中，不要求作为 chunk 标签
    const sentenceLike = /[.!?]\s*$/.test(chunkText)
    const prototypeOk = prototype || (sentenceLike && anywhere)
    if (prototypeOk) bucket.chunksCovered += 1
    r.metrics.chunks.prototype += prototypeOk ? 1 : 0
    r.metrics.chunks.anywhere += anywhere ? 1 : 0
    if (!prototypeOk) {
      if (bucket.groups === 0) {
        pendingOf(verb).chunks += 1
      } else {
        report(
          r,
          'warn',
          'chunk-uncovered',
          `${file} :: ${chunkText}`,
          anywhere ? '句块没有作为 chunk 原型出现（仅在句子中出现）' : '句块没有出现在任何练习中',
        )
      }
    }
  }

  for (const model of models) {
    const structure = String((model && model.structure) || '')
    if (!structure) continue
    const verb = verbOf(structure)
    const bucket = verbBucket(r.metrics, verb)
    bucket.models += 1
    const normalized = normalizeText(structure)
    const drilled = patternLabels.some((label) => normalizeText(label) === normalized)
    const regex = phraseRegex(structure.replace(/\[[^\]]*\]/g, ' '))
    const anywhere = Boolean(regex && regex.test(nestedBlob))
    if (drilled) bucket.modelsDrilled += 1
    r.metrics.models.drilled += drilled ? 1 : 0
    r.metrics.models.anywhere += anywhere ? 1 : 0
    if (!drilled) {
      if (bucket.groups === 0) {
        pendingOf(verb).models += 1
      } else {
        report(
          r,
          'warn',
          'model-undrilled',
          `${file} :: ${structure}`,
          anywhere ? '句型没有独立 pattern_drill（已在句子中体现）' : '句型没有对应练习',
        )
      }
    }
  }

  for (const word of vocabulary) {
    const text = String(word)
    if (!text) continue
    const regex = phraseRegex(text)
    const anywhere = Boolean(regex && regex.test(nestedBlob)) || normalizedLabels.has(normalizeText(text))
    r.metrics.vocabulary.anywhere += anywhere ? 1 : 0
    if (!anywhere) {
      const verb = verbOf(text)
      if (pending.has(verb)) pendingOf(verb).vocabulary += 1
      else report(r, 'warn', 'vocabulary-uncovered', `${file} :: ${text}`, '词汇/搭配没有出现在任何练习中')
    }
  }

  for (const [verb, counts] of pending) {
    report(
      r,
      'warn',
      'verb-not-started',
      `${file} :: ${verb}`,
      `动词还没有练习（待覆盖句块 ${counts.chunks}、句型 ${counts.models}、词汇 ${counts.vocabulary}）`,
    )
  }

  for (const [, entry] of answerCounts) {
    if (entry.count > 1) r.metrics.duplicates.answers.push(entry)
  }
  for (const [, entry] of promptCounts) {
    if (entry.count > 1) r.metrics.duplicates.prompts.push(entry)
  }
  if (r.metrics.duplicates.answers.length) {
    report(
      r,
      'warn',
      'answer-duplicate',
      file,
      `${r.metrics.duplicates.answers.length} 条答案在文件内重复`,
    )
  }
  if (r.metrics.duplicates.prompts.length) {
    report(
      r,
      'warn',
      'prompt-duplicate',
      file,
      `${r.metrics.duplicates.prompts.length} 条题干在文件内重复`,
    )
  }

  const active = { chunks: 0, chunksCovered: 0, models: 0, modelsDrilled: 0 }
  for (const [verb, bucket] of Object.entries(r.metrics.verbs)) {
    if (!bucket.groups || verb === 'phrase') continue
    active.chunks += bucket.chunks
    active.chunksCovered += bucket.chunksCovered
    active.models += bucket.models
    active.modelsDrilled += bucket.modelsDrilled
  }
  r.metrics.active = active

  r.metrics.patterns = patterns.length
  return r
}

function percent(part, total) {
  if (!total) return total === 0 ? 'n/a' : '0%'
  return `${((part / total) * 100).toFixed(0)}%`
}

function render(report, options) {
  const { metrics: m } = report
  const rel = path.relative(process.cwd(), report.file) || report.file
  const lines = []
  if (!options.quiet) lines.push('')
  lines.push(rel)
  lines.push(
    `  题组 ${m.groups} | 题目 ${m.items} | 拆句层级 ${m.levels} | 每组 >= ${options.minItems} 题 ${m.groupsMeetingMinItems}/${m.groups} (${percent(
      m.groupsMeetingMinItems,
      m.groups,
    )})`,
  )
  lines.push(
    `  句块原型 ${m.chunks.prototype}/${m.chunks.total} (${percent(m.chunks.prototype, m.chunks.total)}) | 句块出现 ${m.chunks.anywhere}/${m.chunks.total} (${percent(
      m.chunks.anywhere,
      m.chunks.total,
    )})`,
  )
  lines.push(
    `  句型 drill ${m.models.drilled}/${m.models.total} (${percent(m.models.drilled, m.models.total)}) | 句型出现 ${m.models.anywhere}/${m.models.total} (${percent(
      m.models.anywhere,
      m.models.total,
    )})`,
  )
  lines.push(
    `  词汇命中 ${m.vocabulary.anywhere}/${m.vocabulary.total} (${percent(m.vocabulary.anywhere, m.vocabulary.total)})`,
  )
  if (m.active) {
    lines.push(
      `  已完成动词 句块 ${m.active.chunksCovered}/${m.active.chunks} (${percent(m.active.chunksCovered, m.active.chunks)}) | 句型 ${m.active.modelsDrilled}/${m.active.models} (${percent(
        m.active.modelsDrilled,
        m.active.models,
      )})`,
    )
  }
  const types = Object.entries(m.types)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type} ${count}`)
    .join(' | ')
  lines.push(`  题型 ${types || '(none)'}`)
  const directions = Object.entries(m.directions)
    .sort((a, b) => b[1] - a[1])
    .map(([direction, count]) => `${direction} ${count}`)
    .join(' | ')
  lines.push(`  方向 ${directions || '(none)'}`)
  lines.push(
    `  重复 答案 ${m.duplicates.answers.length} 组 | 题干 ${m.duplicates.prompts.length} 组`,
  )

  const verbRows = Object.entries(m.verbs)
    .filter(([verb, value]) => verb !== 'phrase' && (value.chunks || value.models || value.groups))
    .sort((a, b) => b[1].items - a[1].items)
  const phrase = m.verbs.phrase
  if (verbRows.length) {
    const pendingVerbs = verbRows.filter(([, v]) => v.groups === 0).map(([verb]) => verb)
    lines.push(
      `  动词覆盖 ${verbRows.length - pendingVerbs.length}/${verbRows.length}${
        pendingVerbs.length ? ` | 未开始: ${pendingVerbs.join(', ')}` : ''
      }`,
    )
  }
  if (phrase) {
    lines.push(`  完整句块（非动词）题组 ${phrase.groups} | 题目 ${phrase.items}`)
  }

  const counts = report.issues.reduce(
    (acc, issue) => {
      acc[issue.level] = (acc[issue.level] ?? 0) + 1
      return acc
    },
    { error: 0, warn: 0 },
  )
  if (report.issues.length) {
    const shown = report.issues.slice(0, options.quiet ? 20 : 200)
    for (const issue of shown) {
      lines.push(`  [${issue.level}] ${issue.code} ${issue.where} — ${issue.message}`)
    }
    if (report.issues.length > shown.length) {
      lines.push(`  ... 其余 ${report.issues.length - shown.length} 条见 --json 报告`)
    }
  }
  lines.push(`  结果 error ${counts.error} / warn ${counts.warn}`)
  return lines.join('\n')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(
      '用法: node scripts/validate-learning-docs.cjs [文件或目录...] [--min-items 3] [--json out.json] [--strict] [--quiet]',
    )
    return 0
  }
  const targets = options.paths.length ? options.paths : [DEFAULT_ROOT]
  const files = targets.flatMap((target) => {
    const absolute = path.resolve(target)
    if (!fs.existsSync(absolute)) throw new Error(`路径不存在: ${target}`)
    return walk(absolute)
  })
  if (!files.length) throw new Error('没有找到 *.learning.md 文件')

  const reports = files.map((file) => analyzeFile(file, options))
  let errors = 0
  let warnings = 0
  for (const report of reports) {
    console.log(render(report, options))
    for (const issue of report.issues) {
      if (issue.level === 'error') errors += 1
      else warnings += 1
    }
  }

  const totals = reports.reduce(
    (acc, report) => {
      const m = report.metrics
      acc.groups += m.groups
      acc.items += m.items
      acc.chunks.prototype += m.chunks.prototype
      acc.chunks.total += m.chunks.total
      acc.models.drilled += m.models.drilled
      acc.models.total += m.models.total
      acc.vocabulary.anywhere += m.vocabulary.anywhere
      acc.vocabulary.total += m.vocabulary.total
      return acc
    },
    {
      groups: 0,
      items: 0,
      chunks: { prototype: 0, total: 0 },
      models: { drilled: 0, total: 0 },
      vocabulary: { anywhere: 0, total: 0 },
    },
  )

  console.log(
    `\n汇总 ${reports.length} 个文件 | 题组 ${totals.groups} | 题目 ${totals.items} | 句块 ${percent(
      totals.chunks.prototype,
      totals.chunks.total,
    )} | 句型 ${percent(totals.models.drilled, totals.models.total)} | 词汇 ${percent(
      totals.vocabulary.anywhere,
      totals.vocabulary.total,
    )} | error ${errors} / warn ${warnings}`,
  )

  if (options.json) {
    fs.writeFileSync(
      path.resolve(options.json),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), options, totals, reports }, null, 2)}\n`,
      'utf8',
    )
  }

  if (errors > 0) return 1
  if (options.strict && warnings > 0) return 1
  return 0
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
