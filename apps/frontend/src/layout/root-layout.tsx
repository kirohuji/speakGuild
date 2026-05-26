import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Header } from './header'
import { Footer } from './footer'
import { BottomNav } from './bottom-nav'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNotificationStore } from '@/features/notification/store'
import { cn } from '@/lib/cn'

export function RootLayout() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  const isAuthPage = pathname === '/auth/login' || pathname === '/auth/register'
  const isLoggedIn = !!session
  const showMobileAvatar = isLoggedIn && pathname === '/'

  return (
    <div className="flex min-h-screen flex-col pt-safe">
      {!isAuthPage && (
        <div className="hidden lg:block">
          <Header />
        </div>
      )}
      {!isAuthPage && showMobileAvatar && <MobileTopBar />}
      <main className={`flex-1 pt-0 ${
        isAuthPage || !isLoggedIn
          ? 'pb-0 lg:pt-0 lg:pb-0'
          : `${showMobileAvatar ? 'pt-[calc(3.25rem+env(safe-area-inset-top,0px))]' : 'pt-0'} pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pt-14 lg:pb-0`
      }`}>
        <div className={isAuthPage ? 'h-full max-w-none px-0 py-0' : 'mx-auto max-w-[1480px] px-0 py-3 lg:px-4 lg:py-6'}>
          <Outlet />
        </div>
      </main>
      {!isAuthPage && (
        <div className="hidden lg:block">
          <Footer />
        </div>
      )}
      {!isAuthPage && <BottomNav />}
    </div>
  )
}

function MobileTopBar() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const user = session?.user
  const fallback = (user?.name || user?.email || '我').slice(0, 1).toUpperCase()
  const profileActive = pathname.startsWith('/profile') || pathname.startsWith('/account')

  React.useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  return (
    <header className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-40 flex items-center gap-1 rounded-full bg-background/70 p-1 backdrop-blur-xl ring-1 ring-border/40 lg:hidden">
      <Link
        to="/notifications"
        aria-label="通知"
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </Link>
      <Link
        to="/profile"
        aria-label="个人页面"
        className={cn(
          'block rounded-full p-0.5 transition-colors',
          profileActive ? 'bg-primary/10' : 'hover:bg-muted/70',
        )}
      >
        <Avatar className="size-8">
          <AvatarImage src={user?.image} alt={user?.name || '个人头像'} />
          <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
            {fallback}
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  )
}
