import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LocalWarmupModelVariantId } from '@/lib/local-ai/warmup-model-manager'
import type { LocalSttModelVariantId } from '@/lib/local-stt/local-stt-model-manager'
import type { TtsProviderKey } from '@/lib/tts-api'

// ---- Web Speech API（浏览器原生，无需后端） ----
export interface TtsSettings {
  voiceURI: string   // 声音标识符，空字符串 = 系统默认
  rate: number       // 语速 0.5 – 2.0，默认 0.9
  pitch: number      // 音调 0.0 – 2.0，默认 1.0
  volume: number     // 音量 0.0 – 1.0，默认 1.0
}

// ---- 后端 TTS 配置（持久化音频 + 词时间戳） ----
export interface TtsBackendSettings {
  provider: TtsProviderKey
  model: string
  voiceId?: string
  params?: Record<string, string | number | boolean>
}

interface Preferences {
  autoPlay: boolean
  bgmEnabled: boolean
  bgmVolume: number | null
  theme: string
  language: string
  tts: TtsSettings
  ttsBackend: TtsBackendSettings
  wifiOnlyMedia: boolean
  nativeSpeechRecognitionEnabled: boolean
  localSttEnabled: boolean
  localSttModelVariant: LocalSttModelVariantId
  localSttFallbackToCloud: boolean
  dailyGoal: number
  dailyPracticeGoal: number
  reviewBatchSize: number
  dailyPracticeMixedPacks: boolean
  dailyPracticeRandomOrder: boolean
  dailyPracticeLastMode: string
  localAiWarmupJudgeEnabled: boolean
  localAiWarmupModelVariant: LocalWarmupModelVariantId
  learningReminderEnabled: boolean
  learningReminderTime: string
}

interface PreferencesStore extends Preferences {
  setAutoPlay: (autoPlay: boolean) => void
  setBgmEnabled: (bgmEnabled: boolean) => void
  setBgmVolume: (bgmVolume: number) => void
  setTheme: (theme: string) => void
  setLanguage: (language: string) => void
  setTts: (tts: Partial<TtsSettings>) => void
  setTtsBackend: (settings: Partial<TtsBackendSettings>) => void
  setWifiOnlyMedia: (value: boolean) => void
  setNativeSpeechRecognitionEnabled: (value: boolean) => void
  setLocalSttEnabled: (value: boolean) => void
  setLocalSttModelVariant: (value: LocalSttModelVariantId) => void
  setLocalSttFallbackToCloud: (value: boolean) => void
  setDailyGoal: (value: number) => void
  setDailyPracticeGoal: (value: number) => void
  setReviewBatchSize: (value: number) => void
  setDailyPracticeMixedPacks: (value: boolean) => void
  setDailyPracticeRandomOrder: (value: boolean) => void
  setDailyPracticeLastMode: (value: string) => void
  setLocalAiWarmupJudgeEnabled: (value: boolean) => void
  setLocalAiWarmupModelVariant: (value: LocalWarmupModelVariantId) => void
  setLearningReminderEnabled: (value: boolean) => void
  setLearningReminderTime: (value: string) => void
}

export const DEFAULT_TTS: TtsSettings = {
  voiceURI: '',
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
}

export const DEFAULT_TTS_BACKEND: TtsBackendSettings = {
  provider: 'minimax',
  model: 'speech-2.8-hd',
  voiceId: 'English_Trustworthy_Man',
  params: { speed: 1, vol: 1, pitch: 0 },
}

export const PRACTICE_BATCH_OPTIONS = [20, 40, 60] as const

function normalizePracticeBatchSize(value: number | undefined, fallback: number) {
  if (value == null || Number.isNaN(value)) return fallback
  if ((PRACTICE_BATCH_OPTIONS as readonly number[]).includes(value)) return value
  if (value <= 20) return 20
  if (value <= 40) return 40
  return 60
}

const DEFAULT_PREFERENCES: Preferences = {
  autoPlay: false,
  bgmEnabled: false,
  bgmVolume: null,
  theme: 'system',
  language: 'zh-CN',
  tts: DEFAULT_TTS,
  ttsBackend: DEFAULT_TTS_BACKEND,
  wifiOnlyMedia: true,
  nativeSpeechRecognitionEnabled: false,
  localSttEnabled: false,
  localSttModelVariant: 'tiny-en-q8',
  localSttFallbackToCloud: true,
  dailyGoal: 20,
  dailyPracticeGoal: 20,
  reviewBatchSize: 20,
  dailyPracticeMixedPacks: false,
  dailyPracticeRandomOrder: true,
  dailyPracticeLastMode: 'practice',
  localAiWarmupJudgeEnabled: false,
  localAiWarmupModelVariant: 'q8',
  learningReminderEnabled: true,
  learningReminderTime: '20:00',
}

// These values change the account's learning plan. Keep device capabilities
// (language, network policy, installed-model choices and TTS output) shared,
// but never carry a plan configuration from one account to another.
const ACCOUNT_LEARNING_PREFERENCE_KEYS = [
  'dailyGoal',
  'dailyPracticeGoal',
  'reviewBatchSize',
  'dailyPracticeMixedPacks',
  'dailyPracticeRandomOrder',
  'dailyPracticeLastMode',
  'learningReminderEnabled',
  'learningReminderTime',
] as const

type AccountLearningPreferences = Pick<Preferences, typeof ACCOUNT_LEARNING_PREFERENCE_KEYS[number]>

let activeAccountId: string | null = null

function accountPreferencesKey(userId: string) {
  return `manyu-account-learning-preferences:${userId}`
}

function snapshotAccountLearningPreferences(state: Preferences): AccountLearningPreferences {
  return Object.fromEntries(ACCOUNT_LEARNING_PREFERENCE_KEYS.map((key) => [key, state[key]])) as AccountLearningPreferences
}

function readAccountLearningPreferences(userId: string): Partial<AccountLearningPreferences> | null {
  try {
    const raw = localStorage.getItem(accountPreferencesKey(userId))
    return raw ? JSON.parse(raw) as Partial<AccountLearningPreferences> : null
  } catch {
    return null
  }
}

function writeAccountLearningPreferences(userId: string, state: Preferences) {
  try {
    localStorage.setItem(accountPreferencesKey(userId), JSON.stringify(snapshotAccountLearningPreferences(state)))
  } catch {
    // A full/private local store must not block authentication.
  }
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      setAutoPlay: (autoPlay) => set({ autoPlay }),
      setBgmEnabled: (bgmEnabled) => set({ bgmEnabled }),
      setBgmVolume: (bgmVolume) => set({ bgmVolume }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => {
        set({ language })
        localStorage.setItem('manyu-language', language)
      },
      setTts: (tts) =>
        set((state) => ({ tts: { ...state.tts, ...tts } })),
      setTtsBackend: (settings) =>
        set((state) => ({ ttsBackend: { ...state.ttsBackend, ...settings } })),
      setWifiOnlyMedia: (value) => set({ wifiOnlyMedia: value }),
      setNativeSpeechRecognitionEnabled: (value) => set({ nativeSpeechRecognitionEnabled: value }),
      setLocalSttEnabled: (value) => set({ localSttEnabled: value }),
      setLocalSttModelVariant: (value) => set({ localSttModelVariant: value }),
      setLocalSttFallbackToCloud: (value) => set({ localSttFallbackToCloud: value }),
      // dailyGoal is retained as a persisted compatibility alias for older settings screens.
      setDailyGoal: (value) => set({ dailyGoal: value, dailyPracticeGoal: value }),
      setDailyPracticeGoal: (value) => set({ dailyGoal: value, dailyPracticeGoal: value }),
      setReviewBatchSize: (value) => set({ reviewBatchSize: value }),
      setDailyPracticeMixedPacks: (value) => set({ dailyPracticeMixedPacks: value }),
      setDailyPracticeRandomOrder: (value) => set({ dailyPracticeRandomOrder: value }),
      setDailyPracticeLastMode: (value) => set({ dailyPracticeLastMode: value }),
      setLocalAiWarmupJudgeEnabled: (value) => set({ localAiWarmupJudgeEnabled: value }),
      setLocalAiWarmupModelVariant: (value) => set({ localAiWarmupModelVariant: value }),
      setLearningReminderEnabled: (value) => set({ learningReminderEnabled: value }),
      setLearningReminderTime: (value) => set({ learningReminderTime: value }),
    }),
    {
      name: 'manyu-preferences',
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<PreferencesStore>
        const base = version >= 2
          ? state
          : {
              ...state,
              dailyPracticeRandomOrder: state.dailyPracticeRandomOrder ?? DEFAULT_PREFERENCES.dailyPracticeRandomOrder,
              localSttEnabled: state.localSttEnabled ?? DEFAULT_PREFERENCES.localSttEnabled,
              localSttModelVariant: state.localSttModelVariant ?? DEFAULT_PREFERENCES.localSttModelVariant,
              localSttFallbackToCloud: state.localSttFallbackToCloud ?? DEFAULT_PREFERENCES.localSttFallbackToCloud,
              localAiWarmupJudgeEnabled: state.localAiWarmupJudgeEnabled ?? DEFAULT_PREFERENCES.localAiWarmupJudgeEnabled,
              localAiWarmupModelVariant: state.localAiWarmupModelVariant ?? DEFAULT_PREFERENCES.localAiWarmupModelVariant,
              learningReminderEnabled: DEFAULT_PREFERENCES.learningReminderEnabled,
              learningReminderTime: !state.learningReminderTime || state.learningReminderTime === '20:30'
                ? DEFAULT_PREFERENCES.learningReminderTime
                : state.learningReminderTime,
            }
        const dailyPracticeGoal = normalizePracticeBatchSize(
          base.dailyPracticeGoal ?? base.dailyGoal,
          DEFAULT_PREFERENCES.dailyPracticeGoal,
        )
        return {
          ...base,
          dailyGoal: dailyPracticeGoal,
          dailyPracticeGoal,
          reviewBatchSize: normalizePracticeBatchSize(base.reviewBatchSize, DEFAULT_PREFERENCES.reviewBatchSize),
        }
      },
    }
  )
)

function applyAccountLearningPreferences(initialPreferences: Partial<AccountLearningPreferences> | null) {
  const dailyPracticeGoal = normalizePracticeBatchSize(
    initialPreferences?.dailyPracticeGoal ?? initialPreferences?.dailyGoal,
    DEFAULT_PREFERENCES.dailyPracticeGoal,
  )
  usePreferencesStore.setState({
    ...snapshotAccountLearningPreferences(DEFAULT_PREFERENCES),
    ...initialPreferences,
    dailyGoal: dailyPracticeGoal,
    dailyPracticeGoal,
    reviewBatchSize: normalizePracticeBatchSize(initialPreferences?.reviewBatchSize, DEFAULT_PREFERENCES.reviewBatchSize),
  })
}

/** Switch only account-owned learning-plan preferences after authentication. */
export function activateAccountLearningPreferences(userId: string | null, options: { migrateCurrentDeviceValues?: boolean } = {}): void {
  const current = usePreferencesStore.getState()
  const previousAccountId = activeAccountId
  if (previousAccountId && previousAccountId !== userId) {
    writeAccountLearningPreferences(previousAccountId, current)
  }
  activeAccountId = userId
  if (!userId) {
    // A session can expire before any account id is bound. Those device values
    // are the only copy the next login can migrate, so leave them in place.
    // Once an account was bound, its snapshot is already saved above.
    if (previousAccountId) applyAccountLearningPreferences(null)
    return
  }
  const accountPreferences = readAccountLearningPreferences(userId)
  // Existing installs stored these values device-wide. Migrate them only for
  // the known prior owner; a newly signed-in account must start from defaults.
  const initialPreferences = accountPreferences
    ?? (options.migrateCurrentDeviceValues ? snapshotAccountLearningPreferences(current) : null)
  applyAccountLearningPreferences(initialPreferences)
}

usePreferencesStore.subscribe((state) => {
  if (activeAccountId) writeAccountLearningPreferences(activeAccountId, state)
})
