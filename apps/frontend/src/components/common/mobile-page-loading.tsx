import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'

type MobilePageLoadingProps = {
  loading?: boolean
  className?: string
  rows?: number
  minHeightClassName?: string
}

export function MobileTopProgress({ loading = true }: { loading?: boolean }) {
  const visible = useDelayedLoading(loading, 300)
  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-transparent">
      <div className="h-full w-1/2 animate-[mobile-progress_1.1s_ease-in-out_infinite] rounded-full bg-primary/80 shadow-[0_0_12px_hsl(var(--primary)/0.35)]" />
    </div>
  )
}

export function MobilePageLoading({
  loading = true,
  className,
  rows = 4,
  minHeightClassName = 'min-h-[60vh]',
}: MobilePageLoadingProps) {
  const visible = useDelayedLoading(loading, 300)
  if (!visible) return null

  return (
    <div className={cn('relative flex items-start justify-center px-4 py-6', minHeightClassName, className)}>
      <MobileTopProgress loading={loading} />
      <div className="w-full max-w-2xl space-y-3">
        <Skeleton className="h-8 w-2/5 rounded-md" />
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border/60 bg-card/60 p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 flex-shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
