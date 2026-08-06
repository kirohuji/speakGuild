import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" data-icon="inline-start" />
          </div>
          <CardTitle className="text-lg">{title ?? t('common.loadFailed')}</CardTitle>
          <CardDescription>{description ?? t('common.networkRetryHint')}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 size-4" data-icon="inline-start" />
              {t('common.retry')}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
