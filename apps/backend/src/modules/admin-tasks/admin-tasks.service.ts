import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminTaskLogLevel, AdminTaskStatus, Prisma, ScriptWorkStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ADMIN_CONTENT_QUEUE, CONTENT_PREPARE_JOB, WARMUP_PIPELINE_GENERATE_JOB, SCENE_TOPIC_BATCH_GENERATE_JOB, VOCABULARY_IMPORT_QUEUE, VOCABULARY_CSV_IMPORT_JOB, VOCABULARY_MISSING_MEANING_ENRICH_JOB, VOCABULARY_POLISH_JOB, CHUNK_MISSING_MEANING_ENRICH_JOB, PATTERN_MISSING_MEANING_ENRICH_JOB, SCRIPT_VIDEO_QUEUE, SCRIPT_VIDEO_RENDER_JOB, NARRATIVE_VIDEO_RENDER_JOB, FILE_ASSET_INSPECT_JOB, FILE_ASSET_CLEANUP_JOB, DICTIONARY_PRONUNCIATION_BATCH_REFRESH_JOB } from './admin-tasks.constants';
import { DictionaryService } from '../dictionary/dictionary.service';

@Injectable()
export class AdminTasksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ADMIN_CONTENT_QUEUE) private readonly contentQueue: Queue,
    @InjectQueue(VOCABULARY_IMPORT_QUEUE) private readonly vocabularyImportQueue: Queue,
    @InjectQueue(SCRIPT_VIDEO_QUEUE) private readonly videoQueue: Queue,
    private readonly dictionaryService: DictionaryService,
  ) {}

  /** 将音标审查页当前的最多 100 个词作为一个可追踪的后台刷新任务。 */
  async enqueueDictionaryPronunciationBatchRefresh(createdById: string, params?: { search?: string; page?: number }) {
    const audit = await this.dictionaryService.pronunciationAudit(params);
    const words = audit.items.filter((item: any) => !item.locked).map((item) => item.word);
    if (!words.length) throw new BadRequestException('当前审查页的单词均已确认并锁定，无需检查');

    const task = await this.prisma.adminTask.create({
      data: {
        type: DICTIONARY_PRONUNCIATION_BATCH_REFRESH_JOB,
        title: `批量检查音标：第 ${audit.page} 页（${words.length} 个单词）`,
        targetType: 'dictionary_pronunciation_audit',
        targetId: String(audit.page),
        createdById,
        totalItems: words.length,
        payload: { words, page: audit.page, search: params?.search?.trim() || undefined } as Prisma.InputJsonValue,
      },
    });
    const job = await this.contentQueue.add(DICTIONARY_PRONUNCIATION_BATCH_REFRESH_JOB, { taskId: task.id, words });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', `已加入队列：自动更新本页 ${words.length} 个单词的 UK + US 音标`, { step: 'queued' });
    return { ...task, bullJobId: job.id };
  }

  async enqueueScriptVideo(workId: string, userId: string, frames: unknown[]) {
    const work = await this.prisma.scriptWork.findFirst({
      where: { id: workId, userId },
      select: { id: true, title: true },
    });
    if (!work) throw new NotFoundException('作品不存在');
    const localVisualFrames = frames.filter((frame: any) => [frame?.background?.url, frame?.sprite?.url].some((url) =>
      typeof url === 'string' && (url.startsWith('capacitor://') || url.includes('/_capacitor_file_/')),
    ));
    if (localVisualFrames.length > 0) {
      console.error('[script-video] rejected local visual URLs in render payload', {
        workId,
        frameIndexes: localVisualFrames.map((frame: any) => frame?.index),
      });
      throw new BadRequestException('视频渲染不能使用设备本地资源地址，请重新提交渲染任务');
    }
    console.log('[script-video] queued render payload', {
      workId,
      frames: frames.length,
      backgrounds: frames.filter((frame: any) => Boolean(frame?.background?.url)).length,
      sprites: frames.filter((frame: any) => Boolean(frame?.sprite?.url)).length,
    });
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
      // Persist cancellation before touching BullMQ. A worker may already have
      // picked up the job; every worker transition is guarded against this
      // persisted state, so it can no longer turn a canceled task back into
      // "running" while job removal is in flight.
      await this.prisma.adminTask.update({
        where: { id: task.id },
        data: {
          status: AdminTaskStatus.canceled,
          currentStep: 'canceled',
          errorMessage: reason,
          finishedAt: new Date(),
        },
      });
      if (task.bullJobId) {
        try {
          const job = await this.videoQueue.getJob(task.bullJobId);
          if (job) await job.remove();
        } catch {
          // Active BullMQ jobs cannot be removed. The processor checks the
          // persisted canceled state before uploading or publishing its output.
        }
      }
      await this.log(task.id, 'warn', reason, { step: 'canceled' });
    }
  }

  async enqueueNarrativeVideo(userId: string, frames: unknown[]) {
    const task = await this.prisma.adminTask.create({
      data: {
        type: NARRATIVE_VIDEO_RENDER_JOB,
        title: '生成叙事视频预览',
        targetType: 'narrative_video',
        targetId: userId,
        createdById: userId,
        totalItems: frames.length,
        payload: { userId, frames } as Prisma.InputJsonValue,
      },
    });
    const job = await this.videoQueue.add(NARRATIVE_VIDEO_RENDER_JOB, { taskId: task.id, userId, frames });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '叙事视频任务已加入 Redis 队列', { step: 'queued' });
    return task;
  }

  async getNarrativeVideoTask(taskId: string) {
    const task = await this.prisma.adminTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        progress: true,
        currentStep: true,
        errorMessage: true,
        summary: true,
        finishedAt: true,
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
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
    // The task center and every work/record view read ScriptWork as their
    // shared render state. Do not leave a canceled job's work in `rendering`,
    // otherwise other screens will poll forever and display a stale spinner.
    if (task.type === SCRIPT_VIDEO_RENDER_JOB && task.targetId) {
      await this.prisma.scriptWork.updateMany({
        where: { id: task.targetId, status: ScriptWorkStatus.rendering },
        data: {
          status: ScriptWorkStatus.ready,
          renderError: '视频生成已取消',
        },
      });
    }
    await this.log(task.id, 'info', '任务已加入后台队列', { step: 'queued' });

    return { ...task, bullJobId: job.id };
  }

  async enqueueWarmupPipelineGenerate(topicId: string, createdById: string) {
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: { id: true, title: true, sceneId: true, scene: { select: { title: true } } },
    });
    if (!topic) throw new NotFoundException('学习话题不存在');

    const existing = await this.prisma.adminTask.findFirst({
      where: {
        type: WARMUP_PIPELINE_GENERATE_JOB,
        targetType: 'training_topic',
        targetId: topic.id,
        status: { in: [AdminTaskStatus.queued, AdminTaskStatus.running] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { ...existing, reused: true };

    const task = await this.prisma.adminTask.create({
      data: {
        type: WARMUP_PIPELINE_GENERATE_JOB,
        title: `生成知识点练习：${topic.title}`,
        targetType: 'training_topic',
        targetId: topic.id,
        createdById,
        totalItems: 3,
        payload: { topicId: topic.id, sceneId: topic.sceneId, createdById } as Prisma.InputJsonValue,
      },
    });
    const job = await this.contentQueue.add(WARMUP_PIPELINE_GENERATE_JOB, {
      taskId: task.id,
      topicId: topic.id,
      sceneId: topic.sceneId,
      createdById,
    });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', `「${topic.scene.title} / ${topic.title}」知识点练习已加入后台队列`, { step: 'queued' });
    return { ...task, bullJobId: job.id, reused: false };
  }

  /**
   * 场景批量生成：为该场景下所有话题执行「教学文档 + 知识点训练」补齐任务。
   * 每个话题两项子任务，总计 totalItems = 话题数 × 2。
   */
  async enqueueSceneTopicBatchGenerate(sceneId: string, createdById?: string) {
    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId }, select: { id: true, title: true } });
    if (!scene) throw new NotFoundException('学习包不存在');

    const topicCount = await this.prisma.trainingTopic.count({ where: { sceneId } });
    if (!topicCount) throw new BadRequestException('学习包下没有训练话题');

    const existing = await this.prisma.adminTask.findFirst({
      where: {
        type: SCENE_TOPIC_BATCH_GENERATE_JOB,
        targetType: 'scene',
        targetId: scene.id,
        status: { in: [AdminTaskStatus.queued, AdminTaskStatus.running] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { ...existing, reused: true };

    const task = await this.prisma.adminTask.create({
      data: {
        type: SCENE_TOPIC_BATCH_GENERATE_JOB,
        title: `批量生成学习包内容：${scene.title}`,
        targetType: 'scene',
        targetId: scene.id,
        createdById,
        totalItems: topicCount * 2,
        payload: { sceneId: scene.id, createdById } as Prisma.InputJsonValue,
      },
    });
    const job = await this.contentQueue.add(SCENE_TOPIC_BATCH_GENERATE_JOB, {
      taskId: task.id,
      sceneId: scene.id,
      createdById,
    });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', `「${scene.title}」批量生成任务已加入后台队列（${topicCount} 个话题）`, { step: 'queued' });
    return { ...task, bullJobId: job.id, reused: false };
  }

  async enqueueVocabularyCsvImport(words: string[], createdById?: string) {
    const uniqueWords = [...new Set(words.map(w => w.trim()).filter(Boolean))];
    if (uniqueWords.length === 0) {
      throw new BadRequestException('CSV 中没有有效的词汇');
    }

    const task = await this.prisma.adminTask.create({
      data: {
        type: VOCABULARY_CSV_IMPORT_JOB,
        title: `批量导入词汇（${uniqueWords.length} 个）`,
        targetType: 'vocabulary',
        createdById,
        totalItems: uniqueWords.length,
        payload: { words: uniqueWords } as Prisma.InputJsonValue,
      },
    });

    const job = await this.vocabularyImportQueue.add(VOCABULARY_CSV_IMPORT_JOB, {
      taskId: task.id,
      words: uniqueWords,
    });

    await this.prisma.adminTask.update({
      where: { id: task.id },
      data: { bullJobId: job.id },
    });

    await this.log(task.id, 'info', '词汇 CSV 导入任务已加入 Redis 队列', { step: 'queued', meta: { count: uniqueWords.length } });
    return { ...task, bullJobId: job.id };
  }

  /** 扫描全部词汇，为缺失讲解/描述或例句的记录创建 AI 富化任务。 */
  async enqueueVocabularyMissingMeaningEnrich(createdById?: string) {
    const task = await this.prisma.adminTask.create({
      data: {
        type: VOCABULARY_MISSING_MEANING_ENRICH_JOB,
        title: '检查并 AI 富化词汇讲解/描述与例句',
        targetType: 'vocabulary',
        createdById,
        payload: {} as Prisma.InputJsonValue,
      },
    });

    const job = await this.vocabularyImportQueue.add(VOCABULARY_MISSING_MEANING_ENRICH_JOB, { taskId: task.id });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '词汇讲解/描述与例句检查任务已加入 Redis 队列', { step: 'queued' });
    return { ...task, bullJobId: job.id };
  }

  /** 扫描全部词汇，为例句缺中文翻译 / 释义过长的记录创建轻量修补任务。 */
  async enqueueVocabularyPolish(createdById?: string) {
    const task = await this.prisma.adminTask.create({
      data: {
        type: VOCABULARY_POLISH_JOB,
        title: '词汇例句翻译补全与释义精简',
        targetType: 'vocabulary',
        createdById,
        payload: {} as Prisma.InputJsonValue,
      },
    });

    const job = await this.vocabularyImportQueue.add(VOCABULARY_POLISH_JOB, { taskId: task.id });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '词汇例句翻译补全与释义精简任务已加入 Redis 队列', { step: 'queued' });
    return { ...task, bullJobId: job.id };
  }

  /** 扫描全部句块，为缺失中文释义、讲解/描述或例句的记录创建 AI 富化任务。 */
  async enqueueChunkMissingMeaningEnrich(createdById?: string) {
    const task = await this.prisma.adminTask.create({
      data: {
        type: CHUNK_MISSING_MEANING_ENRICH_JOB,
        title: '检查并 AI 富化句块中文释义、讲解与例句',
        targetType: 'chunk',
        createdById,
        payload: {} as Prisma.InputJsonValue,
      },
    });
    const job = await this.vocabularyImportQueue.add(CHUNK_MISSING_MEANING_ENRICH_JOB, { taskId: task.id });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '句块中文释义、讲解与例句检查任务已加入 Redis 队列', { step: 'queued' });
    return { ...task, bullJobId: job.id };
  }

  /** 扫描全部句型，为缺失中文释义、讲解/描述或例句的记录创建 AI 富化任务。 */
  async enqueuePatternMissingMeaningEnrich(createdById?: string) {
    const task = await this.prisma.adminTask.create({
      data: {
        type: PATTERN_MISSING_MEANING_ENRICH_JOB,
        title: '检查并 AI 富化句型中文释义、讲解与例句',
        targetType: 'sentence_pattern',
        createdById,
        payload: {} as Prisma.InputJsonValue,
      },
    });
    const job = await this.vocabularyImportQueue.add(PATTERN_MISSING_MEANING_ENRICH_JOB, { taskId: task.id });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '句型中文释义、讲解与例句检查任务已加入 Redis 队列', { step: 'queued' });
    return { ...task, bullJobId: job.id };
  }

  async enqueueFileAssetInspection(createdById: string, minAgeDays = 7) {
    const safeDays = Number.isFinite(minAgeDays)
      ? Math.min(Math.max(Math.floor(minAgeDays), 1), 365)
      : 7;
    const task = await this.prisma.adminTask.create({
      data: {
        type: FILE_ASSET_INSPECT_JOB,
        title: '检查未使用的文件资源',
        targetType: 'file_asset',
        createdById,
        payload: { minAgeDays: safeDays } as Prisma.InputJsonValue,
      },
    });
    const job = await this.contentQueue.add(FILE_ASSET_INSPECT_JOB, {
      taskId: task.id,
      minAgeDays: safeDays,
    });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '资源检查任务已加入队列', { step: 'queued' });
    return { ...task, bullJobId: job.id };
  }

  async enqueueFileAssetCleanup(createdById: string, inspectionTaskId: string) {
    if (typeof inspectionTaskId !== 'string' || !inspectionTaskId.trim()) {
      throw new BadRequestException('inspectionTaskId 不能为空');
    }
    const inspection = await this.prisma.adminTask.findFirst({
      where: {
        id: inspectionTaskId,
        type: FILE_ASSET_INSPECT_JOB,
        status: AdminTaskStatus.completed,
      },
    });
    const candidateIds = (inspection?.summary as any)?.candidateIds;
    if (!inspection || !Array.isArray(candidateIds)) {
      throw new BadRequestException('请先完成一次资源检查，再清理该次检查结果');
    }
    const task = await this.prisma.adminTask.create({
      data: {
        type: FILE_ASSET_CLEANUP_JOB,
        title: `清理未使用的文件资源（${candidateIds.length} 项）`,
        targetType: 'file_asset',
        targetId: inspection.id,
        createdById,
        totalItems: candidateIds.length,
        payload: { inspectionTaskId: inspection.id, candidateIds } as Prisma.InputJsonValue,
      },
    });
    const job = await this.contentQueue.add(FILE_ASSET_CLEANUP_JOB, {
      taskId: task.id,
      candidateIds,
    });
    await this.prisma.adminTask.update({ where: { id: task.id }, data: { bullJobId: job.id } });
    await this.log(task.id, 'info', '资源清理任务已加入队列；执行时会逐项重新检查引用', { step: 'queued' });
    return { ...task, bullJobId: job.id };
  }

  async list(params: {

    type?: string;
    status?: AdminTaskStatus;
    statuses?: AdminTaskStatus[];
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const statusFilter = params.statuses?.length
      ? { status: { in: params.statuses } }
      : (params.status ? { status: params.status } : {});
    const where: Prisma.AdminTaskWhereInput = {
      ...(params.type ? { type: params.type } : {}),
      ...statusFilter,
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

    // 任务完成时会写入 summary.usage；取消/中断的任务缺失，
    // 从最近一条 ai-usage 日志补齐（日志为累计值）。
    const summary = (task.summary ?? {}) as Record<string, any>;
    if (!summary.usage || (!summary.usage.calls && !summary.usage.totalTokens)) {
      const latestUsage = await this.prisma.adminTaskLog.findFirst({
        where: { taskId: id, step: 'ai-usage' },
        orderBy: { createdAt: 'desc' },
        select: { meta: true },
      });
      if (latestUsage?.meta) {
        summary.usage = latestUsage.meta as Prisma.InputJsonValue;
        task.summary = summary as Prisma.JsonValue;
      }
    }
    return task;
  }

  async retry(id: string, createdById?: string) {
    const task = await this.prisma.adminTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.type === SCRIPT_VIDEO_RENDER_JOB && task.targetId) {
      const payload = task.payload as any;
      return this.enqueueScriptVideo(task.targetId, payload?.userId || createdById, payload?.frames || []);
    }
    if (task.type === NARRATIVE_VIDEO_RENDER_JOB) {
      const payload = task.payload as any;
      return this.enqueueNarrativeVideo(payload?.userId || createdById, payload?.frames || []);
    }
    if (task.type === WARMUP_PIPELINE_GENERATE_JOB && task.targetId && createdById) {
      return this.enqueueWarmupPipelineGenerate(task.targetId, createdById);
    }
    if (task.type === SCENE_TOPIC_BATCH_GENERATE_JOB && task.targetId && createdById) {
      return this.enqueueSceneTopicBatchGenerate(task.targetId, createdById);
    }
    if (task.type === VOCABULARY_MISSING_MEANING_ENRICH_JOB) {
      return this.enqueueVocabularyMissingMeaningEnrich(createdById);
    }
    if (task.type === VOCABULARY_POLISH_JOB) {
      return this.enqueueVocabularyPolish(createdById);
    }
    if (task.type === CHUNK_MISSING_MEANING_ENRICH_JOB) {
      return this.enqueueChunkMissingMeaningEnrich(createdById);
    }
    if (task.type === PATTERN_MISSING_MEANING_ENRICH_JOB) {
      return this.enqueuePatternMissingMeaningEnrich(createdById);
    }
    if (task.type === FILE_ASSET_INSPECT_JOB && createdById) {
      return this.enqueueFileAssetInspection(createdById, Number((task.payload as any)?.minAgeDays ?? 7));
    }
    if (task.type === FILE_ASSET_CLEANUP_JOB && task.targetId && createdById) {
      return this.enqueueFileAssetCleanup(createdById, task.targetId);
    }
    if (task.type === DICTIONARY_PRONUNCIATION_BATCH_REFRESH_JOB && createdById) {
      const payload = task.payload as any;
      return this.enqueueDictionaryPronunciationBatchRefresh(createdById, { page: payload?.page, search: payload?.search });
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

    // First make cancellation durable. An active worker may not be removable,
    // but it must never be able to overwrite this state while removal runs.
    await this.prisma.adminTask.update({
      where: { id },
      data: {
        status: AdminTaskStatus.canceled,
        currentStep: 'canceled',
        finishedAt: new Date(),
        errorMessage: '任务已被管理员取消',
      },
    });

    // 从 BullMQ 队列中移除任务
    if (task.bullJobId) {
      try {
        const queue = task.type === SCRIPT_VIDEO_RENDER_JOB || task.type === NARRATIVE_VIDEO_RENDER_JOB
          ? this.videoQueue
          : task.type === VOCABULARY_CSV_IMPORT_JOB || task.type === VOCABULARY_MISSING_MEANING_ENRICH_JOB || task.type === VOCABULARY_POLISH_JOB || task.type === CHUNK_MISSING_MEANING_ENRICH_JOB || task.type === PATTERN_MISSING_MEANING_ENRICH_JOB
            ? this.vocabularyImportQueue
            : this.contentQueue;
        const job = await queue.getJob(task.bullJobId);
        if (job) {
          await job.remove();
        }
      } catch {
        // 任务可能已经不存在于队列中，忽略错误
      }
    }

    await this.log(id, 'warn', '任务已被管理员取消', { step: 'canceled' });

    return this.get(id);
  }

  async markRunning(taskId: string, currentStep = 'scan') {
    const result = await this.prisma.adminTask.updateMany({
      where: { id: taskId, status: AdminTaskStatus.queued },
      data: {
        status: AdminTaskStatus.running,
        currentStep,
        startedAt: new Date(),
        errorMessage: null,
      },
    });
    return result.count > 0;
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
    await this.prisma.adminTask.updateMany({
      where: { id: taskId, status: { not: AdminTaskStatus.canceled } },
      data: {
        ...data,
        progress,
      },
    });
  }

  async markCompleted(taskId: string, summary: unknown) {
    await this.prisma.adminTask.updateMany({
      where: { id: taskId, status: { not: AdminTaskStatus.canceled } },
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
    await this.prisma.adminTask.updateMany({
      where: { id: taskId, status: { not: AdminTaskStatus.canceled } },
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

  async getQueuesStatus() {
    const queues = [
      { name: ADMIN_CONTENT_QUEUE, queue: this.contentQueue, label: '学习包内容准备' },
      { name: VOCABULARY_IMPORT_QUEUE, queue: this.vocabularyImportQueue, label: '词汇CSV导入' },
      { name: SCRIPT_VIDEO_QUEUE, queue: this.videoQueue, label: '视频渲染' },
    ];

    const results = await Promise.all(
      queues.map(async ({ name, queue, label }) => {
        const [waiting, active, delayed, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ]);
        return { name, label, waiting, active, delayed, completed, failed };
      }),
    );

    return {
      queues: results,
      totalWaiting: results.reduce((sum, q) => sum + q.waiting, 0),
      totalActive: results.reduce((sum, q) => sum + q.active, 0),
      totalDelayed: results.reduce((sum, q) => sum + q.delayed, 0),
      totalFailed: results.reduce((sum, q) => sum + q.failed, 0),
    };
  }

  async getQueueJobs(queueName: string, statuses: string[]) {
    const queueMap: Record<string, Queue> = {
      [ADMIN_CONTENT_QUEUE]: this.contentQueue,
      [VOCABULARY_IMPORT_QUEUE]: this.vocabularyImportQueue,
      [SCRIPT_VIDEO_QUEUE]: this.videoQueue,
    };
    const queue = queueMap[queueName];
    if (!queue) throw new NotFoundException(`队列 ${queueName} 不存在`);

    const jobs: Array<{
      id: string;
      name: string;
      status: string;
      progress: number;
      attemptsMade: number;
      timestamp: number;
      processedOn?: number;
      finishedOn?: number;
      failedReason?: string;
      data: any;
    }> = [];

    for (const status of statuses) {
      let fetched: Awaited<ReturnType<typeof queue.getJobs>> = [];
      switch (status) {
        case 'waiting': fetched = await queue.getJobs(['waiting']); break;
        case 'active': fetched = await queue.getJobs(['active']); break;
        case 'delayed': fetched = await queue.getJobs(['delayed']); break;
        case 'completed': fetched = await queue.getJobs(['completed'], 0, 49); break;
        case 'failed': fetched = await queue.getJobs(['failed'], 0, 49); break;
      }
      for (const job of fetched) {
        jobs.push({
          id: job.id || '',
          name: job.name,
          status,
          progress: typeof job.progress === 'number' ? job.progress : 0,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp || 0,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: (job as any).failedReason,
          data: job.data,
        });
      }
    }

    return { queueName, jobs, total: jobs.length };
  }

  async prioritizeTask(taskId: string) {
    const task = await this.prisma.adminTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.status !== 'queued') {
      throw new BadRequestException('只能对排队中的任务进行插队操作');
    }
    if (!task.bullJobId) {
      throw new BadRequestException('该任务尚未进入队列，无法插队');
    }

    const queue = this.getQueueForTask(task.type);
    const job = await queue.getJob(task.bullJobId);
    if (!job) {
      throw new BadRequestException('任务在队列中已不存在（可能已被处理）');
    }
    const jobState = await job.getState();
    if (jobState === 'delayed') {
      await job.promote();
    } else if (jobState !== 'waiting' && jobState !== 'prioritized') {
      throw new BadRequestException(`任务当前处于 ${jobState} 状态，无法插队`);
    }

    // BullMQ's default priority is 0 (highest). `lifo` puts this waiting job
    // at the worker-facing end of the normal wait list.
    await job.changePriority({ priority: 0, lifo: true });
    await this.log(taskId, 'info', '任务已被插队到队列最前面', { step: 'prioritized' });

    return this.get(taskId);
  }

  async forceRunTask(taskId: string, userId: string) {
    const task = await this.prisma.adminTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('任务不存在');

    // Allow force-run on queued (stuck) or failed tasks
    if (task.status !== 'queued' && task.status !== 'failed') {
      throw new BadRequestException('只能强制执行排队中或失败的任务');
    }

    // 1. Remove the old job from the queue if still queued
    if (task.bullJobId && task.status === 'queued') {
      try {
        const queue = this.getQueueForTask(task.type);
        const job = await queue.getJob(task.bullJobId);
        if (job) await job.remove();
      } catch {
        // job may already be gone
      }
    }

    // 2. Mark old task as canceled (it will be replaced by a new one)
    await this.prisma.adminTask.update({
      where: { id: taskId },
      data: {
        status: AdminTaskStatus.canceled,
        currentStep: 'canceled',
        finishedAt: new Date(),
        errorMessage: '已被强制执行替换',
      },
    });

    // 3. Create a new task with highest priority and enqueue it
    const payload = task.payload as any;
    const newTask = await this.prisma.adminTask.create({
      data: {
        type: task.type,
        title: `${task.title}【强制执行】`,
        targetType: task.targetType,
        targetId: task.targetId,
        createdById: userId,
        totalItems: task.totalItems,
        payload: task.payload as Prisma.InputJsonValue,
      },
    });

    const queue = this.getQueueForTask(task.type);
    try {
      const job = await queue.add(task.type, {
        taskId: newTask.id,
        sceneId: task.targetId,
        workId: task.targetId,
        userId: payload?.userId || userId,
        frames: payload?.frames || [],
        words: payload?.words || [],
        retryItems: payload?.retryItems,
        topicId: payload?.topicId,
        createdById: payload?.createdById || userId,
      }, {
        lifo: true,
      });

      await this.prisma.adminTask.update({
        where: { id: newTask.id },
        data: { bullJobId: job.id },
      });
    } catch (error) {
      await this.prisma.adminTask.update({
        where: { id: newTask.id },
        data: {
          status: AdminTaskStatus.failed,
          currentStep: 'enqueue_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        },
      });
      throw error;
    }

    await this.log(newTask.id, 'info', '任务已被强制执行（新任务已插队）', { step: 'force-run' });

    return this.get(newTask.id);
  }

  private getQueueForTask(type: string): Queue {
    if (type === SCRIPT_VIDEO_RENDER_JOB || type === NARRATIVE_VIDEO_RENDER_JOB) {
      return this.videoQueue;
    }
    if (type === VOCABULARY_CSV_IMPORT_JOB || type === VOCABULARY_MISSING_MEANING_ENRICH_JOB || type === VOCABULARY_POLISH_JOB || type === CHUNK_MISSING_MEANING_ENRICH_JOB || type === PATTERN_MISSING_MEANING_ENRICH_JOB) {
      return this.vocabularyImportQueue;
    }
    return this.contentQueue;
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
