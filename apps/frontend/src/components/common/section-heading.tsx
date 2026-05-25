import React from 'react'
import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  title: string
  description?: string
  badge?: string | number
  className?: string
  action?: React.ReactNode
}

export function SectionHeading({ title, description, badge, className, action }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          {badge !== undefined && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
