import { describe, expect, it } from 'vitest'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'
import { readSyncSnapshotZip } from '../sync-snapshot'

async function buildSnapshotZip(payload: unknown) {
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  await writer.add('payload.json', new TextReader(JSON.stringify(payload)))
  const blob = await writer.close()
  return blob.arrayBuffer()
}

describe('readSyncSnapshotZip', () => {
  it('reads payload.json from a cold-start sync snapshot zip', async () => {
    const payload = {
      userId: 'user-a',
      complete: true,
      cursors: { learningNotebookItems: '2026-01-01T00:00:00.000Z|nb-1' },
      hasMore: { learningNotebookItems: false },
      changed: {
        expressionItems: [],
        sceneProgresses: [],
        chunkProgresses: [],
        practiceSessions: [],
        practiceTurns: [],
        practiceWarmupRecords: [],
        dailyPracticeRuns: [{ clientRunId: 'run-1' }],
        learningNotebooks: [{ id: 'nb-1' }],
        learningNotebookItems: [{ id: 'item-1' }],
      },
      deleted: {
        expressionItems: [],
        sceneProgresses: [],
        chunkProgresses: [],
        learningNotebooks: [],
        learningNotebookItems: [],
      },
    }
    const buffer = await buildSnapshotZip(payload)
    const parsed = await readSyncSnapshotZip(buffer)
    expect(parsed.userId).toBe('user-a')
    expect(parsed.complete).toBe(true)
    expect(parsed.changed.dailyPracticeRuns?.[0]?.clientRunId).toBe('run-1')
    expect(parsed.changed.learningNotebookItems).toHaveLength(1)
    expect(parsed.cursors.learningNotebookItems).toContain('nb-1')
  })

  it('rejects zips that are missing payload.json', async () => {
    const writer = new ZipWriter(new BlobWriter('application/zip'))
    await writer.add('readme.txt', new TextReader('no payload'))
    const blob = await writer.close()
    await expect(readSyncSnapshotZip(await blob.arrayBuffer())).rejects.toThrow(/payload\.json/)
  })
})
