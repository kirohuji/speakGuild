import { ChevronRight, FileText } from 'lucide-react'
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
  return (
    <section className="rounded-lg bg-primary/[0.045] p-4" aria-label="阅读题目">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-primary" /><p className="text-sm font-semibold">阅读题目</p></div>
        <span className="text-right text-xs leading-5 text-muted-foreground">{durationMinutes ? `${durationMinutes} 分钟 · ` : ''}{questionCount} 题{wordCount ? ` · ${wordCount} 词` : ''}</span>
      </div>
      {questionMarkdown?.trim()
        ? <MarkdownRenderer content={questionMarkdown} className="text-[15px] leading-7 prose-p:my-3 prose-img:my-4 prose-img:w-full prose-img:object-contain" />
        : <p className="text-sm text-muted-foreground">暂未配置阅读题目。</p>}
      {onStart && <Button size="lg" className="mt-5 w-full" onClick={onStart}>开始答题<ChevronRight className="ml-1 size-4" /></Button>}
    </section>
  )
}
