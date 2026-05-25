import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateCosPolicyDto } from './dto/create-cos-policy.dto';
import { CreateReferenceDto } from './dto/create-reference.dto';
import { DeleteReferenceDto } from './dto/delete-reference.dto';
import { FileAssetsService } from './file-assets.service';
import { SetCurrentAvatarDto } from './dto/set-current-avatar.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('file-assets')
export class FileAssetsController {
  constructor(private readonly fileAssetsService: FileAssetsService) {}

  @Post('cos-policy')
  createCosPolicy(@Body() dto: CreateCosPolicyDto) {
    return this.fileAssetsService.createCosPolicy(dto);
  }

  @Post('complete')
  completeUpload(@Body() dto: CompleteUploadDto) {
    return this.fileAssetsService.completeUpload(dto);
  }

  @Post('references')
  async createReference(@Req() req: Request, @Body() dto: CreateReferenceDto) {
    const session = await requireAuthSession(req);
    return this.fileAssetsService.createReference(session.user.id, dto);
  }

  @Delete('references')
  async deleteReference(@Req() req: Request, @Body() dto: DeleteReferenceDto) {
    const session = await requireAuthSession(req);
    return this.fileAssetsService.deleteReference(session.user.id, dto);
  }

  @Get('avatar/current')
  async getCurrentAvatar(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.fileAssetsService.getCurrentAvatar(session.user.id);
  }

  @Post('avatar/current')
  async setCurrentAvatar(@Req() req: Request, @Body() dto: SetCurrentAvatarDto) {
    const session = await requireAuthSession(req);
    return this.fileAssetsService.setCurrentAvatar(session.user.id, dto);
  }

  @Get(':id/private-url')
  getPrivateUrl(@Param('id') id: string) {
    return this.fileAssetsService.getPrivateUrlByAssetId(id);
  }

  @Get(':id/references')
  listReferences(@Param('id') id: string) {
    return this.fileAssetsService.listReferences(id);
  }
}
