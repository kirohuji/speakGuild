import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Award,
  BookmarkPlus,
  CheckCircle2,
  Mic2,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'

interface DialogueAnalysisResult {
  overallScore?: number
  summary?: string
  objectiveAnalysis?: Array<{
    objective: string
    completed: boolean
    comment?: string
  }>
  chunkUsageAnalysis?: Array<{
    chunk: string
    used: boolean
    context?: string
  }>
  grammarHighlights?: Array<{
    type: string
    original: string
    correction: string
    round?: number
  }>
  strengths?: string[]
  improvements?: string[]
  nextStepSuggestion?: string
}

interface PracticeAnalysisPanelProps {
  analysis: DialogueAnalysisResult | null
  loading: boolean
  onBack?: () => void
  onRestart?: () => void
  onSaveExpression?: (data: {
    type: string
    original?: string
    corrected?: string
    chunkText?: string
    sceneName?: string
  }) => Promise<void>
  topicTitle?: string
  readOnly?: boolean
}

const sectionClass = 'rounded-xl bg-muted/20 p-4'
const insetClass = 'rounded-lg bg-background/50 p-3'

export function PracticeAnalysisPanel({
  analysis,
  loading,
  onBack,
  onRestart,
  onSaveExpression,
  topicTitle,
  readOnly = false,
}: PracticeAnalysisPanelProps) {
  const { t } = useTranslation()
  const [retellText, setRetellText] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const retellWordCount = useMemo(() => {
    return retellText.trim().split(/\s+/).filter(Boolean).length
  }, [retellText])

  if (loading) {
    return (
      <section className={cn(sectionClass, 'flex flex-col items-center gap-4 py-16')}>
        <div className="flex size-12 items-center justify-center rounded-xl bg-background/50">
          <Sparkles className="size-6 animate-pulse text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">{t('practiceVn.analyzing')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('practiceVn.analysisDetail')}</p>
        </div>
        <Progress value={60} className="h-1.5 w-52" />
      </section>
    )
  }

  if (!analysis) return null

  const score = analysis.overallScore ?? 0
  const objectives = analysis.objectiveAnalysis ?? []
  const chunks = analysis.chunkUsageAnalysis ?? []
  const usedChunks = chunks.filter((chunk) => chunk.used)
  const completedObjectives = objectives.filter((objective) => objective.completed)
  const grammarIssues = analysis.grammarHighlights ?? []
  const strengths = analysis.strengths ?? []
  const improvements = analysis.improvements ?? []
  const primaryCorrection = grammarIssues.find((issue) => issue.original && issue.correction)
  const retellPrompt = primaryCorrection?.correction
    || usedChunks[0]?.chunk
    || analysis.nextStepSuggestion
    || topicTitle
    || ''

  const saveExpression = async (
    key: string,
    data: {
      type: string
      original?: string
      corrected?: string
      chunkText?: string
      sceneName?: string
    },
  ) => {
    if (!onSaveExpression) return
    setSavingKey(key)
    try {
      await onSaveExpression(data)
      toast.success(t('insight.savedToLibrary'))
    } catch {
      toast.error(t('insight.saveFailed'))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <section className={sectionClass}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-primary">
              <Award className="size-4" />
              <p className="text-xs font-semibold">{t('practiceSession.reviewTitle')}</p>
            </div>
            {analysis.summary && (
              <p className="mt-2 text-sm leading-6 text-foreground">{analysis.summary}</p>
            )}
          </div>
          <div
            className={cn(
              'flex size-[68px] shrink-0 flex-col items-center justify-center rounded-xl bg-background/50',
              score >= 80
                ? 'text-green-600'
                : score >= 60
                  ? 'text-amber-600'
                  : 'text-destructive',
            )}
          >
            <span className="text-2xl font-bold leading-none">{score}</span>
            <span className="mt-1 text-[10px] font-medium">{t('practiceVn.overallScore')}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <AnalysisMetric label={t('practiceVn.metricObjectives')} value={`${completedObjectives.length}/${objectives.length}`} />
          <AnalysisMetric label={t('practiceVn.metricChunks')} value={`${usedChunks.length}/${chunks.length}`} />
          <AnalysisMetric label={t('practiceVn.metricLanguage')} value={`${grammarIssues.length}`} />
        </div>
      </section>

      {!readOnly && (
        <section className={sectionClass}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Mic2 className="size-4 text-emerald-600 dark:text-emerald-400" /> {t('practiceVn.retell')}
          </h3>
          <div className="flex flex-col gap-3">
            <div className={insetClass}>
              <p className="text-xs text-muted-foreground">{t('practiceVn.retellPrompt')}</p>
              <p className="mt-1 text-sm font-medium leading-6 text-foreground">{retellPrompt}</p>
            </div>
            <Textarea
              value={retellText}
              onChange={(event) => setRetellText(event.target.value)}
              placeholder={t('practiceVn.retellPlaceholder')}
              className="min-h-24 resize-none rounded-lg border-0 bg-background/50 shadow-none"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{retellWordCount} words</span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" className="border-0 shadow-none" onClick={onBack}>
                  {t('practiceVn.backToScene')}
                </Button>
                {onRestart && (
                  <Button type="button" size="sm" onClick={onRestart}>
                    <RotateCcw className="mr-1 size-3.5" /> {t('practiceVn.practiceAgain')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {objectives.length > 0 && (
        <section className={sectionClass}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-primary" /> {t('practiceVn.objectivesStatus')}
          </h3>
          <div className="flex flex-col gap-2">
            {objectives.map((obj, index) => (
              <div
                key={`${obj.objective}-${index}`}
                className={cn(
                  'flex items-start gap-2',
                  insetClass,
                  !obj.completed && 'opacity-70',
                )}
              >
                {obj.completed ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className={cn('text-sm', obj.completed ? 'text-foreground' : 'text-muted-foreground')}>
                    {obj.objective}
                  </p>
                  {obj.comment && <p className="mt-0.5 text-xs text-muted-foreground">{obj.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {chunks.length > 0 && (
        <section className={sectionClass}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4" /> {t('practiceVn.coreExprUsage')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {chunks.map((chunk, index) => (
              <Badge
                key={`${chunk.chunk}-${index}`}
                variant={chunk.used ? 'default' : 'secondary'}
                className={cn('rounded-full border-0 px-2.5 py-1 text-xs shadow-none', !chunk.used && 'opacity-50')}
              >
                {chunk.used ? '✓ ' : ''}{chunk.chunk}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {grammarIssues.length > 0 && (
        <section className={sectionClass}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4" /> {t('practiceVn.languageCorrection')} ({grammarIssues.length})
          </h3>
          <div className="flex flex-col gap-3">
            {grammarIssues.map((issue, index) => (
              <div key={`${issue.original}-${index}`} className={insetClass}>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="border-0 text-xs shadow-none">
                    {t(`practiceVn.${issue.type}`)}
                  </Badge>
                  {issue.round && <span className="text-xs text-muted-foreground">{t('practiceVn.round')} {issue.round}</span>}
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <p className="text-sm text-destructive line-through">{issue.original}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">→ {issue.correction}</p>
                </div>
                {onSaveExpression && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3 h-8 gap-1.5 border-0 text-xs shadow-none"
                    disabled={savingKey === `correction:${index}`}
                    onClick={() => saveExpression(`correction:${index}`, {
                      type: 'error_sentence',
                      original: issue.original,
                      corrected: issue.correction,
                      sceneName: topicTitle,
                    })}
                  >
                    <BookmarkPlus className="size-3.5" />
                    {savingKey === `correction:${index}` ? t('practiceVn.saving') : t('practiceVn.saveThis')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {strengths.length > 0 && (
            <section className={sectionClass}>
              <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">{t('practiceVn.strengths')}</h3>
              <ul className="flex flex-col gap-1">
                {strengths.map((item, index) => (
                  <li key={`${item}-${index}`} className="text-sm leading-6 text-foreground">• {item}</li>
                ))}
              </ul>
            </section>
          )}

          {improvements.length > 0 && (
            <section className={sectionClass}>
              <h3 className="mb-2 text-sm font-semibold text-amber-600 dark:text-amber-400">{t('practiceVn.improvements')}</h3>
              <ul className="flex flex-col gap-1">
                {improvements.map((item, index) => (
                  <li key={`${item}-${index}`} className="text-sm leading-6 text-foreground">• {item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {analysis.nextStepSuggestion && (
        <section className="rounded-xl bg-primary/[0.06] p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-primary" /> {t('practiceVn.nextStep')}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">{analysis.nextStepSuggestion}</p>
        </section>
      )}

      {onSaveExpression && usedChunks.length > 0 && (
        <section className={sectionClass}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BookmarkPlus className="size-4" /> {t('practiceVn.saveUsedExpr')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {usedChunks.map((chunk, index) => (
              <Button
                key={`${chunk.chunk}-${index}`}
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 rounded-full border-0 px-3 text-xs shadow-none"
                disabled={savingKey === `chunk:${index}`}
                onClick={() => saveExpression(`chunk:${index}`, {
                  type: 'chunk',
                  chunkText: chunk.chunk,
                  sceneName: topicTitle,
                })}
              >
                <BookmarkPlus className="mr-1 size-3.5" />
                {chunk.chunk}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/50 px-2 py-2 text-center">
      <p className="text-base font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}
