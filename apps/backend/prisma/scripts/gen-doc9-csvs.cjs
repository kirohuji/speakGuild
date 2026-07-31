const fs = require('fs')
const path = require('path')

const packageDir = path.resolve(__dirname, '../data/packages/foundation-9-describe-compare')
const markdown = fs.readFileSync(path.join(packageDir, '学习包的功能介绍.md'), 'utf8')
const lines = markdown.split(/\r?\n/)

const sceneTitles = [
  '基础⑨·比较事物',
  '基础⑨·比较级进阶',
  '基础⑨·程度表达',
  '基础⑨·偏好与推荐',
  '基础⑨·综合评价',
]

const topicDefinitions = [
  ['单音节比较级', '-er than (big→bigger)'],
  ['y→ier 比较级', 'y→ier (easy→easier)'],
  ['多音节比较级', 'more + adj'],
  ['不规则比较级', 'better/worse/more/less'],
  ['最高级', 'the -est / the most'],
  ['数量比较', 'more/fewer/less + than'],
  ['双比较级', 'the more...the more'],
  ['程度修饰比较', 'much/a little/far + 比较级'],
  ['倍数比较', 'twice/three times as...as'],
  ['比较级问答', 'Which is ___er, A or B?'],
  ['as...as 同级比较', 'as + adj + as'],
  ['not as...as 不如', 'not as + adj + as'],
  ['too 太…不能', 'too + adj + to'],
  ['enough 足够', 'adj + enough / not enough to'],
  ['方式副词', '-ly adverbs / well / hard'],
  ['偏好表达', 'prefer / would rather / like better'],
  ['推荐与背书', 'I recommend / I suggest'],
  ['比较与选择名词', 'advantage / disadvantage / trade-off'],
  ['推荐与反馈', 'recommendation / feedback / rating'],
  ['二选一比较', 'Between A and B, which is ___er?'],
  ['多维度比较', 'in terms of / regarding / when it comes to'],
  ['变化描述', 'getting ___er / more and more ___'],
  ['性价比评价', 'overpriced / affordable / worth the money'],
  ['比较总结', 'in comparison / by contrast / on balance'],
  ['比较级结论', 'X proves to be ___er / X outweighs Y'],
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
  ['比较事物', '学习单音节、多音节和不规则比较级及最高级。'],
  ['比较级进阶', '学习数量比较、双比较级、程度修饰、倍数比较和比较级问答。'],
  ['程度表达', '学习as...as、not as...as、too、enough和方式副词。'],
  ['偏好与推荐', '学习偏好、推荐、比较选择、反馈和二选一表达。'],
  ['综合评价', '学习多维度比较、变化描述、性价比评价、比较总结和结论。'],
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
  prompt_en: `Practice ${grammar} in a short spoken comparison.`,
  prompt_zh: `练习使用${grammar}完成简短比较表达。`,
  duration_sec: index >= 20 ? '40' : '35',
  difficulty: 'L2',
  description: `掌握${title}的核心用法。`,
  knowledge_points: grammar,
  teaching_markdown: `## ${title}\n\n核心语法：${grammar}`,
  ink_script_key: '',
}))

function chunkTopic(label, text, lessonNumber) {
  if (lessonNumber <= 2) {
    if (/y→ier/.test(label)) return 'y→ier 比较级'
    if (/多音节/.test(label)) return '多音节比较级'
    if (/不规则/.test(label)) return '不规则比较级'
    if (/最高级|one of/.test(label)) return '最高级'
    if (/越…越/.test(label)) return '双比较级'
    return '单音节比较级'
  }
  // The Markdown's second chunk group is a stale location unit, while the
  // authoritative topic blueprint defines comparison-advanced Topics 06–10.
  // Keep these rows scene-level rather than inventing false topic mappings.
  if (lessonNumber <= 4) return ''
  if (lessonNumber <= 6) {
    if (/not as|不如/.test(label)) return 'not as...as 不如'
    if (/too/.test(label)) return 'too 太…不能'
    if (/enough/.test(label)) return 'enough 足够'
    if (/副词|well|hard|频率/.test(label)) return '方式副词'
    if (/程度修饰/.test(label)) return '程度修饰比较'
    return 'as...as 同级比较'
  }
  if (lessonNumber <= 8) {
    if (/推荐|best choice|the best/.test(label)) return '推荐与背书'
    if (/二选一|比较选择/.test(label)) return '二选一比较'
    if (/Compared|same|tried both/.test(label)) return '比较与选择名词'
    return '偏好表达'
  }
  if (/变化/.test(label)) return '变化描述'
  if (/性价比|价格质量/.test(label)) return '性价比评价'
  if (/多维度/.test(label)) return '多维度比较'
  if (/观点对比/.test(label)) return '比较总结'
  if (/综合评价|推荐\+理由/.test(label)) return '比较级结论'
  return '比较级结论'
}

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
  const sceneTitle = sceneTitles[Math.ceil(lessonNumber / 2) - 1]
  const inferredTopicTitle = chunkTopic(label, text, lessonNumber)
  const topicTitle = inferredTopicTitle && topicScene.get(inferredTopicTitle) === sceneTitle
    ? inferredTopicTitle
    : ''
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
  const chapterId = `ch_desc_${String(Math.ceil(lessonNumber / 2)).padStart(2, '0')}`
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
const patternLines = section('## 句型模板（供 `sentence_patterns.csv` 使用）', '## 核心词汇（逐话题分配，严格零跨包重叠）')
const patterns = []
function patternTopic(patternNumber) {
  if ([1, 2].includes(patternNumber)) return '单音节比较级'
  if (patternNumber === 3) return '多音节比较级'
  if ([4, 5, 6].includes(patternNumber)) return '最高级'
  if (patternNumber === 7) return '不规则比较级'
  if (patternNumber === 8) return ''
  if (patternNumber >= 9 && patternNumber <= 15) return ''
  if (patternNumber === 16) return 'as...as 同级比较'
  if (patternNumber === 17) return 'not as...as 不如'
  if (patternNumber === 18) return ''
  if (patternNumber === 19) return 'too 太…不能'
  if (patternNumber === 20) return 'enough 足够'
  if ([21, 22].includes(patternNumber)) return '方式副词'
  if ([23, 24, 25].includes(patternNumber)) return '偏好表达'
  if (patternNumber === 26) return '二选一比较'
  if ([27, 28].includes(patternNumber)) return '推荐与背书'
  if (patternNumber === 29) return '比较与选择名词'
  if (patternNumber === 30) return '多维度比较'
  if ([31, 32].includes(patternNumber)) return '变化描述'
  if (patternNumber === 33) return '比较级结论'
  if (patternNumber === 34) return '比较总结'
  return ''
}
for (const line of patternLines) {
  if (!line.startsWith('|')) continue
  const row = cells(line)
  if (row.length !== 4 || row[0] === '#' || /^:?-+/.test(row[0])) continue
  const patternNumber = Number(row[0])
  const sceneIndex = patternNumber <= 8 ? 0 : patternNumber <= 15 ? 1 : patternNumber <= 22 ? 2 : patternNumber <= 29 ? 3 : 4
  const pattern = stripMarkdown(row[1])
  const example = stripMarkdown(row[3])
  const inferredTopicTitle = patternTopic(patternNumber)
  const topicTitle = inferredTopicTitle && topicScene.get(inferredTopicTitle) === sceneTitles[sceneIndex]
    ? inferredTopicTitle
    : ''
  patterns.push({
    scene_title: sceneTitles[sceneIndex],
    topic_title: topicTitle,
    pattern,
    meaning: chunkMeaningByExample.get(example) || `用于“${topicTitle || sceneTitles[sceneIndex]}”的核心句型。`,
    slots: stripMarkdown(row[2]),
    example,
    difficulty: 'L2',
    sort_order: String(patternNumber - 1),
  })
}

const lexicon = {
  high: '高的', higher: '更高的', low: '低的', lower: '更低的', near: '近的', nearer: '更近的',
  large: '大的', larger: '更大的', wide: '宽的', wider: '更宽的', deep: '深的', deeper: '更深的',
  cheap: '便宜的', cheaper: '更便宜的', easy: '容易的', easier: '更容易的', heavy: '重的',
  heavier: '更重的', early: '早的', earlier: '更早的', healthy: '健康的', healthier: '更健康的',
  wealthy: '富有的', wealthier: '更富有的', thirsty: '口渴的', thirstier: '更口渴的',
  difficult: '困难的', important: '重要的', popular: '受欢迎的', famous: '著名的', different: '不同的',
  useful: '有用的', convenient: '方便的', bad: '坏的', worse: '更差的', little: '少的', less: '更少的',
  far: '远的', farther: '更远的', further: '更进一步的', much: '许多', more: '更多', many: '许多',
  highest: '最高的', lowest: '最低的', easiest: '最容易的', heaviest: '最重的', money: '钱',
  people: '人', time: '时间', books: '书', water: '水', problems: '问题', amount: '数量',
  sooner: '更早', better: '更好', merrier: '更快乐', harder: '更困难', significantly: '显著地',
  considerably: '相当地', slightly: '稍微地', big: '大的', expensive: '昂贵的', half: '一半',
  size: '尺寸', triple: '三倍', ten: '十', faster: '更快', good: '好的', difference: '差别',
  same: '相同的', loud: '响亮的', quiet: '安静的', bright: '明亮的', dark: '黑暗的',
  crowded: '拥挤的', light: '轻的', close: '近的', late: '晚的', warm: '温暖的',
  old: '年长的', rich: '富有的', strong: '强壮的', smart: '聪明的', brave: '勇敢的',
  nicely: '友好地', happily: '开心地', sadly: '伤心地', angrily: '生气地', easily: '容易地',
  heavily: '沉重地', lightly: '轻轻地', smoothly: '顺利地', warmly: '热情地', coldly: '冷淡地',
  favor: '偏爱', urge: '力荐', endorse: '认可；背书', advocate: '提倡', promote: '推荐；推广',
  champion: '支持；拥护', back: '支持', selection: '选择', comparison: '比较', similarity: '相似点',
  advantage: '优点', disadvantage: '缺点', benefit: '好处', drawback: '缺点', pro: '优点',
  con: '缺点', compromise: '妥协', recommendation: '推荐', suggestion: '建议', advice: '建议',
  guidance: '指导', proposal: '提议', nomination: '提名', endorsement: '背书；认可', referral: '推荐',
  testimonial: '推荐证明', rating: '评分', feedback: '反馈', input: '意见', perspective: '视角',
  standpoint: '立场', even: '甚至；更加', regarding: '关于', concerning: '关于',
  overpriced: '定价过高的', underpriced: '定价过低的', affordable: '负担得起的', pricey: '昂贵的',
  steep: '价格高昂的', economical: '经济实惠的', reasonable: '合理的', inexpensive: '不贵的',
}

const phraseMeanings = {
  'the most difficult': '最困难的', 'the most important': '最重要的', 'the most popular': '最受欢迎的',
  'more money than': '钱比……更多', 'fewer people than': '人比……更少', 'less time than': '时间比……更少',
  'as many books as': '书和……一样多', 'as much water as': '水和……一样多', 'the most of all': '所有之中最多',
  'the fewest problems': '问题最少', 'the least amount of': '……的数量最少',
  'the sooner the better': '越早越好', 'the more the merrier': '越多越热闹', 'the cheaper the better': '越便宜越好',
  'more and more popular': '越来越受欢迎', 'less and less important': '越来越不重要',
  'better and better': '越来越好', 'worse and worse': '越来越差',
  'the longer you wait the harder it gets': '等得越久，事情越难',
  'far better': '好得多', 'much worse': '差得多', 'a little cheaper': '便宜一点',
  'a lot easier': '容易得多', 'even more difficult': '更加困难', 'by far the best': '遥遥领先的最好',
  'nearly as good as': '几乎和……一样好', 'twice as big as': '是……的两倍大',
  'three times as expensive as': '价格是……的三倍', 'half as heavy as': '重量是……的一半',
  'double the size of': '尺寸是……的两倍', 'triple the amount of': '数量是……的三倍',
  'ten times faster than': '比……快十倍', 'nowhere near as good as': '远不如……好',
  'Which is better, A or B?': 'A和B哪个更好？', 'Is this cheaper than that?': '这个比那个便宜吗？',
  'Yes much cheaper': '是的，便宜得多', 'Not really they are about the same': '不完全是，它们差不多',
  'This one is definitely better': '这个肯定更好', 'There is not much difference between them': '它们之间差别不大',
  'would rather': '宁愿', 'opt for': '选择', 'lean towards': '倾向于', 'be partial to': '偏爱',
  'have a preference for': '偏好', 'vouch for': '为……担保', 'speak highly of': '高度评价',
  'put in a good word for': '为……说好话', 'trade-off': '权衡；取舍',
  'twice as': '两倍……', 'three times as': '三倍……', 'half as': '一半……',
  'not nearly as': '远没有……那么', 'nowhere near as': '远不如……',
  'just as good as': '和……一样好', 'almost as good as': '几乎和……一样好',
  'in terms of': '就……而言', 'when it comes to': '说到……', 'as far as': '就……而言',
  'with respect to': '关于；就……而言', "it's getting": '正在变得……',
  "it's becoming": '正在变成……', "it's growing": '正在逐渐变得……',
  'compared to before': '与以前相比', 'compared to the past': '与过去相比',
  'unlike before': '不像以前', 'different from before': '与以前不同',
  'cost-effective': '性价比高的', 'budget-friendly': '适合预算有限者的',
  'in comparison': '相比之下', 'by contrast': '相反；相比之下', 'on balance': '综合权衡',
  'the key difference is': '关键区别是', 'the main advantage is': '主要优点是',
  'what sets them apart is': '它们的区别在于', 'when you compare the two': '比较两者时',
  'side by side': '并排比较', 'X proves to be better': '事实证明X更好',
  'between the two': '两者之中', 'X is clearly better': 'X明显更好',
  'X outweighs Y in terms of quality': '在质量方面X胜过Y', 'X comes out ahead': 'X最终领先',
  'the clear winner is X': '明显的胜者是X', 'no comparison': '无法相提并论',
  'X is far superior': 'X优越得多', 'X edges out Y slightly': 'X略胜Y一筹',
  'X and Y are evenly matched': 'X和Y势均力敌',
}

function meaningFor(word, topicTitle) {
  if (phraseMeanings[word]) return phraseMeanings[word]
  if (lexicon[word]) return lexicon[word]
  if (word.includes('→')) {
    const [from, to] = word.split('→')
    return `${lexicon[from] || from}→${lexicon[to] || to}`
  }
  let match = word.match(/^the (.+)$/)
  if (match) return `最${lexicon[match[1]] || match[1]}`
  match = word.match(/^as (.+) as$/)
  if (match) return `和……一样${lexicon[match[1]] || match[1]}`
  match = word.match(/^not as (.+) as$/)
  if (match) return `不如……${lexicon[match[1]] || match[1]}`
  match = word.match(/^too (.+)$/)
  if (match) return `太${lexicon[match[1]] || match[1]}`
  match = word.match(/^(.+) enough$/)
  if (match) return `足够${lexicon[match[1]] || match[1]}`
  return `${topicTitle}核心表达：${word}`
}

const specialVocabularyLists = {
  9: [
    'Which is better, A or B?', 'Is this cheaper than that?', 'Yes much cheaper',
    'Not really they are about the same', 'This one is definitely better',
    'There is not much difference between them',
  ],
  24: [
    'X proves to be better', 'between the two', 'X is clearly better',
    'X outweighs Y in terms of quality', 'X comes out ahead', 'the clear winner is X',
    'no comparison', 'X is far superior', 'X edges out Y slightly', 'X and Y are evenly matched',
  ],
}

const vocabularyLines = section('## 核心词汇（逐话题分配，严格零跨包重叠）', '## 附：比较级与最高级速查卡')
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
  const words = specialVocabularyLists[vocabularyTopicIndex] || boldMatch[1].split(/,\s+/)
  const topicTitle = topicDefinitions[vocabularyTopicIndex][0]
  words.forEach((word, sortOrder) => vocabulary.push({
    scene_title: topicScene.get(topicTitle),
    topic_title: topicTitle,
    word,
    meaning: meaningFor(word, topicTitle),
    part_of_speech: word.includes(' ') || word.includes('→') || word.includes('?') ? 'phrase' : 'word',
    phonetic_us: '',
    phonetic_uk: '',
    difficulty: 'L2',
    description: '',
    examples_json: '',
    sort_order: String(sortOrder),
  }))
}

const chapterRows = [
  ['ch_desc_01', '比较事物', ['比…更', '最…的']],
  ['ch_desc_02', '比较级进阶', ['数量与双比较', '程度与倍数']],
  ['ch_desc_03', '程度表达', ['和…一样/不如', '太/足够/方式']],
  ['ch_desc_04', '偏好与推荐', ['偏好与选择', '描述与推荐']],
  ['ch_desc_05', '综合评价', ['多维度比较', '比较总结与结论']],
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

// The prose summary says 66 chunks and 250 vocabulary items, while the
// authoritative Markdown tables explicitly contain 65 and 208 respectively.
const expected = { scenes: 5, topics: 25, vocabulary: 208, chunks: 65, patterns: 35, episodes: 10 }
for (const [name, count] of Object.entries(expected)) {
  const actual = ({ scenes, topics, vocabulary, chunks, patterns, episodes })[name].length
  if (actual !== count) throw new Error(`${name}: expected ${count}, got ${actual}`)
}
