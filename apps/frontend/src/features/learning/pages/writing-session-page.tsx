import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, BookText, BookmarkPlus, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FilePenLine, Info, Languages, ListMusic, Loader2, MessageCircle, MessageSquareText, Save, Search, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { cn } from '@/lib/cn'
import { extractCoreUsage } from '@/lib/markdown-utils'
import { useLayoutStore } from '@/stores/layout.store'
import { useLearningStore } from '@/stores/learning.store'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { LearningInsightDialog, type LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import { SaveToNotebookDrawer } from '@/features/expression/components/save-to-notebook-drawer'
import { learningContentRepository } from '@/lib/offline'
import { learningApi, type ChunkItem, type SentencePattern, type TrainingTopicItem, type VocabItem } from '../api/learning-api'
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
  const isTranslation = useMemo(
    () => topic?.contentConfig?.writing?.genre === 'translation',
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
      ) : isTranslation ? (
        <TranslationEditor
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
  const [insightOpen, setInsightOpen] = useState(false)
  const [insightKind, setInsightKind] = useState<WritingKnowledgeItem['kind']>('vocab')
  const [insightIndex, setInsightIndex] = useState(0)
  const [saveDrawerOpen, setSaveDrawerOpen] = useState(false)
  const [pendingSave, setPendingSave] = useState<WritingKnowledgeItem | null>(null)
  const [collectedTexts, setCollectedTexts] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      learningContentRepository.listExpressionTexts('word'),
      learningContentRepository.listExpressionTexts('chunk'),
      learningContentRepository.listExpressionTexts('pattern'),
    ]).then((groups) => {
      if (!cancelled) setCollectedTexts(new Set(groups.flat()))
    })
    return () => { cancelled = true }
  }, [])

  const insightItems = useMemo<Record<WritingKnowledgeItem['kind'], LearningInsightItem[]>>(() => ({
    vocab: visibleVocabularies.map((item) => ({ ...item, kind: 'word' as const, sceneName: unitTitle })),
    chunk: visibleChunks.map((item) => ({ ...item, kind: 'chunk' as const, sceneName: unitTitle })),
    pattern: visiblePatterns.map((item, index) => ({
      ...item,
      id: item.id ?? `pattern-${index}`,
      kind: 'pattern' as const,
      sceneName: unitTitle,
    })),
  }), [unitTitle, visibleChunks, visiblePatterns, visibleVocabularies])

  const openInsight = (item: WritingKnowledgeItem) => {
    const items = insightItems[item.kind]
    setInsightKind(item.kind)
    setInsightIndex(Math.max(0, items.findIndex((candidate) => candidate.id === item.id)))
    setInsightOpen(true)
  }

  const requestSave = (item: WritingKnowledgeItem) => {
    setPendingSave(item)
    setSaveDrawerOpen(true)
  }

  const savePendingToNotebooks = async (notebookIds: string[]) => {
    if (!pendingSave) return
    const isVocab = pendingSave.kind === 'vocab'
    const text = isVocab ? pendingSave.word : pendingSave.kind === 'chunk' ? pendingSave.text : pendingSave.pattern
    await learningContentRepository.saveExpressionEntryAndSync({
      kind: isVocab ? 'word' : pendingSave.kind,
      text,
      meaning: pendingSave.meaning,
      sceneName: unitTitle,
      contentSnapshot: pendingSave,
      sourceType: isVocab ? 'vocabulary' : pendingSave.kind === 'chunk' ? 'chunk' : 'sentence_pattern',
      sourceId: pendingSave.id,
      notebookIds,
    })
    setCollectedTexts((current) => new Set([...current, text]))
    setPendingSave(null)
    toast.success(t('learning.addedToLibrary'))
  }

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
                items={visibleVocabularies.map((item) => ({ ...item, kind: 'vocab' as const, title: item.word, subtitle: item.meaning }))}
                emptyText={t('learning.noTopicVocab')}
                collectedTexts={collectedTexts}
                onInspect={openInsight}
                onCollect={requestSave}
              />
            </TabsContent>
            <TabsContent value="chunk" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                items={visibleChunks.map((item) => ({ ...item, kind: 'chunk' as const, title: item.text, subtitle: item.meaning }))}
                emptyText={t('learning.noTopicChunks')}
                collectedTexts={collectedTexts}
                onInspect={openInsight}
                onCollect={requestSave}
              />
            </TabsContent>
            <TabsContent value="pattern" className="mt-3" data-mobile-gesture-allow>
              <WritingKnowledgeList
                items={visiblePatterns.map((item, index) => ({ ...item, kind: 'pattern' as const, id: item.id ?? `pattern-${index}`, title: item.pattern, subtitle: item.meaning }))}
                emptyText={t('learning.noTopicPatterns')}
                collectedTexts={collectedTexts}
                onInspect={openInsight}
                onCollect={requestSave}
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
          questionMarkdown={config.genre === 'translation' ? config.sourceText : config.questionMarkdown}
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
      <LearningInsightDialog
        items={insightItems[insightKind]}
        index={Math.min(insightIndex, Math.max(insightItems[insightKind].length - 1, 0))}
        open={insightOpen}
        onOpenChange={setInsightOpen}
        onIndexChange={setInsightIndex}
      />
      <SaveToNotebookDrawer
        open={saveDrawerOpen}
        onOpenChange={setSaveDrawerOpen}
        onSave={savePendingToNotebooks}
      />
    </div>
  )
}

type WritingKnowledgeItem =
  | (NonNullable<TrainingTopicItem['vocabularies']>[number] & { kind: 'vocab'; title: string; subtitle: string })
  | (TrainingTopicItem['activeChunks'][number] & { kind: 'chunk'; title: string; subtitle: string })
  | (NonNullable<TrainingTopicItem['sentencePatterns']>[number] & { kind: 'pattern'; id: string; title: string; subtitle: string })

function WritingKnowledgeList({
  items,
  emptyText,
  collectedTexts,
  onInspect,
  onCollect,
}: {
  items: WritingKnowledgeItem[]
  emptyText: string
  collectedTexts: Set<string>
  onInspect: (item: WritingKnowledgeItem) => void
  onCollect: (item: WritingKnowledgeItem) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="rounded-lg bg-muted/25 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id} className={cn('border-0 bg-muted/30 shadow-none transition-colors', expandedId === item.id && 'bg-primary/[0.06]')}>
          <CardContent className="p-0">
            <button
              type="button"
              className="flex w-full items-center gap-3 p-3 text-left"
              onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
              aria-expanded={expandedId === item.id}
            >
              <WritingKnowledgeIcon kind={item.kind} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  {item.kind === 'vocab' && item.partOfSpeech && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{item.partOfSpeech}</Badge>}
                  {item.kind === 'pattern' && item.difficulty && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{item.difficulty}</Badge>}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expandedId === item.id && 'rotate-90')} />
            </button>
            {expandedId === item.id && (
              <WritingKnowledgeDetail
                item={item}
                collected={collectedTexts.has(item.kind === 'vocab' ? item.word : item.kind === 'chunk' ? item.text : item.pattern)}
                onInspect={() => onInspect(item)}
                onCollect={() => onCollect(item)}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WritingKnowledgeIcon({ kind }: { kind: WritingKnowledgeItem['kind'] }) {
  const styles = {
    vocab: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    chunk: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    pattern: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  }[kind]
  const Icon = kind === 'vocab' ? BookText : kind === 'chunk' ? MessageSquareText : Search
  return <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', styles)}><Icon className="size-4" /></span>
}

function WritingKnowledgeDetail({
  item,
  collected,
  onInspect,
  onCollect,
}: {
  item: WritingKnowledgeItem
  collected: boolean
  onInspect: () => void
  onCollect: () => void
}) {
  if (item.kind === 'pattern') {
    return (
      <div className="px-3 pb-3 pt-2">
        {item.example && (
          <div className="mb-3 rounded-md bg-muted/45 p-2.5">
            <p className="text-xs font-medium leading-5 text-foreground">{item.example}</p>
            {item.topicTitle && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.topicTitle}</p>}
          </div>
        )}
        {item.slots.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {item.slots.map((slot) => <Badge key={slot} variant="secondary" className="rounded-full px-2 text-[10px]">{slot}</Badge>)}
          </div>
        )}
        <WritingKnowledgeActions collected={collected} onInspect={onInspect} onCollect={onCollect} />
      </div>
    )
  }

  const description = item.description?.trim()
  const fallbackUsage = item.kind === 'vocab' ? item.definitionEn?.trim() : null
  const example = item.examples?.[0]

  return (
    <div className="px-3 pb-3 pt-2">
      {description ? (
        <div className="mb-3 line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
          <MarkdownContent content={extractCoreUsage(description)} />
        </div>
      ) : fallbackUsage ? (
        <p className="mb-3 text-xs leading-5 text-muted-foreground">{fallbackUsage}</p>
      ) : null}
      {example && (
        <div className="mb-3 rounded-md bg-muted/45 p-2.5">
          <p className="text-xs font-medium leading-5 text-foreground">{example.en}</p>
          {example.zh && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{example.zh}</p>}
          {example.note && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{example.note}</p>}
        </div>
      )}
      <WritingKnowledgeActions collected={collected} onInspect={onInspect} onCollect={onCollect} />
    </div>
  )
}

function WritingKnowledgeActions({
  collected,
  onInspect,
  onCollect,
}: {
  collected: boolean
  onInspect: () => void
  onCollect: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={onInspect}>
        <Search className="size-3.5" /> {t('learning.view')}
      </Button>
      <Button size="sm" variant={collected ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" onClick={onCollect}>
        <BookmarkPlus className="size-3.5" /> {collected ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
      </Button>
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
      className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-background pt-safe"
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

// ─── Translation Editor ───────────────────────────────────

type TranslationSegment = { id: string; source: string; reference?: string; hint?: string }

function TranslationEditor({
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
  const direction = config.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en'
  const scope = config.scope === 'article' ? 'article' : 'sentence'
  const segments: TranslationSegment[] = useMemo(() => {
    const configured = Array.isArray(config.segments) ? config.segments : []
    if (configured.length) return configured.map((segment: any, index: number) => ({ id: String(segment.id || `s${index + 1}`), source: String(segment.source ?? ''), reference: String(segment.reference ?? ''), hint: String(segment.hint ?? '') }))
    const source = String(config.sourceText ?? '').trim()
    return source ? [{ id: 's1', source, reference: '', hint: '' }] : []
  }, [config.segments, config.sourceText])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [hintOpen, setHintOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const latest = await learningApi.getLatestTopicSession(topic.id)
        if (cancelled) return
        if (latest?.status === 'active') {
          setSessionId(latest.id)
          const saved = latest.submissions?.[0]?.response?.answers
          if (Array.isArray(saved)) setAnswers(Object.fromEntries(saved.map((item: any) => [String(item.segmentId), String(item.text ?? '')])))
        } else if (latest?.status === 'analyzed') {
          setAnalysisResult(latest.analysisResult ?? null)
          const created = await learningApi.startTopicSession(topic.id)
          if (!cancelled) setSessionId(created.id)
        } else {
          const created = await learningApi.startTopicSession(topic.id)
          if (!cancelled) setSessionId(created.id)
        }
      } catch { /* keep the editor usable while offline */ }
    })()
    return () => { cancelled = true }
  }, [topic.id])

  const answeredCount = segments.filter((segment) => (answers[segment.id] ?? '').trim()).length
  const active = segments[activeIndex]
  const save = async (submit = false) => {
    const response = {
      direction,
      scope,
      answers: segments.map((segment) => ({ segmentId: segment.id, text: answers[segment.id] ?? '' })),
    }
    if (!submit && !answeredCount) return
    setSaving(true)
    try {
      if (!submit) {
        if (!sessionId) throw new Error('练习会话尚未准备好，请稍后重试')
        await learningApi.saveTopicSubmission(topic.id, { response, status: 'draft', sessionId })
        toast.success(t('learning.draftSaved'))
        return
      }
      if (!sessionId) throw new Error('练习会话尚未准备好，请稍后重试')
      await learningApi.saveTopicSubmission(topic.id, { response, status: 'submitted', sessionId })
      await learningApi.completeTopicSession(topic.id, sessionId)
      const result = await learningApi.analyzeTopicSession(topic.id, sessionId)
      setAnalysisResult(result.analysis ?? null)
      toast.success(t('learning.aiEvaluationDone'))
    } catch (error: any) {
      toast.error(error?.message || t('learning.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const selectSegment = (index: number) => {
    setActiveIndex(index)
    setHintOpen(false)
    setListOpen(false)
  }

  const sourceLanguage = direction === 'zh_to_en' ? '中文原文' : 'English source'
  const answerLanguage = direction === 'zh_to_en' ? 'Write in English' : '用中文翻译'

  return (
    <div data-keyboard-overlay="writing" className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-background pt-safe">
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-4 pb-2.5 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Languages className="size-4" /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{direction === 'zh_to_en' ? '中译英' : '英译中'}</Badge><span className="truncate text-[11px] text-muted-foreground">{topic.difficulty}</span></div><h1 className="truncate text-base font-bold leading-snug text-foreground">{config.sourceTitle || topic.title}</h1><p className="truncate text-[11px] text-muted-foreground">{unitTitle}</p></div>
          <div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={onOpenGuide} title={t('learning.viewGuide')}><BookOpen className="size-4" /></Button><button type="button" onClick={onClose} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground" aria-label="退出翻译"><X className="size-3.5" /></button></div>
        </div>
      </header>

      {analysisResult ? (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto max-w-3xl px-4 py-5 pb-safe"><WritingAnalysisPanel analysis={analysisResult} /><Button variant="outline" className="mt-5 w-full" onClick={onClose}>返回学习包</Button></div></main>
      ) : (
        <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(15rem,40dvh)]" data-writing-scroll-region>
          <section className="min-h-0 overflow-y-auto overscroll-contain" aria-label={sourceLanguage}>
            <article className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-6 sm:px-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{sourceLanguage}</p>
              <p className="text-[16px] leading-8 text-foreground">{active?.source || '暂无原文内容'}</p>
            </article>
          </section>

          <section className="flex min-h-0 flex-col border-t border-border/70 bg-background shadow-[0_-8px_20px_rgba(0,0,0,0.04)]" aria-label={answerLanguage}>
            <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2">
              <Button variant="outline" size="sm" className="h-8 px-2.5" disabled={activeIndex === 0} onClick={() => selectSegment(activeIndex - 1)}><ChevronLeft className="size-4" />上一{scope === 'article' ? '段' : '句'}</Button>
              <span className="min-w-0 flex-1 truncate text-center text-xs tabular-nums text-muted-foreground">{answeredCount}/{segments.length} 已完成</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {activeIndex < segments.length - 1 ? <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => selectSegment(activeIndex + 1)}>下一{scope === 'article' ? '段' : '句'}<ChevronRight className="size-4" /></Button> : <Button size="sm" className="h-8 px-3" onClick={() => save(true)} disabled={saving || !sessionId || answeredCount !== segments.length || !segments.length}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}提交</Button>}
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setListOpen(true)} title="段落列表"><ListMusic className="size-4" /></Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto w-full max-w-3xl px-5 py-4 sm:px-8"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{answerLanguage}</p>{active?.hint && <Button type="button" size="sm" variant="ghost" onClick={() => setHintOpen((current) => !current)} className="shrink-0 gap-1.5 px-2 text-primary"><Sparkles className="size-3.5" />提示</Button>}</div>{hintOpen && active?.hint && <div className="mb-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm leading-6 text-muted-foreground">{active.hint}</div>}<textarea value={active ? answers[active.id] ?? '' : ''} onChange={(event) => active && setAnswers((current) => ({ ...current, [active.id]: event.target.value }))} className="min-h-[132px] w-full resize-y bg-transparent p-0 text-[16px] leading-8 text-foreground outline-none placeholder:text-muted-foreground/45 focus:ring-0" placeholder={direction === 'zh_to_en' ? 'Write your English translation here…' : '在这里写下中文译文…'} autoCapitalize="sentences" autoCorrect="on" spellCheck={direction === 'zh_to_en'} /></div></div>
          </section>
        </main>
      )}

      <Drawer open={listOpen} onOpenChange={setListOpen}>
        <DrawerContent className="h-[100dvh] rounded-none pt-safe !z-[10001]" overlayClassName="!z-[10001]"><div className="flex items-center justify-between px-5 py-3"><DrawerTitle className="text-lg">{scope === 'article' ? '段落列表' : '句子列表'}</DrawerTitle><button type="button" onClick={() => setListOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><ChevronDown className="size-5" /></button></div><div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8"><div className="space-y-1">{segments.map((segment, index) => <button key={segment.id} type="button" onClick={() => selectSegment(index)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors', activeIndex === index ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted')}><span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', activeIndex === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{index + 1}</span><p className="line-clamp-2 min-w-0 flex-1 text-sm leading-5">{segment.source}</p>{(answers[segment.id] ?? '').trim() && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}</button>)}</div></div></DrawerContent>
      </Drawer>
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
      className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-background pt-safe"
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
  const segmentFeedback = (analysis.segmentFeedback ?? []) as Array<{ segmentId?: string; score?: number; comment?: string; suggestion?: string; acceptableExpression?: string }>
  return (
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2"><Sparkles className="size-4 text-primary" /><p className="text-sm font-semibold">AI 写作评估</p>{score > 0 && <Badge className="ml-auto">{score}</Badge>}</div>
      {analysis.summary && <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>}
      {segmentFeedback.length > 0 && <div className="mt-4 space-y-2">{segmentFeedback.map((item, index) => <div key={item.segmentId ?? index} className="rounded-xl bg-background/70 p-3"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-foreground">第 {index + 1} 段</span>{typeof item.score === 'number' && <Badge variant="secondary" className="text-[10px]">{item.score}</Badge>}</div>{item.comment && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.comment}</p>}{item.suggestion && <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-400">建议：{item.suggestion}</p>}{item.acceptableExpression && <p className="mt-1 text-xs leading-5 text-primary">可参考：{item.acceptableExpression}</p>}</div>)}</div>}
      {strengths.length > 0 && <ul className="mt-3 space-y-1 text-sm">{strengths.map((item: string) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1 size-3.5 shrink-0 text-emerald-600" />{item}</li>)}</ul>}
      {improvements.length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-400">{improvements.map((item: string) => <li key={item}>→ {item}</li>)}</ul>}
      {analysis.nextStepSuggestion && <p className="mt-3 rounded-lg bg-background/70 px-3 py-2 text-sm font-medium">下一步：{analysis.nextStepSuggestion}</p>}
    </div>
  )
}
