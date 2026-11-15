// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => {
  const noop = vi.fn(async () => {})
  const data = { reset: noop, resetUserState: noop, clearHistory: noop, clearConfig: noop, ensureLoaded: noop,
    setLoginRestorePending: noop, fetchFlags: noop, initSocket: noop, disconnect: noop, fetchUnreadCount: noop, waitForPendingWrites: noop }
  return { getSession: vi.fn(), prepare: vi.fn(), snapshot: vi.fn(), noop, store: { getState: () => data },
    IsolationError: class extends Error {},
  }
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/features/auth/client', () => ({ authClient: { getSession: state.getSession }, clearBearerToken: state.noop }))
vi.mock('@/features/auth/api', () => ({ revokeOtherSessions: state.noop }))
vi.mock('@/lib/offline/account-data-ownership', () => ({ prepareAccountData: state.prepare, AccountDataIsolationError: state.IsolationError, clearAccountDataForLogout: state.noop }))
vi.mock('@/providers/auth-session', () => ({ setCurrentSessionSnapshot: state.snapshot }))
vi.mock('@/lib/offline/notebook-mutations', () => ({ serializeNotebookWrite: (work: () => Promise<unknown>) => work() }))
vi.mock('@/lib/offline/storage-events', () => ({ getOutboxVersion: () => 0, subscribeOutboxChanged: () => () => {} }))
vi.mock('@/lib/offline', () => ({ offlineStorageService: { clearUserData: state.noop }, offlineSyncService: {
  pauseForAccountReset: state.noop, resumeForAccount: state.noop, waitForIdle: state.noop, sync: state.noop,
}, scriptRepository: { refreshMyRecords: state.noop, refreshMyWorks: state.noop } }))
vi.mock('@/lib/native', () => ({ isNative: () => false, revenueCat: {} }))
vi.mock('@/lib/native/learning-reminder', () => ({ cancelLearningReminders: state.noop, rescheduleLearningReminder: state.noop, registerLearningReminderActions: state.noop, refreshLearningBadgeFromTodayRun: state.noop }))
vi.mock('@/hooks/use-management-route', () => ({ isManagementHashRoute: () => false, useManagementHashRoute: () => false }))
vi.mock('@/stores/config.store', () => ({ useConfigStore: state.store }))
vi.mock('@/stores/feature-flags.store', () => ({ useFeatureFlagsStore: state.store }))
vi.mock('@/features/notification/store', () => ({ useNotificationStore: state.store }))
vi.mock('@/stores/user.store', () => ({ useUserStore: state.store }))
vi.mock('@/stores/offline-sync.store', () => ({ useOfflineSyncStore: state.store }))
vi.mock('@/stores/search.store', () => ({ useSearchStore: state.store }))
vi.mock('@/stores/practice-activity.store', () => ({ usePracticeActivityStore: state.store, flushPracticeActivityRecords: state.noop, waitForActivityWrites: state.noop }))
vi.mock('@/stores/preferences.store', () => ({ activateAccountLearningPreferences: state.noop }))
vi.mock('@/stores/theme-preset.store', () => ({ useThemePresetStore: state.store }))
vi.mock('@/stores/daily-practice.store', () => ({ useDailyPracticeStore: state.store }))
vi.mock('@/stores/learning-statistics.store', () => ({ useLearningStatisticsStore: state.store }))
vi.mock('@/stores/learning.store', () => ({ useLearningStore: state.store, waitForCheckInCacheWrites: state.noop }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }))
import { AuthProvider, useAuth } from '../auth-provider'
const cached = { user: { id: 'a' }, token: 'cached', expiresAt: '2099-01-01' }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
function Probe() {
  const auth = useAuth()
  return <div>{auth.isLoading ? 'loading' : auth.isAuthenticated ? `private:${auth.session.user.id}` : 'logged-out'}</div>
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  localStorage.setItem('manyu-auth-session-cache', JSON.stringify(cached))
  state.getSession.mockResolvedValue(cached)
  state.prepare.mockResolvedValue({ reused: true })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('does not expose a cached session until local ownership preparation finishes', async () => {
  const ready = deferred<{ reused: boolean }>(); state.prepare.mockReturnValue(ready.promise)
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(state.prepare).toHaveBeenCalled())
  expect(screen.queryByText('private:a')).toBeNull()
  expect(screen.getByText('loading')).toBeTruthy()
  await act(async () => ready.resolve({ reused: true }))
  expect(screen.getByText('private:a')).toBeTruthy()
})
it.each([true, false])('keeps the account closed on preparation failure instead of falling back to the cached session (%s)', async typed => {
  state.prepare.mockRejectedValue(typed ? new state.IsolationError('清理失败') : new Error('缓存不可用'))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('logged-out')).toBeTruthy())
    expect(state.prepare).toHaveBeenCalledTimes(1)
    expect(state.snapshot).not.toHaveBeenCalledWith(cached)
  } finally { warn.mockRestore() }
})
it('does not let the five-second network fallback bypass pending local ownership validation', async () => {
  vi.useFakeTimers()
  state.getSession.mockReturnValue(new Promise(() => {}))
  const ready = deferred<{ reused: boolean }>(); state.prepare.mockReturnValue(ready.promise)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(state.prepare).toHaveBeenCalled()
    expect(screen.getByText('loading')).toBeTruthy()
    expect(screen.queryByText('private:a')).toBeNull()
    await act(async () => ready.resolve({ reused: true }))
    expect(screen.getByText('private:a')).toBeTruthy()
  } finally { warn.mockRestore() }
})
