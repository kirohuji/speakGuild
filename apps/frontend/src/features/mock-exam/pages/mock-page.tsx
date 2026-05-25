import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Clock, BarChart2, Trophy, CheckCircle, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import {
  getMockPapers,
  getRecentScores,
  getMockDashboard,
  startMockExam,
  type MockPaper,
  type MockScore,
  type MockDashboard,
} from '@/features/mock-exam/api'
import { cn } from '@/lib/cn'

export function MockPage() {
  const { t } = useTranslation()
  const [papers, setPapers] = useState<MockPaper[]>([])
  const [scores, setScores] = useState<MockScore[]>([])
  const [dashboard, setDashboard] = useState<MockDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [scorePage, setScorePage] = useState(1)

  useEffect(() => {
    setIsLoading(true)
    Promise.allSettled([getMockPapers(), getRecentScores(), getMockDashboard()]).then(
      ([papersRes, scoresRes, dashRes]) => {
        if (papersRes.status === 'fulfilled') setPapers(papersRes.value)
        if (scoresRes.status === 'fulfilled') setScores(scoresRes.value)
        if (dashRes.status === 'fulfilled') setDashboard(dashRes.value)
        setIsLoading(false)
      }
    )
  }, [])

  const handleStart = async (paperId: string) => {
    setStarting(paperId)
    try {
      const result = await startMockExam(paperId)
      alert(`模考已开始，试卷 ID：${result.mockId}`)
    } catch {
      alert('启动模考失败，请重试')
    } finally {
      setStarting(null)
    }
  }

  const scoreColumns: ColumnConfig<MockScore>[] = [
    {
      key: 'paperName',
      header: t('mock.columns.name'),
      cell: (v) => <span className="font-medium">{v}</span>,
    },
    {
      key: 'score',
      header: t('mock.score'),
      cell: (v, row) => (
        <span className={cn('font-bold', row.passed ? 'text-green-600' : 'text-destructive')}>
          {v}/{row.totalScore}
        </span>
      ),
      width: 100,
    },
    {
      key: 'passed',
      header: '状态',
      cell: (v) => (
        <Badge variant={v ? 'success' : 'destructive'} className="text-xs">
          {v ? '通过' : '未通过'}
        </Badge>
      ),
      width: 80,
    },
    {
      key: 'durationSeconds',
      header: t('mock.duration'),
      cell: (v) => {
        const min = Math.floor(v / 60)
        const sec = v % 60
        return <span className="text-muted-foreground">{min}分{sec}秒</span>
      },
      width: 100,
    },
    {
      key: 'completedAt',
      header: t('mock.date'),
      cell: (v) => (
        <span className="text-muted-foreground text-xs">{new Date(v).toLocaleString('zh-CN')}</span>
      ),
      width: 160,
    },
  ]

  const paginatedScores = scores.slice((scorePage - 1) * 10, scorePage * 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('mock.title')}</h1>
        <p className="mt-1 text-muted-foreground">模拟真实考试环境，检验您的备考成果</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左列：试卷 + 成绩 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 试卷卡片 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">选择试卷</h2>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : papers.length === 0 ? (
              <div className="rounded-lg border py-12 text-center text-muted-foreground">
                {t('common.empty')}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {papers.map((paper) => (
                  <PaperCard
                    key={paper.paperId}
                    paper={paper}
                    onStart={() => handleStart(paper.paperId)}
                    isStarting={starting === paper.paperId}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 最近成绩 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">{t('mock.recentScores')}</h2>
            <ConfigDataTable
              data={paginatedScores}
              columns={scoreColumns}
              total={scores.length}
              page={scorePage}
              pageSize={10}
              onPageChange={setScorePage}
              isLoading={isLoading}
              emptyMessage={t('mock.noScores')}
            />
          </section>
        </div>

        {/* 右列：配置 + 看板 */}
        <div className="space-y-4">
          {/* 看板 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('mock.dashboard')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}
                </div>
              ) : dashboard ? (
                <div className="space-y-3">
                  <DashItem icon={BarChart2} label={t('mock.avgScore')} value={`${dashboard.avgScore}分`} />
                  <DashItem icon={BookOpen} label={t('mock.totalMocks')} value={`${dashboard.totalMocks}次`} />
                  <DashItem icon={Trophy} label={t('mock.passRate')} value={`${(dashboard.passRate * 100).toFixed(0)}%`} />
                  <DashItem icon={CheckCircle} label="最高分" value={`${dashboard.bestScore}分`} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">暂无统计数据</p>
              )}
            </CardContent>
          </Card>

          {/* 模考说明 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">模考说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• 标准卷：与真实口试接近，建议定期检验</p>
              <p>• 强化卷：加大题量，适合冲刺阶段</p>
              <p>• 模考过程中可录音，方便事后复盘</p>
              <p>• 成绩达到 60 分视为通过</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PaperCard({
  paper,
  onStart,
  isStarting,
}: {
  paper: MockPaper
  onStart: () => void
  isStarting: boolean
}) {
  const { t } = useTranslation()
  return (
    <Card className={cn('transition-shadow hover:shadow-md', paper.type === 'standard' && 'border-primary/30')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{paper.name}</CardTitle>
          <Badge variant={paper.type === 'standard' ? 'default' : 'secondary'} className="text-xs shrink-0 ml-2">
            {paper.type === 'standard' ? t('mock.standard') : t('mock.intensive')}
          </Badge>
        </div>
        {paper.description && (
          <CardDescription className="text-xs">{paper.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{paper.questionCount} 题</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{paper.durationMinutes} 分钟</span>
          </div>
        </div>
        <Button className="w-full gap-2" onClick={onStart} disabled={isStarting}>
          <Play className="h-4 w-4" />
          {isStarting ? '启动中...' : t('mock.start')}
        </Button>
      </CardContent>
    </Card>
  )
}

function DashItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
