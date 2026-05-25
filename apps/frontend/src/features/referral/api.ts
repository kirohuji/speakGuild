import { get, post } from '@/lib/request'

export interface ReferralCodeData {
  id: string
  userId: string
  code: string
  totalInvited: number
  totalReward: number
  createdAt: string
}

export interface ReferralStats {
  code: string | null
  totalInvited: number
  totalReward: number
  referrals: {
    userId: string
    userName: string
    userImage: string | null
    joinedAt: string
    rewarded: boolean
  }[]
}

export function getReferralCode() {
  return get<ReferralCodeData>('/referral/code')
}

export function getReferralStats() {
  return get<ReferralStats>('/referral/stats')
}

export function applyReferral(code: string) {
  return post('/referral/apply', { code })
}
