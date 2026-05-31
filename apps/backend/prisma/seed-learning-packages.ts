/**
 * 📦 学习包 — 按场景分类组织的自学数据
 *
 * 从 data/packages/<category-dir>/ 读取 CSV，每个包包含同构的数据结构：
 *   scenes → scene_vocabulary → chunks → training_topics
 *   → sentence_patterns → script_episodes → episode_chunks
 *
 * 包发现：扫描 data/packages/ 下所有子目录自动发现。
 */

import { PrismaClient } from '@prisma/client'
import { readCsv, parseJson } from './seed-csv'
import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { enrichVocabulary } from './seed-vocab-enrich'

const PKG_DIR = 'packages'
const PKG_ABS = resolve(__dirname, 'data', PKG_DIR)

// ── CSV 类型 ──
type CsvScene = { category_name: string; title: string; location: string; required_output_level: string; required_user_level: string; description: string }
type CsvVocab = { scene_title: string; word: string; meaning: string; part_of_speech: string; phonetic_us: string; phonetic_uk: string; difficulty: string; description: string; examples_json: string; sort_order: string }
type CsvChunk = { scene_title: string; category: string; text: string; meaning: string; difficulty: string; description: string; examples_json: string; applicable_scenes_json: string }
type CsvTopic = { scene_title: string; title: string; prompt_en: string; prompt_zh: string; duration_sec: string; difficulty: string; description: string; knowledge_points: string; ink_script_key: string }
type CsvPattern = { scene_title: string; topic_title: string; pattern: string; meaning: string; slots: string; example: string; difficulty: string; sort_order: string }
type CsvEpisode = { chapter_id: string; chapter_title: string; episode_order: string; title: string; scene_title: string; required_output_level: string; required_user_level: string; vocab_required_count: string; vocab_total_count: string; chunk_required_count: string; chunk_total_count: string; objectives_json: string; pass_objective_count: string; pass_chunk_count: string; pass_min_dialogues: string; npc_name: string; npc_role: string; is_preview: string; ink_script_key: string; rewards_json: string }
type CsvEpChunk = { episode_chapter: string; episode_order: string; chunk_text_match: string; sort_order: string }

export async function seedLearningPackages(prisma: PrismaClient) {
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

  console.log(`  发现 ${packageDirs.length} 个学习包: ${packageDirs.join(', ')}\n`)

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

  for (const dirName of packageDirs) {
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
      const scene = await prisma.scene.create({
        data: {
          categoryId: catId,
          title: row.title,
          location: row.location,
          description: row.description || null,
          requiredOutputLevel: row.required_output_level,
          requiredUserLevel: parseInt(row.required_user_level) || 1,
          isFree: ['宿舍入住', '机场入境', '认识室友'].includes(row.title),
        },
      })
      sceneMap.set(row.title, scene.id)
    }
    console.log(`  ✓ ${sceneRows.length} 个场景`)

    // ═══ 2. 场景词汇 ═══
    const vocabRows = readCsv<CsvVocab>('scene_vocabulary.csv', pkgPath)
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
    console.log(`  ✓ ${vocabCount} 个词汇`)
    totalVocab += vocabCount

    // ═══ 3. 句块 ═══
    const chunkRows = readCsv<CsvChunk>('chunks.csv', pkgPath)
    let chunkCount = 0
    for (const row of chunkRows) {
      const sceneId = sceneMap.get(row.scene_title)
      const examples = parseJson<{ en: string; zh: string; note?: string; level?: string }[]>(row.examples_json)
      const appScenes = parseJson<string[]>(row.applicable_scenes_json)
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
            ? { create: examples.map((ex, i) => ({ en: ex.en, zh: ex.zh, note: ex.note || null, level: ex.level || 'basic', sortOrder: i })) }
            : undefined,
        },
      })
      chunkTextToId.set(row.text.slice(0, 20), chunk.id)
      chunkCount++
    }
    console.log(`  ✓ ${chunkCount} 个句块`)
    totalChunks += chunkCount

    // ═══ 4. 训练话题 ═══
    const topicRows = readCsv<CsvTopic>('training_topics.csv', pkgPath)
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
    totalTopics += topicCount

    // ═══ 5. 句型骨架 ═══
    const patternRows = readCsv<CsvPattern>('sentence_patterns.csv', pkgPath)
    let patternCount = 0
    for (const row of patternRows) {
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
      patternCount++
    }
    console.log(`  ✓ ${patternCount} 个句型`)
    totalPatterns += patternCount

    // ═══ 6. 话题↔句块 关联 ═══
    // 获取当前包中刚创建的话题
    const allTopicIds = Array.from(topicTitleSceneToId.values())
    const pkgTopicIds = allTopicIds.slice(-topicCount)
    const topicsInPkg = await prisma.trainingTopic.findMany({
      where: { id: { in: pkgTopicIds } },
      include: { scene: true },
    })
    const allChunks = await prisma.chunk.findMany({ where: { sceneId: { not: null } } })
    const sceneChunks = new Map<string, string[]>()
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
    // 也获取通用句块
    const generalAll = await prisma.chunk.findMany({ where: { sceneId: null } })
    for (const ck of generalAll) {
      generalChunkIds.push(ck.id)
    }

    let tccCount = 0
    for (const topic of topicsInPkg) {
      const sceneChunkIds = sceneChunks.get(topic.sceneId) || []
      const chunkIds = sceneChunkIds.concat(generalChunkIds)
      const uniqueChunkIds = Array.from(new Set(chunkIds))
      if (uniqueChunkIds.length > 0) {
        await prisma.trainingTopicChunk.createMany({
          data: uniqueChunkIds.map((chunkId, i) => ({ topicId: topic.id, chunkId, sortOrder: i })),
          skipDuplicates: true,
        })
        tccCount += uniqueChunkIds.length
      }
    }
    console.log(`  ✓ ${tccCount} 个话题↔句块关联`)

    // ═══ 7. 剧本关卡 ═══
    const epRows = readCsv<CsvEpisode>('script_episodes.csv', pkgPath)
    let epCount = 0
    for (const row of epRows) {
      const sceneId = sceneMap.get(row.scene_title)
      if (!sceneId) continue
      await prisma.scriptEpisode.create({
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
          passMinDialogues: parseInt(row.pass_min_dialogues) || 2,
          npcName: row.npc_name,
          npcRole: row.npc_role,
          isPreview: row.is_preview === 'true',
          inkScriptId: inkKeyToId.get(row.ink_script_key) || null,
          rewards: parseJson(row.rewards_json),
          prerequisiteEpisodes: [],
        },
      })
      epCount++
    }
    console.log(`  ✓ ${epCount} 个剧本关卡`)
    totalEpisodes += epCount

    // ═══ 8. 关卡↔句块 关联 ═══
    const epChunkRows = readCsv<CsvEpChunk>('episode_chunks.csv', pkgPath)
    // Get the episodes we just created
    const pkgEpisodes = await prisma.scriptEpisode.findMany({
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
    for (const row of epChunkRows) {
      const epId = epOrderToId.get(`${row.episode_chapter},${row.episode_order}`)
      if (!epId) continue
      // Find matching chunk by text
      const matchingChunk = await prisma.chunk.findFirst({
        where: { text: { contains: row.chunk_text_match } },
      })
      if (matchingChunk) {
        await prisma.scriptEpisodeChunk.create({
          data: { episodeId: epId, chunkId: matchingChunk.id, sortOrder: parseInt(row.sort_order) || 0 },
        }).catch(() => {})
        epChunkCount++
      }
    }
    console.log(`  ✓ ${epChunkCount} 个关卡↔句块关联`)
    totalEpChunks += epChunkCount

    console.log('')
  }

  // ── 汇总 ──
  console.log('📊 学习包汇总:')
  console.log(`  ${packageDirs.length} 个包`)
  console.log(`  ${sceneMap.size} 个场景`)
  console.log(`  ${totalVocab} 个词汇`)
  console.log(`  ${totalChunks} 个句块`)
  console.log(`  ${totalTopics} 个训练话题`)
  console.log(`  ${totalPatterns} 个句型`)
  console.log(`  ${totalEpisodes} 个剧本关卡`)
  console.log(`  ${totalEpChunks} 个关卡↔句块关联`)

  // 字典 API 自动补全
  await enrichVocabulary(prisma)

  console.log('\n✅ 全部学习包处理完成！')
  return { sceneMap }
}
