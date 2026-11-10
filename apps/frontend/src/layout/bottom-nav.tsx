import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Clapperboard, Home, Library, ListChecks, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useUserStore } from '@/stores/user.store'
import { useAuth } from '@/providers/auth-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'

const MemberPage = lazy(() =>
  import('@/features/membership/pages/member-page').then((m) => ({ default: m.MemberPage })),
)

export function BottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const visible = useLayoutStore((s) => s.bottomNavVisible)
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const isLoggedIn = !!session
  const membership = useUserStore((s) => s.membership)
  const [memberOpen, setMemberOpen] = useState(false)

  const canUseScripts =
    session?.user?.role === 'admin' || membership?.level === 'admin' || !!membership?.isActive

  const navItems = [
    { label: t('nav.home'), path: '/', icon: Home },
    { label: t('nav.todayTask'), path: '/today', icon: ListChecks },
    { label: t('nav.learningPlan'), path: '/learning', icon: BookOpen },
    { label: t('nav.scripts'), path: '/scripts', icon: Clapperboard, locked: !canUseScripts },
    { label: t('nav.myLibrary'), path: '/expressions', icon: Library },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  if (!visible || !isLoggedIn || !isMobile) return null

  return (
    <>
      <nav className="mobile-bottom-nav fixed inset-x-4 z-40 rounded-full bg-background/48 shadow-[0_12px_34px_rgba(15,23,42,0.10)] backdrop-blur-2xl md:left-1/2 md:right-auto md:w-[min(calc(100%-2rem),42rem)] md:-translate-x-1/2"
           style={{ bottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}>
        <div className="flex h-16 items-center justify-around px-1.5">
          {navItems.map(({ label, path, icon: Icon, locked }) => {
            const active = isActive(path)
            return (
              <Link
                key={path}
                to={path}
                onClick={(event) => {
                  if (locked) {
                    event.preventDefault()
                    setMemberOpen(true)
                    return
                  }
                  if (active) event.preventDefault()
                }}
                onContextMenu={(event) => event.preventDefault()}
                draggable={false}
                className={cn(
                  'relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1 transition-colors',
                  active ? 'bg-background/54 text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                <span className="relative inline-flex">
                  <Icon
                    className={cn(
                      'h-[21px] w-[21px]',
                      locked && 'opacity-50',
                      active && !locked && 'stroke-[2.35] text-primary',
                    )}
                  />
                  {locked && (
                    <Lock
                      aria-hidden
                      className="absolute -right-2 -top-1.5 size-3.5 text-muted-foreground"
                      strokeWidth={2.5}
                    />
                  )}
                </span>
                <span className={cn('max-w-full truncate text-[11.5px] font-medium leading-4', locked && 'opacity-70')}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      <Drawer open={memberOpen} onOpenChange={setMemberOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('member.title')}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {memberOpen && (
              <Suspense fallback={<MobilePageLoading rows={4} />}>
                <MemberPage compact />
              </Suspense>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
