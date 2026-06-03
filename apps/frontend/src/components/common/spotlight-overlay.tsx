import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronRight, ChevronLeft, X, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OnboardingStep } from '@/stores/onboarding.store'

// ---- 洞口外扩像素 ----
const HOLE_PADDING = 8
// Tooltip 距离目标的间距
const TOOLTIP_GAP = 20
// Tooltip 最大宽度
const TOOLTIP_MAX_W = 300

interface SpotlightOverlayProps {
  step: OnboardingStep
  stepIndex: number
  totalSteps: number
  isTestMode?: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

/** 获取目标元素的 bounding rect，不存在返回 null */
function getTargetRect(selector: string): DOMRect | null {
  try {
    const el = document.querySelector(selector)
    if (!el) return null
    return el.getBoundingClientRect()
  } catch {
    return null
  }
}

/** 计算 Tooltip 放置位置：优先放下方，否则放上方 */
function calcPlacement(
  targetRect: DOMRect,
): { placement: 'bottom' | 'top'; style: Record<string, string | number> } {
  const TOOLTIP_EST_HEIGHT = 200
  const spaceBelow = window.innerHeight - targetRect.bottom - TOOLTIP_GAP
  const spaceAbove = targetRect.top - TOOLTIP_GAP

  if (spaceBelow >= TOOLTIP_EST_HEIGHT || spaceBelow >= spaceAbove) {
    // 放在目标下方
    return {
      placement: 'bottom',
      style: { top: targetRect.bottom + TOOLTIP_GAP },
    }
  }
  // 放在目标上方（用 bottom 定位）
  return {
    placement: 'top',
    style: { bottom: window.innerHeight - targetRect.top + TOOLTIP_GAP },
  }
}

export function SpotlightOverlay({
  step,
  stepIndex,
  totalSteps,
  isTestMode,
  onNext,
  onPrev,
  onSkip,
}: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const [tooltipStyle, setTooltipStyle] = useState<Record<string, string | number>>({})
  const rafRef = useRef<number>(0)

  // 实时追踪目标元素位置
  const updatePosition = useCallback(() => {
    const rect = getTargetRect(step.targetSelector)
    if (rect) {
      setTargetRect(rect)
      const pos = calcPlacement(rect)
      setPlacement(pos.placement)
      setTooltipStyle(pos.style)
    }
  }, [step.targetSelector])

  useEffect(() => {
    // 目标元素可能还没渲染，用 rAF 轮询等待
    let attempts = 0
    const tryFind = () => {
      const rect = getTargetRect(step.targetSelector)
      if (rect) {
        updatePosition()
        return
      }
      attempts++
      if (attempts < 50) {
        // 最多等 1.5 秒
        rafRef.current = requestAnimationFrame(tryFind)
      }
    }
    // 稍微延迟一下等 DOM 渲染
    const timeout = setTimeout(tryFind, 150)

    window.addEventListener('scroll', updatePosition, { passive: true })
    window.addEventListener('resize', updatePosition)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [step.targetSelector, updatePosition])

  // 监听目标元素点击（clickToAdvance）
  useEffect(() => {
    if (!step.clickToAdvance) return
    const el = document.querySelector(step.targetSelector)
    if (!el) return
    const handler = () => {
      // 延迟一下，等导航/交互完成
      setTimeout(() => onNext(), 300)
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [step.targetSelector, step.clickToAdvance, onNext])

  // 没有找到目标时不渲染
  if (!targetRect) {
    return null
  }

  const holeX = targetRect.x - HOLE_PADDING
  const holeY = targetRect.y - HOLE_PADDING
  const holeW = targetRect.width + HOLE_PADDING * 2
  const holeH = targetRect.height + HOLE_PADDING * 2
  const holeRx = 14

  return (
    <div className="fixed inset-0 z-[9999] select-none" style={{ pointerEvents: 'none' }}>
      {/* ====== SVG 蒙版层 ====== */}
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="spotlight-hole-mask">
            {/* 白色 = 可见区域（显示蒙版） */}
            <rect width="100%" height="100%" fill="white" />
            {/* 黑色 = 镂空区域（透明） */}
            <rect
              x={holeX}
              y={holeY}
              width={holeW}
              height={holeH}
              rx={holeRx}
              fill="black"
            />
          </mask>
        </defs>

        {/* 半透明暗色蒙版 */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(15,23,42,0.62)"
          mask="url(#spotlight-hole-mask)"
        />

        {/* 洞口发光边框 */}
        <rect
          x={holeX}
          y={holeY}
          width={holeW}
          height={holeH}
          rx={holeRx}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={2.5}
        >
          <animate
            attributeName="stroke-opacity"
            values="0.55;0.2;0.55"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>

      {/* ====== Tooltip 卡片 ====== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: placement === 'bottom' ? -12 : 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 z-10 -translate-x-1/2"
          style={{
            maxWidth: TOOLTIP_MAX_W,
            width: `calc(100vw - 48px)`,
            pointerEvents: 'auto',
            ...tooltipStyle,
          }}
        >
          <div className="rounded-2xl border border-white/20 bg-card/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {/* 步骤指示器 */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === stepIndex
                        ? 'w-7 bg-primary'
                        : i < stepIndex
                          ? 'w-1.5 bg-primary/40'
                          : 'w-1.5 bg-border'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={onSkip}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* 标题 & 描述 */}
            {isTestMode && (
              <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                <FlaskConical className="size-3" /> 测试模式
              </div>
            )}
            <h3 className="text-[15px] font-semibold leading-snug text-foreground">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {step.description}
            </p>

            {/* 按钮区 */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                disabled={stepIndex === 0}
                className="h-8 rounded-full px-3 text-xs"
              >
                <ChevronLeft className="size-3.5" />
                上一步
              </Button>

              <Button
                size="sm"
                onClick={onNext}
                className="h-8 rounded-full px-4 text-xs font-medium"
              >
                {stepIndex >= totalSteps - 1 ? '开始体验' : '下一步'}
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
