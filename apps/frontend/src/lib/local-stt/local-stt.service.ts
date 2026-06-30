import { toast } from 'sonner'
import { transcribeRecording, type TranscribeRecordingResult } from '@/lib/practice-ai-api'
import { usePreferencesStore } from '@/stores/preferences.store'
import { localSttModelManager, type LocalSttModelLoadConfig } from './local-stt-model-manager'

type WorkerResponse = {
  id: number
  ok: boolean
  text?: string
  error?: string
  warm?: boolean
}

type WorkerMessage = {
  type: 'transcribe'
  config: LocalSttModelLoadConfig
  audio: Float32Array
  language?: string
}

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void; timeoutId: number }>()

function getWorker() {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  worker = new Worker(new URL('./local-stt.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const request = pending.get(response.id)
    if (!request) return
    clearTimeout(request.timeoutId)
    pending.delete(response.id)
    request.resolve(response)
  }
  worker.onerror = (event) => {
    for (const [id, request] of pending) {
      clearTimeout(request.timeoutId)
      request.reject(new Error(event.message || 'local stt worker failed'))
      pending.delete(id)
    }
  }
  return worker
}

function requestWorker(message: WorkerMessage, timeoutMs = 120_000) {
  const activeWorker = getWorker()
  if (!activeWorker) return Promise.reject(new Error('worker unavailable'))

  const id = ++requestId
  return new Promise<WorkerResponse>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('local stt timeout'))
    }, timeoutMs)
    pending.set(id, { resolve, reject, timeoutId })
    activeWorker.postMessage({ id, ...message }, [message.audio.buffer])
  })
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function canUseCloud(fallbackToCloud: boolean) {
  return fallbackToCloud && !isOffline()
}

function toResult(audioBlob: Blob, text: string): TranscribeRecordingResult {
  return {
    audioBase64: '',
    mimeType: audioBlob.type || 'audio/webm',
    text,
    audioUrl: null,
    wordTimestamps: null,
  }
}

function getAudioContextCtor() {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? (window as any).webkitAudioContext ?? null
}

function resampleLinear(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) return input
  const outputLength = Math.max(1, Math.round(input.length * outputRate / inputRate))
  const output = new Float32Array(outputLength)
  const ratio = (input.length - 1) / Math.max(1, outputLength - 1)
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio
    const left = Math.floor(sourceIndex)
    const right = Math.min(input.length - 1, left + 1)
    const weight = sourceIndex - left
    output[i] = input[left] * (1 - weight) + input[right] * weight
  }
  return output
}

async function decodeAudioBlobToMono16k(audioBlob: Blob) {
  const AudioContextCtor = getAudioContextCtor()
  if (!AudioContextCtor) throw new Error('AudioContext unavailable')
  const audioContext = new AudioContextCtor()
  try {
    const arrayBuffer = await audioBlob.arrayBuffer()
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const channelCount = Math.max(1, decoded.numberOfChannels)
    const mono = new Float32Array(decoded.length)
    for (let channel = 0; channel < channelCount; channel += 1) {
      const data = decoded.getChannelData(channel)
      for (let i = 0; i < decoded.length; i += 1) mono[i] += data[i] / channelCount
    }
    return resampleLinear(mono, decoded.sampleRate, 16_000)
  } finally {
    await audioContext.close().catch(() => undefined)
  }
}

async function cloudTranscribe(audioBlob: Blob, filename: string, language?: string) {
  return transcribeRecording(audioBlob, filename, language)
}

export async function transcribeVoiceInput(
  audioBlob: Blob,
  filename = 'recording.webm',
  language?: string,
): Promise<TranscribeRecordingResult> {
  const preferences = usePreferencesStore.getState()
  if (!preferences.localSttEnabled) {
    return cloudTranscribe(audioBlob, filename, language)
  }

  const fallbackToCloud = preferences.localSttFallbackToCloud
  const variantId = preferences.localSttModelVariant
  const status = await localSttModelManager.getStatus(variantId)

  if (status.installing) {
    toast.info('本地 STT 模型正在下载，下载完成后将自动用于语音识别')
    if (canUseCloud(fallbackToCloud)) return cloudTranscribe(audioBlob, filename, language)
    throw new Error('本地 STT 模型正在下载中，离线时暂时无法识别')
  }

  const config = await localSttModelManager.getLoadConfig(variantId)
  if (!config) {
    if (canUseCloud(fallbackToCloud)) return cloudTranscribe(audioBlob, filename, language)
    throw new Error('本地 STT 模型尚未准备好')
  }

  try {
    const decodeStart = performance.now()
    const audio = await decodeAudioBlobToMono16k(audioBlob)
    const decodeMs = performance.now() - decodeStart
    const audioDurationSec = audio.length / 16_000

    const transcribeStart = performance.now()
    const response = await requestWorker({ type: 'transcribe', config, audio, language })
    const transcribeMs = performance.now() - transcribeStart
    const totalMs = decodeMs + transcribeMs

    console.log(
      `[local-stt] perf: audio=${audioDurationSec.toFixed(1)}s ` +
      `decode=${decodeMs.toFixed(0)}ms transcribe=${transcribeMs.toFixed(0)}ms ` +
      `total=${totalMs.toFixed(0)}ms ` +
      `rtf=${(transcribeMs / 1000 / Math.max(0.1, audioDurationSec)).toFixed(2)}x ` +
      `${response.warm ? 'warm' : 'COLD'} ` +
      `model=${config.modelId}`,
    )
    if (!response.ok) throw new Error(response.error || 'local stt failed')
    const text = (response.text ?? '').trim()
    if (!text) throw new Error('local stt empty result')
    return toResult(audioBlob, text)
  } catch (error) {
    console.warn('[local-stt] transcribe failed:', error)
    if (canUseCloud(fallbackToCloud)) return cloudTranscribe(audioBlob, filename, language)
    throw error
  }
}
