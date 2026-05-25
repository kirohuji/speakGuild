import React from 'react'
import { Bell, Clock, CheckCircle2, X, User, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/cn'
import type { NotificationItem } from '@/features/notification/api'
import { useIsMobile } from '@/hooks/use-mobile'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'

interface Props {
  item: NotificationItem | null
  open: boolean
  onClose: () => void
  onMarkRead?: () => void
}

export function NotificationDetailSheet({ item, open, onClose, onMarkRead }: Props) {
  const isMobile = useIsMobile()

  if (!item) return null

  const formattedDate = new Date(item.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col p-0',
          isMobile ? 'h-[85vh] rounded-t-2xl' : 'sm:max-w-[480px]'
        )}
      >
        {/* 顶部拖动条（移动端） */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-0">
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/20" />
          </div>
        )}

        {/* Header */}
        <SheetHeader className="flex-shrink-0 px-5 pt-4 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base leading-tight line-clamp-2">
                  {item.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  通知详情
                </SheetDescription>
              </div>
            </div>
            {/* <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 -mr-1"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button> */}
          </div>

          {/* 元信息 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
        </SheetHeader>

        <Separator className="mt-4" />

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
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
      </SheetContent>
    </Sheet>
  )
}
