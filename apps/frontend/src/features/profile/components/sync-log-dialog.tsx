import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useOfflineSyncStore, type OfflineSyncLogEntry } from '@/stores/offline-sync.store'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 5

function formatTime(value: string | undefined, locale: string) {
  if (!value) return ''
  return new Date(value).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDetail(log: OfflineSyncLogEntry, t: (key: string, opts?: Record<string, unknown>) => string) {
  const detail = log.detail as {
    push?: { synced?: number; failed?: number; skipped?: number; operations?: Record<string, number> }
    pull?: { changed?: number; deleted?: number } | null
    refreshedPacks?: string[]
  } | null | undefined
  if (!detail) return null
  const parts: string[] = []
  if (detail.push) {
    const { synced = 0, failed = 0, skipped = 0 } = detail.push
    parts.push(t('settings.syncPushDetail', { synced, failed, skipped }))
  }
  if (detail.pull) {
    parts.push(t('settings.syncPullDetail', { count: (detail.pull.changed ?? 0) + (detail.pull.deleted ?? 0) }))
  }
  if (detail.refreshedPacks?.length) {
    parts.push(t('settings.syncPackUpdateDetail', { count: detail.refreshedPacks.length }))
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

interface SyncLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncLogDialog({ open, onOpenChange }: SyncLogDialogProps) {
  const { t, i18n } = useTranslation()
  const { logs, clearLogs } = useOfflineSyncStore()
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE))

  const pagedLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return logs.slice(start, start + PAGE_SIZE)
  }, [logs, page])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md gap-4 rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>{t('settings.syncLogTitle')}</DialogTitle>
          <DialogDescription className="text-xs">
            {t('settings.syncLogCountHint', { count: logs.length })}
          </DialogDescription>
        </DialogHeader>

        {logs.length > 0 ? (
          <div className="min-h-0 space-y-1.5 overflow-hidden">
            {pagedLogs.map((log) => {
              const Icon = log.status === 'running' ? Loader2 : log.status === 'failed' || log.error ? AlertCircle : CheckCircle2
              const tone = log.status === 'running'
                ? 'bg-primary/10 text-primary'
                : log.status === 'failed' || log.error
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-600'
              const detail = formatDetail(log, t)
              return (
                <div key={log.id} className="flex items-start gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
                  <div className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md', tone)}>
                    <Icon className={cn('size-3.5', log.status === 'running' && 'animate-spin')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-medium">
                        {log.status === 'running' ? t('settings.syncRunning') : log.summary}
                      </p>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                        {formatTime(log.finishedAt ?? log.startedAt, i18n.language)}
                      </span>
                    </div>
                    {(log.error || detail) && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        {log.error ?? detail}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-3.5" /> {t('common.prevPage')}
                </Button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('common.nextPage')} <ChevronRight className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('settings.syncEmpty')}</p>
        )}

        <DialogFooter className="sm:justify-start">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={() => { clearLogs(); onOpenChange(false) }}
            disabled={logs.length === 0}
          >
            <Trash2 className="size-3.5" /> {t('settings.clearAllLogs')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
