import { get, post, patch } from '@/lib/request'

export interface CouponData {
  id: string
  code: string
  type: 'percentage' | 'fixed' | 'free_trial'
  value: number
  minAmount?: number | null
  maxUses?: number | null
  usedCount: number
  validFrom: string
  validUntil?: string | null
  isActive: boolean
  createdAt: string
}

export interface CouponValidateResult {
  coupon: CouponData
  discount: number
  finalAmount: number
}

export interface CouponListResult {
  items: CouponData[]
  total: number
  page: number
  pageSize: number
}

export function getAllCoupons(params?: { page?: number; pageSize?: number; keyword?: string }) {
  return get<CouponListResult>('/coupons', params)
}

export function createCoupon(data: {
  code: string
  type: string
  value: number
  minAmount?: number
  maxUses?: number
  validUntil?: string
}) {
  return post<CouponData>('/coupons', data)
}

export function updateCoupon(id: string, data: { isActive?: boolean; maxUses?: number; validUntil?: string }) {
  return patch<CouponData>(`/coupons/${id}`, data)
}

export function validateCoupon(code: string, amount: number) {
  return post<CouponValidateResult>('/coupons/validate', { code, amount })
}
