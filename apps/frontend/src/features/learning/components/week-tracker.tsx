import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isAfter, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
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
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date())
  const today = useMemo(() => startOfDay(new Date()), [])
  const calendarLocale = i18n.language.startsWith('ja')
    ? ja
    : i18n.language.startsWith('en')
      ? enUS
      : zhCN
  const visibleRange = useMemo(() => {
    if (view === 'week') {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
      return { startDate: format(weekStart, 'yyyy-MM-dd'), endDate: format(weekEnd, 'yyyy-MM-dd') }
    }
    return {
      startDate: format(startOfWeek(startOfMonth(month), { locale: calendarLocale, weekStartsOn: 1 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(endOfMonth(month), { locale: calendarLocale, weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
  }, [calendarLocale, month, today, view])
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[min(88dvh,700px)] rounded-t-[28px] border-border/70 bg-background drawer-surface">
        <DrawerHeader className="shrink-0 px-4 pb-2 pt-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-base font-semibold">{t('learning.checkInCalendar')}</DrawerTitle>
            <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value as 'week' | 'month')} variant="outline" size="sm" className="gap-0">
              <ToggleGroupItem value="week" className="h-7 px-3 text-xs">{t('learning.week', { defaultValue: '本周' })}</ToggleGroupItem>
              <ToggleGroupItem value="month" className="h-7 px-3 text-xs">{t('learning.month', { defaultValue: '本月' })}</ToggleGroupItem>
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
                {t('learning.activeDuration', { defaultValue: '有效练习' })}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatDuration(summary.activeSeconds)}</p>
            </div>
          </div>

          {view === 'week' ? (
            <WeeklyActivity days={visibleDays} dailyStats={dailyStats} locale={calendarLocale} today={today} />
          ) : (
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
  const safeSeconds = Math.max(0, Math.floor(seconds))
  if (safeSeconds < 60) return `${safeSeconds}秒`
  const minutes = Math.floor(safeSeconds / 60)
  if (minutes < 60) return `${minutes}分`
  return `${Math.floor(minutes / 60)}时${minutes % 60}分`
}

function WeeklyActivity({ days, dailyStats, locale, today }: {
  days: Date[]
  dailyStats: Map<string, { date: string; questionCount: number; activeSeconds: number }>
  locale: typeof zhCN
  today: Date
}) {
  const maxSeconds = Math.max(60, ...days.map((day) => dailyStats.get(format(day, 'yyyy-MM-dd'))?.activeSeconds ?? 0))
  return (
    <div className="min-h-0 flex-1 rounded-2xl bg-muted/20 px-3 pb-3 pt-4">
      <div className="flex h-full items-end justify-between gap-1.5">
        {days.map((day) => {
          const stat = dailyStats.get(format(day, 'yyyy-MM-dd'))
          const seconds = stat?.activeSeconds ?? 0
          const height = seconds > 0 ? Math.max(10, Math.round((seconds / maxSeconds) * 76)) : 4
          return (
            <div key={day.toISOString()} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <span className="h-4 text-[10px] tabular-nums text-muted-foreground">{stat?.questionCount ? `${stat.questionCount}题` : ''}</span>
              <div className="flex h-[88px] w-full items-end rounded-full bg-background/70 px-1.5 pb-1">
                <div className={cn('w-full rounded-full transition-all duration-300', seconds > 0 ? 'bg-primary' : 'bg-transparent')} style={{ height }} />
              </div>
              <span className={cn('text-[10px]', isSameDay(day, today) ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                {format(day, 'EEEEE', { locale })}
              </span>
              <span className={cn('text-xs tabular-nums', isSameDay(day, today) ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
