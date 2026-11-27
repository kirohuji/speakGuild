import { createContext, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Library, ListChecks, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/cn'
import { LearningStatsRail } from '@/features/home/components/learning-stats-rail'
import {
  type DesktopLearningSection,
  desktopLearningHref,
} from '@/features/home/desktop-learning-section'
import { Link } from 'react-router-dom'

const NAV_ITEMS: Array<{
  section: DesktopLearningSection
  labelKey: string
  icon: typeof ListChecks
}> = [
  { section: 'today', labelKey: 'nav.todayTask', icon: ListChecks },
  { section: 'learning', labelKey: 'nav.learningPlan', icon: BookOpen },
  { section: 'shop', labelKey: 'learning.shopTitle', icon: ShoppingBag },
  { section: 'expressions', labelKey: 'nav.myLibrary', icon: Library },
]

const DesktopAsideSlotContext = createContext<HTMLElement | null>(null)

/** 页面把右栏自定义内容（话题 / 知识点 / 本题准备）挂到壳上的 DOM 槽位 */
export function useDesktopAsideSlot() {
  return useContext(DesktopAsideSlotContext)
}

/** @deprecated 使用 useDesktopAsideSlot */
export function useDesktopTodayAsideSlot() {
  return useDesktopAsideSlot()
}

export function DesktopLearningShell({
  section,
  asideMode,
  children,
}: {
  section: DesktopLearningSection
  /** stats=学习统计；slot=由页面 portal 自定义内容 */
  asideMode?: 'stats' | 'slot'
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [asideEl, setAsideEl] = useState<HTMLElement | null>(null)
  const useSlot = asideMode === 'slot'

  return (
    <DesktopAsideSlotContext.Provider value={useSlot ? asideEl : null}>
      <div className="flex h-[calc(100dvh-3.5rem)] w-full min-h-0 justify-center">
        {/* 左导航固定窄条；主栏:右栏 ≈ φ:1（黄金比） */}
        <div className="flex h-full w-full min-h-0 max-w-[1480px]">
          <aside className="flex w-[180px] shrink-0 flex-col border-r border-border/50 bg-transparent">
            <nav className="flex flex-1 flex-col gap-0.5 px-1.5 py-4">
              {NAV_ITEMS.map(({ section: itemSection, labelKey, icon: Icon }) => {
                const active = section === itemSection
                return (
                  <Link
                    key={itemSection}
                    to={desktopLearningHref(itemSection)}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2.5 text-[15px] font-medium transition-colors',
                      active
                        ? 'bg-background/54 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn('size-5 shrink-0', active && 'stroke-[2.35] text-primary')}
                    />
                    <span className="truncate">{t(labelKey)}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-[1.618] flex-col overflow-hidden px-5 py-5">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[52rem] flex-col">{children}</div>
          </main>

          <aside className="flex min-w-0 flex-1 flex-col border-l border-border/50 bg-transparent">
            {useSlot ? (
              <div
                ref={setAsideEl}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              />
            ) : (
              <LearningStatsRail />
            )}
          </aside>
        </div>
      </div>
    </DesktopAsideSlotContext.Provider>
  )
}
