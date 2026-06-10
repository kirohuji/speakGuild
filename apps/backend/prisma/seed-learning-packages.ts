/**
 * 📦 学习包 — 按场景分类组织的自学数据
 *
 * 从 data/packages/<category-dir>/ 读取 CSV：
 *   scenes.csv → 场景基本信息
 *   scene_vocabulary.csv → 词汇（独立表 Vocabulary，通过 TrainingTopicVocab join 关联话题）
 *   chunks.csv → 句块（独立表 Chunk，通过 TrainingTopicChunk join 关联话题）
 *   training_topics.csv → 训练话题（通过 scene_title 关联场景）
 *   sentence_patterns.csv → 句型（独立表 SentencePattern，通过 TrainingTopicSentencePattern join）
 *   script_episodes.csv → 剧本关卡（通过 ScriptEpisodeChunk/ScriptEpisodeVocab join 关联）
 *
 * 新 Schema 数据流（所有关联都通过 ID join 表）：
 *   Vocabulary ──→ TrainingTopicVocab ──→ TrainingTopic ──→ Scene
 *   Chunk      ──→ TrainingTopicChunk ──→ TrainingTopic
 *   SentencePattern ──→ TrainingTopicSentencePattern ──→ TrainingTopic
 *   ScriptEpisode ──→ ScriptEpisodeVocab / ScriptEpisodeChunk / ScriptEpisodeSentencePattern
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
type CsvVocab = { scene_title: string; topic_title: string; word: string; meaning: string; part_of_speech: string; phonetic_us: string; phonetic_uk: string; difficulty: string; description: string; examples_json: string; sort_order: string }
type CsvChunk = { scene_title: string; topic_title: string; category: string; text: string; meaning: string; difficulty: string; description: string; examples_json: string }
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

  // TODO: 正式环境移除 .filter，处理全部包
  const targetDirs = packageDirs.filter(d => d === 'study-abroad')
  console.log(`  处理 ${targetDirs.length} 个包: ${targetDirs.join(', ')}\n`)

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

    // ═══ 3.5. Ink 脚本（从包目录加载） ═══
    try {
      const inkDir = resolve(__dirname, 'data', pkgPath, 'ink-scripts')
      if (existsSync(inkDir)) {
        const inkFiles = readdirSync(inkDir).filter((f: string) => f.endsWith('.json'))
        for (const file of inkFiles) {
          const inkData = JSON.parse(require('fs').readFileSync(resolve(inkDir, file), 'utf-8'))
          const ink = await prisma.inkScript.upsert({
            where: { key: inkData.key },
            create: inkData,
            update: inkData,
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
          inkScriptId: inkId,
          sortOrder: topicCount,
        },
      })
      topicTitleSceneToId.set(`${row.scene_title}|${row.title}`, topic.id)
      topicCount++
    }
    console.log(`  ✓ ${topicCount} 个训练话题`)
    totalTopics += topicCount

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

    // ═══ 8. 关卡↔句块 关联（ScriptEpisodeChunk join 表） ═══
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

    // ═══ 8.5. 关卡↔词汇 关联（ScriptEpisodeVocab join 表） ═══
    // Link each episode to all vocabs in the same scene
    let epVocabCount = 0
    for (const ep of pkgEpisodes) {
      const match = epRows.find(r => r.title === ep.title)
      if (!match) continue
      const vocabIds = sceneVocabIds.get(match.scene_title) ?? []
      if (vocabIds.length > 0) {
        await prisma.scriptEpisodeVocab.createMany({
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
  console.log(`  ${totalEpVocabs} 个关卡↔词汇关联`)

  // 字典 API 自动补全
  await enrichVocabulary(prisma)

  console.log('\n✅ 全部学习包处理完成！')
  return { sceneMap }
}
