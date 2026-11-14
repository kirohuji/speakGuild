import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'

export function useLearningChartConfig() {
  const { t } = useTranslation()
  return {
    minutes: { label: t('learning.activeDuration', { defaultValue: '练习分钟' }), color: 'hsl(var(--primary))' },
    questions: { label: t('learning.questionsCompleted', { defaultValue: '完成题数' }), color: 'hsl(var(--accent))' },
  } satisfies ChartConfig
}

export function getChartCardPosition(index: number, itemCount: number) {
  const anchor = `${((index + 0.5) / itemCount) * 100}%`
  return {
    left: `clamp(3.75rem, ${anchor}, calc(100% - 3.75rem))`,
    transform: 'translateX(-50%)',
  }
}

export function getChartCardTopByRatio(ratio: number, plotHeight: number, topMargin: number) {
  const barTop = topMargin + (1 - ratio) * plotHeight
  return Math.max(4, barTop - 46)
}

// Minutes and completed questions are separate units. Give each one a little
// headroom so a single high value does not visually pin its mark to the top.
export function getChartDomainMax(values: number[], minimum: number) {
  const maximum = Math.max(0, ...values)
  return Math.max(minimum, Math.ceil(maximum * 1.15))
}

export function ActivityInfoCard({ title, minutes, questions }: { title: string; minutes: number; questions: number }) {
  const { t } = useTranslation()
  return (
    <div className="w-28 rounded-md border border-accent bg-background px-2 py-1 text-[10px] shadow-md">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-0.5 whitespace-nowrap text-muted-foreground">{formatDuration(minutes * 60, t)} · {questions}{t('learning.questionsUnit', { defaultValue: '题' })}</p>
    </div>
  )
}

export interface ActivityChartItem {
  key: string
  title: string
  label: string
  minutes: number | null
  questions: number | null
}

export function CompactActivityChart({ title, items, selectedKey, onSelect, ticks, height = 116 }: {
  title: string
  items: ActivityChartItem[]
  selectedKey?: string
  onSelect: (index: number) => void
  ticks?: string[]
  height?: number
}) {
  const { t } = useTranslation()
  const config = useLearningChartConfig()
  const selectedIndex = items.findIndex(item => item.key === selectedKey)
  const selected = items[selectedIndex]
  const minutesMax = getChartDomainMax(items.map(item => item.minutes ?? 0), 60)
  const questionsMax = getChartDomainMax(items.map(item => item.questions ?? 0), 160)
  const ratio = selected ? Math.max((selected.minutes ?? 0) / minutesMax, (selected.questions ?? 0) / questionsMax) : 0
  return (
    <section className="shrink-0 px-3 pt-2" aria-label={title}>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{t('learning.chartLegend')}</p>
      </div>
      <div className="relative">
        <ChartContainer config={config} className="w-full aspect-auto" style={{ height }}>
          <ComposedChart accessibilityLayer data={items} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} onClick={state => {
            if (state?.activeTooltipIndex == null) return
            const index = Number(state.activeTooltipIndex)
            if (Number.isInteger(index) && items[index]?.minutes != null) onSelect(index)
          }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" axisLine={false} tickLine={false} interval={ticks ? 0 : 4} ticks={ticks} tick={{ fontSize: 9 }} tickFormatter={value => items.find(item => item.key === String(value))?.label ?? ''} />
            <YAxis hide yAxisId="minutes" domain={[0, minutesMax]} />
            <YAxis hide yAxisId="questions" orientation="right" domain={[0, questionsMax]} />
            {selected && <ReferenceLine x={selectedKey} yAxisId="minutes" stroke="hsl(var(--accent))" strokeOpacity={0.75} strokeWidth={1.5} />}
            <Bar dataKey="minutes" yAxisId="minutes" barSize={5} fill="var(--color-minutes)" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {items.map(item => <Cell key={item.key} fill={item.key === selectedKey ? 'hsl(var(--accent))' : 'var(--color-minutes)'} stroke={item.key === selectedKey ? 'hsl(var(--accent))' : 'transparent'} strokeWidth={item.key === selectedKey ? 2 : 0} />)}
            </Bar>
            <Line type="linear" dataKey="questions" yAxisId="questions" stroke="var(--color-questions)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        {selected && <div className="pointer-events-none absolute z-10" style={{ ...getChartCardPosition(selectedIndex, items.length), top: getChartCardTopByRatio(ratio, height - 40, 8) }}>
          <ActivityInfoCard title={selected.title} minutes={selected.minutes ?? 0} questions={selected.questions ?? 0} />
        </div>}
      </div>
    </section>
  )
}

function formatDuration(seconds: number, t: any) {
  if (seconds > 0 && seconds < 60) return t('learning.dayDetails.lessMinute')
  return t('learning.minutesWithCount', { count: Math.ceil(Math.max(0, seconds) / 60) })
}

/** The day and year views share the same bounded plot, header and footer layout. */
export function ExpandedActivityChart({ title, hint, period, onPrevious, onNext, canGoNext, previousLabel, nextLabel, busy = false, items, selectedKey, onSelect, footer, notice, barSize = 10, minimumMinutes = 120, minimumQuestions = 240 }: {
  title: string
  hint: string
  period: string
  onPrevious: () => void
  onNext: () => void
  canGoNext: boolean
  previousLabel: string
  nextLabel: string
  busy?: boolean
  items: ActivityChartItem[]
  selectedKey?: string
  onSelect: (index: number) => void
  footer: ReactNode
  notice?: string
  barSize?: number
  minimumMinutes?: number
  minimumQuestions?: number
}) {
  const config = useLearningChartConfig()
  const selectedIndex = items.findIndex(item => item.key === selectedKey)
  const selected = items[selectedIndex]
  const minutesMax = getChartDomainMax(items.map(item => item.minutes ?? 0), minimumMinutes)
  const questionsMax = getChartDomainMax(items.map(item => item.questions ?? 0), minimumQuestions)
  const ratio = selected ? Math.max((selected.minutes ?? 0) / minutesMax, (selected.questions ?? 0) / questionsMax) : 0
  return <section className="flex h-[440px] min-w-0 flex-none flex-col overflow-hidden rounded-2xl bg-background" aria-label={title}>
    <div className="flex items-center justify-between gap-3 px-3 pt-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full" onClick={onPrevious} aria-label={previousLabel}><ChevronLeft /></Button>
        <span className="flex min-w-10 items-center justify-center gap-1 text-xs font-medium tabular-nums">{period}{busy && <Spinner className="size-3" />}</span>
        <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full" onClick={onNext} disabled={!canGoNext} aria-label={nextLabel}><ChevronRight /></Button>
      </div>
    </div>
    <div className="relative mt-2 min-h-0 min-w-0 flex-1 px-3">
      <div className="absolute inset-x-3 top-0" style={{ bottom: notice ? '5.5rem' : '3.75rem' }}>
        <ChartContainer config={config} className="size-full min-w-0 aspect-auto overflow-hidden">
          <ComposedChart accessibilityLayer data={items} margin={{ top: 18, right: 4, left: 4, bottom: 8 }} onClick={state => {
            if (state?.activeTooltipIndex == null) return
            const index = Number(state.activeTooltipIndex)
            if (Number.isInteger(index) && items[index]?.minutes != null) onSelect(index)
          }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" hide />
            <YAxis hide yAxisId="minutes" domain={[0, minutesMax]} padding={{ bottom: 4 }} allowDataOverflow />
            <YAxis hide yAxisId="questions" orientation="right" domain={[0, questionsMax]} padding={{ bottom: 4 }} allowDataOverflow />
            {selected && <ReferenceLine x={selectedKey} yAxisId="minutes" stroke="hsl(var(--accent))" strokeOpacity={0.75} strokeWidth={1.5} />}
            <Bar dataKey="minutes" yAxisId="minutes" barSize={barSize} fill="var(--color-minutes)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {items.map(item => <Cell key={item.key} fill={item.key === selectedKey ? 'hsl(var(--accent))' : 'var(--color-minutes)'} stroke={item.key === selectedKey ? 'hsl(var(--accent))' : 'transparent'} strokeWidth={item.key === selectedKey ? 2 : 0} />)}
            </Bar>
            <Line type="linear" dataKey="questions" yAxisId="questions" stroke="var(--color-questions)" strokeWidth={3} dot={{ r: 2.5, fill: 'var(--color-questions)', strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        {selected && <div className="pointer-events-none absolute z-10" style={{ ...getChartCardPosition(selectedIndex, items.length), top: getChartCardTopByRatio(ratio, notice ? 270 : 298, 18) }}>
          <ActivityInfoCard title={selected.title} minutes={selected.minutes ?? 0} questions={selected.questions ?? 0} />
        </div>}
      </div>
      <div className="absolute inset-x-3 bottom-2 flex flex-col gap-1">
        {footer}
        {notice && <p className="text-[10px] leading-relaxed text-muted-foreground" role="status">{notice}</p>}
      </div>
    </div>
  </section>
}
