import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  message?: string;
  canExchange: boolean;
  exchangeCost: number;
}

const QUOTAS: Record<string, Record<string, number>> = {
  free: {
    feedback: 5,   // AI 纠错
    dialogue: 5,   // 对话判定
    summary: 1,    // 汇总分析
  },
  standard: {
    feedback: -1,  // -1 = 会员不受限
    dialogue: -1,
    summary: -1,
  },
  advanced: {
    feedback: -1,
    dialogue: -1,
    summary: -1,
  },
};

const EXCHANGE_COST = 10; // 10 积分换 1 次

const TYPE_LABELS: Record<string, string> = {
  feedback: 'AI 纠错',
  dialogue: '对话判定',
  summary: '汇总分析',
};

@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 检查并扣减配额 */
  async checkAndDeduct(
    userId: string,
    type: 'feedback' | 'dialogue' | 'summary',
  ): Promise<QuotaCheckResult> {
    // 0. 管理员直接放行（无限配额）
    const adminCheck = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (adminCheck?.role === 'admin') {
      return { allowed: true, remaining: -1, canExchange: false, exchangeCost: 0 };
    }

    // 1. 查会员等级
    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const level = membership?.plan?.level ?? 'free';
    const isActive =
      membership?.status === 'active' && membership.expiredAt > new Date();
    const effectiveLevel = isActive ? level : 'free';

    const quota = QUOTAS[effectiveLevel]?.[type] ?? 0;

    // 2. 会员直接放行（-1 = 无限）
    if (quota === -1) {
      return { allowed: true, remaining: -1, canExchange: false, exchangeCost: 0 };
    }

    // 3. 查今日用量
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.aiUsageDaily.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today },
      update: {},
    });

    const used = (usage as any)[type] ?? 0;
    if (used >= quota) {
      return {
        allowed: false,
        remaining: 0,
        message: `今日${TYPE_LABELS[type]}额度已用完（${quota}次/天）。10 积分可换 1 次，或 ¥19.9 开通会员无限畅练`,
        canExchange: true,
        exchangeCost: EXCHANGE_COST,
      };
    }

    // 4. 扣减
    await this.prisma.aiUsageDaily.update({
      where: { userId_date: { userId, date: today } },
      data: { [type]: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: quota - used - 1,
      canExchange: false,
      exchangeCost: 0,
    };
  }

  /** 积分兑换 AI 次数 */
  async exchangeByPoints(
    userId: string,
    type: 'feedback' | 'dialogue' | 'summary',
  ): Promise<{ success: boolean; message: string }> {
    // 查积分
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user || user.points < EXCHANGE_COST) {
      return { success: false, message: `积分不足（需要 ${EXCHANGE_COST} 积分，当前 ${user?.points ?? 0}）` };
    }

    // 扣积分 + 追加配额
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: EXCHANGE_COST } },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'exchange',
          amount: -EXCHANGE_COST,
          balance: user.points - EXCHANGE_COST,
          description: `积分兑换 1 次${TYPE_LABELS[type]}`,
        },
      });

      // 追加配额：将今日用量 -1（相当于多一次）
      const usage = await tx.aiUsageDaily.findUnique({
        where: { userId_date: { userId, date: today } },
      });

      if (usage) {
        await tx.aiUsageDaily.update({
          where: { userId_date: { userId, date: today } },
          data: { [type]: { decrement: 1 } },
        });
      }
    });

    return { success: true, message: `兑换成功！获得 1 次${TYPE_LABELS[type]}` };
  }

  /** 获取用户当前配额状态 */
  async getStatus(userId: string) {
    // 管理员直接返回无限配额
    const adminCheck = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (adminCheck?.role === 'admin') {
      return {
        level: 'admin',
        isMember: true,
        isAdmin: true,
        message: '管理员拥有无限 AI 配额',
        quotas: {},
        points: 0,
      };
    }

    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const level = membership?.plan?.level ?? 'free';
    const isActive =
      membership?.status === 'active' && membership.expiredAt > new Date();
    const effectiveLevel = isActive ? level : 'free';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (effectiveLevel !== 'free') {
      return {
        level: effectiveLevel,
        isMember: true,
        message: '会员无限畅练',
        quotas: {},
        points: user?.points ?? 0,
      };
    }

    return {
      level: 'free',
      isMember: false,
      points: user?.points ?? 0,
      exchangeCost: EXCHANGE_COST,
      quotas: {
        feedback: {
          used: usage?.feedback ?? 0,
          limit: QUOTAS.free.feedback,
          remaining: Math.max(0, QUOTAS.free.feedback - (usage?.feedback ?? 0)),
        },
        dialogue: {
          used: usage?.dialogue ?? 0,
          limit: QUOTAS.free.dialogue,
          remaining: Math.max(0, QUOTAS.free.dialogue - (usage?.dialogue ?? 0)),
        },
        summary: {
          used: usage?.summary ?? 0,
          limit: QUOTAS.free.summary,
          remaining: Math.max(0, QUOTAS.free.summary - (usage?.summary ?? 0)),
        },
      },
    };
  }
}
