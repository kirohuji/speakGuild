import { create } from 'zustand'
import { get } from '@/lib/request'

export interface PublicFlags {
  scriptPracticeEnabled: boolean
}

interface FeatureFlagsStore extends PublicFlags {
  loading: boolean
  loaded: boolean
  fetchFlags: () => Promise<void>
}

/**
 * 公开功能开关 Store
 *
 * 从 GET /system-config/public-flags 拉取，无鉴权。
 * 默认全部为 false（保守关闭），即使请求失败也不影响主流程。
 *
 * 使用方式：
 *   const scriptEnabled = useFeatureFlagsStore((s) => s.scriptPracticeEnabled)
 */
export const useFeatureFlagsStore = create<FeatureFlagsStore>()((set, getState) => ({
  scriptPracticeEnabled: false,

  loading: false,
  loaded: false,

  fetchFlags: async () => {
    // 已加载或正在加载中，跳过
    if (getState().loaded || getState().loading) return

    set({ loading: true })
    try {
      const data = await get<PublicFlags>('/system-config/public-flags')
      set({
        scriptPracticeEnabled: data?.scriptPracticeEnabled ?? false,
        loading: false,
        loaded: true,
      })
    } catch {
      // 请求失败时保持默认值（全部 false），不阻塞任何流程
      set({ loading: false, loaded: true })
    }
  },
}))
