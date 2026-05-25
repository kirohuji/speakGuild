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
      },
    })

    await this.prisma.referralCode.update({
      where: { id: referrerCode.id },
      data: { totalInvited: { increment: 1 }, totalReward: { increment: 3 } },
    })

    // 给邀请人加3天会员
    await this.grantTrialDays(referrerCode.userId, 3)
    // 给被邀请人也加3天
    await this.grantTrialDays(referredUserId, 3)

    return referral
  }

  private async grantTrialDays(userId: string, days: number) {
    const membership = await this.prisma.userMembership.findUnique({ where: { userId } })
    const now = new Date()
    if (membership) {
      const newExpiry = new Date(
        Math.max(membership.expiredAt.getTime(), now.getTime()) + days * 86400000,
      )
      await this.prisma.userMembership.update({
        where: { userId },
        data: { expiredAt: newExpiry },
      })
    } else {
      // 给一个默认的免费会员延期
      const freePlan = await this.prisma.membershipPlan.findFirst({
        where: { level: 'free' },
      })
      if (freePlan) {
        await this.prisma.userMembership.create({
          data: {
            userId,
            planId: freePlan.id,
            status: 'active',
            expiredAt: new Date(now.getTime() + days * 86400000),
          },
        })
      }
    }
  }
}
