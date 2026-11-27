import React, { lazy, Suspense, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  IdCard, Loader2, LogOut, Palette, Settings, Shield, WifiOff, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/common/user-avatar'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { useUserStore } from '@/stores/user.store'
import { useOfflineSyncStore } from '@/stores/offline-sync.store'
import { useAppUpdateStore } from '@/stores/app-update.store'
import { isDevHost } from '@/lib/dev-host'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { managementHome } from '@/features/admin/management-access'
import { desktopLearningHref } from '@/features/home/desktop-learning-section'
import { NotificationBell } from '@/features/notification/components/notification-bell'
import { AppearanceContent } from '@/features/profile/components/appearance-drawer'
import { showRequestError } from '@/lib/request-feedback'

const AccountTab = lazy(() =>
  import('@/features/profile/components/account-tab').then((m) => ({ default: m.AccountTab })),
)
const MobileSettingsView = lazy(() =>
  import('@/features/profile/components/mobile-settings-view').then((m) => ({ default: m.MobileSettingsView })),
)

const panelSurface = 'border border-border bg-background shadow-none'

function HeaderIconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('relative h-8 w-8 text-muted-foreground hover:text-foreground', className)}
    >
      {children}
    </Button>
  )
}

export function Header() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [logoutForceConfirm, setLogoutForceConfirm] = useState(false)
  const [logoutForceReason, setLogoutForceReason] = useState<'offline' | 'sync'>('offline')
  const [logoutLoading, setLogoutLoading] = useState(false)
  const { session, signOut } = useAuth()
  const ensureUserLoaded = useUserStore((s) => s.ensureLoaded)
  const userProfile = useUserStore((s) => s.profile)
  const membership = useUserStore((s) => s.membership)
  const isSyncing = useOfflineSyncStore((s) => s.isSyncing)
  const updateStatus = useAppUpdateStore((s) => s.status)
  const updateDialogOpen = useAppUpdateStore((s) => s.dialogOpen)
  const updateVersion = useAppUpdateStore((s) => s.version)
  const updateShouldNotify = useAppUpdateStore((s) => s.shouldNotify)
  const updateIsMandatory = useAppUpdateStore((s) => s.isMandatory)
  const openUpdateDialog = useAppUpdateStore((s) => s.openDialog)
  const isOnline = useOnlineStatus()
  const isAdmin = session?.user?.role === 'admin'
  const isCreator = session?.user?.role === 'creator'
  const user = session?.user

  const showBackgroundUpdate =
    updateStatus === 'downloading' &&
    !updateDialogOpen &&
    Boolean(updateVersion) &&
    (updateShouldNotify || updateIsMandatory)

  const hasActiveMembership = membership?.level === 'admin' || !!membership?.isActive
  const membershipLabel = membership?.level === 'admin'
    ? t('member.admin')
    : hasActiveMembership
      ? membership?.planName || t('member.badgeActive')
      : t('member.freeUser')
  const nickname = userProfile?.name || userProfile?.username || user?.name || t('app.name')

  useEffect(() => {
    if (session?.user?.id) {
      void ensureUserLoaded(session.user.id)
    }
  }, [ensureUserLoaded, session?.user?.id])

  const openLogoutDialog = () => {
    const offline = !navigator.onLine
    setLogoutForceReason(offline ? 'offline' : 'sync')
    setLogoutForceConfirm(offline)
    setShowLogoutDialog(true)
  }

  const handleConfirmLogout = async () => {
    if (logoutLoading) return
    setLogoutLoading(true)
    try {
      await signOut(logoutForceConfirm ? { forceOffline: true } : undefined)
      setShowLogoutDialog(false)
      setLogoutForceConfirm(false)
      navigate('/auth/login')
    } catch (error: any) {
      if (!logoutForceConfirm && (
        error?.code === 'OFFLINE' ||
        error?.message?.includes('offline') ||
        error?.message?.includes('sync')
      )) {
        setLogoutForceConfirm(true)
        setLogoutForceReason(error?.code === 'OFFLINE' || String(error?.message ?? '').includes('offline') ? 'offline' : 'sync')
        return
      }
      showRequestError(error, t('profile.logoutFailed', { defaultValue: '退出登录失败，请重试' }))
    } finally {
      setLogoutLoading(false)
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center px-3 lg:px-4">
          <Link to={desktopLearningHref('today')} className="mr-8 hidden shrink-0 items-center gap-2 lg:flex">
            <img
              src="/logo.png"
              alt={t('app.name')}
              className="h-7 w-auto dark:invert"
            />
          </Link>

          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            <Link
              to="/portal"
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                location.pathname.startsWith('/portal')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {t('nav.home')}
            </Link>
          </nav>

          <div className="ml-auto hidden items-center gap-0.5 lg:flex">
            {user && <NotificationBell className="h-8 w-8" />}

            {user && (
              <HeaderIconButton label={t('profile.account')} onClick={() => setAccountOpen(true)}>
                <IdCard className="h-4 w-4" />
              </HeaderIconButton>
            )}

            {user && (
              <HeaderIconButton label={t('profile.systemSettings')} onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4" />
              </HeaderIconButton>
            )}

            <HeaderIconButton label={t('profile.theme')} onClick={() => setThemeOpen(true)}>
              <Palette className="h-4 w-4" />
            </HeaderIconButton>

            {showBackgroundUpdate && (
              <HeaderIconButton label={t('settings.downloading2')} onClick={openUpdateDialog} className="text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
              </HeaderIconButton>
            )}

            {user && (
              <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('nav.profile')}
                    className="relative ml-0.5 block rounded-full p-0.5 transition-colors hover:bg-muted"
                  >
                    <UserAvatar className="size-8" fallbackClassName="bg-muted text-xs font-semibold text-foreground" />
                    {isSyncing && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
                        <Loader2 className="size-3 animate-spin text-primary" />
                      </span>
                    )}
                    {isDevHost && (
                      <span className="absolute -bottom-0.5 -left-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white ring-1 ring-amber-600">
                        <Wrench className="size-2.5" />
                      </span>
                    )}
                    {!isOnline && (
                      <span className="absolute -bottom-0.5 -left-0.5 flex size-4 items-center justify-center rounded-full bg-muted-foreground/70 text-background ring-1 ring-border">
                        <WifiOff className="size-2.5" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className={cn(panelSurface, 'w-72 overflow-hidden rounded-2xl p-0')}
                >
                  <div className="border-b border-border/60 px-4 py-3">
                    <p className="truncate text-sm font-semibold">{nickname}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{membershipLabel}</p>
                  </div>
                  {(isAdmin || isCreator) && (
                    <div className="p-1.5">
                      <Link
                        to={managementHome(session?.user?.role)}
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted/60"
                      >
                        <Shield className="size-4 text-muted-foreground" />
                        {isCreator ? '创作管理' : t('common.adminPanel')}
                      </Link>
                    </div>
                  )}
                  <div className="border-t border-border/60 p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        openLogoutDialog()
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="size-4" />
                      {t('profile.logout')}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </header>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="flex h-[min(88vh,840px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-14 text-left">
            <DialogTitle className="text-base font-semibold">{t('profile.account')}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {accountOpen && (
              <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}>
                <AccountTab desktop />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="flex max-h-[min(88vh,840px)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-14 text-left">
            <DialogTitle className="text-base font-semibold">{t('profile.systemSettings')}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            {settingsOpen && (
              <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}>
                <MobileSettingsView desktop />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={themeOpen} onOpenChange={setThemeOpen}>
        <DialogContent className="flex max-h-[min(88vh,840px)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-14 text-left">
            <DialogTitle className="text-base font-semibold">{t('profile.theme')}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            {themeOpen && <AppearanceContent />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showLogoutDialog}
        onOpenChange={(open) => {
          if (logoutLoading) return
          setShowLogoutDialog(open)
          if (!open) setLogoutForceConfirm(false)
        }}
      >
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('profile.logout')}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              {logoutForceConfirm
                ? (logoutForceReason === 'sync'
                  ? t('learningNotebooks.syncLogoutConfirm')
                  : t('learningNotebooks.offlineLogoutConfirm'))
                : t('profile.logoutConfirmHint')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 space-x-0 border-t border-border/60 bg-muted/10 -mx-5 -mb-5 mt-2 px-5 py-4 sm:rounded-b-2xl">
            <Button
              variant="secondary"
              className="flex-1 border-0 shadow-none sm:flex-none"
              onClick={() => { setShowLogoutDialog(false); setLogoutForceConfirm(false) }}
              disabled={logoutLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 sm:flex-none"
              onClick={() => void handleConfirmLogout()}
              disabled={logoutLoading}
            >
              {logoutLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {logoutLoading ? t('profile.loggingOut') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
