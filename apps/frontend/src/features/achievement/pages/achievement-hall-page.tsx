import { useState, useEffect } from 'react'
import { Award, Lock, Star, Trophy, Zap, Flame, Sparkles, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { achievementApi, type AchievementItem } from '../api/achievement-api'
import { cn } from '@/lib/cn'

const RARITY_STYLES: Record<string, { border: string; bg: string; text: string; icon: string; label: string }> = {
  common:    { border: 'border-border',          bg: 'bg-muted',               text: 'text-muted-foreground', icon: 'text-muted-foreground', label: '普通' },
  rare:      { border: 'border-blue-500/30',     bg: 'bg-blue-50 dark:bg-blue-950',   text: 'text-blue-600 dark:text-blue-400',   icon: 'text-blue-500',   label: '稀有' },
  epic:      { border: 'border-purple-500/30',   bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-600 dark:text-purple-400', icon: 'text-purple-500', label: '史诗' },
  legendary: { border: 'border-amber-400/50',    bg: 'bg-amber-50 dark:bg-amber-950',  text: 'text-amber-600 dark:text-amber-400',  icon: 'text-amber-400',  label: '传说' },
}

const CATEGORY_LABELS: Record<string, string> = {
  milestone: '里程碑', streak: '连续打卡', challenge: '挑战', mastery: '掌握', hidden: '隐藏', first_time: '初次体验',
}

const RARITY_ICONS: Record<string, typeof Star> = {
  common: Star, rare: Award, epic: Trophy, legendary: Sparkles,
}

export function AchievementHallPage() {
  const [achievements, setAchievements] = useState<AchievementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    achievementApi.getAll()
      .then(setAchievements)
      .catch(() => setAchievements([]))
      .finally(() => setLoading(false))
  }, [])

  const unlocked = achievements.filter((a) => a.userStatus === 'unlocked' || a.userStatus === 'seen')
  const filtered = tab === 'all' ? achievements : achievements.filter((a) => a.category === tab)
  const categories = [...new Set(achievements.map((a) => a.category))]

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">🏆 成就殿堂</h1>
        <p className="mt-1 text-muted-foreground">已解锁 {unlocked.length} / {achievements.length}</p>
      </div>

      {achievements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Award className="size-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">完成首次练习，解锁你的第一个成就！</p>
            <p className="text-sm text-muted-foreground">成就系统将在首次练习后激活</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 w-full flex-wrap">
              <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs">
                  {CATEGORY_LABELS[cat] ?? cat}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={tab}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filtered.map((ach) => (
                  <AchievementBadge key={ach.id} achievement={ach} />
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Recently unlocked */}
          {unlocked.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-foreground">最近解锁</p>
              <div className="flex gap-2 overflow-x-auto">
                {unlocked.slice(0, 3).map((ach) => (
                  <Badge key={ach.id} variant="secondary" className="shrink-0 gap-1">
                    <Award className="size-3" /> {ach.title}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AchievementBadge({ achievement: a }: { achievement: AchievementItem }) {
  const style = RARITY_STYLES[a.rarity] ?? RARITY_STYLES.common
  const isLocked = a.userStatus === 'locked'
  const isHidden = a.isHidden && isLocked
  const Icon = RARITY_ICONS[a.rarity] ?? Star

  return (
    <Card className={cn('overflow-hidden border-2 transition-all', style.border, isLocked ? style.bg : 'bg-card')}>
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        {isHidden ? (
          <>
            <EyeOff className="size-10 text-muted-foreground/30" />
            <p className="text-xs font-bold text-muted-foreground">???</p>
            <p className="text-[10px] leading-tight text-muted-foreground/60">{a.hintText ?? '神秘的成就'}</p>
          </>
        ) : (
          <>
            <div className={cn('flex size-12 items-center justify-center rounded-full', isLocked ? 'bg-muted' : style.bg)}>
              {isLocked ? (
                <Lock className="size-5 text-muted-foreground" />
              ) : (
                <Icon className={cn('size-6', style.icon)} />
              )}
            </div>
            <p className={cn('text-xs font-bold', isLocked ? 'text-muted-foreground' : 'text-foreground')}>
              {a.title}
            </p>
            <p className="text-[10px] leading-tight text-muted-foreground">
              {isLocked ? a.description : a.rewardTitle ?? a.description}
            </p>
            {/* Progress bar for locked achievements */}
            {isLocked && a.progressTarget > 0 && (
              <div className="w-full space-y-0.5">
                <Progress value={Math.round((a.progress / a.progressTarget) * 100)} className="h-1" />
                <p className="text-[10px] text-muted-foreground">{a.progress}/{a.progressTarget}</p>
              </div>
            )}
            {!isLocked && (
              <Badge variant="outline" className={cn('text-[10px]', style.text)}>
                {style.label}
              </Badge>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
