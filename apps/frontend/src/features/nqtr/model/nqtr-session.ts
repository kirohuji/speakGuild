import type { NqtrQuest, NqtrQuestStage, NqtrSession } from './types'
import type { NqtrTimeSettings, QuestProgress } from './nqtr-time-chrome'

export function freshSession(time: NqtrTimeSettings): NqtrSession {
  const first = [...time.timeSlots].sort((a, b) => a.startTime - b.startTime)[0]
  return {
    gameDay: 1,
    gameTime: first?.startTime ?? time.dayStartTime,
    attached: [],
    enabledCommitmentIds: [],
    questProgress: {},
    flags: {},
    applied: [],
    log: ['试玩开始'],
  }
}

export function minutesToNqtr(total: number) {
  const hour = Math.floor(total / 60)
  const minute = total % 60
  return hour + minute / 100
}

export function windowOf(item: {
  timeFrom?: number | null
  timeTo?: number | null
  startMinute?: number | null
  endMinute?: number | null
}) {
  if (item.timeFrom != null || item.timeTo != null) return { from: item.timeFrom ?? null, to: item.timeTo ?? null }
  if (item.startMinute != null || item.endMinute != null) {
    return {
      from: item.startMinute == null ? null : minutesToNqtr(item.startMinute),
      to: item.endMinute == null ? null : minutesToNqtr(item.endMinute),
    }
  }
  return { from: null, to: null }
}

export function timeContains(now: number, from: number | null, to: number | null) {
  if (from == null && to == null) return true
  if (from == null) return now < (to as number)
  if (to == null) return now >= from
  if (from <= to) return now >= from && now < to
  return now >= from || now < to
}

export function slotName(time: NqtrTimeSettings, now: number) {
  const ordered = [...time.timeSlots].sort((a, b) => a.startTime - b.startTime)
  if (!ordered.length) return '全天'
  if (now < ordered[0].startTime) return ordered[ordered.length - 1].name
  return ordered.reduce((name, slot) => (slot.startTime <= now ? slot.name : name), ordered[0].name)
}

export function dayLabel(time: NqtrTimeSettings, day: number) {
  if (!time.dayNames.length) return `第 ${day} 天`
  return time.dayNames[(day - 1) % time.dayNames.length]
}

export function pushLog(session: NqtrSession, line: string): NqtrSession {
  return { ...session, log: [line, ...session.log].slice(0, 40) }
}

export function stageReady(
  stage: NqtrQuestStage,
  startedOnDay: number,
  gameDay: number,
  flags: Record<string, string | number | boolean>,
) {
  if (stage.deltaDays && gameDay < startedOnDay + stage.deltaDays) return false
  const required = stage.requiredFlags
  if (!required || typeof required !== 'object' || Array.isArray(required)) return true
  return Object.entries(required).every(([key, value]) => flags[key] === value)
}

export function applyActions(session: NqtrSession, stage: NqtrQuestStage, phase: 'on_start' | 'on_continue') {
  let next = session
  for (const action of stage.actions ?? []) {
    if ((action.phase ?? 'on_start') !== phase) continue
    if (action.kind === 'add_activity' && action.activityId && action.roomId) {
      const exists = next.attached.some((item) => item.activityId === action.activityId && item.roomId === action.roomId)
      if (!exists) next = { ...next, attached: [...next.attached, { activityId: action.activityId, roomId: action.roomId }] }
      next = pushLog(next, `挂上行为到房间`)
    }
    if (action.kind === 'add_commitment' && action.commitmentId && !next.enabledCommitmentIds.includes(action.commitmentId)) {
      next = { ...next, enabledCommitmentIds: [...next.enabledCommitmentIds, action.commitmentId] }
      next = pushLog(next, `启用一条日程`)
    }
  }
  return next
}

export function syncStages(session: NqtrSession, quests: NqtrQuest[]) {
  let next = session
  for (const quest of quests) {
    const progress = next.questProgress[quest.key]
    if (!progress || progress.status !== 'active') continue
    const stage = [...quest.stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).find((item) => item.stageKey === progress.stageKey)
    if (!stage) continue
    const key = `${quest.key}:${stage.stageKey}:on_start`
    if (next.applied.includes(key)) continue
    if (!stageReady(stage, progress.startedOnDay ?? next.gameDay, next.gameDay, next.flags)) continue
    next = applyActions(next, stage, 'on_start')
    next = { ...next, applied: [...next.applied, key] }
    next = pushLog(next, `${quest.title} 进入「${stage.title || stage.stageKey}」`)
  }
  return next
}

export function applyQuest(
  session: NqtrSession,
  quests: NqtrQuest[],
  questId: string | null,
  questAction: 'start' | 'continue' | null,
) {
  if (!questId || !questAction) return session
  const quest = quests.find((item) => item.id === questId)
  if (!quest) return pushLog(session, '找不到关联任务')
  const stages = [...quest.stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const progress = session.questProgress[quest.key]
  if (questAction === 'start') {
    if (progress) return pushLog(session, `${quest.title} 已经领过`)
    const first = stages[0]
    if (!first) return pushLog(session, `${quest.title} 没有阶段`)
    let next: NqtrSession = {
      ...session,
      questProgress: { ...session.questProgress, [quest.key]: { stageKey: first.stageKey, status: 'active', startedOnDay: session.gameDay } },
    }
    next = pushLog(next, `领取任务「${quest.title}」`)
    return syncStages(next, quests)
  }
  if (!progress || progress.status !== 'active') return pushLog(session, `${quest.title} 还没开始`)
  const index = stages.findIndex((item) => item.stageKey === progress.stageKey)
  const current = stages[index]
  if (!current) return session
  if (!stageReady(current, progress.startedOnDay ?? session.gameDay, session.gameDay, session.flags)) {
    return pushLog(session, `${quest.title} 的「${current.title}」天数还没到`)
  }
  const continueKey = `${quest.key}:${current.stageKey}:on_continue`
  let next = session.applied.includes(continueKey) ? session : applyActions(session, current, 'on_continue')
  if (!next.applied.includes(continueKey)) next = { ...next, applied: [...next.applied, continueKey] }
  const following = stages[index + 1]
  if (!following) {
    next = {
      ...next,
      questProgress: { ...next.questProgress, [quest.key]: { ...progress, status: 'completed' } },
    }
    return pushLog(next, `完成任务「${quest.title}」`)
  }
  next = {
    ...next,
    questProgress: {
      ...next.questProgress,
      [quest.key]: { stageKey: following.stageKey, status: 'active', startedOnDay: next.gameDay },
    },
  }
  next = pushLog(next, `${quest.title} 进入下一阶段`)
  return syncStages(next, quests)
}

export function addSpent(session: NqtrSession, spent: number, time: NqtrTimeSettings) {
  if (!spent) return session
  let gameTime = session.gameTime + spent
  let gameDay = session.gameDay
  const span = Math.max(0.01, time.dayEndTime - time.dayStartTime)
  while (gameTime >= time.dayEndTime) {
    gameTime = time.dayStartTime + (gameTime - time.dayEndTime)
    gameDay += 1
    if (gameTime - time.dayStartTime > span) break
  }
  return pushLog({ ...session, gameDay, gameTime: Math.round(gameTime * 100) / 100 }, `时间推进 ${spent}`)
}

export function sessionFromSave(input: {
  gameDay: number
  gameTime: number
  questProgress?: QuestProgress | null
  flags?: Record<string, string | number | boolean> | null
  runtime?: {
    attached?: { activityId: string; roomId: string }[]
    enabledCommitmentIds?: string[]
    applied?: string[]
  } | null
  sameChapter: boolean
}): NqtrSession {
  return {
    gameDay: input.gameDay,
    gameTime: input.gameTime,
    attached: input.sameChapter ? input.runtime?.attached ?? [] : [],
    enabledCommitmentIds: input.sameChapter ? input.runtime?.enabledCommitmentIds ?? [] : [],
    questProgress: (input.questProgress ?? {}) as QuestProgress,
    flags: input.flags ?? {},
    applied: input.sameChapter ? input.runtime?.applied ?? [] : [],
    log: ['已读档'],
  }
}
