import { create } from 'zustand'

interface LayoutStore {
  bottomNavVisible: boolean
  setBottomNavVisible: (visible: boolean) => void
}

export const useLayoutStore = create<LayoutStore>()((set) => ({
  bottomNavVisible: true,
  setBottomNavVisible: (visible) => set({ bottomNavVisible: visible }),
}))
