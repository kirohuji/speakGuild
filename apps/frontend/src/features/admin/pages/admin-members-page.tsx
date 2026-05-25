import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Search, Crown, Shield, ShieldAlert, ChevronLeft, ChevronRight,
  Loader2, ArrowLeft, Calendar, Mail, Ban, CreditCard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectItem } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import {
  listMembers, cancelMembership, getMemberDetail,
  type AdminMember, type AdminMemberDetail, type AdminMembersResult,
} from '@/features/admin/api'
import { useAuth } from '@/providers/auth-provider'

export function AdminMembersPage() {
  const navigate = useNavigate()
  const { session } = useAuth()

  const [data, setData] = useState<AdminMembersResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchMembers = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await listMembers({ page, pageSize, keyword: keyword || undefined })
      setData(result)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, keyword])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

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

  // 统计
  const activeCount = data?.list.filter((m) => m.status === 'active' && new Date(m.expiredAt) > new Date()).length || 0
  const expiredCount = data?.list.filter((m) => m.status === 'expired' || (m.status === 'active' && new Date(m.expiredAt) <= new Date())).length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">会员管理</h1>
        <p className="text-sm text-muted-foreground">管理系统中的所有会员订阅</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.total ?? '--'}</p>
                <p className="text-xs text-muted-foreground">会员总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Crown className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">生效中</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data ? data.list.filter((m) => m.plan.level === 'advanced' && m.status === 'active').length : '--'}
                </p>
                <p className="text-xs text-muted-foreground">进阶会员</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <Ban className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredCount}</p>
                <p className="text-xs text-muted-foreground">已过期/取消</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索邮箱或姓名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">搜索</Button>
        {keyword && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); setKeyword(''); setPage(1) }}>
            清除
          </Button>
        )}
      </div>

      {/* 会员列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">会员列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !data || data.list.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">暂无会员记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">用户</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">套餐</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:table-cell">状态</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider md:table-cell">到期时间</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.list.map((member) => (
                    <MemberRow key={member.id} member={member} onRefresh={fetchMembers} />
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

function MemberRow({ member, onRefresh }: { member: AdminMember; onRefresh: () => void }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const isActive = member.status === 'active' && new Date(member.expiredAt) > new Date()

  const openDetail = async () => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const d = await getMemberDetail(member.userId)
      setDetail(d)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelMembership(member.userId)
      setCancelOpen(false)
      onRefresh()
    } catch {
      // ignore
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <tr className="transition-colors hover:bg-muted/30 cursor-pointer" onClick={openDetail}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              isActive ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
            )}>
              {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{member.user.name || '未命名'}</p>
              <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant={member.plan.level === 'advanced' ? 'default' : 'secondary'} className="text-xs">
            {member.plan.name}
          </Badge>
        </td>
        <td className="hidden px-4 py-3 sm:table-cell">
          <Badge
            variant={isActive ? 'default' : 'secondary'}
            className={cn('text-xs', isActive && 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15')}
          >
            {isActive ? '生效中' : member.status === 'cancelled' ? '已取消' : '已过期'}
          </Badge>
        </td>
        <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
          {new Date(member.expiredAt).toLocaleDateString('zh-CN')}
        </td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); openDetail() }}>
            详情
          </Button>
        </td>
      </tr>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>会员详情</DialogTitle>
            <DialogDescription>查看会员订阅和订单记录</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : detail ? (
            <div className="space-y-4 py-2">
              {/* 用户信息 */}
              <div className="flex items-center gap-4">
                <div className={cn(
                  'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold',
                  isActive ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                )}>
                  {detail.user.name?.[0]?.toUpperCase() || detail.user.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{detail.user.name || '未命名'}</p>
                    <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                      {isActive ? '生效中' : '已过期'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{detail.user.email}</span>
                  </div>
                </div>
              </div>

              {/* 订阅信息 */}
              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-sm font-medium">订阅信息</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">套餐</span>
                  <span className="font-medium">{detail.plan.name}</span>
                  <span className="text-muted-foreground">开通时间</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {new Date(detail.startedAt).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="text-muted-foreground">到期时间</span>
                  <span>{new Date(detail.expiredAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>

              {/* 订单记录 */}
              {detail.orders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">支付记录</p>
                  <div className="rounded-xl border divide-y divide-border">
                    {detail.orders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <p className="font-mono text-xs">{order.orderNo}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">¥{(order.amount / 100).toFixed(2)}</p>
                          <Badge
                            variant={order.status === 'paid' ? 'default' : 'secondary'}
                            className="text-xs mt-1"
                          >
                            {order.status === 'paid' ? '已支付' : order.status === 'pending' ? '待支付' : order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 取消订阅 */}
              {isActive && (
                <div className="rounded-xl border border-destructive/30 p-4">
                  <p className="text-sm font-medium text-destructive mb-2">取消订阅</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    取消后用户将失去会员权限，无法恢复。如需重新开通需再次购买。
                  </p>
                  <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                    <Ban className="mr-2 h-4 w-4" />
                    取消会员
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">加载失败</div>
          )}
        </DialogContent>
      </Dialog>

      {/* 取消确认弹窗 */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认取消会员</DialogTitle>
            <DialogDescription>
              确定要取消 <span className="font-semibold text-foreground">{member.user.name || member.user.email}</span> 的会员吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>返回</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
