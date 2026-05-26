import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Header } from './header'
import { Footer } from './footer'
import { BottomNav } from './bottom-nav'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useNotificationStore } from '@/features/notification/store'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { NotificationListPage } from '@/features/notification/pages/notification-list-page'
import { useLayoutStore } from '@/stores/layout.store'
import { cn } from '@/lib/cn'

export function RootLayout() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  const immersiveMode = useLayoutStore((s) => s.immersiveMode)
  const isAuthPage = pathname === '/auth/login' || pathname === '/auth/register'
  const isHomePage = pathname === '/'
  const isLoggedIn = !!session
  const showMobileAvatar = isLoggedIn && isHomePage && !immersiveMode
  const [profileDrawerOpen, setProfileDrawerOpen] = React.useState(false)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = React.useState(false)

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col bg-background text-foreground',
        !isHomePage && !immersiveMode && 'app-surface pt-safe',
      )}
    >
      {!isAuthPage && (
        <div className={cn('hidden lg:block', immersiveMode && 'hidden')}>
          <Header />
        </div>
      )}
      {!isAuthPage && showMobileAvatar && (
        <MobileTopBar
          onNotificationOpen={() => setNotificationDrawerOpen(true)}
          onProfileOpen={() => setProfileDrawerOpen(true)}
        />
      )}
      <main className={`flex-1 pt-0 ${
        immersiveMode
          ? 'pb-0'
          : isAuthPage || !isLoggedIn
            ? 'pb-0 lg:pt-0 lg:pb-0'
            : isHomePage
              ? 'pt-0 pb-0 lg:pt-14 lg:pb-0'
              : 'pt-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pt-14 lg:pb-0'
      }`}>
        <div className={isAuthPage || isHomePage || immersiveMode ? 'h-full max-w-none px-0 py-0' : 'mx-auto max-w-[1480px] px-0 py-3 lg:px-4 lg:py-6'}>
          <Outlet />
        </div>
      </main>
      {!isAuthPage && (
        <div className={cn('hidden lg:block', immersiveMode && 'hidden')}>
          <Footer />
        </div>
      )}
      {!isAuthPage && <div className={cn(immersiveMode && 'hidden')}><BottomNav /></div>}
      <Drawer open={profileDrawerOpen} onOpenChange={setProfileDrawerOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="sr-only">个人中心</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <ProfilePage />
          </div>
        </DrawerContent>
      </Drawer>
      <Drawer open={notificationDrawerOpen} onOpenChange={setNotificationDrawerOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="sr-only">通知中心</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <NotificationListPage compact />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function MobileTopBar({
  onNotificationOpen,
  onProfileOpen,
}: {
  onNotificationOpen: () => void
  onProfileOpen: () => void
}) {
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
    <header className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-40 flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45 lg:hidden">
      <button
        type="button"
        onClick={onNotificationOpen}
        aria-label="通知"
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </button>
      <button
        type="button"
        onClick={onProfileOpen}
        aria-label="个人页面"
        className={cn(
          'block rounded-full p-0.5 transition-colors',
          profileActive ? 'bg-background/45' : 'hover:bg-background/45',
        )}
      >
        <Avatar className="size-8">
          <AvatarImage src={user?.image} alt={user?.name || '个人头像'} />
          <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
            {fallback}
          </AvatarFallback>
        </Avatar>
      </button>
    </header>
  )
}
