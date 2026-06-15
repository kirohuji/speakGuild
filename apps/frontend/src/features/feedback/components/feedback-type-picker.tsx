import { Bug, Lightbulb, MessageSquare, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

export const FEEDBACK_TYPE_OPTIONS: Array<{
  value: string
  labelKey: string
  label: string
  Icon: LucideIcon
}> = [
  { value: 'bug', label: 'Bug Report', labelKey: 'feedback.typeBug', Icon: Bug },
  { value: 'suggestion', label: 'Suggestion', labelKey: 'feedback.typeSuggestion', Icon: Lightbulb },
  { value: 'other', label: 'Other', labelKey: 'feedback.typeOther', Icon: MessageSquare },
]

interface FeedbackTypePickerProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function FeedbackTypePicker({ value, onValueChange, className }: FeedbackTypePickerProps) {
  const { t } = useTranslation()

  return (
    <div role="radiogroup" className={cn('grid grid-cols-3 gap-2', className)}>
      {FEEDBACK_TYPE_OPTIONS.map(({ value: optionValue, labelKey, label, Icon }) => {
        const selected = value === optionValue

        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(optionValue)}
            className={cn(
              'flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="leading-tight">{t(labelKey, { defaultValue: label })}</span>
          </button>
        )
      })}
    </div>
  )
}
