import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js'
import type { PullResult } from './sync-api'

/** Parse cold-start sync zip (`payload.json`) produced by `/sync/pull/snapshot`. */
export async function readSyncSnapshotZip(buffer: ArrayBuffer): Promise<PullResult & { complete?: boolean }> {
  const reader = new ZipReader(new BlobReader(new Blob([buffer], { type: 'application/zip' })))
  try {
    const entries = await reader.getEntries()
    const payloadEntry = entries.find((entry) => entry.filename === 'payload.json' && !entry.directory) as
      | (typeof entries[number] & { getData?: (writer: TextWriter) => Promise<string> })
      | undefined
    if (!payloadEntry?.getData) throw new Error('snapshot missing payload.json')
    const text = await payloadEntry.getData(new TextWriter())
    return JSON.parse(text) as PullResult & { complete?: boolean }
  } finally {
    await reader.close().catch(() => undefined)
  }
}
