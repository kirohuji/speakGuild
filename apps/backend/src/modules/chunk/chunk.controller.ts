import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ChunkService } from './chunk.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('chunks')
export class ChunkController {
  constructor(private readonly chunkService: ChunkService) {}

  @Get()
  async getChunks(@Query('sceneId') sceneId?: string) {
    if (sceneId) {
      return this.chunkService.getChunksByScene(sceneId);
    }
    return [];
  }

  @Get('my')
  async getMyChunks(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.chunkService.getMyChunks(session.user.id);
  }

  @Post(':id/activate')
  async activate(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.chunkService.activateChunk(session.user.id, id);
  }

  @Post(':id/read')
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.chunkService.markRead(session.user.id, id);
  }

  @Post(':id/output')
  async markOutput(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('sceneId') sceneId?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.chunkService.markOutput(session.user.id, id, sceneId);
  }

  @Post(':id/master')
  async markMastered(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.chunkService.markMastered(session.user.id, id);
  }
}
