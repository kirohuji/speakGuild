import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, BookOpen,
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
import { getContentDetail, listContentLeanPage, listContentPage, readTopicTeaching } from '@/lib/offline/learning-pack-read-model'
import type { InsightListItem } from '@/lib/offline/insight-playlist'
import {
  LearningInsightDialog,
  type LearningInsightItem,
} from '@/features/practice/components/learning-insight-dialog'
import { useLeanInsightPlaylist } from '@/features/practice/hooks/use-lean-insight-playlist'
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
import { useIsMobile } from '@/hooks/use-mobile'
import { DesktopLearningShell, useDesktopAsideSlot } from '@/layout/desktop-learning-shell'
import { desktopLearningHref } from '@/features/home/desktop-learning-section'
import { displayLearningUnitLocation } from '../lib/learning-unit-display'

const PREP_PAGE_SIZE = 8
const TOPIC_PAGE_SIZE = 8

function pageFromSearchParams(searchParams: URLSearchParams, name: string) {
  const value = Number(searchParams.get(name))
  return Number.isInteger(value) && value > 0 ? value : 1
}

export function LearningUnitPage() {
  const isMobile = useIsMobile()
  if (!isMobile) {
    return (
      <DesktopLearningShell section="learning" asideMode="slot">
        <LearningUnitPageContent />
      </DesktopLearningShell>
    )
  }
  return <LearningUnitPageContent />
}

function LearningUnitPageContent() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const asideSlot = useDesktopAsideSlot()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const planHref = isMobile ? '/learning' : desktopLearningHref('learning')

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

  const [dialogKind, setDialogKind] = useState<'vocab' | 'chunk' | 'pattern'>('vocab')
  const dialogKindRef = useRef(dialogKind)
  dialogKindRef.current = dialogKind

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

  const mapVocabToInsight = useCallback((v: VocabItem): LearningInsightItem => ({
    kind: 'word',
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
  }), [unit?.title])

  const mapChunkToInsight = useCallback((c: ChunkItem): LearningInsightItem => ({
    kind: 'chunk',
    id: c.id,
    text: c.text,
    meaning: c.meaning,
    description: c.description,
    examples: c.examples,
    sceneName: unit?.title,
  }), [unit?.title])

  const mapPatternToInsight = useCallback((p: SentencePattern, index: number): LearningInsightItem => ({
    kind: 'pattern',
    id: p.id ?? `${p.topicId}-${index}`,
    pattern: p.pattern,
    meaning: p.meaning,
    slots: p.slots,
    example: p.example,
    description: p.description,
    examples: p.examples,
    difficulty: p.difficulty,
    sceneName: unit?.title,
  }), [unit?.title])

  const packLeanFromInline = useCallback((kind: 'vocab' | 'chunk' | 'pattern'): InsightListItem[] => {
    if (kind === 'chunk') {
      return (unit?.chunks ?? []).map((c) => ({
        id: c.id,
        kind: 'chunk' as const,
        title: c.text,
        meaning: c.meaning,
      }))
    }
    if (kind === 'pattern') {
      return (unit?.sentencePatterns ?? []).map((p, i) => ({
        id: p.id ?? `${p.topicId}-${i}`,
        kind: 'pattern' as const,
        title: p.pattern,
        meaning: p.meaning,
      }))
    }
    return (unit?.vocabularies ?? []).map((v) => ({
      id: v.id,
      kind: 'word' as const,
      title: v.word,
      meaning: v.meaning,
    }))
  }, [unit])

  const fetchLeanPage = useCallback(async ({ offset, limit }: { offset: number; limit: number }) => {
    const kind = dialogKindRef.current
    if (!projected || !unitId) {
      const all = packLeanFromInline(kind)
      return { items: all.slice(offset, offset + limit), total: all.length }
    }
    return listContentLeanPage({ unitId, kind, limit, offset })
  }, [packLeanFromInline, projected, unitId])

  const fetchLeanDetail = useCallback(async (id: string) => {
    const kind = dialogKindRef.current
    if (!projected || !unitId) {
      if (kind === 'chunk') {
        const item = (unit?.chunks ?? []).find((c) => c.id === id)
        return item ? mapChunkToInsight(item) : null
      }
      if (kind === 'pattern') {
        const list = unit?.sentencePatterns ?? []
        const index = list.findIndex((p, i) => (p.id ?? `${p.topicId}-${i}`) === id)
        return index >= 0 ? mapPatternToInsight(list[index]!, index) : null
      }
      const item = (unit?.vocabularies ?? []).find((v) => v.id === id)
      return item ? mapVocabToInsight(item) : null
    }
    const raw = await getContentDetail(kind, id)
    if (!raw) return null
    if (kind === 'chunk') return mapChunkToInsight(raw as ChunkItem)
    if (kind === 'pattern') return mapPatternToInsight(raw as SentencePattern, 0)
    return mapVocabToInsight(raw as VocabItem)
  }, [mapChunkToInsight, mapPatternToInsight, mapVocabToInsight, projected, unit, unitId])

  const insightPlaylist = useLeanInsightPlaylist({
    fetchPage: fetchLeanPage,
    fetchDetail: fetchLeanDetail,
  })

  const openDialog = useCallback((kind: 'vocab' | 'chunk' | 'pattern', startIndex: number) => {
    setDialogKind(kind)
    dialogKindRef.current = kind
    void insightPlaylist.openAt(startIndex)
  }, [insightPlaylist])

  // 点击列表项展开/收起详情
  const handleItemClick = useCallback((itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId))
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      insightPlaylist.reset()
      void refreshCollectedTexts()
    } else {
      insightPlaylist.setOpen(true)
    }
  }, [insightPlaylist, refreshCollectedTexts])

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
  if (loading && unit?.id !== unitId) {
    return <MobilePageLoading rows={5} />
  }
  if (!unit && !loading) {
    return (
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
          <Button variant="secondary" className="border-0 shadow-none" asChild><Link to={planHref}>{t('learning.backToPlan')}</Link></Button>
        )}
      </div>
    )
  }

  const knowledgeCollapsed = isMobile && collapsedSections.has('knowledge')
  const topicsCollapsed = isMobile && collapsedSections.has('topics')

  const page = (
    <div className={cn(isMobile ? 'mx-auto max-w-2xl px-4 pb-24 pt-3' : 'flex h-full min-h-0 flex-col pb-0')}>
      {/* ===== Header：与 practice/session 同一套圆形返回 + 双行标题 ===== */}
      <div className={cn('mb-4 flex min-h-10 items-center gap-3', !isMobile && 'shrink-0')}>
        <button
          type="button"
          onClick={() => navigate(planHref)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
          aria-label={t('learning.learningPlan')}
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-xs text-muted-foreground">
            {unit.category}
            {!isMobile && unit.location
              ? ` · ${displayLearningUnitLocation(unit.location, unit.contentMode === 'nqtr'
                ? t('learning.contentModeNqtr')
                : unit.contentMode === 'story' ? t('learning.contentModeStory') : unit.category)}`
              : ''}
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{unit.title}</h1>
        </div>
      </div>

      {/* ===== 说明 ===== */}
      <section className={cn('mb-5', !isMobile && 'shrink-0')}>
        <SectionHeader
          eyebrow="1"
          title={t('learning.preparationTitle')}
          subtitle={(isMobile && collapsedSections.has('prep')) ? undefined : t('learning.prepSubtitle')}
          collapsible={isMobile}
          collapsed={isMobile && collapsedSections.has('prep')}
          onToggle={() => toggleSection('prep')}
        />
        {(isMobile && collapsedSections.has('prep')) ? (
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

      {/* ===== 知识点：桌面右栏；移动端中栏可折叠 ===== */}
      {(() => {
        const knowledgeSection = (
          <section className={cn(isMobile ? 'mb-5' : 'flex h-full min-h-0 flex-col')}>
            <SectionHeader
              eyebrow={isMobile ? '2' : undefined}
              title={t('learning.knowledgePoints')}
              subtitle={knowledgeCollapsed ? undefined : t('learning.knowledgeSubtitle')}
              meta={`${vocabTotal + chunkTotal + patternTotal}${t('learning.items')}`}
              collapsible={isMobile}
              collapsed={knowledgeCollapsed}
              onToggle={() => toggleSection('knowledge')}
            />

            <Tabs value={activeTab} onValueChange={handleTabChange} className={cn('space-y-3', !isMobile && 'flex min-h-0 flex-1 flex-col')} data-mobile-route-swipe>
              <TabsList className="grid h-10 w-full shrink-0 grid-cols-3 rounded-lg bg-muted/70 p-1">
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

              <TabsContent value="vocab" className={cn('mt-0 space-y-2', !isMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide')} data-mobile-gesture-allow>
                {vocabTotal > 0 ? (
                  <>
                    {(knowledgeCollapsed ? (projected ? vocabPageItems.items : unit.vocabularies).slice(0, 2) : vocabPageItems.items).map((vocab, index) => (
                      <VocabPrepCard
                        key={vocab.id}
                        vocab={vocab}
                        collected={collectedTexts.has(vocab.word)}
                        expanded={expandedItemId === vocab.id}
                        onToggle={() => handleItemClick(vocab.id)}
                        onOpen={() => openDialog('vocab', knowledgeCollapsed && !projected
                          ? unit.vocabularies.indexOf(vocab)
                          : vocabPageItems.startIndex + index)}
                        onCollect={() => handleCollectWord(vocab)}
                        {...(index === 0 ? { 'data-spotlight': 'first-vocab-card' as any } : {})}
                      />
                    ))}
                    {!knowledgeCollapsed && (
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

              <TabsContent value="chunk" className={cn('mt-0 space-y-2', !isMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide')} data-mobile-gesture-allow>
                {chunkTotal > 0 ? (
                  <>
                    {(knowledgeCollapsed ? (projected ? chunkPageItems.items : unit.chunks).slice(0, 2) : chunkPageItems.items).map((chunk, index) => (
                      <ChunkPrepCard
                        key={chunk.id}
                        chunk={chunk}
                        collected={collectedTexts.has(chunk.text)}
                        expanded={expandedItemId === chunk.id}
                        onToggle={() => handleItemClick(chunk.id)}
                        onOpen={() => openDialog('chunk', knowledgeCollapsed && !projected
                          ? unit.chunks.indexOf(chunk)
                          : chunkPageItems.startIndex + index)}
                        onCollect={() => handleCollectChunk(chunk)}
                      />
                    ))}
                    {!knowledgeCollapsed && (
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

              <TabsContent value="pattern" className={cn('mt-0 space-y-2', !isMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide')} data-mobile-gesture-allow>
                {patternTotal > 0 ? (
                  <>
                    {(knowledgeCollapsed ? (projected ? patternPageItems.items : unit.sentencePatterns).slice(0, 2) : patternPageItems.items).map((pattern, index) => {
                      const absoluteIndex = knowledgeCollapsed && !projected
                        ? unit.sentencePatterns!.indexOf(pattern)
                        : patternPageItems.startIndex + index
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
                    {!knowledgeCollapsed && (
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

            {knowledgeCollapsed && (
              <CurrentTabExpandButton
                itemCount={currentKnowledgeTabCount}
                onExpand={() => toggleSection('knowledge')}
              />
            )}
          </section>
        )

        if (!isMobile) {
          return asideSlot
            ? createPortal(
              <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-hidden px-4 py-4">
                {knowledgeSection}
              </div>,
              asideSlot,
            )
            : null
        }
        return knowledgeSection
      })()}

      {/* ===== 题目 ===== */}
      {unit.contentMode && !['practice', 'story'].includes(unit.contentMode) && (
        <div className={cn(!isMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide')}>
          <ContentModeExperience key={unit.id} unit={unit} />
        </div>
      )}
      {(unit.contentMode ?? (unit.packageType === 'story' ? 'story' : 'practice')) === 'practice' && unit.trainingTopics.length > 0 && (
        <section className={cn(isMobile ? 'mb-5' : 'flex min-h-0 flex-1 flex-col')}>
          <SectionHeader
            eyebrow={isMobile ? '3' : undefined}
            title={t('learning.practiceTitle')}
            subtitle={topicsCollapsed ? undefined : t('learning.practiceSubtitle')}
            meta={`${unit.trainingTopics.length}${t('learning.questions')}`}
            collapsible={isMobile}
            collapsed={topicsCollapsed}
            onToggle={() => toggleSection('topics')}
          />
          <div className={cn('space-y-2', !isMobile && 'scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
            {(topicsCollapsed ? unit.trainingTopics.slice(0, 2) : topicPageItems.items).map((topic, i) => {
              const absoluteIndex = topicsCollapsed ? i : topicPageItems.startIndex + i
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
          {!topicsCollapsed && (
            <div className={cn('mt-2', !isMobile && 'shrink-0')}>
              <PrepPager
                currentPage={topicPage}
                totalPages={topicPageItems.totalPages}
                totalItems={unit.trainingTopics.length}
                onPageChange={changeTopicPage}
              />
            </div>
          )}
          {topicsCollapsed && (
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
        practiceUnitId={unitId}
        items={insightPlaylist.displayItems}
        index={Math.min(insightPlaylist.index, Math.max(insightPlaylist.displayItems.length - 1, 0))}
        open={insightPlaylist.open}
        onOpenChange={handleDialogClose}
        onIndexChange={(absoluteIndex) => { void insightPlaylist.handleIndexChange(absoluteIndex) }}
        total={insightPlaylist.total}
        windowOffset={insightPlaylist.windowOffset}
        onLoadMore={() => { void insightPlaylist.loadMore() }}
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
        entry={pendingSave ? { kind: pendingSave.kind, text: pendingSave.kind === 'word' ? pendingSave.item.word : pendingSave.kind === 'chunk' ? pendingSave.item.text : pendingSave.item.pattern } : null}
        onRemoved={() => { void Promise.all((['word', 'chunk', 'pattern'] as const).map(kind => learningContentRepository.listExpressionTexts(kind))).then(groups => setCollectedTexts(new Set(groups.flat()))) }}
        open={saveDrawerOpen}
        onOpenChange={setSaveDrawerOpen}
        onSave={savePendingToNotebooks}
      />
    </div>
  )

  return page
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
  eyebrow?: string
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
        {eyebrow ? (
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {eyebrow}
          </span>
        ) : null}
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
              <Badge key={chunk.id} variant="secondary" className="rounded-full border-0 px-2 text-[10px] shadow-none">
                {chunk.text}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

