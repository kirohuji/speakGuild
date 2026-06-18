import { useState, useCallback, useMemo } from 'react'
import { Lightbulb, Eye, Loader2, CheckCircle2, Braces } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'

type DrillStatus = 'idle' | 'judging' | 'passed' | 'failed'
type HintLevel = 'none' | 'hint' | 'answer'

interface PatternDrillCardProps {
  pattern: string
  patternMeaning?: string
  items: { zh: string; answer?: string; hint?: string }[]
  stepId: string
  groupTitle?: string
  direction?: DrillDirection
  onComplete?: (itemIndex: number, passed: boolean, score: WarmupScore) => void
  /** Dialog 已提供题型标签时，隐藏内部 header badge */
  hideHeader?: boolean
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

function scoreFromHint(passed: boolean, hintLevel: HintLevel): WarmupScore {
  if (!passed) return 'miss'
  if (hintLevel === 'answer') return 'weak'
  if (hintLevel === 'hint') return 'ok'
  return 'strong'
}

function hintLevelValue(hintLevel: HintLevel): 0 | 1 | 2 | 3 {
  if (hintLevel === 'answer') return 3
  if (hintLevel === 'hint') return 1
  return 0
}

/** 句型操练卡片：渐进式提示 + 句型高亮 */
export function PatternDrillCard({
  pattern,
  patternMeaning,
  items,
  stepId,
  groupTitle,
  direction = 'zh_to_en',
  onComplete,
  hideHeader = false,
}: PatternDrillCardProps) {
  const store = useWarmupSessionStore()
  const saved = store.stepStates[stepId]
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState(saved?.userAnswer ?? '')
  const [status, setStatus] = useState<DrillStatus>(saved?.status ?? 'idle')
  const [feedback, setFeedback] = useState(saved?.feedback ?? '')
  const [correction, setCorrection] = useState(saved?.correction ?? '')
  const [hintLevel, setHintLevel] = useState<HintLevel>(saved?.hintLevel ?? 'none')

  const current = items[currentIdx]
  const totalItems = items.length
  const isZhToEn = direction === 'zh_to_en'

  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!pattern || !patternMeaning) return null
    return `句型「${pattern}」表示「${patternMeaning}」。把中文意思套入这个句型框架中，替换 [ ... ] 部分即可。`
  }, [current?.hint, pattern, patternMeaning])

  const skip = useCallback(() => {
    if (!current || status === 'judging' || status === 'passed') return
    const correctionText = current.answer || ''
    setStatus('failed')
    setHintLevel('answer')
    setFeedback('已标记为需要复练。最后会集中再练一次。')
    setCorrection(correctionText)
    onComplete?.(currentIdx, false, 'miss')
    store.recordStep(stepId, { userAnswer: userInput.trim(), passed: false, feedback: '我不会/跳过', correction: correctionText, hintLevel: 'answer', score: 'miss' })
    store.recordEntry({ stepId, stepType: 'pattern_drill', zh: current.zh, answer: correctionText, userAnswer: userInput.trim(), passed: false, feedback: '我不会/跳过', groupTitle, score: 'miss', usedHintLevel: 3, correction: correctionText })
  }, [current, currentIdx, groupTitle, onComplete, status, stepId, store, userInput])

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
      const score = scoreFromHint(judgement.passed, hintLevel)
      if (judgement.passed) {
        setStatus('passed')
        setFeedback(judgement.feedback || '正确！')
        setHintLevel('answer')
        onComplete?.(currentIdx, true, score)
        store.recordStep(stepId, { userAnswer: userInput.trim(), passed: true, feedback: judgement.feedback || '', hintLevel, score })
        store.recordEntry({ stepId, stepType: 'pattern_drill', zh: current.zh, answer: current.answer || '', userAnswer: userInput.trim(), passed: true, feedback: judgement.feedback || '', groupTitle, score, usedHintLevel: hintLevelValue(hintLevel) })
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || '再试一次')
        setCorrection(judgement.correction || current.answer || '')
        onComplete?.(currentIdx, false, 'miss')
        store.recordStep(stepId, { userAnswer: userInput.trim(), passed: false, feedback: judgement.feedback || '', correction: judgement.correction || current.answer || '', hintLevel, score: 'miss' })
        store.recordEntry({ stepId, stepType: 'pattern_drill', zh: current.zh, answer: current.answer || '', userAnswer: userInput.trim(), passed: false, feedback: judgement.feedback || '', groupTitle, score: 'miss', usedHintLevel: hintLevelValue(hintLevel), correction: judgement.correction || current.answer || '' })
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || '反馈不可用')
    }
  }, [userInput, current, status, currentIdx, isZhToEn, pattern, onComplete, stepId, store, groupTitle, hintLevel])


  if (!current) return null

  const promptLabel = isZhToEn ? '用英文说出' : '用中文说出'
  const displayText = isZhToEn ? current.zh : (current.answer ?? current.zh)

  return (
    <div className="space-y-2.5">
      {/* Header */}
      {!hideHeader && (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Braces className="size-3" />句型
        </Badge>
        {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>}
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>
      )}

      {/* Pattern display */}
      <div className="rounded-lg bg-gradient-to-br from-violet-500/8 to-violet-500/3 px-1 py-2.5">
        <p className="text-xs text-muted-foreground">核心句型</p>
        <p className="mt-0.5 font-mono text-base font-bold text-violet-600 dark:text-violet-400">{pattern}</p>
        {patternMeaning && <p className="mt-0.5 text-xs text-muted-foreground">{patternMeaning}</p>}
      </div>

      {/* Task prompt */}
      <div className="rounded-lg bg-muted/20 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">{promptLabel}</p>
        <p className="text-base font-semibold text-foreground">{displayText}</p>
      </div>

      {/* Progressive hints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-full bg-muted/35 px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
            onClick={() => setHintLevel(hintLevel === 'none' ? 'hint' : hintLevel === 'hint' ? 'answer' : 'none')}
            disabled={status === 'judging' || status === 'passed'}
          >
            {hintLevel === 'answer' ? <Eye className="size-3.5" /> : <Lightbulb className="size-3.5" />}
            {hintLevel === 'none' ? '提示' : hintLevel === 'hint' ? '查看答案' : '收起答案'}
          </Button>
          <button
            type="button"
            onClick={skip}
            disabled={status === 'judging' || status === 'passed'}
            className="rounded-full px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
          >
            我不会
          </button>
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
        className="mx-2 min-h-[52px] w-[calc(100%-12px)] min-w-0 resize-none rounded-lg border-0 bg-background/70 px-4 text-base"
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

      {/* Submit */}
      <div className="space-y-2">
        <Button className="w-full min-h-11 rounded-xl" size="default" onClick={submit} disabled={status === 'judging' || status === 'passed' || !userInput.trim()}>
          {status === 'judging' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {status === 'judging' ? '评判中...' : status === 'passed' ? '已通过' : '提交'}
        </Button>
        {status === 'failed' && (
          <p className="text-center text-[11px] text-muted-foreground">已加入本轮错题，最后会集中再练一次。</p>
        )}
      </div>
    </div>
  )
}
