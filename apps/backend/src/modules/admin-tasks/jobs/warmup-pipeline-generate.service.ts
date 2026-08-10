import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { EnglishPracticeAiService } from '../../practice-ai/english-practice-ai.service';
import { AdminTasksService } from '../admin-tasks.service';

type JsonRecord = Record<string, any>;

@Injectable()
export class WarmupPipelineGenerateService {
  private readonly logger = new Logger(WarmupPipelineGenerateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceAi: EnglishPracticeAiService,
    private readonly tasks: AdminTasksService,
    private readonly notifications: NotificationService,
  ) {}

  async run(taskId: string, topicId: string, createdById?: string) {
    const started = await this.tasks.markRunning(taskId, 'loading-topic');
    if (!started) {
      const task = await this.prisma.adminTask.findUnique({ where: { id: taskId }, select: { status: true } });
      if (!task || task.status === 'canceled') return { canceled: true };
      // BullMQ automatic retries reuse the same task after the previous attempt
      // marked it failed. Re-open it without reviving completed/canceled tasks.
      if (task.status !== 'failed') return { skipped: true };
      await this.prisma.adminTask.update({
        where: { id: taskId },
        data: { status: 'running', currentStep: 'loading-topic', errorMessage: null, finishedAt: null },
      });
    }
    await this.tasks.setProgress(taskId, { currentStep: 'loading-topic', totalItems: 3, processedItems: 0 });

    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      include: {
        scene: { select: { id: true, title: true } },
        topicVocabs: { orderBy: { sortOrder: 'asc' }, include: { vocab: true } },
        activeChunks: { orderBy: { sortOrder: 'asc' }, include: { chunk: true } },
        topicPatterns: { orderBy: { sortOrder: 'asc' }, include: { pattern: true } },
      },
    });
    if (!topic) throw new NotFoundException('学习话题不存在');

    const metadata = this.asRecord(topic.metadata);
    const outputTraining = this.asRecord(metadata.outputTraining);
    const currentPipeline = Array.isArray(outputTraining.pipeline) ? outputTraining.pipeline as JsonRecord[] : [];
    const usage = this.asRecord(outputTraining.materialUsage);
    const totals = this.asRecord(usage.totals);
    const countMap = (items: unknown) => new Map(
      (Array.isArray(items) ? items : []).map((item: any) => [String(item?.id ?? ''), Number(item?.count ?? 0)]),
    );
    const vocabCounts = countMap(totals.vocabs);
    const chunkCounts = countMap(totals.chunks);
    const patternCounts = countMap(totals.patterns);

    await this.tasks.setProgress(taskId, { currentStep: 'generating-warmup', totalItems: 3, processedItems: 1 });
    const result = await this.practiceAi.generateWarmupPipeline({
      topicTitle: topic.title,
      difficulty: topic.difficulty,
      materials: {
        vocabs: topic.topicVocabs.map(({ vocab }) => ({ id: vocab.id, word: vocab.word, meaning: vocab.meaning, count: vocabCounts.get(vocab.id) ?? 0 })),
        chunks: topic.activeChunks.map(({ chunk }) => ({ id: chunk.id, text: chunk.text, meaning: chunk.meaning, count: chunkCounts.get(chunk.id) ?? 0 })),
        patterns: topic.topicPatterns.map(({ pattern }) => ({ id: pattern.id, pattern: pattern.pattern, meaning: pattern.meaning ?? undefined, count: patternCounts.get(pattern.id) ?? 0 })),
      },
      constraints: { sceneId: topic.sceneId, difficulty: topic.difficulty },
      structure: this.describeStructure(currentPipeline),
      previousPipeline: currentPipeline,
    });

    const generated = (Array.isArray(result.pipeline) ? result.pipeline : [])
      .map((item) => this.normalizeItem(item))
      .filter((item): item is JsonRecord => Boolean(item));
    if (!generated.length) throw new Error('AI 没有生成可用题目，请稍后重试');

    if (await this.tasks.isCanceled(taskId)) return { canceled: true };

    // Generation can take a while. Re-read metadata before writing so edits made
    // while the task was running are preserved and newly added exercises are merged.
    const latest = await this.prisma.trainingTopic.findUnique({ where: { id: topic.id }, select: { metadata: true } });
    if (!latest) throw new NotFoundException('学习话题不存在');
    const latestMetadata = this.asRecord(latest.metadata);
    const latestOutputTraining = this.asRecord(latestMetadata.outputTraining);
    const latestPipeline = Array.isArray(latestOutputTraining.pipeline) ? latestOutputTraining.pipeline as JsonRecord[] : [];
    const beforeItems = this.countPracticeItems(latestPipeline);
    const nextPipeline = this.dedupe([...latestPipeline, ...generated]);
    const nextOutputTraining: JsonRecord = {
      ...latestOutputTraining,
      version: Number(latestOutputTraining.version ?? 1),
      enabled: latestOutputTraining.enabled !== false,
      pipeline: nextPipeline,
    };
    delete nextOutputTraining.materialUsage;

    await this.tasks.setProgress(taskId, { currentStep: 'saving-warmup', totalItems: 3, processedItems: 2 });
    if (await this.tasks.isCanceled(taskId)) return { canceled: true };
    await this.prisma.trainingTopic.update({
      where: { id: topic.id },
      data: {
        metadata: {
          ...latestMetadata,
          outputTraining: nextOutputTraining,
        } as Prisma.InputJsonValue,
      },
    });

    const actionUrl = `/admin/learning-content?sceneId=${encodeURIComponent(topic.sceneId)}&topicId=${encodeURIComponent(topic.id)}&dialog=topic&tab=warmup`;
    const summary = {
      sceneId: topic.sceneId,
      topicId: topic.id,
      actionUrl,
      generatedGroups: generated.length,
      beforeGroups: latestPipeline.length,
      afterGroups: nextPipeline.length,
      beforeItems,
      afterItems: this.countPracticeItems(nextPipeline),
    };
    await this.tasks.markCompleted(taskId, summary);

    if (createdById) {
      try {
        await this.notifications.createSystemTargetedNotification(
          createdById,
          createdById,
          `知识点练习已生成：${topic.title}`,
          `已为「${topic.scene.title} / ${topic.title}」补齐 ${generated.length} 个练习题组，点击可直接检查结果。`,
          actionUrl,
        );
      } catch (error) {
        this.logger.warn(`生成成功但通知发送失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return summary;
  }

  private asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
  }

  private describeStructure(pipeline: JsonRecord[]) {
    let zhToEnItems = 0;
    let enToZhItems = 0;
    let patternItems = 0;
    let expansionUnits = 0;
    for (const item of pipeline) {
      if (item.type === 'chunk_substitution') {
        const count = Array.isArray(item.items) ? item.items.length : 0;
        if (item.direction === 'en_to_zh') enToZhItems += count;
        else zhToEnItems += count;
      } else if (item.type === 'pattern_drill') {
        patternItems += Array.isArray(item.items) ? item.items.length : 0;
      } else if (item.type === 'vocab_sentence_building' || item.type === 'sentence_decomposition') {
        expansionUnits += 1;
      }
    }
    return { zhToEnItems, enToZhItems, patternItems, expansionUnits, steps: pipeline.length, totalItems: this.countPracticeItems(pipeline) };
  }

  private countPracticeItems(pipeline: JsonRecord[]) {
    return pipeline.reduce((sum, item) => {
      if (item.type === 'sentence_decomposition') return sum + (Array.isArray(item.levels) ? item.levels.length : 0);
      if (item.type === 'vocab_sentence_building') {
        return sum + (Array.isArray(item.patterns) ? item.patterns : []).reduce((inner: number, pattern: any) => inner + (Array.isArray(pattern?.items) ? pattern.items.length : 0), 0);
      }
      return sum + (Array.isArray(item.items) ? item.items.length : 0);
    }, 0);
  }

  private normalizeTranslations(items: unknown, direction: 'zh_to_en' | 'en_to_zh') {
    return (Array.isArray(items) ? items : []).map((item: any) => {
      const answer = String(item?.answer ?? '').trim();
      const hint = String(item?.hint ?? '').trim();
      if (direction === 'en_to_zh') {
        const rawEn = String(item?.en ?? '').trim();
        const rawZh = String(item?.zh ?? '').trim();
        return { en: rawEn || (/[A-Za-z]/.test(rawZh) ? rawZh : ''), answer, hint };
      }
      return { zh: String(item?.zh ?? '').trim(), answer, hint };
    }).filter((item: any) => Boolean(direction === 'en_to_zh' ? item.en : item.zh) && Boolean(item.answer));
  }

  private normalizeItem(raw: unknown): JsonRecord | null {
    const item = this.asRecord(raw);
    const direction = item.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en';
    if (item.type === 'chunk_substitution' || item.type === 'pattern_drill') {
      const keyword = String(item.type === 'chunk_substitution' ? item.chunk ?? '' : item.pattern ?? '').trim();
      const items = this.normalizeTranslations(item.items, direction);
      if (!keyword || !items.length) return null;
      return { ...item, id: `warmup_${randomUUID()}`, direction, items, ...(item.type === 'chunk_substitution' ? { chunk: keyword, kind: item.kind === 'word' ? 'word' : 'chunk' } : { pattern: keyword }) };
    }
    if (item.type === 'vocab_sentence_building') {
      const vocabWord = String(item.vocabWord ?? '').trim();
      const patterns = (Array.isArray(item.patterns) ? item.patterns : []).map((pattern: any) => ({
        chunk: String(pattern?.chunk ?? vocabWord).trim(),
        items: this.normalizeTranslations(pattern?.items, direction),
      })).filter((pattern: any) => pattern.chunk && pattern.items.length);
      if (!vocabWord || !patterns.length) return null;
      return { ...item, id: `warmup_${randomUUID()}`, direction, vocabWord, patterns };
    }
    if (item.type === 'sentence_decomposition') {
      const fullSentence = String(item.fullSentence ?? '').trim();
      const levels = (Array.isArray(item.levels) ? item.levels : []).map((level: any, index: number) => ({
        ...level, level: index + 1, en: String(level?.en ?? '').trim(), zh: String(level?.zh ?? '').trim(),
      })).filter((level: any) => level.en && level.zh);
      if (!fullSentence || !levels.length) return null;
      return { ...item, id: `warmup_${randomUUID()}`, fullSentence, levels };
    }
    return null;
  }

  private dedupe(pipeline: JsonRecord[]) {
    const seen = new Set<string>();
    return pipeline.filter((item) => {
      const signature = JSON.stringify({
        type: item.type,
        direction: item.direction,
        keyword: item.chunk ?? item.pattern ?? item.vocabWord ?? item.fullSentence ?? '',
        content: item.items ?? item.patterns ?? item.levels ?? [],
      }).toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }
}
