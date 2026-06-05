import { cn } from '@/lib/cn'
import type { LucideIcon } from 'lucide-react'
import type { LearningUnitSummary } from '../api/learning-api'

interface Props {
  unit: LearningUnitSummary & { categoryName?: string }
  icon: LucideIcon
  className?: string
}

export function UnitCover({ unit, icon: Icon, className }: Props) {
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
