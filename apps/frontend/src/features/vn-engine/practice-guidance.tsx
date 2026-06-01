import { Lightbulb, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

export interface VnTurnGuidance {
  objective?: string
  hint?: string
}

export function TurnGuidanceCard({
  guidance,
  className,
}: {
  guidance?: VnTurnGuidance
  className?: string
}) {
  const { t } = useTranslation()

  if (!guidance?.objective && !guidance?.hint) return null

  return (
    <div className={cn('ml-auto w-fit max-w-[92%] overflow-hidden rounded-xl border border-primary/15 bg-background/88 text-left shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl mb-8 mr-[-24px]', className)}>
      {guidance.objective && (
        <div className="flex items-start gap-2 px-3 py-2">
          <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="text-xs leading-5 text-foreground/85">
            <span className="mr-1.5 font-semibold text-primary">{t('practiceVn.objective')}</span>
            {guidance.objective}
          </p>
        </div>
      )}
      {guidance.hint && (
        <div className={cn('flex items-start gap-2 px-3 py-2', guidance.objective && 'border-t border-border/45 bg-muted/30')}>
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="text-xs leading-5 text-foreground/75">
            <span className="mr-1.5 font-semibold text-amber-700 dark:text-amber-200">{t('practiceVn.hint')}</span>
            {guidance.hint}
          </p>
        </div>
      )}
    </div>
  )
}
