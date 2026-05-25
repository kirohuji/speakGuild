import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, Crown, Star, Zap, Shield, ChevronLeft, Sparkles, Loader2, QrCode, ExternalLink, Monitor } from 'lucide-react'
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
import { cn } from '@/lib/cn'

const FALLBACK_BENEFITS: MemberBenefit[] = [
  { benefitId: '1', name: '题库使用数量', freeSupport: '1 套', standardSupport: '3 套', advancedSupport: '无限' },
  { benefitId: '2', name: 'AI 练习反馈', freeSupport: false, standardSupport: true, advancedSupport: true },
  { benefitId: '3', name: '模拟考试', freeSupport: '5 次/月', standardSupport: '30 次/月', advancedSupport: '无限' },
  { benefitId: '4', name: '练习记录', freeSupport: true, standardSupport: true, advancedSupport: true },
  { benefitId: '5', name: '收藏题目', freeSupport: true, standardSupport: true, advancedSupport: true },
  { benefitId: '6', name: '生词本', freeSupport: true, standardSupport: true, advancedSupport: true },
  { benefitId: '7', name: '客服支持', freeSupport: false, standardSupport: '工作日', advancedSupport: '全天' },
  { benefitId: '8', name: 'AI 智能出卷', freeSupport: false, standardSupport: false, advancedSupport: true },
]

const planIcons: Record<string, React.ElementType> = {
  free: Star,
  standard: Crown,
  advanced: Zap,
}

export function MemberPage() {
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

  useEffect(() => {
    Promise.allSettled([getMemberPlans(), getCurrentMembership(), getMemberBenefits()]).then(
      ([plansRes, curRes, benRes]) => {
        if (plansRes.status === 'fulfilled') setPlans(plansRes.value)
        if (curRes.status === 'fulfilled') setCurrent(curRes.value)
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
      })
      setPayResult(result)

      // 支付宝 PC 支付：在新窗口打开
      if (result.payUrl && method === 'alipay') {
        window.open(result.payUrl, '_blank')
      }
    } catch (err: any) {
      setPayError(err?.response?.data?.message || '创建订单失败')
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
      setPayError('模拟支付确认失败')
    } finally {
      setPayLoading(false)
    }
  }, [payResult])

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* 手机端返回栏 */}
      <div className="relative flex items-center justify-center lg:hidden">
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">{t('member.title')}</h1>
      </div>

      {/* 当前套餐 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('member.currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent>
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
                      {current?.isActive ? '生效中' : '免费'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {current?.expiredAt
                      ? `${new Date(current.expiredAt).toLocaleDateString('zh-CN')} 到期`
                      : '升级解锁更多功能'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 选择套餐 */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">选择套餐</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{t('member.subtitle')}</p>
            </div>
            <div className="inline-flex rounded-xl bg-muted p-1 self-start">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
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
                  'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
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
          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[320px] rounded-xl" />)}
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border py-12 text-center text-sm text-muted-foreground">
              {t('common.empty')}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
          )}
        </CardContent>
      </Card>

      {/* 权益对比 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('member.benefits')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
            </div>
          ) : benefits.length === 0 ? (
            <div className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
              {t('common.empty')}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-4 items-center gap-2 bg-muted/50 px-4 py-2.5">
                <span className="text-xs font-semibold text-muted-foreground">{t('member.columns.benefit')}</span>
                <span className="text-center text-xs font-semibold text-muted-foreground">{t('member.columns.free')}</span>
                <span className="text-center text-xs font-semibold text-muted-foreground">{t('member.columns.standard')}</span>
                <span className="text-center text-xs font-semibold text-muted-foreground">{t('member.columns.advanced')}</span>
              </div>
              {benefits.map((item, idx) => (
                <div
                  key={item.benefitId}
                  className={cn(
                    'grid grid-cols-4 items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-muted/30',
                    idx !== benefits.length - 1 && 'border-b border-border/50'
                  )}
                >
                  <span className="font-medium">{item.name}</span>
                  <SupportCell value={item.freeSupport} />
                  <SupportCell value={item.standardSupport} />
                  <SupportCell value={item.advancedSupport} highlighted />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 服务说明 */}
      <Card>
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

      {/* 支付弹窗 */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认支付</DialogTitle>
            <DialogDescription>
              选择支付方式完成购买
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 支付信息 */}
            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">套餐</span>
                <span className="font-medium">{payPlan?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">周期</span>
                <span className="font-medium">
                  {billingCycle === 'yearly' ? '年付 (83折)' : '月付'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">应付金额</span>
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
                  请使用微信扫描二维码完成支付
                </p>
                <p className="text-xs text-muted-foreground/60">
                  订单号：{payResult.orderNo}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMockConfirm}
                  disabled={payLoading}
                  className="w-full"
                >
                  {payLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  （开发环境）模拟支付成功
                </Button>
              </div>
            )}

            {/* 支付宝已跳转 */}
            {payResult?.payUrl && (
              <div className="rounded-xl border bg-blue-500/5 p-4 text-center">
                <Monitor className="mx-auto h-8 w-8 text-blue-500 mb-2" />
                <p className="text-sm mb-1">已在新窗口打开支付宝支付页面</p>
                <p className="text-xs text-muted-foreground mb-3">
                  如果未自动打开，请点击下方按钮
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(payResult.payUrl, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    重新打开
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleMockConfirm}
                    disabled={payLoading}
                  >
                    {payLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    模拟支付成功
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
                  <span className="text-sm font-medium">支付宝</span>
                  <span className="text-xs text-muted-foreground">网页/扫码支付</span>
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
                  <span className="text-sm font-medium">微信支付</span>
                  <span className="text-xs text-muted-foreground">扫码支付</span>
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
