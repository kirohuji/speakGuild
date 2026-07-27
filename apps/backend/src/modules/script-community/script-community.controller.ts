import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { requireAuthSession } from '../auth/session.util'
import {
  CompleteScriptPracticeDto,
  CreateScriptWorkDto,
  RenderScriptWorkDto,
  ScriptReactionDto,
  ScriptReportDto,
  UpdateScriptWorkDto,
} from './dto/script-community.dto'
import { ScriptCommunityService } from './script-community.service'

@Controller('scripts')
export class ScriptCommunityController {
  constructor(private readonly service: ScriptCommunityService) {}

  @Post('episodes/:episodeId/records')
  async completeRecord(
    @Req() req: Request,
    @Param('episodeId') episodeId: string,
    @Body() body: CompleteScriptPracticeDto,
  ) {
    const session = await requireAuthSession(req)
    return this.service.completeRecord(session.user.id, episodeId, body)
  }

  @Get('records/mine')
  async myRecords(
    @Req() req: Request,
    @Query('mode') mode?: 'vn' | 'repeat',
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const session = await requireAuthSession(req)
    return this.service.myRecords(session.user.id, {
      mode,
      cursor,
      limit: Number(limit) || 20,
    })
  }

  @Post('works')
  async createWork(@Req() req: Request, @Body() body: CreateScriptWorkDto) {
    const session = await requireAuthSession(req)
    return this.service.createWork(session.user.id, body)
  }

  @Get('works/mine')
  async myWorks(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const session = await requireAuthSession(req)
    return this.service.myWorks(session.user.id, cursor, Number(limit) || 20)
  }

  @Patch('works/:id')
  async updateWork(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateScriptWorkDto) {
    const session = await requireAuthSession(req)
    return this.service.updateWork(session.user.id, id, body)
  }

  @Post('works/:id/publish')
  async publishWork(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.service.publishWork(session.user.id, id)
  }

  @Post('works/:id/render')
  async renderWork(@Req() req: Request, @Param('id') id: string, @Body() body: RenderScriptWorkDto) {
    const session = await requireAuthSession(req)
    return this.service.requestRender(session.user.id, id, body.frames)
  }

  @Get('works/:id/render-status')
  async renderStatus(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.service.renderStatus(session.user.id, id)
  }

  @Post('works/:id/unpublish')
  async unpublishWork(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.service.unpublishWork(session.user.id, id)
  }

  @Delete('works/:id')
  async deleteWork(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.service.deleteWork(session.user.id, id)
  }

  @Get('square/feed')
  async feed(
    @Req() req: Request,
    @Query('type') type?: 'all' | 'vn' | 'repeat' | 'progress',
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const session = await requireAuthSession(req)
    return this.service.feed(session.user.id, {
      type: type ?? 'all',
      cursor,
      limit: Number(limit) || 20,
    })
  }

  @Post('works/:id/like')
  async like(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.service.like(session.user.id, id)
  }

  @Delete('works/:id/like')
  async unlike(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.service.unlike(session.user.id, id)
  }

  @Put('works/:id/reaction')
  async react(@Req() req: Request, @Param('id') id: string, @Body() body: ScriptReactionDto) {
    const session = await requireAuthSession(req)
    return this.service.react(session.user.id, id, body.reaction)
  }

  @Delete('works/:id/reaction')
  async removeReaction(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.service.removeReaction(session.user.id, id)
  }

  @Post('works/:id/report')
  async report(@Req() req: Request, @Param('id') id: string, @Body() body: ScriptReportDto) {
    const session = await requireAuthSession(req)
    return this.service.report(session.user.id, id, body)
  }
}
