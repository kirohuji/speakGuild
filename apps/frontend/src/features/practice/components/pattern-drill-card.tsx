import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit3, Loader2, CheckCircle2, Braces } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'

type DrillStatus = 'idle' | 'judging' | 'passed' | 'failed'

interface PatternDrillCardProps {
  pattern: string
  patternMeaning?: string
  items: { zh: string; answer?: string }[]
  groupTitle?: string
  direction?: DrillDirection
  onComplete?: (itemIndex: number, passed: boolean) => void
}

/** 句型操练卡片：语法框架固定 + 槽位内容替换 */
export function PatternDrillCard({
  pattern,
  patternMeaning,
  items,
  groupTitle,
  direction = 'zh_to_en',
  onComplete,
}: PatternDrillCardProps) {
  const { t } = useTranslation()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [status, setStatus] = useState<DrillStatus>('idle')
  const [feedback, setFeedback] = useState('')
  const [correction, setCorrection] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)

  const current = items[currentIdx]
  const totalItems = items.length
  const isZhToEn = direction === 'zh_to_en'

  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || status === 'judging') return
    setStatus('judging')
    setFeedback('')
    try {
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '',
        npcText: isZhToEn ? current.zh : (current.answer ?? ''),
        userText: userInput.trim(),
        objectives: isZhToEn ? [`用「${pattern}」表达：${current.zh}`] : [`理解句型：${pattern}`],
        mode: 'targeted_output',
        ...(isZhToEn && current.answer
          ? { targetChunks: [current.answer], requiredChunks: [current.answer] }
          : {}),
      })
      if (judgement.passed) {
        setStatus('passed')
        setFeedback(judgement.feedback || t('passed'))
        onComplete?.(currentIdx, true)
        setTimeout(() => advance(), 1000)
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || t('practiceSession.tryAgain'))
        setCorrection(judgement.correction || current.answer || '')
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || t('practiceVn.feedbackUnavailable'))
    }
  }, [userInput, current, status, currentIdx, isZhToEn, pattern, onComplete, t])

  const advance = useCallback(() => {
    setStatus('idle')
    setUserInput('')
    setFeedback('')
    setCorrection('')
    setShowAnswer(false)
    if (currentIdx < totalItems - 1) {
      setCurrentIdx(prev => prev + 1)
    }
  }, [currentIdx, totalItems])

  if (!current) return null

  const promptLabel = isZhToEn
    ? t('practiceSession.sayInEnglish')
    : t('practiceSession.sayInChinese')
  const displayText = isZhToEn ? current.zh : (current.answer ?? current.zh)

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Braces className="size-3" />句型
          </Badge>
          {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>}
          <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
        </div>

        {/* Pattern display */}
        <div className="rounded-md bg-primary/5 px-3 py-2">
          <p className="font-mono text-sm font-semibold text-primary">{pattern}</p>
          {patternMeaning && <p className="mt-0.5 text-[11px] text-muted-foreground">{patternMeaning}</p>}
        </div>

        {/* Task prompt */}
        <div>
          <p className="text-xs text-muted-foreground">{promptLabel}:</p>
          <p className="text-base font-semibold text-foreground">{displayText}</p>
        </div>

        {/* Show answer toggle */}
        <div className="flex gap-2">
          <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm" onClick={() => setShowAnswer(!showAnswer)}>
            <Edit3 className="size-4" />
            {showAnswer ? t('common.collapse') : t('practiceSession.showAnswer')}
          </Button>
        </div>

        {showAnswer && current.answer && (
          <div className="rounded-md bg-muted/60 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{current.answer}</p>
          </div>
        )}

        {/* Input area */}
        <Textarea
          value={userInput}
          onChange={(e) => { setUserInput(e.target.value); setStatus('idle'); setFeedback('') }}
          placeholder={isZhToEn ? '输入英文...' : '输入中文...'}
          className="min-h-[60px] resize-none rounded-xl border-0 bg-background/70 text-base"
          disabled={status === 'judging' || status === 'passed'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        />

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
