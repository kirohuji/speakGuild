import { del, get, patch, post } from '@/lib/request'

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
    teachingMarkdown?: string | null
    promptEn: string
    promptZh: string
    suggestedDurationSec: number
    difficulty: string
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
      avatarUrl?: string | null
      spriteBaseUrl?: string | null
      expressions?: any
      defaultPosition: 'left' | 'center' | 'right'
    }>
  }
  vocabularies: Array<{
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
    description?: string | null
    difficulty?: string
  }>
  activeChunks: {
    id: string
    text: string
    meaning: string
    description?: string | null
    examples?: Array<{ en: string; zh: string; note?: string | null; level?: string }>
    masteryStatus: string
  }[]
}

export interface PracticeSession {
  id: string
  topicId: string
  sceneId: string
  inkScriptId?: string | null
  status: 'active' | 'completed' | 'analyzing' | 'analyzed' | 'failed' | string
  turnCount: number
  topicSnapshot?: { title?: string; promptZh?: string; promptEn?: string } | null
  sceneSnapshot?: { title?: string; location?: string } | null
  analysisResult?: any
  analysisRaw?: string | null
  analysisError?: string | null
  startedAt: string
  completedAt?: string | null
  analyzedAt?: string | null
  turns?: Array<{
    id: string
    round: number
    npcText: string
    userText: string
    inputNodeId?: string | null
    tags?: any
    judgement?: any
    objectivesCompleted: string[]
    chunksUsed: string[]
    createdAt: string
  }>
}

export const practiceApi = {
  getTopics: (sceneId: string) =>
    get<{ scene: any; topics: TrainingTopic[] }>('/practice/topics', { sceneId }),

  getTopicDetail: (topicId: string) =>
    get<TopicDetail>(`/practice/topics/${topicId}`),

  getTopicTeachingMarkdown: (topicId: string) =>
    get<{ teachingMarkdown?: string | null }>(`/practice/topics/${topicId}/teaching`),

  /** 获取话题关联的 Ink 脚本 */
  getTopicInk: (topicId: string) =>
    get<{ id: string; inkJson: any; inkSource?: string | null; key: string; title: string } | null>(`/practice/topics/${topicId}/ink`),

  createSession: (topicId: string) =>
    post<{ id: string }>(`/practice/topics/${topicId}/sessions`, { topicId }),

  getSession: (sessionId: string) =>
    get<PracticeSession>(`/practice/sessions/${sessionId}`),

  submitTurn: (sessionId: string, data: {
    round?: number
    npcText: string
    userText: string
    userAudioUrl?: string
    inputNodeId?: string
    tags?: string[]
    judgement?: any
    objectivesCompleted?: string[]
    chunksUsed?: string[]
  }) => post(`/practice/sessions/${sessionId}/turns`, data),

  completeSession: (sessionId: string) =>
    post<PracticeSession>(`/practice/sessions/${sessionId}/complete`, {}),

  submitRecording: (topicId: string, userTranscript: string, audioUrl?: string) =>
    post(`/practice/topics/${topicId}/record`, { userTranscript, audioUrl, topicId }),

  /** 提交练习对话记录 */
  submitDialogue: (topicId: string, data: {
    round: number
    npcText: string
    userText?: string
    isOnTopic?: boolean
    objectivesCompleted?: string[]
    chunksUsed?: string[]
    grammarIssues?: any
  }) => post(`/practice/topics/${topicId}/dialogue`, data),

  /** 获取话题的所有对话记录 */
  getTopicDialogues: (topicId: string) =>
    get<Array<{
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
  }) => post('/practice/topics/any/save', data),
}

// ---- AI  ----
export const practiceAiApi = {
  judgeDialogueTurn: (dto: {
    topicId: string
    inputNodeId?: string
    npcText: string
    userText: string
    expectedIntent?: string
    objectives?: string[]
    targetChunks?: string[]
  }) => post<{
    intent: string
    passed: boolean
    objectiveCompleted: string[]
    chunksUsed: string[]
    inkVariables: Record<string, string | number | boolean>
    feedback: string
    confidence: number
  }>('/practice-ai/dialogue-turn', dto),

  analyzeSession: (sessionId: string) =>
    post<{ analysis: any; raw: string }>(`/practice-ai/sessions/${sessionId}/analyze`, {}),
}

// ---- 学习库 ----
export type MasteryStatus = 'learning' | 'reviewing' | 'mastered'

export const expressionApi = {
  list: (params?: {
    type?: string
    sceneName?: string
    reviewState?: MasteryStatus
    page?: number
    pageSize?: number
  }) => get('/expressions', params),

  create: (data: any) => post('/expressions', data),

  remove: (id: string) => del(`/expressions/${id}`),

  updateStatus: (id: string, status: MasteryStatus) =>
    patch(`/expressions/${id}/status`, { status }),
}

// ---- Chunk ----
export const chunkApi = {
  activate: (chunkId: string) => post(`/chunks/${chunkId}/activate`),
  markRead: (chunkId: string) => post(`/chunks/${chunkId}/read`),
}

// ---- 等级 ----
export const levelApi = {
  getOverview: () => get('/level/overview'),
  getWeeklyStats: () => get('/level/weekly-stats'),
  getCommonErrors: () => get('/level/common-errors'),
  getRecommendedPath: () => get('/level/recommended-path'),
}

export default practiceApi
