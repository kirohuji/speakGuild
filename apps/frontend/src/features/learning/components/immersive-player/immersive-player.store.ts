import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { IMMERSIVE_PAUSE_GAP_SECONDS, type ImmersiveAccent, type ImmersivePauseGapSeconds, type ImmersivePlaybackSettings } from './immersive-player.types'

export const DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS: ImmersivePlaybackSettings = {
  sleepTimerMinutes: 0,
  repeatPerItem: 1,
  playbackRate: 1,
  pauseGapSeconds: 2,
  accent: 'us',
  playMainText: true,
  playMeaning: true,
  playExample: false,
  playExampleTranslation: false,
  autoNext: true,
  loopQueue: false,
  textVisible: true,
}

function isPauseGap(value: unknown): value is ImmersivePauseGapSeconds {
  return IMMERSIVE_PAUSE_GAP_SECONDS.includes(value as ImmersivePauseGapSeconds)
}

function isAccent(value: unknown): value is ImmersiveAccent {
  return value === 'us' || value === 'uk'
}

function mergeSettings(settings: Partial<ImmersivePlaybackSettings> | undefined): ImmersivePlaybackSettings {
  const merged = { ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS, ...settings }
  if (!isPauseGap(merged.pauseGapSeconds)) {
    merged.pauseGapSeconds = DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS.pauseGapSeconds
  }
  if (!isAccent(merged.accent)) {
    merged.accent = DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS.accent
  }
  return merged
}

type ImmersivePlayerPreferencesStore = {
  settings: ImmersivePlaybackSettings
  updateSettings: (settings: Partial<ImmersivePlaybackSettings>) => void
}

export const useImmersivePlayerPreferences = create<ImmersivePlayerPreferencesStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      updateSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
    }),
    {
      name: 'manyu-immersive-player',
      version: 1,
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<ImmersivePlayerPreferencesStore> | undefined
        if (version === 0 && persisted?.settings) {
          return {
            ...persisted,
            settings: { ...persisted.settings, playExample: false },
          }
        }
        return persistedState as ImmersivePlayerPreferencesStore
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ImmersivePlayerPreferencesStore> | undefined
        return {
          ...currentState,
          ...persisted,
          settings: mergeSettings(persisted?.settings),
        }
      },
    },
  ),
)
