import { CheckInCalendarPanel } from '@/features/learning/components/week-tracker'

/** 桌面右栏：复用移动端「我的学习」统计 Drawer 内容 */
export function LearningStatsRail({ className }: { className?: string }) {
  return <CheckInCalendarPanel className={className ?? 'min-h-0 flex-1'} />
}
