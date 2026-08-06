import { ChevronRight, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { Button } from '@/components/ui/button'

type Props = {
  questionMarkdown?: string | null
  durationMinutes?: number | null
  questionCount?: number
  wordCount?: number | null
  onStart?: () => void
}

export function ReadingTaskCard({ questionMarkdown, durationMinutes, questionCount = 0, wordCount, onStart }: Props) {
  const { t } = useTranslation()
  return (
    <section className="rounded-lg bg-primary/[0.045] p-4" aria-label={t('learning.readingTaskTitle')}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-primary" /><p className="text-sm font-semibold">{t('learning.readingTaskTitle')}</p></div>
        <span className="text-right text-xs leading-5 text-muted-foreground">{durationMinutes ? `${t('learning.minutesWithCount', { count: durationMinutes })} · ` : ''}{t('learning.questionCountLabel', { count: questionCount })}{wordCount ? ` · ${t('learning.wordCountLabel', { count: wordCount })}` : ''}</span>
      </div>
      {questionMarkdown?.trim()
        ? <MarkdownRenderer content={questionMarkdown} className="text-[15px] leading-7 prose-p:my-3 prose-img:my-4 prose-img:w-full prose-img:object-contain" />
        : <p className="text-sm text-muted-foreground">{t('learning.noReadingQuestion')}</p>}
      {onStart && <Button size="lg" className="mt-5 w-full" onClick={onStart}>{t('learning.startAnswering')}<ChevronRight className="ml-1 size-4" /></Button>}
    </section>
  )
}
