import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  ScriptPracticeMode,
  ScriptWorkKind,
  ScriptWorkStatus,
} from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { FileAssetsService } from '../file-assets/file-assets.service'
import { LearningService } from '../learning/learning.service'
import { AdminTasksService } from '../admin-tasks/admin-tasks.service'
import { EnglishPracticeAiService } from '../practice-ai/english-practice-ai.service'
import {
  CompleteScriptPracticeDto,
  CreateScriptWorkDto,
  ScriptReportDto,
  UpdateScriptWorkDto,
} from './dto/script-community.dto'
import { parseMedia } from '@remotion/media-parser'

const feedInclude = {
  user: { select: { id: true, name: true, username: true, image: true, userLevel: true } },
  episode: {
    select: {
      id: true,
      title: true,
      chapterName: true,
      scene: { select: { id: true, title: true, coverImage: true } },
    },
  },
  videoAsset: { select: { id: true, mimeType: true } },
  coverAsset: { select: { id: true } },
  _count: { select: { likes: true, reactions: true } },
} satisfies Prisma.ScriptWorkInclude

type FeedWork = Prisma.ScriptWorkGetPayload<{ include: typeof feedInclude }>

// 作品列表（feed / myWorks）在端上会停留较久（预览、播放、二次进入），
// 签名 URL 用 7 天档，与 FileAssetsService.getAssetLongLivedUrl 一致，避免隔天打开时 403。
const SCRIPT_ASSET_URL_EXPIRES_SECONDS = 7 * 24 * 3600

function dialogueToPracticeTurns(
  dialogue: Array<{
    speaker?: string
    text?: string
    isUser?: boolean
    originalText?: string
    recorded?: boolean
    recordingFrameIndex?: number
    recordingDurationMs?: number
  }>,
) {
  const turns: Array<{
    round: number
    npcText: string
    userText: string
    objectivesCompleted: string[]
    chunksUsed: string[]
    originalText?: string
    recordingFrameIndex?: number
    recordingDurationMs?: number
    evaluationPriority: 'primary' | 'supplemental'
  }> = []
  let pendingNpc: string[] = []
  let round = 0
  for (const line of dialogue) {
    const text = typeof line?.text === 'string' ? line.text.trim() : ''
    if (!text) continue
    const learnerTurn = Boolean(line.isUser || line.recorded)
    if (learnerTurn) {
      round += 1
      const originalText = typeof line.originalText === 'string' && line.originalText.trim()
        ? line.originalText.trim()
        : text
      turns.push({
        round,
        npcText: pendingNpc.join('\n') || `Target line: ${originalText}`,
        userText: text,
        objectivesCompleted: [],
        chunksUsed: [],
        originalText,
        recordingFrameIndex: Number.isInteger(line.recordingFrameIndex) ? line.recordingFrameIndex : undefined,
        recordingDurationMs: typeof line.recordingDurationMs === 'number' ? line.recordingDurationMs : undefined,
        evaluationPriority: line.isUser ? 'primary' : 'supplemental',
      })
      pendingNpc = []
    } else {
      pendingNpc.push(text)
    }
  }
  return turns
}

@Injectable()
export class ScriptCommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningService: LearningService,
    private readonly practiceAi: EnglishPracticeAiService,
    private readonly fileAssetsService: FileAssetsService,
    private readonly adminTasksService: AdminTasksService,
  ) {}

  private isLocalVisualUrl(url: string) {
    return url.startsWith('capacitor://')
      || url.includes('/_capacitor_file_/')
      || url.startsWith('file:')
      || url.startsWith('blob:')
  }

  /** Extract a file-asset id from asset:// refs or /file-assets/:id/content URLs. */
  private extractFileAssetId(url?: string | null): string | undefined {
    if (!url || typeof url !== 'string') return undefined
    if (url.startsWith('asset://')) {
      const raw = url.slice('asset://'.length).split(/[?#]/)[0] || ''
      if (!raw || raw.includes('/')) return undefined
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
    try {
      const pathname = new URL(url, 'http://manyu.local').pathname
      const match = pathname.match(/\/file-assets\/([^/]+)\/content\/?$/i)
      if (!match?.[1]) return undefined
      return decodeURIComponent(match[1])
    } catch {
      return undefined
    }
  }

  private async getRecordingDurationMs(url: string, assetId: string) {
    try {
      const { durationInSeconds } = await parseMedia({
        src: url,
        fields: { durationInSeconds: true },
        acknowledgeRemotionLicense: true,
      })
      if (!Number.isFinite(durationInSeconds) || !durationInSeconds || durationInSeconds <= 0) {
        throw new Error(`invalid duration: ${durationInSeconds}`)
      }
      return Math.ceil(durationInSeconds * 1000)
    } catch (error) {
      // A guessed duration either truncates a learner's voice or pads every
      // line arbitrarily. Fail the request instead so the asset problem can be
      // corrected and the recording is never silently altered.
      throw new BadRequestException(`无法读取录音时长（素材 ${assetId}），请重新录制后再生成视频`)
    }
  }

  /** Soft read for TTS / already-signed URLs — falls back to text estimate. */
  private async getAudioDurationMs(url: string): Promise<number | undefined> {
    try {
      const { durationInSeconds } = await parseMedia({
        src: url,
        fields: { durationInSeconds: true },
        acknowledgeRemotionLicense: true,
      })
      if (!Number.isFinite(durationInSeconds) || !durationInSeconds || durationInSeconds <= 0) {
        return undefined
      }
      return Math.ceil(durationInSeconds * 1000)
    } catch {
      return undefined
    }
  }

  /**
   * Remotion fetches media without cookies. Rewrite asset:// and
   * /file-assets/:id/content into long-lived private COS signed URLs.
   */
  private async remapFramesForRemotion(frames: any[], expiresSeconds = 6 * 3600) {
    const assetIds = new Set<string>()
    for (const frame of frames) {
      for (const url of [
        frame?.background?.url,
        frame?.sprite?.url,
        frame?.resolvedAudioUrl,
        frame?.audioUrl,
      ]) {
        const id = this.extractFileAssetId(typeof url === 'string' ? url : undefined)
        if (id) assetIds.add(id)
      }
    }
    const signed = await this.fileAssetsService.getPrivateUrlsByAssetIds(
      [...assetIds],
      expiresSeconds,
    )
    const unresolvedAssetIds: string[] = []
    const resolveUrl = (url?: string) => {
      if (!url || this.isLocalVisualUrl(url)) return undefined
      const id = this.extractFileAssetId(url)
      if (id) {
        const mapped = signed.get(id)
        if (!mapped) unresolvedAssetIds.push(id)
        return mapped || undefined
      }
      // Already a public/signed https URL Remotion can fetch.
      if (/^https?:\/\//i.test(url)) return url
      return undefined
    }

    const remapped = frames.map((frame: any) => {
      const backgroundUrl = resolveUrl(
        typeof frame?.background?.url === 'string' ? frame.background.url : undefined,
      )
      const spriteUrl = resolveUrl(
        typeof frame?.sprite?.url === 'string' ? frame.sprite.url : undefined,
      )
      const rawAudio = typeof frame?.resolvedAudioUrl === 'string'
        ? frame.resolvedAudioUrl
        : typeof frame?.audioUrl === 'string'
          ? frame.audioUrl
          : undefined
      const audioUrl = resolveUrl(rawAudio)
      return {
        ...frame,
        background: frame.background
          ? { ...frame.background, url: backgroundUrl }
          : frame.background,
        // Drop avatarUrl — Remotion video does not render avatars for now.
        sprite: frame.sprite
          ? { speaker: frame.sprite.speaker, expression: frame.sprite.expression, position: frame.sprite.position, url: spriteUrl }
          : frame.sprite,
        // Never leave asset:// / content proxies for Remotion to fetch.
        resolvedAudioUrl: audioUrl,
      }
    })

    // Forward-fill backgrounds only (do not pull a later scene onto the opening).
    let lastBackground: { url?: string; fit?: string } | undefined
    const withBackground = remapped.map((frame: any) => {
      if (frame?.background?.url) {
        lastBackground = frame.background
        return frame
      }
      if (!lastBackground) return frame
      return {
        ...frame,
        background: { ...lastBackground },
      }
    })

    if (unresolvedAssetIds.length) {
      console.warn('[script-video] file assets missing during Remotion remap', {
        count: unresolvedAssetIds.length,
        sample: [...new Set(unresolvedAssetIds)].slice(0, 8),
      })
    }

    return withBackground
  }

  /**
   * Rebuild the timeline from real audio lengths so TTS lines (often the
   * opening beat) stay in sync with recordings that already carry durationMs.
   */
  private async rebuildTimelineFromAudio(
    frames: any[],
    fps: number,
    ttsDurationHints: Record<string, unknown> = {},
  ) {
    const cache = new Map<string, number>()
    let reusedHints = 0
    let parsedRemote = 0
    const measure = async (url: string) => {
      const cached = cache.get(url)
      if (cached) return cached
      const ms = await this.getAudioDurationMs(url)
      if (ms) {
        cache.set(url, ms)
        parsedRemote += 1
      }
      return ms
    }

    const padFrames = Math.max(1, Math.round(0.12 * fps))
    let cursor = 0
    const timed: any[] = []
    for (const frame of frames) {
      const indexKey = String(frame.index)
      const hintRaw = ttsDurationHints[indexKey] ?? ttsDurationHints[frame.index]
      const hintMs = typeof hintRaw === 'number' ? hintRaw : Number(hintRaw)
      let durationMs = Number(frame.recordingDurationMs)
      let durationSource: 'recording' | 'frame' | 'snapshot' | 'parseMedia' | 'none' = 'none'
      if (Number.isFinite(durationMs) && durationMs > 0) {
        durationSource = 'recording'
      } else {
        const frameHint = Number(frame.audioDurationMs ?? frame.ttsDurationMs)
        if (Number.isFinite(frameHint) && frameHint > 0) {
          durationMs = frameHint
          durationSource = 'frame'
          reusedHints += 1
        } else if (Number.isFinite(hintMs) && hintMs > 0) {
          durationMs = Math.ceil(hintMs)
          durationSource = 'snapshot'
          reusedHints += 1
        } else if (typeof frame.resolvedAudioUrl === 'string') {
          durationMs = (await measure(frame.resolvedAudioUrl)) ?? 0
          if (Number.isFinite(durationMs) && durationMs > 0) durationSource = 'parseMedia'
        }
      }
      const fromAudio = Number.isFinite(durationMs) && durationMs > 0
        ? Math.ceil((durationMs / 1000) * fps) + padFrames
        : 0
      // Prefer real media length. Text estimates only kick in for silent beats.
      const durationFrames = Math.max(1, fromAudio || Number(frame.durationFrames) || 1)
      timed.push({
        ...frame,
        startFrame: cursor,
        durationFrames,
        endFrame: cursor + durationFrames,
        fps,
        audioDurationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined,
        durationSource,
      })
      cursor += durationFrames
    }
    return { frames: timed, reusedHints, parsedRemote }
  }

  async requestRender(userId: string, workId: string, frames: Record<string, unknown>[]) {
    if (!frames.length) throw new BadRequestException('没有可渲染的视频帧')
    const work = await this.prisma.scriptWork.findFirst({
      where: { id: workId, userId },
      select: { id: true, status: true, record: { select: { resultSnapshot: true } } },
    })
    if (!work) throw new NotFoundException('作品不存在')
    if (work.status === ScriptWorkStatus.published) {
      throw new BadRequestException('该作品正在广场发布中，请先取消发布后再生成新版本')
    }
    const recordSnapshot = (work.record?.resultSnapshot as any) ?? {}
    const recordingAssets = recordSnapshot.recordingAssets
    const durationHints = (
      recordSnapshot.recordingDurationsMs
      && typeof recordSnapshot.recordingDurationsMs === 'object'
    )
      ? recordSnapshot.recordingDurationsMs as Record<string, unknown>
      : {}
    const ttsDurationHints = (
      recordSnapshot.ttsDurationsMs
      && typeof recordSnapshot.ttsDurationsMs === 'object'
    )
      ? recordSnapshot.ttsDurationsMs as Record<string, unknown>
      : {}
    const renderOptions = await this.adminTasksService.getScriptVideoRenderOptions()
    const fps = renderOptions.fps

    const recordingEntries = recordingAssets && typeof recordingAssets === 'object'
      ? Object.entries(recordingAssets as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1]))
      : []
    const recordingAssetIds = [...new Set(recordingEntries.map(([, assetId]) => assetId))]
    // One DB round-trip + parallel signing instead of N getPrivateUrlByAssetId calls.
    const recordingSignedUrls = await this.fileAssetsService.getPrivateUrlsByAssetIds(
      recordingAssetIds,
      6 * 3600,
    )
    const recordingsByFrame = await Promise.all(recordingEntries.map(async ([frameIndex, assetId]) => {
      const url = recordingSignedUrls.get(assetId)
      if (!url) {
        console.warn('[script-video] saved recording is unavailable; falling back to TTS', {
          workId,
          frameIndex,
          assetId,
        })
        return null
      }
      const hintRaw = durationHints[frameIndex] ?? durationHints[String(Number(frameIndex))]
      const hintMs = typeof hintRaw === 'number' ? hintRaw : Number(hintRaw)
      // Reuse snapshot durations when present — parseMedia per recording is a major
      // latency source before Remotion even starts.
      const durationMs = Number.isFinite(hintMs) && hintMs > 0
        ? Math.ceil(hintMs)
        : await this.getRecordingDurationMs(url, assetId)
      return [Number(frameIndex), { url, durationMs }] as const
    }))
    const recordingUrls = new Map(recordingsByFrame.filter((entry): entry is readonly [number, { url: string; durationMs: number }] => Boolean(entry)))
    const audioLocks = (recordSnapshot.audioLocks && typeof recordSnapshot.audioLocks === 'object')
      ? recordSnapshot.audioLocks as Record<string, 'tts' | 'recording'>
      : {}
    const framesWithRecordingAudio = frames.map((frame: any) => {
      // Priority: explicit theatre lock → default (user=recording, NPC=TTS) →
      // if a character frame has no TTS, fall back to optional learner dubbing.
      const index = Number(frame?.index)
      const isUserLine = frame?.kind === 'choice' || frame?.kind === 'userInput'
      const recording = recordingUrls.get(index)
      const ttsUrl = frame?.resolvedAudioUrl || frame?.audioUrl
      const hasTts = Boolean(ttsUrl)
      const lock = audioLocks[String(index)] ?? (audioLocks as Record<number, 'tts' | 'recording'>)[index]
      let useRecording = false
      if (lock === 'recording' && recording) useRecording = true
      else if (lock === 'tts') useRecording = !hasTts && Boolean(recording)
      else if (isUserLine) useRecording = Boolean(recording)
      else useRecording = !hasTts && Boolean(recording)
      return useRecording && recording
        ? {
            ...frame,
            resolvedAudioUrl: recording.url,
            audioSource: 'userRecording',
            recordingDurationMs: recording.durationMs,
          }
        : frame
    })
    // Sign media first so parseMedia can read TTS the same way Remotion will.
    const remappedFrames = await this.remapFramesForRemotion(framesWithRecordingAudio)
    // Rebuild from real audio lengths — text estimates on the opening TTS beat
    // were desyncing the first few lines against accurate recording durations.
    const rebuilt = await this.rebuildTimelineFromAudio(remappedFrames, fps, ttsDurationHints)
    const sanitizedFrames = rebuilt.frames
    const skippedBackgroundFrames = sanitizedFrames.filter((frame: any) => !frame.background?.url).map((frame: any) => frame.index)
    const skippedSpriteFrames = sanitizedFrames.filter((frame: any) => (
      frame.kind !== 'choice'
      && frame.sprite?.speaker
      && !frame.sprite?.url
    )).map((frame: any) => frame.index)
    const missingAudioFrames = sanitizedFrames.filter((frame: any) => (
      !frame.resolvedAudioUrl
      && (frame.kind === 'line' || frame.kind === 'choice' || frame.kind === 'userInput')
      && Boolean(frame.text)
    )).map((frame: any) => frame.index)
    const stillAssetScheme = sanitizedFrames.flatMap((frame: any) => {
      const urls = [frame?.background?.url, frame?.sprite?.url, frame?.resolvedAudioUrl]
      return urls.some((url) => typeof url === 'string' && (url.startsWith('asset://') || /\/file-assets\/[^/]+\/content/i.test(url)))
        ? [frame.index]
        : []
    })
    if (skippedBackgroundFrames.length || skippedSpriteFrames.length || missingAudioFrames.length || stillAssetScheme.length) {
      console.warn('[script-video] asset gaps after Remotion remap', {
        workId,
        backgrounds: skippedBackgroundFrames,
        sprites: skippedSpriteFrames,
        audio: missingAudioFrames,
        unresolvedScheme: stillAssetScheme,
      })
    }
    console.log('[script-video] resolved media for render', {
      workId,
      renderOptions,
      fps,
      frames: sanitizedFrames.length,
      backgrounds: sanitizedFrames.filter((frame: any) => Boolean(frame.background?.url)).length,
      sprites: sanitizedFrames.filter((frame: any) => Boolean(frame.sprite?.url)).length,
      audio: sanitizedFrames.filter((frame: any) => Boolean(frame.resolvedAudioUrl)).length,
      measuredAudio: sanitizedFrames.filter((frame: any) => Number(frame.audioDurationMs) > 0).length,
      reusedTtsHints: rebuilt.reusedHints,
      parseMediaCount: rebuilt.parsedRemote,
      savedRecordings: recordingUrls.size,
      reusedDurationHints: recordingsByFrame.filter((entry) => {
        if (!entry) return false
        const [frameIndex] = entry
        const hintRaw = durationHints[String(frameIndex)] ?? durationHints[frameIndex]
        const hintMs = typeof hintRaw === 'number' ? hintRaw : Number(hintRaw)
        return Number.isFinite(hintMs) && hintMs > 0
      }).length,
      injectedFrames: sanitizedFrames.filter((frame: any) => frame.audioSource === 'userRecording').map((frame: any) => frame.index),
      openingBackground: sanitizedFrames[0]?.background?.url ? 'present' : 'missing',
      openingDurationFrames: sanitizedFrames[0]?.durationFrames,
    })
    await this.adminTasksService.cancelScriptVideoTasks(workId, userId)
    await this.prisma.scriptWork.update({
      where: { id: workId },
      data: {
        status: ScriptWorkStatus.rendering,
        videoAssetId: null,
        publishedAt: null,
        hiddenAt: null,
        renderError: null,
      },
    })
    try {
      const task = await this.adminTasksService.enqueueScriptVideo(workId, userId, sanitizedFrames)
      return { taskId: task.id, workId }
    } catch (error) {
      await this.prisma.scriptWork.update({
        where: { id: workId },
        data: {
          status: ScriptWorkStatus.failed,
          renderError: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  async renderStatus(userId: string, workId: string) {
    const work = await this.prisma.scriptWork.findFirst({
      where: { id: workId, userId },
      select: { id: true, status: true, renderError: true, videoAssetId: true },
    })
    if (!work) throw new NotFoundException('作品不存在')
    const task = await this.prisma.adminTask.findFirst({
      where: { targetType: 'script_work', targetId: workId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, progress: true, currentStep: true, errorMessage: true },
    })
    return { work, task }
  }

  async publishHistory(userId: string, params: {
    workId?: string
    episodeId?: string
    page: number
    pageSize: number
  }) {
    const page = Math.max(1, params.page)
    const pageSize = Math.min(50, Math.max(1, params.pageSize))
    const ownedWorks = await this.prisma.scriptWork.findMany({
      where: {
        userId,
        ...(params.workId ? { id: params.workId } : {}),
        ...(params.episodeId ? { episodeId: params.episodeId } : {}),
      },
      select: {
        id: true,
        title: true,
        kind: true,
        episodeId: true,
        episode: {
          select: {
            title: true,
            chapterName: true,
            scene: { select: { id: true, title: true } },
          },
        },
      },
    })
    const workIds = ownedWorks.map((work) => work.id)
    const filteredByWork = Boolean(params.workId || params.episodeId)
    if (filteredByWork && workIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 }
    }
    const where: Prisma.AdminTaskWhereInput = {
      type: 'script-video-render',
      targetType: 'script_work',
      createdById: userId,
      ...(filteredByWork ? { targetId: { in: workIds } } : {}),
    }
    const [tasks, total] = await Promise.all([
      this.prisma.adminTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          targetId: true,
          status: true,
          progress: true,
          currentStep: true,
          errorMessage: true,
          summary: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
      this.prisma.adminTask.count({ where }),
    ])
    const worksById = new Map(ownedWorks.map((work) => [work.id, work]))
    return {
      items: tasks.map((task) => ({ ...task, work: worksById.get(task.targetId ?? '') ?? null })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  private clampLimit(limit: number) {
    return Math.min(50, Math.max(1, Math.floor(limit || 20)))
  }

  private async assertOwnedAsset(userId: string, assetId?: string) {
    if (!assetId) return
    const reference = await this.prisma.fileReference.findFirst({
      where: {
        createdById: userId,
        assetId,
      },
      select: { id: true },
    })
    if (!reference) throw new ForbiddenException('文件不存在或不属于当前用户')
  }

  private async assertPublishedWork(workId: string) {
    const work = await this.prisma.scriptWork.findFirst({
      where: { id: workId, status: ScriptWorkStatus.published, hiddenAt: null },
      select: { id: true },
    })
    if (!work) throw new NotFoundException('作品不存在或已下架')
  }

  async completeRecord(userId: string, episodeId: string, dto: CompleteScriptPracticeDto) {
    const player = await this.learningService.getStoryEpisodePlayer(userId, episodeId)
    const recordingAssetIds = [...new Set(dto.recordingAssetIds ?? [])]
    const clientMutationId = dto.clientMutationId?.trim() || undefined
    if (clientMutationId) {
      const existing = await this.prisma.scriptPracticeRecord.findUnique({
        where: { userId_clientMutationId: { userId, clientMutationId } },
      })
      if (existing) {
        return {
          ...existing,
          sceneId: player.episode.sceneId,
          sceneTitle: player.episode.sceneTitle,
        }
      }
    }
    await Promise.all([
      this.assertOwnedAsset(userId, dto.audioAssetId),
      this.assertOwnedAsset(userId, dto.videoAssetId),
      ...recordingAssetIds.map((assetId) => this.assertOwnedAsset(userId, assetId)),
    ])

    const now = new Date()
    try {
      return await this.prisma.$transaction(async (tx) => {
      if (clientMutationId) {
        const raced = await tx.scriptPracticeRecord.findUnique({
          where: { userId_clientMutationId: { userId, clientMutationId } },
        })
        if (raced) {
          return {
            ...raced,
            sceneId: player.episode.sceneId,
            sceneTitle: player.episode.sceneTitle,
          }
        }
      }
      const record = await tx.scriptPracticeRecord.create({
        data: {
          userId,
          episodeId,
          mode: dto.mode as ScriptPracticeMode,
          status: 'completed',
          durationSec: dto.durationSec ?? 0,
          turnCount: dto.turnCount ?? 0,
          lineCount: dto.lineCount ?? 0,
          usedChunkCount: dto.usedChunkCount ?? 0,
          completedObjectiveCount: dto.completedObjectiveCount ?? 0,
          score: dto.score,
          resultSnapshot: dto.resultSnapshot as Prisma.InputJsonValue | undefined,
          clientMutationId,
          audioAssetId: dto.audioAssetId,
          videoAssetId: dto.videoAssetId,
          completedAt: now,
        },
      })

      // The browser temporarily owns each uploaded line through the batch
      // reference. Move that ownership to the durable practice record in the
      // same transaction, so history playback survives page reloads and the
      // temporary upload reference does not leak.
      if (recordingAssetIds.length > 0) {
        // `skipDuplicates` is not supported by every Prisma provider used by
        // local development. Use the compound unique key explicitly instead.
        await Promise.all(recordingAssetIds.map((assetId) => tx.fileReference.upsert({
          where: {
            assetId_bizType_bizId: {
              assetId,
              bizType: 'script_practice_record',
              bizId: record.id,
            },
          },
          create: {
            assetId,
            createdById: userId,
            bizType: 'script_practice_record',
            bizId: record.id,
          },
          update: {},
        })))
        if (dto.recordingBatchId) {
          await tx.fileReference.deleteMany({
            where: {
              createdById: userId,
              bizType: 'script_practice_upload',
              bizId: dto.recordingBatchId,
              assetId: { in: recordingAssetIds },
            },
          })
        }
      }

      await tx.storyRecord.upsert({
        where: { userId_episodeId: { userId, episodeId } },
        create: {
          userId,
          episodeId,
          passed: true,
          turnCount: dto.turnCount ?? dto.lineCount ?? 0,
          usedChunkCount: dto.usedChunkCount ?? 0,
          completedObjectiveCount: dto.completedObjectiveCount ?? 0,
          completedAt: now,
          xpEarned: 10,
          aiFeedback: { source: 'script-community', mode: dto.mode, recordId: record.id },
        },
        update: {
          passed: true,
          turnCount: dto.turnCount ?? dto.lineCount ?? 0,
          usedChunkCount: dto.usedChunkCount ?? 0,
          completedObjectiveCount: dto.completedObjectiveCount ?? 0,
          completedAt: now,
          xpEarned: 10,
          aiFeedback: { source: 'script-community', mode: dto.mode, recordId: record.id },
        },
      })

      return {
        ...record,
        sceneId: player.episode.sceneId,
        sceneTitle: player.episode.sceneTitle,
      }
      })
    } catch (error: any) {
      if (clientMutationId && error?.code === 'P2002') {
        const existing = await this.prisma.scriptPracticeRecord.findUnique({
          where: { userId_clientMutationId: { userId, clientMutationId } },
        })
        if (existing) {
          return {
            ...existing,
            sceneId: player.episode.sceneId,
            sceneTitle: player.episode.sceneTitle,
          }
        }
      }
      throw error
    }
  }

  async myRecords(
    userId: string,
    params: { mode?: 'vn' | 'repeat'; cursor?: string; limit: number },
  ) {
    const take = this.clampLimit(params.limit)
    const items = await this.prisma.scriptPracticeRecord.findMany({
      where: {
        userId,
        status: 'completed',
        ...(params.mode ? { mode: params.mode as ScriptPracticeMode } : {}),
      },
      include: {
        episode: {
          select: {
            id: true,
            title: true,
            chapterName: true,
            characterName: true,
            scene: { select: { id: true, title: true } },
          },
        },
        works: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, kind: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = items.length > take
    const list = hasMore ? items.slice(0, take) : items
    return { list, nextCursor: hasMore ? list.at(-1)?.id ?? null : null }
  }

  async analyzeRecord(userId: string, recordId: string) {
    const record = await this.prisma.scriptPracticeRecord.findFirst({
      where: { id: recordId, userId, status: 'completed' },
      include: {
        episode: {
          select: {
            id: true,
            title: true,
            chapterName: true,
            characterName: true,
            objectives: true,
            scene: {
              select: {
                id: true,
                title: true,
                location: true,
                description: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    })
    if (!record) throw new NotFoundException('练习记录不存在')

    const snapshot = (record.resultSnapshot && typeof record.resultSnapshot === 'object')
      ? record.resultSnapshot as Record<string, any>
      : {}
    if (snapshot.aiAnalysis) {
      return { analysis: snapshot.aiAnalysis, raw: snapshot.aiAnalysisRaw ?? undefined }
    }

    const dialogue = Array.isArray(snapshot.dialogue) ? snapshot.dialogue : []
    const turns = dialogueToPracticeTurns(dialogue)
    if (turns.length === 0) {
      throw new BadRequestException('这次练习没有可评估的用户台词')
    }

    const sessionLike = {
      id: record.id,
      topicId: record.episodeId,
      topicSnapshot: {
        title: record.episode.title,
        promptEn: record.episode.title,
        promptZh: record.episode.chapterName,
        description: `剧本练习 · ${record.mode === 'vn' ? 'VN 互动' : '跟读剧场'}`,
        knowledgePoints: '',
        difficulty: '',
      },
      sceneSnapshot: {
        title: record.episode.scene.title,
        category: record.episode.scene.category?.name ?? '',
        location: record.episode.scene.location ?? '',
        description: record.episode.scene.description ?? '',
      },
      objectivesSnapshot: Array.isArray(record.episode.objectives) ? record.episode.objectives : [],
      chunksSnapshot: [],
      vocabSnapshot: [],
      sentencePatternsSnapshot: [],
      turns,
    }

    try {
      const result = await this.practiceAi.summarizePracticeSession(sessionLike, userId)
      const nextSnapshot = {
        ...snapshot,
        aiAnalysis: result.analysis,
        aiAnalysisRaw: result.raw,
        aiAnalysisError: null,
      }
      await this.prisma.scriptPracticeRecord.update({
        where: { id: record.id },
        data: {
          resultSnapshot: nextSnapshot as Prisma.InputJsonValue,
          score: typeof result.analysis?.overallScore === 'number'
            ? Math.round(result.analysis.overallScore)
            : record.score,
        },
      })
      return result
    } catch (error: any) {
      const nextSnapshot = {
        ...snapshot,
        aiAnalysisError: error?.message || '分析失败',
      }
      await this.prisma.scriptPracticeRecord.update({
        where: { id: record.id },
        data: { resultSnapshot: nextSnapshot as Prisma.InputJsonValue },
      })
      throw error
    }
  }

  async createWork(userId: string, dto: CreateScriptWorkDto) {
    const record = await this.prisma.scriptPracticeRecord.findFirst({
      where: { id: dto.recordId, userId, status: 'completed' },
      include: { episode: { select: { id: true } } },
    })
    if (!record) throw new NotFoundException('练习记录不存在')
    await Promise.all([
      this.assertOwnedAsset(userId, dto.videoAssetId),
      this.assertOwnedAsset(userId, dto.coverAssetId),
    ])

    const kind = dto.kind as ScriptWorkKind
    if (kind === ScriptWorkKind.vn_video && record.mode !== ScriptPracticeMode.vn) {
      throw new BadRequestException('VN 视频必须来自 VN 练习记录')
    }
    if (kind === ScriptWorkKind.repeat_video && record.mode !== ScriptPracticeMode.repeat) {
      throw new BadRequestException('跟读视频必须来自跟读练习记录')
    }

    // One practice record owns one work per video kind. A later confirmed
    // render reuses this work and replaces its video instead of creating
    // duplicate square posts and render tasks.
    const existing = await this.prisma.scriptWork.findFirst({
      where: { userId, recordId: record.id, kind, status: { not: ScriptWorkStatus.hidden } },
      orderBy: { createdAt: 'desc' },
      include: feedInclude,
    })
    if (existing) return existing

    return this.prisma.scriptWork.create({
      data: {
        userId,
        episodeId: record.episodeId,
        recordId: record.id,
        kind,
        title: dto.title.trim(),
        caption: dto.caption?.trim() || null,
        durationSec: record.durationSec,
        videoAssetId: dto.videoAssetId ?? record.videoAssetId,
        coverAssetId: dto.coverAssetId,
        status: dto.videoAssetId || record.videoAssetId
          ? ScriptWorkStatus.ready
          : ScriptWorkStatus.draft,
        renderPayload: {
          recordId: record.id,
          mode: record.mode,
          resultSnapshot: record.resultSnapshot,
        },
      },
      include: feedInclude,
    })
  }

  async myWorks(userId: string, cursor?: string, requestedLimit = 20) {
    const take = this.clampLimit(requestedLimit)
    const items = await this.prisma.scriptWork.findMany({
      where: { userId, status: { not: ScriptWorkStatus.hidden } },
      include: feedInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = items.length > take
    const list = hasMore ? items.slice(0, take) : items
    return {
      list: await this.serializeWorks(list, userId),
      nextCursor: hasMore ? list.at(-1)?.id ?? null : null,
    }
  }

  async updateWork(userId: string, id: string, dto: UpdateScriptWorkDto) {
    const work = await this.prisma.scriptWork.findFirst({ where: { id, userId } })
    if (!work) throw new NotFoundException('作品不存在')
    if (work.status === ScriptWorkStatus.published) {
      throw new BadRequestException('请先取消发布再编辑作品')
    }
    await Promise.all([
      this.assertOwnedAsset(userId, dto.videoAssetId),
      this.assertOwnedAsset(userId, dto.coverAssetId),
    ])
    const videoAssetId = dto.videoAssetId ?? work.videoAssetId
    const nextStatus = videoAssetId ? ScriptWorkStatus.ready : work.status
    return this.prisma.scriptWork.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        caption: dto.caption === undefined ? undefined : dto.caption.trim() || null,
        videoAssetId: dto.videoAssetId,
        coverAssetId: dto.coverAssetId,
        status: nextStatus,
        renderError: null,
      },
      include: feedInclude,
    })
  }

  async publishWork(userId: string, id: string) {
    const work = await this.prisma.scriptWork.findFirst({ where: { id, userId } })
    if (!work) throw new NotFoundException('作品不存在')
    if (!work.videoAssetId) {
      throw new BadRequestException('视频尚未生成，暂时不能发布')
    }
    if (work.status !== ScriptWorkStatus.ready && work.status !== ScriptWorkStatus.published) {
      throw new BadRequestException('当前作品状态不能发布')
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.scriptWork.updateMany({
        where: {
          userId,
          episodeId: work.episodeId,
          id: { not: id },
          status: ScriptWorkStatus.published,
        },
        data: { status: ScriptWorkStatus.ready, publishedAt: null },
      })
      return tx.scriptWork.update({
        where: { id },
        data: { status: ScriptWorkStatus.published, publishedAt: new Date(), hiddenAt: null },
        include: feedInclude,
      })
    })
  }

  async unpublishWork(userId: string, id: string) {
    const work = await this.prisma.scriptWork.findFirst({ where: { id, userId } })
    if (!work) throw new NotFoundException('作品不存在')
    await this.adminTasksService.cancelScriptVideoTasks(id, userId, '用户取消发布', true)
    return this.prisma.scriptWork.update({
      where: { id },
      data: { status: ScriptWorkStatus.ready, publishedAt: null },
      include: feedInclude,
    })
  }

  async deleteWork(userId: string, id: string) {
    const work = await this.prisma.scriptWork.findFirst({ where: { id, userId }, select: { id: true } })
    if (!work) throw new NotFoundException('作品不存在')
    // A rendering task may still complete after the work has been removed.
    // Cancel it first so it cannot write a video back to a deleted work.
    await this.adminTasksService.cancelScriptVideoTasks(id, userId, '用户删除作品', true)
    await this.prisma.scriptWork.delete({ where: { id } })
    return { success: true }
  }

  async feed(
    userId: string,
    params: { type: 'all' | 'vn' | 'repeat' | 'progress'; cursor?: string; limit: number },
  ) {
    const take = this.clampLimit(params.limit)
    const kind =
      params.type === 'vn' ? ScriptWorkKind.vn_video
        : params.type === 'repeat' ? ScriptWorkKind.repeat_video
          : params.type === 'progress' ? ScriptWorkKind.progress_card
            : undefined
    const items = await this.prisma.scriptWork.findMany({
      where: {
        status: ScriptWorkStatus.published,
        hiddenAt: null,
        videoAssetId: { not: null },
        ...(kind ? { kind } : {}),
      },
      include: feedInclude,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = items.length > take
    const list = hasMore ? items.slice(0, take) : items
    return {
      list: await this.serializeWorks(list, userId),
      nextCursor: hasMore ? list.at(-1)?.id ?? null : null,
    }
  }

  async like(userId: string, workId: string) {
    await this.assertPublishedWork(workId)
    await this.prisma.scriptWorkLike.upsert({
      where: { workId_userId: { workId, userId } },
      create: { workId, userId },
      update: {},
    })
    return { liked: true }
  }

  async unlike(userId: string, workId: string) {
    await this.prisma.scriptWorkLike.deleteMany({ where: { workId, userId } })
    return { liked: false }
  }

  async react(userId: string, workId: string, reaction: string) {
    await this.assertPublishedWork(workId)
    return this.prisma.scriptWorkReaction.upsert({
      where: { workId_userId: { workId, userId } },
      create: { workId, userId, reaction },
      update: { reaction },
    })
  }

  async removeReaction(userId: string, workId: string) {
    await this.prisma.scriptWorkReaction.deleteMany({ where: { workId, userId } })
    return { success: true }
  }

  async report(userId: string, workId: string, dto: ScriptReportDto) {
    await this.assertPublishedWork(workId)
    await this.prisma.scriptWorkReport.upsert({
      where: { workId_userId: { workId, userId } },
      create: { workId, userId, reason: dto.reason, detail: dto.detail },
      update: { reason: dto.reason, detail: dto.detail },
    })
    return { success: true }
  }

  /**
   * 批量序列化作品列表：资产 URL、点赞、我的表情、表情分组全部批量查询，
   * 避免每项一次 DB 查询的 N+1（原来 20 条列表 ≈ 100 次查询，现在固定 4 次）。
   */
  private async serializeWorks(works: FeedWork[], currentUserId: string) {
    if (works.length === 0) return []
    const workIds = works.map((work) => work.id)
    const assetIds = works.flatMap((work) => [work.videoAssetId, work.coverAssetId])
    const [urlByAsset, likedRows, myReactionRows, reactionGroupRows] = await Promise.all([
      this.fileAssetsService.getPrivateUrlsByAssetIds(assetIds, SCRIPT_ASSET_URL_EXPIRES_SECONDS),
      this.prisma.scriptWorkLike.findMany({
        where: { workId: { in: workIds }, userId: currentUserId },
        select: { workId: true },
      }),
      this.prisma.scriptWorkReaction.findMany({
        where: { workId: { in: workIds }, userId: currentUserId },
        select: { workId: true, reaction: true },
      }),
      this.prisma.scriptWorkReaction.groupBy({
        by: ['workId', 'reaction'],
        where: { workId: { in: workIds } },
        _count: { reaction: true },
      }),
    ])
    const likedByWork = new Set(likedRows.map((row) => row.workId))
    const reactionByWork = new Map(myReactionRows.map((row) => [row.workId, row.reaction]))
    const groupsByWork = new Map<string, { reaction: string; count: number }[]>()
    for (const row of reactionGroupRows) {
      const groups = groupsByWork.get(row.workId) ?? []
      groups.push({ reaction: row.reaction, count: row._count.reaction })
      groupsByWork.set(row.workId, groups)
    }

    return works.map((work) => ({
      ...work,
      videoUrl: work.videoAssetId ? (urlByAsset.get(work.videoAssetId) ?? null) : null,
      videoMimeType: work.videoAsset?.mimeType ?? null,
      // A work-specific cover remains authoritative.  Older works did not
      // persist coverAssetId, so use their owning learning package's cover
      // rather than returning a blank card.
      coverUrl: (work.coverAssetId ? urlByAsset.get(work.coverAssetId) : null)
        ?? work.episode.scene.coverImage
        ?? null,
      liked: likedByWork.has(work.id),
      myReaction: reactionByWork.get(work.id) ?? null,
      reactionGroups: (groupsByWork.get(work.id) ?? []).sort((a, b) => b.count - a.count),
    }))
  }
}
