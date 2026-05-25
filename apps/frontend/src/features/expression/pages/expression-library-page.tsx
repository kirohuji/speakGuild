import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trash2, BookMarked, AlertCircle, Sparkles, Layers,
  RefreshCw, Eye, EyeOff, Check, X,
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
import { cn } from '@/lib/cn'

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; createdAt: string
}

const TYPE_META: Record<string, { label: string; icon: typeof BookMarked; color: string }> = {
  chunk: { label: 'Chunk', icon: Layers, color: 'border-l-blue-500' },
  error_sentence: { label: '错句', icon: AlertCircle, color: 'border-l-red-500' },
  upgraded: { label: '升级', icon: Sparkles, color: 'border-l-amber-500' },
  scene_phrase: { label: '场景', icon: BookMarked, color: 'border-l-green-500' },
}

export function ExpressionLibraryPage() {
  const [expressions, setExpressions] = useState<Expression[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // Review state
  const [reviewItems, setReviewItems] = useState<Expression[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filter !== 'all' && filter !== 'review') params.type = filter
      const res: any = await expressionApi.list(params)
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
    else fetchData()
  }, [filter])

  const handleDelete = async (id: string) => {
    try { await expressionApi.remove(id); fetchData() } catch {}
  }

  const filtered = filter === 'all' ? expressions : expressions.filter((e) => e.type === filter)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">表达库</h1>
        <p className="mt-1 text-muted-foreground">你的英语表达资产中心</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="mb-4 w-full flex-wrap">
          <TabsTrigger value="all" className="flex-1 min-w-[60px]">全部</TabsTrigger>
          <TabsTrigger value="chunk" className="flex-1 min-w-[60px]">Chunk</TabsTrigger>
          <TabsTrigger value="error_sentence" className="flex-1 min-w-[60px]">错句</TabsTrigger>
          <TabsTrigger value="upgraded" className="flex-1 min-w-[60px]">升级</TabsTrigger>
          <TabsTrigger value="review" className="flex-1 min-w-[60px] relative">
            复习
            {reviewItems.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1 text-[10px]">{reviewItems.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Review Tab */}
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
                const meta = TYPE_META[expr.type] ?? TYPE_META.chunk
                const Icon = meta.icon
                const text = expr.corrected ?? expr.chunkText ?? expr.original ?? ''
                return (
                  <Card key={expr.id} className={cn('border-l-4', meta.color)}>
                    <CardContent className="flex items-start justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Icon className="size-3" />{meta.label}
                          </Badge>
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

        <TabsContent value={filter}>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BookMarked className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">还没有保存的表达</p>
              <p className="text-sm text-muted-foreground">完成练习后可以保存错句和升级表达</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((expr) => {
                const meta = TYPE_META[expr.type] ?? TYPE_META.chunk
                const Icon = meta.icon
                const text = expr.corrected ?? expr.chunkText ?? expr.original ?? ''
                return (
                  <Card key={expr.id} className={cn('border-l-4', meta.color)}>
                    <CardContent className="flex items-start justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Icon className="size-3" />{meta.label}
                          </Badge>
                          {expr.sceneName && <span className="text-xs text-muted-foreground">{expr.sceneName}</span>}
                        </div>
                        <p className="truncate text-sm text-foreground">{text}</p>
                        {expr.original && expr.corrected && expr.original !== expr.corrected && (
                          <p className="mt-1 truncate text-xs text-muted-foreground line-through">{expr.original}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="ml-2 shrink-0" onClick={() => handleDelete(expr.id)}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {filtered.length > 0 && filter !== 'review' && (
        <p className="mt-4 text-center text-xs text-muted-foreground">共 {filtered.length} 条表达</p>
      )}

      {/* Review Dialog */}
      <ReviewDialog
        open={reviewOpen}
        onOpenChange={(open) => { setReviewOpen(open); if (!open) loadReview() }}
        items={reviewItems}
        index={reviewIndex}
        setIndex={setReviewIndex}
        revealed={revealed}
        setRevealed={setRevealed}
        userAnswer={userAnswer}
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
