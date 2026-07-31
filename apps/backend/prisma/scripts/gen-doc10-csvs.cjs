const fs = require('fs')
const path = require('path')

const packageDir = path.resolve(__dirname, '../data/packages/foundation-10-clause-gerund-infinitive')
const markdown = fs.readFileSync(path.join(packageDir, '学习包的功能介绍.md'), 'utf8')
const lines = markdown.split(/\r?\n/)

const sceneTitles = [
  '基础⑩·表达想法',
  '基础⑩·描述人物事物',
  '基础⑩·意图与目的',
  '基础⑩·喜好与活动',
  '基础⑩·综合运用',
]

const topicDefinitions = [
  ['I think (that)...', 'that 宾语从句（肯定）'],
  ["I know / I'm sure", '确定表达 + that 从句'],
  ["I don't think...", '否定转移'],
  ['He said (that)...', '转述从句'],
  ['wh- 宾语从句', 'what/where/when/why 从句'],
  ['that 定语从句（物）', 'the book that I read'],
  ['who 定语从句（人）', 'the person who called'],
  ['where/when/why 定语从句', 'the place where we met'],
  ['偏好描述（定从+最高级）', 'the book that I like most'],
  ['综合定语从句', 'There are many things that...'],
  ['want/hope/would like to', '意愿不定式'],
  ['decide/promise/agree to', '决定承诺不定式'],
  ['to 不定式表目的', 'I came to study / in order to'],
  ['It is + adj + to 不定式主语', "It's important to practice"],
  ['have something to 不定式定语', 'I have something to tell you'],
  ['enjoy/like/love + 动名词', 'I enjoy reading'],
  ['start/finish/keep + 动名词', 'I started learning'],
  ['be good at / interested in + 动名词', "I'm good at remembering"],
  ['动名词作主语', 'Swimming is fun'],
  ['Thank you for / Sorry for + 动名词', 'Thank you for helping'],
  ['从句 + 不定式混合', "I think it's important to..."],
  ['定语从句 + 不定式混合', 'The best thing that you can do is to...'],
  ['动名词 vs 不定式对比', 'stop smoking vs stop to smoke'],
  ['复杂观点表达', 'What I like most about...is...'],
  ['长篇叙事综合', 'I decided to...because I think...'],
]

const topicScene = new Map(
  topicDefinitions.map(([title], index) => [title, sceneTitles[Math.floor(index / 5)]]),
)

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeCsv(fileName, headers, rows) {
  const content = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n')
  fs.writeFileSync(path.join(packageDir, fileName), `${content}\n`, 'utf8')
  console.log(`${fileName}: ${rows.length} rows`)
}

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function stripMarkdown(value) {
  return value.replace(/\*\*/g, '').replace(/`/g, '').trim()
}

function section(startHeading, endHeading) {
  const start = lines.findIndex((line) => line === startHeading)
  const end = lines.findIndex((line, index) => index > start && line === endHeading)
  if (start < 0 || end < 0) throw new Error(`Section not found: ${startHeading}`)
  return lines.slice(start + 1, end)
}

const scenes = [
  ['表达想法', '学习that宾语从句、否定转移、转述和wh-宾语从句。'],
  ['描述人物事物', '学习that/who/where/when/why定语从句。'],
  ['意图与目的', '学习意愿、决定、目的、评价和定语用法的不定式。'],
  ['喜好与活动', '学习动名词作宾语、介词宾语和主语。'],
  ['综合运用', '综合使用从句、不定式和动名词完成观点与叙事表达。'],
].map(([name, description], index) => ({
  category_name: '基础入门',
  title: sceneTitles[index],
  location: '零基础课堂',
  required_output_level: 'L2',
  required_user_level: '1',
  description,
  package_type: 'foundation',
}))

const topics = topicDefinitions.map(([title, grammar], index) => ({
  scene_title: sceneTitles[Math.floor(index / 5)],
  title,
  prompt_en: `Practice ${grammar} in a short spoken response.`,
  prompt_zh: `练习使用${grammar}完成简短口语表达。`,
  duration_sec: index >= 20 ? '40' : '35',
  difficulty: 'L2',
  description: `掌握${title}的核心用法。`,
  knowledge_points: grammar,
  teaching_markdown: `## ${title}\n\n核心语法：${grammar}`,
  ink_script_key: '',
}))

function chunkTopic(label, text, lessonNumber) {
  if (lessonNumber <= 2) {
    if (/I don't think/.test(text)) return "I don't think..."
    if (/don't know (what|where|when|why|how)|wonder (what|where|when|why|how)/i.test(text)) return 'wh- 宾语从句'
    if (/said|told me|heard/.test(text) || /转述/.test(label)) return 'He said (that)...'
    if (/I know|I'm sure|I'm sorry/.test(text) || /我知道/.test(label)) return "I know / I'm sure"
    return 'I think (that)...'
  }
  if (lessonNumber <= 4) {
    if (/描述人/.test(label) || /\bwho\b/.test(text)) return 'who 定语从句（人）'
    if (/地点|原因/.test(label) || /\bwhere\b|\bwhy\b/.test(text)) return 'where/when/why 定语从句'
    if (/偏好/.test(label)) return '偏好描述（定从+最高级）'
    if (/综合/.test(label)) return '综合定语从句'
    return 'that 定语从句（物）'
  }
  if (lessonNumber <= 6) {
    if (/想要|希望/.test(label)) return 'want/hope/would like to'
    if (/决定|承诺|忘记|记住/.test(label)) return 'decide/promise/agree to'
    if (/目的/.test(label)) return 'to 不定式表目的'
    if (/评价/.test(label)) return 'It is + adj + to 不定式主语'
    return 'have something to 不定式定语'
  }
  if (lessonNumber <= 8) {
    if (/喜欢|不喜欢/.test(label)) return 'enjoy/like/love + 动名词'
    if (/开始|结束|继续/.test(label)) return 'start/finish/keep + 动名词'
    if (/擅长/.test(label)) return 'be good at / interested in + 动名词'
    if (/感谢|道歉/.test(label)) return 'Thank you for / Sorry for + 动名词'
    return '动名词作主语'
  }
  if (/从句\+(不定式|动名词)/.test(label)) return '从句 + 不定式混合'
  if (/定语从句\+不定式/.test(label) || /推荐理由/.test(label)) return '定语从句 + 不定式混合'
  if (/复杂观点/.test(label)) return '复杂观点表达'
  return '长篇叙事综合'
}

const chunkLines = section('## 句块参考（按场景分类）', '## 句型模板（供 sentence_patterns.csv 使用）')
const chunks = []
const episodeChunks = []
let lessonNumber = 0
for (const line of chunkLines) {
  const lessonMatch = line.match(/^#### 第 (\d+) 课：/)
  if (lessonMatch) {
    lessonNumber = Number(lessonMatch[1])
    continue
  }
  if (!line.startsWith('|')) continue
  const row = cells(line)
  if (row.length !== 4 || row[0] === '主题' || /^:?-+/.test(row[0])) continue
  const label = stripMarkdown(row[0])
  const text = stripMarkdown(row[1])
  const topicTitle = chunkTopic(label, text, lessonNumber)
  const sceneTitle = sceneTitles[Math.ceil(lessonNumber / 2) - 1]
  chunks.push({
    scene_title: sceneTitle,
    topic_title: topicTitle,
    category: label,
    text,
    meaning: stripMarkdown(row[2]),
    difficulty: 'L2',
    description: '',
    examples_json: '',
  })
  const chapterId = `ch_clause_${String(Math.ceil(lessonNumber / 2)).padStart(2, '0')}`
  const episodeOrder = String(((lessonNumber - 1) % 2) + 1)
  episodeChunks.push({
    episode_chapter: chapterId,
    episode_order: episodeOrder,
    chunk_text_match: text,
    sort_order: String(episodeChunks.filter((item) =>
      item.episode_chapter === chapterId && item.episode_order === episodeOrder).length),
  })
}

const chunkMeaningByExample = new Map(chunks.map((chunk) => [chunk.text, chunk.meaning]))
const patternLines = section('## 句型模板（供 sentence_patterns.csv 使用）', '## 核心词汇（逐话题分配，严格零跨包重叠）')
const patterns = []
let patternSceneIndex = 0
function patternTopic(pattern, example, sceneIndex) {
  if (sceneIndex === 0) {
    if (/I don't know/.test(pattern)) return 'wh- 宾语从句'
    if (/He said|She told me|I heard/.test(pattern)) return 'He said (that)...'
    if (/I don't think|not sure/.test(pattern)) return "I don't think..."
    if (/I know|I'm sure|I'm sorry/.test(pattern)) return "I know / I'm sure"
    return 'I think (that)...'
  }
  if (sceneIndex === 1) {
    if (/There are many/.test(pattern)) return '综合定语从句'
    if (/where|reason why/.test(pattern)) return 'where/when/why 定语从句'
    if (/\bwho\b/.test(pattern)) return 'who 定语从句（人）'
    return 'that 定语从句（物）'
  }
  if (sceneIndex === 2) {
    if (/want to|hope to|would like to/.test(pattern)) return 'want/hope/would like to'
    if (/decided to|promised to|forget to/.test(pattern)) return 'decide/promise/agree to'
    if (/目的/.test(pattern)) return 'to 不定式表目的'
    if (/It's \+ 形容词/.test(pattern)) return 'It is + adj + to 不定式主语'
    return 'have something to 不定式定语'
  }
  if (/Thank you for|sorry for/.test(pattern)) return 'Thank you for / Sorry for + 动名词'
  if (/be good at|be interested in|be tired of/.test(pattern)) return 'be good at / interested in + 动名词'
  if (/started\/finished|keep \+/.test(pattern)) return 'start/finish/keep + 动名词'
  if (/动名词 \+ be/.test(pattern)) return '动名词作主语'
  return 'enjoy/like/love + 动名词'
}
for (const line of patternLines) {
  const markerIndex = ['🅰️', '🅱️', '🅲', '🅳'].findIndex((marker) => line.includes(marker))
  if (markerIndex >= 0) patternSceneIndex = markerIndex
  if (!line.startsWith('|')) continue
  const row = cells(line)
  if (row.length !== 3 || row[0] === '句型模板' || /^:?-+/.test(row[0])) continue
  const pattern = stripMarkdown(row[0])
  const example = stripMarkdown(row[1])
  const topicTitle = patternTopic(pattern, example, patternSceneIndex)
  patterns.push({
    scene_title: sceneTitles[patternSceneIndex],
    topic_title: topicTitle,
    pattern,
    meaning: stripMarkdown(row[2]),
    slots: '',
    example,
    difficulty: 'L2',
    sort_order: String(patterns.filter((item) => item.scene_title === sceneTitles[patternSceneIndex]).length),
  })
}

const meaningLabels = new Map(topicDefinitions.map(([title, grammar]) => [title, grammar]))
const prefixMeanings = {
  'I think (that)': '我认为……',
  'I believe (that)': '我相信……',
  'I feel (that)': '我觉得……',
  'I suppose (that)': '我想；我认为……',
  'I guess (that)': '我猜……',
  'I imagine (that)': '我想象；我认为……',
  'I know (that)': '我知道……',
  "I'm sure (that)": '我确定……',
  "I'm certain (that)": '我确信……',
  "I'm positive (that)": '我肯定……',
  "I'm confident (that)": '我有信心……',
  'I realize (that)': '我意识到……',
  'I notice (that)': '我注意到……',
  "I don't think (that)": '我认为……不……',
  "I don't believe (that)": '我不相信……',
  "I'm not sure (that)": '我不确定……',
  "I'm not certain (that)": '我不确信……',
  'I doubt (that)': '我怀疑……',
  'I wonder if': '我想知道是否……',
  'He said (that)': '他说……',
  'She told me (that)': '她告诉我……',
  'I heard (that)': '我听说……',
  'They explained (that)': '他们解释说……',
  'She mentioned (that)': '她提到……',
  'He admitted (that)': '他承认……',
  'They reported (that)': '他们报告说……',
  "I don't know what": '我不知道什么……',
  "I don't know where": '我不知道哪里……',
  "I don't know when": '我不知道何时……',
  "I don't know why": '我不知道为什么……',
  "I don't know how": '我不知道如何……',
  'Can you tell me where': '你能告诉我哪里……吗',
  'I wonder why': '我想知道为什么……',
  'I understand how': '我明白如何……',
}

function vocabularyMeaning(word, topicTitle) {
  if (prefixMeanings[word]) return prefixMeanings[word]
  return `${meaningLabels.get(topicTitle)}核心结构`
}

const vocabularyLines = section('## 核心词汇（逐话题分配，严格零跨包重叠）', '## 附：宾语从句速查卡')
const vocabulary = []
let vocabularyTopicIndex = -1
for (const line of vocabularyLines) {
  const topicMatch = line.match(/^#### Topic (\d+) · /)
  if (topicMatch) {
    vocabularyTopicIndex = Number(topicMatch[1]) - 1
    continue
  }
  if (!line.startsWith('| 核心 |')) continue
  const row = cells(line)
  const boldMatch = row[1].match(/\*\*(.+)\*\*/)
  if (!boldMatch) continue
  const words = boldMatch[1].split(/,\s+/)
  const topicTitle = topicDefinitions[vocabularyTopicIndex][0]
  words.forEach((word, sortOrder) => vocabulary.push({
    scene_title: topicScene.get(topicTitle),
    topic_title: topicTitle,
    word,
    meaning: vocabularyMeaning(word, topicTitle),
    part_of_speech: 'phrase',
    phonetic_us: '',
    phonetic_uk: '',
    difficulty: 'L2',
    description: '',
    examples_json: '',
    sort_order: String(sortOrder),
  }))
}

const chapterRows = [
  ['ch_clause_01', '表达想法', ['我认为/我知道', '转述与不确定']],
  ['ch_clause_02', '描述事物', ['描述物品与人', '地点与偏好']],
  ['ch_clause_03', '意图与目的', ['想要/决定/承诺', '目的与评价']],
  ['ch_clause_04', '喜好与活动', ['喜欢/开始/擅长', '感谢与对比']],
  ['ch_clause_05', '综合运用', ['混合叙事表达', '观点与推荐']],
]
const episodes = chapterRows.flatMap(([chapterId, chapterTitle, episodeTitles], chapterIndex) =>
  episodeTitles.map((title, episodeIndex) => {
    const count = episodeChunks.filter((item) =>
      item.episode_chapter === chapterId && item.episode_order === String(episodeIndex + 1)).length
    return {
      chapter_id: chapterId,
      chapter_title: chapterTitle,
      episode_order: String(episodeIndex + 1),
      title,
      scene_title: sceneTitles[chapterIndex],
      required_output_level: 'L2',
      required_user_level: '1',
      vocab_required_count: '2',
      vocab_total_count: '4',
      chunk_required_count: String(Math.min(3, count)),
      chunk_total_count: String(count),
      objectives_json: '',
      pass_objective_count: '1',
      pass_chunk_count: String(Math.min(3, count)),
      pass_min_dialogues: '2',
      npc_name: 'Tutor',
      npc_role: '英语导师',
      is_preview: chapterIndex === 0 && episodeIndex === 0 ? 'true' : 'false',
      ink_script_key: '',
      rewards_json: '',
    }
  }),
)

writeCsv('scenes.csv',
  ['category_name', 'title', 'location', 'required_output_level', 'required_user_level', 'description', 'package_type'],
  scenes)
writeCsv('training_topics.csv',
  ['scene_title', 'title', 'prompt_en', 'prompt_zh', 'duration_sec', 'difficulty', 'description', 'knowledge_points', 'teaching_markdown', 'ink_script_key'],
  topics)
writeCsv('scene_vocabulary.csv',
  ['scene_title', 'topic_title', 'word', 'meaning', 'part_of_speech', 'phonetic_us', 'phonetic_uk', 'difficulty', 'description', 'examples_json', 'sort_order'],
  vocabulary)
writeCsv('chunks.csv',
  ['scene_title', 'topic_title', 'category', 'text', 'meaning', 'difficulty', 'description', 'examples_json'],
  chunks)
writeCsv('sentence_patterns.csv',
  ['scene_title', 'topic_title', 'pattern', 'meaning', 'slots', 'example', 'difficulty', 'sort_order'],
  patterns)
writeCsv('script_episodes.csv',
  ['chapter_id', 'chapter_title', 'episode_order', 'title', 'scene_title', 'required_output_level', 'required_user_level', 'vocab_required_count', 'vocab_total_count', 'chunk_required_count', 'chunk_total_count', 'objectives_json', 'pass_objective_count', 'pass_chunk_count', 'pass_min_dialogues', 'npc_name', 'npc_role', 'is_preview', 'ink_script_key', 'rewards_json'],
  episodes)
writeCsv('episode_chunks.csv',
  ['episode_chapter', 'episode_order', 'chunk_text_match', 'sort_order'],
  episodeChunks)

// The prose summary says 300 vocabulary items, 66 chunks, and 55 patterns.
// The authoritative Markdown tables explicitly contain 159, 63, and 37.
const expected = { scenes: 5, topics: 25, vocabulary: 159, chunks: 63, patterns: 37, episodes: 10 }
for (const [name, count] of Object.entries(expected)) {
  const actual = ({ scenes, topics, vocabulary, chunks, patterns, episodes })[name].length
  if (actual !== count) throw new Error(`${name}: expected ${count}, got ${actual}`)
}
