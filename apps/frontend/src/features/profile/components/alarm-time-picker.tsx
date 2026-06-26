import { useMemo, useState } from 'react'
import { AlarmClock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return { hour: 20, minute: 0 }
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function meridiemLabel(hour: number) {
  if (hour < 6) return '凌晨'
  if (hour < 12) return '上午'
  if (hour < 18) return '下午'
  return '晚上'
}

function minuteOptions(selectedMinute: number) {
  const options = new Set<number>()
  for (let minute = 0; minute < 60; minute += 5) options.add(minute)
  options.add(selectedMinute)
  return Array.from(options).sort((a, b) => a - b)
}

function TimeColumn({
  label,
  values,
  value,
  format,
  onChange,
}: {
  label: string
  values: number[]
  value: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 px-1 text-center text-[11px] font-medium text-muted-foreground">{label}</p>
      <ScrollArea className="h-56 rounded-lg bg-muted/40">
        <div className="flex flex-col gap-1 p-1.5">
          {values.map((option) => {
            const selected = option === value
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  'flex h-10 items-center justify-center rounded-md text-sm font-medium tabular-nums transition-colors',
                  selected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground active:bg-background/70',
                )}
              >
                {format(option)}
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

export function AlarmTimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const parsed = useMemo(() => parseTime(value), [value])
  const [open, setOpen] = useState(false)
  const [draftHour, setDraftHour] = useState(parsed.hour)
  const [draftMinute, setDraftMinute] = useState(parsed.minute)

  const display = formatTime(parsed.hour, parsed.minute)
  const minutes = useMemo(() => minuteOptions(draftMinute), [draftMinute])

  const openPicker = () => {
    setDraftHour(parsed.hour)
    setDraftMinute(parsed.minute)
    setOpen(true)
  }

  const commit = () => {
    onChange(formatTime(draftHour, draftMinute))
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-full bg-muted px-3 text-sm font-semibold tabular-nums text-foreground transition-colors active:bg-muted/70 disabled:opacity-50"
        aria-label="设置学习提醒时间"
      >
        <AlarmClock className="size-4 text-muted-foreground" />
        {display}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[90vw] max-w-xs rounded-2xl p-5">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-base">学习提醒时间</DialogTitle>
            <DialogDescription>
              {meridiemLabel(draftHour)} {formatTime(draftHour, draftMinute)} 提醒未完成学习
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-background">
            <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-muted/35 text-4xl font-semibold tabular-nums">
              {formatTime(draftHour, draftMinute)}
            </div>
            <div className="flex gap-3">
              <TimeColumn
                label="小时"
                values={Array.from({ length: 24 }, (_, index) => index)}
                value={draftHour}
                format={(option) => String(option).padStart(2, '0')}
                onChange={setDraftHour}
              />
              <TimeColumn
                label="分钟"
                values={minutes}
                value={draftMinute}
                format={(option) => String(option).padStart(2, '0')}
                onChange={setDraftMinute}
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={commit}>
              <Check data-icon="inline-start" />
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
