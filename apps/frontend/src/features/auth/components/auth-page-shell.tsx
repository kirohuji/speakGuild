import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

interface AuthPageShellProps {
  children: ReactNode
  description?: string
  backLabel?: string
  onBack?: () => void
  footer?: ReactNode
}

export function AuthPageShell({
  children,
  description,
  backLabel,
  onBack,
  footer,
}: AuthPageShellProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
      <div className="relative mx-auto flex min-h-[calc(100dvh-1.75rem)] w-full max-w-md flex-col justify-center">
        {onBack && backLabel ? (
          <div className="mb-3 flex min-h-9 items-center">
            <button
              type="button"
              onClick={onBack}
              className="press-feedback inline-flex min-h-10 items-center gap-1.5 rounded-full bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground ring-1 ring-border/50 backdrop-blur-xl transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {backLabel}
            </button>
          </div>
        ) : null}

        <div className="mb-4 text-center">
          <img src="/logo.png" alt="ManYu" className="mx-auto h-16 w-auto dark:invert" />
          {description ? (
            <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="rounded-3xl bg-card/92 p-4 shadow-[0_12px_36px_rgba(0,46,95,0.09)] ring-1 ring-foreground/20 backdrop-blur-xl sm:p-5">
          {children}
        </div>

        {footer ? <div className="mt-3 text-center text-xs leading-5 text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  )
}

export const authInputClassName =
  'h-11 rounded-xl border-foreground/20 bg-background/75 px-3.5 shadow-sm transition-colors focus-visible:bg-background'

export const authLabelClassName =
  'text-xs font-semibold text-muted-foreground'
