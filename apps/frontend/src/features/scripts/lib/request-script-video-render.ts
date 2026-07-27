import { buildNqtrVideoTimeline } from '@/features/admin/components/nqtr-video-timeline'
import { type MixedTimelineFrame } from '@/features/admin/components/vn-mixed-timeline'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export async function requestScriptVideoRender({
  workId,
  frames,
  onProgress,
}: {
  workId: string
  frames: MixedTimelineFrame[]
  onProgress?: (progress: number, step?: string) => void
}) {
  const timeline = buildNqtrVideoTimeline(frames, { gapSeconds: 1 })
  await scriptCommunityApi.renderWork(workId, timeline.frames as unknown as Record<string, unknown>[])
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
