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

export type ImmersivePlaybackSettings = {
  sleepTimerMinutes: 0 | 15 | 30 | 60
  repeatPerItem: 1 | 2 | 3 | 5
  playbackRate: 0.75 | 1 | 1.25 | 1.5
  playMainText: boolean
  playMeaning: boolean
  playExample: boolean
  playExampleTranslation: boolean
  autoNext: boolean
  loopQueue: boolean
  textVisible: boolean
}

export type ImmersivePlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'
