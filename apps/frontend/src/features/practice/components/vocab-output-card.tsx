import { useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Eye, Loader2, CheckCircle2, ChevronDown, Layers3, Play, Pause, Repeat2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'
import { PracticeAnswerInput } from './practice-answer-input'

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
  /** Dialog 已提供题型标签时，隐藏内�?header badge */
  hideHeader?: boolean
  /** 只读回顾模式：传入已保存的练习数�?*/
  reviewData?: {
    userAnswer: string
    passed: boolean
    feedback: string
    correction?: string
    audioUrl?: string | null
  } | null
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
  hideHeader = false,
  reviewData,
}: VocabOutputCardProps) {
  // ── 只读回顾模式：走完全相同的渲染路�?──
  const isReview = !!reviewData
  const { t } = useTranslation()

  const store = useWarmupSessionStore()
  const saved = isReview ? undefined : store.stepStates[stepId]
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState(isReview ? (reviewData?.userAnswer ?? '') : (saved?.userAnswer ?? ''))
  const [judging, setJudging] = useState(false)
  const [result, setResult] = useState<{ passed: boolean; feedback: string; correction?: string } | null>(
    isReview ? { passed: reviewData?.passed ?? false, feedback: reviewData?.feedback ?? '', correction: reviewData?.correction } : (saved ? { passed: saved.status === 'passed', feedback: saved.feedback, correction: saved.correction } : null)
  )
  const [hintLevel, setHintLevel] = useState<HintLevel>(isReview ? 'answer' : ((saved?.hintLevel as HintLevel) ?? 'none'))
  const [audioUrl, setAudioUrl] = useState<string | null>(isReview ? (reviewData?.audioUrl ?? null) : (saved?.audioUrl ?? null))
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const current = vocabs[currentIdx]
  const totalItems = vocabs.length
  const isZhToEn = direction === 'zh_to_en'

  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!current?.targetWords?.length) return null
    const words = current.targetWords.join('、')
    return t('practiceSession.warmupDrill.vocabHint', { words })
  }, [current?.hint, current?.targetWords, t])

  const skip = useCallback(() => {
    if (!current || judging || result?.passed) return
    const correctionText = current.suggestedAnswer || ''
    setHintLevel('answer')
    setResult({ passed: false, feedback: t('practiceSession.warmupDrill.skippedHint'), correction: correctionText })
    onComplete?.(currentIdx, false, 'miss')
    store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: false, feedback: '我不会/跳过', correction: correctionText, hintLevel: 'answer', score: 'miss' })
    store.recordEntry({ stepId, stepType: 'vocab_drill', zh: current.promptZh, answer: correctionText, userAnswer: userInput.trim(), audioUrl, passed: false, feedback: '我不会/跳过', groupTitle: title, displayLabel: t('todayTask.vocabDrill'), score: 'miss', usedHintLevel: 3, correction: correctionText })
  }, [current, currentIdx, judging, onComplete, result?.passed, stepId, store, t, title, userInput])

  const retryCurrent = useCallback(() => {
    if (isReview || judging) return
    setUserInput('')
    setResult(null)
    setHintLevel('none')
    setAudioUrl(null)
    store.resetSteps([stepId])
  }, [isReview, judging, stepId, store])

  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || judging) return
    setJudging(true)
    setResult(null)
    try {
      const judgement = await practiceAiApi.judgeWarmupTurn({
        stepType: 'vocab_drill',
        direction,
        prompt: isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh),
        expectedAnswer: isZhToEn ? current.suggestedAnswer : current.promptZh,
        userAnswer: userInput.trim(),
        targetText: isZhToEn ? current.targetWords?.join(', ') : undefined,
      })
      const score = judgement.passed && hintLevel !== 'none' ? scoreFromHint(judgement.passed, hintLevel) : judgement.score
      if (judgement.passed) {
        setResult({ passed: true, feedback: judgement.feedback || t('practiceSession.warmupDrill.correct') })
        setHintLevel('answer')
        onComplete?.(currentIdx, true, score)
        store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: true, feedback: judgement.feedback || '', hintLevel, score })
        store.recordEntry({ stepId, stepType: 'vocab_drill', zh: current.promptZh, answer: current.suggestedAnswer || '', userAnswer: userInput.trim(), audioUrl, passed: true, feedback: judgement.feedback || '', groupTitle: title, displayLabel: t('todayTask.vocabDrill'), score, usedHintLevel: hintLevelValue(hintLevel) })
      } else {
        setResult({ passed: false, feedback: judgement.feedback || t('practiceSession.tryAgain'), correction: judgement.correction || (isZhToEn ? current.suggestedAnswer : current.promptZh) || '' })
        onComplete?.(currentIdx, false, 'miss')
        store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: false, feedback: judgement.feedback || '', correction: judgement.correction || (isZhToEn ? current.suggestedAnswer : current.promptZh) || '', hintLevel, score: 'miss' })
        store.recordEntry({ stepId, stepType: 'vocab_drill', zh: current.promptZh, answer: current.suggestedAnswer || '', userAnswer: userInput.trim(), audioUrl, passed: false, feedback: judgement.feedback || '', groupTitle: title, displayLabel: t('todayTask.vocabDrill'), score: 'miss', usedHintLevel: hintLevelValue(hintLevel), correction: judgement.correction || (isZhToEn ? current.suggestedAnswer : current.promptZh) || '' })
      }
    } catch (err: any) {
      setResult({ passed: false, feedback: err?.message || t('practiceSession.warmupDrill.feedbackUnavailable') })
    } finally {
      setJudging(false)
    }
  }, [userInput, current, judging, currentIdx, isZhToEn, onComplete, stepId, store, t, title, hintLevel])

  const advance = useCallback(() => {
    setResult(null)
    setUserInput('')
    setHintLevel('none')
    if (currentIdx < totalItems - 1) setCurrentIdx(prev => prev + 1)
  }, [currentIdx, totalItems])

  if (!current) return null

  const promptLabel = isZhToEn ? t('practiceSession.warmupDrill.contextLabel') : t('practiceSession.warmupDrill.sayInChinese')
  const displayText = isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh)

  return (
    <div className="space-y-2.5">
      {/* Header */}
      {!hideHeader && (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Layers3 className="size-3" />
          {t('todayTask.vocabSentenceBuilding')}
        </Badge>
        <Badge variant="outline" className="text-[10px]">{title}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>
      )}

      {/* Target words */}
      {isZhToEn && current.targetWords?.length ? (
        <div className="rounded-lg bg-gradient-to-br from-blue-500/8 to-blue-500/3 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">{t('practiceSession.warmupDrill.targetWordsLabel')}</p>
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
          <p className="text-[11px] text-muted-foreground">{t('practiceSession.warmupDrill.vocabFreeHint')}</p>
        )}
      </div>

      {/* Progressive hints */}
      {!isReview && (
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
            {hintLevel === 'none' ? t('practiceSession.warmupDrill.hint') : hintLevel === 'hint' ? t('practiceSession.showAnswer') : t('practiceSession.warmupDrill.hideAnswer')}
          </Button>
          <button
            type="button"
            onClick={skip}
            disabled={judging || !!result?.passed}
            className="rounded-full px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
          >
            {t('practiceSession.warmupDrill.dontKnow')}
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
                  <p className="text-[10px] text-muted-foreground mb-1">{t('practiceSession.warmupDrill.referenceAnswer')}</p>
                  <p className="text-sm font-medium text-foreground">
                    {highlightWords(current.suggestedAnswer, current.targetWords ?? [])}
                  </p>
                </div>
              </>
            )}
            {hintLevel === 'answer' && (
              <details className="text-[10px] text-muted-foreground">
                <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
                  <ChevronDown className="size-3" /> {t('practiceSession.warmupDrill.learningNote')}
                </summary>
                <p className="mt-1">{t('practiceSession.warmupDrill.learningNoteDesc')}</p>
              </details>
            )}
          </div>
        )}
      </div>
      )}

      {/* 回顾模式：直接展示参考答�?*/}
      {isReview && current.suggestedAnswer && (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground mb-1">{t('practiceSession.warmupDrill.referenceAnswer')}</p>
          <p className="text-sm font-medium text-foreground">
            {highlightWords(current.suggestedAnswer, current.targetWords ?? [])}
          </p>
        </div>
      )}

      {/* Input �?persist on success; 回顾模式 disabled */}
      <PracticeAnswerInput
        value={userInput}
        onChange={(nextValue) => { if (!result?.passed) { setUserInput(nextValue); setResult(null) } }}
        placeholder={isZhToEn ? t('practiceSession.warmupDrill.vocabPlaceholder') : t('practiceSession.warmupDrill.inputPlaceholderZh')}
        disabled={isReview || judging || !!result?.passed}
        onEnter={isReview ? undefined : submit}
        onAudioChange={isReview ? undefined : setAudioUrl}
        lang={isZhToEn ? 'en-US' : 'zh-CN'}
      />

      {/* 回顾模式：录音回�?*/}
      {isReview && audioUrl && (
        <button
          type="button"
          onClick={() => {
            if (playing) { audioRef.current?.pause(); setPlaying(false); return }
            const a = new Audio(audioUrl!)
            a.onended = () => setPlaying(false)
            a.play().catch(() => {})
            audioRef.current = a
            setPlaying(true)
          }}
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          {playing ? <Pause className="size-3" /> : <Play className="size-3 ml-0.5" />}
          {t('practiceSession.warmupDrill.audioPlayback')}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className={cn('rounded-lg px-3 py-2', result.passed ? 'bg-green-500/10' : 'bg-amber-500/10')}>
          <div className="flex items-center gap-1.5">
            {result.passed ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
            <p className="text-xs font-medium">{result.passed ? t('practiceSession.warmupDrill.correct') : t('practiceSession.tryAgain')}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{result.feedback}</p>
          {result.correction && !result.passed && (
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{highlightWords(result.correction, current.targetWords ?? [])}</p>
          )}
        </div>
      )}

      {/* Submit �?回顾模式隐藏 */}
      {!isReview && (
      <div className="space-y-2">
        {result?.passed ? (
          <Button className="min-h-9 w-full rounded-xl gap-1.5" size="sm" variant="outline" onClick={retryCurrent}>
            <Repeat2 className="size-3.5" />
            {t('practiceSession.warmupDrill.retryCurrent')}
          </Button>
        ) : (
          <Button
            className="min-h-11 w-full rounded-xl"
            onClick={submit}
            disabled={judging || !userInput.trim()}
          >
            {judging ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {judging ? t('practiceSession.warmupDrill.judging') : t('practiceSession.submit')}
          </Button>
        )}
        {result && !result.passed && (
          <p className="text-center text-[11px] text-muted-foreground">{t('practiceSession.warmupDrill.failedHint')}</p>
        )}
      </div>
      )}
    </div>
  )
}
