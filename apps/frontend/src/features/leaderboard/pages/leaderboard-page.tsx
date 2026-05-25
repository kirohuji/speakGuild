import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, PenLine, Flame, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  getPracticeLeaderboard, getMockExamLeaderboard, getStreakLeaderboard,
  type LeaderboardEntry,
} from '@/features/leaderboard/api'
import { cn } from '@/lib/cn'

type Tab = 'practice' | 'mock' | 'streak'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'practice', label: '练习达人', icon: PenLine },
  { key: 'mock', label: '模考分数', icon: Trophy },
  { key: 'streak', label: '连续打卡', icon: Flame },
]

export function LeaderboardPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('practice')
  const [items, setItems] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let data: LeaderboardEntry[] = []
      if (tab === 'practice') data = await getPracticeLeaderboard()
      else if (tab === 'mock') data = await getMockExamLeaderboard()
      else data = await getStreakLeaderboard()
      setItems(data)
    } finally { setLoading(false) }
  }, [tab])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">排行榜</h1>
          <p className="text-xs text-muted-foreground">看看谁是学习之星</p>
        </div>
      </div>

      <div className="flex gap-1.5 rounded-lg bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-all',
              tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.userId}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 transition-all hover:border-border',
                idx < 3 && 'border-primary/10 bg-primary/[0.02]'
              )}
            >
              <div className="flex-shrink-0 w-8 text-center">
                {idx < 3 ? (
                  <Crown className={cn('h-5 w-5 mx-auto', idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : 'text-orange-600')} />
                ) : (
                  <span className="text-sm font-mono text-muted-foreground">{item.rank}</span>
                )}
              </div>
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={item.userImage || undefined} />
                <AvatarFallback className="text-xs">{item.userName?.slice(0, 2) || '??'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.userName}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-bold text-primary">{item.score.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">
                  {tab === 'practice' ? '题' : tab === 'mock' ? '分' : '天'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
