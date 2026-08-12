import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AiModelService } from '../../ai-model/ai-model.service';
import { buildTopicTeachingDocumentPrompt } from '../prompts/topic-teaching.prompt';

type TeachingMaterial = {
  id: string;
  text: string;
  meaning: string;
  examples: string[];
};

type Materials = {
  chunks: TeachingMaterial[];
  patterns: TeachingMaterial[];
  vocabs: TeachingMaterial[];
};

/** 兼容字符串或 { en, zh, note? } 的例句字段 */
const toExample = (item: any): string => {
  if (typeof item === 'string') return item.trim();
  return String(item?.en ?? '').trim();
};

/** 去掉释义结尾多余的句号 */
const cleanMeaning = (value: string): string => value.replace(/[。.]+$/, '');

/** 去除代码块包裹 */
const stripFences = (value: string): string => value
  .replace(/```(?:markdown|md)?\s*/gi, '')
  .replace(/```\s*/g, '')
  .trim();

/**
 * 话题教学文档生成（Markdown）
 * 供单话题「AI 生成」与场景批量生成共用，保证两者产出一致。
 * 完整文档直接由 AI 生成，结构自由、以老师讲课的口吻展开；
 * 服务端只负责整理已批准材料并调用模型，失败直接抛错，不做二次拼接。
 * 遵守学习包组顺序约束：不得出现后序包知识点，难度与话题/学习包对齐。
 */
@Injectable()
export class TopicTeachingGenerateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiModelService: AiModelService,
  ) {}

  /** 为话题生成教学文档，返回 Markdown（失败抛错） */
  async generateForTopic(topicId: string): Promise<string> {
    const llmConfig = await this.aiModelService.getLlmConfig();
    if (!llmConfig.apiKey) throw new Error('LLM API Key 未配置');

    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      include: {
        scene: { select: { id: true, title: true, requiredOutputLevel: true } },
        topicPatterns: { include: { pattern: true } },
        topicVocabs: { include: { vocab: true } },
        activeChunks: { include: { chunk: { include: { examples: { orderBy: { sortOrder: 'asc' } } } } } },
      },
    });
    if (!topic) throw new Error('学习话题不存在');

    const materials = this.collectMaterials(topic);
    if (!materials.chunks.length && !materials.patterns.length) {
      throw new Error('当前话题没有可用的句块或句型，无法生成教学文档');
    }
    return this.generateFullDocument(topic, llmConfig, materials);
  }

  /** 从数据库资产整理本课材料 */
  private collectMaterials(topic: any): Materials {
    const chunks: TeachingMaterial[] = (topic.activeChunks ?? [])
      .map((row: any) => ({
        id: row.chunk.id,
        text: row.chunk.text,
        meaning: row.chunk.meaning ?? '',
        examples: (row.chunk.examples ?? []).map((item: any) => item.en).filter(Boolean),
      }))
      .slice(0, 4);
    const patterns: TeachingMaterial[] = (topic.topicPatterns ?? [])
      .map((row: any) => ({
        id: row.pattern.id,
        text: row.pattern.pattern,
        meaning: row.pattern.meaning ?? '',
        examples: Array.isArray(row.pattern.examples) ? row.pattern.examples.map(toExample).filter(Boolean) : [],
      }))
      .slice(0, 3);
    const vocabs: TeachingMaterial[] = (topic.topicVocabs ?? [])
      .map((row: any) => ({
        id: row.vocab.id,
        text: row.vocab.word,
        meaning: row.vocab.meaning ?? '',
        examples: Array.isArray(row.vocab.examples) ? row.vocab.examples.map(toExample).filter(Boolean) : [],
      }))
      .slice(0, 8);
    return { chunks, patterns, vocabs };
  }

  /**
   * 完整文档由 AI 一次生成；失败直接抛错，不重试、不回退。
   * deepseek-v4-flash 默认开启 thinking 模式，会把全部输出预算花在推理上导致正文为空，
   * 因此这里直接调用 OpenAI 兼容接口并显式关闭 thinking。
   */
  private async generateFullDocument(topic: any, llmConfig: any, materials: Materials): Promise<string> {
    const prompt = buildTopicTeachingDocumentPrompt({
      topicTitle: topic.title,
      sceneTitle: topic.scene.title,
      objective: topic.promptZh,
      chunks: materials.chunks.map((item) => this.formatMaterial(item)),
      patterns: materials.patterns.map((item) => this.formatMaterial(item)),
      vocabulary: materials.vocabs.map((item) => this.formatMaterial(item)),
    });
    console.log(`[topic-teaching] generate topic=${topic.title} model=${llmConfig.model} baseUrl=${llmConfig.baseUrl} promptChars=${prompt.length}`);

    const endpoint = `${llmConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.55,
        max_tokens: 6000,
        thinking: { type: 'disabled' },
      }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`AI 调用失败（HTTP ${response.status}）：${JSON.stringify(data).slice(0, 500)}`);
    }
    const raw = String(data?.choices?.[0]?.message?.content ?? '');
    const markdown = stripFences(raw);
    console.log(`[topic-teaching] AI raw: textChars=${raw.length} strippedChars=${markdown.length} finish=${data?.choices?.[0]?.finish_reason ?? 'n/a'}`);
    if (!markdown) {
      console.error(`[topic-teaching] AI 返回内容为空，原始响应：${JSON.stringify(data).slice(0, 2000)}`);
      throw new Error('AI 返回内容为空');
    }
    return markdown;
  }

  /** 把一条材料整理成 prompt 中的一行：英文 + 释义 + 例句 */
  private formatMaterial(item: TeachingMaterial): string {
    const head = `- \`${item.text}\` —— ${cleanMeaning(item.meaning) || '（无释义）'}`;
    if (!item.examples.length) return head;
    return `${head}\n  例句：${item.examples.map((example) => `\`${example}\``).join('；')}`;
  }

}
