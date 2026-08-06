import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, FileText, Layers, Loader2, Search, Sparkles, Target, X } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useLearningStore } from '@/stores/learning.store'
import { learningApi, type TrainingTopicItem } from '../api/learning-api'

type ReadingPhase = 'prepare' | 'answer'

export function ReadingSessionPage() {
  const { t } = useTranslation()
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
    return <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center"><BookOpen className="size-10 text-muted-foreground/35" /><div><p className="font-medium">{t('learning.readingNotFound')}</p><p className="mt-1 text-sm text-muted-foreground">{t('learning.backToPackHint')}</p></div><Button variant="outline" onClick={() => navigate(-1)}>{t('learning.backToPack')}</Button></div>
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
  const { t } = useTranslation()
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
            <div className="mb-2 flex items-center gap-2"><BookOpen className="size-4 text-primary" /><p className="text-sm font-semibold text-foreground">{t('learning.readingGuide')}</p></div>
            {topic.description?.trim() && <MarkdownRenderer content={topic.description} className="text-muted-foreground prose-p:my-1" />}
            <Button variant="outline" className="mt-4 min-h-11 w-full" onClick={onOpenGuide}><BookOpen className="size-4" />{t('learning.teachingGuide')}</Button>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1"><div><h2 className="text-base font-semibold">{t('learning.readingPrep')}</h2><p className="mt-0.5 text-xs text-muted-foreground">{t('learning.readingPrepHint')}</p></div><Badge variant="outline" className="rounded-full text-[11px]">{t('learning.supportCount', { count: supportCount })}</Badge></div>
          <Tabs defaultValue={visibleVocabularies.length > 0 ? 'vocab' : visibleChunks.length > 0 ? 'chunk' : 'pattern'} className="w-full" data-mobile-route-swipe>
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
              <TabsTrigger value="vocab" className="rounded-md text-xs">{t('learning.vocab')} ({visibleVocabularies.length})</TabsTrigger>
              <TabsTrigger value="chunk" className="rounded-md text-xs">{t('learning.coreChunks')} ({visibleChunks.length})</TabsTrigger>
              <TabsTrigger value="pattern" className="rounded-md text-xs">{t('learning.patterns')} ({visiblePatterns.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="vocab" className="mt-3" data-mobile-gesture-allow><ReadingKnowledgeList icon={<Search className="size-4" />} items={visibleVocabularies.map((item) => ({ title: item.word, subtitle: item.meaning }))} tone="cyan" emptyText={t('learning.noTopicVocab')} /></TabsContent>
            <TabsContent value="chunk" className="mt-3" data-mobile-gesture-allow><ReadingKnowledgeList icon={<Layers className="size-4" />} items={visibleChunks.map((item) => ({ title: item.text, subtitle: item.meaning }))} tone="emerald" emptyText={t('learning.noTopicChunks')} /></TabsContent>
            <TabsContent value="pattern" className="mt-3" data-mobile-gesture-allow><ReadingKnowledgeList icon={<Target className="size-4" />} items={visiblePatterns.map((item) => ({ title: item.pattern, subtitle: item.meaning }))} tone="violet" emptyText={t('learning.noTopicPatterns')} /></TabsContent>
          </Tabs>
        </section>

        <section className="rounded-lg bg-accent/[0.06] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-accent" />
              <p className="text-sm font-semibold text-foreground">{t('learning.readingPractice')}</p>
            </div>
            <span className="text-right text-xs leading-5 text-muted-foreground">
              {t('learning.minutesWithCount', { count: durationMinutes })} · {t('learning.questionCountLabel', { count: questions.length })}{config.wordCount ? ` · ${t('learning.estimatedWords', { count: config.wordCount })}` : ''}
            </span>
          </div>
          {topic.promptEn?.trim() && <p className="text-lg font-semibold leading-7 text-foreground">{topic.promptEn}</p>}
          {topic.promptZh?.trim() && <p className="mt-2 text-sm leading-6 text-muted-foreground">{topic.promptZh}</p>}
          {!(topic.promptEn?.trim() || topic.promptZh?.trim()) && <p className="text-sm leading-6 text-muted-foreground">{t('learning.readingIntro')}</p>}
          <Button size="lg" className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" onClick={onStart}>{t('learning.startPractice')}<ChevronRight className="size-4" /></Button>
        </section>
      </main>
    </div>
  )
}

function ReadingKnowledgeList({ icon, items, tone, emptyText }: { icon: React.ReactNode; items: Array<{ title: string; subtitle?: string | null }>; tone: 'cyan' | 'emerald' | 'violet'; emptyText: string }) {
  const toneClass = { cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' }[tone]
  if (items.length === 0) return <p className="rounded-lg bg-muted/25 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  return <div className="flex flex-col gap-2">{items.map((item) => <Card key={item.title} className="border-0 bg-muted/30 shadow-none"><CardContent className="flex items-center gap-3 p-3"><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClass)}>{icon}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{item.title}</p>{item.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>}</div></CardContent></Card>)}</div>
}

function ReadingHeader({ topic, unitTitle, onBack }: { topic: TrainingTopicItem; unitTitle: string; onBack: () => void }) {
  const { t } = useTranslation()
  return <header className="mb-4 flex min-h-10 items-center gap-3"><button type="button" onClick={onBack} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted" aria-label={t('learning.backToPack')}><ArrowLeft className="size-4" /></button><div className="min-w-0 flex-1"><p className="truncate text-xs text-muted-foreground">{unitTitle}</p><h1 className="truncate text-lg font-semibold tracking-tight">{topic.title}</h1></div><Badge variant="secondary">{topic.difficulty}</Badge></header>
}

function ReadingAnswerPage({ topic, unitTitle, onClose, onOpenGuide }: { topic: TrainingTopicItem; unitTitle: string; onClose: () => void; onOpenGuide: () => void }) {
  const { t } = useTranslation()
  const config = topic.contentConfig?.reading ?? {}
  const questions: any[] = config.questions ?? []
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const answeredCount = questions.filter((_: any, index: number) => String(answers[String(index)] ?? '').trim()).length
  const question = questions[currentQuestion]

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const latest = await learningApi.getLatestTopicSession(topic.id)
        if (cancelled) return
        if (latest?.status === 'active') {
          setSessionId(latest.id)
          if (latest.submissions?.[0]?.response?.answers) setAnswers(latest.submissions[0].response.answers)
        } else if (latest?.status === 'analyzed') {
          setAnalysisResult(latest.analysisResult ?? null)
          const created = await learningApi.startTopicSession(topic.id)
          if (!cancelled) setSessionId(created.id)
        } else {
          const created = await learningApi.startTopicSession(topic.id)
          if (!cancelled) setSessionId(created.id)
        }
      } catch { /* 离线 */ }
    })()
    return () => { cancelled = true }
  }, [topic.id])

  const submit = async () => {
    if (!sessionId || saving) return
    setSaving(true)
    try {
      await learningApi.saveTopicSubmission(topic.id, { response: { answers }, status: 'submitted' })
      await learningApi.completeTopicSession(topic.id, sessionId)
      const result = await learningApi.analyzeTopicSession(topic.id, sessionId)
      setAnalysisResult(result.analysis ?? null)
      setSubmitted(true)
      toast.success(t('learning.aiEvaluationDone'))
    } catch (error: any) { toast.error(error?.message || t('learning.submitFailed')) } finally { setSaving(false) }
  }

  const showAnalysis = submitted || analysisResult

  return (
    <div className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#fffefb] pt-safe dark:bg-background">
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-4 pb-2.5 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-4" /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge variant="secondary" className="text-[10px] h-5 px-1.5">{t('learning.readingPractice')}</Badge><span className="truncate text-[11px] text-muted-foreground">{topic.difficulty}</span></div><h1 className="truncate text-base font-bold leading-snug">{topic.title}</h1><p className="truncate text-[11px] text-muted-foreground">{unitTitle}</p></div>
          <button type="button" onClick={onClose} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground" aria-label={t('learning.exitAnswering')}><X className="size-3.5" /></button>
        </div>
      </header>
      {showAnalysis ? (
        <ReadingAnalysisPanel analysis={analysisResult} onClose={onClose} />
      ) : (
        <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(15rem,40dvh)]">
          <section className="min-h-0 overflow-y-auto overscroll-contain" aria-label={t('learning.readingArticle')}>
            <article className="mx-auto w-full max-w-3xl px-5 pb-6 pt-4 sm:px-8">
              <div className="mb-3 flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t('learning.readingPassage')}</p><Button variant="ghost" size="sm" onClick={onOpenGuide} className="-mr-2 h-7 text-xs"><BookOpen className="size-3.5" />{t('learning.guide')}</Button></div>
              <MarkdownRenderer content={String(config.questionMarkdown ?? '')} className="text-[16px] leading-8 prose-p:my-4 prose-p:leading-8 prose-img:my-5 prose-img:w-full" />
            </article>
          </section>

          <section className="flex min-h-0 flex-col border-t border-border/70 bg-background shadow-[0_-8px_20px_rgba(0,0,0,0.04)]" aria-label={t('learning.readingQuestions')}>
            <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2">
              <p className="shrink-0 text-[11px] font-medium text-muted-foreground">{t('learning.questionsLabel')}</p>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                {questions.map((_: any, index: number) => <button key={index} type="button" onClick={() => setCurrentQuestion(index)} className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', currentQuestion === index ? 'border-primary bg-primary text-primary-foreground' : answers[String(index)] ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground')} aria-label={t('learning.questionNumberAria', { number: index + 1 })}>{index + 1}</button>)}
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{answeredCount}/{questions.length}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-8 px-2.5" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((index) => Math.max(0, index - 1))}><ChevronLeft className="size-4" />{t('learning.prevQuestion')}</Button>
                {currentQuestion < questions.length - 1
                  ? <Button size="sm" className="h-8 px-3" onClick={() => setCurrentQuestion((index) => Math.min(questions.length - 1, index + 1))}>{t('learning.nextQuestion')}<ChevronRight className="size-4" /></Button>
                  : <Button size="sm" className="h-8 px-3" onClick={submit} disabled={saving || answeredCount < questions.length || questions.length === 0 || !sessionId}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{t('learning.submitEvaluation')}</Button>}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mx-auto w-full max-w-3xl px-4 py-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                {question ? <ReadingQuestion index={currentQuestion} question={question} value={answers[String(currentQuestion)] ?? ''} onChange={(value) => setAnswers((current) => ({ ...current, [String(currentQuestion)]: value }))} /> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t('learning.noComprehensionQuestions')}</p>}
              </div>
            </div>
          </section>
        </main>
      )}
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

function ReadingAnalysisPanel({ analysis, onClose }: { analysis: Record<string, any> | null; onClose: () => void }) {
  if (!analysis) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">AI 正在评估你的回答...</p>
      </main>
    )
  }
  const score = analysis.overallScore ?? 0
  const qByQ = (analysis.questionByQuestion ?? []) as any[]
  const strengths = (analysis.strengths ?? []) as string[]
  const improvements = (analysis.improvements ?? []) as string[]

  return (
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center gap-4 rounded-xl bg-muted/30 p-5">
          <div className={cn('flex size-[72px] shrink-0 flex-col items-center justify-center rounded-xl bg-background/70', score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-destructive')}>
            <span className="text-3xl font-bold leading-none">{score}</span>
            <span className="mt-1 text-[10px] font-medium">总分</span>
          </div>
          <div className="min-w-0">
            {analysis.summary && <p className="text-sm leading-6 text-foreground">{analysis.summary}</p>}
          </div>
        </div>
        {qByQ.length > 0 && (
          <div className="rounded-xl bg-muted/30 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />逐题分析</h3>
            <div className="space-y-3">
              {qByQ.map((item: any) => (
                <div key={item.index} className="rounded-lg bg-background/60 p-3">
                  <div className="flex items-start gap-2">
                    {item.isCorrect ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" /> : <X className="mt-0.5 size-4 shrink-0 text-destructive" />}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">第 {item.index} 题</p>
                      {item.comment && <p className="mt-1 text-xs text-muted-foreground">{item.comment}</p>}
                      {item.evidenceMatch && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{item.evidenceMatch}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl bg-muted/30 p-4">
          {strengths.length > 0 && (
            <div className="mb-3">
              <h3 className="mb-2 text-sm font-semibold text-green-700 dark:text-green-400">做得好的地方</h3>
              <ul className="space-y-1">{strengths.map((s: string) => <li key={s} className="text-xs text-muted-foreground">→ {s}</li>)}</ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">可以改进</h3>
              <ul className="space-y-1">{improvements.map((s: string) => <li key={s} className="text-xs text-muted-foreground">→ {s}</li>)}</ul>
            </div>
          )}
        </div>
        {analysis.nextStepSuggestion && (
          <div className="rounded-xl border border-primary/10 bg-primary/[0.04] p-4">
            <h3 className="mb-1 text-sm font-semibold text-primary">下一步建议</h3>
            <p className="text-sm leading-6 text-muted-foreground">{analysis.nextStepSuggestion}</p>
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={onClose}>返回学习包</Button>
      </div>
    </main>
  )
}
