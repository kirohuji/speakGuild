import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, CheckCircle2, Circle, Lightbulb, Target, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  objectives: Objective[]
  hints: { type: 'chunk' | 'pattern'; text: string; meaning?: string; example?: string }[]
  coreChunks: ChunkHint[]
  usedChunkTexts: Set<string>
  hideToggles?: boolean
  triggerClassName?: string
  compactTrigger?: boolean
  plainTrigger?: boolean
  showTriggerIcon?: boolean
}

export function PracticeVnDrawer({
  objectives,
  hints,
  coreChunks,
  usedChunkTexts,
  hideToggles = false,
  triggerClassName,
  compactTrigger = false,
  plainTrigger = false,
  showTriggerIcon = true,
}: PracticeVnDrawerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const completedCount = objectives.filter((objective) => objective.completed).length
  const currentObjective = objectives.find((objective) => !objective.completed) ?? objectives[0]
  const suggestedChunks = useMemo(() => {
    const unused = coreChunks.filter((chunk) => !usedChunkTexts.has(chunk.text))
    return (unused.length > 0 ? unused : coreChunks).slice(0, 3)
  }, [coreChunks, usedChunkTexts])
  const latestHint = hints[hints.length - 1]

  return (
    <>
      {!hideToggles && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            !plainTrigger && 'flex items-center gap-2 rounded-full border border-border/20 bg-background/60 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-2xl transition-transform active:scale-[0.97]',
            triggerClassName,
          )}
        >
          {showTriggerIcon && (
            compactTrigger
              ? <Lightbulb className="size-3.5 text-foreground/70" />
              : <Target className="size-3.5 text-rose-300" />
          )}
          <span>{compactTrigger ? t('practiceVn.hint') : t('practiceVn.objective')} {completedCount}/{objectives.length || 1}</span>
          {!compactTrigger && (
            <>
              <span className="h-1 w-1 rounded-full bg-foreground/30" />
              <span className="text-muted-foreground">{t('practiceVn.assistant')}</span>
            </>
          )}
        </button>
      )}

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[82vh] rounded-t-[28px] border-border/20 bg-background text-foreground shadow-[0_-24px_80px_rgba(0,0,0,.42)] backdrop-blur-2xl">
          <DrawerHeader className="px-5 pb-2 pt-3 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle className="text-base">{t('practiceVn.assistant')}</DrawerTitle>
                <DrawerDescription className="mt-1 text-xs">
                  {t('practiceVn.desc')}
                </DrawerDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="px-5 pb-3">
            <Progress value={(completedCount / Math.max(objectives.length, 1)) * 100} className="h-1.5" />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{t('practiceVn.taskProgress')}</span>
              <span>{completedCount}/{objectives.length || 1}</span>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <div className="space-y-3 pb-5">
              <section className="rounded-2xl border border-border/70 bg-card/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-rose-500/12 text-rose-300">
                    <Target className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t('practiceVn.whatToSay')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('practiceVn.intentOnly')}</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-foreground">
                  {currentObjective?.text || '围绕当前话题完成一轮自然回应'}
                </p>
              </section>

              <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-amber-300" />
                    <p className="text-sm font-semibold">{t('practiceVn.availableExpr')}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {usedChunkTexts.size}/{coreChunks.length || 1}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {suggestedChunks.length > 0 ? suggestedChunks.map((chunk) => {
                    const used = usedChunkTexts.has(chunk.text)
                    return (
                      <div
                        key={chunk.text}
                        className={cn(
                          'rounded-xl border px-3 py-2.5',
                          used ? 'border-green-400/30 bg-green-500/[0.08]' : 'border-border/70 bg-background/[0.42]',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {used ? (
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-400" />
                          ) : (
                            <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-5 text-foreground">{chunk.text}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{chunk.meaning}</p>
                          </div>
                        </div>
                      </div>
                    )
                  }) : (
                    <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                      {t('practiceVn.noRecommend')}
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-400" />
                    <p className="text-sm font-semibold">{t('practiceVn.taskProgress')}</p>
                </div>
                <div className="space-y-2">
                  {objectives.map((objective, index) => (
                    <div key={`${objective.text}-${index}`} className="flex items-start gap-2 rounded-xl bg-background/[0.34] px-3 py-2.5">
                      {objective.completed ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-400" />
                      ) : (
                        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <p className={cn('text-xs leading-5', objective.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
                        {objective.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {latestHint && (
                <section className="rounded-2xl border border-amber-300/24 bg-amber-300/[0.08] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb className="size-4 text-amber-300" />
                    <p className="text-sm font-semibold">{t('practiceVn.recentHint')}</p>
                  </div>
                  <p className="text-sm leading-6 text-foreground">{latestHint.text}</p>
                  {latestHint.meaning && <p className="mt-1 text-xs leading-5 text-muted-foreground">{latestHint.meaning}</p>}
                  {latestHint.example && <p className="mt-1 text-xs leading-5 text-muted-foreground">{latestHint.example}</p>}
                </section>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  )
}
