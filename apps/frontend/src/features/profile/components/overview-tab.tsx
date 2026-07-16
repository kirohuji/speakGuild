import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { ActivityCalendar } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import {
  Calendar, CheckSquare, Star, BookMarked, Flame, TrendingUp, GraduationCap,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import {
  getProfileOverview,
  getActivityHeatmap,
  type ProfileOverview,
  type ActivityDay,
} from '@/features/profile/api'

export function OverviewTab() {
  const { t } = useTranslation()
  const [overview, setOverview] = useState<ProfileOverview | null>(null)
  const [heatmap, setHeatmap] = useState<ActivityDay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hmLoading, setHmLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const maxYear = new Date().getFullYear()

  // Load overview stats once on mount
  useEffect(() => {
    getProfileOverview()
      .then(setOverview)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // Load activity heatmap; reload when year changes
  useEffect(() => {
    setHmLoading(true)
    getActivityHeatmap(year)
      .then(setHeatmap)
      .catch(() => {})
      .finally(() => setHmLoading(false))
  }, [year])

  const stats = [
    { label: t('profile.stats.practiceDays'), value: overview?.totalPracticeDays ?? 0, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: t('profile.stats.totalQuestions'), value: overview?.totalQuestionsAnswered ?? 0, icon: CheckSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: t('profile.stats.favorites'), value: overview?.totalFavorites ?? 0, icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: t('profile.stats.words'), value: overview?.totalWords ?? 0, icon: BookMarked, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: t('profile.stats.streakDays'), value: `${overview?.streakDays ?? 0}`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: t('profile.stats.dailyAvg'), value: overview?.avgDailyQuestions ?? 0, icon: TrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('profile.practiceStats')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {stats.map(({ label, value, icon: Icon, color, bg }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-border"
                >
                  <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', bg)}>
                    <Icon className={cn('h-4.5 w-4.5', color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight tracking-tight tabular-nums">
                      {value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {overview?.currentBank && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('profile.currentBank')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{overview.currentBank.bankName}</p>
                <p className="text-xs text-muted-foreground">{t('profile.stats.currentBankDesc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('profile.learningActivity', { defaultValue: '学习活跃度' })}</CardTitle>
        </CardHeader>
        <CardContent>
          {hmLoading ? <Skeleton className="h-52 rounded-xl" /> : (
            <ActivityCalendarSection
              days={heatmap}
              year={year}
              onPrevYear={() => setYear((value) => value - 1)}
              onNextYear={() => setYear((value) => Math.min(maxYear, value + 1))}
              maxYear={maxYear}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActivityCalendarSection({
  days,
  year,
  onPrevYear,
  onNextYear,
  maxYear,
}: {
  days: ActivityDay[]
  year: number
  onPrevYear: () => void
  onNextYear: () => void
  maxYear: number
}) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Ensure data always spans the full calendar year (Jan 1 – Dec 31).
  const yearData = useMemo<ActivityDay[]>(() => {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    if (days.length === 0) {
      const result: ActivityDay[] = []
      const date = new Date(year, 0, 1)
      while (date.getFullYear() === year) {
        const d = date.toISOString().slice(0, 10)
        result.push({ date: d, count: 0, level: 0 })
        date.setDate(date.getDate() + 1)
      }
      return result
    }

    const dateSet = new Set(days.map((d) => d.date))
    const result = [...days]

    if (!dateSet.has(yearStart)) {
      result.unshift({ date: yearStart, count: 0, level: 0 })
    }
    if (!dateSet.has(yearEnd)) {
      result.push({ date: yearEnd, count: 0, level: 0 })
    }

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [days, year])

  return (
    <div>
      <YearlyTrend days={days} />
      <div className="flex justify-end overflow-x-auto">
        <ActivityCalendar
          data={yearData}
          blockSize={13}
          blockMargin={4}
          blockRadius={2}
          fontSize={14}
          colorScheme={isDark ? 'dark' : 'light'}
          theme={{
            light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
            dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
          }}
          labels={{
            totalCount: t('common.activityTotal', { year, count: yearData.filter(d => d.count > 0).length }),
            legend: { less: t('common.activityLess'), more: t('common.activityMore') },
          }}
          weekStart={0}
        />
      </div>
      <YearNavigator year={year} onPrevYear={onPrevYear} onNextYear={onNextYear} maxYear={maxYear} />
    </div>
  )
}

function YearlyTrend({ days }: { days: ActivityDay[] }) {
  const { t } = useTranslation()
  const values = Array.from({ length: 12 }, (_, index) => {
    const prefix = `${new Date(days[0]?.date ?? Date.now()).getFullYear()}-${String(index + 1).padStart(2, '0')}`
    const monthDays = days.filter((day) => day.date.startsWith(prefix))
    return {
      label: `${index + 1}月`,
      minutes: Math.ceil(monthDays.reduce((sum, day) => sum + (day.activeSeconds ?? 0), 0) / 60),
      questions: monthDays.reduce((sum, day) => sum + (day.questionCount ?? day.count), 0),
    }
  })
  const maxMinutes = Math.max(1, ...values.map((item) => item.minutes))
  const maxQuestions = Math.max(1, ...values.map((item) => item.questions))
  const width = 360
  const height = 116
  const inset = 12
  const plotHeight = 76
  const step = width / 12
  const points = values.map((item, index) => `${step * index + step / 2},${inset + plotHeight - item.questions / maxQuestions * plotHeight}`).join(' ')
  return (
    <div className="mb-5 rounded-xl bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t('profile.yearlyTrend', { defaultValue: '全年学习趋势' })}</p>
        <p className="text-[10px] text-muted-foreground">{t('profile.yearlyTrendHint', { defaultValue: '柱：分钟 · 线：题数' })}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-[116px] w-full" role="img" aria-label="全年练习分钟和完成题数趋势">
        {values.map((item, index) => {
          const barHeight = item.minutes ? Math.max(4, item.minutes / maxMinutes * plotHeight) : 0
          return <rect key={item.label} x={step * index + step * .28} y={inset + plotHeight - barHeight} width={step * .44} height={barHeight} rx="3" fill="hsl(var(--primary) / .22)" />
        })}
        <polyline points={points} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((item, index) => <text key={`${item.label}:text`} x={step * index + step / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{index + 1}</text>)}
      </svg>
    </div>
  )
}

function YearNavigator({
  year,
  onPrevYear,
  onNextYear,
  maxYear,
}: {
  year: number
  onPrevYear: () => void
  onNextYear: () => void
  maxYear: number
}) {
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPrevYear}
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[4rem] text-center text-sm font-medium tabular-nums">
        {year}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onNextYear}
        disabled={year >= maxYear}
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
