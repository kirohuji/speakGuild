import type { TFunction } from 'i18next'

export type VoiceInputStatus = 'idle' | 'recording' | 'processing'

export function pickVoiceRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
      (mimeType) => MediaRecorder.isTypeSupported(mimeType),
    ) ?? ''
  )
}

export function formatVoiceInputElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function normalizeVoiceInputText(value: string) {
  return value.replace(/\r\n?/g, '\n').trim()
}

export function getVoiceMicErrorMessage(error: unknown, t: TFunction) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return t('profile.placement.micInsecureContext')
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return t('profile.placement.micUnavailable')
  }
  const name = typeof DOMException !== 'undefined' && error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return t('profile.placement.micDenied')
  }
  return t('profile.placement.micFailed')
}

export function getVoiceInputFeedbackText({
  t,
  status,
  elapsed,
  error,
  idleText,
}: {
  t: TFunction
  status: VoiceInputStatus
  elapsed: number
  error?: string
  idleText?: string
}) {
  if (error) return error
  if (status === 'recording') {
    return t('profile.placement.voiceRecording', { time: formatVoiceInputElapsed(elapsed) })
  }
  if (status === 'processing') return t('profile.placement.voiceProcessing')
  return idleText ?? t('profile.placement.voiceIdle')
}
