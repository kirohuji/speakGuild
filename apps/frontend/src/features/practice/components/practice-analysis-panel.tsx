import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Award,
  BookmarkPlus,
  CheckCircle2,
  Library,
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
      <Card className="overflow-hidden rounded-2xl border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-amber-500/[0.06] shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-20">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="size-7 animate-pulse text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{t('practiceVn.analyzing')}</p>
            <p className="mt-1 text-xs text-muted-foreground">正在整理本轮目标、表达和语言细节</p>
          </div>
          <Progress value={60} className="h-1.5 w-52" />
        </CardContent>
      </Card>
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
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/[0.12] via-background to-amber-500/[0.08] shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary">
                <Award className="size-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Practice Report</p>
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">本次练习复盘</h2>
              {analysis.summary && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              )}
            </div>
            <div
              className={cn(
                'flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border bg-background/70 shadow-sm',
                score >= 80
                  ? 'border-green-500/30 text-green-600'
                  : score >= 60
                    ? 'border-amber-500/30 text-amber-600'
                    : 'border-destructive/30 text-destructive',
              )}
            >
              <span className="text-3xl font-bold leading-none">{score}</span>
              <span className="mt-1 text-[10px] font-medium">{t('practiceVn.overallScore')}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <AnalysisMetric label="目标完成" value={`${completedObjectives.length}/${objectives.length}`} />
            <AnalysisMetric label="核心表达" value={`${usedChunks.length}/${chunks.length}`} />
            <AnalysisMetric label="语言提醒" value={`${grammarIssues.length}`} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/[0.04] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic2 className="size-4 text-emerald-600 dark:text-emerald-400" /> {t('practiceVn.retell')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-emerald-500/10 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t('practiceVn.retellPrompt')}</p>
            <p className="mt-1 text-sm font-medium leading-6 text-foreground">{retellPrompt}</p>
          </div>
          <Textarea
            value={retellText}
            onChange={(event) => setRetellText(event.target.value)}
            placeholder={t('practiceVn.retellPlaceholder')}
            className="min-h-24 resize-none rounded-xl bg-background/80"
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
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" /> {t('practiceVn.objectivesStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {objectives.map((obj, index) => (
                <div
                  key={`${obj.objective}-${index}`}
                  className={cn(
                    'flex items-start gap-2 rounded-xl border p-3',
                    obj.completed ? 'border-green-500/10 bg-green-500/5' : 'border-border/50 bg-muted/40',
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
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="pb-3">
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
                  className={cn('rounded-full px-2.5 py-1 text-xs', !chunk.used && 'opacity-50')}
                >
                  {chunk.used ? '✓ ' : ''}{chunk.chunk}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {grammarIssues.length > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4" /> {t('practiceVn.languageCorrection')} ({grammarIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grammarIssues.map((issue, index) => (
                <div key={`${issue.original}-${index}`} className="rounded-xl border border-border/70 bg-muted/[0.18] p-3">
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
            <Card className="rounded-2xl border-green-500/20 bg-green-500/[0.03] shadow-sm">
              <CardHeader className="pb-3">
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
            <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.03] shadow-sm">
              <CardHeader className="pb-3">
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
        <Card className="rounded-2xl border-primary/15 bg-primary/[0.04] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4 text-primary" /> {t('practiceVn.nextStep')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">{analysis.nextStepSuggestion}</p>
          </CardContent>
        </Card>
      )}

      {onSaveExpression && usedChunks.length > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="pb-3">
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

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/50 bg-background/55 px-3 py-2.5 text-center shadow-sm backdrop-blur-sm">
      <p className="text-lg font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}
