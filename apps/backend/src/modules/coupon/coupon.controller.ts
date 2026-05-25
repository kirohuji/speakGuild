import { Controller, Get, Post, Patch, Body, Param, Query, Req, ForbiddenException } from '@nestjs/common'
import type { Request } from 'express'
import { CouponService } from './coupon.service'
import { requireAuthSession } from '../auth/session.util'

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.couponService.findAll(Number(page) || 1, Number(pageSize) || 20, keyword)
  }

  @Post()
  async create(@Req() req: Request, @Body() body: {
    code: string; type: string; value: number
    minAmount?: number; maxUses?: number; validFrom?: string; validUntil?: string
  }) {
    const session = await requireAuthSession(req)
    if ((session.user as any)?.role !== 'admin') throw new ForbiddenException('仅管理员可创建优惠券')
    return this.couponService.create(body)
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: {
    isActive?: boolean; maxUses?: number; validUntil?: string
  }) {
    const session = await requireAuthSession(req)
    if ((session.user as any)?.role !== 'admin') throw new ForbiddenException('仅管理员可管理优惠券')
    return this.couponService.update(id, body)
  }

  @Post('validate')
  async validate(@Req() req: Request, @Body() body: { code: string; amount: number }) {
    await requireAuthSession(req)
    return this.couponService.validate(body.code, body.amount)
  }
}
