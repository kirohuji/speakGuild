import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  BookText, MessageSquareText, Mic, Play, ChevronRight,
  CheckCircle2, Target, Clock, ArrowRight, Sparkles, ListChecks,
  RotateCcw, BookOpen, Volume2, Loader2, Edit3,
  ChevronLeft, ListMusic, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import {
  learningApi,
  type TodayPlan,
  type TodayTask,
} from '../api/learning-api'
import { expressionApi, practiceAiApi } from '@/features/practice/api/english-practice-api'
import { synthesizeText } from '@/lib/tts-api'

const TASK_ICONS = {
  vocab: BookText,
  chunk: MessageSquareText,
  pattern: MessageSquareText,
  practice: Mic,
  script: Play,
} as const

const TASK_COLORS = {
  vocab: 'text-blue-500 bg-blue-500/10',
  chunk: 'text-purple-500 bg-purple-500/10',
  pattern: 'text-violet-500 bg-violet-500/10',
  practice: 'text-orange-500 bg-orange-500/10',
  script: 'text-green-500 bg-green-500/10',
} as const

export function TodayTaskPage() {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  // ── 今日复练 ──
  const [reviewItems, setReviewItems] = useState<any[]>([])
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewDialogIndex, setReviewDialogIndex] = useState(0)
  const [retryText, setRetryText] = useState('')
  const [retryJudging, setRetryJudging] = useState(false)
  const [retryResult, setRetryResult] = useState<{ passed: boolean; feedback: string } | null>(null)

  // ── 词汇/表达 输出练习 Dialog ──
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillIndex, setDrillIndex] = useState(0)
  const [drillItems, setDrillItems] = useState<Array<{ label: string; text: string; meaning: string; isVocab: boolean }>>([])
  const [drillInput, setDrillInput] = useState('')
  const [drillJudging, setDrillJudging] = useState(false)
  const [drillResult, setDrillResult] = useState<{ passed: boolean; feedback: string; correction?: string } | null>(null)
  const [drillShowHint, setDrillShowHint] = useState(false)
  const [drillAudioPlaying, setDrillAudioPlaying] = useState(false)
  const drillAudioRef = useRef<HTMLAudioElement | null>(null)
  const [drillPlaylistOpen, setDrillPlaylistOpen] = useState(false)
  const drillTouchStartX = useRef(0)

  // ── Drill submit ──
  const submitDrill = useCallback(async () => {
    if (!drillInput.trim()) return
    const item = drillItems[drillIndex]
    if (!item) return
    setDrillJudging(true)
    setDrillResult(null)
    try {
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '',
        npcText: item.isVocab ? `请用 "${item.text}" 造句` : `请用英文表达：${item.meaning || item.text}`,
        userText: drillInput.trim(),
        objectives: [item.text],
        targetChunks: [item.text],
        mode: 'targeted_output',
        requiredChunks: [item.text],
      })
      setDrillResult({
        passed: judgement.passed,
        feedback: judgement.feedback || (judgement.passed ? '通过！' : '再试一次'),
        correction: judgement.correction || undefined,
      })
    } catch (err: any) {
      setDrillResult({ passed: false, feedback: err?.message || '判断失败' })
    } finally {
      setDrillJudging(false)
    }
  }, [drillInput, drillItems, drillIndex])

  useEffect(() => {
    learningApi.getTodayTasks()
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false))

    // Fetch review items
    expressionApi.list({ reviewState: 'learning', pageSize: 10 })
      .then((res: any) => {
        const items = res?.items ?? []
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        // Filter items whose nextReviewAt is today or before
        const dueToday = items.filter((item: any) => {
          if (!item.nextReviewAt) return true // no date = needs review
          return new Date(item.nextReviewAt) <= today
        })
        setReviewItems(dueToday.slice(0, 5))
      })
      .catch(() => setReviewItems([]))
      .finally(() => setReviewLoading(false))
  }, [])

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const allTasks = plan?.tasks ?? []
  const totalTasks = allTasks.length
  const doneTasks = completedTasks.size
  const allDone = totalTasks > 0 && doneTasks === totalTasks

  if (loading) return <MobilePageLoading rows={4} />

  if (!plan || allTasks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">{t('learning.chooseMaterial')}</p>
          <Button className="mt-4" asChild>
            <Link to="/learning">
              {t('learning.browsePlan')}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">

      {/* Overall Progress */}
      <Card className="mb-5 border-0 bg-primary/[0.07] shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/20">
                <ListChecks className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {allDone ? t('learning.allDone') : `${t('learning.todayProgress')} ${doneTasks}/${totalTasks}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.currentUnit?.title}
                  {plan.currentUnit?.progress && (
                    <> · {t('learning.vocab')} {plan.currentUnit.progress.vocabLearned}/{plan.currentUnit.progress.vocabTotal} · {t('learning.chunks')} {plan.currentUnit.progress.chunkMastered}/{plan.currentUnit.progress.chunkTotal}</>
                  )}
                </p>
              </div>
            </div>
            {allDone && <Sparkles className="size-5 text-amber-500" />}
          </div>
          <Progress
            value={(doneTasks / Math.max(totalTasks, 1)) * 100}
            className="mt-3 h-2"
          />
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-3">
        {allTasks.map((task) => {
          const Icon = TASK_ICONS[task.type]
          const isDone = completedTasks.has(task.id)

          return (
            <Card
              key={task.id}
              className={cn(
                'border-0 bg-muted/30 shadow-none transition-all',
                isDone && 'opacity-60',
                (task.type === 'vocab' || task.type === 'chunk' || task.type === 'pattern') && !isDone && 'cursor-pointer active:scale-[0.98]',
              )}
              onClick={() => {
                if (isDone) return
                if (task.type === 'vocab') {
                  const items = (task.data ?? []).map((d: any) => ({
                    label: d.word,
                    text: d.word,
                    meaning: d.meaning || '',
                    isVocab: true,
                  }))
                  if (items.length > 0) { setDrillItems(items); setDrillIndex(0); setDrillInput(''); setDrillResult(null); setDrillShowHint(false); setDrillOpen(true) }
                } else if (task.type === 'chunk') {
                  const items = (task.data ?? []).map((d: any) => ({
                    label: d.text,
                    text: d.text,
                    meaning: d.meaning || '',
                    isVocab: false,
                  }))
                  if (items.length > 0) { setDrillItems(items); setDrillIndex(0); setDrillInput(''); setDrillResult(null); setDrillShowHint(false); setDrillOpen(true) }
                } else if (task.type === 'pattern') {
                  const items = (task.data ?? []).map((d: any) => ({
                    label: d.pattern || d.text,
                    text: d.pattern || d.text,
                    meaning: d.meaning || '',
                    isVocab: false,
                  }))
                  if (items.length > 0) { setDrillItems(items); setDrillIndex(0); setDrillInput(''); setDrillResult(null); setDrillShowHint(false); setDrillOpen(true) }
                }
              }}
            >
              <CardContent className="flex items-start gap-3 p-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors',
                    isDone
                      ? 'bg-green-500 text-white'
                      : 'bg-background/80 hover:bg-primary/15',
                  )}
                >
                  {isDone && <CheckCircle2 className="size-5" />}
                </button>

                {/* Icon */}
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TASK_COLORS[task.type])}>
                  <Icon className="size-5" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-medium', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {task.title}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {t(`learning.taskLabel.${task.type}`)}
                    </Badge>
                  </div>
                  <p className={cn('mt-0.5 text-xs', isDone ? 'text-muted-foreground/60' : 'text-muted-foreground')}>
                    {task.description}
                  </p>

                  {/* Progress for vocab/chunk tasks */}
                  {(task.type === 'vocab' || task.type === 'chunk' || task.type === 'pattern') && task.total && (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress
                        value={(task.done! / Math.max(task.total!, 1)) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {task.done}/{task.total}
                      </span>
                    </div>
                  )}

                  {/* Duration for practice tasks */}
                  {task.type === 'practice' && task.durationSec && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{t('practiceHub.suggested')} {Math.round(task.durationSec / 60)} {t('practiceSession.minutes')}</span>
                    </div>
                  )}
                </div>

                {/* Secondary action for vocab/chunk — still links to unit for full context */}
                <TaskAction task={task} isDone={isDone} />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Today's Review Cards */}
      {!reviewLoading && reviewItems.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <RotateCcw className="size-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-foreground">今日复练</h2>
            <Badge variant="secondary" className="text-[11px]">{reviewItems.length}</Badge>
          </div>
          <div className="space-y-2">
            {reviewItems.map((item: any, idx: number) => (
              <button
                key={item.id}
                type="button"
                className="w-full rounded-xl bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:scale-[0.99]"
                onClick={() => {
                  setReviewDialogIndex(idx)
                  setReviewDialogOpen(true)
                }}
              >
                <div className="flex items-center gap-2.5">
                  {item.type === 'error_sentence' && (
                    <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[10px] text-amber-500 border-amber-500/30">错句</Badge>
                  )}
                  {item.type === 'chunk' && (
                    <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[10px] text-purple-500 border-purple-500/30">表达</Badge>
                  )}
                  {item.type === 'word' && (
                    <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[10px] text-blue-500 border-blue-500/30">词汇</Badge>
                  )}
                  {item.type === 'upgraded' && (
                    <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[10px] text-green-500 border-green-500/30">升级</Badge>
                  )}
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.type === 'error_sentence' && item.original
                      ? item.original.slice(0, 30) + (item.original.length > 30 ? '...' : '')
                      : item.original || item.chunkText || '—'}
                  </span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </div>
                {item.corrected && (
                  <p className="mt-1.5 truncate pl-[62px] text-xs text-muted-foreground">
                    → {item.corrected}
                  </p>
                )}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" asChild>
            <Link to="/expressions?reviewState=learning">
              <BookOpen className="mr-1 size-3.5" />
              查看全部待复练
            </Link>
          </Button>
        </div>
      )}

      {/* Completion Message */}
      {allDone && (
        <div className="mt-6 rounded-lg bg-green-500/10 p-4 text-center">
          <Sparkles className="mx-auto mb-2 size-6 text-amber-500" />
          <p className="font-medium text-foreground">{t('learning.allTasksDone')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            坚持每天练习，英语表达会越来越自然
          </p>
          <Button className="mt-3" variant="outline" asChild>
            <Link to="/learning">浏览更多学习材料</Link>
          </Button>
        </div>
      )}

      {/* Review Dialog — simple inline retry input */}
      <Dialog open={reviewDialogOpen} onOpenChange={(o) => { setReviewDialogOpen(o); if (!o) { setRetryText(''); setRetryResult(null) } }}>
        <DialogContent className="max-w-sm rounded-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>复练</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const item = reviewItems[reviewDialogIndex]
              if (!item) return null
              return (
                <>
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {item.type === 'error_sentence' ? '错句复习' : item.type === 'chunk' ? '表达复习' : item.type === 'word' ? '词汇复习' : '升级表达'}
                    </p>
                    {item.original && (
                      <p className="mt-1 text-sm line-through text-muted-foreground">{item.original}</p>
                    )}
                    {item.corrected && (
                      <p className="mt-0.5 text-sm font-medium text-foreground">→ {item.corrected}</p>
                    )}
                    {!item.corrected && item.chunkText && (
                      <p className="mt-1 text-sm font-medium text-foreground">{item.chunkText}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">请重新说一遍：</p>
                  <Textarea
                    value={retryText}
                    onChange={(e) => { setRetryText(e.target.value); setRetryResult(null) }}
                    placeholder="输入正确的表达..."
                    className="min-h-[60px] resize-none rounded-lg"
                    disabled={retryJudging}
                  />
                  {retryResult && (
                    <div className={cn('rounded-md px-3 py-2', retryResult.passed ? 'bg-green-500/10' : 'bg-amber-500/10')}>
                      <p className="text-[11px] font-medium">{retryResult.passed ? '✅ 正确！' : '再试一次'}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{retryResult.feedback}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button className="flex-1" size="sm" disabled={retryJudging || !retryText.trim()} onClick={async () => {
                      if (!retryText.trim()) return
                      setRetryJudging(true)
                      try {
                        const judgement = await practiceAiApi.judgeDialogueTurn({
                          topicId: '',
                          npcText: item.corrected || item.chunkText || item.original || '',
                          userText: retryText.trim(),
                          objectives: [item.corrected || item.chunkText || ''],
                          targetChunks: item.corrected ? [item.corrected] : [],
                          mode: 'targeted_output',
                        })
                        setRetryResult({ passed: judgement.passed, feedback: judgement.feedback })
                      } catch (err: any) {
                        setRetryResult({ passed: false, feedback: err?.message || '判断失败' })
                      } finally {
                        setRetryJudging(false)
                      }
                    }}>
                      {retryJudging ? <RotateCcw className="mr-1 size-3.5 animate-spin" /> : null}
                      提交
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      if (reviewDialogIndex < reviewItems.length - 1) {
                        setReviewDialogIndex(prev => prev + 1)
                        setRetryText('')
                        setRetryResult(null)
                      } else {
                        setReviewDialogOpen(false)
                      }
                    }}>
                      下一张 <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Vocab/Chunk Practice Drill Dialog — full-screen like LearningInsightDialog */}
      <Dialog open={drillOpen} onOpenChange={(o) => { setDrillOpen(o); if (!o) { setDrillInput(''); setDrillResult(null); setDrillShowHint(false) } }}>
        <DialogContent
          className="!z-[10000] h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 pt-safe md:h-[88vh] md:max-w-3xl md:rounded-2xl md:pt-0 [&>button]:hidden"
          onTouchStart={(e) => { drillTouchStartX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            const deltaX = e.changedTouches[0].clientX - drillTouchStartX.current
            if (Math.abs(deltaX) < 50) return
            if (deltaX > 0 && drillIndex > 0) { setDrillIndex(prev => prev - 1); setDrillInput(''); setDrillResult(null); setDrillShowHint(false) }
            else if (deltaX < 0 && drillIndex < drillItems.length - 1) { setDrillIndex(prev => prev + 1); setDrillInput(''); setDrillResult(null); setDrillShowHint(false) }
          }}
        >
          <DialogTitle className="sr-only">
            {drillItems[drillIndex]?.isVocab ? '词汇练习' : '表达练习'} — {drillItems[drillIndex]?.text}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {drillItems[drillIndex]?.isVocab ? `练习使用词汇 ${drillItems[drillIndex]?.text}` : `练习使用表达 ${drillItems[drillIndex]?.text}`}
          </DialogDescription>
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {drillItems[drillIndex]?.isVocab ? <BookText className="size-[18px]" /> : <MessageSquareText className="size-[18px]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Badge variant="secondary" className="mb-1.5">
                    {drillItems[drillIndex]?.isVocab ? '词汇练习' : '表达练习'}
                  </Badge>
                  <h2 className="break-words text-xl font-bold leading-tight text-foreground">
                    {drillItems[drillIndex]?.text}
                  </h2>
                  {drillItems[drillIndex]?.meaning && (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{drillItems[drillIndex]?.meaning}</p>
                  )}
                </div>
                <button
                  onClick={() => setDrillOpen(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3 md:px-6">
              {(() => {
                const item = drillItems[drillIndex]
                if (!item) return <p className="text-muted-foreground text-sm">暂无内容</p>

                return (
                  <>
                    {/* Prompt */}
                    <p className="text-base font-medium text-foreground">
                      {item.isVocab
                        ? `请用 "${item.text}" 造一个英文句子`
                        : item.text.includes('___') || item.text.includes('…')
                          ? '请在空白处填词，说出完整的英文句子：'
                          : `请用英文表达：${item.meaning || item.text}`
                      }
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm"
                        disabled={drillAudioPlaying}
                        onClick={async () => {
                          setDrillAudioPlaying(true)
                          try {
                            const result = await synthesizeText({ text: item.text, provider: 'minimax' as any, model: 'speech-02' })
                            const blob = await fetch(`data:${result.mimeType};base64,${result.audioBase64}`).then(r => r.blob())
                            const url = URL.createObjectURL(blob)
                            const audio = new Audio(url)
                            drillAudioRef.current = audio
                            audio.onended = () => { URL.revokeObjectURL(url); setDrillAudioPlaying(false) }
                            audio.onerror = () => { setDrillAudioPlaying(false) }
                            await audio.play()
                          } catch { setDrillAudioPlaying(false) }
                        }}
                      >
                        {drillAudioPlaying ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
                        跟读
                      </Button>
                      <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm"
                        onClick={() => setDrillShowHint(!drillShowHint)}>
                        <Edit3 className="size-4" />
                        {drillShowHint ? '隐藏' : '提示'}
                      </Button>
                    </div>

                    {/* Hint */}
                    {drillShowHint && (
                      <div className="rounded-md bg-muted/60 px-3 py-2 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          {item.isVocab ? '提示' : '参考答案'}
                        </p>
                        {item.isVocab ? (
                          <p className="text-sm text-foreground">
                            用 "{item.text}" ({item.meaning}) 造句，如：I need a {item.text.includes(' ') ? '' : ' '}{item.text} to check out books.
                          </p>
                        ) : (
                          <p className="text-sm text-foreground">{item.text}</p>
                        )}
                        {!item.isVocab && (item.text.includes('___') || item.text.includes('…')) && (
                          <p className="text-xs text-muted-foreground">跟读一遍，然后在输入框里默写出来。</p>
                        )}
                      </div>
                    )}

                    {/* Input */}
                    <Textarea
                      value={drillInput}
                      onChange={(e) => { setDrillInput(e.target.value); setDrillResult(null) }}
                      placeholder={item.isVocab ? "用这个词造个句子..." : "输入完整的英文句子..."}
                      className="min-h-[80px] resize-none rounded-xl border-0 bg-background/70 text-base"
                      disabled={drillJudging}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitDrill() } }}
                    />

                    {/* Result */}
                    {drillResult && (
                      <div className={cn('rounded-md px-3 py-2', drillResult.passed ? 'bg-green-500/10' : 'bg-amber-500/10')}>
                        <div className="flex items-center gap-1.5">
                          {drillResult.passed ? <CheckCircle2 className="size-4 text-green-500" /> : null}
                          <p className="text-sm font-medium">{drillResult.passed ? '通过！' : '再试一次'}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{drillResult.feedback}</p>
                        {drillResult.correction && (
                          <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">{drillResult.correction}</p>
                        )}
                      </div>
                    )}

                    {/* Submit */}
                    <Button className="w-full min-h-11" size="default" disabled={drillJudging || !drillInput.trim()}
                      onClick={() => submitDrill()}>
                      {drillJudging ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                      {drillJudging ? '判断中...' : '提交'}
                    </Button>

                    {/* Next when passed */}
                    {drillResult?.passed && (
                      <Button variant="outline" className="w-full min-h-11" size="default"
                        onClick={() => {
                          if (drillIndex < drillItems.length - 1) {
                            setDrillIndex(prev => prev + 1); setDrillInput(''); setDrillResult(null); setDrillShowHint(false)
                          } else { setDrillOpen(false) }
                        }}>
                        {drillIndex < drillItems.length - 1 ? '下一题' : '完成'}
                        <ChevronRight className="ml-1 size-4" />
                      </Button>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Footer */}
            <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
              <Button variant="outline" size="sm" disabled={drillIndex === 0}
                onClick={() => { setDrillIndex(prev => prev - 1); setDrillInput(''); setDrillResult(null); setDrillShowHint(false) }}>
                <ChevronLeft className="size-4" /> 上一个
              </Button>
              <span className="text-xs text-muted-foreground">{drillIndex + 1} / {drillItems.length}</span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={drillIndex >= drillItems.length - 1}
                  onClick={() => { setDrillIndex(prev => prev + 1); setDrillInput(''); setDrillResult(null); setDrillShowHint(false) }}>
                  下一个 <ChevronRight className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDrillPlaylistOpen(true)} title="列表">
                  <ListMusic className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Playlist Drawer */}
      <Drawer open={drillPlaylistOpen} onOpenChange={setDrillPlaylistOpen}>
        <DrawerContent className="h-[100dvh] rounded-none pt-safe !z-[10001]" overlayClassName="!z-[10001]">
          <div className="flex items-center justify-between px-5 py-3">
            <DrawerTitle className="text-lg">练习列表</DrawerTitle>
            <button
              onClick={() => setDrillPlaylistOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronRight className="size-5 rotate-90" />
            </button>
          </div>
          <ScrollArea className="flex-1 px-4 pb-8">
            <div className="space-y-1">
              {drillItems.map((dItem, i) => {
                const Icon = dItem.isVocab ? BookText : MessageSquareText
                const isActive = i === drillIndex
                return (
                  <button
                    key={i}
                    onClick={() => { setDrillIndex(i); setDrillPlaylistOpen(false); setDrillInput(''); setDrillResult(null); setDrillShowHint(false) }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{dItem.text}</p>
                      {dItem.meaning && <p className="truncate text-xs text-muted-foreground">{dItem.meaning}</p>}
                    </div>
                    {isActive && <Badge className="px-1.5 py-0 text-[10px]">当前</Badge>}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function TaskAction({ task, isDone }: { task: TodayTask; isDone: boolean }) {
  if (isDone) return null

  const baseClass = 'flex shrink-0 items-center gap-1 text-xs font-medium'

  switch (task.type) {
    case 'vocab':
      return (
        <Link
          to={`/learning/units/${task.unitId}`}
          className={cn(baseClass, 'text-muted-foreground hover:text-primary hover:underline')}
          onClick={(e) => e.stopPropagation()}
        >
          详情
          <ChevronRight className="size-3" />
        </Link>
      )
    case 'chunk':
    case 'pattern':
      return (
        <Link
          to={`/learning/units/${task.unitId}`}
          className={cn(baseClass, 'text-muted-foreground hover:text-primary hover:underline')}
          onClick={(e) => e.stopPropagation()}
        >
          详情
          <ChevronRight className="size-3" />
        </Link>
      )
    case 'practice':
      return (
        <Link
          to={`/practice/session/${task.topicId}`}
          className={cn(baseClass, 'text-primary hover:underline')}
        >
          开始
          <ChevronRight className="size-3" />
        </Link>
      )
    case 'script':
      return (
        <Link
          to={`/script/${task.episodeId}`}
          className={cn(baseClass, 'text-primary hover:underline')}
        >
          挑战
          <ChevronRight className="size-3" />
        </Link>
      )
    default:
      return null
  }
}
