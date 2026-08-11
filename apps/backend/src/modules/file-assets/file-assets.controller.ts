import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateCosPolicyDto } from './dto/create-cos-policy.dto';
import { CreateReferenceDto } from './dto/create-reference.dto';
import { FileAssetsService } from './file-assets.service';
import { SetCurrentAvatarDto } from './dto/set-current-avatar.dto';
import { MatchSamplingToneDto } from './dto/match-sampling-tone.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('file-assets')
export class FileAssetsController {
  constructor(private readonly fileAssetsService: FileAssetsService) {}

  @Post('cos-policy')
  async createCosPolicy(@Req() req: Request, @Body() dto: CreateCosPolicyDto) {
    await requireAuthSession(req);
    return this.fileAssetsService.createCosPolicy(dto);
  }

  @Post('complete')
  async completeUpload(@Req() req: Request, @Body() dto: CompleteUploadDto) {
    await requireAuthSession(req);
    return this.fileAssetsService.completeUpload(dto);
  }

  @Post('references')
  async createReference(@Req() req: Request, @Body() dto: CreateReferenceDto) {
    const session = await requireAuthSession(req);
    return this.fileAssetsService.createReference(session.user.id, dto);
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

  @Post('sampling/match')
  async matchSamplingTone(
    @Req() req: Request,
    @Body() dto: MatchSamplingToneDto,
  ) {
    await requireAuthSession(req);
    return this.fileAssetsService.matchSamplingTone(dto);
  }

  /**
   * Permanent application URL for browser/media elements. Never cache the
   * redirect itself because its COS Location contains an expiring signature.
   */
  @Get(':id/content')
  async getStableContent(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const asset = await this.fileAssetsService.getPrivateUrlByAssetId(id);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    // Helmet defaults to same-origin, but the frontend and API use different
    // origins in development and may also do so in native/production builds.
    // This response only redirects to an already-authorized COS object.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.redirect(302, asset.url);
  }

  @Get(':id/private-url')
  async getPrivateUrl(@Req() req: Request, @Param('id') id: string) {
    await requireAuthSession(req);
    return this.fileAssetsService.getPrivateUrlByAssetId(id);
  }

  @Get('sampling/proxy')
  async proxyForSampling(
    @Req() req: Request,
    @Res() res: Response,
    @Query('url') url: string,
  ) {
    await requireAuthSession(req);
    const upstream = await this.fileAssetsService.fetchAssetForSampling(
      url,
      req.headers.range,
    );
    res.status(upstream.status);
    for (const header of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body as any).pipe(res);
  }

}
