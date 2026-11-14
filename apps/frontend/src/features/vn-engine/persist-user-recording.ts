import { saveUserRecording } from '@/lib/offline/user-recordings'
import type { VnInputRecording } from './vn-input-panel'

/**
 * Persist a VN user recording the same way for practice + story packs:
 * save local bytes + upload queue → stable local identity → server asset on sync.
 * Ephemeral blob: URLs are never returned (they die with the session).
 */
export async function persistUserRecordingAsset(input: {
  recording?: VnInputRecording | null
  fallbackAudioUrl?: string | null
  bizType: string
  bizId: string
}): Promise<string | undefined> {
  const { recording, fallbackAudioUrl } = input

  if (recording?.blob && recording.blob.size > 0) {
    return saveUserRecording(recording.blob, recording.filename || 'recording.webm')
  }

  const fallback = fallbackAudioUrl?.trim()
  if (!fallback || fallback.startsWith('blob:')) return undefined
  return fallback
}
