import * as React from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('group/calendar bg-background p-3 [--cell-size:2.5rem]', className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-full', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn('absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1', defaultClassNames.nav),
        button_previous: cn(buttonVariants({ variant: buttonVariant }), 'size-[--cell-size] select-none p-0 aria-disabled:opacity-50', defaultClassNames.button_previous),
        button_next: cn(buttonVariants({ variant: buttonVariant }), 'size-[--cell-size] select-none p-0 aria-disabled:opacity-50', defaultClassNames.button_next),
        month_caption: cn('flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]', defaultClassNames.month_caption),
        caption_label: cn('select-none text-sm font-semibold', defaultClassNames.caption_label),
        month_grid: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn('flex-1 select-none text-center text-xs font-normal text-muted-foreground', defaultClassNames.weekday),
        week: cn('mt-1.5 flex w-full', defaultClassNames.week),
        day: cn('group/day relative aspect-square h-full w-full select-none p-0 text-center', defaultClassNames.day),
        today: cn('rounded-xl bg-muted text-foreground', defaultClassNames.today),
        outside: cn('text-muted-foreground/35', defaultClassNames.outside),
        disabled: cn('text-muted-foreground opacity-35', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rootProps }) => (
          <div ref={rootRef} className={cn(className)} {...rootProps} />
        ),
        Chevron: ({ className, orientation, ...chevronProps }) => {
          if (orientation === 'left') return <ChevronLeft className={cn('size-4', className)} {...chevronProps} />
          if (orientation === 'right') return <ChevronRight className={cn('size-4', className)} {...chevronProps} />
          return <ChevronDown className={cn('size-4', className)} {...chevronProps} />
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      className={cn('flex aspect-square h-auto w-full min-w-[--cell-size] items-center justify-center rounded-xl p-0 text-xs font-normal', className)}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
