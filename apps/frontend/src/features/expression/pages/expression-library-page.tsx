import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  BookMarked, Search, Trash2, BookOpen,
  BookText, MessageSquareText, ExternalLink, Layers,
  RotateCcw, CheckCheck, ArrowRightFromLine,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { expressionApi, type MasteryStatus } from '@/features/practice/api/english-practice-api'
import { LearningInsightDialog, type LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import { cn } from '@/lib/cn'
import {
  learningContentRepository,
  type ExpressionEntry,
  type ExpressionEntryKind,
} from '@/lib/offline'

type LibraryTab = 'words' | 'chunk' | 'pattern'

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; nextReviewAt?: string | null; lastReviewedAt?: string | null
  createdAt: string
  localKind?: ExpressionEntryKind
  localEntry?: ExpressionEntry
  vocabulary?: {
    id: string; word: string; meaning: string; partOfSpeech?: string | null;
    phoneticUs?: string | null; phoneticUk?: string | null;
    audioUsUrl?: string | null; audioUkUrl?: string | null;
    definitionEn?: string | null; synonyms?: string[];
    examples?: unknown; description?: string | null;
    difficulty?: string;
  } | null
}

interface PageResult {
  items: Expression[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PAGE_SIZE = 30

function createLocalResult(items: Expression[]): PageResult {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: items.length > 0 ? 1 : 0,
  }
}

function expressionEntryToExpression(entry: ExpressionEntry): Expression {
  const snapshot = entry.contentSnapshot ?? {}
  if (entry.kind === 'word') {
    const word = snapshot.word ?? entry.original ?? ''
    return {
      id: entry.id,
      type: 'word',
      original: word,
      corrected: snapshot.description ?? entry.corrected ?? null,
      chunkText: snapshot.meaning ?? entry.chunkText ?? null,
      sceneName: snapshot.sceneName ?? entry.sceneName ?? null,
      masteryStatus: entry.masteryStatus,
      reviewCount: entry.reviewCount ?? 0,
      lastReviewedAt: entry.lastReviewedAt,
      nextReviewAt: entry.nextReviewAt,
      createdAt: entry.createdAt,
      localKind: entry.kind,
      localEntry: entry,
      vocabulary: {
        id: snapshot.id ?? entry.id,
        word,
        meaning: snapshot.meaning ?? entry.chunkText ?? '',
        partOfSpeech: snapshot.partOfSpeech,
        phoneticUs: snapshot.phoneticUs,
        phoneticUk: snapshot.phoneticUk,
        audioUsUrl: snapshot.audioUsUrl,
        audioUkUrl: snapshot.audioUkUrl,
        definitionEn: snapshot.definitionEn,
        synonyms: snapshot.synonyms,
        examples: snapshot.examples,
        description: snapshot.description ?? entry.corrected,
        difficulty: snapshot.difficulty,
      },
    }
  }

  if (entry.kind === 'pattern') {
    return {
      id: entry.id,
      type: 'scene_phrase',
      original: snapshot.meaning ?? entry.original ?? null,
      corrected: snapshot.example ?? entry.corrected ?? entry.chunkText ?? null,
      chunkText: snapshot.pattern ?? entry.chunkText ?? null,
      sceneName: snapshot.sceneName ?? entry.sceneName ?? null,
      masteryStatus: entry.masteryStatus,
      reviewCount: entry.reviewCount ?? 0,
      lastReviewedAt: entry.lastReviewedAt,
      nextReviewAt: entry.nextReviewAt,
      createdAt: entry.createdAt,
      localKind: entry.kind,
      localEntry: entry,
    }
  }

  return {
    id: entry.id,
    type: 'chunk',
    original: snapshot.meaning ?? entry.original ?? null,
    corrected: snapshot.text ?? entry.corrected ?? entry.chunkText ?? null,
    chunkText: snapshot.text ?? entry.chunkText ?? null,
    sceneName: snapshot.sceneName ?? entry.sceneName ?? null,
    masteryStatus: entry.masteryStatus,
    reviewCount: entry.reviewCount ?? 0,
    lastReviewedAt: entry.lastReviewedAt,
    nextReviewAt: entry.nextReviewAt,
    createdAt: entry.createdAt,
    localKind: entry.kind,
    localEntry: entry,
  }
}

export function ExpressionLibraryPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('words')
  const [reviewState, setReviewState] = useState<MasteryStatus>('learning')

  // 后端分页数据
  const [result, setResult] = useState<PageResult>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])

  // 展开的列表项
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [handledDeepLink, setHandledDeepLink] = useState('')

  // ---- 核心数据请求：一级 tab + 二级 tab 都作为查询参数传给后端 ----
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const apiType = libraryTab === 'words' ? 'word' : libraryTab === 'pattern' ? 'scene_phrase' : 'chunk'
      const localKind: ExpressionEntryKind = libraryTab === 'words' ? 'word' : libraryTab
      const localItems = (await learningContentRepository.listExpressionEntries(localKind)).map(expressionEntryToExpression)

      if (localItems.length > 0) {
        const filteredLocalItems = localItems.filter((item) => item.masteryStatus === reviewState)
        setResult(createLocalResult(filteredLocalItems))
        return
      }

      const raw: any = await expressionApi.list({
        type: apiType,
        reviewState,
        page: 1,
        pageSize: PAGE_SIZE,
      })
      // 响应拦截器已解包 data.data，直接拿结果
      if (raw && Array.isArray(raw.items)) {
        setResult(raw as PageResult)
      } else if (Array.isArray(raw)) {
        // 兼容旧版返回纯数组
        setResult({ items: raw, total: raw.length, page: 1, pageSize: PAGE_SIZE, totalPages: 1 })
      } else if (raw?.data && Array.isArray(raw.data.items)) {
        setResult(raw.data as PageResult)
      } else {
        setResult({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
      }
    } catch {
      setResult({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
    } finally {
      setLoading(false)
    }
  }, [libraryTab, reviewState])

  const deepLinkKind = searchParams.has('word')
    ? 'word'
    : searchParams.has('chunk')
      ? 'chunk'
      : searchParams.has('pattern')
        ? 'pattern'
        : null
  const deepLinkValue = deepLinkKind ? searchParams.get(deepLinkKind)?.trim() ?? '' : ''

  useEffect(() => {
    if (!deepLinkKind || !deepLinkValue) return
    setLibraryTab(deepLinkKind === 'word' ? 'words' : deepLinkKind)
    setReviewState('learning')
    setExpandedItemId(null)
  }, [deepLinkKind, deepLinkValue])

  // 一级 tab 或二级 tab 变化时重新请求
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 切换一级 tab 时重置二级 tab
  const handleLibraryTabChange = useCallback((value: string) => {
    setLibraryTab(value as LibraryTab)
    setReviewState('learning')
    setExpandedItemId(null)
    setHandledDeepLink('')
    setSearchParams({})
  }, [setSearchParams])

  // ---- dialog ----
  const apiType = libraryTab === 'words' ? 'word' : libraryTab === 'pattern' ? 'scene_phrase' : 'chunk'
  const visibleDialogItems: LearningInsightItem[] = result.items.map((expr) => {
    if (apiType === 'word') {
      const vocab = expr.vocabulary
      return {
        kind: 'word' as const,
        id: `word:${expr.original ?? expr.id}`,
        word: vocab?.word ?? expr.original ?? '',
        meaning: vocab?.meaning ?? expr.chunkText ?? expr.corrected ?? undefined,
        partOfSpeech: vocab?.partOfSpeech,
        phoneticUs: vocab?.phoneticUs,
        phoneticUk: vocab?.phoneticUk,
        audioUsUrl: vocab?.audioUsUrl,
        audioUkUrl: vocab?.audioUkUrl,
        definitionEn: vocab?.definitionEn,
        synonyms: vocab?.synonyms,
        examples: vocab?.examples,
        description: vocab?.description ?? (expr.corrected && expr.corrected !== expr.chunkText ? expr.corrected : undefined),
        difficulty: vocab?.difficulty,
        sceneName: expr.sceneName ?? undefined,
      }
    }
    if (apiType === 'scene_phrase') {
      const cacheEntry = expr.localEntry?.contentSnapshot
      return {
        kind: 'pattern' as const,
        id: expr.id,
        pattern: expr.chunkText ?? expr.corrected ?? '',
        meaning: expr.original ?? '',
        slots: cacheEntry?.slots,
        example: cacheEntry?.example,
        difficulty: cacheEntry?.difficulty,
        sceneName: expr.sceneName ?? undefined,
      }
    }
    const cacheEntry = expr.localEntry?.contentSnapshot
    return {
      kind: 'chunk' as const,
      id: expr.id,
      text: expr.chunkText ?? expr.corrected ?? '',
      meaning: expr.original ?? '',
      description: cacheEntry?.description,
      examples: cacheEntry?.examples as any,
      sceneName: expr.sceneName ?? undefined,
      saved: true, // 已在学习库中
    }
  })

  const openDialog = useCallback((items: LearningInsightItem[], startIndex: number) => {
    if (items.length === 0) return
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [])

  useEffect(() => {
    if (!deepLinkKind || !deepLinkValue || loading) return
    const key = `${deepLinkKind}:${deepLinkValue}`
    if (handledDeepLink === key) return

    const target = deepLinkValue.toLowerCase()
    const index = visibleDialogItems.findIndex((item) => {
      if (item.kind === 'word') return item.word.toLowerCase() === target
      if (item.kind === 'chunk') return item.text.toLowerCase() === target
      return item.pattern.toLowerCase() === target
    })
    const fallbackItem: LearningInsightItem =
      deepLinkKind === 'word'
        ? { kind: 'word', id: `word:${deepLinkValue}`, word: deepLinkValue }
        : deepLinkKind === 'chunk'
          ? { kind: 'chunk', id: `chunk:${deepLinkValue}`, text: deepLinkValue, meaning: '' }
          : { kind: 'pattern', id: `pattern:${deepLinkValue}`, pattern: deepLinkValue }

    if (index >= 0) {
      openDialog(visibleDialogItems, index)
    } else {
      openDialog([fallbackItem], 0)
    }
    setHandledDeepLink(key)
  }, [deepLinkKind, deepLinkValue, handledDeepLink, loading, openDialog, visibleDialogItems])

  // ---- 状态变更 ----
  const handleUpdateStatus = useCallback(async (id: string, status: MasteryStatus) => {
    const target = result.items.find((item) => item.id === id)
    if (target?.localKind) {
      const text = target.localKind === 'word'
        ? target.original ?? id
        : target.chunkText ?? target.corrected ?? id
      await learningContentRepository.updateExpressionStatusAndSync(target.localKind, text, status)
      toast.success(status === 'learning' ? t('expressionLib.movedToLearning') : status === 'reviewing' ? t('expressionLib.movedToReview') : t('expressionLib.movedToMastered'))
      fetchData()
      return
    }
    try {
      await expressionApi.updateStatus(id, status)
      toast.success(status === 'learning' ? t('expressionLib.movedToLearning') : status === 'reviewing' ? t('expressionLib.movedToReview') : t('expressionLib.movedToMastered'))
      fetchData()
    } catch {
      toast.error(t('expressionLib.operationFailed'))
    }
  }, [fetchData, result.items, t])

  // ---- 删除操作 ----
  const handleRemove = useCallback(async (id: string) => {
    const target = result.items.find((item) => item.id === id)
    try {
      if (target?.localKind) {
        const text = target.localKind === 'word'
          ? target.original ?? id
          : target.chunkText ?? target.corrected ?? id

        await learningContentRepository.deleteExpressionByTextAndSync(target.localKind, text)
        setResult((current) => {
          const nextItems = current.items.filter((item) => item.id !== id)
          return createLocalResult(nextItems)
        })
        toast.success(t('expressionLib.removed'))
        return
      }

      await expressionApi.remove(id)
      toast.success(t('expressionLib.removed'))
      fetchData()
    } catch {
      toast.error(t('expressionLib.removeFailed'))
    }
  }, [fetchData, result.items, t])

  // ---- 二级状态过滤 ----
  const filterPills = [
    { value: 'learning' as MasteryStatus, label: t('expressionLib.done') },
    { value: 'reviewing' as MasteryStatus, label: t('expressionLib.reviewing') },
    { value: 'mastered' as MasteryStatus, label: t('expressionLib.mastered') },
  ]

  // ---- empty state ----
  const emptyState = (icon: React.ReactNode, title: string, hint?: string) => (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="text-muted-foreground/40">{icon}</div>
      <p className="mt-4 text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  )

  // ---- 列表项渲染 ----
  const renderExpressionItem = (expr: Expression, index: number) => {
    const isWord = expr.type === 'word'
    const isPattern = expr.type === 'scene_phrase'
    const text = isWord ? (expr.original ?? '') : (expr.chunkText ?? expr.corrected ?? '')
    const displayKey = isWord ? (expr.original ?? expr.id) : expr.id
    const isExpanded = expandedItemId === displayKey

    const iconEl = isWord ? (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <BookText className="size-4" />
      </div>
    ) : isPattern ? (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
        <Layers className="size-4" />
      </div>
    ) : (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <MessageSquareText className="size-4" />
      </div>
    )

    return (
      <Card key={displayKey} className={cn(
        'border-0 bg-muted/30 shadow-none transition-colors',
        isExpanded && 'bg-primary/[0.06]',
      )}>
        <CardContent className="p-0">
          <button
            type="button"
            className="flex w-full items-center gap-3 p-3 text-left"
            onClick={() => setExpandedItemId((prev) => (prev === displayKey ? null : displayKey))}
          >
            {iconEl}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{text}</p>
                {expr.reviewCount > 0 && (
                  <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">
                    {t('expressionLib.reviewedCount', { count: expr.reviewCount })}
                  </Badge>
                )}
              </div>
              {expr.sceneName && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{expr.sceneName}</p>
              )}
              {isWord && expr.createdAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('expressionLib.collectedAt', { date: new Date(expr.createdAt).toLocaleDateString('zh-CN') })}
                </p>
              )}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-0.5">
              {(expr.masteryStatus === 'learning' || expr.masteryStatus === 'activated') && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'reviewing') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-primary hover:bg-primary/10"
                >
                  <ArrowRightFromLine className="size-3.5" />
                </span>
              )}
              {expr.masteryStatus === 'reviewing' && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'learning') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-amber-500 hover:bg-amber-500/10"
                >
                  <RotateCcw className="size-3.5" />
                </span>
              )}
              {expr.masteryStatus === 'mastered' && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'reviewing') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                </span>
              )}
              {(expr.masteryStatus === 'learning' || expr.masteryStatus === 'activated' || expr.masteryStatus === 'reviewing') && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'mastered') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-emerald-500 hover:bg-emerald-500/10"
                >
                  <CheckCheck className="size-3.5" />
                </span>
              )}
              {expr.masteryStatus === 'mastered' && <span />}
              <span
                onClick={(e) => { e.stopPropagation(); openDialog(visibleDialogItems, index) }}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Search className="size-3.5" />
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); handleRemove(expr.id) }}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
              >
                <Trash2 className="size-3.5" />
              </span>
            </div>
          </button>

          {isExpanded && (
            <div className="border-t border-border/50 px-3 pb-3 pt-2">
              {/* 显示简要意思 */}
              {isWord ? (
                <div className="rounded-md bg-muted/45 p-2.5">
                  <p className="text-xs leading-5 text-muted-foreground">{expr.chunkText || expr.corrected || t('expressionLib.noMeaning')}</p>
                </div>
              ) : (
                <div className="rounded-md bg-muted/45 p-2.5">
                  <p className="text-xs font-medium leading-5 text-foreground">{text}</p>
                  {expr.original && (
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{expr.original}</p>
                  )}
                </div>
              )}

              {/* 展开后显示复习信息 */}
              {/* {expr.lastReviewedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('expressionLib.lastReview')}{new Date(expr.lastReviewedAt).toLocaleDateString('zh-CN')}
                </p>
              )} */}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const emptyHintMap: Record<string, { icon: React.ReactNode; title: string; hint?: string }> = {
    'words-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyWords'), hint: t('expressionLib.hintCollectInUnit') },
    'words-learning': { icon: <BookOpen className="size-12" />, title: t('expressionLib.emptyWordsDone') },
    'words-mastered': { icon: <BookOpen className="size-12" />, title: t('expressionLib.emptyWordsDone') },
    'chunk-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunks'), hint: t('expressionLib.hintAutoCollect') },
    'chunk-learning': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunksDone') },
    'chunk-mastered': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunksMastered') },
    'pattern-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatterns'), hint: t('expressionLib.hintCollectPatterns') },
    'pattern-learning': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatternsDone') },
    'pattern-mastered': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatternsMastered') },
  }

  const emptyKey = `${libraryTab}-${reviewState}`
  const empty = emptyHintMap[emptyKey]

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
      <Tabs value={libraryTab} onValueChange={handleLibraryTabChange}>
        <TabsList className="mb-3 w-full rounded-full bg-background/54 backdrop-blur-2xl">
          <TabsTrigger value="words" className="flex-1 rounded-full">{t('expressionLib.words')}</TabsTrigger>
          <TabsTrigger value="chunk" className="flex-1 rounded-full">{t('expressionLib.chunks')}</TabsTrigger>
          <TabsTrigger value="pattern" className="flex-1 rounded-full">{t('expressionLib.patterns')}</TabsTrigger>
        </TabsList>

        {/* ---- 二级状态过滤 ---- */}
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {filterPills.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setReviewState(item.value)
                setExpandedItemId(null)
              }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                reviewState === item.value
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 两个 TabsContent 共享同一套渲染逻辑 */}
        <TabsContent value="words" forceMount className="data-[state=inactive]:hidden">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
                <button
                  onClick={() => openDialog(visibleDialogItems, 0)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="size-3" /> {t('expressionLib.immersive')}
                </button>
              </div>
              <div className="space-y-2">
                {result.items.map((expr, i) => renderExpressionItem(expr, i))}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t('expressionLib.totalItems', { count: result.total })}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chunk" forceMount className="data-[state=inactive]:hidden">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
                <button
                  onClick={() => openDialog(visibleDialogItems, 0)}
                  className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600"
                >
                  <ExternalLink className="size-3" /> {t('expressionLib.immersive')}
                </button>
              </div>
              <div className="space-y-2">
                {result.items.map((expr, i) => renderExpressionItem(expr, i))}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t('expressionLib.totalItems', { count: result.total })}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pattern" forceMount className="data-[state=inactive]:hidden">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
                <button
                  onClick={() => openDialog(visibleDialogItems, 0)}
                  className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600"
                >
                  <ExternalLink className="size-3" /> {t('expressionLib.immersive')}
                </button>
              </div>
              <div className="space-y-2">
                {result.items.map((expr, i) => renderExpressionItem(expr, i))}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t('expressionLib.totalItems', { count: result.total })}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LearningInsightDialog
        items={dialogItems} index={dialogIndex} open={dialogOpen}
        onOpenChange={setDialogOpen} onIndexChange={setDialogIndex}
        hideSaveActions
      />
    </div>
  )
}
