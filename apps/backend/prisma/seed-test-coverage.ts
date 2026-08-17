/**
 * 全模式测试数据包。
 *
 * 这个脚本只会替换标题以 `[TEST] 全题型｜` 开头的数据，不会清空正常内容。
 * 覆盖：6 种内容模式、5 种学习包类型、阅读 4 题型、写作 7 文体、
 * 输出训练 4 种当前题型，以及剧情 VN / 跟读两种练习记录。
 */
import { PrismaClient } from '@prisma/client'

const TEST_PREFIX = '[TEST] 全题型｜'
const TEST_SLUG_PREFIX = 'test-all-modes-'
const FIXTURE_KEY_PREFIX = 'fixtures/test-all-modes/'

const packageDefinitions = [
  { key: 'practice', mode: 'practice', type: 'daily', title: `${TEST_PREFIX}口语输出训练`, location: '语言练习室', description: '覆盖所有输出训练题型的可重复测试包。' },
  { key: 'warmup-cafe', mode: 'practice', type: 'daily', title: `${TEST_PREFIX}知识点练习：咖啡店点单`, location: '街角咖啡店', description: '测试礼貌点单、数量表达与补充请求的知识点练习包。' },
  { key: 'warmup-hotel', mode: 'practice', type: 'foundation', title: `${TEST_PREFIX}知识点练习：酒店入住`, location: '酒店前台', description: '测试入住登记、确认预订与提出需求的知识点练习包。' },
  { key: 'warmup-travel', mode: 'practice', type: 'exam', title: `${TEST_PREFIX}知识点练习：行程变更`, location: '机场服务台', description: '测试说明变更、礼貌请求与条件句的知识点练习包。' },
  { key: 'writing', mode: 'writing', type: 'course', title: `${TEST_PREFIX}写作七文体`, location: '写作工坊', description: '每一种写作文体各有一道独立测试题。' },
  { key: 'reading', mode: 'reading', type: 'exam', title: `${TEST_PREFIX}阅读四题型`, location: '阅读中心', description: '单选、判断、简答、开放回答一次覆盖。' },
  { key: 'listening', mode: 'listening', type: 'foundation', title: `${TEST_PREFIX}听力精听`, location: '听力实验室', description: '带逐句时间戳的听力内容测试包。' },
  { key: 'story', mode: 'story', type: 'story', title: `${TEST_PREFIX}剧情包：雨天的车站`, location: '城市公交站', description: '含连续剧情关卡、VN 与跟读模式测试记录。' },
  { key: 'novel', mode: 'novel', type: 'course', title: `${TEST_PREFIX}小说包：The Last Train`, location: '阅读书架', description: 'EPUB 元数据、目录和阅读进度测试包。' },
] as const

async function clearExistingFixtures(prisma: PrismaClient) {
  const scenes = await prisma.scene.findMany({
    where: { title: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  const sceneIds = scenes.map((scene) => scene.id)
  // `seed.ts` may have already removed the scenes during a full reset while
  // leaving their package groups behind. Clean these global fixture records
  // even when no fixture scene exists, otherwise the unique group slugs would
  // make the next full seed fail.
  if (!sceneIds.length) {
    await prisma.$transaction(async (tx) => {
      await tx.packageGroup.deleteMany({ where: { slug: { startsWith: TEST_SLUG_PREFIX } } })
      await tx.fileAsset.deleteMany({ where: { cosKey: { startsWith: FIXTURE_KEY_PREFIX } } })
    })
    return
  }

  const [topics, episodes, novels] = await Promise.all([
    prisma.trainingTopic.findMany({ where: { sceneId: { in: sceneIds } }, select: { id: true } }),
    prisma.storyEpisode.findMany({ where: { sceneId: { in: sceneIds } }, select: { id: true } }),
    prisma.novelPackage.findMany({ where: { sceneId: { in: sceneIds } }, select: { id: true } }),
  ])
  const topicIds = topics.map((topic) => topic.id)
  const episodeIds = episodes.map((episode) => episode.id)
  const novelIds = novels.map((novel) => novel.id)
  const works = episodeIds.length
    ? await prisma.scriptWork.findMany({ where: { episodeId: { in: episodeIds } }, select: { id: true } })
    : []
  const workIds = works.map((work) => work.id)

  await prisma.$transaction(async (tx) => {
    if (workIds.length) {
      await tx.scriptWorkLike.deleteMany({ where: { workId: { in: workIds } } })
      await tx.scriptWorkReaction.deleteMany({ where: { workId: { in: workIds } } })
      await tx.scriptWorkReport.deleteMany({ where: { workId: { in: workIds } } })
      await tx.scriptWork.deleteMany({ where: { id: { in: workIds } } })
    }
    if (episodeIds.length) {
      await tx.scriptPracticeRecord.deleteMany({ where: { episodeId: { in: episodeIds } } })
      await tx.storyTurn.deleteMany({ where: { episodeId: { in: episodeIds } } })
      await tx.storyRecord.deleteMany({ where: { episodeId: { in: episodeIds } } })
      await tx.storyEpisodeVocabulary.deleteMany({ where: { episodeId: { in: episodeIds } } })
      await tx.storyEpisodeChunk.deleteMany({ where: { episodeId: { in: episodeIds } } })
      await tx.storyEpisodeSentencePattern.deleteMany({ where: { episodeId: { in: episodeIds } } })
      await tx.storyEpisode.deleteMany({ where: { id: { in: episodeIds } } })
    }
    if (topicIds.length) {
      await tx.practiceTurn.deleteMany({ where: { session: { topicId: { in: topicIds } } } })
      await tx.practiceSession.deleteMany({ where: { topicId: { in: topicIds } } })
      await tx.trainingTopicSubmission.deleteMany({ where: { topicId: { in: topicIds } } })
      await tx.topicSession.deleteMany({ where: { topicId: { in: topicIds } } })
      await tx.trainingTopicVocab.deleteMany({ where: { topicId: { in: topicIds } } })
      await tx.trainingTopicChunk.deleteMany({ where: { topicId: { in: topicIds } } })
      await tx.trainingTopicSentencePattern.deleteMany({ where: { topicId: { in: topicIds } } })
      await tx.trainingTopic.deleteMany({ where: { id: { in: topicIds } } })
    }
    if (novelIds.length) {
      await tx.novelReadingProgress.deleteMany({ where: { novelPackageId: { in: novelIds } } })
      await tx.novelPackage.deleteMany({ where: { id: { in: novelIds } } })
    }
    await tx.userWarmupItemProgress.deleteMany({ where: { packId: { in: sceneIds } } })
    await tx.userDailyPracticeAttempt.deleteMany({ where: { packId: { in: sceneIds } } })
    await tx.userDailyPracticeRun.deleteMany({ where: { packIds: { hasSome: sceneIds } } })
    await tx.userSceneProgress.deleteMany({ where: { sceneId: { in: sceneIds } } })
    await tx.learningPackage.deleteMany({ where: { sceneId: { in: sceneIds } } })
    await tx.scenePrerequisite.deleteMany({ where: { OR: [{ sceneId: { in: sceneIds } }, { prerequisiteId: { in: sceneIds } }] } })
    await tx.sceneMaterialReference.deleteMany({ where: { sceneId: { in: sceneIds } } })
    await tx.sceneVocabulary.deleteMany({ where: { sceneId: { in: sceneIds } } })
    await tx.sceneChunk.deleteMany({ where: { sceneId: { in: sceneIds } } })
    await tx.sceneSentencePattern.deleteMany({ where: { sceneId: { in: sceneIds } } })
    await tx.packageGroupItem.deleteMany({ where: { sceneId: { in: sceneIds } } })
    await tx.scene.deleteMany({ where: { id: { in: sceneIds } } })
    await tx.packageGroup.deleteMany({ where: { slug: { startsWith: TEST_SLUG_PREFIX } } })
    await tx.fileAsset.deleteMany({ where: { cosKey: { startsWith: FIXTURE_KEY_PREFIX } } })
  })
}

async function upsertTestAssets(prisma: PrismaClient) {
  const [audio, epub] = await Promise.all([
    prisma.fileAsset.upsert({
      where: { sha256: 'test-fixture-listening-audio-v1' },
      create: { sha256: 'test-fixture-listening-audio-v1', bucket: 'test-fixtures', region: 'local', cosKey: `${FIXTURE_KEY_PREFIX}listening-sample.mp3`, group: 'tts', size: 1, mimeType: 'audio/mpeg', filename: 'listening-sample.mp3' },
      update: {},
    }),
    prisma.fileAsset.upsert({
      where: { sha256: 'test-fixture-novel-epub-v1' },
      create: { sha256: 'test-fixture-novel-epub-v1', bucket: 'test-fixtures', region: 'local', cosKey: `${FIXTURE_KEY_PREFIX}the-last-train.epub`, group: 'epub', size: 1, mimeType: 'application/epub+zip', filename: 'the-last-train.epub' },
      update: {},
    }),
  ])
  return { audio, epub }
}

export async function seedTestCoverage(prisma: PrismaClient) {
  console.log('🧪 导入全模式测试数据…')
  await clearExistingFixtures(prisma)

  const category = await prisma.sceneCategory.findFirst({ where: { name: '[TEST] 全模式压力测试' } })
    ?? await prisma.sceneCategory.create({ data: { name: '[TEST] 全模式压力测试', icon: '🧪', sortOrder: 9999 } })
  const { audio, epub } = await upsertTestAssets(prisma)

  const vocabularies = await Promise.all([
    prisma.vocabulary.upsert({ where: { word: 'test-fixture-reschedule' }, create: { word: 'test-fixture-reschedule', meaning: '改期；重新安排', partOfSpeech: 'verb', difficulty: 'L2', examples: [{ en: 'Could we reschedule the meeting?', zh: '我们可以改期开会吗？' }] }, update: {} }),
    prisma.vocabulary.upsert({ where: { word: 'test-fixture-platform' }, create: { word: 'test-fixture-platform', meaning: '站台；平台', partOfSpeech: 'noun', difficulty: 'L2', examples: [{ en: 'The train leaves from platform three.', zh: '火车从三号站台出发。' }] }, update: {} }),
    prisma.vocabulary.upsert({ where: { word: 'test-fixture-delay' }, create: { word: 'test-fixture-delay', meaning: '延误；耽搁', partOfSpeech: 'noun', difficulty: 'L1', examples: [{ en: 'There is a fifteen-minute delay.', zh: '有十五分钟的延误。' }] }, update: {} }),
    prisma.vocabulary.upsert({ where: { word: 'test-fixture-departure' }, create: { word: 'test-fixture-departure', meaning: '出发；离站', partOfSpeech: 'noun', difficulty: 'L2', examples: [{ en: 'Please check the departure board.', zh: '请查看出发信息牌。' }] }, update: {} }),
    prisma.vocabulary.upsert({ where: { word: 'test-fixture-announcement' }, create: { word: 'test-fixture-announcement', meaning: '广播；公告', partOfSpeech: 'noun', difficulty: 'L2', examples: [{ en: 'Listen carefully to the announcement.', zh: '请仔细听广播。' }] }, update: {} }),
    prisma.vocabulary.upsert({ where: { word: 'test-fixture-confirm' }, create: { word: 'test-fixture-confirm', meaning: '确认', partOfSpeech: 'verb', difficulty: 'L2', examples: [{ en: 'Could you confirm the new time?', zh: '你能确认新的时间吗？' }] }, update: {} }),
  ])
  const chunks = await Promise.all([
    prisma.chunk.upsert({ where: { text: '[TEST] Could you say that again, please?' }, create: { text: '[TEST] Could you say that again, please?', meaning: '请你再说一遍好吗？', category: 'test', difficulty: 'L1' }, update: {} }),
    prisma.chunk.upsert({ where: { text: '[TEST] I would like to change my reservation.' }, create: { text: '[TEST] I would like to change my reservation.', meaning: '我想更改我的预订。', category: 'test', difficulty: 'L2' }, update: {} }),
    prisma.chunk.upsert({ where: { text: '[TEST] The train has been delayed by fifteen minutes.' }, create: { text: '[TEST] The train has been delayed by fifteen minutes.', meaning: '列车已经晚点十五分钟。', category: 'travel', difficulty: 'L2', examples: { create: [{ en: 'The train has been delayed by fifteen minutes.', zh: '列车已经晚点十五分钟。', sortOrder: 0 }] } }, update: {} }),
    prisma.chunk.upsert({ where: { text: '[TEST] Which platform does the train leave from?' }, create: { text: '[TEST] Which platform does the train leave from?', meaning: '这趟列车从哪个站台出发？', category: 'travel', difficulty: 'L1', examples: { create: [{ en: 'Which platform does the train leave from?', zh: '这趟列车从哪个站台出发？', sortOrder: 0 }] } }, update: {} }),
    prisma.chunk.upsert({ where: { text: '[TEST] Thank you for letting me know.' }, create: { text: '[TEST] Thank you for letting me know.', meaning: '谢谢你告知我。', category: 'social', difficulty: 'L1', examples: { create: [{ en: 'Thank you for letting me know.', zh: '谢谢你告知我。', sortOrder: 0 }] } }, update: {} }),
    prisma.chunk.upsert({ where: { text: '[TEST] Is there anything else I need to do?' }, create: { text: '[TEST] Is there anything else I need to do?', meaning: '还有什么我需要做的吗？', category: 'travel', difficulty: 'L2', examples: { create: [{ en: 'Is there anything else I need to do?', zh: '还有什么我需要做的吗？', sortOrder: 0 }] } }, update: {} }),
  ])
  const patterns = await Promise.all([
    prisma.sentencePattern.upsert({ where: { pattern: '[TEST] Could you [verb] [object]?' }, create: { pattern: '[TEST] Could you [verb] [object]?', meaning: '礼貌请求句型', difficulty: 'L1', examples: [{ en: 'Could you show me the platform?', zh: '你能告诉我站台在哪吗？' }] }, update: {} }),
    prisma.sentencePattern.upsert({ where: { pattern: '[TEST] If [condition], I will [result].' }, create: { pattern: '[TEST] If [condition], I will [result].', meaning: '条件句', difficulty: 'L2', examples: [{ en: 'If it rains, I will take a taxi.', zh: '如果下雨，我会坐出租车。' }] }, update: {} }),
    prisma.sentencePattern.upsert({ where: { pattern: '[TEST] The [transport] has been delayed by [time].' }, create: { pattern: '[TEST] The [transport] has been delayed by [time].', meaning: '说明交通延误', difficulty: 'L2', examples: [{ en: 'The train has been delayed by fifteen minutes.', zh: '列车已经晚点十五分钟。' }] }, update: {} }),
    prisma.sentencePattern.upsert({ where: { pattern: '[TEST] I need to [action] because [reason].' }, create: { pattern: '[TEST] I need to [action] because [reason].', meaning: '说明需求与原因', difficulty: 'L2', examples: [{ en: 'I need to call the hotel because my train is late.', zh: '我需要联系酒店，因为火车晚点了。' }] }, update: {} }),
    prisma.sentencePattern.upsert({ where: { pattern: '[TEST] Would it be possible to [action]?' }, create: { pattern: '[TEST] Would it be possible to [action]?', meaning: '更正式地提出请求', difficulty: 'L3', examples: [{ en: 'Would it be possible to change my check-in time?', zh: '可以更改我的入住时间吗？' }] }, update: {} }),
  ])

  const scenes = new Map<string, { id: string; title: string }>()
  for (const [index, definition] of packageDefinitions.entries()) {
    const group = await prisma.packageGroup.create({
      data: { slug: `${TEST_SLUG_PREFIX}${definition.key}`, name: definition.title, description: `${definition.description}（可安全重复执行 seed）`, contentMode: definition.mode, status: 'published' },
    })
    const scene = await prisma.scene.create({
      data: { categoryId: category.id, packageType: definition.type, contentMode: definition.mode, title: definition.title, location: definition.location, description: definition.description, requiredOutputLevel: 'L2', requiredUserLevel: 1, isFree: true, groupId: group.id, sortOrder: index },
    })
    await prisma.packageGroupItem.create({ data: { groupId: group.id, sceneId: scene.id, sortOrder: 0, volumeLabel: '测试卷 01' } })
    await prisma.learningPackage.create({
      data: { sceneId: scene.id, version: 1, title: `${definition.title} v1`, type: definition.type, status: 'draft', manifestSnapshot: { fixture: true, contentMode: definition.mode, note: '测试数据包；需要真实文件时请通过后台上传并生成 ZIP。' }, buildLog: 'Test fixture seed — draft package.' },
    })
    await prisma.sceneVocabulary.createMany({ data: vocabularies.map((vocabulary, sortOrder) => ({ sceneId: scene.id, vocabularyId: vocabulary.id, sortOrder })) })
    await prisma.sceneChunk.createMany({ data: chunks.map((chunk, sortOrder) => ({ sceneId: scene.id, chunkId: chunk.id, sortOrder })) })
    await prisma.sceneSentencePattern.createMany({ data: patterns.map((pattern, sortOrder) => ({ sceneId: scene.id, patternId: pattern.id, sortOrder })) })
    await prisma.sceneMaterialReference.createMany({ data: [
      ...vocabularies.map((vocabulary) => ({ sceneId: scene.id, materialType: 'vocab' as const, materialId: vocabulary.id })),
      ...chunks.map((chunk) => ({ sceneId: scene.id, materialType: 'chunk' as const, materialId: chunk.id })),
      ...patterns.map((pattern) => ({ sceneId: scene.id, materialType: 'pattern' as const, materialId: pattern.id })),
    ] })
    scenes.set(definition.key, scene)
  }

  const attachTopicCorpus = async (topicId: string) => {
    await prisma.trainingTopicVocab.createMany({ data: vocabularies.map((vocab, sortOrder) => ({ topicId, vocabId: vocab.id, sortOrder })) })
    await prisma.trainingTopicChunk.createMany({ data: chunks.map((chunk, sortOrder) => ({ topicId, chunkId: chunk.id, sortOrder })) })
    await prisma.trainingTopicSentencePattern.createMany({ data: patterns.map((pattern, sortOrder) => ({ topicId, patternId: pattern.id, sortOrder })) })
  }

  const practiceScene = scenes.get('practice')!
  const practiceTopic = await prisma.trainingTopic.create({
    data: {
      sceneId: practiceScene.id, type: 'daily', activityType: 'practice', title: '[TEST] 输出训练：全部题型', description: '句块替换、一词多句、句子拆解、句型操练与兼容旧题型。', knowledgePoints: '礼貌请求；改期与确认；条件句；需求与原因；正式请求', teachingMarkdown: '## 输出训练：车站行程变更\n\n这组练习把一个真实的出行情境拆成可复用的表达。先用 **Could you …?** 发出礼貌请求，再用 **I need to … because …** 说明自己的需求与原因。\n\n### 关键句型\n\n- **Could you [verb] [object]?**：礼貌地请对方协助。\n- **If [condition], I will [result].**：说明条件与下一步安排。\n- **I need to [action] because [reason].**：解释你为什么需要做某事。\n- **Would it be possible to [action]?**：更正式、委婉地提出请求。\n\n### 使用建议\n\n先完成中译英替换，确认核心句块；再练一词多句与句型操练；最后通过句子拆解，把短句自然组合成完整表达。', promptEn: 'Practice every available output drill type.', promptZh: '依次完成全部输出训练题型。', suggestedDurationSec: 600, difficulty: 'L2', sortOrder: 0,
      metadata: { outputTraining: { version: 1, enabled: true, pipeline: [
        { id: 'test-chunk-zh-en', type: 'chunk_substitution', title: '句块替换（中译英）', chunk: chunks[0].text, chunkMeaning: chunks[0].meaning, direction: 'zh_to_en', kind: 'chunk', items: [{ zh: '请你再说一遍好吗？', answer: 'Could you say that again, please?', hint: '使用礼貌请求。' }] },
        { id: 'test-chunk-en-zh', type: 'chunk_substitution', title: '句块替换（英译中）', chunk: chunks[1].text, chunkMeaning: chunks[1].meaning, direction: 'en_to_zh', kind: 'chunk', items: [{ zh: '我想更改我的预订。', answer: 'I would like to change my reservation.', hint: '理解 change my reservation。' }] },
        { id: 'test-vocab-building', type: 'vocab_sentence_building', title: '一词多句', vocabWord: 'reschedule', vocabMeaning: '改期', direction: 'zh_to_en', patterns: [{ chunk: 'Could we [verb] the meeting?', items: [{ zh: '我们可以把会议改期吗？', answer: 'Could we reschedule the meeting?', hint: '使用 reschedule。' }] }] },
        { id: 'test-decomposition', type: 'sentence_decomposition', title: '句子拆解', fullSentence: 'If the train is late, I will call the hotel and reschedule my reservation.', fullSentenceZh: '如果火车晚点，我会给酒店打电话并更改预订。', levels: [{ level: 1, label: '核心', en: 'The train is late.', zh: '火车晚点。' }, { level: 2, label: '条件', en: 'If the train is late, I will call the hotel.', zh: '如果火车晚点，我会给酒店打电话。' }, { level: 3, label: '完整', en: 'If the train is late, I will call the hotel and reschedule my reservation.', zh: '如果火车晚点，我会给酒店打电话并更改预订。' }] },
        { id: 'test-pattern', type: 'pattern_drill', title: '句型操练', pattern: 'If [condition], I will [result].', patternMeaning: '条件句', direction: 'zh_to_en', items: [{ zh: '如果下雨，我会坐出租车。', answer: 'If it rains, I will take a taxi.', hint: '条件从句用一般现在时。' }] },
        { id: 'test-vocab-legacy', type: 'vocab_drill', title: '词汇操练（兼容）', direction: 'zh_to_en', vocabs: [{ vocabId: vocabularies[0].id, promptZh: '用 reschedule 说明改期会议。', targetWords: ['reschedule'], suggestedAnswer: 'Could we reschedule the meeting?' }] },
        { id: 'test-vn-legacy', type: 'vn_dialogue', title: 'VN 对话（兼容）', structuredObjectives: [{ id: 'request-help', title: '礼貌请求帮助', requiredIntent: 'ask_for_help', essentialSlots: ['polite_request'], targetChunks: [chunks[0].text] }] },
      ] } },
    },
  })
  await attachTopicCorpus(practiceTopic.id)

  const knowledgePointFixtures = [
    {
      sceneKey: 'warmup-cafe',
      title: '[TEST] 知识点：礼貌点单',
      description: '在咖啡店用 Can I have、I’d like 和 anything else 完成一轮点单。',
      knowledgePoints: 'Can I have…?；I’d like…；Anything else?；数量 + 单位',
      teachingMarkdown: '## 礼貌点单\n\n用 **Can I have …?** 或 **I’d like …** 点单；说明数量时把数字放在饮品或食物前。需要补充时可说 **Anything else?**。',
      promptEn: 'Order a drink and a snack politely at a café.',
      promptZh: '在咖啡店礼貌地点一杯饮料和一份点心。',
      pipeline: [
        { id: 'cafe-order', type: 'chunk_substitution', title: '中译英：礼貌点单', chunk: 'Can I have [item], please?', chunkMeaning: '我可以要……吗？', direction: 'zh_to_en', kind: 'chunk', items: [{ zh: '我可以要一杯拿铁吗？', answer: 'Can I have a latte, please?', hint: '用 Can I have 开头。' }, { zh: '我可以要两块饼干吗？', answer: 'Can I have two cookies, please?', hint: '数量放在名词前。' }] },
        { id: 'cafe-preference', type: 'pattern_drill', title: '句型操练：表达偏好', pattern: 'I’d like [item], please.', patternMeaning: '我想要……，谢谢。', direction: 'zh_to_en', items: [{ zh: '我想要一杯冰美式，谢谢。', answer: 'I’d like an iced Americano, please.', hint: 'I’d like 后直接接物品。' }] },
        { id: 'cafe-follow-up', type: 'sentence_decomposition', title: '句子拆解：补充点单', fullSentence: 'I’d like a latte, and can I have a cookie as well?', fullSentenceZh: '我想要一杯拿铁，还可以要一块饼干吗？', levels: [{ level: 1, label: '核心', en: 'I’d like a latte.', zh: '我想要一杯拿铁。' }, { level: 2, label: '补充', en: 'Can I have a cookie as well?', zh: '我还可以要一块饼干吗？' }, { level: 3, label: '完整', en: 'I’d like a latte, and can I have a cookie as well?', zh: '我想要一杯拿铁，还可以要一块饼干吗？' }] },
      ],
    },
    {
      sceneKey: 'warmup-hotel',
      title: '[TEST] 知识点：酒店入住',
      description: '在酒店前台说明预订信息，并礼貌地提出入住需求。',
      knowledgePoints: 'I have a reservation；under + 姓名；Could I…?；check in',
      teachingMarkdown: '## 酒店入住\n\n报到时说 **I have a reservation under [name]**。提出请求可用 **Could I …?**，例如提前入住或确认早餐时间。',
      promptEn: 'Check in at a hotel and confirm your reservation.',
      promptZh: '在酒店办理入住并确认你的预订。',
      pipeline: [
        { id: 'hotel-reservation', type: 'chunk_substitution', title: '中译英：确认预订', chunk: 'I have a reservation under [name].', chunkMeaning: '我以……的名字预订了房间。', direction: 'zh_to_en', kind: 'chunk', items: [{ zh: '我以王女士的名字预订了房间。', answer: 'I have a reservation under Ms. Wang.', hint: '用 under 表示预订登记的姓名。' }] },
        { id: 'hotel-request', type: 'pattern_drill', title: '句型操练：提出入住需求', pattern: 'Could I [request]?', patternMeaning: '我可以……吗？', direction: 'zh_to_en', items: [{ zh: '我可以早点办理入住吗？', answer: 'Could I check in early?', hint: 'check in 表示办理入住。' }, { zh: '我可以确认早餐时间吗？', answer: 'Could I confirm the breakfast time?', hint: 'confirm 表示确认。' }] },
        { id: 'hotel-vocab', type: 'vocab_sentence_building', title: '一词多句：reservation', vocabWord: 'reservation', vocabMeaning: '预订', direction: 'zh_to_en', patterns: [{ chunk: 'I have a [word] under [name].', items: [{ zh: '我以李先生的名字有一份预订。', answer: 'I have a reservation under Mr. Li.', hint: '替换 word。' }] }] },
      ],
    },
    {
      sceneKey: 'warmup-travel',
      title: '[TEST] 知识点：行程变更',
      description: '说明航班或列车变更，并用正式表达请求协助。',
      knowledgePoints: 'has been delayed；Would it be possible to…?；If …, I will …；reschedule',
      teachingMarkdown: '## 行程变更\n\n说明状态用 **has been delayed**；正式请求用 **Would it be possible to …?**。当结果取决于条件时，用 **If …, I will …**。',
      promptEn: 'Explain a travel delay and ask to change your booking.',
      promptZh: '说明行程延误，并请求变更你的预订。',
      pipeline: [
        { id: 'travel-delay', type: 'chunk_substitution', title: '中译英：说明延误', chunk: 'My flight has been delayed.', chunkMeaning: '我的航班延误了。', direction: 'zh_to_en', kind: 'chunk', items: [{ zh: '我的火车已经晚点了。', answer: 'My train has been delayed.', hint: '用 has been delayed。' }] },
        { id: 'travel-formal-request', type: 'pattern_drill', title: '句型操练：正式请求', pattern: 'Would it be possible to [action]?', patternMeaning: '是否可以……？', direction: 'zh_to_en', items: [{ zh: '是否可以更改我的预订？', answer: 'Would it be possible to change my reservation?', hint: '用正式请求开头。' }] },
        { id: 'travel-condition', type: 'sentence_decomposition', title: '句子拆解：延误后的安排', fullSentence: 'If the flight is delayed, I will reschedule my hotel booking.', fullSentenceZh: '如果航班延误，我会重新安排酒店预订。', levels: [{ level: 1, label: '状态', en: 'The flight is delayed.', zh: '航班延误。' }, { level: 2, label: '计划', en: 'I will reschedule my hotel booking.', zh: '我会重新安排酒店预订。' }, { level: 3, label: '完整', en: 'If the flight is delayed, I will reschedule my hotel booking.', zh: '如果航班延误，我会重新安排酒店预订。' }] },
      ],
    },
  ] as const

  for (const [sortOrder, fixture] of knowledgePointFixtures.entries()) {
    const scene = scenes.get(fixture.sceneKey)!
    const topic = await prisma.trainingTopic.create({
      data: {
        sceneId: scene.id,
        type: 'daily',
        activityType: 'practice',
        title: fixture.title,
        description: fixture.description,
        knowledgePoints: fixture.knowledgePoints,
        teachingMarkdown: fixture.teachingMarkdown,
        promptEn: fixture.promptEn,
        promptZh: fixture.promptZh,
        suggestedDurationSec: 360,
        difficulty: sortOrder === 0 ? 'L1' : 'L2',
        sortOrder: 0,
        metadata: { outputTraining: { version: 1, enabled: true, pipeline: fixture.pipeline } },
      },
    })
    await attachTopicCorpus(topic.id)
  }

  const writingScene = scenes.get('writing')!
  const writingGenres = ['journal', 'message', 'email', 'paragraph', 'essay', 'dialogue', 'translation'] as const
  for (const [sortOrder, genre] of writingGenres.entries()) {
    const isDialogue = genre === 'dialogue'
    const isTranslation = genre === 'translation'
    const writing = isDialogue
      ? { genre, situation: '你在车站向朋友说明列车晚点。', minWords: 40, maxWords: 120, turns: [{ aText: 'Are you already at the station?', hint: '说明你已到站但列车晚点。' }, { aText: 'What will you do now?', hint: '说明你会联系酒店并改期。' }] }
      : isTranslation
        ? { genre, direction: 'zh_to_en', scope: 'article', sourceTitle: '雨天赶火车', sourceText: '火车晚点了。\n\n我需要联系酒店。', segments: [{ id: 's1', source: '火车晚点了。', reference: 'The train is late.', hint: 'late 作表语。' }, { id: 's2', source: '我需要联系酒店并更改预订。', reference: 'I need to call the hotel and change my reservation.', hint: '注意并列动词。' }], minWords: 0, maxWords: 300 }
        : { genre, questionMarkdown: `## ${genre} 写作测试\n\n你因火车晚点无法按原计划抵达。请写一篇 **80–180 词** 的 ${genre}，向相关人员说明情况并提出下一步安排。`, minWords: 80, maxWords: 180, candidateRole: '因列车晚点受影响的旅客', audience: '酒店或同行朋友', purpose: '清晰说明延误并安排后续', requirements: ['说明列车晚点', '交代预计安排', '提出明确请求或下一步'], rubric: ['任务完成', '结构清晰', '语言准确', '语气得体'] }
    const topic = await prisma.trainingTopic.create({ data: { sceneId: writingScene.id, type: 'daily', activityType: 'writing', title: `[TEST] 写作：${genre}`, description: `写作 ${genre} 文体测试。`, promptEn: `Complete the ${genre} writing task.`, promptZh: `完成 ${genre} 写作任务。`, suggestedDurationSec: isTranslation ? 900 : 1200, difficulty: 'L2', contentConfig: { writing }, sortOrder } })
    await attachTopicCorpus(topic.id)
  }

  const readingScene = scenes.get('reading')!
  const readingTopic = await prisma.trainingTopic.create({ data: { sceneId: readingScene.id, type: 'daily', activityType: 'reading', title: '[TEST] 阅读：四种理解题', description: '同一篇材料覆盖所有阅读题型。', promptEn: 'Read the passage and answer every question.', promptZh: '阅读材料并完成全部题型。', suggestedDurationSec: 900, difficulty: 'L2', sortOrder: 0, contentConfig: { reading: { wordCount: 126, questionMarkdown: '## A Rainy Delay\n\n> Maya arrived at the station twenty minutes early, but a storm delayed her train. Instead of waiting silently, she called her hotel and asked to move her check-in time. The receptionist thanked her for calling and kept her room for the evening. Maya then bought a coffee, checked the platform display, and sent her friend a message. By the time the train arrived, she had a clear plan and felt much calmer.', questions: [{ type: 'choice', prompt: 'Why did Maya call the hotel?', options: ['To cancel her room', 'To change her check-in time', 'To order food', 'To ask for directions'], answer: 'To change her check-in time', evidence: 'she called her hotel and asked to move her check-in time' }, { type: 'boolean', prompt: 'Maya arrived late at the station.', answer: '错误', evidence: 'arrived at the station twenty minutes early' }, { type: 'short', prompt: 'What did Maya do after speaking with the receptionist?', answer: 'She bought a coffee, checked the platform display, and sent her friend a message.', acceptedAnswers: ['She bought coffee, checked the display, and messaged her friend.'], evidence: 'Maya then bought a coffee, checked the platform display, and sent her friend a message.' }, { type: 'open', prompt: 'What can learners copy from Maya when travel plans change? Explain with evidence.', answer: 'She stayed proactive: she contacted the hotel, checked information, and told her friend instead of waiting passively.', evidence: 'called her hotel; checked the platform display; sent her friend a message' }] } } } })
  await attachTopicCorpus(readingTopic.id)

  const listeningScene = scenes.get('listening')!
  const listeningTopic = await prisma.trainingTopic.create({ data: { sceneId: listeningScene.id, type: 'daily', activityType: 'listening', title: '[TEST] 听力：车站广播', description: '带文本、音频资产占位和逐句时间戳。', promptEn: 'Listen to the station announcement.', promptZh: '听车站广播并跟读。', suggestedDurationSec: 90, difficulty: 'L2', sortOrder: 0, mediaAssetId: audio.id, contentConfig: { listening: { defaultRate: 1, pauseMs: 400, articleText: 'Attention please. The train to Brighton is delayed by fifteen minutes. Passengers should wait near platform three.' } }, transcript: [{ text: 'Attention please.', translation: '请注意。', startMs: 0, endMs: 1200, words: [{ token: 'Attention', startMs: 0, endMs: 700 }, { token: 'please', startMs: 720, endMs: 1200 }] }, { text: 'The train to Brighton is delayed by fifteen minutes.', translation: '前往布莱顿的列车将晚点十五分钟。', startMs: 1400, endMs: 4800, words: [] }, { text: 'Passengers should wait near platform three.', translation: '乘客请在三号站台附近等候。', startMs: 5000, endMs: 7600, words: [] }] } })
  await attachTopicCorpus(listeningTopic.id)

  const storyScene = scenes.get('story')!
  const ink = await prisma.inkScript.upsert({ where: { key: 'test-rainy-station-story' }, create: { key: 'test-rainy-station-story', title: '[TEST] 雨天车站剧情', scriptType: 'story', inkSource: '=== start ===\nA rainy station test fixture.\n', inkJson: {} }, update: { title: '[TEST] 雨天车站剧情' } })
  const storyEpisodes = await Promise.all([
    prisma.storyEpisode.create({ data: { sceneId: storyScene.id, chapterKey: 'rainy_station', chapterName: 'Rainy Station', sortOrder: 1, title: '[TEST] 剧情 1：发现晚点', description: '确认列车晚点并阅读站台信息。', requiredOutputLevel: 'L2', requiredUserLevel: 1, requiredVocabularyCount: 1, totalVocabularyCount: 2, requiredChunkCount: 1, totalChunkCount: 2, objectives: ['确认列车状态', '询问站台位置'], requiredObjectiveCount: 2, requiredUsedChunkCount: 1, minimumTurnCount: 2, rewards: { xp: 10 }, characterName: 'Alex', characterRole: '站务员', characterPersona: '冷静、乐于帮忙。', inkScriptId: ink.id, isPreview: true } }),
    prisma.storyEpisode.create({ data: { sceneId: storyScene.id, chapterKey: 'rainy_station', chapterName: 'Rainy Station', sortOrder: 2, title: '[TEST] 剧情 2：联系酒店', description: '向酒店解释延误并更改入住时间。', requiredOutputLevel: 'L2', requiredUserLevel: 1, requiredVocabularyCount: 1, totalVocabularyCount: 2, requiredChunkCount: 2, totalChunkCount: 2, objectives: ['说明晚点', '请求更改入住时间'], requiredObjectiveCount: 2, requiredUsedChunkCount: 2, minimumTurnCount: 3, rewards: { xp: 20 }, characterName: 'Lena', characterRole: '酒店前台', characterPersona: '专业、耐心。', inkScriptId: ink.id } }),
  ])
  for (const episode of storyEpisodes) {
    await prisma.storyEpisodeVocabulary.createMany({ data: vocabularies.map((vocab, sortOrder) => ({ episodeId: episode.id, vocabId: vocab.id, sortOrder })) })
    await prisma.storyEpisodeChunk.createMany({ data: chunks.map((chunk, sortOrder) => ({ episodeId: episode.id, chunkId: chunk.id, sortOrder })) })
    await prisma.storyEpisodeSentencePattern.createMany({ data: patterns.map((pattern, sortOrder) => ({ episodeId: episode.id, patternId: pattern.id, sortOrder })) })
  }

  const novelScene = scenes.get('novel')!
  const novel = await prisma.novelPackage.create({ data: { sceneId: novelScene.id, epubAssetId: epub.id, metadata: { title: 'The Last Train', author: 'Test Fixture', language: 'en', fixtureAsset: true }, toc: [{ id: 'chapter-1', label: 'Chapter 1: The Delay', href: 'chapter-1.xhtml' }, { id: 'chapter-2', label: 'Chapter 2: A New Plan', href: 'chapter-2.xhtml' }] } })

  const testUser = await prisma.user.findUnique({ where: { email: 'user@engjourney.local' }, select: { id: true } })
  if (testUser) {
    await prisma.storyRecord.create({ data: { userId: testUser.id, episodeId: storyEpisodes[0].id, passed: true, completedObjectiveCount: 2, usedChunkCount: 2, turnCount: 3, retellCompleted: true, xpEarned: 10, completedAt: new Date() } })
    await prisma.scriptPracticeRecord.createMany({ data: [{ userId: testUser.id, episodeId: storyEpisodes[0].id, mode: 'vn', status: 'completed', durationSec: 95, turnCount: 3, lineCount: 5, usedChunkCount: 2, completedObjectiveCount: 2, score: 91, completedAt: new Date() }, { userId: testUser.id, episodeId: storyEpisodes[1].id, mode: 'repeat', status: 'completed', durationSec: 76, turnCount: 0, lineCount: 6, usedChunkCount: 2, completedObjectiveCount: 2, score: 88, completedAt: new Date() }] })
    await prisma.novelReadingProgress.create({ data: { userId: testUser.id, novelPackageId: novel.id, locator: { href: 'chapter-1.xhtml', progression: 0.42 }, percentage: 0.42 } })
  }

  console.log(`  ✓ ${packageDefinitions.length} 个学习包（6 内容模式 / 5 包类型）`)
  console.log(`  ✓ ${knowledgePointFixtures.length} 个知识点练习测试包（每包 3 组可执行练习）`)
  console.log('  ✓ 阅读 4 题型、写作 7 文体、输出训练题型、剧情 VN / 跟读记录')
  console.log('  ⚠️ 听力与 EPUB 使用占位资产；若要真实播放/阅读，请在后台上传真实音频和 EPUB 后替换。')
}

if (require.main === module) {
  const prisma = new PrismaClient()
  seedTestCoverage(prisma)
    .then(() => console.log('✅ 全模式测试数据已完成'))
    .catch((error) => { console.error(error); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
}
