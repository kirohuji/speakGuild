import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FileText, CheckCircle2, XCircle, Clock3, Target, History, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Drawer, DrawerContent, DrawerTitle,
} from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { practiceRepository } from '@/lib/offline'
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

function warmupRecordFingerprint(record: WarmupRecord) {
  const items = Array.isArray(record.items) ? record.items : []
  return items
    .map((item: any) => `${item.stepId ?? ''}|${item.userAnswer ?? ''}|${item.answer ?? item.suggestedAnswer ?? ''}`)
    .join('::')
}

function warmupRecordKeys(record: WarmupRecord) {
  const keys = new Set<string>()
  const remoteId = (record as any).remoteId
  if (remoteId) keys.add(`remote:${remoteId}`)
  if (!String(record.id).startsWith('guided-warmup:') && !String(record.id).startsWith('today-warmup:') && !String(record.id).startsWith('warmup:')) {
    keys.add(`remote:${record.id}`)
  }
  const fingerprint = warmupRecordFingerprint(record)
  if (fingerprint) keys.add(`fp:${fingerprint}`)
  keys.add(`id:${record.id}`)
  return [...keys]
}

function warmupRecordDisplayTitle(record: WarmupRecord, fallback: string, questionUnit: string) {
  const items = Array.isArray(record.items) ? record.items : []
  const first = items[0] as any
  if (!first) return record.topicTitle || fallback
  const title = first.groupTitle || first.displayLabel || record.topicTitle || fallback
  const prompt = first.zh || first.promptZh || first.answer || first.suggestedAnswer
  if (items.length === 1 && prompt && prompt !== title) return `${title} · ${String(prompt).slice(0, 28)}`
  return items.length > 1 ? `${title} · ${items.length} ${questionUnit}` : title
}

function warmupRecordPracticeCount(record: WarmupRecord) {
  const items = Array.isArray(record.items) ? record.items : []
  return items.reduce((sum, item: any) => sum + Math.max(1, Number(item.practiceCount ?? 1)), 0)
}

function mergeWarmupRecords(localRecords: WarmupRecord[], remoteRecords: WarmupRecord[]) {
  const seen = new Set<string>()
  return [...localRecords, ...remoteRecords]
    .filter((record) => {
      const keys = warmupRecordKeys(record)
      if (keys.some((key) => seen.has(key))) return false
      keys.forEach((key) => seen.add(key))
      return true
    })
    .sort((a, b) => String((b as any).updatedAt ?? b.createdAt ?? '').localeCompare(String((a as any).updatedAt ?? a.createdAt ?? '')))
}

export function WarmupHistoryDrawer({ open, onOpenChange, topicId, topicTitle }: WarmupHistoryDrawerProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<WarmupRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replayItem, setReplayItem] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    if (open && topicId) {
      setLoading(true)
      Promise.allSettled([
        practiceRepository.listLocalWarmupRecords(topicId),
        warmupRecordApi.list(topicId),
        practiceRepository.getPracticeDataResetAt(),
      ]).then(([localResult, remoteResult, resetResult]) => {
        if (cancelled) return
        const localRecords = localResult.status === 'fulfilled' ? localResult.value : []
        const resetAt = resetResult.status === 'fulfilled' ? resetResult.value : null
        const remoteRecords = remoteResult.status === 'fulfilled'
          ? remoteResult.value.filter((record) => !resetAt || String(record.createdAt ?? '').localeCompare(resetAt) >= 0)
          : []
        setRecords(mergeWarmupRecords(localRecords, remoteRecords))
      }).catch(() => {
        if (!cancelled) setRecords([])
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }
    return () => { cancelled = true }
  }, [open, topicId])

  const typeLabel = (item: any) => {
    if (item.displayLabel) return item.displayLabel
    const type = item.stepType ?? item.type
    if (type === 'chunk_substitution') return t('todayTask.chunkSubstitution')
    if (type === 'vocab_sentence_building') return t('todayTask.vocabSentenceBuilding')
    if (type === 'pattern_drill') return t('todayTask.patternDrill')
    if (type === 'vocab_drill') return t('todayTask.vocabDrill')
    if (type === 'sentence_decomposition') return t('todayTask.sentenceDecomposition')
    return t('todayTask.practice')
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85dvh] rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <History className="size-5" />
            {t('todayTask.practiceRecords')}
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
            <div className="py-16 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">{t('todayTask.noTodayPracticeRecords')}</p>
              <p className="text-xs text-muted-foreground/60">{t('todayTask.todayPracticeRecordsEmptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-2 pt-4">
              {records.map((record) => {
                const totalItems = record.items?.length ?? 0
                const passedItems = record.items?.filter((i: any) => i.passed).length ?? 0
                const practiceCount = warmupRecordPracticeCount(record)
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
                        <p className="text-sm font-medium truncate">{warmupRecordDisplayTitle(record, topicTitle, t('todayTask.questions'))}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="size-3" />
                          {fmtDate(record.createdAt)}
                          <span>·</span>
                          <Target className="size-3" />
                          {t('todayTask.recordPassed', { passed: passedItems, total: totalItems })}
                          <span>·</span>
                          {t('todayTask.practiceTimes', { count: practiceCount })}
                        </div>
                      </div>
                      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                    </button>

                    {isExpanded && (
                      <div className="border-t px-4 py-3 space-y-3">
                        {record.feedback && (
                          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t('todayTask.aiAssessment')}</p>
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
                                {item.practiceCount > 1 && <span className="text-[10px] text-muted-foreground">{t('todayTask.practiceTimes', { count: item.practiceCount })}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">{t('todayTask.questionLabel')}: {item.zh || item.promptZh}</p>
                              {item.answer || item.suggestedAnswer ? (
                                <p className="text-xs">{t('todayTask.answerLabel')}: <span className="text-green-600 dark:text-green-400">{item.answer || item.suggestedAnswer}</span></p>
                              ) : null}
                              {item.userAnswer && (
                                <div>
                                  <p className="mb-1 text-[10px] text-muted-foreground">{t('learning.yourAnswer')}</p>
                                  <div className={cn(
                                    'min-h-[52px] rounded-lg bg-muted/30 px-3 py-2 text-sm leading-6',
                                    item.passed ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300',
                                  )}>
                                    {item.userAnswer}
                                  </div>
                                </div>
                              )}
                              {item.feedback && (
                                <p className="text-[10px] text-muted-foreground/70 italic">{item.feedback}</p>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-full justify-between rounded-lg px-2 text-xs"
                                onClick={() => setReplayItem({ ...item, index: idx })}
                              >
                                {t('todayTask.replayQuestion')}
                                <ChevronRight className="size-3.5" />
                              </Button>
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
      <Dialog open={!!replayItem} onOpenChange={(nextOpen) => { if (!nextOpen) setReplayItem(null) }}>
        <DialogContent className="!z-[10001] w-[calc(100vw-2rem)] max-w-md rounded-2xl p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">{t('todayTask.replayDialogTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('todayTask.replayDialogDesc')}</DialogDescription>
          {replayItem && (
            <div className="overflow-hidden rounded-2xl">
              <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge variant="secondary" className="text-[10px]">{typeLabel(replayItem)}</Badge>
                    <h2 className="mt-2 truncate text-base font-semibold text-foreground">
                      {replayItem.groupTitle || topicTitle}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplayItem(null)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-3 px-5 py-4">
                <div className="rounded-lg bg-muted/20 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{t('todayTask.questionLabel')}</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{replayItem.zh || replayItem.promptZh}</p>
                </div>
                {(replayItem.answer || replayItem.suggestedAnswer || replayItem.correction) && (
                  <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground">{t('todayTask.referenceAnswer')}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {replayItem.answer || replayItem.suggestedAnswer || replayItem.correction}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">{t('learning.yourAnswer')}</p>
                  <div className="min-h-[72px] rounded-lg bg-background/70 px-3 py-2 text-base leading-6 ring-1 ring-border/45">
                    {replayItem.userAnswer || t('todayTask.notAnswered')}
                  </div>
                </div>
                {replayItem.feedback && (
                  <div className={cn('rounded-lg px-3 py-2.5', replayItem.passed ? 'bg-green-500/10' : 'bg-amber-500/10')}>
                    <div className="flex items-center gap-1.5">
                      {replayItem.passed ? <CheckCircle2 className="size-3.5 text-green-500" /> : <XCircle className="size-3.5 text-amber-500" />}
                      <p className="text-xs font-medium">{replayItem.passed ? t('todayTask.correct') : t('todayTask.feedback')}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{replayItem.feedback}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Drawer>
  )
}
