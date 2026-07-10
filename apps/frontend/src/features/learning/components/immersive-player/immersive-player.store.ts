import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ImmersivePlaybackSettings } from './immersive-player.types'

export const DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS: ImmersivePlaybackSettings = {
  sleepTimerMinutes: 0,
  repeatPerItem: 1,
  playbackRate: 1,
  playMainText: true,
  playMeaning: true,
  playExample: true,
  playExampleTranslation: false,
  autoNext: true,
  loopQueue: false,
  textVisible: true,
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
    },
  ),
)

