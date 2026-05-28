import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  Library,
  Mic2,
  RotateCcw,
  Sparkles,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
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
  onBack: () => void
  onFinish: () => void
  onRestart?: () => void
  onSaveExpression?: (data: {
    type: string
    original?: string
    corrected?: string
    chunkText?: string
    sceneName?: string
  }) => Promise<void>
  topicTitle?: string
}



export function PracticeAnalysisPanel({
  analysis,
  loading,
  onBack,
  onFinish,
  onRestart,
  onSaveExpression,
  topicTitle,
}: PracticeAnalysisPanelProps) {
  const { t } = useTranslation()
  const [retellText, setRetellText] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const retellWordCount = useMemo(() => {
    return retellText.trim().split(/\s+/).filter(Boolean).length
  }, [retellText])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <Sparkles className="size-10 animate-pulse text-primary" />
          <p className="text-foreground">{t('practiceVn.analyzing')}</p>
          <Progress value={60} className="h-1.5 w-48" />
        </CardContent>
      </Card>
    )
  }

  if (!analysis) return null

  const score = analysis.overallScore ?? 0
  const objectives = analysis.objectiveAnalysis ?? []
  const chunks = analysis.chunkUsageAnalysis ?? []
  const usedChunks = chunks.filter((chunk) => chunk.used)
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
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <div
            className={cn(
              'flex size-20 items-center justify-center rounded-full border-4 text-3xl font-bold',
              score >= 80
                ? 'border-green-500 text-green-600'
                : score >= 60
                  ? 'border-amber-500 text-amber-600'
                  : 'border-destructive text-destructive',
            )}
          >
            {score}
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t('practiceVn.overallScore')}</p>
          {analysis.summary && (
            <p className="max-w-md text-center text-sm leading-6 text-foreground">{analysis.summary}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic2 className="size-4 text-emerald-600 dark:text-emerald-400" /> {t('practiceVn.retell')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t('practiceVn.retellPrompt')}</p>
            <p className="mt-1 text-sm font-medium leading-6 text-foreground">{retellPrompt}</p>
          </div>
          <Textarea
            value={retellText}
            onChange={(event) => setRetellText(event.target.value)}
            placeholder={t('practiceVn.retellPlaceholder')}
            className="min-h-24 resize-none bg-background/80"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{retellWordCount} words</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onBack}>
                {t('practiceVn.backToScene')}
              </Button>
              {onRestart && (
                <Button type="button" size="sm" onClick={onRestart}>
                  <RotateCcw className="mr-1 size-3.5" /> {t('practiceVn.practiceAgain')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {objectives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> {t('practiceVn.objectivesStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {objectives.map((obj, index) => (
                <div
                  key={`${obj.objective}-${index}`}
                  className={cn(
                    'flex items-start gap-2 rounded-lg p-2.5',
                    obj.completed ? 'bg-green-500/5' : 'bg-muted/50',
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
          </CardContent>
        </Card>
      )}

      {chunks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> {t('practiceVn.coreExprUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chunks.map((chunk, index) => (
                <Badge
                  key={`${chunk.chunk}-${index}`}
                  variant={chunk.used ? 'default' : 'outline'}
                  className={cn('text-xs', !chunk.used && 'opacity-50')}
                >
                  {chunk.used ? '✓ ' : ''}{chunk.chunk}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {grammarIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4" /> {t('practiceVn.languageCorrection')} ({grammarIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grammarIssues.map((issue, index) => (
                <div key={`${issue.original}-${index}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t(`practiceVn.${issue.type}`)}
                    </Badge>
                    {issue.round && <span className="text-xs text-muted-foreground">{t('practiceVn.round')} {issue.round}</span>}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-destructive line-through">{issue.original}</p>
                    <p className="text-sm text-green-600 dark:text-green-400">→ {issue.correction}</p>
                  </div>
                  {onSaveExpression && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8 gap-1.5 text-xs"
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
          </CardContent>
        </Card>
      )}

      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <Card className="border-green-500/20">
              <CardHeader>
                <CardTitle className="text-sm text-green-600 dark:text-green-400">{t('practiceVn.strengths')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {strengths.map((item, index) => (
                    <li key={`${item}-${index}`} className="text-sm leading-6 text-foreground">• {item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {improvements.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-sm text-amber-600 dark:text-amber-400">{t('practiceVn.improvements')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {improvements.map((item, index) => (
                    <li key={`${item}-${index}`} className="text-sm leading-6 text-foreground">• {item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {analysis.nextStepSuggestion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('practiceVn.nextStep')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">{analysis.nextStepSuggestion}</p>
          </CardContent>
        </Card>
      )}

      {onSaveExpression && usedChunks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookmarkPlus className="size-4" /> {t('practiceVn.saveUsedExpr')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {usedChunks.map((chunk, index) => (
                <Button
                  key={`${chunk.chunk}-${index}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" onClick={onRestart ?? onBack}>
          <RotateCcw className="mr-1 size-4" /> {t('practiceVn.restart')}
        </Button>
        <Button type="button" onClick={onFinish}>
          <Library className="mr-1 size-4" /> {t('practiceVn.exprLibrary')}
        </Button>
      </div>
    </div>
  )
}
