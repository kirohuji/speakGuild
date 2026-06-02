import axios from 'axios'
import { getBearerToken } from '@/features/auth/client'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getBearerToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => {
    const data = res.data
    return data && typeof data === 'object' && 'data' in data ? data.data : data
  },
  (error) => {
    const msg = error.response?.data?.message || error.message || '请求失败'
    console.error('[Learning API Error]', msg)
    return Promise.reject(error)
  },
)

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
  description: string | null
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

// ---- API 方法 ----

export const learningApi = {
  /** 获取全部教材列表 */
  getUnits: () => api.get<any, LearningCategory[]>('/learning/units'),

  /** 获取用户正在学习的单元 */
  getMyUnits: () => api.get<any, MyUnit[]>('/learning/my-units'),

  /** 获取学习单元详情 */
  getUnitDetail: (unitId: string) => api.get<any, UnitDetail>(`/learning/units/${unitId}`),

  /** 获取今日任务 */
  getTodayTasks: () => api.get<any, TodayPlan>('/learning/today'),

  /** 更新学习单元进度 */
  updateProgress: (unitId: string, data: {
    vocabLearned?: number
    chunkMastered?: number
    completedPractice?: boolean
    completedScript?: boolean
  }) => api.post(`/learning/units/${unitId}/progress`, data),

  /** 开始学习一个单元 */
  startUnit: (unitId: string) => api.post(`/learning/units/${unitId}/start`),

  /** 退出学习一个单元 */
  quitUnit: (unitId: string) => api.delete(`/learning/units/${unitId}`),
}
