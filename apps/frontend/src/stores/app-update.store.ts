import { create } from 'zustand'
import type { UpdaterAPI } from '@/lib/native/types'

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'failed'
type UpdateStage =
  | 'idle'
  | 'checkingCurrent'
  | 'collectingDeviceInfo'
  | 'requestingUpdateInfo'
  | 'updateFound'
  | 'alreadyDownloaded'
  | 'downloadingBundle'
  | 'preparingNextLaunch'
  | 'applyingUpdate'
  | 'noUpdate'
  | 'ready'
  | 'failed'

interface AppUpdateState {
  status: UpdateStatus
  dialogOpen: boolean
  version: string
  url: string
  isMandatory: boolean
  shouldNotify: boolean
  displayPercent: number
  stage: UpdateStage
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

function stagePercent(stage: UpdateStage) {
  if (stage === 'checkingCurrent') return 8
  if (stage === 'collectingDeviceInfo') return 16
  if (stage === 'requestingUpdateInfo') return 26
  if (stage === 'updateFound') return 34
  if (stage === 'alreadyDownloaded') return 96
  if (stage === 'downloadingBundle') return 36
  if (stage === 'preparingNextLaunch' || stage === 'applyingUpdate') return 96
  if (stage === 'ready') return 100
  return 0
}

function normalizeStage(stage: string): UpdateStage {
  const known: UpdateStage[] = [
    'idle',
    'checkingCurrent',
    'collectingDeviceInfo',
    'requestingUpdateInfo',
    'updateFound',
    'alreadyDownloaded',
    'downloadingBundle',
    'preparingNextLaunch',
    'applyingUpdate',
    'noUpdate',
    'ready',
    'failed',
  ]
  return known.includes(stage as UpdateStage) ? stage as UpdateStage : 'idle'
}

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  status: 'idle',
  dialogOpen: false,
  version: '',
  url: '',
  isMandatory: false,
  shouldNotify: true,
  displayPercent: 0,
  stage: 'idle',
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
        displayPercent: Math.max(get().displayPercent, stagePercent('updateFound')),
        stage: 'updateFound',
        checking: false,
        error: null,
      })
    })

    updater.onDownload((percent) => {
      const rounded = Math.max(0, Math.min(99, Math.round(percent)))
      const mapped = Math.round(36 + rounded * 0.56)
      set((state) => ({
        status: state.status === 'ready' ? state.status : 'downloading',
        stage: state.status === 'ready' ? state.stage : 'downloadingBundle',
        displayPercent: Math.max(state.displayPercent, mapped),
        checking: false,
      }))
    })

    updater.onDownloadComplete(() => {
      set({ status: 'ready', stage: 'ready', displayPercent: 100, checking: false, error: null })
    })

    updater.onStage((nextStage) => {
      const stage = normalizeStage(nextStage)
      set((state) => {
        const status: UpdateStatus =
          stage === 'failed' ? 'failed'
            : stage === 'noUpdate' ? 'idle'
              : stage === 'checkingCurrent' || stage === 'collectingDeviceInfo' || stage === 'requestingUpdateInfo' ? 'checking'
                : stage === 'ready' ? 'ready'
                  : 'downloading'
        return {
          status: state.status === 'ready' ? state.status : status,
          stage: state.status === 'ready' ? state.stage : stage,
          displayPercent: Math.max(state.displayPercent, stagePercent(stage)),
          checking: status === 'checking',
        }
      })
    })

    updater.onFailed((error) => {
      set({
        status: 'failed',
        stage: 'failed',
        displayPercent: 0,
        checking: false,
        error: error instanceof Error ? error.message : String(error ?? ''),
      })
    })
  },

  prepareManualCheck() {
    set({
      status: 'checking',
      dialogOpen: false,
      version: '',
      url: '',
      isMandatory: false,
      shouldNotify: true,
      displayPercent: 0,
      stage: 'checkingCurrent',
      checking: true,
      error: null,
    })
  },

  finishNoUpdate() {
    if (get().status === 'checking') {
      set({ status: 'idle', stage: 'idle', checking: false, displayPercent: 0 })
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
    set({
      status: 'idle',
      dialogOpen: false,
      version: '',
      url: '',
      isMandatory: false,
      shouldNotify: true,
      displayPercent: 0,
      stage: 'idle',
      checking: false,
      error: null,
    })
  },
}))
