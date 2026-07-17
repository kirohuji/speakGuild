import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth, endOfWeek, endOfYear, format, isAfter, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { enUS, ja, zhCN } from 'date-fns/locale'
import { CalendarDays, Flame, CalendarCheck, ChevronLeft, ChevronRight, Clock3, ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/stores/learning.store'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from 'recharts'

function useLearningChartConfig() {
  const { t } = useTranslation()
  return {
    minutes: { label: t('learning.activeDuration', { defaultValue: '练习分钟' }), color: 'hsl(var(--primary))' },
    questions: { label: t('learning.questionsCompleted', { defaultValue: '完成题数' }), color: 'hsl(var(--accent))' },
  } satisfies ChartConfig
}

const weeklyChartMock = [
  { minutes: 12, questions: 8 },
  { minutes: 24, questions: 16 },
  { minutes: 8, questions: 5 },
  { minutes: 31, questions: 21 },
  { minutes: 18, questions: 12 },
  { minutes: 27, questions: 18 },
  { minutes: 15, questions: 10 },
]

const yearlyChartMock = [18, 24, 15, 32, 21, 38, 26, 29, 20, 34, 28, 41].map((minutes, index) => ({
  minutes,
  questions: [12, 16, 9, 23, 14, 27, 18, 21, 13, 25, 19, 30][index],
}))

const monthlyChartMock = [
  [8, 5], [16, 11], [0, 0], [24, 17], [12, 8], [31, 22], [18, 13],
  [0, 0], [21, 15], [28, 20], [14, 9], [36, 25], [19, 14], [9, 6],
  [0, 0], [26, 18], [33, 23], [17, 12], [22, 16], [0, 0], [29, 21],
  [13, 10], [38, 27], [20, 15], [11, 7], [0, 0], [25, 19], [32, 24],
  [16, 11], [27, 20], [35, 26],
].map(([minutes, questions]) => ({ minutes, questions }))

type MonthlyActivityData = {
  dateKey: string
  date: string
  label: string
  minutes: number
  questions: number
}

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
  const [view, setView] = useState<'week' | 'month' | 'year'>('month')
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
  const monthSwipeStartRef = useRef<{ x: number; y: number } | null>(null)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[min(88dvh,700px)] rounded-t-[28px] border-border/70 bg-background drawer-surface">
        <DrawerHeader className="shrink-0 px-4 pb-2 pt-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-base font-semibold">{t('learning.myLearning')}</DrawerTitle>
            <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value as 'week' | 'month' | 'year')} variant="outline" size="sm" className="rounded-full border border-border/60 bg-muted/50 p-0.5">
              {/* <ToggleGroupItem value="week" aria-label="周视图" className="h-7 min-w-10 px-2 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">周</ToggleGroupItem> */}
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
              checkedInDates={checkedInDates}
              locale={calendarLocale}
              today={today}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onPrevWeek={() => changeWeek(-1)}
              onNextWeek={() => changeWeek(1)}
              canGoToNextWeek={canGoToNextWeek}
            />
          ) : view === 'month' ? (
          <div
            className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden rounded-2xl bg-background"
            onPointerDownCapture={(event) => {
              monthSwipeStartRef.current = { x: event.clientX, y: event.clientY }
            }}
            onPointerUpCapture={(event) => {
              const start = monthSwipeStartRef.current
              monthSwipeStartRef.current = null
              if (!start) return
              const deltaX = event.clientX - start.x
              const deltaY = event.clientY - start.y
              if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return
              if (deltaX < 0 && canGoToNextMonth) changeMonth(1)
              if (deltaX > 0) changeMonth(-1)
            }}
            onPointerCancel={() => { monthSwipeStartRef.current = null }}
          >
            <div className="flex items-center justify-between px-3 pt-3">
              <Button type="button" variant="ghost" size="icon" className="touch-manipulation transition-none hover:!bg-transparent active:!scale-100"
                onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
                onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {format(month, 'yyyy MMMM', { locale: calendarLocale })}
                {loading && <Spinner className="size-3.5 text-muted-foreground" />}
              </div>
              <Button type="button" variant="ghost" size="icon" className="touch-manipulation transition-none hover:!bg-transparent active:!scale-100"
                disabled={!canGoToNextMonth}
                onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
                onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <MonthlyActivityChart days={visibleDays} dailyStats={dailyStats} locale={calendarLocale} selectedDay={selectedDay} />
            <div className="min-h-0 flex-1 overflow-y-auto" onPointerDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
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
              today={today}
              onSelectMonth={(target) => {
                setMonth(target)
                setSelectedDay(target)
                setView('month')
              }}
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

function WeeklyActivity({ days, dailyStats, checkedInDates, locale, today, selectedDay, onSelectDay, onPrevWeek, onNextWeek, canGoToNextWeek }: {
  days: Date[]
  dailyStats: Map<string, { date: string; questionCount: number; activeSeconds: number }>
  checkedInDates: Date[]
  locale: typeof zhCN
  today: Date
  selectedDay?: Date
  onSelectDay: (day: Date) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  canGoToNextWeek: boolean
}) {
  const { t } = useTranslation()
  const chartConfig = useLearningChartConfig()
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const items = days.map((day) => {
    const stat = dailyStats.get(format(day, 'yyyy-MM-dd'))
    return { day, minutes: Math.ceil((stat?.activeSeconds ?? 0) / 60), questionCount: stat?.questionCount ?? 0 }
  })
  const hasData = items.some((item) => item.minutes > 0 || item.questionCount > 0)
  const usingMockData = !hasData && import.meta.env.DEV
  const chartData = items.map((item, index) => ({
    day: format(item.day, 'EEEEE', { locale }),
    minutes: usingMockData ? weeklyChartMock[index].minutes : item.minutes,
    questions: usingMockData ? weeklyChartMock[index].questions : item.questionCount,
  }))
  return (
    <div
      className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden rounded-2xl bg-background"
      onPointerDown={(event) => {
        swipeStartRef.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerUp={(event) => {
        const start = swipeStartRef.current
        swipeStartRef.current = null
        if (!start) return
        const deltaX = event.clientX - start.x
        const deltaY = event.clientY - start.y
        if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return
        if (deltaX < 0 && canGoToNextWeek) onNextWeek()
        if (deltaX > 0) onPrevWeek()
      }}
      onPointerCancel={() => { swipeStartRef.current = null }}
    >
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
        <ChartContainer config={chartConfig} className="absolute inset-x-3 top-0 h-[calc(100%-4.5rem)] w-[calc(100%-1.5rem)] pb-2">
          <ComposedChart accessibilityLayer data={chartData} margin={{ top: 18, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" hide />
            <YAxis hide yAxisId="metric" />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Bar dataKey="minutes" yAxisId="metric" barSize={14} fill="var(--color-minutes)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="minutes" position="top" offset={5} className="fill-muted-foreground" fontSize={10} />
            </Bar>
            <Line type="linear" dataKey="questions" yAxisId="metric" stroke="var(--color-questions)" strokeWidth={3} dot={{ r: 3, fill: 'var(--color-questions)', strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        <div className="absolute inset-x-3 bottom-2 [--cell-size:2.15rem]">
          <div className="grid grid-cols-7 text-center text-xs font-normal text-muted-foreground">
            {items.map((item) => <span key={`weekday:${item.day.toISOString()}`}>{format(item.day, 'EEEEE', { locale })}</span>)}
          </div>
          <div className="mt-1.5 grid grid-cols-7">
            {items.map((item) => (
              <button key={item.day.toISOString()} type="button" onClick={() => onSelectDay(item.day)} className={cn('flex aspect-square size-full min-h-[--cell-size] items-center justify-center rounded-xl p-0 text-xs font-normal leading-normal transition-colors', checkedInDates.some((date) => isSameDay(date, item.day)) && 'relative after:absolute after:bottom-1 after:left-1/2 after:size-2 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[""]', isSameDay(item.day, selectedDay ?? new Date(0)) ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted')}>
                {format(item.day, 'd')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthlyActivityChart({ days, dailyStats, locale, selectedDay }: {
  days: Date[]
  dailyStats: Map<string, { date: string; questionCount: number; activeSeconds: number }>
  locale: typeof zhCN
  selectedDay?: Date
}) {
  const { t } = useTranslation()
  const chartConfig = useLearningChartConfig()
  const realChartData = days.map((day) => {
    const stat = dailyStats.get(format(day, 'yyyy-MM-dd'))
    return {
      dateKey: format(day, 'yyyy-MM-dd'),
      date: format(day, 'M/d', { locale }),
      label: format(day, 'd', { locale }),
      minutes: Math.ceil((stat?.activeSeconds ?? 0) / 60),
      questions: stat?.questionCount ?? 0,
    }
  })
  const usingMockData = !realChartData.some((item) => item.minutes > 0 || item.questions > 0)
  const chartData = realChartData.map((item) => {
    const mock = monthlyChartMock[(item.label ? Number(item.label) : 1) - 1] ?? monthlyChartMock[0]
    return usingMockData ? { ...item, ...mock } : item
  })
  const selectedDateKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : undefined
  const selectedChartIndex = chartData.findIndex((item) => item.dateKey === selectedDateKey)
  const selectedChartItem = selectedChartIndex >= 0 ? chartData[selectedChartIndex] : null
  const [isChartInteracting, setIsChartInteracting] = useState(false)

  useEffect(() => {
    setIsChartInteracting(false)
  }, [selectedDateKey])

  return (
    <section className="shrink-0 px-3 pt-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">{t('learning.monthlyRhythm', { defaultValue: '本月练习趋势' })}</p>
        <p className="text-[10px] text-muted-foreground">{t('learning.chartLegend', { defaultValue: '柱状为分钟，折线为完成题数' })}</p>
      </div>
      <div
        className="relative"
        onPointerDown={() => setIsChartInteracting(true)}
        onMouseEnter={() => setIsChartInteracting(true)}
        onMouseLeave={() => setIsChartInteracting(false)}
      >
        <ChartContainer config={chartConfig} className="h-[116px] w-full">
          <ComposedChart accessibilityLayer data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="dateKey" axisLine={false} tickLine={false} interval={4} tick={{ fontSize: 9 }} tickFormatter={(value) => String(value).slice(-2).replace(/^0/, '')} />
            <YAxis hide yAxisId="metric" />
            <ChartTooltip
              cursor={false}
              content={(props) => {
                const item = props.payload?.[0]?.payload as MonthlyActivityData | undefined
                return props.active && item ? <ActivityInfoCard title={item.date} minutes={item.minutes} questions={item.questions} /> : null
              }}
            />
            {selectedDateKey && <ReferenceLine x={selectedDateKey} yAxisId="metric" stroke="hsl(var(--accent))" strokeOpacity={0.75} strokeWidth={1.5} />}
            <Bar dataKey="minutes" yAxisId="metric" barSize={5} fill="var(--color-minutes)" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {chartData.map((item) => {
                const isSelected = item.dateKey === selectedDateKey
                return <Cell key={item.dateKey} fill={isSelected ? 'hsl(var(--accent))' : 'var(--color-minutes)'} stroke={isSelected ? 'hsl(var(--accent))' : 'transparent'} strokeWidth={isSelected ? 2 : 0} />
              })}
            </Bar>
            <Line type="linear" dataKey="questions" yAxisId="metric" stroke="var(--color-questions)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        {selectedChartItem && !isChartInteracting && (
          <div className="pointer-events-none absolute top-1 z-10 -translate-x-1/2" style={{ left: `${((selectedChartIndex + 0.5) / chartData.length) * 100}%` }}>
            <ActivityInfoCard title={selectedChartItem.date} minutes={selectedChartItem.minutes} questions={selectedChartItem.questions} />
          </div>
        )}
      </div>
    </section>
  )
}

function ActivityInfoCard({ title, minutes, questions }: { title: string; minutes: number; questions: number }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-md border border-accent bg-background px-2 py-1 text-[10px] shadow-md">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-0.5 whitespace-nowrap text-muted-foreground">{formatDuration(minutes * 60)} · {questions}{t('learning.questionsUnit', { defaultValue: '题' })}</p>
    </div>
  )
}

function YearlyActivity({ year, dailyStats, today, onSelectMonth, onPrevYear, onNextYear, canGoToNextYear }: {
  year: Date
  dailyStats: Map<string, { date: string; questionCount: number; activeSeconds: number }>
  today: Date
  onSelectMonth: (month: Date) => void
  onPrevYear: () => void
  onNextYear: () => void
  canGoToNextYear: boolean
}) {
  const { t } = useTranslation()
  const chartConfig = useLearningChartConfig()
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
  const usingMockData = !hasData && import.meta.env.DEV
  const chartData = values.map((item, index) => ({
    ...item,
    minutes: usingMockData ? yearlyChartMock[index].minutes : item.minutes,
    questions: usingMockData ? yearlyChartMock[index].questions : item.questions,
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-background">
      <div className="flex items-center justify-between gap-3 px-3 pt-3">
        <div>
          <p className="text-sm font-semibold">{t('profile.yearlyTrend', { defaultValue: '全年学习趋势' })}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{t('profile.yearlyTrendHint', { defaultValue: '柱状为分钟，折线为完成题数' })}</p>
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
      <div className="relative mt-2 min-h-0 flex-1 px-3">
        <ChartContainer config={chartConfig} className="absolute inset-x-3 top-0 h-[calc(100%-3.75rem)] w-[calc(100%-1.5rem)]">
          <ComposedChart accessibilityLayer data={chartData} margin={{ top: 18, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis hide yAxisId="metric" />
            <ChartTooltip
              cursor={false}
              content={(props) => {
                const item = props.payload?.[0]?.payload as { label: number; minutes: number; questions: number } | undefined
                return props.active && item
                  ? <ActivityInfoCard title={`${format(year, 'yyyy')}-${String(item.label).padStart(2, '0')}`} minutes={item.minutes} questions={item.questions} />
                  : null
              }}
            />
            <Bar dataKey="minutes" yAxisId="metric" barSize={10} fill="var(--color-minutes)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="minutes" position="top" offset={5} className="fill-muted-foreground" fontSize={9} />
            </Bar>
            <Line type="linear" dataKey="questions" yAxisId="metric" stroke="var(--color-questions)" strokeWidth={3} dot={{ r: 2.5, fill: 'var(--color-questions)', strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        <div className="absolute inset-x-3 bottom-2 grid grid-cols-12 [--cell-size:2.15rem]">
          {values.map((item, index) => {
            const monthDate = startOfMonth(new Date(year.getFullYear(), index, 1))
            const isFuture = isAfter(monthDate, startOfMonth(today))
            return (
              <button key={item.label} type="button" disabled={isFuture} onClick={() => onSelectMonth(monthDate)} className="flex h-[--cell-size] w-full items-center justify-center rounded-xl p-0 text-[10px] font-normal leading-normal text-foreground transition-colors hover:bg-muted disabled:text-muted-foreground disabled:opacity-35">
                {item.label}
              </button>
            )
          })}
        </div>
        {/* {!hasData && <p className="pointer-events-none absolute inset-x-0 top-11 text-center text-[10px] text-muted-foreground">完成练习后，这里会显示全年趋势</p>} */}
      </div>
    </div>
  )
}
