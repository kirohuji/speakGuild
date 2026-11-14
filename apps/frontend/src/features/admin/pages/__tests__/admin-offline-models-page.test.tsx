// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
const state = vi.hoisted(() => ({ prepare: vi.fn(), failedValidation: false }))
const catalog = [{ variantId: 'tiny-en-q8', modelId: 'Xenova/whisper-tiny.en', label: 'Whisper Tiny EN', purpose: 'stt', dtype: 'q8', files: ['config.json'] }]
const row = () => ({ id: 'release', version: 'v1', modelId: catalog[0].modelId, variantId: catalog[0].variantId, purpose: 'stt', dtype: 'q8',
  status: 'ready', isPublished: false, files: [], totalBytes: 1000, deviceValidation: state.failedValidation ? 'failed' : 'unverified', createdAt: '2026-11-14' })
vi.mock('../../api-offline-models', () => ({ offlineModelsApi: {
  list: async () => ({ catalog, versions: [row()] }), detail: async () => row(), prepare: state.prepare,
} }))
vi.mock('../../api-content-admin', () => ({ listFileAssets: async () => ({ items: [{ id: 'zip-resource', filename: 'whisper.zip', size: 1024 }] }) }))
vi.mock('@/features/file-assets/api', () => ({ uploadFileToCosAndComplete: vi.fn() }))
vi.mock('@/lib/file-asset-reference', () => ({ getFileAssetContentUrl: (id: string) => `https://assets.example/${id}` }))
vi.mock('@/lib/request-feedback', () => ({ showRequestError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { AdminOfflineModelsPage } from '../admin-offline-models-page'
beforeEach(() => { state.failedValidation = false; state.prepare.mockReset(); state.prepare.mockResolvedValue({ id: 'release' }) })
afterEach(cleanup)
const mount = () => render(<MemoryRouter><AdminOfflineModelsPage /></MemoryRouter>)
it('creates a background download task with the selected preset and source revision', async () => {
  mount(); const user = userEvent.setup()
  await screen.findByRole('button', { name: 'Whisper Tiny EN' })
  await user.click(screen.getByRole('button', { name: '准备新版本' }))
  fireEvent.change(screen.getByLabelText('版本号'), { target: { value: 'v2' } })
  await user.click(screen.getByRole('button', { name: '开始后台下载' }))
  await waitFor(() => expect(state.prepare).toHaveBeenCalledWith({ variantId: 'tiny-en-q8', version: 'v2', sourceRevision: 'main' }))
})
it('uses a selected resource ZIP for import rather than contacting the source repository', async () => {
  mount(); const user = userEvent.setup()
  await screen.findByRole('button', { name: 'Whisper Tiny EN' })
  await user.click(screen.getByRole('button', { name: '准备新版本' }))
  await user.click(screen.getByRole('tab', { name: '导入模型包' }))
  const option = await screen.findByRole('option', { name: /whisper.zip/ })
  expect(option).toBeTruthy()
  fireEvent.change(screen.getByLabelText('资源库模型包'), { target: { value: 'zip-resource' } })
  fireEvent.change(screen.getByLabelText('版本号'), { target: { value: 'import-v1' } })
  await user.click(screen.getByRole('button', { name: '开始导入校验' }))
  await waitFor(() => expect(state.prepare).toHaveBeenCalledWith({ variantId: 'tiny-en-q8', version: 'import-v1', importAssetId: 'zip-resource' }))
})
it('does not let an administrator publish a version marked as failing device validation', async () => {
  state.failedValidation = true; mount()
  const publish = await screen.findByRole('button', { name: '发布' }) as HTMLButtonElement
  expect(publish.disabled).toBe(true)
})
