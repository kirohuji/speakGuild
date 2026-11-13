import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { isNative } from '@/lib/native/platform'

/**
 * 官网类页面（Portal / Marketing / Support / 隐私政策 / 服务条款）共用的顶部导航。
 */
export function LandingHeader() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  const navItems = [
    { to: '/portal', label: t('system.pages.portalNav'), hiddenOnMobile: false },
    { to: '/marketing', label: t('system.marketing.navProduct'), hiddenOnMobile: false },
    { to: '/support', label: t('system.marketing.navSupport'), hiddenOnMobile: false },
    { to: '/system/privacy', label: t('system.privacy'), hiddenOnMobile: true },
    { to: '/system/terms', label: t('system.terms'), hiddenOnMobile: true },
  ].filter((item) => !isNative() || item.to.startsWith('/system/') || item.to === '/support')

  return (
    <header className="sticky top-0 z-40 border-0 bg-background shadow-none">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={isNative() ? '/' : '/portal'} className="flex items-center gap-2">
          <img src="/logo.png" alt={t('app.name')} className="h-7 w-auto dark:invert" />
          <span className="hidden text-sm font-extrabold tracking-tight text-foreground sm:inline">
            {t('app.name')}
          </span>
        </Link>
        <nav className="flex items-center gap-3.5 text-xs text-muted-foreground sm:gap-6 sm:text-sm">
          {navItems.map((item) => {
            const active = pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  item.hiddenOnMobile && 'hidden sm:inline',
                  active ? 'font-medium text-foreground' : 'transition-colors hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

/** 官网类页面共用的页脚。 */
export function LandingFooter({ extraLinks }: { extraLinks?: ReactNode }) {
  const { t } = useTranslation()

  return (
    <footer className="border-0 shadow-none">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt={t('app.name')} className="size-8 dark:invert" />
              <span className="font-extrabold text-foreground">{t('app.name')}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('support.tagline')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
            {!isNative() && (
              <Link to="/portal" className="transition-colors hover:text-foreground">
                {t('system.pages.portalNav')}
              </Link>
            )}
            {!isNative() && (
              <Link to="/marketing" className="transition-colors hover:text-foreground">
                {t('system.marketing.navProduct')}
              </Link>
            )}
            <Link to="/support" className="transition-colors hover:text-foreground">
              {t('system.marketing.navSupport')}
            </Link>
            <Link to="/system/privacy" className="transition-colors hover:text-foreground">
              {t('system.privacy')}
            </Link>
            <Link to="/system/terms" className="transition-colors hover:text-foreground">
              {t('system.terms')}
            </Link>
            {extraLinks}
          </div>
        </div>
        <Separator className="my-6" />
        <p className="text-center text-[11px] text-muted-foreground/50">
          {t('support.copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  )
}
