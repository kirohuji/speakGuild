import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Bell, Inbox, Mail, MailOpen, CheckCheck, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import {
  getUserNotifications, markAsRead, markAllAsRead,
  type NotificationItem,
} from '@/features/notification/api'
import { useNotificationStore } from '@/features/notification/store'
import { NotificationDetailSheet } from '../components/notification-detail-sheet'

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

function NotificationCard({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-2xl border border-border/50 p-4 text-left transition-all hover:border-primary/20 hover:shadow-sm active:scale-[0.99]',
        !item.isRead
          ? 'bg-primary/[0.02] border-primary/10'
          : 'bg-card'
      )}
    >
      <div className="flex items-start gap-3">
        {/* 图标区 */}
        <div
          className={cn(
            'relative mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
            item.isRead ? 'bg-muted/60' : 'bg-primary/10'
          )}
        >
          {!item.isRead && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
          )}
          <Bell
            className={cn(
              'h-5 w-5',
              item.isRead ? 'text-muted-foreground/40' : 'text-primary'
            )}
          />
        </div>

        {/* 内容 */}
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
            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
          </div>

          <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {item.content.replace(/[#*`>\[\]()!\-]/g, '').substring(0, 120)}
          </p>

          {/* 底部信息 */}
          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(item.createdAt)}
            </span>
            <Badge
              variant={item.type === 'broadcast' ? 'outline' : 'secondary'}
              className="h-5 text-[10px] px-1.5 font-normal"
            >
              {item.type === 'broadcast' ? '系统广播' : '定向通知'}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  )
}

function NotificationTabContent({ tab }: { tab: TabValue }) {
  const [list, setList] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 20
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const resetUnread = useNotificationStore((s) => s.resetUnread)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadList = useCallback(
    async (pg: number, replace: boolean) => {
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
        setHasMore(result.list.length === pageSize)
      } catch {
        if (replace) setList([])
      } finally {
        setLoading(false)
      }
    },
    [tab]
  )

  useEffect(() => {
    setPage(1)
    setList([])
    loadList(1, true)
  }, [tab, loadList])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1
          setPage(nextPage)
          loadList(nextPage, false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, page, loadList])

  const handleClickItem = (item: NotificationItem) => {
    setDetailItem(item)
    setDetailOpen(true)
    if (!item.isRead) {
      markAsRead(item.id).then(() => {
        setList((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        )
        fetchUnreadCount()
      }).catch(() => {})
    }
  }

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

  const hasUnread = list.some((n) => !n.isRead)

  return (
    <>
      {tab !== 'read' && hasUnread && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {list.filter((n) => !n.isRead).length} 条未读
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleMarkAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            全部已读
          </Button>
        </div>
      )}

      {loading && list.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/50 p-4">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
            {tab === 'unread' ? (
              <Mail className="h-7 w-7 text-muted-foreground/30" />
            ) : (
              <Inbox className="h-7 w-7 text-muted-foreground/30" />
            )}
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {tab === 'unread' ? '暂无未读通知' : tab === 'read' ? '暂无已读通知' : '暂无通知'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/50">
            {tab === 'unread' ? '新通知到达时会出现在这里' : '通知记录都会展示在这里'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              onClick={() => handleClickItem(item)}
            />
          ))}
        </div>
      )}

      {/* Sentinela para scroll infinito */}
      <div ref={sentinelRef} className="h-4" />

      {loading && list.length > 0 && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <NotificationDetailSheet
        item={detailItem}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setDetailItem(null)
        }}
      />
    </>
  )
}

export function NotificationListPage() {
  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">通知中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          查看和管理你的所有通知
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="h-10 w-full bg-muted/60 p-0.5">
          {tabConfig.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 gap-1.5 text-sm data-[state=active]:shadow-sm"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabConfig.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-0 space-y-4">
            <NotificationTabContent tab={value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
