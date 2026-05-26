import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Header } from './header'
import { Footer } from './footer'
import { BottomNav } from './bottom-nav'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'

export function RootLayout() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  const isAuthPage = pathname === '/auth/login' || pathname === '/auth/register'
  const isLoggedIn = !!session

  return (
    <div className="flex min-h-screen flex-col pt-safe">
      {!isAuthPage && (
        <div className="hidden lg:block">
          <Header />
        </div>
      )}
      {!isAuthPage && isLoggedIn && <MobileTopBar />}
      <main className={`flex-1 pt-0 ${
        isAuthPage || !isLoggedIn ? 'pb-0 lg:pt-0 lg:pb-0' : 'pt-[calc(3.25rem+env(safe-area-inset-top,0px))] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pt-14 lg:pb-0'
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
  const user = session?.user
  const fallback = (user?.name || user?.email || '我').slice(0, 1).toUpperCase()
  const profileActive = pathname.startsWith('/profile') || pathname.startsWith('/account')

  return (
    <header className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-40 rounded-full border border-border/70 bg-background/90 p-1 shadow-[0_10px_26px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
      <Link
        to="/profile"
        aria-label="个人页面"
        className={cn(
          'block rounded-full p-0.5 transition-colors',
          profileActive ? 'bg-primary/12 ring-1 ring-primary/30' : 'hover:bg-muted',
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
