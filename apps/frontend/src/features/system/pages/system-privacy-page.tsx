import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import PrivacyPolicyContent from '../content/privacy-policy.md?raw'
import { MarkdownContent } from '../components/markdown-content'
import { SystemContentLayout } from '../components/system-content-layout'
import { useLayoutStore } from '@/stores/layout.store'
import { useIsMobile } from '@/hooks/use-mobile'

export function SystemPrivacyPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const setBottomNavVisible = useLayoutStore((s) => s.setBottomNavVisible)

  useEffect(() => {
    if (isMobile) setBottomNavVisible(false)
    return () => {
      if (isMobile) setBottomNavVisible(true)
    }
  }, [isMobile, setBottomNavVisible])

  return (
    <SystemContentLayout title={t('system.privacy')}>
      <MarkdownContent content={PrivacyPolicyContent} />
    </SystemContentLayout>
  )
}
