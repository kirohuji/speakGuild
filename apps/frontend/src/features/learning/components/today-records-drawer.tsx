import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock3, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!z-[10001] h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 pt-safe md:h-[88vh] md:max-w-3xl md:rounded-2xl md:pt-0 [&>button]:hidden">
        <DialogTitle className="sr-only">今日练习记录</DialogTitle>
        <DialogDescription className="sr-only">查看已完成的练习题目与评分</DialogDescription>

        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3">
            <h2 className="text-lg font-semibold text-foreground">今日练习记录</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-4 pb-8">
            {records.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <ClipboardList className="size-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">暂无练习记录</p>
                <p className="text-xs text-muted-foreground/60">完成题目提交后会自动记录</p>
              </div>
            ) : (
              <div className="space-y-2 pt-4">
                {records.map((record, idx) => {
                  const step = steps.find((s) => s.id === record.stepId)
                  const stepIndex = steps.findIndex((s) => s.id === record.stepId)
                  return (
                    <div key={record.stepId || idx} className="rounded-lg border bg-card p-3">
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
                            <Badge variant="outline" className="text-[10px]">{step?.displayLabel || '练习'}</Badge>
                            {step?.topicTitle && (
                              <span className="truncate text-xs font-medium text-foreground">{step.topicTitle}</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-foreground">{record.zh}</p>
                          {record.answer && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {record.answer}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Clock3 className="size-3" />
                            <span>第 {stepIndex >= 0 ? stepIndex + 1 : '?'} 题</span>
                            {record.score && (
                              <>
                                <span>·</span>
                                <span className={cn(
                                  record.score === 'strong' && 'text-green-600',
                                  record.score === 'ok' && 'text-blue-600',
                                  record.score === 'weak' && 'text-amber-600',
                                  record.score === 'miss' && 'text-red-500',
                                )}>
                                  {record.score === 'strong' ? '熟练' : record.score === 'ok' ? '通过' : record.score === 'weak' ? '待稳' : '复练'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (stepIndex >= 0) onReplay(stepIndex)
                          }}
                          className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="回放此题"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
