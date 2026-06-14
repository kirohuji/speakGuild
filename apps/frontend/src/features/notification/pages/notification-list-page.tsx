import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Inbox, Mail, MailOpen, CheckCheck, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileListSkeleton } from '@/components/common/mobile-page-loading'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import {
  markAsRead, markAllAsRead,
  type NotificationItem,
} from '@/features/notification/api'
import { useNotificationStore } from '@/features/notification/store'
import { NotificationDetailSheet } from '../components/notification-detail-sheet'

type TabValue = 'all' | 'unread' | 'read'

function useTabConfig() {
  const { t } = useTranslation()
  return [
    { value: 'all' as const, label: t('notification.tabAll'), icon: Inbox },
    { value: 'unread' as const, label: t('notification.tabUnread'), icon: Mail },
    { value: 'read' as const, label: t('notification.tabRead'), icon: MailOpen },
  ]
}

function useFormatRelativeTime() {
  const { t } = useTranslation()
  return (dateStr: string): string => {
    const now = Date.now()
    const date = new Date(dateStr).getTime()
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return t('notification.justNow')
    if (diffMin < 60) return t('notification.minutesAgo', { count: diffMin })
    if (diffHour < 24) return t('notification.hoursAgo', { count: diffHour })
    if (diffDay < 7) return t('notification.daysAgo', { count: diffDay })
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }
}

function NotificationCard({ item, onClick, formatRelativeTime, compact = false }: { item: NotificationItem; onClick: () => void; formatRelativeTime: (s: string) => string; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full overflow-hidden text-left transition-all active:scale-[0.99]',
        compact
          ? 'rounded-lg hover:bg-muted/50'
          : 'rounded-2xl border border-border/50 hover:border-primary/20 hover:shadow-sm',
        !item.isRead
          ? compact ? 'bg-primary/[0.06]' : 'bg-primary/[0.02] border-primary/10'
          : compact ? 'bg-muted/30' : 'bg-card'
      )}
    >
      {!item.isRead && (
        <span className="absolute right-3 top-3 z-10 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
      )}

      {/* 图片区 — 有图显示图片，无图显示占位，保证所有项高度一致 */}
      <div className="relative aspect-[16/5] w-full overflow-hidden bg-muted/60">
        {item.imageUrl ? (
          <>
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Bell className="size-7 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* 文字内容 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm leading-snug line-clamp-1',
              !item.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'
            )}
          >
            {item.title}
          </p>
          {!compact && <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />}
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
        </div>
      </div>
    </button>
  )
}

function NotificationTabContent({ tab, formatRelativeTime, compact = false }: { tab: TabValue; formatRelativeTime: (s: string) => string; compact?: boolean }) {
  const { t } = useTranslation()
  const tabLists = useNotificationStore((s) => s.tabLists)
  const tabLoading = useNotificationStore((s) => s.tabLoading)
  const fetchTabList = useNotificationStore((s) => s.fetchTabList)
  const markItemReadInStore = useNotificationStore((s) => s.markItemReadInStore)
  const markAllReadInStore = useNotificationStore((s) => s.markAllReadInStore)
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const resetUnread = useNotificationStore((s) => s.resetUnread)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const cache = tabLists[tab]
  const list = cache?.list ?? []
  const loading = tabLoading[tab] ?? false
  const hasMore = cache?.hasMore ?? true
  const page = cache?.page ?? 1

  // 首次加载
  useEffect(() => {
    if (!cache) fetchTabList(tab, 1, true)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // 无限滚动
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchTabList(tab, page + 1, false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, page, tab, fetchTabList])

  const handleClickItem = (item: NotificationItem) => {
    setDetailItem(item)
    setDetailOpen(true)
    if (!item.isRead) {
      markAsRead(item.id).then(() => {
        markItemReadInStore(item.id)
        fetchUnreadCount()
      }).catch(() => {})
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllAsRead()
      markAllReadInStore()
      resetUnread()
      fetchUnreadCount()
    } catch {}
  }

  const hasUnread = list.some((n) => !n.isRead)

  return (
    <>
      {tab !== 'read' && hasUnread && (
        <div className={cn(
          'flex items-center justify-between',
          compact && 'mb-3 rounded-lg bg-muted/30 px-3 py-2'
        )}>
          <span className={cn('text-xs text-muted-foreground', compact && 'font-medium')}>
              {t('notification.unreadCount', { count: list.filter((n) => !n.isRead).length })}
          </span>
          <Button
            variant={compact ? 'ghost' : 'outline'}
            size="sm"
            className={cn('h-8 gap-1.5 text-xs', compact && '-mr-1 rounded-full px-2.5 text-primary hover:bg-primary/10 hover:text-primary')}
            onClick={handleMarkAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t('notification.markAllRead')}
          </Button>
        </div>
      )}

      {loading && list.length === 0 ? (
        <MobileListSkeleton rows={4} showHeader={false} className={compact ? 'space-y-2' : undefined} />
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
            {tab === 'unread' ? t('notification.emptyUnread') : tab === 'read' ? t('notification.emptyRead') : t('notification.empty')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/50">
            {tab === 'unread' ? t('notification.emptyUnreadDesc') : t('notification.emptyAllDesc')}
          </p>
        </div>
      ) : (
        <div className={cn(
          compact
            ? 'space-y-2'
            : 'space-y-3'
        )}>
          {list.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              onClick={() => handleClickItem(item)}
              formatRelativeTime={formatRelativeTime}
              compact={compact}
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

export function NotificationListPage({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const tabConfig = useTabConfig()
  const formatRelativeTime = useFormatRelativeTime()
  return (
    <div className={cn('min-h-0', compact ? 'flex h-full flex-col' : 'space-y-5')}>
      {/* 页面标题 */}
      {!compact && (
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('notification.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('notification.subtitle')}
          </p>
        </div>
      )}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className={cn(compact ? 'flex min-h-0 flex-1 flex-col' : 'space-y-3')}
      >
        <div className="shrink-0">
          <TabsList className={cn('h-10 w-full rounded-full bg-muted/60 p-0.5', compact && 'border border-border/35 bg-muted/45')}>
            {tabConfig.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn('flex-1 gap-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm', compact && 'rounded-full text-xs')}
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className={cn(compact ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3' : undefined)}>
          <NotificationTabContent tab={activeTab} formatRelativeTime={formatRelativeTime} compact={compact} />
        </div>
      </Tabs>
    </div>
  )
}
