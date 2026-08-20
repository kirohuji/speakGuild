import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ChunkOutputDrillCard } from '@/features/practice/components/chunk-output-drill-card'
import { PatternDrillCard } from '@/features/practice/components/pattern-drill-card'
import { SentenceDecompositionCard } from '@/features/practice/components/sentence-decomposition-card'
import { VocabOutputCard } from '@/features/practice/components/vocab-output-card'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import { toWarmupReviewData } from '@/stores/warmup-session.store'

export interface WarmupReviewItem {
  stepId?: string
  stepType?: string
  groupTitle?: string
  displayLabel?: string
  zh?: string
  promptZh?: string
  answer?: string
  suggestedAnswer?: string
  userAnswer?: string
  passed?: boolean
  feedback?: string
  correction?: string
  audioUrl?: string | null
  practiceCount?: number
}

interface WarmupRecordDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: WarmupReviewItem[]
  topicTitle?: string | null
  score?: number | null
  initialIndex?: number
  contentClassName?: string
  overlayClassName?: string
}

export function WarmupRecordDetailDialog({
  open,
  onOpenChange,
  items,
  topicTitle,
  score,
  initialIndex = 0,
  contentClassName,
  overlayClassName,
}: WarmupRecordDetailDialogProps) {
  const { t } = useTranslation()
  const [currentIdx, setCurrentIdx] = useState(0)
  const total = items.length
  const current = items[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < total - 1

  useEffect(() => {
    if (!open) return
    setCurrentIdx(Math.max(0, Math.min(items.length - 1, initialIndex)))
  }, [initialIndex, items.length, open])

  const gotoPrev = () => setCurrentIdx((index) => Math.max(0, index - 1))
  const gotoNext = () => setCurrentIdx((index) => Math.min(total - 1, index + 1))

  const renderCard = () => {
    if (!current) return null
    const reviewData = toWarmupReviewData(current)
    const prompt = current.zh || current.promptZh || ''
    const answer = current.answer || current.suggestedAnswer || ''
    const stepId = current.stepId || String(currentIdx)

    if (current.stepType === 'chunk_substitution' || current.stepType === 'vocab_sentence_building') {
      return (
        <ChunkOutputDrillCard
          chunk={{ text: current.correction?.split(' ')?.slice(0, 3)?.join(' ') || answer || prompt, meaning: '' }}
          items={[{ zh: prompt, answer }]}
          stepId={stepId}
          stepType={current.stepType}
          groupTitle={current.groupTitle}
          reviewData={reviewData}
        />
      )
    }
    if (current.stepType === 'vocab_drill') {
      return (
        <VocabOutputCard
          title={current.groupTitle || t('learning.wordDrill')}
          vocabs={[{ vocabId: '', promptZh: prompt, suggestedAnswer: answer }]}
          stepId={stepId}
          reviewData={reviewData}
        />
      )
    }
    if (current.stepType === 'pattern_drill') {
      return (
        <PatternDrillCard
          pattern={current.correction || answer || prompt}
          items={[{ zh: prompt, answer }]}
          stepId={stepId}
          groupTitle={current.groupTitle}
          reviewData={reviewData}
        />
      )
    }
    if (current.stepType === 'sentence_decomposition') {
      let levels: any[] = []
      try { levels = JSON.parse(current.correction || '[]') } catch {}
      let levelAudios: Record<number, string> | null = null
      try { levelAudios = JSON.parse(current.userAnswer || '{}') } catch {}
      return (
        <SentenceDecompositionCard
          title={prompt || t('learning.sentenceBreakdown')}
          levels={levels.length > 0 ? levels : [{ level: 1, label: '', en: answer || prompt, zh: '' }]}
          stepId={stepId}
          reviewData={{ levelAudios }}
        />
      )
    }
    return (
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            current.passed ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500',
          )}>
            {current.passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{prompt}</p>
            {current.userAnswer && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('learning.yourAnswer')}
                <span className={cn('font-medium', current.passed ? 'text-green-600' : 'text-red-500')}>{current.userAnswer}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('!z-[10001] h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 pt-safe md:h-[88vh] md:max-w-3xl md:rounded-2xl md:pt-0 [&>button]:hidden', contentClassName)}
        overlayClassName={overlayClassName}
      >
        <DialogTitle className="sr-only">{t('learning.reviewTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('learning.reviewSubtitle')}</DialogDescription>

        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
            <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle2 className="size-[18px]" />
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {topicTitle || t('learning.warmupPractice')} · {t('common.total')} {score ?? '-'} {t('learning.scoreUnit')}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <ChevronDown className="size-4" />
                </button>
                <h2 className="col-span-2 line-clamp-2 break-words text-lg font-bold leading-snug text-foreground">
                  {current?.groupTitle || current?.displayLabel || current?.zh || t('learning.practiceReview')}
                </h2>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
            <div key={currentIdx} className="h-full">
              {renderCard()}
            </div>
          </div>

          <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
            <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
              <ChevronLeft className="size-4" />
              <span className="ml-1">{t('todayTask.prevQuestion')}</span>
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {total > 0 ? currentIdx + 1 : 0} / {total}
              {current?.practiceCount && current.practiceCount > 1 ? ` · ${t('todayTask.practiceTimes', { count: current.practiceCount })}` : ''}
            </span>
            <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
              <span className="mr-1">{t('todayTask.nextQuestion')}</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
