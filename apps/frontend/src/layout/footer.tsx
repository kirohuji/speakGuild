import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-[1480px] px-4 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('app.name')}</span>
            <span className="text-muted-foreground text-sm">{t('app.tagline')}</span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">{t('nav.library')}</Link>
            <Link to="/mock" className="hover:text-foreground transition-colors">{t('nav.mock')}</Link>
            <Link to="/member" className="hover:text-foreground transition-colors">{t('nav.member')}</Link>
            <Link to="/profile" className="hover:text-foreground transition-colors">{t('nav.profile')}</Link>
          </nav>

          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap justify-center sm:justify-start">
            <Link to="/system/privacy" className="hover:text-foreground transition-colors">{t('footer.privacy')}</Link>
            <Link to="/system/privacy-concise" className="hover:text-foreground transition-colors">{t('footer.privacyConcise')}</Link>
            <Link to="/system/terms" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link>
            <Link to="/system/permissions" className="hover:text-foreground transition-colors">{t('footer.permissions')}</Link>
            <Link to="/system/sdk-list" className="hover:text-foreground transition-colors">SDK目录</Link>
            <Link to="/system/collect-info" className="hover:text-foreground transition-colors">信息收集清单</Link>
            <Link to="/system/icp" className="hover:text-foreground transition-colors">ICP备案</Link>
            <Link to="/system/contact" className="hover:text-foreground transition-colors">联系我们</Link>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} 漫语町. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
