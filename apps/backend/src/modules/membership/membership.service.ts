import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

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
      features: plan.features,
      highlighted: plan.highlighted,
    }));
  }

  async getCurrentMembership(userId: string) {
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
      message: `会员有效期至 ${membership.expiredAt.toLocaleDateString('zh-CN')}`,
    };
  }

  getBenefits() {
    return [
      { benefitId: '1', name: '题库使用数量', freeSupport: '1 套', standardSupport: '3 套', advancedSupport: '无限' },
      { benefitId: '2', name: 'AI 练习反馈', freeSupport: false, standardSupport: true, advancedSupport: true },
      { benefitId: '3', name: '模拟考试', freeSupport: '5 次/月', standardSupport: '30 次/月', advancedSupport: '无限' },
      { benefitId: '4', name: '练习记录', freeSupport: true, standardSupport: true, advancedSupport: true },
      { benefitId: '5', name: '收藏题目', freeSupport: true, standardSupport: true, advancedSupport: true },
      { benefitId: '6', name: '生词本', freeSupport: true, standardSupport: true, advancedSupport: true },
      { benefitId: '7', name: '客服支持', freeSupport: false, standardSupport: '工作日', advancedSupport: '全天' },
      { benefitId: '8', name: 'AI 智能出卷', freeSupport: false, standardSupport: false, advancedSupport: true },
    ];
  }
}
