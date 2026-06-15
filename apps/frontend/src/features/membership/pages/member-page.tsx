import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, X, Crown, Star, Zap, Shield, ChevronLeft, Sparkles, Loader2, QrCode, ExternalLink, Monitor, Gift, RefreshCw, Settings } from 'lucide-react'
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
import { isNative, revenueCat } from '@/lib/native'
import { useRevenueCat } from '@/hooks/use-revenuecat'
import { useProfileCacheStore } from '@/features/profile/profile-cache.store'

const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Star,
  standard: Crown,
}

const FALLBACK_BENEFITS: MemberBenefit[] = [
  { benefitId: '1', name: 'AI 每轮评价', freeSupport: '5 次/天', standardSupport: '更多次数', advancedSupport: '更多次数' },
  { benefitId: '2', name: 'AI 完成复盘', freeSupport: '1 次/天', standardSupport: '更多次数', advancedSupport: '更多次数' },
  { benefitId: '3', name: '剧本模式', freeSupport: '体验剧集', standardSupport: '完整开放', advancedSupport: '完整开放' },
  { benefitId: '4', name: '主题化练习', freeSupport: '基础主题', standardSupport: '更多主题', advancedSupport: '更多主题' },
  { benefitId: '5', name: '完成后自由练习', freeSupport: false, standardSupport: true, advancedSupport: true },
  { benefitId: '6', name: '表达库容量', freeSupport: '基础容量', standardSupport: '更多收纳', advancedSupport: '更多收纳' },
]

export function MemberPage({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<MemberPlan[]>([])
  const [current, setCurrent] = useState<CurrentMembership | null>(null)
  const [benefits, setBenefits] = useState<MemberBenefit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')
  const [subscriptionAction, setSubscriptionAction] = useState<'restore' | 'manage' | null>(null)
  const setCachedMembership = useProfileCacheStore((s) => s.setMembership)
  const revenueCatState = useRevenueCat()

  const isNativeApp = isNative()
  const isRevenueCatUnlimited = isNativeApp && revenueCatState.hasUnlimited
  const isAdmin = current?.level === 'admin'
  const hasActiveMembership = isRevenueCatUnlimited || !!current?.isActive

  // 支付弹窗
  const [payOpen, setPayOpen] = useState(false)
  const [payPlan, setPayPlan] = useState<MemberPlan | null>(null)
  const [payResult, setPayResult] = useState<OrderResult | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [pointsBalance, setPointsBalance] = useState(0)
  const [usePoints, setUsePoints] = useState(false)
  const selectedPayPrice = payPlan
    ? billingCycle === 'yearly' && payPlan.yearlyPrice
      ? payPlan.yearlyPrice
      : payPlan.price
    : 0
  const appliedPoints = usePoints ? Math.min(pointsBalance, selectedPayPrice) : 0
  const checkoutAmount = selectedPayPrice - appliedPoints
  const yearlyOriginalPrice = payPlan ? payPlan.price * 12 : 0
  const yearlySaving = billingCycle === 'yearly' ? Math.max(0, yearlyOriginalPrice - selectedPayPrice) : 0
  const yearlyDiscount = yearlyOriginalPrice > 0
    ? (selectedPayPrice / yearlyOriginalPrice * 10).toFixed(1)
    : '10.0'

  useEffect(() => {
    Promise.allSettled([getMemberPlans(), getCurrentMembership(), getMemberBenefits(), pointsApi.getBalance()]).then(
      ([plansRes, curRes, benRes, ptsRes]) => {
        if (plansRes.status === 'fulfilled') setPlans(plansRes.value)
        if (curRes.status === 'fulfilled') {
          setCurrent(curRes.value)
          setCachedMembership(curRes.value)
        }
        if (ptsRes.status === 'fulfilled') setPointsBalance(ptsRes.value.points)
        if (benRes.status === 'fulfilled' && benRes.value.length > 0) {
          setBenefits(benRes.value)
        } else {
          setBenefits(FALLBACK_BENEFITS)
        }
        setIsLoading(false)
      }
    )
  }, [setCachedMembership])

  const refreshMembership = useCallback(async (retryUntilActive = false) => {
    let latest: CurrentMembership | null = null
    const attempts = retryUntilActive ? 5 : 1

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      latest = await getCurrentMembership()
      setCurrent(latest)
      setCachedMembership(latest)
      if (!retryUntilActive || latest.isActive || latest.level === 'admin') break
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }

    return latest
  }, [setCachedMembership])

  const handleUpgrade = useCallback(async (plan: MemberPlan) => {
    if (isNativeApp) {
      try {
        const result = await revenueCat.presentPaywallIfNeeded()
        await revenueCat.refreshCustomerInfo()
        if (result?.result === 'PURCHASED' || result?.result === 'RESTORED') {
          await refreshMembership(true).catch(() => null)
          toast.success('Subscription updated')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Unable to open RevenueCat paywall')
      }
      return
    }

    setPayPlan(plan)
    setPayResult(null)
    setPayError(null)
    setPayOpen(true)
  }, [isNativeApp, refreshMembership])

  const handleRestorePurchases = useCallback(async () => {
    setSubscriptionAction('restore')
    try {
      await revenueCatState.restorePurchases()
      await refreshMembership(true).catch(() => null)
      toast.success('购买记录已恢复')
    } catch (err: any) {
      toast.error(err?.message || '恢复购买失败')
    } finally {
      setSubscriptionAction(null)
    }
  }, [refreshMembership, revenueCatState])

  const handleManageSubscription = useCallback(async () => {
    setSubscriptionAction('manage')
    try {
      await revenueCatState.presentCustomerCenter()
      await refreshMembership().catch(() => null)
    } catch (err: any) {
      toast.error(err?.message || '暂时无法打开订阅管理')
    } finally {
      setSubscriptionAction(null)
    }
  }, [refreshMembership, revenueCatState])

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
      await refreshMembership(true)
    } catch {
      setPayError(t('member.mockConfirmFailed'))
    } finally {
      setPayLoading(false)
    }
  }, [payResult, refreshMembership, t])

  const plansContent = isLoading ? (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {[1, 2].map((i) => <Skeleton key={i} className="h-[280px] rounded-xl" />)}
    </div>
  ) : plans.length === 0 ? (
    <div className="rounded-xl border py-12 text-center text-sm text-muted-foreground">
      {t('common.empty')}
    </div>
  ) : (
    <div className={cn(
      plans.length === 1
        ? 'flex justify-center'
        : 'grid gap-3 grid-cols-1 sm:grid-cols-2'
    )}>
      {plans.map((plan) => (
        <PricingCard
          key={plan.planId}
          plan={plan}
          isCurrent={current?.planId === plan.planId}
          billingCycle={billingCycle}
          onUpgrade={() => handleUpgrade(plan)}
          compact={plans.length === 1}
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
          className="absolute left-0 inline-flex size-10 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <h1 className="text-base font-semibold">{t('member.title')}</h1>
      </div>}

      {/* 当前套餐 — compact 模式更紧凑 */}
      {compact ? (
        <div className={cn(
          'overflow-hidden rounded-xl px-4 py-3.5',
          isAdmin
            ? 'bg-gradient-to-br from-purple-500/10 via-violet-500/8 to-indigo-500/10'
            : 'bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-sky-500/8',
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              isAdmin ? 'bg-purple-500/15' : hasActiveMembership ? 'bg-amber-500/15' : 'bg-muted',
            )}>
              {isAdmin ? (
                <Shield className="size-5 text-purple-500" />
              ) : hasActiveMembership ? (
                <Crown className="size-5 text-amber-500" />
              ) : (
                <Star className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate">{isAdmin ? '管理员' : current?.planName || t('member.freeUser')}</p>
                <Badge variant={isAdmin ? 'default' : hasActiveMembership ? 'default' : 'secondary'} className={cn('h-4.5 px-1.5 text-[10px] leading-none', isAdmin && 'bg-purple-500 hover:bg-purple-500')}>
                  {isAdmin ? '全部权限' : hasActiveMembership ? t('member.badgeActive') : t('member.badgeFree')}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isAdmin ? '所有功能已解锁，AI 无限畅用' : current?.expiredAt
                  ? `${new Date(current.expiredAt).toLocaleDateString()} ${t('member.expiresSuffix')}`
                  : t('member.upgradeExperience')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <section className={cn(
          'overflow-hidden rounded-lg p-4',
          isAdmin
            ? 'bg-gradient-to-br from-purple-100 via-violet-50 to-indigo-100 dark:from-purple-950/40 dark:via-violet-950/20 dark:to-indigo-950/40'
            : 'bg-gradient-to-br from-amber-100 via-orange-50 to-sky-100 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-sky-950/40',
        )}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('member.center')}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal text-foreground">
                {isAdmin ? '管理员模式' : t('member.unlockExperience')}
              </h2>
              <p className="mt-2 max-w-[260px] text-xs leading-5 text-muted-foreground">
                {isAdmin ? '你拥有全部功能的访问权限，无需购买任何套餐。' : t('member.subtitle')}
              </p>
            </div>
            <div className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full',
              isAdmin ? 'bg-purple-500/15 text-purple-500' : 'bg-background/70 text-amber-500',
            )}>
              {isAdmin ? <Shield className="size-6" /> : <Crown className="size-6" />}
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
                    isAdmin ? 'bg-purple-500/10' : hasActiveMembership ? 'bg-amber-500/10' : 'bg-muted',
                  )}>
                    {isAdmin ? (
                      <Shield className="h-5 w-5 text-purple-500" />
                    ) : hasActiveMembership ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{isAdmin ? '管理员' : current?.planName || t('member.freeUser')}</p>
                      <Badge variant={isAdmin ? 'default' : hasActiveMembership ? 'default' : 'secondary'} className={cn('text-xs', isAdmin && 'bg-purple-500 hover:bg-purple-500')}>
                        {isAdmin ? '全部权限' : hasActiveMembership ? t('member.badgeActive') : t('member.badgeFree')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isAdmin ? '所有功能已解锁，AI 无限畅用' : current?.expiredAt
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

      {isNativeApp && !isAdmin && (
        compact ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs"
              onClick={handleRestorePurchases}
              disabled={subscriptionAction !== null}
            >
              {subscriptionAction === 'restore' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              恢复购买
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs"
              onClick={handleManageSubscription}
              disabled={subscriptionAction !== null}
            >
              {subscriptionAction === 'manage' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Settings className="h-3.5 w-3.5" />
              )}
              管理订阅
            </Button>
          </div>
        ) : (
          <Card className="rounded-lg border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Apple 订阅</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  恢复已购买的会员权益，或打开系统订阅中心管理续费。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={handleRestorePurchases}
                  disabled={subscriptionAction !== null}
                >
                  {subscriptionAction === 'restore' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  恢复购买
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={handleManageSubscription}
                  disabled={subscriptionAction !== null}
                >
                  {subscriptionAction === 'manage' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  管理订阅
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* 选择套餐 — 管理员不显示 */}
      {!isAdmin && (
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
            <div className={cn(
              plans.length === 1
                ? 'block'
                : 'grid grid-cols-2 gap-2'
            )}>
              {isLoading ? (
                <Skeleton className="h-[168px] rounded-2xl" />
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
                    compact={plans.length === 1}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* 管理员：全部功能已解锁提示 */}
      {isAdmin && !compact && (
        <Card className="rounded-lg border-border/70 border-purple-500/30 bg-purple-500/[0.03] shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
              <Zap className="size-6 text-purple-500" />
            </div>
            <div>
              <p className="font-semibold">全部功能已解锁</p>
              <p className="text-sm text-muted-foreground">作为管理员，你拥有所有套餐的全部功能权限，包括无限 AI 调用。</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isAdmin && compact && (
        <div className="rounded-xl bg-purple-500/[0.06] px-3 py-3 flex items-center gap-2.5">
          <Zap className="size-4 shrink-0 text-purple-500" />
          <p className="text-xs text-muted-foreground">管理员 · 全部功能已解锁 · AI 无限畅用</p>
        </div>
      )}

      {/* 权益对比 — admin 显示全部已解锁 */}
      {isAdmin ? (
        <div className={compact ? 'overflow-hidden rounded-xl bg-muted/30' : ''}>
          {!compact && (
            <Card className="rounded-lg border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">权益说明</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg bg-muted/30">
                  <div className="grid grid-cols-3 items-center gap-2 bg-muted/50 px-4 py-2.5">
                    <span className="text-xs font-semibold text-muted-foreground">权益项</span>
                    <span className="text-center text-xs font-semibold text-muted-foreground">普通用户</span>
                    <span className="text-center text-xs font-semibold text-purple-500">管理员</span>
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
                      <div className="flex justify-center">
                        <Check className="size-4 text-purple-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {compact && (
            <div className="rounded-xl bg-muted/30 px-3 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">管理权益</p>
              <div className="flex items-center gap-2 rounded-lg bg-purple-500/[0.06] px-3 py-2.5">
                <Check className="size-3.5 shrink-0 text-purple-500" />
                <p className="text-xs text-muted-foreground">全部功能已解锁，所有套餐权益均享有</p>
              </div>
            </div>
          )}
        </div>
      ) : (
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
      )}

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
        <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border-border/70 p-5 shadow-xl sm:max-w-md sm:p-6">
          <DialogHeader className="pr-6 text-left">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Crown className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base">{t('member.payTitle')}</DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-5">
                  {t('member.checkoutDesc', { plan: payPlan?.name || t('member.title') })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5">
            {/* 支付信息 */}
            <div className="overflow-hidden rounded-lg bg-muted/30">
              <div className="flex items-start justify-between gap-4 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold">{payPlan?.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {billingCycle === 'yearly'
                      ? t('member.yearlyPlanSummary', { discount: yearlyDiscount })
                      : t('member.monthlyPlanSummary')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight">¥{(checkoutAmount / 100).toFixed(2)}</p>
                  {billingCycle === 'yearly' && yearlySaving > 0 && (
                    <p className="mt-1 text-[11px] font-medium text-primary">
                      {t('member.savedAmount', { amount: (yearlySaving / 100).toFixed(2) })}
                    </p>
                  )}
                </div>
              </div>
              {appliedPoints > 0 && (
                <div className="flex items-center justify-between border-t border-border/40 px-4 py-2 text-xs">
                  <span className="text-muted-foreground">{t('member.pointsDeduction')}</span>
                  <span className="font-medium text-amber-600">- ¥{(appliedPoints / 100).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* 积分抵扣 */}
            {pointsBalance > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <Gift className="size-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('member.pointsDeduction')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('member.pointsAvailable', { points: pointsBalance, amount: (pointsBalance / 100).toFixed(2) })}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={usePoints ? 'default' : 'outline'}
                  onClick={() => setUsePoints(!usePoints)}
                  className="h-7 text-xs"
                >
                  {usePoints ? t('member.applied') : t('member.use')}
                </Button>
              </div>
            )}

            {/* 支付结果 - QR 码 */}
            {payResult?.qrCode && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-green-500/20 bg-green-500/[0.04] p-5">
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
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4 text-center">
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
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{t('member.selectPaymentMethod')}</p>
                <div className="overflow-hidden rounded-lg bg-muted/30">
                <button
                  type="button"
                  onClick={() => handlePay('alipay')}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 border-b border-border/40 px-3.5 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  {payLoading ? (
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-base font-bold text-white">
                      支
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t('member.alipay')}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{t('member.webPay')}</span>
                  </span>
                  <ChevronLeft className="size-4 rotate-180 text-muted-foreground/50" />
                </button>

                <button
                  type="button"
                  onClick={() => handlePay('wechat')}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  {payLoading ? (
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-500 text-base font-bold text-white">
                      微
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t('member.wechatPay')}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{t('member.scanPay')}</span>
                  </span>
                  <ChevronLeft className="size-4 rotate-180 text-muted-foreground/50" />
                </button>
                </div>
                <p className="pt-1 text-center text-[10px] leading-4 text-muted-foreground">
                  {t('member.paymentAgreement')}
                </p>
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
  compact = false,
}: {
  plan: MemberPlan
  isCurrent: boolean
  billingCycle: 'monthly' | 'yearly'
  onUpgrade: () => void
  compact?: boolean
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
        compact && 'w-full max-w-sm',
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
  compact = false,
}: {
  plan: MemberPlan
  isCurrent: boolean
  billingCycle: 'monthly' | 'yearly'
  onUpgrade: () => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  const Icon = planIcons[plan.level] || Star
  const price = billingCycle === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice : plan.price
  const monthlyEquivalent = billingCycle === 'yearly' && plan.yearlyPrice
    ? Math.round(plan.yearlyPrice / 12) / 100
    : plan.price / 100
  const colorAccent =
    plan.level === 'standard' ? 'border-primary/25 bg-gradient-to-br from-primary/[0.12] via-background to-amber-500/[0.08]' :
    ''

  return (
    <button
      type="button"
      onClick={isCurrent ? undefined : onUpgrade}
      className={cn(
        'group relative overflow-hidden rounded-2xl border px-4 py-4 text-left shadow-sm transition-all active:scale-[0.99]',
        compact && 'w-full',
        isCurrent
          ? 'cursor-default border-primary/40 bg-primary/[0.08]'
          : colorAccent || 'border-border/60 bg-card hover:border-primary/30 hover:shadow-md',
      )}
    >
      <div className="absolute -right-8 -top-10 size-28 rounded-full bg-primary/[0.08] blur-2xl transition-transform group-hover:scale-125" />
      {isCurrent && (
        <Badge variant="default" className="absolute right-3 top-3 h-5 px-2 text-[10px] leading-none">
          {t('member.currentPlanBadge')}
        </Badge>
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex size-10 items-center justify-center rounded-xl',
            plan.level === 'standard' ? 'bg-primary/15' : 'bg-muted',
          )}>
            <Icon className={cn(
              'size-5',
              plan.level === 'standard' ? 'text-primary' : 'text-muted-foreground',
            )} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
              SpeakGuild Pass
            </p>
            <p className="text-sm font-bold">{plan.name}</p>
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3 border-b border-primary/10 pb-3">
        <div>
          <p className="text-3xl font-bold tracking-tight">
            ¥{(price / 100).toFixed(0)}
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">{billingCycle === 'yearly' ? t('member.perYear') : t('member.perMonth')}</span>
          </p>
          {billingCycle === 'yearly' && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t('member.monthlyEquivalent', { amount: monthlyEquivalent.toFixed(0) })}</p>
          )}
        </div>
        {!isCurrent && (
          <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
            {t('member.upgrade')}
          </span>
        )}
      </div>

      {plan.features && plan.features.length > 0 && (
        <ul className="relative mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {plan.features.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
              <Check className="size-3 shrink-0 text-primary" />
              {f}
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className="text-[11px] leading-4 text-primary/80">{t('member.moreItems', { count: plan.features.length - 3 })}</li>
          )}
        </ul>
      )}
    </button>
  )
}
