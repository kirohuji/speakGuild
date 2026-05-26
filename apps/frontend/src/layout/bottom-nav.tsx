import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, Library } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useAuth } from '@/providers/auth-provider'

const navItems = [
  { label: '首页', path: '/', icon: Home },
  { label: '学习计划', path: '/learning', icon: BookOpen },
  // { label: '今日任务', path: '/today', icon: ListChecks },
  { label: '我的学习库', path: '/expressions', icon: Library },
  // { label: '剧本挑战', path: '/script', icon: Play },
]

export function BottomNav() {
  const location = useLocation()
  const visible = useLayoutStore((s) => s.bottomNavVisible)
  const { session } = useAuth()
  const isLoggedIn = !!session

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  if (!visible || !isLoggedIn) return null

  return (
    <nav className="fixed inset-x-4 bottom-3 z-40 rounded-full border border-border/70 bg-background/90 shadow-[0_12px_34px_rgba(15,23,42,0.14)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex h-14 items-center justify-around px-1">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = isActive(path)
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'relative flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1 transition-colors',
                active ? 'bg-muted text-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.35] text-primary')} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
