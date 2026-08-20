import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronDown, Eye, XCircle } from 'lucide-react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import { WarmupRecordDetailDialog } from '@/features/practice/components/warmup-record-detail-dialog'
import { cn } from '@/lib/cn'
import type { WarmupRecordEntry } from '@/stores/warmup-session.store'
import type { PracticeItem } from '../pages/today-task-page'

interface TodayRecordsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: WarmupRecordEntry[]
  steps: PracticeItem[]
}

export function TodayRecordsDrawer({ open, onOpenChange, records, steps }: TodayRecordsDrawerProps) {
  const { t } = useTranslation()
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const scoreLabels = {
    strong: t('todayTask.scoreStrong'),
    ok: t('todayTask.scoreOk'),
    weak: t('todayTask.scoreWeak'),
    miss: t('todayTask.scoreMiss'),
  }

  const setDrawerOpen = (nextOpen: boolean) => {
    if (!nextOpen) setDetailIndex(null)
    if (nextOpen) setPage(1)
    onOpenChange(nextOpen)
  }

  const selectedRecord = detailIndex === null ? null : records[detailIndex]
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize))
  const pagedRecords = records.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const columns: ColumnConfig<WarmupRecordEntry>[] = [
    {
      key: 'zh',
      header: t('todayTask.knowledgePoint'),
      cell: (value, record) => {
        const step = steps.find((item) => item.id === record.stepId)
        return (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{step?.displayLabel || record.displayLabel || t('todayTask.practice')}</span>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{value}</p>
              {record.answer && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{record.answer}</p>}
            </div>
            {/* <Eye className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" /> */}
          </div>
        )
      },
    },
    {
      key: 'score',
      header: t('learning.scoreHeader'),
      width: 82,
      cell: (value, record) => (
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-1">
            {record.passed
              ? <CheckCircle2 className="size-3.5 text-green-500" />
              : <XCircle className="size-3.5 text-red-400" />}
            <span className={cn(
              'text-xs font-medium',
              value === 'strong' && 'text-green-600',
              value === 'ok' && 'text-blue-600',
              value === 'weak' && 'text-amber-600',
              value === 'miss' && 'text-red-500',
            )}>
              {value ? scoreLabels[value as keyof typeof scoreLabels] : (record.passed ? t('todayTask.scoreOk') : t('todayTask.scoreMiss'))}
            </span>
          </div>
          {record.practiceCount && record.practiceCount > 1 ? (
            <p className="text-[10px] text-muted-foreground">{t('todayTask.practiceTimes', { count: record.practiceCount })}</p>
          ) : null}
        </div>
      ),
      align: 'center',
    },
  ]

  return (
    <Drawer open={open} onOpenChange={setDrawerOpen}>
      <DrawerContent
        className="!z-[10001] flex h-[95dvh] max-h-[95dvh] w-full max-w-full flex-col overflow-hidden bg-background p-0"
        overlayClassName="!z-[10001]"
      >
        <DrawerTitle className="sr-only">{t('todayTask.todayPracticeRecords')}</DrawerTitle>
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 pb-3 pt-2">
            <h2 className="text-base font-semibold text-foreground">{t('todayTask.todayPracticeRecords')}</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
            <ConfigDataTable
              data={pagedRecords}
              columns={columns}
              total={records.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              emptyMessage={t('todayTask.noTodayPracticeRecords')}
              onRowClick={(record) => setDetailIndex(records.indexOf(record))}
              className="h-full min-h-0 text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3"
            />
          </div>
        </div>
      </DrawerContent>

      <WarmupRecordDetailDialog
        open={detailIndex !== null && Boolean(selectedRecord)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setDetailIndex(null) }}
        items={records}
        topicTitle={selectedRecord?.topicTitle || t('todayTask.todayPracticeRecords')}
        initialIndex={detailIndex ?? 0}
        contentClassName="!z-[10002]"
        overlayClassName="!z-[10002]"
      />
    </Drawer>
  )
}
