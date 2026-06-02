import React from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, CheckCircle2, User, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  if (!item) return null

  const formattedDate = new Date(item.createdAt).toLocaleString(undefined, {
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
          'flex flex-col bg-background p-0 text-foreground [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:p-2',
          isMobile
            ? 'h-[82vh] max-h-[82vh] rounded-t-[28px] border-border/20 shadow-[0_-24px_80px_rgba(0,0,0,.22)] backdrop-blur-2xl'
            : 'sm:max-w-[480px]'
        )}
      >
        <SheetHeader className="flex-shrink-0 border-b border-border/45 px-5 pb-4 pt-3 text-left">
          <div className="flex items-start gap-3 pr-10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="line-clamp-2 text-base font-semibold leading-tight tracking-tight">
                  {item.title}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs">
                  {formattedDate}
                </SheetDescription>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* <Badge
              variant={item.type === 'broadcast' ? 'outline' : 'secondary'}
              className="h-5 gap-1 text-[10px] px-1.5 font-normal"
            >
              {item.type === 'broadcast' ? (
                <Volume2 className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              {item.type === 'broadcast' ? t('notification.typeBroadcast') : t('notification.typeDirect')}
            </Badge>
            {item.isRead && (
              <span className="inline-flex items-center gap-1 text-[11px] text-primary/70">
                <CheckCircle2 className="h-3 w-3" />
                {t('notification.read')}
              </span>
            )} */}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
          <MarkdownRenderer content={item.content} variant="teaching" />

          {item.readAt && (
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-primary/60" />
              <span className="text-xs text-muted-foreground/70">
                {t('notification.readAt', { time: new Date(item.readAt).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                }) })}
              </span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
