import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import type { Prisma } from '@prisma/client'

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 20, keyword?: string) {
    const where: Prisma.CouponWhereInput = {}
    if (keyword) {
      where.code = { contains: keyword.toUpperCase(), mode: 'insensitive' }
    }
    const skip = (page - 1) * pageSize
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      this.prisma.coupon.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async create(data: {
    code: string
    type: string
    value: number
    minAmount?: number
    maxUses?: number
    validFrom?: string
    validUntil?: string
  }) {
    return this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        type: data.type as any,
        value: data.value,
        minAmount: data.minAmount,
        maxUses: data.maxUses,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      },
    })
  }

  async update(id: string, data: {
    isActive?: boolean
    maxUses?: number
    validUntil?: string
  }) {
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
        ...(data.validUntil && { validUntil: new Date(data.validUntil) }),
      },
    })
  }

  async validate(code: string, amount: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
    if (!coupon) throw new BadRequestException('优惠码不存在')
    if (!coupon.isActive) throw new BadRequestException('优惠码已失效')
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
      throw new BadRequestException('优惠码已用完')
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date())
      throw new BadRequestException('优惠码已过期')
    if (coupon.minAmount && amount < coupon.minAmount)
      throw new BadRequestException(`订单金额不满足最低消费 ¥${(coupon.minAmount / 100).toFixed(2)}`)

    let discount = 0
    if (coupon.type === 'percentage') {
      discount = Math.round(amount * (coupon.value / 100))
    } else if (coupon.type === 'fixed') {
      discount = Math.min(coupon.value, amount)
    }

    return { coupon, discount, finalAmount: amount - discount }
  }
}
