import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, CheckCircle2, XCircle, Clock, Send, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectItem } from '@/components/ui/select'
import { getAllFeedbacks, updateFeedback, replyFeedback } from '@/features/feedback/api'
import type { FeedbackResult } from '@/features/feedback/api'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { cn } from '@/lib/cn'

const STATUS_MAP: Record<string, { label: string; variant: 'outline' | 'secondary' | 'default' }> = {
  pending: { label: '待处理', variant: 'secondary' },
  resolved: { label: '已解决', variant: 'default' },
  closed: { label: '已关闭', variant: 'outline' },
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
]

const TYPE_MAP: Record<string, string> = {
  bug: '问题反馈', suggestion: '功能建议', other: '其他',
}

const PAGE_SIZES = [10, 20, 50]

export function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<(FeedbackResult & { user?: { name: string; email: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<typeof feedbacks[0] | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [replySent, setReplySent] = useState(false)

  const fetchData = useCallback(async () => {
    const data = await getAllFeedbacks({ status: filter || undefined, page, pageSize })
    setFeedbacks(data.items)
    setTotal(data.total)
    setLoading(false)
  }, [filter, page, pageSize])

  useEffect(() => { fetchData() }, [fetchData])

  const handleStatusChange = async (id: string, status: string) => {
    await updateFeedback(id, { status })
    // 本地即时更新 selected 和列表状态，不关闭弹窗
    setSelected((prev) => prev && prev.id === id ? { ...prev, status: status as FeedbackResult['status'] } : prev)
    setFeedbacks((prev) => prev.map((fb) => fb.id === id ? { ...fb, status: status as FeedbackResult['status'] } : fb))
  }

  const handleCriticalChange = async (id: string, isCritical: boolean) => {
    await updateFeedback(id, { status: selected?.status || 'pending', isCritical })
    setSelected((prev) => prev && prev.id === id ? { ...prev, isCritical } : prev)
    setFeedbacks((prev) => prev.map((fb) => fb.id === id ? { ...fb, isCritical } : fb))
  }

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return
    setReplying(true)
    try {
      await replyFeedback(selected.id, replyText.trim())
      setReplySent(true)
      setReplyText('')
      fetchData()
    } catch {
      // 失败时保持回复框内容，用户可重试
    } finally {
      setReplying(false)
    }
  }

  const handleDialogClose = () => {
    setSelected(null)
    setReplyText('')
    setReplySent(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">反馈管理</h1>
        <p className="text-xs text-muted-foreground">查看和处理用户反馈</p>
      </div>

      <div className="flex gap-2">
        <Select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1) }} className="w-40">
          <SelectItem value="">全部</SelectItem>
          <SelectItem value="pending">待处理</SelectItem>
          <SelectItem value="resolved">已解决</SelectItem>
          <SelectItem value="closed">已关闭</SelectItem>
        </Select>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">反馈总数</p>
              <p className="text-lg font-bold">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">待处理</p>
              <p className="text-lg font-bold">{feedbacks.filter((f) => f.status === 'pending').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">已解决</p>
              <p className="text-lg font-bold">{feedbacks.filter((f) => f.status === 'resolved').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">已关闭</p>
              <p className="text-lg font-bold">{feedbacks.filter((f) => f.status === 'closed').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-24 w-full rounded-xl" />))}
        </div>
      ) : feedbacks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">暂无反馈</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb) => (
            <Card
              key={fb.id}
              className="cursor-pointer hover:border-border transition-colors"
              onClick={() => setSelected(fb)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{TYPE_MAP[fb.type] || fb.type}</Badge>
                      <Badge variant={STATUS_MAP[fb.status]?.variant || 'outline'} className="text-[10px]">
                        {STATUS_MAP[fb.status]?.label || fb.status}
                      </Badge>
                      {fb.isCritical && (
                        <Badge variant="outline" className="border-red-500/40 text-[10px] text-red-500">
                          严重
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">{fb.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {fb.user?.name || '未知用户'} · {new Date(fb.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">每页</span>
            <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-16">
              {PAGE_SIZES.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
            </Select>
            <span className="text-xs text-muted-foreground">条</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              共 {total} 条，第 {page}/{Math.ceil(total / pageSize) || 1} 页
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                上一页
              </Button>
              <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)}>
                下一页
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) handleDialogClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>反馈详情</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{TYPE_MAP[selected.type] || selected.type}</Badge>
                <Badge variant={STATUS_MAP[selected.status]?.variant || 'outline'} className="text-[10px]">
                  {STATUS_MAP[selected.status]?.label || selected.status}
                </Badge>
                {selected.isCritical && (
                  <Badge variant="outline" className="border-red-500/40 text-[10px] text-red-500">
                    严重
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">用户</p>
                <p className="text-sm">{selected.user?.name || '未知'} ({selected.user?.email || '-'})</p>
              </div>
              {selected.contact && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">联系方式</p>
                  <p className="text-sm">{selected.contact}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">反馈内容</p>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-sm whitespace-pre-wrap">{selected.content}</p>
                </div>
              </div>

              {/* 已有的管理员回复 */}
              {selected.adminNote && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">客服回复</p>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                    <p className="text-sm whitespace-pre-wrap">{selected.adminNote}</p>
                  </div>
                </div>
              )}

              {/* 回复成功提示 */}
              {replySent && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs text-green-700 dark:text-green-300">
                    回复已发送，用户将收到通知
                  </p>
                </div>
              )}

              {/* 回复输入区 */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-1.5">回复用户（支持 Markdown，将发送通知）</p>
                <MarkdownEditor
                  value={replyText}
                  onChange={setReplyText}
                  height={180}
                  placeholder="输入回复内容，支持 Markdown 格式..."
                  disabled={replying || replySent}
                />
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyText.trim() || replying || replySent}
                  className="gap-1.5"
                >
                  {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {replying ? '发送中...' : '发送回复'}
                </Button>
              </div>

              {/* 状态管理 */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                <span className="text-xs text-muted-foreground">状态</span>
                <Select
                  value={selected.status}
                  onChange={(e) => handleStatusChange(selected.id, e.target.value)}
                  className="w-28"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant={selected.isCritical ? 'destructive' : 'outline'}
                  onClick={() => handleCriticalChange(selected.id, !selected.isCritical)}
                  className="gap-1.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {selected.isCritical ? '取消严重' : '标记严重'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
