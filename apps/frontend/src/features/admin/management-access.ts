export type ManagementRole = 'user' | 'creator' | 'admin'

export const CREATOR_ROUTE_PREFIXES = [
  '/admin/learning-content',
  '/admin/scenes',
  '/admin/nqtr',
  '/admin/learning-packs',
  '/admin/narrative',
  '/admin/narrative-assets',
  '/admin/script-packs',
] as const

export const CREATOR_MENU_KEYS = new Set([
  'learning-content',
  'nqtr',
  'learning-packs',
  'narrative',
  'narrative-assets',
  'script-packs',
])

export function canAccessManagementPath(role: ManagementRole | undefined, pathname: string) {
  if (role === 'admin') return true
  if (role !== 'creator') return false
  return CREATOR_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function managementHome(role: ManagementRole | undefined) {
  return role === 'creator' ? '/admin/learning-content' : '/admin/users'
}
