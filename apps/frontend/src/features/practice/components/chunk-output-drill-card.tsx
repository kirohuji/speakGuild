import { useState, useCallback, useMemo, useRef } from 'react'
import { Lightbulb, Eye, Loader2, CheckCircle2, Repeat2, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'
import { PracticeAnswerInput } from './practice-answer-input'
import { useCachedImage } from '@/hooks/use-cached-image'

type DrillStatus = 'idle' | 'judging' | 'passed' | 'failed'
type HintLevel = 'none' | 'hint' | 'answer'

interface ChunkOutputDrillCardProps {
  chunk: { text: string; meaning?: string; description?: string | null }
  items: { zh: string; answer?: string; hint?: string; imageUrl?: string }[]
  stepId: string
  stepType?: 'chunk_substitution' | 'vocab_sentence_building'
  groupTitle?: string
  direction?: DrillDirection
  kind?: 'chunk' | 'word'
  onComplete?: (itemIndex: number, passed: boolean, score: WarmupScore) => void
  /** 只读回顾模式：传入已保存的练习数据 */
  reviewData?: {
    userAnswer: string
    passed: boolean
    feedback: string
    correction?: string
    audioUrl?: string | null
  } | null
}

/** 在文本中高亮目标词/句块 */
function highlightChunk(text: string, target: string) {
  if (!target) return text
  const idx = text.toLowerCase().indexOf(target.toLowerCase())
  if (idx < 0) return text
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + target.length)
  const after = text.slice(idx + target.length)
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

/** Chunk 输出热身卡片 — 渐进式提示 + 高亮教学 */
export function ChunkOutputDrillCard({
  chunk,
  items,
  stepId,
  stepType = 'chunk_substitution',
  groupTitle,
  direction = 'zh_to_en',
  kind = 'chunk',
  onComplete,
  reviewData,
}: ChunkOutputDrillCardProps) {
  // ── 只读回顾模式：走完全相同的渲染路径，仅初始化状态 + 禁用交互 ──
  const isReview = !!reviewData

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
  const totalItems = items.length
  const isZhToEn = direction === 'zh_to_en'
  const typeLabel = stepType === 'vocab_sentence_building'
    ? '一词多句'
    : kind === 'word'
      ? '词汇替换'
      : '句块替换'

  // ── 教学提示（优先使用题目配置的 hint） ──
  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!chunk.text || !chunk.meaning) return null
    if (kind === 'word') return `核心词汇「${chunk.text}」意思是「${chunk.meaning}」，在英文中使用。`
    return `使用句块「${chunk.text}」（${chunk.meaning}）来表达。试着把这个句块放进你的回答里。`
  }, [current?.hint, chunk.text, chunk.meaning, kind])

  const skip = useCallback(() => {
    if (!current || status === 'judging' || status === 'passed') return
    const correctionText = current.answer || ''
    setStatus('failed')
    setHintLevel('answer')
    setFeedback('已标记为需要复练。先往后走，最后会集中再练一次。')
    setCorrection(correctionText)
    onComplete?.(currentIdx, false, 'miss')
    store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: false, feedback: '我不会/跳过', correction: correctionText, hintLevel: 'answer', score: 'miss' })
    store.recordEntry({ stepId, stepType, zh: current.zh, answer: correctionText, userAnswer: userInput.trim(), audioUrl, passed: false, feedback: '我不会/跳过', groupTitle, score: 'miss', usedHintLevel: 3, correction: correctionText })
  }, [current, currentIdx, groupTitle, onComplete, status, stepId, stepType, store, userInput])

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
        objectives: isZhToEn
          ? [`必须使用固定${kind === 'word' ? '词汇' : '句块'}「${chunk.text}」表达：${current.zh}`]
          : [`理解并说出中文含义：${current.answer ?? ''}`],
        mode: 'targeted_output',
        ...(isZhToEn && chunk.text
          ? { targetChunks: [chunk.text], requiredChunks: [chunk.text] }
          : {}),
      })
      const score = scoreFromHint(judgement.passed, hintLevel)
      if (judgement.passed) {
        setStatus('passed')
        setFeedback(judgement.feedback || '正确！')
        setHintLevel('answer') // 自动显示答案
        onComplete?.(currentIdx, true, score)
        store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: true, feedback: judgement.feedback || '', hintLevel, score })
        store.recordEntry({ stepId, stepType, zh: current.zh, answer: current.answer || '', userAnswer: userInput.trim(), audioUrl, passed: true, feedback: judgement.feedback || '', groupTitle, score, usedHintLevel: hintLevelValue(hintLevel) })
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || '再试一次')
        setCorrection(judgement.correction || current.answer || '')
        onComplete?.(currentIdx, false, 'miss')
        store.recordStep(stepId, { userAnswer: userInput.trim(), audioUrl, passed: false, feedback: judgement.feedback || '', correction: judgement.correction || current.answer || '', hintLevel, score: 'miss' })
        store.recordEntry({ stepId, stepType, zh: current.zh, answer: current.answer || '', userAnswer: userInput.trim(), audioUrl, passed: false, feedback: judgement.feedback || '', groupTitle, score: 'miss', usedHintLevel: hintLevelValue(hintLevel), correction: judgement.correction || current.answer || '' })
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || '反馈不可用')
    }
  }, [userInput, current, status, currentIdx, isZhToEn, onComplete, stepId, stepType, store, groupTitle, hintLevel])


  if (!current) return null

  const promptLabel = isZhToEn ? '替换成完整英文句子' : '用中文说出'
  const displayText = isZhToEn ? current.zh : (current.answer ?? current.zh)

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Repeat2 className="size-3" />
          {typeLabel}
        </Badge>
        {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>}
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>

      {/* Chunk display  — highlighted target */}
      <div className="rounded-lg bg-gradient-to-br from-primary/8 to-primary/3 px-3 py-2.5">
        {/* <p className="text-xs text-muted-foreground">{kind === 'word' ? '必须使用这个词' : '必须使用这个句块'}</p> */}
        <p className="mt-0.5 text-base font-bold text-primary">{chunk.text}</p>
        {chunk.meaning && (
          <p className="mt-0.5 text-xs text-muted-foreground">{chunk.meaning}</p>
        )}
      </div>

      {/* Item image */}
      {cachedImageUrl && (
        <div className="overflow-hidden rounded-lg">
          <img
            src={cachedImageUrl}
            alt="题目配图"
            className="w-full h-40 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Task prompt */}
      <div className="rounded-lg bg-muted/20 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">{promptLabel}</p>
        <p className="text-base font-semibold text-foreground">{displayText}</p>
        {/* {isZhToEn && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            重点不是背参考答案，而是把上面的固定表达套进新句子里。
          </p>
        )} */}
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

        {/* Hint panel */}
        {hintLevel !== 'none' && (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 space-y-2">
            {/* Teaching hint */}
            {teachingHint && (
              <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <p className="text-[11px] text-foreground/80">{teachingHint}</p>
              </div>
            )}
            {/* Full answer with highlight */}
            {hintLevel === 'answer' && current.answer && (
              <>
                {teachingHint && <Separator className="opacity-50" />}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">参考答案</p>
                  <p className="text-sm font-medium text-foreground">
                    {highlightChunk(current.answer, chunk.text)}
                  </p>
                  {current.zh && <p className="mt-0.5 text-[11px] text-muted-foreground">{current.zh}</p>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* 回顾模式：直接展示参考答案 */}
      {isReview && current.answer && (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground mb-1">参考答案</p>
          <p className="text-sm font-medium text-foreground">
            {highlightChunk(current.answer, chunk.text)}
          </p>
        </div>
      )}

      {/* Input area — persist on success; 回顾模式 disabled */}
      <PracticeAnswerInput
        value={userInput}
        onChange={(nextValue) => { if (status !== 'passed') { setUserInput(nextValue); setStatus('idle'); setFeedback('') } }}
        placeholder={isZhToEn ? `写一句英文，必须包含「${chunk.text}」...` : '输入中文...'}
        disabled={isReview || status === 'judging' || status === 'passed'}
        onEnter={isReview ? undefined : submit}
        onAudioChange={isReview ? undefined : setAudioUrl}
        lang={isZhToEn ? 'en-US' : 'zh-CN'}
      />

      {/* 回顾模式：录音回放按钮 */}
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
          录音回放
        </button>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={cn('rounded-lg px-3 py-2', status === 'passed' ? 'bg-green-500/10' : 'bg-amber-500/10')}>
          <div className="flex items-center gap-1.5">
            {status === 'passed' ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
            <p className="text-xs font-medium">{status === 'passed' ? '正确！' : '再试一次'}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{feedback}</p>
          {correction && (
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{highlightChunk(correction, chunk.text)}</p>
          )}
        </div>
      )}

      {/* Submit — 回顾模式隐藏 */}
      {!isReview && (
      <div className="space-y-2">
        <Button
          className={cn('w-full rounded-xl', status === 'passed' ? 'min-h-9' : 'min-h-11')}
          size={status === 'passed' ? 'sm' : 'default'}
          onClick={submit}
          disabled={status === 'judging' || status === 'passed' || !userInput.trim()}
        >
          {status === 'judging' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {status === 'judging' ? '评判中...' : status === 'passed' ? '已通过' : '提交'}
        </Button>
        {status === 'failed' && (
          <p className="text-center text-[11px] text-muted-foreground">已加入本轮错题，先继续往后练，最后会集中再来一次。</p>
        )}
      </div>
      )}
    </div>
  )
}
