import { PrismaClient, AchievementCategory, AchievementRarity } from '@prisma/client'
import { readCsv, parseJson } from './seed-csv'
import { enrichVocabulary } from './seed-vocab-enrich'
import * as fs from 'fs'
import * as path from 'path'

type CsvSceneCategory = { name: string; icon: string; sort_order: string }
type CsvScene = { category_name: string; title: string; location: string; required_output_level: string; required_user_level: string; description: string }
type CsvVocab = { scene_title: string; word: string; meaning: string; part_of_speech: string; phonetic_us: string; phonetic_uk: string; difficulty: string; description: string; examples_json: string; sort_order: string }
type CsvChunk = { scene_title: string; category: string; text: string; meaning: string; difficulty: string; description: string; examples_json: string; applicable_scenes_json: string }
type CsvTopic = { scene_title: string; title: string; prompt_en: string; prompt_zh: string; duration_sec: string; difficulty: string; description: string; knowledge_points: string; ink_script_key: string }
type CsvEpisode = { chapter_id: string; chapter_title: string; episode_order: string; title: string; scene_title: string; required_output_level: string; required_user_level: string; vocab_required_count: string; vocab_total_count: string; chunk_required_count: string; chunk_total_count: string; objectives_json: string; pass_objective_count: string; pass_chunk_count: string; pass_min_dialogues: string; npc_name: string; npc_role: string; is_preview: string; ink_script_key: string; rewards_json: string }
type CsvEpChunk = { episode_chapter: string; episode_order: string; chunk_text_match: string; sort_order: string }
type CsvChar = { name: string; display_name: string; role: string; personality: string; default_position: string; avatar_url: string; sprite_base_url: string }
type CsvMap = { name: string; display_name: string; required_output_level: string; is_preview: string; sort_order: string }
type CsvLocation = { map_name: string; name: string; display_name: string; description: string; pos_x: string; pos_y: string; location_type: string; is_preview: string; required_output_level: string; background_url: string }
type CsvLocNpc = { location_name: string; character_name: string; default_greeting: string; sort_order: string }
type CsvLocExit = { from_location: string; to_location: string; label: string }
type CsvAchievement = { key: string; title: string; description: string; category: string; rarity: string; sort_order: string; is_hidden: string; hint_text: string; condition_json: string; reward_xp: string }

const DATA_DIR = path.resolve(__dirname, 'data')
const INK_DIR = path.resolve(DATA_DIR, 'ink-scripts')

export async function seedEnglishOutput(prisma: PrismaClient) {
  console.log('🌍 开始创建英语输出训练种子数据...\n')

  // ═══ 1. 场景分类 ═══
  const catRows = readCsv<CsvSceneCategory>('scene_categories.csv')
  const catMap = new Map<string, string>()
  for (const row of catRows) {
    const cat = await prisma.sceneCategory.create({
      data: { name: row.name, icon: row.icon || null, sortOrder: parseInt(row.sort_order) },
    })
    catMap.set(row.name, cat.id)
  }
  console.log(`  ✓ ${catRows.length} 个场景分类`)

  // ═══ 2. 场景 ═══
  const sceneRows = readCsv<CsvScene>('scenes.csv')
  const sceneMap = new Map<string, string>()
  for (const row of sceneRows) {
    const catId = catMap.get(row.category_name)
    if (!catId) {
      console.warn(`  ⚠️  Category not found: ${row.category_name}, skipping scene: ${row.title}`)
      continue
    }
    const scene = await prisma.scene.create({
      data: {
        categoryId: catId,
        title: row.title,
        location: row.location,
        description: row.description || null,
        requiredOutputLevel: row.required_output_level,
        requiredUserLevel: parseInt(row.required_user_level) || 1,
      },
    })
    sceneMap.set(row.title, scene.id)
  }
  console.log(`  ✓ ${sceneRows.length} 个场景`)

  // ═══ 3. 场景词汇 ═══
  const vocabRows = readCsv<CsvVocab>('scene_vocabulary.csv')
  let vocabCount = 0
  for (const row of vocabRows) {
    const sceneId = sceneMap.get(row.scene_title)
    if (!sceneId) continue
    await prisma.sceneVocabulary.create({
      data: {
        sceneId,
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
    })
    vocabCount++
  }
  console.log(`  ✓ ${vocabCount} 个场景词汇`)

  // Enrich from dictionaryapi.dev
  await enrichVocabulary(prisma)

  // ═══ 4. Chunk 表达块 ═══
  const chunkRows = readCsv<CsvChunk>('chunks.csv')
  const chunkTextToId = new Map<string, string>()
  let chunkCount = 0
  for (const row of chunkRows) {
    const sceneId = sceneMap.get(row.scene_title)
    const examples = parseJson<{ en: string; zh: string; note?: string; level?: string }[]>(row.examples_json)
    const appScenes = parseJson<string[]>(row.applicable_scenes_json)
    // Auto-compute applicableSceneIds from scene_title if not provided
    const computedAppScenes = appScenes?.length
      ? appScenes.map((s) => sceneMap.get(s)).filter(Boolean) as string[]
      : (sceneId ? [sceneId] : [])

    const chunk = await prisma.chunk.create({
      data: {
        text: row.text,
        meaning: row.meaning,
        category: row.category,
        difficulty: row.difficulty || 'L2',
        description: row.description || null,
        sceneId,
        applicableSceneIds: computedAppScenes,
        examples: examples?.length
          ? {
              create: examples.map((ex, i) => ({
                en: ex.en,
                zh: ex.zh,
                note: ex.note || null,
                level: ex.level || 'basic',
                sortOrder: i,
              })),
            }
          : undefined,
      },
    })
    const key = row.text.slice(0, 20)
    chunkTextToId.set(key, chunk.id)
    chunkCount++
  }
  console.log(`  ✓ ${chunkCount} 个 Chunk`)

  // ═══ 5. Ink 对话脚本 ═══
  try {
    const inkFiles = fs.readdirSync(INK_DIR).filter((f: string) => f.endsWith('.json'))
    let inkCount = 0
    for (const file of inkFiles) {
      const inkData = JSON.parse(fs.readFileSync(path.resolve(INK_DIR, file), 'utf-8'))
      await prisma.inkScript.upsert({
        where: { key: inkData.key },
        create: inkData,
        update: {},
      })
      inkCount++
    }
    console.log(`  ✓ ${inkCount} 个 Ink 对话脚本`)
  } catch {
    console.log('  ⚠️  No ink scripts directory or files found')
  }

  // Build a map from ink_script_key → id
  const allInkScripts = await prisma.inkScript.findMany()
  const inkKeyToId = new Map<string, string>()
  for (const ink of allInkScripts) {
    inkKeyToId.set(ink.key, ink.id)
  }

  // ═══ 6. 训练话题 ═══
  const topicRows = readCsv<CsvTopic>('training_topics.csv')
  const topicTitleSceneToId = new Map<string, string>() // "scene_title|title" → id
  let topicCount = 0
  for (const row of topicRows) {
    const sceneId = sceneMap.get(row.scene_title)
    if (!sceneId) continue

    const topic = await prisma.trainingTopic.create({
      data: {
        sceneId,
        title: row.title,
        promptEn: row.prompt_en,
        promptZh: row.prompt_zh,
        suggestedDurationSec: parseInt(row.duration_sec) || 60,
        difficulty: row.difficulty || 'L2',
        description: row.description || null,
        knowledgePoints: row.knowledge_points || null,
        inkScriptId: inkKeyToId.get(row.ink_script_key) || null,
        sortOrder: 0,
      },
    })
    topicTitleSceneToId.set(`${row.scene_title}|${row.title}`, topic.id)
    topicCount++
  }
  console.log(`  ✓ ${topicCount} 个训练话题`)

  // ═══ 6b. 句型骨架 ═══
  type CsvSentencePattern = {
    scene_title: string
    topic_title: string
    pattern: string
    meaning: string
    slots: string
    example: string
    difficulty: string
    sort_order: string
  }
  const spRows = readCsv<CsvSentencePattern>('sentence_patterns.csv')
  let spCount = 0
  for (const row of spRows) {
    const topicId = topicTitleSceneToId.get(`${row.scene_title}|${row.topic_title}`)
    if (!topicId) continue
    await prisma.trainingTopicSentencePattern.create({
      data: {
        topicId,
        pattern: row.pattern,
        meaning: row.meaning || null,
        slots: row.slots ? parseJson(row.slots) : undefined,
        example: row.example || null,
        difficulty: row.difficulty || 'L1',
        sortOrder: parseInt(row.sort_order) || 0,
      },
    })
    spCount++
  }
  console.log(`  ✓ ${spCount} 个句型骨架`)

  // ═══ 7. 话题↔Chunk 关联 ═══
  // 每个话题关联同场景的句块 + 通用句块
  const allChunks = await prisma.chunk.findMany()
  const sceneChunks = new Map<string, string[]>() // sceneId → chunkIds
  const generalChunkIds: string[] = []
  for (const ck of allChunks) {
    if (!ck.sceneId) {
      generalChunkIds.push(ck.id)
    } else {
      const list = sceneChunks.get(ck.sceneId) || []
      list.push(ck.id)
      sceneChunks.set(ck.sceneId, list)
    }
  }
  const allTopics = await prisma.trainingTopic.findMany({ include: { scene: true } })
  let tccCount = 0
  for (const topic of allTopics) {
    const chunkIds = [...(sceneChunks.get(topic.sceneId) || []), ...generalChunkIds]
    // Deduplicate
    const uniqueChunkIds = [...new Set(chunkIds)]
    if (uniqueChunkIds.length > 0) {
      await prisma.trainingTopicChunk.createMany({
        data: uniqueChunkIds.map((chunkId, i) => ({
          topicId: topic.id,
          chunkId,
          sortOrder: i,
        })),
        skipDuplicates: true,
      })
      tccCount += uniqueChunkIds.length
    }
  }
  console.log(`  ✓ ${tccCount} 个话题↔Chunk 关联`)

  // ═══ 8. 剧本关卡 ═══
  const episodeRows = readCsv<CsvEpisode>('script_episodes.csv')
  const episodeIdMap = new Map<string, string>() // "chapter_id,episode_order" → id
  for (const row of episodeRows) {
    const sceneId = sceneMap.get(row.scene_title)
    if (!sceneId) continue

    const episode = await prisma.scriptEpisode.create({
      data: {
        chapterId: row.chapter_id,
        chapterTitle: row.chapter_title,
        episodeOrder: parseInt(row.episode_order),
        title: row.title,
        sceneId,
        requiredOutputLevel: row.required_output_level || 'L1',
        requiredUserLevel: parseInt(row.required_user_level) || 1,
        vocabRequiredCount: parseInt(row.vocab_required_count) || 2,
        vocabTotalCount: parseInt(row.vocab_total_count) || 10,
        chunkRequiredCount: parseInt(row.chunk_required_count) || 2,
        chunkTotalCount: parseInt(row.chunk_total_count) || 10,
        objectives: parseJson<string[]>(row.objectives_json) || [],
        passObjectiveCount: parseInt(row.pass_objective_count) || 2,
        passChunkCount: parseInt(row.pass_chunk_count) || 2,
        passRetellRequired: false,
        passMinDialogues: parseInt(row.pass_min_dialogues) || 2,
        npcName: row.npc_name,
        npcRole: row.npc_role,
        isPreview: row.is_preview === 'true',
        inkScriptId: inkKeyToId.get(row.ink_script_key) || null,
        rewards: parseJson(row.rewards_json),
        prerequisiteEpisodes: [],
      },
    })
    episodeIdMap.set(`${row.chapter_id},${row.episode_order}`, episode.id)
  }
  console.log(`  ✓ ${episodeRows.length} 个剧本关卡`)

  // ═══ 9. 关卡↔Chunk 关联 ═══
  const epChunkRows = readCsv<CsvEpChunk>('episode_chunks.csv')
  let epChunkCount = 0
  for (const row of epChunkRows) {
    const epId = episodeIdMap.get(`${row.episode_chapter},${row.episode_order}`)
    if (!epId) continue

    // Find chunks matching the text
    const matchingChunks = chunkRows.filter((c) =>
      c.text.toLowerCase().includes(row.chunk_text_match.toLowerCase()),
    )
    for (let i = 0; i < Math.min(matchingChunks.length, 5); i++) {
      const ckId = chunkTextToId.get(matchingChunks[i].text.slice(0, 20))
      if (ckId) {
        await prisma.scriptEpisodeChunk.create({
          data: { episodeId: epId, chunkId: ckId, sortOrder: parseInt(row.sort_order) || i },
        }).catch(() => {})
        epChunkCount++
      }
    }
  }
  console.log(`  ✓ ${epChunkCount} 个关卡↔Chunk 关联`)

  // ═══ 10. NPC ═══
  const charRows = readCsv<CsvChar>('game_characters.csv')
  const charNameToId = new Map<string, string>()
  for (const row of charRows) {
    const char = await prisma.gameCharacter.create({
      data: {
        name: row.name,
        displayName: row.display_name,
        role: row.role,
        personality: row.personality || null,
        defaultPosition: row.default_position || 'center',
        avatarUrl: row.avatar_url || null,
        spriteBaseUrl: row.sprite_base_url || null,
      },
    })
    charNameToId.set(row.name, char.id)
  }
  console.log(`  ✓ ${charRows.length} 个 NPC`)

  // ═══ 11. 探索地图 + 地点 ═══
  const mapRows = readCsv<CsvMap>('game_maps.csv')
  const mapNameToId = new Map<string, string>()
  for (const row of mapRows) {
    const map = await prisma.gameMap.create({
      data: {
        name: row.name,
        displayName: row.display_name,
        requiredOutputLevel: row.required_output_level || 'L1',
        isPreview: row.is_preview === 'true',
        sortOrder: parseInt(row.sort_order) || 0,
      },
    })
    mapNameToId.set(row.name, map.id)
  }

  const locRows = readCsv<CsvLocation>('game_locations.csv')
  const locNameToId = new Map<string, string>()
  for (const row of locRows) {
    const mapId = mapNameToId.get(row.map_name)
    if (!mapId) continue
    const loc = await prisma.gameLocation.create({
      data: {
        mapId,
        name: row.name,
        displayName: row.display_name,
        description: row.description || null,
        posX: parseFloat(row.pos_x) || 0,
        posY: parseFloat(row.pos_y) || 0,
        locationType: row.location_type || 'vn_scene',
        isPreview: row.is_preview === 'true',
        requiredOutputLevel: row.required_output_level || 'L1',
        backgroundUrl: row.background_url || null,
      },
    })
    locNameToId.set(row.name, loc.id)
  }

  // ═══ 12. 地点↔NPC 关联 ═══
  const locNpcRows = readCsv<CsvLocNpc>('location_npcs.csv')
  for (const row of locNpcRows) {
    const locId = locNameToId.get(row.location_name)
    const charId = charNameToId.get(row.character_name)
    if (!locId || !charId) continue
    await prisma.gameLocationNpc.create({
      data: {
        locationId: locId,
        characterId: charId,
        defaultGreeting: row.default_greeting || null,
        sortOrder: parseInt(row.sort_order) || 0,
      },
    })
  }

  // ═══ 13. 地点出口 ═══
  const exitRows = readCsv<CsvLocExit>('location_exits.csv')
  for (const row of exitRows) {
    const fromId = locNameToId.get(row.from_location)
    const toId = locNameToId.get(row.to_location)
    if (!fromId || !toId) continue
    await prisma.gameLocationExit.create({
      data: {
        fromId,
        toId,
        label: row.label || '→',
      },
    })
  }
  console.log(`  ✓ ${mapRows.length} 个地图 + ${locRows.length} 个地点 + 关联`)

  // ═══ 14. 成就定义 ═══
  const achRows = readCsv<CsvAchievement>('achievement_defs.csv')
  for (const row of achRows) {
    const rarity = row.rarity as AchievementRarity
    const rewardXp = row.rarity === 'legendary' ? 100 : row.rarity === 'epic' ? 50 : row.rarity === 'rare' ? 20 : 10
    await prisma.achievementDef.upsert({
      where: { key: row.key },
      create: {
        key: row.key,
        title: row.title,
        description: row.description,
        category: row.category as AchievementCategory,
        rarity,
        icon: null,
        sortOrder: parseInt(row.sort_order) || 0,
        isHidden: row.is_hidden === 'true',
        hintText: row.hint_text || null,
        condition: parseJson(row.condition_json) || {},
        rewardXp: parseInt(row.reward_xp) || rewardXp,
        rewardTitle: null,
      },
      update: {},
    })
  }
  console.log(`  ✓ ${achRows.length} 个成就定义`)

  console.log('\n✅ 英语输出训练种子数据创建完成!\n')
}
