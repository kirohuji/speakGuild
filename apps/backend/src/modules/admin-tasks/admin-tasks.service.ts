import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminTaskLogLevel, AdminTaskStatus, Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ADMIN_CONTENT_QUEUE, CONTENT_PREPARE_JOB, SCRIPT_VIDEO_QUEUE, SCRIPT_VIDEO_RENDER_JOB } from './admin-tasks.constants';

@Injectable()
export class AdminTasksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ADMIN_CONTENT_QUEUE) private readonly contentQueue: Queue,
    @InjectQueue(SCRIPT_VIDEO_QUEUE) private readonly videoQueue: Queue,
  ) {}

  async enqueueScriptVideo(workId: string, userId: string, frames: unknown[]) {
    const work = await this.prisma.scriptWork.findFirst({
      where: { id: workId, userId },
      select: { id: true, title: true },
    });
    if (!work) throw new NotFoundException('作品不存在');
    const task = await this.prisma.adminTask.create({
      data: {
        type: SCRIPT_VIDEO_RENDER_JOB,
        title: `生成剧本视频：${work.title}`,
        targetType: 'script_work',
        targetId: work.id,
        createdById: userId,
        totalItems: frames.length,
        payload: { workId, userId, frames } as Prisma.InputJsonValue,
      },
    });
    const job = await this.videoQueue.add(SCRIPT_VIDEO_RENDER_JOB, { taskId: task.id, workId, userId, frames });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '视频任务已加入 Redis 队列', { step: 'queued' });
    return task;
  }

  async cancelScriptVideoTasks(
    workId: string,
    userId: string,
    reason = '已被新的生成任务替代',
    includeCompleted = true,
  ) {
    const tasks = await this.prisma.adminTask.findMany({
      where: {
        type: SCRIPT_VIDEO_RENDER_JOB,
        targetType: 'script_work',
        targetId: workId,
        createdById: userId,
        status: {
          in: [
            AdminTaskStatus.queued,
            AdminTaskStatus.running,
            ...(includeCompleted ? [AdminTaskStatus.completed] : []),
          ],
        },
      },
      select: { id: true, bullJobId: true },
    });

    for (const task of tasks) {
      if (task.bullJobId) {
        try {
          const job = await this.videoQueue.getJob(task.bullJobId);
          if (job) await job.remove();
        } catch {
          // Active BullMQ jobs cannot be removed. The processor checks the
          // persisted canceled state before uploading or publishing its output.
        }
      }
      await this.prisma.adminTask.update({
        where: { id: task.id },
        data: {
          status: AdminTaskStatus.canceled,
          currentStep: 'canceled',
          errorMessage: reason,
          finishedAt: new Date(),
        },
      });
      await this.log(task.id, 'warn', reason, { step: 'canceled' });
    }
  }

  async isCanceled(taskId: string) {
    const task = await this.prisma.adminTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
    return task?.status === AdminTaskStatus.canceled;
  }

  async enqueueContentPrepare(sceneId: string, createdById?: string, options?: {
    retryOfTaskId?: string;
    retryItems?: {
      vocabulary?: string[];
      chunk?: string[];
      pattern?: string[];
    };
  }) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { id: true, title: true },
    });
    if (!scene) throw new NotFoundException('学习包不存在');

    const task = await this.prisma.adminTask.create({
      data: {
        type: CONTENT_PREPARE_JOB,
        title: `准备学习包内容：${scene.title}`,
        targetType: 'scene',
        targetId: scene.id,
        createdById,
        payload: {
          sceneId: scene.id,
          retryOfTaskId: options?.retryOfTaskId,
          retryItems: options?.retryItems,
        },
      },
    });

    const job = await this.contentQueue.add(CONTENT_PREPARE_JOB, {
      taskId: task.id,
      sceneId: scene.id,
      retryItems: options?.retryItems,
    });

    await this.prisma.adminTask.update({
      where: { id: task.id },
      data: { bullJobId: job.id },
    });
    await this.log(task.id, 'info', '任务已加入后台队列', { step: 'queued' });

    return { ...task, bullJobId: job.id };
  }

  async list(params: {
    type?: string;
    status?: AdminTaskStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.AdminTaskWhereInput = {
      ...(params.type ? { type: params.type } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.adminTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adminTask.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async get(id: string) {
    const task = await this.prisma.adminTask.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
  }

  async retry(id: string, createdById?: string) {
    const task = await this.prisma.adminTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.type === SCRIPT_VIDEO_RENDER_JOB && task.targetId) {
      const payload = task.payload as any;
      return this.enqueueScriptVideo(task.targetId, payload?.userId || createdById, payload?.frames || []);
    }
    if (task.type !== CONTENT_PREPARE_JOB || task.targetType !== 'scene' || !task.targetId) {
      throw new NotFoundException('暂不支持重试该任务');
    }
    const retryItems = this.extractRetryItems(task.summary);
    return this.enqueueContentPrepare(task.targetId, createdById, {
      retryOfTaskId: task.id,
      retryItems: retryItems.total > 0 ? retryItems.items : undefined,
    });
  }

  async cancel(id: string) {
    const task = await this.prisma.adminTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.status !== 'queued' && task.status !== 'running') {
      throw new NotFoundException('只能取消排队中或执行中的任务');
    }

    // 从 BullMQ 队列中移除任务
    if (task.bullJobId) {
      try {
        const queue = task.type === SCRIPT_VIDEO_RENDER_JOB ? this.videoQueue : this.contentQueue;
        const job = await queue.getJob(task.bullJobId);
        if (job) {
          await job.remove();
        }
      } catch {
        // 任务可能已经不存在于队列中，忽略错误
      }
    }

    await this.prisma.adminTask.update({
      where: { id },
      data: {
        status: AdminTaskStatus.canceled,
        finishedAt: new Date(),
        errorMessage: '任务已被管理员取消',
      },
    });
    await this.log(id, 'warn', '任务已被管理员取消', { step: 'canceled' });

    return this.get(id);
  }

  async markRunning(taskId: string, currentStep = 'scan') {
    await this.prisma.adminTask.update({
      where: { id: taskId },
      data: {
        status: AdminTaskStatus.running,
        currentStep,
        startedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async setProgress(taskId: string, data: {
    currentStep?: string;
    totalItems?: number;
    processedItems?: number;
    successItems?: number;
    failedItems?: number;
  }) {
    const totalItems = data.totalItems ?? 0;
    const processedItems = data.processedItems ?? 0;
    const progress = totalItems > 0 ? Math.min(99, Math.floor((processedItems / totalItems) * 100)) : 0;
    await this.prisma.adminTask.update({
      where: { id: taskId },
      data: {
        ...data,
        progress,
      },
    });
  }

  async markCompleted(taskId: string, summary: unknown) {
    await this.prisma.adminTask.update({
      where: { id: taskId },
      data: {
        status: AdminTaskStatus.completed,
        progress: 100,
        currentStep: 'completed',
        summary: summary as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  }

  async markFailed(taskId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await this.prisma.adminTask.update({
      where: { id: taskId },
      data: {
        status: AdminTaskStatus.failed,
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    await this.log(taskId, 'error', message, { step: 'failed' });
  }

  private extractRetryItems(summary: unknown) {
    const items = {
      vocabulary: [] as string[],
      chunk: [] as string[],
      pattern: [] as string[],
    };
    const errors = (summary as any)?.errors;
    if (!Array.isArray(errors)) return { items, total: 0 };

    for (const error of errors) {
      if (!error?.id || typeof error.id !== 'string') continue;
      if (error.type === 'vocabulary') items.vocabulary.push(error.id);
      if (error.type === 'chunk') items.chunk.push(error.id);
      if (error.type === 'pattern') items.pattern.push(error.id);
    }

    return {
      items,
      total: items.vocabulary.length + items.chunk.length + items.pattern.length,
    };
  }

  async log(
    taskId: string,
    level: AdminTaskLogLevel | `${AdminTaskLogLevel}`,
    message: string,
    options?: { step?: string; meta?: unknown },
  ) {
    await this.prisma.adminTaskLog.create({
      data: {
        taskId,
        level: level as AdminTaskLogLevel,
        step: options?.step,
        message,
        meta: options?.meta as Prisma.InputJsonValue,
      },
    });
  }
}
