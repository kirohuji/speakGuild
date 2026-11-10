import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen,
  Target, Download,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { type ChunkItem, type SentencePattern, type TrainingTopicItem, type UnitDetail, type VocabItem } from '../api/learning-api'
import { useLearningStore } from '@/stores/learning.store'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { LEARNING_LIBRARY_CHANGED_EVENT, learningContentRepository } from '@/lib/offline'
import { listContentPage, readTopicTeaching } from '@/lib/offline/learning-pack-read-model'
import {
  LearningInsightDialog,
  type LearningInsightItem,
} from '@/features/practice/components/learning-insight-dialog'
import { SaveToNotebookDrawer } from '@/features/expression/components/save-to-notebook-drawer'
import { ContentModeExperience } from '../components/content-mode-experience'
import { CurrentTabExpandButton } from '../components/current-tab-expand-button'
import {
  ChunkPrepCard,
  EmptyPrepState,
  PatternPrepCard,
  VocabPrepCard,
} from '../components/expression-prep-section'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { useEffectivePracticeTimer } from '@/hooks/use-effective-practice-timer'
import { displayLearningUnitLocation } from '../lib/learning-unit-display'

const PREP_PAGE_SIZE = 8
const TOPIC_PAGE_SIZE = 8

function pageFromSearchParams(searchParams: URLSearchParams, name: string) {
  const value = Number(searchParams.get(name))
  return Number.isInteger(value) && value > 0 ? value : 1
}

export function LearningUnitPage() {
  const { t } = useTranslation()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 数据：来自 store
  const unit = useLearningStore((s) => s.unitDetail)
  const projected = Boolean((unit as { __offlineProjection?: boolean } | null)?.__offlineProjection)
  const loading = useLearningStore((s) => s.unitDetailLoading)
  const fetchUnitDetail = useLearningStore((s) => s.fetchUnitDetail)
  const fetchDownloadedPacks = useLearningStore((s) => s.fetchDownloadedPacks)
  const isEnrolled = useLearningStore((s) => s.myUnits.some((item) => item.id === unitId))
  const downloadUnitPack = useLearningStore((s) => s.downloadUnitPack)
  const downloadTask = useLearningStore((s) => s.downloadTasks.find((task) => task.packId === unitId))
  // 重装同一学习包时，内容页必须重新以学习库为准计算“已收录”。
  const packRevision = useLearningStore((s) => {
    const pack = s.downloadedPacks.find((item) => item.packId === unitId)
    return pack ? `${pack.status}:${pack.version}:${pack.updatedAt}` : 'not-installed'
  })

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'vocab')
  const [prepPage, setPrepPage] = useState(() => ({
    vocab: pageFromSearchParams(searchParams, 'vocabPage'),
    chunk: pageFromSearchParams(searchParams, 'chunkPage'),
    pattern: pageFromSearchParams(searchParams, 'patternPage'),
  }))
  const [topicPage, setTopicPage] = useState(() => pageFromSearchParams(searchParams, 'practicePage'))
  const [vocabRemote, setVocabRemote] = useState<{ items: VocabItem[]; total: number }>({ items: [], total: 0 })
  const [chunkRemote, setChunkRemote] = useState<{ items: ChunkItem[]; total: number }>({ items: [], total: 0 })
  const [patternRemote, setPatternRemote] = useState<{ items: SentencePattern[]; total: number }>({ items: [], total: 0 })
  const [teachingTopic, setTeachingTopic] = useState<TrainingTopicItem | null>(null)
  const [teachingMarkdown, setTeachingMarkdown] = useState('')
  useEffectivePracticeTimer({
    enabled: Boolean(unitId && unit?.id === unitId),
    sourceId: unitId ? `learning-unit:${unitId}` : null,
    scope: 'learning',
    idlePauseMs: 3 * 60_000,
  })

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogKind, setDialogKind] = useState<'vocab' | 'chunk' | 'pattern'>('vocab')

  // 展开的列表项（点击高亮 + 展开显示详情）
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [saveDrawerOpen, setSaveDrawerOpen] = useState(false)
  const onboardingCompletedSegments = useOnboardingStore((state) => state.completedSegments)
  const [pendingSave, setPendingSave] = useState<
    | { kind: 'word'; item: VocabItem }
    | { kind: 'chunk'; item: ChunkItem }
    | { kind: 'pattern'; item: SentencePattern }
    | null
  >(null)

  // 知识点区域折叠状态（默认折叠，显示前两行预览）
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['prep', 'knowledge']))
  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // 已收集文本始终来自学习库索引，而不是学习包的缓存快照。
  const [collectedTexts, setCollectedTexts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!unitId) return
    fetchUnitDetail(unitId)
    fetchDownloadedPacks()
  }, [unitId, fetchUnitDetail, fetchDownloadedPacks])

  useEffect(() => {
    if (!teachingTopic) {
      setTeachingMarkdown('')
      return
    }
    let cancelled = false
    readTopicTeaching(teachingTopic.id).then((document) => {
      if (!cancelled) setTeachingMarkdown(document?.teachingMarkdown?.trim() || teachingTopic.teachingMarkdown?.trim() || '')
    }).catch(() => {
      if (!cancelled) setTeachingMarkdown(teachingTopic.teachingMarkdown?.trim() || '')
    })
    return () => { cancelled = true }
  }, [teachingTopic])

  useEffect(() => {
    if (!projected || !unitId) return
    const kind = activeTab === 'chunk' ? 'chunk' : activeTab === 'pattern' ? 'pattern' : 'vocab'
    const page = prepPage[kind]
    let cancelled = false
    listContentPage({ unitId, kind, page, pageSize: PREP_PAGE_SIZE }).then((result) => {
      if (cancelled) return
      if (kind === 'vocab') setVocabRemote(result as { items: VocabItem[]; total: number })
      else if (kind === 'chunk') setChunkRemote(result as { items: ChunkItem[]; total: number })
      else setPatternRemote(result as { items: SentencePattern[]; total: number })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [activeTab, prepPage, projected, unitId])

  const refreshCollectedTexts = useCallback(async () => {
    const groups = await Promise.all([
      learningContentRepository.listExpressionTexts('word'),
      learningContentRepository.listExpressionTexts('chunk'),
      learningContentRepository.listExpressionTexts('pattern'),
    ])
    setCollectedTexts(new Set(groups.flat()))
  }, [])

  useEffect(() => {
    void refreshCollectedTexts()
  }, [packRevision, refreshCollectedTexts, unitId])

  useEffect(() => {
    const refresh = () => { void refreshCollectedTexts() }
    window.addEventListener(LEARNING_LIBRARY_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(LEARNING_LIBRARY_CHANGED_EVENT, refresh)
  }, [refreshCollectedTexts])

  // 知识点 / 练习话题就绪时触发分段引导（先收藏，再开练）
  useEffect(() => {
    if (!unit) return
    const hasKnowledge = projected
      ? (unit.vocabCount > 0 || unit.chunkCount > 0 || ((unit as { patternCount?: number }).patternCount ?? 0) > 0)
      : (
        unit.vocabularies.length > 0 ||
        unit.chunks.length > 0 ||
        (unit.sentencePatterns?.length ?? 0) > 0
      )
    const contentMode = unit.contentMode ?? (unit.packageType === 'story' ? 'story' : 'practice')
    const hasTopics = contentMode === 'practice' && unit.trainingTopics.length > 0

    if (hasKnowledge && !onboardingCompletedSegments['unit-save-to-library']) {
      useOnboardingStore.getState().tryStartSegment('unit-save-to-library')
      return
    }
    if (hasTopics) {
      useOnboardingStore.getState().tryStartSegment('unit-start-practice')
    }
  }, [unit, projected, onboardingCompletedSegments])

  const requestSave = useCallback((value: NonNullable<typeof pendingSave>) => {
    setPendingSave(value)
    setSaveDrawerOpen(true)
  }, [])

  const handleCollectChunk = useCallback((chunk: ChunkItem) => {
    requestSave({ kind: 'chunk', item: chunk })
  }, [requestSave])

  const handleCollectPattern = useCallback((pattern: SentencePattern) => {
    requestSave({ kind: 'pattern', item: pattern })
  }, [requestSave])

  const handleCollectWord = useCallback((vocab: VocabItem) => {
    requestSave({ kind: 'word', item: vocab })
  }, [requestSave])

  const savePendingToNotebooks = useCallback(async (notebookIds: string[]) => {
    if (!pendingSave) return
    if (pendingSave.kind === 'word') {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'word',
        text: pendingSave.item.word,
        meaning: pendingSave.item.meaning,
        sceneName: unit?.title,
        contentSnapshot: pendingSave.item,
        sourceType: 'vocabulary',
        sourceId: pendingSave.item.id,
        notebookIds,
      })
      setCollectedTexts((prev) => new Set([...prev, pendingSave.item.word]))
    } else if (pendingSave.kind === 'chunk') {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'chunk',
        text: pendingSave.item.text,
        meaning: pendingSave.item.meaning,
        sceneName: unit?.title,
        contentSnapshot: pendingSave.item,
        sourceType: 'chunk',
        sourceId: pendingSave.item.id,
        notebookIds,
      })
      setCollectedTexts((prev) => new Set([...prev, pendingSave.item.text]))
    } else {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'pattern',
        text: pendingSave.item.pattern,
        meaning: pendingSave.item.meaning,
        sceneName: unit?.title,
        contentSnapshot: pendingSave.item,
        sourceType: 'sentence_pattern',
        sourceId: pendingSave.item.id,
        notebookIds,
      })
      setCollectedTexts((prev) => new Set([...prev, pendingSave.item.pattern]))
    }
    toast.success(t('learning.addedToLibrary'))
    setPendingSave(null)
  }, [pendingSave, t, unit?.title])

  const vocabDialogItems = useMemo<LearningInsightItem[]>(() =>
    (projected ? vocabRemote.items : (unit?.vocabularies ?? [])).map((v) => ({
      kind: 'word' as const,
      id: v.id,
      word: v.word,
      meaning: v.meaning,
      partOfSpeech: v.partOfSpeech,
      phoneticUs: v.phoneticUs,
      phoneticUk: v.phoneticUk,
      audioUsUrl: v.audioUsUrl,
      audioUkUrl: v.audioUkUrl,
      definitionEn: v.definitionEn,
      synonyms: v.synonyms,
      examples: v.examples,
      description: v.description,
      difficulty: v.difficulty,
      sceneName: unit?.title,
    })), [projected, unit, vocabRemote.items])

  const chunkDialogItems = useMemo<LearningInsightItem[]>(() =>
    (projected ? chunkRemote.items : (unit?.chunks ?? [])).map((c) => ({
      kind: 'chunk' as const,
      id: c.id,
      text: c.text,
      meaning: c.meaning,
      description: c.description,
      examples: c.examples,
      sceneName: unit?.title,
    })), [chunkRemote.items, projected, unit])

  const allVocabCount = vocabDialogItems.length
  const allChunkCount = chunkDialogItems.length
  const patternDialogItems = useMemo<LearningInsightItem[]>(() =>
    (projected ? patternRemote.items : (unit?.sentencePatterns ?? [])).map((p, index) => ({
      kind: 'pattern' as const,
      // 句型库对象本身有稳定 id；旧下载包没有时才回退到 topic/index。
      id: p.id ?? `${p.topicId}-${index}`,
      pattern: p.pattern,
      meaning: p.meaning,
      slots: p.slots,
      example: p.example,
      // 这里此前遗漏，导致下载包虽保存了讲解/例句，Dialog 却永远拿不到。
      description: p.description,
      examples: p.examples,
      difficulty: p.difficulty,
      sceneName: unit?.title,
    })), [patternRemote.items, projected, unit])

  const currentDialogItems = useMemo(() => {
    if (dialogKind === 'chunk') return chunkDialogItems
    if (dialogKind === 'pattern') return patternDialogItems
    return vocabDialogItems
  }, [chunkDialogItems, dialogKind, patternDialogItems, vocabDialogItems])

  // 打开 Dialog
  const openDialog = useCallback((kind: 'vocab' | 'chunk' | 'pattern', startIndex: number) => {
    const nextItems =
      kind === 'chunk' ? chunkDialogItems : kind === 'pattern' ? patternDialogItems : vocabDialogItems
    setDialogKind(kind)
    setDialogIndex(Math.min(startIndex, nextItems.length - 1))
    setDialogOpen(true)
  }, [chunkDialogItems, patternDialogItems, vocabDialogItems])

  // 点击列表项展开/收起详情
  const handleItemClick = useCallback((itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId))
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      void refreshCollectedTexts()
    }
  }, [refreshCollectedTexts])

  const remotePage = <T,>(items: T[], total: number, page: number) => {
    const totalPages = Math.max(1, Math.ceil(total / PREP_PAGE_SIZE))
    const currentPage = Math.min(Math.max(page, 1), totalPages)
    return { items, startIndex: (currentPage - 1) * PREP_PAGE_SIZE, totalPages }
  }
  const vocabPageItems = useMemo(
    () => projected
      ? remotePage(vocabRemote.items, vocabRemote.total || unit?.vocabCount || 0, prepPage.vocab)
      : paginateItems(unit?.vocabularies ?? [], prepPage.vocab, PREP_PAGE_SIZE),
    [prepPage.vocab, projected, unit?.vocabCount, unit?.vocabularies, vocabRemote.items, vocabRemote.total],
  )
  const chunkPageItems = useMemo(
    () => projected
      ? remotePage(chunkRemote.items, chunkRemote.total || unit?.chunkCount || 0, prepPage.chunk)
      : paginateItems(unit?.chunks ?? [], prepPage.chunk, PREP_PAGE_SIZE),
    [chunkRemote.items, chunkRemote.total, prepPage.chunk, projected, unit?.chunkCount, unit?.chunks],
  )
  const patternPageItems = useMemo(
    () => projected
      ? remotePage(patternRemote.items, patternRemote.total || (unit as { patternCount?: number } | null)?.patternCount || 0, prepPage.pattern)
      : paginateItems(unit?.sentencePatterns ?? [], prepPage.pattern, PREP_PAGE_SIZE),
    [patternRemote.items, patternRemote.total, prepPage.pattern, projected, unit],
  )
  const vocabTotal = projected ? (vocabRemote.total || unit?.vocabCount || 0) : (unit?.vocabularies.length ?? 0)
  const chunkTotal = projected ? (chunkRemote.total || unit?.chunkCount || 0) : (unit?.chunks.length ?? 0)
  const patternTotal = projected ? (patternRemote.total || (unit as { patternCount?: number } | null)?.patternCount || 0) : (unit?.sentencePatterns?.length ?? 0)
  const currentKnowledgeTabCount = activeTab === 'vocab'
    ? vocabTotal
    : activeTab === 'chunk'
      ? chunkTotal
      : patternTotal
  const topicPageItems = useMemo(
    () => paginateItems(unit?.trainingTopics ?? [], topicPage, TOPIC_PAGE_SIZE),
    [topicPage, unit?.trainingTopics],
  )

  const changePrepPage = useCallback((kind: keyof typeof prepPage, page: number) => {
    setPrepPage((current) => ({ ...current, [kind]: page }))
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      const key = `${kind}Page`
      if (page === 1) next.delete(key)
      else next.set(key, String(page))
      return next
    }, { replace: true })
    setExpandedItemId(null)
  }, [setSearchParams])

  const changeTopicPage = useCallback((page: number) => {
    setTopicPage(page)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (page === 1) next.delete('practicePage')
      else next.set('practicePage', String(page))
      return next
    }, { replace: true })
  }, [setSearchParams])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value === 'vocab') next.delete('tab')
      else next.set('tab', value)
      return next
    }, { replace: true })
    setExpandedItemId(null)
  }, [setSearchParams])

  // 当前 unit 已有数据时不展示骨架，避免切换/重进时闪烁
  if (loading && unit?.id !== unitId) return <MobilePageLoading rows={5} />
  if (!unit && !loading) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Target className="size-12 text-muted-foreground/40" />
      <p className="text-center text-muted-foreground">{isEnrolled ? t('learning.packNeedsDownload') : t('learning.unitNotFound')}</p>
      {isEnrolled ? (
        <Button
          onClick={() => unitId && void downloadUnitPack(unitId)}
          disabled={Boolean(downloadTask && downloadTask.status !== 'error' && downloadTask.status !== 'done')}
        >
          <Download className="size-4" />
          {downloadTask && downloadTask.status !== 'error' && downloadTask.status !== 'done'
            ? t('learning.downloading')
            : t('learning.redownloadPack')}
        </Button>
      ) : (
        <Button variant="outline" asChild><Link to="/learning">{t('learning.backToPlan')}</Link></Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 md:pt-4">
      {/* ===== Header ===== */}
      <div className="mb-4">
        <div className="flex min-h-10 items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => navigate('/learning')}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label={t('learning.learningPlan')}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-xs text-muted-foreground">{unit.category}</p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{unit.title}</h1>
          </div>
        </div>
        <div className="hidden md:block">
          <Link to="/learning" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> {t('learning.learningPlan')}
          </Link>
          <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-2 rounded-full">{unit.category}</Badge>
            <h1 className="text-xl font-bold leading-tight text-foreground">{unit.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {displayLearningUnitLocation(unit.location, unit.contentMode === 'nqtr'
                ? t('learning.contentModeNqtr')
                : unit.contentMode === 'story' ? t('learning.contentModeStory') : unit.category)}
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="size-5" />
          </div>
          </div>
        </div>
      </div>

      {/* ===== 说明 ===== */}
      <section className="mb-5">
        <SectionHeader
          eyebrow="1"
          title={t('learning.preparationTitle')}
          subtitle={collapsedSections.has('prep') ? undefined : t('learning.prepSubtitle')}
          collapsible
          collapsed={collapsedSections.has('prep')}
          onToggle={() => toggleSection('prep')}
        />
        {collapsedSections.has('prep') ? (
        <div className="rounded-lg bg-muted/30 px-4 py-3">
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {unit.description || t('learning.prepFallback')}
          </p>
        </div>
        ) : (
        <div className="rounded-lg bg-muted/30 p-4">
          {unit.description ? (
            <p className="text-sm leading-6 text-muted-foreground">{unit.description}</p>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">{t('learning.prepFallback')}</p>
          )}
        </div>
        )}
      </section>

      {/* ===== 知识点 ===== */}
      <section className="mb-5">
        <SectionHeader
          eyebrow="2"
          title={t('learning.knowledgePoints')}
          subtitle={collapsedSections.has('knowledge') ? undefined : t('learning.knowledgeSubtitle')}
          meta={`${vocabTotal + chunkTotal + patternTotal}${t('learning.items')}`}
          collapsible
          collapsed={collapsedSections.has('knowledge')}
          onToggle={() => toggleSection('knowledge')}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3" data-mobile-route-swipe>
          <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
            <TabsTrigger value="vocab" className="rounded-md text-xs">
              {t('learning.vocab')} {vocabTotal}
            </TabsTrigger>
            <TabsTrigger value="chunk" className="rounded-md text-xs">
              {t('learning.coreChunks')} {chunkTotal}
            </TabsTrigger>
            <TabsTrigger value="pattern" className="rounded-md text-xs">
              {t('learning.patterns')} {patternTotal}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vocab" className="mt-0 space-y-2" data-mobile-gesture-allow>
            {vocabTotal > 0 ? (
              <>
                {(collapsedSections.has('knowledge') ? (projected ? vocabPageItems.items : unit.vocabularies).slice(0, 2) : vocabPageItems.items).map((vocab, index) => (
                  <VocabPrepCard
                    key={vocab.id}
                    vocab={vocab}
                    collected={collectedTexts.has(vocab.word)}
                    expanded={expandedItemId === vocab.id}
                    onToggle={() => handleItemClick(vocab.id)}
                    onOpen={() => openDialog('vocab', projected ? index : (collapsedSections.has('knowledge') ? unit.vocabularies.indexOf(vocab) : vocabPageItems.startIndex + index))}
                    onCollect={() => handleCollectWord(vocab)}
                    {...(index === 0 ? { 'data-spotlight': 'first-vocab-card' as any } : {})}
                  />
                ))}
                {!collapsedSections.has('knowledge') && (
                <PrepPager
                  currentPage={prepPage.vocab}
                  totalPages={vocabPageItems.totalPages}
                  totalItems={vocabTotal}
                  onPageChange={(page) => changePrepPage('vocab', page)}
                />
                )}
              </>
            ) : (
              <EmptyPrepState label={t('learning.noVocab')} />
            )}
          </TabsContent>

          <TabsContent value="chunk" className="mt-0 space-y-2" data-mobile-gesture-allow>
            {chunkTotal > 0 ? (
              <>
                {(collapsedSections.has('knowledge') ? (projected ? chunkPageItems.items : unit.chunks).slice(0, 2) : chunkPageItems.items).map((chunk, index) => (
                  <ChunkPrepCard
                    key={chunk.id}
                    chunk={chunk}
                    collected={collectedTexts.has(chunk.text)}
                    expanded={expandedItemId === chunk.id}
                    onToggle={() => handleItemClick(chunk.id)}
                    onOpen={() => openDialog('chunk', projected ? index : (collapsedSections.has('knowledge') ? unit.chunks.indexOf(chunk) : chunkPageItems.startIndex + index))}
                    onCollect={() => handleCollectChunk(chunk)}
                  />
                ))}
                {!collapsedSections.has('knowledge') && (
                <PrepPager
                  currentPage={prepPage.chunk}
                  totalPages={chunkPageItems.totalPages}
                  totalItems={chunkTotal}
                  onPageChange={(page) => changePrepPage('chunk', page)}
                />
                )}
              </>
            ) : (
              <EmptyPrepState label={t('learning.noChunks')} />
            )}
          </TabsContent>

          <TabsContent value="pattern" className="mt-0 space-y-2" data-mobile-gesture-allow>
            {patternTotal > 0 ? (
              <>
                {(collapsedSections.has('knowledge') ? (projected ? patternPageItems.items : unit.sentencePatterns).slice(0, 2) : patternPageItems.items).map((pattern, index) => {
                  const absoluteIndex = projected ? index : (collapsedSections.has('knowledge') ? unit.sentencePatterns!.indexOf(pattern) : patternPageItems.startIndex + index)
                  const key = `${pattern.topicId}-${absoluteIndex}`
                  return (
                    <PatternPrepCard
                      key={key}
                      pattern={pattern}
                      collected={collectedTexts.has(pattern.pattern)}
                      expanded={expandedItemId === key}
                      onToggle={() => handleItemClick(key)}
                      onOpen={() => openDialog('pattern', absoluteIndex)}
                      onCollect={() => handleCollectPattern(pattern)}
                    />
                  )
                })}
                {!collapsedSections.has('knowledge') && (
                <PrepPager
                  currentPage={prepPage.pattern}
                  totalPages={patternPageItems.totalPages}
                  totalItems={patternTotal}
                  onPageChange={(page) => changePrepPage('pattern', page)}
                />
                )}
              </>
            ) : (
              <EmptyPrepState label={t('learning.noPatterns')} />
            )}
          </TabsContent>
        </Tabs>

        {collapsedSections.has('knowledge') && (
          <CurrentTabExpandButton
            itemCount={currentKnowledgeTabCount}
            onExpand={() => toggleSection('knowledge')}
          />
        )}
      </section>

      {/* ===== 题目 ===== */}
      {unit.contentMode && !['practice', 'story'].includes(unit.contentMode) && (
        <ContentModeExperience key={unit.id} unit={unit} />
      )}
      {(unit.contentMode ?? (unit.packageType === 'story' ? 'story' : 'practice')) === 'practice' && unit.trainingTopics.length > 0 && (
        <section className="mb-5">
          <SectionHeader
            eyebrow="3"
            title={t('learning.practiceTitle')}
            subtitle={collapsedSections.has('topics') ? undefined : t('learning.practiceSubtitle')}
            meta={`${unit.trainingTopics.length}${t('learning.questions')}`}
            collapsible
            collapsed={collapsedSections.has('topics')}
            onToggle={() => toggleSection('topics')}
          />
          <div className="space-y-2">
            {(collapsedSections.has('topics') ? unit.trainingTopics.slice(0, 2) : topicPageItems.items).map((topic, i) => {
              const absoluteIndex = collapsedSections.has('topics') ? i : topicPageItems.startIndex + i
              return (
              <PracticeTopicCard
                key={topic.id}
                topic={topic}
                index={absoluteIndex}
                onStart={() => navigate(`/practice/session/${topic.id}?unitId=${unitId}`)}
                onOpenTeaching={() => setTeachingTopic(topic)}
                {...(absoluteIndex === 0 ? { 'data-spotlight': 'start-vn-practice' as any } : {})}
              />
              )
            })}
          </div>
          {!collapsedSections.has('topics') && (
            <div className="mt-2">
              <PrepPager
                currentPage={topicPage}
                totalPages={topicPageItems.totalPages}
                totalItems={unit.trainingTopics.length}
                onPageChange={changeTopicPage}
              />
            </div>
          )}
          {collapsedSections.has('topics') && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full gap-1.5 text-xs text-muted-foreground transition-none hover:!bg-transparent hover:!text-muted-foreground active:!scale-100"
              onClick={() => toggleSection('topics')}
            >
              <ChevronDown className="size-3.5" /> {t('learning.expandAll', { count: unit.trainingTopics.length })}
            </Button>
          )}
        </section>
      )}

      {/* Dialog */}
      <LearningInsightDialog
        items={currentDialogItems}
        index={Math.min(dialogIndex, Math.max(currentDialogItems.length - 1, 0))}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onIndexChange={setDialogIndex}
      />
      <PracticeVnDrawer
        open={Boolean(teachingTopic)}
        onOpenChange={(open) => { if (!open) setTeachingTopic(null) }}
        hideToggles
        unitId={unitId}
        topicId={teachingTopic?.id}
        teachingMarkdown={teachingMarkdown}
      />
      <SaveToNotebookDrawer
        open={saveDrawerOpen}
        onOpenChange={setSaveDrawerOpen}
        onSave={savePendingToNotebooks}
      />
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  collapsible = false,
  collapsed = false,
  onToggle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  meta?: string
  collapsible?: boolean
  collapsed?: boolean
  onToggle?: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {eyebrow}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {meta && (
          <Badge variant="secondary" className="shrink-0 rounded-full border-0 text-[11px] shadow-none">
            {meta}
          </Badge>
        )}
        {collapsible && (
          <button
            type="button"
            onClick={onToggle}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? t('common.expand') : t('common.collapse')}
          >
            <ChevronDown className={cn('size-4 transition-transform duration-200', collapsed && '-rotate-90')} />
          </button>
        )}
      </div>
    </div>
  )
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIndex = (currentPage - 1) * pageSize

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    startIndex,
    totalPages,
  }
}

function PrepPager({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">
        {t('common.total')} {totalItems} {t('learning.items')}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 border-0 bg-primary/10 px-2 text-xs text-primary shadow-none hover:bg-primary/16 hover:text-primary"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {t('common.prevPage')}
        </Button>
        <span className="min-w-10 text-center text-[11px] text-muted-foreground">
          {currentPage}/{totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 border-0 bg-primary/10 px-2 text-xs text-primary shadow-none hover:bg-primary/16 hover:text-primary"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {t('common.nextPage')}
        </Button>
      </div>
    </div>
  )
}

function UnitMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/45 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function PracticeTopicCard({
  topic,
  index,
  onStart,
  onOpenTeaching,
  ...rest
}: {
  topic: TrainingTopicItem
  index: number
  onStart: () => void
  onOpenTeaching: () => void
  [key: `data-${string}`]: string | undefined
}) {
  return (
    <Card
      className="cursor-pointer border-0 bg-accent/[0.06] shadow-none ring-0 transition-colors hover:bg-accent/[0.1] dark:ring-0"
      onClick={onStart}
      {...rest}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold leading-none text-primary">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">{topic.title}</p>
              <Badge variant="secondary" className="text-[10px]">{topic.difficulty}</Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{topic.promptZh}</p>
          </div>
          {(topic.hasTeachingDocument || topic.teachingMarkdown?.trim()) && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onOpenTeaching() }}
              className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:scale-[0.92]"
              aria-label={`阅读${topic.title}教学文档`}
            >
              <BookOpen className="size-4" />
            </button>
          )}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </div>
        {topic.activeChunks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 rounded-md bg-background/45 p-2.5">
            {topic.activeChunks.slice(0, 3).map((chunk) => (
              <Badge key={chunk.id} variant="outline" className="rounded-full px-2 text-[10px]">
                {chunk.text}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

