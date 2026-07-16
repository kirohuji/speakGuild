import { del, get, patch, post } from '@/lib/request'
import { judgeWarmupTurnLocally, type WarmupTurnJudgeInput } from '@/lib/local-ai/warmup-local-judge'
import { warmupModelManager } from '@/lib/local-ai/warmup-model-manager'
import { usePreferencesStore } from '@/stores/preferences.store'
import { getCurrentSessionSnapshot } from '@/providers/auth-provider'
import { toast } from 'sonner'

function isLocalModelHealthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /not downloaded|file was not found|local_files_only|failed to fetch|model failed|no available backend|Unable to load from local path/i.test(message)
}

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

type WarmupTurnRemoteJudgeOutput = {
  passed: boolean
  score: 'strong' | 'ok' | 'weak' | 'miss'
  feedback: string
  correction?: string | null
}

async function judgeWarmupTurnRemotely(dto: WarmupTurnJudgeInput, reason?: string): Promise<WarmupTurnRemoteJudgeOutput> {
  if (reason && getCurrentSessionSnapshot()?.user?.role === 'admin') {
    toast.info(reason)
  }
  const remote = await post<WarmupTurnRemoteJudgeOutput>('/practice-ai/warmup-turn', dto)
  if (getCurrentSessionSnapshot()?.user?.role === 'admin') {
    toast.info(`云端 AI 已判断：${remote.passed ? '通过' : '未通过'} · ${remote.score}`)
  }
  return remote
}

// ---- 练习模式 ----
export interface TrainingTopic {
  id: string
  title: string
  promptZh: string
  difficulty: string
  suggestedDurationSec: number
}

// ── Output Training Pipeline Types ──

export type DrillDirection = 'zh_to_en' | 'en_to_zh'

export interface ChunkSubstitutionItem {
  type: 'chunk_substitution'
  id: string
  title: string
  chunk: string
  chunkMeaning?: string
  direction?: DrillDirection
  kind?: 'chunk' | 'word'
  items: Array<{ zh: string; answer: string; hint?: string }>
}

export interface VocabDrillItem {
  type: 'vocab_drill'
  id: string
  title: string
  direction?: DrillDirection
  vocabs: Array<{
    vocabId: string
    promptZh: string
    targetWords?: string[]
    suggestedAnswer: string
    hint?: string
  }>
}

export interface VnDialogueItem {
  type: 'vn_dialogue'
  id: string
  title: string
  structuredObjectives: Array<{
    id: string
    title: string
    requiredIntent: string
    essentialSlots: string[]
    targetChunks: string[]
  }>
}

/** 一词多句：围绕核心词 + 多种 Chunk 搭配生成句子，在 Phase 中拆成多个 ChunkOutputDrillCard */
export interface VocabSentenceBuildingItem {
  type: 'vocab_sentence_building'
  id: string
  title: string
  vocabWord: string
  vocabMeaning: string
  direction?: DrillDirection
  patterns: Array<{
    chunk: string
    items: Array<{ zh: string; answer: string; hint?: string }>
  }>
}

/** 长句拆解：从简单句逐级扩展到复杂长句 */
export interface SentenceDecompositionItem {
  type: 'sentence_decomposition'
  id: string
  title: string
  fullSentence?: string
  fullSentenceZh?: string
  levels: Array<{
    level: number
    label: string
    en: string
    zh: string
    highlight?: string
    hint?: string
  }>
}

/** 句型操练：语法框架固定 + 槽位内容可变 */
export interface PatternDrillItem {
  type: 'pattern_drill'
  id: string
  title: string
  pattern: string
  patternMeaning?: string
  direction?: DrillDirection
  items: Array<{ zh: string; answer: string; hint?: string }>
}

export type OutputPipelineItem =
  | ChunkSubstitutionItem
  | VocabDrillItem
  | VnDialogueItem
  | VocabSentenceBuildingItem
  | SentenceDecompositionItem
  | PatternDrillItem

export interface OutputTrainingMetadata {
  version: number
  enabled: boolean
  pipeline: OutputPipelineItem[]
}

// ── TopicDetail ──

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
    inkScriptId?: string | null
    metadata?: {
      outputTraining?: OutputTrainingMetadata
    } | null
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
    examples?: Array<{ en: string; zh?: string; note?: string | null; level?: string; audioUrl?: string | null }>
    description?: string | null
    difficulty?: string
    outputPriority?: 'low' | 'medium' | 'high'
    collocations?: Array<{ collocation: string; zh?: string }> | null
  }>
  activeChunks: {
    id: string
    text: string
    meaning: string
    description?: string | null
    examples?: Array<{ en: string; zh: string; note?: string | null; level?: string; audioUrl?: string | null }>
    masteryStatus: string
  }[]
  sentencePatterns?: Array<{
    pattern: string
    meaning: string
    slots: string[]
    example: string
    difficulty: string
  }> | null
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
    post<PracticeSession>(`/practice/topics/${topicId}/sessions`, { topicId }),

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
    isRetry?: boolean
    parentTurnId?: string
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
    mode?: string
    requiredChunks?: string[]
    targetWords?: string[]
    essentialSlots?: string[]
    allowParaphrase?: boolean
  }) => post<{
    intent: string
    passed: boolean
    objectiveCompleted: string[]
    chunksUsed: string[]
    targetWordsUsed?: string[]
    missingTargets?: string[]
    inkVariables: Record<string, string | number | boolean>
    feedback: string
    confidence: number
    correction?: string | null
    upgraded?: string | null
    retryRequired?: boolean
    retryPrompt?: string | null
    focusChunk?: string | null
    grammarIssues?: Array<{ type: string; original: string; correction: string }>
  }>('/practice-ai/dialogue-turn', dto),

  judgeWarmupTurn: async (dto: WarmupTurnJudgeInput) => {
    const preferences = usePreferencesStore.getState()
    const preferLocal = preferences.localAiWarmupJudgeEnabled
    const offline = isBrowserOffline()
    if (preferLocal || offline) {
      try {
        const modelStatus = await warmupModelManager.getStatus(preferences.localAiWarmupModelVariant)
        if (modelStatus.installing) {
          toast.info('本地 AI 模型正在下载，下载完成后将自动用于判题')
          if (!offline) {
            return judgeWarmupTurnRemotely(dto, getCurrentSessionSnapshot()?.user?.role === 'admin' ? '本地 AI 下载中，已切到云端判题' : undefined)
          }
          throw new Error('本地 AI 模型正在下载，离线时暂不可判题')
        }

        const local = await judgeWarmupTurnLocally(dto)
        if (getCurrentSessionSnapshot()?.user?.role === 'admin') {
          toast.info(`本地 AI 已判断：${local.passed ? '通过' : '未通过'} · ${local.score}${local.fallback ? ' · 低置信' : ''}`)
        }
        if (!offline && (!local.passed || local.fallback)) {
          return judgeWarmupTurnRemotely(
            dto,
            getCurrentSessionSnapshot()?.user?.role === 'admin'
              ? local.fallback
                ? '本地 AI 低置信，已切到云端复判'
                : '本地 AI 未通过，已切到云端复判'
              : undefined,
          )
        }
        if (preferLocal || !local.fallback) {
          return {
            passed: local.passed,
            score: local.score,
            feedback: local.feedback,
            correction: local.correction,
          }
        }
      } catch (error) {
        console.warn('[warmup-local-judge] fallback to server:', error)
        if (isLocalModelHealthError(error)) {
          usePreferencesStore.getState().setLocalAiWarmupJudgeEnabled(false)
          if (getCurrentSessionSnapshot()?.user?.role === 'admin') {
            toast.warning('本地 AI 模型加载失败，已回退云端并关闭本地判断，请在存储管理中重新下载')
          }
        }
        if (offline) throw error
      }
    }

    return judgeWarmupTurnRemotely(dto)
  },

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

// ---- Warmup Records ----
export interface WarmupRecord {
  id: string
  score: number | null
  feedback: string | null
  items: any[]
  topicTitle?: string
  createdAt: string
}

export const warmupRecordApi = {
  list: (topicId: string) =>
    get<WarmupRecord[]>('/practice/warmup-records', { topicId }),

  listAll: () =>
    get<WarmupRecord[]>('/practice/warmup-records'),

  save: (topicId: string, items: any[]) =>
    post<{ id: string }>('/practice/warmup-records', { topicId, items }),

  assess: (topicId: string, topicTitle: string, items: any[]) =>
    post<{ id: string; score: number; feedback: string }>('/practice/warmup-records/assess', { topicId, topicTitle, items }),
}

export interface RemoteDailyPracticeProgress {
  itemId: string
  packId: string
  topicId: string
  type: string
  status: string
  dueDate: string
  lastPracticedAt?: string | null
  bestScore?: string | null
  bestScoreRank?: number
  lastScore?: string | null
  lastScoreRank?: number
  attempts?: number
  correctCount?: number
  streak?: number
  lapseCount?: number
  intervalDays?: number
  easeFactor?: number
}

export const dailyPracticeApi = {
  progress: (itemIds: string[]) =>
    post<{ items: RemoteDailyPracticeProgress[] }>('/practice/daily-practice/progress', { itemIds }),

  complete: (payload: any) =>
    post<{ runId: string; syncedAttempts: string[]; warmupRecordId: string | null }>('/practice/daily-practice/complete', payload),

  recordActivity: (payload: {
    date: string
    sourceId: string
    scope: 'daily' | 'dialogue'
    activeSeconds: number
    questionCount?: number
  }) => post('/practice/daily-practice/activity', payload),
}

export default practiceApi
