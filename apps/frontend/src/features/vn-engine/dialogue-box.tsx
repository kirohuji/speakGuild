import { cn } from '@/lib/cn'

interface DialogueBoxProps {
  speaker?: string
  text: string
  isCurrent?: boolean
  className?: string
}

/** Ren'Py 风格底栏对话框 */
export function DialogueBox({ speaker, text, isCurrent, className }: DialogueBoxProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-sm transition-opacity',
        !isCurrent && 'opacity-50',
        className,
      )}
    >
      {speaker && (
        <div className="mb-1 inline-block rounded bg-primary/15 px-2 py-0.5">
          <span className="text-xs font-semibold text-primary">{speaker}</span>
        </div>
      )}
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  )
}
