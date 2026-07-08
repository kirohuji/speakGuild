import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ChevronDown, DownloadCloud, Loader2, PackageOpen, Trash2 } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useLearningStore, type DownloadTask } from '@/stores/learning.store'

function activeTasks(tasks: DownloadTask[]) {
  return tasks.filter((task) => task.status !== 'done')
}

function isRunning(task: DownloadTask) {
  return task.status === 'downloading' || task.status === 'extracting' || task.status === 'uninstalling'
}

function statusLabel(task: DownloadTask, t: ReturnType<typeof useTranslation>['t']) {
  if (task.status === 'queued') return t('learning.packTaskQueued')
  if (task.status === 'paused') return task.stepLabel ?? t('learning.packTaskPaused')
  if (task.status === 'uninstalling') return task.stepLabel ?? t('learning.packTaskUninstalling')
  if (task.status === 'extracting') return task.stepLabel ?? t('learning.packTaskExtracting')
  if (task.status === 'error') return task.kind === 'uninstall' ? t('learning.packTaskUninstallFailed') : t('learning.packTaskDownloadFailed')
  return task.stepLabel ?? t('learning.packTaskDownloading')
}

function taskTitle(task: DownloadTask, t: ReturnType<typeof useTranslation>['t']) {
  return (task.kind ?? 'download') === 'uninstall' ? t('learning.packTaskUninstallTitle') : t('learning.packTaskDownloadTitle')
}

function taskPercent(task: DownloadTask) {
  return Math.max(0, Math.min(100, Math.round(task.progress || 0)))
}

function aggregatePercent(tasks: DownloadTask[]) {
  const running = tasks.filter((task) => task.status !== 'error')
  if (running.length === 0) return 0
  return Math.round(running.reduce((sum, task) => sum + taskPercent(task), 0) / running.length)
}

function compactPath(value?: string | null) {
  if (!value) return ''
  const clean = value.split('?')[0] ?? value
  const parts = clean.split('/').filter(Boolean)
  return parts.slice(-3).join('/') || clean
}

export function LearningPackDownloadStatusButton({
  onClick,
  className,
  mobile = false,
  embedded = false,
}: {
  onClick: () => void
  className?: string
  mobile?: boolean
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const downloadTasks = useLearningStore((state) => state.downloadTasks)
  const tasks = useMemo(() => activeTasks(downloadTasks), [downloadTasks])

  const running = tasks.some(isRunning)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('learning.packTasksTitle')}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
        embedded
          ? 'size-9 p-0.5 hover:bg-background/45'
          : 'border border-border/60 bg-background/70 shadow-sm hover:bg-muted',
        !embedded && (mobile ? 'size-9' : 'size-8'),
        className,
      )}
    >
      <DownloadCloud className={cn('shrink-0', mobile || embedded ? 'size-[18px]' : 'size-4')} />
      {tasks.length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
          {running ? (
            <Loader2 className="size-3 animate-spin text-primary" />
          ) : (
            <span className="size-2 rounded-full bg-primary" />
          )}
        </span>
      )}
    </button>
  )
}

export function LearningPackDownloadDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const downloadTasks = useLearningStore((state) => state.downloadTasks)
  const resumePackTask = useLearningStore((state) => state.resumePackTask)
  const tasks = useMemo(() => activeTasks(downloadTasks), [downloadTasks])
  const runningCount = tasks.filter(isRunning).length
  const percent = aggregatePercent(tasks)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[88svh] flex-col rounded-t-[28px] border-border/70 bg-background drawer-surface">
        <DrawerHeader className="shrink-0 px-4 pb-1 pt-2 text-left">
          <DrawerTitle className="flex items-center gap-2 text-base font-semibold">
            <DownloadCloud className="size-4 text-primary" />
            {t('learning.packTasksTitle')}
          </DrawerTitle>
          <p className="text-xs text-muted-foreground">
            {tasks.length > 0 ? t('learning.packTasksSummary', { count: runningCount, percent }) : t('learning.noPackTasks')}
          </p>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {tasks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <PackageOpen className="mb-3 size-8 opacity-45" />
              {t('learning.noPackTasksEmpty')}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <details
                  key={task.packId}
                  open={isRunning(task) || task.status === 'error'}
                  className="group overflow-hidden rounded-lg bg-muted/30"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5">
                    <div className="flex aspect-square size-[44px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40">
                      {task.status === 'error' ? (
                        <AlertCircle className="size-4 text-destructive" />
                      ) : task.status === 'paused' ? (
                        <DownloadCloud className="size-4 text-muted-foreground" />
                      ) : task.kind === 'uninstall' ? (
                        <Trash2 className="size-4 text-destructive/80" />
                      ) : isRunning(task) ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <DownloadCloud className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{taskPercent(task)}%</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate">{taskTitle(task, t)} · {statusLabel(task, t)}</span>
                        {typeof task.current === 'number' && typeof task.total === 'number' && task.total > 0 && (
                          <span className="shrink-0 tabular-nums">{task.current}/{task.total}</span>
                        )}
                      </div>
                      <Progress value={taskPercent(task)} className="mt-2 h-1" />
                    </div>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="border-t border-border/40 px-3.5 py-3 text-xs">
                    {task.status === 'error' ? (
                      <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
                        {task.error ?? (task.kind === 'uninstall' ? t('learning.packTaskUninstallFailedRetry') : t('learning.packTaskDownloadFailedRetry'))}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span>{task.kind === 'uninstall' ? t('learning.packTaskCurrentStep') : t('learning.packTaskCurrentResource')}</span>
                          {typeof task.total === 'number' && task.total > 0 && typeof task.current === 'number' && (
                            <span className="tabular-nums">{t('learning.packTaskRemaining', { count: Math.max(0, task.total - task.current) })}</span>
                          )}
                        </div>
                        <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground">
                          {task.kind === 'uninstall' ? (task.stepLabel || task.step || t('learning.packTaskWaiting')) : (compactPath(task.currentItem) || task.step || t('learning.packTaskWaiting'))}
                        </code>
                        {task.status === 'paused' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-1 h-8 w-full rounded-full text-xs"
                            onClick={() => void resumePackTask(task.packId)}
                          >
                            {task.kind === 'uninstall' ? t('learning.resumeUninstall') : t('learning.resumeDownload')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
