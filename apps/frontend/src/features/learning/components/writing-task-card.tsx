import { ChevronRight, FilePenLine } from 'lucide-react'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { Button } from '@/components/ui/button'

type Props = {
  questionMarkdown?: string | null
  promptEn?: string | null
  promptZh?: string | null
  genre?: string | null
  minWords?: number | null
  maxWords?: number | null
  durationMinutes?: number | null
  hasDraft?: boolean
  onStart?: () => void
}

export function WritingTaskCard({
  questionMarkdown,
  promptEn,
  promptZh,
  genre,
  minWords,
  maxWords,
  durationMinutes,
  hasDraft = false,
  onStart,
}: Props) {
  const question = questionMarkdown?.trim()

  return (
    <section className="rounded-lg bg-accent/[0.06] p-4" aria-label="写作题目">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FilePenLine className="size-4 shrink-0 text-accent" />
          <p className="text-sm font-semibold text-foreground">写作题目</p>
        </div>
        <span className="text-right text-xs leading-5 text-muted-foreground">
          {durationMinutes ? `${durationMinutes} 分钟 · ` : ''}{genre || '自由写作'}
          {minWords ? ` · ${minWords}–${maxWords ?? '∞'} 词` : ''}
        </span>
      </div>

      {question ? (
        <MarkdownRenderer
          content={question}
          className="text-[15px] leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-headings:text-foreground prose-p:my-3 prose-p:leading-7 prose-li:my-1 prose-img:my-4 prose-img:w-full prose-img:object-contain"
        />
      ) : (
        promptEn?.trim() || promptZh?.trim() ? null : (
          <p className="text-sm leading-6 text-muted-foreground">暂未配置题目正文。</p>
        )
      )}

      {(promptEn?.trim() || promptZh?.trim()) && (
        <div className={question ? 'mt-4 border-t border-border/50 pt-4' : ''}>
          {promptEn?.trim() && <p className="text-lg font-semibold leading-7 text-foreground">{promptEn}</p>}
          {promptZh?.trim() && <p className="mt-2 text-sm leading-6 text-muted-foreground">{promptZh}</p>}
        </div>
      )}

      {onStart && (
        <Button className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" size="lg" onClick={onStart}>
          {hasDraft ? '继续写作' : '开始写作'}<ChevronRight className="size-4" />
        </Button>
      )}
    </section>
  )
}
