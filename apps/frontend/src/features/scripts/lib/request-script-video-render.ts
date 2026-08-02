import { buildNqtrVideoTimeline } from '@/features/admin/components/nqtr-video-timeline'
import { type MixedTimelineFrame } from '@/features/admin/components/vn-mixed-timeline'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** Submit the Remotion job and return immediately; rendering is server-side. */
export async function enqueueScriptVideoRender({
  workId,
  frames,
}: {
  workId: string
  frames: MixedTimelineFrame[]
}) {
  const timeline = buildNqtrVideoTimeline(frames, { gapSeconds: 1 })
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
