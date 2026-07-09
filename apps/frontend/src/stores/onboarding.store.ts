import { create } from 'zustand'

// ---- 单步引导配置 ----
export interface OnboardingStep {
  /** 唯一标识 */
  id: string
  /** 目标页面路由（用于 Provider 检测是否在正确页面） */
  route: string
  /** CSS 选择器，如 '[data-spotlight="go-to-shop"]' */
  targetSelector: string
  /** Tooltip 标题 */
  title: string
  /** Tooltip 描述 */
  description: string
  /** 用户点击高亮元素时是否自动推进到下一步 */
  clickToAdvance: boolean
}

// ---- 引导步骤定义 ----
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'nav-to-learning',
    route: '/',
    targetSelector: 'a[href="#/learning"]',
    title: '从这里开始',
    description: '点击底部「学习计划」，开启你的口语训练之旅',
    clickToAdvance: true,
  },
  {
    id: 'go-to-shop',
    route: '/learning',
    targetSelector: '[data-spotlight="go-to-shop"], [data-spotlight="open-shop"]',
    title: '去商店选教材',
    description: '可以从这里打开商店，挑选适合你的学习包。',
    clickToAdvance: true,
  },
  {
    id: 'pick-unit',
    route: '/learning',
    targetSelector: '[data-spotlight="first-shop-unit"]',
    title: '挑选一个单元',
    description: '从商店中选择一个感兴趣的单元',
    clickToAdvance: true,
  },
  {
    id: 'confirm-unit',
    route: '/learning',
    targetSelector: '[data-spotlight="confirm-start"]',
    title: '准备好后再开始',
    description: '这里会把学习包加入你的计划。准备好时点「开始」即可，后续每天主要从「今日任务」练输出。',
    clickToAdvance: false,
  },
  {
    id: 'today-overview',
    route: '/today',
    targetSelector: '[data-spotlight="today-practice-button"]',
    title: '每天从这里练',
    description: '今日任务会根据你的学习包安排输出练习和复练。看到任务后，按自己的节奏开始就好。',
    clickToAdvance: false,
  },
]

// ---- Store ----
interface OnboardingStore {
  isActive: boolean
  currentIndex: number
  steps: OnboardingStep[]

  start: () => void
  next: () => void
  prev: () => void
  finish: () => void
  goToStep: (index: number) => void
}

export const useOnboardingStore = create<OnboardingStore>()((set, get) => ({
  isActive: false,
  currentIndex: 0,
  steps: ONBOARDING_STEPS,

  start: () => {
    set({ isActive: true, currentIndex: 0, steps: ONBOARDING_STEPS })
  },

  next: () => {
    const { currentIndex, steps } = get()
    if (currentIndex >= steps.length - 1) {
      set({ isActive: false, currentIndex: 0 })
    } else {
      set({ currentIndex: currentIndex + 1 })
    }
  },

  prev: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 })
    }
  },

  finish: () => {
    set({ isActive: false, currentIndex: 0 })
  },

  goToStep: (index: number) => {
    set({ currentIndex: index })
  },
}))
