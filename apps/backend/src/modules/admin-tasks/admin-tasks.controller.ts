import { Controller, Get, Param, Post, Query, Req, ForbiddenException } from '@nestjs/common';
import { AdminTaskStatus } from '@prisma/client';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { PRONUNCIATION_AUDIT_FILTERS, type PronunciationAuditFilter } from '../dictionary/dto/pronunciation-audit.dto';
import { AdminTasksService } from './admin-tasks.service';

@Controller('admin/tasks')
export class AdminTasksController {
  constructor(private readonly adminTasksService: AdminTasksService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  /** 队列状态总览 —— 必须在 :id 路由之前定义，避免 "queues" 被当作 task id */
  @Get('queues/status')
  async getQueuesStatus(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminTasksService.getQueuesStatus();
  }

  /** 从音标审查页创建当前 100 个单词的后台更新任务。 */
  @Post('dictionary-pronunciations/refresh-current-page')
  async refreshDictionaryPronunciations(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
  ) {
    const session = await this.requireAdmin(req);
    const auditFilter: PronunciationAuditFilter = PRONUNCIATION_AUDIT_FILTERS.includes(filter as PronunciationAuditFilter)
      ? filter as PronunciationAuditFilter
      : 'all';
    return this.adminTasksService.enqueueDictionaryPronunciationBatchRefresh(session.user.id, {
      page: page ? Number(page) : 1,
      search,
      filter: auditFilter,
    });
  }

  /** Generate every missing UK/US audio asset on the current audit page. */
  @Post('dictionary-pronunciations/generate-current-page-audio')
  async generateDictionaryPageAudio(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
  ) {
    const session = await this.requireAdmin(req);
    const auditFilter: PronunciationAuditFilter = PRONUNCIATION_AUDIT_FILTERS.includes(filter as PronunciationAuditFilter)
      ? filter as PronunciationAuditFilter
      : 'all';
    return this.adminTasksService.enqueueDictionaryAudioBatch(session.user.id, {
      page: page ? Number(page) : 1,
      search,
      filter: auditFilter,
    });
  }

  /** Fill missing vocabulary example-sentence audio on the current content-library page. */
  @Post('library-vocabularies/generate-current-page-example-audio')
  async generateVocabularyExamplePageAudio(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('matchType') matchType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('pronunciationStatus') pronunciationStatus?: string,
    @Query('qualityIssue') qualityIssue?: string,
    @Query('tag') tag?: string,
  ) {
    const session = await this.requireAdmin(req);
    return this.adminTasksService.enqueueVocabularyExampleAudioBatch(session.user.id, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search,
      matchType: matchType === 'exact' ? 'exact' : 'fuzzy',
      difficulty,
      pronunciationStatus: pronunciationStatus as any,
      qualityIssue: qualityIssue as any,
      tag,
    });
  }

  /** 查看某个队列中等待/活跃的任务 */
  @Get('queues/:queueName/jobs')
  async getQueueJobs(
    @Req() req: Request,
    @Param('queueName') queueName: string,
    @Query('statuses') statuses?: string,
  ) {
    await this.requireAdmin(req);
    const statusList = statuses
      ? statuses.split(',').map(s => s.trim()).filter(Boolean)
      : ['waiting', 'active', 'delayed'];
    return this.adminTasksService.getQueueJobs(queueName, statusList);
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('type') type?: string,
    @Query('status') status?: AdminTaskStatus,
    @Query('statuses') statuses?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    return this.adminTasksService.list({
      type,
      status,
      statuses: statuses
        ? (statuses.split(',').map((s) => s.trim()).filter(Boolean) as AdminTaskStatus[])
        : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.adminTasksService.get(id);
  }

  @Post(':id/retry')
  async retry(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.adminTasksService.retry(id, session.user.id);
  }

  @Post(':id/cancel')
  async cancel(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.adminTasksService.cancel(id);
  }

  /** 插队：把排队中的任务提到队列最前面 */
  @Post(':id/prioritize')
  async prioritize(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.adminTasksService.prioritizeTask(id);
  }

  /** 强制执行：立即执行一个排队中或失败的任务（绕过排队） */
  @Post(':id/force-run')
  async forceRun(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.adminTasksService.forceRunTask(id, session.user.id);
  }
}
