import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Eye, Loader2, CheckCircle2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'

type DrillStatus = 'idle' | 'judging' | 'passed' | 'failed'
type HintLevel = 'none' | 'hint' | 'answer'

interface ChunkOutputDrillCardProps {
  chunk: { text: string; meaning?: string; description?: string | null }
  items: { zh: string; answer?: string; hint?: string }[]
  groupTitle?: string
  direction?: DrillDirection
  kind?: 'chunk' | 'word'
  onComplete?: (itemIndex: number, passed: boolean) => void
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

/** Chunk 输出热身卡片 — 渐进式提示 + 高亮教学 */
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
  const [hintLevel, setHintLevel] = useState<HintLevel>('none')

  const current = items[currentIdx]
  const totalItems = items.length
  const isZhToEn = direction === 'zh_to_en'

  // ── 教学提示（优先使用题目配置的 hint） ──
  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!chunk.text || !chunk.meaning) return null
    if (kind === 'word') return `核心词汇「${chunk.text}」意思是「${chunk.meaning}」，在英文中使用。`
    return `使用句块「${chunk.text}」（${chunk.meaning}）来表达。试着把这个句块放进你的回答里。`
  }, [current?.hint, chunk.text, chunk.meaning, kind])

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

  const advance = useCallback((_passed: boolean) => {
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
        <Badge variant="secondary" className="text-[10px]">{kind === 'word' ? '单词' : '句块'}</Badge>
        {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>}
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>

      {/* Chunk display  — highlighted target */}
      <div className="rounded-xl bg-gradient-to-br from-primary/8 to-primary/3 px-4 py-3">
        <p className="text-sm text-muted-foreground">{kind === 'word' ? '核心词汇' : '核心句块'}</p>
        <p className="mt-0.5 text-lg font-bold text-primary">{chunk.text}</p>
        {chunk.meaning && (
          <p className="mt-0.5 text-xs text-muted-foreground">{chunk.meaning}</p>
        )}
      </div>

      {/* Task prompt */}
      <div className="rounded-lg bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">{promptLabel}</p>
        <p className="text-lg font-semibold text-foreground">{displayText}</p>
      </div>

      {/* Progressive hints */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => setHintLevel(hintLevel === 'none' ? 'hint' : hintLevel === 'hint' ? 'none' : 'none')}
          >
            <Lightbulb className="size-3.5" />
            {hintLevel === 'none' ? '💡 提示' : '收起提示'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => setHintLevel(hintLevel === 'answer' ? 'none' : 'answer')}
          >
            <Eye className="size-3.5" />
            {hintLevel === 'answer' ? '隐藏答案' : '显示答案'}
          </Button>
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
        <div className={cn('rounded-lg px-3 py-2.5', status === 'passed' ? 'bg-green-500/10' : 'bg-amber-500/10')}>
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

      {/* Submit */}
      <Button className="w-full min-h-11 rounded-xl" size="default" onClick={submit} disabled={status === 'judging' || status === 'passed' || !userInput.trim()}>
        {status === 'judging' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
        {status === 'judging' ? '评判中...' : status === 'passed' ? '正确！' : '提交'}
      </Button>
    </div>
  )
}
