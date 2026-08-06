import { del, get, post, put } from '@/lib/request'

const LEARNING_PACK_DOWNLOAD_TIMEOUT_MS = 10 * 60_000

export type ContentMode = 'practice' | 'writing' | 'reading' | 'listening' | 'novel' | 'story'
export type TopicActivityType = 'practice' | 'writing' | 'reading' | 'listening'

// ---- 类型定义 ----

export interface TopicSummary {
  id: string
  type?: 'daily' | 'ielts'
  activityType?: TopicActivityType
  title: string
  description?: string | null
  difficulty: string
  metadata?: any
  suggestedDurationSec: number
}

export interface LearningUnitSummary {
  id: string
  packageType?: 'daily' | 'exam' | 'story' | 'course' | 'foundation'
  contentMode?: ContentMode
  title: string
  location: string
  description?: string | null
  coverImage?: string | null
  categoryId?: string
  categoryName?: string
  categoryIcon?: string | null
  topics: TopicSummary[]
  requiredOutputLevel: string
  requiredUserLevel: number
  isUnlocked: boolean
  isLocked: boolean       // 会员锁定（非会员 + 非免费场景）
  isFree: boolean         // 是否免费场景
  vocabCount: number
  chunkCount: number
  topicCount: number
  scriptCount: number
  progress: {
    readiness: number
    mastery: number
    vocabLearned: number
    vocabTotal: number
    chunkMastered: number
    chunkTotal: number
    completedPracticeCount: number
    totalPracticeCount?: number
    completedScriptCount: number
  } | null
  completionPercent: number
}

export interface UnitsListResult {
  list: LearningUnitSummary[]
  total: number
  page: number
  pageSize: number
}

export interface LearningCategory {
  id: string
  name: string
  icon: string | null
  units: LearningUnitSummary[]
}

export interface VocabItem {
  id: string
  word: string
  meaning: string
  partOfSpeech?: string | null
  phoneticUs?: string | null
  phoneticUk?: string | null
  audioUsUrl?: string | null
  audioUkUrl?: string | null
  definitionEn?: string | null
  synonyms?: string[]
  examples?: Array<{ en: string; zh?: string; note?: string | null; level?: string }>
  description: string | null
  difficulty?: string
}

export interface ChunkItem {
  id: string
  text: string
  meaning: string
  description: string | null
  category: string
  difficulty: string
  masteryStatus: string
  examples: { en: string; zh: string; note: string | null; level: string }[]
}

export interface SentencePattern {
  pattern: string
  meaning: string
  slots: string[]
  example: string
  difficulty: string
  topicId: string
  topicTitle: string
}

export interface TrainingTopicItem {
  id: string
  type?: 'daily' | 'ielts'
  activityType?: TopicActivityType
  title: string
  description?: string | null
  teachingMarkdown?: string | null
  promptEn: string
  promptZh: string
  difficulty: string
  metadata?: any
  contentConfig?: Record<string, any> | null
  mediaAssetId?: string | null
  mediaUrl?: string | null
  transcript?: ListeningTranscriptSegment[] | null
  latestSubmission?: TopicSubmission | null
  suggestedDurationSec: number
  activeChunks: { id: string; text: string; meaning: string }[]
  vocabularies?: VocabItem[]
  sentencePatterns?: SentencePattern[]
}

export interface UnitDetail {
  id: string
  packageType?: 'daily' | 'exam' | 'story' | 'course' | 'foundation'
  contentMode?: ContentMode
  title: string
  location: string
  description: string | null
  coverImage?: string | null
  category: string
  requiredOutputLevel: string
  requiredUserLevel: number
  prerequisites: { id: string; title: string }[]
  progress: {
    readiness: number
    mastery: number
    vocabLearned: number
    vocabTotal: number
    chunkMastered: number
    chunkTotal: number
    completedPracticeCount: number
    totalPracticeCount?: number
    completedScriptCount: number
  } | null
  vocabularies: VocabItem[]
  chunks: ChunkItem[]
  sentencePatterns: SentencePattern[]
  trainingTopics: TrainingTopicItem[]
  firstEpisode: { id: string; title: string; chapterTitle: string; episodeOrder: number; description: string | null; requiredOutputLevel: string } | null
  storyEpisodes?: StoryEpisodeItem[]
  vocabCount: number
  chunkCount: number
  topicCount: number
  scriptCount: number
  /** 仅存在于下载包中的章节播放数据；线上详情接口不会返回该字段。 */
  offlineStoryEpisodePlayers?: StoryEpisodePlayerData[]
  /** 仅存在于下载包中的小说包数据（metadata/toc/epubAssetId）；线上详情接口不会返回该字段。 */
  novelPackage?: {
    id: string
    metadata: Record<string, any>
    toc: Array<{ label: string; href: string }>
    epubAssetId?: string | null
  } | null
}

export interface StoryEpisodeItem {
  id: string
  chapterKey: string
  chapterName: string
  sortOrder: number
  title: string
  description: string | null
  requiredOutputLevel: string
  requiredUserLevel: number
  objectives: string[]
  characterName: string
  characterRole: string
  inkScriptId?: string | null
  isPreview: boolean
  prerequisiteEpisodeIds: string[]
  isUnlocked: boolean
  vocabularies: Array<Pick<VocabItem, 'id' | 'word' | 'meaning' | 'partOfSpeech'>>
  chunks: Array<Pick<ChunkItem, 'id' | 'text' | 'meaning'>>
  sentencePatterns: Array<Pick<SentencePattern, 'pattern' | 'meaning'> & { id: string; example?: string }>
  record: {
    id: string
    passed: boolean
    completedObjectiveCount: number
    usedChunkCount: number
    turnCount: number
    retellCompleted: boolean
    xpEarned: number
    completedAt: string | null
    createdAt: string
  } | null
}

export interface StoryEpisodePlayerData {
  episode: {
    id: string
    sceneId: string
    sceneTitle: string
    location: string
    title: string
    chapterName: string
    description: string | null
    characterName: string
    characterRole: string
    objectives: string[]
    isPreview: boolean
  }
  inkScript: {
    id: string
    key: string
    title: string
    inkJson: Record<string, any>
    inkSource: string | null
    assetMap?: Record<string, { fileAssetId?: string; signedUrl?: string | null; type?: string; mimeType?: string }> | null
    version: number
  }
  /** 舞台资源随章节包一起下发，供离线剧场直接使用。 */
  scene?: {
    backgroundUrl?: string | null
    characters?: Array<{
      name: string
      displayName?: string | null
      spriteBaseUrl?: string | null
      expressions?: Record<string, unknown> | null
      defaultPosition?: 'left' | 'center' | 'right'
    }>
  }
}

/** 用户正在学习的单元（从 my-units 接口返回） */
export interface MyUnit {
  id: string
  packageType?: 'daily' | 'exam' | 'story' | 'course' | 'foundation'
  contentMode?: ContentMode
  title: string
  location: string
  description?: string | null
  coverImage?: string | null
  categoryName: string
  topics: TopicSummary[]
  vocabCount: number
  chunkCount: number
  topicCount: number
  scriptCount: number
  progress: {
    readiness: number
    mastery: number
    vocabLearned: number
    vocabTotal: number
    chunkMastered: number
    chunkTotal: number
    completedPracticeCount: number
    totalPracticeCount?: number
    completedScriptCount: number
  }
  completionPercent: number
}

export interface TagInfo {
  name: string
  icon: string | null
}

export type LearningPackageType = 'daily' | 'exam' | 'story' | 'course' | 'foundation'

export interface ListeningTranscriptWord {
  token: string
  startMs: number
  endMs: number
}

export interface ListeningTranscriptSegment {
  id?: string
  text: string
  translation?: string
  speaker?: string
  startMs: number
  endMs: number
  words?: ListeningTranscriptWord[]
}

export interface TopicSubmission {
  id: string
  revision: number
  status: 'draft' | 'submitted' | 'reviewed' | 'completed'
  response: Record<string, any>
  feedback?: Record<string, any> | null
  updatedAt: string
}

export interface TopicSession {
  id: string
  status: 'active' | 'completed' | 'analyzed'
  analysisResult?: Record<string, any> | null
  startedAt: string
  completedAt?: string | null
  analyzedAt?: string | null
  createdAt: string
  submissions?: TopicSubmission[]
}

export interface SceneExperience {
  id: string
  contentMode: ContentMode
  groupItem?: {
    sortOrder: number
    volumeLabel?: string | null
    group: {
      id: string
      name: string
      description?: string | null
      items: Array<{
        id: string
        sceneId: string
        sortOrder: number
        volumeLabel?: string | null
        requiredPrevious: boolean
        scene: { id: string; title: string; coverImage?: string | null; contentMode: ContentMode }
      }>
    }
  } | null
  novelPackage?: {
    id: string
    metadata: Record<string, any>
    toc: Array<{ label: string; href: string }>
    epubUrl: string
    epubAssetId?: string | null
    progress?: { locator: Record<string, any>; percentage: number } | null
  } | null
}

export interface OfflineManifestResult {
  manifest: {
    packId: string
    version: number
    title: string
    updatedAt: string
    units: string[]
    topics: string[]
    vocabularies: string[]
    chunks: string[]
    sentencePatterns: string[]
    storyEpisodes: string[]
    inkScripts: string[]
    assets: Array<{ assetId?: string; url: string; sha256?: string | null; mimeType?: string | null; size?: number | null; role?: string }>
  }
  unitDetail: UnitDetail
  topicDetails: any[]
}

export interface PackManifestPreview {
  manifest: OfflineManifestResult['manifest'] & {
    formatVersion?: number
    contentRoot?: string
    generatedAt?: string
    files?: Record<string, string>
    failedAssets?: Array<{ url: string; reason: string }>
  }
  zipChecksum: string | null
  fileName: string
  size: number | null
}

export interface PackUpdateInfo {
  packId: string
  fromVersion: number
  toVersion: number
  updateType: 'full' | 'delta'
  title?: string
  updatedAt?: string
  // full update
  fullDownloadUrl?: string
  fullSize?: number
  fullSizeHuman?: string
  zipChecksum?: string
  fallbackReason?: string
  // delta update
  deltaSize?: number
  deltaSizeHuman?: string
  deltaDownloadUrl?: string
  deltaChecksum?: string
  savingPercent?: number
}

// ---- API 方法 ----

export const learningApi = {
  /** 获取可用分类标签列表 */
  getTags: (packageType?: LearningPackageType) =>
    get<TagInfo[]>('/learning/tags', packageType ? { packageType } : undefined),

  /** 获取教材列表（分页），支持按分类标签过滤和模糊搜索 */
  getUnits: (params?: { tag?: string; packageType?: LearningPackageType; excludePackageType?: LearningPackageType; search?: string; page?: number; pageSize?: number }) =>
    get<UnitsListResult>('/learning/units', params),

  /** 获取用户正在学习的单元 */
  getMyUnits: () => get<MyUnit[]>('/learning/my-units'),

  /** 获取学习单元详情 */
  getUnitDetail: (unitId: string) => get<UnitDetail>(`/learning/units/${unitId}`),

  getSceneExperience: (unitId: string) =>
    get<SceneExperience>(`/learning/experiences/scenes/${unitId}`),

  saveTopicSubmission: (
    topicId: string,
    data: { response: Record<string, any>; status?: TopicSubmission['status']; revision?: number },
  ) => post<TopicSubmission>(`/learning/experiences/topics/${topicId}/submissions`, data),

  // ═══ TopicSession ═══

  startTopicSession: (topicId: string) =>
    post<TopicSession>(`/learning/experiences/topics/${topicId}/sessions/start`, {}),

  completeTopicSession: (topicId: string, sessionId: string) =>
    post<TopicSession>(`/learning/experiences/topics/${topicId}/sessions/${sessionId}/complete`, {}),

  analyzeTopicSession: (topicId: string, sessionId: string) =>
    post<{ analysis: any; raw?: string; error?: string }>(`/learning/experiences/topics/${topicId}/sessions/${sessionId}/analyze`, {}),

  listTopicSessions: (topicId: string) =>
    get<TopicSession[]>(`/learning/experiences/topics/${topicId}/sessions`),

  getLatestTopicSession: (topicId: string) =>
    get<TopicSession | null>(`/learning/experiences/topics/${topicId}/sessions/latest`),

  saveNovelProgress: (unitId: string, data: { locator: Record<string, any>; percentage: number }) =>
    put(`/learning/experiences/novels/${unitId}/progress`, data),

  getStoryEpisodePlayer: (episodeId: string) =>
    get<StoryEpisodePlayerData>(`/learning/episodes/${episodeId}/player`),

  completeStoryEpisode: (
    episodeId: string,
    data: { turnCount?: number; usedChunkCount?: number; completedObjectiveCount?: number },
  ) => post(`/learning/episodes/${episodeId}/complete`, data),

  getOfflineManifest: (unitId: string) =>
    get<OfflineManifestResult>(`/learning/units/${unitId}/offline-manifest`),

  getPackManifest: (unitId: string) =>
    get<PackManifestPreview>(`/learning/units/${unitId}/pack-manifest`, undefined, { dedupe: false }),

  downloadPack: (unitId: string, signal?: AbortSignal) =>
    get<ArrayBuffer>(`/learning/units/${unitId}/download-pack`, undefined, {
      dedupe: false,
      responseType: 'arraybuffer',
      timeout: LEARNING_PACK_DOWNLOAD_TIMEOUT_MS,
      signal,
    }),

  checkPacks: (installed: Array<{ packId: string; version?: number }>) =>
    post<{ updates: PackUpdateInfo[] }>('/learning/packs/check', { installed }),

  /** V2: 下载 delta 增量包 */
  downloadDelta: (unitId: string, fromVersion: number, toVersion: number, signal?: AbortSignal) =>
    get<ArrayBuffer>(`/learning/units/${unitId}/download-delta?from=${fromVersion}&to=${toVersion}`, undefined, {
      dedupe: false,
      responseType: 'arraybuffer',
      timeout: LEARNING_PACK_DOWNLOAD_TIMEOUT_MS,
      signal,
    }),

  /** 更新学习单元进度 */
  updateProgress: (unitId: string, data: {
    vocabLearned?: number
    chunkMastered?: number
    completedPractice?: boolean
    completedScript?: boolean
  }) => post(`/learning/units/${unitId}/progress`, data),

  /** 开始学习一个单元 */
  startUnit: (unitId: string) => post(`/learning/units/${unitId}/start`),

  /** 退出学习一个单元 */
  quitUnit: (unitId: string) => del(`/learning/units/${unitId}`),
}
