import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, FileText, Layers, Loader2, Search, Sparkles, Target, X } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useLearningStore } from '@/stores/learning.store'
import { learningApi, type TrainingTopicItem } from '../api/learning-api'

type ReadingPhase = 'prepare' | 'answer'

export function ReadingSessionPage() {
  const navigate = useNavigate()
  const { topicId } = useParams<{ topicId: string }>()
  const [searchParams] = useSearchParams()
  const unitId = searchParams.get('unitId')
  const unit = useLearningStore((state) => state.unitDetail)
  const loading = useLearningStore((state) => state.unitDetailLoading)
  const fetchUnitDetail = useLearningStore((state) => state.fetchUnitDetail)
  const setImmersiveMode = useLayoutStore((state) => state.setImmersiveMode)
  const [phase, setPhase] = useState<ReadingPhase>('prepare')
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (!unitId || unit?.id === unitId) return
    void fetchUnitDetail(unitId)
  }, [fetchUnitDetail, unit?.id, unitId])

  useEffect(() => {
    setImmersiveMode(phase === 'answer')
    return () => setImmersiveMode(false)
  }, [phase, setImmersiveMode])

  const topic = useMemo(() => unit?.trainingTopics.find((item) => item.id === topicId) ?? null, [topicId, unit?.trainingTopics])

  if (loading && (!unit || unit.id !== unitId)) return <MobilePageLoading rows={5} minHeightClassName="min-h-[100dvh]" />

  if (!unitId || !topic || unit?.contentMode !== 'reading') {
    return <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center"><BookOpen className="size-10 text-muted-foreground/35" /><div><p className="font-medium">没有找到这个阅读话题</p><p className="mt-1 text-sm text-muted-foreground">返回学习包后重新选择一个话题。</p></div><Button variant="outline" onClick={() => navigate(-1)}>返回学习包</Button></div>
  }

  return (
    <>
      {phase === 'prepare'
        ? <ReadingPreparePage topic={topic} unitTitle={unit.title} onBack={() => navigate(-1)} onOpenGuide={() => setGuideOpen(true)} onStart={() => setPhase('answer')} />
        : <ReadingAnswerPage topic={topic} unitTitle={unit.title} onClose={() => setPhase('prepare')} onOpenGuide={() => setGuideOpen(true)} />}
      <PracticeVnDrawer open={guideOpen} onOpenChange={setGuideOpen} hideToggles teachingMarkdown={topic.teachingMarkdown?.trim() || topic.description?.trim() || ''} />
    </>
  )
}

function ReadingPreparePage({ topic, unitTitle, onBack, onOpenGuide, onStart }: { topic: TrainingTopicItem; unitTitle: string; onBack: () => void; onOpenGuide: () => void; onStart: () => void }) {
  const config = topic.contentConfig?.reading ?? {}
  const questions: any[] = config.questions ?? []
  const supportCount = (topic.vocabularies?.length ?? 0) + (topic.activeChunks?.length ?? 0) + (topic.sentencePatterns?.length ?? 0)
  const durationMinutes = Math.max(1, Math.round(topic.suggestedDurationSec / 60))
  const visibleVocabularies = topic.vocabularies ?? []
  const visibleChunks = topic.activeChunks ?? []
  const visiblePatterns = topic.sentencePatterns ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 md:pt-4">
      <ReadingHeader topic={topic} unitTitle={unitTitle} onBack={onBack} />
      <main className="space-y-5">
        {(topic.description?.trim() || topic.teachingMarkdown?.trim()) && (
          <section className="rounded-lg bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2"><BookOpen className="size-4 text-primary" /><p className="text-sm font-semibold">阅读说明</p></div>
            {topic.description?.trim() && <MarkdownRenderer content={topic.description} className="text-muted-foreground prose-p:my-1" />}
            <Button variant="outline" className="mt-4 min-h-11 w-full" onClick={onOpenGuide}><BookOpen className="size-4" />教学讲解</Button>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1"><div><h2 className="text-base font-semibold">阅读准备</h2><p className="mt-0.5 text-xs text-muted-foreground">开始前可复习关联的词汇、句块与句型</p></div><Badge variant="outline" className="rounded-full text-[11px]">{supportCount} 项</Badge></div>
          <Tabs defaultValue={visibleVocabularies.length > 0 ? 'vocab' : visibleChunks.length > 0 ? 'chunk' : 'pattern'} className="w-full" data-mobile-route-swipe>
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
              <TabsTrigger value="vocab" className="rounded-md text-xs">词汇 ({visibleVocabularies.length})</TabsTrigger>
              <TabsTrigger value="chunk" className="rounded-md text-xs">核心句块 ({visibleChunks.length})</TabsTrigger>
              <TabsTrigger value="pattern" className="rounded-md text-xs">句型 ({visiblePatterns.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="vocab" className="mt-3" data-mobile-gesture-allow><ReadingKnowledgeList icon={<Search className="size-4" />} items={visibleVocabularies.map((item) => ({ title: item.word, subtitle: item.meaning }))} tone="cyan" emptyText="这个话题暂未配置词汇" /></TabsContent>
            <TabsContent value="chunk" className="mt-3" data-mobile-gesture-allow><ReadingKnowledgeList icon={<Layers className="size-4" />} items={visibleChunks.map((item) => ({ title: item.text, subtitle: item.meaning }))} tone="emerald" emptyText="这个话题暂未配置核心句块" /></TabsContent>
            <TabsContent value="pattern" className="mt-3" data-mobile-gesture-allow><ReadingKnowledgeList icon={<Target className="size-4" />} items={visiblePatterns.map((item) => ({ title: item.pattern, subtitle: item.meaning }))} tone="violet" emptyText="这个话题暂未配置句型" /></TabsContent>
          </Tabs>
        </section>

        <section className="rounded-lg bg-primary/[0.045] p-4">
          <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-base font-semibold">准备好后开始作答</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">进入后，上方阅读文章，下方逐题作答，可以随时滚动原文检查。</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">{durationMinutes} 分钟</Badge><Badge variant="outline">{questions.length} 题</Badge>{config.wordCount ? <Badge variant="outline">约 {config.wordCount} 词</Badge> : null}</div>
          <Button size="lg" className="mt-4 w-full" onClick={onStart}>开始作答<ChevronRight className="size-4" /></Button>
        </section>
      </main>
    </div>
  )
}

function ReadingKnowledgeList({ icon, items, tone, emptyText }: { icon: React.ReactNode; items: Array<{ title: string; subtitle?: string | null }>; tone: 'cyan' | 'emerald' | 'violet'; emptyText: string }) {
  const toneClass = { cyan: 'bg-cyan-500/10 text-cyan-600', emerald: 'bg-emerald-500/10 text-emerald-600', violet: 'bg-violet-500/10 text-violet-600' }[tone]
  if (items.length === 0) return <p className="rounded-lg bg-muted/25 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  return <div className="flex flex-col gap-2">{items.map((item) => <div key={item.title} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClass)}>{icon}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p>{item.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>}</div></div>)}</div>
}

function ReadingHeader({ topic, unitTitle, onBack }: { topic: TrainingTopicItem; unitTitle: string; onBack: () => void }) {
  return <header className="mb-4 flex min-h-10 items-center gap-3"><button type="button" onClick={onBack} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted" aria-label="返回学习包"><ArrowLeft className="size-4" /></button><div className="min-w-0 flex-1"><p className="truncate text-xs text-muted-foreground">{unitTitle}</p><h1 className="truncate text-lg font-semibold tracking-tight">{topic.title}</h1></div><Badge variant="secondary">{topic.difficulty}</Badge></header>
}

function ReadingAnswerPage({ topic, unitTitle, onClose, onOpenGuide }: { topic: TrainingTopicItem; unitTitle: string; onClose: () => void; onOpenGuide: () => void }) {
  const config = topic.contentConfig?.reading ?? {}
  const questions: any[] = config.questions ?? []
  const [answers, setAnswers] = useState<Record<string, string>>(topic.latestSubmission?.response?.answers ?? {})
  const [submission, setSubmission] = useState(topic.latestSubmission ?? null)
  const [saving, setSaving] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const answeredCount = questions.filter((_: any, index: number) => String(answers[String(index)] ?? '').trim()).length
  const question = questions[currentQuestion]

  const submit = async () => {
    setSaving(true)
    try {
      await learningApi.saveTopicSubmission(topic.id, { response: { answers }, status: 'submitted' })
      const reviewed = await learningApi.reviewTopicSubmission(topic.id)
      setSubmission(reviewed)
      toast.success('回答已提交')
    } catch (error: any) { toast.error(error?.message || '提交失败') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#fffefb] pt-safe dark:bg-background">
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mx-auto flex max-w-3xl items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-[18px]" /></span>
          <div className="min-w-0 flex-1"><div className="mb-1.5 flex items-center gap-2"><Badge variant="secondary">阅读练习</Badge><span className="truncate text-xs text-muted-foreground">{topic.difficulty}</span></div><h1 className="break-words text-xl font-bold leading-tight">{topic.title}</h1><p className="mt-1.5 truncate text-sm text-muted-foreground">{unitTitle}</p></div>
          <button type="button" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground" aria-label="退出答题"><X className="size-4" /></button>
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(19rem,43dvh)]">
        <section className="min-h-0 overflow-y-auto overscroll-contain" aria-label="阅读文章">
          <article className="mx-auto w-full max-w-3xl px-5 pb-8 pt-5 sm:px-8">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Reading passage</p><p className="mt-1 text-xs text-muted-foreground">文章区域可独立滚动</p></div><Button variant="ghost" size="sm" onClick={onOpenGuide} className="-mr-2"><BookOpen className="size-4" />指南</Button></div>
            <MarkdownRenderer content={String(config.questionMarkdown ?? '')} className="text-[16px] leading-8 prose-p:my-4 prose-p:leading-8 prose-img:my-5 prose-img:w-full" />
          </article>
        </section>

        <section className="flex min-h-0 flex-col border-t border-border/70 bg-background shadow-[0_-10px_30px_rgba(0,0,0,0.05)]" aria-label="阅读问题">
          <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 overflow-x-auto border-b border-border/50 px-4 py-2.5">
            <p className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">题目</p>
            {questions.map((_: any, index: number) => <button key={index} type="button" onClick={() => setCurrentQuestion(index)} className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', currentQuestion === index ? 'border-primary bg-primary text-primary-foreground' : answers[String(index)] ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground')} aria-label={`第 ${index + 1} 题`}>{index + 1}</button>)}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{answeredCount}/{questions.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-3xl px-4 py-4">
              {question ? <ReadingQuestion index={currentQuestion} question={question} value={answers[String(currentQuestion)] ?? ''} onChange={(value) => setAnswers((current) => ({ ...current, [String(currentQuestion)]: value }))} /> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">暂未配置理解题</p>}
              {submission?.feedback && <div className="mt-4"><ReadingFeedback feedback={submission.feedback} /></div>}
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 border-t border-border/50 px-4 py-2.5 pb-safe">
            <Button variant="outline" size="sm" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((index) => Math.max(0, index - 1))}><ChevronLeft className="size-4" />上一题</Button>
            {currentQuestion < questions.length - 1
              ? <Button size="sm" className="ml-auto" onClick={() => setCurrentQuestion((index) => Math.min(questions.length - 1, index + 1))}>下一题<ChevronRight className="size-4" /></Button>
              : <Button size="sm" className="ml-auto" onClick={submit} disabled={saving || answeredCount < questions.length || questions.length === 0}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}提交答案</Button>}
          </div>
        </section>
      </main>
    </div>
  )
}

function ReadingQuestion({ index, question, value, onChange }: { index: number; question: any; value: string; onChange: (value: string) => void }) {
  const options = question.type === 'boolean' ? ['正确', '错误'] : (question.options ?? [])
  return (
    <div className="rounded-xl bg-muted/30 p-4">
      <div className="mb-3 flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span><p className="pt-0.5 text-sm font-semibold leading-6">{question.prompt}</p></div>
      {['choice', 'boolean'].includes(question.type) ? <div className="space-y-2">{options.map((option: string, optionIndex: number) => <button key={`${option}-${optionIndex}`} type="button" onClick={() => onChange(option)} className={cn('flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors', value === option ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 bg-background')}><span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', value === option ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}>{question.type === 'boolean' ? (optionIndex === 0 ? '✓' : '×') : String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></button>)}</div> : <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 resize-y bg-background" placeholder="根据阅读材料作答…" />}
    </div>
  )
}

function ReadingFeedback({ feedback }: { feedback: Record<string, any> }) {
  return <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><div className="mb-3 flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /><p className="text-sm font-semibold">阅读反馈</p>{feedback.score != null && <Badge className="ml-auto">{feedback.score}</Badge>}</div><p className="text-sm leading-6 text-muted-foreground">{feedback.summary}</p>{(feedback.improvements ?? []).length > 0 && <ul className="mt-3 space-y-1 text-sm">{feedback.improvements.map((item: string) => <li key={item}>→ {item}</li>)}</ul>}</div>
}
