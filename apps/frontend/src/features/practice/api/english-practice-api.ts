import axios from 'axios'
import { getBearerToken } from '@/features/auth/client'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1/guide-exam'

/** 英语输出训练 API 客户端 */
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
    console.error('[English API Error]', msg)
    return Promise.reject(error)
  },
)

// ---- 练习模式 ----
export interface TrainingTopic {
  id: string
  title: string
  promptZh: string
  difficulty: string
  suggestedDurationSec: number
}

export interface TopicDetail {
  topic: {
    id: string
    title: string
    description?: string | null
    knowledgePoints?: string | null
    promptEn: string
    promptZh: string
    suggestedDurationSec: number
    difficulty: string
    sentenceSkeleton: string | null
    sentencePatterns?: Array<{
      pattern: string
      meaning: string
      slots: string[]
      example: string
      difficulty: string
    }> | null
    inkScriptId?: string | null
  }
  inkScript?: {
    id: string
    inkJson: any
    inkSource?: string | null
    key: string
    title: string
  } | null
  scene: {
    id: string
    title: string
    location: string
    category: string
    backgroundUrl?: string | null
    characters?: Array<{
      id: string
      name: string
      displayName: string
      spriteBaseUrl?: string | null
      expressions?: any
      defaultPosition: 'left' | 'center' | 'right'
    }>
  }
  vocabularies: { id: string; word: string; meaning: string }[]
  activeChunks: {
    id: string
    text: string
    meaning: string
    description?: string | null
    examples?: Array<{ en: string; zh: string; note?: string | null; level?: string }>
    masteryStatus: string
  }[]
}

export const practiceApi = {
  getTopics: (sceneId: string) =>
    api.get<any, { scene: any; topics: TrainingTopic[] }>(`/practice/topics`, { params: { sceneId } }),

  getTopicDetail: (topicId: string) =>
    api.get<any, TopicDetail>(`/practice/topics/${topicId}`),

  /** 获取话题关联的 Ink 脚本 */
  getTopicInk: (topicId: string) =>
    api.get<any, { id: string; inkJson: any; inkSource?: string | null; key: string; title: string } | null>(`/practice/topics/${topicId}/ink`),

  submitRecording: (topicId: string, userTranscript: string, audioUrl?: string) =>
    api.post(`/practice/topics/${topicId}/record`, { userTranscript, audioUrl, topicId }),

  /** 提交练习对话记录 */
  submitDialogue: (topicId: string, data: {
    round: number
    npcText: string
    userText?: string
    isOnTopic?: boolean
    objectivesCompleted?: string[]
    chunksUsed?: string[]
    grammarIssues?: any
  }) => api.post(`/practice/topics/${topicId}/dialogue`, data),

  /** 获取话题的所有对话记录 */
  getTopicDialogues: (topicId: string) =>
    api.get<any, Array<{
      round: number
      npcText: string
      userText: string
      isOnTopic?: boolean
      objectiveCompleted?: string[]
      chunksUsed?: string[]
      grammarIssues?: any
    }>>(`/practice/topics/${topicId}/dialogues`),

  saveExpression: (data: {
    type: string
    original?: string
    corrected?: string
    chunkText?: string
    sceneName?: string
  }) => api.post(`/practice/topics/any/save`, data),
}

// ---- AI 纠错 ----
export const practiceAiApi = {
  /** SSE 流式纠错 */
  streamFeedback: (dto: {
    userTranscript: string
    promptEn?: string
    sceneTitle?: string
    topicTitle?: string
    outputLevel?: string
  }) =>
    fetch(`${API_BASE}/practice-ai/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getBearerToken()}` },
      body: JSON.stringify(dto),
    }),

  /** 表达升级 */
  upgrade: (dto: { userTranscript: string; outputLevel?: string }) =>
    api.post('/practice-ai/upgrade', dto),

  /** 对话汇总分析 */
  dialogueSummary: (dto: {
    topicId: string
    topicTitle: string
    promptEn: string
    objectives?: string[]
    coreChunks?: string[]
  }) => api.post<any, { analysis: any; raw: string }>('/practice-ai/dialogue-summary', dto),

  judgeDialogueTurn: (dto: {
    topicId: string
    inputNodeId?: string
    npcText: string
    userText: string
    expectedIntent?: string
    objectives?: string[]
    targetChunks?: string[]
  }) => api.post<any, {
    intent: string
    passed: boolean
    objectiveCompleted: string[]
    chunksUsed: string[]
    inkVariables: Record<string, string | number | boolean>
    feedback: string
    confidence: number
    raw?: string
  }>('/practice-ai/dialogue-turn', dto),
}

// ---- 表达库 ----
export const expressionApi = {
  list: (params?: { type?: string; sceneName?: string }) =>
    api.get('/expressions', { params }),

  create: (data: any) => api.post('/expressions', data),

  remove: (id: string) => api.delete(`/expressions/${id}`),

  getReview: () => api.get('/expressions/review'),

  completeReview: (id: string) => api.post(`/expressions/${id}/review`),
}

// ---- Chunk ----
export const chunkApi = {
  activate: (chunkId: string) => api.post(`/chunks/${chunkId}/activate`),
  markRead: (chunkId: string) => api.post(`/chunks/${chunkId}/read`),
}

// ---- 等级 ----
export const levelApi = {
  getOverview: () => api.get('/level/overview'),
  getWeeklyStats: () => api.get('/level/weekly-stats'),
  getCommonErrors: () => api.get('/level/common-errors'),
  getRecommendedPath: () => api.get('/level/recommended-path'),
}

export default api
