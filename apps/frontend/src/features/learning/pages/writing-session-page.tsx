import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle2, FilePenLine, Info, Layers, Loader2, Save, Search, Sparkles, Target, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useLearningStore } from '@/stores/learning.store'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { learningApi, type TrainingTopicItem } from '../api/learning-api'
import { WritingTaskCard } from '../components/writing-task-card'

type WritingPhase = 'prepare' | 'write'

export function WritingSessionPage() {
  const navigate = useNavigate()
  const { topicId } = useParams<{ topicId: string }>()
  const [searchParams] = useSearchParams()
  const unitId = searchParams.get('unitId')
  const unit = useLearningStore((state) => state.unitDetail)
  const loading = useLearningStore((state) => state.unitDetailLoading)
  const fetchUnitDetail = useLearningStore((state) => state.fetchUnitDetail)
  const setImmersiveMode = useLayoutStore((state) => state.setImmersiveMode)
  const [phase, setPhase] = useState<WritingPhase>('prepare')
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (!unitId || unit?.id === unitId) return
    void fetchUnitDetail(unitId)
  }, [fetchUnitDetail, unit?.id, unitId])

  useEffect(() => {
    setImmersiveMode(phase === 'write')
    return () => setImmersiveMode(false)
  }, [phase, setImmersiveMode])

  const topic = useMemo(
    () => unit?.trainingTopics.find((item) => item.id === topicId) ?? null,
    [topicId, unit?.trainingTopics],
  )

  if (loading && (!unit || unit.id !== unitId)) {
    return <MobilePageLoading rows={5} minHeightClassName="min-h-[100dvh]" />
  }

  if (!unitId || !topic || unit?.contentMode !== 'writing') {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <FilePenLine className="size-10 text-muted-foreground/35" />
        <div>
          <p className="font-medium text-foreground">没有找到这个写作话题</p>
          <p className="mt-1 text-sm text-muted-foreground">返回学习包后重新选择一个话题。</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>返回学习包</Button>
      </div>
    )
  }

  return (
    <>
      {phase === 'prepare' ? (
        <WritingPreparePage
          topic={topic}
          unitTitle={unit.title}
          onBack={() => navigate(-1)}
          onOpenGuide={() => setGuideOpen(true)}
          onStart={() => setPhase('write')}
        />
      ) : (
        <WritingEditor
          topic={topic}
          unitTitle={unit.title}
          onClose={() => setPhase('prepare')}
          onOpenGuide={() => setGuideOpen(true)}
        />
      )}

      <WritingGuide open={guideOpen} onOpenChange={setGuideOpen} topic={topic} />
    </>
  )
}

function WritingPreparePage({
  topic,
  unitTitle,
  onBack,
  onOpenGuide,
  onStart,
}: {
  topic: TrainingTopicItem
  unitTitle: string
  onBack: () => void
  onOpenGuide: () => void
  onStart: () => void
}) {
  const config = topic.contentConfig?.writing ?? {}
  const requirements: string[] = config.requirements ?? []
  const durationMinutes = Math.max(1, Math.round(topic.suggestedDurationSec / 60))
  const hasDraft = Boolean(String(topic.latestSubmission?.response?.text ?? '').trim())
  const visibleVocabularies = topic.vocabularies ?? []
  const visibleChunks = topic.activeChunks ?? []
  const visiblePatterns = topic.sentencePatterns ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 md:pt-4">
      <header className="mb-4 flex min-h-10 items-center gap-3 md:hidden">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
          aria-label="返回学习包"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs text-muted-foreground">{unitTitle}</p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{topic.title}</h1>
        </div>
        <Badge variant="secondary" className="shrink-0">{topic.difficulty}</Badge>
      </header>
      <header className="mb-4 hidden items-center gap-3 md:flex">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{unitTitle}</p>
          <h1 className="text-lg font-bold text-foreground">{topic.title}</h1>
        </div>
        <Badge variant="secondary">{topic.difficulty}</Badge>
      </header>

      <main className="space-y-5">
        {(topic.description?.trim() || topic.teachingMarkdown?.trim()) && (
          <section className="rounded-lg bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Info className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">话题说明</p>
            </div>
            {topic.description?.trim() ? (
              <MarkdownRenderer
                content={topic.description}
                className="text-muted-foreground prose-p:my-0 prose-ul:my-1 prose-ol:my-1"
              />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">先阅读教学文档，再进入写作任务。</p>
            )}
            <Button variant="outline" className="mt-4 min-h-11 w-full" size="default" onClick={onOpenGuide}>
              <BookOpen className="size-4" />教学讲解
            </Button>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-base font-semibold text-foreground">写作准备</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">写作时可以使用的词汇、句块与句型</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">
              {visibleVocabularies.length + visibleChunks.length + visiblePatterns.length} 项
            </Badge>
          </div>

          <Tabs defaultValue={visibleVocabularies.length > 0 ? 'vocab' : visibleChunks.length > 0 ? 'chunk' : 'pattern'} className="w-full" data-mobile-route-swipe>
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
              <TabsTrigger value="vocab" className="rounded-md text-xs">词汇 ({visibleVocabularies.length})</TabsTrigger>
              <TabsTrigger value="chunk" className="rounded-md text-xs">核心句块 ({visibleChunks.length})</TabsTrigger>
              <TabsTrigger value="pattern" className="rounded-md text-xs">句型 ({visiblePatterns.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="vocab" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                icon={<Search className="size-4" />}
                items={visibleVocabularies.map((item) => ({ title: item.word, subtitle: item.meaning }))}
                tone="cyan"
                emptyText="这个话题暂未配置词汇"
              />
            </TabsContent>
            <TabsContent value="chunk" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                icon={<Layers className="size-4" />}
                items={visibleChunks.map((item) => ({ title: item.text, subtitle: item.meaning }))}
                tone="emerald"
                emptyText="这个话题暂未配置核心句块"
              />
            </TabsContent>
            <TabsContent value="pattern" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                icon={<Target className="size-4" />}
                items={visiblePatterns.map((item) => ({ title: item.pattern, subtitle: item.meaning }))}
                tone="violet"
                emptyText="这个话题暂未配置句型"
              />
            </TabsContent>
          </Tabs>
        </section>

        {requirements.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold text-foreground">写作要求</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">提交前确认已经覆盖这些内容</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[11px]">{requirements.length} 项</Badge>
            </div>
            <div className="space-y-2">
              {requirements.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground">要求 {index + 1}</p>
                    <p className="mt-0.5 text-sm font-medium leading-5 text-foreground">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <WritingTaskCard
          questionMarkdown={config.questionMarkdown}
          promptEn={topic.promptEn}
          promptZh={topic.promptZh}
          genre={config.genre}
          minWords={config.minWords}
          maxWords={config.maxWords}
          durationMinutes={durationMinutes}
          hasDraft={hasDraft}
          onStart={onStart}
        />
      </main>
    </div>
  )
}

function WritingKnowledgeList({
  icon,
  items,
  tone,
  emptyText,
}: {
  icon: React.ReactNode
  items: Array<{ title: string; subtitle?: string | null }>
  tone: 'cyan' | 'emerald' | 'violet'
  emptyText: string
}) {
  const toneClass = {
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  }[tone]

  if (items.length === 0) {
    return <p className="rounded-lg bg-muted/25 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.title} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClass)}>{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
            {item.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function WritingEditor({
  topic,
  unitTitle,
  onClose,
  onOpenGuide,
}: {
  topic: TrainingTopicItem
  unitTitle: string
  onClose: () => void
  onOpenGuide: () => void
}) {
  const config = topic.contentConfig?.writing ?? {}
  const editorPrompt = String(config.questionMarkdown ?? '').trim()
  const [text, setText] = useState(String(topic.latestSubmission?.response?.text ?? ''))
  const [submission, setSubmission] = useState(topic.latestSubmission ?? null)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  const save = async (submit = false) => {
    setSaving(true)
    try {
      let next = await learningApi.saveTopicSubmission(topic.id, { response: { text }, status: submit ? 'submitted' : 'draft' })
      if (submit) next = await learningApi.reviewTopicSubmission(topic.id)
      setSubmission(next)
      toast.success(submit ? 'AI 反馈已生成' : '草稿已保存')
    } catch (error: any) {
      toast.error(error?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const focusEditor = () => {
    window.setTimeout(() => editorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 260)
  }

  return (
    <div
      data-keyboard-overlay="writing"
      className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#fffefb] pt-safe dark:bg-background"
    >
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FilePenLine className="size-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="secondary">写作练习</Badge>
              <span className="truncate text-xs text-muted-foreground">{topic.difficulty}</span>
            </div>
            <h1 className="break-words text-xl font-bold leading-tight text-foreground">{topic.title}</h1>
            <p className="mt-1.5 truncate text-sm text-muted-foreground">{unitTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            aria-label="退出编辑"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-writing-scroll-region>
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-8 pt-5 sm:px-8 sm:pt-7">
          <section className="shrink-0 border-b border-border/50 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">Writing prompt</p>
                <MarkdownRenderer content={editorPrompt} className="mt-2 line-clamp-4 text-[15px] font-semibold leading-6 prose-p:my-0 prose-img:hidden" />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={onOpenGuide} className="-mr-2 shrink-0 gap-1.5 text-primary">
                <BookOpen className="size-4" />指南
              </Button>
            </div>
          </section>

          <div ref={editorRef} className="flex min-h-[55dvh] flex-1 flex-col pt-5" data-writing-editor>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onFocus={focusEditor}
              className="m-0 min-h-[52dvh] w-full flex-1 resize-none appearance-none rounded-none border-0 bg-transparent p-0 text-[17px] leading-8 text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground/45 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="开始写作…"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck
            />
            {submission?.feedback && <div className="mt-6"><WritingFeedback feedback={submission.feedback} /></div>}
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl pb-safe" data-writing-footer>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{config.genre || '自由写作'}</p>
            <p className={cn('mt-0.5 text-xs tabular-nums text-muted-foreground', config.minWords && wordCount < config.minWords && 'text-amber-600')}>
              {wordCount} 词{config.minWords ? ` · 目标 ${config.minWords}–${config.maxWords ?? '∞'}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving || !text.trim()} className="shrink-0 gap-1.5">
            <Save className="size-4" />保存
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={saving || !text.trim()} className="shrink-0 gap-1.5 rounded-full px-4">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}提交反馈
          </Button>
        </div>
      </footer>
    </div>
  )
}

function WritingGuide({ open, onOpenChange, topic }: { open: boolean; onOpenChange: (open: boolean) => void; topic: TrainingTopicItem }) {
  return (
    <PracticeVnDrawer
      open={open}
      onOpenChange={onOpenChange}
      hideToggles
      teachingMarkdown={topic.teachingMarkdown?.trim() || topic.description?.trim() || ''}
    />
  )
}

function WritingFeedback({ feedback }: { feedback: Record<string, any> }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
      <div className="mb-3 flex items-center gap-2"><Sparkles className="size-4 text-emerald-600" /><p className="text-sm font-semibold">AI 学习反馈</p>{feedback.score != null && <Badge className="ml-auto">{feedback.score}</Badge>}</div>
      <p className="text-sm leading-6 text-muted-foreground">{feedback.summary}</p>
      {(feedback.strengths ?? []).length > 0 && <ul className="mt-3 space-y-1 text-sm">{feedback.strengths.map((item: string) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1 size-3.5 shrink-0 text-emerald-600" />{item}</li>)}</ul>}
      {(feedback.improvements ?? []).length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-400">{feedback.improvements.map((item: string) => <li key={item}>→ {item}</li>)}</ul>}
      {feedback.nextRevisionFocus && <p className="mt-3 rounded-lg bg-background/70 px-3 py-2 text-sm font-medium">下一稿：{feedback.nextRevisionFocus}</p>}
    </div>
  )
}
