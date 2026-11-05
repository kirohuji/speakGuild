/**
 * 在数据库 TrainingTopic.teachingMarkdown 与 apps/docs-md 之间同步教学文档。
 *
 *   pnpm docs:export              数据库 -> Markdown（会覆盖清单内的本地文件）
 *   pnpm docs:sync               Markdown -> 数据库
 *   pnpm docs:sync-learning      .learning.md -> 数据库（不更新教学正文）
 *   pnpm docs:sync -- --dry-run  只预览，不写数据库
 *   pnpm docs:sync -- --force    忽略数据库侧变化，以本地 Markdown 强制覆盖
 */
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { loadEnvFile } from 'process'
import { dirname, isAbsolute, relative, resolve, sep } from 'path'
import { Prisma, PrismaClient } from '@prisma/client'
import { dump, load } from 'js-yaml'

type Tx = Prisma.TransactionClient

const REPO_ROOT = resolve(__dirname, '../../..')
const DOCS_ROOT = resolve(REPO_ROOT, 'apps', 'docs-md')
const MANIFEST_PATH = resolve(DOCS_ROOT, '.teaching-docs.json')
const ENV_PATH = resolve(REPO_ROOT, '.env')

const CONTENT_MODE_DIRS = {
  practice: '学习包',
  listening: '听力包',
  reading: '阅读包',
  writing: '写作包',
} as const

type SupportedContentMode = keyof typeof CONTENT_MODE_DIRS

type ManifestDocument = {
  topicId: string
  sceneId: string
  contentMode: SupportedContentMode
  packageTitle: string
  topicTitle: string
  path: string
  exportedSha256: string
  learningPath?: string
  exportedLearningSha256?: string
}

type Manifest = {
  version: 1 | 2
  generatedAt: string
  documents: ManifestDocument[]
}

type ChunkModelConfig = {
  structure: string
  meaning: string
  examples: string[]
  notes: string[]
}

type LearningConfig = {
  vocabulary?: string[]
  chunks?: string[]
  patterns?: string[]
  chunkModels?: ChunkModelConfig[]
  exercises?: { enabled?: boolean; pipeline?: unknown[] }
}

type ParsedDocument = {
  teachingMarkdown: string
  learning?: LearningConfig
}

function normalizeMaterial(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

function normalizeModelText(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function stringList(value: unknown, field: string) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`learning.${field} 必须是非空字符串数组。`)
  }
  return [...new Map(value.map((item) => [normalizeMaterial(item), item.normalize('NFC').trim()])).values()]
}

function parseChunkModels(value: unknown, path: string): ChunkModelConfig[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new Error(`${path} 的 learning.chunk_models 必须是数组。`)

  const models: ChunkModelConfig[] = []
  const seen = new Set<string>()
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`${path} 的 learning.chunk_models[${index + 1}] 必须是对象。`)
    }
    const item = raw as Record<string, unknown>
    const structure = typeof item.structure === 'string' ? normalizeModelText(item.structure) : ''
    if (!structure) throw new Error(`${path} 的 learning.chunk_models[${index + 1}] 缺少 structure。`)
    const meaning = typeof item.meaning === 'string' ? normalizeModelText(item.meaning) : ''
    const examples = stringList(item.examples, `chunk_models[${index + 1}].examples`)
    if (!examples?.length) throw new Error(`${path} 的 learning.chunk_models[${index + 1}].examples 不能为空。`)
    const notes = item.notes === undefined
      ? []
      : stringList(item.notes, `chunk_models[${index + 1}].notes`) ?? []
    const key = `${structure}\0${meaning}`
    if (seen.has(key)) {
      throw new Error(`${path} 的 learning.chunk_models 存在重复项：structure="${structure}" meaning="${meaning}"。`)
    }
    seen.add(key)
    models.push({ structure, meaning, examples, notes })
  }
  return models
}

function parseDocument(content: string, path: string): ParsedDocument {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { teachingMarkdown: content }
  let frontmatter: unknown
  try {
    frontmatter = load(match[1])
  } catch (error) {
    throw new Error(`${path} 的 Front Matter 无法解析：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!frontmatter || typeof frontmatter !== 'object' || !('learning' in frontmatter)) {
    // 不是本同步器管理的 Front Matter，按原样作为教学正文处理。
    return { teachingMarkdown: content }
  }
  const learning = (frontmatter as { learning?: unknown }).learning
  if (!learning || typeof learning !== 'object' || Array.isArray(learning)) {
    throw new Error(`${path} 的 learning 必须是对象。`)
  }
  const raw = learning as Record<string, unknown>
  const exercises = raw.exercises
  if (exercises !== undefined && (!exercises || typeof exercises !== 'object' || Array.isArray(exercises))) {
    throw new Error(`${path} 的 learning.exercises 必须是对象。`)
  }
  const exerciseValue = exercises as Record<string, unknown> | undefined
  if (exerciseValue?.enabled !== undefined && typeof exerciseValue.enabled !== 'boolean') {
    throw new Error(`${path} 的 learning.exercises.enabled 必须是布尔值。`)
  }
  if (exerciseValue?.pipeline !== undefined && !Array.isArray(exerciseValue.pipeline)) {
    throw new Error(`${path} 的 learning.exercises.pipeline 必须是数组。`)
  }
  return {
    teachingMarkdown: content.slice(match[0].length),
    learning: {
      vocabulary: stringList(raw.vocabulary, 'vocabulary'),
      chunks: stringList(raw.chunks, 'chunks'),
      patterns: stringList(raw.patterns, 'patterns'),
      chunkModels: parseChunkModels(raw.chunk_models, path),
      exercises: exerciseValue ? { enabled: exerciseValue.enabled as boolean | undefined, pipeline: exerciseValue.pipeline as unknown[] | undefined } : undefined,
    },
  }
}

function outputTrainingFromMetadata(metadata: unknown) {
  const value = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {}
  const outputTraining = value.outputTraining
  if (!outputTraining || typeof outputTraining !== 'object' || Array.isArray(outputTraining)) return { enabled: true, pipeline: [] as unknown[] }
  const training = outputTraining as Record<string, unknown>
  return {
    enabled: training.enabled !== false,
    pipeline: Array.isArray(training.pipeline) ? training.pipeline : [],
  }
}

const PIPELINE_TYPES = new Set(['chunk_substitution', 'vocab_drill', 'vn_dialogue', 'vocab_sentence_building', 'sentence_decomposition', 'pattern_drill'])

function pipelineForDocument(topicId: string, pipeline: unknown[]) {
  return pipeline.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
    const item = raw as Record<string, unknown>
    const stablePrefix = `md:${topicId}:`
    const key = typeof item.id === 'string' && item.id.trim()
      ? (item.id.startsWith(stablePrefix) ? item.id.slice(stablePrefix.length) : item.id.trim())
      : `item-${index + 1}`
    const { id: _id, ...rest } = item
    return { key, ...rest }
  })
}

function materializePipeline(topicId: string, pipeline: unknown[], path: string) {
  const keys = new Set<string>()
  return pipeline.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${path} 的第 ${index + 1} 个练习组必须是对象。`)
    const item = raw as Record<string, unknown>
    const key = typeof item.key === 'string' ? item.key.trim() : ''
    const type = typeof item.type === 'string' ? item.type : ''
    if (!key || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(key)) throw new Error(`${path} 的第 ${index + 1} 个练习组缺少合法 key（仅字母、数字、_、-）。`)
    if (keys.has(key)) throw new Error(`${path} 的练习组 key 重复：${key}`)
    if (!PIPELINE_TYPES.has(type)) throw new Error(`${path} 的练习题型不支持：${type || '未填写'}`)
    keys.add(key)
    const { key: _key, ...rest } = item
    return { ...rest, id: `md:${topicId}:${key}` }
  })
}

function learningConfigForYaml(learning: LearningConfig) {
  const payload: Record<string, unknown> = {}
  if (learning.vocabulary !== undefined) payload.vocabulary = learning.vocabulary
  if (learning.chunks !== undefined) payload.chunks = learning.chunks
  if (learning.patterns !== undefined) payload.patterns = learning.patterns
  if (learning.chunkModels !== undefined) {
    payload.chunk_models = learning.chunkModels.map((model) => {
      const item: Record<string, unknown> = {
        structure: model.structure,
        examples: model.examples,
      }
      if (model.meaning) item.meaning = model.meaning
      if (model.notes.length) item.notes = model.notes
      return item
    })
  }
  if (learning.exercises !== undefined) payload.exercises = learning.exercises
  return payload
}

function documentWithLearningConfig(learning: LearningConfig) {
  const frontmatter = dump({ learning: learningConfigForYaml(learning) }, { noRefs: true, lineWidth: -1, quotingType: '"', forceQuotes: false })
  return `---\n${frontmatter}---\n`
}

type TopicLearningSnapshot = {
  topicVocabs: Array<{ vocab: { word: string } }>
  activeChunks: Array<{ chunk: { text: string } }>
  topicPatterns: Array<{ pattern: { pattern: string } }>
  topicChunkModels: Array<{
    chunkModel: {
      structure: string
      meaning: string
      notes: string[]
      examples: Array<{ chunk: { text: string }; sortOrder: number }>
    }
  }>
  metadata: unknown
}

function learningConfigFromTopic(topic: TopicLearningSnapshot, topicId: string): LearningConfig {
  const chunkModels = topic.topicChunkModels.map(({ chunkModel }) => ({
    structure: chunkModel.structure,
    meaning: chunkModel.meaning,
    notes: chunkModel.notes,
    examples: [...chunkModel.examples]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => item.chunk.text),
  }))
  return {
    vocabulary: topic.topicVocabs.map((item) => item.vocab.word),
    chunks: topic.activeChunks.map((item) => item.chunk.text),
    patterns: topic.topicPatterns.map((item) => item.pattern.pattern),
    // 无模型时不写出字段，避免空数组改变既有 .learning.md 哈希。
    chunkModels: chunkModels.length ? chunkModels : undefined,
    exercises: {
      ...outputTrainingFromMetadata(topic.metadata),
      pipeline: pipelineForDocument(topicId, outputTrainingFromMetadata(topic.metadata).pipeline),
    },
  }
}

const topicLearningSelect = {
  topicVocabs: { select: { sortOrder: true, vocab: { select: { word: true } } }, orderBy: { sortOrder: 'asc' as const } },
  activeChunks: { select: { sortOrder: true, chunk: { select: { text: true } } }, orderBy: { sortOrder: 'asc' as const } },
  topicPatterns: { select: { sortOrder: true, pattern: { select: { pattern: true } } }, orderBy: { sortOrder: 'asc' as const } },
  topicChunkModels: {
    select: {
      sortOrder: true,
      chunkModel: {
        select: {
          structure: true,
          meaning: true,
          notes: true,
          examples: {
            select: { sortOrder: true, chunk: { select: { text: true } } },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const

function loadRootEnv() {
  if (!process.env.DATABASE_URL && existsSync(ENV_PATH)) loadEnvFile(ENV_PATH)
  if (!process.env.DATABASE_URL) {
    throw new Error(`缺少 DATABASE_URL。请在 ${ENV_PATH} 中配置，或在命令行环境中传入。`)
  }
}

function sha256(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function safePathSegment(value: string, fallback: string) {
  const cleaned = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  const usable = cleaned || fallback
  const shortened = usable.slice(0, 120).replace(/[. ]+$/g, '') || fallback
  return reserved.test(shortened) ? `${shortened}_` : shortened
}

function toManifestPath(absolutePath: string) {
  return relative(DOCS_ROOT, absolutePath).split(sep).join('/')
}

function resolveManifestPath(manifestPath: string) {
  const absolutePath = resolve(DOCS_ROOT, ...manifestPath.split('/'))
  const relativePath = relative(DOCS_ROOT, absolutePath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`清单包含 docs-md 目录之外的路径：${manifestPath}`)
  }
  return absolutePath
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`找不到 ${MANIFEST_PATH}，请先运行 pnpm docs:export。`)
  }
  const value = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Partial<Manifest>
  if ((value.version !== 1 && value.version !== 2) || !Array.isArray(value.documents)) {
    throw new Error('教学文档清单格式无效，请重新运行 pnpm docs:export。')
  }
  return value as Manifest
}

function uniqueDocumentPath(
  usedPaths: Set<string>,
  mode: SupportedContentMode,
  packageTitle: string,
  topicTitle: string,
  topicId: string,
) {
  const directory = resolve(
    DOCS_ROOT,
    CONTENT_MODE_DIRS[mode],
    safePathSegment(packageTitle, `未命名学习包-${topicId.slice(-6)}`),
  )
  const baseName = safePathSegment(topicTitle, `未命名话题-${topicId.slice(-6)}`)
  let absolutePath = resolve(directory, `${baseName}.md`)
  let key = absolutePath.toLocaleLowerCase('en-US')
  if (usedPaths.has(key)) {
    absolutePath = resolve(directory, `${baseName}-${topicId.slice(-6)}.md`)
    key = absolutePath.toLocaleLowerCase('en-US')
  }
  usedPaths.add(key)
  return absolutePath
}

async function exportDocuments(prisma: PrismaClient, learningOnly = false) {
  const existingManifest = learningOnly ? readManifest() : null
  const manifestByTopicId = new Map(existingManifest?.documents.map((document) => [document.topicId, document]))
  const topics = await prisma.trainingTopic.findMany({
    where: learningOnly
      ? { id: { in: existingManifest!.documents.map((document) => document.topicId) } }
      : { scene: { contentMode: { in: Object.keys(CONTENT_MODE_DIRS) as SupportedContentMode[] } } },
    select: {
      id: true,
      title: true,
      teachingMarkdown: true,
      metadata: true,
      ...topicLearningSelect,
      scene: { select: { id: true, title: true, contentMode: true, sortOrder: true } },
    },
    orderBy: [{ scene: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const usedPaths = new Set<string>()
  const documents: ManifestDocument[] = []
  for (const topic of topics) {
    const mode = topic.scene.contentMode as SupportedContentMode
    const existingDocument = manifestByTopicId.get(topic.id)
    const absolutePath = existingDocument
      ? resolveManifestPath(existingDocument.path)
      : uniqueDocumentPath(usedPaths, mode, topic.scene.title, topic.title, topic.id)
    const content = topic.teachingMarkdown ?? ''
    const learningContent = documentWithLearningConfig(learningConfigFromTopic(topic, topic.id))
    const learningAbsolutePath = absolutePath.replace(/\.md$/i, '.learning.md')
    mkdirSync(dirname(absolutePath), { recursive: true })
    if (!learningOnly) writeFileSync(absolutePath, content, 'utf8')
    writeFileSync(learningAbsolutePath, learningContent, 'utf8')
    documents.push({
      topicId: topic.id,
      sceneId: topic.scene.id,
      contentMode: mode,
      packageTitle: topic.scene.title,
      topicTitle: topic.title,
      path: toManifestPath(absolutePath),
      // 仅导出 learning 时保留教学文档上一次的冲突基准，绝不把数据库正文当作本地版本覆盖。
      exportedSha256: learningOnly ? existingDocument!.exportedSha256 : sha256(content),
      learningPath: toManifestPath(learningAbsolutePath),
      exportedLearningSha256: sha256(learningContent),
    })
  }

  const manifest: Manifest = { version: 2, generatedAt: new Date().toISOString(), documents }
  mkdirSync(DOCS_ROOT, { recursive: true })
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const nonEmpty = topics.filter((topic) => Boolean(topic.teachingMarkdown?.trim())).length
  console.log(learningOnly
    ? `已导出 ${documents.length} 份学习配置（未修改教学正文）。`
    : `已导出 ${documents.length} 份教学文档（${nonEmpty} 份有内容，${documents.length - nonEmpty} 份为空）。`)
  console.log(`目录：${DOCS_ROOT}`)
}

/** 批量按大小写不敏感匹配已有材料，缺失的一次 createMany，再按原列表顺序返回 id。 */
async function resolveMaterialIds(
  values: string[],
  label: string,
  findMany: (values: string[]) => Promise<Array<{ id: string; key: string }>>,
  createMissing: (missing: string[]) => Promise<void>,
) {
  if (!values.length) return [] as string[]

  const toMap = (rows: Array<{ id: string; key: string }>) => {
    const map = new Map<string, string>()
    for (const row of rows) map.set(normalizeMaterial(row.key), row.id)
    return map
  }

  let byKey = toMap(await findMany(values))
  const missing = values.filter((value) => !byKey.has(normalizeMaterial(value)))
  if (missing.length) {
    await createMissing(missing)
    byKey = toMap(await findMany(values))
  }

  return values.map((value) => {
    const id = byKey.get(normalizeMaterial(value))
    if (!id) throw new Error(`未能解析${label}：${value}`)
    return id
  })
}

async function syncChunkModels(tx: Tx, topicId: string, models: ChunkModelConfig[], path: string) {
  await tx.trainingTopicChunkModel.deleteMany({ where: { topicId } })
  if (!models.length) return

  const exampleTexts = [...new Map(
    models.flatMap((model) => model.examples).map((text) => [normalizeMaterial(text), text]),
  ).values()]
  const exampleChunkIds = await resolveMaterialIds(
    exampleTexts,
    'Chunk Model 示例',
    async (texts) => {
      const rows = await tx.chunk.findMany({
        where: { OR: texts.map((text) => ({ text: { equals: text, mode: 'insensitive' } })) },
        select: { id: true, text: true },
      })
      return rows.map((row) => ({ id: row.id, key: row.text }))
    },
    async (missing) => {
      throw new Error(`${path} 的 chunk_models.examples 找不到已有 Chunk：${missing.join('、')}。请先写入同文件 chunks 或确保库中已有对应 Chunk。`)
    },
  )
  const chunkIdByText = new Map(exampleTexts.map((text, index) => [normalizeMaterial(text), exampleChunkIds[index]]))

  const modelIds: string[] = []
  for (const model of models) {
    const existing = await tx.chunkModel.findUnique({
      where: { structure_meaning: { structure: model.structure, meaning: model.meaning } },
      select: { id: true },
    })
    const chunkModel = existing
      ? await tx.chunkModel.update({
          where: { id: existing.id },
          data: { notes: model.notes },
          select: { id: true },
        })
      : await tx.chunkModel.create({
          data: { structure: model.structure, meaning: model.meaning, notes: model.notes },
          select: { id: true },
        })

    await tx.chunkModelExample.deleteMany({ where: { chunkModelId: chunkModel.id } })
    const exampleIds = model.examples.map((text) => {
      const chunkId = chunkIdByText.get(normalizeMaterial(text))
      if (!chunkId) throw new Error(`${path} 的 chunk_models.examples 未能解析 Chunk：${text}`)
      return chunkId
    })
    if (exampleIds.length) {
      await tx.chunkModelExample.createMany({
        data: exampleIds.map((chunkId, sortOrder) => ({ chunkModelId: chunkModel.id, chunkId, sortOrder })),
        skipDuplicates: true,
      })
    }
    modelIds.push(chunkModel.id)
  }

  await tx.trainingTopicChunkModel.createMany({
    data: modelIds.map((chunkModelId, sortOrder) => ({ topicId, chunkModelId, sortOrder })),
  })
}

async function syncLearningConfig(tx: Tx, topicId: string, config: LearningConfig, path: string) {
  // 某区块未声明时不触碰现有数据；声明为空数组则明确清空对应话题关联。
  if (config.vocabulary !== undefined) {
    const ids = await resolveMaterialIds(
      config.vocabulary,
      '词汇',
      async (words) => {
        const rows = await tx.vocabulary.findMany({
          where: { OR: words.map((word) => ({ word: { equals: word, mode: 'insensitive' } })) },
          select: { id: true, word: true },
        })
        return rows.map((row) => ({ id: row.id, key: row.word }))
      },
      async (missing) => {
        await tx.vocabulary.createMany({
          data: missing.map((word) => ({ word, meaning: '待补充' })),
          skipDuplicates: true,
        })
      },
    )
    await tx.trainingTopicVocab.deleteMany({ where: { topicId } })
    if (ids.length) await tx.trainingTopicVocab.createMany({ data: ids.map((vocabId, sortOrder) => ({ topicId, vocabId, sortOrder })) })
  }
  if (config.chunks !== undefined) {
    const ids = await resolveMaterialIds(
      config.chunks,
      'Chunk',
      async (texts) => {
        const rows = await tx.chunk.findMany({
          where: { OR: texts.map((text) => ({ text: { equals: text, mode: 'insensitive' } })) },
          select: { id: true, text: true },
        })
        return rows.map((row) => ({ id: row.id, key: row.text }))
      },
      async (missing) => {
        await tx.chunk.createMany({
          data: missing.map((text) => ({ text, meaning: '待补充', category: 'general' })),
          skipDuplicates: true,
        })
      },
    )
    await tx.trainingTopicChunk.deleteMany({ where: { topicId } })
    if (ids.length) await tx.trainingTopicChunk.createMany({ data: ids.map((chunkId, sortOrder) => ({ topicId, chunkId, sortOrder })) })
  }
  if (config.patterns !== undefined) {
    const ids = await resolveMaterialIds(
      config.patterns,
      '句型',
      async (patterns) => {
        const rows = await tx.sentencePattern.findMany({
          where: { OR: patterns.map((pattern) => ({ pattern: { equals: pattern, mode: 'insensitive' } })) },
          select: { id: true, pattern: true },
        })
        return rows.map((row) => ({ id: row.id, key: row.pattern }))
      },
      async (missing) => {
        await tx.sentencePattern.createMany({
          data: missing.map((pattern) => ({ pattern })),
          skipDuplicates: true,
        })
      },
    )
    await tx.trainingTopicSentencePattern.deleteMany({ where: { topicId } })
    if (ids.length) await tx.trainingTopicSentencePattern.createMany({ data: ids.map((patternId, sortOrder) => ({ topicId, patternId, sortOrder })) })
  }
  if (config.chunkModels !== undefined) {
    await syncChunkModels(tx, topicId, config.chunkModels, path)
  }
  if (config.exercises !== undefined) {
    const topic = await tx.trainingTopic.findUniqueOrThrow({ where: { id: topicId }, select: { metadata: true } })
    const metadata = topic.metadata && typeof topic.metadata === 'object' && !Array.isArray(topic.metadata) ? topic.metadata as Record<string, unknown> : {}
    const previous = outputTrainingFromMetadata(metadata)
    await tx.trainingTopic.update({
      where: { id: topicId },
      data: { metadata: { ...metadata, outputTraining: { version: 1, enabled: config.exercises.enabled ?? previous.enabled, pipeline: config.exercises.pipeline ? materializePipeline(topicId, config.exercises.pipeline, path) : previous.pipeline } } },
    })
  }
}

async function syncDocuments(prisma: PrismaClient, dryRun: boolean, force: boolean, learningOnly = false) {
  const manifest = readManifest()
  const missing: string[] = []
  const changed: Array<ManifestDocument & { content: string; learning?: LearningConfig; learningContent?: string }> = []
  const databaseChanged: string[] = []
  const conflicts: string[] = []
  let unchanged = 0

  const databaseTopics = await prisma.trainingTopic.findMany({
    where: { id: { in: manifest.documents.map((document) => document.topicId) } },
    select: {
      id: true, sceneId: true, teachingMarkdown: true, metadata: true,
      ...topicLearningSelect,
    },
  })
  const topicById = new Map(databaseTopics.map((topic) => [topic.id, topic]))

  for (const document of manifest.documents) {
    const absolutePath = resolveManifestPath(document.path)
    const learningAbsolutePath = document.learningPath ? resolveManifestPath(document.learningPath) : null
    const requiredPath = learningOnly ? learningAbsolutePath : absolutePath
    if (!requiredPath || !existsSync(requiredPath)) {
      missing.push(learningOnly ? (document.learningPath ?? `${document.path}（缺少 learningPath）`) : document.path)
      continue
    }
    const topic = topicById.get(document.topicId)
    if (!topic) throw new Error(`数据库中找不到话题 ${document.topicId}（${document.path}）。请重新导出清单。`)
    if (topic.sceneId !== document.sceneId) {
      throw new Error(`话题所属学习包已变化：${document.path}。请重新运行 pnpm docs:export。`)
    }
    const content = learningOnly ? (topic.teachingMarkdown ?? '') : readFileSync(absolutePath, 'utf8')
    const learningContent = learningAbsolutePath && existsSync(learningAbsolutePath) ? readFileSync(learningAbsolutePath, 'utf8') : undefined
    const learning = learningContent === undefined ? undefined : parseDocument(learningContent, document.learningPath!).learning
    if (learningContent !== undefined && !learning) throw new Error(`${document.learningPath} 缺少 learning Front Matter。`)
    if (learning?.exercises?.pipeline) materializePipeline(document.topicId, learning.exercises.pipeline, document.learningPath!)
    const databaseLearningContent = learning
      ? documentWithLearningConfig(learningConfigFromTopic(topic, topic.id))
      : undefined
    const localHash = sha256(content)
    const databaseHash = sha256(topic.teachingMarkdown ?? '')
    const learningLocalHash = learningContent === undefined ? undefined : sha256(learningContent)
    const learningDatabaseHash = databaseLearningContent === undefined ? undefined : sha256(databaseLearningContent)
    const localChanged = learningOnly
      ? learningLocalHash !== learningDatabaseHash
      : localHash !== databaseHash || (learningLocalHash !== undefined && learningLocalHash !== learningDatabaseHash)
    const dbChanged = learningOnly
      ? learningDatabaseHash !== undefined && document.exportedLearningSha256 !== undefined && learningDatabaseHash !== document.exportedLearningSha256
      : databaseHash !== document.exportedSha256 || (learningDatabaseHash !== undefined && document.exportedLearningSha256 !== undefined && learningDatabaseHash !== document.exportedLearningSha256)
    const localMatchesExport = learningOnly
      ? learningLocalHash !== undefined && learningLocalHash === document.exportedLearningSha256
      : localHash === document.exportedSha256 && (learningLocalHash === undefined || learningLocalHash === document.exportedLearningSha256)
    if (!localChanged) unchanged++
    else if (force || !dbChanged) changed.push({ ...document, content, learning, learningContent })
    else if (localMatchesExport) databaseChanged.push(document.path)
    else conflicts.push(document.path)
  }

  if (missing.length) {
    console.warn(`跳过 ${missing.length} 个已从本地删除的文件（不会清空数据库）：`)
    missing.forEach((path) => console.warn(`  - ${path}`))
  }

  if (databaseChanged.length) {
    console.warn(`跳过 ${databaseChanged.length} 份仅数据库有新改动的文档，请先重新导出后再编辑：`)
    databaseChanged.forEach((path) => console.warn(`  - ${path}`))
  }

  if (conflicts.length) {
    console.error(`发现 ${conflicts.length} 份本地和数据库都已修改的冲突文档：`)
    conflicts.forEach((path) => console.error(`  - ${path}`))
    throw new Error('同步已取消，数据库未写入。请先备份本地改动并重新导出，再合并冲突内容。')
  }

  if (dryRun) {
    console.log(`${force ? '强制覆盖预览' : '预览'}：将更新 ${changed.length} 份${learningOnly ? '学习配置' : '文档'}，未变化 ${unchanged} 份，仅数据库变化 ${databaseChanged.length} 份，缺失 ${missing.length} 份。`)
    changed.forEach((document) => console.log(`  - ${document.path}`))
    return
  }

  if (changed.length) {
    console.log(`${force ? '强制覆盖' : '即将更新'} ${changed.length} 份${learningOnly ? '学习配置（不更新教学正文）' : '教学文档'}：`)
    changed.forEach((document) => console.log(`  - ${document.path}`))
    await prisma.$transaction(
      async (tx) => {
        for (const document of changed) {
          if (!learningOnly) await tx.trainingTopic.update({ where: { id: document.topicId }, data: { teachingMarkdown: document.content } })
          if (document.learning) await syncLearningConfig(tx, document.topicId, document.learning, document.learningPath ?? document.path)
        }
      },
      // 材料已批量查找/创建，但仍保留足够超时以覆盖多文档原子写入。
      { maxWait: 10_000, timeout: 180_000 },
    )
    const changedById = new Map(changed.map((document) => [document.topicId, { teaching: sha256(document.content), learning: document.learningContent ? sha256(document.learningContent) : undefined }]))
    manifest.documents = manifest.documents.map((document) => ({
      ...document,
      exportedSha256: learningOnly ? document.exportedSha256 : changedById.get(document.topicId)?.teaching ?? document.exportedSha256,
      exportedLearningSha256: changedById.get(document.topicId)?.learning ?? document.exportedLearningSha256,
    }))
    manifest.generatedAt = new Date().toISOString()
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }
  console.log(`同步完成：更新 ${changed.length} 份${learningOnly ? '学习配置' : '文档'}，未变化 ${unchanged} 份，仅数据库变化并跳过 ${databaseChanged.length} 份，缺失并跳过 ${missing.length} 份。`)
}

async function main() {
  const command = process.argv.slice(2).find((argument) => argument === 'export' || argument === 'export-learning' || argument === 'sync' || argument === 'sync-learning')
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')
  if (!command) throw new Error('用法：sync-teaching-docs.ts <export|export-learning|sync|sync-learning> [--dry-run] [--force]')
  if ((command === 'export' || command === 'export-learning') && dryRun) throw new Error('export 命令不支持 --dry-run。')
  if ((command === 'export' || command === 'export-learning') && force) throw new Error('export 命令不支持 --force。')

  loadRootEnv()
  const prisma = new PrismaClient()
  try {
    if (command === 'export' || command === 'export-learning') await exportDocuments(prisma, command === 'export-learning')
    else await syncDocuments(prisma, dryRun, force, command === 'sync-learning')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
