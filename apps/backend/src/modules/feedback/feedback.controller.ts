import { Controller, Get, Post, Patch, Body, Param, Query, Req, ForbiddenException } from '@nestjs/common'
import type { Request } from 'express'
import { FeedbackService } from './feedback.service'
import { requireAuthSession } from '../auth/session.util'

@Controller('feedbacks')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async submit(@Req() req: Request, @Body() body: { type: string; content: string; contact?: string }) {
    const session = await requireAuthSession(req)
    return this.feedbackService.create({
      userId: session.user.id,
      type: body.type,
      content: body.content,
      contact: body.contact,
    })
  }

  @Get('mine')
  async myFeedbacks(@Req() req: Request, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const session = await requireAuthSession(req)
    return this.feedbackService.findByUser(session.user.id, Number(page) || 1, Number(pageSize) || 20)
  }

  @Get()
  async list(@Req() req: Request, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const session = await requireAuthSession(req)
    if ((session.user as any)?.role !== 'admin') throw new ForbiddenException('仅管理员可查看所有反馈')
    return this.feedbackService.findAll({ status, page: Number(page) || 1, pageSize: Number(pageSize) || 20 })
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: { status: string; adminNote?: string }) {
    const session = await requireAuthSession(req)
    if ((session.user as any)?.role !== 'admin') throw new ForbiddenException('仅管理员可处理反馈')
    return this.feedbackService.updateStatus(id, body.status, body.adminNote)
  }

  /** 管理员回复反馈，自动发送通知给用户 */
  @Post(':id/reply')
  async reply(@Req() req: Request, @Param('id') id: string, @Body() body: { adminNote: string }) {
    const session = await requireAuthSession(req)
    if ((session.user as any)?.role !== 'admin') throw new ForbiddenException('仅管理员可回复反馈')
    return this.feedbackService.reply(session.user.id, id, body.adminNote)
  }
}
