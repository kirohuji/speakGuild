import { beforeEach, describe, expect, it, vi } from 'vitest'

const save = vi.hoisted(() => vi.fn())
const discard = vi.hoisted(() => vi.fn())
const transcribe = vi.hoisted(() => vi.fn())

vi.mock('@/lib/offline/user-recordings', () => ({
  saveUserRecording: save,
  discardUserRecording: discard,
}))
vi.mock('@/lib/local-stt/local-stt.service', () => ({
  transcribeVoiceInput: transcribe,
}))

import { persistPracticeVoiceAfterTranscription } from '../practice-voice-persist'

beforeEach(() => {
  save.mockReset()
  discard.mockReset()
  transcribe.mockReset()
})

describe('persistPracticeVoiceAfterTranscription', () => {
  it('does not save or enqueue when transcription throws', async () => {
    transcribe.mockRejectedValueOnce(new Error('offline stt'))
    const result = await persistPracticeVoiceAfterTranscription({
      blob: new Blob(['voice']),
      filename: 'a.webm',
      lang: 'en-US',
      transcribe,
      save,
      discard,
    })
    expect(result).toEqual({ status: 'transcribe_failed' })
    expect(save).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
  })

  it('does not save when transcription returns empty text', async () => {
    transcribe.mockResolvedValueOnce({ text: '   ' })
    const result = await persistPracticeVoiceAfterTranscription({
      blob: new Blob(['voice']),
      filename: 'a.webm',
      lang: 'en-US',
      transcribe,
      save,
      discard,
    })
    expect(result).toEqual({ status: 'empty' })
    expect(save).not.toHaveBeenCalled()
  })

  it('saves only after non-empty transcription succeeds', async () => {
    transcribe.mockResolvedValueOnce({ text: ' hello world ' })
    save.mockResolvedValueOnce('user-recording://rec-1')
    const blob = new Blob(['voice'])
    const result = await persistPracticeVoiceAfterTranscription({
      blob,
      filename: 'a.webm',
      lang: 'en-US',
      transcribe,
      save,
      discard,
    })
    expect(result).toEqual({
      status: 'persisted',
      text: 'hello world',
      reference: 'user-recording://rec-1',
    })
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith(blob, 'a.webm')
    expect(discard).not.toHaveBeenCalled()
  })

  it('returns stale without saving when capture is already obsolete after STT', async () => {
    transcribe.mockResolvedValueOnce({ text: 'kept' })
    const result = await persistPracticeVoiceAfterTranscription({
      blob: new Blob(['voice']),
      filename: 'a.webm',
      lang: 'en-US',
      isCurrent: () => false,
      transcribe,
      save,
      discard,
    })
    expect(result).toEqual({ status: 'stale' })
    expect(save).not.toHaveBeenCalled()
  })

  it('discards after save when capture goes stale mid-persist', async () => {
    let afterSave = true
    transcribe.mockResolvedValueOnce({ text: 'late' })
    save.mockImplementation(async () => {
      afterSave = false
      return 'user-recording://late'
    })
    const late = await persistPracticeVoiceAfterTranscription({
      blob: new Blob(['voice']),
      filename: 'a.webm',
      lang: 'en-US',
      isCurrent: () => afterSave,
      transcribe,
      save,
      discard,
    })
    expect(late).toEqual({ status: 'stale' })
    expect(discard).toHaveBeenCalledWith('user-recording://late')
  })
})
