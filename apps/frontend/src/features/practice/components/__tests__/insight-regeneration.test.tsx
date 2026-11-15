// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ role: 'admin', online: true, post: vi.fn(), cache: vi.fn(), error: vi.fn(), resolve: vi.fn(), read: vi.fn() }))
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: { user: { id: 'admin', role: state.role } } }) }))
vi.mock('@/providers/auth-session', () => ({ getCurrentSessionSnapshot: () => ({ user: { id: 'admin' } }) }))
vi.mock('@/hooks/use-online-status', () => ({ useOnlineStatus: () => state.online }))
vi.mock('@/lib/request', () => ({ post: state.post }))
vi.mock('@/lib/request-feedback', () => ({ showRequestError: state.error }))
vi.mock('@/lib/offline/insight-content', () => ({ cacheInsightContentPatch: state.cache, readInsightContentPatch: state.read, resolveInsightContentId: state.resolve }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: state.error } }))
import { InsightRegenerateButton, useInsightRegeneration } from '../insight-regeneration'
const item = { kind: 'word' as const, id: 'target' }
beforeEach(() => {
  vi.clearAllMocks(); state.role = 'admin'; state.online = true
  state.cache.mockResolvedValue(undefined)
  state.resolve.mockImplementation(async (_kind: string, id: string) => id)
  state.read.mockResolvedValue({})
  state.post.mockResolvedValue({ kind: 'word', id: 'target', patch: { description: 'new' }, updatedAt: '2026-11-15' })
})
afterEach(cleanup)
it('does no administrator snapshot work when a regular user opens an insight', async () => {
  state.role = 'user'
  function Probe() { const result = useInsightRegeneration(item); return <div>{result.item.id}</div> }
  render(<Probe />)
  await act(async () => {})
  expect(screen.getByText('target')).toBeTruthy()
  expect(state.resolve).not.toHaveBeenCalled()
  expect(state.read).not.toHaveBeenCalled()
})
it('hides the action for regular users and on the dictionary tab', () => {
  state.role = 'user'
  const view = render(<InsightRegenerateButton item={item} field="description" onUpdated={() => {}} />)
  expect(screen.queryByRole('button')).toBeNull()
  state.role = 'admin'
  view.rerender(<InsightRegenerateButton item={item} field="dictionary" onUpdated={() => {}} />)
  expect(screen.queryByRole('button')).toBeNull()
})
it('disables generation offline without sending a request', () => {
  state.online = false
  render(<InsightRegenerateButton item={item} field="examples" onUpdated={() => {}} />)
  const button = screen.getByRole('button') as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(button); expect(state.post).not.toHaveBeenCalled()
})
it('sends the selected field and publishes the refreshed view after its local cache commits', async () => {
  const updated = vi.fn()
  render(<InsightRegenerateButton item={item} field="description" onUpdated={updated} />)
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(updated).toHaveBeenCalledWith({ description: 'new' }))
  expect(state.post).toHaveBeenCalledWith('/admin/insight-content/word/target/regenerate', { field: 'description' }, expect.anything())
  expect(state.cache).toHaveBeenCalledWith('word', 'target', { description: 'new' })
})
it('does not apply a completed request to a different word after navigation', async () => {
  let resolve!: (value: any) => void
  state.post.mockReturnValue(new Promise(r => { resolve = r }))
  const updated = vi.fn()
  const view = render(<InsightRegenerateButton item={item} field="description" onUpdated={updated} />)
  fireEvent.click(screen.getByRole('button'))
  view.rerender(<InsightRegenerateButton item={{ ...item, id: 'another' }} field="description" onUpdated={updated} />)
  await act(async () => resolve({ kind: 'word', id: 'target', patch: { description: 'new' } }))
  expect(state.cache).toHaveBeenCalled()
  expect(updated).not.toHaveBeenCalled()
})
it('reports a cache failure after saving remotely and never claims full success', async () => {
  state.cache.mockRejectedValueOnce(new Error('disk full'))
  const updated = vi.fn()
  render(<InsightRegenerateButton item={item} field="description" onUpdated={updated} />)
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(state.error).toHaveBeenCalledWith('后端已保存，本地缓存更新失败，请同步后重试'))
  expect(updated).not.toHaveBeenCalled()
})
