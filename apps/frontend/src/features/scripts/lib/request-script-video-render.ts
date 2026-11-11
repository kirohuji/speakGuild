import { buildNqtrVideoTimeline } from '@/features/admin/components/nqtr-video-timeline'
import { type MixedTimelineFrame } from '@/features/admin/components/vn-mixed-timeline'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** Measure remote/local audio duration for TTS lines so the server can skip parseMedia. */
function measureAudioUrlDurationMs(url: string) {
  return new Promise<number>((resolve) => {
    const audio = new Audio()
    const finish = (durationMs = 0) => {
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
      resolve(durationMs)
    }
    audio.preload = 'metadata'
    audio.crossOrigin = 'anonymous'
    audio.onloadedmetadata = () => {
      finish(Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.ceil(audio.duration * 1000)
        : 0)
    }
    audio.onerror = () => finish()
    window.setTimeout(() => finish(), 8_000)
    audio.src = url
  })
}

async function attachMeasuredAudioDurations(frames: MixedTimelineFrame[]) {
  const cache = new Map<string, number>()
  return Promise.all(frames.map(async (frame) => {
    const existing = Number((frame as any).audioDurationMs ?? (frame as any).recordingDurationMs ?? (frame as any).ttsDurationMs)
    if (Number.isFinite(existing) && existing > 0) {
      return { ...frame, audioDurationMs: Math.ceil(existing) }
    }
    const url = (frame as any).resolvedAudioUrl || frame.audioUrl
    if (!url || typeof url !== 'string') return frame
    if (
      url.startsWith('capacitor://')
      || url.includes('/_capacitor_file_/')
      || url.startsWith('file:')
      || url.startsWith('blob:')
      || url.startsWith('asset://')
    ) {
      return frame
    }
    let durationMs = cache.get(url)
    if (durationMs == null) {
      durationMs = await measureAudioUrlDurationMs(url)
      if (durationMs > 0) cache.set(url, durationMs)
    }
    return durationMs > 0
      ? { ...frame, audioDurationMs: durationMs, ttsDurationMs: durationMs }
      : frame
  }))
}

/** Polls the server-owned render task and stops itself once it reaches a terminal state. */
export function watchScriptVideoRender({
  workId,
  onUpdate,
  intervalMs = 10_000,
}: {
  workId: string
  intervalMs?: number
  onUpdate: (result: Awaited<ReturnType<typeof scriptCommunityApi.renderStatus>>) => void
}) {
  let stopped = false
  const poll = async () => {
    try {
      const result = await scriptCommunityApi.renderStatus(workId)
      if (stopped) return
      onUpdate(result)
      const terminal = result.work.status === 'published'
        || result.work.status === 'failed'
        || result.task?.status === 'failed'
        || result.task?.status === 'canceled'
      if (!terminal) window.setTimeout(() => void poll(), intervalMs)
    } catch (error) {
      console.warn('[script-video] render status poll failed', { workId, error })
      if (!stopped) window.setTimeout(() => void poll(), intervalMs)
    }
  }
  void poll()
  return () => { stopped = true }
}

/** Submit the render job and return immediately; rendering is server-side. */
export async function enqueueScriptVideoRender({
  workId,
  frames,
}: {
  workId: string
  frames: MixedTimelineFrame[]
}) {
  const framesWithDurations = await attachMeasuredAudioDurations(frames)
  // Do not invent a one-second pause between lines. The timeline may still
  // use its per-line duration estimate, but there is no artificial silence.
  const timeline = buildNqtrVideoTimeline(framesWithDurations, { gapSeconds: 0 })
  const isLocal = (url?: string) => Boolean(url && (
    url.startsWith('capacitor://')
    || url.includes('/_capacitor_file_/')
    || url.startsWith('file:')
    || url.startsWith('blob:')
  ))
  const isAssetRef = (url?: string) => Boolean(url && (
    url.startsWith('asset://')
    || /\/file-assets\/[^/]+\/content/i.test(url)
  ))
  const localVisualFrames = timeline.frames.filter((frame) =>
    [frame.background?.url, frame.sprite?.url].some(isLocal),
  )
  const measuredDurations = timeline.frames.filter((frame) => Number((frame as any).audioDurationMs) > 0).length
  console.log('[script-video] submit render timeline', {
    workId,
    frames: timeline.frames.length,
    fps: timeline.fps,
    size: `${timeline.width}x${timeline.height}`,
    backgrounds: timeline.frames.filter((frame) => Boolean(frame.background?.url)).length,
    sprites: timeline.frames.filter((frame) => Boolean(frame.sprite?.url)).length,
    audio: timeline.frames.filter((frame) => Boolean(frame.resolvedAudioUrl || frame.audioUrl)).length,
    measuredAudioDurations: measuredDurations,
    assetRefs: timeline.frames.filter((frame) =>
      [frame.background?.url, frame.sprite?.url, frame.resolvedAudioUrl, frame.audioUrl]
        .some(isAssetRef),
    ).length,
    localVisualFrames: localVisualFrames.map((frame) => frame.index),
  })
  return scriptCommunityApi.renderWork(workId, timeline.frames as unknown as Record<string, unknown>[])
}

export async function requestScriptVideoRender({
  workId,
  frames,
  onProgress,
}: {
  workId: string
  frames: MixedTimelineFrame[]
  onProgress?: (progress: number, step?: string) => void
}) {
  await enqueueScriptVideoRender({ workId, frames })
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    const result = await scriptCommunityApi.renderStatus(workId)
    const progress = result.task?.progress ?? 0
    onProgress?.(progress, result.task?.currentStep ?? undefined)
    if (result.work.status === 'published' && result.work.videoAssetId) return result
    if (result.work.status === 'failed' || result.task?.status === 'failed') {
      throw new Error(result.work.renderError || result.task?.errorMessage || '视频生成失败')
    }
    await wait(3000)
  }
  throw new Error('视频生成超时，请稍后在任务中心查看')
}
