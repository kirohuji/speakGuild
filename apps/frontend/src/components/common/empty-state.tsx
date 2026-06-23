import { type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          {icon && (
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              {icon}
            </div>
          )}
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {action && <CardContent>{action}</CardContent>}
      </Card>
    </div>
  )
}
