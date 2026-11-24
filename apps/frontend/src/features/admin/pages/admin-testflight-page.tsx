import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Copy, Loader2, Plane, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectItem } from '@/components/ui/select'
import { AdminPagination } from '@/features/admin/components/admin-pagination'
import {
  getAllFeedbacks,
  notifyFeedbackStatsChanged,
  updateFeedback,
  type FeedbackResult,
} from '@/features/feedback/api'
import { cn } from '@/lib/cn'

type FeedbackItem = FeedbackResult & { user?: { name: string; email: string } }

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: '待邀请', className: 'border-amber-500/30 text-amber-600' },
  resolved: { label: '已邀请', className: 'border-emerald-500/30 text-emerald-600' },
  closed: { label: '已关闭', className: 'text-muted-foreground' },
}

const PAGE_SIZES = [10, 20, 50]

export function AdminTestflightPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllFeedbacks({
        type: 'testflight',
        status: statusFilter || undefined,
        page,
        pageSize,
      })
      setItems(data.items)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page, pageSize])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const copyAppleId = async (appleId: string) => {
    try {
      await navigator.clipboard.writeText(appleId)
      toast.success('已复制 Apple ID')
    } catch {
      toast.error('复制失败')
    }
  }

  const setStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      await updateFeedback(id, { status })
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: status as FeedbackResult['status'] } : item)))
      notifyFeedbackStatsChanged()
      toast.success(status === 'resolved' ? '已标记为已邀请' : '状态已更新')
      if (statusFilter && status !== statusFilter) {
        void fetchData()
      }
    } catch (error: any) {
      toast.error(error?.message || '更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">TestFlight 申请</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看用户提交的 Apple ID，复制后到 App Store Connect 发送内测邀请。
          </p>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-40"
        >
          <SelectItem value="">全部状态</SelectItem>
          <SelectItem value="pending">待邀请</SelectItem>
          <SelectItem value="resolved">已邀请</SelectItem>
          <SelectItem value="closed">已关闭</SelectItem>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Plane className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">当前列表</p>
              <p className="text-lg font-bold">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="size-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">待邀请（本页）</p>
              <p className="text-lg font-bold">{items.filter((item) => item.status === 'pending').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">已邀请（本页）</p>
              <p className="text-lg font-bold">{items.filter((item) => item.status === 'resolved').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Plane className="mx-auto mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">暂无 TestFlight 申请</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const appleId = item.contact || '—'
            const status = STATUS_MAP[item.status] || STATUS_MAP.pending
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn('text-[10px]', status.className)}>
                        {status.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{appleId}</p>
                      {item.contact && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => void copyAppleId(item.contact!)}
                        >
                          <Copy className="size-3.5" />
                          复制
                        </Button>
                      )}
                    </div>
                    {item.content && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.status !== 'resolved' && (
                      <Button
                        size="sm"
                        disabled={updatingId === item.id}
                        onClick={() => void setStatus(item.id, 'resolved')}
                      >
                        {updatingId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                        标记已邀请
                      </Button>
                    )}
                    {item.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updatingId === item.id}
                        onClick={() => void setStatus(item.id, 'closed')}
                      >
                        <XCircle className="size-3.5" />
                        关闭
                      </Button>
                    )}
                    {item.status !== 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updatingId === item.id}
                        onClick={() => void setStatus(item.id, 'pending')}
                      >
                        恢复待邀请
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && total > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <AdminPagination
            total={total}
            page={page}
            pageSize={pageSize}
            pageSizes={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </div>
      )}
    </div>
  )
}
