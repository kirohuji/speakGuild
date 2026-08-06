import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle2, FilePenLine, Info, Layers, Loader2, MessageCircle, Save, Search, Sparkles, Target, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  const { t } = useTranslation()
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

  const isDialogue = useMemo(
    () => topic?.contentConfig?.writing?.genre === 'dialogue',
    [topic?.contentConfig?.writing?.genre],
  )

  if (loading && (!unit || unit.id !== unitId)) {
    return <MobilePageLoading rows={5} minHeightClassName="min-h-[100dvh]" />
  }

  if (!unitId || !topic || unit?.contentMode !== 'writing') {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <FilePenLine className="size-10 text-muted-foreground/35" />
        <div>
          <p className="font-medium text-foreground">{t('learning.writingNotFound')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('learning.backToPackHint')}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>{t('learning.backToPack')}</Button>
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
      ) : isDialogue ? (
        <DialogueEditor
          topic={topic}
          unitTitle={unit.title}
          onClose={() => setPhase('prepare')}
          onOpenGuide={() => setGuideOpen(true)}
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
  const { t } = useTranslation()
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
          aria-label={t('learning.backToPack')}
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
              <p className="text-sm font-semibold text-foreground">{t('learning.topicDescription')}</p>
            </div>
            {topic.description?.trim() ? (
              <MarkdownRenderer
                content={topic.description}
                className="text-muted-foreground prose-p:my-0 prose-ul:my-1 prose-ol:my-1"
              />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">{t('learning.readGuideFirst')}</p>
            )}
            <Button variant="outline" className="mt-4 min-h-11 w-full" size="default" onClick={onOpenGuide}>
              <BookOpen className="size-4" />{t('learning.teachingGuide')}
            </Button>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t('learning.writingPrep')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('learning.writingPrepHint')}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">
              {t('learning.supportCount', { count: visibleVocabularies.length + visibleChunks.length + visiblePatterns.length })}
            </Badge>
          </div>

          <Tabs defaultValue={visibleVocabularies.length > 0 ? 'vocab' : visibleChunks.length > 0 ? 'chunk' : 'pattern'} className="w-full" data-mobile-route-swipe>
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
              <TabsTrigger value="vocab" className="rounded-md text-xs">{t('learning.vocab')} ({visibleVocabularies.length})</TabsTrigger>
              <TabsTrigger value="chunk" className="rounded-md text-xs">{t('learning.coreChunks')} ({visibleChunks.length})</TabsTrigger>
              <TabsTrigger value="pattern" className="rounded-md text-xs">{t('learning.patterns')} ({visiblePatterns.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="vocab" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                icon={<Search className="size-4" />}
                items={visibleVocabularies.map((item) => ({ title: item.word, subtitle: item.meaning }))}
                tone="cyan"
                emptyText={t('learning.noTopicVocab')}
              />
            </TabsContent>
            <TabsContent value="chunk" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                icon={<Layers className="size-4" />}
                items={visibleChunks.map((item) => ({ title: item.text, subtitle: item.meaning }))}
                tone="emerald"
                emptyText={t('learning.noTopicChunks')}
              />
            </TabsContent>
            <TabsContent value="pattern" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                icon={<Target className="size-4" />}
                items={visiblePatterns.map((item) => ({ title: item.pattern, subtitle: item.meaning }))}
                tone="violet"
                emptyText={t('learning.noTopicPatterns')}
              />
            </TabsContent>
          </Tabs>
        </section>

        {requirements.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t('learning.writingRequirements')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('learning.requirementsHint')}</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[11px]">{t('learning.supportCount', { count: requirements.length })}</Badge>
            </div>
            <div className="space-y-2">
              {requirements.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground">{t('learning.requirementNumber', { number: index + 1 })}</p>
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
        <Card key={item.title} className="border-0 bg-muted/30 shadow-none">
          <CardContent className="flex items-center gap-3 p-3">
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClass)}>{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
              {item.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>}
            </div>
          </CardContent>
        </Card>
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
  const { t } = useTranslation()
  const config = topic.contentConfig?.writing ?? {}
  const editorPrompt = String(config.questionMarkdown ?? '').trim()
  const [text, setText] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const latest = await learningApi.getLatestTopicSession(topic.id)
        if (cancelled) return
        if (latest?.status === 'active') {
          setSessionId(latest.id)
          if (latest.submissions?.[0]?.response?.text) setText(latest.submissions[0].response.text)
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

  const save = async (submit = false) => {
    setSaving(true)
    try {
      if (submit && sessionId) {
        await learningApi.saveTopicSubmission(topic.id, { response: { text }, status: 'submitted' })
        await learningApi.completeTopicSession(topic.id, sessionId)
        const result = await learningApi.analyzeTopicSession(topic.id, sessionId)
        setAnalysisResult(result.analysis ?? null)
        setSubmitted(true)
        toast.success(t('learning.aiEvaluationDone'))
      } else {
        // 仅保存草稿到本地
        toast.success(t('learning.draftSaved'))
      }
    } catch (error: any) { toast.error(error?.message || t('learning.saveFailed')) } finally { setSaving(false) }
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
              <Badge variant="secondary">{t('learning.writingPractice')}</Badge>
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
            {analysisResult && <div className="mt-6"><WritingAnalysisPanel analysis={analysisResult} /></div>}
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

// ─── Dialogue Editor ──────────────────────────────────────

function DialogueEditor({
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
  const { t } = useTranslation()
  const config = topic.contentConfig?.writing ?? {}
  const turns: Array<{ aText: string; hint: string }> = config.turns ?? []

  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [showHint, setShowHint] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // B 输入框聚焦时滚到可视区：底部对齐到键盘上方（而非居中，
  // 因为软键盘在部分浏览器不压缩布局，居中的输入框会落在键盘后面）
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const focusInput = () => {
    window.setTimeout(() => {
      const wrap = inputWrapRef.current
      const scrollRegion = wrap?.closest<HTMLElement>('[data-writing-scroll-region]')
      if (!wrap || !scrollRegion) return
      // --keyboard-height 由 KeyboardProvider 写入（原生 Capacitor / Web visualViewport）
      const keyboardHeight =
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height')) || 0
      const regionRect = scrollRegion.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      // 可视区底部 = 滚动区底部与「键盘上方」取较小者，再留 16px 呼吸
      const safeBottom = Math.min(regionRect.bottom, window.innerHeight - keyboardHeight) - 16
      if (wrapRect.bottom > safeBottom) {
        scrollRegion.scrollBy({ top: wrapRect.bottom - safeBottom, behavior: 'smooth' })
      }
    }, 300)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const latest = await learningApi.getLatestTopicSession(topic.id)
        if (cancelled) return
        if (latest?.status === 'active') {
          setSessionId(latest.id)
          if (latest.submissions?.[0]?.response?.turns) {
            const prevTurns = latest.submissions[0].response.turns as any[]
            const init: Record<number, string> = {}
            prevTurns.forEach((t: any, i: number) => { if (t?.userResponse) init[i] = t.userResponse })
            setResponses(init)
          }
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

  const currentTurn = turns[currentIndex]
  const currentResponse = responses[currentIndex] ?? ''
  const answeredCount = turns.filter((_, i) => (responses[i] ?? '').trim()).length
  const allAnswered = answeredCount === turns.length

  const save = async (submit = false) => {
    setSaving(true)
    try {
      const responseTurns = turns.map((turn, i) => ({
        aText: turn.aText,
        hint: turn.hint,
        userResponse: responses[i] ?? '',
      }))
      if (submit && sessionId) {
        await learningApi.saveTopicSubmission(topic.id, { response: { turns: responseTurns }, status: 'submitted' })
        await learningApi.completeTopicSession(topic.id, sessionId)
        const result = await learningApi.analyzeTopicSession(topic.id, sessionId)
        setAnalysisResult(result.analysis ?? null)
        setSubmitted(true)
        toast.success(t('learning.aiEvaluationDone'))
      } else {
        toast.success(t('learning.draftSaved'))
      }
    } catch (error: any) { toast.error(error?.message || t('learning.saveFailed')) } finally { setSaving(false) }
  }

  const goToTurn = (index: number) => {
    if (index < 0 || index >= turns.length) return
    setCurrentIndex(index)
    setShowHint(false)
  }

  return (
    <div
      data-keyboard-overlay="writing"
      data-writing-dialogue
      className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#fffefb] pt-safe dark:bg-background"
    >
      {/* Header — unified with WritingEditor style */}
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="secondary">{t('learning.conversationWriting')}</Badge>
              <span className="truncate text-xs text-muted-foreground">{topic.difficulty}</span>
            </div>
            <h1 className="break-words text-xl font-bold leading-tight text-foreground">{topic.title}</h1>
            <p className="mt-1.5 truncate text-sm text-muted-foreground">{unitTitle}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onOpenGuide} title={t('learning.viewGuide')}>
              <BookOpen className="size-4" />
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="退出编辑"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-writing-scroll-region>
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pb-8 pt-5 sm:px-8 sm:pt-7">
          {/* Situation banner */}
          {config.situation && (
            <div className="mb-5 rounded-lg bg-sky-50/60 px-3 py-2 text-sm leading-relaxed dark:bg-sky-950/20">
              <span className="font-medium text-sky-600 dark:text-sky-400">📍 </span>
              {config.situation}
            </div>
          )}

          {/* Current turn — conversation style */}
          {currentTurn && (
            <div className="flex-1 py-5">
              {/* A's message bubble */}
              <div className="flex items-start gap-2.5">
                <span className="mt-1 shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">A</span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted/50 px-4 py-3 text-[15px] leading-relaxed">
                  {currentTurn.aText}
                </div>
              </div>

              {/* Collapsible hint */}
              <div className="ml-9 mt-2">
                {!showHint ? (
                  <button
                    type="button"
                    onClick={() => setShowHint(true)}
                    className="flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100/60 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-400"
                  >
                    <Sparkles className="size-3" />查看提示
                  </button>
                ) : (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">💡 写作提示</p>
                      <button
                        type="button"
                        onClick={() => setShowHint(false)}
                        className="text-xs text-amber-500 hover:text-amber-700"
                      >
                        收起
                      </button>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-amber-800 dark:text-amber-300">{currentTurn.hint}</p>
                  </div>
                )}
              </div>

              {/* B's response input */}
              <div ref={inputWrapRef} className="ml-9 mt-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">B</span>
                  <div className="flex-1">
                    <textarea
                      value={currentResponse}
                      onChange={(event) => setResponses({ ...responses, [currentIndex]: event.target.value })}
                      onFocus={focusInput}
                      className="min-h-[140px] w-full resize-none rounded-2xl rounded-tl-md border-0 bg-muted/40 p-4 text-[16px] leading-7 text-foreground outline-none ring-0 placeholder:text-muted-foreground/45 focus:bg-background focus:ring-2 focus:ring-primary/20"
                      placeholder="用英语写下 B 的回复…"
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      spellCheck
                    />
                    {currentResponse.trim() && (
                      <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {currentResponse.trim().split(/\s+/).length} 词
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Turn progress dots */}
          {turns.length > 1 && (
            <div className="mt-4 border-t border-border/50 pt-4">
              <div className="flex items-center justify-center gap-2">
                {turns.map((_, i) => {
                  const isAnswered = (responses[i] ?? '').trim()
                  const isCurrent = i === currentIndex
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToTurn(i)}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                        isCurrent && 'bg-primary text-primary-foreground shadow-sm',
                        !isCurrent && isAnswered && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
                        !isCurrent && !isAnswered && 'bg-muted text-muted-foreground hover:bg-muted/70',
                      )}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {answeredCount}/{turns.length} 轮已填写
              </p>
            </div>
          )}

          {/* AI feedback */}
          {submitted && analysisResult && (
            <div className="mt-6">
              <WritingAnalysisPanel analysis={analysisResult} />
            </div>
          )}
        </div>
      </div>

      {/* Footer — submit feedback only */}
      <footer className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl pb-safe" data-writing-footer>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button size="lg" onClick={() => save(true)} disabled={saving || !allAnswered} className="w-full gap-1.5 rounded-full">
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

function WritingAnalysisPanel({ analysis }: { analysis: Record<string, any> | null }) {
  if (!analysis) return null
  const score = analysis.overallScore ?? 0
  const strengths = (analysis.strengths ?? []) as string[]
  const improvements = (analysis.improvements ?? []) as string[]
  return (
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2"><Sparkles className="size-4 text-primary" /><p className="text-sm font-semibold">AI 写作评估</p>{score > 0 && <Badge className="ml-auto">{score}</Badge>}</div>
      {analysis.summary && <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>}
      {strengths.length > 0 && <ul className="mt-3 space-y-1 text-sm">{strengths.map((item: string) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1 size-3.5 shrink-0 text-emerald-600" />{item}</li>)}</ul>}
      {improvements.length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-400">{improvements.map((item: string) => <li key={item}>→ {item}</li>)}</ul>}
      {analysis.nextStepSuggestion && <p className="mt-3 rounded-lg bg-background/70 px-3 py-2 text-sm font-medium">下一步：{analysis.nextStepSuggestion}</p>}
    </div>
  )
}
