export type NqtrTimeSlot = { name: string; startTime: number }

/** 与 Pixi-VN timeTracker.initialize 相同的时钟设定。startTime 用小时，18.30 表示 18:30。 */
export type NqtrTimeSettings = {
  defaultTimeSpent: number
  dayStartTime: number
  dayEndTime: number
  weekendStartDay: number
  weekLength: number
  dayNames: string[]
  timeSlots: NqtrTimeSlot[]
}

export function defaultNqtrTime(): NqtrTimeSettings {
  return {
    defaultTimeSpent: 1,
    dayStartTime: 0,
    dayEndTime: 24,
    weekendStartDay: 6,
    weekLength: 7,
    dayNames: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    timeSlots: [
      { name: '早晨', startTime: 5 },
      { name: '下午', startTime: 12 },
      { name: '傍晚', startTime: 18 },
      { name: '夜晚', startTime: 22 },
    ],
  }
}

export function parseNqtrTime(value: unknown): NqtrTimeSettings {
  const fallback = defaultNqtrTime()
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<NqtrTimeSettings>
  const slots = Array.isArray(raw.timeSlots)
    ? raw.timeSlots
      .map((slot) => ({ name: String(slot?.name || '').trim(), startTime: Number(slot?.startTime) }))
      .filter((slot) => slot.name && Number.isFinite(slot.startTime))
    : []
  return {
    defaultTimeSpent: Number(raw.defaultTimeSpent ?? fallback.defaultTimeSpent),
    dayStartTime: Number(raw.dayStartTime ?? fallback.dayStartTime),
    dayEndTime: Number(raw.dayEndTime ?? fallback.dayEndTime),
    weekendStartDay: Number(raw.weekendStartDay ?? fallback.weekendStartDay),
    weekLength: Number(raw.weekLength ?? fallback.weekLength),
    dayNames: Array.isArray(raw.dayNames) && raw.dayNames.length ? raw.dayNames.map((name) => String(name)) : fallback.dayNames,
    timeSlots: slots.length ? slots : fallback.timeSlots,
  }
}

/** Pixi-VN 用 18.30 表示 18:30，小数部分是分钟而不是小时的小数。 */
export function nqtrTimeToMinutes(time: number) {
  const hour = Math.trunc(time)
  const minute = Math.round((time - hour) * 100)
  return hour * 60 + Math.min(59, Math.max(0, minute))
}

export function formatNqtrTime(time: number) {
  const hour = Math.trunc(time)
  const minute = Math.min(59, Math.max(0, Math.round((time - hour) * 100)))
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** 画面右上角两个图标，以及热点、行为的显示尺寸。 */
export type NqtrCommandKey = 'map' | 'place'

export type NqtrCommandStyle = { icon: string; size: number }

export type NqtrChrome = {
  commands: Record<NqtrCommandKey, NqtrCommandStyle>
  hotspotIcon: string
  locationIconSize: number
  activityIcon: string
  activityIconSize: number
  talkIcon: string
  talkIconSize: number
  /** 左上角时间/地点底板图；文字叠在图中间。 */
  statusBadgeIcon: string
  statusBadgeWidth: number
  statusBadgeHeight: number
  /** 地图地点与热点名牌底板；宽度随文字略拉伸。 */
  pinLabelIcon: string
  pinLabelHeight: number
  pinLabelMinWidth: number
}

export const NQTR_COMMANDS: { key: NqtrCommandKey; label: string; hint: string }[] = [
  { key: 'map', label: '地图', hint: '画面右上角。点开整张世界地图。' },
  { key: 'place', label: '热点', hint: '和地图按钮并排。点开后显示当前地点的全部热点。' },
]

export function defaultNqtrChrome(): NqtrChrome {
  return {
    commands: {
      map: { icon: '', size: 40 },
      place: { icon: '', size: 40 },
    },
    hotspotIcon: '',
    locationIconSize: 72,
    activityIcon: '',
    activityIconSize: 56,
    talkIcon: '',
    talkIconSize: 48,
    statusBadgeIcon: '',
    statusBadgeWidth: 148,
    statusBadgeHeight: 64,
    pinLabelIcon: '',
    pinLabelHeight: 36,
    pinLabelMinWidth: 72,
  }
}

export function parseNqtrChrome(value: unknown): NqtrChrome {
  const fallback = defaultNqtrChrome()
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<NqtrChrome> & { mapButtonIcon?: string; mapButtonSize?: number; commands?: Partial<Record<string, Partial<NqtrCommandStyle>>> }
  const size = (input: unknown, next: number) => {
    const number = Number(input)
    return Number.isFinite(number) && number >= 16 ? number : next
  }
  const commands = { ...fallback.commands }
  for (const item of NQTR_COMMANDS) {
    const stored = raw.commands?.[item.key]
    const legacyIcon = item.key === 'map' ? raw.mapButtonIcon : undefined
    const legacySize = item.key === 'map' ? raw.mapButtonSize : undefined
    commands[item.key] = {
      icon: typeof stored?.icon === 'string' ? stored.icon : typeof legacyIcon === 'string' ? legacyIcon : '',
      size: size(stored?.size ?? legacySize, fallback.commands[item.key].size),
    }
  }
  return {
    commands,
    hotspotIcon: typeof raw.hotspotIcon === 'string' ? raw.hotspotIcon : '',
    locationIconSize: size(raw.locationIconSize, fallback.locationIconSize),
    activityIcon: typeof raw.activityIcon === 'string' ? raw.activityIcon : '',
    activityIconSize: size(raw.activityIconSize, fallback.activityIconSize),
    talkIcon: typeof raw.talkIcon === 'string' ? raw.talkIcon : '',
    talkIconSize: size(raw.talkIconSize, fallback.talkIconSize),
    statusBadgeIcon: typeof raw.statusBadgeIcon === 'string' ? raw.statusBadgeIcon : '',
    statusBadgeWidth: size(raw.statusBadgeWidth, fallback.statusBadgeWidth),
    statusBadgeHeight: size(raw.statusBadgeHeight, fallback.statusBadgeHeight),
    pinLabelIcon: typeof raw.pinLabelIcon === 'string'
      ? raw.pinLabelIcon
      : typeof raw.hotspotIcon === 'string' && raw.hotspotIcon
        ? raw.hotspotIcon
        : '',
    pinLabelHeight: size(raw.pinLabelHeight, fallback.pinLabelHeight),
    pinLabelMinWidth: size(raw.pinLabelMinWidth, fallback.pinLabelMinWidth),
  }
}

export type QuestProgressStatus = 'active' | 'completed'

export type QuestProgress = Record<
  string,
  { stageKey: string; status: QuestProgressStatus; startedOnDay?: number }
>
