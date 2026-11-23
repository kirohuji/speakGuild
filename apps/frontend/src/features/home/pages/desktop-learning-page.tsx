import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DesktopLearningShell } from '@/layout/desktop-learning-shell'
import {
  parseDesktopLearningSection,
  type DesktopLearningSection,
} from '@/features/home/desktop-learning-section'
import { TodayTaskPage } from '@/features/learning/pages/today-task-page'
import { LearningPlanPage } from '@/features/learning/pages/learning-plan-page'
import { DesktopShopSection } from '@/features/learning/pages/desktop-shop-section'
import { LearningNotebooksPage } from '@/features/expression/pages/learning-notebooks-page'

function SectionContent({ section }: { section: DesktopLearningSection }) {
  switch (section) {
    case 'learning':
      return <LearningPlanPage />
    case 'shop':
      return <DesktopShopSection />
    case 'expressions':
      return <LearningNotebooksPage />
    case 'today':
    default:
      return <TodayTaskPage />
  }
}

export function DesktopLearningPage() {
  const [searchParams] = useSearchParams()
  const section = useMemo(
    () => parseDesktopLearningSection(searchParams.get('section')),
    [searchParams],
  )

  return (
    <DesktopLearningShell section={section}>
      <SectionContent section={section} />
    </DesktopLearningShell>
  )
}
