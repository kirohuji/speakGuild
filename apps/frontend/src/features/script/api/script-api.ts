import { get, post } from '@/lib/request'

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
  description?: string
  npcPersonality?: string
  objectives: string[]
  rewards: any
  isPreview: boolean
  requiredOutputLevel: string
  requiredUserLevel: number
  scene: { id: string; title: string; location: string }
  coreVocabularies: { vocab: { id: string; word: string; meaning: string } }[]
  coreChunks: { chunk: { id: string; text: string; meaning: string; description?: string | null; examples?: Array<{ en: string; zh: string; note?: string | null; level?: string }> } }[]
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
  getChapters: () => get<ScriptChapter[]>('/script/chapters'),

  getEpisode: (id: string) => get<EpisodeDetail>(`/script/episodes/${id}`),

  getReadiness: (id: string) => get<EpisodeReadiness>(`/script/episodes/${id}/readiness`),

  getInk: (id: string) => get<{ inkJson: any }>(`/script/episodes/${id}/ink`),

  /** 提交任务判断（返回 Prompt，前端调用 AI） */
  judge: (id: string, data: {
    lastNpcText: string
    userTranscript: string
    completedObjectives: string[]
    usedChunks: string[]
    round: number
    maxRounds: number
  }) => post(`/script/episodes/${id}/judge`, data),

  complete: (id: string, data: any) => post(`/script/episodes/${id}/complete`, data),

  getRecords: () => get('/script/records'),
}

export default scriptApi
