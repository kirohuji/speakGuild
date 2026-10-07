import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, BookText, BookmarkPlus, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FilePenLine, Info, Languages, Lightbulb, ListMusic, Loader2, MessageCircle, MessageSquareText, RotateCcw, Save, Search, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
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
import { type ChunkItem, type SentencePattern, type TrainingTopicItem, type VocabItem } from '../api/learning-api'
import { withoutWritingRequirements, WritingTaskCard } from '../components/writing-task-card'
import { useTopicSession, type TopicSessionReviewSnapshot } from '../hooks/use-topic-session'
import { Switch } from '@/components/ui/switch'

type WritingPhase = 'prepare' | 'write'

/** 历史练习回看：按 genre 挂载只读练习壳 + Switch，隐藏重试。 */
export function WritingSessionReview({
  topic,
  unitTitle,
  review,
  onClose,
}: {
  topic: TrainingTopicItem
  unitTitle: string
  review: TopicSessionReviewSnapshot
  onClose: () => void
}) {
  const genre = topic.contentConfig?.writing?.genre
  const shared = { topic, unitTitle, onClose, review, hideRetry: true as const }
  if (genre === 'dialogue') return <DialogueEditor {...shared} />
  if (genre === 'translation') return <TranslationEditor {...shared} />
  return <WritingEditor {...shared} />
}

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

        <WritingTaskCard
          questionMarkdown={config.genre === 'translation' ? undefined : config.questionMarkdown}
          promptEn={topic.promptEn}
          promptZh={topic.promptZh}
          requirements={requirements}
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

/**
 * textarea 没有可靠的原生 caret 屏幕坐标 API，只能用镜像 div 量一次位置。
 * 这不是「画假光标」，只是测量；真光标仍是系统的。
 * 性能：debounce 300ms + 仅 focus/click 触发，单次离屏 DOM 测量后立即移除。
 */
const TEXTAREA_CARET_MIRROR_PROPS = [
  'direction', 'boxSizing', 'width',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
  'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
  'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize',
  'whiteSpace', 'wordBreak', 'overflowWrap',
] as const

function getTextareaCaretCoordinates(textarea: HTMLTextAreaElement, position: number) {
  const computed = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  const style = mirror.style
  style.position = 'absolute'
  style.visibility = 'hidden'
  style.overflow = 'hidden'
  style.top = '0'
  style.left = '-9999px'
  for (const prop of TEXTAREA_CARET_MIRROR_PROPS) {
    style[prop as any] = (computed as any)[prop]
  }
  // 宽度对齐可视内容区；高度必须 auto，否则长文测量会被裁切导致 top 偏小、越滚越高。
  style.width = `${textarea.clientWidth}px`
  style.height = 'auto'
  style.whiteSpace = 'pre-wrap'
  style.overflowWrap = 'break-word'

  mirror.textContent = textarea.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = '|'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const top = marker.offsetTop + (Number.parseFloat(computed.borderTopWidth) || 0)
  const height = marker.offsetHeight || Number.parseFloat(computed.fontSize) || 17
  document.body.removeChild(mirror)
  return { top, height }
}

function resolveWritingTextarea(target: HTMLElement | null) {
  if (!target) return null
  if (target instanceof HTMLTextAreaElement) return target
  return target.querySelector('textarea')
}

let writingCaretScrollTimer: number | undefined

/**
 * 键盘就绪后把光标行滚进安全区。
 * 普通写作必须让 textarea 自己滚（定高 + overflow），不能靠外层被长文撑开，
 * 否则光标已在「盒子」里会早退，表现为点底部无反应。
 */
function scheduleWritingInputSafeScroll(
  target: HTMLElement | null,
  scrollRegionSelector = '[data-writing-scroll-region]',
) {
  window.clearTimeout(writingCaretScrollTimer)

  const run = (attempt: number) => {
    const textarea = resolveWritingTextarea(target)
    const anchor = textarea ?? target
    const scrollRegion = anchor?.closest<HTMLElement>(scrollRegionSelector)
    if (!anchor || !scrollRegion) return

    const keyboardHeight =
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height')) || 0
    // 键盘已打开但高度尚未写入时再等一轮，避免按 0 高度误判「已在安全区」。
    if (document.body.dataset.keyboardOpen === 'true' && keyboardHeight < 1 && attempt < 2) {
      writingCaretScrollTimer = window.setTimeout(() => run(attempt + 1), 180)
      return
    }

    const regionRect = scrollRegion.getBoundingClientRect()
    const safeBottom = Math.min(regionRect.bottom, window.innerHeight - keyboardHeight) - 12
    const safeTop = regionRect.top + 12

    if (textarea) {
      const caret = getTextareaCaretCoordinates(textarea, textarea.selectionEnd)
      const textareaRect = textarea.getBoundingClientRect()
      const caretInViewTop = caret.top - textarea.scrollTop
      const caretScreenTop = textareaRect.top + caretInViewTop
      const caretScreenBottom = caretScreenTop + caret.height
      const maxInner = Math.max(0, textarea.scrollHeight - textarea.clientHeight)

      // textarea 可视底边还要被键盘裁切
      const clippedBottomInView = Math.min(textarea.clientHeight, safeBottom - textareaRect.top) - 8
      const clippedTopInView = Math.max(0, safeTop - textareaRect.top) + 8

      const outOfScreen = caretScreenBottom > safeBottom + 1 || caretScreenTop < safeTop - 1
      const outOfTextareaBand =
        maxInner > 0 && (caretInViewTop > clippedBottomInView || caretInViewTop < clippedTopInView)

      if (!outOfScreen && !outOfTextareaBand) return

      // 直接按内容坐标对齐：把光标行放到裁切可视区中部偏下，比累加 delta 更稳。
      if (maxInner > 0) {
        const avail = Math.max(caret.height + 24, clippedBottomInView - clippedTopInView)
        const targetInView = clippedTopInView + Math.min(avail * 0.62, avail - caret.height - 8)
        textarea.scrollTop = Math.max(0, Math.min(maxInner, caret.top - targetInView))
        return
      }

      // 外层兜底（短气泡 / 尚未定高时）
      if (caretScreenBottom > safeBottom) {
        scrollRegion.scrollBy({ top: caretScreenBottom - safeBottom, behavior: 'auto' })
      } else if (caretScreenTop < safeTop) {
        scrollRegion.scrollBy({ top: caretScreenTop - safeTop, behavior: 'auto' })
      }
      return
    }

    const targetRect = anchor.getBoundingClientRect()
    if (targetRect.bottom > safeBottom) {
      scrollRegion.scrollBy({ top: targetRect.bottom - safeBottom, behavior: 'auto' })
    }
  }

  writingCaretScrollTimer = window.setTimeout(() => run(0), 320)
}

function WritingEditor({
  topic,
  unitTitle,
  onClose,
  onOpenGuide,
  review,
  hideRetry = false,
}: {
  topic: TrainingTopicItem
  unitTitle: string
  onClose: () => void
  onOpenGuide?: () => void
  review?: TopicSessionReviewSnapshot
  hideRetry?: boolean
}) {
  const { t } = useTranslation()
  const config = topic.contentConfig?.writing ?? {}
  const editorPrompt = withoutWritingRequirements(String(config.questionMarkdown ?? ''))
  const requirements: string[] = config.requirements ?? []
  const [text, setText] = useState('')
  const [view, setView] = useState<'editor' | 'analysis'>(review ? 'analysis' : 'editor')
  const [taskOpen, setTaskOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const restore = useCallback((response: Record<string, unknown>) => setText(String(response.text ?? '')), [])
  const session = useTopicSession(topic.id, restore, { review })
  const response = useMemo(() => ({ text }), [text])

  useEffect(() => {
    if (session.readOnly) setView('analysis')
  }, [session.readOnly])

  useEffect(() => {
    if (!session.sessionId || session.readOnly) return
    const timer = window.setTimeout(() => { void session.saveDraft(response) }, 600)
    return () => window.clearTimeout(timer)
  }, [response, session])

  const save = async (submit = false) => {
    setSaving(true)
    try {
      if (submit) {
        await session.submit(response)
        setView('analysis')
        toast.success(t('learning.aiEvaluationDone'))
      } else {
        await session.saveDraft(response)
        toast.success(t('learning.draftSaved'))
      }
    } catch (error: any) { toast.error(error?.message || t('learning.saveFailed')) } finally { setSaving(false) }
  }

  // focus 时 selection 可能未落到点击处，兼听 click；不听 select，避免打字时反复测量滚动。
  const scheduleCaretScroll = () => {
    scheduleWritingInputSafeScroll(textareaRef.current)
  }

  return (
    <div
      data-keyboard-overlay="writing"
      data-writing-compose
      className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-background pt-safe"
    >
      <header data-writing-compose-header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-4 pb-2.5 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FilePenLine className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{t('learning.writingPractice')}</Badge>
              <span data-writing-compose-meta className="truncate text-[11px] text-muted-foreground">{topic.difficulty}</span>
            </div>
            <h1 className="truncate text-base font-bold leading-snug text-foreground">{topic.title}</h1>
            <p data-writing-compose-meta className="truncate text-[11px] text-muted-foreground">{unitTitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {session.readOnly && <WritingReviewControls view={view} onViewChange={setView} hideRetry={hideRetry} onRetry={() => void session.startNewAttempt().then(() => { setText(''); setView('editor') })} />}
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setTaskOpen(true)} aria-label={t('learning.writingTaskTitle')} title={t('learning.writingTaskTitle')}>
              <FilePenLine className="size-4" />
            </Button>
            {onOpenGuide && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={onOpenGuide} aria-label={t('learning.guide')} title={t('learning.guide')}>
                <BookOpen className="size-4" />
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label={t('learning.exitEdit')}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {session.readOnly && view === 'analysis' ? (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto max-w-2xl px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"><WritingAnalysisPanel analysis={session.analysis} /></div></main>
      ) : (
      // 定高 flex 链 + textarea 内滚（与互译一致）。若 min-h-full 被长文撑开，外层滚、内层 maxInner=0，底部点击会早退无反应。
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-writing-scroll-region>
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
          {(config.referenceExplanation || config.referenceAnswer) && <button type="button" onClick={() => setSupportOpen(true)} className="mt-3 w-fit shrink-0 text-xs font-medium text-primary transition-opacity hover:opacity-70">{t('learning.seeWritingSupport')}</button>}

          <div className="flex min-h-0 flex-1 flex-col pt-3" data-writing-editor>
            <textarea
              ref={textareaRef}
              data-writing-caret-scroll
              value={text}
              onChange={(event) => setText(event.target.value)}
              readOnly={session.readOnly}
              onFocus={scheduleCaretScroll}
              onClick={scheduleCaretScroll}
              className="m-0 min-h-0 w-full flex-1 resize-none overflow-y-auto overscroll-contain appearance-none rounded-none border-0 bg-transparent p-0 text-[17px] leading-8 text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground/45 focus:border-0 focus:outline-none focus:ring-0"
              placeholder={t('learning.writingPlaceholder')}
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck
            />
          </div>
        </div>
      </div>
      )}

      <footer className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl pb-safe" data-writing-footer>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p data-writing-footer-meta className="truncate text-xs text-muted-foreground">{({ message: t('learning.genreMessage'), journal: t('learning.genreJournal'), email: t('learning.genreEmail'), paragraph: t('learning.genreParagraph'), essay: t('learning.genreEssay'), dialogue: t('learning.genreDialogue'), translation: t('learning.genreTranslation') } as Record<string, string>)[config.genre ?? ''] || config.genre || t('learning.freeWriting')}</p>
            <p data-writing-footer-count className={cn('mt-0.5 text-xs tabular-nums text-muted-foreground', config.minWords && wordCount < config.minWords && 'text-amber-600')}>
              {config.minWords
                ? t('learning.wordCountWithTarget', { count: wordCount, min: config.minWords, max: config.maxWords ?? '∞' })
                : t('learning.wordCount', { count: wordCount })}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving || session.readOnly || !text.trim() || !session.ready} className="shrink-0 gap-1.5" aria-label={t('learning.save')}>
            <Save className="size-4" /><span data-writing-footer-label>{t('learning.save')}</span>
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={saving || session.readOnly || !text.trim() || !session.sessionId} className="shrink-0 gap-1.5 rounded-full px-4" aria-label={t('learning.submitFeedback')}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}<span data-writing-footer-label>{t('learning.submitFeedback')}</span>
          </Button>
        </div>
      </footer>
      <WritingSupportDrawer open={supportOpen} onOpenChange={setSupportOpen} explanation={String(config.referenceExplanation ?? '')} referenceAnswer={String(config.referenceAnswer ?? '')} hasAttempt={wordCount >= 3} />
      <Drawer open={taskOpen} onOpenChange={setTaskOpen}>
        <DrawerContent className="max-h-[82dvh] rounded-t-[28px] border-0 bg-background !z-[10001]" overlayClassName="!z-[10001]">
          <DrawerHeader className="px-5 pb-2 pt-5"><DrawerTitle>{t('learning.writingTaskTitle')}</DrawerTitle></DrawerHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <MarkdownRenderer content={editorPrompt} className="text-[15px] leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-headings:text-foreground prose-p:my-3 prose-p:leading-7 prose-li:my-1 prose-img:my-4 prose-img:w-full prose-img:object-contain" />
            {requirements.length > 0 && <section className="mt-6 border-t border-border/60 pt-5"><h2 className="text-base font-semibold text-foreground">{t('learning.writingRequirements')}</h2><div className="mt-3 space-y-2">{requirements.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">{t('learning.requirementNumber', { number: index + 1 })}</p><p className="mt-0.5 text-sm font-medium leading-5 text-foreground">{item}</p></div></div>)}</div></section>}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// ─── Translation Editor ───────────────────────────────────

type TranslationSegment = { id: string; source: string; reference?: string; hint?: string; referenceExplanation?: string }

function TranslationEditor({
  topic,
  unitTitle,
  onClose,
  onOpenGuide,
  review,
  hideRetry = false,
}: {
  topic: TrainingTopicItem
  unitTitle: string
  onClose: () => void
  onOpenGuide?: () => void
  review?: TopicSessionReviewSnapshot
  hideRetry?: boolean
}) {
  const { t } = useTranslation()
  const config = topic.contentConfig?.writing ?? {}
  const direction = config.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en'
  const scope = config.scope === 'article' ? 'article' : 'sentence'
  const segments: TranslationSegment[] = useMemo(() => {
    const configured = Array.isArray(config.segments) ? config.segments : []
    if (configured.length) return configured.map((segment: any, index: number) => ({ id: String(segment.id || `s${index + 1}`), source: String(segment.source ?? ''), reference: String(segment.reference ?? ''), hint: String(segment.hint ?? ''), referenceExplanation: String(segment.referenceExplanation ?? '') }))
    const source = String(config.sourceText ?? '').trim()
    return source ? [{ id: 's1', source, reference: '', hint: '', referenceExplanation: '' }] : []
  }, [config.segments, config.sourceText])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [hintOpen, setHintOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'editor' | 'analysis'>(review ? 'analysis' : 'editor')
  const translationInputRef = useRef<HTMLTextAreaElement>(null)
  const restore = useCallback((saved: Record<string, unknown>) => {
    const values = saved.answers
    if (Array.isArray(values)) setAnswers(Object.fromEntries(values.map((item: any) => [String(item.segmentId), String(item.text ?? '')])))
  }, [])
  const session = useTopicSession(topic.id, restore, { review })

  useEffect(() => {
    if (session.readOnly) setView('analysis')
  }, [session.readOnly])

  const answeredCount = segments.filter((segment) => (answers[segment.id] ?? '').trim()).length
  const active = segments[activeIndex]
  const response = useMemo(() => ({ direction, scope, answers: segments.map((segment) => ({ segmentId: segment.id, text: answers[segment.id] ?? '' })) }), [answers, direction, scope, segments])
  useEffect(() => {
    if (!session.sessionId || session.readOnly || !answeredCount) return
    const timer = window.setTimeout(() => { void session.saveDraft(response) }, 600)
    return () => window.clearTimeout(timer)
  }, [answeredCount, response, session])
  const save = async (submit = false) => {
    if (!submit && !answeredCount) return
    setSaving(true)
    try {
      if (!submit) {
        await session.saveDraft(response)
        toast.success(t('learning.draftSaved'))
        return
      }
      await session.submit(response)
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

  // CSS 负责缩壳与分区；长译文按光标滚进安全区（兼听 click；不听 select，避免打字抖动）。
  const scheduleTranslationCaretScroll = () => {
    scheduleWritingInputSafeScroll(translationInputRef.current, '[data-writing-translation-answer-scroll]')
  }

  const sourceLanguage = direction === 'zh_to_en' ? t('learning.sourceZh') : t('learning.sourceEn')
  const answerLanguage = direction === 'zh_to_en' ? t('learning.answerWriteEn') : t('learning.answerWriteZh')

  return (
    <div data-keyboard-overlay="writing" data-writing-translation className="fixed inset-0 z-[10000] flex h-[100dvh] w-screen flex-col overflow-hidden bg-background pt-safe">
      <header data-writing-translation-header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-4 pb-2.5 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Languages className="size-4" /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{direction === 'zh_to_en' ? t('learning.zhToEnBadge') : t('learning.enToZhBadge')}</Badge><span data-writing-translation-meta className="truncate text-[11px] text-muted-foreground">{topic.difficulty}</span></div><h1 className="truncate text-base font-bold leading-snug text-foreground">{config.sourceTitle || topic.title}</h1><p data-writing-translation-meta className="truncate text-[11px] text-muted-foreground">{unitTitle}</p></div>
          <div className="flex items-center gap-1">
            {session.readOnly && <WritingReviewControls view={view} onViewChange={setView} hideRetry={hideRetry} onRetry={() => void session.startNewAttempt().then(() => { setAnswers({}); setActiveIndex(0); setView('editor') })} />}
            {onOpenGuide && <Button type="button" variant="ghost" size="icon-sm" onClick={onOpenGuide} aria-label={t('learning.viewGuide')} title={t('learning.viewGuide')}><BookOpen className="size-4" /></Button>}
            <button type="button" onClick={onClose} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground" aria-label={t('learning.exitTranslation')}><X className="size-3.5" /></button>
          </div>
        </div>
      </header>

      {session.readOnly && view === 'analysis' ? (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto max-w-3xl px-4 py-5 pb-safe"><WritingAnalysisPanel analysis={session.analysis} /></div></main>
      ) : (
        <main data-writing-translation-main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(20rem,55dvh)]" data-writing-scroll-region>
          <section data-writing-translation-source className="min-h-0 overflow-y-auto overscroll-contain" aria-label={sourceLanguage}>
            <article data-writing-translation-source-content className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-6 sm:px-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{sourceLanguage}</p>
              <p className="text-[16px] leading-8 text-foreground">{active?.source || t('learning.noSourceContent')}</p>
            </article>
          </section>

          <section className="flex min-h-0 flex-col border-t border-border/70 bg-background shadow-[0_-8px_20px_rgba(0,0,0,0.04)]" aria-label={answerLanguage}>
            <div data-writing-translation-nav className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2">
              <Button variant="outline" size="sm" className="h-8 px-2.5" disabled={activeIndex === 0} onClick={() => selectSegment(activeIndex - 1)}><ChevronLeft className="size-4" />{scope === 'article' ? t('learning.prevParagraph') : t('learning.prevSentence')}</Button>
              <span className="min-w-0 flex-1 truncate text-center text-xs tabular-nums text-muted-foreground">{t('learning.completedCount', { count: answeredCount, total: segments.length })}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {activeIndex < segments.length - 1 ? <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => selectSegment(activeIndex + 1)}>{scope === 'article' ? t('learning.nextParagraph') : t('learning.nextSentence')}<ChevronRight className="size-4" /></Button> : <Button size="sm" className="h-8 px-3" onClick={() => save(true)} disabled={saving || !session.sessionId || answeredCount !== segments.length || !segments.length}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{t('learning.submitShort')}</Button>}
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setListOpen(true)} title={scope === 'article' ? t('learning.segmentList') : t('learning.sentenceList')}><ListMusic className="size-4" /></Button>
              </div>
            </div>
            <div data-writing-translation-answer-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div data-writing-translation-input className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-4 sm:px-8"><div className="mb-3 flex shrink-0 items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{answerLanguage}</p><Button type="button" size="sm" variant="ghost" onClick={() => setHintOpen(true)} disabled={!active?.hint} className="h-7 shrink-0 gap-1 px-2 text-primary" aria-label={t('learning.hint')}><Lightbulb className="size-3.5" />{t('learning.hint')}</Button></div><textarea ref={translationInputRef} data-writing-caret-scroll data-writing-translation-textarea value={active ? answers[active.id] ?? '' : ''} onChange={(event) => active && setAnswers((current) => ({ ...current, [active.id]: event.target.value }))} readOnly={session.readOnly} onFocus={scheduleTranslationCaretScroll} onClick={scheduleTranslationCaretScroll} className="min-h-[132px] w-full flex-1 resize-y bg-transparent p-0 text-[16px] leading-8 text-foreground outline-none placeholder:text-muted-foreground/45 focus:ring-0" placeholder={direction === 'zh_to_en' ? t('learning.translationPlaceholderEn') : t('learning.translationPlaceholderZh')} autoCapitalize="sentences" autoCorrect="on" spellCheck={direction === 'zh_to_en'} /></div></div>
          </section>
        </main>
      )}

      <WritingSupportDrawer open={supportOpen} onOpenChange={setSupportOpen} explanation={String(active?.referenceExplanation ?? '')} referenceAnswer={String(active?.reference ?? '')} hasAttempt={Boolean(active && answers[active.id]?.trim())} />

      <Drawer open={hintOpen} onOpenChange={setHintOpen}>
        <DrawerContent className="max-h-[82dvh] rounded-t-[28px] border-0 bg-background !z-[10001]" overlayClassName="!z-[10001]">
          <DrawerHeader className="px-5 pb-2 pt-5">
            <DrawerTitle>{t('learning.hint')}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <p className="text-sm leading-7 text-muted-foreground">{active?.hint}</p>
            {(active?.referenceExplanation || active?.reference) && <Button type="button" variant="link" className="mt-3 h-auto px-0 text-primary" onClick={() => { setHintOpen(false); setSupportOpen(true) }}>{t('learning.stillStuckSeeSample')}</Button>}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={listOpen} onOpenChange={setListOpen}>
        <DrawerContent className="h-[100dvh] rounded-none pt-safe !z-[10001]" overlayClassName="!z-[10001]"><div className="flex items-center justify-between px-5 py-3"><DrawerTitle className="text-lg">{scope === 'article' ? t('learning.segmentList') : t('learning.sentenceList')}</DrawerTitle><button type="button" onClick={() => setListOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><ChevronDown className="size-5" /></button></div><div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8"><div className="space-y-1">{segments.map((segment, index) => <button key={segment.id} type="button" onClick={() => selectSegment(index)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors', activeIndex === index ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted')}><span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', activeIndex === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{index + 1}</span><p className="line-clamp-2 min-w-0 flex-1 text-sm leading-5">{segment.source}</p>{(answers[segment.id] ?? '').trim() && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}</button>)}</div></div></DrawerContent>
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
  review,
  hideRetry = false,
}: {
  topic: TrainingTopicItem
  unitTitle: string
  onClose: () => void
  onOpenGuide?: () => void
  review?: TopicSessionReviewSnapshot
  hideRetry?: boolean
}) {
  const { t } = useTranslation()
  const config = topic.contentConfig?.writing ?? {}
  const turns: Array<{ aText: string; hint: string; referenceAnswer?: string; referenceExplanation?: string }> = config.turns ?? []

  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [showHint, setShowHint] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'editor' | 'analysis'>(review ? 'analysis' : 'editor')
  const [supportOpen, setSupportOpen] = useState(false)
  const restore = useCallback((saved: Record<string, unknown>) => {
    const savedTurns = saved.turns
    if (!Array.isArray(savedTurns)) return
    const next: Record<number, string> = {}
    savedTurns.forEach((turn: any, index: number) => { if (turn?.userResponse) next[index] = String(turn.userResponse) })
    setResponses(next)
  }, [])
  const session = useTopicSession(topic.id, restore, { review })
  useEffect(() => {
    if (session.readOnly) setView('analysis')
  }, [session.readOnly])

  // B 输入框聚焦：短气泡滚盒子；长回复时同样按光标滚。
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const focusInput = () => {
    scheduleWritingInputSafeScroll(inputWrapRef.current)
  }

  const currentTurn = turns[currentIndex]
  const currentResponse = responses[currentIndex] ?? ''
  const answeredCount = turns.filter((_, i) => (responses[i] ?? '').trim()).length
  const allAnswered = answeredCount === turns.length
  const responseTurns = useMemo(() => turns.map((turn, index) => ({ aText: turn.aText, hint: turn.hint, userResponse: responses[index] ?? '' })), [responses, turns])
  const response = useMemo(() => ({ turns: responseTurns }), [responseTurns])
  useEffect(() => {
    if (!session.sessionId || session.readOnly || !answeredCount) return
    const timer = window.setTimeout(() => { void session.saveDraft(response) }, 600)
    return () => window.clearTimeout(timer)
  }, [answeredCount, response, session])

  const save = async (submit = false) => {
    setSaving(true)
    try {
      if (submit) {
        await session.submit(response)
        toast.success(t('learning.aiEvaluationDone'))
      } else {
        await session.saveDraft(response)
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
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-4 pb-2.5 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageCircle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{t('learning.conversationWriting')}</Badge>
              <span className="truncate text-[11px] text-muted-foreground">{topic.difficulty}</span>
            </div>
            <h1 className="truncate text-base font-bold leading-snug text-foreground">{topic.title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{unitTitle}</p>
          </div>
          <div className="flex items-center gap-1">
            {session.readOnly && <WritingReviewControls view={view} onViewChange={setView} hideRetry={hideRetry} onRetry={() => void session.startNewAttempt().then(() => { setResponses({}); setCurrentIndex(0); setView('editor') })} />}
            {onOpenGuide && (
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onOpenGuide} title={t('learning.viewGuide')}>
                <BookOpen className="size-4" />
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label={t('learning.exitEdit')}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Switch 的两侧都是完整页面；评估不再堆在对话作答的底部。 */}
      {session.readOnly && view === 'analysis' ? (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-2xl px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"><WritingAnalysisPanel analysis={session.analysis} /></div>
        </main>
      ) : <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-writing-scroll-region>
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
                    className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                  >
                    {t('learning.viewHint')}
                  </button>
                ) : (
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{t('learning.writingHintTitle')}</p>
                      <button
                        type="button"
                        onClick={() => setShowHint(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t('learning.collapse')}
                      </button>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{currentTurn.hint}</p>
                    {(currentTurn.referenceExplanation || currentTurn.referenceAnswer) && <button type="button" onClick={() => setSupportOpen(true)} className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline">{t('learning.stillStuckSeeSample')}</button>}
                  </div>
                )}
              </div>

              {/* B's response input */}
              <div ref={inputWrapRef} data-writing-caret-scroll className="ml-9 mt-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">B</span>
                  <div className="flex-1">
                    <textarea
                      data-writing-caret-scroll
                      value={currentResponse}
                      onChange={(event) => setResponses({ ...responses, [currentIndex]: event.target.value })}
                      readOnly={session.readOnly}
                      onFocus={focusInput}
                      onClick={focusInput}
                      className="min-h-[140px] w-full resize-none rounded-2xl rounded-tl-md border-0 bg-muted/40 p-4 text-[16px] leading-7 text-foreground outline-none ring-0 placeholder:text-muted-foreground/45 focus:bg-background focus:ring-2 focus:ring-primary/20"
                      placeholder={t('learning.dialogueReplyPlaceholder')}
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      spellCheck
                    />
                    {currentResponse.trim() && (
                      <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {t('learning.wordCount', { count: currentResponse.trim().split(/\s+/).length })}
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
                {t('learning.turnsFilled', { count: answeredCount, total: turns.length })}
              </p>
            </div>
          )}

        </div>
      </div>}

      {/* Footer — submit / retry；历史回看隐藏重试 */}
      {!(session.readOnly && hideRetry) && (
      <footer className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl pb-safe" data-writing-footer>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {session.readOnly ? (
            <Button size="lg" onClick={() => void session.startNewAttempt().then(() => { setResponses({}); setCurrentIndex(0); setView('editor') })} className="w-full gap-1.5 rounded-full">
              <RotateCcw className="size-4" />{t('learning.retryPractice')}
            </Button>
          ) : (
            <Button size="lg" onClick={() => save(true)} disabled={saving || !allAnswered || !session.sessionId} className="w-full gap-1.5 rounded-full">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{t('learning.submitFeedback')}
            </Button>
          )}
        </div>
      </footer>
      )}
      <WritingSupportDrawer open={supportOpen} onOpenChange={setSupportOpen} explanation={String(currentTurn?.referenceExplanation ?? '')} referenceAnswer={String(currentTurn?.referenceAnswer ?? '')} hasAttempt={Boolean(currentResponse.trim())} />
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

/** Progressive help: strategy first, model answer only after an explicit second step. */
function WritingSupportDrawer({
  open, onOpenChange, explanation, referenceAnswer, hasAttempt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  explanation: string
  referenceAnswer: string
  hasAttempt: boolean
}) {
  const { t } = useTranslation()
  const [showAnswer, setShowAnswer] = useState(false)
  useEffect(() => { if (!open) setShowAnswer(false) }, [open])
  return <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="max-h-[82dvh] rounded-t-[28px] border-0 bg-background !z-[10001]" overlayClassName="!z-[10001]">
      <DrawerHeader className="px-5 pb-2 pt-3 text-left"><DrawerTitle className="text-base">{t('learning.writingSupportTitle')}</DrawerTitle></DrawerHeader>
      <div className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        {!showAnswer ? <>
          <p className="mb-4 text-sm leading-6 text-muted-foreground"></p>
          {explanation ? <MarkdownRenderer content={explanation} className="text-sm leading-6 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1" /> : <p className="py-5 text-sm text-muted-foreground">{t('learning.noWritingSupport')}</p>}
          {referenceAnswer && <div className="mt-5"><Button variant="outline" className="w-full" onClick={() => setShowAnswer(true)}>{hasAttempt ? t('learning.viewReferenceAfterTry') : t('learning.viewReferenceAnyway')}</Button><p className="mt-2 text-center text-[11px] leading-5 text-muted-foreground">{t('learning.writingSupportHint')}</p></div>}
        </> : <>
          <button type="button" onClick={() => setShowAnswer(false)} className="mb-3 text-xs font-medium text-primary">{t('learning.backToWritingSupport')}</button>
          <p className="mb-3 text-sm leading-6 text-muted-foreground"></p>
          <MarkdownRenderer content={referenceAnswer} className="text-[15px] leading-7 prose-p:my-3 prose-headings:my-3" />
        </>}
      </div>
    </DrawerContent>
  </Drawer>
}

function WritingReviewControls({
  view,
  onViewChange,
  onRetry,
  hideRetry = false,
}: {
  view: 'editor' | 'analysis'
  onViewChange: (view: 'editor' | 'analysis') => void
  onRetry: () => void
  hideRetry?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Sparkles className={cn('size-3.5 transition-colors', view === 'analysis' ? 'text-primary' : 'text-muted-foreground')} />
      <Switch checked={view === 'analysis'} onCheckedChange={(checked) => onViewChange(checked ? 'analysis' : 'editor')} aria-label={t('learning.toggleAiReview')} title={view === 'analysis' ? t('learning.viewAnswer') : t('learning.viewAiReview')} />
      {!hideRetry && (
        <button type="button" onClick={onRetry} title={t('learning.retryPractice')} className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t('learning.retryPractice')}>
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function WritingAnalysisPanel({ analysis }: { analysis: Record<string, any> | null }) {
  const { t } = useTranslation()
  if (!analysis) return null
  const score = analysis.overallScore ?? 0
  const strengths = (analysis.strengths ?? []) as string[]
  const improvements = (analysis.improvements ?? []) as string[]
  const segmentFeedback = (analysis.segmentFeedback ?? []) as Array<{ segmentId?: string; score?: number; comment?: string; suggestion?: string; acceptableExpression?: string }>
  const scoreTone = score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-4">
      <section className="flex items-center gap-4 rounded-xl bg-muted/30 p-5">
        <div className={cn('flex size-[72px] shrink-0 flex-col items-center justify-center rounded-xl bg-background/70', scoreTone)}><span className="text-3xl font-bold leading-none tabular-nums">{score}</span><span className="mt-1 text-[10px] font-medium">{t('learning.totalScore')}</span></div>
        <div className="min-w-0">{analysis.summary ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{analysis.summary}</p> : <p className="text-sm text-muted-foreground">{t('learning.writingReviewDone')}</p>}</div>
      </section>
      {segmentFeedback.length > 0 && <section className="rounded-xl bg-muted/30 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />{t('learning.segmentFeedback')}</h3><div className="space-y-3">{segmentFeedback.map((item, index) => <div key={item.segmentId ?? index} className="rounded-lg bg-background/60 p-3"><div className="flex items-center gap-2"><span className="text-xs font-semibold">{t('learning.segmentNumber', { number: index + 1 })}</span>{typeof item.score === 'number' && <span className="ml-auto text-xs font-semibold text-primary">{t('learning.scorePoints', { score: item.score })}</span>}</div>{item.comment && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.comment}</p>}{item.suggestion && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-amber-700 dark:text-amber-400">{t('learning.suggestionPrefix', { text: item.suggestion })}</p>}{item.acceptableExpression && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-primary">{t('learning.referencePrefix', { text: item.acceptableExpression })}</p>}</div>)}</div></section>}
      {(strengths.length > 0 || improvements.length > 0) && <section className="rounded-xl bg-muted/30 p-4">{strengths.length > 0 && <div className={improvements.length > 0 ? 'mb-4' : ''}><h3 className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t('learning.strengthsTitle')}</h3><ul className="space-y-2">{strengths.map((item) => <li key={item} className="flex gap-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground"><CheckCircle2 className="mt-1 size-3.5 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>}{improvements.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">{t('learning.improvementsTitle')}</h3><ul className="space-y-2">{improvements.map((item) => <li key={item} className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">→ {item}</li>)}</ul></div>}</section>}
      {analysis.nextStepSuggestion && <section className="rounded-xl bg-primary/[0.04] p-4"><h3 className="mb-1 text-sm font-semibold text-primary">{t('learning.nextStepSuggestion')}</h3><p className="text-sm leading-6 text-muted-foreground">{analysis.nextStepSuggestion}</p></section>}
    </div>
  )
}
