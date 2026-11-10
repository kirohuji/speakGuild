import { createFileReference, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import { createFileAssetReference } from '@/lib/file-asset-reference'
import type { VnInputRecording } from './vn-input-panel'

/**
 * Persist a VN user recording the same way for practice + story packs:
 * upload blob → file asset → durable asset:// reference for later replay.
 * Ephemeral blob: URLs are never returned (they die with the session).
 */
export async function persistUserRecordingAsset(input: {
  recording?: VnInputRecording | null
  fallbackAudioUrl?: string | null
  bizType: string
  bizId: string
}): Promise<string | undefined> {
  const { recording, fallbackAudioUrl, bizType, bizId } = input

  if (recording?.blob && recording.blob.size > 0) {
    try {
      const file = new File(
        [recording.blob],
        recording.filename || 'recording.webm',
        { type: recording.blob.type || 'audio/webm' },
      )
      const asset = await uploadFileToCosAndComplete({ file, group: 'user_recording' })
      await createFileReference(asset.id, bizType, bizId).catch(() => undefined)
      return createFileAssetReference(asset.id)
    } catch (error) {
      console.warn('[vn-recording] upload failed', { bizType, bizId, error })
    }
  }

  const fallback = fallbackAudioUrl?.trim()
  if (!fallback || fallback.startsWith('blob:')) return undefined
  return fallback
}
