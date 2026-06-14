import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'

type MobilePageLoadingProps = {
  loading?: boolean
  className?: string
  rows?: number
  minHeightClassName?: string
}

type MobileListSkeletonProps = {
  rows?: number
  className?: string
  showHeader?: boolean
}

type MobileGridSkeletonProps = {
  items?: number
  className?: string
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
      <div className="w-full max-w-2xl">
        <MobileListSkeleton rows={rows} />
      </div>
    </div>
  )
}

export function MobileListSkeleton({ rows = 4, className, showHeader = true }: MobileListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {showHeader && (
        <div className="px-1">
          <Skeleton className="h-5 w-28 rounded-full bg-muted/70" />
        </div>
      )}
      <div className="overflow-hidden rounded-lg bg-muted/30">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'flex min-h-[52px] items-center gap-3 px-4 py-3',
              index < rows - 1 && 'border-b border-border/50'
            )}
          >
            <Skeleton className="size-8 shrink-0 rounded-[10px] bg-background/80" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5 rounded-full bg-background/80" />
              <Skeleton className="h-3 w-3/4 rounded-full bg-background/70" />
            </div>
            <Skeleton className="h-3.5 w-10 rounded-full bg-background/70" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function MobileGridSkeleton({ items = 6, className }: MobileGridSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="rounded-lg bg-muted/30 p-4">
          <Skeleton className="mx-auto mb-3 size-12 rounded-2xl bg-background/80" />
          <Skeleton className="mx-auto h-3.5 w-20 rounded-full bg-background/80" />
          <Skeleton className="mx-auto mt-2 h-3 w-24 rounded-full bg-background/70" />
          <Skeleton className="mx-auto mt-3 h-4 w-12 rounded-full bg-background/70" />
        </div>
      ))}
    </div>
  )
}
