import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { addMonths, endOfMonth, endOfWeek, format, isAfter, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { enUS, ja, zhCN } from 'date-fns/locale'
import {
  BookOpen, GraduationCap, Plane, Coffee, Briefcase, Users,
  ChevronLeft, ChevronRight, CheckCircle2, Lock, ArrowRight,
  ClipboardList, ShoppingBag, Play, Search, CalendarDays, Mic,
  BookText, MessageSquareText, ListChecks, X, Flame, CalendarCheck, type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import { getPracticeRecords, type PracticeRecord, type PracticeRecordsResult } from '@/features/profile/api'
import { MemberPage } from '@/features/membership/pages/member-page'
import { pointsApi, type CheckInCalendar } from '@/features/points/api'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import {
  learningApi,
  type LearningCategory,
  type LearningUnitSummary,
  type MyUnit,
  type TodayPlan,
  type TodayTask,
} from '../api/learning-api'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  '留学生活': GraduationCap,
  '旅行英语': Plane,
  '日常社交': Coffee,
  '职场交流': Briefcase,
  '学术挑战': Users,
}

function getCategoryIcon(name: string) {
  return CATEGORY_ICONS[name] ?? BookOpen
}

export function LearningPlanPage() {
  const { t } = useTranslation()
  const [shopOpen, setShopOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)

  // ── "当前学习" 数据 ──
  const [myUnits, setMyUnits] = useState<MyUnit[]>([])
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null)
  const [myLoading, setMyLoading] = useState(true)

  // ── "学习商店" 数据 ──
  const [shopCategories, setShopCategories] = useState<LearningCategory[]>([])
  const [shopLoading, setShopLoading] = useState(false)

  // 首次加载：两个 Tab 都预拉
  useEffect(() => {
    Promise.all([
      learningApi.getMyUnits().then(setMyUnits).catch(() => setMyUnits([])),
      learningApi.getTodayTasks().then(setTodayPlan).catch(() => setTodayPlan(null)),
      learningApi.getUnits().then(setShopCategories).catch(() => setShopCategories([])),
    ]).finally(() => { setMyLoading(false); setShopLoading(false) })
  }, [])

  const refreshMyUnits = useCallback(() => {
    learningApi.getMyUnits().then(setMyUnits).catch(() => {})
  }, [])

  const refreshShop = useCallback(() => {
    setShopLoading(true)
    learningApi.getUnits()
      .then(setShopCategories)
      .catch(() => {})
      .finally(() => setShopLoading(false))
  }, [])

  // 商店数据平坦化
  const allShopUnits = shopCategories.flatMap((c) =>
    c.units.map((u) => ({ ...u, categoryName: c.name, categoryIcon: c.icon })),
  )
  const notStarted = allShopUnits.filter(
    (u) => u.isUnlocked && (u.completionPercent ?? 0) === 0,
  )

  // 我的学习数据分组
  const inProgress = myUnits.filter((u) => u.completionPercent < 100)
  const completed = myUnits.filter((u) => u.completionPercent >= 100)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24">
        <div className="mb-3 flex items-center justify-between">
          <div />

          <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45 lg:hidden">
            <button
              type="button"
              onClick={() => setRecordsOpen(true)}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
              aria-label={t('profile.records')}
            >
              <ClipboardList className="size-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => { setShopOpen(true); refreshShop() }}
              className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
              aria-label={t('member.title')}
            >
              <ShoppingBag className="size-[18px]" />
              {/* {notStarted.length > 0 && (
                <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
              )} */}
            </button>
          </div>
        </div>

        <MyLearningView
          myUnits={myUnits}
          inProgress={inProgress}
          completed={completed}
          todayPlan={todayPlan}
          loading={myLoading}
          onGoToShop={() => { setShopOpen(true); refreshShop() }}
          onRefresh={refreshMyUnits}
        />

        <Drawer open={recordsOpen} onOpenChange={setRecordsOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('profile.records')}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <PracticeRecordsContent />
            </div>
          </DrawerContent>
        </Drawer>
        <Drawer open={shopOpen} onOpenChange={setShopOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('learning.shopTitle')}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <ShopView
                categories={shopCategories}
                loading={shopLoading}
                categoriesEmpty={shopCategories.length === 0}
                onMemberOpen={() => setMemberOpen(true)}
              />
            </div>
          </DrawerContent>
        </Drawer>
        <Drawer open={memberOpen} onOpenChange={setMemberOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">开通会员</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <MemberPage compact />
            </div>
          </DrawerContent>
        </Drawer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
//  「当前学习」视图
// ═══════════════════════════════════════════════════════

function MyLearningView({
  myUnits,
  inProgress,
  completed,
  todayPlan,
  loading,
  onGoToShop,
  onRefresh,
}: {
  myUnits: MyUnit[]
  inProgress: MyUnit[]
  completed: MyUnit[]
  todayPlan: TodayPlan | null
  loading: boolean
  onGoToShop: () => void
  onRefresh?: () => void
}) {
  const { t } = useTranslation()
  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
  }

  if (myUnits.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-14 text-center">
        <BookOpen className="size-10 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">{t('learning.notStarted')}</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onGoToShop}>
          {t('learning.goToShop')}
        </Button>
      </div>
    )
  }

  const primaryUnit = inProgress[0]
  const otherUnits = inProgress.slice(1)
  const tasks = todayPlan?.tasks ?? []
  const practiceTasks = tasks.filter((task) => task.type === 'practice' || task.type === 'script')

  return (
    <div className="space-y-5">
      <LearningWeekTracker todayPlan={todayPlan} />

      {/* 进行中的单元 - 统一卡片，默认全部展开 */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">
            {t('learning.inProgress')}
          </h2>
          <div className="space-y-2">
            {inProgress.map((unit) => (
              <InProgressUnitCard key={unit.id} unit={unit} todayPlan={todayPlan} onRefresh={onRefresh} />
            ))}
          </div>
        </section>
      )}

      {/* 学习进度概览 */}
      {/* {inProgress.length > 0 && (
        <TodayProgressSummary units={inProgress} />
      )} */}

      {completed.length > 0 && (<section>
          <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">
            {t('learning.completed')}
          </h2>
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

// ── 进行中的单元卡片（可展开/折叠，默认展开）──

function InProgressUnitCard({ unit, todayPlan, onRefresh }: { unit: MyUnit; todayPlan: TodayPlan | null; onRefresh?: () => void }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [quitting, setQuitting] = useState(false)
  const pct = unit.completionPercent
  const Icon = getCategoryIcon(unit.categoryName)
  const nextTopic = unit.topics?.[0]
  const unitTasks = (todayPlan?.tasks ?? []).filter((task) => task.unitId === unit.id)
  const prepTasks = unitTasks.filter((task) => task.type === 'vocab' || task.type === 'chunk')

  const handleQuit = useCallback(async () => {
    setQuitting(true)
    try {
      await learningApi.quitUnit(unit.id)
      toast.success(t('learning.quitSuccess'))
      onRefresh?.()
    } catch {
      toast.error(t('learning.quitFailed'))
    } finally {
      setQuitting(false)
      setConfirmQuit(false)
    }
  }, [unit.id, t, onRefresh])

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
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setConfirmQuit(true) }}
                className="shrink-0 rounded-md p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
            <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
              <span>{unit.vocabCount} {t('learning.vocab')}</span>
              <span>{unit.chunkCount} {t('learning.chunks')}</span>
              <span>{unit.topicCount} {t('learning.topics')}</span>
            </div>

            {/* <Progress value={pct} className="mt-2 h-1" /> */}

            {/* {unit.description && (
              <div className="mt-2 rounded-md bg-muted/40 px-2.5 py-2">
                <p className="text-xs font-medium text-foreground">{t('learning.preparationTitle')}</p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{unit.description}</p>
              </div>
            )} */}
          </div>
        </Link>

        {/* 今日学习暂时隐藏
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-3 flex w-full items-center justify-between rounded-md bg-background/60 px-3 py-2 text-left"
        >
          <div>
            <p className="text-xs font-medium text-foreground">{t('learning.todayStudy')}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {prepTasks.length > 0
                ? `${prepTasks.filter((t) => (t.done ?? 0) > 0).length}/${prepTasks.length} ${t('learning.completed')}`
                : t('learning.noTasks')}
            </p>
          </div>
          <span className="flex items-center gap-0.5 text-xs text-primary">
            {expanded ? t('learning.collapse') : t('learning.expand')}
            <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
          </span>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {prepTasks.length > 0 ? prepTasks.map((task) => (
              <TodayTaskRow key={task.id} task={task} compact />
            )) : (
              <div className="rounded-md bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                {t('learning.previewHint')}
              </div>
            )}
          </div>
        )}
        */}
        
        {/* 退出确认弹窗 */}
        <Dialog open={confirmQuit} onOpenChange={setConfirmQuit}>
          <DialogContent className="rounded-2xl p-6 sm:mx-auto sm:max-w-xs w-[90vw]">
            <DialogHeader className="p-0">
              <DialogTitle className="text-base">{t('learning.quitConfirmTitle')}</DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-5">
                {t('learning.quitConfirmDesc', { title: unit.title })}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                disabled={quitting}
                onClick={() => setConfirmQuit(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl"
                disabled={quitting}
                onClick={handleQuit}
              >
                {quitting ? t('common.loading') : t('learning.quitConfirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}

function LearningWeekTracker({ todayPlan }: { todayPlan: TodayPlan | null }) {
  const { t } = useTranslation()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const summary = getTodayTaskSummary(todayPlan)
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
          <Badge variant={summary.allDone ? 'default' : 'secondary'} className="h-6 rounded-full px-2 text-[10px]">
            {summary.total > 0 ? `${summary.done}/${summary.total}` : t('learning.pending')}
          </Badge>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, index) => {
            const isToday = index === mondayIndex
            const isPast = index < mondayIndex
            const isDone = isToday && summary.allDone
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-xs font-medium',
                    isDone && 'bg-primary text-primary-foreground',
                    isToday && !isDone && 'bg-background text-foreground',
                    isPast && 'bg-background/70 text-muted-foreground',
                    !isToday && !isPast && 'text-muted-foreground/50',
                  )}
                >
                  {day}
                </div>
                <span className={cn('size-1 rounded-full', isDone ? 'bg-primary' : isToday ? 'bg-muted-foreground/50' : 'bg-transparent')} />
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
  const [data, setData] = useState<CheckInCalendar | null>(null)
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(() => new Date())
  const calendarCache = useRef(new Map<string, CheckInCalendar>())
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
    const cacheKey = `${visibleRange.startDate}:${visibleRange.endDate}`
    const cached = calendarCache.current.get(cacheKey)
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setData((current) => current ? { ...current, dates: [] } : null)
    pointsApi.getCheckInCalendar(visibleRange.startDate, visibleRange.endDate)
      .then((nextData) => {
        if (cancelled) return
        calendarCache.current.set(cacheKey, nextData)
        setData(nextData)
      })
      .catch(() => {
        if (!cancelled) {
          setData((current) => current ?? { dates: [], totalCheckIns: 0, currentStreak: 0 })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, visibleRange])

  const changeMonth = useCallback((offset: number) => {
    const nextMonth = addMonths(month, offset)
    if (!isAfter(nextMonth, today)) setMonth(nextMonth)
  }, [month, today])

  const canGoToNextMonth = !isAfter(addMonths(month, 1), today)

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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-manipulation"
                onPointerDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {format(month, 'yyyy MMMM', { locale: calendarLocale })}
                {loading && <Spinner className="size-3.5 text-muted-foreground" />}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-manipulation"
                disabled={!canGoToNextMonth}
                onPointerDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onClick={() => changeMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="overflow-hidden">
              <Calendar
                month={month}
                hideNavigation
                locale={calendarLocale}
                disabled={{ after: today }}
                modifiers={{ checkedIn: checkedInDates }}
                modifiersClassNames={{
                  checkedIn: 'relative after:absolute after:bottom-1 after:left-1/2 after:size-2 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[""]',
                }}
                classNames={{ month_caption: 'hidden' }}
                className="mx-auto w-full [--cell-size:2.5rem]"
              />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">{t('learning.calendarSwipeHint')}</p>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function TodayProgressSummary({ units }: { units: MyUnit[] }) {
  const { t } = useTranslation()
  const totals = units.reduce(
    (acc, u) => {
      const p = u.progress
      if (!p) return acc
      return {
        vocabDone: acc.vocabDone + p.vocabLearned,
        vocabTotal: acc.vocabTotal + p.vocabTotal,
        chunkDone: acc.chunkDone + p.chunkMastered,
        chunkTotal: acc.chunkTotal + p.chunkTotal,
        practiceDone: acc.practiceDone + p.completedPracticeCount,
        practiceTotal: acc.practiceTotal + u.topicCount,
      }
    },
    { vocabDone: 0, vocabTotal: 0, chunkDone: 0, chunkTotal: 0, practiceDone: 0, practiceTotal: 0 },
  )
  const overallTotal = totals.vocabTotal + totals.chunkTotal + totals.practiceTotal
  const overallDone = totals.vocabDone + totals.chunkDone + totals.practiceDone
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0

  return (
    <section className="rounded-lg bg-muted/30 p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          <p className="text-xs font-semibold text-foreground">{t('learning.progressOverview')}</p>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{overallPct}%</span>
      </div>
      <Progress value={overallPct} className="mt-2 h-1.5" />
      <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
        <span>{t('learning.vocab')} {totals.vocabDone}/{totals.vocabTotal}</span>
        <span>{t('learning.chunks')} {totals.chunkDone}/{totals.chunkTotal}</span>
        <span>{t('learning.topics')} {totals.practiceDone}/{totals.practiceTotal}</span>
      </div>
    </section>
  )
}

function TodayTaskRow({ task, compact = false }: { task: TodayTask; compact?: boolean }) {
  const Icon = task.type === 'vocab' ? BookText : task.type === 'chunk' ? MessageSquareText : task.type === 'script' ? Play : Mic
  const href = task.type === 'practice'
    ? `/practice/session/${task.topicId}`
    : task.type === 'script'
      ? `/script/${task.episodeId}`
      : `/learning/units/${task.unitId}`

  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-3 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50',
        compact && 'rounded-md bg-muted/35 p-2.5 shadow-none ring-0',
      )}
    >
      <div className={cn(
        'flex aspect-square shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-orange-100 via-amber-50 to-sky-100 text-orange-600 dark:from-orange-950/50 dark:via-amber-950/30 dark:to-sky-950/40',
        compact ? 'size-9' : 'size-12',
      )}>
        <Icon className={compact ? 'size-4' : 'size-5'} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold text-foreground">{task.topicTitle ?? task.episodeTitle ?? task.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.promptZh ?? task.description}</p>
        {(task.type === 'vocab' || task.type === 'chunk') && task.total ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={((task.done ?? 0) / Math.max(task.total, 1)) * 100} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground">{task.done ?? 0}/{task.total}</span>
          </div>
        ) : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function getTodayTaskSummary(todayPlan: TodayPlan | null) {
  const tasks = todayPlan?.tasks ?? []
  let done = 0
  let total = 0
  let countedPracticeDone = 0
  const completedPractice = todayPlan?.currentUnit?.progress?.completedPractice ?? 0

  for (const task of tasks) {
    if (task.type === 'vocab' || task.type === 'chunk') {
      done += task.done ?? 0
      total += task.total ?? task.count ?? 0
    } else if (task.type === 'practice') {
      total += 1
      if (countedPracticeDone < completedPractice) {
        done += 1
        countedPracticeDone += 1
      }
    } else {
      total += 1
    }
  }

  return {
    done,
    total,
    allDone: total > 0 && done >= total,
  }
}

// ── 我的学习单元卡片 ──

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
        isCompleted
          ? 'hover:bg-emerald-500/[0.06]'
          : 'hover:bg-muted/50',
      )}
    >
      <div
        className={cn(
          'relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40',
          isCompleted && 'from-emerald-100 via-emerald-50 to-slate-100 text-emerald-600 dark:from-emerald-950/50 dark:via-emerald-950/30 dark:to-slate-950/40',
        )}
      >
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

// ═══════════════════════════════════════════════════════
//  「学习商店」视图
// ═══════════════════════════════════════════════════════

function ShopView({
  categories,
  loading,
  categoriesEmpty,
  onMemberOpen,
}: {
  categories: LearningCategory[]
  loading: boolean
  categoriesEmpty: boolean
  onMemberOpen: () => void
}) {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState('all')
  const [keyword, setKeyword] = useState('')

  const allUnits = useMemo(
    () =>
      categories.flatMap((category) =>
        category.units.map((unit) => ({
          ...unit,
          categoryName: category.name,
          categoryIcon: category.icon,
        })),
      ),
    [categories],
  )

  const categoryTabs = useMemo(
    () => [
      { id: 'all', label: t('learning.all'), count: allUnits.length },
      ...categories.map((category) => ({
        id: category.id,
        label: category.name,
        count: category.units.length,
      })),
    ],
    [allUnits.length, categories],
  )

  const filteredUnits = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return allUnits.filter((unit) => {
      const matchesCategory =
        activeCategory === 'all' ||
        categories.find((category) => category.id === activeCategory)?.name === unit.categoryName

      if (!matchesCategory) return false
      if (!query) return true

      const haystack = [
        unit.title,
        unit.location,
        unit.categoryName,
        ...unit.topics.map((topic) => topic.title),
      ].join(' ').toLowerCase()

      return haystack.includes(query)
    })
  }, [activeCategory, allUnits, categories, keyword])

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
  }

  if (categoriesEmpty) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <BookOpen className="size-12 text-muted-foreground/40" />
        <p className="mt-4 text-muted-foreground">{t('learning.comingSoon')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('learning.searchPlaceholder')}
          className="h-11 rounded-full border-0 bg-muted/70 pl-9 text-sm"
        />
      </div>

      <div className="-mx-4 scrollbar-hide overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {categoryTabs.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                activeCategory === category.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {category.label}
              <span className="ml-1 opacity-70">{category.count}</span>
            </button>
          ))}
        </div>
      </div>

      {filteredUnits.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ShoppingBag className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">{t('learning.noMatch')}</p>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg">
          {filteredUnits.map((unit) => (
            <ShopCard key={unit.id} unit={unit} onMemberOpen={onMemberOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 商店卡片 ──

function ShopCard({ unit, onMemberOpen }: { unit: LearningUnitSummary & { categoryName?: string }; onMemberOpen: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [detailOpen, setDetailOpen] = useState(false)
  const [acquiring, setAcquiring] = useState(false)
  const [topicPage, setTopicPage] = useState(1)
  const pageSize = 6
  const Icon = (unit.isUnlocked && !unit.isLocked) ? getCategoryIcon(unit.categoryName ?? '') : Lock
  const totalTopicPages = Math.max(1, Math.ceil((unit.topics?.length ?? 0) / pageSize))
  const pagedTopics = (unit.topics ?? []).slice((topicPage - 1) * pageSize, topicPage * pageSize)

  const handleAcquire = useCallback(async () => {
    if (acquiring || !unit.isUnlocked || unit.isLocked) return
    setAcquiring(true)
    try {
      await learningApi.startUnit(unit.id)
      navigate(`/learning/units/${unit.id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || ''
      if (msg.includes('最多同时')) {
        toast.error(msg)
      } else {
        navigate(`/learning/units/${unit.id}`)
      }
    } finally {
      setAcquiring(false)
    }
  }, [unit.id, unit.isUnlocked, acquiring, navigate])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!unit.isUnlocked || unit.isLocked) { onMemberOpen(); return }
          setTopicPage(1); setDetailOpen(true)
        }}
        className="flex w-full gap-3 rounded-lg bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50"
      >
        <UnitCover unit={unit} icon={Icon} />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
            {(!unit.isUnlocked || unit.isLocked) && <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {unit.topicCount}{t('learning.topics')} · {unit.vocabCount}{t('learning.vocab')} · {unit.chunkCount}{t('learning.chunks')}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {unit.categoryName && <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{unit.categoryName}</Badge>}
            <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
              Lv.{unit.requiredUserLevel}
            </Badge>
          </div>
        </div>
      </button>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden rounded-2xl p-0 sm:max-w-md w-[90vw]">
          <DialogHeader className="sr-only">
            <DialogTitle>{unit.title}</DialogTitle>
            <DialogDescription>{unit.location}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[88vh] flex-col">
            <div className="flex gap-3 bg-muted/30 p-4">
              <UnitCover unit={unit} icon={Icon} className="size-20" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {unit.categoryName && <Badge variant="secondary" className="rounded-full text-[10px]">{unit.categoryName}</Badge>}
                  {(!unit.isUnlocked || unit.isLocked) && <Badge variant="outline" className="rounded-full text-[10px]">{t('learning.locked')}</Badge>}
                </div>
                <h3 className="mt-2 line-clamp-2 text-base font-bold leading-5 text-foreground">{unit.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{unit.location}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{unit.vocabCount} {t('learning.vocab')}</span>
                  <span>{unit.chunkCount} {t('learning.chunks')}</span>
                  <span>{unit.topicCount} {t('learning.topics')}</span>
                </div>
              </div>
            </div>

            <div className="p-4">
              <Button className="w-full gap-2" disabled={!unit.isUnlocked || unit.isLocked || acquiring} onClick={handleAcquire}>
                {acquiring ? <Spinner data-icon="inline-start" /> : <ArrowRight className="size-4" />}
                {unit.isUnlocked && !unit.isLocked ? t('learning.start') : `${t('learning.level')}.${unit.requiredUserLevel} ${t('learning.unlock')}`}
              </Button>
            </div>

            <div className="bg-muted/30 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">{t('learning.topicList')}</p>
                {unit.topics.length > pageSize && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={topicPage === 1}
                      onClick={() => setTopicPage((page) => Math.max(1, page - 1))}
                      className="rounded-full px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
                    >
                      {t('common.prevPage')}
                    </button>
                    <span className="text-[11px] text-muted-foreground">{topicPage}/{totalTopicPages}</span>
                    <button
                      type="button"
                      disabled={topicPage === totalTopicPages}
                      onClick={() => setTopicPage((page) => Math.min(totalTopicPages, page + 1))}
                      className="rounded-full px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
                    >
                      {t('common.nextPage')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {pagedTopics.length > 0 ? (
                <div className="space-y-1.5">
                  {pagedTopics.map((topic, index) => (
                    <div key={topic.id} className="flex items-center gap-3 rounded-lg bg-muted/25 px-3 py-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {(topicPage - 1) * pageSize + index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-foreground">{topic.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t('practiceHub.suggested')} {Math.max(1, Math.round(topic.suggestedDurationSec / 60))} {t('practiceSession.minutes')}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[10px]">{topic.difficulty}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('learning.noTopics')}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function UnitCover({
  unit,
  icon: Icon,
  className,
}: {
  unit: LearningUnitSummary & { categoryName?: string }
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40',
        (!unit.isUnlocked || unit.isLocked) && 'grayscale',
        className,
      )}
    >
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
      <Icon className="relative size-7" />
    </div>
  )
}

// ─── 练习记录列表内容 ──────────────────────────────────────────────────────
function PracticeRecordsContent() {
  const { t } = useTranslation()
  const [data, setData] = useState<PracticeRecordsResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    setIsLoading(true)
    getPracticeRecords({ page, pageSize })
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [page])

  const columns: ColumnConfig<PracticeRecord>[] = [
    {
      key: 'topicName',
      header: t('profile.practiceRecords.columns.topic'),
      cell: (v, row) => (
        <div>
          <span className="text-sm font-medium">{v}</span>
          {row.questionText && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.questionText}</p>
          )}
          {row.summary && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{row.summary}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('profile.practiceRecords.columns.status'),
      cell: (v, row) => (
        <div className="space-y-1">
          <Badge variant={v === 'analyzed' ? 'default' : v === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
            {v === 'analyzed' ? t('profile.practiceRecords.status.analyzed') : v === 'analyzing' ? t('profile.practiceRecords.status.analyzing') : v === 'completed' ? t('profile.practiceRecords.status.completed') : v === 'failed' ? t('profile.practiceRecords.status.failed') : t('profile.practiceRecords.status.inProgress')}
          </Badge>
          <div className="text-[11px] text-muted-foreground">
            {typeof row.score === 'number' && <span className="font-semibold text-primary tabular-nums">{row.score}分</span>}
            {typeof row.score === 'number' && <span className="mx-1 text-border">·</span>}
            <span>{row.practiceCount}次</span>
          </div>
        </div>
      ),
      align: 'center',
    },
    {
      key: 'lastPracticeAt',
      header: t('profile.practiceRecords.columns.date'),
      cell: (v) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {new Date(v).toLocaleDateString('zh-CN')}
        </span>
      ),
      align: 'center',
    },
  ]

  return (
    <div className="space-y-4">
      <ConfigDataTable
        data={data?.list || []}
        columns={columns}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t('profile.practiceRecords.empty')}
      />
    </div>
  )
}
