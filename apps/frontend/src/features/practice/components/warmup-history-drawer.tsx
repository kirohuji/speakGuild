import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FileText, CheckCircle2, XCircle, Clock3, Target, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Drawer, DrawerContent, DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/cn'
import { warmupRecordApi, type WarmupRecord } from '../api/english-practice-api'

interface WarmupHistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  topicId: string
  topicTitle: string
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function WarmupHistoryDrawer({ open, onOpenChange, topicId, topicTitle }: WarmupHistoryDrawerProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<WarmupRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (open && topicId) {
      setLoading(true)
      warmupRecordApi.list(topicId)
        .then(setRecords)
        .catch(() => setRecords([]))
        .finally(() => setLoading(false))
    }
  }, [open, topicId])

  const typeLabel = (item: any) => {
    if (item.type === 'chunk_substitution') return '句块'
    if (item.type === 'pattern_drill') return '句型'
    if (item.type === 'vocab_drill') return '词汇'
    return '练习'
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85dvh] rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <History className="size-5" />
            练习记录
          </DrawerTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <ChevronDown className="size-5" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-4 pb-8">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">暂无练习记录</p>
              <p className="text-xs text-muted-foreground/60">完成知识点练习后会自动保存</p>
            </div>
          ) : (
            <div className="space-y-2 pt-4">
              {records.map((record) => {
                const totalItems = record.items?.length ?? 0
                const passedItems = record.items?.filter((i: any) => i.passed).length ?? 0
                const isExpanded = expandedId === record.id
                return (
                  <div key={record.id} className="rounded-lg border bg-card">
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    >
                      <div className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        record.score != null && record.score >= 80 ? 'bg-green-500/15 text-green-600' :
                        record.score != null && record.score >= 50 ? 'bg-amber-500/15 text-amber-600' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {record.score ?? '-'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{topicTitle}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="size-3" />
                          {fmtDate(record.createdAt)}
                          <span>·</span>
                          <Target className="size-3" />
                          {passedItems}/{totalItems} 通过
                        </div>
                      </div>
                      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                    </button>

                    {isExpanded && (
                      <div className="border-t px-4 py-3 space-y-3">
                        {record.feedback && (
                          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                            <p className="text-xs font-medium text-muted-foreground mb-1">AI 综合评估</p>
                            <p className="text-sm text-foreground">{record.feedback}</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          {record.items?.map((item: any, idx: number) => (
                            <div key={idx} className="rounded-lg border border-border/60 bg-background px-3 py-2.5 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                                <Badge variant="outline" className="text-[10px]">{typeLabel(item)}</Badge>
                                {item.passed ?
                                  <CheckCircle2 className="size-3.5 text-green-500" /> :
                                  <XCircle className="size-3.5 text-red-400" />
                                }
                                {item.groupTitle && <span className="text-[10px] text-muted-foreground truncate">{item.groupTitle}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">题目: {item.zh || item.promptZh}</p>
                              {item.answer || item.suggestedAnswer ? (
                                <p className="text-xs">答案: <span className="text-green-600 dark:text-green-400">{item.answer || item.suggestedAnswer}</span></p>
                              ) : null}
                              {item.userAnswer && (
                                <p className="text-xs">你的回答: <span className={cn(item.passed ? 'text-green-600' : 'text-red-500')}>{item.userAnswer}</span></p>
                              )}
                              {item.feedback && (
                                <p className="text-[10px] text-muted-foreground/70 italic">{item.feedback}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
