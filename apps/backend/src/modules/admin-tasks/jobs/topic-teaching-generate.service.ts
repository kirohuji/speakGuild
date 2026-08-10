import { Injectable } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AiModelService } from '../../ai-model/ai-model.service';
import { MaterialConstraintService } from '../../content-experiences/material-constraint.service';

/**
 * 话题教学文档生成（Markdown）
 * 供单话题「AI 生成」与场景批量生成共用，保证两者产出一致。
 * 遵守学习包组顺序约束：不得出现后序包知识点，难度与话题/学习包对齐。
 */
@Injectable()
export class TopicTeachingGenerateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiModelService: AiModelService,
    private readonly materialConstraints: MaterialConstraintService,
  ) {}

  /** 为话题生成教学文档，返回清洗后的 Markdown（失败抛错） */
  async generateForTopic(topicId: string): Promise<string> {
    const llmConfig = await this.aiModelService.getLlmConfig();
    if (!llmConfig.apiKey) throw new Error('LLM API Key 未配置');

    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      include: {
        scene: { select: { id: true, title: true, requiredOutputLevel: true } },
        topicPatterns: { include: { pattern: true } },
        topicVocabs: { include: { vocab: true } },
        activeChunks: { include: { chunk: { include: { examples: { take: 2, orderBy: { sortOrder: 'asc' } } } } } },
      },
    });
    if (!topic) throw new Error('学习话题不存在');

    const difficulty = topic.difficulty || topic.scene.requiredOutputLevel || 'L2';

    // ── 组约束上下文：后序包认领材料禁止出现，前序包材料可作为复习提及 ──
    const context = await this.materialConstraints.getGroupContext(topic.sceneId);
    const forbiddenRefs = context.laterScenes.flatMap((scene) => scene.claims.filter((claim) => claim.role === 'learn'));
    const reviewRefs = context.earlierScenes.flatMap((scene) => scene.claims);
    const texts = await this.materialConstraints.resolveMaterialTexts(
      [...forbiddenRefs, ...reviewRefs].map((claim) => ({ kind: claim.kind, materialId: claim.materialId })),
    );
    const forbiddenLines = forbiddenRefs
      .map((claim) => texts.get(`${claim.kind}:${claim.materialId}`))
      .filter((text): text is string => Boolean(text));
    const reviewLines = reviewRefs
      .map((claim) => texts.get(`${claim.kind}:${claim.materialId}`))
      .filter((text): text is string => Boolean(text));

    const parts: string[] = [];
    parts.push(`## 话题信息`);
    parts.push(`- 学习包: ${topic.scene.title}`);
    parts.push(`- 标题: ${topic.title}`);
    parts.push(`- 难度: ${difficulty}`);
    if (topic.description) parts.push(`- 描述: ${topic.description}`);
    if (topic.promptZh) parts.push(`- 训练目标: ${topic.promptZh}`);
    if (topic.promptEn) parts.push(`- 训练目标（英文）: ${topic.promptEn}`);

    if (topic.activeChunks?.length) {
      parts.push(`\n## 句块（实用表达）`);
      for (const tc of topic.activeChunks) {
        parts.push(`- **${tc.chunk.text}** — ${tc.chunk.meaning}`);
        for (const ex of tc.chunk.examples ?? []) parts.push(`  - 例: ${ex.en} → ${ex.zh || ''}`);
      }
    }
    if (topic.topicVocabs?.length) {
      parts.push(`\n## 核心词汇`);
      for (const tv of topic.topicVocabs) parts.push(`- **${tv.vocab.word}** — ${tv.vocab.meaning || ''}`);
    }
    if (topic.topicPatterns?.length) {
      parts.push(`\n## 句式`);
      for (const tp of topic.topicPatterns) parts.push(`- \`${tp.pattern.pattern}\` — ${tp.pattern.meaning || ''}`);
    }
    if (forbiddenLines.length) {
      parts.push(`\n## 禁用知识点（后续学习包内容，绝对不能出现）`);
      parts.push(forbiddenLines.join('、'));
    }
    if (reviewLines.length) {
      parts.push(`\n## 前序复习材料（可提及，但不要作为新知识点展开）`);
      parts.push(reviewLines.join('、'));
    }

    const contextBlock = parts.join('\n');

    const client = createOpenAI({ apiKey: llmConfig.apiKey, baseURL: llmConfig.baseUrl });
    const model = client.chat(llmConfig.model);

    // 清洗输出：DeepSeek 偶发返回空内容，自动重试一次
    let md = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { text } = await generateText({
        model,
        prompt: `你是一名英语学习教学设计专家。请根据以下话题信息，为面向中国英语学习者的「练习助手」撰写一份教学文档（Markdown 格式）。

这份文档会展示在练习页顶部，是学习者开始练习前的**老师讲课**，而不是知识点清单。

## 最重要的一条原则（务必理解）

学习者在本页的其他区域已经能看到本话题绑定的**单词、句型、句块完整列表**，所以教学文档绝不能再罗列一遍：

- 禁止出现「核心词汇」「实用表达」「句型框架」这类纯清单小节，禁止只写 \`word — 释义\` 这种条目式内容；
- 你的任务是**把这些知识点讲懂、讲透**：每个知识点讲清楚「是什么 → 怎么用（结构/搭配）→ 什么时候用（场景）→ 例句 → 容易错在哪」；
- 例句必须结合本话题场景来造，是对话里真实会说的话，不要写与场景无关的例句；
- 学习者读完这篇文档，应该能直接开口——知道接下来该说什么、怎么说、为什么这么说。

## 写作要求

1. 语言：**全部用中文写**（仅英文例句保留英文）
2. 语气：亲切、鼓励，像老师在课前做 briefing，讲人话、不端着
3. 长度：500-900 字
4. 排版：规范的 Markdown，可以用 ## 小标题帮助分段，但**不要套固定模板**
5. 目标难度：${difficulty}，词汇与表达控制在对应等级

## 怎么写（自由发挥，不要固定结构）

不要用固定的章节标题和顺序，像老师上课一样把知识点自然地讲出来，怎么讲清楚就怎么组织。几点建议（不是强制）：

- 可以先用一两句话把场景带出来，让学习者进入情境，再顺势引出要学的知识点；
- 每个知识点讲清楚：意思 → 怎么用（结构/搭配）→ 什么时候用（场景）→ 结合场景的例句 → 容易错在哪；
- 至少给出 1 组「易混辨析」：把两个容易混淆的词/表达放在一起，讲清区别和各自的使用场合；
- 用生活化的类比或记忆提示，帮助学习者记住用法；
- 篇幅上保证「讲透」为主，不要为了凑结构堆内容，也不要只列条目不解释。

## 硬性约束（必须遵守）

- 禁止出现任何「禁用知识点」中的内容（它们是后续学习包的知识点，出现即算泄露）。
- 「前序复习材料」只允许作为例句或复习提示轻量带过，不要当作新知识点展开讲解。

---

## 输入信息

${contextBlock}

## 输出

直接输出 Markdown 文档，不要任何额外说明。`,
        temperature: 0.5,
        maxOutputTokens: 3000,
      });
      md = text
        .replace(/```markdown\s*/gi, '')
        .replace(/```md\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      if (md) break;
    }
    if (!md) throw new Error('AI 生成教学文档失败：模型返回内容为空，请重试');
    return md;
  }
}
