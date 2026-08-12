import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { AdminTasksService } from '../admin-tasks.service';
import { TopicTeachingGenerateService } from './topic-teaching-generate.service';
import { WarmupPipelineGenerateService } from './warmup-pipeline-generate.service';

type JsonRecord = Record<string, any>;

/** 教学文档视为"缺失"的最少字数（低于该值重新生成） */
const TEACHING_MIN_CHARS = 100;

@Injectable()
export class SceneTopicBatchGenerateService {
  private readonly logger = new Logger(SceneTopicBatchGenerateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: AdminTasksService,
    private readonly teachingGenerate: TopicTeachingGenerateService,
    private readonly warmupGenerate: WarmupPipelineGenerateService,
    private readonly notifications: NotificationService,
  ) {}

  /** 场景批量生成：教学文档 + 知识点训练，逐话题检查缺失后补齐 */
  async run(taskId: string, sceneId: string, createdById?: string) {
    const started = await this.tasks.markRunning(taskId, 'collecting-topics');
    if (!started) {
      const task = await this.prisma.adminTask.findUnique({ where: { id: taskId }, select: { status: true } });
      if (!task || task.status === 'canceled') return { canceled: true };
      if (task.status !== 'failed') return { skipped: true };
      await this.prisma.adminTask.update({
        where: { id: taskId },
        data: { status: 'running', currentStep: 'collecting-topics', errorMessage: null, finishedAt: null },
      });
    }

    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId }, select: { id: true, title: true } });
    if (!scene) throw new NotFoundException('学习包不存在');

    const topics = await this.prisma.trainingTopic.findMany({
      where: { sceneId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, teachingMarkdown: true, metadata: true },
    });
    if (!topics.length) {
      await this.tasks.markCompleted(taskId, { sceneId, sceneTitle: scene.title, topicCount: 0, teachingGenerated: 0, teachingSkipped: 0, warmupGenerated: 0, warmupSkipped: 0, errors: [] });
      return { summary: { topicCount: 0 } };
    }

    // 每个话题 2 个子任务：教学文档 + 知识点训练
    const totalItems = topics.length * 2;
    await this.tasks.setProgress(taskId, { currentStep: 'checking-topics', totalItems, processedItems: 0 });

    let processedItems = 0;
    let teachingGenerated = 0;
    let teachingSkipped = 0;
    let warmupGenerated = 0;
    let warmupSkipped = 0;
    const errors: Array<{ topicId: string; topicTitle: string; item: string; message: string }> = [];

    for (const topic of topics) {
      // ── 1. 教学文档：有初稿（≥100字）时 AI 润色，无初稿则跳过 ──
      const teachingText = (topic.teachingMarkdown ?? '').trim();
      if (teachingText.length >= TEACHING_MIN_CHARS) {
        try {
          await this.tasks.log(taskId, 'info', `正在润色教学文档：${topic.title}`, { step: 'polishing-teaching', meta: { topicId: topic.id } });
          const result = await this.teachingGenerate.polishForTopic(topic.id);
          await this.prisma.trainingTopic.update({ where: { id: topic.id }, data: { teachingMarkdown: result.markdown } });
          teachingGenerated += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ topicId: topic.id, topicTitle: topic.title, item: '教学文档', message });
          await this.tasks.log(taskId, 'error', `教学文档润色失败：${topic.title}（${message}）`, { step: 'polishing-teaching', meta: { topicId: topic.id } });
        }
      } else {
        teachingSkipped += 1;
      }
      processedItems += 1;
      await this.tasks.setProgress(taskId, { currentStep: 'generating-teaching', totalItems, processedItems });

      // ── 2. 知识点训练：pipeline 为空时生成 ──
      const metadata = this.asRecord(topic.metadata);
      const outputTraining = this.asRecord(metadata.outputTraining);
      const pipeline = Array.isArray(outputTraining.pipeline) ? outputTraining.pipeline as JsonRecord[] : [];
      if (!pipeline.length) {
        try {
          await this.tasks.log(taskId, 'info', `正在生成知识点训练：${topic.title}`, { step: 'generating-warmup', meta: { topicId: topic.id } });
          const summary = await this.warmupGenerate.generateAndSaveForTopic(topic.id, () => this.tasks.isCanceled(taskId));
          if (!summary) return { canceled: true };
          warmupGenerated += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ topicId: topic.id, topicTitle: topic.title, item: '知识点训练', message });
          await this.tasks.log(taskId, 'error', `知识点训练生成失败：${topic.title}（${message}）`, { step: 'generating-warmup', meta: { topicId: topic.id } });
        }
      } else {
        warmupSkipped += 1;
      }
      processedItems += 1;
      await this.tasks.setProgress(taskId, { currentStep: 'saving', totalItems, processedItems });

      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
    }

    const summary = {
      sceneId: scene.id,
      sceneTitle: scene.title,
      topicCount: topics.length,
      teachingGenerated,
      teachingSkipped,
      warmupGenerated,
      warmupSkipped,
      errors,
      actionUrl: `/admin/learning-content?sceneId=${encodeURIComponent(scene.id)}`,
    };
    await this.tasks.markCompleted(taskId, summary);

    if (createdById) {
      try {
        await this.notifications.createSystemTargetedNotification(
          createdById,
          createdById,
          `学习包内容批量生成完成：${scene.title}`,
          `共处理 ${topics.length} 个话题：教学文档生成 ${teachingGenerated} 篇${teachingSkipped ? `（${teachingSkipped} 篇已达标跳过）` : ''}，知识点训练生成 ${warmupGenerated} 组${warmupSkipped ? `（${warmupSkipped} 组已有跳过）` : ''}${errors.length ? `，${errors.length} 项失败：${errors.slice(0, 3).map((e) => `${e.topicTitle}-${e.item}`).join('、')}${errors.length > 3 ? ' 等' : ''}` : ''}。`,
          `/admin/learning-content?sceneId=${encodeURIComponent(scene.id)}`,
        );
      } catch (error) {
        this.logger.warn(`批量生成完成但通知发送失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { summary };
  }

  private asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
  }
}
