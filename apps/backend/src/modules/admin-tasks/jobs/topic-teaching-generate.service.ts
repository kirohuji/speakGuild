import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AiModelService } from '../../ai-model/ai-model.service';
import { buildTopicTeachingPolishPrompt, type PolishChange } from '../prompts/topic-teaching.prompt';

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

export type PolishResult = {
  markdown: string;
  changes: PolishChange[];
};

/**
 * 话题教学文档润色服务
 * 管理员在后台编写教学文档初稿并保存到 trainingTopic.teachingMarkdown，
 * 然后调用本服务的润色接口，AI 会润色语言并返回结构化改动说明。
 *
 * 与旧版 generateForTopic 的区别：
 * - 旧版：从材料全量生成，质量不稳定
 * - 新版：基于管理员初稿润色，只做语言优化和硬伤修正，不改结构
 */
@Injectable()
export class TopicTeachingGenerateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiModelService: AiModelService,
  ) {}

  /** 润色话题教学文档，返回润色后 Markdown + 改动列表（失败抛错） */
  async polishForTopic(topicId: string): Promise<PolishResult> {
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

    const draftMarkdown = (topic.teachingMarkdown ?? '').trim();
    if (!draftMarkdown) {
      throw new Error('当前话题还没有教学文档初稿，请先在编辑器中编写并保存');
    }

    const materials = this.collectMaterials(topic);
    return this.callPolishApi(topic, llmConfig, materials, draftMarkdown);
  }

  /** 从数据库资产整理本课材料（供 AI 润色时参考约束） */
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
   * 调用 AI 润色接口，解析分隔标记格式的响应。
   * deepseek-v4-flash 默认开启 thinking 模式，会把全部输出预算花在推理上导致正文为空，
   * 因此这里直接调用 OpenAI 兼容接口并显式关闭 thinking。
   */
  private async callPolishApi(
    topic: any,
    llmConfig: any,
    materials: Materials,
    draftMarkdown: string,
  ): Promise<PolishResult> {
    const prompt = buildTopicTeachingPolishPrompt({
      topicTitle: topic.title,
      sceneTitle: topic.scene.title,
      objective: topic.promptZh ?? '',
      draftMarkdown,
      chunks: materials.chunks.map((item) => this.formatMaterial(item)),
      patterns: materials.patterns.map((item) => this.formatMaterial(item)),
      vocabulary: materials.vocabs.map((item) => this.formatMaterial(item)),
    });
    console.log(`[topic-teaching-polish] topic=${topic.title} model=${llmConfig.model} baseUrl=${llmConfig.baseUrl} draftChars=${draftMarkdown.length} promptChars=${prompt.length}`);

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
        temperature: 0.45,
        max_tokens: 6000,
        thinking: { type: 'disabled' },
      }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`AI 润色调用失败（HTTP ${response.status}）：${JSON.stringify(data).slice(0, 500)}`);
    }
    const raw = String(data?.choices?.[0]?.message?.content ?? '');
    console.log(`[topic-teaching-polish] AI raw: textChars=${raw.length} finish=${data?.choices?.[0]?.finish_reason ?? 'n/a'}`);

    const result = this.parsePolishResponse(raw);
    if (!result.markdown) {
      console.error(`[topic-teaching-polish] AI 返回内容为空，原始响应：${JSON.stringify(data).slice(0, 2000)}`);
      throw new Error('AI 润色返回内容为空');
    }
    console.log(`[topic-teaching-polish] polishedChars=${result.markdown.length} changes=${result.changes.length}`);
    return result;
  }

  /** 解析 AI 返回的分隔标记格式：===POLISHED_START=== / ===POLISHED_END=== / ===CHANGES_START=== / ===CHANGES_END=== */
  private parsePolishResponse(raw: string): PolishResult {
    const polishedMatch = raw.match(/===POLISHED_START===\s*([\s\S]*?)===POLISHED_END===/);
    const changesMatch = raw.match(/===CHANGES_START===\s*([\s\S]*?)===CHANGES_END===/);

    let markdown = '';
    if (polishedMatch?.[1]) {
      markdown = stripFences(polishedMatch[1].trim());
    }
    // 兼容：如果 AI 没按格式输出，把整个响应当润色结果
    if (!markdown) {
      markdown = stripFences(raw);
    }

    let changes: PolishChange[] = [];
    if (changesMatch?.[1]) {
      try {
        const parsed = JSON.parse(changesMatch[1].trim());
        if (Array.isArray(parsed)) {
          changes = parsed.filter(
            (c: any) =>
              typeof c?.before === 'string' &&
              typeof c?.after === 'string' &&
              typeof c?.reason === 'string' &&
              c.before.trim() &&
              c.after.trim(),
          );
        }
      } catch {
        console.warn('[topic-teaching-polish] 无法解析 changes JSON，将返回空数组');
      }
    }

    return { markdown, changes };
  }

  /** 把一条材料整理成 prompt 中的一行：英文 + 释义 + 例句 */
  private formatMaterial(item: TeachingMaterial): string {
    const head = `- \`${item.text}\` —— ${cleanMeaning(item.meaning) || '（无释义）'}`;
    if (!item.examples.length) return head;
    return `${head}\n  例句：${item.examples.map((example) => `\`${example}\``).join('；')}`;
  }
}
