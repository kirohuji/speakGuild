import { useState } from 'react'
import { BookOpen, Target, Lightbulb, ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'

interface Objective {
  text: string
  completed: boolean
}

interface ChunkHint {
  text: string
  meaning: string
}

interface PracticeVnDrawerProps {
  /** 左侧：任务目标 */
  objectives: Objective[]
  /** 右侧：当前提示（AI 给的关键词/句型建议） */
  hints: { type: 'chunk' | 'pattern'; text: string; meaning?: string; example?: string }[]
  /** 右侧：核心表达列表 */
  coreChunks: ChunkHint[]
  /** 已使用 chunk 文本集合 */
  usedChunkTexts: Set<string>
}

/** VN 练习模式的左右侧抽屉 */
export function PracticeVnDrawer({
  objectives,
  hints,
  coreChunks,
  usedChunkTexts,
}: PracticeVnDrawerProps) {
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  const completedCount = objectives.filter((o) => o.completed).length

  return (
    <>
      {/* Left drawer toggle */}
      <button
        onClick={() => { setLeftOpen(!leftOpen); if (rightOpen) setRightOpen(false) }}
        className="fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-lg border border-border bg-background/90 p-2 shadow-md backdrop-blur-sm transition-all hover:bg-muted"
        title="任务目标"
      >
        <ChevronRight className={cn('size-4 transition-transform', leftOpen && 'rotate-180')} />
      </button>

      {/* Left drawer panel */}
      <div
        className={cn(
          'fixed left-0 top-0 z-40 h-full w-72 border-r border-border bg-background/95 shadow-xl backdrop-blur-md transition-transform duration-300 ease-in-out',
          leftOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">任务目标</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setLeftOpen(false)}>
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          <div className="px-4 pb-2">
            <Progress value={(completedCount / Math.max(objectives.length, 1)) * 100} className="h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              {completedCount}/{objectives.length} 完成
            </p>
          </div>

          <Separator />

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {objectives.map((obj, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 transition-all',
                    obj.completed
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-border bg-card',
                  )}
                >
                  {obj.completed ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(
                    'text-sm',
                    obj.completed ? 'text-foreground line-through opacity-60' : 'text-foreground',
                  )}>
                    {obj.text}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right drawer toggle */}
      <button
        onClick={() => { setRightOpen(!rightOpen); if (leftOpen) setLeftOpen(false) }}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg border border-border bg-background/90 p-2 shadow-md backdrop-blur-sm transition-all hover:bg-muted"
        title="表达提示"
      >
        <ChevronLeft className={cn('size-4 transition-transform', rightOpen && 'rotate-180')} />
      </button>

      {/* Right drawer panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-40 h-full w-72 border-l border-border bg-background/95 shadow-xl backdrop-blur-md transition-transform duration-300 ease-in-out',
          rightOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">表达提示</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setRightOpen(false)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Separator />

          <ScrollArea className="flex-1 p-4">
            {/* AI 实时提示 */}
            {hints.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">💡 当前提示</p>
                <div className="space-y-2">
                  {hints.map((hint, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg border p-3',
                        hint.type === 'chunk'
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-blue-500/30 bg-blue-500/5',
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{hint.text}</p>
                      {hint.meaning && (
                        <p className="mt-1 text-xs text-muted-foreground">{hint.meaning}</p>
                      )}
                      {hint.example && (
                        <p className="mt-1 text-xs italic text-muted-foreground">{hint.example}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 核心表达 CheckList */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                <BookOpen className="mr-1 inline size-3" />
                核心表达 ({usedChunkTexts.size}/{coreChunks.length})
              </p>
              <div className="space-y-2">
                {coreChunks.map((chunk, i) => {
                  const isUsed = usedChunkTexts.has(chunk.text)
                  return (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg border p-2.5 transition-all',
                        isUsed
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-border bg-card',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {isUsed ? (
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                        ) : (
                          <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <div>
                          <Badge variant={isUsed ? 'default' : 'outline'} className="text-xs">
                            {chunk.text}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">{chunk.meaning}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Overlay when any drawer is open */}
      {(leftOpen || rightOpen) && (
        <div
          className="fixed inset-0 z-10 bg-black/20 backdrop-blur-sm"
          onClick={() => { setLeftOpen(false); setRightOpen(false) }}
        />
      )}
    </>
  )
}
