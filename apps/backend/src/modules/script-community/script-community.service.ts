import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  FileAssetStatus,
  Prisma,
  ScriptPracticeMode,
  ScriptWorkKind,
  ScriptWorkStatus,
} from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { FileAssetsService } from '../file-assets/file-assets.service'
import { LearningService } from '../learning/learning.service'
import {
  CompleteScriptPracticeDto,
  CreateScriptWorkDto,
  ScriptReportDto,
  UpdateScriptWorkDto,
} from './dto/script-community.dto'

const feedInclude = {
  user: { select: { id: true, name: true, username: true, image: true, userLevel: true } },
  episode: {
    select: {
      id: true,
      title: true,
      chapterName: true,
      scene: { select: { id: true, title: true } },
    },
  },
  videoAsset: { select: { id: true } },
  coverAsset: { select: { id: true } },
  _count: { select: { likes: true, reactions: true } },
} satisfies Prisma.ScriptWorkInclude

type FeedWork = Prisma.ScriptWorkGetPayload<{ include: typeof feedInclude }>

@Injectable()
export class ScriptCommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningService: LearningService,
    private readonly fileAssetsService: FileAssetsService,
  ) {}

  private clampLimit(limit: number) {
    return Math.min(50, Math.max(1, Math.floor(limit || 20)))
  }

  private async assertOwnedAsset(userId: string, assetId?: string) {
    if (!assetId) return
    const reference = await this.prisma.fileReference.findFirst({
      where: {
        userId,
        assetId,
        asset: { status: FileAssetStatus.active },
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
    await Promise.all([
      this.assertOwnedAsset(userId, dto.audioAssetId),
      this.assertOwnedAsset(userId, dto.videoAssetId),
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
        status:
          kind === ScriptWorkKind.progress_card || dto.videoAssetId || record.videoAssetId
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
      list: await Promise.all(list.map((work) => this.serializeWork(work, userId))),
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
    const nextStatus =
      work.kind === ScriptWorkKind.progress_card || videoAssetId
        ? ScriptWorkStatus.ready
        : work.status
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
    if (work.kind !== ScriptWorkKind.progress_card && !work.videoAssetId) {
      throw new BadRequestException('视频尚未生成，暂时不能发布')
    }
    if (work.status !== ScriptWorkStatus.ready && work.status !== ScriptWorkStatus.published) {
      throw new BadRequestException('当前作品状态不能发布')
    }
    return this.prisma.scriptWork.update({
      where: { id },
      data: { status: ScriptWorkStatus.published, publishedAt: new Date(), hiddenAt: null },
      include: feedInclude,
    })
  }

  async unpublishWork(userId: string, id: string) {
    const work = await this.prisma.scriptWork.findFirst({ where: { id, userId } })
    if (!work) throw new NotFoundException('作品不存在')
    return this.prisma.scriptWork.update({
      where: { id },
      data: { status: ScriptWorkStatus.ready, publishedAt: null },
      include: feedInclude,
    })
  }

  async deleteWork(userId: string, id: string) {
    const result = await this.prisma.scriptWork.deleteMany({ where: { id, userId } })
    if (result.count === 0) throw new NotFoundException('作品不存在')
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
      list: await Promise.all(list.map((work) => this.serializeWork(work, userId))),
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

  private async serializeWork(work: FeedWork, currentUserId: string) {
    const [video, cover, liked, myReaction, reactionGroups] = await Promise.all([
      work.videoAssetId
        ? this.fileAssetsService.getPrivateUrlByAssetId(work.videoAssetId).catch(() => null)
        : null,
      work.coverAssetId
        ? this.fileAssetsService.getPrivateUrlByAssetId(work.coverAssetId).catch(() => null)
        : null,
      this.prisma.scriptWorkLike.findUnique({
        where: { workId_userId: { workId: work.id, userId: currentUserId } },
        select: { id: true },
      }),
      this.prisma.scriptWorkReaction.findUnique({
        where: { workId_userId: { workId: work.id, userId: currentUserId } },
        select: { reaction: true },
      }),
      this.prisma.scriptWorkReaction.groupBy({
        by: ['reaction'],
        where: { workId: work.id },
        _count: { reaction: true },
        orderBy: { _count: { reaction: 'desc' } },
      }),
    ])

    return {
      ...work,
      videoUrl: video?.url ?? null,
      coverUrl: cover?.url ?? null,
      liked: Boolean(liked),
      myReaction: myReaction?.reaction ?? null,
      reactionGroups: reactionGroups.map((group) => ({
        reaction: group.reaction,
        count: group._count.reaction,
      })),
    }
  }
}
