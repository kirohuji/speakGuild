import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { addMonths, endOfMonth, endOfWeek, format, isAfter, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { enUS, ja, zhCN } from 'date-fns/locale'
import { CalendarDays, Flame, CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/stores/learning.store'

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
  const today = useMemo(() => startOfDay(new Date()), [])
  const calendarLocale = i18n.language.startsWith('ja')
    ? ja
    : i18n.language.startsWith('en')
      ? enUS
      : zhCN
  const visibleRange = useMemo(() => ({
    startDate: format(startOfWeek(startOfMonth(month), { locale: calendarLocale }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(endOfMonth(month), { locale: calendarLocale }), 'yyyy-MM-dd'),
  }), [calendarLocale, month])
  const checkedInDates = useMemo<Date[]>(
    () => data?.dates.map((date) => parseISO(date)) ?? [],
    [data],
  )

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
      <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background">
        <DrawerHeader className="px-4 pb-1 pt-2 text-left">
          <DrawerTitle className="text-base font-semibold">{t('learning.checkInCalendar')}</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Flame className="size-3.5" />
                {t('learning.currentStreak')}
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">{data?.currentStreak ?? 0}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('learning.days')}</span></p>
            </div>
            <div className="rounded-2xl bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarCheck className="size-3.5" />
                {t('learning.totalCheckIns')}
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">{data?.totalCheckIns ?? 0}<span className="ml-1 text-xs font-normal text-muted-foreground">{t('learning.days')}</span></p>
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl bg-background">
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
              <Calendar month={month} hideNavigation locale={calendarLocale} disabled={{ after: today }}
                modifiers={{ checkedIn: checkedInDates }}
                modifiersClassNames={{ checkedIn: 'relative after:absolute after:bottom-1 after:left-1/2 after:size-2 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[""]' }}
                classNames={{ month_caption: 'hidden' }} className="mx-auto w-full [--cell-size:2.5rem]" />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">{t('learning.calendarSwipeHint')}</p>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
