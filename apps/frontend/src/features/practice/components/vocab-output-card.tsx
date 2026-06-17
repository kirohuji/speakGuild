import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit3, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'

interface VocabDrillSubItem {
  vocabId: string
  promptZh: string
  targetWords?: string[]
  suggestedAnswer?: string
}

interface VocabOutputCardProps {
  title: string
  vocabs: VocabDrillSubItem[]
  direction?: DrillDirection
  onComplete?: (index: number, passed: boolean) => void
}

/** 词汇输出卡片 */
export function VocabOutputCard({
  title,
  vocabs,
  direction = 'zh_to_en',
  onComplete,
}: VocabOutputCardProps) {
  const { t } = useTranslation()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [judging, setJudging] = useState(false)
  const [result, setResult] = useState<{ passed: boolean; feedback: string; correction?: string } | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const current = vocabs[currentIdx]
  const totalItems = vocabs.length
  const isZhToEn = direction === 'zh_to_en'

  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || judging) return
    setJudging(true)
    setResult(null)
    try {
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '',
        npcText: isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh),
        userText: userInput.trim(),
        objectives: isZhToEn ? [current.promptZh] : [`理解英文：${current.suggestedAnswer ?? ''}`],
        mode: 'targeted_output',
        ...(isZhToEn
          ? {
              targetWords: current.targetWords,
              targetChunks: current.suggestedAnswer ? [current.suggestedAnswer] : [],
            }
          : {}),
      })
      if (judgement.passed) {
        setResult({ passed: true, feedback: judgement.feedback || t('practiceSession.passed') })
        onComplete?.(currentIdx, true)
        setTimeout(() => advance(), 1000)
      } else {
        setResult({ passed: false, feedback: judgement.feedback || t('practiceSession.tryAgain'), correction: judgement.correction || current.suggestedAnswer || '' })
      }
    } catch (err: any) {
      setResult({ passed: false, feedback: err?.message || t('practiceVn.feedbackUnavailable') })
    } finally {
      setJudging(false)
    }
  }, [userInput, current, judging, currentIdx, isZhToEn, onComplete, t])

  const advance = useCallback(() => {
    setResult(null)
    setUserInput('')
    setShowAnswer(false)
    setDetailOpen(false)
    if (currentIdx < totalItems - 1) setCurrentIdx(prev => prev + 1)
  }, [currentIdx, totalItems])

  if (!current) return null

  const promptLabel = isZhToEn
    ? t('practiceSession.sayInEnglish')
    : t('practiceSession.sayInChinese')
  const displayText = isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh)

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">词汇</Badge>
          <Badge variant="outline" className="text-[10px]">{title}</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
        </div>

        {/* Target words (仅 zh→en 模式显示) */}
        {isZhToEn && current.targetWords?.length ? (
          <div className="rounded-md bg-blue-500/5 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">目标词汇</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {current.targetWords.map((word) => (
                <span key={word} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">{word}</span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Task */}
        <div>
          <p className="text-xs text-muted-foreground">{promptLabel}:</p>
          <p className="text-base font-semibold text-foreground">{displayText}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm" onClick={() => { setShowAnswer(!showAnswer); setDetailOpen(!showAnswer) }}>
            <Edit3 className="size-4" />
            {showAnswer ? t('common.collapse') : t('practiceSession.showAnswer')}
          </Button>
        </div>

        {/* Expanded detail */}
        {detailOpen && (
          <div className="rounded-md bg-muted/60 px-3 py-2 space-y-1.5">
            {current.suggestedAnswer && (
              <div>
                <p className="text-[10px] text-muted-foreground">参考答案</p>
                <p className="text-[11px]">{current.suggestedAnswer}</p>
              </div>
            )}
            <details className="text-[10px] text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
                <ChevronDown className="size-3" /> 学习说明
              </summary>
              <p className="mt-1">记住搭配，在不同场景复用这个表达。</p>
            </details>
          </div>
        )}

        {/* Input */}
        <Textarea
          value={userInput}
          onChange={(e) => { setUserInput(e.target.value); setResult(null) }}
          placeholder={isZhToEn ? '输入英文...' : '输入中文...'}
          className="min-h-[60px] resize-none rounded-xl border-0 bg-background/70 text-base"
          disabled={judging}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        />

        {/* Result */}
        {result && (
          <div className={cn('rounded-md px-3 py-2', result.passed ? 'bg-green-500/10' : 'bg-amber-500/10')}>
            <div className="flex items-center gap-1.5">
              {result.passed ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
              <p className="text-[11px] font-medium">{result.passed ? t('practiceSession.passed') : t('practiceSession.tryAgain')}</p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{result.feedback}</p>
            {result.correction && !result.passed && (
              <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{result.correction}</p>
            )}
          </div>
        )}

        {/* Submit */}
        <Button className="w-full min-h-11" size="default" onClick={submit} disabled={judging || !userInput.trim()}>
          {judging ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {judging ? t('practiceVn.feedbackEvaluating') : t('practiceSession.submit')}
        </Button>
      </CardContent>
    </Card>
  )
}
