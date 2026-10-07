import { CheckCircle2, ChevronRight, FilePenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { Button } from '@/components/ui/button'

type Props = {
  questionMarkdown?: string | null
  promptEn?: string | null
  promptZh?: string | null
  requirements?: string[]
  genre?: string | null
  minWords?: number | null
  maxWords?: number | null
  durationMinutes?: number | null
  hasDraft?: boolean
  onStart?: () => void
}

function withoutWritingSections(markdown: string | null | undefined, hiddenTitles: Set<string>) {
  if (!markdown?.trim()) return ''

  let skippedHeadingLevel: number | null = null
  const visibleLines: string[] = []

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      const level = heading[1].length
      const title = heading[2].replace(/[：:]/g, '').trim()
      if (skippedHeadingLevel !== null && level <= skippedHeadingLevel) skippedHeadingLevel = null
      if (hiddenTitles.has(title)) {
        skippedHeadingLevel = level
        continue
      }
    }
    if (skippedHeadingLevel === null) visibleLines.push(line)
  }

  return visibleLines.join('\n').trim()
}

/** Requirements have their own learner-facing cards. */
export function withoutWritingRequirements(markdown?: string | null) {
  return withoutWritingSections(markdown, new Set(['写作要求']))
}

/** The preparation sheet is deliberately concise; support prompts belong in the editor drawer. */
export function withoutWritingPreparationSupport(markdown?: string | null) {
  return withoutWritingSections(markdown, new Set(['写作要求', '提示', '写作提示']))
}

export function WritingTaskCard({
  questionMarkdown,
  promptEn,
  promptZh,
  requirements = [],
  genre,
  minWords,
  maxWords,
  durationMinutes,
  hasDraft = false,
  onStart,
}: Props) {
  const { t } = useTranslation()
  const question = withoutWritingPreparationSupport(questionMarkdown)
  const showSupplementalPrompt = Boolean(
    (genre === 'translation' || genre === 'dialogue') && !question && (promptEn?.trim() || promptZh?.trim()),
  )

  return (
    <section className="rounded-lg bg-accent/[0.06] p-4" aria-label={t('learning.writingTaskTitle')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FilePenLine className="size-4 shrink-0 text-accent" />
          <p className="text-sm font-semibold text-foreground">{t('learning.writingTaskTitle')}</p>
        </div>
        <span className="text-right text-xs leading-5 text-muted-foreground">
          {durationMinutes ? `${t('learning.minutesWithCount', { count: durationMinutes })} · ` : ''}{({ message: '消息', journal: '日记', email: '邮件', paragraph: '短段落', essay: '议论文', dialogue: '对话', translation: '中英互译' } as Record<string, string>)[genre ?? ''] || genre || t('learning.freeWriting')}
          {minWords ? ` · ${t('learning.wordRange', { min: minWords, max: maxWords ?? '∞' })}` : ''}
        </span>
      </div>

      {question ? (
        <MarkdownRenderer
          content={question}
          className="text-[15px] leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-headings:text-foreground prose-p:my-3 prose-p:leading-7 prose-li:my-1 prose-img:my-4 prose-img:w-full prose-img:object-contain"
        />
      ) : (
        showSupplementalPrompt ? null : (
          <p className="text-sm leading-6 text-muted-foreground">{t('learning.noWritingQuestion')}</p>
        )
      )}

      {showSupplementalPrompt && (
        <div className={question ? 'mt-4 border-t border-border/50 pt-4' : ''}>
          {promptEn?.trim() && <p className="text-lg font-semibold leading-7 text-foreground">{promptEn}</p>}
          {promptZh?.trim() && <p className="mt-2 text-sm leading-6 text-muted-foreground">{promptZh}</p>}
        </div>
      )}

      {requirements.length > 0 && (
        <section className="mt-5 border-t border-border/50 pt-4">
          <h2 className="text-base font-semibold text-foreground">{t('learning.writingRequirements')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('learning.requirementsHint')}</p>
          <div className="mt-3 space-y-2">
            {requirements.map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{t('learning.requirementNumber', { number: index + 1 })}</p>
                  <p className="mt-0.5 text-sm font-medium leading-5 text-foreground">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {onStart && (
        <Button className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" size="lg" onClick={onStart}>
          {hasDraft ? t('learning.continueWriting') : t('learning.startWriting')}<ChevronRight className="size-4" />
        </Button>
      )}
    </section>
  )
}
