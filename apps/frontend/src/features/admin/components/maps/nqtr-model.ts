/** @deprecated Prefer `@/features/nqtr/model/nqtr-time-chrome`. Kept for admin import paths. */
export {
  type NqtrTimeSlot,
  type NqtrTimeSettings,
  defaultNqtrTime,
  parseNqtrTime,
  nqtrTimeToMinutes,
  formatNqtrTime,
  type NqtrCommandKey,
  type NqtrCommandStyle,
  type NqtrChrome,
  NQTR_COMMANDS,
  defaultNqtrChrome,
  parseNqtrChrome,
  type QuestProgressStatus,
  type QuestProgress,
} from '@/features/nqtr/model/nqtr-time-chrome'

/** 全局行为。房间只保存对它的引用。文档/草稿形状；运行时请用 api-content-admin 的完整类型。 */
export type NqtrTrigger = 'click' | 'auto'

export type NqtrActivityDraft = {
  key: string
  title: string
  minutes: number
  startMinute?: number
  endMinute?: number
  trigger: NqtrTrigger
  inkScriptId?: string
  hiddenFlag?: string
  disabledFlag?: string
}

/** 一条日程只占一个时间段、一间房、一个角色。 */
export type NqtrCommitmentDraft = {
  key: string
  characterId: string
  roomId: string
  startMinute: number
  endMinute: number
  priority: number
  trigger: NqtrTrigger
  inkScriptId?: string
}

/** @deprecated 使用 NqtrActivityDraft，避免与 api-content-admin.NqtrActivity 同名冲突 */
export type NqtrActivity = NqtrActivityDraft
/** @deprecated 使用 NqtrCommitmentDraft */
export type NqtrCommitment = NqtrCommitmentDraft
