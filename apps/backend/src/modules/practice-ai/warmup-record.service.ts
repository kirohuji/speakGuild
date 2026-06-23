import { Injectable } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmProviderFactory } from '../../common/llm/llm-provider.factory';
import { AiModelService } from '../ai-model/ai-model.service';

@Injectable()
export class WarmupRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmFactory: LlmProviderFactory,
    private readonly aiModel: AiModelService,
  ) {}

  async list(userId: string, topicId?: string) {
    const where: any = { userId };
    if (topicId) where.topicId = topicId;
    
    const records = await (this.prisma as any).practiceWarmupRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        score: true,
        feedback: true,
        items: true,
        topicId: true,
        createdAt: true,
      },
    });

    // Fetch topic titles
    const topicIds = Array.from(new Set(records.map((r: any) => (r.topicId as string)))) as string[];
    const topics = await this.prisma.trainingTopic.findMany({
      where: { id: { in: topicIds as string[] } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(topics.map(t => [t.id, t.title]));

    return records.map((r: any) => ({
      id: r.id,
      score: r.score,
      feedback: r.feedback,
      items: r.items,
      topicTitle: titleMap.get(r.topicId) || r.topicId,
      createdAt: r.createdAt,
    }));
  }

  async save(userId: string, topicId: string, items: any[]) {
    return (this.prisma as any).practiceWarmupRecord.create({
      data: { userId, topicId, items },
    });
  }

  async assessAndSave(userId: string, topicId: string, topicTitle: string, items: any[]) {
    // AI 综合评估
    let score: number | null = null;
    let feedback: string | null = null;

    try {
      const totalItems = items.length;
      const passedItems = items.filter((i: any) => i.passed).length;
      const passedRatio = totalItems > 0 ? (passedItems / totalItems * 100).toFixed(0) : '0';

      const summary = items.map((i: any, idx: number) =>
        `[${idx + 1}] 类型:${i.type} 题目:${i.zh || i.promptZh || ''} 答案:${i.answer || i.suggestedAnswer || ''} 用户:${i.userAnswer || ''} ${i.passed ? '✓' : '✗'}`
      ).join('\n');

      const system = `You are an ESL assessment expert. Evaluate a warmup drill session and give a brief, encouraging summary in Chinese (3-5 sentences). Include:
1. Overall performance assessment
2. One specific strength
3. One specific area to improve
4. A score 0-100

Return ONLY a JSON object: { "score": number, "feedback": "Chinese text" }`;

      const config = await this.aiModel.getLlmConfig();
      const model = this.llmFactory.create(config);
      const { text } = await generateText({
        model,
        system,
        prompt: `Topic: ${topicTitle}\nPassed: ${passedItems}/${totalItems} (${passedRatio}%)\n\n${summary}`,
        temperature: 0.5,
        maxOutputTokens: 400,
      });

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      score = parsed.score ?? Math.round((passedItems / Math.max(totalItems, 1)) * 100);
      feedback = parsed.feedback ?? '';
    } catch {
      const total = Math.max(items.length, 1);
      const passed = items.filter((i: any) => i.passed).length;
      score = Math.round((passed / total) * 100);
      feedback = `完成了 ${passed}/${total} 道题目。`;
    }

    const record = await (this.prisma as any).practiceWarmupRecord.create({
      data: { userId, topicId, score, feedback, items },
    });

    return { id: record.id, score, feedback };
  }
}
