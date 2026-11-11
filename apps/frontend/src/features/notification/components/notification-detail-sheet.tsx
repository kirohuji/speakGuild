import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Gift,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetDescription, SheetTitle,
} from '@/components/ui/sheet'
import { BlurFade } from '@/components/ui/blur-fade'
import { NumberTicker } from '@/components/ui/number-ticker'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { cn } from '@/lib/cn'
import {
  getNotificationActionUrl,
  type NotificationItem,
} from '@/features/notification/api'
import {
  extractGiftDays,
  resolveNotificationVariant,
  type NotificationVariant,
} from '@/features/notification/notification-variant'
import { useIsMobile } from '@/hooks/use-mobile'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'

interface Props {
  item: NotificationItem | null
  open: boolean
  onClose: () => void
  onMarkRead?: () => void
}

/** 仅反馈 / 维护 / 会员·奖励到账保留嵌套底；其余类型正文直出 */
function panelWash(variant: 'maintenance' | 'feedback' | 'membership') {
  switch (variant) {
    case 'maintenance':
      return 'bg-destructive/10'
    case 'feedback':
      return 'bg-muted/35'
    case 'membership':
      return 'bg-primary/[0.06]'
  }
}

export function NotificationDetailSheet({ item, open, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  if (!item) return null

  const variant = resolveNotificationVariant(item)
  const formattedDate = new Date(item.createdAt).toLocaleString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const actionUrl = getNotificationActionUrl(item)
    || (variant === 'membership' ? '/member' : undefined)

  const handleAction = () => {
    if (!actionUrl) return
    onClose()
    navigate(actionUrl.startsWith('#') ? actionUrl.slice(1) : actionUrl)
  }

  const header = (
    <DetailHeader
      onClose={isMobile ? onClose : undefined}
      backLabel={t('common.back')}
      isRead={item.isRead}
      readLabel={t('notification.read')}
    />
  )

  const body = (
    <NotificationDetailBody
      item={item}
      variant={variant}
      formattedDate={formattedDate}
      actionUrl={actionUrl}
      onAction={handleAction}
    />
  )

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="app-surface drawer-surface left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 pt-safe text-foreground shadow-none sm:rounded-none [&>button]:hidden"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{item.title}</DialogTitle>
          <DialogDescription className="sr-only">{formattedDate}</DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col">
            {header}
            {body}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="app-surface drawer-surface flex flex-col border-0 p-0 text-foreground shadow-none sm:max-w-[480px] [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:p-2"
      >
        <SheetTitle className="sr-only">{item.title}</SheetTitle>
        <SheetDescription className="sr-only">{formattedDate}</SheetDescription>
        <div className="flex min-h-0 flex-1 flex-col pt-10">
          {header}
          {body}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailHeader({
  onClose,
  backLabel,
  isRead,
  readLabel,
}: {
  onClose?: () => void
  backLabel: string
  isRead: boolean
  readLabel: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-3">
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          onClick={onClose}
          aria-label={backLabel}
        >
          <ArrowLeft className="size-5" />
        </Button>
      ) : (
        <div className="size-10 shrink-0" />
      )}
      <div className="min-w-0 flex-1" />
      {isRead ? (
        <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          <CheckCircle2 className="size-3.5" />
          {readLabel}
        </span>
      ) : null}
    </div>
  )
}

function NotificationDetailBody({
  item,
  variant,
  formattedDate,
  actionUrl,
  onAction,
}: {
  item: NotificationItem
  variant: NotificationVariant
  formattedDate: string
  actionUrl?: string
  onAction: () => void
}) {
  const { t } = useTranslation()
  const giftDays = variant === 'membership' ? extractGiftDays(item.content) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {variant === 'campaign' && item.imageUrl ? (
          <BlurFade delay={0.05}>
            <div>
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full aspect-[10/7] object-cover"
              />
              <div className="flex flex-col gap-2 px-5 py-4">
                <h2 className="text-[22px] font-semibold leading-snug tracking-tight text-foreground">
                  {item.title}
                </h2>
                <p className="text-xs text-muted-foreground">{formattedDate}</p>
              </div>
            </div>
          </BlurFade>
        ) : (
          <BlurFade delay={0.05}>
            <div className="flex flex-col gap-2 px-5 pb-2 pt-1">
              <h2 className="text-[22px] font-semibold leading-snug tracking-tight text-foreground">
                {item.title}
              </h2>
              <p className="text-xs text-muted-foreground">{formattedDate}</p>

              {giftDays != null && (
                <div className="mt-2 flex items-end gap-2 rounded-2xl bg-primary/[0.06] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground">{t('notification.giftDaysLabel')}</p>
                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <NumberTicker
                        value={giftDays}
                        className="text-3xl font-semibold tracking-tight text-primary"
                      />
                      <span className="text-sm text-muted-foreground">{t('notification.giftDaysUnit')}</span>
                    </div>
                  </div>
                  <Gift className="mb-1 size-5 text-primary/50" />
                </div>
              )}
            </div>
          </BlurFade>
        )}

        <BlurFade delay={0.12}>
          <div className="px-5 pb-6 pt-4">
            {variant === 'feedback' ? (
              <FeedbackBody content={item.content} />
            ) : variant === 'maintenance' ? (
              <div className={cn('rounded-2xl px-4 py-4', panelWash('maintenance'))}>
                <div className="mb-3 flex items-center gap-2 text-destructive">
                  <TriangleAlert className="size-4" />
                  <span className="text-xs font-medium">{t('notification.variantMaintenance')}</span>
                </div>
                <MarkdownRenderer content={item.content} className="prose-p:my-2" />
              </div>
            ) : variant === 'membership' ? (
              <div className={cn('rounded-2xl px-4 py-4', panelWash('membership'))}>
                <MarkdownRenderer content={item.content} className="prose-p:my-2" />
              </div>
            ) : (
              <MarkdownRenderer content={item.content} className="prose-p:my-2.5" />
            )}
          </div>
        </BlurFade>
      </div>

      {actionUrl && (
        <div className="shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
          {variant === 'campaign' ? (
            <ShimmerButton
              type="button"
              onClick={onAction}
              background="hsl(var(--primary))"
              className="w-full border-0 shadow-none"
            >
              <span className="flex items-center justify-center gap-2 text-sm font-medium text-primary-foreground">
                {t('notification.openAction')}
                <ArrowRight className="size-4" />
              </span>
            </ShimmerButton>
          ) : (
            <Button
              type="button"
              className="h-11 w-full rounded-full border-0 shadow-none"
              onClick={onAction}
            >
              {t('notification.openAction')}
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackBody({ content }: { content: string }) {
  const { t } = useTranslation()
  const parts = content.split(/\n---\n/)
  if (parts.length < 2) {
    return (
      <div className={cn('rounded-2xl px-4 py-4', panelWash('feedback'))}>
        <MarkdownRenderer content={content} className="prose-p:my-2" />
      </div>
    )
  }

  const [quote, ...rest] = parts
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-muted/35 px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
          <Bell className="size-3.5" />
          <span className="text-[11px]">{t('notification.feedbackOriginal')}</span>
        </div>
        <MarkdownRenderer content={quote.trim()} className="prose-p:my-1.5 prose-blockquote:border-0" />
      </div>
      <div className={cn('rounded-2xl px-4 py-4', panelWash('membership'))}>
        <MarkdownRenderer content={rest.join('\n---\n').trim()} className="prose-p:my-2" />
      </div>
    </div>
  )
}
