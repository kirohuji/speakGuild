import type { LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'

export type ImmersivePlayerItemKind = 'word' | 'chunk' | 'pattern'

export type ImmersivePlayerItem = {
  id: string
  kind: ImmersivePlayerItemKind
  title: string
  meaning?: string | null
  insight?: string | null
  exampleEn?: string | null
  exampleZh?: string | null
  mainAudioUrl?: string | null
  exampleAudioUrl?: string | null
  sceneName?: string | null
  source?: LearningInsightItem
}

export type PlaybackSegmentRole = 'main' | 'meaning' | 'example' | 'exampleTranslation'

export type PlaybackSegment = {
  id: string
  itemId: string
  role: PlaybackSegmentRole
  text: string
  lang: 'en' | 'zh'
  audioUrl?: string | null
  title: string
  subtitle?: string | null
}

export const IMMERSIVE_PAUSE_GAP_SECONDS = [1, 2, 3, 5] as const

export type ImmersivePauseGapSeconds = (typeof IMMERSIVE_PAUSE_GAP_SECONDS)[number]

export type ImmersivePlaybackSettings = {
  sleepTimerMinutes: 0 | 15 | 30 | 60
  repeatPerItem: 1 | 2 | 3 | 'infinite'
  playbackRate: 0.75 | 1 | 1.25 | 1.5
  /** 每播完一遍后的真实等待，不随倍速缩短。重复同一条、进入下一条都会停。 */
  pauseGapSeconds: ImmersivePauseGapSeconds
  playMainText: boolean
  playMeaning: boolean
  playExample: boolean
  playExampleTranslation: boolean
  autoNext: boolean
  loopQueue: boolean
  textVisible: boolean
}

export type ImmersivePlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'
