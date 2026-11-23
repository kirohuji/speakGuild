export const DESKTOP_LEARNING_SECTIONS = ['today', 'learning', 'shop', 'expressions'] as const

export type DesktopLearningSection = (typeof DESKTOP_LEARNING_SECTIONS)[number]

export const DEFAULT_DESKTOP_LEARNING_SECTION: DesktopLearningSection = 'today'

const PATH_TO_SECTION: Record<string, DesktopLearningSection> = {
  '/today': 'today',
  '/learning': 'learning',
  '/expressions': 'expressions',
}

export function parseDesktopLearningSection(value: string | null | undefined): DesktopLearningSection {
  if (value && (DESKTOP_LEARNING_SECTIONS as readonly string[]).includes(value)) {
    return value as DesktopLearningSection
  }
  return DEFAULT_DESKTOP_LEARNING_SECTION
}

export function desktopSectionFromPath(pathname: string): DesktopLearningSection | null {
  if (pathname === '/expressions' || pathname.startsWith('/expressions/')) return 'expressions'
  return PATH_TO_SECTION[pathname] ?? null
}

export function desktopLearningHref(section: DesktopLearningSection = DEFAULT_DESKTOP_LEARNING_SECTION) {
  if (section === DEFAULT_DESKTOP_LEARNING_SECTION) return '/'
  return `/?section=${section}`
}
