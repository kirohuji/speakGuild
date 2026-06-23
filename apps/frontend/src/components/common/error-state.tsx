import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/cn'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = '加载失败',
  description = '请检查网络连接后重试',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" data-icon="inline-start" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 size-4" data-icon="inline-start" />
              重试
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
