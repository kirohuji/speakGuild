import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Bell, CheckCheck, MailOpen, Mail, Inbox, Clock, ArrowRight, ArrowLeft, User, Volume2, CheckCircle2 } from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import {
  getUserNotifications, markAsRead, markAllAsRead,
  type NotificationItem,
} from '@/features/notification/api'
import { useNotificationStore } from '@/features/notification/store'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { useIsMobile } from '@/hooks/use-mobile'

type TabValue = 'all' | 'unread' | 'read'

const tabConfig: { value: TabValue; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: '全部', icon: Inbox },
  { value: 'unread', label: '未读', icon: Mail },
  { value: 'read', label: '已读', icon: MailOpen },
]

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

function NotificationItemRow({
  item,
  onClick,
}: {
  item: NotificationItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-xl px-4 py-3.5 text-left transition-all hover:bg-muted/60 active:scale-[0.99]',
        !item.isRead && 'bg-primary/[0.03]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted/80">
          {!item.isRead ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          ) : null}
          <Bell className={cn('h-4 w-4', item.isRead ? 'text-muted-foreground/50' : 'text-primary')} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm leading-snug line-clamp-1',
                !item.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'
              )}
            >
              {item.title}
            </p>
            <span className="flex-shrink-0 text-[10px] text-muted-foreground/50">
              {formatRelativeTime(item.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {item.content.replace(/[#*`>\[\]()!\-]/g, '').substring(0, 120)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant={item.type === 'broadcast' ? 'outline' : 'secondary'}
              className="h-5 text-[10px] px-1.5 font-normal"
            >
              {item.type === 'broadcast' ? '系统广播' : '定向通知'}
            </Badge>
            {!item.isRead && (
              <span className="text-[10px] font-medium text-primary">未读</span>
            )}
          </div>
        </div>

        <ArrowRight className="mt-2.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

// ========== Virtuoso 虚拟列表 ==========
function NotificationList({
  tab,
  onOpenDetail,
}: {
  tab: TabValue
  onOpenDetail: (item: NotificationItem) => void
}) {
  const [list, setList] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 20
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const resetUnread = useNotificationStore((s) => s.resetUnread)

  const pageRef = useRef(1)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)

  const loadList = useCallback(
    async (pg: number, replace: boolean) => {
      loadingRef.current = true
      setLoading(true)
      try {
        const isReadParam = tab === 'all' ? undefined : tab === 'read'
        const result = await getUserNotifications({
          page: pg,
          pageSize,
          isRead: isReadParam,
        })
        if (replace) {
          setList(result.list)
        } else {
          setList((prev) => [...prev, ...result.list])
        }
        hasMoreRef.current = result.list.length === pageSize
        setHasMore(hasMoreRef.current)
      } catch {
        if (replace) setList([])
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [tab]
  )

  useEffect(() => {
    pageRef.current = 1
    hasMoreRef.current = true
    setList([])
    setHasMore(true)
    loadList(1, true)
  }, [tab, loadList])

  const handleMarkAll = async () => {
    try {
      await markAllAsRead()
      setList((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      )
      resetUnread()
      fetchUnreadCount()
    } catch {}
  }

  const handleEndReached = useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current) return
    const nextPage = pageRef.current + 1
    pageRef.current = nextPage
    loadList(nextPage, false)
  }, [loadList])

  const hasUnread = list.some((n) => !n.isRead)

  const Footer = useCallback(() => {
    if (loading && list.length > 0) {
      return (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
          </div>
        </div>
      )
    }
    return null
  }, [loading, list.length])

  const EmptyPlaceholder = useCallback(() => {
    if (loading && list.length === 0) {
      return (
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (!loading && list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
            {tab === 'unread' ? (
              <Mail className="h-6 w-6 text-muted-foreground/30" />
            ) : (
              <Inbox className="h-6 w-6 text-muted-foreground/30" />
            )}
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {tab === 'unread' ? '暂无未读通知' : tab === 'read' ? '暂无已读通知' : '暂无通知'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/50">
            {tab === 'unread' ? '新通知会在这里显示' : '通知会出现在这里'}
          </p>
        </div>
      )
    }
    return null
  }, [loading, list.length, tab])

  return (
    <div className="flex flex-col h-full">
      {tab !== 'read' && hasUnread && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/30">
          <span className="text-xs text-muted-foreground">
            {list.filter((n) => !n.isRead).length} 条未读
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            全部已读
          </Button>
        </div>
      )}

      {/* Chrome 移动端滚动兼容：用 relative + absolute 给 Virtuoso 一个确定高度 */}
      <div className="flex-1 relative min-h-0">
        <Virtuoso
          className="absolute inset-0 !touch-auto"
          style={{ touchAction: 'pan-y' } as React.CSSProperties}
          totalCount={list.length}
          endReached={handleEndReached}
          overscan={300}
          components={{
            Footer,
            EmptyPlaceholder,
          }}
          itemContent={(index) => (
            <div className="px-2 py-0.5">
              <NotificationItemRow
                item={list[index]}
                onClick={() => onOpenDetail(list[index])}
              />
            </div>
          )}
        />
      </div>
    </div>
  )
}

// ========== 通知详情 Dialog ==========
function NotificationDetailDialog({
  item,
  open,
  onClose,
}: {
  item: NotificationItem | null
  open: boolean
  onClose: () => void
}) {
  if (!item) return null

  const formattedDate = new Date(item.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-0">
          <DialogTitle className="sr-only">通知详情</DialogTitle>
          <DialogDescription className="sr-only">{item.title}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-snug">{item.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant={item.type === 'broadcast' ? 'outline' : 'secondary'}
                  className="h-5 gap-1 text-[10px] px-1.5 font-normal"
                >
                  {item.type === 'broadcast' ? (
                    <Volume2 className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {item.type === 'broadcast' ? '系统广播' : '定向通知'}
                </Badge>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {formattedDate}
                </span>
                {item.isRead && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary/70">
                    <CheckCircle2 className="h-3 w-3" />
                    已读
                  </span>
                )}
              </div>
            </div>
          </div>

          <Separator className="mt-4 mb-4" />

          <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
            <MarkdownRenderer content={item.content} />
          </div>

          {item.readAt && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary/[0.03] px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-primary/60" />
              <span className="text-xs text-muted-foreground/70">
                已于 {new Date(item.readAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })} 阅读
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabValue>('all')
  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const isMobile = useIsMobile()

  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const handleOpenDetail = (item: NotificationItem) => {
    setDetailItem(item)
    setDetailOpen(true)
    if (!item.isRead) {
      markAsRead(item.id).then(() => {
        useNotificationStore.getState().fetchUnreadCount()
      }).catch(() => {})
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => { setDetailItem(null); setOpen(true) }}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* 通知中心 Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            'flex flex-col overflow-hidden p-0',
            isMobile
              ? 'fixed inset-0 z-50 h-full w-full max-w-none rounded-none border-0'
              : 'sm:max-w-[520px] h-[620px] max-h-[85vh]'
          )}
        >
          <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">通知中心</DialogTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="h-5 gap-1 px-2 text-[10px] font-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  {unreadCount} 条未读
                </Badge>
              )}
            </div>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabValue)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-shrink-0 px-5 pt-3 pb-2">
              <TabsList className="h-9 w-full bg-muted/60 p-0.5">
                {tabConfig.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="flex-1 gap-1.5 text-xs data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {tabConfig.map(({ value }) => (
              <TabsContent key={value} value={value} className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                <NotificationList
                  tab={value}
                  onOpenDetail={handleOpenDetail}
                />
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 通知详情 Dialog（独立弹窗，列表保持挂载） */}
      <NotificationDetailDialog
        item={detailItem}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  )
}
