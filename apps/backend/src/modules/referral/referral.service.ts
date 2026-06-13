import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import * as crypto from 'crypto'

@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase()
  }

  async getOrCreateCode(userId: string) {
    let code = await this.prisma.referralCode.findUnique({ where: { userId } })
    if (!code) {
      code = await this.prisma.referralCode.create({
        data: { userId, code: this.generateCode() },
      })
    }
    return code
  }

  async getReferralStats(userId: string) {
    const code = await this.prisma.referralCode.findUnique({
      where: { userId },
      include: {
        referrals: {
          include: { referredUser: { select: { id: true, name: true, image: true, createdAt: true } } },
        },
      },
    })
    if (!code) return { code: null, totalInvited: 0, totalReward: 0, referrals: [] }
    return {
      code: code.code,
      totalInvited: code.totalInvited,
      totalReward: code.totalReward,
      referrals: code.referrals.map((r) => ({
        userId: r.referredUser.id,
        userName: r.referredUser.name,
        userImage: r.referredUser.image,
        joinedAt: r.referredUser.createdAt,
        rewarded: !!r.rewardedAt,
      })),
    }
  }

  async applyReferral(referredUserId: string, referralCode: string) {
    const referrerCode = await this.prisma.referralCode.findUnique({
      where: { code: referralCode.toUpperCase() },
    })
    if (!referrerCode) throw new BadRequestException('邀请码无效')
    if (referrerCode.userId === referredUserId) throw new BadRequestException('不能邀请自己')

    const existing = await this.prisma.referral.findUnique({
      where: { referredUserId },
    })
    if (existing) throw new BadRequestException('您已被其他用户邀请')

    const referral = await this.prisma.referral.create({
      data: {
        referrerId: referrerCode.id,
        referredUserId,
        rewardedAt: new Date(),
      },
    })

    // 读取系统配置：邀请人奖励天数
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'invite_trial_days' },
    });
    const trialDays = parseInt(config?.value || '5', 10);

    await this.prisma.referralCode.update({
      where: { id: referrerCode.id },
      data: { totalInvited: { increment: 1 }, totalReward: { increment: trialDays } },
    });

    // 仅邀请人获得会员天数；被邀请人只获得积分，不额外赠送邀请会员天数。
    await this.grantTrialDays(referrerCode.userId, trialDays)

    // 积分奖励
    await this.grantPoints(referrerCode.userId, 100, 'invite_reward', '邀请好友注册奖励')
    await this.grantPoints(referredUserId, 50, 'invited_bonus', '通过邀请码注册新人礼包')

    return referral
  }

  private async grantPoints(userId: string, amount: number, type: string, description: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    const newBalance = (user?.points ?? 0) + amount;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { points: { increment: amount } },
      }),
      this.prisma.pointTransaction.create({
        data: {
          userId,
          type,
          amount,
          balance: newBalance,
          description,
        },
      }),
    ]);
  }

  private async grantTrialDays(userId: string, days: number) {
    const membership = await this.prisma.userMembership.findUnique({ where: { userId } })
    const now = new Date()
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { level: 'standard' },
    })
    if (!plan) return

    if (membership) {
      const newExpiry = new Date(
        Math.max(membership.expiredAt.getTime(), now.getTime()) + days * 86400000,
      )
      await this.prisma.userMembership.update({
        where: { userId },
        data: {
          planId: plan.id,
          status: 'active',
          expiredAt: newExpiry,
        },
      })
    } else {
      // 给漫语会员（标准会员）
      await this.prisma.userMembership.create({
        data: {
          userId,
          planId: plan.id,
          status: 'active',
          expiredAt: new Date(now.getTime() + days * 86400000),
        },
      })
    }
  }
}
