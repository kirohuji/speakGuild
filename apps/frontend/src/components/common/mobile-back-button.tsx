import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

type MobileBackButtonProps = {
  onClick: () => void
  label: string
  className?: string
}

/** Shared mobile detail-page back affordance. */
export function MobileBackButton({ onClick, label, className }: MobileBackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70 active:bg-muted/90',
        className,
      )}
    >
      <ChevronLeft className="size-[22px]" aria-hidden="true" />
    </button>
  )
}
