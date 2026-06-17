import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Eye, Loader2, CheckCircle2, Braces } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'

type DrillStatus = 'idle' | 'judging' | 'passed' | 'failed'
type HintLevel = 'none' | 'hint' | 'answer'

interface PatternDrillCardProps {
  pattern: string
  patternMeaning?: string
  items: { zh: string; answer?: string; hint?: string }[]
  groupTitle?: string
  direction?: DrillDirection
  onComplete?: (itemIndex: number, passed: boolean) => void
}

/** 高亮答案中的句型 key words */
function highlightPattern(text: string, pattern: string) {
  // Extract key words from pattern like "I'd like to [verb]..." → highlight "I'd like to"
  const keyWords = pattern.replace(/\[.*?\]/g, '').replace(/\.{3}/g, '').trim()
  if (!keyWords || keyWords.length < 2) return text
  const idx = text.toLowerCase().indexOf(keyWords.toLowerCase())
  if (idx < 0) return text
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + keyWords.length)
  const after = text.slice(idx + keyWords.length)
  return <>{before}<mark className="rounded bg-primary/20 px-0.5 text-primary font-semibold">{match}</mark>{after}</>
}

/** 句型操练卡片：渐进式提示 + 句型高亮 */
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
  const [hintLevel, setHintLevel] = useState<HintLevel>('none')

  const current = items[currentIdx]
  const totalItems = items.length
  const isZhToEn = direction === 'zh_to_en'

  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!pattern || !patternMeaning) return null
    return `句型「${pattern}」表示「${patternMeaning}」。把中文意思套入这个句型框架中，替换 [ ... ] 部分即可。`
  }, [current?.hint, pattern, patternMeaning])

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
        setFeedback(judgement.feedback || '正确！')
        setHintLevel('answer')
        onComplete?.(currentIdx, true)
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || '再试一次')
        setCorrection(judgement.correction || current.answer || '')
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || '反馈不可用')
    }
  }, [userInput, current, status, currentIdx, isZhToEn, pattern, onComplete])

  const advance = useCallback(() => {
    setStatus('idle')
    setUserInput('')
    setFeedback('')
    setCorrection('')
    setHintLevel('none')
    if (currentIdx < totalItems - 1) {
      setCurrentIdx(prev => prev + 1)
    }
  }, [currentIdx, totalItems])

  if (!current) return null

  const promptLabel = isZhToEn ? '用英文说出' : '用中文说出'
  const displayText = isZhToEn ? current.zh : (current.answer ?? current.zh)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Braces className="size-3" />句型
        </Badge>
        {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>}
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>

      {/* Pattern display */}
      <div className="rounded-xl bg-gradient-to-br from-violet-500/8 to-violet-500/3 px-4 py-3">
        <p className="text-sm text-muted-foreground">核心句型</p>
        <p className="mt-0.5 font-mono text-lg font-bold text-violet-600 dark:text-violet-400">{pattern}</p>
        {patternMeaning && <p className="mt-0.5 text-xs text-muted-foreground">{patternMeaning}</p>}
      </div>

      {/* Task prompt */}
      <div className="rounded-lg bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">{promptLabel}</p>
        <p className="text-lg font-semibold text-foreground">{displayText}</p>
      </div>

      {/* Progressive hints */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => setHintLevel(hintLevel === 'none' ? 'hint' : hintLevel === 'hint' ? 'none' : 'none')}>
            <Lightbulb className="size-3.5" />💡 提示
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => setHintLevel(hintLevel === 'answer' ? 'none' : 'answer')}>
            <Eye className="size-3.5" />{hintLevel === 'answer' ? '隐藏答案' : '显示答案'}
          </Button>
        </div>

        {hintLevel !== 'none' && (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 space-y-2">
            {teachingHint && (
              <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <p className="text-[11px] text-foreground/80">{teachingHint}</p>
              </div>
            )}
            {hintLevel === 'answer' && current.answer && (
              <>
                {teachingHint && <Separator className="opacity-50" />}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">参考答案</p>
                  <p className="text-sm font-medium text-foreground">{highlightPattern(current.answer, pattern)}</p>
                  {current.zh && <p className="mt-0.5 text-[11px] text-muted-foreground">{current.zh}</p>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Input area — persist on success */}
      <Textarea
        value={userInput}
        onChange={(e) => { if (status !== 'passed') { setUserInput(e.target.value); setStatus('idle'); setFeedback('') } }}
        placeholder={isZhToEn ? '输入英文...' : '输入中文...'}
        className="min-h-[60px] resize-none rounded-xl border-0 bg-background/70 text-base"
        disabled={status === 'judging' || status === 'passed'}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
      />

      {/* Feedback */}
      {feedback && (
        <div className={cn('rounded-lg px-3 py-2.5', status === 'passed' ? 'bg-green-500/10' : 'bg-amber-500/10')}>
          <div className="flex items-center gap-1.5">
            {status === 'passed' ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
            <p className="text-xs font-medium">{status === 'passed' ? '正确！' : '再试一次'}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{feedback}</p>
          {correction && <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{highlightPattern(correction, pattern)}</p>}
        </div>
      )}

      {/* Actions */}
      {status === 'passed' ? (
        <Button className="w-full min-h-11 rounded-xl" onClick={advance}>
          {currentIdx < totalItems - 1 ? '下一题' : '完成'}
        </Button>
      ) : (
        <Button className="w-full min-h-11 rounded-xl" size="default" onClick={submit} disabled={status === 'judging' || !userInput.trim()}>
          {status === 'judging' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {status === 'judging' ? '评判中...' : '提交'}
        </Button>
      )}
    </div>
  )
}
