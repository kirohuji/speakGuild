import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SceneService } from './scene.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('scenes')
export class SceneController {
  constructor(private readonly sceneService: SceneService) {}

  @Get('categories')
  async getCategories() {
    return this.sceneService.getCategories();
  }

  @Get()
  async getScenes() {
    // Alias for categories; includes all scenes
    return this.sceneService.getCategories();
  }

  @Get(':id')
  async getSceneDetail(@Param('id') id: string) {
    return this.sceneService.getSceneDetail(id);
  }

  @Get(':id/readiness')
  async getSceneReadiness(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.sceneService.getSceneReadiness(session.user.id, id);
  }
}
