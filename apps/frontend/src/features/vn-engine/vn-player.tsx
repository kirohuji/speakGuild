import { useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'

export interface VnPlayerLine {
  speaker?: string
  text: string
  isUser?: boolean
}

export interface VnPlayerChoice {
  index: number
  text: string
}

interface VnPlayerProps {
  backgroundUrl?: string
  currentLine?: VnPlayerLine | null
  history?: VnPlayerLine[]
  choices?: VnPlayerChoice[]
  currentSpriteUrl?: string
  spriteAlt?: string
  spritePosition?: 'left' | 'center' | 'right'
  isWaiting?: boolean
  isEnded?: boolean
  onAdvance?: () => void
  onChoice?: (index: number) => void
  onReset?: () => void
  className?: string
  stageClassName?: string
}

export function VnPlayer({
  backgroundUrl,
  currentLine,
  history = [],
  choices = [],
  currentSpriteUrl,
  spriteAlt,
  spritePosition = 'left',
  isWaiting = false,
  isEnded = false,
  onAdvance,
  onChoice,
  onReset,
  className,
  stageClassName,
}: VnPlayerProps) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const canAdvance = !!onAdvance && !isEnded && !isWaiting && choices.length === 0

  return (
    <div className={cn('relative mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-black text-white sm:rounded-xl sm:border sm:border-border', className)}>
      <div
        role="button"
        tabIndex={canAdvance ? 0 : -1}
        aria-label="推进对话"
        className={cn(
          'relative min-h-[620px] flex-1 overflow-hidden text-left outline-none',
          canAdvance && 'cursor-pointer',
          stageClassName,
        )}
        onClick={() => { if (canAdvance) onAdvance?.() }}
        onKeyDown={(e) => {
          if (canAdvance && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onAdvance?.()
          }
        }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: backgroundUrl
              ? `url(${backgroundUrl})`
              : 'linear-gradient(160deg, #141827 0%, #203647 52%, #0e1118 100%)',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(to_top,rgba(0,0,0,0.76),rgba(0,0,0,0.12)_48%,rgba(0,0,0,0.34))]" />

        <div className="absolute right-3 top-3 z-30 flex gap-2">
          <span
            role="button"
            tabIndex={0}
            className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white"
            onClick={(e) => { e.stopPropagation(); setHistoryOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                setHistoryOpen(true)
              }
            }}
          >
            <History className="size-4" />
          </span>
          {onReset && (
            <span
              role="button"
              tabIndex={0}
              className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white"
              onClick={(e) => { e.stopPropagation(); onReset() }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onReset()
                }
              }}
            >
              <RotateCcw className="size-4" />
            </span>
          )}
        </div>

        {currentSpriteUrl && (
          <div
            className={cn(
              'absolute bottom-[118px] z-10 flex h-[58%] max-h-[430px] items-end transition-all duration-500',
              spritePosition === 'left' && 'left-2 justify-start',
              spritePosition === 'center' && 'left-1/2 -translate-x-1/2 justify-center',
              spritePosition === 'right' && 'right-2 justify-end',
            )}
          >
            <img
              src={currentSpriteUrl}
              alt={spriteAlt}
              className="h-full max-w-[72vw] object-contain drop-shadow-[0_22px_30px_rgba(0,0,0,0.55)]"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}

        {choices.length > 0 && (
          <div className="absolute inset-x-5 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
            {choices.map((choice) => (
              <span
                key={choice.index}
                role="button"
                tabIndex={0}
                className="rounded-lg border border-white/20 bg-black/58 px-4 py-3 text-center text-sm font-medium text-white shadow-xl backdrop-blur-md transition-colors hover:border-white/45 hover:bg-black/72"
                onClick={(e) => { e.stopPropagation(); onChoice?.(choice.index) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChoice?.(choice.index)
                  }
                }}
              >
                {choice.text}
              </span>
            ))}
          </div>
        )}

        <div className="absolute inset-x-3 bottom-3 z-20">
          {currentLine?.speaker && (
            <div className="ml-3 inline-flex min-w-24 max-w-[82%] items-center rounded-t-lg border border-white/20 border-b-0 bg-black/72 px-4 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-md">
              <span className="truncate">{currentLine.speaker}</span>
            </div>
          )}
          <div className="min-h-[112px] rounded-xl border border-white/20 bg-black/68 px-4 py-3 shadow-2xl backdrop-blur-md">
            {currentLine ? (
              <p className="text-[15px] leading-7 text-white">{currentLine.text}</p>
            ) : isEnded ? (
              <p className="text-center text-sm text-white/70">故事结束</p>
            ) : isWaiting ? (
              <p className="text-center text-sm text-white/70">等待用户输入...</p>
            ) : (
              <p className="text-center text-sm text-white/55">点击继续</p>
            )}
            {canAdvance && (
              <span className="absolute bottom-3 right-5 text-xs text-white/55">点击继续</span>
            )}
          </div>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[82vh] max-w-md overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>历史对话</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[64vh]">
            <div className="space-y-3 p-5">
              {history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">还没有历史对话</p>
              ) : history.map((line, index) => (
                <div key={index} className={cn('rounded-lg border p-3', line.isUser ? 'bg-primary/5' : 'bg-muted/30')}>
                  {line.speaker && <p className="mb-1 text-xs font-semibold text-muted-foreground">{line.speaker}</p>}
                  <p className="text-sm leading-relaxed">{line.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
