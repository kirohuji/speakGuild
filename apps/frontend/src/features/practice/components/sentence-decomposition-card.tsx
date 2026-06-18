import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { WarmupScore } from '@/stores/warmup-session.store'

interface DecompositionLevel {
  level: number
  label: string
  en: string
  zh: string
  highlight?: string
  hint?: string
}

interface SentenceDecompositionCardProps {
  title: string
  levels: DecompositionLevel[]
  stepId: string
  onComplete?: (passed: boolean, score: WarmupScore) => void
  /** Dialog 已提供题型标签时，隐藏内部 header badge */
  hideHeader?: boolean
}

/** 长句拆解 — 从简单句逐级扩展到复杂长句 */
export function SentenceDecompositionCard({
  title,
  levels,
  stepId,
  onComplete,
  hideHeader = false,
}: SentenceDecompositionCardProps) {
  const { t } = useTranslation()
  const totalLevels = levels.length
  const [currentIdx, setCurrentIdx] = useState(0)

  const current = levels[currentIdx]
  const previous = currentIdx > 0 ? levels[currentIdx - 1] : null
  const isDone = currentIdx >= totalLevels
  const isFirst = currentIdx === 0
  const isLast = currentIdx === totalLevels - 1

  const advance = useCallback(() => {
    if (currentIdx < totalLevels - 1) {
      setCurrentIdx(prev => prev + 1)
    } else {
      setCurrentIdx(totalLevels)
      onComplete?.(true, 'strong')
    }
  }, [currentIdx, totalLevels, onComplete])

  const goBack = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1)
    }
  }, [currentIdx])

  // 全部完成
  if (isDone) {
    return (
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 className="size-10 text-green-500" />
          <p className="text-sm font-semibold text-foreground">已掌握完整长句</p>
          <div className="rounded-md bg-muted/50 px-4 py-2">
            <p className="text-sm text-foreground">{levels[totalLevels - 1].en}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{levels[totalLevels - 1].zh}</p>
          </div>
          <Button
            size="default"
            variant="outline"
            className="mt-1 gap-1.5 text-sm"
            onClick={goBack}
          >
            <ChevronLeft className="size-4" />
            上一级
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!current) return null

  // 构建上一级展示文字（高亮当前新增部分）
  const renderPreviousLine = previous ? (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-[10px] text-muted-foreground mb-0.5">{t('practiceSession.previousLevel')}</p>
      <p className="text-sm text-foreground/60">{previous.en}</p>
      <p className="text-[11px] text-muted-foreground/60 mt-0.5">{previous.zh}</p>
    </div>
  ) : null

  // 构建本级展示文字（高亮部分用 primary 色标记）
  const renderCurrentLine = () => {
    if (!current.highlight) {
      return <p className="text-base font-semibold text-foreground">{current.en}</p>
    }
    // 在句子中标记 highlight 部分
    const idx = current.en.toLowerCase().indexOf(current.highlight.toLowerCase())
    if (idx < 0) return <p className="text-base font-semibold text-foreground">{current.en}</p>
    const before = current.en.slice(0, idx)
    const match = current.en.slice(idx, idx + current.highlight.length)
    const after = current.en.slice(idx + current.highlight.length)
    return (
      <p className="text-base font-semibold text-foreground">
        {before}
        <span className="rounded bg-primary/15 px-0.5 text-primary font-bold">{match}</span>
        {after}
      </p>
    )
  }

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardContent className="space-y-2.5 p-3">
        {/* Header */}
        {!hideHeader && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{t('practiceSession.sentenceDecomposition')}</Badge>
          <Badge variant="outline" className="text-[10px]">{title}</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">{current.level}/{totalLevels}</span>
        </div>
        )}

        {/* Progress */}
        <Progress value={(current.level / totalLevels) * 100} className="h-1" />

        {/* 当前层级标签 */}
        <p className="text-xs font-medium text-foreground/70">
          {t('practiceSession.currentLevel', { n: current.level, label: current.label })}
        </p>

        {/* 上一级 */}
        {renderPreviousLine}

        {/* 本级 — 高亮新增 */}
        <div className="rounded-md bg-primary/[0.04] px-3 py-2">
          {renderCurrentLine()}
          <p className="mt-1.5 text-sm text-muted-foreground">{current.zh}</p>
          {current.hint && (
            <p className="mt-1 text-[11px] text-primary/70">{current.hint}</p>
          )}
        </div>

        {/* Navigation: 上一级 / 下一级 */}
        <div className="flex gap-2">
          <Button
            size="default"
            variant="outline"
            className="min-h-11 flex-1 gap-1.5 text-sm"
            onClick={goBack}
            disabled={isFirst}
          >
            <ChevronLeft className="size-4" />
            上一级
          </Button>
          <Button
            size="default"
            variant="outline"
            className="min-h-11 flex-1 gap-1.5 text-sm"
            onClick={advance}
          >
            {isLast ? '完成' : '下一级'}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
