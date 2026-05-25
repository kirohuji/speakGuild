import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, BookOpen, PenLine, Trophy, GraduationCap, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

interface OnboardingStep {
  icon: React.ElementType
  iconBg: string
  title: string
  description: string
}

const STEPS: OnboardingStep[] = [
  {
    icon: BookOpen,
    iconBg: 'bg-blue-500',
    title: '海量题库，精准备考',
    description: '按省份、语种、考试类型选择题库，涵盖景点介绍、导游规范、应变能力等全部题型。',
  },
  {
    icon: PenLine,
    iconBg: 'bg-violet-500',
    title: '逐题练习，AI 评分',
    description: '听读练习 + 发音纠正，快捷键操作效率翻倍。AI 即时反馈帮你发现薄弱点。',
  },
  {
    icon: Trophy,
    iconBg: 'bg-amber-500',
    title: '模拟考试，检验实力',
    description: '标准卷 / 强化卷任选，记录分数与薄弱点，追踪进步轨迹。',
  },
  {
    icon: GraduationCap,
    iconBg: 'bg-green-500',
    title: '绑定题库，开始学习',
    description: '选择你的报考省份和语种，系统自动匹配对应题库。随时可调整。',
  },
]

interface OnboardingGuideProps {
  open: boolean
  onClose: () => void
  onFinish?: () => void
}

export function OnboardingGuide({ open, onClose, onFinish }: OnboardingGuideProps) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setDirection('forward')
      setStep((s) => s + 1)
    } else {
      onFinish?.()
      onClose()
    }
  }, [step, onClose, onFinish])

  const handlePrev = useCallback(() => {
    if (step > 0) {
      setDirection('backward')
      setStep((s) => s - 1)
    }
  }, [step])

  if (!open) return null

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  // ─── 移动端：全屏覆盖 ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* 跳过按钮 */}
        <div className="flex items-center justify-end px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            跳过
          </button>
        </div>

        {/* 主内容 */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-6">
          <div
            key={step}
            className={cn(
              'flex flex-col items-center text-center transition-all duration-300',
              direction === 'forward' ? 'animate-in slide-in-from-right-8' : 'animate-in slide-in-from-left-8',
            )}
          >
            <div className={cn('flex h-20 w-20 items-center justify-center rounded-3xl shadow-lg', current.iconBg)}>
              <Icon className="h-10 w-10 text-white" />
            </div>
            <h2 className="mt-8 text-2xl font-bold tracking-tight">{current.title}</h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-xs">
              {current.description}
            </p>
          </div>
        </div>

        {/* 底部：进度指示器 + 按钮 */}
        <div className="px-6 pb-8 space-y-6">
          {/* 圆点指示器 */}
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  idx === step ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 ? (
              <Button variant="outline" size="lg" onClick={handlePrev} className="flex-1">
                上一步
              </Button>
            ) : (
              <div className="flex-1" />
            )}
            <Button size="lg" onClick={handleNext} className="flex-1 gap-1.5">
              {isLast ? (
                <>开始使用 <Check className="h-4 w-4" /></>
              ) : (
                <>下一步 <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── PC 端：居中卡片 ──────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-3xl bg-card shadow-2xl overflow-hidden">
        {/* 顶部彩色条 */}
        <div className={cn('h-2', current.iconBg)} />

        <div className="p-8">
          {/* 步骤号 */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Step {step + 1} / {STEPS.length}
          </p>

          {/* 图标 + 标题 */}
          <div className="flex items-center gap-4 mt-3">
            <div className={cn('flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl shadow-md', current.iconBg)}>
              <Icon className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">{current.title}</h2>
          </div>

          {/* 描述 */}
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>

          {/* 进度条 */}
          <div className="mt-6 flex gap-1.5">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  idx <= step ? 'bg-primary' : 'bg-muted',
                )}
              />
            ))}
          </div>

          {/* 按钮 */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              跳过
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一步
                </Button>
              )}
              <Button size="sm" onClick={handleNext} className="gap-1">
                {isLast ? '开始使用' : '下一步'}
                {!isLast && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 检查是否是首次访问，返回是否需要显示引导
 * 存储 key: guideready-onboarding-seen
 */
export function useOnboarding() {
  const KEY = 'guideready-onboarding-seen'

  const hasSeen = localStorage.getItem(KEY) === '1'

  const markSeen = () => {
    localStorage.setItem(KEY, '1')
  }

  const reset = () => {
    localStorage.removeItem(KEY)
  }

  return { hasSeen, markSeen, reset }
}
