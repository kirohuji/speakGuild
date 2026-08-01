import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { LucideIcon } from 'lucide-react'
import type { LearningUnitSummary } from '../api/learning-api'

interface Props {
  unit: LearningUnitSummary & { categoryName?: string }
  icon: LucideIcon
  className?: string
}

export function UnitCover({ unit, icon: Icon, className }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const showCover = unit.coverImage && !imgFailed

  return (
    <div
      className={cn(
        'relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40',
        (!unit.isUnlocked || unit.isLocked) && 'grayscale',
        className,
      )}
    >
      {showCover ? (
        <img
          src={unit.coverImage!}
          alt={unit.title}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
          <Icon className="relative size-7" />
        </>
      )}
    </div>
  )
}
