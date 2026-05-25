import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Receipt, Search, ChevronLeft, ChevronRight,
  ArrowLeft, TrendingUp, DollarSign, ShoppingCart, CheckCircle2,
  ShieldAlert, FlaskConical, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import {
  listOrders, getOrderStats, testPayment,
  type AdminOrder, type AdminOrdersResult, type AdminOrderStats,
} from '@/features/admin/api'
import { useAuth } from '@/providers/auth-provider'

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '待支付', variant: 'secondary' },
  paid: { label: '已支付', variant: 'default' },
  cancelled: { label: '已取消', variant: 'outline' },
  refunded: { label: '已退款', variant: 'destructive' },
}

const methodLabels: Record<string, string> = {
  alipay: '支付宝',
  wechat: '微信支付',
}

export function AdminBillingPage() {
  const navigate = useNavigate()
  const { session } = useAuth()

  const [data, setData] = useState<AdminOrdersResult | null>(null)
  const [stats, setStats] = useState<AdminOrderStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [ordersResult, statsResult] = await Promise.all([
        listOrders({ page, pageSize, keyword: keyword || undefined, status: statusFilter || undefined }),
        page === 1 && !keyword && !statusFilter ? getOrderStats() : Promise.resolve(null),
      ])
      setData(ordersResult)
      if (statsResult) setStats(statsResult)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, keyword, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleTestPayment = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const result = await testPayment()
      if (result.payUrl) {
        window.open(result.payUrl, '_blank')
        setTestResult(`支付宝支付页面已打开！订单号: ${result.orderNo}，金额: ¥${(result.amount / 100).toFixed(2)}，支付完成后等待回调自动开通会员`)
      } else {
        setTestResult(`订单已创建: ${result.orderNo}，但未获取到支付链接，请检查支付宝配置`)
      }
      fetchData()
    } catch (err: any) {
      setTestResult(`失败: ${err?.response?.data?.message || err?.message || '未知错误'}`)
    } finally {
      setTestLoading(false)
    }
  }

  if (session && session.user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/30" />
        <p className="mt-4 text-lg font-semibold text-muted-foreground">需要管理员权限</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回首页
        </Button>
      </div>
    )
  }

  const handleSearch = () => {
    setPage(1)
    setKeyword(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">账单管理</h1>
        <p className="text-sm text-muted-foreground">查看所有支付订单和收入统计</p>
      </div>

      {/* 测试支付区域 */}
      <Card className="shadow-none border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <FlaskConical className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">测试支付</p>
                <p className="text-xs text-muted-foreground">
                  自动创建 1 元订单并跳转支付宝支付页面，支付成功后自动开通会员
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestPayment}
              disabled={testLoading}
              className="shrink-0"
            >
              {testLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FlaskConical className="mr-2 h-4 w-4" />
              测试 ¥1.00 支付
            </Button>
          </div>
          {testResult && (
            <p className={`mt-3 text-sm rounded-lg px-3 py-2 ${
              testResult.includes('已打开') ? 'bg-blue-500/10 text-blue-700' : testResult.startsWith('失败') ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-700'
            }`}>
              {testResult}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Receipt className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalOrders ?? '--'}</p>
                <p className="text-xs text-muted-foreground">总订单数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.paidOrders ?? '--'}</p>
                <p className="text-xs text-muted-foreground">已支付</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats ? formatAmount(stats.totalRevenue) : '--'}
                </p>
                <p className="text-xs text-muted-foreground">总收入</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.paidOrders && stats.totalRevenue && stats.paidOrders > 0
                    ? formatAmount(Math.round(stats.totalRevenue / stats.paidOrders))
                    : '--'}
                </p>
                <p className="text-xs text-muted-foreground">客单价</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单号或邮箱..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {['', 'paid', 'pending', 'cancelled', 'refunded'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                statusFilter === s ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s === '' ? '全部' : statusLabels[s]?.label || s}
            </button>
          ))}
        </div>
        <Button onClick={handleSearch} size="sm">搜索</Button>
        {keyword && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); setKeyword(''); setPage(1) }}>
            清除
          </Button>
        )}
      </div>

      {/* 最近订单 */}
      {stats?.recentOrders && stats.recentOrders.length > 0 && page === 1 && !keyword && !statusFilter && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近订单</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {stats.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                      order.paymentMethod === 'alipay' ? 'bg-blue-500/10' : 'bg-green-500/10'
                    )}>
                      <ShoppingCart className={cn(
                        'h-4 w-4',
                        order.paymentMethod === 'alipay' ? 'text-blue-500' : 'text-green-500'
                      )} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {order.user.name || order.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.plan.name} · {methodLabels[order.paymentMethod] || order.paymentMethod} · {order.billingCycle === 'yearly' ? '年付' : '月付'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold">{formatAmount(order.amount)}</p>
                    <Badge variant={statusLabels[order.status]?.variant || 'secondary'} className="text-xs mt-0.5">
                      {statusLabels[order.status]?.label || order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 全部订单列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">全部订单</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !data || data.list.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">暂无订单</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">订单号</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">用户</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:table-cell">套餐</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">金额</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider md:table-cell">支付方式</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">状态</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider lg:table-cell">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.list.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                          {order.orderNo}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium truncate max-w-[100px]">
                          {order.user.name || order.user.email}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge variant="secondary" className="text-xs">{order.plan.name}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatAmount(order.amount)}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                        {methodLabels[order.paymentMethod] || order.paymentMethod}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={statusLabels[order.status]?.variant || 'secondary'}
                          className={cn(
                            'text-xs',
                            order.status === 'paid' && 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15'
                          )}
                        >
                          {statusLabels[order.status]?.label || order.status}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                        {new Date(order.createdAt).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">每页</span>
                <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-16">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </Select>
                <span className="text-xs text-muted-foreground">条</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-2">
                  共 {data.total} 条，第 {page}/{totalPages} 页
                </span>
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
