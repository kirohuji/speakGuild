import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, Crown, Star, Zap, Shield, ChevronLeft, Sparkles, Loader2, QrCode, ExternalLink, Monitor, Gift } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  getMemberPlans,
  getCurrentMembership,
  getMemberBenefits,
  createOrder,
  mockPayConfirm,
  type MemberPlan,
  type CurrentMembership,
  type MemberBenefit,
  type OrderResult,
} from '@/features/membership/api'
import { pointsApi } from '@/features/points/api'
import { cn } from '@/lib/cn'

const planIcons: Record<string, React.ElementType> = {
  free: Star,
  standard: Crown,
}

const FALLBACK_BENEFITS: MemberBenefit[] = [
  { benefitId: '1', name: 'AI 口语纠错', freeSupport: '5 次/天', standardSupport: '50 次/天' },
  { benefitId: '2', name: 'AI 对话判定', freeSupport: '5 次/天', standardSupport: '50 次/天' },
  { benefitId: '3', name: '学习计划单元', freeSupport: '寝室入住等基础', standardSupport: '全部解锁' },
  { benefitId: '4', name: '表达库容量', freeSupport: '20 条', standardSupport: '无限' },
  { benefitId: '5', name: '输出等级追踪', freeSupport: '基础', standardSupport: '完整报告' },
  { benefitId: '6', name: '邀请好友', freeSupport: '+7天+100积分', standardSupport: '+7天+100积分' },
  { benefitId: '7', name: '被邀请奖励', freeSupport: '+50积分', standardSupport: '+50积分' },
]

export function MemberPage({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<MemberPlan[]>([])
  const [current, setCurrent] = useState<CurrentMembership | null>(null)
  const [benefits, setBenefits] = useState<MemberBenefit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')

  // 支付弹窗
  const [payOpen, setPayOpen] = useState(false)
  const [payPlan, setPayPlan] = useState<MemberPlan | null>(null)
  const [payResult, setPayResult] = useState<OrderResult | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [pointsBalance, setPointsBalance] = useState(0)
  const [usePoints, setUsePoints] = useState(false)

  useEffect(() => {
    Promise.allSettled([getMemberPlans(), getCurrentMembership(), getMemberBenefits(), pointsApi.getBalance()]).then(
      ([plansRes, curRes, benRes, ptsRes]) => {
        if (plansRes.status === 'fulfilled') setPlans(plansRes.value)
        if (curRes.status === 'fulfilled') setCurrent(curRes.value)
        if (ptsRes.status === 'fulfilled') setPointsBalance(ptsRes.value.points)
        if (benRes.status === 'fulfilled' && benRes.value.length > 0) {
          setBenefits(benRes.value)
        } else {
          setBenefits(FALLBACK_BENEFITS)
        }
        setIsLoading(false)
      }
    )
  }, [])

  const handleUpgrade = useCallback((plan: MemberPlan) => {
    setPayPlan(plan)
    setPayResult(null)
    setPayError(null)
    setPayOpen(true)
  }, [])

  const handlePay = useCallback(async (method: 'alipay' | 'wechat') => {
    if (!payPlan) return
    setPayLoading(true)
    setPayError(null)

    try {
      const result = await createOrder({
        planId: payPlan.planId,
        paymentMethod: method,
        billingCycle,
        usePoints: usePoints ? pointsBalance : 0,
      } as any)
      setPayResult(result)

      // 支付宝 PC 支付：在新窗口打开
      if (result.payUrl && method === 'alipay') {
        window.open(result.payUrl, '_blank')
      }
    } catch (err: any) {
      setPayError(err?.response?.data?.message || t('member.createOrderFailed'))
    } finally {
      setPayLoading(false)
    }
  }, [payPlan, billingCycle])

  const handleMockConfirm = useCallback(async () => {
    if (!payResult?.orderNo) return
    setPayLoading(true)
    try {
      await mockPayConfirm(payResult.orderNo)
      setPayOpen(false)
      // 刷新会员状态
      const cur = await getCurrentMembership()
      setCurrent(cur)
    } catch {
      setPayError(t('member.mockConfirmFailed'))
    } finally {
      setPayLoading(false)
    }
  }, [payResult])

  const plansContent = isLoading ? (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {[1, 2].map((i) => <Skeleton key={i} className="h-[280px] rounded-xl" />)}
    </div>
  ) : plans.length === 0 ? (
    <div className="rounded-xl border py-12 text-center text-sm text-muted-foreground">
      {t('common.empty')}
    </div>
  ) : (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {plans.map((plan) => (
        <PricingCard
          key={plan.planId}
          plan={plan}
          isCurrent={current?.planId === plan.planId}
          billingCycle={billingCycle}
          onUpgrade={() => handleUpgrade(plan)}
        />
      ))}
    </div>
  )

  const benefitsContent = isLoading ? (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
    </div>
  ) : benefits.length === 0 ? (
    <div className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
      {t('common.empty')}
    </div>
  ) : compact ? (
    <div className="overflow-hidden rounded-lg border border-border/40">
      <div className="grid grid-cols-2 items-center gap-1 bg-muted/40 px-3 py-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground">{t('member.compactBenefit')}</span>
        <span className="text-center text-[10px] font-semibold text-muted-foreground">会员</span>
      </div>
      {benefits.map((item, idx) => (
        <div
          key={item.benefitId}
          className={cn(
            'grid grid-cols-2 items-center gap-1 px-3 py-2 text-xs transition-colors hover:bg-muted/20',
            idx !== benefits.length - 1 && 'border-b border-border/30',
          )}
        >
          <span className="font-medium truncate">{item.name}</span>
          <CompactSupportCell value={item.standardSupport} highlighted />
        </div>
      ))}
    </div>
  ) : (
    <div className="overflow-hidden rounded-lg bg-muted/30">
      <div className="grid grid-cols-3 items-center gap-2 bg-muted/50 px-4 py-2.5">
        <span className="text-xs font-semibold text-muted-foreground">{t('member.columns.benefit')}</span>
        <span className="text-center text-xs font-semibold text-muted-foreground">{t('member.columns.free')}</span>
        <span className="text-center text-xs font-semibold text-muted-foreground">会员</span>
      </div>
      {benefits.map((item, idx) => (
        <div
          key={item.benefitId}
          className={cn(
            'grid grid-cols-3 items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-muted/30',
            idx !== benefits.length - 1 && 'border-b border-border/50'
          )}
        >
          <span className="font-medium">{item.name}</span>
          <SupportCell value={item.freeSupport} />
          <SupportCell value={item.standardSupport} highlighted />
        </div>
      ))}
    </div>
  )

  return (
    <div className={cn(
      'mx-auto max-w-2xl space-y-3 lg:max-w-none',
      compact ? 'px-0 pb-4 space-y-2.5' : 'px-4 pb-24 lg:px-0 lg:pb-0 lg:space-y-5',
    )}>
      {/* 手机端返回栏 */}
      {!compact && <div className="relative flex items-center justify-center lg:hidden">
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">{t('member.title')}</h1>
      </div>}

      {/* 当前套餐 — compact 模式更紧凑 */}
      {compact ? (
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-sky-500/8 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              current?.isActive ? 'bg-amber-500/15' : 'bg-muted',
            )}>
              {current?.isActive ? (
                <Crown className="size-5 text-amber-500" />
              ) : (
                <Star className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate">{current?.planName || t('member.freeUser')}</p>
                <Badge variant={current?.isActive ? 'default' : 'secondary'} className="h-4.5 px-1.5 text-[10px] leading-none">
                  {current?.isActive ? t('member.badgeActive') : t('member.badgeFree')}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {current?.expiredAt
                  ? `${new Date(current.expiredAt).toLocaleDateString()} ${t('member.expiresSuffix')}`
                  : t('member.upgradeExperience')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg bg-gradient-to-br from-amber-100 via-orange-50 to-sky-100 p-4 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-sky-950/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('member.center')}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal text-foreground">{t('member.unlockExperience')}</h2>
              <p className="mt-2 max-w-[260px] text-xs leading-5 text-muted-foreground">{t('member.subtitle')}</p>
            </div>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background/70 text-amber-500">
              <Crown className="size-6" />
            </div>
          </div>
        </section>
      )}

      {/* 当前套餐状态 — 非 compact 模式才显示 */}
      {!compact && (
        <Card className="rounded-lg border-border/70 shadow-sm">
          <CardContent className="p-3.5">
            {isLoading ? (
              <Skeleton className="h-[72px] rounded-xl" />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                    current?.isActive ? 'bg-amber-500/10' : 'bg-muted'
                  )}>
                    {current?.isActive ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{current?.planName || t('member.freeUser')}</p>
                      <Badge variant={current?.isActive ? 'default' : 'secondary'} className="text-xs">
                        {current?.isActive ? t('member.badgeActive') : t('member.badgeFree')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {current?.expiredAt
                        ? `${new Date(current.expiredAt).toLocaleDateString()} ${t('member.expiresSuffix')}`
                        : t('member.upgradeMore')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 选择套餐 */}
      <div className={compact ? '' : ''}>
        {!compact && (
          <Card className="rounded-lg border-border/70 shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">{t('member.selectPlan')}</CardTitle>
                <div className="inline-flex rounded-full bg-muted p-1 self-start">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
                      billingCycle === 'monthly'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t('member.monthly')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
                      billingCycle === 'yearly'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t('member.yearlySave')}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {plansContent}
            </CardContent>
          </Card>
        )}
        {compact && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('member.selectPlan')}</p>
              <div className="inline-flex rounded-full bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                    billingCycle === 'monthly'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('member.monthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                    billingCycle === 'yearly'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('member.yearlySave')}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-[120px] rounded-xl" />
                  <Skeleton className="h-[120px] rounded-xl" />
                </>
              ) : plans.length === 0 ? (
                <div className="col-span-2 rounded-xl border py-10 text-center text-sm text-muted-foreground">
                  {t('common.empty')}
                </div>
              ) : (
                plans.map((plan) => (
                  <CompactPlanCard
                    key={plan.planId}
                    plan={plan}
                    isCurrent={current?.planId === plan.planId}
                    billingCycle={billingCycle}
                    onUpgrade={() => handleUpgrade(plan)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 权益对比 — compact 模式简化 */}
      <div className={compact ? 'overflow-hidden rounded-xl bg-muted/30' : ''}>
        {!compact && (
          <Card className="rounded-lg border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t('member.benefits')}</CardTitle>
            </CardHeader>
            <CardContent>
              {benefitsContent}
            </CardContent>
          </Card>
        )}
        {compact && (
          <div className="space-y-1.5 px-3 py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('member.benefitCompact')}</p>
            {benefitsContent}
          </div>
        )}
      </div>

      {/* 服务说明 — compact 模式简化 */}
      {compact ? (
        <div className="rounded-xl bg-muted/30 px-3 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('member.serviceCompact')}</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
              {t('member.serviceItem1')}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
              {t('member.serviceItem2')}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
              {t('member.serviceItem3')}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
              {t('member.serviceItem4')}
            </li>
          </ul>
        </div>
      ) : (
        <Card className="rounded-lg border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('member.service')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                {t('member.serviceItem1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                {t('member.serviceItem2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                {t('member.serviceItem3')}
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50" />
                {t('member.serviceItem4')}
              </li>
            </ul>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">{t('member.serviceFooter')}</p>
          </CardContent>
        </Card>
      )}

      {/* 支付弹窗 */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('member.payTitle')}</DialogTitle>
            <DialogDescription>
              {t('member.payDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 积分抵扣 */}
            {pointsBalance > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Gift className="size-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">积分抵扣</p>
                    <p className="text-[11px] text-muted-foreground">{pointsBalance}积分 ≈ ¥{(pointsBalance / 100).toFixed(2)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={usePoints ? 'default' : 'outline'}
                  onClick={() => setUsePoints(!usePoints)}
                  className="h-7 text-xs"
                >
                  {usePoints ? '已使用' : '使用'}
                </Button>
              </div>
            )}

            {/* 支付信息 */}
            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('member.plan')}</span>
                <span className="font-medium">{payPlan?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('member.cycle')}</span>
                <span className="font-medium">
                  {billingCycle === 'yearly' ? t('member.yearlyDiscount', { discount: 83 }) : t('member.monthly')}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('member.totalAmount')}</span>
                <span className="text-lg font-bold">
                  ¥{((): string => {
                    if (!payPlan) return '0.00'
                    const price = billingCycle === 'yearly' && payPlan.yearlyPrice
                      ? payPlan.yearlyPrice
                      : payPlan.price
                    return (price / 100).toFixed(2)
                  })()}
                </span>
              </div>
            </div>

            {/* 支付结果 - QR 码 */}
            {payResult?.qrCode && (
              <div className="rounded-xl border p-6 flex flex-col items-center gap-4">
                <QrCode className="h-24 w-24 text-muted-foreground" />
                <p className="text-sm text-center text-muted-foreground">
                  {t('member.scanToPay')}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {t('member.orderNo')}{payResult.orderNo}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMockConfirm}
                  disabled={payLoading}
                  className="w-full"
                >
                  {payLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('member.mockSuccess')}
                </Button>
              </div>
            )}

            {/* 支付宝已跳转 */}
            {payResult?.payUrl && (
              <div className="rounded-xl border bg-blue-500/5 p-4 text-center">
                <Monitor className="mx-auto h-8 w-8 text-blue-500 mb-2" />
                <p className="text-sm mb-1">{t('member.alipayOpened')}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('member.autoOpenTip')}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(payResult.payUrl, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('member.reopen')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleMockConfirm}
                    disabled={payLoading}
                  >
                    {payLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('member.mockConfirm')}
                  </Button>
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {payError && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {payError}
              </div>
            )}

            {/* 支付方式选择 */}
            {!payResult && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handlePay('alipay')}
                  disabled={payLoading}
                  className="flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
                >
                  {payLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white font-bold text-lg">
                      支
                    </div>
                  )}
                  <span className="text-sm font-medium">{t('member.alipay')}</span>
                  <span className="text-xs text-muted-foreground">{t('member.webPay')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePay('wechat')}
                  disabled={payLoading}
                  className="flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors hover:border-green-500 hover:bg-green-50 disabled:opacity-50"
                >
                  {payLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500 text-white font-bold text-lg">
                      微
                    </div>
                  )}
                  <span className="text-sm font-medium">{t('member.wechatPay')}</span>
                  <span className="text-xs text-muted-foreground">{t('member.scanPay')}</span>
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PricingCard({
  plan,
  isCurrent,
  billingCycle,
  onUpgrade,
}: {
  plan: MemberPlan
  isCurrent: boolean
  billingCycle: 'monthly' | 'yearly'
  onUpgrade: () => void
}) {
  const { t } = useTranslation()
  const Icon = planIcons[plan.level] || Star

  const displayPrice =
    billingCycle === 'yearly' && plan.level !== 'free' && plan.yearlyPrice
      ? Math.round(plan.yearlyPrice / 100 / 12 * 100) / 100
      : plan.price / 100

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border bg-card p-5 transition-all',
        plan.highlighted && 'shadow-lg border-primary/30',
        isCurrent && 'shadow-sm',
        !plan.highlighted && !isCurrent && 'border-border hover:shadow-sm'
      )}
    >
      {plan.highlighted && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground shadow-sm">
            <Sparkles className="mr-1 h-3 w-3" />
            {t('member.recommended')}
          </Badge>
        </div>
      )}

      <div className="mb-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl border',
            plan.highlighted ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/50'
          )}>
            <Icon className={cn('h-5 w-5', plan.highlighted ? 'text-primary' : 'text-foreground')} />
          </div>
          <p className="text-lg font-bold">{plan.name}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {plan.description}
        </p>
      </div>

      <div className="mb-4">
        <div className="flex items-end gap-0.5">
          <span className="text-3xl font-bold tracking-tight">¥{displayPrice}</span>
          <span className="mb-1 text-xs text-muted-foreground">{t('member.perMonth')}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {billingCycle === 'yearly' ? t('member.billedYearly') : t('member.billedMonthly')}
        </p>
      </div>

      <Button
        variant={plan.level === 'free' ? 'outline' : plan.highlighted ? 'default' : 'outline'}
        size="lg"
        className="mb-4 w-full rounded-xl"
        disabled={isCurrent || plan.level === 'free'}
        onClick={onUpgrade}
      >
        {isCurrent ? t('member.currentPlan') : plan.level === 'free' ? t('member.useFree') : t('member.upgrade')}
      </Button>

      <div className="mt-auto space-y-2.5 border-t pt-4">
        <p className="text-sm font-semibold">{t('member.featureTitle')}</p>
        <ul className="space-y-2">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm leading-5">
              <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SupportCell({ value, highlighted }: { value: boolean | string; highlighted?: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <div className="flex justify-center">
        <Check className={cn('h-4 w-4', highlighted ? 'text-primary' : 'text-green-500')} />
      </div>
    ) : (
      <div className="flex justify-center">
        <X className="h-4 w-4 text-muted-foreground/30" />
      </div>
    )
  }
  return (
    <span className={cn('text-center text-sm', highlighted && 'font-semibold text-primary')}>
      {value}
    </span>
  )
}

function CompactSupportCell({ value, highlighted }: { value: boolean | string; highlighted?: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <div className="flex justify-center">
        <Check className={cn('size-3.5', highlighted ? 'text-primary' : 'text-green-500')} />
      </div>
    ) : (
      <div className="flex justify-center">
        <X className="size-3.5 text-muted-foreground/25" />
      </div>
    )
  }
  return (
    <span className={cn('text-center text-[11px]', highlighted && 'font-semibold text-primary')}>
      {value}
    </span>
  )
}

function CompactPlanCard({
  plan,
  isCurrent,
  billingCycle,
  onUpgrade,
}: {
  plan: MemberPlan
  isCurrent: boolean
  billingCycle: 'monthly' | 'yearly'
  onUpgrade: () => void
}) {
  const { t } = useTranslation()
  const Icon = planIcons[plan.level] || Star
  const price = billingCycle === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice : plan.price
  const colorAccent =
    plan.level === 'standard' ? 'border-primary/40 bg-primary/3' :
    ''

  return (
    <button
      type="button"
      onClick={isCurrent ? undefined : onUpgrade}
      className={cn(
        'relative flex flex-col items-center rounded-xl border-2 px-3 py-3 text-center transition-all active:scale-[0.97]',
        isCurrent
          ? 'border-primary bg-primary/5 cursor-default'
          : colorAccent || 'border-transparent bg-muted/30 hover:border-primary/30',
      )}
    >
      {isCurrent && (
        <Badge variant="default" className="absolute -top-2 h-4.5 px-1.5 text-[10px] leading-none">
          {t('member.currentPlanBadge')}
        </Badge>
      )}
      <div className={cn(
        'flex size-8 items-center justify-center rounded-lg mb-1.5',
        plan.level === 'standard' ? 'bg-primary/15' : 'bg-muted',
      )}>
        <Icon className={cn(
          'size-4',
          plan.level === 'standard' ? 'text-primary' : 'text-muted-foreground',
        )} />
      </div>
      <p className="text-xs font-semibold">{plan.name}</p>
      <p className="mt-0.5 text-lg font-bold">
        ¥{(price / 100).toFixed(0)}
        <span className="text-[10px] font-normal text-muted-foreground">{billingCycle === 'yearly' ? t('member.perYear') : t('member.perMonth')}</span>
      </p>
      {plan.features && plan.features.length > 0 && (
        <ul className="mt-2 space-y-0.5 w-full text-left">
          {plan.features.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Check className="size-2.5 shrink-0 text-green-500" />
              {f}
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className="text-[10px] text-muted-foreground/60">{t('member.moreItems', { count: plan.features.length - 3 })}</li>
          )}
        </ul>
      )}
    </button>
  )
}
