import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, Library } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useAuth } from '@/providers/auth-provider'
import { useIsMobile } from '@/hooks/use-mobile'

export function BottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const visible = useLayoutStore((s) => s.bottomNavVisible)
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const isLoggedIn = !!session

  const navItems = [
    { label: t('nav.home'), path: '/', icon: Home },
    { label: t('nav.learningPlan'), path: '/learning', icon: BookOpen },
    { label: t('nav.myLibrary'), path: '/expressions', icon: Library },
  ]



  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  if (!visible || !isLoggedIn || !isMobile) return null

  return (
    <nav className="fixed inset-x-4 z-40 rounded-full border border-white/45 bg-background/48 shadow-[0_12px_34px_rgba(15,23,42,0.10)] backdrop-blur-2xl"
         style={{ bottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}>
      <div className="flex h-14 items-center justify-around px-1">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = isActive(path)
          return (
            <Link
              key={path}
              to={path}
              onClick={(event) => {
                if (active) event.preventDefault()
              }}
              className={cn(
                'relative flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1 transition-colors',
                active ? 'bg-background/54 text-foreground shadow-sm' : 'text-muted-foreground'
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
