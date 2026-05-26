import { create } from 'zustand'

interface LayoutStore {
  bottomNavVisible: boolean
  setBottomNavVisible: (visible: boolean) => void
  /** 沉浸模式 — 隐藏 Header/BottomNav/Footer，用于 VN 对话等全屏场景 */
  immersiveMode: boolean
  setImmersiveMode: (on: boolean) => void
}

export const useLayoutStore = create<LayoutStore>()((set) => ({
  bottomNavVisible: true,
  setBottomNavVisible: (visible) => set({ bottomNavVisible: visible }),

  immersiveMode: false,
  setImmersiveMode: (on) => {
    set({ immersiveMode: on, bottomNavVisible: !on })
  },
}))
