import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { BlobReader, BlobWriter, ZipWriter, Uint8ArrayReader } from '@zip.js/zip.js'
import { FileAssetsService } from '../../../../../backend/src/modules/file-assets/file-assets.service'

async function buildZip(entries: Array<{ localId: string; bytes: Uint8Array; filename?: string; mimeType?: string; sha256?: string; bizId?: string; path?: string }>) {
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  const manifest = {
    entries: entries.map((entry) => {
      const path = entry.path ?? `files/${entry.localId}.webm`
      return {
        localId: entry.localId,
        path,
        filename: entry.filename ?? `${entry.localId}.webm`,
        mimeType: entry.mimeType ?? 'audio/webm',
        sha256: entry.sha256 ?? createHash('sha256').update(entry.bytes).digest('hex'),
        bizId: entry.bizId ?? `user-recording:${entry.localId}`,
      }
    }),
  }
  await writer.add('manifest.json', new BlobReader(new Blob([JSON.stringify(manifest)], { type: 'application/json' })))
  for (const entry of entries) {
    await writer.add(entry.path ?? `files/${entry.localId}.webm`, new Uint8ArrayReader(entry.bytes))
  }
  const blob = await writer.close()
  return Buffer.from(await blob.arrayBuffer())
}

describe('FileAssetsService.batchIngestRecordingsZip', () => {
  it('ingests multiple recordings and binds practice_recording references', async () => {
    const createAssetFromBuffer = vi.fn(async ({ filename }: any) => ({ id: `asset-${filename}` }))
    const createReference = vi.fn(async () => ({ id: 'ref' }))
    const service = Object.create(FileAssetsService.prototype) as FileAssetsService
    ;(service as any).logger = { warn: vi.fn() }
    ;(service as any).createAssetFromBuffer = createAssetFromBuffer
    ;(service as any).createReference = createReference
    ;(service as any).sanitizeFilename = (name: string) => name

    const zip = await buildZip([
      { localId: 'a', bytes: new TextEncoder().encode('voice-a') },
      { localId: 'b', bytes: new TextEncoder().encode('voice-b') },
    ])
    const result = await service.batchIngestRecordingsZip('user-1', zip)
    expect(result.results).toEqual([
      { localId: 'a', status: 'synced', assetId: 'asset-a.webm' },
      { localId: 'b', status: 'synced', assetId: 'asset-b.webm' },
    ])
    expect(createAssetFromBuffer).toHaveBeenCalledTimes(2)
    expect(createAssetFromBuffer.mock.calls[0][0].group).toBe('user_recording')
    expect(createReference).toHaveBeenCalledWith('user-1', expect.objectContaining({
      assetId: 'asset-a.webm',
      bizType: 'practice_recording',
      bizId: 'user-recording:a',
    }))
  })

  it('returns per-entry failures without aborting the batch', async () => {
    const createAssetFromBuffer = vi.fn(async ({ filename }: any) => {
      if (filename.includes('bad')) throw new Error('COS down')
      return { id: `asset-${filename}` }
    })
    const service = Object.create(FileAssetsService.prototype) as FileAssetsService
    ;(service as any).logger = { warn: vi.fn() }
    ;(service as any).createAssetFromBuffer = createAssetFromBuffer
    ;(service as any).createReference = vi.fn(async () => ({ id: 'ref' }))
    ;(service as any).sanitizeFilename = (name: string) => name

    const zip = await buildZip([
      { localId: 'ok', bytes: new TextEncoder().encode('ok'), filename: 'ok.webm' },
      { localId: 'bad', bytes: new TextEncoder().encode('bad'), filename: 'bad.webm' },
    ])
    const result = await service.batchIngestRecordingsZip('user-1', zip)
    expect(result.results[0]).toEqual({ localId: 'ok', status: 'synced', assetId: 'asset-ok.webm' })
    expect(result.results[1].status).toBe('failed')
    expect(result.results[1].error).toContain('COS down')
  })

  it('rejects checksum mismatches for a single entry', async () => {
    const service = Object.create(FileAssetsService.prototype) as FileAssetsService
    ;(service as any).logger = { warn: vi.fn() }
    ;(service as any).createAssetFromBuffer = vi.fn()
    ;(service as any).createReference = vi.fn()
    ;(service as any).sanitizeFilename = (name: string) => name

    const zip = await buildZip([
      { localId: 'x', bytes: new TextEncoder().encode('voice'), sha256: '0'.repeat(64) },
    ])
    const result = await service.batchIngestRecordingsZip('user-1', zip)
    expect(result.results[0].status).toBe('failed')
    expect(result.results[0].error).toContain('校验和')
    expect((service as any).createAssetFromBuffer).not.toHaveBeenCalled()
  })
})
