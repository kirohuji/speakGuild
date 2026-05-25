import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Clock, CheckCircle2, User, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { NotificationItem } from '@/features/notification/api'
import { useIsMobile } from '@/hooks/use-mobile'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'

export function NotificationDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const item = (location.state as any)?.item as NotificationItem | undefined

  useEffect(() => {
    if (!item) {
      const timer = setTimeout(() => navigate('/notifications', { replace: true }), 3000)
      return () => clearTimeout(timer)
    }
  }, [item, navigate])

  if (!item) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Bell className="h-12 w-12 text-muted-foreground/20" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">通知不存在或已过期</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/notifications')}>
          返回列表
        </Button>
      </div>
    )
  }

  const formattedDate = new Date(item.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-5">
      {/* 返回按钮 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">通知详情</h1>
          <p className="text-xs text-muted-foreground">查看完整的通知内容</p>
        </div>
      </div>

      {/* 通知卡片 */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {/* 头部 */}
        <div className="flex items-start gap-3.5 px-5 pt-5 pb-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug">{item.title}</h2>
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

        <Separator />

        {/* 内容 */}
        <div className="px-5 py-5">
          <div className="rounded-xl bg-muted/20 border border-border/50 p-5">
            <MarkdownRenderer content={item.content} />
          </div>

          {item.readAt && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary/[0.03] px-3.5 py-2.5">
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
      </div>
    </div>
  )
}
