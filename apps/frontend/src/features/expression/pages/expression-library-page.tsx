import { useState, useEffect, useCallback } from 'react'
import {
  BookMarked, RefreshCw, ExternalLink, Search,
  BookmarkPlus, Trash2, Layers, Eye, EyeOff, Check, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; createdAt: string
}

export function ExpressionLibraryPage() {
  const [expressions, setExpressions] = useState<Expression[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('words')
  const { entries: wordEntries, removeWord } = useWordsStore()

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])

  // 展开的列表项
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Review
  const [reviewItems, setReviewItems] = useState<Expression[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res: any = await expressionApi.list({ type: 'chunk' })
      setExpressions(Array.isArray(res) ? res : res?.data ?? [])
    } catch { setExpressions([]) }
    finally { setLoading(false) }
  }

  const loadReview = async () => {
    try {
      const res: any = await expressionApi.getReview()
      setReviewItems(Array.isArray(res) ? res : res?.data ?? [])
    } catch { setReviewItems([]) }
  }

  useEffect(() => {
    if (filter === 'review') { setLoading(true); loadReview().finally(() => setLoading(false)) }
    else if (filter === 'words') setLoading(false)
    else fetchData()
  }, [filter])

  // Dialog data
  const wordDialogItems: LearningInsightItem[] = wordEntries.map((entry) => ({
    kind: 'word', id: `word:${entry.word}`, word: entry.word,
  }))

  const chunkDialogItems: LearningInsightItem[] = expressions.map((expr) => ({
    kind: 'chunk', id: expr.id,
    text: expr.chunkText ?? expr.corrected ?? '',
    meaning: expr.original ?? '',
    sceneName: expr.sceneName ?? undefined,
  }))

  const openDialog = useCallback((items: LearningInsightItem[], startIndex: number) => {
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="mb-4 w-full flex-wrap rounded-full">
          <TabsTrigger value="words" className="flex-1 min-w-[60px]">单词</TabsTrigger>
          <TabsTrigger value="chunk" className="flex-1 min-w-[60px]">表达</TabsTrigger>
          <TabsTrigger value="review" className="flex-1 min-w-[60px] relative">
            复习
            {reviewItems.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1 text-[10px]">{reviewItems.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 单词 */}
        <TabsContent value="words">
          {wordEntries.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BookMarked className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">还没有收藏单词</p>
              <p className="text-sm text-muted-foreground">在学习单元页点击 🔖 即可收藏单词</p>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">点击单项展开 · 点击「查询」进入沉浸式学习</span>
                <button onClick={() => openDialog(wordDialogItems, 0)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
                  <ExternalLink className="size-3" /> 沉浸式
                </button>
              </div>
              <div className="space-y-1">
                {wordEntries.map((entry, i) => {
                  const isExpanded = expandedItemId === entry.word
                  return (
                    <div key={entry.word} className={cn(
                      'rounded-lg border transition-all',
                      isExpanded ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-card',
                    )}>
                      <button onClick={() => setExpandedItemId((prev) => (prev === entry.word ? null : entry.word))}
                        className="flex w-full items-center justify-between p-3 text-left"
                      >
                        <p className={cn('text-sm font-bold', isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-foreground')}>
                          {entry.word}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span onClick={(e) => { e.stopPropagation(); openDialog(wordDialogItems, i) }}
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="查询">
                            <Search className="size-3.5" />
                          </span>
                          <span onClick={(e) => { e.stopPropagation(); removeWord(entry.word); toast.success('已移除') }}
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500" title="移除">
                            <Trash2 className="size-3.5" />
                          </span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-blue-500/20 px-3 pb-3 pt-2">
                          <p className="text-xs text-muted-foreground">收藏于 {new Date(entry.addedAt).toLocaleDateString('zh-CN')}</p>
                          <button onClick={() => openDialog(wordDialogItems, i)}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
                            <ExternalLink className="size-3" /> 查看详情
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">共 {wordEntries.length} 个单词</p>
            </div>
          )}
        </TabsContent>

        {/* 表达 */}
        <TabsContent value="chunk">
          {loading ? <div className="flex justify-center py-12"><Spinner /></div>
          : expressions.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BookMarked className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">还没有保存的表达</p>
              <p className="text-sm text-muted-foreground">学习过程中系统会自动沉淀到这里</p>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">点击单项展开 · 点击「查询」进入沉浸式学习</span>
                <button onClick={() => openDialog(chunkDialogItems, 0)}
                  className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600">
                  <ExternalLink className="size-3" /> 沉浸式
                </button>
              </div>
              <div className="space-y-1">
                {expressions.map((expr, i) => {
                  const text = expr.chunkText ?? expr.corrected ?? ''
                  const isExpanded = expandedItemId === expr.id
                  return (
                    <div key={expr.id} className={cn(
                      'rounded-lg border transition-all',
                      isExpanded ? 'border-purple-500/40 bg-purple-500/5' : 'border-border bg-card',
                    )}>
                      <button onClick={() => setExpandedItemId((prev) => (prev === expr.id ? null : expr.id))}
                        className="flex w-full items-center justify-between p-3 text-left">
                        <p className={cn('text-sm font-medium', isExpanded ? 'text-purple-600 dark:text-purple-400' : 'text-foreground')}>
                          {text}
                        </p>
                        <span onClick={(e) => { e.stopPropagation(); openDialog(chunkDialogItems, i) }}
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="查询">
                          <Search className="size-3.5" />
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-purple-500/20 px-3 pb-3 pt-2">
                          <p className="text-sm text-foreground">{expr.original ?? text}</p>
                          {expr.sceneName && <p className="mt-1 text-xs text-muted-foreground">场景：{expr.sceneName}</p>}
                          <button onClick={() => openDialog(chunkDialogItems, i)}
                            className="mt-2 flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600">
                            <ExternalLink className="size-3" /> 查看详情
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">共 {expressions.length} 条表达</p>
            </div>
          )}
        </TabsContent>

        {/* 复习 */}
        <TabsContent value="review">
          {reviewItems.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <RefreshCw className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">暂无待复习内容</p>
              <p className="text-sm text-muted-foreground">练习后保存的表达会自动进入复习队列</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{reviewItems.length} 条待复习</p>
                <Button onClick={() => { setReviewIndex(0); setRevealed(false); setUserAnswer(''); setReviewOpen(true) }}>
                  <RefreshCw className="size-4 mr-1" /> 开始复习
                </Button>
              </div>
              {reviewItems.map((expr) => {
                const text = expr.corrected ?? expr.chunkText ?? expr.original ?? ''
                return (
                  <Card key={expr.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="flex items-start justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-xs"><Layers className="size-3" />表达</Badge>
                          {expr.sceneName && <span className="text-xs text-muted-foreground">{expr.sceneName}</span>}
                        </div>
                        <p className="text-sm text-foreground">{text}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LearningInsightDialog
        items={dialogItems} index={dialogIndex} open={dialogOpen}
        onOpenChange={setDialogOpen} onIndexChange={setDialogIndex}
      />

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={(open) => { setReviewOpen(open); if (!open) loadReview() }}
        items={reviewItems} index={reviewIndex}
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
