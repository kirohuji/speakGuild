import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, Play, Library, TrendingUp, Sparkles, Mic, Target,
  ListChecks, ChevronRight, ArrowRight, GraduationCap, MessageSquareText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import api from '@/features/practice/api/english-practice-api'
import { learningApi, type TodayPlan } from '@/features/learning/api/learning-api'

interface QuickStats {
  userLevel: number; totalXp: number; xpForNextLevel: number
  outputLevel: string; outputLevelDescription: string
  totalChunks: number; masteredChunks: number
}

export function EnglishHomePage() {
  const { session } = useAuth()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return }

    Promise.all([
      api.get('/level/overview').then((res: any) => {
        const data = res?.data ?? res
        if (data?.outputLevel) setStats(data)
      }).catch(() => {}),
      learningApi.getTodayTasks().then(setTodayPlan).catch(() => setTodayPlan(null)),
    ]).finally(() => setLoading(false))
  }, [session])

  const xpPercent = stats
    ? Math.min(100, Math.round((stats.totalXp % (stats.xpForNextLevel || 100)) / (stats.xpForNextLevel || 100) * 100))
    : 0

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Hi, {session?.user?.name ?? '同学'}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          继续你的英语表达学习之旅
        </p>
      </div>

      {/* Level Card */}
      {loading ? (
        <div className="mb-6 space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : stats ? (
        <Link to="/growth">
          <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10 transition-colors hover:from-primary/10 hover:to-primary/20">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Sparkles className="size-7 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Lv.{stats.userLevel}</Badge>
                  <span className="text-sm font-medium text-foreground">
                    {stats.outputLevelDescription}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>XP {stats.totalXp}</span>
                    <span>下一级 {stats.xpForNextLevel} XP</span>
                  </div>
                  <Progress value={xpPercent} className="h-1.5" />
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ) : (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Target className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">完成新手引导，解锁你的能力评估</p>
            <Link to="/onboarding/goals">
              <Button size="sm">开始引导</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Continue Learning / Today's Tasks — Primary CTA */}
      {todayPlan && todayPlan.currentUnit && todayPlan.tasks.length > 0 && (
        <Link to="/today">
          <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 transition-colors hover:from-primary/10 hover:to-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/20">
                    <ListChecks className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">继续学习</p>
                    <p className="text-xs text-muted-foreground">
                      {todayPlan.currentUnit.title} · 今日 {todayPlan.tasks.length} 个任务
                    </p>
                  </div>
                </div>
                <Button size="sm" className="shrink-0 gap-1">
                  去完成
                  <ArrowRight className="size-3" />
                </Button>
              </div>

              {/* Mini task list */}
              <div className="mt-3 space-y-1.5">
                {todayPlan.tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={cn(
                      'size-1.5 rounded-full',
                      task.type === 'vocab' && 'bg-blue-500',
                      task.type === 'chunk' && 'bg-purple-500',
                      task.type === 'practice' && 'bg-orange-500',
                      task.type === 'script' && 'bg-green-500',
                    )} />
                    <span>{task.title}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Quick Actions */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '学习计划', icon: BookOpen, path: '/learning', color: 'text-blue-500 bg-blue-500/10' },
          { label: '今日任务', icon: ListChecks, path: '/today', color: 'text-primary bg-primary/10' },
          { label: '剧本挑战', icon: Play, path: '/script', color: 'text-green-500 bg-green-500/10' },
          { label: '我的学习库', icon: Library, path: '/expressions', color: 'text-amber-500 bg-amber-500/10' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.label} to={item.path}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div className={`flex size-10 items-center justify-center rounded-full ${item.color}`}>
                    <Icon className="size-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Chunks & Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center p-4 text-center">
              <span className="text-2xl font-bold text-foreground">{stats.masteredChunks}</span>
              <span className="text-xs text-muted-foreground">已掌握 Chunk</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-4 text-center">
              <span className="text-2xl font-bold text-foreground">{stats.totalChunks}</span>
              <span className="text-xs text-muted-foreground">总计 Chunk</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom links */}
      <div className="space-y-2">
        <Link to="/learning">
          <Button variant="outline" className="w-full gap-2">
            <BookOpen className="size-4" /> 浏览全部学习材料
          </Button>
        </Link>
        <Link to="/growth">
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
            <TrendingUp className="size-4" /> 查看我的成长
          </Button>
        </Link>
      </div>
    </div>
  )
}
