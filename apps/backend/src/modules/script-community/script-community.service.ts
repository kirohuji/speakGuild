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

@Injectable()
export class ScriptCommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningService: LearningService,
    private readonly fileAssetsService: FileAssetsService,
    private readonly adminTasksService: AdminTasksService,
  ) {}

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
    const recordingsByFrame = recordingAssets && typeof recordingAssets === 'object'
      ? await Promise.all(Object.entries(recordingAssets as Record<string, unknown>).map(async ([frameIndex, assetId]) => {
        if (typeof assetId !== 'string' || !assetId) return null
        let asset: Awaited<ReturnType<FileAssetsService['getPrivateUrlByAssetId']>>
        try {
          asset = await this.fileAssetsService.getPrivateUrlByAssetId(assetId)
        } catch (error) {
          console.warn('[script-video] saved recording is unavailable; falling back to TTS', { workId, frameIndex, assetId, error })
          return null
        }
        return [Number(frameIndex), {
          url: asset.url,
          durationMs: await this.getRecordingDurationMs(asset.url, assetId),
        }] as const
      }))
      : []
    const recordingUrls = new Map(recordingsByFrame.filter((entry): entry is readonly [number, { url: string; durationMs: number }] => Boolean(entry)))
    const framesWithRecordingAudio = frames.map((frame: any) => {
      const recording = recordingUrls.get(Number(frame?.index))
      return recording
        ? {
            ...frame,
            resolvedAudioUrl: recording.url,
            audioSource: 'userRecording',
            recordingDurationMs: recording.durationMs,
          }
        : frame
    })
    // The client can only estimate TTS duration from text. Recorded speech is
    // often much longer, so rebuild the sequential timeline after injection
    // and give the recording its complete duration instead of cutting Audio at
    // the original text-derived Sequence boundary.
    let cursor = 0
    const renderFrames = framesWithRecordingAudio.map((frame: any) => {
      const recordingFrames = frame.recordingDurationMs
        ? Math.ceil((frame.recordingDurationMs / 1000) * 30)
        : 0
      const durationFrames = Math.max(1, Number(frame.durationFrames) || 1, recordingFrames)
      const next = {
        ...frame,
        startFrame: cursor,
        durationFrames,
        endFrame: cursor + durationFrames,
      }
      cursor = next.endFrame
      return next
    })
    const missingBackgroundFrames = renderFrames.filter((frame: any) => !frame.background?.url).map((frame: any) => frame.index)
    const missingSpriteFrames = renderFrames.filter((frame: any) => (
      frame.kind !== 'choice'
      && frame.sprite?.speaker
      && !frame.sprite?.url
    )).map((frame: any) => frame.index)
    if (missingBackgroundFrames.length || missingSpriteFrames.length) {
      throw new BadRequestException(
        `视频素材不完整：${missingBackgroundFrames.length ? `背景缺失（帧 ${missingBackgroundFrames.join(', ')}）` : ''}`
        + `${missingBackgroundFrames.length && missingSpriteFrames.length ? '；' : ''}`
        + `${missingSpriteFrames.length ? `立绘缺失（帧 ${missingSpriteFrames.join(', ')}）` : ''}`,
      )
    }
    console.log('[script-video] resolved user recordings for render', {
      workId,
      savedRecordings: recordingUrls.size,
      injectedFrames: renderFrames.filter((frame: any) => frame.audioSource === 'userRecording').map((frame: any) => frame.index),
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
      const task = await this.adminTasksService.enqueueScriptVideo(workId, userId, renderFrames)
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
    await Promise.all([
      this.assertOwnedAsset(userId, dto.audioAssetId),
      this.assertOwnedAsset(userId, dto.videoAssetId),
      ...recordingAssetIds.map((assetId) => this.assertOwnedAsset(userId, assetId)),
    ])

    const now = new Date()
    return this.prisma.$transaction(async (tx) => {
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
