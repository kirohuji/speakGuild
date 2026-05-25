import { PrismaClient, AchievementCategory, AchievementRarity } from '@prisma/client'

/**
 * 英语输出训练 — 种子数据
 *
 * MVP 内容规模：
 * - 5 个场景分类
 * - 8 个场景 + 80 词汇
 * - 60+ 个 Chunk
 * - 15 个训练话题
 * - Chapter 0: 3 个体验关卡
 * - 3 个 NPC
 * - 1 个探索地图 + 3 个地点
 * - 15 个成就定义
 */
export async function seedEnglishOutput(prisma: PrismaClient) {
  console.log('🌍 开始创建英语输出训练种子数据...\n')

  // ═══ 1. 场景分类 ═══
  const categories = await Promise.all([
    prisma.sceneCategory.create({ data: { name: '留学生活', icon: 'GraduationCap', sortOrder: 1 } }),
    prisma.sceneCategory.create({ data: { name: '日常社交', icon: 'Coffee', sortOrder: 2 } }),
    prisma.sceneCategory.create({ data: { name: '旅行英语', icon: 'Plane', sortOrder: 3 } }),
    prisma.sceneCategory.create({ data: { name: '职场交流', icon: 'Briefcase', sortOrder: 4 } }),
    prisma.sceneCategory.create({ data: { name: '学术挑战', icon: 'BookOpen', sortOrder: 5 } }),
  ])
  const [catStudy, catSocial, catTravel, catWork, catAcademic] = categories
  console.log(`  ✓ 5 个场景分类`)

  // ═══ 2. 场景 + 词汇 ═══
  const sceneDefs = [
    { catId: catStudy.id, title: '宿舍入住', location: '宿舍前台', level: 'L2' },
    { catId: catStudy.id, title: '机场入境', location: '机场入境大厅', level: 'L2' },
    { catId: catStudy.id, title: '认识室友', location: '宿舍房间', level: 'L2' },
    { catId: catSocial.id, title: '咖啡店点餐', location: '校园咖啡店', level: 'L1' },
    { catId: catSocial.id, title: '超市购物', location: '超市', level: 'L1' },
    { catId: catTravel.id, title: '打车出行', location: '机场出租车站', level: 'L1' },
    { catId: catWork.id, title: '面试自我介绍', location: '面试室', level: 'L3' },
    { catId: catAcademic.id, title: '小组讨论', location: '教室', level: 'L3' },
  ]

  const scenes: Record<string, string> = {}
  for (const s of sceneDefs) {
    const scene = await prisma.scene.create({
      data: { categoryId: s.catId, title: s.title, location: s.location, requiredOutputLevel: s.level, requiredUserLevel: 1 },
    })
    scenes[s.title] = scene.id
  }
  console.log(`  ✓ ${sceneDefs.length} 个场景`)

  // 场景词汇
  const vocabData: Record<string, string[]> = {
    '宿舍入住': ['dormitory,宿舍', 'reception,前台', 'check in,办理入住', 'booking,预订', 'room key,房间钥匙', 'student ID,学生证', 'Wi-Fi,无线网', 'laundry room,洗衣房', 'shared kitchen,共享厨房', 'elevator,电梯'],
    '机场入境': ['passport,护照', 'visa,签证', 'customs,海关', 'declare,申报', 'luggage,行李', 'boarding pass,登机牌', 'immigration,入境', 'arrival hall,到达大厅', 'study abroad,留学', 'purpose of visit,来访目的'],
    '认识室友': ['introduce,介绍', 'hometown,家乡', 'major,专业', 'get used to,适应', 'hang out,出去玩', 'schedule,日程', 'dorm mate,室友', 'semester,学期', 'campus,校园', 'freshman,大一新生'],
    '咖啡店点餐': ['latte,拿铁', 'cappuccino,卡布奇诺', 'espresso,浓缩咖啡', 'take away,打包', 'for here,堂食', 'menu,菜单', 'order,点餐', 'receipt,收据', 'tip,小费', 'straw,吸管'],
    '超市购物': ['shopping cart,购物车', 'checkout,结账', 'discount,折扣', 'receipt,收据', 'aisle,过道', 'produce,农产品', 'dairy,乳制品', 'frozen food,冷冻食品', 'plastic bag,塑料袋', 'price tag,价签'],
    '打车出行': ['taxi,出租车', 'destination,目的地', 'address,地址', 'meter,计价器', 'fare,车费', 'trunk,后备箱', 'seatbelt,安全带', 'intersection,十字路口', 'drop off,下车', 'pick up,接人'],
    '面试自我介绍': ['background,背景', 'experience,经验', 'strength,优势', 'qualification,资质', 'achievement,成就', 'career goal,职业目标', 'team player,团队合作者', 'problem-solving,解决问题', 'internship,实习', 'reference,推荐人'],
    '小组讨论': ['presentation,展示', 'argument,论点', 'evidence,证据', 'agree,同意', 'disagree,不同意', 'perspective,观点', 'compromise,妥协', 'brainstorm,头脑风暴', 'conclusion,结论', 'deadline,截止日期'],
  }

  for (const [sceneTitle, words] of Object.entries(vocabData)) {
    const sceneId = scenes[sceneTitle]
    if (!sceneId) continue
    for (let i = 0; i < words.length; i++) {
      const [word, meaning] = words[i].split(',')
      await prisma.sceneVocabulary.create({ data: { sceneId, word, meaning, sortOrder: i } })
    }
  }
  console.log(`  ✓ 80 个场景词汇`)

  // ═══ 3. Chunk 表达块 ═══
  const chunkData: { text: string; meaning: string; category: string; sceneTitle: string; difficulty: string; examples?: { en: string; zh: string; note?: string; level?: string }[] }[] = [
    // 宿舍入住
    { text: "I'm here to check in.", meaning: '我是来办理入住的。', category: '宿舍入住', sceneTitle: '宿舍入住', difficulty: 'L2', examples: [{ en: "Hi, I'm here to check in. My booking is under the name Li.", zh: '你好，我是来办理入住的。我的预订姓名是李。', level: 'basic' }] },
    { text: 'My booking is under the name...', meaning: '我的预订名字是...', category: '宿舍入住', sceneTitle: '宿舍入住', difficulty: 'L2' },
    { text: 'Here is my student ID.', meaning: '这是我的学生证。', category: '宿舍入住', sceneTitle: '宿舍入住', difficulty: 'L2' },
    { text: 'Could you tell me where my room is?', meaning: '能告诉我房间在哪吗？', category: '宿舍入住', sceneTitle: '宿舍入住', difficulty: 'L2' },
    { text: 'Is there Wi-Fi in the building?', meaning: '楼里有 Wi-Fi 吗？', category: '宿舍入住', sceneTitle: '宿舍入住', difficulty: 'L2' },
    { text: 'Where is the laundry room?', meaning: '洗衣房在哪？', category: '宿舍入住', sceneTitle: '宿舍入住', difficulty: 'L2' },
    { text: 'Thank you for your help.', meaning: '谢谢你的帮助。', category: '宿舍入住', sceneTitle: '宿舍入住', difficulty: 'L1' },
    // 机场入境
    { text: "I'm here to study.", meaning: '我是来读书的。', category: '机场入境', sceneTitle: '机场入境', difficulty: 'L2', examples: [{ en: "I'm here to study at the University of Manchester.", zh: '我是来曼彻斯特大学读书的。', level: 'basic' }] },
    { text: 'I will be staying for...', meaning: '我会待...', category: '机场入境', sceneTitle: '机场入境', difficulty: 'L2' },
    { text: 'My luggage is...', meaning: '我的行李是...', category: '机场入境', sceneTitle: '机场入境', difficulty: 'L1' },
    { text: 'I have nothing to declare.', meaning: '我没有需要申报的。', category: '机场入境', sceneTitle: '机场入境', difficulty: 'L2' },
    // 认识室友
    { text: "I'm from...", meaning: '我来自...', category: '认识室友', sceneTitle: '认识室友', difficulty: 'L1', examples: [{ en: "I'm from Shanghai. It's a big city in China.", zh: '我来自上海，那是中国的一座大城市。', level: 'basic' }] },
    { text: "My major is...", meaning: '我的专业是...', category: '认识室友', sceneTitle: '认识室友', difficulty: 'L1' },
    { text: "I'm still getting used to everything.", meaning: '我还在适应一切。', category: '认识室友', sceneTitle: '认识室友', difficulty: 'L2' },
    { text: 'Would you like to grab a coffee sometime?', meaning: '改天一起喝杯咖啡？', category: '认识室友', sceneTitle: '认识室友', difficulty: 'L2' },
    { text: "It's nice to meet you.", meaning: '很高兴认识你。', category: '认识室友', sceneTitle: '认识室友', difficulty: 'L1' },
    // 咖啡店
    { text: "I'd like a..., please.", meaning: '我想要一杯...', category: '咖啡店', sceneTitle: '咖啡店点餐', difficulty: 'L1', examples: [{ en: "I'd like a latte, please.", zh: '我想要一杯拿铁，谢谢。', level: 'basic' }] },
    { text: 'For here or to go?', meaning: '堂食还是打包？', category: '咖啡店', sceneTitle: '咖啡店点餐', difficulty: 'L1' },
    { text: 'Can I get the bill, please?', meaning: '能给我账单吗？', category: '咖啡店', sceneTitle: '咖啡店点餐', difficulty: 'L1' },
    { text: 'Do you have any dairy-free options?', meaning: '有非乳制品的选项吗？', category: '咖啡店', sceneTitle: '咖啡店点餐', difficulty: 'L2' },
    { text: 'How much is it?', meaning: '多少钱？', category: '咖啡店', sceneTitle: '咖啡店点餐', difficulty: 'L1' },
    // 超市
    { text: 'Where can I find...?', meaning: '我在哪能找到...？', category: '超市', sceneTitle: '超市购物', difficulty: 'L1', examples: [{ en: 'Where can I find the milk?', zh: '我在哪能找到牛奶？', level: 'basic' }] },
    { text: 'Do you have this in a different size?', meaning: '这个有其他尺寸吗？', category: '超市', sceneTitle: '超市购物', difficulty: 'L2' },
    { text: "I'm looking for...", meaning: '我在找...', category: '超市', sceneTitle: '超市购物', difficulty: 'L1' },
    { text: 'Is this on sale?', meaning: '这个在打折吗？', category: '超市', sceneTitle: '超市购物', difficulty: 'L1' },
    // 打车
    { text: "Could you take me to..., please?", meaning: '能带我去...吗？', category: '打车', sceneTitle: '打车出行', difficulty: 'L1' },
    { text: 'How much will it cost?', meaning: '大概多少钱？', category: '打车', sceneTitle: '打车出行', difficulty: 'L1' },
    { text: 'How long does it take to get there?', meaning: '到那要多久？', category: '打车', sceneTitle: '打车出行', difficulty: 'L1' },
    // 面试
    { text: "I have experience in...", meaning: '我在...方面有经验。', category: '面试', sceneTitle: '面试自我介绍', difficulty: 'L3' },
    { text: "One of my strengths is...", meaning: '我的一个优势是...', category: '面试', sceneTitle: '面试自我介绍', difficulty: 'L3' },
    { text: "I'm looking for a position where I can...", meaning: '我在找一个能让我...的职位。', category: '面试', sceneTitle: '面试自我介绍', difficulty: 'L3' },
    // 小组讨论
    { text: "I see your point, but...", meaning: '我理解你的观点，但是...', category: '小组讨论', sceneTitle: '小组讨论', difficulty: 'L3' },
    { text: "What do you think about...?", meaning: '你觉得...怎么样？', category: '小组讨论', sceneTitle: '小组讨论', difficulty: 'L2' },
    { text: "I agree with... to some extent.", meaning: '我在某种程度上同意...', category: '小组讨论', sceneTitle: '小组讨论', difficulty: 'L3' },
    { text: "Let's look at this from a different angle.", meaning: '我们换个角度看。', category: '小组讨论', sceneTitle: '小组讨论', difficulty: 'L3' },
    // 通用日常
    { text: "I'm not sure how to say this, but...", meaning: '我不确定怎么说，但是...', category: '日常表达', sceneTitle: '认识室友', difficulty: 'L1' },
    { text: 'Could you repeat that, please?', meaning: '能重复一遍吗？', category: '日常表达', sceneTitle: '宿舍入住', difficulty: 'L1' },
    { text: "I was wondering if...", meaning: '我在想是否...', category: '日常表达', sceneTitle: '咖啡店点餐', difficulty: 'L2', examples: [{ en: 'I was wondering if you could help me.', zh: '我想问问你是否可以帮我一下。', level: 'intermediate' }] },
    { text: "I'm afraid I...", meaning: '恐怕我...', category: '日常表达', sceneTitle: '小组讨论', difficulty: 'L2' },
    { text: "It depends on...", meaning: '这取决于...', category: '日常表达', sceneTitle: '小组讨论', difficulty: 'L2' },
    { text: "To be honest...", meaning: '说实话...', category: '日常表达', sceneTitle: '认识室友', difficulty: 'L2' },
    { text: "As far as I know...", meaning: '据我所知...', category: '日常表达', sceneTitle: '小组讨论', difficulty: 'L3' },
    { text: 'Would you mind...?', meaning: '你介意...吗？', category: '日常表达', sceneTitle: '咖啡店点餐', difficulty: 'L2', examples: [{ en: 'Would you mind opening the window?', zh: '你介意打开窗户吗？', level: 'intermediate' }] },
  ]

  const chunkIds: Record<string, string> = {}
  for (const c of chunkData) {
    const sceneId = scenes[c.sceneTitle]
    const chunk = await prisma.chunk.create({
      data: {
        text: c.text, meaning: c.meaning, category: c.category,
        difficulty: c.difficulty,
        description: `${c.meaning} 常用于${c.category}场景，可替换省略号部分来表达具体信息。`,
        sceneId,
        applicableSceneIds: [sceneId].filter(Boolean) as string[],
        examples: c.examples?.length
          ? {
              create: c.examples.map((example, i) => ({
                en: example.en,
                zh: example.zh,
                note: example.note ?? null,
                level: example.level ?? 'basic',
                sortOrder: i,
              })),
            }
          : undefined,
      },
    })
    const key = c.text.slice(0, 20)
    chunkIds[key] = chunk.id
  }
  console.log(`  ✓ ${chunkData.length} 个 Chunk`)

  // ═══ 4. 训练话题 ═══
  const topicData = [
    { sceneTitle: '宿舍入住', title: '办理入住', promptEn: "You've just arrived at the student dormitory. The receptionist asks: 'How can I help you?'", promptZh: '你刚到学生宿舍，前台工作人员问你需要什么帮助。', duration: 60, diff: 'L2', skeleton: "Hi, I'm here to ___. My booking is under the name ___. Here is my ___. Could you tell me where ___ is?" },
    { sceneTitle: '宿舍入住', title: '询问设施', promptEn: "Ask the receptionist about Wi-Fi, laundry, and kitchen facilities.", promptZh: '询问前台关于 Wi-Fi、洗衣房和厨房设施。', duration: 45, diff: 'L2' },
    { sceneTitle: '机场入境', title: '说明来访目的', promptEn: "The immigration officer asks: 'What is the purpose of your visit?'", promptZh: '入境官问你来访目的是什么。', duration: 60, diff: 'L2', skeleton: "I'm here to ___. I'll be staying for ___. I've been accepted to ___." },
    { sceneTitle: '认识室友', title: '初次见面', promptEn: "You meet your new roommate for the first time. Introduce yourself.", promptZh: '你第一次见到新室友，请自我介绍。', duration: 45, diff: 'L1', skeleton: "Hi, I'm ___. I'm from ___. My major is ___. It's nice to ___." },
    { sceneTitle: '认识室友', title: '聊家乡', promptEn: "Your roommate asks: 'Tell me about your hometown.'", promptZh: '室友让你介绍一下你的家乡。', duration: 60, diff: 'L2' },
    { sceneTitle: '咖啡店点餐', title: '点咖啡', promptEn: "You're at a coffee shop. Order your favorite drink.", promptZh: '你在咖啡店，请点你喜欢的饮品。', duration: 30, diff: 'L1', skeleton: "I'd like a ___, please. For ___ / to go. How much ___?" },
  ]

  for (const t of topicData) {
    const sceneId = scenes[t.sceneTitle]
    if (!sceneId) continue
    await prisma.trainingTopic.create({
      data: {
        sceneId, title: t.title, promptEn: t.promptEn, promptZh: t.promptZh,
        suggestedDurationSec: t.duration, difficulty: t.diff,
        sentenceSkeleton: t.skeleton ?? null, sortOrder: 0,
      },
    })
  }
  console.log(`  ✓ ${topicData.length} 个训练话题`)

  // ═══ 5. Chapter 0 体验关卡 ═══
  const ep1 = await prisma.scriptEpisode.create({
    data: {
      chapterId: 'chapter_0', chapterTitle: '新手体验', episodeOrder: 1,
      title: '和前台打招呼', sceneId: scenes['宿舍入住'],
      requiredOutputLevel: 'L1', requiredUserLevel: 1,
      vocabRequiredCount: 3, vocabTotalCount: 10, chunkRequiredCount: 2, chunkTotalCount: 6,
      objectives: ['打招呼', '说明来办理入住', '提供姓名'],
      passObjectiveCount: 2, passChunkCount: 2, passRetellRequired: false, passMinDialogues: 2,
      npcName: 'Sarah（前台）', npcRole: '宿舍前台工作人员，友好热情',
      isPreview: true,
      rewards: { xp: 20 },
    },
  })
  const ep2 = await prisma.scriptEpisode.create({
    data: {
      chapterId: 'chapter_0', chapterTitle: '新手体验', episodeOrder: 2,
      title: '咖啡店点一杯咖啡', sceneId: scenes['咖啡店点餐'],
      requiredOutputLevel: 'L1', requiredUserLevel: 1,
      vocabRequiredCount: 2, vocabTotalCount: 10, chunkRequiredCount: 2, chunkTotalCount: 5,
      objectives: ['和店员打招呼', '点一杯饮品', '指定大小和温度', '确认价格'],
      passObjectiveCount: 3, passChunkCount: 2, passRetellRequired: false, passMinDialogues: 2,
      npcName: 'Tom（咖啡师）', npcRole: '校园咖啡店咖啡师，友好随和',
      isPreview: true,
      rewards: { xp: 20 },
    },
  })
  const ep3 = await prisma.scriptEpisode.create({
    data: {
      chapterId: 'chapter_0', chapterTitle: '新手体验', episodeOrder: 3,
      title: '室友见面', sceneId: scenes['认识室友'],
      requiredOutputLevel: 'L1', requiredUserLevel: 1,
      vocabRequiredCount: 2, vocabTotalCount: 10, chunkRequiredCount: 2, chunkTotalCount: 5,
      prerequisiteEpisodes: [], passObjectiveCount: 2, passChunkCount: 2, passRetellRequired: false, passMinDialogues: 2,
      objectives: ['打招呼', '自我介绍', '说明来自哪里', '说明专业'],
      npcName: 'Alex（室友）', npcRole: '大一新生，友好健谈',
      isPreview: true,
      rewards: { xp: 20, unlockNpc: 'alex' },
    },
  })

  // Link chunks to episodes
  for (const [key, epId] of [['check in', ep1.id], ['latte', ep2.id], ['from', ep3.id]] as const) {
    const matchingChunks = chunkData.filter((c) => c.text.toLowerCase().includes(key))
    for (let i = 0; i < Math.min(matchingChunks.length, 5); i++) {
      const ckId = chunkIds[matchingChunks[i].text.slice(0, 20)]
      if (ckId) {
        await prisma.scriptEpisodeChunk.create({
          data: { episodeId: epId, chunkId: ckId, sortOrder: i },
        }).catch(() => {})
      }
    }
  }
  console.log(`  ✓ 3 个 Chapter 0 体验关卡`)

  // ═══ 6. NPC ═══
  const npcAlex = await prisma.gameCharacter.create({
    data: { name: 'alex', displayName: 'Alex', role: '室友，大一新生，友好健谈', personality: 'friendly, curious about your culture', defaultPosition: 'right' },
  })
  const npcSarah = await prisma.gameCharacter.create({
    data: { name: 'sarah_front_desk', displayName: 'Sarah', role: '宿舍前台，乐于助人', personality: 'professional and warm', defaultPosition: 'left' },
  })
  const npcTom = await prisma.gameCharacter.create({
    data: { name: 'tom_barista', displayName: 'Tom', role: '咖啡师，友好健谈', personality: 'laid-back, loves coffee culture', defaultPosition: 'left' },
  })
  console.log(`  ✓ 3 个 NPC`)

  // ═══ 7. 探索地图 + 地点 ═══
  const map1 = await prisma.gameMap.create({
    data: { name: 'campus', displayName: '大学校园', requiredOutputLevel: 'L1', isPreview: true, sortOrder: 1 },
  })

  const locDorm = await prisma.gameLocation.create({
    data: { mapId: map1.id, name: '宿舍大厅', displayName: '🏠 宿舍大厅', description: '你住的地方，前台 Sarah 和室友 Alex 经常在这里。', posX: 25, posY: 40, locationType: 'vn_scene', isPreview: false },
  })
  const locCafe = await prisma.gameLocation.create({
    data: { mapId: map1.id, name: '校园咖啡店', displayName: '☕ 校园咖啡店', description: '课间休息的好去处，Tom 在这里工作。', posX: 60, posY: 30, locationType: 'vn_scene', isPreview: true, requiredOutputLevel: 'L2' },
  })
  const locLibrary = await prisma.gameLocation.create({
    data: { mapId: map1.id, name: '图书馆', displayName: '📚 图书馆', description: '安静的学习空间。', posX: 75, posY: 65, locationType: 'vn_scene', isPreview: true, requiredOutputLevel: 'L2' },
  })

  // Link NPCs to locations
  await prisma.gameLocationNpc.create({ data: { locationId: locDorm.id, characterId: npcSarah.id, defaultGreeting: "Hi! Welcome to the dormitory. How can I help you?", sortOrder: 1 } })
  await prisma.gameLocationNpc.create({ data: { locationId: locDorm.id, characterId: npcAlex.id, defaultGreeting: "Hey! You must be my new roommate. I'm Alex!", sortOrder: 2 } })
  await prisma.gameLocationNpc.create({ data: { locationId: locCafe.id, characterId: npcTom.id, defaultGreeting: "Hey! What can I get for you today?", sortOrder: 1 } })

  // Exits
  await prisma.gameLocationExit.create({ data: { fromId: locDorm.id, toId: locCafe.id, label: '去校园咖啡店 →' } })
  await prisma.gameLocationExit.create({ data: { fromId: locCafe.id, toId: locDorm.id, label: '回宿舍大厅 →' } })
  await prisma.gameLocationExit.create({ data: { fromId: locCafe.id, toId: locLibrary.id, label: '去图书馆 →' } })
  console.log(`  ✓ 1 个地图 + 3 个地点 + 出口 + NPC 关联`)

  // ═══ 8. 成就定义 ═══
  const achievementDefs: { key: string; title: string; description: string; category: AchievementCategory; rarity: AchievementRarity; sortOrder: number; condition?: any; isHidden?: boolean; hintText?: string }[] = [
    { key: 'first_recording', title: '初次开口', description: '完成第一次录音回答', category: 'first_time', rarity: 'common', sortOrder: 1 },
    { key: 'first_script_clear', title: '初出茅庐', description: '通关第一个剧本关卡', category: 'first_time', rarity: 'common', sortOrder: 2 },
    { key: 'first_retell', title: '过目不忘', description: '完成第一次遮挡复述', category: 'first_time', rarity: 'common', sortOrder: 3 },
    { key: 'recording_10', title: '开口十次', description: '累计完成 10 次录音回答', category: 'milestone', rarity: 'rare', sortOrder: 10, condition: { type: 'recording_count', threshold: 10 } },
    { key: 'recording_50', title: '话筒常客', description: '累计完成 50 次录音回答', category: 'milestone', rarity: 'epic', sortOrder: 11, condition: { type: 'recording_count', threshold: 50 } },
    { key: 'chunk_20', title: '表达学徒', description: '掌握 20 个 Chunk', category: 'milestone', rarity: 'rare', sortOrder: 20, condition: { type: 'chunk_mastered', threshold: 20 } },
    { key: 'chunk_50', title: '表达达人', description: '掌握 50 个 Chunk', category: 'milestone', rarity: 'epic', sortOrder: 21, condition: { type: 'chunk_mastered', threshold: 50 } },
    { key: 'streak_7', title: '七日之约', description: '连续打卡 7 天', category: 'streak', rarity: 'rare', sortOrder: 30, condition: { type: 'streak_days', threshold: 7 } },
    { key: 'streak_30', title: '铁嘴铜牙', description: '连续打卡 30 天', category: 'streak', rarity: 'epic', sortOrder: 31, condition: { type: 'streak_days', threshold: 30 } },
    { key: 'level_l3', title: '能说完整', description: '输出等级达到 L3', category: 'mastery', rarity: 'rare', sortOrder: 40, condition: { type: 'output_level', threshold: 'L3' } },
    { key: 'chapter_0_all', title: '初来乍到', description: '通关 Chapter 0 全部关卡', category: 'challenge', rarity: 'common', sortOrder: 50, condition: { type: 'chapter_complete', chapterId: 'chapter_0' } },
    { key: 'one_take', title: '一遍过', description: '连续通关 3 个剧本关卡无失败', category: 'challenge', rarity: 'epic', sortOrder: 51, condition: { type: 'script_streak', threshold: 3 } },
    { key: 'hidden_polite', title: '彬彬有礼', description: '在对话中自然使用多种礼貌表达', category: 'hidden', rarity: 'rare', isHidden: true, hintText: '礼貌是最好的通行证...', sortOrder: 90 },
  ]

  for (const a of achievementDefs) {
    await prisma.achievementDef.upsert({
      where: { key: a.key },
      create: { ...a, condition: (a as any).condition ?? {}, rewardXp: a.rarity === 'legendary' ? 100 : a.rarity === 'epic' ? 50 : a.rarity === 'rare' ? 20 : 10 },
      update: {},
    })
  }
  console.log(`  ✓ ${achievementDefs.length} 个成就定义`)

  console.log('\n✅ 英语输出训练种子数据创建完成!\n')
}
