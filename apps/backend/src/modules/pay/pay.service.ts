import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AlipayProvider } from './providers/alipay.provider';
import { WechatProvider } from './providers/wechat.provider';
import { RevenueCatService } from './revenuecat/revenuecat.service';
import type { PaymentProvider, CallbackVerification } from './providers/payment-provider.interface';
import type { CreateOrderDto, OrderResult } from './dto/create-order.dto';

@Injectable()
export class PayService {
  private readonly logger = new Logger(PayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alipayProvider: AlipayProvider,
    private readonly wechatProvider: WechatProvider,
    private readonly revenueCatService: RevenueCatService,
  ) {}

  private getProvider(method: string): PaymentProvider {
    if (method === 'alipay') return this.alipayProvider;
    if (method === 'wechat') return this.wechatProvider;
    throw new BadRequestException(`不支持的支付方式: ${method}`);
  }

  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderResult> {
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('套餐不存在');
    }

    const isYearly = dto.billingCycle === 'yearly';
    const amount = isYearly && plan.yearlyPrice ? plan.yearlyPrice : plan.price;
    const durationDays = isYearly ? 365 : plan.durationDays;

    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNo = `ECHOON${timestamp}${random}`;

    const order = await this.prisma.order.create({
      data: {
        orderNo,
        userId,
        planId: plan.id,
        amount,
        paymentMethod: dto.paymentMethod,
        billingCycle: dto.billingCycle,
        status: 'pending',
      },
    });

    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const notifyUrl = `${baseUrl}/api/pay/callback/${dto.paymentMethod}`;
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/member?orderNo=${orderNo}`;

    const provider = this.getProvider(dto.paymentMethod);
    const result = await provider.createPayment({
      orderNo,
      amount,
      subject: `${plan.name} - ${isYearly ? '年付' : '月付'}`,
          body: `guideready 会员 - ${plan.name}`,
      notifyUrl,
      returnUrl,
    });

    if (!result.success) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'cancelled' },
      });
      throw new BadRequestException('创建支付订单失败，请稍后重试');
    }

    return {
      orderNo: order.orderNo,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      payUrl: result.payUrl,
      qrCode: result.qrCode,
      status: order.status,
    };
  }

  async handleCallback(method: string, params: Record<string, any>) {
    const provider = this.getProvider(method);

    let verification: CallbackVerification;
    try {
      verification = await provider.verifyCallback(params);
    } catch (error) {
      this.logger.error('支付回调验证异常', error);
      return { success: false };
    }

    if (!verification.success || !verification.orderNo) {
      this.logger.warn(`支付回调验证失败: ${JSON.stringify(params)}`);
      return { success: false };
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNo: verification.orderNo },
    });

    if (!order) {
      this.logger.error(`订单未找到: ${verification.orderNo}`);
      return { success: false };
    }

    if (order.status === 'paid') {
      return { success: true };
    }

    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id: order.planId },
    });

    if (!plan) {
      return { success: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paymentRef: verification.paymentRef,
          paidAt: new Date(),
        },
      });

      const isYearly = order.billingCycle === 'yearly';
      const durationDays = isYearly ? 365 : plan.durationDays;
      const now = new Date();

      const existingMembership = await tx.userMembership.findUnique({
        where: { userId: order.userId },
      });

      if (existingMembership && existingMembership.status === 'active' && existingMembership.expiredAt > now) {
        const newExpiry = new Date(existingMembership.expiredAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        await tx.userMembership.update({
          where: { userId: order.userId },
          data: {
            planId: plan.id,
            expiredAt: newExpiry,
            orderId: order.id,
          },
        });
      } else {
        const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        await tx.userMembership.upsert({
          where: { userId: order.userId },
          create: {
            userId: order.userId,
            planId: plan.id,
            status: 'active',
            startedAt: now,
            expiredAt: expiryDate,
            orderId: order.id,
          },
          update: {
            planId: plan.id,
            status: 'active',
            startedAt: now,
            expiredAt: expiryDate,
            orderId: order.id,
            cancelledAt: null,
          },
        });
      }
    });

    if (plan.revenueCatEntitlementId) {
      const isYearly = order.billingCycle === 'yearly';
      const durationDays = isYearly ? 365 : plan.durationDays;
      await this.revenueCatService.grantEntitlement({
        userId: order.userId,
        entitlementId: plan.revenueCatEntitlementId,
        durationDays,
      });
    }

    this.logger.log(`支付成功: orderNo=${verification.orderNo}, userId=${order.userId}, amount=${order.amount}`);
    return { success: true };
  }

  async getOrderStatus(orderNo: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('订单不存在');
    }

    return {
      orderNo: order.orderNo,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      status: order.status,
      paidAt: order.paidAt,
    };
  }

  /** Mock 支付确认 - 开发环境用 */
  async mockPayConfirm(orderNo: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
      include: { plan: true },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return this.handleCallback(order.paymentMethod, {
      out_trade_no: orderNo,
      total_amount: (order.amount / 100).toString(),
      trade_no: `mock_${Date.now()}`,
      amount: order.amount.toString(),
    });
  }

  /** 管理后台测试支付 - 真实调用支付宝生成 1 元订单 */
  async createTestOrder(userId: string): Promise<OrderResult> {
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { level: { not: 'free' } },
      orderBy: { sortOrder: 'asc' },
    });

    if (!plan) {
      throw new NotFoundException('没有可用的付费套餐');
    }

    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNo = `TEST${timestamp}${random}`;

    await this.prisma.order.create({
      data: {
        orderNo,
        userId,
        planId: plan.id,
        amount: 100, // 1 元 = 100 分
        paymentMethod: 'alipay',
        billingCycle: 'monthly',
        status: 'pending',
      },
    });

    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const notifyUrl = `${baseUrl}/api/v1/guide-exam/pay/callback/alipay`;
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/member`;

    const result = await this.alipayProvider.createPayment({
      orderNo,
      amount: 100,
      subject: `[测试] ${plan.name} - 月付`,
          body: `guideready 测试支付 - ${plan.name}`,
      notifyUrl,
      returnUrl,
    });

    if (!result.success) {
      await this.prisma.order.update({
        where: { orderNo },
        data: { status: 'cancelled' },
      });
      throw new BadRequestException('创建支付宝支付失败，请检查支付宝配置');
    }

    this.logger.log(`[Admin测试支付] 已创建真实支付宝订单: ${orderNo}`);

    return {
      orderNo,
      amount: 100,
      paymentMethod: 'alipay',
      payUrl: result.payUrl,
      status: 'pending',
    };
  }
}
