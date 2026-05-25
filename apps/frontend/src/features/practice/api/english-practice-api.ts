import axios from 'axios'
import { getBearerToken } from '@/features/auth/client'

/** 英语输出训练 API 客户端 — 使用 /api/v1 前缀 */
const api = axios.create({
  baseURL: '/api/v1',
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
    promptEn: string
    promptZh: string
    suggestedDurationSec: number
    difficulty: string
    sentenceSkeleton: string | null
  }
  scene: { id: string; title: string; location: string; category: string }
  vocabularies: { id: string; word: string; meaning: string }[]
  activeChunks: {
    id: string
    text: string
    meaning: string
    example: string | null
    masteryStatus: string
  }[]
}

export const practiceApi = {
  getTopics: (sceneId: string) =>
    api.get<any, { scene: any; topics: TrainingTopic[] }>(`/practice/topics`, { params: { sceneId } }),

  getTopicDetail: (topicId: string) =>
    api.get<any, TopicDetail>(`/practice/topics/${topicId}`),

  submitRecording: (topicId: string, userTranscript: string, audioUrl?: string) =>
    api.post(`/practice/topics/${topicId}/record`, { userTranscript, audioUrl, topicId }),

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
    fetch('/api/v1/practice-ai/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getBearerToken()}` },
      body: JSON.stringify(dto),
    }),

  /** 表达升级 */
  upgrade: (dto: { userTranscript: string; outputLevel?: string }) =>
    api.post('/practice-ai/upgrade', dto),
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
}

export default api
