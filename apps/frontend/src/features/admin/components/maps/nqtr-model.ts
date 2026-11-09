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

/** 全局行为。房间只保存对它的引用。 */
export type NqtrTrigger = "click" | "auto";

export type NqtrActivity = {
  key: string;
  title: string;
  minutes: number;
  startMinute?: number;
  endMinute?: number;
  trigger: NqtrTrigger;
  inkScriptId?: string;
  hiddenFlag?: string;
  disabledFlag?: string;
};

/** 一条日程只占一个时间段、一间房、一个角色。 */
export type NqtrCommitment = {
  key: string;
  characterId: string;
  roomId: string;
  startMinute: number;
  endMinute: number;
  priority: number;
  trigger: NqtrTrigger;
  inkScriptId?: string;
};

export type QuestProgressStatus = "active" | "completed";

export type QuestProgress = Record<
  string,
  { stageKey: string; status: QuestProgressStatus; startedOnDay?: number }
>;
