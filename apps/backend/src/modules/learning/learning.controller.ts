import { Controller, Delete, Get, Param, Post, Body, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LearningService } from './learning.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  /** 获取全部教材分类标签（供筛选下拉使用） */
  @Get('tags')
  async getTags(@Query('packageType') packageType?: string) {
    return this.learningService.getTags(packageType);
  }

  /** 获取全部教材（学习单元）列表，支持分页、按分类标签过滤和模糊搜索 */
  @Get('units')
  async getUnits(
    @Req() req: Request,
    @Query('tag') tag?: string,
    @Query('packageType') packageType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const session = await requireAuthSession(req);
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const size = Math.min(50, Math.max(1, parseInt(pageSize || '20', 10) || 20));
    return this.learningService.getLearningUnits(session.user.id, { tag, packageType, search, page: pageNum, pageSize: size });
  }

  /** 获取用户正在学习的单元（有进度记录的） */
  @Get('my-units')
  async getMyUnits(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.learningService.getMyLearningUnits(session.user.id);
  }

  /** 获取学习单元详情（顺序学习内容） */
  @Get('units/:id')
  async getUnitDetail(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.learningService.getLearningUnitDetail(session.user.id, id);
  }

  /** 获取学习包离线 manifest：内容、Ink 与资源引用 */
  @Get('units/:id/offline-manifest')
  async getOfflineManifest(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.learningService.getOfflineManifest(session.user.id, id);
  }

  /** 获取学习包 manifest（zip 内同名文件的预览版本） */
  @Get('units/:id/pack-manifest')
  async getPackManifest(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    const published = await this.learningService.getPublishedLearningPackage(id);
    if (published?.manifestSnapshot) {
      return {
        manifest: published.manifestSnapshot,
        zipChecksum: published.zipChecksum,
        fileName: published.fileAsset?.filename ?? `${published.sceneId}-${published.version}.zip`,
        size: published.zipSize,
        source: 'published',
      };
    }
    const preview = await this.learningService.getOfflineManifest(session.user.id, id);
    return {
      manifest: preview.manifest,
      zipChecksum: null,
      fileName: `${preview.manifest.packId}-${preview.manifest.version}.zip`,
      size: null,
      source: 'dynamic',
    };
  }

  /** 下载学习包 zip。有已发布包时代理 COS 下载（避免 CORS），否则实时生成。 */
  @Get('units/:id/download-pack')
  async downloadPack(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const session = await requireAuthSession(req);
    const published = await this.learningService.getPublishedLearningPackageDownload(id);
    if (published) {
      // 后端代理下载：从 COS 拉取，pipe 给客户端，避免 COS 跨域 CORS 问题
      const cosResponse = await fetch(published.url);
      if (!cosResponse.ok) {
        res.status(502).json({ code: 502, message: 'COS 下载失败', data: null });
        return;
      }
      const buffer = Buffer.from(await cosResponse.arrayBuffer());
      const fileName = `${published.pack.sceneId}-${published.pack.version}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', String(buffer.byteLength));
      res.send(buffer);
      return;
    }
    const pack = await this.learningService.buildLearningPackZip(session.user.id, id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${pack.fileName}"`);
    res.setHeader('Content-Length', String(pack.buffer.byteLength));
    res.setHeader('X-Learning-Pack-Checksum', pack.checksum);
    res.send(pack.buffer);
  }

  /** 检查已安装学习包是否有新版本。V2 支持全量+增量。 */
  @Post('packs/check')
  async checkPacks(
    @Req() req: Request,
    @Body() body: { installed?: Array<{ packId: string; version?: number }> },
  ) {
    const session = await requireAuthSession(req);
    return this.learningService.checkLearningPacks(session.user.id, body.installed ?? []);
  }

  /** V2: 下载 delta 增量包 */
  @Get('units/:id/download-delta')
  async downloadDelta(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('from') fromVersion: string,
    @Query('to') toVersion: string,
    @Res() res: Response,
  ) {
    const session = await requireAuthSession(req);
    const delta = await (this.learningService as any).getDeltaPackage(id, Number(fromVersion), Number(toVersion));
    if (!delta) {
      res.status(404).json({ code: 404, message: 'Delta not found', data: null });
      return;
    }
    const response = await fetch(delta.url);
    if (!response.ok) {
      res.status(502).json({ code: 502, message: 'COS download failed', data: null });
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="delta-v${fromVersion}-v${toVersion}.zip"`);
    res.setHeader('Content-Length', String(buffer.byteLength));
    res.send(buffer);
  }

  /** 获取今日任务 */
  @Get('today')
  async getTodayTasks(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.learningService.getTodayTasks(session.user.id);
  }

  /** 更新学习单元进度 */
  @Post('units/:id/progress')
  async updateProgress(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: {
      vocabLearned?: number;
      chunkMastered?: number;
      completedPractice?: boolean;
      completedScript?: boolean;
    },
  ) {
    const session = await requireAuthSession(req);
    return this.learningService.updateUnitProgress(session.user.id, id, body);
  }

  /** 开始学习一个单元 */
  @Post('units/:id/start')
  async startUnit(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.learningService.startUnit(session.user.id, id);
  }

  /** 退出学习一个单元 */
  @Delete('units/:id')
  async quitUnit(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.learningService.quitUnit(session.user.id, id);
  }
}
