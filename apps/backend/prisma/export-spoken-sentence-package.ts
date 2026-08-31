/**
 * 将数据库学习包导出为可版本管理的数据包。
 *
 * 运行：
 *   cd apps/backend
 *   DATABASE_URL=... npx ts-node prisma/export-spoken-sentence-package.ts [学习包标题]
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const prisma = new PrismaClient()
const PACKAGE_TITLE = process.argv[2]?.trim() || '口语万能造句：50 个高频句式'
const PACKAGE_DIR = resolve(__dirname, 'data', 'packages', PACKAGE_TITLE)

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csv(rows: Array<Record<string, unknown>>, headers: string[]) {
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n') + '\n'
}

function safeDocumentName(title: string) {
  return `${title.replace(/[\\/:*?"<>|]/g, ' ')}.md`
}

async function main() {
  const scene = await prisma.scene.findFirst({
    where: { title: PACKAGE_TITLE },
    include: {
      category: true,
      trainingTopics: {
        orderBy: { sortOrder: 'asc' },
        include: {
          topicPatterns: {
            orderBy: { sortOrder: 'asc' },
            include: { pattern: true },
          },
        },
      },
      materialReferences: true,
    },
  })
  if (!scene) throw new Error(`未找到学习包：${PACKAGE_TITLE}`)

  const topicIdToTitle = new Map(scene.trainingTopics.map((topic) => [topic.id, topic.title]))
  const patternRows = scene.trainingTopics.flatMap((topic) => topic.topicPatterns.map((link) => ({
    scene_title: scene.title,
    topic_title: topic.title,
    pattern: link.pattern.pattern,
    meaning: link.pattern.meaning ?? '',
    slots: link.pattern.slots ? JSON.stringify(link.pattern.slots) : '',
    example: Array.isArray(link.pattern.examples) && link.pattern.examples[0] && typeof link.pattern.examples[0] === 'object'
      ? String((link.pattern.examples[0] as Record<string, unknown>).en ?? '')
      : '',
    difficulty: link.pattern.difficulty,
    sort_order: link.sortOrder,
  })))

  mkdirSync(resolve(PACKAGE_DIR, 'teaching-docs'), { recursive: true })
  writeFileSync(resolve(PACKAGE_DIR, 'scenes.csv'), csv([{
    category_name: scene.category.name,
    title: scene.title,
    location: scene.location,
    required_output_level: scene.requiredOutputLevel,
    required_user_level: scene.requiredUserLevel,
    description: scene.description ?? '',
    package_type: scene.packageType,
  }], ['category_name', 'title', 'location', 'required_output_level', 'required_user_level', 'description', 'package_type']))

  const topicRows = scene.trainingTopics.map((topic) => {
    const filename = safeDocumentName(topic.title)
    writeFileSync(resolve(PACKAGE_DIR, 'teaching-docs', filename), topic.teachingMarkdown ?? '')
    return {
      scene_title: scene.title,
      title: topic.title,
      prompt_en: topic.promptEn,
      prompt_zh: topic.promptZh,
      duration_sec: topic.suggestedDurationSec,
      difficulty: topic.difficulty,
      description: topic.description ?? '',
      knowledge_points: topic.knowledgePoints ?? '',
      teaching_markdown_file: filename,
      ink_script_key: '',
    }
  })
  writeFileSync(resolve(PACKAGE_DIR, 'training_topics.csv'), csv(topicRows, [
    'scene_title', 'title', 'prompt_en', 'prompt_zh', 'duration_sec', 'difficulty', 'description', 'knowledge_points', 'teaching_markdown_file', 'ink_script_key',
  ]))
  writeFileSync(resolve(PACKAGE_DIR, 'sentence_patterns.csv'), csv(patternRows, [
    'scene_title', 'topic_title', 'pattern', 'meaning', 'slots', 'example', 'difficulty', 'sort_order',
  ]))
  const vocabRefs = scene.materialReferences.filter((reference) => reference.materialType === 'vocab')
  const chunkRefs = scene.materialReferences.filter((reference) => reference.materialType === 'chunk')
  const [vocabResult, chunkResult] = await Promise.all([
    vocabRefs.length ? prisma.vocabulary.findMany({ where: { id: { in: vocabRefs.map((reference) => reference.materialId) } } }) : [],
    chunkRefs.length ? prisma.chunk.findMany({ where: { id: { in: chunkRefs.map((reference) => reference.materialId) } }, include: { examples: { orderBy: { sortOrder: 'asc' } } } }) : [],
  ])
  const vocabs = vocabResult as any[]
  const chunks = chunkResult as any[]
  const vocabById = new Map<string, any>(vocabs.map((vocab) => [vocab.id, vocab] as [string, any]))
  const chunkById = new Map<string, any>(chunks.map((chunk) => [chunk.id, chunk] as [string, any]))
  const vocabRows = vocabRefs.flatMap((reference, sortOrder) => {
    const vocab = vocabById.get(reference.materialId)
    const topicTitle = reference.topicId ? topicIdToTitle.get(reference.topicId) : ''
    return vocab && (topicTitle !== undefined) ? [{
      scene_title: scene.title,
      topic_title: topicTitle,
      word: vocab.word,
      meaning: vocab.meaning,
      part_of_speech: vocab.partOfSpeech ?? '',
      phonetic_us: vocab.phoneticUs ?? '',
      phonetic_uk: vocab.phoneticUk ?? '',
      difficulty: vocab.difficulty,
      description: vocab.description ?? '',
      examples_json: JSON.stringify(vocab.examples ?? []),
      sort_order: sortOrder,
    }] : []
  })
  const chunkRows = chunkRefs.flatMap((reference) => {
    const chunk = chunkById.get(reference.materialId)
    const topicTitle = reference.topicId ? topicIdToTitle.get(reference.topicId) : ''
    return chunk && (topicTitle !== undefined) ? [{
      scene_title: scene.title,
      topic_title: topicTitle,
      category: chunk.category,
      text: chunk.text,
      meaning: chunk.meaning,
      difficulty: chunk.difficulty,
      description: chunk.description ?? '',
      examples_json: JSON.stringify(chunk.examples.map((example) => ({ en: example.en, zh: example.zh, note: example.note ?? undefined, level: example.level }))),
    }] : []
  })
  writeFileSync(resolve(PACKAGE_DIR, 'scene_vocabulary.csv'), csv(vocabRows, ['scene_title', 'topic_title', 'word', 'meaning', 'part_of_speech', 'phonetic_us', 'phonetic_uk', 'difficulty', 'description', 'examples_json', 'sort_order']))
  writeFileSync(resolve(PACKAGE_DIR, 'chunks.csv'), csv(chunkRows, ['scene_title', 'topic_title', 'category', 'text', 'meaning', 'difficulty', 'description', 'examples_json']))
  writeFileSync(resolve(PACKAGE_DIR, 'script_episodes.csv'), 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n')
  writeFileSync(resolve(PACKAGE_DIR, 'episode_chunks.csv'), 'episode_chapter,episode_order,chunk_text_match,sort_order\n')
  writeFileSync(resolve(PACKAGE_DIR, 'warmup_pipeline.json'), JSON.stringify(Object.fromEntries(scene.trainingTopics.map((topic) => [topic.title, {
    outputTraining: { enabled: true, version: 1, pipeline: [], materialUsage: { totals: { chunks: [], vocabs: [], patterns: [] }, usedRefs: { chunkIds: [], vocabIds: [], patternIds: [] }, itemStats: [] } },
  }])), null, 2) + '\n')

  console.log(`✅ 已导出 ${scene.title}：${scene.trainingTopics.length} 个话题，${vocabRows.length} 个词汇，${chunkRows.length} 个句块，${patternRows.length} 个句式`)
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
