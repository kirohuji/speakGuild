import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit3, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'

type DrillStatus = 'idle' | 'judging' | 'passed' | 'failed'

interface ChunkOutputDrillCardProps {
  chunk: { text: string; meaning?: string; description?: string | null }
  items: { zh: string; answer?: string }[]
  groupTitle?: string
  direction?: DrillDirection
  kind?: 'chunk' | 'word'
  onComplete?: (itemIndex: number, passed: boolean) => void
}

/** Chunk 输出热身卡片 */
export function ChunkOutputDrillCard({
  chunk,
  items,
  groupTitle,
  direction = 'zh_to_en',
  kind = 'chunk',
  onComplete,
}: ChunkOutputDrillCardProps) {
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

  // ── 提交判断 ──
  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || status === 'judging') return
    setStatus('judging')
    setFeedback('')
    try {
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '',
        npcText: isZhToEn ? current.zh : (current.answer ?? ''),
        userText: userInput.trim(),
        objectives: isZhToEn ? [current.zh] : [`理解英文：${current.answer ?? ''}`],
        mode: 'targeted_output',
        ...(isZhToEn && current.answer
          ? { targetChunks: [current.answer], requiredChunks: [current.answer] }
          : {}),
      })
      if (judgement.passed) {
        setStatus('passed')
        setFeedback(judgement.feedback || t('passed'))
        onComplete?.(currentIdx, true)
        setTimeout(() => advance(true), 1000)
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || t('practiceSession.tryAgain'))
        setCorrection(judgement.correction || current.answer || '')
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || t('practiceVn.feedbackUnavailable'))
    }
  }, [userInput, current, status, currentIdx, isZhToEn, onComplete, t])

  // ── 前进（仅通过后自动触发） ──
  const advance = useCallback((_passed: boolean) => {
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
          <Badge variant="secondary" className="text-[10px]">{kind === 'word' ? '单词' : '句块'}</Badge>
          {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>}
          <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
        </div>

        {/* Chunk display */}
        <div className="rounded-md bg-primary/5 px-3 py-2">
          <p className="text-sm font-semibold text-primary">{chunk.text}</p>
          {chunk.meaning && <p className="mt-0.5 text-[11px] text-muted-foreground">{chunk.meaning}</p>}
        </div>

        {/* Task prompt */}
        <div>
          <p className="text-xs text-muted-foreground">{promptLabel}:</p>
          <p className="text-base font-semibold text-foreground">{displayText}</p>
        </div>

        {/* Action: 提示 */}
        <div className="flex gap-2">
          <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm" onClick={() => setShowAnswer(!showAnswer)}>
            <Edit3 className="size-4" />
            {showAnswer ? t('common.collapse') : t('practiceSession.showAnswer')}
          </Button>
        </div>

        {/* Answer hint */}
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
