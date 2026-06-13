import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── iOS 风格行组件 ──────────────────────────────────────────────────────────
export function IosRow({
  iconBg,
  icon: Icon,
  label,
  subtitle,
  value,
  last = false,
  onTap,
  right,
}: {
  iconBg?: string
  icon?: React.ElementType
  label: string
  subtitle?: string
  value?: string
  last?: boolean
  onTap?: () => void
  right?: React.ReactNode
}) {
  const inner = (
    <div className={cn(
      'flex min-h-[52px] items-center gap-3 px-4 py-3 transition-colors',
      onTap && 'active:bg-muted/60',
      !last && 'border-b border-border/50'
    )}>
      {Icon && iconBg && (
        <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]', iconBg)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right ?? (
        <div className="flex items-center gap-1 text-muted-foreground">
          {value && <span className="text-sm">{value}</span>}
          {onTap && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
        </div>
      )}
    </div>
  )

  return onTap ? (
    <button type="button" onClick={onTap} className="w-full text-left">
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
  )
}

export function IosSection({ header, children }: { header?: string; children: React.ReactNode }) {
  return (
    <div>
      {header && (
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {header}
        </p>
      )}
      <div className="overflow-hidden rounded-lg bg-muted/30">
        {children}
      </div>
    </div>
  )
}
