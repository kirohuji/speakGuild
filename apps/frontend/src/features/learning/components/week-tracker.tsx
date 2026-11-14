import { DailyActivityChart } from './daily-activity-chart'
import { toast } from 'sonner'
import { ActivityInfoCard, CompactActivityChart, ExpandedActivityChart, getChartCardPosition, getChartCardTopByRatio, useLearningChartConfig } from './activity-chart'
import { pointsApi, type CheckInCalendar } from '@/features/points/api'
import { makeupAvailability } from '@/features/points/makeup-policy'
import { useUserStore } from '@/stores/user.store'
import { useHomeStore } from '@/stores/home.store'
import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import { localDateKey } from '@/lib/date/calendar-date'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLearningStatistics } from '@/stores/learning-statistics.store'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth, endOfWeek, endOfYear, format, isAfter, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
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
import { ChartContainer } from '@/components/ui/chart'
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from 'recharts'

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

export function CheckInCalendarDrawer({
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
  const [view, setView] = useState<'day' | 'month' | 'year'>('day')
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date())
  const [today, setToday] = useState(() => startOfDay(new Date()))
  const todayKey = localDateKey(today)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [makeupBusy, setMakeupBusy] = useState(false)
  const [quote, setQuote] = useState<{ date: string; cost: number; balance: number } | null>(null)
  const requestEpoch = useRef(0)
  const submittingRef = useRef(false)
  const accountId = useUserStore(state => state.currentUserId)
  useEffect(() => { requestEpoch.current++; setQuote(null); setMakeupBusy(false) }, [accountId])
  useEffect(() => {
    if (!open) return
    const update = () => { setOnline(navigator.onLine); setToday(startOfDay(new Date())) }
    update()
    const timer = setInterval(update, 60_000)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); window.removeEventListener('online', update); window.removeEventListener('offline', update); document.removeEventListener('visibilitychange', update) }
  }, [open])
  useEffect(()=>{
    if(open){const current=startOfDay(new Date());setToday(current);setSelectedDay(current);setMonth(startOfMonth(current));setView('day')}
  },[open])
  const calendarLocale = i18n.language.startsWith('ja')
    ? ja
    : i18n.language.startsWith('en')
      ? enUS
      : zhCN
  const visibleRange = useMemo(() => {
    if (view === 'day') { const date=localDateKey(selectedDay??today); return {startDate:date,endDate:date} }
    if (view === 'year') {
      return { startDate: format(startOfYear(year), 'yyyy-MM-dd'), endDate: format(endOfYear(year), 'yyyy-MM-dd') }
    }
    return {
      startDate: format(startOfWeek(startOfMonth(month), { locale: calendarLocale, weekStartsOn: 1 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(endOfMonth(month), { locale: calendarLocale, weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
  }, [calendarLocale, month, view, weekStart, year, selectedDay, todayKey])
  const { data: statistics } = useLearningStatistics(visibleRange.startDate, visibleRange.endDate, open)
  const checkedInDates = useMemo<Date[]>(
    () => data?.dates.map((date) => parseISO(date)) ?? [],
    [data],
  )
  const dailyStats = useMemo(() => new Map((statistics?.dailyStats ?? []).map((item) => [item.date, item])), [statistics])
  const visibleDays = useMemo(() => eachDayOfInterval({ start: parseISO(visibleRange.startDate), end: parseISO(visibleRange.endDate) }), [visibleRange])
  const periodDays = useMemo(() => view === 'month' ? eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }) : visibleDays, [view, month, visibleDays])
  const summary = useMemo(() => periodDays.reduce((total, day) => {
    const stat = dailyStats.get(format(day, 'yyyy-MM-dd'))
    if (!stat) return total
    return {
      activeDays: total.activeDays + (stat.active ? 1 : 0),
      questionCount: total.questionCount + stat.questionCount,
      activeSeconds: total.activeSeconds + stat.activeSeconds,
    }
  }, { activeDays: 0, questionCount: 0, activeSeconds: 0 }), [dailyStats, periodDays])
  const focusedStats = selectedDay ? dailyStats.get(format(selectedDay, 'yyyy-MM-dd')) : null
  const dayUnknown=view==='day'&&!focusedStats&&!statistics?.historyComplete

  useEffect(() => {
    if (!open) return
    fetchCheckInCalendar(visibleRange.startDate, visibleRange.endDate)
  }, [open, visibleRange, fetchCheckInCalendar, todayKey, online])

  const changeMonth = useCallback((offset: number) => {
    const nextMonth = startOfMonth(addMonths(month, offset))
    if (!isAfter(nextMonth, startOfMonth(today))) { setMonth(nextMonth); setSelectedDay(isSameDay(nextMonth, startOfMonth(today)) ? today : nextMonth) }
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
  const selectedKey = selectedDay ? localDateKey(selectedDay) : todayKey
  const calendarMatches = view==='day' ? Boolean(data?.startDate && data.endDate && data.startDate<=selectedKey && data.endDate>=selectedKey) : data?.startDate === visibleRange.startDate && data?.endDate === visibleRange.endDate
  const activeCalendar = calendarMatches ? data : null
  const makeupState = makeupAvailability(selectedKey, activeCalendar, online, todayKey)
  const canOfferMakeup = view === 'day' && selectedKey < todayKey && !activeCalendar?.dates.includes(selectedKey)
  const makeupReason = makeupState === 'insufficient'
    ? t('learning.dayDetails.insufficient', { cost: activeCalendar?.makeup?.cost, balance: activeCalendar?.makeup?.pointsBalance })
    : t(`learning.dayDetails.${makeupState}`)
  const invalidateCalendar = useLearningStore(state => state.invalidateCheckInCalendar)
  const selectDay = useCallback((day?: Date) => {
    if (!day || isAfter(day, today)) return
    setSelectedDay(day)
    if (view === 'month' && !isSameDay(startOfMonth(day), month)) setMonth(startOfMonth(day))
  }, [today, view, month])
  const lastDayTap=useRef<{key:string;at:number}|null>(null)
  const openDay=(day:Date)=>{const current=startOfDay(new Date());if(isAfter(day,current))return;setToday(current);setSelectedDay(day);setMonth(startOfMonth(day));setView('day')}
  const calendarDayClick=(day:Date,_modifiers:unknown,event:React.MouseEvent)=>{
    if(isAfter(day,today)||event.detail===0)return
    const key=localDateKey(day),at=performance.now(),previous=lastDayTap.current
    if(event.detail>=2||(previous?.key===key&&at-previous.at<350)){lastDayTap.current=null;openDay(day)}
    else lastDayTap.current={key,at}
  }
  const changeView=(value:string)=>{
    if(value==='day')openDay(startOfDay(new Date()))
    else if(value==='month'){setMonth(startOfMonth(selectedDay??today));setView('month')}
    else if(value==='year'){setYear(startOfYear(month));setView('year')}
  }
  const showMakeupError = (error: unknown) => {
    const code = (error as any)?.apiCode ?? (error as any)?.response?.data?.code
    const key = ({ MAKEUP_ALREADY_CHECKED_IN: 'checked', MAKEUP_OUT_OF_RANGE: 'out_of_range', MAKEUP_INSUFFICIENT_POINTS: 'insufficientError' } as Record<string,string>)[code] ?? 'failed'
    toast.error(t(`learning.dayDetails.${key}`))
  }
  const prepareMakeup = async () => {
    const owner = getCurrentSessionSnapshot()?.user?.id
    if (!owner || submittingRef.current || !navigator.onLine) return
    const epoch = ++requestEpoch.current
    setMakeupBusy(true)
    try {
      const fresh = await fetchCheckInCalendar(visibleRange.startDate, visibleRange.endDate)
      if (epoch !== requestEpoch.current || getCurrentSessionSnapshot()?.user?.id !== owner) return
      if (!fresh?.makeup) { toast.error(t('learning.dayDetails.failed')); return }
      const availability = makeupAvailability(selectedKey, fresh, navigator.onLine, localDateKey())
      if (availability !== 'ready') { toast.error(t(`learning.dayDetails.${availability === 'insufficient' ? 'insufficientError' : availability}`)); return }
      setQuote({ date: selectedKey, cost: fresh.makeup.cost, balance: fresh.makeup.pointsBalance })
    } catch (error) {
      if (epoch === requestEpoch.current && getCurrentSessionSnapshot()?.user?.id === owner) showMakeupError(error)
    } finally { if (epoch === requestEpoch.current) setMakeupBusy(false) }
  }
  const confirmMakeup = async () => {
    const owner = getCurrentSessionSnapshot()?.user?.id
    if (!quote || !owner || submittingRef.current) return
    if (!navigator.onLine) { toast.error(t('learning.dayDetails.offline')); return }
    submittingRef.current = true
    setMakeupBusy(true)
    try {
      const result = await pointsApi.makeupCheckIn(quote.date)
      if (getCurrentSessionSnapshot()?.user?.id !== owner) return
      if (useUserStore.getState().currentUserId === owner) useUserStore.getState().setPointsBalance(result.points)
      useHomeStore.setState({ checkInStatus: result.status })
      useLearningStore.setState(state => {
        const current = state.checkInData
        if (!current) return {}
        const dates = [...new Set([...current.dates, result.date])].sort()
        return { checkInStreak: result.status.currentStreak, checkInData: { ...current, totalCheckIns: current.totalCheckIns + (result.alreadyApplied ? 0 : 1), dates, makeupDates: [...new Set([...(current.makeupDates ?? []), result.date])],
          currentStreak: result.status.currentStreak, today: result.status.today,
          makeup: current.makeup ? { ...current.makeup, pointsBalance: result.points } : undefined } }
      })
      setQuote(null)
      toast.success(t(result.alreadyApplied ? 'learning.dayDetails.alreadyApplied' : 'learning.dayDetails.success'))
      await invalidateCalendar(result.status)
      if (getCurrentSessionSnapshot()?.user?.id === owner) await fetchCheckInCalendar(visibleRange.startDate, visibleRange.endDate)
    } catch (error) {
      if (getCurrentSessionSnapshot()?.user?.id === owner) { showMakeupError(error); void fetchCheckInCalendar(visibleRange.startDate, visibleRange.endDate) }
    } finally { submittingRef.current = false; setMakeupBusy(false) }
  }

  const monthSwipeStartRef = useRef<{ x: number; y: number } | null>(null)

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[min(88dvh,700px)] rounded-t-[28px] bg-background drawer-surface">
        <DrawerHeader className="shrink-0 px-4 pb-2 pt-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-base font-semibold">{t('learning.myLearning')}</DrawerTitle>
            <ToggleGroup type="single" value={view} onValueChange={changeView} size="sm" className="rounded-full bg-muted/50 p-0.5">
              <ToggleGroupItem value="day" aria-label={t('learning.dayChart.dayView')} className="h-7 min-w-10 border-0 px-2 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">{t('learning.dayChart.dayShort')}</ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label={t('learning.monthView')} className="h-7 min-w-10 border-0 px-2 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">{t('learning.monthShort')}</ToggleGroupItem>
              <ToggleGroupItem value="year" aria-label={t('learning.yearView')} className="h-7 min-w-10 border-0 px-2 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">{t('learning.yearShort')}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <p className="text-xs text-muted-foreground">
            {view === 'day' ? format(selectedDay ?? today, 'PPP', { locale: calendarLocale }) : view === 'year' ? format(year, 'yyyy') : format(month, 'yyyy MMMM', { locale: calendarLocale })}
            {' · '}{t(view === 'day' ? 'learning.dayChart.daySummary' : view === 'year' ? 'learning.dayDetails.yearSummary' : 'learning.dayDetails.monthSummary')}
          </p>

          <div className="grid shrink-0 grid-cols-3 gap-2">
            <div className="rounded-2xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarCheck className="size-3.5" />
                {view==='day'?t('learning.dayChart.checkInStatus'):t('learning.activeDays', { defaultValue: '练习天数' })}
              </div>
              {canOfferMakeup ? <Button type="button" variant="outline" size="sm" className="mt-1 h-7 px-2 text-xs" disabled={makeupState !== 'ready' || makeupBusy} title={makeupState === 'ready' ? undefined : makeupReason} aria-description={makeupState === 'ready' ? undefined : makeupReason} onClick={() => { void prepareMakeup() }}>
                {makeupBusy && <Spinner data-icon="inline-start" />}
                {t('learning.dayDetails.makeup')}
              </Button> : <p className={cn('mt-1 tabular-nums', view === 'day' ? 'text-sm font-medium leading-7' : 'text-lg font-bold')}>{view==='day'?(activeCalendar?t(activeCalendar.dates.includes(selectedKey)?(activeCalendar.makeupDates?.includes(selectedKey)?'learning.dayDetails.madeUp':'learning.dayDetails.checkedIn'):'learning.dayDetails.notCheckedIn'):'—'):<>{summary.activeDays}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('learning.days')}</span></>}</p>}
            </div>
            <div className="rounded-2xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="size-3.5" />
                {t('learning.questionsCompleted', { defaultValue: '完成题数' })}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{dayUnknown?'—':summary.questionCount}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('learning.questionsUnit', { defaultValue: '题' })}</span></p>
            </div>
            <div className="rounded-2xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                {t('learning.activeDuration', { defaultValue: '练习分钟' })}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{dayUnknown?'—':formatDuration(summary.activeSeconds, t)}</p>
            </div>
          </div>

          {view === 'day' ? (
            <DailyActivityChart key={selectedKey} pending={dayUnknown} hours={statistics?.hourlyStats ?? []}
              complete={Boolean(statistics?.hourlyComplete)} hasActivity={summary.questionCount > 0 || summary.activeSeconds > 0} today={selectedKey === todayKey}
              period={format(selectedDay ?? today, 'M/d')} busy={loading}
              onPrevious={() => openDay(addDays(selectedDay ?? today, -1))}
              onNext={() => openDay(addDays(selectedDay ?? today, 1))} canGoNext={!isSameDay(selectedDay ?? today, today)} />
          ) : view === 'month' ? (
          <div
            className="flex flex-none touch-pan-y flex-col rounded-2xl bg-background"
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
            <LearningPeriodHeader
              label={format(month, 'yyyy MMMM', { locale: calendarLocale })}
              loading={loading}
              onPrevious={() => changeMonth(-1)}
              onNext={() => changeMonth(1)}
              canGoNext={canGoToNextMonth}
              previousLabel="Previous month"
              nextLabel="Next month"
            />
            <MonthlyActivityChart days={periodDays} dailyStats={dailyStats} locale={calendarLocale} selectedDay={selectedDay} onSelectDay={selectDay} />
            <div className="flex-none" onPointerDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
              <Calendar mode="single" required selected={selectedDay} onSelect={selectDay} onDayClick={calendarDayClick} onDayKeyDown={(day,_modifiers,event)=>{if(event.key==='Enter'&&event.shiftKey)openDay(day)}} month={month} hideNavigation locale={calendarLocale} disabled={{ after: today }}
                modifiers={{ checkedIn: checkedInDates.filter(day => !(data?.makeupDates ?? []).includes(localDateKey(day))), madeUp: (data?.makeupDates ?? []).map(date => parseISO(date)) }}
                modifiersClassNames={{
                  checkedIn: 'relative after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[""] [&.rdp-selected]:after:bg-primary-foreground',
                  madeUp: 'relative after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:border after:border-primary after:content-[""] [&.rdp-selected]:after:border-primary-foreground',
                }}
                classNames={{ month_caption: 'hidden' }} className="mx-auto w-full [--cell-size:2.15rem]" />
            </div>
          </div>
          ) : (
            <YearlyActivity
              year={year}
              dailyStats={dailyStats}
              today={today}
              onSelectMonth={(target) => {
                if (isAfter(startOfMonth(target), startOfMonth(today))) return
                setMonth(target)
                setSelectedDay(isSameDay(startOfMonth(target), startOfMonth(today)) ? today : target)
                setView('month')
              }}
              onPrevYear={() => setYear((value) => addYears(value, -1))}
              onNextYear={() => setYear((value) => addYears(value, 1))}
              canGoToNextYear={canGoToNextYear}
            />
          )}
          {view==='month'&&<div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary"/>{t('learning.dayDetails.checkedIn')}</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full border border-primary"/>{t('learning.dayDetails.madeUp')}</span>
            <span>{t('learning.dayChart.doubleTap')}</span>
          </div>}

        </div>
      </DrawerContent>
    </Drawer>
    <Dialog open={Boolean(quote)} onOpenChange={value => { if (!value && !submittingRef.current) setQuote(null) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('learning.dayDetails.confirmTitle', { date: quote ? format(parseISO(quote.date),'PPP',{locale:calendarLocale}) : '' })}</DialogTitle>
          <DialogDescription>{t('learning.dayDetails.confirmDescription', { cost: quote?.cost })}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-3 text-sm tabular-nums">
          <span>{t('learning.dayDetails.balance', { balance: quote?.balance })}</span>
          <span>{t('learning.dayDetails.afterBalance', { balance: (quote?.balance ?? 0)-(quote?.cost ?? 0) })}</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={makeupBusy} onClick={() => setQuote(null)}>{t('common.cancel')}</Button>
          <Button type="button" disabled={makeupBusy || !online} onClick={() => { void confirmMakeup() }}>{makeupBusy && <Spinner data-icon="inline-start" />}{t('learning.dayDetails.confirm', { cost: quote?.cost })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

function LearningPeriodHeader({ label, loading, onPrevious, onNext, canGoNext, previousLabel, nextLabel }: {
  label: string
  loading: boolean
  onPrevious: () => void
  onNext: () => void
  canGoNext: boolean
  previousLabel: string
  nextLabel: string
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-3">
      <Button type="button" variant="ghost" size="icon" className="touch-manipulation transition-none hover:!bg-transparent active:!scale-100"
        onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
        onClick={onPrevious} aria-label={previousLabel}>
        <ChevronLeft />
      </Button>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {label}
        {loading && <Spinner className="size-3.5 text-muted-foreground" />}
      </div>
      <Button type="button" variant="ghost" size="icon" className="touch-manipulation transition-none hover:!bg-transparent active:!scale-100"
        disabled={!canGoNext} onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
        onClick={onNext} aria-label={nextLabel}>
        <ChevronRight />
      </Button>
    </div>
  )
}

function formatDuration(seconds: number, t: any) {
  if (seconds > 0 && seconds < 60) return t('learning.dayDetails.lessMinute')
  return t('learning.minutesWithCount', { count: Math.ceil(Math.max(0, seconds) / 60) })
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
  const chartData = items.map((item) => ({
    day: format(item.day, 'EEEEE', { locale }),
    dateKey: format(item.day, 'yyyy-MM-dd'),
    date: format(item.day, 'M/d', { locale }),
    minutes: item.minutes,
    questions: item.questionCount,
  }))
  const selectedDateKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : undefined
  const selectedChartIndex = chartData.findIndex((item) => item.dateKey === selectedDateKey)
  const selectedChartItem = selectedChartIndex >= 0 ? chartData[selectedChartIndex] : null
  const chartMaxValue = Math.max(1, ...chartData.flatMap((item) => [item.minutes, item.questions]))
  return (
    <div
      className="flex h-[440px] flex-none touch-pan-y flex-col overflow-hidden rounded-2xl bg-background"
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
          <ComposedChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 18, right: 0, left: 0, bottom: 0 }}
            onClick={(state) => {
              if (typeof state?.activeTooltipIndex !== 'number') return
              const target = items[state.activeTooltipIndex]
              if (target) onSelectDay(target.day)
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" hide />
            <YAxis hide yAxisId="metric" />
            {selectedDateKey && <ReferenceLine x={chartData[selectedChartIndex]?.day} yAxisId="metric" stroke="hsl(var(--accent))" strokeOpacity={0.75} strokeWidth={1.5} />}
            <Bar dataKey="minutes" yAxisId="metric" barSize={14} fill="var(--color-minutes)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {chartData.map((item) => {
                const isSelected = item.dateKey === selectedDateKey
                return <Cell key={item.dateKey} fill={isSelected ? 'hsl(var(--accent))' : 'var(--color-minutes)'} stroke={isSelected ? 'hsl(var(--accent))' : 'transparent'} strokeWidth={isSelected ? 2 : 0} />
              })}
              <LabelList dataKey="minutes" position="top" offset={5} className="fill-muted-foreground" fontSize={10} />
            </Bar>
            <Line type="linear" dataKey="questions" yAxisId="metric" stroke="var(--color-questions)" strokeWidth={3} dot={{ r: 3, fill: 'var(--color-questions)', strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        {selectedChartItem && (
          <div className="pointer-events-none absolute z-10" style={{ ...getChartCardPosition(selectedChartIndex, chartData.length), top: getChartCardTopByRatio(selectedChartItem.minutes / chartMaxValue, 300, 18) }}>
            <ActivityInfoCard title={selectedChartItem.date} minutes={selectedChartItem.minutes} questions={selectedChartItem.questions} />
          </div>
        )}
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

function MonthlyActivityChart({ days, dailyStats, locale, selectedDay, onSelectDay }: {
  days: Date[]
  dailyStats: Map<string, { date: string; questionCount: number; activeSeconds: number }>
  locale: typeof zhCN
  selectedDay?: Date
  onSelectDay: (day: Date) => void
}) {
  const { t } = useTranslation()
  const items = days.map(day => {
    const stat = dailyStats.get(format(day, 'yyyy-MM-dd'))
    return {
      key: format(day, 'yyyy-MM-dd'),
      title: format(day, 'M/d', { locale }),
      label: format(day, 'd', { locale }),
      minutes: Math.ceil((stat?.activeSeconds ?? 0) / 60),
      questions: stat?.questionCount ?? 0,
    }
  })
  return <CompactActivityChart title={t('learning.monthlyRhythm', { defaultValue: '本月练习趋势' })} items={items} selectedKey={selectedDay ? format(selectedDay, 'yyyy-MM-dd') : undefined} onSelect={index => onSelectDay(days[index])} />
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
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null)
  useEffect(() => setSelectedMonthIndex(null), [year])
  const values = Array.from({ length: 12 }, (_, index) => {
    const prefix = `${format(year, 'yyyy')}-${String(index + 1).padStart(2, '0')}`
    const days = [...dailyStats.values()].filter((item) => item.date.startsWith(prefix))
    return {
      label: index + 1,
      minutes: Math.ceil(days.reduce((sum, item) => sum + item.activeSeconds, 0) / 60),
      questions: days.reduce((sum, item) => sum + item.questionCount, 0),
    }
  })
  const items = values.map(item => ({
    key: String(item.label), label: String(item.label),
    title: `${format(year, 'yyyy')}-${String(item.label).padStart(2, '0')}`,
    minutes: item.minutes, questions: item.questions,
  }))
  return <ExpandedActivityChart
    title={t('profile.yearlyTrend', { defaultValue: '全年学习趋势' })}
    hint={t('profile.yearlyTrendHint', { defaultValue: '柱状为分钟，折线为完成题数' })}
    period={format(year, 'yyyy')} onPrevious={onPrevYear} onNext={onNextYear} canGoNext={canGoToNextYear}
    previousLabel="Previous year" nextLabel="Next year"
    items={items} selectedKey={selectedMonthIndex === null ? undefined : String(selectedMonthIndex + 1)} onSelect={setSelectedMonthIndex}
    footer={<div className="grid grid-cols-12 [--cell-size:2.15rem]">
      {values.map((item, index) => {
        const monthDate = startOfMonth(new Date(year.getFullYear(), index, 1))
        return <button key={item.label} type="button" disabled={isAfter(monthDate, startOfMonth(today))} onClick={() => { setSelectedMonthIndex(index); onSelectMonth(monthDate) }} className={cn('flex h-[--cell-size] w-full items-center justify-center rounded-xl p-0 text-[10px] font-normal leading-normal text-foreground transition-colors hover:bg-muted disabled:text-muted-foreground disabled:opacity-35', index === selectedMonthIndex && 'bg-muted')}>{item.label}</button>
      })}
    </div>}
  />
}
