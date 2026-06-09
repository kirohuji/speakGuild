import { del, get, post } from '@/lib/request'

// ---- 类型定义 ----

export interface TopicSummary {
  id: string
  title: string
  difficulty: string
  suggestedDurationSec: number
}

export interface LearningUnitSummary {
  id: string
  title: string
  location: string
  description?: string | null
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
  title: string
  promptEn: string
  promptZh: string
  difficulty: string
  suggestedDurationSec: number
  activeChunks: { id: string; text: string; meaning: string }[]
}

export interface UnitDetail {
  id: string
  title: string
  location: string
  description: string | null
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
    completedScriptCount: number
  } | null
  vocabularies: VocabItem[]
  chunks: ChunkItem[]
  sentencePatterns: SentencePattern[]
  trainingTopics: TrainingTopicItem[]
  firstEpisode: { id: string; title: string; chapterTitle: string; episodeOrder: number; description: string | null; requiredOutputLevel: string } | null
  vocabCount: number
  chunkCount: number
  topicCount: number
  scriptCount: number
}

export interface TodayTask {
  id: string
  type: 'vocab' | 'chunk' | 'practice' | 'script'
  title: string
  description: string
  unitId: string
  unitTitle: string
  // vocab/chunk-specific
  count?: number       // 总待学数
  dayCount?: number    // 今日限额展示数
  done?: number        // 已完成数
  total?: number       // 总数量
  hasMore?: boolean    // 今日是否只展示了部分
  data?: { id?: string; word?: string; text?: string; meaning?: string }[]
  // practice-specific
  durationSec?: number
  topicId?: string
  topicTitle?: string
  promptZh?: string
  // script-specific
  episodeId?: string
  episodeTitle?: string
}

export interface TodayPlan {
  currentUnit: {
    id: string
    title: string
    location: string
    progress: {
      vocabLearned: number
      vocabTotal: number
      chunkMastered: number
      chunkTotal: number
      completedPractice: number
      practiceTotal: number
    } | null
  } | null
  tasks: TodayTask[]
}

/** 用户正在学习的单元（从 my-units 接口返回） */
export interface MyUnit {
  id: string
  title: string
  location: string
  description?: string | null
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
    completedScriptCount: number
  }
  completionPercent: number
}

export interface TagInfo {
  name: string
  icon: string | null
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
    scriptEpisodes: string[]
    inkScripts: string[]
    assets: Array<{ assetId?: string; url: string; sha256?: string | null; mimeType?: string | null; size?: number | null; role?: string }>
  }
  unitDetail: UnitDetail
  topicDetails: any[]
}

// ---- API 方法 ----

export const learningApi = {
  /** 获取可用分类标签列表 */
  getTags: () => get<TagInfo[]>('/learning/tags'),

  /** 获取教材列表（分页），支持按分类标签过滤和模糊搜索 */
  getUnits: (params?: { tag?: string; search?: string; page?: number; pageSize?: number }) =>
    get<UnitsListResult>('/learning/units', params),

  /** 获取用户正在学习的单元 */
  getMyUnits: () => get<MyUnit[]>('/learning/my-units'),

  /** 获取学习单元详情 */
  getUnitDetail: (unitId: string) => get<UnitDetail>(`/learning/units/${unitId}`),

  getOfflineManifest: (unitId: string) =>
    get<OfflineManifestResult>(`/learning/units/${unitId}/offline-manifest`),

  /** 获取今日任务 */
  getTodayTasks: () => get<TodayPlan>('/learning/today'),

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
