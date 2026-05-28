import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookMarked, RefreshCw, ExternalLink, Search,
  Trash2, Eye, EyeOff, Check, X, BookOpen,
  BookText, MessageSquareText, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { expressionApi } from '@/features/practice/api/english-practice-api'
import { LearningInsightDialog, type LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import { cn } from '@/lib/cn'
import { useWordsStore } from '@/stores/assets.store'

type LibraryTab = 'words' | 'chunk'
type ReviewState = 'reviewing' | 'done' | 'mastered'

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; nextReviewAt?: string | null; lastReviewedAt?: string | null
  createdAt: string
}

export function ExpressionLibraryPage() {
  const { t } = useTranslation()
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('words')
  const [reviewState, setReviewState] = useState<ReviewState>('reviewing')
  const { entries: wordEntries, removeWord } = useWordsStore()

  // Chunk data from backend
  const [allChunks, setAllChunks] = useState<Expression[]>([])
  const [reviewChunks, setReviewChunks] = useState<Expression[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])

  // 展开的列表项
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Review
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')

  // ---- fetch chunk data ----
  const fetchChunks = useCallback(async () => {
    setChunksLoading(true)
    try {
      const [all, review] = await Promise.all([
        expressionApi.list({ type: 'chunk' }).catch(() => []),
        expressionApi.getReview().catch(() => []),
      ])
      setAllChunks(Array.isArray(all) ? all : all?.data ?? [])
      setReviewChunks(Array.isArray(review) ? review : review?.data ?? [])
    } catch {
      setAllChunks([])
      setReviewChunks([])
    } finally {
      setChunksLoading(false)
    }
  }, [])

  useEffect(() => {
    if (libraryTab === 'chunk') fetchChunks()
  }, [libraryTab, fetchChunks])

  // ---- computed visible data ----
  const dueReviewIds = new Set(reviewChunks.map((item) => item.id))

  // 已复习过但不在待复习列表中的 = "已标熟" (done)
  const doneChunks = allChunks.filter(
    (c) => c.reviewCount > 0 && !dueReviewIds.has(c.id) && c.masteryStatus !== 'mastered',
  )
  // masteryStatus === 'mastered' = 已掌握
  const masteredChunks = allChunks.filter((c) => c.masteryStatus === 'mastered')

  const visibleChunks =
    reviewState === 'reviewing'
      ? reviewChunks
      : reviewState === 'done'
        ? doneChunks
        : masteredChunks

  const visibleChunkDialogItems: LearningInsightItem[] = visibleChunks.map((expr) => ({
    kind: 'chunk',
    id: expr.id,
    text: expr.chunkText ?? expr.corrected ?? '',
    meaning: expr.original ?? '',
    sceneName: expr.sceneName ?? undefined,
  }))

  const wordDialogItems: LearningInsightItem[] = wordEntries.map((entry) => ({
    kind: 'word', id: `word:${entry.word}`, word: entry.word,
  }))

  const openDialog = useCallback((items: LearningInsightItem[], startIndex: number) => {
    if (items.length === 0) return
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [])

  const refreshAfterReview = () => {
    fetchChunks()
  }

  // ---- counts ----
  const filterPills = [
    {
      value: 'reviewing' as ReviewState,
      label: t('expressionLib.reviewing'),
      count: libraryTab === 'words' ? wordEntries.length : reviewChunks.length,
    },
    {
      value: 'done' as ReviewState,
      label: t('expressionLib.done'),
      count: libraryTab === 'words' ? 0 : doneChunks.length,
    },
    {
      value: 'mastered' as ReviewState,
      label: t('expressionLib.mastered'),
      count: libraryTab === 'words' ? 0 : masteredChunks.length,
    },
  ]

  // ---- empty states ----
  const emptyState = (icon: React.ReactNode, title: string, hint?: string) => (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="text-muted-foreground/40">{icon}</div>
      <p className="mt-4 text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
      <Tabs value={libraryTab} onValueChange={(value) => setLibraryTab(value as LibraryTab)}>
        <TabsList className="mb-3 w-full rounded-full bg-background/54 backdrop-blur-2xl">
          <TabsTrigger value="words" className="flex-1 rounded-full">{t('expressionLib.words')}</TabsTrigger>
          <TabsTrigger value="chunk" className="flex-1 rounded-full">{t('expressionLib.chunks')}</TabsTrigger>
        </TabsList>

        {/* ---- 状态过滤 ---- */}
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {filterPills.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setReviewState(item.value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                reviewState === item.value
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {item.label}
              <span className="ml-1 opacity-70">{item.count}</span>
            </button>
          ))}
        </div>

        {/* ═══ 单词 ═══ */}
        <TabsContent value="words">
          {reviewState !== 'reviewing' ? (
            emptyState(<BookOpen className="size-12" />, t('expressionLib.emptyWordsDone'))
          ) : wordEntries.length === 0 ? (
            emptyState(<BookMarked className="size-12" />, t('expressionLib.emptyWords'), t('expressionLib.hintCollectInUnit'))
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
                <button onClick={() => openDialog(wordDialogItems, 0)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
                  <ExternalLink className="size-3" /> {t('expressionLib.immersive')}
                </button>
              </div>
              <div className="space-y-2">
                {wordEntries.map((entry, i) => {
                  const isExpanded = expandedItemId === entry.word
                  return (
                    <Card key={entry.word} className={cn(
                      'border-0 bg-muted/30 shadow-none transition-colors',
                      isExpanded && 'bg-primary/[0.06]',
                    )}>
                      <CardContent className="p-0">
                        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setExpandedItemId((prev) => (prev === entry.word ? null : entry.word))}>
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            <BookText className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{entry.word}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              收藏于 {new Date(entry.addedAt).toLocaleDateString('zh-CN')}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span onClick={(e) => { e.stopPropagation(); openDialog(wordDialogItems, i) }}
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={t('expressionLib.search')}>
                              <Search className="size-3.5" />
                            </span>
                            <span onClick={(e) => { e.stopPropagation(); removeWord(entry.word); toast.success(t('expressionLib.removed')) }}
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
                              title={t('expressionLib.remove')}>
                              <Trash2 className="size-3.5" />
                            </span>
                            <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                          </div>
                        </button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t('expressionLib.totalWords', { count: wordEntries.length })}
              </p>
            </div>
          )}
        </TabsContent>

        {/* ═══ 句块 ═══ */}
        <TabsContent value="chunk">
          {chunksLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : visibleChunks.length === 0 ? (
            reviewState === 'reviewing'
              ? emptyState(<BookMarked className="size-12" />, t('expressionLib.emptyChunks'), t('expressionLib.hintAutoCollect'))
              : reviewState === 'done'
                ? emptyState(<BookMarked className="size-12" />, t('expressionLib.emptyChunksDone'))
                : emptyState(<BookMarked className="size-12" />, t('expressionLib.emptyChunksMastered'))
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">点击查看详情 · 右侧按钮沉浸式学习</span>
                <button onClick={() => openDialog(visibleChunkDialogItems, 0)}
                  className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600">
                  <ExternalLink className="size-3" /> 沉浸式
                </button>
              </div>
              <div className="space-y-2">
                {visibleChunks.map((expr, i) => {
                  const text = expr.chunkText ?? expr.corrected ?? ''
                  const isExpanded = expandedItemId === expr.id
                  return (
                    <Card key={expr.id} className={cn(
                      'border-0 bg-muted/30 shadow-none transition-colors',
                      isExpanded && 'bg-primary/[0.06]',
                    )}>
                      <CardContent className="p-0">
                        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setExpandedItemId((prev) => (prev === expr.id ? null : expr.id))}>
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <MessageSquareText className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">{text}</p>
                              {expr.reviewCount > 0 && (
                                <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">已复习{expr.reviewCount}次</Badge>
                              )}
                            </div>
                            {expr.sceneName && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{expr.sceneName}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span onClick={(e) => { e.stopPropagation(); openDialog(visibleChunkDialogItems, i) }}
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="查询">
                              <Search className="size-3.5" />
                            </span>
                            <span onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                await expressionApi.remove(expr.id)
                                toast.success('已移除')
                                fetchChunks()
                              } catch { toast.error('移除失败') }
                            }}
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
                              title="移除">
                              <Trash2 className="size-3.5" />
                            </span>
                            <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border/50 px-3 pb-3 pt-2">
                            {expr.original && (
                              <div className="mb-3 rounded-md bg-muted/45 p-2.5">
                                <p className="text-xs font-medium leading-5 text-foreground">{text}</p>
                                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{expr.original}</p>
                              </div>
                            )}
                            {expr.lastReviewedAt && (
                              <p className="text-xs text-muted-foreground">
                                上次复习：{new Date(expr.lastReviewedAt).toLocaleDateString('zh-CN')}
                              </p>
                            )}
                            <Button size="sm" variant="outline" className="mt-2 h-8 w-full gap-1.5 text-xs" onClick={() => openDialog(visibleChunkDialogItems, i)}>
                              <Search className="size-3.5" /> 查看详情
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">共 {visibleChunks.length} 条句块</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---- 复习按钮 ---- */}
      {libraryTab === 'chunk' && reviewState === 'reviewing' && reviewChunks.length > 0 && (
        <Button
          className="mt-3 w-full rounded-full"
          onClick={() => { setReviewIndex(0); setRevealed(false); setUserAnswer(''); setReviewOpen(true) }}
        >
          <RefreshCw className="mr-1 size-4" /> 开始复习（{reviewChunks.length} 项）
        </Button>
      )}

      <LearningInsightDialog
        items={dialogItems} index={dialogIndex} open={dialogOpen}
        onOpenChange={setDialogOpen} onIndexChange={setDialogIndex}
      />

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={(open) => { setReviewOpen(open); if (!open) refreshAfterReview() }}
        items={reviewChunks} index={reviewIndex}
        setIndex={setReviewIndex} revealed={revealed}
        setRevealed={setRevealed} userAnswer={userAnswer}
        setUserAnswer={setUserAnswer}
      />
    </div>
  )
}

// ─── Review Dialog ──────────────────────────────────────────

function ReviewDialog({
  open, onOpenChange, items, index, setIndex,
  revealed, setRevealed, userAnswer, setUserAnswer,
}: {
  open: boolean; onOpenChange: (open: boolean) => void
  items: Expression[]; index: number
  setIndex: (i: number) => void
  revealed: boolean; setRevealed: (r: boolean) => void
  userAnswer: string; setUserAnswer: (a: string) => void
}) {
  const current = items[index]
  const isLast = index >= items.length - 1

  const text = current?.corrected ?? current?.chunkText ?? current?.original ?? ''
  const chunks = text.split(/(_____|\.{3,}|___)/g)

  const handleNext = () => {
    if (isLast) {
      toast.success('复习完成！')
      onOpenChange(false)
    } else {
      setIndex(index + 1)
      setRevealed(false)
      setUserAnswer('')
    }
  }

  const handleCheck = async () => {
    if (current) {
      try {
        await expressionApi.completeReview(current.id)
      } catch {}
    }
    handleNext()
  }

  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-4" /> 输出式复习
            <span className="text-sm font-normal text-muted-foreground">
              {index + 1} / {items.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1">
          {items.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${
              i < index ? 'bg-primary' : i === index ? 'bg-primary/60' : 'bg-muted'
            }`} />
          ))}
        </div>

        <div className="space-y-4 py-4">
          {/* Output prompt */}
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs text-muted-foreground mb-2">请说出以下表达：</p>
            {revealed ? (
              <p className="text-lg font-medium text-foreground">{text}</p>
            ) : (
              <div className="space-y-1">
                {chunks.map((part, i) => (
                  <span key={i}>
                    {part === '_____' || part === '...' || part === '___' ? (
                      <span className="inline-block w-16 border-b-2 border-dashed border-primary" />
                    ) : (
                      <span className={cn(i % 2 === 1 ? 'text-primary font-bold' : 'text-foreground')}>
                        {part}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* User answer */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">你的回答：</p>
            <Textarea
              placeholder="在此输入你的回答..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              rows={3}
            />
          </div>

          {/* Answer comparison */}
          {revealed && (
            <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-1">
                <Check className="size-4" />
                <span className="text-sm font-medium">参考答案</span>
              </div>
              <p className="text-sm">{text}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setRevealed(!revealed)}>
            {revealed ? (
              <><EyeOff className="size-4 mr-1" /> 隐藏答案</>
            ) : (
              <><Eye className="size-4 mr-1" /> 查看答案</>
            )}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleNext}>
              <X className="size-4 mr-1" /> 跳过
            </Button>
            <Button onClick={handleCheck}>
              <Check className="size-4 mr-1" /> {isLast ? '完成' : '下一个'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
