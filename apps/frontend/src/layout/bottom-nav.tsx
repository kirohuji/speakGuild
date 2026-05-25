import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, Library, Play, User, ListChecks } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useAuth } from '@/providers/auth-provider'

const navItems = [
  { label: '首页', path: '/', icon: Home },
  { label: '学习计划', path: '/learning', icon: BookOpen },
  { label: '今日任务', path: '/today', icon: ListChecks },
  { label: '剧本挑战', path: '/script', icon: Play },
  { label: '我的学习库', path: '/expressions', icon: Library },
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 items-center justify-around">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = isActive(path)
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.2]')} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
