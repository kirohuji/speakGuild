import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireAuthSession } from '../auth/session.util';

export type ManagementRole = 'creator' | 'admin';

export interface ManagementSession {
  user: {
    id: string;
    role: ManagementRole;
    name?: string;
    email?: string;
  };
}

@Injectable()
export class ContentAccessService implements OnModuleInit {
  private readonly logger = new Logger(ContentAccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Historical rows predate creator ownership. Assign them to the oldest
    // administrator so every row has an accountable owner in normal operation.
    const admin = await this.prisma.user.findFirst({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!admin) {
      this.logger.warn('No administrator exists; legacy content ownership backfill was skipped');
      return;
    }

    const owner = { ownerId: admin.id };
    const results = await this.prisma.$transaction([
      this.prisma.scene.updateMany({ where: { ownerId: null }, data: owner }),
      this.prisma.packageGroup.updateMany({ where: { ownerId: null }, data: owner }),
      this.prisma.inkScript.updateMany({ where: { ownerId: null }, data: owner }),
      this.prisma.gameCharacter.updateMany({ where: { ownerId: null }, data: owner }),
      this.prisma.ttsVoiceAsset.updateMany({ where: { ownerId: null }, data: owner }),
    ]);
    const updated = results.reduce((sum, result) => sum + result.count, 0);
    if (updated > 0) this.logger.log(`Assigned ${updated} legacy content rows to the default administrator`);
  }

  async requireManager(req: Request): Promise<ManagementSession> {
    const session = await requireAuthSession(req);
    const role = (session.user as any)?.role;
    if (role !== 'admin' && role !== 'creator') {
      throw new ForbiddenException('需要创作者或管理员权限');
    }
    return session as ManagementSession;
  }

  async requireAdmin(req: Request): Promise<ManagementSession> {
    const session = await this.requireManager(req);
    if (session.user.role !== 'admin') throw new ForbiddenException('需要管理员权限');
    return session;
  }

  isAdmin(session: ManagementSession) {
    return session.user.role === 'admin';
  }

  ownerWhere(session: ManagementSession) {
    return this.isAdmin(session) ? {} : { ownerId: session.user.id };
  }

  sceneWhere(session: ManagementSession) {
    return this.isAdmin(session) ? {} : { scene: { ownerId: session.user.id } };
  }

  async assertSceneAccess(session: ManagementSession, sceneId: string) {
    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, ...this.ownerWhere(session) },
      select: { id: true, ownerId: true },
    });
    if (!scene) throw new NotFoundException('内容不存在');
    return scene;
  }

  async assertTopicAccess(session: ManagementSession, topicId: string) {
    const topic = await this.prisma.trainingTopic.findFirst({
      where: { id: topicId, ...this.sceneWhere(session) },
      select: { id: true, sceneId: true },
    });
    if (!topic) throw new NotFoundException('内容不存在');
    return topic;
  }

  async assertStoryAccess(session: ManagementSession, storyId: string) {
    const story = await this.prisma.inkScript.findFirst({
      where: { id: storyId, ...this.ownerWhere(session) },
      select: { id: true, ownerId: true },
    });
    if (!story) throw new NotFoundException('内容不存在');
    return story;
  }

  async assertCharacterAccess(session: ManagementSession, characterId: string) {
    const character = await this.prisma.gameCharacter.findFirst({
      where: { id: characterId, ...this.ownerWhere(session) },
      select: { id: true },
    });
    if (!character) throw new NotFoundException('角色不存在');
    return character;
  }

  async assertVoiceAccess(session: ManagementSession, voiceId: string) {
    const voice = await this.prisma.ttsVoiceAsset.findFirst({
      where: {
        id: voiceId,
        ...(this.isAdmin(session)
          ? {}
          : { OR: [{ ownerId: session.user.id }, { visibility: 'system_shared' }] }),
      },
      select: { id: true, ownerId: true, visibility: true },
    });
    if (!voice) throw new NotFoundException('音色不存在');
    return voice;
  }
}
