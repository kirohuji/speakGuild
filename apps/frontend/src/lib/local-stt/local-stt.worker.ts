import { env, pipeline } from '@huggingface/transformers'
import type { LocalSttModelLoadConfig } from './local-stt-model-manager'

type WorkerRequest = {
  id: number
  type: 'transcribe'
  config: LocalSttModelLoadConfig
  audio: Float32Array
  language?: string
}

let transcriberPromise: Promise<any> | null = null
let transcriberKey: string | null = null
let runCount = 0

function getTranscriber(config: LocalSttModelLoadConfig) {
  const localModelPath = config.localModelPath?.trim()
  const allowRemoteModels = config.allowRemoteModels ?? !localModelPath
  const nextKey = `${config.modelId}:${config.dtype}:${localModelPath ?? ''}:${allowRemoteModels ? 'remote' : 'local'}`
  if (transcriberKey !== nextKey) {
    transcriberKey = nextKey
    transcriberPromise = null
    env.allowLocalModels = Boolean(localModelPath)
    env.allowRemoteModels = allowRemoteModels
    if (localModelPath) env.localModelPath = localModelPath
  }

  transcriberPromise ??= pipeline('automatic-speech-recognition', config.modelId, {
    dtype: config.dtype,
    local_files_only: !allowRemoteModels,
    session_options: {
      graphOptimizationLevel: 'basic',
    },
  })
  return transcriberPromise
}

function whisperLanguage(language?: string) {
  if (!language) return 'english'
  const normalized = language.toLowerCase()
  if (normalized.startsWith('zh') || normalized.includes('chinese')) return 'chinese'
  return 'english'
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  try {
    const transcriber = await getTranscriber(message.config)
    // English-only 模型（.en 后缀）不接受 language / task 参数
    const isEnglishOnly = message.config.modelId.includes('.en')
    const options: Record<string, unknown> = { return_timestamps: false }
    if (!isEnglishOnly) {
      options.language = whisperLanguage(message.language)
      options.task = 'transcribe'
    }
    const isFirstRun = runCount === 0
    runCount += 1
    const output = await transcriber(message.audio, options)
    const text = Array.isArray(output)
      ? output.map((item) => item?.text ?? '').join(' ').trim()
      : String(output?.text ?? '').trim()
    self.postMessage({ id: message.id, ok: true, text, warm: !isFirstRun })
  } catch (error: any) {
    self.postMessage({ id: message.id, ok: false, error: error?.message || 'local stt failed' })
  }
}
