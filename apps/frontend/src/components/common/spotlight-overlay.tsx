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
const TOOLTIP_MAX_W = 280

interface SpotlightOverlayProps {
  step: OnboardingStep
  stepIndex: number
  totalSteps: number
  isTestMode?: boolean
  onNext: (fromClickAdvance?: boolean) => void
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

/** 计算 Tooltip 放置位置：优先放下方，否则放上方，始终水平居中，垂直不超出视口 */
function calcPlacement(
  targetRect: DOMRect,
): { placement: 'bottom' | 'top'; style: Record<string, string | number> } {
  const vh = window.innerHeight
  const gap = TOOLTIP_GAP
  // 卡片最小所需高度（用于判断是否有足够空间）
  const minH = vh < 640 ? 220 : 170
  const spaceBelow = vh - targetRect.bottom - gap
  const spaceAbove = targetRect.top - gap

  if (spaceBelow >= minH || spaceBelow >= spaceAbove) {
    // 放在目标下方，top 定位确保不超出视口底部
    const top = Math.min(targetRect.bottom + gap, vh - minH - 16)
    return {
      placement: 'bottom',
      style: { top: Math.max(16, top), maxHeight: Math.min(minH + 40, vh - top - 16) },
    }
  }
  // 放在目标上方：用 bottom 定位，卡片底部固定在 target.top - gap
  return {
    placement: 'top',
    style: { bottom: Math.max(16, vh - targetRect.top + gap), maxHeight: Math.min(minH + 40, targetRect.top - gap - 16) },
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

  // 步骤切换时重置 targetRect，避免旧步骤的高亮位置残留
  useEffect(() => {
    setTargetRect(null)
  }, [step.id])

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
    let foundEl: Element | null = null
    const tryFind = () => {
      const el = document.querySelector(step.targetSelector)
      if (el) {
        // 首次找到时，若元素不在可视区域内则滚动到视口中央
        if (el !== foundEl) {
          foundEl = el
          const rect = el.getBoundingClientRect()
          const centerY = rect.top + rect.height / 2
          const vh = window.innerHeight
          if (centerY < 80 || centerY > vh - 80) {
            el.scrollIntoView({ behavior: 'auto', block: 'center' })
            // 等滚动完成后再更新位置（嵌套滚动容器需要等 layout）
            requestAnimationFrame(() => updatePosition())
            return
          }
        }
        updatePosition()
        return
      }
      attempts++
      if (attempts < 400) {
        // 最多等 ~8 秒（含初始 150ms 延迟），覆盖慢速数据加载
        rafRef.current = requestAnimationFrame(tryFind)
      } else {
        console.warn('[Spotlight] timed out looking for:', step.targetSelector)
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

  // 监听目标元素点击（clickToAdvance）— 使用 document 级事件委托避免
  // React 重渲染导致 DOM 元素被替换后原生 listener 失效的问题
  useEffect(() => {
    if (!step.clickToAdvance) return

    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      const match = target.closest(step.targetSelector)
      if (match) {
        // clickToAdvance: 传 true 告知 provider 跳过路由导航
        setTimeout(() => onNext(true), 300)
      }
    }

    // 捕获阶段监听，确保在 React 事件系统之前捕获
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
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
          className="absolute z-10"
          style={{
            maxWidth: TOOLTIP_MAX_W,
            width: `calc(100vw - 48px)`,
            // 左手动居中：避免 Framer Motion animate 覆盖 transform
            left: `calc(50% - ${TOOLTIP_MAX_W / 2}px)`,
            pointerEvents: 'auto',
            ...tooltipStyle,
          }}
        >
          <div data-spotlight-tooltip className="rounded-2xl bg-card p-4 text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-none dark:ring-1 dark:ring-white/[0.07]">
            {/* 跳过按钮 */}
            <div className="mb-3 flex items-center justify-end">
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
                className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
