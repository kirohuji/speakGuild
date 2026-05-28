import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookMarked, Search, Trash2, BookOpen,
  BookText, MessageSquareText, ChevronRight, ExternalLink, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { expressionApi } from '@/features/practice/api/english-practice-api'
import { LearningInsightDialog, type LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import { cn } from '@/lib/cn'

type LibraryTab = 'words' | 'chunk' | 'pattern'
type ReviewState = 'reviewing' | 'done' | 'mastered'

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; nextReviewAt?: string | null; lastReviewedAt?: string | null
  createdAt: string
}

interface PageResult {
  items: Expression[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PAGE_SIZE = 30

export function ExpressionLibraryPage() {
  const { t } = useTranslation()
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('words')
  const [reviewState, setReviewState] = useState<ReviewState>('reviewing')

  // 后端分页数据
  const [result, setResult] = useState<PageResult>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
  const [loading, setLoading] = useState(false)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])

  // 展开的列表项
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // ---- 核心数据请求：一级 tab + 二级 tab 都作为查询参数传给后端 ----
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const apiType = libraryTab === 'words' ? 'word' : 'chunk'
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

  // 一级 tab 或二级 tab 变化时重新请求
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 切换一级 tab 时重置二级 tab
  const handleLibraryTabChange = useCallback((value: string) => {
    setLibraryTab(value as LibraryTab)
    setReviewState('reviewing')
    setExpandedItemId(null)
  }, [])

  // ---- dialog ----
  const apiType = libraryTab === 'words' ? 'word' : libraryTab === 'pattern' ? 'scene_phrase' : 'chunk'
  const visibleDialogItems: LearningInsightItem[] = result.items.map((expr) => {
    if (apiType === 'word') {
      return {
        kind: 'word' as const,
        id: `word:${expr.original ?? expr.id}`,
        word: expr.original ?? '',
      }
    }
    if (apiType === 'scene_phrase') {
      return {
        kind: 'pattern' as const,
        id: expr.id,
        pattern: expr.chunkText ?? expr.corrected ?? '',
        meaning: expr.original ?? '',
        sceneName: expr.sceneName ?? undefined,
      }
    }
    return {
      kind: 'chunk' as const,
      id: expr.id,
      text: expr.chunkText ?? expr.corrected ?? '',
      meaning: expr.original ?? '',
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

  // ---- 删除操作 ----
  const handleRemove = useCallback(async (id: string) => {
    try {
      await expressionApi.remove(id)
      toast.success(t('expressionLib.removed'))
      fetchData()
    } catch {
      toast.error(t('expressionLib.removeFailed'))
    }
  }, [fetchData, t])

  // ---- counts for filter pills (from backend total) ----
  // 由于后端只返回当前筛选结果，我们无法直接拿到其他状态的 count
  // 这里做一个轻量级的额外请求或者在切换时更新
  // 简化方案：pills 显示当前结果数量
  const filterPills = [
    { value: 'reviewing' as ReviewState, label: t('expressionLib.reviewing') },
    { value: 'done' as ReviewState, label: t('expressionLib.done') },
    { value: 'mastered' as ReviewState, label: t('expressionLib.mastered') },
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
            <div className="flex shrink-0 items-center gap-1">
              <span
                onClick={(e) => { e.stopPropagation(); openDialog(visibleDialogItems, index) }}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                title={t('expressionLib.search')}
              >
                <Search className="size-3.5" />
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); handleRemove(expr.id) }}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
                title={t('expressionLib.remove')}
              >
                <Trash2 className="size-3.5" />
              </span>
              <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
            </div>
          </button>
          {isExpanded && (
            <div className="border-t border-border/50 px-3 pb-3 pt-2">
              {expr.original && !isWord && (
                <div className="mb-3 rounded-md bg-muted/45 p-2.5">
                  <p className="text-xs font-medium leading-5 text-foreground">{text}</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{expr.original}</p>
                </div>
              )}
              {expr.lastReviewedAt && (
                <p className="text-xs text-muted-foreground">
                  {t('expressionLib.lastReview')}{new Date(expr.lastReviewedAt).toLocaleDateString('zh-CN')}
                </p>
              )}
              <Button
                size="sm" variant="outline"
                className="mt-2 h-8 w-full gap-1.5 text-xs"
                onClick={() => openDialog(visibleDialogItems, index)}
              >
                <Search className="size-3.5" /> {t('expressionLib.viewDetail')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const emptyHintMap: Record<string, { icon: React.ReactNode; title: string; hint?: string }> = {
    'words-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyWords'), hint: t('expressionLib.hintCollectInUnit') },
    'words-done': { icon: <BookOpen className="size-12" />, title: t('expressionLib.emptyWordsDone') },
    'words-mastered': { icon: <BookOpen className="size-12" />, title: t('expressionLib.emptyWordsDone') },
    'chunk-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunks'), hint: t('expressionLib.hintAutoCollect') },
    'chunk-done': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunksDone') },
    'chunk-mastered': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunksMastered') },
    'pattern-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatterns'), hint: t('expressionLib.hintCollectPatterns') },
    'pattern-done': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatternsDone') },
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
      />
    </div>
  )
}
