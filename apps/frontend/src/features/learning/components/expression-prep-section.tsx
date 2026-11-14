import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookText,
  BookmarkPlus,
  ChevronRight,
  MessageSquareText,
  Search,
  TextQuote,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { extractCoreUsage } from '@/lib/markdown-utils'
import { LEARNING_LIBRARY_CHANGED_EVENT, learningContentRepository } from '@/lib/offline'
import { listContentPage } from '@/lib/offline/learning-pack-read-model'
import { PrepPager } from '@/features/practice/components/prep-pager'
import {
  LearningInsightDialog,
  type LearningInsightItem,
} from '@/features/practice/components/learning-insight-dialog'
import { SaveToNotebookDrawer } from '@/features/expression/components/save-to-notebook-drawer'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { CurrentTabExpandButton } from './current-tab-expand-button'
import { WordMeaningInline } from './word-meaning-lines'
import { patternSlotDescription, patternSlotLabel } from '../lib/pattern-slot'
import type { ChunkItem, SentencePattern, VocabItem } from '../api/learning-api'

export type ExpressionPrepTab = 'vocab' | 'chunk' | 'pattern'

type PendingSave =
  | { kind: 'word'; item: VocabItem }
  | { kind: 'chunk'; item: ChunkItem }
  | { kind: 'pattern'; item: SentencePattern }

const DEFAULT_PAGE_SIZE = 8

/** Chunk examples from topic APIs and offline packs may omit optional metadata. */
type ChunkPrepItem = Omit<Partial<ChunkItem>, 'examples'> & {
  id: string
  text: string
  meaning: string
  examples?: Array<{ en: string; zh: string; note?: string | null; level?: string }>
}

function firstExampleText(examples: unknown): string {
  if (!Array.isArray(examples) || examples.length === 0) return ''
  const first = examples[0]
  if (typeof first === 'string') return first
  if (first && typeof first === 'object' && 'en' in first) {
    return String((first as { en?: unknown }).en ?? '')
  }
  return ''
}

export function normalizeVocabItem(item: Partial<VocabItem> & { id: string; word: string; meaning: string }): VocabItem {
  return {
    id: item.id,
    word: item.word,
    meaning: item.meaning,
    partOfSpeech: item.partOfSpeech ?? null,
    phoneticUs: item.phoneticUs ?? null,
    phoneticUk: item.phoneticUk ?? null,
    audioUsUrl: item.audioUsUrl ?? null,
    audioUkUrl: item.audioUkUrl ?? null,
    definitionEn: item.definitionEn ?? null,
    synonyms: item.synonyms ?? [],
    examples: item.examples,
    description: item.description ?? null,
    difficulty: item.difficulty,
  }
}

export function normalizeChunkItem(
  item: ChunkPrepItem,
): ChunkItem {
  return {
    id: item.id,
    text: item.text,
    meaning: item.meaning,
    description: item.description ?? null,
    category: item.category ?? '',
    difficulty: item.difficulty ?? 'L2',
    masteryStatus: item.masteryStatus ?? 'not_learned',
    examples: (item.examples ?? []).map((example) => ({
      en: example.en,
      zh: example.zh,
      note: example.note ?? null,
      level: example.level ?? 'L2',
    })),
  }
}

export function normalizePatternItem(
  item: Partial<SentencePattern> & { pattern: string; meaning?: string | null },
  fallback: { topicId?: string; topicTitle?: string; index?: number } = {},
): SentencePattern {
  const example = item.example || firstExampleText(item.examples)
  return {
    id: item.id ?? `${fallback.topicId ?? 'pattern'}-${fallback.index ?? 0}`,
    pattern: item.pattern,
    meaning: item.meaning ?? '',
    slots: Array.isArray(item.slots) ? item.slots : [],
    example,
    description: item.description ?? null,
    examples: item.examples,
    difficulty: item.difficulty ?? 'L1',
    topicId: item.topicId ?? fallback.topicId ?? '',
    topicTitle: item.topicTitle ?? fallback.topicTitle ?? '',
  }
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIndex = (currentPage - 1) * pageSize
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    startIndex,
    currentPage,
    totalPages,
  }
}

export function EmptyPrepState({ label }: { label: string }) {
  return (
    <div className="rounded-lg bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function VocabPrepCard({
  vocab,
  collected,
  expanded,
  onToggle,
  onOpen,
  onCollect,
  ...rest
}: {
  vocab: VocabItem
  collected: boolean
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  onCollect: () => void
} & Record<string, any>) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const handleClick = () => {
    setSaving(true)
    Promise.resolve(onCollect()).finally(() => setSaving(false))
  }

  return (
    <Card className={cn('border-0 bg-muted/30 shadow-none ring-0 transition-colors dark:ring-0')}>
      <CardContent className="p-0">
        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle} {...rest}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <BookText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{vocab.word}</p>
              {collected && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{t('learning.collected')}</Badge>}
            </div>
            <WordMeaningInline meaning={vocab.meaning} />
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>
        {expanded && (
          <div className="px-3 pb-3 pt-2">
            {vocab.description && (
              <div className="mb-3 line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                <MarkdownContent content={extractCoreUsage(vocab.description)} />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="h-8 flex-1 gap-1.5 border-0 text-xs shadow-none" onClick={onOpen}>
                <Search className="size-3.5" /> {t('learning.view')}
              </Button>
              <Button size="sm" variant={collected ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={saving} onClick={handleClick} data-spotlight="bookmark-btn">
                <BookmarkPlus className="size-3.5" /> {saving ? t('learning.processing') : collected ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ChunkPrepCard({
  chunk,
  collected,
  expanded,
  onToggle,
  onOpen,
  onCollect,
}: {
  chunk: ChunkItem
  collected: boolean
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  onCollect: () => void
}) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const handleClick = () => {
    setSaving(true)
    Promise.resolve(onCollect()).finally(() => setSaving(false))
  }

  return (
    <Card className={cn('border-0 bg-muted/30 shadow-none ring-0 transition-colors dark:ring-0')}>
      <CardContent className="p-0">
        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageSquareText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{chunk.text}</p>
              {collected && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{t('learning.collected')}</Badge>}
            </div>
            <WordMeaningInline meaning={chunk.meaning} />
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>
        {expanded && (
          <div className="px-3 pb-3 pt-2">
            {chunk.description && (
              <div className="mb-3 line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                <MarkdownContent content={extractCoreUsage(chunk.description)} />
              </div>
            )}
            {chunk.examples[0] && (
              <div className="mb-3 rounded-md bg-muted/45 p-2.5">
                <p className="text-xs font-medium leading-5 text-foreground">{chunk.examples[0].en}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{chunk.examples[0].zh}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="h-8 flex-1 gap-1.5 border-0 text-xs shadow-none" onClick={onOpen}>
                <Search className="size-3.5" /> {t('learning.view')}
              </Button>
              <Button size="sm" variant={collected ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={saving} onClick={handleClick}>
                <BookmarkPlus className="size-3.5" />
                {saving ? t('learning.processing') : collected ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PatternPrepCard({
  pattern,
  collected,
  expanded,
  onToggle,
  onOpen,
  onCollect,
}: {
  pattern: SentencePattern
  collected: boolean
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  onCollect: () => void
}) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const handleClick = () => {
    setSaving(true)
    Promise.resolve(onCollect()).finally(() => setSaving(false))
  }

  return (
    <Card className={cn('border-0 bg-muted/30 shadow-none ring-0 transition-colors dark:ring-0')}>
      <CardContent className="p-0">
        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <TextQuote className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{pattern.pattern}</p>
              {collected && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{t('learning.collected')}</Badge>}
            </div>
            <WordMeaningInline meaning={pattern.meaning} />
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>
        {expanded && (
          <div className="px-3 pb-3 pt-2">
            {pattern.description && (
              <div className="mb-3 line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                <MarkdownContent content={extractCoreUsage(pattern.description)} />
              </div>
            )}
            {(pattern.example || pattern.topicTitle) && (
              <div className="mb-3 rounded-md bg-muted/45 p-2.5">
                {pattern.example && <p className="text-xs font-medium leading-5 text-foreground">{pattern.example}</p>}
                {pattern.topicTitle && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{pattern.topicTitle}</p>}
              </div>
            )}
            {(pattern.slots ?? []).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {pattern.slots.map((slot, index) => (
                  <Badge key={index} title={patternSlotDescription(slot)} variant="secondary" className="rounded-full px-2 text-[10px]">{patternSlotLabel(slot)}</Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="h-8 flex-1 gap-1.5 border-0 text-xs shadow-none" onClick={onOpen}>
                <Search className="size-3.5" /> {t('learning.viewPattern')}
              </Button>
              <Button size="sm" variant={collected ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={saving} onClick={handleClick}>
                <BookmarkPlus className="size-3.5" />
                {saving ? t('learning.processing') : collected ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ExpressionPrepSection({
  vocabularies = [],
  chunks = [],
  patterns = [],
  contentSource,
  sceneName,
  pageSize = DEFAULT_PAGE_SIZE,
  defaultTab = 'vocab',
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onCollapsedChange,
  collapsible = false,
  collapsedPreviewCount = 2,
  onChunkExpand,
  className,
}: {
  vocabularies?: Array<Partial<VocabItem> & { id: string; word: string; meaning: string }>
  chunks?: ChunkPrepItem[]
  patterns?: Array<Partial<SentencePattern> & { pattern: string; meaning?: string | null }>
  /** 已安装学习包：从本地 content index 分页读取，不走后端。包级传 unitId，章节/话题传 topicId。 */
  contentSource?: {
    unitId?: string
    topicId?: string
    totals?: { vocab?: number; chunk?: number; pattern?: number }
  }
  sceneName?: string
  pageSize?: number
  defaultTab?: ExpressionPrepTab
  defaultCollapsed?: boolean
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  collapsible?: boolean
  collapsedPreviewCount?: number
  onChunkExpand?: (chunkId: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const useLocalIndex = Boolean(contentSource?.topicId || contentSource?.unitId)
  const [activeTab, setActiveTab] = useState<ExpressionPrepTab>(defaultTab)
  const [collapsedState, setCollapsedState] = useState(defaultCollapsed)
  const collapsed = collapsedProp ?? collapsedState
  const setCollapsed = (next: boolean) => {
    onCollapsedChange?.(next)
    if (collapsedProp === undefined) setCollapsedState(next)
  }
  const [prepPage, setPrepPage] = useState({ vocab: 1, chunk: 1, pattern: 1 })
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogKind, setDialogKind] = useState<ExpressionPrepTab>('vocab')
  const [saveDrawerOpen, setSaveDrawerOpen] = useState(false)
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [collectedTexts, setCollectedTexts] = useState<Set<string>>(new Set())
  const [remoteVocab, setRemoteVocab] = useState<{ items: VocabItem[]; total: number }>({ items: [], total: 0 })
  const [remoteChunk, setRemoteChunk] = useState<{ items: ChunkItem[]; total: number }>({ items: [], total: 0 })
  const [remotePattern, setRemotePattern] = useState<{ items: SentencePattern[]; total: number }>({ items: [], total: 0 })

  const inlineVocabItems = useMemo(() => vocabularies.map(normalizeVocabItem), [vocabularies])
  const inlineChunkItems = useMemo(() => chunks.map(normalizeChunkItem), [chunks])
  const inlinePatternItems = useMemo(
    () => patterns.map((item, index) => normalizePatternItem(item, { topicId: sceneName, topicTitle: sceneName, index })),
    [patterns, sceneName],
  )

  useEffect(() => {
    if (!useLocalIndex || (!contentSource?.topicId && !contentSource?.unitId)) return
    const kind = activeTab === 'chunk' ? 'chunk' : activeTab === 'pattern' ? 'pattern' : 'vocab'
    const page = collapsed ? 1 : prepPage[kind]
    let cancelled = false
    listContentPage({
      unitId: contentSource.topicId ? undefined : contentSource.unitId,
      topicId: contentSource.topicId,
      kind,
      page,
      pageSize,
    }).then((result) => {
      if (cancelled) return
      if (kind === 'vocab') setRemoteVocab(result as { items: VocabItem[]; total: number })
      else if (kind === 'chunk') setRemoteChunk(result as { items: ChunkItem[]; total: number })
      else setRemotePattern(result as { items: SentencePattern[]; total: number })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [activeTab, collapsed, contentSource?.topicId, contentSource?.unitId, pageSize, prepPage, useLocalIndex])

  const vocabItems = useMemo(
    () => (useLocalIndex ? remoteVocab.items.map(normalizeVocabItem) : inlineVocabItems),
    [inlineVocabItems, remoteVocab.items, useLocalIndex],
  )
  const chunkItems = useMemo(
    () => (useLocalIndex ? remoteChunk.items.map(normalizeChunkItem) : inlineChunkItems),
    [inlineChunkItems, remoteChunk.items, useLocalIndex],
  )
  const patternItems = useMemo(
    () => (useLocalIndex
      ? remotePattern.items.map((item, index) => normalizePatternItem(item, { topicId: sceneName, topicTitle: sceneName, index }))
      : inlinePatternItems),
    [inlinePatternItems, remotePattern.items, sceneName, useLocalIndex],
  )

  const vocabTotal = useLocalIndex
    ? (remoteVocab.total || contentSource?.totals?.vocab || 0)
    : inlineVocabItems.length
  const chunkTotal = useLocalIndex
    ? (remoteChunk.total || contentSource?.totals?.chunk || 0)
    : inlineChunkItems.length
  const patternTotal = useLocalIndex
    ? (remotePattern.total || contentSource?.totals?.pattern || 0)
    : inlinePatternItems.length

  const refreshCollectedTexts = useCallback(async () => {
    const [words, chunkTexts, patternTexts] = await Promise.all([
      learningContentRepository.listExpressionTexts('word'),
      learningContentRepository.listExpressionTexts('chunk'),
      learningContentRepository.listExpressionTexts('pattern'),
    ])
    setCollectedTexts(new Set([...words, ...chunkTexts, ...patternTexts]))
  }, [])

  useEffect(() => {
    void refreshCollectedTexts()
    const onChanged = () => { void refreshCollectedTexts() }
    window.addEventListener(LEARNING_LIBRARY_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(LEARNING_LIBRARY_CHANGED_EVENT, onChanged)
  }, [refreshCollectedTexts])

  const remotePage = <T,>(items: T[], total: number, page: number) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const currentPage = Math.min(Math.max(page, 1), totalPages)
    return { items, startIndex: (currentPage - 1) * pageSize, currentPage, totalPages }
  }
  const vocabPageItems = useMemo(
    () => (useLocalIndex
      ? remotePage(vocabItems, vocabTotal, prepPage.vocab)
      : paginateItems(inlineVocabItems, prepPage.vocab, pageSize)),
    [inlineVocabItems, pageSize, prepPage.vocab, useLocalIndex, vocabItems, vocabTotal],
  )
  const chunkPageItems = useMemo(
    () => (useLocalIndex
      ? remotePage(chunkItems, chunkTotal, prepPage.chunk)
      : paginateItems(inlineChunkItems, prepPage.chunk, pageSize)),
    [chunkItems, chunkTotal, inlineChunkItems, pageSize, prepPage.chunk, useLocalIndex],
  )
  const patternPageItems = useMemo(
    () => (useLocalIndex
      ? remotePage(patternItems, patternTotal, prepPage.pattern)
      : paginateItems(inlinePatternItems, prepPage.pattern, pageSize)),
    [inlinePatternItems, pageSize, patternItems, patternTotal, prepPage.pattern, useLocalIndex],
  )

  const vocabDialogItems = useMemo<LearningInsightItem[]>(() =>
    vocabItems.map((v) => ({
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
      sceneName,
    })), [sceneName, vocabItems])

  const chunkDialogItems = useMemo<LearningInsightItem[]>(() =>
    chunkItems.map((c) => ({
      kind: 'chunk' as const,
      id: c.id,
      text: c.text,
      meaning: c.meaning,
      description: c.description,
      examples: c.examples,
      sceneName,
    })), [chunkItems, sceneName])

  const patternDialogItems = useMemo<LearningInsightItem[]>(() =>
    patternItems.map((p, index) => ({
      kind: 'pattern' as const,
      id: p.id ?? `${p.topicId}-${index}`,
      pattern: p.pattern,
      meaning: p.meaning,
      slots: p.slots,
      example: p.example,
      description: p.description,
      examples: p.examples,
      difficulty: p.difficulty,
      sceneName,
    })), [patternItems, sceneName])

  const currentDialogItems = dialogKind === 'chunk'
    ? chunkDialogItems
    : dialogKind === 'pattern'
      ? patternDialogItems
      : vocabDialogItems

  const requestSave = useCallback((payload: PendingSave) => {
    setPendingSave(payload)
    setSaveDrawerOpen(true)
  }, [])

  const savePendingToNotebooks = useCallback(async (notebookIds: string[]) => {
    if (!pendingSave) return
    if (pendingSave.kind === 'word') {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'word',
        text: pendingSave.item.word,
        meaning: pendingSave.item.meaning,
        sceneName,
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
        sceneName,
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
        sceneName,
        contentSnapshot: pendingSave.item,
        sourceType: 'sentence_pattern',
        sourceId: pendingSave.item.id,
        notebookIds,
      })
      setCollectedTexts((prev) => new Set([...prev, pendingSave.item.pattern]))
    }
    toast.success(t('learning.addedToLibrary'))
    setPendingSave(null)
  }, [pendingSave, sceneName, t])

  const openDialog = (kind: ExpressionPrepTab, startIndex: number) => {
    const items = kind === 'chunk' ? chunkDialogItems : kind === 'pattern' ? patternDialogItems : vocabDialogItems
    setDialogKind(kind)
    setDialogIndex(Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)))
    setDialogOpen(true)
  }

  const visibleVocabs = collapsed ? vocabItems.slice(0, collapsedPreviewCount) : vocabPageItems.items
  const visibleChunks = collapsed ? chunkItems.slice(0, collapsedPreviewCount) : chunkPageItems.items
  const visiblePatterns = collapsed ? patternItems.slice(0, collapsedPreviewCount) : patternPageItems.items
  const currentTabCount = activeTab === 'chunk'
    ? chunkTotal
    : activeTab === 'pattern'
      ? patternTotal
      : vocabTotal

  return (
    <div className={cn('space-y-3', className)}>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ExpressionPrepTab)}
        className="space-y-3"
        data-mobile-route-swipe
      >
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
              {visibleVocabs.map((vocab, index) => (
                <VocabPrepCard
                  key={vocab.id}
                  vocab={vocab}
                  collected={collectedTexts.has(vocab.word)}
                  expanded={expandedItemId === vocab.id}
                  onToggle={() => setExpandedItemId((prev) => (prev === vocab.id ? null : vocab.id))}
                  onOpen={() => openDialog('vocab', useLocalIndex || collapsed ? index : vocabPageItems.startIndex + index)}
                  onCollect={() => requestSave({ kind: 'word', item: vocab })}
                />
              ))}
              {!collapsed && (
                <PrepPager
                  currentPage={vocabPageItems.currentPage}
                  totalPages={vocabPageItems.totalPages}
                  totalItems={vocabTotal}
                  onPageChange={(page) => setPrepPage((current) => ({ ...current, vocab: page }))}
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
              {visibleChunks.map((chunk, index) => (
                <ChunkPrepCard
                  key={chunk.id}
                  chunk={chunk}
                  collected={collectedTexts.has(chunk.text)}
                  expanded={expandedItemId === chunk.id}
                  onToggle={() => {
                    setExpandedItemId((prev) => {
                      const next = prev === chunk.id ? null : chunk.id
                      if (next) onChunkExpand?.(chunk.id)
                      return next
                    })
                  }}
                  onOpen={() => openDialog('chunk', useLocalIndex || collapsed ? index : chunkPageItems.startIndex + index)}
                  onCollect={() => requestSave({ kind: 'chunk', item: chunk })}
                />
              ))}
              {!collapsed && (
                <PrepPager
                  currentPage={chunkPageItems.currentPage}
                  totalPages={chunkPageItems.totalPages}
                  totalItems={chunkTotal}
                  onPageChange={(page) => setPrepPage((current) => ({ ...current, chunk: page }))}
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
              {visiblePatterns.map((pattern, index) => {
                const absoluteIndex = useLocalIndex || collapsed ? index : patternPageItems.startIndex + index
                const key = pattern.id ?? `${pattern.pattern}-${absoluteIndex}`
                return (
                  <PatternPrepCard
                    key={key}
                    pattern={pattern}
                    collected={collectedTexts.has(pattern.pattern)}
                    expanded={expandedItemId === key}
                    onToggle={() => setExpandedItemId((prev) => (prev === key ? null : key))}
                    onOpen={() => openDialog('pattern', absoluteIndex)}
                    onCollect={() => requestSave({ kind: 'pattern', item: pattern })}
                  />
                )
              })}
              {!collapsed && (
                <PrepPager
                  currentPage={patternPageItems.currentPage}
                  totalPages={patternPageItems.totalPages}
                  totalItems={patternTotal}
                  onPageChange={(page) => setPrepPage((current) => ({ ...current, pattern: page }))}
                />
              )}
            </>
          ) : (
            <EmptyPrepState label={t('learning.noPatterns')} />
          )}
        </TabsContent>
      </Tabs>

      {collapsible && collapsed && (
        <CurrentTabExpandButton itemCount={currentTabCount} onExpand={() => setCollapsed(false)} />
      )}

      <LearningInsightDialog
        items={currentDialogItems}
        index={Math.min(dialogIndex, Math.max(currentDialogItems.length - 1, 0))}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) void refreshCollectedTexts()
        }}
        onIndexChange={setDialogIndex}
      />
      <SaveToNotebookDrawer
        entry={pendingSave ? { kind: pendingSave.kind, text: pendingSave.kind === 'word' ? pendingSave.item.word : pendingSave.kind === 'chunk' ? pendingSave.item.text : pendingSave.item.pattern } : null}
        onRemoved={() => { void refreshCollectedTexts() }}
        open={saveDrawerOpen}
        onOpenChange={setSaveDrawerOpen}
        onSave={savePendingToNotebooks}
      />
    </div>
  )
}
