import { useTranslation } from 'react-i18next'
import TermsOfServiceContent from '../content/terms-of-service.md?raw'
import { MarkdownContent } from '../components/markdown-content'
import { SystemArticleLayout } from '../components/system-article-layout'

export function SystemTermsPage() {
  const { t } = useTranslation()

  return (
    <SystemArticleLayout title={t('system.terms')}>
      <MarkdownContent content={TermsOfServiceContent} />
    </SystemArticleLayout>
  )
}
