import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  message?: string;
  canExchange: boolean;
  exchangeCost: number;
}

// 会员等级配额（free 由 system_config.free_ai_corrections 动态控制）
const QUOTAS: Record<string, Record<string, number>> = {
  standard: {
    dialogue: -1,  // -1 = 会员不受限
    summary: -1,
  },
  advanced: {
    dialogue: -1,
    summary: -1,
  },
};

/** free 层级默认值（system_config 缺失时回退） */
const FREE_DEFAULTS: Record<string, number> = {
  dialogue: 5,
  summary: 1,
};

const EXCHANGE_COST = 10; // 10 积分换 1 次

const TYPE_LABELS: Record<string, string> = {
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
    type: 'dialogue' | 'summary',
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

    // 2. 会员直接放行（-1 = 无限）
    if (effectiveLevel !== 'free') {
      return { allowed: true, remaining: -1, canExchange: false, exchangeCost: 0 };
    }

    // 3. free 层级：从 system_config 读取配额
    const quota = await this.getFreeQuota(type);

    // 4. 查今日用量
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.aiUsageDaily.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today },
      update: {},
    });

    const used = (usage as any)[type] ?? 0;
    if (used >= quota) {
      // 动态获取会员月价
      const plan = await this.prisma.membershipPlan.findFirst({
        where: { level: 'standard' },
        select: { price: true },
      });
      const monthlyPrice = plan ? (plan.price / 100).toFixed(0) : '20';

      return {
        allowed: false,
        remaining: 0,
        message: `今日${TYPE_LABELS[type]}额度已用完（${quota}次/天）。10 积分可换 1 次，或 ¥${monthlyPrice} 开通会员无限畅练`,
        canExchange: true,
        exchangeCost: EXCHANGE_COST,
      };
    }

    // 5. 扣减
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
    type: 'dialogue' | 'summary',
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

    // free 层级：从 system_config 读取配额
    const dialogueLimit = await this.getFreeQuota('dialogue');
    const summaryLimit = await this.getFreeQuota('summary');

    return {
      level: 'free',
      isMember: false,
      points: user?.points ?? 0,
      exchangeCost: EXCHANGE_COST,
      quotas: {
        dialogue: {
          used: usage?.dialogue ?? 0,
          limit: dialogueLimit,
          remaining: Math.max(0, dialogueLimit - (usage?.dialogue ?? 0)),
        },
        summary: {
          used: usage?.summary ?? 0,
          limit: summaryLimit,
          remaining: Math.max(0, summaryLimit - (usage?.summary ?? 0)),
        },
      },
    };
  }

  /** 记录 token 消耗量（追加到今日记录） */
  async recordTokens(userId: string, tokenCount: number) {
    if (!tokenCount || tokenCount <= 0) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
      await this.prisma.aiUsageDaily.upsert({
        where: { userId_date: { userId, date: today } },
        create: { userId, date: today, tokens: tokenCount },
        update: { tokens: { increment: tokenCount } },
      })
    } catch (err: any) {
      this.logger.warn(`Failed to record tokens for user ${userId}: ${err.message}`)
    }
  }

  /** 从 system_config 读取 free 层级配额，缺失时回退默认值 */
  private async getFreeQuota(type: 'dialogue' | 'summary'): Promise<number> {
    const configKey = type === 'dialogue' ? 'free_ai_corrections' : 'free_ai_summaries';
    const fallback = FREE_DEFAULTS[type] ?? 1;

    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { key: configKey },
        select: { value: true },
      });
      const val = parseInt(row?.value ?? '', 10);
      return Number.isFinite(val) && val >= 0 ? val : fallback;
    } catch {
      return fallback;
    }
  }
}
