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
    targetSelector: '[data-spotlight="first-vocab-card"]',
    title: '💡 点开单词卡片',
    description: '点开单词查看释义，下方有「加入学习库」收藏按钮',
    clickToAdvance: true,
  },
  {
    id: 'collect-word',
    route: '/learning/units',
    targetSelector: '[data-spotlight="bookmark-btn"]',
    title: '收藏单词',
    description: '点击「加入学习库」，收藏这个单词随时复习',
    clickToAdvance: true,
  },
  {
    id: 'start-vn',
    route: '/learning/units',
    targetSelector: '[data-spotlight="start-vn-practice"]',
    title: '进入实战',
    description: '点击第一个练习题目，进入口语实战页面',
    clickToAdvance: true,
  },
  {
    id: 'start-practice',
    route: '/practice/session',
    targetSelector: '[data-spotlight="start-vn-practice"]',
    title: '开始练习！',
    description: '准备好了吗？点击「开始练习」正式开练，AI 会陪你练口语并纠错',
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
