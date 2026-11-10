import type { MemberBenefit, MemberPlan } from '@/features/membership/api'

const CACHE_KEY = 'manyu-member-catalog:v1'

export interface MemberCatalogCache {
  plans: MemberPlan[]
  benefits: MemberBenefit[]
  cachedAt: number
}

export function readMemberCatalogCache(): MemberCatalogCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MemberCatalogCache
    if (!Array.isArray(parsed?.plans) || !Array.isArray(parsed?.benefits)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeMemberCatalogCache(data: Pick<MemberCatalogCache, 'plans' | 'benefits'>): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        plans: data.plans,
        benefits: data.benefits,
        cachedAt: Date.now(),
      } satisfies MemberCatalogCache),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function sameMemberPlans(a: MemberPlan[], b: MemberPlan[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function sameMemberBenefits(a: MemberBenefit[], b: MemberBenefit[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
