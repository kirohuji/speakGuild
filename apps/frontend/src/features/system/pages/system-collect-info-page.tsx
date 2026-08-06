import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import CollectInfoContent from '../content/collect-info-list.md?raw'
import { MarkdownContent } from '../components/markdown-content'
import { SystemContentLayout } from '../components/system-content-layout'
import { useLayoutStore } from '@/stores/layout.store'
import { useIsMobile } from '@/hooks/use-mobile'

export function SystemCollectInfoPage() {
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
    <SystemContentLayout title={t('system.collectInfo')}>
      <MarkdownContent content={CollectInfoContent} />
    </SystemContentLayout>
  )
}
