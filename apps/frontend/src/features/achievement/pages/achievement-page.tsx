import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Crown, Flame, Medal, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { getMyAchievements, checkAchievements, type AchievementItem } from '@/features/achievement/api'
import { cn } from '@/lib/cn'

const ICON_MAP: Record<string, React.ElementType> = {
  Play: Medal, BookOpen: Medal, PenLine: Medal, Zap: Medal, Crown: Crown,
  Flame: Flame, GraduationCap: Trophy, Trophy: Trophy, Star: Trophy,
  Sparkles: Medal, Heart: Medal, BookMarked: Medal,
}

const CATEGORY_LABELS: Record<string, string> = {
  practice: '练习', streak: '打卡', mock: '模考', collection: '收藏',
}

export function AchievementPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [items, setItems] = useState<AchievementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  const fetchData = async () => {
    const data = await getMyAchievements()
    setItems(data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCheck = async () => {
    setChecking(true)
    try {
      const res = await checkAchievements()
      if (res.unlocked.length > 0) {
        await fetchData()
      }
    } finally { setChecking(false) }
  }

  const unlocked = items.filter((i) => i.unlocked).length
  const total = items.length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">成就</h1>
          <p className="text-xs text-muted-foreground">已解锁 {unlocked}/{total}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCheck} disabled={checking}>
          {checking ? '检测中...' : '刷新'}
        </Button>
      </div>

      {/* progress bar */}
      <div className="rounded-full bg-muted h-2 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: total > 0 ? `${(unlocked / total) * 100}%` : '0%' }}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => {
            const Icon = ICON_MAP[item.icon] || Medal
            return (
              <Card
                key={item.id}
                className={cn(
                  'relative overflow-hidden transition-all',
                  item.unlocked
                    ? 'border-primary/20 bg-primary/[0.02]'
                    : 'opacity-50'
                )}
              >
                <CardContent className="p-4 text-center">
                  <div className={cn(
                    'inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-3',
                    item.unlocked ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    {item.unlocked ? (
                      <Icon className="h-6 w-6 text-primary" />
                    ) : (
                      <Lock className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <p className={cn('text-sm font-medium', item.unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                  <BadgeMini cat={item.category} />
                </CardContent>
                {item.unlocked && (
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[24px] border-r-[24px] border-t-primary border-r-transparent" />
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BadgeMini({ cat }: { cat: string }) {
  return (
    <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
      {CATEGORY_LABELS[cat] || cat}
    </span>
  )
}
