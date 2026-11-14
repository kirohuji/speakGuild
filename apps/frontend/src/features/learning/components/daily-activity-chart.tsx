import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { ExpandedActivityChart } from './activity-chart'

export interface HourActivity { hour: number; questionCount: number; activeSeconds: number }
export function dailyChartData(hours: HourActivity[], futureAfter?: number) {
  const byHour = new Map(hours.map(hour => [hour.hour, hour]))
  return Array.from({ length: 24 }, (_, hour) => {
    const stat = byHour.get(hour)
    const future = futureAfter !== undefined && hour > futureAfter
    return { hour, minutes: future ? null : (stat?.activeSeconds ?? 0) / 60, questions: future ? null : stat?.questionCount ?? 0, seconds: stat?.activeSeconds ?? 0 }
  })
}
export function DailyActivityChart({ hours, complete, hasActivity, today, pending = false, period, onPrevious, onNext, canGoNext, busy = false }: {
  pending?: boolean
  hours: HourActivity[]
  complete: boolean
  hasActivity: boolean
  today: boolean
  period: string
  onPrevious: () => void
  onNext: () => void
  canGoNext: boolean
  busy?: boolean
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number | null>(null)
  const rows = dailyChartData(hours, today ? new Date().getHours() : undefined)
  const awaitingHistory = pending && !hours.length
  const items = rows.map(row => ({
    key: String(row.hour),
    title: `${String(row.hour).padStart(2, '0')}:00–${String(row.hour + 1).padStart(2, '0')}:00`,
    label: `${row.hour}:00`,
    minutes: awaitingHistory ? null : row.minutes,
    questions: awaitingHistory ? null : row.questions,
  }))
  const notice = pending ? t('learning.dayDetails.historyPending') : !complete && hasActivity ? t('learning.dayChart.partial') : undefined
  return <ExpandedActivityChart
    title={t('learning.dayChart.title')} hint={t('learning.chartLegend')} period={period}
    onPrevious={onPrevious} onNext={onNext} canGoNext={canGoNext}
    previousLabel={t('learning.dayChart.previousDay')} nextLabel={t('learning.dayChart.nextDay')} busy={busy}
    items={items} selectedKey={selected === null ? undefined : String(selected)} onSelect={setSelected}
    barSize={7} minimumMinutes={60} minimumQuestions={160} notice={notice}
    footer={<div className="flex h-[2.15rem] items-center justify-between">
      {[0, 6, 12, 18, 23].map(hour => <button key={hour} type="button" disabled={awaitingHistory || rows[hour].minutes === null} onClick={() => setSelected(hour)} className={cn('rounded-xl px-1 py-2 text-[10px] tabular-nums text-foreground hover:bg-muted disabled:text-muted-foreground disabled:opacity-35', selected === hour && 'bg-muted')}>{hour}:00</button>)}
    </div>}
  />
}
