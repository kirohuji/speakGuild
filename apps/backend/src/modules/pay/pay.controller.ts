import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PayService } from './pay.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { requireAuthSession } from '../auth/session.util';
import { RevenueCatService } from './revenuecat/revenuecat.service';
import { OpsAlertService } from '../../common/ops/ops-alert.service';

@Controller('pay')
export class PayController {
  constructor(
    private readonly payService: PayService,
    private readonly revenueCatService: RevenueCatService,
    private readonly alerts: OpsAlertService,
  ) {}

  /** 创建支付订单 */
  @Post('orders')
  async createOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const session = await requireAuthSession(req);
    return this.payService.createOrder(session.user.id, dto);
  }

  /** 查询订单状态 */
  @Get('orders/:orderNo')
  async getOrderStatus(@Req() req: Request, @Param('orderNo') orderNo: string) {
    const session = await requireAuthSession(req);
    return this.payService.getOrderStatus(orderNo, session.user.id);
  }

  /** 支付宝异步回调 */
  @Post('callback/alipay')
  async alipayCallback(@Req() req: Request, @Res() res: Response) {
    const params = req.body;
    const result = await this.payService.handleCallback('alipay', params);
    if (result.success) {
      res.send('success');
    } else {
      res.send('fail');
    }
  }

  /** 微信支付异步回调 */
  @Post('callback/wechat')
  async wechatCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.payService.handleCallback('wechat', {
      body: req.body,
      headers: req.headers,
    });

    if (result.success) {
      res.status(200).json({ code: 'SUCCESS', message: 'OK' });
    } else {
      res.status(500).json({ code: 'FAIL', message: '验证失败' });
    }
  }

  /** RevenueCat 订阅事件回调 */
  @Post('revenuecat/webhook')
  async revenueCatWebhook(@Req() req: Request, @Body() body: any) {
    try {
      this.revenueCatService.verifyWebhookAuthorization(req.headers.authorization);
      return await this.revenueCatService.handleWebhook(body);
    } catch (error) {
      await this.alerts.notify({
        key: 'revenuecat-webhook-failed',
        title: 'RevenueCat webhook 处理失败',
        severity: 'critical',
        details: {
          message: error instanceof Error ? error.message : String(error),
          eventType: body?.event?.type,
          appUserId: body?.event?.app_user_id,
        },
      });
      throw error;
    }
  }

  /** Mock: 模拟支付成功（开发环境用） */
  @Post('mock-confirm/:orderNo')
  async mockPayConfirm(@Req() req: Request, @Param('orderNo') orderNo: string) {
    await requireAuthSession(req);
    return this.payService.mockPayConfirm(orderNo);
  }
}
