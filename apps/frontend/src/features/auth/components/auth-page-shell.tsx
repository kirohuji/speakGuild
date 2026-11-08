import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface AuthPageShellProps {
  children: ReactNode
  description?: string
  footer?: ReactNode
  className?: string
}

export function AuthPageShell({
  children,
  description,
  footer,
  className,
}: AuthPageShellProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
      <div className={cn('relative mx-auto flex min-h-[calc(100dvh-1.75rem)] w-full max-w-md flex-col justify-center', className)}>
        <div className="mb-4 text-center">
          <img src="/logo.png" alt="ManYuDing" className="mx-auto h-16 w-auto dark:invert" />
          {description ? (
            <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="rounded-3xl bg-muted/30 p-4 shadow-none ring-0 sm:p-5">
          {children}
        </div>

        {footer ? <div className="mt-3 text-center text-xs leading-5 text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  )
}

export const authInputClassName =
  'h-11 rounded-xl border border-border bg-background px-3.5 shadow-none'

export const authLabelClassName =
  'text-xs font-semibold text-muted-foreground'
