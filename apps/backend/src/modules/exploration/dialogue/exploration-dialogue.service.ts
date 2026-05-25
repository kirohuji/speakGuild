import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * 探索模式自由对话服务
 *
 * 当 NPC 没有配置 Ink 脚本时，使用 AI 生成 NPC 回复。
 * 此服务负责：对话记录存储、对话历史查询。
 *
 * AI 回复生成由 practice-ai 模块处理（复用 DeepSeek 调用框架）。
 */
@Injectable()
export class ExplorationDialogueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取最近 N 轮对话（用于构建 AI prompt 上下文）
   */
  async getRecentHistory(userId: string, characterId: string, limit = 10) {
    return this.prisma.explorationRecord.findMany({
      where: { userId, characterId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        userText: true,
        npcReply: true,
        createdAt: true,
      },
    });
  }

  /**
   * 保存一轮对话
   */
  async saveDialogue(data: {
    userId: string;
    characterId: string;
    locationId: string;
    userText: string;
    npcReply?: string;
    feedback?: any;
    isInkDriven?: boolean;
    inkKnotName?: string;
  }) {
    return this.prisma.explorationRecord.create({ data });
  }
}
