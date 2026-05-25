import axios from 'axios'
import { getBearerToken } from '@/features/auth/client'

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
  (res) => (res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data),
  (e) => Promise.reject(e),
)

export interface ScriptChapter {
  chapterId: string
  chapterTitle: string
  episodes: ScriptEpisodeCard[]
}

export interface ScriptEpisodeCard {
  id: string
  title: string
  episodeOrder: number
  requiredOutputLevel: string
  requiredUserLevel: number
  isPreview: boolean
  passed: boolean
}

export interface EpisodeDetail {
  id: string
  title: string
  chapterId: string
  chapterTitle: string
  episodeOrder: number
  npcName: string
  npcRole: string
  npcPersonality?: string
  objectives: string[]
  rewards: any
  isPreview: boolean
  requiredOutputLevel: string
  requiredUserLevel: number
  scene: { id: string; title: string; location: string }
  coreVocabularies: { vocab: { id: string; word: string; meaning: string } }[]
  coreChunks: { chunk: { id: string; text: string; meaning: string; example?: string } }[]
  records: { passed: boolean }[]
}

export interface EpisodeReadiness {
  outputLevelSatisfied: boolean
  prerequisiteCompleted: boolean
  vocabLearned: number
  vocabRequired: number
  chunkMastered: number
  chunkRequired: number
  readiness: number
}

export const scriptApi = {
  getChapters: () => api.get<any, ScriptChapter[]>('/script/chapters'),

  getEpisode: (id: string) => api.get<any, EpisodeDetail>(`/script/episodes/${id}`),

  getReadiness: (id: string) => api.get<any, EpisodeReadiness>(`/script/episodes/${id}/readiness`),

  getInk: (id: string) => api.get<any, { inkJson: any }>(`/script/episodes/${id}/ink`),

  /** 提交任务判断（返回 Prompt，前端调用 AI） */
  judge: (id: string, data: {
    lastNpcText: string
    userTranscript: string
    completedObjectives: string[]
    usedChunks: string[]
    round: number
    maxRounds: number
  }) => api.post(`/script/episodes/${id}/judge`, data),

  complete: (id: string, data: any) => api.post(`/script/episodes/${id}/complete`, data),

  getRecords: () => api.get('/script/records'),
}

export default api
