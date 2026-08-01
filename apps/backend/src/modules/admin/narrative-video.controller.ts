import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { AdminTasksService } from '../admin-tasks/admin-tasks.service';
import { FileAssetsService } from '../file-assets/file-assets.service';

class RenderNarrativeVideoDto {
  frames!: Record<string, unknown>[];
}

@Controller('admin/narrative-video')
export class NarrativeVideoController {
  constructor(
    private readonly adminTasksService: AdminTasksService,
    private readonly fileAssetsService: FileAssetsService,
  ) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  @Post('render')
  async render(
    @Req() req: Request,
    @Body() body: RenderNarrativeVideoDto,
  ) {
    const session = await this.requireAdmin(req);
    const task = await this.adminTasksService.enqueueNarrativeVideo(
      session.user.id,
      body.frames,
    );
    return { taskId: task.id };
  }

  @Get('render/:taskId/status')
  async renderStatus(
    @Req() req: Request,
    @Param('taskId') taskId: string,
  ) {
    await this.requireAdmin(req);
    const task = await this.adminTasksService.getNarrativeVideoTask(taskId);
    const result: any = {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      currentStep: task.currentStep,
      errorMessage: task.errorMessage,
      finishedAt: task.finishedAt,
    };

    // When completed, resolve the video download URL
    if (task.status === 'completed' && task.summary) {
      const summary = task.summary as { videoAssetId?: string };
      if (summary.videoAssetId) {
        try {
          const { url } = await this.fileAssetsService.getPrivateUrlByAssetId(summary.videoAssetId);
          result.videoUrl = url;
        } catch {
          // URL generation may fail if asset was cleaned up
        }
      }
    }

    return result;
  }
}
