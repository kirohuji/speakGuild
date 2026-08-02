import { buildNqtrVideoTimeline } from '@/features/admin/components/nqtr-video-timeline'
import { type MixedTimelineFrame } from '@/features/admin/components/vn-mixed-timeline'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

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

/** Submit the Remotion job and return immediately; rendering is server-side. */
export async function enqueueScriptVideoRender({
  workId,
  frames,
}: {
  workId: string
  frames: MixedTimelineFrame[]
}) {
  // Do not invent a one-second pause between lines. The timeline may still
  // use its per-line duration estimate, but there is no artificial silence.
  const timeline = buildNqtrVideoTimeline(frames, { gapSeconds: 0 })
  const localVisualFrames = timeline.frames.filter((frame) => [frame.background?.url, frame.sprite?.url].some((url) =>
    Boolean(url?.startsWith('capacitor://') || url?.includes('/_capacitor_file_/')),
  ))
  console.log('[script-video] submit render timeline', {
    workId,
    frames: timeline.frames.length,
    backgrounds: timeline.frames.filter((frame) => Boolean(frame.background?.url)).length,
    sprites: timeline.frames.filter((frame) => Boolean(frame.sprite?.url)).length,
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
