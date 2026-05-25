import { create } from 'zustand'

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('guide-exam-config')
  } catch {
    /* ignore */
  }
}

export interface ExamConfig {
  province: string
  language: string
  examType: string
  interviewForm: string
  bankId?: string
  bankName?: string
}

/** GET /bootstrap 响应（与后端 ConfigGuideService.getBootstrap 对齐） */
export interface BootstrapPayload {
  configured: boolean
  config: {
    province: string
    language: string
    examType: string
    interviewForm: string
  } | null
  bank: { id: string; name: string; topics?: unknown[] } | null
}

interface ConfigStore {
  config: ExamConfig | null
  isConfigured: boolean
  setConfig: (config: ExamConfig) => void
  clearConfig: () => void
  hydrateFromBootstrap: (payload: BootstrapPayload) => void
}

export const useConfigStore = create<ConfigStore>()((set) => ({
  config: null,
  isConfigured: false,
  setConfig: (config) => set({ config, isConfigured: true }),
  clearConfig: () => set({ config: null, isConfigured: false }),
  hydrateFromBootstrap: (payload) => {
    if (!payload.configured || !payload.config) {
      set({ config: null, isConfigured: false })
      return
    }
    set({
      isConfigured: true,
      config: {
        province: payload.config.province,
        language: payload.config.language,
        examType: payload.config.examType,
        interviewForm: payload.config.interviewForm,
        bankId: payload.bank?.id,
        bankName: payload.bank?.name ?? undefined,
      },
    })
  },
}))
