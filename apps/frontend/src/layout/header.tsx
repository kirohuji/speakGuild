import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, User, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { NotificationBell } from '@/features/notification/components/notification-bell'

const navItems = [
  { key: 'library', path: '/' },
  { key: 'mock', path: '/mock' },
  { key: 'member', path: '/member' },
]

export function Header() {
  const { t } = useTranslation()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const { session } = useAuth()
  const isAdmin = session?.user?.role === 'admin'
  const isLoggedIn = !!session

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

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center px-3 lg:px-4">
        {/* Logo - 桌面端 */}
        <Link to="/" className="mr-8 hidden lg:flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt="GuideReady 导游说"
            className="h-7 w-auto dark:invert"
          />
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden lg:flex items-center gap-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-1.5 lg:gap-2 ml-auto">
          {/* 通知铃铛 - 仅桌面端，需登录 */}
          {isLoggedIn && (
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
          )}

          {/* 桌面端：后台管理 + 主题切换 + 个人中心 */}
          <div className="hidden lg:flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin/users">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  后台管理
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

            {isLoggedIn && (
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
