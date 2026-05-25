import { useEffect, useState } from 'react'
import { Award, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { AchievementItem } from '../api/achievement-api'

interface AchievementToastProps {
  achievement: AchievementItem | null
  onClose: () => void
}

/** 成就解锁 Toast 动画 — 底部弹出，3 秒后自动消失 */
export function AchievementToast({ achievement, onClose }: AchievementToastProps) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!achievement) return
    setVisible(true)
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => { setVisible(false); setExiting(false); onClose() }, 400)
    }, 3500)
    return () => clearTimeout(timer)
  }, [achievement])

  if (!visible || !achievement) return null

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transition-all duration-300',
        exiting ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
      )}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 px-5 py-4 shadow-2xl backdrop-blur-xl">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
          <Award className="size-6 text-amber-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">🎉 成就解锁!</p>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{achievement.title}</p>
          <p className="text-xs text-muted-foreground">{achievement.description}</p>
        </div>
        <button onClick={() => { setExiting(true); setTimeout(onClose, 400) }} className="shrink-0">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
