import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { IMMERSIVE_PAUSE_GAP_SECONDS, type ImmersivePauseGapSeconds, type ImmersivePlaybackSettings } from './immersive-player.types'

export const DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS: ImmersivePlaybackSettings = {
  sleepTimerMinutes: 0,
  repeatPerItem: 1,
  playbackRate: 1,
  pauseGapSeconds: 2,
  playMainText: true,
  playMeaning: true,
  playExample: true,
  playExampleTranslation: false,
  autoNext: true,
  loopQueue: false,
  textVisible: true,
}

function isPauseGap(value: unknown): value is ImmersivePauseGapSeconds {
  return IMMERSIVE_PAUSE_GAP_SECONDS.includes(value as ImmersivePauseGapSeconds)
}

function mergeSettings(settings: Partial<ImmersivePlaybackSettings> | undefined): ImmersivePlaybackSettings {
  const merged = { ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS, ...settings }
  if (!isPauseGap(merged.pauseGapSeconds)) {
    merged.pauseGapSeconds = DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS.pauseGapSeconds
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
