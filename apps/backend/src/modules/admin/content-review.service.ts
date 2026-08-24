import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ContentAccessService, type ManagementSession } from './content-access.service';
import { LearningPackAdminService } from './learning-pack-admin.service';

@Injectable()
export class ContentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ContentAccessService,
    private readonly learningPacks: LearningPackAdminService,
    private readonly notifications: NotificationService,
  ) {}

  private async sourceSnapshot(sceneId: string) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        trainingTopics: {
          orderBy: { sortOrder: 'asc' },
          include: { activeChunks: true, topicVocabs: true, topicPatterns: true },
        },
        storyEpisodes: {
          orderBy: { sortOrder: 'asc' },
          include: { vocabularies: true, chunks: true, sentencePatterns: true },
        },
      },
    });
    if (!scene) throw new NotFoundException('内容不存在');

    const inkIds = [...new Set([
      ...scene.trainingTopics.map((topic) => topic.inkScriptId),
      ...scene.storyEpisodes.map((episode) => episode.inkScriptId),
    ].filter(Boolean))] as string[];
    const scripts = inkIds.length
      ? await this.prisma.inkScript.findMany({
          where: { id: { in: inkIds } },
          orderBy: { id: 'asc' },
          select: { id: true, version: true, inkSource: true, inkJson: true, updatedAt: true },
        })
      : [];
    const snapshot = { scene, scripts };
    const revision = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    return { snapshot, revision };
  }

  async submit(session: ManagementSession, sceneId: string, kind: 'learning_package' | 'narrative_package') {
    await this.access.assertSceneAccess(session, sceneId);
    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId }, select: { packageType: true } });
    if (!scene) throw new NotFoundException('内容不存在');
    if (kind === 'narrative_package' && scene.packageType !== 'story') {
      throw new BadRequestException('只有剧情包可以提交剧情包审核');
    }
    if (kind === 'learning_package' && scene.packageType === 'story') {
      throw new BadRequestException('剧情包请提交剧情包审核');
    }

    const existing = await this.prisma.contentReviewRequest.findFirst({
      where: { sceneId, kind, status: 'pending' },
      select: { id: true },
    });
    if (existing) throw new ConflictException('该内容已有待审核申请');

    const latest = await this.prisma.learningPackage.findFirst({
      where: { sceneId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const requestedVersion = Number(latest?.version ?? 0) + 1;
    const { snapshot, revision } = await this.sourceSnapshot(sceneId);

    return this.prisma.contentReviewRequest.create({
      data: {
        kind,
        sceneId,
        ownerId: session.user.id,
        requestedVersion,
        sourceRevision: revision,
        snapshot,
      },
      include: { owner: { select: { id: true, name: true, email: true } }, scene: { select: { id: true, title: true } } },
    });
  }

  async list(session: ManagementSession, params: { status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: any = {
      ...(params.status ? { status: params.status } : {}),
      ...(this.access.isAdmin(session) ? {} : { ownerId: session.user.id }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentReviewRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          reviewer: { select: { id: true, name: true, email: true } },
          scene: { select: { id: true, title: true, packageType: true, updatedAt: true } },
          generatedPackage: { select: { id: true, version: true, status: true } },
        },
      }),
      this.prisma.contentReviewRequest.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async approve(admin: ManagementSession, id: string, reviewNote?: string) {
    const request = await this.prisma.contentReviewRequest.findUnique({
      where: { id },
      include: { scene: { select: { id: true, title: true } } },
    });
    if (!request) throw new NotFoundException('审核申请不存在');
    if (request.status !== 'pending') throw new ConflictException('该申请已处理');

    const current = await this.sourceSnapshot(request.sceneId);
    if (current.revision !== request.sourceRevision) {
      await this.prisma.contentReviewRequest.update({ where: { id }, data: { status: 'superseded' } });
      throw new ConflictException('内容在提交后已经修改，请创作者重新提交审核');
    }

    await this.prisma.contentReviewRequest.update({
      where: { id },
      data: { status: 'approved', reviewNote: reviewNote?.trim() || null, reviewedById: admin.user.id, reviewedAt: new Date() },
    });

    try {
      const pack = await this.learningPacks.generate(admin.user.id, request.sceneId, {
        version: request.requestedVersion,
        publish: true,
      });
      const completed = await this.prisma.contentReviewRequest.update({
        where: { id },
        data: { generatedPackageId: pack.id },
        include: { owner: { select: { id: true, name: true, email: true } }, scene: { select: { id: true, title: true } }, generatedPackage: true },
      });
      await this.notifications.createSystemTargetedNotification(
        admin.user.id,
        request.ownerId,
        '内容审核通过',
        `“${request.scene.title}”已审核通过并生成 v${request.requestedVersion}。`,
        request.kind === 'narrative_package' ? '/admin/script-packs' : '/admin/learning-packs',
      );
      return completed;
    } catch (error) {
      await this.prisma.contentReviewRequest.update({
        where: { id },
        data: { status: 'pending', reviewNote: null, reviewedById: null, reviewedAt: null },
      }).catch(() => undefined);
      await this.notifications.createSystemTargetedNotification(
        admin.user.id,
        request.ownerId,
        '内容构建失败',
        `“${request.scene.title}”审核已通过，但生成失败，请联系管理员重试。`,
      ).catch(() => undefined);
      throw error;
    }
  }

  async reject(admin: ManagementSession, id: string, reviewNote: string) {
    if (!reviewNote?.trim()) throw new BadRequestException('驳回时必须填写原因');
    const request = await this.prisma.contentReviewRequest.findUnique({
      where: { id },
      include: { scene: { select: { title: true } } },
    });
    if (!request) throw new NotFoundException('审核申请不存在');
    if (request.status !== 'pending') throw new ConflictException('该申请已处理');
    const updated = await this.prisma.contentReviewRequest.update({
      where: { id },
      data: { status: 'rejected', reviewNote: reviewNote.trim(), reviewedById: admin.user.id, reviewedAt: new Date() },
    });
    await this.notifications.createSystemTargetedNotification(
      admin.user.id,
      request.ownerId,
      '内容审核未通过',
      `“${request.scene.title}”需要修改：${reviewNote.trim()}`,
    );
    return updated;
  }
}
