import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronDown, Lightbulb, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { TurnFeedback } from '../types/practice-session'

export function PracticeTurnFeedback({
  feedback,
  onContinue,
  tone = 'vn',
}: {
  feedback: TurnFeedback
  onContinue: () => void
  tone?: 'vn' | 'chat'
}) {
  const { t } = useTranslation()
  const isLoading = feedback.status === 'loading'
  const isError = feedback.status === 'error'
  const isPassed = Boolean(feedback.result?.passed)
  const isRetry = Boolean(feedback.result?.retryRequired)
  const correction = feedback.result?.correction
  const upgraded = feedback.result?.upgraded
  const retryPrompt = feedback.result?.retryPrompt
  const grammarIssues = feedback.result?.grammarIssues ?? []
  const suggestedChunks = feedback.targetChunks.filter((chunk) => !feedback.result?.chunksUsed.includes(chunk))
  const example = suggestedChunks.length ? suggestedChunks.join(' ') : feedback.targetChunks.join(' ')
  const isChat = tone === 'chat'

  const icon = isLoading
    ? <Loader2 className="size-3.5 animate-spin text-primary" />
    : isPassed && !isRetry
      ? <CheckCircle2 className="size-3.5 text-green-500" />
      : isRetry
        ? <CheckCircle2 className="size-3.5 text-blue-500" />
        : <Lightbulb className="size-3.5 text-amber-500" />

  const title = isLoading
    ? t('practiceVn.feedbackEvaluating')
    : isPassed && !isRetry
      ? t('practiceVn.feedbackPassed')
      : isRetry
        ? '请重说一遍'
        : isError
          ? t('practiceVn.feedbackUnavailable')
          : t('practiceVn.feedbackRetry')

  return (
    <div className={cn(
      isChat
        ? cn('rounded-lg bg-muted/65 text-foreground ring-1 ring-border/45', isPassed && !isRetry ? 'px-2.5 py-1.5' : 'px-3 py-2.5')
        : cn('border-t border-border/45 bg-background/72 px-3 pb-safe text-foreground backdrop-blur-xl', isPassed && !isRetry ? 'py-1.5' : 'py-2'),
    )}>
      <div className="mb-2 flex items-center gap-2">
        <div className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', isChat ? 'bg-background/70' : 'bg-muted/70')}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{title}</p>
            {!isLoading && (!isPassed || isRetry) && (
              <button type="button" onClick={onContinue} className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
                {t('practiceVn.continueAnyway')}
              </button>
            )}
          </div>
          {!isLoading && (
            <p className="mt-1 text-[11px] leading-4 text-foreground/75">
              {isError ? feedback.error : feedback.result?.feedback || t('practiceVn.feedbackContinue')}
            </p>
          )}

          {/* Retry correction: reuse existing card style */}
          {!isLoading && isRetry && (correction || upgraded) && (
            <div className="mt-2 space-y-1.5">
              {correction && (
                <div className="rounded bg-blue-500/10 px-2 py-1.5">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">{correction}</p>
                </div>
              )}
              {upgraded && (
                <div className="rounded bg-blue-500/5 px-2 py-1.5">
                  <p className="text-[10px] text-blue-500/70 dark:text-blue-300/70">{upgraded}</p>
                </div>
              )}
              {retryPrompt && (
                <p className="text-[11px] font-medium text-foreground/85">{retryPrompt}</p>
              )}
            </div>
          )}

          {/* Grammar issues */}
          {!isLoading && grammarIssues.length > 0 && (
            <div className="mt-2 space-y-1">
              {grammarIssues.slice(0, 3).map((issue, idx) => (
                <div key={idx} className="rounded bg-muted/60 px-2 py-1">
                  <p className="text-[10px] text-muted-foreground line-through">{issue.original}</p>
                  <p className="text-[10px] text-foreground/75">→ {issue.correction}</p>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !isPassed && !isRetry && suggestedChunks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {suggestedChunks.map((chunk) => (
                <span key={chunk} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">{chunk}</span>
              ))}
            </div>
          )}
          {!isLoading && !isPassed && !isRetry && (
            <details className="mt-2 text-[11px] text-foreground/75">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground/75 hover:text-foreground">
                <ChevronDown className="size-3" />
                {t('practiceVn.viewExplanation')}
              </summary>
              <div className="mt-1.5 space-y-1 rounded bg-background/90 p-2 leading-4 text-foreground/80 ring-1 ring-border/35">
                <p><span className="text-muted-foreground">{t('practiceVn.objective')}：</span>{feedback.objective || t('practiceVn.defaultObjective')}</p>
                {feedback.hint && <p><span className="text-muted-foreground">{t('practiceVn.hint')}：</span>{feedback.hint}</p>}
                <p><span className="text-muted-foreground">{t('practiceVn.reference')}：</span>{example || t('practiceVn.defaultReference')}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

