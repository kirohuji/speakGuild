import { useState, useCallback, useMemo } from 'react'
import { Lightbulb, Eye, Loader2, CheckCircle2, ChevronDown, Layers3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'

interface VocabDrillSubItem {
  vocabId: string
  promptZh: string
  targetWords?: string[]
  suggestedAnswer?: string
  hint?: string
}

interface VocabOutputCardProps {
  title: string
  vocabs: VocabDrillSubItem[]
  stepId: string
  direction?: DrillDirection
  onComplete?: (index: number, passed: boolean, score: WarmupScore) => void
}

/** 高亮目标词汇 */
function highlightWords(text: string, words: string[]) {
  if (!words.length) return text
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) => {
    if (words.some(w => w.toLowerCase() === part.toLowerCase())) {
      return <mark key={i} className="rounded bg-blue-500/20 px-0.5 text-blue-600 dark:text-blue-400 font-semibold">{part}</mark>
    }
    return part
  })
}

type HintLevel = 'none' | 'hint' | 'answer'

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

/** 词汇输出卡片 */
export function VocabOutputCard({
  title,
  vocabs,
  stepId,
  direction = 'zh_to_en',
  onComplete,
}: VocabOutputCardProps) {
  const store = useWarmupSessionStore()
  const saved = store.stepStates[stepId]
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState(saved?.userAnswer ?? '')
  const [judging, setJudging] = useState(false)
  const [result, setResult] = useState<{ passed: boolean; feedback: string; correction?: string } | null>(
    saved ? { passed: saved.status === 'passed', feedback: saved.feedback, correction: saved.correction } : null
  )
  const [hintLevel, setHintLevel] = useState<HintLevel>((saved?.hintLevel as HintLevel) ?? 'none')

  const current = vocabs[currentIdx]
  const totalItems = vocabs.length
  const isZhToEn = direction === 'zh_to_en'

  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!current?.targetWords?.length) return null
    const words = current.targetWords.join('、')
    return `请使用以下词汇表达：${words}。试着把它们放进一个完整的句子里。`
  }, [current?.hint, current?.targetWords])

  const skip = useCallback(() => {
    if (!current || judging || result?.passed) return
    const correctionText = current.suggestedAnswer || ''
    setHintLevel('answer')
    setResult({ passed: false, feedback: '已标记为需要复练。最后会集中再练一次。', correction: correctionText })
    onComplete?.(currentIdx, false, 'miss')
    store.recordStep(stepId, { userAnswer: userInput.trim(), passed: false, feedback: '我不会/跳过', correction: correctionText, hintLevel: 'answer', score: 'miss' })
    store.recordEntry({ stepId, stepType: 'vocab_drill', zh: current.promptZh, answer: correctionText, userAnswer: userInput.trim(), passed: false, feedback: '我不会/跳过', groupTitle: title, score: 'miss', usedHintLevel: 3, correction: correctionText })
  }, [current, currentIdx, judging, onComplete, result?.passed, stepId, store, title, userInput])

  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || judging) return
    setJudging(true)
    setResult(null)
    try {
      const targetWords = current.targetWords ?? []
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '',
        npcText: isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh),
        userText: userInput.trim(),
        objectives: isZhToEn
          ? [`自然使用目标词汇「${targetWords.join('、')}」表达：${current.promptZh}`]
          : [`理解英文句子并说出中文：${current.suggestedAnswer ?? ''}`],
        mode: 'targeted_output',
        ...(isZhToEn
          ? { targetWords }
          : {}),
      })
      const score = scoreFromHint(judgement.passed, hintLevel)
      if (judgement.passed) {
        setResult({ passed: true, feedback: judgement.feedback || '正确！' })
        setHintLevel('answer')
        onComplete?.(currentIdx, true, score)
        store.recordStep(stepId, { userAnswer: userInput.trim(), passed: true, feedback: judgement.feedback || '', hintLevel, score })
        store.recordEntry({ stepId, stepType: 'vocab_drill', zh: current.promptZh, answer: current.suggestedAnswer || '', userAnswer: userInput.trim(), passed: true, feedback: judgement.feedback || '', groupTitle: title, score, usedHintLevel: hintLevelValue(hintLevel) })
      } else {
        setResult({ passed: false, feedback: judgement.feedback || '再试一次', correction: judgement.correction || current.suggestedAnswer || '' })
        onComplete?.(currentIdx, false, 'miss')
        store.recordStep(stepId, { userAnswer: userInput.trim(), passed: false, feedback: judgement.feedback || '', correction: judgement.correction || current.suggestedAnswer || '', hintLevel, score: 'miss' })
        store.recordEntry({ stepId, stepType: 'vocab_drill', zh: current.promptZh, answer: current.suggestedAnswer || '', userAnswer: userInput.trim(), passed: false, feedback: judgement.feedback || '', groupTitle: title, score: 'miss', usedHintLevel: hintLevelValue(hintLevel), correction: judgement.correction || current.suggestedAnswer || '' })
      }
    } catch (err: any) {
      setResult({ passed: false, feedback: err?.message || '反馈不可用' })
    } finally {
      setJudging(false)
    }
  }, [userInput, current, judging, currentIdx, isZhToEn, onComplete, stepId, store, title, hintLevel])

  const advance = useCallback(() => {
    setResult(null)
    setUserInput('')
    setHintLevel('none')
    if (currentIdx < totalItems - 1) setCurrentIdx(prev => prev + 1)
  }, [currentIdx, totalItems])

  if (!current) return null

  const promptLabel = isZhToEn ? '语境 / 中文意图' : '用中文说出'
  const displayText = isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh)

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Layers3 className="size-3" />
          一词多句
        </Badge>
        <Badge variant="outline" className="text-[10px]">{title}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>

      {/* Target words */}
      {isZhToEn && current.targetWords?.length ? (
        <div className="rounded-lg bg-gradient-to-br from-blue-500/8 to-blue-500/3 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">这题要自然用到</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {current.targetWords.map((word) => (
              <span key={word} className="rounded-md bg-blue-500/15 px-2 py-1 text-sm font-medium text-blue-700 dark:text-blue-300">{word}</span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Task prompt */}
      <div className="rounded-lg bg-muted/20 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">{promptLabel}</p>
        <p className="text-base font-semibold text-foreground">{displayText}</p>
        {isZhToEn && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            你可以写自己的句子，只要目标词用得自然、意思表达清楚。
          </p>
        )}
      </div>

      {/* Progressive hints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-full bg-muted/35 px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
            onClick={() => setHintLevel(hintLevel === 'none' ? 'hint' : hintLevel === 'hint' ? 'answer' : 'none')}
            disabled={judging || !!result?.passed}
          >
            {hintLevel === 'answer' ? <Eye className="size-3.5" /> : <Lightbulb className="size-3.5" />}
            {hintLevel === 'none' ? '提示' : hintLevel === 'hint' ? '查看答案' : '收起答案'}
          </Button>
          <button
            type="button"
            onClick={skip}
            disabled={judging || !!result?.passed}
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
            {hintLevel === 'answer' && current.suggestedAnswer && (
              <>
                {teachingHint && <Separator className="opacity-50" />}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">参考答案</p>
                  <p className="text-sm font-medium text-foreground">
                    {highlightWords(current.suggestedAnswer, current.targetWords ?? [])}
                  </p>
                </div>
              </>
            )}
            {hintLevel === 'answer' && (
              <details className="text-[10px] text-muted-foreground">
                <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
                  <ChevronDown className="size-3" /> 学习说明
                </summary>
                <p className="mt-1">目标是把同一个词放进不同语境里，而不是背这一句参考答案。</p>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Input — persist on success */}
      <Textarea
        value={userInput}
        onChange={(e) => { if (!result?.passed) { setUserInput(e.target.value); setResult(null) } }}
        placeholder={isZhToEn ? '用目标词写一句自然的英文...' : '输入中文...'}
        className="mx-2 min-h-[52px] w-[calc(100%-12px)] min-w-0 resize-none rounded-lg border-0 bg-background/70 px-4 text-base"
        disabled={judging || !!result?.passed}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
      />

      {/* Result */}
      {result && (
        <div className={cn('rounded-lg px-3 py-2.5', result.passed ? 'bg-green-500/10' : 'bg-amber-500/10')}>
          <div className="flex items-center gap-1.5">
            {result.passed ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
            <p className="text-xs font-medium">{result.passed ? '正确！' : '再试一次'}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{result.feedback}</p>
          {result.correction && !result.passed && (
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{highlightWords(result.correction, current.targetWords ?? [])}</p>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="space-y-2">
        <Button className="w-full min-h-11 rounded-xl" size="default" onClick={submit} disabled={judging || !!result?.passed || !userInput.trim()}>
          {judging ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {judging ? '评判中...' : result?.passed ? '已通过' : '提交'}
        </Button>
        {result && !result.passed && (
          <p className="text-center text-[11px] text-muted-foreground">已加入本轮错题，最后会集中再练一次。</p>
        )}
      </div>
    </div>
  )
}
