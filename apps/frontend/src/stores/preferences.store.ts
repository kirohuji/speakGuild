import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  dailyGoal: number
  dailyPracticeMixedPacks: boolean
  dailyPracticeRandomOrder: boolean
  dailyPracticeLastMode: string
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
  setDailyGoal: (value: number) => void
  setDailyPracticeMixedPacks: (value: boolean) => void
  setDailyPracticeRandomOrder: (value: boolean) => void
  setDailyPracticeLastMode: (value: string) => void
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

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      autoPlay: false,
      bgmEnabled: false,
      bgmVolume: null,
      theme: 'system',
      language: 'zh-CN',
      tts: DEFAULT_TTS,
      ttsBackend: DEFAULT_TTS_BACKEND,
      wifiOnlyMedia: true,
      nativeSpeechRecognitionEnabled: false,
      dailyGoal: 20,
      dailyPracticeMixedPacks: false,
      dailyPracticeRandomOrder: true,
      dailyPracticeLastMode: 'review',
      learningReminderEnabled: false,
      learningReminderTime: '20:30',
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
      setDailyGoal: (value) => set({ dailyGoal: value }),
      setDailyPracticeMixedPacks: (value) => set({ dailyPracticeMixedPacks: value }),
      setDailyPracticeRandomOrder: (value) => set({ dailyPracticeRandomOrder: value }),
      setDailyPracticeLastMode: (value) => set({ dailyPracticeLastMode: value }),
      setLearningReminderEnabled: (value) => set({ learningReminderEnabled: value }),
      setLearningReminderTime: (value) => set({ learningReminderTime: value }),
    }),
    { name: 'manyu-preferences' }
  )
)
