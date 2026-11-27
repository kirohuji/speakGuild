import { Navigate, useLocation } from 'react-router-dom'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  desktopLearningHref,
  desktopSectionFromPath,
  parseDesktopLearningSection,
} from '@/features/home/desktop-learning-section'

/** Desktop: /today|/learning|/expressions → /?section=… */
export function DesktopLegacyLearningRedirect({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const location = useLocation()
  if (isMobile) return <>{children}</>
  const section = desktopSectionFromPath(location.pathname)
  if (!section) return <>{children}</>
  if (location.pathname.startsWith('/expressions/')) return <>{children}</>
  return <Navigate to={desktopLearningHref(section)} replace />
}

/** Mobile: /?section=… → /today|/learning|/expressions */
export function MobileSectionParamRedirect({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const raw = params.get('section')
  if (!isMobile || !raw) return <>{children}</>
  const section = parseDesktopLearningSection(raw)
  const target =
    section === 'shop' ? '/learning'
      : section === 'learning' ? '/learning'
        : section === 'expressions' ? '/expressions'
          : '/today'
  return <Navigate to={target} replace />
}
