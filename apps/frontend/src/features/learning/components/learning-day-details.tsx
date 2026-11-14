import { useTranslation } from 'react-i18next'
import { CalendarCheck, Clock3, ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { makeupAvailability } from '@/features/points/makeup-policy'
import type { CheckInCalendar } from '@/features/points/api'

export function LearningDayDetails({ date, dateLabel, today, statistics, historyComplete, calendar, online, busy, onMakeup }: {
  date: string; dateLabel: string; today: string
  statistics?: { questionCount: number; activeSeconds: number }
  historyComplete: boolean; calendar: CheckInCalendar | null; online: boolean; busy: boolean
  onMakeup: () => void
}) {
  const { t } = useTranslation()
  const checked = calendar?.dates.includes(date)
  const madeUp = calendar?.makeupDates?.includes(date)
  const availability = makeupAvailability(date, calendar, online, today)
  const unknown = !statistics && !historyComplete
  const seconds = statistics?.activeSeconds ?? 0
  const duration = unknown ? '—' : seconds > 0 && seconds < 60 ? t('learning.dayDetails.lessMinute') : t('learning.minutesWithCount', { count: Math.ceil(seconds / 60) })
  const message = availability === 'insufficient' ? t('learning.dayDetails.insufficient', { cost: calendar?.makeup?.cost, balance: calendar?.makeup?.pointsBalance })
    : t(`learning.dayDetails.${availability}`)
  return (
    <section className="flex shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5" aria-label={t('learning.dayDetails.title')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{dateLabel}</p>
        <Badge variant={madeUp ? 'outline' : 'secondary'}>
          {checked ? t(madeUp ? 'learning.dayDetails.madeUp' : 'learning.dayDetails.checkedIn') : t(calendar ? 'learning.dayDetails.notCheckedIn' : 'learning.dayDetails.statusPending')}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl bg-background/70 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ListChecks className="size-3.5" />{t('learning.questionsCompleted')}</p>
          <p className="text-lg font-semibold tabular-nums">{unknown ? '—' : t('learning.dayDetails.questions', { count: statistics?.questionCount ?? 0 })}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-background/70 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{t('learning.activeDuration')}</p>
          <p className="text-lg font-semibold tabular-nums">{duration}</p>
        </div>
      </div>
      {unknown && <p className="text-xs text-muted-foreground">{t('learning.dayDetails.historyPending')}</p>}
      {!unknown && !statistics && <p className="text-xs text-muted-foreground">{t('learning.dayDetails.noPractice')}</p>}
      {date < today && !checked && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">{t('learning.dayDetails.makeupHint')}</p>
            <Button type="button" size="sm" variant="outline" disabled={availability !== 'ready' || busy} onClick={onMakeup}>
              {busy ? <Spinner data-icon="inline-start" /> : <CalendarCheck data-icon="inline-start" />}
              {calendar?.makeup ? t('learning.dayDetails.makeupButton', { cost: calendar.makeup.cost }) : t('learning.dayDetails.makeup')}
            </Button>
          </div>
          {availability !== 'ready' && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
      )}
    </section>
  )
}
