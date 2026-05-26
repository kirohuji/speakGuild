import { CheckCircle2, XCircle, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
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
  topicTitle?: string
}

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-destructive'
}

const GRAMMAR_TYPE_LABELS: Record<string, string> = {
  grammar: '语法',
  collocation: '搭配',
  chinglish: '中式英语',
  unnatural: '不自然',
}

export function PracticeAnalysisPanel({
  analysis,
  loading,
  topicTitle,
}: PracticeAnalysisPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <Sparkles className="size-10 animate-pulse text-primary" />
          <p className="text-foreground">AI 正在分析你的对话表现...</p>
          <Progress value={60} className="w-48 h-1.5" />
        </CardContent>
      </Card>
    )
  }

  if (!analysis) return null

  const score = analysis.overallScore ?? 0
  const objectives = analysis.objectiveAnalysis ?? []
  const chunks = analysis.chunkUsageAnalysis ?? []
  const grammarIssues = analysis.grammarHighlights ?? []
  const strengths = analysis.strengths ?? []
  const improvements = analysis.improvements ?? []

  return (
    <div className="space-y-4">
      {/* 总体评分 */}
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
          <p className="text-sm font-medium text-muted-foreground">综合评分</p>
          {analysis.summary && (
            <p className="max-w-md text-center text-sm text-foreground">{analysis.summary}</p>
          )}
        </CardContent>
      </Card>

      {/* 目标完成情况 */}
      {objectives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> 任务目标完成情况
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {objectives.map((obj, i) => (
                <div
                  key={i}
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
                    <p className={cn(
                      'text-sm',
                      obj.completed ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {obj.objective}
                    </p>
                    {obj.comment && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{obj.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chunk 使用分析 */}
      {chunks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> 核心表达使用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chunks.map((c, i) => (
                <Badge
                  key={i}
                  variant={c.used ? 'default' : 'outline'}
                  className={cn('text-xs', !c.used && 'opacity-50')}
                >
                  {c.used ? '✓ ' : ''}{c.chunk}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 语法纠正 */}
      {grammarIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4" /> 语言纠正 ({grammarIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grammarIssues.map((issue, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {GRAMMAR_TYPE_LABELS[issue.type] ?? issue.type}
                    </Badge>
                    {issue.round && (
                      <span className="text-xs text-muted-foreground">轮次 {issue.round}</span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-destructive line-through">{issue.original}</p>
                    <p className="text-sm text-green-600 dark:text-green-400">→ {issue.correction}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 优势 & 改进 */}
      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <Card className="border-green-500/20">
              <CardHeader>
                <CardTitle className="text-sm text-green-600 dark:text-green-400">👍 做得好的地方</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {strengths.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">• {s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {improvements.length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-sm text-amber-600 dark:text-amber-400">📝 可以改进</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {improvements.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">• {s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 下一步建议 */}
      {analysis.nextStepSuggestion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">下一步学习建议</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{analysis.nextStepSuggestion}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
