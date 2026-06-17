/**
 * 📦 学习包 — 按场景分类组织的自学数据
 *
 * 从 data/packages/<category-dir>/ 读取 CSV：
 *   scenes.csv → 场景基本信息
 *   scene_vocabulary.csv → 词汇（独立表 Vocabulary，通过 TrainingTopicVocab join 关联话题）
 *   chunks.csv → 句块（独立表 Chunk，通过 TrainingTopicChunk join 关联话题）
 *   training_topics.csv → 训练话题（通过 scene_title 关联场景）
 *   sentence_patterns.csv → 句型（独立表 SentencePattern，通过 TrainingTopicSentencePattern join）
 *   script_episodes.csv → 剧本关卡（通过 StoryEpisodeChunk/StoryEpisodeVocabulary join 关联）
 *
 * 新 Schema 数据流（所有关联都通过 ID join 表）：
 *   Vocabulary ──→ TrainingTopicVocab ──→ TrainingTopic ──→ Scene
 *   Chunk      ──→ TrainingTopicChunk ──→ TrainingTopic
 *   SentencePattern ──→ TrainingTopicSentencePattern ──→ TrainingTopic
 *   StoryEpisode ──→ StoryEpisodeVocabulary / StoryEpisodeChunk / StoryEpisodeSentencePattern
 *
 * 包发现：扫描 data/packages/ 下所有子目录自动发现。
 */

import { PrismaClient } from '@prisma/client'
import { readCsv, parseJson } from './seed-csv'
import { readdirSync, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { enrichVocabulary } from './seed-vocab-enrich'

const PKG_DIR = 'packages'
const PKG_ABS = resolve(__dirname, 'data', PKG_DIR)

/** 从 Ink 文本的 YAML front matter 中提取 key、title 和 scriptType */
function parseInkMeta(raw: string): { key: string; title: string; scriptType: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return { key: '', title: '', scriptType: 'practice' }
  const front = match[1]
  const keyMatch = front.match(/^key:\s*(.+)$/m)
  const titleMatch = front.match(/^title:\s*(.+)$/m)
  const typeMatch = front.match(/^scriptType:\s*(.+)$/m)
  return {
    key: (keyMatch?.[1] || '').trim(),
    title: (titleMatch?.[1] || '').trim(),
    scriptType: (typeMatch?.[1] || 'practice').trim(),
  }
}

// ── CSV 类型 ──
type CsvScene = { category_name: string; title: string; location: string; required_output_level: string; required_user_level: string; description: string; package_type?: string }
type CsvVocab = { scene_title: string; topic_title: string; word: string; meaning: string; part_of_speech: string; phonetic_us: string; phonetic_uk: string; difficulty: string; description: string; examples_json: string; sort_order: string }
type CsvChunk = { scene_title: string; topic_title: string; category: string; text: string; meaning: string; difficulty: string; description: string; examples_json: string }
type CsvTopic = { scene_title: string; title: string; prompt_en: string; prompt_zh: string; duration_sec: string; difficulty: string; description: string; knowledge_points: string; ink_script_key: string }
type CsvPattern = { scene_title: string; topic_title: string; pattern: string; meaning: string; slots: string; example: string; difficulty: string; sort_order: string }
type CsvEpisode = { chapter_id: string; chapter_title: string; episode_order: string; title: string; scene_title: string; required_output_level: string; required_user_level: string; vocab_required_count: string; vocab_total_count: string; chunk_required_count: string; chunk_total_count: string; objectives_json: string; pass_objective_count: string; pass_chunk_count: string; pass_min_dialogues: string; npc_name: string; npc_role: string; is_preview: string; ink_script_key: string; rewards_json: string }
type CsvEpChunk = { episode_chapter: string; episode_order: string; chunk_text_match: string; sort_order: string }

async function createLearningPackageRecord(prisma: PrismaClient, input: {
  sceneId: string
  title: string
  type: 'daily' | 'exam' | 'story' | 'course' | 'foundation'
}) {
  await prisma.learningPackage.upsert({
    where: { sceneId_version: { sceneId: input.sceneId, version: 1 } },
    create: {
      sceneId: input.sceneId,
      version: 1,
      title: `${input.title} v1`,
      type: input.type,
      status: 'draft',
      manifestSnapshot: {
        packId: input.sceneId,
        title: input.title,
        type: input.type,
        seeded: true,
      },
      buildLog: 'Seeded draft package. Generate zip from admin before publishing.',
    },
    update: {
      title: `${input.title} v1`,
      type: input.type,
      status: 'draft',
      buildLog: 'Seeded draft package. Generate zip from admin before publishing.',
    },
  })
}

async function upsertSeedVocabulary(prisma: PrismaClient, word: string, meaning: string, difficulty = 'L2') {
  return prisma.vocabulary.upsert({
    where: { word },
    create: {
      word,
      meaning,
      partOfSpeech: 'phrase',
      difficulty,
      examples: [{ en: word, zh: meaning, level: 'basic' }],
      description: null,
    },
    update: { meaning, difficulty },
  })
}

async function upsertSeedChunk(prisma: PrismaClient, text: string, meaning: string, category: string, difficulty = 'L2') {
  return prisma.chunk.upsert({
    where: { text },
    create: {
      text,
      meaning,
      category,
      difficulty,
      description: null,
      examples: {
        create: [{ en: text, zh: meaning, level: 'basic', sortOrder: 0 }],
      },
    },
    update: { meaning, category, difficulty },
  })
}

async function upsertSeedPattern(prisma: PrismaClient, pattern: string, meaning: string, difficulty = 'L2') {
  return prisma.sentencePattern.upsert({
    where: { pattern },
    create: {
      pattern,
      meaning,
      difficulty,
      examples: [{ en: pattern, zh: meaning, level: 'basic' }],
    },
    update: { meaning, difficulty },
  })
}

async function attachTopicAssets(prisma: PrismaClient, topicId: string, assets: {
  vocabIds?: string[]
  chunkIds?: string[]
  patternIds?: string[]
}) {
  if (assets.vocabIds?.length) {
    await prisma.trainingTopicVocab.createMany({
      data: assets.vocabIds.map((vocabId, sortOrder) => ({ topicId, vocabId, sortOrder })),
      skipDuplicates: true,
    })
  }
  if (assets.chunkIds?.length) {
    await prisma.trainingTopicChunk.createMany({
      data: assets.chunkIds.map((chunkId, sortOrder) => ({ topicId, chunkId, sortOrder })),
      skipDuplicates: true,
    })
  }
  if (assets.patternIds?.length) {
    await prisma.trainingTopicSentencePattern.createMany({
      data: assets.patternIds.map((patternId, sortOrder) => ({ topicId, patternId, sortOrder })),
      skipDuplicates: true,
    })
  }
}

async function seedIeltsAndStoryExamples(prisma: PrismaClient, catMap: Map<string, string>) {
  const ieltsCategoryId = catMap.get('雅思口语')
  const storyCategoryId = catMap.get('留学生活')
  const foundationCategoryId = catMap.get('基础入门')
  const cultureCategoryId = catMap.get('历史文化')
  if (!ieltsCategoryId || !storyCategoryId) {
    console.warn('  ⚠️  缺少「雅思口语」或「留学生活」分类，跳过 IELTS/故事样例包')
    return { scenes: 0, topics: 0, episodes: 0, vocabularies: 0, chunks: 0, patterns: 0 }
  }

  const ieltsScene = await prisma.scene.create({
    data: {
      categoryId: ieltsCategoryId,
      packageType: 'exam',
      title: 'IELTS Speaking 6.5 冲刺',
      location: 'IELTS 口语考场',
      description: '围绕 IELTS Speaking Part 1/2/3 的高频题型，训练答题结构、扩展能力和评分维度。',
      requiredOutputLevel: 'L3',
      requiredUserLevel: 2,
      isFree: true,
    },
  })
  await createLearningPackageRecord(prisma, { sceneId: ieltsScene.id, title: ieltsScene.title, type: 'exam' })

  const ieltsVocabs = await Promise.all([
    upsertSeedVocabulary(prisma, 'upbringing', '成长环境', 'L3'),
    upsertSeedVocabulary(prisma, 'work-life balance', '工作与生活平衡', 'L3'),
    upsertSeedVocabulary(prisma, 'environmentally friendly', '环保的', 'L3'),
    upsertSeedVocabulary(prisma, 'public facilities', '公共设施', 'L3'),
  ])
  const ieltsChunks = await Promise.all([
    upsertSeedChunk(prisma, 'That depends on the situation.', '这取决于具体情况。', 'IELTS', 'L3'),
    upsertSeedChunk(prisma, 'One example that comes to mind is...', '我想到的一个例子是……', 'IELTS', 'L3'),
    upsertSeedChunk(prisma, 'From my perspective, the main reason is...', '在我看来，主要原因是……', 'IELTS', 'L3'),
    upsertSeedChunk(prisma, 'It has become increasingly common for people to...', '人们越来越常……', 'IELTS', 'L4'),
  ])
  const ieltsPatterns = await Promise.all([
    upsertSeedPattern(prisma, 'I would say [answer], mainly because [reason].', 'Part 1 简洁回答 + 原因', 'L3'),
    upsertSeedPattern(prisma, 'The person/place/object I would like to describe is [x].', 'Part 2 开场结构', 'L3'),
    upsertSeedPattern(prisma, 'Although [contrast], I still believe [opinion].', 'Part 3 对比让步观点', 'L4'),
  ])
  const ieltsTopics = [
    {
      title: 'Part 1: Hometown and Daily Life',
      promptEn: 'The examiner asks you about your hometown, daily routine, and hobbies. Answer naturally and give one short reason.',
      promptZh: '考官询问你的家乡、日常生活和兴趣爱好。请自然回答，并补充一个简短原因。',
      metadata: { exam: 'IELTS', section: 'speaking', part: 1, bandTarget: '6.5', questionType: 'interview', rubric: ['fluency', 'lexical_resource', 'grammar', 'pronunciation'] },
      duration: 45,
      difficulty: 'L3',
    },
    {
      title: 'Part 2: Describe a Useful Object',
      promptEn: 'Describe a useful object you use often. Say what it is, when you use it, and why it is useful.',
      promptZh: '描述一个你经常使用且有用的物品。说明它是什么、什么时候使用、为什么有用。',
      metadata: { exam: 'IELTS', section: 'speaking', part: 2, bandTarget: '6.5', questionType: 'cue_card', prepSeconds: 60, answerSeconds: 120, rubric: ['fluency', 'lexical_resource', 'grammar', 'pronunciation'] },
      duration: 120,
      difficulty: 'L3',
    },
    {
      title: 'Part 3: Cities and Public Services',
      promptEn: 'Discuss how cities can improve public services and whether technology helps people live better.',
      promptZh: '讨论城市如何改善公共服务，以及科技是否能让人们生活得更好。',
      metadata: { exam: 'IELTS', section: 'speaking', part: 3, bandTarget: '6.5', questionType: 'discussion', rubric: ['fluency', 'lexical_resource', 'grammar', 'pronunciation'] },
      duration: 90,
      difficulty: 'L4',
    },
  ]
  for (const [sortOrder, topic] of ieltsTopics.entries()) {
    const created = await prisma.trainingTopic.create({
      data: {
        sceneId: ieltsScene.id,
        type: 'ielts',
        title: topic.title,
        description: 'IELTS 口语专项训练题。',
        teachingMarkdown: '## 答题策略\n\n先直接回答，再给原因或例子。Part 2 注意时间结构，Part 3 注意观点深度。',
        promptEn: topic.promptEn,
        promptZh: topic.promptZh,
        suggestedDurationSec: topic.duration,
        difficulty: topic.difficulty,
        metadata: topic.metadata,
        sortOrder,
      },
    })
    await attachTopicAssets(prisma, created.id, {
      vocabIds: ieltsVocabs.map((v) => v.id),
      chunkIds: ieltsChunks.map((c) => c.id),
      patternIds: ieltsPatterns.map((p) => p.id),
    })
  }

  const storyScene = await prisma.scene.create({
    data: {
      categoryId: storyCategoryId,
      packageType: 'story',
      title: '留学第一周：迷路的新生',
      location: '校园与宿舍区',
      description: '一个轻剧情学习包：新生第一周在校园里解决入住、问路、认识同伴等任务，练习后进入故事关卡实战。',
      requiredOutputLevel: 'L2',
      requiredUserLevel: 1,
      isFree: true,
    },
  })
  await createLearningPackageRecord(prisma, { sceneId: storyScene.id, title: storyScene.title, type: 'story' })

  const storyVocabs = await Promise.all([
    upsertSeedVocabulary(prisma, 'orientation', '迎新活动', 'L2'),
    upsertSeedVocabulary(prisma, 'student ID', '学生证', 'L1'),
    upsertSeedVocabulary(prisma, 'residence hall', '学生宿舍楼', 'L2'),
  ])
  const storyChunks = await Promise.all([
    upsertSeedChunk(prisma, "I'm new here. Could you help me find...?", '我是新来的。你能帮我找……吗？', 'story', 'L2'),
    upsertSeedChunk(prisma, 'I was told to check in at...', '我被告知要在……办理登记。', 'story', 'L2'),
    upsertSeedChunk(prisma, 'Could you show me where that is on the map?', '你能在地图上告诉我那在哪里吗？', 'story', 'L2'),
  ])
  const storyPatterns = await Promise.all([
    upsertSeedPattern(prisma, "I'm looking for [place].", '说明自己要找的地点', 'L1'),
    upsertSeedPattern(prisma, 'Could you tell me how to get to [place]?', '礼貌问路', 'L2'),
  ])
  const storyTopic = await prisma.trainingTopic.create({
    data: {
      sceneId: storyScene.id,
      type: 'daily',
      title: '校园问路准备',
      description: '故事关卡前的语言准备：问路、说明身份、确认地点。',
      teachingMarkdown: '## 故事前置练习\n\n先说自己是新生，再说明要找的地点，最后确认路线。',
      promptEn: "You are a new student on campus. Ask a student helper how to get to the residence hall.",
      promptZh: '你是刚到校园的新生，请向学生志愿者询问如何去宿舍楼。',
      suggestedDurationSec: 60,
      difficulty: 'L2',
      sortOrder: 0,
    },
  })
  await attachTopicAssets(prisma, storyTopic.id, {
    vocabIds: storyVocabs.map((v) => v.id),
    chunkIds: storyChunks.map((c) => c.id),
    patternIds: storyPatterns.map((p) => p.id),
  })
  const episodes = await Promise.all([
    prisma.storyEpisode.create({
      data: {
        sceneId: storyScene.id,
        chapterKey: 'arrival_week',
        chapterName: 'Arrival Week',
        sortOrder: 1,
        title: '找到宿舍楼',
        description: '你拖着行李来到校园，需要向志愿者确认宿舍楼的位置。',
        requiredOutputLevel: 'L2',
        requiredUserLevel: 1,
        requiredVocabularyCount: 2,
        totalVocabularyCount: storyVocabs.length,
        requiredChunkCount: 2,
        totalChunkCount: storyChunks.length,
        objectives: ['说明自己是新生', '询问宿舍楼方向', '确认下一步该去哪里'],
        requiredObjectiveCount: 2,
        requiredUsedChunkCount: 2,
        requiresRetell: false,
        minimumTurnCount: 3,
        rewards: { xp: 25, title: 'Campus Starter' },
        characterName: 'Maya',
        characterRole: '迎新志愿者',
        characterPersona: '热情、语速适中，会主动用简单表达解释路线。',
        isPreview: true,
        prerequisiteEpisodeIds: [],
      },
    }),
    prisma.storyEpisode.create({
      data: {
        sceneId: storyScene.id,
        chapterKey: 'arrival_week',
        chapterName: 'Arrival Week',
        sortOrder: 2,
        title: '错过迎新集合',
        description: '你发现自己走错楼，需要向宿舍前台解释情况并请求帮助。',
        requiredOutputLevel: 'L2',
        requiredUserLevel: 1,
        requiredVocabularyCount: 2,
        totalVocabularyCount: storyVocabs.length,
        requiredChunkCount: 2,
        totalChunkCount: storyChunks.length,
        objectives: ['解释自己走错楼', '询问迎新集合地点', '感谢对方帮助'],
        requiredObjectiveCount: 2,
        requiredUsedChunkCount: 2,
        requiresRetell: true,
        minimumTurnCount: 4,
        rewards: { xp: 35 },
        characterName: 'Daniel',
        characterRole: '宿舍前台工作人员',
        characterPersona: '耐心但比较忙，会要求你说清姓名和学生证信息。',
        isPreview: false,
        prerequisiteEpisodeIds: [],
      },
    }),
  ])
  for (const episode of episodes) {
    await prisma.storyEpisodeVocabulary.createMany({
      data: storyVocabs.map((vocab, sortOrder) => ({ episodeId: episode.id, vocabId: vocab.id, sortOrder })),
      skipDuplicates: true,
    })
    await prisma.storyEpisodeChunk.createMany({
      data: storyChunks.map((chunk, sortOrder) => ({ episodeId: episode.id, chunkId: chunk.id, sortOrder })),
      skipDuplicates: true,
    })
    await prisma.storyEpisodeSentencePattern.createMany({
      data: storyPatterns.map((pattern, sortOrder) => ({ episodeId: episode.id, patternId: pattern.id, sortOrder })),
      skipDuplicates: true,
    })
  }

  let extraScenes = 2
  let extraTopics = ieltsTopics.length + 1
  let extraVocabs = ieltsVocabs.length + storyVocabs.length
  let extraChunks = ieltsChunks.length + storyChunks.length
  let extraPatterns = ieltsPatterns.length + storyPatterns.length

  if (foundationCategoryId) {
    const foundationScene = await prisma.scene.create({
      data: {
        categoryId: foundationCategoryId,
        packageType: 'foundation',
        title: '零基础开口第一课',
        location: 'Beginner Lab',
        description: '面向刚开始开口的学习者，训练问候、自我介绍、请求重复和简单确认。',
        requiredOutputLevel: 'L1',
        requiredUserLevel: 1,
        isFree: true,
      },
    })
    await createLearningPackageRecord(prisma, { sceneId: foundationScene.id, title: foundationScene.title, type: 'foundation' })
    const foundationVocabs = await Promise.all([
      upsertSeedVocabulary(prisma, 'hello', '你好', 'L1'),
      upsertSeedVocabulary(prisma, 'again', '再一次', 'L1'),
      upsertSeedVocabulary(prisma, 'slowly', '慢一点', 'L1'),
    ])
    const foundationChunks = await Promise.all([
      upsertSeedChunk(prisma, 'My name is...', '我的名字是……', 'foundation', 'L1'),
      upsertSeedChunk(prisma, 'Could you say that again?', '你能再说一遍吗？', 'foundation', 'L1'),
      upsertSeedChunk(prisma, 'I am learning English.', '我正在学英语。', 'foundation', 'L1'),
    ])
    const foundationPatterns = await Promise.all([
      upsertSeedPattern(prisma, 'My name is [name].', '介绍自己的名字', 'L1'),
      upsertSeedPattern(prisma, 'Could you [verb], please?', '礼貌请求', 'L1'),
    ])
    const foundationTopic = await prisma.trainingTopic.create({
      data: {
        sceneId: foundationScene.id,
        type: 'daily',
        title: '第一次自我介绍',
        description: '从最短句开始，完成姓名、学习状态和请求重复。',
        teachingMarkdown: '## 开口顺序\n\n先说名字，再说自己正在学习英语，听不懂时请求对方重复。',
        promptEn: 'Introduce yourself with simple sentences. Ask the other person to repeat if needed.',
        promptZh: '用简单句介绍自己。如果没听清，请请求对方重复。',
        suggestedDurationSec: 45,
        difficulty: 'L1',
        sortOrder: 0,
      },
    })
    await attachTopicAssets(prisma, foundationTopic.id, {
      vocabIds: foundationVocabs.map((v) => v.id),
      chunkIds: foundationChunks.map((c) => c.id),
      patternIds: foundationPatterns.map((p) => p.id),
    })
    extraScenes += 1
    extraTopics += 1
    extraVocabs += foundationVocabs.length
    extraChunks += foundationChunks.length
    extraPatterns += foundationPatterns.length
  }

  if (cultureCategoryId) {
    const courseScene = await prisma.scene.create({
      data: {
        categoryId: cultureCategoryId,
        packageType: 'course',
        title: '历史文化表达课：博物馆讲解',
        location: 'Museum Gallery',
        description: '课程型学习包：围绕历史文化、展品介绍和观点表达，适合作为付费专题课样例。',
        requiredOutputLevel: 'L3',
        requiredUserLevel: 2,
        isFree: false,
      },
    })
    await createLearningPackageRecord(prisma, { sceneId: courseScene.id, title: courseScene.title, type: 'course' })
    const courseVocabs = await Promise.all([
      upsertSeedVocabulary(prisma, 'artifact', '文物；手工艺品', 'L3'),
      upsertSeedVocabulary(prisma, 'heritage', '遗产；传统', 'L3'),
      upsertSeedVocabulary(prisma, 'exhibition', '展览', 'L2'),
    ])
    const courseChunks = await Promise.all([
      upsertSeedChunk(prisma, 'This artifact dates back to...', '这件文物可以追溯到……', 'culture', 'L3'),
      upsertSeedChunk(prisma, 'It reflects the way people used to...', '它反映了过去人们如何……', 'culture', 'L3'),
      upsertSeedChunk(prisma, 'What I find interesting is...', '我觉得有趣的是……', 'culture', 'L3'),
    ])
    const coursePatterns = await Promise.all([
      upsertSeedPattern(prisma, 'This [object] dates back to [period].', '介绍年代', 'L3'),
      upsertSeedPattern(prisma, 'It reflects [idea/culture/value].', '解释文化意义', 'L3'),
    ])
    const courseTopic = await prisma.trainingTopic.create({
      data: {
        sceneId: courseScene.id,
        type: 'daily',
        title: '介绍一件展品',
        description: '学习如何用英语介绍展品年代、用途和文化意义。',
        teachingMarkdown: '## 讲解结构\n\n年代 -> 用途 -> 文化意义 -> 个人观察。',
        promptEn: 'You are introducing an artifact in a museum. Explain what it is, when it was made, and why it matters.',
        promptZh: '你正在介绍博物馆里的一件展品。说明它是什么、年代，以及它为什么重要。',
        suggestedDurationSec: 90,
        difficulty: 'L3',
        sortOrder: 0,
      },
    })
    await attachTopicAssets(prisma, courseTopic.id, {
      vocabIds: courseVocabs.map((v) => v.id),
      chunkIds: courseChunks.map((c) => c.id),
      patternIds: coursePatterns.map((p) => p.id),
    })
    extraScenes += 1
    extraTopics += 1
    extraVocabs += courseVocabs.length
    extraChunks += courseChunks.length
    extraPatterns += coursePatterns.length
  }

  return {
    scenes: extraScenes,
    topics: extraTopics,
    episodes: episodes.length,
    vocabularies: extraVocabs,
    chunks: extraChunks,
    patterns: extraPatterns,
  }
}

export async function seedLearningPackages(prisma: PrismaClient, packageName?: string) {
  console.log('📦 开始处理学习包...\n')

  // 发现可用包
  if (!existsSync(PKG_ABS)) {
    console.log('  ⚠️  未找到 packages 目录')
    return { sceneMap: new Map<string, string>() }
  }
  const packageDirs = readdirSync(PKG_ABS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  if (packageDirs.length === 0) {
    console.log('  ⚠️  无学习包')
    return { sceneMap: new Map<string, string>() }
  }

  // 筛选目标包
  let targetDirs: string[]
  if (packageName) {
    // 指定包名，仅处理匹配的包
    targetDirs = packageDirs.filter(d => d === packageName)
    if (targetDirs.length === 0) {
      console.log(`  ⚠️  未找到名为 "${packageName}" 的学习包，可用包: ${packageDirs.join(', ')}`)
      return { sceneMap: new Map<string, string>() }
    }
    console.log(`  发现 ${packageDirs.length} 个学习包: ${packageDirs.join(', ')}`)
    console.log(`  ▶ 仅导入指定包: ${targetDirs[0]}\n`)
  } else {
    // 未指定包名，默认导入全部包（调试中可改回只导入 study-abroad）
    targetDirs = packageDirs
    console.log(`  发现 ${packageDirs.length} 个学习包: ${packageDirs.join(', ')}\n`)
  }

  // 场景分类 name → id 映射（从 init 包创建）
  const allCategories = await prisma.sceneCategory.findMany()
  const catMap = new Map<string, string>()
  for (const cat of allCategories) {
    catMap.set(cat.name, cat.id)
  }

  // Ink key → id 映射（跨包共享）
  const allInkScripts = await prisma.inkScript.findMany()
  const inkKeyToId = new Map<string, string>()
  for (const ink of allInkScripts) {
    inkKeyToId.set(ink.key, ink.id)
  }

  // Track already-used ink IDs to avoid unique constraint violation
  const usedInkIds = new Set<string>()

  // 用于关联的全局映射
  const sceneMap = new Map<string, string>()
  const topicTitleSceneToId = new Map<string, string>()
  const chunkTextToId = new Map<string, string>()

  let totalVocab = 0
  let totalChunks = 0
  let totalTopics = 0
  let totalPatterns = 0
  let totalEpisodes = 0
  let totalEpChunks = 0
  let totalEpVocabs = 0

  for (const dirName of targetDirs) {
    const pkgPath = `${PKG_DIR}/${dirName}`
    console.log(`📁 packages/${dirName}/`)

    // ═══ 1. 场景 ═══
    const sceneRows = readCsv<CsvScene>('scenes.csv', pkgPath)
    for (const row of sceneRows) {
      const catId = catMap.get(row.category_name)
      if (!catId) {
        console.warn(`  ⚠️  分类未找到: ${row.category_name}, 跳过场景: ${row.title}`)
        continue
      }
      // 追加模式安全：检查场景是否已存在（按分类+标题），避免 duplicate
      const existingScene = await prisma.scene.findFirst({
        where: { categoryId: catId, title: row.title },
      })
      if (existingScene) {
        sceneMap.set(row.title, existingScene.id)
        // 确保 LearningPackage 记录存在（防止之前被意外删除）
        await createLearningPackageRecord(prisma, { sceneId: existingScene.id, title: row.title, type: 'daily' })
        continue
      }
      const scene = await prisma.scene.create({
        data: {
          categoryId: catId,
          packageType: (row.package_type as any) || 'daily',
          title: row.title,
          location: row.location,
          description: row.description || null,
          requiredOutputLevel: row.required_output_level,
          requiredUserLevel: parseInt(row.required_user_level) || 1,
          isFree: ['宿舍入住', '机场入境', '认识室友'].includes(row.title),
        },
      })
      await createLearningPackageRecord(prisma, { sceneId: scene.id, title: scene.title, type: 'daily' })
      sceneMap.set(row.title, scene.id)
    }
    console.log(`  ✓ ${sceneRows.length} 个场景`)

    // ═══ 2. 词汇（独立表 Vocabulary，后续通过 TrainingTopicVocab join） ═══
    const vocabRows = readCsv<CsvVocab>('scene_vocabulary.csv', pkgPath)
    let vocabCount = 0
    const sceneVocabIds = new Map<string, string[]>() // sceneTitle → vocabId[] (scene-level shared)
    const topicVocabIds = new Map<string, string[]>() // sceneTitle|topicTitle → vocabId[] (per-topic)
    for (const row of vocabRows) {
      const sceneId = sceneMap.get(row.scene_title)
      if (!sceneId) continue
      const vocab = await prisma.vocabulary.upsert({
        where: { word: row.word },
        create: {
          word: row.word,
          meaning: row.meaning,
          partOfSpeech: row.part_of_speech || null,
          phoneticUs: row.phonetic_us || null,
          phoneticUk: row.phonetic_uk || null,
          audioUsUrl: null,
          audioUkUrl: null,
          definitionEn: null,
          synonyms: [],
          examples: parseJson(row.examples_json),
          description: row.description || null,
          difficulty: row.difficulty || 'L1',
          sortOrder: parseInt(row.sort_order) || 0,
        },
        update: {
          meaning: row.meaning,
          partOfSpeech: row.part_of_speech || undefined,
          phoneticUs: row.phonetic_us || undefined,
          phoneticUk: row.phonetic_uk || undefined,
          examples: parseJson(row.examples_json) ?? undefined,
          description: row.description || undefined,
          difficulty: row.difficulty || 'L1',
          sortOrder: parseInt(row.sort_order) || 0,
        },
      })
      // Track by topic if specified, otherwise scene-level (shared across all topics)
      if (row.topic_title) {
        const key = `${row.scene_title}|${row.topic_title}`
        const ids = topicVocabIds.get(key) ?? []
        ids.push(vocab.id)
        topicVocabIds.set(key, ids)
      } else {
        const ids = sceneVocabIds.get(row.scene_title) ?? []
        ids.push(vocab.id)
        sceneVocabIds.set(row.scene_title, ids)
      }
      vocabCount++
    }
    console.log(`  ✓ ${vocabCount} 个词汇`)
    totalVocab += vocabCount

    // ═══ 3. 句块（独立表 Chunk，后续通过 TrainingTopicChunk join） ═══
    const chunkRows = readCsv<CsvChunk>('chunks.csv', pkgPath)
    let chunkCount = 0
    const sceneChunkIds = new Map<string, string[]>() // sceneTitle → chunkId[] (scene-level shared)
    const topicChunkIds = new Map<string, string[]>() // sceneTitle|topicTitle → chunkId[] (per-topic)
    for (const row of chunkRows) {
      const examples = parseJson<{ en: string; zh: string; note?: string; level?: string }[]>(row.examples_json)

      const chunk = await prisma.chunk.upsert({
        where: { text: row.text },
        create: {
          text: row.text,
          meaning: row.meaning,
          category: row.category,
          difficulty: row.difficulty || 'L2',
          description: row.description || null,
          examples: examples?.length
            ? { create: examples.map((ex, i) => ({ en: ex.en, zh: ex.zh, note: ex.note || null, level: ex.level || 'basic', sortOrder: i })) }
            : undefined,
        },
        update: {
          meaning: row.meaning,
          category: row.category,
          difficulty: row.difficulty || 'L2',
          description: row.description || null,
          examples: examples?.length
            ? {
                deleteMany: {},
                create: examples.map((ex, i) => ({ en: ex.en, zh: ex.zh, note: ex.note || null, level: ex.level || 'basic', sortOrder: i })),
              }
            : undefined,
        },
      })
      chunkTextToId.set(row.text.slice(0, 20), chunk.id)
      // Track by topic if specified, otherwise scene-level
      if (row.topic_title) {
        const key = `${row.scene_title}|${row.topic_title}`
        const ids = topicChunkIds.get(key) ?? []
        ids.push(chunk.id)
        topicChunkIds.set(key, ids)
      } else {
        const ids = sceneChunkIds.get(row.scene_title) ?? []
        ids.push(chunk.id)
        sceneChunkIds.set(row.scene_title, ids)
      }
      chunkCount++
    }
    console.log(`  ✓ ${chunkCount} 个句块`)
    totalChunks += chunkCount

    // ═══ 3.5. Ink 脚本（从包目录加载 .ink 文件） ═══
    try {
      const inkDir = resolve(__dirname, 'data', pkgPath, 'ink-scripts')
      if (existsSync(inkDir)) {
        const inkFiles = readdirSync(inkDir).filter((f: string) => f.endsWith('.ink'))
        for (const file of inkFiles) {
          const raw = require('fs').readFileSync(resolve(inkDir, file), 'utf-8')
          const { key, title, scriptType } = parseInkMeta(raw)
          if (!key) continue
          const ink = await prisma.inkScript.upsert({
            where: { key },
            create: { key, title: title || key, scriptType: scriptType || 'practice', inkSource: raw, inkJson: {} },
            update: { inkSource: raw },
          })
          inkKeyToId.set(ink.key, ink.id)
        }
        if (inkFiles.length > 0) console.log(`  ✓ ${inkFiles.length} 个 Ink 脚本`)
      }
    } catch { /* no ink-scripts dir */ }

    // ═══ 4. 训练话题 ═══
    const topicRows = readCsv<CsvTopic>('training_topics.csv', pkgPath)
    let topicCount = 0
    for (const row of topicRows) {
      const sceneId = sceneMap.get(row.scene_title)
      if (!sceneId) continue
      // Avoid duplicate inkScriptId (unique constraint)
      let inkId: string | null = null
      if (row.ink_script_key) {
        const rawKey = row.ink_script_key.trim()
        const found = inkKeyToId.get(rawKey)
        if (found && !usedInkIds.has(found)) {
          inkId = found
          usedInkIds.add(found)
        }
      }
      const topic = await prisma.trainingTopic.findFirst({
        where: { sceneId, title: row.title },
      })
      if (topic) {
        // 已存在，记录映射后跳过
        topicTitleSceneToId.set(`${row.scene_title}|${row.title}`, topic.id)
        topicCount++
        continue
      }
      const newTopic = await prisma.trainingTopic.create({
        data: {
          sceneId,
          title: row.title,
          promptEn: row.prompt_en,
          promptZh: row.prompt_zh,
          suggestedDurationSec: parseInt(row.duration_sec) || 60,
          difficulty: row.difficulty || 'L2',
          description: row.description || null,
          knowledgePoints: row.knowledge_points || null,
          inkScriptId: inkId,
          sortOrder: topicCount,
        },
      })
      topicTitleSceneToId.set(`${row.scene_title}|${row.title}`, newTopic.id)
      topicCount++
    }
    console.log(`  ✓ ${topicCount} 个训练话题`)
    totalTopics += topicCount

    // ═══ 4.1. 知识点练习 pipeline（从 warmup_pipeline.json 加载） ═══
    const pipelinePath = resolve(__dirname, 'data', pkgPath, 'warmup_pipeline.json')
    if (existsSync(pipelinePath)) {
      try {
        const pipelineData = JSON.parse(readFileSync(pipelinePath, 'utf-8'))
        let pipelineCount = 0
        for (const [topicTitle, pipeline] of Object.entries(pipelineData)) {
          // 在所有已创建的话题中按 title 查找
          const t = await prisma.trainingTopic.findFirst({ where: { title: topicTitle } })
          if (!t) continue
          await prisma.trainingTopic.update({ where: { id: t.id }, data: { metadata: pipeline as any } })
          pipelineCount++
        }
        if (pipelineCount > 0) console.log(`  ✓ ${pipelineCount} 个知识点练习 pipeline`)
      } catch (err: any) {
        console.warn(`  ⚠️ warmup_pipeline.json 解析失败: ${err.message}`)
      }
    }

    // ═══ 4.5. 话题↔词汇 关联 ═══
    // Scene-level vocab (topic_title empty) → shared to all topics in the scene
    // Topic-level vocab (topic_title specified) → only to that specific topic
    let tvcCount = 0
    for (const row of topicRows) {
      const topicId = topicTitleSceneToId.get(`${row.scene_title}|${row.title}`)
      if (!topicId) continue
      const sceneVocabs = sceneVocabIds.get(row.scene_title) ?? []
      const topicKey = `${row.scene_title}|${row.title}`
      const topicVocabs = topicVocabIds.get(topicKey) ?? []
      const allVocabIds = [...new Set([...sceneVocabs, ...topicVocabs])]
      if (allVocabIds.length > 0) {
        await prisma.trainingTopicVocab.createMany({
          data: allVocabIds.map((vocabId, i) => ({ topicId, vocabId, sortOrder: i })),
          skipDuplicates: true,
        })
        tvcCount += allVocabIds.length
      }
    }
    console.log(`  ✓ ${tvcCount} 个话题↔词汇关联`)

    // ═══ 5. 句型（独立表 SentencePattern，通过 TrainingTopicSentencePattern join） ═══
    const patternRows = readCsv<CsvPattern>('sentence_patterns.csv', pkgPath)
    let patternCount = 0
    for (const row of patternRows) {
      const topicId = topicTitleSceneToId.get(`${row.scene_title}|${row.topic_title}`)
      if (!topicId) continue
      const patternRecord = await prisma.sentencePattern.upsert({
        where: { pattern: row.pattern },
        create: {
          pattern: row.pattern,
          meaning: row.meaning || null,
          slots: row.slots ? parseJson(row.slots) : undefined,
          examples: row.example ? [{ en: row.example, zh: '', level: 'intermediate' }] : undefined,
          difficulty: row.difficulty || 'L1',
        },
        update: {},
      })
      await prisma.trainingTopicSentencePattern.upsert({
        where: { topicId_patternId: { topicId, patternId: patternRecord.id } },
        create: { topicId, patternId: patternRecord.id, sortOrder: parseInt(row.sort_order) || 0 },
        update: { sortOrder: parseInt(row.sort_order) || 0 },
      })
      patternCount++
    }
    console.log(`  ✓ ${patternCount} 个句型`)
    totalPatterns += patternCount

    // ═══ 6. 话题↔句块 关联（TrainingTopicChunk join 表） ═══
    // Scene-level chunks (topic_title empty) → shared to all topics in the scene
    // Topic-level chunks (topic_title specified) → only to that specific topic
    let tccCount = 0
    for (const row of topicRows) {
      const topicId = topicTitleSceneToId.get(`${row.scene_title}|${row.title}`)
      if (!topicId) continue
      const sceneChunks = sceneChunkIds.get(row.scene_title) ?? []
      const topicKey = `${row.scene_title}|${row.title}`
      const topicChunks = topicChunkIds.get(topicKey) ?? []
      const allChunkIds = [...sceneChunks, ...topicChunks]
      if (allChunkIds.length > 0) {
        await prisma.trainingTopicChunk.createMany({
          data: allChunkIds.map((chunkId, i) => ({ topicId, chunkId, sortOrder: i })),
          skipDuplicates: true,
        })
        tccCount += allChunkIds.length
      }
    }
    console.log(`  ✓ ${tccCount} 个话题↔句块关联`)

    // ═══ 7. 剧本关卡 ═══
    const epRows = readCsv<CsvEpisode>('script_episodes.csv', pkgPath)
    let epCount = 0
    for (const row of epRows) {
      const sceneId = sceneMap.get(row.scene_title)
      if (!sceneId) continue
      // 追加模式安全：检查关卡是否已存在
      const existingEp = await prisma.storyEpisode.findFirst({
        where: { chapterKey: row.chapter_id, sceneId, title: row.title },
      })
      if (existingEp) {
        // 关联仍沿用旧数据，不重复创建
        continue
      }
      await prisma.storyEpisode.create({
        data: {
          chapterKey: row.chapter_id,
          chapterName: row.chapter_title,
          sortOrder: parseInt(row.episode_order),
          title: row.title,
          sceneId,
          requiredOutputLevel: row.required_output_level || 'L1',
          requiredUserLevel: parseInt(row.required_user_level) || 1,
          requiredVocabularyCount: parseInt(row.vocab_required_count) || 2,
          totalVocabularyCount: parseInt(row.vocab_total_count) || 10,
          requiredChunkCount: parseInt(row.chunk_required_count) || 2,
          totalChunkCount: parseInt(row.chunk_total_count) || 10,
          objectives: parseJson<string[]>(row.objectives_json) || [],
          requiredObjectiveCount: parseInt(row.pass_objective_count) || 2,
          requiredUsedChunkCount: parseInt(row.pass_chunk_count) || 2,
          minimumTurnCount: parseInt(row.pass_min_dialogues) || 2,
          characterName: row.npc_name,
          characterRole: row.npc_role,
          isPreview: row.is_preview === 'true',
          inkScriptId: inkKeyToId.get(row.ink_script_key) || null,
          rewards: parseJson(row.rewards_json),
          prerequisiteEpisodeIds: [],
        },
      })
      epCount++
    }
    console.log(`  ✓ ${epCount} 个剧本关卡`)
    totalEpisodes += epCount

    // ═══ 8. 关卡↔句块 关联（StoryEpisodeChunk join 表） ═══
    const epChunkRows = readCsv<CsvEpChunk>('episode_chunks.csv', pkgPath)
    // Get the episodes we just created
    const pkgEpisodes = await prisma.storyEpisode.findMany({
      where: { title: { in: epRows.map(r => r.title) } },
    })
    const epOrderToId = new Map<string, string>()
    for (const ep of pkgEpisodes) {
      // Find matching row to get chapterId + episodeOrder
      const match = epRows.find(r => r.title === ep.title)
      if (match) {
        epOrderToId.set(`${match.chapter_id},${match.episode_order}`, ep.id)
      }
    }

    let epChunkCount = 0
    const chunkLinks: { episodeId: string; chunkId: string; sortOrder: number }[] = []
    for (const row of epChunkRows) {
      const epId = epOrderToId.get(`${row.episode_chapter},${row.episode_order}`)
      if (!epId) continue
      // Find matching chunk by text
      const matchingChunk = await prisma.chunk.findFirst({
        where: { text: { contains: row.chunk_text_match } },
      })
      if (matchingChunk) {
        chunkLinks.push({ episodeId: epId, chunkId: matchingChunk.id, sortOrder: parseInt(row.sort_order) || 0 })
      }
    }
    if (chunkLinks.length > 0) {
      await prisma.storyEpisodeChunk.createMany({ data: chunkLinks, skipDuplicates: true })
      epChunkCount = chunkLinks.length
    }
    console.log(`  ✓ ${epChunkCount} 个关卡↔句块关联`)
    totalEpChunks += epChunkCount

    // ═══ 8.5. 关卡↔词汇 关联（StoryEpisodeVocabulary join 表） ═══
    // Link each episode to all vocabs in the same scene
    let epVocabCount = 0
    for (const ep of pkgEpisodes) {
      const match = epRows.find(r => r.title === ep.title)
      if (!match) continue
      const vocabIds = sceneVocabIds.get(match.scene_title) ?? []
      if (vocabIds.length > 0) {
        await prisma.storyEpisodeVocabulary.createMany({
          data: vocabIds.map((vocabId, i) => ({ episodeId: ep.id, vocabId, sortOrder: i })),
          skipDuplicates: true,
        })
        epVocabCount += vocabIds.length
      }
    }
    console.log(`  ✓ ${epVocabCount} 个关卡↔词汇关联`)
    totalEpVocabs += epVocabCount

    console.log('')
  }

  // 追加模式：跳过 generated 示例场景（它们不属于任何数据包）
  let extra = { scenes: 0, topics: 0, episodes: 0, vocabularies: 0, chunks: 0, patterns: 0 }
  if (!packageName) {
    console.log('📁 generated/ielts-and-story-examples/')
    extra = await seedIeltsAndStoryExamples(prisma, catMap)
    totalVocab += extra.vocabularies
    totalChunks += extra.chunks
    totalTopics += extra.topics
    totalPatterns += extra.patterns
    totalEpisodes += extra.episodes
    console.log(`  ✓ ${extra.scenes} 个示例学习包（日常体系外补充：Exam + Story + Course + Foundation）`)
    console.log(`  ✓ ${extra.topics} 个示例话题`)
    console.log(`  ✓ ${extra.episodes} 个故事关卡`)
    console.log('')
  }

  // ── 汇总 ──
  console.log('📊 学习包汇总:')
  console.log(`  ${targetDirs.length + extra.scenes} 个包`)
  console.log(`  ${sceneMap.size + extra.scenes} 个场景`)
  console.log(`  ${totalVocab} 个词汇`)
  console.log(`  ${totalChunks} 个句块`)
  console.log(`  ${totalTopics} 个训练话题`)
  console.log(`  ${totalPatterns} 个句型`)
  console.log(`  ${totalEpisodes} 个剧本关卡`)
  console.log(`  ${totalEpChunks} 个关卡↔句块关联`)
  console.log(`  ${totalEpVocabs} 个关卡↔词汇关联`)

  // 字典 API 自动补全
  await enrichVocabulary(prisma)

  console.log('\n✅ 全部学习包处理完成！')
  return { sceneMap }
}
