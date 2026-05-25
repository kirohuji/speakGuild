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
  level: 'free' | 'standard' | 'advanced'
  isActive: boolean
  expiredAt?: string | null
  startedAt?: string | null
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

/** 创建支付订单 */
export const createOrder = (params: {
  planId: string
  paymentMethod: 'alipay' | 'wechat'
  billingCycle: 'monthly' | 'yearly'
}): Promise<OrderResult> => post('/pay/orders', params)

/** 查询订单状态 */
export const getOrderStatus = (orderNo: string): Promise<OrderStatus> =>
  get(`/pay/orders/${orderNo}`)

/** Mock 确认支付（开发环境用） */
export const mockPayConfirm = (orderNo: string): Promise<{ success: boolean }> =>
  post(`/pay/mock-confirm/${orderNo}`)
