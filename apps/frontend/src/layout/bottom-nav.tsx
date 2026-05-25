import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, FileText, User, Bell } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useNotificationStore } from '@/features/notification/store'
import { useAuth } from '@/providers/auth-provider'

const navItems = [
  { label: '题库', path: '/', icon: BookOpen },
  { label: '模考', path: '/mock', icon: FileText },
  { label: '通知', path: '/notifications', icon: Bell },
  { label: '我的', path: '/profile', icon: User },
]

export function BottomNav() {
  const location = useLocation()
  const visible = useLayoutStore((s) => s.bottomNavVisible)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const initSocket = useNotificationStore((s) => s.initSocket)
  const { session } = useAuth()
  const isLoggedIn = !!session

  useEffect(() => {
    if (session?.user?.id) {
      initSocket(session.user.id)
      fetchUnreadCount()
    }
  }, [session?.user?.id, initSocket, fetchUnreadCount])

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
              {path === '/notifications' && unreadCount > 0 && (
                <span className="absolute right-[calc(50%-20px)] top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
