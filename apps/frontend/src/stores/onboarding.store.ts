import { create } from 'zustand'

// ---- 单步引导配置 ----
export interface OnboardingStep {
  /** 唯一标识 */
  id: string
  /** 所属页面路由前缀（离开页面时自动取消分段引导） */
  route: string
  /** CSS 选择器，如 '[data-spotlight="bookmark-btn"]' */
  targetSelector: string
  /** i18n key，优先于 title/description 渲染 */
  titleKey?: string
  /** i18n key，优先于 title/description 渲染 */
  descKey?: string
  /** 硬编码 fallback（一般不用，与 i18n key 二选一） */
  title?: string
  description?: string
  /** 用户点击高亮元素时是否自动推进并完成 */
  clickToAdvance: boolean
}

/** 引导模式：tour=完整连贯流程 / segment=分段条件引导 */
export type OnboardingMode = 'tour' | 'segment'

// ---- Tour 模式：新用户总览（重点：学习计划首页 → 商店 → 选学习包）----
// 今日任务、学习本、剧本等日常引导由 Segment 模式负责，这里不重复覆盖
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'nav-to-learning',
    route: '/',
    targetSelector: 'a[href="#/learning"]',
    titleKey: 'onboarding.tourNavTitle',
    descKey: 'onboarding.tourNavDesc',
    clickToAdvance: true,
  },
  {
    id: 'go-to-shop',
    route: '/learning',
    targetSelector: '[data-spotlight="go-to-shop"], [data-spotlight="open-shop"]',
    titleKey: 'onboarding.tourShopTitle',
    descKey: 'onboarding.tourShopDesc',
    clickToAdvance: true,
  },
  {
    id: 'pick-unit',
    route: '/learning',
    targetSelector: '[data-spotlight="first-shop-unit"]',
    titleKey: 'onboarding.tourPickTitle',
    descKey: 'onboarding.tourPickDesc',
    clickToAdvance: true,
  },
  {
    id: 'confirm-unit',
    route: '/learning',
    targetSelector: '[data-spotlight="confirm-start"]',
    titleKey: 'onboarding.tourConfirmTitle',
    descKey: 'onboarding.tourConfirmDesc',
    clickToAdvance: false,
  },
]

// ---- Segment 模式：分段定义（各自独立，由页面在数据就绪时按条件触发）----
export interface OnboardingSegment {
  id: string
  steps: OnboardingStep[]
}

export const ONBOARDING_SEGMENTS: OnboardingSegment[] = [
  {
    id: 'shop-categories',
    steps: [
      {
        id: 'shop-categories',
        route: '/learning',
        targetSelector: '[data-spotlight="shop-category-tabs"]',
        titleKey: 'onboarding.shopCategoriesTitle',
        descKey: 'onboarding.shopCategoriesDesc',
        clickToAdvance: false,
      },
    ],
  },
  {
    id: 'unit-save-to-library',
    steps: [
      {
        id: 'unit-save-to-library',
        route: '/learning/units/',
        targetSelector: '[data-spotlight="first-vocab-card"]',
        titleKey: 'onboarding.unitSaveTitle',
        descKey: 'onboarding.unitSaveDesc',
        clickToAdvance: false,
      },
    ],
  },
  {
    id: 'today-practice',
    steps: [
      {
        id: 'today-practice',
        route: '/today',
        targetSelector: '[data-spotlight="today-practice-button"]',
        titleKey: 'onboarding.todayTitle',
        descKey: 'onboarding.todayDesc',
        clickToAdvance: true,
      },
    ],
  },
  {
    id: 'notebooks',
    steps: [
      {
        id: 'notebooks',
        route: '/expressions',
        targetSelector: '[data-spotlight="first-notebook-row"]',
        titleKey: 'onboarding.notebooksTitle',
        descKey: 'onboarding.notebooksDesc',
        clickToAdvance: false,
      },
    ],
  },
  {
    id: 'scripts',
    steps: [
      {
        id: 'scripts',
        route: '/scripts',
        targetSelector: '[data-spotlight="first-script-card"]',
        titleKey: 'onboarding.scriptsTitle',
        descKey: 'onboarding.scriptsDesc',
        clickToAdvance: false,
      },
    ],
  },
]

const STORAGE_KEY = 'manyu:onboarding-segments-completed'

function loadCompleted(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveCompleted(completed: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
  } catch {
    // 存储失败不阻塞交互
  }
}

// ---- Store ----
interface OnboardingStore {
  /** 当前引导模式，null = 无引导 */
  mode: OnboardingMode | null
  /** 当前步骤下标（tour 与 segment 共用） */
  currentIndex: number
  /** 当前模式步骤列表 */
  steps: OnboardingStep[]
  /** segment 模式当前分段 id */
  activeSegmentId: string | null
  /** 已看完/已关闭的分段（localStorage 持久化） */
  completedSegments: Record<string, boolean>

  /** 启动完整引导流程（Tour），会打断当前分段 */
  startTour: () => void
  /** 跳转到指定步骤（Tour 步骤控制） */
  goToStep: (index: number) => void
  /** 页面在数据就绪时调用：无引导激活且该分段未完成则启动 */
  tryStartSegment: (segmentId: string) => void
  /** 离开分段所属页面时取消（不标记完成，下次进入再提示） */
  cancelSegment: () => void
  next: () => void
  prev: () => void
  /** 完成当前模式：segment 标记完成；tour 由 Provider 写后端 */
  finish: () => void
}

export const useOnboardingStore = create<OnboardingStore>()((set, get) => ({
  mode: null,
  currentIndex: 0,
  steps: [],
  activeSegmentId: null,
  completedSegments: loadCompleted(),

  startTour: () => {
    set({ mode: 'tour', currentIndex: 0, steps: ONBOARDING_STEPS, activeSegmentId: null })
  },

  goToStep: (index) => {
    const { steps } = get()
    if (index >= 0 && index < steps.length) set({ currentIndex: index })
  },

  tryStartSegment: (segmentId) => {
    const { mode, completedSegments } = get()
    if (mode || completedSegments[segmentId]) return
    const segment = ONBOARDING_SEGMENTS.find((s) => s.id === segmentId)
    if (!segment) return
    set({ mode: 'segment', activeSegmentId: segment.id, currentIndex: 0, steps: segment.steps })
  },

  cancelSegment: () => {
    if (get().mode !== 'segment') return
    set({ mode: null, activeSegmentId: null, currentIndex: 0, steps: [] })
  },

  next: () => {
    const { currentIndex, steps } = get()
    if (currentIndex >= steps.length - 1) {
      get().finish()
    } else {
      set({ currentIndex: currentIndex + 1 })
    }
  },

  prev: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) set({ currentIndex: currentIndex - 1 })
  },

  finish: () => {
    const { mode, activeSegmentId, completedSegments } = get()
    if (!mode) return
    if (mode === 'segment' && activeSegmentId) {
      const next = { ...completedSegments, [activeSegmentId]: true }
      saveCompleted(next)
      set({ completedSegments: next })
    }
    set({ mode: null, activeSegmentId: null, currentIndex: 0, steps: [] })
  },
}))
