import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Receipt, Search,
  ArrowLeft, TrendingUp, DollarSign, ShoppingCart, CheckCircle2,
  ShieldAlert, FlaskConical, Loader2, Apple, ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import {
  listOrders, getOrderStats, testPayment,
  listRCSubscribers, getRCSubscriberDetail,
  type AdminOrder, type AdminOrdersResult, type AdminOrderStats,
  type RCSubscriber, type RCSubscriberDetail,
} from '@/features/admin/api'
import { useAuth } from '@/providers/auth-provider'
import { AdminPagination } from '@/features/admin/components/admin-pagination'

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

const storeLabels: Record<string, string> = {
  app_store: 'App Store',
  mac_app_store: 'Mac App Store',
  play_store: 'Google Play',
  stripe: 'Stripe',
  amazon: 'Amazon',
  promotional: '促销',
  unknown: '未知',
}

const subscriptionStatusLabels: Record<string, string> = {
  trialing: '试用',
  active: '有效',
  expired: '已过期',
  in_grace_period: '宽限期',
  in_billing_retry: '扣款重试',
  paused: '已暂停',
  unknown: '未知',
  incomplete: '未完成',
}

const renewalLabels: Record<string, string> = {
  will_renew: '自动续费',
  will_not_renew: '到期后停止',
  will_change_product: '到期后换商品',
  will_pause: '到期后暂停',
  requires_price_increase_consent: '待确认涨价',
  has_already_renewed: '已完成下期扣款',
}

type BillingTab = 'local' | 'revenuecat'

export function AdminBillingPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session } = useAuth()
  const tab: BillingTab = searchParams.get('tab') === 'revenuecat' ? 'revenuecat' : 'local'
  const selectTab = (next: BillingTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', next)
    setSearchParams(nextParams)
  }

  useEffect(() => {
    const current = searchParams.get('tab')
    if (current === 'local' || current === 'revenuecat') return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', 'local')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  // ── 本地订单状态 ──
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

  // ── RevenueCat 状态 ──
  const [rcData, setRcData] = useState<{ list: RCSubscriber[]; total: number; message?: string } | null>(null)
  const [rcLoading, setRcLoading] = useState(false)
  const [rcPage, setRcPage] = useState(1)
  const [rcPageSize, setRcPageSize] = useState(20)
  const [rcDetail, setRcDetail] = useState<RCSubscriberDetail | null>(null)
  const [rcDetailLoading, setRcDetailLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
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

  const fetchRCSubscribers = useCallback(async () => {
    setRcLoading(true)
    try {
      const result = await listRCSubscribers({ page: rcPage, pageSize: rcPageSize })
      setRcData(result)
    } catch {
      setRcData(null)
    } finally {
      setRcLoading(false)
    }
  }, [rcPage, rcPageSize])

  useEffect(() => {
    if (tab === 'local') fetchOrders()
    else fetchRCSubscribers()
  }, [tab, fetchOrders, fetchRCSubscribers])

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
      fetchOrders()
    } catch (err: any) {
      setTestResult(`失败: ${err?.response?.data?.message || err?.message || '未知错误'}`)
    } finally {
      setTestLoading(false)
    }
  }

  const handleViewRCDetail = async (userId: string) => {
    setRcDetailLoading(true)
    setRcDetail(null)
    try {
      const detail = await getRCSubscriberDetail(userId)
      setRcDetail(detail)
    } catch {
      setRcDetail(null)
    } finally {
      setRcDetailLoading(false)
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
  const rcTotalPages = rcData ? Math.ceil(rcData.total / rcPageSize) : 0

  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`

  const formatDate = (d: string) => {
    if (!d) return '--'
    return new Date(d).toLocaleString('zh-CN')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">账单管理</h1>
        <p className="text-sm text-muted-foreground">查看所有支付订单和订阅状态</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {([
          { key: 'local' as const, label: '支付宝 / 微信', icon: ShoppingCart },
          { key: 'revenuecat' as const, label: 'RevenueCat (Apple Pay)', icon: Apple },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              tab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════ 本地订单 ═══════════════════════════ */}
      {tab === 'local' && (
        <>
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
                            <p className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">{order.orderNo}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium truncate max-w-[100px]">{order.user.name || order.user.email}</p>
                          </td>
                          <td className="hidden px-4 py-3 sm:table-cell">
                            <Badge variant="secondary" className="text-xs">{order.plan.name}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">{formatAmount(order.amount)}</td>
                          <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                            {methodLabels[order.paymentMethod] || order.paymentMethod}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusLabels[order.status]?.variant || 'secondary'} className={cn('text-xs', order.status === 'paid' && 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15')}>
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
                <AdminPagination total={data.total} page={Math.min(page, Math.max(1, totalPages))} pageSize={pageSize}
                  pageSizes={[10, 20, 50]} onPageChange={setPage}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════════════════════════ RevenueCat ═══════════════════════════ */}
      {tab === 'revenuecat' && (
        <>
          {/* 订阅用户列表 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Apple className="h-4 w-4" />
                RevenueCat 订阅用户
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rcLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : !rcData || rcData.list.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <Apple className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-sm font-medium text-muted-foreground">
                    {rcData?.message || '暂无 RevenueCat 订阅数据'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">用户</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">商品</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">权益</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">状态</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">续费</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">到期</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rcData.list.map((sub) => {
                        const current = sub.subscription
                        return (
                          <tr key={sub.userId} className="transition-colors hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <p className="text-sm">{sub.name || sub.localEmail || sub.email || '未匹配本地用户'}</p>
                              <p className="max-w-[160px] truncate text-xs font-mono text-muted-foreground">{sub.userId}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs">{current?.storeProductId || current?.productId || '--'}</p>
                              <p className="text-xs text-muted-foreground">{current ? (storeLabels[current.store] || current.store) : ''}</p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {current?.entitlementKeys.join(', ') || '--'}
                            </td>
                            <td className="px-4 py-3">
                              {current ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  <Badge variant={current.givesAccess ? 'default' : 'secondary'} className={cn('text-xs', current.givesAccess && 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15')}>
                                    {subscriptionStatusLabels[current.status] || current.status}
                                  </Badge>
                                  {current.environment === 'sandbox' && <Badge variant="outline" className="text-[10px]">沙盒</Badge>}
                                </div>
                              ) : <span className="text-xs text-muted-foreground">无订阅</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {current ? (renewalLabels[current.autoRenewalStatus] || current.autoRenewalStatus) : '--'}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {formatDate(current?.currentPeriodEndsAt || '')}
                            </td>
                            <td className="px-4 py-3">
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleViewRCDetail(sub.userId)}>
                                <ExternalLink className="mr-1 h-3 w-3" />
                                详情
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {rcData && rcData.total > 0 && (
                <AdminPagination total={rcData.total} page={Math.min(rcPage, Math.max(1, rcTotalPages))} pageSize={rcPageSize}
                  pageSizes={[10, 20, 50]} onPageChange={setRcPage}
                  onPageSizeChange={(size) => { setRcPageSize(size); setRcPage(1); }} />
              )}
            </CardContent>
          </Card>

          {/* 订阅详情 Dialog */}
          <Dialog open={!!rcDetail} onOpenChange={(v) => { if (!v) setRcDetail(null) }}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>RevenueCat 订阅详情</DialogTitle>
              </DialogHeader>
              {rcDetail && (
                <div className="mt-2 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">用户 ID</p>
                      <p className="break-all font-mono text-xs">{rcDetail.userId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">邮箱</p>
                      <p className="text-xs">{rcDetail.localEmail || rcDetail.email || '--'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">订阅</p>
                    {rcDetail.subscriptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">没有订阅记录</p>
                    ) : (
                      <div className="space-y-2">
                        {[...rcDetail.subscriptions].sort((a, b) => {
                          const aTime = new Date(a.startsAt || a.currentPeriodStartsAt || 0).getTime()
                          const bTime = new Date(b.startsAt || b.currentPeriodStartsAt || 0).getTime()
                          return bTime - aTime
                        }).map((item) => (
                          <div key={item.id} className="space-y-2 rounded-lg border border-border/60 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={item.givesAccess ? 'default' : 'secondary'} className={cn('text-[10px]', item.givesAccess && 'bg-emerald-500/15 text-emerald-700')}>
                                {item.givesAccess ? '有权益' : '无权益'}
                              </Badge>
                              <span className="text-xs">{subscriptionStatusLabels[item.status] || item.status}</span>
                              <span className="text-xs text-muted-foreground">{renewalLabels[item.autoRenewalStatus] || item.autoRenewalStatus || '--'}</span>
                              {item.environment === 'sandbox' && <Badge variant="outline" className="text-[10px]">沙盒</Badge>}
                              {item.pendingPayment && <Badge variant="outline" className="text-[10px]">待扣款</Badge>}
                            </div>
                            <p className="text-xs font-medium">{item.storeProductId || item.productId || item.id}</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <span>商店: {storeLabels[item.store] || item.store}</span>
                              <span>环境: {item.environment === 'sandbox' ? '沙盒' : item.environment === 'production' ? '正式' : '--'}</span>
                              <span>购买: {formatDate(item.startsAt || '')}</span>
                              <span>到期: {formatDate(item.currentPeriodEndsAt || item.endsAt || '')}</span>
                              <span>交易号: {item.storeSubscriptionIdentifier || '--'}</span>
                            </div>
                            {item.entitlementKeys.length > 0 && (
                              <p className="text-[11px] text-muted-foreground">权益: {item.entitlementKeys.join(', ')}</p>
                            )}
                            {item.pendingProductStoreId && (
                              <p className="text-[11px] text-amber-600">到期后改为 {item.pendingProductStoreId}</p>
                            )}
                            {item.totalRevenueUsd && (
                              <p className="text-[11px] text-muted-foreground">
                                收入 ${item.totalRevenueUsd.gross.toFixed(2)}，实收 ${item.totalRevenueUsd.proceeds.toFixed(2)}
                              </p>
                            )}
                            {item.managementUrl && (
                              <a href={item.managementUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" />
                                商店订阅管理
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
