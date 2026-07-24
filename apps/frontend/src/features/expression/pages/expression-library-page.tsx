import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BookMarked, Search, Trash2, BookOpen,
  BookText, MessageSquareText, ExternalLink, Layers,
  RotateCcw, CheckCheck, ArrowRightFromLine,
  ArrowLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { toast } from 'sonner'
import { expressionApi, learningNotebookApi, type MasteryStatus } from '@/features/practice/api/english-practice-api'
import { LearningInsightDialog, type LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import { ImmersivePlayerDialog, mapInsightItemsToImmersiveItems, type ImmersivePlayerItem } from '@/features/learning/components/immersive-player'
import { cn } from '@/lib/cn'
import { extractCoreUsage } from '@/lib/markdown-utils'
import { isNative } from '@/lib/native'

type LibraryTab = 'words' | 'chunk' | 'pattern'
const LIBRARY_TABS: LibraryTab[] = ['words', 'chunk', 'pattern']
const TAB_SWIPE_DISTANCE = 70

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  notebookItemId?: string
  notebookId?: string
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; nextReviewAt?: string | null; lastReviewedAt?: string | null
  createdAt: string
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

function normalizePageResult(raw: any): PageResult {
  if (raw && Array.isArray(raw.items)) {
    return raw as PageResult
  }
  if (Array.isArray(raw)) {
    return { items: raw, total: raw.length, page: 1, pageSize: PAGE_SIZE, totalPages: raw.length > 0 ? 1 : 0 }
  }
  if (raw?.data && Array.isArray(raw.data.items)) {
    return raw.data as PageResult
  }
  return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 }
}

export function ExpressionLibraryPage() {
  const { t } = useTranslation()
  const { notebookId } = useParams<{ notebookId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notebookName, setNotebookName] = useState('学习本')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('words')
  const [reviewState, setReviewState] = useState<MasteryStatus>('learning')

  // 后端分页数据
  const [result, setResult] = useState<PageResult>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [immersiveIndex, setImmersiveIndex] = useState(0)
  const [immersiveItems, setImmersiveItems] = useState<ImmersivePlayerItem[]>([])

  // 展开的列表项
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [handledDeepLink, setHandledDeepLink] = useState('')
  const tabSwipeRef = useRef({ x: 0, y: 0, blocked: false })

  // ---- 核心数据请求：一级 tab + 二级 tab 都作为查询参数传给后端 ----
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const apiType = libraryTab === 'words' ? 'word' : libraryTab === 'pattern' ? 'scene_phrase' : 'chunk'
      if (!notebookId) throw new Error('Missing notebookId')
      const raw: any = await expressionApi.list({
        type: apiType,
        reviewState,
        notebookId,
        page: 1,
        pageSize: PAGE_SIZE,
      })
      setResult(normalizePageResult(raw))
    } catch {
      setResult({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
    } finally {
      setLoading(false)
    }
  }, [libraryTab, notebookId, reviewState])

  useEffect(() => {
    if (!notebookId) return
    learningNotebookApi.list()
      .then((data) => {
        const notebook = data.items.find((item) => item.id === notebookId)
        if (notebook) setNotebookName(notebook.name)
      })
      .catch(() => undefined)
  }, [notebookId])

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

  useEffect(() => {
    document.body.dataset.mobileExpressionTab = libraryTab
    return () => {
      delete document.body.dataset.mobileExpressionTab
    }
  }, [libraryTab])

  useEffect(() => {
    if (!isNative()) return

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      tabSwipeRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        blocked: Boolean(
          event.target instanceof HTMLElement
            && event.target.closest('button,a,input,textarea,select,[role="button"],[role="dialog"],[data-mobile-gesture-block]'),
        ),
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      const start = tabSwipeRef.current
      if (start.blocked) return
      const touch = event.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.abs(dx) < TAB_SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.4) return

      const currentIndex = LIBRARY_TABS.indexOf(libraryTab)
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1
      const nextTab = LIBRARY_TABS[nextIndex]
      if (!nextTab) return

      handleLibraryTabChange(nextTab)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleLibraryTabChange, libraryTab])

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
      const remoteData = (expr as any).contentData
      return {
        kind: 'pattern' as const,
        id: expr.id,
        pattern: expr.chunkText ?? expr.corrected ?? '',
        meaning: expr.original ?? '',
        slots: remoteData?.slots,
        example: remoteData?.example,
        description: remoteData?.description,
        examples: remoteData?.examples,
        difficulty: remoteData?.difficulty,
        sceneName: expr.sceneName ?? undefined,
      }
    }
    const remoteData = (expr as any).contentData
    return {
      kind: 'chunk' as const,
      id: expr.id,
      text: expr.chunkText ?? expr.corrected ?? '',
      meaning: expr.original ?? '',
      description: remoteData?.description,
      examples: remoteData?.examples as any,
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

  const openImmersivePlayer = useCallback((items: LearningInsightItem[], startIndex: number) => {
    const mappedItems = mapInsightItemsToImmersiveItems(items)
    if (mappedItems.length === 0) return
    setImmersiveItems(mappedItems)
    setImmersiveIndex(Math.min(startIndex, mappedItems.length - 1))
    setImmersiveOpen(true)
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
    if (!target?.notebookItemId) return
    try {
      await expressionApi.updateNotebookItemStatus(target.notebookItemId, status)
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
      if (!target?.notebookItemId) return
      await expressionApi.removeNotebookItem(target.notebookItemId)
      setResult((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== id),
        total: Math.max(0, current.total - 1),
      }))
      toast.success(t('expressionLib.removed'))
    } catch {
      toast.error(t('expressionLib.removeFailed'))
    }
  }, [result.items, t])

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
    const insight = visibleDialogItems[index]
    const meaning = insight?.kind === 'word'
      ? insight.meaning
      : insight?.kind === 'chunk'
        ? insight.meaning
        : insight?.kind === 'pattern'
          ? insight.meaning
          : undefined

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
              {meaning && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{meaning}</p>
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
              {insight?.kind === 'word' && insight.description && (
                <div className="line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                  <MarkdownContent content={extractCoreUsage(insight.description)} />
                </div>
              )}
              {insight?.kind === 'chunk' && (
                <div className="space-y-2">
                  {insight.description && (
                    <div className="line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                      <MarkdownContent content={extractCoreUsage(insight.description)} />
                    </div>
                  )}
                  {insight.examples?.slice(0, 1).map((example, exampleIndex) => (
                    <div key={`${insight.id}-${exampleIndex}`} className="rounded-md bg-muted/60 p-2.5">
                      <p className="text-xs font-medium text-foreground">{example.en}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{example.zh}</p>
                      {example.note && <p className="mt-1 text-[11px] text-muted-foreground">{example.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {insight?.kind === 'pattern' && insight.example && (
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('practiceSession.example')}: {insight.example}
                </p>
              )}
              {!insight && (
                <p className="text-xs leading-5 text-muted-foreground">{expr.chunkText || expr.corrected || t('expressionLib.noMeaning')}</p>
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
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/expressions')}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
          aria-label="返回学习本"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">学习本</p>
          <h1 className="truncate text-lg font-semibold tracking-tight">{notebookName}</h1>
        </div>
      </header>
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
            <MobilePageLoading rows={3} minHeightClassName="min-h-[32vh]" />
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
                <button
                  onClick={() => openImmersivePlayer(visibleDialogItems, 0)}
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
            <MobilePageLoading rows={3} minHeightClassName="min-h-[32vh]" />
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
                <button
                  onClick={() => openImmersivePlayer(visibleDialogItems, 0)}
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
            <MobilePageLoading rows={3} minHeightClassName="min-h-[32vh]" />
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
                <button
                  onClick={() => openImmersivePlayer(visibleDialogItems, 0)}
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
      <ImmersivePlayerDialog
        items={immersiveItems}
        index={Math.min(immersiveIndex, Math.max(immersiveItems.length - 1, 0))}
        open={immersiveOpen}
        onOpenChange={setImmersiveOpen}
        onIndexChange={setImmersiveIndex}
      />
    </div>
  )
}
