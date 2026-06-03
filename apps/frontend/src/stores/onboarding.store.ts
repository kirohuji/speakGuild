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
    targetSelector: '[data-spotlight="go-to-shop"]',
    title: '去商店选教材',
    description: '还没有进行中的单元？点击这里去商店挑选',
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
    title: '确认开始',
    description: '点击「开始」进入单元学习',
    clickToAdvance: true,
  },
  {
    id: 'bookmark-tip',
    route: '/learning/units',
    targetSelector: '[data-spotlight="bookmark-btn"]',
    title: '💡 小技巧：收藏',
    description: '遇到不熟悉的单词或句块？点击收藏，稍后集中复习',
    clickToAdvance: false,
  },
  {
    id: 'library-tip',
    route: '/learning/units',
    targetSelector: 'a[href="#/expressions"]',
    title: '我的学习库',
    description: '收藏的词句都在这里，随时复习巩固',
    clickToAdvance: false,
  },
  {
    id: 'start-vn',
    route: '/learning/units',
    targetSelector: '[data-spotlight="start-vn-practice"]',
    title: '开始实战！',
    description: '点击这里进入口语练习，AI 会陪你练口语并给出纠错反馈',
    clickToAdvance: true,
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
