import { create } from 'zustand'
import type { UpdaterAPI } from '@/lib/native/types'

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'failed'

interface AppUpdateState {
  status: UpdateStatus
  dialogOpen: boolean
  version: string
  url: string
  isMandatory: boolean
  shouldNotify: boolean
  displayPercent: number
  checking: boolean
  error: string | null
  bindUpdaterEvents: (updater: UpdaterAPI) => void
  prepareManualCheck: () => void
  finishNoUpdate: () => void
  openDialog: () => void
  closeDialog: () => void
  resetAfterRestart: () => void
}

let updaterEventsBound = false
let progressTimer: number | null = null

function stopProgressTimer() {
  if (!progressTimer) return
  window.clearInterval(progressTimer)
  progressTimer = null
}

function startProgressTimer() {
  stopProgressTimer()
  progressTimer = window.setInterval(() => {
    useAppUpdateStore.setState((state) => {
      if (state.status !== 'downloading') {
        stopProgressTimer()
        return state
      }
      if (state.displayPercent >= 88) return state
      const step = state.displayPercent < 20 ? 2 : state.displayPercent < 60 ? 1 : 0.4
      return { displayPercent: Math.min(88, state.displayPercent + step) }
    })
  }, 900)
}

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  status: 'idle',
  dialogOpen: false,
  version: '',
  url: '',
  isMandatory: false,
  shouldNotify: true,
  displayPercent: 0,
  checking: false,
  error: null,

  bindUpdaterEvents(updater) {
    if (updaterEventsBound) return
    updaterEventsBound = true

    updater.onUpdateAvailable((info) => {
      if (!info.version) return
      set({
        status: 'downloading',
        dialogOpen: true,
        version: info.version,
        url: info.url || '',
        isMandatory: Boolean(info.isMandatory),
        shouldNotify: info.shouldNotify ?? true,
        displayPercent: 8,
        checking: false,
        error: null,
      })
      startProgressTimer()
    })

    updater.onDownload((percent) => {
      const rounded = Math.max(0, Math.min(99, Math.round(percent)))
      set((state) => ({
        status: state.status === 'ready' ? state.status : 'downloading',
        displayPercent: Math.max(state.displayPercent, rounded, 8),
        checking: false,
      }))
      startProgressTimer()
    })

    updater.onDownloadComplete(() => {
      stopProgressTimer()
      set({ status: 'ready', displayPercent: 100, checking: false, error: null })
    })

    updater.onFailed((error) => {
      stopProgressTimer()
      set({
        status: 'failed',
        displayPercent: 0,
        checking: false,
        error: error instanceof Error ? error.message : String(error ?? ''),
      })
    })
  },

  prepareManualCheck() {
    stopProgressTimer()
    set({
      status: 'checking',
      dialogOpen: false,
      version: '',
      url: '',
      isMandatory: false,
      shouldNotify: true,
      displayPercent: 0,
      checking: true,
      error: null,
    })
  },

  finishNoUpdate() {
    if (get().status === 'checking') {
      set({ status: 'idle', checking: false, displayPercent: 0 })
    } else {
      set({ checking: false })
    }
  },

  openDialog() {
    if (get().version) set({ dialogOpen: true })
  },

  closeDialog() {
    set({ dialogOpen: false })
  },

  resetAfterRestart() {
    stopProgressTimer()
    set({
      status: 'idle',
      dialogOpen: false,
      version: '',
      url: '',
      isMandatory: false,
      shouldNotify: true,
      displayPercent: 0,
      checking: false,
      error: null,
    })
  },
}))
