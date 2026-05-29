import { cn } from '@/lib/cn'

interface DialogueBoxProps {
  speaker?: string
  text: string
  isCurrent?: boolean
  className?: string
  avatarUrl?: string
  avatarAlt?: string
}

/** Ren'Py 风格底栏对话框 */
export function DialogueBox({ speaker, text, isCurrent, className, avatarUrl, avatarAlt }: DialogueBoxProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur-sm transition-opacity',
        !isCurrent && 'opacity-50',
        className,
      )}
    >
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={avatarAlt || speaker || ''}
          className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-border"
        />
      )}
      <div className="min-w-0">
        {speaker && (
          <div className="mb-1 inline-block rounded bg-primary/15 px-2 py-0.5">
            <span className="text-xs font-semibold text-primary">{speaker}</span>
          </div>
        )}
        <p className="text-sm leading-relaxed text-foreground">{text}</p>
      </div>
    </div>
  )
}
