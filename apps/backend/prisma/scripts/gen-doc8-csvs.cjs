const fs = require('fs')
const path = require('path')

const packageDir = path.resolve(__dirname, '../data/packages/foundation-8-integrated-express')
const mdPath = path.join(packageDir, '学习包的功能介绍.md')
const markdown = fs.readFileSync(mdPath, 'utf8')
const lines = markdown.split(/\r?\n/)

const sceneTitles = [
  '基础⑧·并列与转折',
  '基础⑧·因果与条件',
  '基础⑧·时间与顺序',
  '基础⑧·举例与补充',
  '基础⑧·综合叙事',
]

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeCsv(fileName, headers, rows) {
  const body = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n')
  fs.writeFileSync(path.join(packageDir, fileName), `${body}\n`, 'utf8')
  console.log(`${fileName}: ${rows.length} rows`)
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function stripMarkdown(value) {
  return value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim()
}

function section(startHeading, endHeading) {
  const start = lines.findIndex((line) => line === startHeading)
  const end = lines.findIndex((line, index) => index > start && line === endHeading)
  if (start < 0 || end < 0) throw new Error(`Section not found: ${startHeading}`)
  return lines.slice(start + 1, end)
}

const canonicalTopics = [
  ['and 并列连接', 'and / both...and / not only...but also'],
  ['or 选择连接', 'or / either...or / neither...nor'],
  ['but 转折连接', 'but / yet / nevertheless'],
  ['however 对比', 'however / in contrast / on the other hand'],
  ['递进表达', "not only...but also / what's more"],
  ['because 原因', 'because / since / as / due to'],
  ['so 结果', 'so / therefore / thus / as a result'],
  ['if 条件', 'if / provided that / in case'],
  ['unless 除非', 'unless / otherwise / or else'],
  ['as long as 只要', 'as long as / so long as / only if'],
  ['when 时间从句', 'when / whenever / as soon as'],
  ['before/after 前后', 'before / after / right after'],
  ['while 同时', 'while / meanwhile / as'],
  ['until 直到', 'until / till / not...until'],
  ['时间顺序链', 'first / then / after that / finally'],
  ['for example 举例', 'for example / for instance / such as'],
  ['also/too 补充', 'also / too / as well / either'],
  ['besides 递进', "besides / furthermore / moreover / what's more"],
  ['对话衔接词', 'well / actually / by the way / anyway'],
  ['总结表达', 'in short / in conclusion / to sum up'],
  ['多步骤叙事', 'First...Then...After that...Finally'],
  ['因果链叙事', 'because... / so... / The reason why...'],
  ['条件链叙事', 'If...then... / Unless...otherwise...'],
  ['时间链叙事', 'When...after...before... / Initially...Eventually...'],
  ['混合观点表达', 'I think...because...but... / In my opinion...'],
]

const topicScene = new Map(
  canonicalTopics.map(([title], index) => [title, sceneTitles[Math.floor(index / 5)]]),
)

function canonicalTopic(label, text = '') {
  const combined = `${label} ${text}`.toLowerCase()
  if (/^(递进\+结果|混合逻辑|时间顺序|建议\+理由)/.test(label)) return '总结表达'
  if (/^时间\+条件/.test(label)) return '时间链叙事'
  if (/^条件\+结果/.test(label)) return '条件链叙事'
  if (/^(观点\+原因|对比\+转折|建议链)/.test(label)) return '混合观点表达'
  if (/^总结表达/.test(label) && /learning english/i.test(text)) return '混合观点表达'
  if (/多步骤|first.*then.*after that/.test(combined)) return '多步骤叙事'
  if (/因果链/.test(combined)) return '因果链叙事'
  if (/条件链/.test(combined)) return '条件链叙事'
  if (/时间链|initially.*eventually/.test(combined)) return '时间链叙事'
  if (/混合观点|观点\+原因|对比\+转折|建议链|总结表达.*learning english/.test(combined)) return '混合观点表达'
  if (/not only|递进表达/.test(combined) && !/what'?s more|besides/.test(combined)) return '递进表达'
  if (/however/.test(combined)) return 'however 对比'
  if (/\band\b|and 并列|连接动作/.test(combined)) return 'and 并列连接'
  if (/\bor\b|or 选择|选择问/.test(combined)) return 'or 选择连接'
  if (/\bbut\b|but 转折|but 对比/.test(combined)) return 'but 转折连接'
  if (/because|原因/.test(combined)) return 'because 原因'
  if (/\bso\b|结果/.test(combined)) return 'so 结果'
  if (/as long as/.test(combined)) return 'as long as 只要'
  if (/unless/.test(combined)) return 'unless 除非'
  if (/\bif\b|if 条件|时间\+条件|条件\+结果/.test(combined)) return 'if 条件'
  if (/\bwhen\b|when 当/.test(combined)) return 'when 时间从句'
  if (/before|after|前后/.test(combined) && !/after that/.test(combined)) return 'before/after 前后'
  if (/\bwhile\b|while 同时/.test(combined)) return 'while 同时'
  if (/until/.test(combined)) return 'until 直到'
  if (/时间顺序|first.*then/.test(combined)) return '时间顺序链'
  if (/for example|举例/.test(combined)) return 'for example 举例'
  if (/either|also|too|as well|补充/.test(combined) && !/besides|what'?s more/.test(combined)) return 'also/too 补充'
  if (/besides|what'?s more|furthermore|moreover/.test(combined)) return 'besides 递进'
  if (/in short|in conclusion|to sum up|总结/.test(combined)) return '总结表达'
  if (/well|actually|by the way|anyway|对话衔接/.test(combined)) return '对话衔接词'
  return '对话衔接词'
}

const scenes = [
  {
    category_name: '基础入门',
    title: sceneTitles[0],
    location: '零基础课堂',
    required_output_level: 'L2',
    required_user_level: '1',
    description: '学习and/or/but/however/not only...but also表达并列、选择、转折和递进。',
    package_type: 'foundation',
  },
  {
    category_name: '基础入门',
    title: sceneTitles[1],
    location: '零基础课堂',
    required_output_level: 'L2',
    required_user_level: '1',
    description: '学习because/so/if/unless/as long as表达原因、结果、条件。',
    package_type: 'foundation',
  },
  {
    category_name: '基础入门',
    title: sceneTitles[2],
    location: '零基础课堂',
    required_output_level: 'L2',
    required_user_level: '1',
    description: '学习when/before/after/while/until表达时间关系和顺序。',
    package_type: 'foundation',
  },
  {
    category_name: '基础入门',
    title: sceneTitles[3],
    location: '零基础课堂',
    required_output_level: 'L2',
    required_user_level: '1',
    description: "学习for example/also/too/as well/besides/what's more/either表达举例和补充。",
    package_type: 'foundation',
  },
  {
    category_name: '基础入门',
    title: sceneTitles[4],
    location: '零基础课堂',
    required_output_level: 'L2',
    required_user_level: '1',
    description: '学习多步骤叙事、因果链、条件链、时间链等综合表达。',
    package_type: 'foundation',
  },
]

const topics = canonicalTopics.map(([title, connectors], index) => ({
  scene_title: sceneTitles[Math.floor(index / 5)],
  title,
  prompt_en: `Practice ${connectors.replace(/\s*\/\s*/g, ', ')} in a short spoken response.`,
  prompt_zh: `练习使用${connectors}完成简短口语表达。`,
  duration_sec: index >= 20 ? '40' : '35',
  difficulty: 'L2',
  description: `掌握${title}的核心用法。`,
  knowledge_points: connectors,
  teaching_markdown: `## ${title}\n\n核心表达：${connectors}`,
  ink_script_key: '',
}))

const chunkLines = section('## 句块参考（按场景分类）', '## 句型模板（供 `sentence_patterns.csv` 使用）')
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
  const meaning = stripMarkdown(row[2])
  const topicTitle = canonicalTopic(label, text)
  chunks.push({
    scene_title: topicScene.get(topicTitle),
    topic_title: topicTitle,
    category: label,
    text,
    meaning,
    difficulty: 'L2',
    description: '',
    examples_json: '',
  })
  episodeChunks.push({
    episode_chapter: `ch_conj_${String(Math.ceil(lessonNumber / 2)).padStart(2, '0')}`,
    episode_order: String(((lessonNumber - 1) % 2) + 1),
    chunk_text_match: text,
    sort_order: String(episodeChunks.filter((item) =>
      item.episode_chapter === `ch_conj_${String(Math.ceil(lessonNumber / 2)).padStart(2, '0')}`
      && item.episode_order === String(((lessonNumber - 1) % 2) + 1)).length),
  })
}

const chunkMeaningByExample = new Map(chunks.map((chunk) => [chunk.text, chunk.meaning]))
const patternLines = section('## 句型模板（供 `sentence_patterns.csv` 使用）', '## 核心词汇（逐话题分配，严格零跨包重叠）')
const patterns = []
let currentPatternScene = sceneTitles[0]
for (const line of patternLines) {
  const sceneIndex = ['🅰️', '🅱️', '🅲', '🅳', '🅴'].findIndex((marker) => line.includes(marker))
  if (sceneIndex >= 0) currentPatternScene = sceneTitles[sceneIndex]
  if (!line.startsWith('|')) continue
  const row = cells(line)
  if (row.length !== 4 || row[0] === '#' || /^:?-+/.test(row[0])) continue
  const pattern = stripMarkdown(row[1])
  const example = stripMarkdown(row[3])
  const patternNumber = Number(row[0])
  const topicTitle = patternNumber >= 41 && patternNumber <= 43
    ? '总结表达'
    : canonicalTopic(pattern, example)
  patterns.push({
    scene_title: topicScene.get(topicTitle) || currentPatternScene,
    topic_title: topicTitle,
    pattern,
    meaning: chunkMeaningByExample.get(example) || `用于“${topicTitle}”的表达句型。`,
    slots: stripMarkdown(row[2]),
    example,
    difficulty: 'L2',
    sort_order: String(patternNumber - 1),
  })
}

const vocabularyMeanings = {
  'both...and': '两者都；既……又……',
  'as well as': '以及；也',
  'not only...but also': '不仅……而且……',
  'either...or': '要么……要么……',
  'neither...nor': '既不……也不……',
  'whether...or': '无论……还是……',
  alternatively: '或者；作为另一种选择',
  yet: '然而；但是',
  nevertheless: '尽管如此；然而',
  unlike: '不像；与……不同',
  'not just...but': '不只是……而且……',
  'not to mention': '更不用说',
  'in addition to': '除……之外还',
  'on the contrary': '恰恰相反',
  'in contrast': '相比之下',
  'compared to': '与……相比',
  as: '因为；当……时',
  'now that': '既然',
  'due to': '由于',
  'owing to': '由于',
  'thanks to': '多亏；由于',
  thus: '因此',
  hence: '因此；由此',
  consequently: '因此；所以',
  'as a result': '因此；结果',
  'as a consequence': '因此；结果',
  'provided that': '只要；如果',
  'providing that': '只要；如果',
  'on condition that': '条件是；只要',
  'in case': '以防；万一',
  'in the event that': '如果；万一',
  'or else': '否则',
  'if not': '如果不；不然',
  'as long as': '只要',
  'so long as': '只要',
  'even if': '即使',
  'only if': '只有……才',
  'whether...or not': '无论是否',
  while: '当……时；与此同时',
  'just as': '正当；正如',
  'the moment': '一……就',
  'as soon as': '一……就',
  'right before': '就在……之前',
  'right after': '就在……之后',
  'shortly before': '在……前不久',
  'shortly after': '在……后不久',
  simultaneously: '同时地',
  concurrently: '同时地',
  'in the meantime': '与此同时',
  firstly: '首先',
  afterwards: '之后',
  subsequently: '随后',
  lastly: '最后',
  including: '包括',
  'e.g.': '例如',
  'for example': '例如',
  'for instance': '例如',
  'such as': '例如；诸如',
  hmm: '嗯（思考声）',
  um: '嗯（停顿声）',
  er: '呃（停顿声）',
  'I mean': '我的意思是',
  'you know': '你知道；你也知道',
  actually: '其实；实际上',
  truthfully: '说实话',
  seriously: '认真地；说真的',
  'in fact': '事实上',
  'as a matter of fact': '事实上',
  'to be honest': '说实话',
  anyhow: '无论如何',
  alright: '好吧',
  'by the way': '顺便说一下',
  'speaking of which': '说到这个',
  'moving on': '接下来；换个话题',
  'on another note': '换个话题说',
  'in short': '简而言之',
  'to sum up': '总而言之',
  'in conclusion': '总之',
  'in a word': '总之；一句话',
  besides: '此外；而且',
  furthermore: '此外；而且',
  moreover: '此外；而且',
  additionally: '此外',
  plus: '此外；加上',
  "what's more": '而且；更重要的是',
  'in addition': '此外',
  'to start with': '首先',
  'to begin with': '首先',
  'after that': '之后',
  'following that': '在那之后',
  'in the end': '最后',
  'at last': '终于；最后',
  'Since...therefore...': '既然……因此……',
  'The reason why...is that...': '……的原因是……',
  'This leads to...': '这会导致……',
  'This results in...': '这会造成……',
  'If...then...': '如果……那么……',
  'Unless...otherwise...': '除非……否则……',
  'If not...then...': '如果不……那么……',
  'If so...': '如果是这样……',
  'Initially...Subsequently...Eventually...Finally': '起初……随后……最终……最后……',
  'At first...Later on...After a while...In the end': '起初……后来……过了一会儿……最后……',
  personally: '就个人而言',
  honestly: '坦白地说',
  'in my opinion': '在我看来',
  'in my view': '在我看来',
  'from my perspective': '从我的角度看',
  "as far as I'm concerned": '就我而言',
}

const vocabularyLines = section('## 核心词汇（逐话题分配，严格零跨包重叠）', '## 附：连词与连接速查卡')
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
  const topicTitle = canonicalTopics[vocabularyTopicIndex][0]
  words.forEach((word, sortOrder) => {
    vocabulary.push({
      scene_title: topicScene.get(topicTitle),
      topic_title: topicTitle,
      word,
      meaning: vocabularyMeanings[word] || '',
      part_of_speech: word.includes(' ') || word.includes('...') ? 'phrase' : 'adv',
      phonetic_us: '',
      phonetic_uk: '',
      difficulty: 'L2',
      description: '',
      examples_json: '',
      sort_order: String(sortOrder),
    })
  })
}

const chapterRows = [
  ['ch_conj_01', '并列与转折', ['和/或者/但是', '因为/所以']],
  ['ch_conj_02', '时间与条件', ['当…时/之前/之后', '如果/除非']],
  ['ch_conj_03', '举例与顺序', ['举例与补充', '时间顺序叙述']],
  ['ch_conj_04', '对话衔接', ['对话衔接词', '连接词综合运用']],
  ['ch_conj_05', '综合叙事', ['多链叙事', '混合观点表达']],
]
const episodes = chapterRows.flatMap(([chapterId, chapterTitle, episodeTitles], chapterIndex) =>
  episodeTitles.map((title, episodeIndex) => {
    const episodeChunkCount = episodeChunks.filter((item) =>
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
      chunk_required_count: String(Math.min(3, episodeChunkCount)),
      chunk_total_count: String(episodeChunkCount),
      objectives_json: '',
      pass_objective_count: '1',
      pass_chunk_count: String(Math.min(3, episodeChunkCount)),
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

// The explicit Markdown tables are authoritative. The prose summary says 66
// chunks, while the actual tables currently contain 65 rows.
const expected = { scenes: 5, topics: 25, chunks: 65, patterns: 44, episodes: 10 }
for (const [name, count] of Object.entries(expected)) {
  const actual = ({ scenes, topics, chunks, patterns, episodes })[name].length
  if (actual !== count) throw new Error(`${name}: expected ${count}, got ${actual}`)
}
if (vocabulary.some((row) => !row.meaning)) {
  const missing = vocabulary.filter((row) => !row.meaning).map((row) => row.word)
  throw new Error(`Missing vocabulary meanings: ${missing.join(', ')}`)
}
