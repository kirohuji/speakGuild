import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { Loader2, LogOut, Monitor, Moon, Shield, Sun, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/common/user-avatar'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { useUserStore } from '@/stores/user.store'
import { useOfflineSyncStore } from '@/stores/offline-sync.store'
import { useAppUpdateStore } from '@/stores/app-update.store'
import { isDevHost } from '@/lib/dev-host'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { managementHome } from '@/features/admin/management-access'

export function Header() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const { session, signOut } = useAuth()
  const ensureUserLoaded = useUserStore((s) => s.ensureLoaded)
  const isSyncing = useOfflineSyncStore((s) => s.isSyncing)
  const lastSyncLog = useOfflineSyncStore((s) => s.logs[0])
  const updateStatus = useAppUpdateStore((s) => s.status)
  const updateDialogOpen = useAppUpdateStore((s) => s.dialogOpen)
  const updateVersion = useAppUpdateStore((s) => s.version)
  const updateShouldNotify = useAppUpdateStore((s) => s.shouldNotify)
  const updateIsMandatory = useAppUpdateStore((s) => s.isMandatory)
  const openUpdateDialog = useAppUpdateStore((s) => s.openDialog)
  const isAdmin = session?.user?.role === 'admin'
  const isCreator = session?.user?.role === 'creator'
  const user = session?.user

  const showBackgroundUpdate =
    updateStatus === 'downloading' &&
    !updateDialogOpen &&
    Boolean(updateVersion) &&
    (updateShouldNotify || updateIsMandatory)

  const navItems = [
    { label: t('nav.home'), path: '/portal' },
  ]

  const currentPath = location.pathname

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/'
    return currentPath.startsWith(path)
  }

  const themeOptions = [
    { value: 'light', label: t('profile.themeLight'), icon: Sun },
    { value: 'dark', label: t('profile.themeDark'), icon: Moon },
    { value: 'system', label: t('profile.themeSystem'), icon: Monitor },
  ]

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false)
      }
    }
    if (themeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [themeMenuOpen])

  useEffect(() => {
    if (session?.user?.id) {
      void ensureUserLoaded(session.user.id)
    }
  }, [ensureUserLoaded, session?.user?.id])

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center px-3 lg:px-4">
        {/* Logo - 桌面端 */}
        <Link to="/portal" className="mr-8 hidden lg:flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt={t('app.name')}
            className="h-7 w-auto dark:invert"
          />
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden lg:flex items-center gap-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-1.5 lg:gap-2 ml-auto">
          {/* 桌面端：后台管理 + 主题切换 */}
          <div className="hidden lg:flex items-center gap-2">
            {(isAdmin || isCreator) && (
              <Link to={managementHome(session?.user?.role)}>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  {isCreator ? '创作管理' : t('common.adminPanel')}
                </Button>
              </Link>
            )}

            <div className="relative" ref={themeMenuRef}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="h-8 w-8"
              >
                <ThemeIcon className="h-4 w-4" />
              </Button>
              {themeMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-border bg-popover p-1 shadow-md z-50">
                  {themeOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setTheme(value)
                        setThemeMenuOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        theme === value
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showBackgroundUpdate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={openUpdateDialog}
                aria-label={t('settings.downloading2')}
                className="h-8 w-8 text-primary"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            )}

            {user && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="打开账号菜单"
                    className="relative block rounded-full p-0.5 transition-colors hover:bg-muted"
                  >
                    <UserAvatar className="size-8" fallbackClassName="bg-muted text-xs font-semibold text-foreground" />
                    {isSyncing && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                        <Loader2 className="size-3 animate-spin text-primary" />
                      </span>
                    )}
                    {isDevHost && (
                      <span className="absolute -left-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm ring-1 ring-amber-600">
                        <Wrench className="size-2.5" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2">
                  <div className="px-2 py-2">
                    <p className="truncate text-sm font-medium">{user.name || '用户'}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => void signOut().then(() => navigate('/auth/login'))}
                  >
                    <LogOut data-icon="inline-start" />
                    退出登录
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
