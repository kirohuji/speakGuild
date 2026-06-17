import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { practiceAiApi } from '../api/english-practice-api'

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
  onComplete?: (passed: boolean) => void
}

/** 长句拆解 — 从简单句逐级扩展到复杂长句 */
export function SentenceDecompositionCard({
  title,
  levels,
  onComplete,
}: SentenceDecompositionCardProps) {
  const { t } = useTranslation()
  const totalLevels = levels.length
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'judging' | 'passed' | 'failed'>('idle')
  const [feedback, setFeedback] = useState('')
  const [correction, setCorrection] = useState('')

  const current = levels[currentIdx]
  const previous = currentIdx > 0 ? levels[currentIdx - 1] : null
  const isDone = currentIdx >= totalLevels
  const isFirst = currentIdx === 0
  const isLast = currentIdx === totalLevels - 1

  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || status === 'judging') return
    setStatus('judging')
    setFeedback('')
    try {
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '',
        npcText: current.zh,
        userText: userInput.trim(),
        objectives: [`说出完整句子：${current.zh}`],
        mode: 'targeted_output',
        targetChunks: current.highlight ? [current.highlight] : [current.en],
      })
      if (judgement.passed) {
        setStatus('passed')
        setFeedback(judgement.feedback || t('practiceSession.passed'))
        setTimeout(() => advance(), 1000)
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || t('practiceSession.tryAgain'))
        setCorrection(judgement.correction || current.en || '')
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || t('practiceVn.feedbackUnavailable'))
    }
  }, [userInput, current, status, t])

  const advance = useCallback(() => {
    if (currentIdx < totalLevels - 1) {
      setCurrentIdx(prev => prev + 1)
      setStatus('idle')
      setUserInput('')
      setFeedback('')
      setCorrection('')
    } else {
      setCurrentIdx(totalLevels)
      onComplete?.(true)
    }
  }, [currentIdx, totalLevels, onComplete])

  const goBack = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1)
      setStatus('idle')
      setUserInput('')
      setFeedback('')
      setCorrection('')
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
            上一步
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
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{t('practiceSession.sentenceDecomposition')}</Badge>
          <Badge variant="outline" className="text-[10px]">{title}</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">{current.level}/{totalLevels}</span>
        </div>

        {/* Progress */}
        <Progress value={(current.level / totalLevels) * 100} className="h-1" />

        {/* 当前层级标签 */}
        <p className="text-xs font-medium text-foreground/70">
          {t('practiceSession.currentLevel', { n: current.level, label: current.label })}
        </p>

        {/* 上一级 */}
        {renderPreviousLine}

        {/* 本级 — 高亮新增 */}
        <div className="rounded-md bg-primary/[0.04] px-3 py-2.5">
          {renderCurrentLine()}
          <p className="mt-1.5 text-sm text-muted-foreground">{current.zh}</p>
          {current.hint && (
            <p className="mt-1 text-[11px] text-primary/70">{current.hint}</p>
          )}
        </div>

        {/* Navigation: 上一步 / 下一步 */}
        <div className="flex gap-2">
          <Button
            size="default"
            variant="outline"
            className="min-h-11 flex-1 gap-1.5 text-sm"
            onClick={goBack}
            disabled={isFirst}
          >
            <ChevronLeft className="size-4" />
            上一步
          </Button>
          <Button
            size="default"
            variant="outline"
            className="min-h-11 flex-1 gap-1.5 text-sm"
            onClick={advance}
          >
            {isLast ? '完成' : '下一步'}
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Input */}
        {/* <Textarea
          value={userInput}
          onChange={(e) => { setUserInput(e.target.value); setStatus('idle'); setFeedback('') }}
          placeholder={current.zh}
          className="min-h-[60px] resize-none rounded-xl border-0 bg-background/70 text-base"
          disabled={status === 'judging' || status === 'passed'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        /> */}

        {/* Feedback */}
        {feedback && (
          <div className={cn('rounded-md px-3 py-2', status === 'passed' ? 'bg-green-500/10' : 'bg-amber-500/10')}>
            <div className="flex items-center gap-1.5">
              {status === 'passed' ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
              <p className="text-[11px] font-medium">{status === 'passed' ? t('practiceSession.passed') : t('practiceSession.tryAgain')}</p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{feedback}</p>
            {correction && (
              <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{correction}</p>
            )}
          </div>
        )}

        {/* Submit */}
        <Button className="w-full min-h-11" size="default" onClick={submit} disabled={status === 'judging' || status === 'passed' || !userInput.trim()}>
          {status === 'judging' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {status === 'judging' ? t('practiceVn.feedbackEvaluating') : status === 'passed' ? t('practiceSession.passed') : t('practiceSession.submit')}
        </Button>
      </CardContent>
    </Card>
  )
}
