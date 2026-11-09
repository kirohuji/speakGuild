import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevenueCatService } from '../pay/revenuecat/revenuecat.service';

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenueCatService: RevenueCatService,
  ) {}

  private getDisplayFeatures(level: string, features: string[]) {
    if (level !== 'standard') return features;

    return [
      'AI 评价与复盘次数更多',
      '完整剧本模式',
      '更多主题化练习',
      '练习完成后的自由练习模式',
      '更多表达库收纳空间',
    ];
  }

  async getPlans() {
    const plans = await this.prisma.membershipPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return plans.map((plan) => ({
      planId: plan.id,
      name: plan.name,
      level: plan.level,
      price: plan.price,
      yearlyPrice: plan.yearlyPrice,
      period: plan.period,
      durationDays: plan.durationDays,
      description: plan.level === 'free' ? '免费体验' : plan.level === 'standard' ? '适合大部分用户' : '解锁全部功能',
      features: this.getDisplayFeatures(plan.level, plan.features),
      highlighted: plan.highlighted,
    }));
  }

  async getCurrentMembership(userId: string) {
    // 管理员拥有全部权限
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'admin') {
      return {
        userId,
        planId: 'admin',
        planName: '管理员',
        level: 'admin' as const,
        isActive: true,
        expiredAt: null,
        autoRenew: false,
        cancelledAt: null,
        rcProductId: null,
        pendingProductId: null,
        billingIssueAt: null,
        message: '管理员拥有全部功能权限',
      };
    }

    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!membership || membership.status !== 'active' || membership.expiredAt < new Date()) {
      return {
        userId,
        planId: null,
        planName: '免费用户',
        level: 'free',
        isActive: false,
        expiredAt: null,
        autoRenew: false,
        cancelledAt: null,
        rcProductId: null,
        pendingProductId: null,
        billingIssueAt: null,
        message: '当前为免费版，升级会员可解锁更多功能',
      };
    }

    return {
      userId,
      planId: membership.plan.id,
      planName: membership.plan.name,
      level: membership.plan.level,
      isActive: true,
      expiredAt: membership.expiredAt,
      startedAt: membership.startedAt,
      autoRenew: membership.autoRenew,
      cancelledAt: membership.cancelledAt,
      rcProductId: membership.rcProductId,
      pendingProductId: membership.pendingProductId,
      billingIssueAt: membership.billingIssueAt,
      message: `会员有效期至 ${membership.expiredAt.toLocaleDateString('zh-CN')}`,
    };
  }

  async syncRevenueCatMembership(userId: string) {
    const sync = await this.revenueCatService.syncCustomerMembership(userId);
    return { ...(await this.getCurrentMembership(userId)), sync };
  }

  async listPurchases(userId: string, params: { page?: number; pageSize?: number }) {
    const pageSize = Math.min(20, Math.max(1, params.pageSize || 6));
    const page = Math.max(1, params.page || 1);
    const [orders, gifts, remotePurchases] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId, status: 'paid' },
        select: { id: true, billingCycle: true, paidAt: true, createdAt: true, plan: { select: { durationDays: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.notificationTarget.findMany({
        where: { userId, notification: { title: { in: ['新人会员已到账', '邀请奖励已到账'] } } },
        select: { notification: { select: { id: true, content: true, createdAt: true } } },
        orderBy: { notification: { createdAt: 'desc' } },
        take: 50,
      }),
      this.revenueCatService.syncPurchaseLedger(userId),
    ]);
    const storedPurchases = remotePurchases ?? (await this.prisma.membershipPurchase.findMany({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
      take: 100,
    })).flatMap((purchase) => {
      if (purchase.kind !== 'monthly' && purchase.kind !== 'yearly') return [];
      return [{
        id: purchase.rcSubscriptionId,
        kind: purchase.kind,
        purchasedAt: purchase.purchasedAt.toISOString(),
        expiresAt: purchase.expiresAt?.toISOString() ?? null,
      }];
    });

    const records = [
      ...orders.map((order) => {
        const purchasedAt = order.paidAt ?? order.createdAt;
        const days = order.billingCycle === 'yearly' ? 365 : order.plan.durationDays;
        return {
          id: order.id,
          kind: order.billingCycle === 'yearly' ? 'yearly' as const : 'monthly' as const,
          days: null as number | null,
          purchasedAt: purchasedAt.toISOString(),
          expiresAt: new Date(purchasedAt.getTime() + days * 86400000).toISOString(),
        };
      }),
      ...storedPurchases.map((purchase) => ({ ...purchase, days: null as number | null })),
      ...gifts.map((gift) => {
        const days = this.readGiftDays(gift.notification.content);
        return {
          id: gift.notification.id,
          kind: 'gift' as const,
          days,
          purchasedAt: gift.notification.createdAt.toISOString(),
          expiresAt: new Date(gift.notification.createdAt.getTime() + days * 86400000).toISOString(),
        };
      }),
    ].sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());

    const start = (page - 1) * pageSize;
    return {
      list: records.slice(start, start + pageSize),
      total: records.length,
      page,
      pageSize,
    };
  }

  private readGiftDays(content: string) {
    const matched = content.match(/(\d+)\s*天/);
    return matched ? Number(matched[1]) : 5;
  }

  getBenefits() {
    return [
      { benefitId: '1', name: 'AI 每轮评价', freeSupport: '5 次/天', standardSupport: '更多次数', advancedSupport: '更多次数' },
      { benefitId: '2', name: 'AI 完成复盘', freeSupport: '1 次/天', standardSupport: '更多次数', advancedSupport: '更多次数' },
      { benefitId: '3', name: '剧本模式', freeSupport: '体验剧集', standardSupport: '完整开放', advancedSupport: '完整开放' },
      { benefitId: '4', name: '主题化练习', freeSupport: '基础主题', standardSupport: '更多主题', advancedSupport: '更多主题' },
      { benefitId: '5', name: '完成后自由练习', freeSupport: false, standardSupport: true, advancedSupport: true },
      { benefitId: '6', name: '表达库容量', freeSupport: '基础容量', standardSupport: '更多收纳', advancedSupport: '更多收纳' },
    ];
  }
}
