import type { TrainingTopicItem, UnitDetail } from '@/features/learning/api/learning-api'
import { localDb } from './unified-storage'
import { learningContentRepository } from './learning-content.repository'
import { buildWarmupPracticeItemIds } from './warmup-practice-item-id'

export const PACK_PROJECTION_VERSION = 1
const PAGE_LIMIT = 100

export type ContentKind = 'vocab' | 'chunk' | 'pattern'
export type RowKind = 'summary' | 'scene' | 'card' | 'teaching' | 'pipeline'

type TopicSource = {
  topic: any
  vocabularies?: any[]
  activeChunks?: any[]
  chunks?: any[]
  sentencePatterns?: any[]
  teachingMarkdown?: string | null
}

export type PackReadModel = {
  rows: Array<Record<string, any> & { id: string }>
  topicCount: number
  practiceItemIds: string[]
}

const migrations = new Map<string, Promise<boolean>>()

export function unitSummaryId(unitId: string) {
  return `unit:${unitId}:summary`
}

export function unitSceneId(unitId: string) {
  return `unit:${unitId}:scene`
}

export function topicCardId(topicId: string) {
  return `topic:${topicId}:card`
}

export function topicTeachingId(topicId: string) {
  return `topic:${topicId}:teaching`
}

export function topicPipelineId(topicId: string) {
  return `topic:${topicId}:pipeline`
}

function topicSource(raw: any): TopicSource {
  const detail = raw?.detail ?? raw ?? {}
  return {
    topic: detail.topic ?? detail,
    vocabularies: detail.vocabularies,
    activeChunks: detail.activeChunks ?? detail.chunks,
    sentencePatterns: detail.sentencePatterns,
    teachingMarkdown: detail.teachingMarkdown ?? detail.topic?.teachingMarkdown,
  }
}

function pipelineMetadata(topic: any) {
  const metadata = topic?.metadata ?? {}
  return {
    outputTraining: metadata.outputTraining,
    pipeline: metadata.pipeline,
    enabled: metadata.enabled,
  }
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

export function buildPackReadModel(unitDetail: any, topicDetails: any[]): PackReadModel {
  const unitId = unitDetail?.id
  const topics = (topicDetails ?? []).map(topicSource).filter((item) => item.topic?.id)
  const cards: PackReadModel['rows'] = []
  const extraRows: PackReadModel['rows'] = []
  const practiceItemIds: string[] = []
  const teachingTopicIds: string[] = []

  topics.forEach((source, index) => {
    const topic = source.topic
    const topicId = topic.id
    const itemIds = buildWarmupPracticeItemIds(unitId, [{ id: topicId, metadata: topic.metadata }])
    practiceItemIds.push(...itemIds)
    const hasTeachingDocument = hasText(source.teachingMarkdown)
    if (hasTeachingDocument) teachingTopicIds.push(topicId)
    const vocabularies = source.vocabularies ?? []
    const chunks = source.activeChunks ?? []
    const patterns = source.sentencePatterns ?? []

    cards.push({
      id: topicCardId(topicId),
      unitId,
      topicId,
      rowKind: 'card' satisfies RowKind,
      sortOrder: index,
      title: topic.title ?? '',
      description: topic.description ?? null,
      promptEn: topic.promptEn ?? '',
      promptZh: topic.promptZh ?? '',
      difficulty: topic.difficulty ?? '',
      suggestedDurationSec: topic.suggestedDurationSec ?? 0,
      activityType: topic.activityType ?? null,
      mediaUrl: topic.mediaUrl ?? null,
      mediaAssetId: topic.mediaAssetId ?? null,
      knowledgePoints: topic.knowledgePoints ?? null,
      inkScriptId: topic.inkScriptId ?? null,
      hasTeachingDocument,
      practiceItemIds: itemIds,
      vocabCount: vocabularies.length,
      chunkCount: chunks.length,
      patternCount: patterns.length,
    })

    const teaching = {
      teachingMarkdown: hasTeachingDocument ? source.teachingMarkdown : '',
      contentConfig: topic.contentConfig ?? null,
      transcript: topic.transcript ?? null,
    }
    if (hasTeachingDocument || teaching.contentConfig || teaching.transcript) {
      extraRows.push({
        id: topicTeachingId(topicId),
        unitId,
        topicId,
        rowKind: 'teaching' satisfies RowKind,
        sortOrder: index,
        ...teaching,
      })
    }

    const metadata = pipelineMetadata(topic)
    if (metadata.outputTraining || metadata.pipeline) {
      extraRows.push({
        id: topicPipelineId(topicId),
        unitId,
        topicId,
        rowKind: 'pipeline' satisfies RowKind,
        sortOrder: index,
        metadata,
      })
    }
  })

  const vocabCount = new Set(topics.flatMap((source) => (source.vocabularies ?? []).map((item) => item?.id).filter(Boolean))).size
    || (unitDetail?.vocabularies?.length ?? 0)
  const chunkCount = new Set(topics.flatMap((source) => (source.activeChunks ?? []).map((item) => item?.id).filter(Boolean))).size
    || (unitDetail?.chunks?.length ?? 0)
  const patternCount = new Set(topics.flatMap((source) => (source.sentencePatterns ?? []).map((item) => item?.id ?? item?.pattern).filter(Boolean))).size
    || (unitDetail?.sentencePatterns?.length ?? 0)

  const summary = {
    id: unitSummaryId(unitId),
    unitId,
    packId: unitId,
    rowKind: 'summary' satisfies RowKind,
    sortOrder: 0,
    projectionVersion: PACK_PROJECTION_VERSION,
    version: unitDetail?.version ?? null,
    title: unitDetail?.title ?? '',
    description: unitDetail?.description ?? null,
    coverImage: unitDetail?.coverImage ?? null,
    category: unitDetail?.category ?? '',
    location: unitDetail?.location ?? '',
    contentMode: unitDetail?.contentMode ?? null,
    packageType: unitDetail?.packageType ?? null,
    requiredOutputLevel: unitDetail?.requiredOutputLevel ?? '',
    requiredUserLevel: unitDetail?.requiredUserLevel ?? 0,
    prerequisites: unitDetail?.prerequisites ?? [],
    firstEpisode: unitDetail?.firstEpisode ?? null,
    storyEpisodes: unitDetail?.storyEpisodes ?? [],
    nqtrChapters: (unitDetail?.offlineNqtrBundle?.chapters ?? []).map((chapter: any) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary ?? null,
      teachingMarkdown: chapter.teachingMarkdown ?? null,
      hasTeachingDocument: Boolean(chapter.hasTeachingDocument || chapter.teachingMarkdown?.trim()),
      sortOrder: chapter.sortOrder ?? 0,
    })),
    offlineNqtrBundle: unitDetail?.offlineNqtrBundle ?? null,
    novelPackage: unitDetail?.novelPackage ?? null,
    scriptCount: unitDetail?.scriptCount ?? 0,
    vocabCount,
    chunkCount,
    patternCount,
    topicCount: cards.length,
    practiceItemIds,
    practiceItemCount: practiceItemIds.length,
    teachingTopicIds,
    hasTeachingTopics: teachingTopicIds.length > 0,
    hasActivityTasks: topics.some((source) => source.topic.activityType && source.topic.activityType !== 'practice'),
    hasNovelContent: unitDetail?.contentMode === 'novel',
  }

  const scene = {
    id: unitSceneId(unitId),
    unitId,
    rowKind: 'scene' satisfies RowKind,
    sortOrder: 0,
    scene: unitDetail?.scene ?? null,
    offlineStoryEpisodePlayers: unitDetail?.offlineStoryEpisodePlayers ?? [],
    offlineNqtrBundle: unitDetail?.offlineNqtrBundle ?? null,
  }

  return {
    rows: [summary, scene, ...cards, ...extraRows],
    topicCount: cards.length,
    practiceItemIds,
  }
}

export async function writePackProjection(unitDetail: any, topicDetails: any[]) {
  const projection = buildPackReadModel(unitDetail, topicDetails)
  const unitId = unitDetail.id
  await localDb.deleteByIndex('downloaded_unit_details', 'unit_id', unitId)
  await localDb.delete('downloaded_unit_details', unitId)
  await localDb.putMany('downloaded_unit_details', projection.rows)
  return projection
}

async function listKind(unitId: string, rowKind: RowKind) {
  const rows: any[] = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  while (offset < total) {
    const filters = [
      { column: 'unit_id', value: unitId },
      { column: 'row_kind', value: rowKind },
    ]
    const [page, count] = await Promise.all([
      localDb.listPage<any>('downloaded_unit_details', {
        filters,
        orderBy: [{ column: 'sort_order', direction: 'asc' }],
        limit: PAGE_LIMIT,
        offset,
      }),
      offset === 0 ? localDb.countWhere('downloaded_unit_details', filters) : Promise.resolve(total),
    ])
    total = count
    rows.push(...page)
    if (page.length < PAGE_LIMIT) break
    offset += PAGE_LIMIT
  }
  return rows
}

function cardToTopic(card: any): TrainingTopicItem & { hasTeachingDocument?: boolean; vocabCount?: number; chunkCount?: number; patternCount?: number; practiceItemIds?: string[] } {
  return {
    id: card.topicId,
    title: card.title ?? '',
    description: card.description ?? null,
    promptEn: card.promptEn ?? '',
    promptZh: card.promptZh ?? '',
    difficulty: card.difficulty ?? '',
    suggestedDurationSec: card.suggestedDurationSec ?? 0,
    activityType: card.activityType ?? undefined,
    mediaUrl: card.mediaUrl ?? null,
    mediaAssetId: card.mediaAssetId ?? null,
    knowledgePoints: card.knowledgePoints ?? undefined,
    hasTeachingDocument: Boolean(card.hasTeachingDocument),
    vocabCount: card.vocabCount ?? 0,
    chunkCount: card.chunkCount ?? 0,
    patternCount: card.patternCount ?? 0,
    practiceItemIds: card.practiceItemIds ?? [],
    activeChunks: [],
    vocabularies: [],
    sentencePatterns: [],
  } as TrainingTopicItem & { hasTeachingDocument?: boolean }
}

function summaryToShell(summary: any, cards: any[]): UnitDetail & { __offlineProjection: true; patternCount: number; practiceItemCount: number; hasActivityTasks: boolean } {
  return {
    id: summary.unitId,
    title: summary.title ?? '',
    description: summary.description ?? null,
    coverImage: summary.coverImage ?? null,
    category: summary.category ?? '',
    location: summary.location ?? '',
    contentMode: summary.contentMode ?? undefined,
    packageType: summary.packageType ?? undefined,
    requiredOutputLevel: summary.requiredOutputLevel ?? '',
    requiredUserLevel: summary.requiredUserLevel ?? 0,
    prerequisites: summary.prerequisites ?? [],
    progress: null,
    firstEpisode: summary.firstEpisode ?? null,
    storyEpisodes: summary.storyEpisodes ?? [],
    nqtrChapters: summary.nqtrChapters ?? [],
    offlineNqtrBundle: summary.offlineNqtrBundle ?? null,
    novelPackage: summary.novelPackage ?? undefined,
    scriptCount: summary.scriptCount ?? 0,
    vocabCount: summary.vocabCount ?? 0,
    chunkCount: summary.chunkCount ?? 0,
    patternCount: summary.patternCount ?? 0,
    topicCount: summary.topicCount ?? cards.length,
    practiceItemCount: summary.practiceItemCount ?? summary.practiceItemIds?.length ?? 0,
    practiceItemIds: summary.practiceItemIds ?? [],
    teachingTopicIds: summary.teachingTopicIds ?? [],
    hasTeachingTopics: Boolean(summary.hasTeachingTopics),
    hasActivityTasks: Boolean(summary.hasActivityTasks),
    hasNovelContent: Boolean(summary.hasNovelContent),
    vocabularies: [],
    chunks: [],
    sentencePatterns: [],
    trainingTopics: cards.map(cardToTopic),
    __offlineProjection: true,
  } as UnitDetail & { __offlineProjection: true; patternCount: number; practiceItemCount: number; hasActivityTasks: boolean }
}

export async function readUnitSummary(unitId: string) {
  const summary = await localDb.get<any>('downloaded_unit_details', unitSummaryId(unitId))
  if (summary?.rowKind !== 'summary' || summary.projectionVersion !== PACK_PROJECTION_VERSION) return null
  return summary
}

export async function readUnitShell(unitId: string) {
  const summary = await readUnitSummary(unitId)
  if (!summary) return null
  const cards = await listKind(unitId, 'card')
  return summaryToShell(summary, cards)
}

export async function readUnitScene(unitId: string) {
  const row = await localDb.get<any>('downloaded_unit_details', unitSceneId(unitId))
  if (row?.rowKind !== 'scene') return null
  return row
}

export async function readTopicCard(topicId: string) {
  const card = await localDb.get<any>('downloaded_unit_details', topicCardId(topicId))
  if (card?.rowKind !== 'card') return null
  return card
}

export async function readTopicTeaching(topicId: string) {
  const row = await localDb.get<any>('downloaded_unit_details', topicTeachingId(topicId))
  if (row?.rowKind !== 'teaching') return null
  return row
}

export async function readTopicPipeline(topicId: string) {
  const row = await localDb.get<any>('downloaded_unit_details', topicPipelineId(topicId))
  if (row?.rowKind !== 'pipeline') return null
  return row
}

export async function readTopicPrep(topicId: string) {
  const card = await readTopicCard(topicId)
  if (!card?.unitId) return null
  const scene = await readUnitScene(card.unitId)
  return {
    __offlineProjection: true,
    topic: {
      ...cardToTopic(card),
      inkScriptId: card.inkScriptId ?? null,
    },
    scene: scene?.scene ?? { id: card.unitId, title: '', category: '', backgroundUrl: '', characters: [] },
    vocabularies: [],
    activeChunks: [],
    sentencePatterns: [],
  }
}

const CONTENT_TABLE = {
  vocab: 'offline_vocabularies',
  chunk: 'offline_chunks',
  pattern: 'offline_patterns',
} as const

function contentItem(row: any) {
  const body = row?.data && typeof row.data === 'object' ? row.data : row
  return { ...body, id: row?.id ?? body?.id }
}

export async function listContentPage(params: {
  unitId?: string
  topicId?: string
  kind: ContentKind
  page: number
  pageSize: number
}) {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(PAGE_LIMIT, Math.max(1, params.pageSize))
  const refPage = await localDb.listContentRefPage({
    packId: params.topicId ? undefined : params.unitId,
    topicId: params.topicId,
    kind: params.kind,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const rows = refPage.contentIds.length === 0
    ? []
    : await localDb.findByIndexIn<any>(CONTENT_TABLE[params.kind], 'id', refPage.contentIds)
  const byId = new Map<string, any>(rows.map((row) => [row.id, contentItem(row)]))
  return {
    items: refPage.contentIds.map((id) => byId.get(id)).filter((item): item is any => Boolean(item)),
    total: refPage.total,
    page,
    pageSize,
  }
}

export async function readPracticeSource(unitId: string) {
  const shell = await readUnitShell(unitId)
  if (!shell) return null
  const pipelines = await listKind(unitId, 'pipeline')
  const metadataByTopic = new Map(pipelines.map((row) => [row.topicId, row.metadata ?? {}]))
  return {
    ...shell,
    trainingTopics: shell.trainingTopics.map((topic) => ({
      ...topic,
      metadata: metadataByTopic.get(topic.id) ?? {},
    })),
  }
}

async function legacyTopicRows(unitId: string) {
  const rows = await localDb.findByIndex<any>('downloaded_unit_details', 'unit_id', unitId)
  return rows.filter((row) => row?.topicId && row.id === `topic:${row.topicId}` && row.detail)
}

export async function ensurePackProjection(unitId: string): Promise<boolean> {
  const current = migrations.get(unitId)
  if (current) return current
  const task = migratePackProjection(unitId).finally(() => migrations.delete(unitId))
  migrations.set(unitId, task)
  return task
}

async function migratePackProjection(unitId: string): Promise<boolean> {
  if (await readUnitSummary(unitId)) return true
  const legacyUnit = await localDb.get<any>('downloaded_unit_details', unitId)
  const storedTopics = (await legacyTopicRows(unitId)).map((row) => row.detail)
  const legacyTopics = storedTopics.length > 0
    ? storedTopics
    : (legacyUnit?.trainingTopics ?? []).map((topic: any) => ({
      topic,
      vocabularies: topic.vocabularies,
      activeChunks: topic.activeChunks,
      sentencePatterns: topic.sentencePatterns,
      teachingMarkdown: topic.teachingMarkdown,
    }))

  if (!legacyUnit && legacyTopics.length === 0) return false

  const unitDetail = {
    id: unitId,
    ...(legacyUnit ?? {}),
    scene: legacyUnit?.scene,
  }
  const projection = buildPackReadModel(unitDetail, legacyTopics)
  const expectedTopics = storedTopics.length || legacyUnit?.trainingTopics?.length || legacyTopics.length
  if (projection.topicCount !== expectedTopics) {
    console.warn('[offline] skip projection, topic count mismatch', { unitId, expectedTopics, actual: projection.topicCount })
    return false
  }

  await learningContentRepository.savePackContentIndex(unitId, unitId, unitDetail, legacyTopics)
  await localDb.putMany('downloaded_unit_details', projection.rows)
  await localDb.delete('downloaded_unit_details', unitId)
  for (const topic of legacyTopics) {
    const topicId = topicSource(topic).topic?.id ?? topic?.topic?.id ?? topic?.id
    if (topicId) await localDb.delete('downloaded_unit_details', `topic:${topicId}`)
  }
  return true
}

export async function readStoredUnitDetail(unitId: string) {
  const summary = await readUnitSummary(unitId)
  if (!summary) return localDb.get<any>('downloaded_unit_details', unitId)
  const scene = await readUnitScene(unitId)
  return {
    ...summary,
    id: unitId,
    scene: scene?.scene ?? null,
    offlineStoryEpisodePlayers: scene?.offlineStoryEpisodePlayers ?? [],
    offlineNqtrBundle: scene?.offlineNqtrBundle ?? summary?.offlineNqtrBundle ?? null,
    nqtrChapters: summary?.nqtrChapters ?? [],
  }
}

export async function readStoredTopicDetail(topicId: string) {
  const legacy = await localDb.get<any>('downloaded_unit_details', `topic:${topicId}`)
  if (legacy?.detail && legacy.rowKind == null) return legacy.detail
  const card = await readTopicCard(topicId)
  if (!card) return null
  const [teaching, pipeline, vocabs, chunks, patterns] = await Promise.all([
    readTopicTeaching(topicId),
    readTopicPipeline(topicId),
    listContentPage({ topicId, kind: 'vocab', page: 1, pageSize: PAGE_LIMIT }),
    listContentPage({ topicId, kind: 'chunk', page: 1, pageSize: PAGE_LIMIT }),
    listContentPage({ topicId, kind: 'pattern', page: 1, pageSize: PAGE_LIMIT }),
  ])
  return {
    topic: {
      ...cardToTopic(card),
      teachingMarkdown: teaching?.teachingMarkdown ?? '',
      contentConfig: teaching?.contentConfig ?? null,
      transcript: teaching?.transcript ?? null,
      metadata: pipeline?.metadata ?? {},
      inkScriptId: card.inkScriptId ?? null,
    },
    vocabularies: vocabs.items,
    activeChunks: chunks.items,
    sentencePatterns: patterns.items,
    teachingMarkdown: teaching?.teachingMarkdown ?? '',
  }
}
