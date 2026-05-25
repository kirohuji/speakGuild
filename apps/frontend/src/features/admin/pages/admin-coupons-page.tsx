import { useState, useEffect, useCallback } from 'react'
import { Plus, Tag, Percent, DollarSign, Calendar, ToggleLeft, ToggleRight, Search, X, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  getAllCoupons, createCoupon, updateCoupon,
  type CouponData,
} from '@/features/coupon/api'
import { cn } from '@/lib/cn'

const PAGE_SIZES = [10, 20, 50]

export function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponData[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const data = await getAllCoupons({ page, pageSize, keyword: keyword || undefined })
    setCoupons(data.items)
    setTotal(data.total)
    setLoading(false)
  }, [page, pageSize, keyword])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const handleClearSearch = () => {
    setKeyword('')
    setPage(1)
  }

  const handleToggleActive = async (coupon: CouponData) => {
    await updateCoupon(coupon.id, { isActive: !coupon.isActive })
    fetchData()
  }

  const totalPages = Math.ceil(total / pageSize)

  const stats = {
    total,
    active: coupons.filter((c) => c.isActive).length,
    percentage: coupons.filter((c) => c.type === 'percentage').length,
    fixed: coupons.filter((c) => c.type === 'fixed').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">优惠券管理</h1>
          <p className="text-xs text-muted-foreground">创建和管理优惠码</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> 创建优惠券
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">优惠券总数</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
              <ToggleRight className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">生效中</p>
              <p className="text-lg font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Percent className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">百分比折扣</p>
              <p className="text-lg font-bold">{stats.percentage}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">固定金额减免</p>
              <p className="text-lg font-bold">{stats.fixed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索栏 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-8"
            placeholder="搜索优惠码..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {keyword && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleSearch}>搜索</Button>
      </div>

      {/* 列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">优惠券列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-20 w-full rounded-xl" />))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="py-12 text-center">
              <Tag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">暂无优惠券</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setDialogOpen(true)}>
                创建第一个优惠券
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {coupons.map((c) => (
                  <Card key={c.id} className={cn(!c.isActive && 'opacity-50')}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                        c.type === 'percentage' ? 'bg-blue-500/10' : c.type === 'fixed' ? 'bg-green-500/10' : 'bg-amber-500/10'
                      )}>
                        {c.type === 'percentage' ? <Percent className="h-5 w-5 text-blue-500" />
                          : c.type === 'fixed' ? <DollarSign className="h-5 w-5 text-green-500" />
                          : <Calendar className="h-5 w-5 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{c.code}</span>
                          <Badge variant={c.isActive ? 'default' : 'outline'} className="text-[10px] h-4">
                            {c.isActive ? '生效中' : '已停用'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.type === 'percentage' ? `${c.value}% 折扣` : c.type === 'fixed' ? `¥${(c.value / 100).toFixed(2)} 减免` : `${c.value} 天免费试用`}
                          {c.minAmount && ` · 最低 ¥${(c.minAmount / 100).toFixed(2)}`}
                          {c.maxUses && ` · 已用 ${c.usedCount}/${c.maxUses}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => handleToggleActive(c)}
                      >
                        {c.isActive ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">每页</span>
                  <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-16">
                    {PAGE_SIZES.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
                  </Select>
                  <span className="text-xs text-muted-foreground">条</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    共 {total} 条，第 {page}/{totalPages || 1} 页
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      上一页
                    </Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      下一页
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreateCouponDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={fetchData}
      />
    </div>
  )
}

function CreateCouponDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('')
  const [type, setType] = useState('percentage')
  const [value, setValue] = useState(20)
  const [minAmount, setMinAmount] = useState<number | undefined>()
  const [maxUses, setMaxUses] = useState<number | undefined>()
  const [validUntil, setValidUntil] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!code.trim()) return
    setSubmitting(true)
    try {
      await createCoupon({
        code: code.trim(),
        type,
        value,
        minAmount: minAmount ? minAmount * 100 : undefined,
        maxUses,
        validUntil: validUntil || undefined,
      })
      onCreated()
      onClose()
      setCode('')
      setType('percentage')
      setValue(20)
      setMinAmount(undefined)
      setMaxUses(undefined)
      setValidUntil('')
    } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建优惠券</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">优惠码</label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="如 NEWUSER20" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">类型</label>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
              <SelectItem value="percentage">百分比折扣</SelectItem>
              <SelectItem value="fixed">固定金额减免</SelectItem>
              <SelectItem value="free_trial">免费试用天数</SelectItem>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {type === 'percentage' ? '折扣比例 (%)' : type === 'fixed' ? '减免金额 (元)' : '试用天数'}
            </label>
            <Input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">最低消费 (元)</label>
              <Input type="number" value={minAmount || ''} onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : undefined)} placeholder="不限" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">使用上限</label>
              <Input type="number" value={maxUses || ''} onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : undefined)} placeholder="不限" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">过期时间</label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={!code.trim() || submitting} className="w-full">
            {submitting ? '创建中...' : '创建优惠券'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
