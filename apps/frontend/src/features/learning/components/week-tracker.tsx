import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth, endOfWeek, endOfYear, format, isAfter, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { enUS, ja, zhCN } from 'date-fns/locale'
import { CalendarDays, CalendarRange, Flame, CalendarCheck, ChevronLeft, ChevronRight, Clock3, ListChecks, BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/stores/learning.store'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function LearningWeekTracker() {
  const { t } = useTranslation()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const todayIndex = new Date().getDay()
  const mondayIndex = todayIndex === 0 ? 6 : todayIndex - 1
  const weekDays = [t('learning.weekDays.0'), t('learning.weekDays.1'), t('learning.weekDays.2'), t('learning.weekDays.3'), t('learning.weekDays.4'), t('learning.weekDays.5'), t('learning.weekDays.6')]

  return (
    <>
      <button
        type="button"
        onClick={() => setCalendarOpen(true)}
        aria-label={t('learning.checkInCalendar')}
        className="w-full rounded-lg bg-muted/30 p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t('learning.thisWeek')}</p>
          </div>
          <Badge variant="secondary" className="h-6 rounded-full px-2 text-[10px]">
            {t('learning.checkInCalendar')}
          </Badge>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, index) => {
            const isToday = index === mondayIndex
            const isPast = index < mondayIndex
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-xs font-medium',
                    isToday && 'bg-background text-foreground',
                    isPast && 'bg-background/70 text-muted-foreground',
                    !isToday && !isPast && 'text-muted-foreground/50',
                  )}
                >
                  {day}
                </div>
                <span className={cn('size-1 rounded-full', isToday ? 'bg-primary' : 'bg-transparent')} />
              </div>
            )
          })}
        </div>
      </button>
      <CheckInCalendarDrawer open={calendarOpen} onOpenChange={setCalendarOpen} />
    </>
  )
}

function CheckInCalendarDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const data = useLearningStore((s) => s.checkInData)
  const loading = useLearningStore((s) => s.checkInLoading)
  const fetchCheckInCalendar = useLearningStore((s) => s.fetchCheckInCalendar)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [year, setYear] = useState(() => startOfYear(new Date()))
  const [view, setView] = useState<'week' | 'month' | 'year'>('week')
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date())
  const today = useMemo(() => startOfDay(new Date()), [])
  const calendarLocale = i18n.language.startsWith('ja')
    ? ja
    : i18n.language.startsWith('en')
      ? enUS
      : zhCN
  const visibleRange = useMemo(() => {
    if (view === 'week') {
      return { startDate: format(weekStart, 'yyyy-MM-dd'), endDate: format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd') }
    }
    if (view === 'year') {
      return { startDate: format(startOfYear(year), 'yyyy-MM-dd'), endDate: format(endOfYear(year), 'yyyy-MM-dd') }
    }
    return {
      startDate: format(startOfWeek(startOfMonth(month), { locale: calendarLocale, weekStartsOn: 1 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(endOfMonth(month), { locale: calendarLocale, weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
  }, [calendarLocale, month, view, weekStart, year])
  const checkedInDates = useMemo<Date[]>(
    () => data?.dates.map((date) => parseISO(date)) ?? [],
    [data],
  )
  const dailyStats = useMemo(() => new Map((data?.dailyStats ?? []).map((item) => [item.date, item])), [data?.dailyStats])
  const visibleDays = useMemo(() => eachDayOfInterval({ start: parseISO(visibleRange.startDate), end: parseISO(visibleRange.endDate) }), [visibleRange])
  const summary = useMemo(() => visibleDays.reduce((total, day) => {
    const stat = dailyStats.get(format(day, 'yyyy-MM-dd'))
    if (!stat) return total
    return {
      activeDays: total.activeDays + (stat.questionCount > 0 || stat.activeSeconds > 0 ? 1 : 0),
      questionCount: total.questionCount + stat.questionCount,
      activeSeconds: total.activeSeconds + stat.activeSeconds,
    }
  }, { activeDays: 0, questionCount: 0, activeSeconds: 0 }), [dailyStats, visibleDays])
  const focusedStats = selectedDay ? dailyStats.get(format(selectedDay, 'yyyy-MM-dd')) : null

  useEffect(() => {
    if (!open) return
    fetchCheckInCalendar(visibleRange.startDate, visibleRange.endDate)
  }, [open, visibleRange, fetchCheckInCalendar])

  const changeMonth = useCallback((offset: number) => {
    const nextMonth = startOfMonth(addMonths(month, offset))
    if (!isAfter(nextMonth, startOfMonth(today))) setMonth(nextMonth)
  }, [month, today])

  const canGoToNextMonth = !isAfter(startOfMonth(addMonths(month, 1)), startOfMonth(today))
  const canGoToNextWeek = !isAfter(addWeeks(weekStart, 1), startOfWeek(today, { weekStartsOn: 1 }))
  const canGoToNextYear = !isAfter(startOfYear(addYears(year, 1)), startOfYear(today))
  const changeWeek = useCallback((offset: number) => {
    const nextWeek = addWeeks(weekStart, offset)
    if (!isAfter(nextWeek, startOfWeek(today, { weekStartsOn: 1 }))) {
      setWeekStart(nextWeek)
      setSelectedDay(nextWeek)
    }
  }, [today, weekStart])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[min(88dvh,700px)] rounded-t-[28px] border-border/70 bg-background drawer-surface">
        <DrawerHeader className="shrink-0 px-4 pb-2 pt-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-base font-semibold">{t('learning.myLearning', { defaultValue: '我的学习' })}</DrawerTitle>
            <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value as 'week' | 'month' | 'year')} variant="outline" size="sm" className="rounded-full border border-border/60 bg-muted/50 p-0.5">
              <ToggleGroupItem value="week" aria-label="周视图" className="h-7 min-w-10 px-2 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">周</ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="月视图" className="h-7 min-w-10 px-2 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">月</ToggleGroupItem>
              <ToggleGroupItem value="year" aria-label="年视图" className="h-7 min-w-10 px-2 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">年</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarCheck className="size-3.5" />
                {t('learning.activeDays', { defaultValue: '练习天数' })}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{summary.activeDays}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('learning.days')}</span></p>
            </div>
            <div className="rounded-2xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="size-3.5" />
                {t('learning.questionsCompleted', { defaultValue: '完成题数' })}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{summary.questionCount}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('learning.questionsUnit', { defaultValue: '题' })}</span></p>
            </div>
            <div className="rounded-2xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                {t('learning.activeDuration', { defaultValue: '练习分钟' })}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatDuration(summary.activeSeconds)}</p>
            </div>
          </div>

          {view === 'week' ? (
            <WeeklyActivity
              days={visibleDays}
              dailyStats={dailyStats}
              locale={calendarLocale}
              today={today}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onPrevWeek={() => changeWeek(-1)}
              onNextWeek={() => changeWeek(1)}
              canGoToNextWeek={canGoToNextWeek}
            />
          ) : view === 'month' ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-background">
            <div className="flex items-center justify-between px-3 pt-3">
              <Button type="button" variant="ghost" size="icon" className="touch-manipulation"
                onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
                onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {format(month, 'yyyy MMMM', { locale: calendarLocale })}
                {loading && <Spinner className="size-3.5 text-muted-foreground" />}
              </div>
              <Button type="button" variant="ghost" size="icon" className="touch-manipulation"
                disabled={!canGoToNextMonth}
                onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
                onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="overflow-hidden">
              <Calendar mode="single" selected={selectedDay} onSelect={setSelectedDay} month={month} hideNavigation locale={calendarLocale} disabled={{ after: today }}
                modifiers={{ checkedIn: checkedInDates }}
                modifiersClassNames={{ checkedIn: 'relative after:absolute after:bottom-1 after:left-1/2 after:size-2 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[""]' }}
                classNames={{ month_caption: 'hidden' }} className="mx-auto w-full [--cell-size:2.15rem]" />
            </div>
          </div>
          ) : (
            <YearlyActivity
              year={year}
              dailyStats={dailyStats}
              onPrevYear={() => setYear((value) => addYears(value, -1))}
              onNextYear={() => setYear((value) => addYears(value, 1))}
              canGoToNextYear={canGoToNextYear}
            />
          )}
          <div className="flex shrink-0 items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{selectedDay ? format(selectedDay, 'M月d日', { locale: calendarLocale }) : t('learning.today', { defaultValue: '今天' })}</p>
              <p className="mt-0.5 text-muted-foreground">{focusedStats?.questionCount ?? 0}{t('learning.questionsUnit', { defaultValue: '题' })} · {formatDuration(focusedStats?.activeSeconds ?? 0)}</p>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Flame className="size-3.5" />
              {t('learning.currentStreak')} {data?.currentStreak ?? 0}{t('learning.days')}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function formatDuration(seconds: number) {
  return `${Math.ceil(Math.max(0, seconds) / 60)} 分钟`
}

function WeeklyActivity({ days, dailyStats, locale, today, selectedDay, onSelectDay, onPrevWeek, onNextWeek, canGoToNextWeek }: {
  days: Date[]
  dailyStats: Map<string, { date: string; questionCount: number; activeSeconds: number }>
  locale: typeof zhCN
  today: Date
  selectedDay?: Date
  onSelectDay: (day: Date) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  canGoToNextWeek: boolean
}) {
  const { t } = useTranslation()
  const items = days.map((day) => {
    const stat = dailyStats.get(format(day, 'yyyy-MM-dd'))
    return { day, minutes: Math.ceil((stat?.activeSeconds ?? 0) / 60), questionCount: stat?.questionCount ?? 0 }
  })
  const hasData = items.some((item) => item.minutes > 0 || item.questionCount > 0)
  const maxMinutes = Math.max(1, ...items.map((item) => item.minutes))
  const maxQuestions = Math.max(1, ...items.map((item) => item.questionCount))
  const chartWidth = 320
  const chartHeight = 112
  const top = 12
  const bottom = 17
  const innerHeight = chartHeight - top - bottom
  const step = chartWidth / items.length
  const points = items.map((item, index) => {
    const x = step * index + step / 2
    const y = top + innerHeight - (item.questionCount / maxQuestions) * innerHeight
    return `${x},${y}`
  }).join(' ')
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-background">
      <div className="flex items-center justify-between gap-3 px-3 pt-3">
        <div>
          <p className="text-sm font-semibold">{t('learning.weeklyRhythm', { defaultValue: '本周练习节奏' })}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{t('learning.chartLegend', { defaultValue: '柱状为分钟，折线为完成题数' })}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full" onClick={onPrevWeek} aria-label="Previous week">
            <ChevronLeft />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full" onClick={onNextWeek} disabled={!canGoToNextWeek} aria-label="Next week">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 px-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-primary" />分钟</span>
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-accent" />题数</span>
      </div>
      <div className="relative mt-2 min-h-0 flex-1 px-3">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="absolute inset-x-3 top-0 h-[calc(100%-4.5rem)] w-[calc(100%-1.5rem)] overflow-visible" role="img" aria-label="每周练习分钟与完成题数">
          {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={chartWidth} y1={top + innerHeight * ratio} y2={top + innerHeight * ratio} stroke="hsl(var(--border))" strokeDasharray="2 4" />)}
          {items.map((item, index) => {
            const height = item.minutes > 0 ? Math.max(5, (item.minutes / maxMinutes) * innerHeight) : 18
            const x = step * index + step * 0.23
            return <rect key={item.day.toISOString()} x={x} y={top + innerHeight - height} width={step * 0.54} height={height} rx="4" fill={item.minutes > 0 ? 'hsl(var(--primary) / 0.72)' : 'hsl(var(--muted))'} />
          })}
          {hasData && <polyline points={points} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {hasData && items.map((item, index) => {
            const x = step * index + step / 2
            const y = top + innerHeight - (item.questionCount / maxQuestions) * innerHeight
            return <circle key={`point:${item.day.toISOString()}`} cx={x} cy={y} r="3" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeWidth="2" />
          })}
        </svg>
        {!hasData && <p className="pointer-events-none absolute inset-x-0 top-11 text-center text-[10px] text-muted-foreground">完成一次练习后，这里会显示学习趋势</p>}
        <div className="absolute inset-x-3 bottom-2 grid grid-cols-7 gap-1 border-t border-border/60 pt-1.5">
          {items.map((item) => (
            <button key={item.day.toISOString()} type="button" onClick={() => onSelectDay(item.day)} className={cn('mx-auto flex size-[2.15rem] min-w-0 flex-col items-center justify-center rounded-xl text-[10px] transition-colors', isSameDay(item.day, selectedDay ?? new Date(0)) ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60')}>
              <span>{format(item.day, 'EEEEE', { locale })}</span>
              <span className={cn('tabular-nums', isSameDay(item.day, today) && 'font-semibold')}>{format(item.day, 'd')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function YearlyActivity({ year, dailyStats, onPrevYear, onNextYear, canGoToNextYear }: {
  year: Date
  dailyStats: Map<string, { date: string; questionCount: number; activeSeconds: number }>
  onPrevYear: () => void
  onNextYear: () => void
  canGoToNextYear: boolean
}) {
  const values = Array.from({ length: 12 }, (_, index) => {
    const prefix = `${format(year, 'yyyy')}-${String(index + 1).padStart(2, '0')}`
    const days = [...dailyStats.values()].filter((item) => item.date.startsWith(prefix))
    return {
      label: index + 1,
      minutes: Math.ceil(days.reduce((sum, item) => sum + item.activeSeconds, 0) / 60),
      questions: days.reduce((sum, item) => sum + item.questionCount, 0),
    }
  })
  const hasData = values.some((item) => item.minutes > 0 || item.questions > 0)
  const maxMinutes = Math.max(1, ...values.map((item) => item.minutes))
  const maxQuestions = Math.max(1, ...values.map((item) => item.questions))
  const width = 360
  const height = 116
  const top = 12
  const plotHeight = 76
  const step = width / values.length
  const points = values.map((item, index) => `${step * index + step / 2},${top + plotHeight - item.questions / maxQuestions * plotHeight}`).join(' ')

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-background">
      <div className="flex items-center justify-between gap-3 px-3 pt-3">
        <div>
          <p className="text-sm font-semibold">全年学习趋势</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">柱状为分钟，折线为完成题数</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full" onClick={onPrevYear} aria-label="Previous year">
            <ChevronLeft />
          </Button>
          <span className="min-w-10 text-center text-xs font-medium tabular-nums">{format(year, 'yyyy')}</span>
          <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full" onClick={onNextYear} disabled={!canGoToNextYear} aria-label="Next year">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="relative mt-2 px-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[116px] w-full" role="img" aria-label="全年练习分钟与完成题数">
          {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={top + plotHeight * ratio} y2={top + plotHeight * ratio} stroke="hsl(var(--border))" strokeDasharray="2 4" />)}
          {values.map((item, index) => {
            const barHeight = item.minutes > 0 ? Math.max(4, item.minutes / maxMinutes * plotHeight) : 12
            return <rect key={item.label} x={step * index + step * .28} y={top + plotHeight - barHeight} width={step * .44} height={barHeight} rx="3" fill={item.minutes > 0 ? 'hsl(var(--primary) / .72)' : 'hsl(var(--muted))'} />
          })}
          {hasData && <polyline points={points} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {values.map((item, index) => <text key={item.label} x={step * index + step / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{item.label}</text>)}
        </svg>
        {!hasData && <p className="pointer-events-none absolute inset-x-0 top-11 text-center text-[10px] text-muted-foreground">完成练习后，这里会显示全年趋势</p>}
      </div>
    </div>
  )
}
