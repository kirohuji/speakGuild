import { useEffect, useCallback, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { useOnboardingStore, ONBOARDING_SEGMENTS } from '@/stores/onboarding.store'
import { getUserProfile, updateUserProfile, type UserProfile } from '@/features/profile/api'
import { useUserStore } from '@/stores/user.store'
import { LearningAssessmentDialog } from '@/features/profile/components/placement-assessment-dialog'
import { SpotlightOverlay } from '@/components/common/spotlight-overlay'

// 分段引导触发后延迟显示：等页面渲染稳定、用户看清当前内容后再出现，避免"页面一闪就被遮罩"
const SEGMENT_SHOW_DELAY_MS = 1000

interface OnboardingProviderProps {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { session, isAuthenticated } = useAuth()
  const storeMode = useOnboardingStore((s) => s.mode)
  const storeActiveSegmentId = useOnboardingStore((s) => s.activeSegmentId)
  const storeCurrentIndex = useOnboardingStore((s) => s.currentIndex)
  const storeSteps = useOnboardingStore((s) => s.steps)
  const storeNext = useOnboardingStore((s) => s.next)
  const storePrev = useOnboardingStore((s) => s.prev)
  const storeFinish = useOnboardingStore((s) => s.finish)
  const storeCancel = useOnboardingStore((s) => s.cancelSegment)
  const storeStartTour = useOnboardingStore((s) => s.startTour)
  const setCachedProfile = useUserStore((s) => s.setProfile)
  const [placementOpen, setPlacementOpen] = useState(false)
  const [placementProfile, setPlacementProfile] = useState<UserProfile | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const initializedRef = useRef(false)

  // 🧪 检测 test=2（兼容 HashRouter 下 query 在 hash 中的情况）
  const searchStr = location.search || (
    typeof window !== 'undefined'
      ? (() => { const i = window.location.hash.indexOf('?'); return i >= 0 ? window.location.hash.slice(i) : '' })()
      : ''
  )
  const isTestMode = new URLSearchParams(searchStr).get('test') === '2'
  const hasAiPlacementAssessment = (profile: UserProfile | null) =>
    profile?.outputLevelDetail?.source === 'ai_placement_assessment'

  // ---- 启动完整引导（Tour）：从首页开始 ----
  const startGuidance = useCallback(() => {
    storeStartTour()
    if (location.pathname !== '/') {
      navigate('/')
    }
  }, [location.pathname, navigate, storeStartTour])

  // ---- 登录后检查：新用户先测评再走完整引导；老用户日常走分段式 ----
  useEffect(() => {
    if (!isAuthenticated || !session?.user?.id) return

    // 只触发一次（避免每次路由变化/重渲染都重置）
    if (initializedRef.current) return
    initializedRef.current = true

    getUserProfile()
      .then((profile) => {
        setCachedProfile(profile)

        // 🧪 test=2 强制走「先测评，测完再引导」（不写回 DB）
        if (isTestMode) {
          setPlacementProfile(profile)
          setPlacementOpen(true)
          return
        }

        if (!profile.hasCompletedOnboarding) {
          if (hasAiPlacementAssessment(profile)) {
            // 已测评但从未完成引导：首次走完整 Tour
            startGuidance()
          } else {
            // 未测评：先弹测评，测完再走 Tour
            setPlacementProfile(profile)
            setPlacementOpen(true)
          }
        }
        // 已完成 onboarding：日常分段引导由各页面按条件触发，无需处理
      })
      .catch(() => {
        // 请求失败时保守处理：不启动引导
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, session?.user?.id, isTestMode, setCachedProfile, startGuidance])

  // 测评完成 → 进入完整引导（test 模式同样，便于测试）
  const handlePlacementCompleted = useCallback(() => {
    setPlacementOpen(false)
    startGuidance()
  }, [startGuidance])

  // ---- 分段引导延迟显示：tour 即时出现；segment 等页面稳定后再出现 ----
  useEffect(() => {
    if (storeMode === 'segment') {
      setOverlayVisible(false)
      const timer = window.setTimeout(() => setOverlayVisible(true), SEGMENT_SHOW_DELAY_MS)
      return () => window.clearTimeout(timer)
    }
    // tour：测评完成后立即进入引导（用户有预期）；null：无引导
    setOverlayVisible(storeMode === 'tour')
  }, [storeMode])

  // ---- 完成当前引导：仅 Tour 完成时写后端标记 ----
  const handleFinish = useCallback(async () => {
    const isTour = useOnboardingStore.getState().mode === 'tour'
    storeFinish()
    if (!isTour || isTestMode) return
    try {
      await updateUserProfile({ hasCompletedOnboarding: true })
    } catch {
      // 写入失败不阻塞 UI
    }
  }, [storeFinish, isTestMode])

  // ---- 当前步骤 ----
  const currentStep = storeSteps[storeCurrentIndex]

  // ---- 步骤推进（Tour 跨路由导航；Segment 单步直接完成）----
  const handleNext = useCallback((fromClickAdvance?: boolean) => {
    if (storeCurrentIndex >= storeSteps.length - 1) {
      handleFinish()
      return
    }

    const nextStep = storeSteps[storeCurrentIndex + 1]
    storeNext()

    // 仅当「不是 clickToAdvance 触发的」且路由不同时才导航
    // clickToAdvance 时用户已点击目标元素完成了页面跳转，无需再导航
    if (nextStep && nextStep.route !== currentStep?.route && !fromClickAdvance) {
      navigate(nextStep.route)
    }
  }, [storeCurrentIndex, storeSteps, storeNext, handleFinish, currentStep, navigate])

  const handlePrev = useCallback(() => {
    const prevStep = storeSteps[storeCurrentIndex - 1]
    storePrev()

    if (prevStep && prevStep.route !== currentStep?.route) {
      navigate(prevStep.route)
    }
  }, [storeCurrentIndex, storeSteps, storePrev, currentStep, navigate])

  // ---- 离开分段所属页面时自动取消（不标记完成，下次进入再提示）----
  useEffect(() => {
    if (storeMode !== 'segment' || !storeActiveSegmentId) return
    const segment = ONBOARDING_SEGMENTS.find((s) => s.id === storeActiveSegmentId)
    if (!segment || !segment.steps[0]) return
    if (!location.pathname.startsWith(segment.steps[0].route)) {
      storeCancel()
    }
  }, [location.pathname, storeMode, storeActiveSegmentId, storeCancel])

  // ---- 渲染 ----
  return (
    <>
      {children}

      <LearningAssessmentDialog
        open={placementOpen}
        onOpenChange={setPlacementOpen}
        profile={placementProfile}
        required
        onCompleted={handlePlacementCompleted}
      />

      {storeMode && overlayVisible && currentStep && (
        <SpotlightOverlay
          key={currentStep.id}
          step={currentStep}
          stepIndex={storeCurrentIndex}
          totalSteps={storeSteps.length}
          mode={storeMode}
          isTestMode={isTestMode}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleFinish}
        />
      )}
    </>
  )
}
