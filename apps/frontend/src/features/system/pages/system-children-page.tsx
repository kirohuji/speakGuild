import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ChildrenPrivacyContent from '../content/privacy-children.md?raw'
import { MarkdownContent } from '../components/markdown-content'
import { SystemContentLayout } from '../components/system-content-layout'
import { useLayoutStore } from '@/stores/layout.store'
import { useIsMobile } from '@/hooks/use-mobile'

export function SystemChildrenPrivacyPage() {
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
    <SystemContentLayout title={t('system.children')}>
      <MarkdownContent content={ChildrenPrivacyContent} />
    </SystemContentLayout>
  )
}
