import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { ContentExperienceService } from './content-experience.service';
import {
  AssignPackageGroupDto,
  AttachEpubDto,
  CreatePackageGroupDto,
  UpdatePackageGroupDto,
  UpdateSceneKnowledgeDto,
} from './dto/content-experience.dto';

@Controller('admin/content-experiences')
export class AdminContentExperienceController {
  constructor(private readonly experiences: ContentExperienceService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') throw new ForbiddenException('需要管理员权限');
  }

  @Get('groups')
  async listGroups(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.experiences.listGroups();
  }

  @Post('groups')
  async createGroup(@Req() req: Request, @Body() dto: CreatePackageGroupDto) {
    await this.requireAdmin(req);
    return this.experiences.createGroup(dto);
  }

  @Patch('groups/:id')
  async updateGroup(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdatePackageGroupDto) {
    await this.requireAdmin(req);
    return this.experiences.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  async deleteGroup(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.experiences.deleteGroup(id);
  }

  @Get('scenes/:sceneId')
  async getScene(@Req() req: Request, @Param('sceneId') sceneId: string) {
    await this.requireAdmin(req);
    return this.experiences.getSceneExperienceAdmin(sceneId);
  }

  @Put('scenes/:sceneId/group')
  async assignGroup(
    @Req() req: Request,
    @Param('sceneId') sceneId: string,
    @Body() dto: AssignPackageGroupDto,
  ) {
    await this.requireAdmin(req);
    return this.experiences.assignSceneGroup(sceneId, dto);
  }

  @Put('scenes/:sceneId/knowledge')
  async updateKnowledge(
    @Req() req: Request,
    @Param('sceneId') sceneId: string,
    @Body() dto: UpdateSceneKnowledgeDto,
  ) {
    await this.requireAdmin(req);
    return this.experiences.updateSceneKnowledge(sceneId, dto);
  }

  @Post('scenes/:sceneId/epub')
  async attachEpub(
    @Req() req: Request,
    @Param('sceneId') sceneId: string,
    @Body() dto: AttachEpubDto,
  ) {
    await this.requireAdmin(req);
    return this.experiences.attachEpub(sceneId, dto.assetId);
  }
}
