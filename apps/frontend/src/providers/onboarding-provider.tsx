import { useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { getUserProfile, updateUserProfile } from '@/features/profile/api'
import { SpotlightOverlay } from '@/components/common/spotlight-overlay'

interface OnboardingProviderProps {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { session, isAuthenticated } = useAuth()
  const storeIsActive = useOnboardingStore((s) => s.isActive)
  const storeCurrentIndex = useOnboardingStore((s) => s.currentIndex)
  const storeSteps = useOnboardingStore((s) => s.steps)
  const storeStart = useOnboardingStore((s) => s.start)
  const storeNext = useOnboardingStore((s) => s.next)
  const storePrev = useOnboardingStore((s) => s.prev)
  const storeFinish = useOnboardingStore((s) => s.finish)
  const initializedRef = useRef(false)

  // 🧪 检测 test=2（兼容 HashRouter 下 query 在 hash 中的情况）
  const searchStr = location.search || (
    typeof window !== 'undefined'
      ? (() => { const i = window.location.hash.indexOf('?'); return i >= 0 ? window.location.hash.slice(i) : '' })()
      : ''
  )
  const isTestMode = new URLSearchParams(searchStr).get('test') === '2'

  // ---- 启动引导：登录后检查后端标记 ----
  useEffect(() => {
    if (!isAuthenticated || !session?.user?.id) return

    // 🧪 test=2 强制触发引导
    if (isTestMode) {
      storeStart()
      return
    }

    // 正常模式：只检查一次
    if (initializedRef.current) return
    initializedRef.current = true

    getUserProfile()
      .then((profile) => {
        if (!profile.hasCompletedOnboarding) {
          storeStart()
        }
      })
      .catch(() => {
        // 请求失败时保守处理：不启动引导
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, session?.user?.id, isTestMode])

  // ---- 完成引导：写后端（test 模式跳过） ----
  const handleFinish = useCallback(async () => {
    storeFinish()
    if (isTestMode) return
    try {
      await updateUserProfile({ hasCompletedOnboarding: true })
    } catch {
      // 写入失败不阻塞 UI
    }
  }, [storeFinish, isTestMode])

  // ---- 跳过引导 ----
  const handleSkip = useCallback(async () => {
    storeFinish()
    if (isTestMode) return
    try {
      await updateUserProfile({ hasCompletedOnboarding: true })
    } catch {
      // 写入失败不阻塞 UI
    }
  }, [storeFinish, isTestMode])

  // ---- 当前步骤 ----
  const currentStep = storeSteps[storeCurrentIndex]

  // ---- 步骤推进 ----
  const handleNext = useCallback(() => {
    if (storeCurrentIndex >= storeSteps.length - 1) {
      handleFinish()
      return
    }

    const nextStep = storeSteps[storeCurrentIndex + 1]
    storeNext()

    if (nextStep && nextStep.route !== currentStep?.route) {
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

  // ---- 渲染 ----
  return (
    <>
      {children}

      {storeIsActive && currentStep && (
        <SpotlightOverlay
          step={currentStep}
          stepIndex={storeCurrentIndex}
          totalSteps={storeSteps.length}
          isTestMode={isTestMode}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
        />
      )}
    </>
  )
}
