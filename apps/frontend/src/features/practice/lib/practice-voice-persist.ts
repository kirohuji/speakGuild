import { discardUserRecording, saveUserRecording } from '@/lib/offline/user-recordings'
import { transcribeVoiceInput } from '@/lib/local-stt/local-stt.service'
import { normalizeVoiceInputText } from '@/lib/voice-input-feedback'

export type PracticeVoicePersistResult =
  | { status: 'persisted'; text: string; reference: string }
  | { status: 'empty' }
  | { status: 'transcribe_failed' }
  | { status: 'save_failed' }
  | { status: 'stale' }

/**
 * Run STT first; only write a durable user-recording (+ outbox) when text is non-empty.
 * Callers keep a temporary blob URL for playback on empty/failure paths.
 */
export async function persistPracticeVoiceAfterTranscription(options: {
  blob: Blob
  filename: string
  lang: string
  isCurrent?: () => boolean
  transcribe?: typeof transcribeVoiceInput
  save?: typeof saveUserRecording
  discard?: typeof discardUserRecording
}): Promise<PracticeVoicePersistResult> {
  const {
    blob,
    filename,
    lang,
    isCurrent = () => true,
    transcribe = transcribeVoiceInput,
    save = saveUserRecording,
    discard = discardUserRecording,
  } = options

  let text: string
  try {
    const result = await transcribe(blob, filename, lang)
    if (!isCurrent()) return { status: 'stale' }
    text = normalizeVoiceInputText(result.text ?? '')
  } catch {
    return { status: 'transcribe_failed' }
  }

  if (!text) return { status: 'empty' }

  try {
    const reference = await save(blob, filename)
    if (!isCurrent()) {
      await discard(reference)
      return { status: 'stale' }
    }
    return { status: 'persisted', text, reference }
  } catch {
    return { status: 'save_failed' }
  }
}
