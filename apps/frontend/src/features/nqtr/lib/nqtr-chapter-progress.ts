import type { NqtrQuest, NqtrSave } from '../model/types'
import type { QuestProgress } from '../model/nqtr-time-chrome'

export type NqtrChapterProgressItem = {
  id: string
  title: string
  summary?: string | null
  teachingMarkdown?: string | null
  hasTeachingDocument?: boolean
  sortOrder?: number
  passed?: boolean
  isUnlocked?: boolean
}

export function chapterPassedFlagKey(chapterId: string) {
  return `chapterPassed:${chapterId}`
}

export function isChapterPassedInFlags(
  flags: Record<string, string | number | boolean> | null | undefined,
  chapterId: string,
): boolean {
  return flags?.[chapterPassedFlagKey(chapterId)] === true
}

export function markChapterPassedInFlags(
  flags: Record<string, string | number | boolean>,
  chapterId: string,
): Record<string, string | number | boolean> {
  const key = chapterPassedFlagKey(chapterId)
  if (flags[key] === true) return flags
  return { ...flags, [key]: true }
}

export function chapterQuestsCompleted(
  quests: NqtrQuest[],
  questProgress: QuestProgress | null | undefined,
): boolean {
  if (!quests.length) return false
  return quests.every((quest) => questProgress?.[quest.key]?.status === 'completed')
}

/** 前一章未通关则锁后章；已通关章节可重进。 */
export function resolveNqtrChapterUnlock<T extends NqtrChapterProgressItem>(
  chapters: T[],
  save: NqtrSave | null,
): Array<T & { passed: boolean; isUnlocked: boolean }> {
  const ordered = [...chapters].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return ordered.map((chapter, index) => {
    const passed = Boolean(chapter.passed) || isChapterPassedInFlags(save?.flags, chapter.id)
    const previousPassed = index === 0
      || isChapterPassedInFlags(save?.flags, ordered[index - 1]!.id)
      || Boolean(ordered[index - 1]?.passed)
    return {
      ...chapter,
      passed,
      isUnlocked: passed || previousPassed,
    }
  })
}
