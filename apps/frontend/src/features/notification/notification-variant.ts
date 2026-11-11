import type { NotificationItem } from './api'

export type NotificationVariant =
  | 'campaign'
  | 'broadcast'
  | 'direct'
  | 'membership'
  | 'feedback'
  | 'success'
  | 'maintenance'

export function resolveNotificationVariant(item: NotificationItem): NotificationVariant {
  const title = item.title ?? ''
  if (item.imageUrl || item.isSpecial) return 'campaign'
  if (/维护|维护通知|maintenance/i.test(title)) return 'maintenance'
  if (/会员已到账|邀请奖励已到账|会员|奖励已到账/i.test(title)) return 'membership'
  if (/反馈已收到回复|反馈/i.test(title)) return 'feedback'
  if (/已生成|审核通过|批量生成完成|构建失败|审核未通过/i.test(title)) return 'success'
  if (item.type === 'broadcast') return 'broadcast'
  return 'direct'
}

/** 从正文解析「赠送 / 延长 N 天」 */
export function extractGiftDays(content: string): number | null {
  const match = content.match(/(?:赠送|延长)\s*(\d+)\s*天/)
  if (!match) return null
  const days = Number(match[1])
  return Number.isFinite(days) && days > 0 ? days : null
}
