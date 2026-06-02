import React from 'react'
import { useTranslation } from 'react-i18next'
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
import { useIsMobile } from '@/hooks/use-mobile'

export function RootLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { session } = useAuth()
  const immersiveMode = useLayoutStore((s) => s.immersiveMode)
  const isMobile = useIsMobile()
  const isAuthPage = pathname === '/auth/login' || pathname === '/auth/register'
  const isHomePage = pathname === '/'
  const isLearningSubPage =
    pathname.startsWith('/learning/units/') ||
    pathname.startsWith('/practice/session/') ||
    pathname.startsWith('/script/')
  const isLoggedIn = !!session
  const showBottomNav = !immersiveMode && !isLearningSubPage
  const showMobileAvatar = isLoggedIn && isHomePage && !immersiveMode
  const [profileDrawerOpen, setProfileDrawerOpen] = React.useState(false)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = React.useState(false)

  return (
    <div
      className={cn(
        'flex flex-col bg-background text-foreground',
        isMobile ? 'h-dvh overflow-hidden' : 'min-h-screen overflow-visible',
        !isHomePage && !immersiveMode && 'app-surface',
      )}
    >
      {!isAuthPage && (
        <>
          {/* Frosted glass top bar for safe area */}
          {isMobile && <div className="fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top,0px)] bg-background/70 backdrop-blur-xl" />}
          {!isMobile && !immersiveMode && <Header />}
        </>
      )}
      {!isAuthPage && isMobile && showMobileAvatar && (
        <MobileTopBar
          onNotificationOpen={() => setNotificationDrawerOpen(true)}
          onProfileOpen={() => setProfileDrawerOpen(true)}
        />
      )}
      <main className={cn('min-h-0 flex-1 pt-0', isMobile ? 'overflow-y-auto overscroll-contain' : 'overflow-visible', `${
        immersiveMode
          ? 'pb-0'
          : isAuthPage || !isLoggedIn
            ? 'pb-0'
            : isHomePage
              ? isMobile ? 'pt-0 pb-0' : 'pt-14 pb-0'
              : showBottomNav
                ? isMobile ? 'pt-[env(safe-area-inset-top,0px)] pb-[calc(5rem+env(safe-area-inset-bottom,0px))]' : 'pt-14 pb-0'
                : isMobile ? 'pt-[env(safe-area-inset-top,0px)] pb-0' : 'pt-14 pb-0'
      }`)}>
        <div className={isAuthPage || isHomePage || immersiveMode ? 'h-full max-w-none px-0 py-0' : cn('mx-auto max-w-[1480px]', isMobile ? 'px-0 py-3' : 'px-4 py-6')}>
          <Outlet />
        </div>
      </main>
      {!isAuthPage && !isMobile && !immersiveMode && <Footer />}
      {!isAuthPage && showBottomNav && <BottomNav />}
      <Drawer open={profileDrawerOpen} onOpenChange={setProfileDrawerOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background app-surface">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="sr-only">{t('nav.profile')}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <ProfilePage />
          </div>
        </DrawerContent>
      </Drawer>
      <Drawer open={notificationDrawerOpen} onOpenChange={setNotificationDrawerOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background app-surface">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('notification.title')}</DrawerTitle>
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
  const { t } = useTranslation()
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
    <header className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-40 flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45">
      <button
        type="button"
        onClick={onNotificationOpen}
        aria-label={t('notification.title')}
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
        aria-label={t('nav.profile')}
        className={cn(
          'block rounded-full p-0.5 transition-colors',
          profileActive ? 'bg-background/45' : 'hover:bg-background/45',
        )}
      >
        <Avatar className="size-8">
          <AvatarImage src={user?.image} alt={user?.name || t('nav.profile')} />
          <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
            {fallback}
          </AvatarFallback>
        </Avatar>
      </button>
    </header>
  )
}
