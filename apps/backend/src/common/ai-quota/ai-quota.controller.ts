import { Controller, Get, Post, Body, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AiQuotaService } from './ai-quota.service';
import { requireAuthSession } from '../../modules/auth/session.util';

@Controller('ai-quota')
export class AiQuotaController {
  constructor(private readonly quotaService: AiQuotaService) {}

  /** 获取当前配额状态 */
  @Get('status')
  async getStatus(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.quotaService.getStatus(session.user.id);
  }

  /** 积分兑换 AI 次数 */
  @Post('exchange')
  async exchange(
    @Req() req: Request,
    @Body() body: { type: 'feedback' | 'dialogue' | 'summary' },
    @Res() res: Response,
  ) {
    const session = await requireAuthSession(req);
    const result = await this.quotaService.exchangeByPoints(session.user.id, body.type);
    if (!result.success) {
      return res.status(400).json({ code: 400, message: result.message, data: null });
    }
    return { code: 200, message: result.message, data: null };
  }
}
