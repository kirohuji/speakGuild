import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import {
  getPracticeRecords,
  type PracticeRecord,
  type PracticeRecordsResult,
} from '@/features/profile/api'

export function RecordsTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<PracticeRecordsResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    setIsLoading(true)
    getPracticeRecords({ page, pageSize })
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [page])

  const columns: ColumnConfig<PracticeRecord>[] = [
    {
      key: 'topicName',
      header: t('profile.columns.topic'),
      cell: (v) => <span className="text-sm font-medium">{v}</span>,
    },
    {
      key: 'questionText',
      header: t('profile.columns.question'),
      cell: (v, row) => (
        <div className="max-w-[360px]">
          <span className="line-clamp-1 text-sm text-muted-foreground">{v}</span>
          {row.summary && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">{row.summary}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('profile.columns.status'),
      cell: (v, row) => {
        const statusMap: Record<string, string> = {
          analyzed: t('profile.statusAnalyzed'),
          analyzing: t('profile.statusAnalyzing'),
          completed: t('profile.statusCompleted'),
          failed: t('profile.statusFailed'),
          inProgress: t('profile.statusInProgress'),
        }
        return (
          <div className="flex items-center gap-2">
            <Badge variant={v === 'analyzed' ? 'default' : v === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
              {statusMap[v] || v}
            </Badge>
            {typeof row.score === 'number' && <span className="text-xs font-semibold text-primary">{row.score}</span>}
          </div>
        )
      },
      width: 120,
    },
    {
      key: 'practiceCount',
      header: t('profile.columns.count'),
      cell: (v) => <Badge variant="secondary" className="text-xs">{t('profile.practiceCount', { count: v })}</Badge>,
      width: 80,
    },
    {
      key: 'lastPracticeAt',
      header: t('profile.columns.date'),
      cell: (v) => (
        <span className="text-xs text-muted-foreground">
          {new Date(v).toLocaleDateString()}
        </span>
      ),
      width: 100,
    },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t('profile.records')}</h2>
      <p className="rounded-lg bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
        完成最终 AI 复盘后才会生成练习记录，中途退出不会计入记录。
      </p>
      <ConfigDataTable
        data={data?.list || []}
        columns={columns}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t('common.empty')}
      />
    </div>
  )
}
