import { CheckCircle2, ChevronDown, ChevronUp, Lightbulb, Mic2, ThumbsDown, ThumbsUp, Trophy, Pencil } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

type AiFeedback = {
  score: number
  level: string
  summary: string
  strengths: string[]
  improvements: string[]
  languageNotes: string[]
  pronunciationNotes: string[] | null
  revisedAnswer: string
  keywordsUsed: string[]
  keywordsMissed: string[]
}

type AiFeedbackCardProps = {
  feedback: AiFeedback
  className?: string
}

const SCORE_COLOR = (s: number) =>
  s >= 90 ? 'text-emerald-600 dark:text-emerald-400'
  : s >= 75 ? 'text-blue-600 dark:text-blue-400'
  : s >= 60 ? 'text-amber-600 dark:text-amber-400'
  : 'text-red-600 dark:text-red-400'

const SCORE_BG = (s: number) =>
  s >= 90 ? 'bg-emerald-50 dark:bg-emerald-900/20'
  : s >= 75 ? 'bg-blue-50 dark:bg-blue-900/20'
  : s >= 60 ? 'bg-amber-50 dark:bg-amber-900/20'
  : 'bg-red-50 dark:bg-red-900/20'

const SCORE_RING = (s: number) =>
  s >= 90 ? 'ring-emerald-200 dark:ring-emerald-700'
  : s >= 75 ? 'ring-blue-200 dark:ring-blue-700'
  : s >= 60 ? 'ring-amber-200 dark:ring-amber-700'
  : 'ring-red-200 dark:ring-red-700'

export function AiFeedbackCard({ feedback, className }: AiFeedbackCardProps) {
  const [showRevised, setShowRevised] = useState(false)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Score header */}
      <div className={cn('flex items-center gap-4 rounded-2xl p-4 ring-1', SCORE_BG(feedback.score), SCORE_RING(feedback.score))}>
        <div className={cn('flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-center ring-2', SCORE_BG(feedback.score), SCORE_RING(feedback.score))}>
          <span className={cn('text-2xl font-bold tabular-nums leading-none', SCORE_COLOR(feedback.score))}>
            {feedback.score}
          </span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">/ 100</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Trophy className={cn('size-4', SCORE_COLOR(feedback.score))} />
            <span className={cn('font-semibold', SCORE_COLOR(feedback.score))}>{feedback.level}</span>
          </div>
          <p className="mt-1 text-sm text-foreground/80">{feedback.summary}</p>
        </div>
      </div>

      {/* Keywords */}
      {(feedback.keywordsUsed.length > 0 || feedback.keywordsMissed.length > 0) && (
        <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-none dark:ring-1 dark:ring-white/[0.07]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">关键词覆盖</p>
          <div className="flex flex-wrap gap-1.5">
            {feedback.keywordsUsed.map((k) => (
              <span key={k} className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="size-3" />{k}
              </span>
            ))}
            {feedback.keywordsMissed.map((k) => (
              <span key={k} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground line-through">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {feedback.strengths.length > 0 && (
        <FeedbackSection
          icon={<ThumbsUp className="size-4 text-emerald-600" />}
          title="做得好"
          items={feedback.strengths}
          itemClass="text-foreground/80"
          dotClass="bg-emerald-500"
        />
      )}

      {/* Improvements */}
      {feedback.improvements.length > 0 && (
        <FeedbackSection
          icon={<ThumbsDown className="size-4 text-amber-600" />}
          title="可以改进"
          items={feedback.improvements}
          itemClass="text-foreground/80"
          dotClass="bg-amber-500"
        />
      )}

      {/* Language notes */}
      {feedback.languageNotes.length > 0 && (
        <FeedbackSection
          icon={<Lightbulb className="size-4 text-blue-600" />}
          title="语言建议"
          items={feedback.languageNotes}
          itemClass="text-foreground/80"
          dotClass="bg-blue-500"
        />
      )}

      {/* Pronunciation notes (voice only) */}
      {feedback.pronunciationNotes && feedback.pronunciationNotes.length > 0 && (
        <FeedbackSection
          icon={<Mic2 className="size-4 text-purple-600" />}
          title="发音建议"
          items={feedback.pronunciationNotes}
          itemClass="text-foreground/80"
          dotClass="bg-purple-500"
        />
      )}

      {/* Revised answer */}
      {feedback.revisedAnswer && (
        <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-none dark:ring-1 dark:ring-white/[0.07]">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setShowRevised((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" />
              <span className="text-sm font-semibold">参考改进版本</span>
            </div>
            {showRevised
              ? <ChevronUp className="size-4 text-muted-foreground" />
              : <ChevronDown className="size-4 text-muted-foreground" />
            }
          </button>
          {showRevised && (
            <p className="mt-3 text-sm leading-relaxed text-foreground/80 border-t border-border/50 pt-3">
              {feedback.revisedAnswer}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackSection({
  icon, title, items, itemClass, dotClass,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
  itemClass?: string
  dotClass?: string
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-none dark:ring-1 dark:ring-white/[0.07]">
      <div className="mb-2.5 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', dotClass)} />
            <span className={cn('text-sm leading-relaxed', itemClass)}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
