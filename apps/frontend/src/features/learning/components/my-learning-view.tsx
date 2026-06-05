import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import type { MyUnit } from '../api/learning-api'
import { getCategoryIcon } from './category-icons'
import { LearningWeekTracker } from './week-tracker'

interface Props {
  myUnits: MyUnit[]
  inProgress: MyUnit[]
  completed: MyUnit[]
  loading: boolean
  onGoToShop: () => void
  onRefresh?: () => void
  onQuitUnit?: (id: string) => Promise<void>
}

export function MyLearningView({ myUnits, inProgress, completed, loading, onGoToShop, onRefresh, onQuitUnit }: Props) {
  const { t } = useTranslation()

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
  }

  if (myUnits.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-14 text-center">
        <BookOpen className="size-10 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">{t('learning.notStarted')}</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onGoToShop} data-spotlight="go-to-shop">
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
              <InProgressUnitCard key={unit.id} unit={unit} onQuit={() => onQuitUnit?.(unit.id)} />
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

function InProgressUnitCard({ unit, onQuit }: { unit: MyUnit; onQuit?: () => Promise<void> }) {
  const { t } = useTranslation()
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [quitting, setQuitting] = useState(false)
  const Icon = getCategoryIcon(unit.categoryName)

  const handleQuit = useCallback(async () => {
    setQuitting(true)
    try {
      await onQuit?.()
      toast.success(t('learning.quitSuccess'))
    } catch {
      toast.error(t('learning.quitFailed'))
    } finally {
      setQuitting(false)
      setConfirmQuit(false)
    }
  }, [t, onQuit])

  return (
    <div className="overflow-hidden rounded-lg bg-muted/30">
      <div className="p-3.5">
        <Link to={`/learning/units/${unit.id}`} className="flex gap-3">
          <div className="relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
            <Icon className="relative size-7" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
              </div>
              <button type="button" onClick={(e) => { e.preventDefault(); setConfirmQuit(true) }}
                className="shrink-0 rounded-md p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400">
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
            <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
              <span>{unit.vocabCount} {t('learning.vocab')}</span>
              <span>{unit.chunkCount} {t('learning.chunks')}</span>
              <span>{unit.topicCount} {t('learning.topics')}</span>
            </div>
          </div>
        </Link>

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
                {quitting ? t('common.loading') : t('learning.quitConfirm')}
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
  const pct = unit.completionPercent
  const isCompleted = pct >= 100
  const Icon = isCompleted ? CheckCircle2 : getCategoryIcon(unit.categoryName)

  return (
    <Link
      to={`/learning/units/${unit.id}`}
      className={cn(
        'flex items-center gap-3 rounded-lg bg-muted/30 p-3 transition-colors',
        isCompleted ? 'hover:bg-emerald-500/[0.06]' : 'hover:bg-muted/50',
      )}
    >
      <div className={cn(
        'relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40',
        isCompleted && 'from-emerald-100 via-emerald-50 to-slate-100 text-emerald-600 dark:from-emerald-950/50 dark:via-emerald-950/30 dark:to-slate-950/40',
      )}>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
        <Icon className="relative size-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</p>
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
        {!isCompleted && unit.topics && unit.topics.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-1 rounded-full bg-primary/40" />
            <span className="line-clamp-1">{unit.topics[0]?.title}</span>
            {unit.topics.length > 1 && <span className="shrink-0 text-muted-foreground/70">+{unit.topics.length - 1}</span>}
          </div>
        )}
        {!isCompleted && <Progress value={pct} className="mt-2 h-1" />}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
    </Link>
  )
}
