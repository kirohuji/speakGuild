import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight, Download, Loader2, RotateCcw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import type { MyUnit } from '../api/learning-api'
import { getCategoryIcon } from './category-icons'
import { LearningWeekTracker } from './week-tracker'
import { useLearningStore } from '@/stores/learning.store'

interface Props {
  myUnits: MyUnit[]
  inProgress: MyUnit[]
  completed: MyUnit[]
  loading: boolean
  onGoToShop: () => void
  onRefresh?: () => void
  onQuitUnit?: (id: string) => Promise<void>
  downloadedPackIds?: string[]
  updatePackIds?: string[]
  installingPackIds?: string[]
  onDownloadUnitPack?: (id: string) => Promise<void>
}

export function MyLearningView({
  myUnits,
  inProgress,
  completed,
  loading,
  onGoToShop,
  onRefresh,
  onQuitUnit,
  downloadedPackIds = [],
  updatePackIds = [],
  installingPackIds = [],
  onDownloadUnitPack,
}: Props) {
  const { t } = useTranslation()
  const downloadedPackIdSet = useMemo(() => new Set(downloadedPackIds), [downloadedPackIds])
  const updatePackIdSet = useMemo(() => new Set(updatePackIds), [updatePackIds])
  const installingPackIdSet = useMemo(() => new Set(installingPackIds), [installingPackIds])

  if (loading && myUnits.length === 0) {
    return <MobilePageLoading rows={3} minHeightClassName="min-h-[40vh]" />
  }

  if (myUnits.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-14 text-center">
        <BookOpen className="size-10 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">{t('learning.notStarted')}</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={(e) => { e.currentTarget.blur(); onGoToShop() }} data-spotlight="go-to-shop">
          {t('learning.goToShop')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <LearningWeekTracker />

      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">{t('learning.inProgress')}</h2>
          <div className="space-y-2">
            {inProgress.map((unit) => (
              <InProgressUnitCard
                key={unit.id}
                unit={unit}
                isPackDownloaded={downloadedPackIdSet.has(unit.id)}
                hasPackUpdate={updatePackIdSet.has(unit.id)}
                isPackInstalling={installingPackIdSet.has(unit.id)}
                onDownloadPack={() => onDownloadUnitPack?.(unit.id)}
                onQuit={() => onQuitUnit?.(unit.id)}
              />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">{t('learning.completed')}</h2>
          <div className="space-y-2.5">
            {completed.map((unit) => (
              <MyUnitCard key={unit.id} unit={unit} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function InProgressUnitCard({
  unit,
  isPackDownloaded,
  hasPackUpdate,
  isPackInstalling,
  onDownloadPack,
  onQuit,
}: {
  unit: MyUnit
  isPackDownloaded: boolean
  hasPackUpdate: boolean
  isPackInstalling: boolean
  onDownloadPack?: () => Promise<void>
  onQuit?: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [quitting, setQuitting] = useState(false)
  const Icon = getCategoryIcon(unit.categoryName)
  const needsDownload = !isPackDownloaded
  const pct = Math.max(0, Math.min(100, unit.completionPercent ?? 0))
  const completedPracticeCount = unit.progress?.completedPracticeCount ?? 0
  const totalPracticeCount = unit.progress?.totalPracticeCount ?? unit.topicCount ?? 0
  const downloadTask = useLearningStore((state) => state.downloadTasks.find((task) => task.packId === unit.id))
  const isTaskActive = !!downloadTask && downloadTask.status !== 'done' && downloadTask.status !== 'error'
  const isPaused = downloadTask?.status === 'paused'
  const isUninstalling = downloadTask?.kind === 'uninstall' && isTaskActive
  const isPackBusy = isPackInstalling || (isTaskActive && !isPaused)
  const resumePackTask = useLearningStore((state) => state.resumePackTask)
  const showPackAction = isTaskActive || needsDownload || hasPackUpdate
  const packActionText = (() => {
    if (isPaused) return downloadTask?.kind === 'uninstall' ? '卸载已暂停' : '下载已暂停'
    if (isTaskActive) {
      if (downloadTask?.kind === 'uninstall') return downloadTask.stepLabel ?? '卸载中'
      if (downloadTask?.status === 'queued') return '排队下载中'
      return downloadTask?.stepLabel ?? '下载中'
    }
    if (needsDownload) return t('learning.packNeedsDownload')
    return t('learning.packUpdateAvailable', { defaultValue: '学习包有版本更新' })
  })()

  const handleQuit = useCallback(async () => {
    if (isPackBusy) return
    setQuitting(true)
    setConfirmQuit(false)
    try {
      await onQuit?.()
    } catch {
      toast.error(t('learning.quitFailed'))
    } finally {
      setQuitting(false)
    }
  }, [isPackBusy, onQuit, t])

  const handleDownloadPack = useCallback(async () => {
    if (!onDownloadPack || isPackBusy) return
    try {
      await onDownloadPack()
    } catch {
      toast.error(t('learning.packDownloadFailed'))
    }
  }, [isPackBusy, onDownloadPack, t])

  const handleResumePackTask = useCallback(async () => {
    if (!downloadTask || downloadTask.status !== 'paused') return
    try {
      await resumePackTask(unit.id)
    } catch {
      toast.error(downloadTask.kind === 'uninstall' ? '继续卸载失败，请重试' : t('learning.packDownloadFailed'))
    }
  }, [downloadTask, resumePackTask, t, unit.id])

  return (
    <div className={cn('overflow-hidden rounded-lg bg-muted/30 transition-opacity', isPackBusy && 'opacity-55')}>
      <div className="p-3.5">
        <Link
          to={`/learning/units/${unit.id}`}
          aria-disabled={needsDownload || isPackBusy}
          onClick={(event) => {
            if (needsDownload || isPackBusy) event.preventDefault()
          }}
          className={cn(
            'flex gap-3',
            (needsDownload || isPackBusy) && 'cursor-default',
          )}
        >
          <div className="relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
            <Icon className="relative size-7" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
              </div>
              <button type="button" disabled={isPackBusy} onClick={(e) => { e.preventDefault(); if (!isPackBusy) setConfirmQuit(true) }}
                className={cn(
                  '-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400 disabled:pointer-events-none disabled:opacity-45',
                )}>
                {isUninstalling ? <Loader2 className="size-5 animate-spin" /> : <X className="size-5" />}
              </button>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
            <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
              <span>{unit.vocabCount} {t('learning.vocab')}</span>
              <span>{unit.chunkCount} {t('learning.chunks')}</span>
              <span>{unit.topicCount} {t('learning.topics')}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{t('learning.practiceProgress', { done: completedPracticeCount, total: totalPracticeCount })}</span>
                <span className="font-semibold tabular-nums text-foreground/75">{pct}%</span>
              </div>
              <Progress value={pct} className="h-1" />
            </div>
          </div>
        </Link>

        {showPackAction && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-xs text-amber-700 dark:text-amber-300">{packActionText}</p>
            <Button
              type="button"
              variant="ghost"
              disabled={isPackBusy || (!isPaused && !onDownloadPack)}
              onClick={isPaused ? handleResumePackTask : handleDownloadPack}
              className={cn(
                'h-8 shrink-0 rounded-full px-2 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200',
                isPackBusy || isPaused ? 'min-w-14 gap-1.5' : 'w-8 px-0',
              )}
              aria-label={isPaused ? packActionText : isPackBusy ? t('learning.packDownloading') : t('learning.downloadPack')}
              title={isPaused ? packActionText : isPackBusy ? t('learning.packDownloading') : t('learning.downloadPack')}
            >
              {isPaused ? (
                <span className="text-[11px] font-semibold">继续</span>
              ) : isPackBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-[11px] font-semibold tabular-nums">{Math.round(downloadTask?.progress ?? 0)}%</span>
                </>
              ) : (
                <Download className="size-4" />
              )}
            </Button>
          </div>
        )}

        <Dialog open={confirmQuit} onOpenChange={setConfirmQuit}>
          <DialogContent className="rounded-2xl p-6 sm:mx-auto sm:max-w-xs w-[90vw]">
            <DialogHeader className="p-0">
              <DialogTitle className="text-base">{t('learning.quitConfirmTitle')}</DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-5">
                {t('learning.quitConfirmDesc', { title: unit.title })}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" disabled={quitting} onClick={() => setConfirmQuit(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" className="flex-1 rounded-xl" disabled={quitting} onClick={handleQuit}>
                {quitting ? t('learning.uninstalling', { defaultValue: '卸载中' }) : t('learning.quitConfirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function MyUnitCard({ unit }: { unit: MyUnit }) {
  const { t } = useTranslation()
  const pct = Math.max(0, Math.min(100, unit.completionPercent ?? 0))
  const isCompleted = pct >= 100
  const Icon = isCompleted ? CheckCircle2 : getCategoryIcon(unit.categoryName)
  const completedPracticeCount = unit.progress?.completedPracticeCount ?? 0
  const totalPracticeCount = unit.progress?.totalPracticeCount ?? unit.topicCount ?? 0

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-lg p-3 transition-colors',
        isCompleted ? 'bg-muted/25 text-muted-foreground' : 'bg-muted/30',
      )}
    >
      <Link
        to={`/learning/units/${unit.id}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          isCompleted && 'opacity-65',
        )}
      >
        <div className={cn(
          'relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40',
          isCompleted && 'from-slate-100 via-emerald-50 to-slate-100 text-emerald-600 opacity-80 dark:from-slate-900/70 dark:via-emerald-950/30 dark:to-slate-950/40',
        )}>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
          <Icon className="relative size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className={cn('line-clamp-1 flex-1 text-sm font-semibold leading-5', isCompleted ? 'text-muted-foreground' : 'text-foreground')}>{unit.title}</p>
            <Badge variant={isCompleted ? 'secondary' : 'outline'} className="h-5 shrink-0 rounded-full px-2 text-[10px]">
              {isCompleted ? t('learning.done') : `${pct}%`}
            </Badge>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
          <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
            <span>{unit.vocabCount} {t('learning.vocab')}</span>
            <span>{unit.chunkCount} {t('learning.chunks')}</span>
            <span>{unit.topicCount} {t('learning.topics')}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {isCompleted && <CheckCircle2 className="size-3.5 text-emerald-600" />}
            <span>{t('learning.practiceProgress', { done: completedPracticeCount, total: totalPracticeCount })}</span>
          </div>
          {!isCompleted && unit.topics && unit.topics.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-1 rounded-full bg-primary/40" />
              <span className="line-clamp-1">{unit.topics[0]?.title}</span>
              {unit.topics.length > 1 && <span className="shrink-0 text-muted-foreground/70">+{unit.topics.length - 1}</span>}
            </div>
          )}
          {!isCompleted && <Progress value={pct} className="mt-2 h-1" />}
        </div>
      </Link>
      {isCompleted ? (
        <Link
          to={`/learning/units/${unit.id}`}
          className="absolute bottom-2.5 right-2.5 inline-flex h-7 items-center gap-1 rounded-full border border-border/70 bg-background/85 px-2.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur active:bg-muted"
        >
          <RotateCcw className="size-3" />
          {t('learning.learnAgain')}
        </Link>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
      )}
    </div>
  )
}
