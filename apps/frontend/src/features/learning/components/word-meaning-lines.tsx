import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { parseWordMeaningGroups } from '@/features/learning/lib/word-meaning'

const POS_COLORS: Record<string, string> = {
  noun: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  verb: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  adj: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  adv: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  pronoun: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  preposition: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  conjunction: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  interjection: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  determiner: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  article: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  phr: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  num: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function WordMeaningInline({ meaning, className }: { meaning?: string | null; className?: string }) {
  const { t } = useTranslation()
  const text = meaning?.trim() ?? ''
  const groups = parseWordMeaningGroups(text)
  if (!text) return null
  if (!groups) {
    return <span className={cn('mt-0.5 line-clamp-1 block text-xs text-muted-foreground', className)}>{text}</span>
  }

  return (
    <span className={cn('mt-0.5 flex items-center overflow-hidden whitespace-nowrap text-xs text-muted-foreground', className)}>
      {groups.map((group, index) => (
        <span key={group.posKey} className={cn('inline-flex min-w-0 items-center', index > 0 && 'ml-2', index < groups.length - 1 && 'shrink-0')}>
          <span className={cn('mr-1.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-bold leading-none', POS_COLORS[group.posKey] ?? POS_COLORS.phr)}>
            {t(`insight.pos.${group.posKey}`, { defaultValue: group.fallback })}
          </span>
          <span className={index === groups.length - 1 ? 'truncate' : undefined}>{group.glosses.join('；')}</span>
        </span>
      ))}
    </span>
  )
}

export function WordMeaningLines({
  meaning,
  align = 'start',
}: {
  meaning?: string | null
  align?: 'start' | 'center'
}) {
  const { t } = useTranslation()
  const text = meaning?.trim() ?? ''
  const groups = parseWordMeaningGroups(text)
  const centered = align === 'center'
  if (!text) return null
  if (!groups) {
    return (
      <p className={cn(
        'leading-relaxed text-muted-foreground',
        centered ? 'mt-5 text-base font-normal' : 'mt-1.5 text-sm',
        centered && 'text-center',
      )}>
        {text}
      </p>
    )
  }

  return (
    <div className={cn(centered ? 'mt-5 space-y-2' : 'mt-1.5 space-y-1.5', centered && 'mx-auto max-w-md')}>
      {groups.map((group) => (
        <div key={group.posKey} className={cn('flex items-start gap-2', centered && 'justify-center')}>
          <span className={cn('mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold', POS_COLORS[group.posKey] ?? POS_COLORS.phr)}>
            {t(`insight.pos.${group.posKey}`, { defaultValue: group.fallback })}
          </span>
          <p className={cn(
            'min-w-0 font-normal leading-6 text-muted-foreground',
            centered ? 'text-base' : 'text-sm',
            centered && 'text-left',
          )}>
            {group.glosses.join('；')}
          </p>
        </div>
      ))}
    </div>
  )
}
