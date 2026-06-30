import { ChevronDown, ChevronRight, CheckCircle2, XCircle, ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'
import type { PracticeItem } from '../pages/today-task-page'
import type { WarmupRecordEntry } from '@/stores/warmup-session.store'

interface TodayRecordsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: WarmupRecordEntry[]
  steps: PracticeItem[]
  onReplay: (stepIndex: number) => void
}

export function TodayRecordsDrawer({ open, onOpenChange, records, steps, onReplay }: TodayRecordsDrawerProps) {
  const { t } = useTranslation()

  const scoreLabels = {
    strong: t('todayTask.scoreStrong'),
    ok: t('todayTask.scoreOk'),
    weak: t('todayTask.scoreWeak'),
    miss: t('todayTask.scoreMiss'),
  }

  const sourceLabel = (record: WarmupRecordEntry) => {
    if (record.recordId?.startsWith('guided-warmup:')) return t('learning.warmupPractice')
    return t('todayTask.todayPractice')
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="!z-[10001] flex h-[95dvh] max-h-[95dvh] w-full max-w-full flex-col overflow-hidden rounded-t-[28px] border-border/70 bg-background p-0 drawer-surface"
        overlayClassName="!z-[10001]"
      >
        <DrawerTitle className="sr-only">{t('todayTask.todayPracticeRecords')}</DrawerTitle>

        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 pb-3 pt-2">
            <h2 className="text-base font-semibold text-foreground">{t('todayTask.todayPracticeRecords')}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
            {records.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <ClipboardList className="size-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">{t('todayTask.noTodayPracticeRecords')}</p>
                <p className="text-xs text-muted-foreground/60">{t('todayTask.todayPracticeRecordsEmptyHint')}</p>
              </div>
            ) : (
              <div className="space-y-2 pt-4">
                {records.map((record, idx) => {
                  const step = steps.find((s) => s.id === record.stepId)
                  const stepIndex = steps.findIndex((s) => s.id === record.stepId)
                  return (
                    <div key={`${record.stepId || 'record'}-${idx}`} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          record.passed
                            ? 'bg-green-500/15 text-green-600'
                            : 'bg-red-500/15 text-red-500',
                        )}>
                          {record.passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{step?.displayLabel || record.displayLabel || t('todayTask.practice')}</Badge>
                            <span className="truncate text-xs font-medium text-muted-foreground">{sourceLabel(record)}</span>
                          </div>
                          <p className="mt-1 text-sm text-foreground">{record.zh}</p>
                          {record.answer && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {record.answer}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                            {record.score && (
                              <span className={cn(
                                record.score === 'strong' && 'text-green-600',
                                record.score === 'ok' && 'text-blue-600',
                                record.score === 'weak' && 'text-amber-600',
                                record.score === 'miss' && 'text-red-500',
                              )}>
                                {scoreLabels[record.score]}
                              </span>
                            )}
                            {record.practiceCount && record.practiceCount > 1 && (
                              <>
                                <span>·</span>
                                <span>练习 {record.practiceCount} 次</span>
                              </>
                            )}
                          </div>
                        </div>
                        {stepIndex >= 0 && (
                          <button
                            type="button"
                            onClick={() => onReplay(stepIndex)}
                            className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title={t('todayTask.replayQuestion')}
                          >
                            <ChevronRight className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
