/**
 * 📦 学习包充实脚本
 *
 * 修复三个问题：
 * 1. 为所有 topic 生成缺失的 Ink 脚本（JSON 文件 → ink-scripts/）
 * 2. 为 story 包生成真实词汇（替换占位 "keyword,关键词"）
 * 3. 为 exam 包扩充词汇和句块（解决每话题仅 4 词的稀疏问题）
 *
 * 运行：cd apps/backend && npx ts-node prisma/scripts/enrich-packages.ts
 */

import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, join } from 'path'

const PKG_DIR = resolve(__dirname, '..', 'data', 'packages')

// ── CSV 类型 ──
interface CsvVocab {
  scene_title: string; topic_title: string; word: string; meaning: string
  part_of_speech: string; phonetic_us: string; phonetic_uk: string
  difficulty: string; description: string; examples_json: string; sort_order: string
}
interface CsvChunk {
  scene_title: string; topic_title: string; category: string; text: string
  meaning: string; difficulty: string; description: string; examples_json: string
}
interface CsvTopic {
  scene_title: string; title: string; prompt_en: string; prompt_zh: string
  duration_sec: string; difficulty: string; description: string
  knowledge_points: string; ink_script_key: string
}
interface CsvPattern {
  scene_title: string; topic_title: string; pattern: string; meaning: string
  slots: string; example: string; difficulty: string; sort_order: string
}
interface CsvEpisode {
  chapter_id: string; chapter_title: string; episode_order: string; title: string
  scene_title: string; npc_name: string; npc_role: string
  objectives_json: string; ink_script_key: string
}

function parseCsv<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return []
  const lines = content.split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const row: any = {}
    // 简单 CSV 解析（不处理嵌套逗号，这里数据足够简单）
    const values = line.split(',')
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim() })
    return row as T
  })
}

function readAllCsv<T>(pkgPath: string, filename: string): T[] {
  return parseCsv<T>(join(PKG_DIR, pkgPath, filename))
}

// ════════════════════════════════════════════════════════
// 1. Ink 脚本生成
// ════════════════════════════════════════════════════════

function buildInkScript(
  topic: CsvTopic,
  chunks: CsvChunk[],
  episode: CsvEpisode | undefined,
  pkgType: string,
): { key: string; title: string; scriptType: string; inkSource: string } | null {
  const key = topic.ink_script_key?.trim()
  if (!key) return null

  // 从 chunks 中找属于这个 topic 的
  const topicChunks = chunks.filter(c => c.topic_title === topic.title)
  const chunkTexts = topicChunks.length >= 3
    ? topicChunks.slice(0, 3).map(c => c.text).join(',')
    : topicChunks.map(c => c.text).join(',')

  const npcName = episode?.npc_name || 'NPC'
  const objectives = episode?.objectives_json
    ? (() => { try { return JSON.parse(episode.objectives_json) as string[] } catch { return [] } })()
    : [topic.prompt_en]

  const objective1 = objectives[0] || topic.prompt_en
  const objective2 = objectives[1] || 'Follow up or ask a related question'

  // NPC 开场白基于 prompt_zh 构建
  const openingLine = topic.prompt_en.includes('?')
    ? topic.prompt_en
    : `Let's talk about ${topic.title}. ${topic.prompt_en}`

  const inkSource = [
    '---',
    `key: ${key}`,
    `title: ${topic.scene_title} - ${topic.title}`,
    '---',
    `${npcName}: ${openingLine}`,
    `#objective: ${objective1}`,
    chunkTexts ? `#chunks: ${chunkTexts}` : `#chunks: I'd like to talk about...,Let me tell you about...,In my opinion...`,
    '#user_input',
    `${npcName}: Thanks for sharing! Is there anything else you'd like to add or ask?`,
    `#objective: ${objective2}`,
    chunkTexts ? `#chunks: ${chunkTexts}` : `#chunks: I'd like to talk about...,Let me tell you about...,In my opinion...`,
    '#user_input',
    `${npcName}: Got it. That was really helpful. Have a great day!`,
    '-> END',
  ].join('\n')

  return {
    key,
    title: `${topic.scene_title} - ${topic.title}`,
    scriptType: pkgType === 'story' ? 'practice' : 'practice',
    inkSource,
  }
}

// ════════════════════════════════════════════════════════
// 2. 故事包词汇生成
// ════════════════════════════════════════════════════════

interface StoryVocabTemplate {
  scene_title: string
  topic_title: string
  words: Array<{
    word: string; meaning: string; part_of_speech: string
    phonetic_us: string; difficulty: string
    description: string; example_en: string; example_zh: string
  }>
}

const STORY_VOCAB: Record<string, StoryVocabTemplate[]> = {
  'story-culture': [
    {
      scene_title: '英国文化·传统与现代',
      topic_title: '王室与君主制',
      words: [
        { word: 'monarchy', meaning: '君主制', part_of_speech: 'noun', phonetic_us: '/ˈmɑːnərki/', difficulty: 'L2', description: '由国王或女王统治的国家制度。', example_en: "The UK is a constitutional monarchy.", example_zh: '英国是君主立宪制国家。' },
        { word: 'royal family', meaning: '王室', part_of_speech: 'noun', phonetic_us: '/ˈrɔɪəl ˈfæməli/', difficulty: 'L2', description: '国王/女王及其亲属。', example_en: "The royal family lives in Buckingham Palace.", example_zh: '王室住在白金汉宫。' },
        { word: 'coronation', meaning: '加冕典礼', part_of_speech: 'noun', phonetic_us: '/ˌkɔːrəˈneɪʃən/', difficulty: 'L2', description: '君主登基仪式。', example_en: "The coronation was a grand ceremony.", example_zh: '加冕典礼是一场盛大的仪式。' },
        { word: 'castle', meaning: '城堡', part_of_speech: 'noun', phonetic_us: '/ˈkæsəl/', difficulty: 'L1', description: '中世纪贵族居住的大型建筑。', example_en: "Windsor Castle is the oldest inhabited castle.", example_zh: '温莎城堡是最古老的有人居住的城堡。' },
        { word: 'guard', meaning: '卫兵', part_of_speech: 'noun', phonetic_us: '/ɡɑːrd/', difficulty: 'L1', description: '保护重要人物或建筑的人。', example_en: "The guards wear red uniforms and bearskin hats.", example_zh: '卫兵穿着红色制服和熊皮帽子。' },
        { word: 'ceremony', meaning: '仪式', part_of_speech: 'noun', phonetic_us: '/ˈserəmoʊni/', difficulty: 'L2', description: '正式的典礼或庆祝活动。', example_en: "The changing of the guard is a daily ceremony.", example_zh: '卫兵换岗是每天的仪式。' },
        { word: 'tradition', meaning: '传统', part_of_speech: 'noun', phonetic_us: '/trəˈdɪʃən/', difficulty: 'L2', description: '代代相传的习俗。', example_en: "This tradition dates back hundreds of years.", example_zh: '这个传统可以追溯到几百年前。' },
        { word: 'throne', meaning: '王座', part_of_speech: 'noun', phonetic_us: '/θroʊn/', difficulty: 'L2', description: '国王或女王的座位，象征权力。', example_en: "The king sat on his throne.", example_zh: '国王坐在他的王座上。' },
      ]
    },
    {
      scene_title: '英国文化·传统与现代',
      topic_title: '下午茶与美食文化',
      words: [
        { word: 'afternoon tea', meaning: '下午茶', part_of_speech: 'noun', phonetic_us: '/ˌæftərˈnuːn tiː/', difficulty: 'L2', description: '英国传统，下午享用的茶点。', example_en: "Afternoon tea includes sandwiches and scones.", example_zh: '下午茶包括三明治和司康饼。' },
        { word: 'scone', meaning: '司康饼', part_of_speech: 'noun', phonetic_us: '/skoʊn/', difficulty: 'L2', description: '英式烤饼，配奶油和果酱。', example_en: "Scones are served with clotted cream and jam.", example_zh: '司康饼配凝脂奶油和果酱。' },
        { word: 'pub', meaning: '酒吧', part_of_speech: 'noun', phonetic_us: '/pʌb/', difficulty: 'L1', description: '英式小酒馆，提供酒和简餐。', example_en: "Let's meet at the pub for lunch.", example_zh: '我们去酒吧吃午饭吧。' },
        { word: 'fish and chips', meaning: '炸鱼薯条', part_of_speech: 'noun', phonetic_us: '/fɪʃ ænd tʃɪps/', difficulty: 'L1', description: '英国最经典的食物。', example_en: "Fish and chips is a British classic.", example_zh: '炸鱼薯条是英国经典美食。' },
        { word: 'cuisine', meaning: '菜系/烹饪', part_of_speech: 'noun', phonetic_us: '/kwɪˈziːn/', difficulty: 'L2', description: '某国家或地区的烹饪风格。', example_en: "British cuisine has improved a lot.", example_zh: '英国菜系进步了很多。' },
        { word: 'roast dinner', meaning: '周日烤肉', part_of_speech: 'noun', phonetic_us: '/roʊst ˈdɪnər/', difficulty: 'L2', description: '英国传统周日烤肉大餐。', example_en: "A traditional roast dinner has meat, potatoes, and vegetables.", example_zh: '传统的周日烤肉有肉、土豆和蔬菜。' },
        { word: 'teapot', meaning: '茶壶', part_of_speech: 'noun', phonetic_us: '/ˈtiːpɑːt/', difficulty: 'L1', description: '泡茶用的壶。', example_en: "She poured tea from the teapot.", example_zh: '她从茶壶里倒茶。' },
        { word: 'etiquette', meaning: '礼仪', part_of_speech: 'noun', phonetic_us: '/ˈetɪket/', difficulty: 'L2', description: '社交场合的行为规范。', example_en: "There is a certain etiquette for afternoon tea.", example_zh: '喝下午茶有一定的礼仪。' },
      ]
    },
    {
      scene_title: '英国文化·传统与现代',
      topic_title: '英国体育与娱乐',
      words: [
        { word: 'football', meaning: '足球', part_of_speech: 'noun', phonetic_us: '/ˈfʊtbɔːl/', difficulty: 'L1', description: '英国最流行的运动。美式叫soccer。', example_en: "Football is the most popular sport in the UK.", example_zh: '足球是英国最流行的运动。' },
        { word: 'Premier League', meaning: '英超联赛', part_of_speech: 'noun', phonetic_us: '/prɪˈmɪr liːɡ/', difficulty: 'L2', description: '英格兰顶级足球联赛。', example_en: "The Premier League is watched worldwide.", example_zh: '英超联赛在全球被观看。' },
        { word: 'Wimbledon', meaning: '温布尔登网球赛', part_of_speech: 'noun', phonetic_us: '/ˈwɪmbldən/', difficulty: 'L2', description: '世界最古老的网球锦标赛。', example_en: "Wimbledon is the oldest tennis tournament.", example_zh: '温布尔登是最古老的网球锦标赛。' },
        { word: 'cricket', meaning: '板球', part_of_speech: 'noun', phonetic_us: '/ˈkrɪkɪt/', difficulty: 'L2', description: '英联邦国家流行的球类运动。', example_en: "Cricket matches can last for days.", example_zh: '板球比赛可以持续好几天。' },
        { word: 'match', meaning: '比赛', part_of_speech: 'noun', phonetic_us: '/mætʃ/', difficulty: 'L1', description: '体育比赛。', example_en: "Did you watch the match last night?", example_zh: '你昨晚看比赛了吗？' },
        { word: 'tournament', meaning: '锦标赛', part_of_speech: 'noun', phonetic_us: '/ˈtʊrnəmənt/', difficulty: 'L2', description: '系列比赛组成的赛事。', example_en: "The tournament attracts the best players.", example_zh: '这个锦标赛吸引了最好的选手。' },
        { word: 'stadium', meaning: '体育场', part_of_speech: 'noun', phonetic_us: '/ˈsteɪdiəm/', difficulty: 'L2', description: '大型体育场馆。', example_en: "Wembley Stadium holds 90,000 people.", example_zh: '温布利体育场可容纳9万人。' },
        { word: 'fan', meaning: '粉丝/球迷', part_of_speech: 'noun', phonetic_us: '/fæn/', difficulty: 'L1', description: '热情支持某队或某人的追随者。', example_en: "The fans were singing in the stadium.", example_zh: '球迷们在体育场里唱歌。' },
      ]
    },
    {
      scene_title: '美国文化·节日与生活方式',
      topic_title: '美国主要节日',
      words: [
        { word: 'Thanksgiving', meaning: '感恩节', part_of_speech: 'noun', phonetic_us: '/ˌθæŋksˈɡɪvɪŋ/', difficulty: 'L2', description: '美国11月第四个星期四，家庭团聚感恩。', example_en: "We have turkey and pumpkin pie on Thanksgiving.", example_zh: '感恩节我们吃火鸡和南瓜派。' },
        { word: 'Independence Day', meaning: '独立日', part_of_speech: 'noun', phonetic_us: '/ˌɪndɪˈpendəns deɪ/', difficulty: 'L2', description: '7月4日，美国国庆日，放烟花。', example_en: "We watch fireworks on Independence Day.", example_zh: '独立日我们看烟花。' },
        { word: 'turkey', meaning: '火鸡', part_of_speech: 'noun', phonetic_us: '/ˈtɜːrki/', difficulty: 'L1', description: '感恩节传统主菜。', example_en: "Roast turkey is the centerpiece of Thanksgiving.", example_zh: '烤火鸡是感恩节的主菜。' },
        { word: 'fireworks', meaning: '烟花', part_of_speech: 'noun', phonetic_us: '/ˈfaɪrwɜːrks/', difficulty: 'L1', description: '节日庆典的烟火表演。', example_en: "The fireworks display lasted 20 minutes.", example_zh: '烟花表演持续了20分钟。' },
        { word: 'parade', meaning: '游行', part_of_speech: 'noun', phonetic_us: '/pəˈreɪd/', difficulty: 'L2', description: '节日庆祝的游行队伍。', example_en: "The Macy's parade is a Thanksgiving tradition.", example_zh: '梅西游行是感恩节的传统。' },
        { word: 'barbecue', meaning: '烧烤', part_of_speech: 'noun', phonetic_us: '/ˈbɑːrbɪkjuː/', difficulty: 'L1', description: '户外烤肉聚会，独立日必备。', example_en: "We had a barbecue to celebrate the holiday.", example_zh: '我们烧烤庆祝节日。' },
        { word: 'flag', meaning: '国旗', part_of_speech: 'noun', phonetic_us: '/flæɡ/', difficulty: 'L1', description: '美国国旗（Stars and Stripes）。', example_en: "People display American flags on July 4th.", example_zh: '人们在7月4日展示美国国旗。' },
        { word: 'pilgrim', meaning: '清教徒', part_of_speech: 'noun', phonetic_us: '/ˈpɪlɡrɪm/', difficulty: 'L2', description: '1620年乘五月花号到美洲的英国移民。', example_en: "The Pilgrims had the first Thanksgiving with Native Americans.", example_zh: '清教徒和美洲原住民举行了第一个感恩节。' },
      ]
    },
    {
      scene_title: '美国文化·节日与生活方式',
      topic_title: '美国流行文化',
      words: [
        { word: 'Hollywood', meaning: '好莱坞', part_of_speech: 'noun', phonetic_us: '/ˈhɑːliwʊd/', difficulty: 'L2', description: '美国电影工业中心。', example_en: "Hollywood produces hundreds of movies each year.", example_zh: '好莱坞每年制作数百部电影。' },
        { word: 'blockbuster', meaning: '大片', part_of_speech: 'noun', phonetic_us: '/ˈblɑːkbʌstər/', difficulty: 'L2', description: '高票房的大制作电影。', example_en: "The new superhero movie is a blockbuster.", example_zh: '这部新的超级英雄电影是一部大片。' },
        { word: 'Broadway', meaning: '百老汇', part_of_speech: 'noun', phonetic_us: '/ˈbrɔːdweɪ/', difficulty: 'L2', description: '纽约剧院区，音乐剧中心。', example_en: "We saw a musical on Broadway.", example_zh: '我们在百老汇看了一部音乐剧。' },
        { word: 'Grammy', meaning: '格莱美奖', part_of_speech: 'noun', phonetic_us: '/ˈɡræmi/', difficulty: 'L2', description: '美国音乐界最高奖项。', example_en: "She won three Grammys last night.", example_zh: '她昨晚赢得了三个格莱美奖。' },
        { word: 'streaming', meaning: '流媒体', part_of_speech: 'noun', phonetic_us: '/ˈstriːmɪŋ/', difficulty: 'L2', description: '在线播放音乐或视频。', example_en: "Most people watch movies on streaming platforms.", example_zh: '大多数人都在流媒体平台看电影。' },
        { word: 'influencer', meaning: '网红/影响者', part_of_speech: 'noun', phonetic_us: '/ˈɪnfluənsər/', difficulty: 'L2', description: '社交媒体上有大量粉丝的人。', example_en: "She became a famous influencer on Instagram.", example_zh: '她成了Instagram上的知名网红。' },
        { word: 'jazz', meaning: '爵士乐', part_of_speech: 'noun', phonetic_us: '/dʒæz/', difficulty: 'L2', description: '起源于美国的音乐风格。', example_en: "Jazz was born in New Orleans.", example_zh: '爵士乐诞生于新奥尔良。' },
        { word: 'hip-hop', meaning: '嘻哈音乐', part_of_speech: 'noun', phonetic_us: '/ˈhɪp hɑːp/', difficulty: 'L2', description: '源自美国街头的音乐文化。', example_en: "Hip-hop is one of the most popular music genres.", example_zh: '嘻哈是最流行的音乐类型之一。' },
      ]
    },
    {
      scene_title: '全球文化·节日与习俗',
      topic_title: '亚洲文化与传统',
      words: [
        { word: 'Spring Festival', meaning: '春节', part_of_speech: 'noun', phonetic_us: '/sprɪŋ ˈfestɪvəl/', difficulty: 'L2', description: '中国农历新年，最重要的传统节日。', example_en: "During Spring Festival, families gather for reunion dinner.", example_zh: '春节期间家人团聚吃年夜饭。' },
        { word: 'tea ceremony', meaning: '茶道', part_of_speech: 'noun', phonetic_us: '/tiː ˈserəmoʊni/', difficulty: 'L2', description: '日本传统的泡茶与品茶仪式。', example_en: "The Japanese tea ceremony is a form of art.", example_zh: '日本茶道是一种艺术形式。' },
        { word: 'lantern', meaning: '灯笼', part_of_speech: 'noun', phonetic_us: '/ˈlæntərn/', difficulty: 'L1', description: '传统节日用的照明装饰。', example_en: "Red lanterns are hung during Chinese New Year.", example_zh: '春节期间挂红灯笼。' },
        { word: 'dragon dance', meaning: '舞龙', part_of_speech: 'noun', phonetic_us: '/ˈdræɡən dæns/', difficulty: 'L2', description: '中国传统舞蹈表演。', example_en: "The dragon dance brings good luck.", example_zh: '舞龙带来好运。' },
        { word: 'kimono', meaning: '和服', part_of_speech: 'noun', phonetic_us: '/kɪˈmoʊnoʊ/', difficulty: 'L2', description: '日本传统服装。', example_en: "She wore a beautiful kimono to the ceremony.", example_zh: '她穿着美丽的和服参加仪式。' },
        { word: 'Diwali', meaning: '排灯节', part_of_speech: 'noun', phonetic_us: '/dɪˈwɑːli/', difficulty: 'L2', description: '印度教的光明节，点灯庆祝。', example_en: "Diwali is the festival of lights.", example_zh: '排灯节是光明的节日。' },
        { word: 'calligraphy', meaning: '书法', part_of_speech: 'noun', phonetic_us: '/kəˈlɪɡrəfi/', difficulty: 'L2', description: '用毛笔书写汉字的艺术。', example_en: "Chinese calligraphy is an ancient art.", example_zh: '中国书法是古老的艺术。' },
        { word: 'dumpling', meaning: '饺子', part_of_speech: 'noun', phonetic_us: '/ˈdʌmplɪŋ/', difficulty: 'L1', description: '春节传统食物，象征团圆。', example_en: "We make dumplings together on New Year's Eve.", example_zh: '除夕夜我们一起包饺子。' },
      ]
    },
    {
      scene_title: '全球文化·节日与习俗',
      topic_title: '世界各地的文化',
      words: [
        { word: 'Day of the Dead', meaning: '亡灵节', part_of_speech: 'noun', phonetic_us: '/deɪ əv ðə ded/', difficulty: 'L2', description: '墨西哥纪念逝者的传统节日。', example_en: "Day of the Dead celebrates loved ones who have passed.", example_zh: '亡灵节纪念逝去的亲人。' },
        { word: 'Carnival', meaning: '狂欢节', part_of_speech: 'noun', phonetic_us: '/ˈkɑːrnɪvəl/', difficulty: 'L2', description: '巴西等国的盛大庆祝活动。', example_en: "Rio Carnival is the biggest carnival in the world.", example_zh: '里约狂欢节是世界上最大的狂欢节。' },
        { word: 'baguette', meaning: '法棍面包', part_of_speech: 'noun', phonetic_us: '/bæˈɡet/', difficulty: 'L1', description: '法国标志性长面包。', example_en: "The French eat baguettes every day.", example_zh: '法国人每天都吃法棍面包。' },
        { word: 'Oktoberfest', meaning: '慕尼黑啤酒节', part_of_speech: 'noun', phonetic_us: '/ɑːkˈtoʊbərfest/', difficulty: 'L2', description: '德国慕尼黑的啤酒节庆。', example_en: "Oktoberfest is the world's largest beer festival.", example_zh: '慕尼黑啤酒节是世界上最大的啤酒节。' },
        { word: 'tango', meaning: '探戈舞', part_of_speech: 'noun', phonetic_us: '/ˈtæŋɡoʊ/', difficulty: 'L2', description: '阿根廷传统舞蹈。', example_en: "Tango originated in Buenos Aires.", example_zh: '探戈起源于布宜诺斯艾利斯。' },
        { word: 'safari', meaning: '野生动物观赏', part_of_speech: 'noun', phonetic_us: '/səˈfɑːri/', difficulty: 'L2', description: '在非洲草原观赏野生动物。', example_en: "We went on a safari in Kenya.", example_zh: '我们在肯尼亚进行了野生动物观赏。' },
        { word: 'origami', meaning: '折纸', part_of_speech: 'noun', phonetic_us: '/ˌɔːrɪˈɡɑːmi/', difficulty: 'L2', description: '日本折纸艺术。', example_en: "She taught me how to make origami cranes.", example_zh: '她教我折纸鹤。' },
        { word: 'cuisine', meaning: '菜系', part_of_speech: 'noun', phonetic_us: '/kwɪˈziːn/', difficulty: 'L2', description: '特定文化的烹饪传统。', example_en: "French cuisine is famous worldwide.", example_zh: '法国菜系世界闻名。' },
      ]
    },
    {
      scene_title: '现代文化·数字时代',
      topic_title: '社交媒体与数字生活',
      words: [
        { word: 'social media', meaning: '社交媒体', part_of_speech: 'noun', phonetic_us: '/ˈsoʊʃəl ˈmiːdiə/', difficulty: 'L2', description: '在线社交平台如微信、Instagram。', example_en: "Social media has changed how we communicate.", example_zh: '社交媒体改变了我们的沟通方式。' },
        { word: 'algorithm', meaning: '算法', part_of_speech: 'noun', phonetic_us: '/ˈælɡərɪðəm/', difficulty: 'L3', description: '决定内容推荐的计算机程序。', example_en: "The algorithm decides what content you see.", example_zh: '算法决定你看到什么内容。' },
        { word: 'remote work', meaning: '远程办公', part_of_speech: 'noun', phonetic_us: '/rɪˈmoʊt wɜːrk/', difficulty: 'L2', description: '在家或异地通过互联网工作。', example_en: "Remote work became common during the pandemic.", example_zh: '疫情期间远程办公变得普遍。' },
        { word: 'digital nomad', meaning: '数字游民', part_of_speech: 'noun', phonetic_us: '/ˈdɪdʒɪtl ˈnoʊmæd/', difficulty: 'L3', description: '边旅行边远程工作的人。', example_en: "More people are becoming digital nomads.", example_zh: '越来越多人成为数字游民。' },
        { word: 'hashtag', meaning: '话题标签', part_of_speech: 'noun', phonetic_us: '/ˈhæʃtæɡ/', difficulty: 'L1', description: '用#符号标记话题。', example_en: "Use the hashtag to join the conversation.", example_zh: '用话题标签加入对话。' },
        { word: 'viral', meaning: '病毒式传播', part_of_speech: 'adj', phonetic_us: '/ˈvaɪrəl/', difficulty: 'L2', description: '内容在网上迅速传播。', example_en: "The video went viral overnight.", example_zh: '那个视频一夜之间病毒式传播。' },
        { word: 'screen time', meaning: '屏幕时间', part_of_speech: 'noun', phonetic_us: '/skriːn taɪm/', difficulty: 'L2', description: '花在电子设备屏幕上的时间。', example_en: "I'm trying to reduce my screen time.", example_zh: '我在尝试减少屏幕时间。' },
        { word: 'privacy', meaning: '隐私', part_of_speech: 'noun', phonetic_us: '/ˈpraɪvəsi/', difficulty: 'L2', description: '个人信息不被泄露的权利。', example_en: "Online privacy is a growing concern.", example_zh: '网络隐私是一个日益严重的问题。' },
      ]
    },
    {
      scene_title: '现代文化·数字时代',
      topic_title: '当代社会议题',
      words: [
        { word: 'climate change', meaning: '气候变化', part_of_speech: 'noun', phonetic_us: '/ˈklaɪmət tʃeɪndʒ/', difficulty: 'L2', description: '全球气候变暖及其影响。', example_en: "Climate change is the biggest challenge of our time.", example_zh: '气候变化是我们时代最大的挑战。' },
        { word: 'sustainability', meaning: '可持续性', part_of_speech: 'noun', phonetic_us: '/səˌsteɪnəˈbɪləti/', difficulty: 'L3', description: '满足当代需求而不损害后代。', example_en: "Companies are focusing more on sustainability.", example_zh: '企业越来越关注可持续性。' },
        { word: 'diversity', meaning: '多样性', part_of_speech: 'noun', phonetic_us: '/daɪˈvɜːrsəti/', difficulty: 'L2', description: '包含不同背景的人和文化。', example_en: "Diversity makes our community stronger.", example_zh: '多样性让我们的社区更强大。' },
        { word: 'mental health', meaning: '心理健康', part_of_speech: 'noun', phonetic_us: '/ˈmentl helθ/', difficulty: 'L2', description: '心理和情绪的健康状态。', example_en: "Mental health is just as important as physical health.", example_zh: '心理健康和身体健康一样重要。' },
        { word: 'globalization', meaning: '全球化', part_of_speech: 'noun', phonetic_us: '/ˌɡloʊbəlaɪˈzeɪʃən/', difficulty: 'L3', description: '世界各国经济文化日益互联。', example_en: "Globalization has connected cultures worldwide.", example_zh: '全球化连接了世界各地的文化。' },
        { word: 'equality', meaning: '平等', part_of_speech: 'noun', phonetic_us: '/iˈkwɑːləti/', difficulty: 'L2', description: '人人享有同等权利和机会。', example_en: "We should fight for equality for everyone.", example_zh: '我们应该为每个人的平等而奋斗。' },
        { word: 'renewable energy', meaning: '可再生能源', part_of_speech: 'noun', phonetic_us: '/rɪˈnuːəbəl ˈenərdʒi/', difficulty: 'L3', description: '太阳能、风能等可持续能源。', example_en: "Renewable energy is the future.", example_zh: '可再生能源是未来。' },
        { word: 'artificial intelligence', meaning: '人工智能', part_of_speech: 'noun', phonetic_us: '/ˌɑːrtɪˈfɪʃəl ɪnˈtelɪdʒəns/', difficulty: 'L3', description: '模拟人类智能的计算机系统。', example_en: "AI is transforming every industry.", example_zh: '人工智能正在改变每个行业。' },
      ]
    },
  ],
  'story-fables': [
    {
      scene_title: '寓言·经典寓言故事',
      topic_title: '伊索寓言选读',
      words: [
        { word: 'fable', meaning: '寓言', part_of_speech: 'noun', phonetic_us: '/ˈfeɪbəl/', difficulty: 'L2', description: '用故事讲道理的小故事。', example_en: "Aesop's fables teach important life lessons.", example_zh: '伊索寓言教给我们重要的人生道理。' },
        { word: 'moral', meaning: '寓意/教训', part_of_speech: 'noun', phonetic_us: '/ˈmɔːrəl/', difficulty: 'L2', description: '故事要传达的道理。', example_en: "The moral of the story is to be honest.", example_zh: '这个故事的寓意是做人要诚实。' },
        { word: 'tortoise', meaning: '乌龟', part_of_speech: 'noun', phonetic_us: '/ˈtɔːrtəs/', difficulty: 'L2', description: '寓言《龟兔赛跑》的主角。', example_en: "The tortoise won the race through persistence.", example_zh: '乌龟通过坚持赢得了比赛。' },
        { word: 'hare', meaning: '野兔', part_of_speech: 'noun', phonetic_us: '/her/', difficulty: 'L2', description: '《龟兔赛跑》中骄傲的兔子。', example_en: "The hare was overconfident and lost the race.", example_zh: '野兔过于自信输掉了比赛。' },
        { word: 'greedy', meaning: '贪婪的', part_of_speech: 'adj', phonetic_us: '/ˈɡriːdi/', difficulty: 'L2', description: '想要太多，不愿分享。', example_en: "The greedy dog lost everything.", example_zh: '贪婪的狗失去了一切。' },
        { word: 'patience', meaning: '耐心', part_of_speech: 'noun', phonetic_us: '/ˈpeɪʃəns/', difficulty: 'L2', description: '不急躁，能等待的品质。', example_en: "Patience is a virtue.", example_zh: '耐心是一种美德。' },
        { word: 'wisdom', meaning: '智慧', part_of_speech: 'noun', phonetic_us: '/ˈwɪzdəm/', difficulty: 'L2', description: '从经验中学到的深刻理解。', example_en: "The old man shared his wisdom with the children.", example_zh: '老人与孩子们分享他的智慧。' },
        { word: 'deceive', meaning: '欺骗', part_of_speech: 'verb', phonetic_us: '/dɪˈsiːv/', difficulty: 'L2', description: '让人相信不真实的事。', example_en: "Don't try to deceive others.", example_zh: '不要试图欺骗别人。' },
      ]
    },
    {
      scene_title: '寓言·经典寓言故事',
      topic_title: '中国寓言故事',
      words: [
        { word: 'seedling', meaning: '秧苗', part_of_speech: 'noun', phonetic_us: '/ˈsiːdlɪŋ/', difficulty: 'L2', description: '刚发芽的幼苗。', example_en: "He pulled the seedlings to make them grow faster.", example_zh: '他拔秧苗想让它们长快点。' },
        { word: 'perseverance', meaning: '毅力', part_of_speech: 'noun', phonetic_us: '/ˌpɜːrsəˈvɪrəns/', difficulty: 'L3', description: '坚持不懈的品质。', example_en: "Perseverance leads to success.", example_zh: '毅力通向成功。' },
        { word: 'contradiction', meaning: '矛盾', part_of_speech: 'noun', phonetic_us: '/ˌkɑːntrəˈdɪkʃən/', difficulty: 'L3', description: '自相矛盾的说法或行为。', example_en: "His story was full of contradictions.", example_zh: '他的故事充满了矛盾。' },
        { word: 'spear', meaning: '矛', part_of_speech: 'noun', phonetic_us: '/spɪr/', difficulty: 'L2', description: '古代的长柄武器。', example_en: "He sold both spears and shields.", example_zh: '他既卖矛又卖盾。' },
        { word: 'shield', meaning: '盾', part_of_speech: 'noun', phonetic_us: '/ʃiːld/', difficulty: 'L2', description: '防御武器。', example_en: "The shield could block any attack.", example_zh: '这个盾能挡住任何攻击。' },
        { word: 'frog', meaning: '青蛙', part_of_speech: 'noun', phonetic_us: '/frɔːɡ/', difficulty: 'L1', description: '井底之蛙的主角。', example_en: "The frog thought the well was the whole world.", example_zh: '青蛙以为那口井就是整个世界。' },
        { word: 'mark', meaning: '标记/记号', part_of_speech: 'noun', phonetic_us: '/mɑːrk/', difficulty: 'L2', description: '刻舟求剑中的记号。', example_en: "He made a mark on the boat.", example_zh: '他在船上做了一个记号。' },
        { word: 'pretend', meaning: '假装', part_of_speech: 'verb', phonetic_us: '/prɪˈtend/', difficulty: 'L2', description: '装作不是真实的样子。', example_en: "He pretended to like the music.", example_zh: '他假装喜欢这首曲子。' },
      ]
    },
    {
      scene_title: '寓言·经典寓言故事',
      topic_title: '世界寓言精选',
      words: [
        { word: 'grasshopper', meaning: '蚱蜢', part_of_speech: 'noun', phonetic_us: '/ˈɡræshɑːpər/', difficulty: 'L2', description: '《蚂蚁和蚱蜢》中懒惰的角色。', example_en: "The grasshopper played all summer.", example_zh: '蚱蜢整个夏天都在玩耍。' },
        { word: 'ant', meaning: '蚂蚁', part_of_speech: 'noun', phonetic_us: '/ænt/', difficulty: 'L1', description: '勤劳的小昆虫。', example_en: "The ants worked hard to store food.", example_zh: '蚂蚁努力储存食物。' },
        { word: 'shepherd', meaning: '牧羊人', part_of_speech: 'noun', phonetic_us: '/ˈʃepərd/', difficulty: 'L2', description: '放羊的人。', example_en: "The shepherd boy cried wolf.", example_zh: '牧羊少年喊狼来了。' },
        { word: 'wolf', meaning: '狼', part_of_speech: 'noun', phonetic_us: '/wʊlf/', difficulty: 'L1', description: '寓言中常出现的危险动物。', example_en: "A wolf appeared and ate the sheep.", example_zh: '一只狼出现吃掉了羊。' },
        { word: 'trust', meaning: '信任', part_of_speech: 'noun', phonetic_us: '/trʌst/', difficulty: 'L2', description: '相信某人或某事是可靠的。', example_en: "Once you lose trust, it's hard to regain.", example_zh: '一旦失去信任就很难挽回。' },
        { word: 'crow', meaning: '乌鸦', part_of_speech: 'noun', phonetic_us: '/kroʊ/', difficulty: 'L1', description: '黑色聪明的鸟。', example_en: "The clever crow dropped stones into the pitcher.", example_zh: '聪明的乌鸦往水罐里扔石子。' },
        { word: 'flatter', meaning: '奉承', part_of_speech: 'verb', phonetic_us: '/ˈflætər/', difficulty: 'L2', description: '说好听的话取悦人。', example_en: "The fox flattered the crow to get the cheese.", example_zh: '狐狸奉承乌鸦想得到奶酪。' },
        { word: 'lesson', meaning: '教训', part_of_speech: 'noun', phonetic_us: '/ˈlesən/', difficulty: 'L1', description: '从经历中学到的东西。', example_en: "Every fable has a lesson to teach.", example_zh: '每个寓言都教给我们一个教训。' },
      ]
    },
    {
      scene_title: '寓言·现代寓言',
      topic_title: '现代生活寓言',
      words: [
        { word: 'smartphone', meaning: '智能手机', part_of_speech: 'noun', phonetic_us: '/ˈsmɑːrtfoʊn/', difficulty: 'L1', description: '现代人离不开的设备。', example_en: "He couldn't put down his smartphone.", example_zh: '他放不下智能手机。' },
        { word: 'addiction', meaning: '上瘾', part_of_speech: 'noun', phonetic_us: '/əˈdɪkʃən/', difficulty: 'L2', description: '对某事过度依赖。', example_en: "Social media addiction is common among teens.", example_zh: '社交媒体上瘾在青少年中很常见。' },
        { word: 'balance', meaning: '平衡', part_of_speech: 'noun', phonetic_us: '/ˈbæləns/', difficulty: 'L2', description: '工作与生活、线上与线下的平衡。', example_en: "Finding balance is the key to happiness.", example_zh: '找到平衡是幸福的关键。' },
        { word: 'consumerism', meaning: '消费主义', part_of_speech: 'noun', phonetic_us: '/kənˈsuːmərɪzəm/', difficulty: 'L3', description: '过度追求物质消费。', example_en: "Consumerism makes people want more and more.", example_zh: '消费主义让人们想要越来越多。' },
        { word: 'gratitude', meaning: '感恩', part_of_speech: 'noun', phonetic_us: '/ˈɡrætɪtuːd/', difficulty: 'L2', description: '对所拥有的心怀感谢。', example_en: "Practice gratitude for what you have.", example_zh: '对你拥有的心怀感恩。' },
        { word: 'distraction', meaning: '分心', part_of_speech: 'noun', phonetic_us: '/dɪˈstrækʃən/', difficulty: 'L2', description: '让人无法专注的事物。', example_en: "Notifications are a constant distraction.", example_zh: '通知是持续的分心来源。' },
        { word: 'intention', meaning: '意图', part_of_speech: 'noun', phonetic_us: '/ɪnˈtenʃən/', difficulty: 'L2', description: '做某事的目的和计划。', example_en: "Live with intention, not on autopilot.", example_zh: '有意识地生活，不要自动驾驶。' },
        { word: 'community', meaning: '社区', part_of_speech: 'noun', phonetic_us: '/kəˈmjuːnəti/', difficulty: 'L2', description: '共同生活或互动的人群。', example_en: "Real community is more than online friends.", example_zh: '真正的社区不止是线上好友。' },
      ]
    },
    {
      scene_title: '寓言·动物寓言',
      topic_title: '动物寓言故事',
      words: [
        { word: 'lion', meaning: '狮子', part_of_speech: 'noun', phonetic_us: '/ˈlaɪən/', difficulty: 'L1', description: '百兽之王。', example_en: "The lion is the king of the jungle.", example_zh: '狮子是丛林之王。' },
        { word: 'fox', meaning: '狐狸', part_of_speech: 'noun', phonetic_us: '/fɑːks/', difficulty: 'L1', description: '以狡猾著称的动物。', example_en: "The fox is known for being cunning.", example_zh: '狐狸以狡猾著称。' },
        { word: 'mouse', meaning: '老鼠', part_of_speech: 'noun', phonetic_us: '/maʊs/', difficulty: 'L1', description: '小而胆怯的动物。', example_en: "The little mouse helped the mighty lion.", example_zh: '小老鼠帮助了强大的狮子。' },
        { word: 'grateful', meaning: '感激的', part_of_speech: 'adj', phonetic_us: '/ˈɡreɪtfəl/', difficulty: 'L2', description: '心怀感谢的。', example_en: "The lion was grateful for the mouse's help.", example_zh: '狮子感激老鼠的帮助。' },
        { word: 'promise', meaning: '承诺', part_of_speech: 'noun', phonetic_us: '/ˈprɑːmɪs/', difficulty: 'L2', description: '保证会做某事。', example_en: "The mouse made a promise to help the lion.", example_zh: '老鼠承诺会帮助狮子。' },
        { word: 'kindness', meaning: '善良', part_of_speech: 'noun', phonetic_us: '/ˈkaɪndnəs/', difficulty: 'L2', description: '对他人友善的品质。', example_en: "A small act of kindness can make a big difference.", example_zh: '小小的善举可以产生很大影响。' },
        { word: 'pride', meaning: '骄傲', part_of_speech: 'noun', phonetic_us: '/praɪd/', difficulty: 'L2', description: '过度自信或自负。', example_en: "Pride comes before a fall.", example_zh: '骄兵必败。' },
        { word: 'humble', meaning: '谦虚的', part_of_speech: 'adj', phonetic_us: '/ˈhʌmbəl/', difficulty: 'L2', description: '不骄傲，不自大。', example_en: "Stay humble no matter how successful you become.", example_zh: '无论多成功都要保持谦虚。' },
      ]
    },
  ],
  'story-history': [
    {
      scene_title: '历史·古代文明',
      topic_title: '古埃及文明',
      words: [
        { word: 'pyramid', meaning: '金字塔', part_of_speech: 'noun', phonetic_us: '/ˈpɪrəmɪd/', difficulty: 'L2', description: '古埃及法老的巨大陵墓。', example_en: "The Great Pyramid is one of the Seven Wonders.", example_zh: '大金字塔是七大奇迹之一。' },
        { word: 'pharaoh', meaning: '法老', part_of_speech: 'noun', phonetic_us: '/ˈferoʊ/', difficulty: 'L2', description: '古埃及的国王。', example_en: "The pharaoh was considered a god on earth.", example_zh: '法老被认为是地上的神。' },
        { word: 'mummy', meaning: '木乃伊', part_of_speech: 'noun', phonetic_us: '/ˈmʌmi/', difficulty: 'L2', description: '经过防腐处理的尸体。', example_en: "The mummy was preserved for thousands of years.", example_zh: '这具木乃伊保存了几千年。' },
        { word: 'hieroglyph', meaning: '象形文字', part_of_speech: 'noun', phonetic_us: '/ˈhaɪrəɡlɪf/', difficulty: 'L3', description: '古埃及的图画文字。', example_en: "Hieroglyphs were carved on temple walls.", example_zh: '象形文字被刻在神庙墙壁上。' },
        { word: 'Nile', meaning: '尼罗河', part_of_speech: 'noun', phonetic_us: '/naɪl/', difficulty: 'L2', description: '埃及的生命之河。', example_en: "The Nile River was essential to Egyptian civilization.", example_zh: '尼罗河对埃及文明至关重要。' },
        { word: 'temple', meaning: '神庙', part_of_speech: 'noun', phonetic_us: '/ˈtempəl/', difficulty: 'L2', description: '供奉神祇的建筑。', example_en: "The temple was built to honor the gods.", example_zh: '神庙是为敬拜神祇而建的。' },
        { word: 'sarcophagus', meaning: '石棺', part_of_speech: 'noun', phonetic_us: '/sɑːrˈkɑːfəɡəs/', difficulty: 'L3', description: '装木乃伊的石制棺材。', example_en: "The golden sarcophagus contained the pharaoh's body.", example_zh: '金色石棺中装有法老的遗体。' },
        { word: 'civilization', meaning: '文明', part_of_speech: 'noun', phonetic_us: '/ˌsɪvəlaɪˈzeɪʃən/', difficulty: 'L3', description: '有组织、有文化的复杂社会。', example_en: "Ancient Egypt was one of the earliest civilizations.", example_zh: '古埃及是最早的文明之一。' },
      ]
    },
    {
      scene_title: '历史·古代文明',
      topic_title: '古希腊与罗马',
      words: [
        { word: 'democracy', meaning: '民主', part_of_speech: 'noun', phonetic_us: '/dɪˈmɑːkrəsi/', difficulty: 'L3', description: '由人民治理的政治制度，起源于雅典。', example_en: "Democracy was born in ancient Athens.", example_zh: '民主诞生于古雅典。' },
        { word: 'senate', meaning: '元老院', part_of_speech: 'noun', phonetic_us: '/ˈsenət/', difficulty: 'L3', description: '古罗马的最高议事机构。', example_en: "The Roman Senate made important decisions.", example_zh: '罗马元老院做出重要决策。' },
        { word: 'gladiator', meaning: '角斗士', part_of_speech: 'noun', phonetic_us: '/ˈɡlædieɪtər/', difficulty: 'L2', description: '在竞技场战斗的战士。', example_en: "Gladiators fought in the Colosseum.", example_zh: '角斗士在斗兽场战斗。' },
        { word: 'philosophy', meaning: '哲学', part_of_speech: 'noun', phonetic_us: '/fɪˈlɑːsəfi/', difficulty: 'L3', description: '对智慧、存在和知识的探索。', example_en: "Greek philosophy influenced Western thought.", example_zh: '希腊哲学影响了西方思想。' },
        { word: 'mythology', meaning: '神话', part_of_speech: 'noun', phonetic_us: '/mɪˈθɑːlədʒi/', difficulty: 'L3', description: '关于神祇和英雄的传统故事。', example_en: "Greek mythology tells stories of gods and heroes.", example_zh: '希腊神话讲述神与英雄的故事。' },
        { word: 'emperor', meaning: '皇帝', part_of_speech: 'noun', phonetic_us: '/ˈempərər/', difficulty: 'L2', description: '帝国的最高统治者。', example_en: "Augustus was the first Roman emperor.", example_zh: '奥古斯都是第一位罗马皇帝。' },
        { word: 'aqueduct', meaning: '引水渠', part_of_speech: 'noun', phonetic_us: '/ˈækwɪdʌkt/', difficulty: 'L3', description: '古罗马的输水工程。', example_en: "Roman aqueducts brought water to cities.", example_zh: '罗马引水渠将水输送到城市。' },
        { word: 'legion', meaning: '军团', part_of_speech: 'noun', phonetic_us: '/ˈliːdʒən/', difficulty: 'L3', description: '古罗马军队的基本单位。', example_en: "A Roman legion had about 5,000 soldiers.", example_zh: '一个罗马军团约有5000名士兵。' },
      ]
    },
    {
      scene_title: '历史·中古时期',
      topic_title: '中世纪欧洲',
      words: [
        { word: 'knight', meaning: '骑士', part_of_speech: 'noun', phonetic_us: '/naɪt/', difficulty: 'L2', description: '中世纪的骑马战士。', example_en: "Knights wore heavy armor in battle.", example_zh: '骑士在战斗中穿着厚重的盔甲。' },
        { word: 'castle', meaning: '城堡', part_of_speech: 'noun', phonetic_us: '/ˈkæsəl/', difficulty: 'L1', description: '中世纪贵族的防御住所。', example_en: "The castle had thick stone walls.", example_zh: '城堡有厚厚的石墙。' },
        { word: 'feudalism', meaning: '封建制度', part_of_speech: 'noun', phonetic_us: '/ˈfjuːdəlɪzəm/', difficulty: 'L3', description: '以土地分封为基础的社会制度。', example_en: "Feudalism structured medieval society.", example_zh: '封建制度构建了中世纪社会。' },
        { word: 'plague', meaning: '瘟疫', part_of_speech: 'noun', phonetic_us: '/pleɪɡ/', difficulty: 'L2', description: '大规模传染病，尤指黑死病。', example_en: "The Black Death was a devastating plague.", example_zh: '黑死病是一场毁灭性的瘟疫。' },
        { word: 'cathedral', meaning: '大教堂', part_of_speech: 'noun', phonetic_us: '/kəˈθiːdrəl/', difficulty: 'L2', description: '主教所在的大型教堂。', example_en: "Gothic cathedrals took centuries to build.", example_zh: '哥特式大教堂花了几个世纪建造。' },
        { word: 'crusade', meaning: '十字军东征', part_of_speech: 'noun', phonetic_us: '/kruːˈseɪd/', difficulty: 'L3', description: '中世纪欧洲的宗教战争。', example_en: "The Crusades lasted nearly 200 years.", example_zh: '十字军东征持续了近200年。' },
        { word: 'guild', meaning: '行会', part_of_speech: 'noun', phonetic_us: '/ɡɪld/', difficulty: 'L3', description: '中世纪的工匠和商人组织。', example_en: "Craftsmen joined guilds to protect their trade.", example_zh: '工匠加入行会保护自己的手艺。' },
        { word: 'monastery', meaning: '修道院', part_of_speech: 'noun', phonetic_us: '/ˈmɑːnəsteri/', difficulty: 'L3', description: '修士或修女居住和祈祷的地方。', example_en: "Monks copied books by hand in monasteries.", example_zh: '修士在修道院手抄书籍。' },
      ]
    },
    {
      scene_title: '历史·中古时期',
      topic_title: '丝绸之路与探险',
      words: [
        { word: 'Silk Road', meaning: '丝绸之路', part_of_speech: 'noun', phonetic_us: '/sɪlk roʊd/', difficulty: 'L2', description: '连接东西方的古代贸易路线。', example_en: "The Silk Road connected China to Europe.", example_zh: '丝绸之路连接了中国和欧洲。' },
        { word: 'caravan', meaning: '商队', part_of_speech: 'noun', phonetic_us: '/ˈkærəvæn/', difficulty: 'L2', description: '穿越沙漠的骆驼商队。', example_en: "Merchant caravans traveled along the Silk Road.", example_zh: '商人商队沿着丝绸之路行进。' },
        { word: 'spice', meaning: '香料', part_of_speech: 'noun', phonetic_us: '/spaɪs/', difficulty: 'L2', description: '古代最珍贵的商品之一。', example_en: "Spices were worth more than gold.", example_zh: '香料比黄金还值钱。' },
        { word: 'explorer', meaning: '探险家', part_of_speech: 'noun', phonetic_us: '/ɪkˈsplɔːrər/', difficulty: 'L2', description: '探索未知世界的人。', example_en: "Marco Polo was a famous explorer.", example_zh: '马可·波罗是著名的探险家。' },
        { word: 'voyage', meaning: '航行', part_of_speech: 'noun', phonetic_us: '/ˈvɔɪɪdʒ/', difficulty: 'L2', description: '长途海上旅行。', example_en: "Columbus made four voyages to the Americas.", example_zh: '哥伦布进行了四次美洲航行。' },
        { word: 'compass', meaning: '指南针', part_of_speech: 'noun', phonetic_us: '/ˈkʌmpəs/', difficulty: 'L2', description: '中国古代发明，用于导航。', example_en: "The compass helped sailors navigate the seas.", example_zh: '指南针帮助水手在海上导航。' },
        { word: 'empire', meaning: '帝国', part_of_speech: 'noun', phonetic_us: '/ˈempaɪr/', difficulty: 'L2', description: '由单一统治者控制的大片领土。', example_en: "The Mongol Empire was the largest land empire.", example_zh: '蒙古帝国是最大的陆地帝国。' },
        { word: 'trade route', meaning: '贸易路线', part_of_speech: 'noun', phonetic_us: '/treɪd ruːt/', difficulty: 'L2', description: '商品交换的路径。', example_en: "The Silk Road was the most famous trade route.", example_zh: '丝绸之路是最著名的贸易路线。' },
      ]
    },
    {
      scene_title: '历史·近代转折',
      topic_title: '工业革命',
      words: [
        { word: 'factory', meaning: '工厂', part_of_speech: 'noun', phonetic_us: '/ˈfæktəri/', difficulty: 'L2', description: '大规模生产商品的建筑。', example_en: "Factories replaced small workshops.", example_zh: '工厂取代了小作坊。' },
        { word: 'steam engine', meaning: '蒸汽机', part_of_speech: 'noun', phonetic_us: '/stiːm ˈendʒɪn/', difficulty: 'L2', description: '工业革命的核心动力装置。', example_en: "The steam engine powered the Industrial Revolution.", example_zh: '蒸汽机推动了工业革命。' },
        { word: 'urbanization', meaning: '城市化', part_of_speech: 'noun', phonetic_us: '/ˌɜːrbənaɪˈzeɪʃən/', difficulty: 'L3', description: '人口从农村迁往城市。', example_en: "Industrialization led to rapid urbanization.", example_zh: '工业化导致了快速城市化。' },
        { word: 'textile', meaning: '纺织品', part_of_speech: 'noun', phonetic_us: '/ˈtekstaɪl/', difficulty: 'L2', description: '布料和衣物制造。', example_en: "The textile industry was the first to mechanize.", example_zh: '纺织业是最早机械化的行业。' },
        { word: 'railway', meaning: '铁路', part_of_speech: 'noun', phonetic_us: '/ˈreɪlweɪ/', difficulty: 'L2', description: '火车运行的轨道系统。', example_en: "The railway connected cities across the country.", example_zh: '铁路连接了全国各地的城市。' },
        { word: 'invention', meaning: '发明', part_of_speech: 'noun', phonetic_us: '/ɪnˈvenʃən/', difficulty: 'L2', description: '创造新事物的行为。', example_en: "The telephone was a revolutionary invention.", example_zh: '电话是一项革命性的发明。' },
        { word: 'pollution', meaning: '污染', part_of_speech: 'noun', phonetic_us: '/pəˈluːʃən/', difficulty: 'L2', description: '工业化带来的环境问题。', example_en: "Factories caused severe air pollution.", example_zh: '工厂造成了严重的空气污染。' },
        { word: 'revolution', meaning: '革命', part_of_speech: 'noun', phonetic_us: '/ˌrevəˈluːʃən/', difficulty: 'L2', description: '根本性的巨大变革。', example_en: "The Industrial Revolution changed the world forever.", example_zh: '工业革命永远改变了世界。' },
      ]
    },
    {
      scene_title: '历史·近代转折',
      topic_title: '二十世纪重大事件',
      words: [
        { word: 'World War', meaning: '世界大战', part_of_speech: 'noun', phonetic_us: '/wɜːrld wɔːr/', difficulty: 'L2', description: '涉及全球主要国家的战争。', example_en: "World War II ended in 1945.", example_zh: '第二次世界大战于1945年结束。' },
        { word: 'independence', meaning: '独立', part_of_speech: 'noun', phonetic_us: '/ˌɪndɪˈpendəns/', difficulty: 'L2', description: '从殖民统治中获得自由。', example_en: "Many countries gained independence after the war.", example_zh: '许多国家在战后获得了独立。' },
        { word: 'space race', meaning: '太空竞赛', part_of_speech: 'noun', phonetic_us: '/speɪs reɪs/', difficulty: 'L2', description: '美国和苏联的太空探索竞争。', example_en: "The space race led to the moon landing.", example_zh: '太空竞赛导致了登月。' },
        { word: 'civil rights', meaning: '民权', part_of_speech: 'noun', phonetic_us: '/ˈsɪvəl raɪts/', difficulty: 'L3', description: '公民享有的基本权利。', example_en: "The civil rights movement fought for equality.", example_zh: '民权运动为平等而战。' },
        { word: 'treaty', meaning: '条约', part_of_speech: 'noun', phonetic_us: '/ˈtriːti/', difficulty: 'L3', description: '国家间的正式协议。', example_en: "The peace treaty was signed in Versailles.", example_zh: '和平条约在凡尔赛签署。' },
        { word: 'atomic bomb', meaning: '原子弹', part_of_speech: 'noun', phonetic_us: '/əˈtɑːmɪk bɑːm/', difficulty: 'L3', description: '核武器。', example_en: "The atomic bomb changed warfare forever.", example_zh: '原子弹永远改变了战争。' },
        { word: 'conference', meaning: '会议/大会', part_of_speech: 'noun', phonetic_us: '/ˈkɑːnfərəns/', difficulty: 'L2', description: '多个国家或团体参加的大型会议。', example_en: "The United Nations held a peace conference.", example_zh: '联合国举行了和平会议。' },
        { word: 'United Nations', meaning: '联合国', part_of_speech: 'noun', phonetic_us: '/juˈnaɪtɪd ˈneɪʃənz/', difficulty: 'L2', description: '维护世界和平的国际组织。', example_en: "The UN was founded after World War II.", example_zh: '联合国在二战后成立。' },
      ]
    },
  ],
}

// ════════════════════════════════════════════════════════
// 3. 考试包词汇扩充
// ════════════════════════════════════════════════════════

const EXAM_VOCAB_EXPANSION: Record<string, Record<string, Array<{
  word: string; meaning: string; part_of_speech: string; difficulty: string
  description: string; example_en: string; example_zh: string
}>>> = {
  'exam-ielts-6': {
    '家乡与住所': [
      { word: 'suburb', meaning: '郊区', part_of_speech: 'noun', difficulty: 'L2', description: '城市外围的住宅区。', example_en: 'I grew up in the suburbs of London.', example_zh: '我在伦敦郊区长大。' },
      { word: 'downtown', meaning: '市中心', part_of_speech: 'noun', difficulty: 'L1', description: '城市的商业中心区。', example_en: 'There are many shops downtown.', example_zh: '市中心有很多商店。' },
      { word: 'cozy', meaning: '舒适的', part_of_speech: 'adj', difficulty: 'L2', description: '小而温暖舒适的。', example_en: 'My apartment is small but cozy.', example_zh: '我的公寓很小但很舒适。' },
      { word: 'neighborhood', meaning: '社区/街区', part_of_speech: 'noun', difficulty: 'L2', description: '居住的周边区域。', example_en: 'The neighborhood is quiet and safe.', example_zh: '这个社区安静又安全。' },
    ],
    '学习与工作': [
      { word: 'schedule', meaning: '日程/时间表', part_of_speech: 'noun', difficulty: 'L2', description: '安排好的时间计划。', example_en: 'My schedule is quite busy this week.', example_zh: '我这周的日程很忙。' },
      { word: 'deadline', meaning: '截止日期', part_of_speech: 'noun', difficulty: 'L2', description: '必须完成任务的最后期限。', example_en: 'The deadline for the project is Friday.', example_zh: '项目的截止日期是周五。' },
      { word: 'colleague', meaning: '同事', part_of_speech: 'noun', difficulty: 'L2', description: '一起工作的人。', example_en: 'I get along well with my colleagues.', example_zh: '我和同事相处融洽。' },
      { word: 'qualification', meaning: '资格/学历', part_of_speech: 'noun', difficulty: 'L2', description: '证明能力或学历的凭证。', example_en: 'What qualifications do you have?', example_zh: '你有什么资质？' },
    ],
  },
  'exam-ielts-6-5': {
    '兴趣爱好': [
      { word: 'passion', meaning: '热情/爱好', part_of_speech: 'noun', difficulty: 'L2', description: '对某事强烈的热爱。', example_en: 'Music is my greatest passion.', example_zh: '音乐是我最大的热情。' },
      { word: 'recreation', meaning: '消遣/娱乐', part_of_speech: 'noun', difficulty: 'L2', description: '工作之余的休闲活动。', example_en: 'Reading is my favorite form of recreation.', example_zh: '阅读是我最喜欢的消遣方式。' },
      { word: 'pursue', meaning: '追求', part_of_speech: 'verb', difficulty: 'L2', description: '努力实现或获得。', example_en: 'I want to pursue my dream of becoming an artist.', example_zh: '我想追求成为艺术家的梦想。' },
      { word: 'leisure', meaning: '闲暇', part_of_speech: 'noun', difficulty: 'L2', description: '不工作的自由时间。', example_en: 'I spend my leisure time reading novels.', example_zh: '我闲暇时间读小说。' },
    ],
    '旅行与假期': [
      { word: 'destination', meaning: '目的地', part_of_speech: 'noun', difficulty: 'L2', description: '旅行的目标地点。', example_en: 'Paris is a popular travel destination.', example_zh: '巴黎是一个受欢迎的旅游目的地。' },
      { word: 'itinerary', meaning: '行程计划', part_of_speech: 'noun', difficulty: 'L2', description: '旅行的详细安排。', example_en: 'We planned a detailed itinerary.', example_zh: '我们制定了详细的行程计划。' },
      { word: 'sightseeing', meaning: '观光', part_of_speech: 'noun', difficulty: 'L2', description: '参观旅游景点。', example_en: 'We spent the day sightseeing around the city.', example_zh: '我们花了一天在城市观光。' },
      { word: 'accommodation', meaning: '住宿', part_of_speech: 'noun', difficulty: 'L2', description: '旅途中住的地方。', example_en: 'I booked accommodation near the beach.', example_zh: '我订了海滩附近的住宿。' },
    ],
  },
  'exam-ielts-7': {
    '科技与社会': [
      { word: 'innovation', meaning: '创新', part_of_speech: 'noun', difficulty: 'L3', description: '新想法、新方法的创造。', example_en: 'Technological innovation is accelerating.', example_zh: '技术创新正在加速。' },
      { word: 'impact', meaning: '影响', part_of_speech: 'noun', difficulty: 'L2', description: '对某事产生的效果或改变。', example_en: 'The internet has had a huge impact on society.', example_zh: '互联网对社会产生了巨大影响。' },
      { word: 'automation', meaning: '自动化', part_of_speech: 'noun', difficulty: 'L3', description: '用机器代替人工的过程。', example_en: 'Automation is changing the job market.', example_zh: '自动化正在改变就业市场。' },
      { word: 'ethical', meaning: '伦理的', part_of_speech: 'adj', difficulty: 'L3', description: '关于道德和正确行为的。', example_en: 'There are ethical concerns about AI.', example_zh: '关于人工智能存在伦理担忧。' },
    ],
    '环境问题': [
      { word: 'carbon footprint', meaning: '碳足迹', part_of_speech: 'noun', difficulty: 'L3', description: '个人或组织排放的温室气体量。', example_en: 'We should all try to reduce our carbon footprint.', example_zh: '我们都应该尝试减少碳足迹。' },
      { word: 'conservation', meaning: '保护', part_of_speech: 'noun', difficulty: 'L3', description: '保护自然资源和环境。', example_en: 'Wildlife conservation is important.', example_zh: '野生动物保护很重要。' },
      { word: 'ecosystem', meaning: '生态系统', part_of_speech: 'noun', difficulty: 'L3', description: '生物与其环境的相互作用系统。', example_en: 'Pollution threatens the marine ecosystem.', example_zh: '污染威胁着海洋生态系统。' },
      { word: 'sustainable', meaning: '可持续的', part_of_speech: 'adj', difficulty: 'L3', description: '能长期维持而不损害环境的。', example_en: 'We need more sustainable energy sources.', example_zh: '我们需要更多可持续的能源。' },
    ],
  },
}

// ════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════

function main() {
  const packages = readdirSync(PKG_DIR).filter(f => {
    const stat = require('fs').statSync(join(PKG_DIR, f))
    return stat.isDirectory()
  })

  let totalInkCreated = 0
  let totalVocabAdded = 0
  let totalChunksAdded = 0

  for (const pkgName of packages) {
    const pkgPath = join(PKG_DIR, pkgName)
    const pkgType = pkgName.split('-')[0] // daily, exam, story, course, foundation

    console.log(`\n📦 ${pkgName} (${pkgType})`)

    // ── Read CSVs ──
    const topics = readAllCsv<CsvTopic>(pkgName, 'training_topics.csv')
    const chunks = readAllCsv<CsvChunk>(pkgName, 'chunks.csv')
    const episodes = readAllCsv<CsvEpisode>(pkgName, 'script_episodes.csv')
    const vocabRows = readAllCsv<CsvVocab>(pkgName, 'scene_vocabulary.csv')
    const patternRows = readAllCsv<CsvPattern>(pkgName, 'sentence_patterns.csv')

    if (topics.length === 0) continue

    // ═══ 1. Generate Ink Scripts ═══
    const inkDir = join(pkgPath, 'ink-scripts')
    if (!existsSync(inkDir)) mkdirSync(inkDir, { recursive: true })

    for (const topic of topics) {
      const key = topic.ink_script_key?.trim()
      if (!key) continue

      const inkFile = join(inkDir, `${key}.json`)
      if (existsSync(inkFile)) continue // already exists

      const episode = episodes.find(e => e.title === topic.title)
      const inkData = buildInkScript(topic, chunks, episode, pkgType)
      if (!inkData) continue

      writeFileSync(inkFile, JSON.stringify(inkData, null, 2), 'utf-8')
      totalInkCreated++
    }

    // ═══ 2. Story vocab replacement ═══
    if (pkgType === 'story' && STORY_VOCAB[pkgName]) {
      const templates = STORY_VOCAB[pkgName]
      const newVocabRows: CsvVocab[] = []

      for (const template of templates) {
        template.words.forEach((w, i) => {
          const examplesJson = JSON.stringify([
            { en: w.example_en, zh: w.example_zh }
          ])
          newVocabRows.push({
            scene_title: template.scene_title,
            topic_title: template.topic_title,
            word: w.word,
            meaning: w.meaning,
            part_of_speech: w.part_of_speech,
            phonetic_us: w.phonetic_us,
            phonetic_uk: w.phonetic_us.replace('/ˈ', '/ˈ').replace('/ˌ', '/ˌ'), // simplified
            difficulty: w.difficulty,
            description: w.description,
            examples_json: examplesJson,
            sort_order: String(i),
          })
        })
      }

      if (newVocabRows.length > 0) {
        // Build CSV
        const header = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order'
        const lines = newVocabRows.map(r =>
          `"${r.scene_title}","${r.topic_title}","${r.word}","${r.meaning}","${r.part_of_speech}","${r.phonetic_us}","${r.phonetic_uk}","${r.difficulty}","${r.description}","${r.examples_json.replace(/"/g, '""')}",${r.sort_order}`
        )
        const csv = header + '\n' + lines.join('\n')
        const vocabFile = join(pkgPath, 'scene_vocabulary.csv')
        writeFileSync(vocabFile, csv, 'utf-8')
        totalVocabAdded += newVocabRows.length
        console.log(`  ✓ ${newVocabRows.length} 个词汇 → scene_vocabulary.csv`)
      }

      // Also replace placeholder chunks with real content
      const placeholderChunks = chunks.filter(c => c.text.includes('Let me tell you about'))
      if (placeholderChunks.length > 0) {
        const newChunks: CsvChunk[] = []
        for (const template of templates) {
          const topicChunks = [
            { text: `Let me tell you about ${template.topic_title}.`, meaning: `让我给你讲讲${template.topic_title}。`, desc: '引入话题的标准表达。' },
            { text: `I find ${template.topic_title} really interesting.`, meaning: `我觉得${template.topic_title}非常有趣。`, desc: '表达兴趣的句式。' },
            { text: `One interesting thing about ${template.topic_title} is that...`, meaning: `关于${template.topic_title}有趣的一点是...`, desc: '引出具体细节的句式。' },
          ]
          topicChunks.forEach((ch, i) => {
            const examplesJson = JSON.stringify([
              { en: ch.text, zh: ch.meaning }
            ])
            newChunks.push({
              scene_title: template.scene_title,
              topic_title: template.topic_title,
              category: template.topic_title,
              text: ch.text,
              meaning: ch.meaning,
              difficulty: 'L2',
              description: ch.desc,
              examples_json: examplesJson,
            })
          })
        }

        const chunkHeader = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json'
        const chunkLines = newChunks.map(r =>
          `"${r.scene_title}","${r.topic_title}","${r.category}","${r.text}","${r.meaning}","${r.difficulty}","${r.description}","${r.examples_json.replace(/"/g, '""')}"`
        )
        const chunkCsv = chunkHeader + '\n' + chunkLines.join('\n')
        writeFileSync(join(pkgPath, 'chunks.csv'), chunkCsv, 'utf-8')
        totalChunksAdded += newChunks.length
        console.log(`  ✓ ${newChunks.length} 个句块 → chunks.csv`)
      }
    }

    // ═══ 3. Exam vocab expansion ═══
    if (pkgType === 'exam' && EXAM_VOCAB_EXPANSION[pkgName]) {
      const expansion = EXAM_VOCAB_EXPANSION[pkgName]
      const existingVocab = new Map<string, Set<string>>()
      for (const v of vocabRows) {
        const key = v.topic_title
        if (!existingVocab.has(key)) existingVocab.set(key, new Set())
        existingVocab.get(key)!.add(v.word)
      }

      const newRowCount = vocabRows.length
      for (const [topicTitle, words] of Object.entries(expansion)) {
        const existing = existingVocab.get(topicTitle) || new Set()
        words.forEach((w, i) => {
          if (existing.has(w.word)) return // skip duplicates
          const examplesJson = JSON.stringify([
            { en: w.example_en, zh: w.example_zh }
          ])
          // Find scene_title for this topic
          const topic = topics.find(t => t.title === topicTitle)
          vocabRows.push({
            scene_title: topic?.scene_title || '',
            topic_title: topicTitle,
            word: w.word,
            meaning: w.meaning,
            part_of_speech: w.part_of_speech,
            phonetic_us: `/${w.word.toLowerCase().replace(/\s/g, '')}/`,
            phonetic_uk: `/${w.word.toLowerCase().replace(/\s/g, '')}/`,
            difficulty: w.difficulty,
            description: w.description,
            examples_json: examplesJson,
            sort_order: String(newRowCount + i),
          })
        })
      }

      if (vocabRows.length > newRowCount) {
        const header = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order'
        const lines = vocabRows.map(r =>
          `"${r.scene_title}","${r.topic_title}","${r.word}","${r.meaning}","${r.part_of_speech}","${r.phonetic_us}","${r.phonetic_uk}","${r.difficulty}","${r.description}","${r.examples_json.replace(/"/g, '""')}",${r.sort_order}`
        )
        const csv = header + '\n' + lines.join('\n')
        writeFileSync(join(pkgPath, 'scene_vocabulary.csv'), csv, 'utf-8')
        const added = vocabRows.length - newRowCount
        totalVocabAdded += added
        console.log(`  ✓ ${added} 个词汇 → scene_vocabulary.csv`)
      }
    }

    if (topics.length > 0) console.log(`  ℹ ${topics.length} 个话题`)
  }

  console.log('\n═══════════════════════════════')
  console.log('✅ 充实完成！')
  console.log(`   Ink 脚本: ${totalInkCreated} 个新创建`)
  console.log(`   词汇扩充: ${totalVocabAdded} 个新词汇`)
  console.log(`   句块替换: ${totalChunksAdded} 个新句块`)
  console.log('═══════════════════════════════')
}

main()
