import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Play, Map, Library, TrendingUp, Sparkles, Mic, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/providers/auth-provider'
import api from '@/features/practice/api/english-practice-api'

interface QuickStats {
  userLevel: number; totalXp: number; xpForNextLevel: number
  outputLevel: string; outputLevelDescription: string
  totalChunks: number; masteredChunks: number
}

export function EnglishHomePage() {
  const { session } = useAuth()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return }
    api.get('/level/overview')
      .then((res: any) => {
        const data = res?.data ?? res
        if (data?.outputLevel) setStats(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  const xpPercent = stats ? Math.min(100, Math.round((stats.totalXp % (stats.xpForNextLevel || 100)) / (stats.xpForNextLevel || 100) * 100)) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Hi, {session?.user?.name ?? '同学'}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          今日目标：完成 3 次录音练习
        </p>
      </div>

      {/* Level Card */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : stats ? (
        <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10">
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
          </CardContent>
        </Card>
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

      {/* Quick Actions */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '练习', icon: BookOpen, path: '/practice', color: 'text-blue-500 bg-blue-500/10' },
          { label: '剧本', icon: Play, path: '/script', color: 'text-green-500 bg-green-500/10' },
          { label: '探索', icon: Map, path: '/explore', color: 'text-purple-500 bg-purple-500/10' },
          { label: '表达库', icon: Library, path: '/expressions', color: 'text-amber-500 bg-amber-500/10' },
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

      {/* Today's Recommendation */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="size-4 text-primary" /> 今日推荐练习
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <p className="font-medium text-foreground">自我介绍 — 30 秒挑战</p>
            <p className="text-xs text-muted-foreground">场景：留学生活 · 宿舍入住</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">L2</Badge>
              <span className="text-xs text-muted-foreground">预计 5 分钟</span>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="font-medium text-foreground">点咖啡 — 日常对话</p>
            <p className="text-xs text-muted-foreground">场景：日常社交 · 咖啡店</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">L1</Badge>
              <span className="text-xs text-muted-foreground">预计 3 分钟</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chunks & Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center p-4 text-center">
              <span className="text-2xl font-bold text-foreground">{stats.masteredChunks}</span>
              <span className="text-xs text-muted-foreground">已掌握 Chunk</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-4 text-center">
              <span className="text-2xl font-bold text-foreground">{stats.totalChunks}</span>
              <span className="text-xs text-muted-foreground">学习中的 Chunk</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Growth link */}
      <div className="mt-6">
        <Link to="/growth">
          <Button variant="outline" className="w-full gap-2">
            <TrendingUp className="size-4" /> 查看我的成长
          </Button>
        </Link>
      </div>
    </div>
  )
}
