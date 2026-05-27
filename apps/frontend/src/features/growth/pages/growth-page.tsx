import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Star, BarChart3, Target, BookOpen, Award, ChevronRight,
  Mic, Zap, Clock, AlertTriangle, Lightbulb, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { levelApi } from '@/features/practice/api/english-practice-api'
import { cn } from '@/lib/cn'

// ─── Types ──────────────────────────────────────────────────

interface LevelOverview {
  userLevel: number; totalXp: number; xpForNextLevel: number
  outputLevel: string; outputLevelDescription: string
  outputLevelDetail: Record<string, number> | null
  totalChunks: number; masteredChunks: number
  sceneProgresses: { sceneId: string; scene: { id: string; title: string }; mastery: number; readiness: number }[]
}

interface WeeklyStats {
  recordings: number; topicsCompleted: number; chunksMastered: number
  totalPracticeMinutes: number; streakDays: number
}

interface CommonError {
  error: string; count: number; example: string; type: string
}

interface RecommendedPath {
  currentLevel: string; description: string
  overallAdvice: string
  recommendedScenes: { sceneId: string; sceneTitle: string; readiness: number; mastery: number }[]
}

// ─── Mini Radar Chart (SVG) ────────────────────────────────

function RadarChart({ dimensions }: { dimensions: Record<string, number> }) {
  const labels: Record<string, string> = {
    answerLength: '长度',
    grammarAccuracy: '语法',
    chunkUsage: 'Chunk',
    logicCompleteness: '逻辑',
    naturalness: '自然度',
    fluency: '流利度',
  }

  const data = Object.entries(labels).map(([key, label]) => ({
    label,
    value: (dimensions[key] ?? 5) / 10,
  }))

  const size = 180, cx = size / 2, cy = size / 2, radius = 70
  const angleStep = (2 * Math.PI) / data.length

  const getPoint = (value: number, index: number) => {
    const angle = angleStep * index - Math.PI / 2
    const r = radius * value
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  const points = data.map((d, i) => getPoint(d.value, i))
  const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Grid levels */}
      {[0.2, 0.4, 0.6, 0.8, 1.0].map((lvl) => {
        const pts = data.map((_, i) => getPoint(lvl, i))
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
        return <path key={lvl} d={path} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} />
      })}
      {/* Axes */}
      {data.map((_, i) => {
        const p = getPoint(1, i)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth={0.5} />
      })}
      {/* Data polygon */}
      <path d={polygonPath} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={1.5} />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />)}
      {/* Labels */}
      {data.map((d, i) => {
        const lp = getPoint(1.25, i)
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            className="fill-muted-foreground" fontSize={9}>{d.label}</text>
        )
      })}
    </svg>
  )
}

// ─── Main Page ──────────────────────────────────────────────

export function GrowthPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<LevelOverview | null>(null)
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null)
  const [errors, setErrors] = useState<CommonError[]>([])
  const [recommended, setRecommended] = useState<RecommendedPath | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      levelApi.getOverview().then((r: any) => setData(r?.data ?? r)),
      levelApi.getWeeklyStats().then((r: any) => setWeekly(r?.data ?? r)),
      levelApi.getCommonErrors().then((r: any) => setErrors(Array.isArray(r) ? r : r?.data ?? [])),
      levelApi.getRecommendedPath().then((r: any) => setRecommended(r?.data ?? r)),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  const xpForCurrentLevel = data ? ((data.userLevel - 1) * 100) : 0
  const xpProgress = data ? Math.min(100, Math.round(((data.totalXp - xpForCurrentLevel) / data.xpForNextLevel) * 100)) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('growth.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('growth.subtitle')}</p>
      </div>

      {!data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Target className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">{t('growth.emptyHint')}</p>
            <Link to="/practice"><Badge variant="secondary">{t('common.goTo')}</Badge></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* User Level */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
                {data.userLevel}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge>Lv.{data.userLevel}</Badge>
                  <span className="text-sm text-muted-foreground">{t('growth.totalXp')}{data.totalXp}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('growth.nextLevel')}</span><span>{data.totalXp - xpForCurrentLevel} / {data.xpForNextLevel} XP</span>
                  </div>
                  <Progress value={xpProgress} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Output Level + Radar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" /> {t('growth.outputAbility')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">{data.outputLevel}</p>
                  <p className="text-sm text-muted-foreground">{data.outputLevelDescription}</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <div key={l} className={cn('size-3 rounded-full',
                      l <= parseInt(data.outputLevel.replace('L', '')) ? 'bg-primary' : 'bg-muted')} />
                  ))}
                </div>
              </div>
              {data.outputLevelDetail && <RadarChart dimensions={data.outputLevelDetail} />}
              {data.outputLevelDetail && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {Object.entries(data.outputLevelDetail).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{{answerLength:t('growth.answerLength'),grammarAccuracy:t('growth.grammarAccuracy'),chunkUsage:t('growth.chunkUsage'),logicCompleteness:t('growth.logicCompleteness'),naturalness:t('growth.naturalness'),fluency:t('growth.fluency')}[key]??key}</span>
                        <span className="font-medium">{val}/10</span>
                      </div>
                      <Progress value={(val as number) * 10} className="h-1.5" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Stats */}
          {weekly && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="size-4 text-primary" /> {t('growth.weeklyStats')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <Mic className="size-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold text-foreground">{weekly.recordings}</p>
                    <p className="text-[11px] text-muted-foreground">{t('growth.recordings')}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <BookOpen className="size-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold text-foreground">{weekly.chunksMastered}</p>
                    <p className="text-[11px] text-muted-foreground">{t('growth.newChunks')}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <Clock className="size-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold text-foreground">{weekly.totalPracticeMinutes}</p>
                    <p className="text-[11px] text-muted-foreground">{t('growth.minutes')}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <Zap className="size-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-xl font-bold text-foreground">{weekly.streakDays}</p>
                    <p className="text-[11px] text-muted-foreground">{t('growth.streakDays')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Common Errors */}
          {errors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-500" /> {t('growth.commonErrors')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border">
                    <div className={cn('size-8 rounded-full flex items-center justify-center shrink-0',
                      err.type === 'grammar' ? 'bg-red-50 text-red-500 dark:bg-red-950' :
                      err.type === 'collocation' ? 'bg-orange-50 text-orange-500 dark:bg-orange-950' :
                      'bg-amber-50 text-amber-500 dark:bg-amber-950')}>
                      <span className="text-xs font-bold">{err.count}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{err.error}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 italic truncate">"{err.example}"</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{err.type}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommended Path */}
          {recommended && recommended.recommendedScenes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="size-4 text-amber-500" /> {t('growth.recommendedPath')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground leading-relaxed">{recommended.overallAdvice}</p>
                </div>
                <div className="space-y-2">
                  {recommended.recommendedScenes.map((s) => (
                    <Link key={s.sceneId} to={`/practice?scene=${s.sceneId}`}>
                      <div className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Target className="size-5 text-primary/60" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{s.sceneTitle}</p>
                            <p className="text-xs text-muted-foreground">{t('growth.readiness')} {s.readiness}%</p>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chunk Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-primary" /> {t('growth.chunkMastery')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{data.masteredChunks}</p>
                  <p className="text-xs text-muted-foreground">已掌握</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{data.totalChunks}</p>
                  <p className="text-xs text-muted-foreground">学习中</p>
                </div>
              </div>
              {data.totalChunks > 0 && <Progress value={Math.round((data.masteredChunks / Math.max(data.totalChunks, 1)) * 100)} className="mt-3 h-2" />}
            </CardContent>
          </Card>

          {/* Scene Mastery */}
          {data.sceneProgresses && data.sceneProgresses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="size-4 text-primary" /> 场景熟练度
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.sceneProgresses.map((sp) => (
                  <div key={sp.sceneId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{sp.scene?.title ?? sp.sceneId}</span>
                      <span className="text-muted-foreground">{sp.mastery}%</span>
                    </div>
                    <Progress value={sp.mastery} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Achievement entry */}
          <Link to="/achievements">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Award className="size-8 text-amber-500" />
                  <div>
                    <p className="font-medium text-foreground">成就殿堂</p>
                    <p className="text-xs text-muted-foreground">查看已解锁的里程碑和徽章</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  )
}
