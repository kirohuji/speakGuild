export interface AuthSessionSnapshot {
  user?: {
    id?: string
    role?: string
  } | null
}

let currentSessionSnapshot: AuthSessionSnapshot | null = null

export function getCurrentSessionSnapshot() {
  return currentSessionSnapshot
}

export function setCurrentSessionSnapshot(session: AuthSessionSnapshot | null) {
  currentSessionSnapshot = session
}
