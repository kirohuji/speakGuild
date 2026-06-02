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
    <div className={cn('mb-8 ml-auto mr-[-24px] w-fit max-w-[92%] overflow-hidden rounded-xl border border-border/55 bg-background/90 text-left text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-2xl', className)}>
      {guidance.objective && (
        <div className="flex items-start gap-2 bg-primary/[0.10] px-3 py-2">
          <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="text-xs leading-5 text-foreground/85">
            <span className="mr-1.5 font-semibold text-primary">{t('practiceVn.objective')}</span>
            {guidance.objective}
          </p>
        </div>
      )}
      {guidance.hint && (
        <div className={cn('flex items-start gap-2 bg-accent/[0.10] px-3 py-2', guidance.objective && 'border-t border-accent/25')}>
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <p className="text-xs leading-5 text-foreground/75">
            <span className="mr-1.5 font-semibold text-accent">{t('practiceVn.hint')}</span>
            {guidance.hint}
          </p>
        </div>
      )}
    </div>
  )
}
