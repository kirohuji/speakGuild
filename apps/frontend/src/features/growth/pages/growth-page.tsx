import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Star, BarChart3, Target, BookOpen, Award, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { levelApi } from '@/features/practice/api/english-practice-api'
import { cn } from '@/lib/cn'

interface LevelOverview {
  userLevel: number; totalXp: number; xpForNextLevel: number
  outputLevel: string; outputLevelDescription: string
  totalChunks: number; masteredChunks: number
  sceneProgresses: { sceneId: string; scene: { id: string; title: string }; mastery: number; readiness: number }[]
}

export function GrowthPage() {
  const [data, setData] = useState<LevelOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    levelApi.getOverview()
      .then((res: any) => setData(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  const xpForCurrentLevel = data ? ((data.userLevel - 1) * 100) : 0
  const xpProgress = data ? Math.min(100, Math.round(((data.totalXp - xpForCurrentLevel) / data.xpForNextLevel) * 100)) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">我的成长</h1>
        <p className="mt-1 text-muted-foreground">追踪你的英语输出成长轨迹</p>
      </div>

      {!data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Target className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">完成首次练习后查看成长数据</p>
            <Link to="/practice"><Badge variant="secondary">去练习</Badge></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* User Level Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
                {data.userLevel}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge>Lv.{data.userLevel}</Badge>
                  <span className="text-sm text-muted-foreground">总 XP: {data.totalXp}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>距下一级</span><span>{data.totalXp - xpForCurrentLevel} / {data.xpForNextLevel} XP</span>
                  </div>
                  <Progress value={xpProgress} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Output Level */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" /> 输出能力
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-foreground">{data.outputLevel}</p>
                  <p className="text-sm text-muted-foreground">{data.outputLevelDescription}</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <div
                      key={l}
                      className={cn(
                        'size-3 rounded-full',
                        l <= parseInt(data.outputLevel.replace('L', ''))
                          ? 'bg-primary'
                          : 'bg-muted',
                      )}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chunk Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-primary" /> Chunk 掌握
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
              {data.totalChunks > 0 && (
                <Progress
                  value={Math.round((data.masteredChunks / Math.max(data.totalChunks, 1)) * 100)}
                  className="mt-3 h-2"
                />
              )}
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
