import { get, post } from '@/lib/request'

export interface MemberPlan {
  planId: string
  name: string
  level: 'free' | 'standard' | 'advanced'
  price: number          // 月付价格（分）
  yearlyPrice?: number | null  // 年付价格（分）
  period: string
  durationDays: number
  description: string
  features: string[]
  highlighted?: boolean
}

export interface CurrentMembership {
  userId: string
  planId: string | null
  planName: string
  level: 'free' | 'standard' | 'advanced' | 'admin'
  isActive: boolean
  expiredAt?: string | null
  startedAt?: string | null
  autoRenew?: boolean
  cancelledAt?: string | null
  rcProductId?: string | null
  pendingProductId?: string | null
  billingIssueAt?: string | null
  sync?: { synced: boolean; active?: boolean; reason?: string }
  message: string
}

export interface MemberBenefit {
  benefitId: string
  name: string
  freeSupport: boolean | string
  standardSupport: boolean | string
  advancedSupport: boolean | string
}

export interface OrderResult {
  orderNo: string
  amount: number
  paymentMethod: 'alipay' | 'wechat'
  payUrl?: string
  qrCode?: string
  status: string
}

export interface OrderStatus {
  orderNo: string
  amount: number
  paymentMethod: string
  status: string
  paidAt: string | null
}

export const getMemberPlans = (): Promise<MemberPlan[]> => get('/membership/plans')

export const getCurrentMembership = (): Promise<CurrentMembership> =>
  get('/membership/current')

export const getMemberBenefits = (): Promise<MemberBenefit[]> => get('/membership/benefits')

export interface MembershipPurchase {
  id: string
  kind: 'monthly' | 'yearly' | 'gift'
  days: number | null
  purchasedAt: string
  expiresAt: string | null
}

export const getMembershipPurchases = (params: { page?: number; pageSize?: number }) =>
  get<{ list: MembershipPurchase[]; total: number; page: number; pageSize: number }>('/membership/purchases', params)

/** 服务端按当前登录用户向 RevenueCat 查询；不信任客户端 CustomerInfo。 */
export const syncRevenueCatMembership = (): Promise<CurrentMembership> =>
  post('/membership/revenuecat/sync')

/** 创建支付订单 */
export const createOrder = (params: {
  planId: string
  paymentMethod: 'alipay' | 'wechat'
  billingCycle: 'monthly' | 'yearly'
  usePoints?: number
}): Promise<OrderResult> => post('/pay/orders', params)

/** 查询订单状态 */
export const getOrderStatus = (orderNo: string): Promise<OrderStatus> =>
  get(`/pay/orders/${orderNo}`)

/** Mock 确认支付（开发环境用） */
export const mockPayConfirm = (orderNo: string): Promise<{ success: boolean }> =>
  post(`/pay/mock-confirm/${orderNo}`)
