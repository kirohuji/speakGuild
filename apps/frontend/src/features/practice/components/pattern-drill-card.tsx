import { useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Eye, Loader2, CheckCircle2, Braces, Play, Pause, Repeat2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'
import { PracticeAnswerInput } from './practice-answer-input'
import { useCachedImage } from '@/hooks/use-cached-image'
import { useCachedAudio } from '@/hooks/use-cached-audio'

type DrillStatus = 'idle' | 'judging' | 'passed' | 'failed'
type HintLevel = 'none' | 'hint' | 'answer'

interface PatternDrillCardProps {
  pattern: string
  patternMeaning?: string
  items: { zh?: string; en?: string; answer?: string; hint?: string; imageUrl?: string; audioUrl?: string; audioAssetId?: string }[]
  stepId: string
  groupTitle?: string
  direction?: DrillDirection
  onComplete?: (itemIndex: number, passed: boolean, score: WarmupScore) => void
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

/** 高亮答案中的句型 key words */
function highlightPattern(text: string, pattern: string) {
  // Extract key words from pattern like "I'd like to [verb]..." �?highlight "I'd like to"
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
  reviewData,
}: PatternDrillCardProps) {
  // ── 只读回顾模式：走完全相同的渲染路�?──
  const isReview = !!reviewData
  const { t } = useTranslation()

  const store = useWarmupSessionStore()
  const saved = isReview ? undefined : store.stepStates[stepId]
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState(isReview ? (reviewData?.userAnswer ?? '') : (saved?.userAnswer ?? ''))
  const [status, setStatus] = useState<DrillStatus>(isReview ? (reviewData?.passed ? 'passed' : 'failed') : (saved?.status ?? 'idle'))
  const [feedback, setFeedback] = useState(isReview ? (reviewData?.feedback ?? '') : (saved?.feedback ?? ''))
  const [correction, setCorrection] = useState(isReview ? (reviewData?.correction ?? '') : (saved?.correction ?? ''))
  const [hintLevel, setHintLevel] = useState<HintLevel>(isReview ? 'answer' : (saved?.hintLevel ?? 'none'))
  const [audioUrl, setAudioUrl] = useState<string | null>(isReview ? (reviewData?.audioUrl ?? null) : (saved?.audioUrl ?? null))
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const current = items[currentIdx]
  const { resolvedUrl: cachedImageUrl } = useCachedImage(current.imageUrl)
  const exerciseAudio = useCachedAudio()
  const totalItems = items.length
  const isZhToEn = direction === 'zh_to_en'
  const looksEnglish = (text?: string) => /[A-Za-z]/.test(text ?? '')
  const isLegacyEnToZhItem = !isZhToEn && !current.en && looksEnglish(current.answer) && Boolean(current.zh)
  const promptText = isZhToEn
    ? (current.zh ?? current.en ?? '')
    : (current.en ?? (isLegacyEnToZhItem ? current.answer : current.zh) ?? current.answer ?? '')
  const expectedAnswer = isZhToEn
    ? (current.answer ?? '')
    : (current.en ? (current.answer ?? current.zh ?? '') : (isLegacyEnToZhItem ? current.zh ?? '' : current.answer ?? current.zh ?? ''))

  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!pattern || !patternMeaning) return null
    return t('practiceSession.warmupDrill.patternHint', { pattern, meaning: patternMeaning })
  }, [current?.hint, pattern, patternMeaning, t])

  const skip = useCallback(() => {
    if (!current || status === 'judging' || status === 'passed') return
    const correctionText = expectedAnswer || ''
    setStatus('failed')
    setHintLevel('answer')
    setFeedback(t('practiceSession.warmupDrill.skippedHint'))
    setCorrection(correctionText)
    onComplete?.(currentIdx, false, 'miss')
    store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: false, feedback: '我不会/跳过', correction: correctionText, hintLevel: 'answer', score: 'miss' })
    store.recordEntry({ stepId, stepType: 'pattern_drill', zh: promptText, answer: correctionText, userAnswer: userInput.trim(), audioUrl, passed: false, feedback: '我不会/跳过', groupTitle, displayLabel: t('todayTask.patternDrill'), score: 'miss', usedHintLevel: 3, correction: correctionText })
  }, [current, currentIdx, expectedAnswer, groupTitle, onComplete, promptText, status, stepId, store, t, userInput])

  const retryCurrent = useCallback(() => {
    if (isReview || status === 'judging') return
    setUserInput('')
    setStatus('idle')
    setFeedback('')
    setCorrection('')
    setHintLevel('none')
    setAudioUrl(null)
    store.resetSteps([stepId])
  }, [isReview, status, stepId, store])

  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || status === 'judging') return
    setStatus('judging')
    setFeedback('')
    try {
      const judgement = await practiceAiApi.judgeWarmupTurn({
        stepType: 'pattern_drill',
        direction,
        prompt: promptText,
        expectedAnswer,
        userAnswer: userInput.trim(),
        targetText: pattern,
        targetMeaning: patternMeaning,
      })
      const score = judgement.passed && hintLevel !== 'none' ? scoreFromHint(judgement.passed, hintLevel) : judgement.score
      if (judgement.passed) {
        setStatus('passed')
        setFeedback(judgement.feedback || t('practiceSession.warmupDrill.correct'))
        setHintLevel('answer')
        onComplete?.(currentIdx, true, score)
        store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: true, feedback: judgement.feedback || '', hintLevel, score })
        store.recordEntry({ stepId, stepType: 'pattern_drill', zh: promptText, answer: expectedAnswer, userAnswer: userInput.trim(), audioUrl, passed: true, feedback: judgement.feedback || '', groupTitle, displayLabel: t('todayTask.patternDrill'), score, usedHintLevel: hintLevelValue(hintLevel) })
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || t('practiceSession.tryAgain'))
        setCorrection(judgement.correction || expectedAnswer || '')
        onComplete?.(currentIdx, false, 'miss')
        store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: false, feedback: judgement.feedback || '', correction: judgement.correction || expectedAnswer || '', hintLevel, score: 'miss' })
        store.recordEntry({ stepId, stepType: 'pattern_drill', zh: promptText, answer: expectedAnswer, userAnswer: userInput.trim(), audioUrl, passed: false, feedback: judgement.feedback || '', groupTitle, displayLabel: t('todayTask.patternDrill'), score: 'miss', usedHintLevel: hintLevelValue(hintLevel), correction: judgement.correction || expectedAnswer || '' })
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || t('practiceSession.warmupDrill.feedbackUnavailable'))
    }
  }, [userInput, current, status, currentIdx, pattern, onComplete, stepId, store, groupTitle, hintLevel, direction, promptText, expectedAnswer, patternMeaning, t])


  if (!current) return null

  const promptLabel = isZhToEn ? t('practiceSession.warmupDrill.sayInEnglish') : t('practiceSession.warmupDrill.sayInChinese')
  const displayText = promptText

  return (
    <div className="space-y-2.5">
      {/* Header */}
      {!hideHeader && (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Braces className="size-3" />{t('todayTask.patternDrill')}
        </Badge>
        {/* {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>} */}
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>
      )}

      {/* Pattern display */}
      <div className="rounded-lg bg-gradient-to-br from-violet-500/8 to-violet-500/3 px-1 py-2.5">
        <p className="text-xs text-muted-foreground">{t('practiceSession.warmupDrill.corePattern')}</p>
        <p className="mt-0.5 font-mono text-base font-bold text-violet-600 dark:text-violet-400">{pattern}</p>
        {patternMeaning && <p className="mt-0.5 text-xs text-muted-foreground">{patternMeaning}</p>}
      </div>

      {/* Item image */}
      {cachedImageUrl && (
        <div className="overflow-hidden rounded-lg">
          <img
            src={cachedImageUrl}
            alt={t('practiceSession.warmupDrill.questionImage')}
            className="w-full h-41 object-cover bg-muted/10"
            loading="lazy"
          />
        </div>
      )}

      {/* Task prompt */}
      <div className="rounded-lg bg-muted/20 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">{promptLabel}</p>
        <div className="mt-0.5 flex items-start gap-2">
          <p className="min-w-0 flex-1 text-base font-semibold text-foreground">{displayText}</p>
          {(current.audioUrl || current.audioAssetId) && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 rounded-full"
              title={t('practiceSession.warmupDrill.playAudio')}
              onClick={() => exerciseAudio.play(current.audioUrl, current.audioAssetId, 'warmup_audio')}
            >
              <Play className="size-3.5" />
            </Button>
          )}
        </div>
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
            disabled={status === 'judging' || status === 'passed'}
          >
            {hintLevel === 'answer' ? <Eye className="size-3.5" /> : <Lightbulb className="size-3.5" />}
            {hintLevel === 'none' ? t('practiceSession.warmupDrill.hint') : hintLevel === 'hint' ? t('practiceSession.showAnswer') : t('practiceSession.warmupDrill.hideAnswer')}
          </Button>
          <button
            type="button"
            onClick={skip}
            disabled={status === 'judging' || status === 'passed'}
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
            {hintLevel === 'answer' && current.answer && (
              <>
                {teachingHint && <Separator className="opacity-50" />}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">{t('practiceSession.warmupDrill.referenceAnswer')}</p>
                  <p className="text-sm font-medium text-foreground">{highlightPattern(current.answer, pattern)}</p>
                  {current.zh && <p className="mt-0.5 text-[11px] text-muted-foreground">{current.zh}</p>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* 回顾模式：直接展示参考答�?*/}
      {isReview && current.answer && (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground mb-1">{t('practiceSession.warmupDrill.referenceAnswer')}</p>
          <p className="text-sm font-medium text-foreground">{highlightPattern(current.answer, pattern)}</p>
        </div>
      )}

      {/* Input area �?persist on success; 回顾模式 disabled */}
      <PracticeAnswerInput
        value={userInput}
        onChange={(nextValue) => { if (status !== 'passed') { setUserInput(nextValue); setStatus('idle'); setFeedback('') } }}
        placeholder={isZhToEn ? t('practiceSession.warmupDrill.inputPlaceholderEn', { chunk: pattern }) : t('practiceSession.warmupDrill.inputPlaceholderZh')}
        disabled={isReview || status === 'judging' || status === 'passed'}
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

      {/* Feedback */}
      {feedback && (
        <div className={cn('rounded-lg px-3 py-2', status === 'passed' ? 'bg-green-500/10' : 'bg-amber-500/10')}>
          <div className="flex items-center gap-1.5">
            {status === 'passed' ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
            <p className="text-xs font-medium">{status === 'passed' ? t('practiceSession.warmupDrill.correct') : t('practiceSession.tryAgain')}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{feedback}</p>
          {correction && <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{highlightPattern(correction, pattern)}</p>}
        </div>
      )}

      {/* Submit �?回顾模式隐藏 */}
      {!isReview && (
      <div className="space-y-2">
        {status === 'passed' ? (
          <Button className="min-h-9 w-full rounded-xl gap-1.5" size="sm" variant="outline" onClick={retryCurrent}>
            <Repeat2 className="size-3.5" />
            {t('practiceSession.warmupDrill.retryCurrent')}
          </Button>
        ) : (
          <Button
            className="min-h-11 w-full rounded-xl"
            onClick={submit}
            disabled={status === 'judging' || !userInput.trim()}
          >
            {status === 'judging' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {status === 'judging' ? t('practiceSession.warmupDrill.judging') : t('practiceSession.submit')}
          </Button>
        )}
        {status === 'failed' && (
          <p className="text-center text-[11px] text-muted-foreground">{t('practiceSession.warmupDrill.failedHint')}</p>
        )}
      </div>
      )}
    </div>
  )
}
