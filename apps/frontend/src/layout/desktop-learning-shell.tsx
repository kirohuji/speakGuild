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

export function DesktopLearningShell({
  section,
  children,
}: {
  section: DesktopLearningSection
  children: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full min-h-0 justify-center">
      {/* 大屏多余宽度落在两侧外边距，三栏整体居中，不把左右栏顶到视口边缘 */}
      <div className="flex h-full w-full min-h-0 max-w-[1480px]">
        <aside className="flex w-[360px] shrink-0 flex-col border-r border-border/50 bg-transparent">
          <nav className="flex flex-1 flex-col gap-0.5 px-2 py-4">
            {NAV_ITEMS.map(({ section: itemSection, labelKey, icon: Icon }) => {
              const active = section === itemSection
              return (
                <Link
                  key={itemSection}
                  to={desktopLearningHref(itemSection)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-background/54 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn('size-[18px] shrink-0', active && 'stroke-[2.35] text-primary')}
                  />
                  <span className="truncate">{t(labelKey)}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="scrollbar-hide min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>

        <aside className="flex w-[360px] shrink-0 flex-col border-l border-border/50 bg-transparent">
          <LearningStatsRail />
        </aside>
      </div>
    </div>
  )
}
