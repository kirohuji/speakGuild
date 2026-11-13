import { useTranslation } from 'react-i18next'
import PrivacyPolicyContent from '../content/privacy-policy.md?raw'
import { MarkdownContent } from '../components/markdown-content'
import { SystemArticleLayout } from '../components/system-article-layout'

export function SystemPrivacyPage() {
  const { t } = useTranslation()

  return (
    <SystemArticleLayout title={t('system.privacy')}>
      <MarkdownContent content={PrivacyPolicyContent} />
    </SystemArticleLayout>
  )
}
