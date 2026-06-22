import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { DialogueTurnJudgeDto } from './dto/english-feedback.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiQuotaService } from '../../common/ai-quota/ai-quota.service';

@Injectable()
export class EnglishPracticeAiService {
  private readonly logger = new Logger(EnglishPracticeAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: AiQuotaService,
  ) {}

  private getProvider() {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new BadRequestException('未配置 DEEPSEEK_API_KEY');
    const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
    return (model: string) => client.chat(model);
  }

  private parseLevel(value: unknown) {
    const match = String(value ?? '').match(/L[1-5]/i);
    return match ? match[0].toUpperCase() : 'L1';
  }

  private extractJson(text: string) {
    return text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? text;
  }

  private normalizeLearningGoals(goals?: string[]) {
    const aliases: Record<string, string> = {
      arrival_roots: 'daily_scenes',
      daily_hustle: 'daily_scenes',
      people: 'daily_scenes',
      work_study: 'course_system',
      crisis_mode: 'daily_scenes',
      out_about: 'daily_scenes',
    };
    const valid = new Set(['foundation_start', 'daily_scenes', 'exam_ielts', 'story_roleplay', 'course_system']);
    return [...new Set((goals ?? [])
      .map((goal) => aliases[String(goal).trim()] ?? String(goal).trim())
      .filter((goal) => valid.has(goal)))]
      .slice(0, 3);
  }

  async assessPlacement(
    dto: {
      learningGoals: string[];
      answers: Array<{ promptId: string; prompt: string; answer: string }>;
    },
    userId: string,
  ) {
    const provider = this.getProvider();
    const cleanGoals = this.normalizeLearningGoals(dto.learningGoals);
    const cleanAnswers = (dto.answers ?? [])
      .map((answer) => ({
        promptId: String(answer.promptId ?? ''),
        prompt: String(answer.prompt ?? '').trim(),
        answer: String(answer.answer ?? '').trim(),
      }))
      .filter((answer) => answer.prompt && answer.answer)
      .slice(0, 5);

    const scenes = await this.prisma.scene.findMany({
      select: {
        id: true,
        packageType: true,
        title: true,
        location: true,
        description: true,
        requiredOutputLevel: true,
        requiredUserLevel: true,
        category: { select: { name: true } },
        _count: { select: { trainingTopics: true, storyEpisodes: true } },
        trainingTopics: {
          select: { title: true, difficulty: true },
          orderBy: { sortOrder: 'asc' },
          take: 4,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });

    const goalTypeHints: Record<string, string> = {
      foundation_start: 'foundation',
      daily_scenes: 'daily',
      exam_ielts: 'exam',
      story_roleplay: 'story',
      course_system: 'course',
      arrival_roots: 'daily',
      daily_hustle: 'daily',
      people: 'daily',
      work_study: 'course',
      crisis_mode: 'daily',
      out_about: 'daily',
    };
    const preferredPackageTypes = [...new Set(cleanGoals.map((goal) => goalTypeHints[goal]).filter(Boolean))];

    const candidateText = scenes.map((scene, index) => [
      `${index + 1}. id=${scene.id}`,
      `packageType=${scene.packageType}`,
      `title=${scene.title}`,
      `category=${scene.category.name}`,
      `location=${scene.location}`,
      `requiredOutputLevel=${scene.requiredOutputLevel}`,
      `description=${scene.description ?? ''}`,
      `topics=${scene.trainingTopics.map((topic) => `${topic.title}(${topic.difficulty})`).join(' / ')}`,
    ].join(' | ')).join('\n');

    const system = `You are an English speaking placement assessor for a mobile learning app.
Evaluate the learner's written/voice-transcribed answers as speaking output evidence.
Return only JSON. Be practical, concise, and learner-friendly.

Level rubric:
- L1: short phrases/simple sentences; can handle greetings, ordering, basic needs.
- L2: can complete basic real-life tasks like check-in, shopping, appointments, simple problems.
- L3: can explain reasons, preferences, simple conflicts, and keep a short conversation coherent.
- L4: can negotiate, persuade, describe tradeoffs, and express more complex opinions.
- L5: can discuss open-ended topics naturally with nuance and strong control.

Recommend learning units from the provided candidate list only. Use exact candidate ids.`;

    const user = `## Learner goals
${cleanGoals.length ? cleanGoals.join(', ') : 'not specified'}

## Preferred package types inferred from goals
${preferredPackageTypes.length ? preferredPackageTypes.join(', ') : 'not specified'}

## Assessment answers
${cleanAnswers.map((answer, index) => `Task ${index + 1}: ${answer.prompt}\nLearner: ${answer.answer}`).join('\n\n')}

## Candidate learning units
${candidateText || 'No candidates'}

Return this exact JSON shape:
{
  "outputLevel": "L1|L2|L3|L4|L5",
  "confidence": 0.72,
  "summary": "中文，2句话总结当前输出能力",
  "strengths": ["中文优势1", "中文优势2"],
  "improvements": ["中文改进1", "中文改进2"],
  "recommendedUnitIds": ["candidate scene id", "candidate scene id", "candidate scene id"],
  "recommendationReason": "中文说明为什么推荐这些学习包",
  "nextStep": "中文的一句话下一步建议"
}`;

    const result = await generateText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.25,
      maxOutputTokens: 1800,
    });

    if (result.usage) {
      this.quotaService.recordTokens(userId, result.usage.totalTokens ?? 0);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(this.extractJson(result.text));
    } catch {
      parsed = null;
    }

    const recommendedIds = new Set(
      Array.isArray(parsed?.recommendedUnitIds)
        ? parsed.recommendedUnitIds.map((id: unknown) => String(id))
        : [],
    );
    const fallbackLevel = cleanAnswers.some((answer) => answer.answer.length > 120) ? 'L3' : cleanAnswers.some((answer) => answer.answer.length > 50) ? 'L2' : 'L1';
    const outputLevel = this.parseLevel(parsed?.outputLevel ?? fallbackLevel);
    const recommendedUnits = scenes
      .filter((scene) => recommendedIds.has(scene.id))
      .slice(0, 3);
    const fallbackScenes = preferredPackageTypes.length
      ? [
          ...scenes.filter((scene) => preferredPackageTypes.includes(scene.packageType)),
          ...scenes.filter((scene) => !preferredPackageTypes.includes(scene.packageType)),
        ]
      : scenes;
    const finalRecommendedUnits = (recommendedUnits.length ? recommendedUnits : fallbackScenes.slice(0, 3)).map((scene) => ({
      id: scene.id,
      packageType: scene.packageType,
      title: scene.title,
      categoryName: scene.category.name,
      location: scene.location,
      description: scene.description,
      requiredOutputLevel: scene.requiredOutputLevel,
      topicCount: scene._count.trainingTopics,
      scriptCount: scene._count.storyEpisodes,
    }));

    const analysis = {
      outputLevel,
      confidence: Number(parsed?.confidence ?? 0.6),
      summary: String(parsed?.summary ?? '已根据你的测评回答生成初步画像。'),
      strengths: Array.isArray(parsed?.strengths) ? parsed.strengths.map(String).slice(0, 4) : [],
      improvements: Array.isArray(parsed?.improvements) ? parsed.improvements.map(String).slice(0, 4) : [],
      recommendationReason: String(parsed?.recommendationReason ?? '这些学习包和你的目标与当前输出水平相对匹配。'),
      nextStep: String(parsed?.nextStep ?? '建议先完成一个推荐学习包中的对话任务。'),
      recommendedUnits: finalRecommendedUnits,
      raw: result.text,
    };

    const outputLevelDetail = {
      source: 'ai_placement_assessment',
      assessedAt: new Date().toISOString(),
      confidence: analysis.confidence,
      summary: analysis.summary,
      strengths: analysis.strengths,
      improvements: analysis.improvements,
      recommendationReason: analysis.recommendationReason,
      nextStep: analysis.nextStep,
      recommendedUnits: finalRecommendedUnits.map((unit) => ({
        id: unit.id,
        packageType: unit.packageType,
        title: unit.title,
        requiredOutputLevel: unit.requiredOutputLevel,
      })),
      answers: cleanAnswers.map((answer) => ({
        promptId: answer.promptId,
        prompt: answer.prompt,
        answer: answer.answer,
      })),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        outputLevel,
        learningGoals: cleanGoals,
        outputLevelDetail,
      },
    });

    return {
      outputLevel,
      learningGoals: cleanGoals,
      outputLevelDetail,
      analysis,
    };
  }

  /** 单轮 NPC 对话输入判定：把开放式用户输入转换为 Ink 可消费的变量 */
  async judgeDialogueTurn(dto: DialogueTurnJudgeDto, userId?: string) {
    const provider = this.getProvider();
    const objectives = dto.objectives?.length ? dto.objectives : ['respond_to_npc'];
    const targetChunks = dto.targetChunks ?? [];
    const mode = dto.mode ?? 'communicative';
    const requiredChunks = dto.requiredChunks ?? [];
    const targetWords = dto.targetWords ?? [];
    const essentialSlots = dto.essentialSlots ?? [];

    let system = `You evaluate one turn in an English speaking practice dialogue.
Return only JSON. Be practical, learner-friendly, and tolerant of normal learner variation.

The "passed" field answers only this question: did the learner communicate the expected intent clearly enough for the NPC to understand and continue the conversation?

Evaluation rules:
- Pass when the required information or communicative intent is conveyed, even if the learner does not use a suggested target chunk.
- Pass when the learner uses a natural paraphrase, a different sentence pattern, or a slightly incomplete but understandable sentence.
- Minor grammar, spelling, punctuation, capitalization, or speech-to-text errors must not cause failure when the meaning is clear.
- Target chunks are optional learning suggestions. Track naturally used chunks in "chunksUsed", but never require exact wording and never fail a turn only because no target chunk was used.
- Count a target chunk as used when the learner uses its recognizable structure with reasonable substitutions or minor learner errors. Return the canonical target chunk text from the provided list.
- Mark "passed" false only when the response is off-topic, too vague to satisfy the intent, missing essential requested information, or genuinely hard to understand.
- Keep "objectiveCompleted" separate from "chunksUsed". An objective can be completed with zero chunks used.

Determine the user's intent, completed objectives, and naturally used target chunks.
Use short snake_case strings for intent and Ink variables.

## Correction & Retry
When the learner's response is understandable but unnatural:
1. Set "passed" to true (communication succeeded).
2. Provide a natural "correction" version.
3. Provide a more fluent "upgraded" version.
4. Set "retryRequired" to true, with a friendly "retryPrompt".
5. Identify one "focusChunk" the learner should practice.
6. List grammar issues in "grammarIssues". Be concise (1-3 items max).`;

    if (mode === 'targeted_output') {
      system += `

## Targeted Output Mode

When mode is "targeted_output", evaluate only the targets provided in the request.

- If requiredChunks are provided, the learner should use one of them or a clear equivalent structure.
- If targetWords are provided, check whether the learner naturally used those words or close inflected forms.
- If essentialSlots are provided, check whether the required meaning/content was expressed.
- Return targetWordsUsed as the target words used naturally.
- Return missingTargets as required chunks, target words, or slots that were not expressed.
- If any required target is missing, mark "passed": false unless allowParaphrase is true and the learner expressed the same meaning naturally.`;
    }

    let user = `## Context
Input node: ${dto.inputNodeId ?? 'unknown'}
Expected intent: ${dto.expectedIntent ?? 'infer_from_context'}
Judge mode: ${mode}
NPC says: ${dto.npcText}

## Practice objectives
${objectives.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## Target chunks
${targetChunks.length ? targetChunks.join('\n') : 'None'}`;

    if (requiredChunks.length) {
      user += `\n\n## Required Chunks (targeted output)
${requiredChunks.join('\n')}`;
    }
    if (targetWords.length) {
      user += `\n\n## Target Words (targeted output)
${targetWords.join('\n')}`;
    }
    if (essentialSlots.length) {
      user += `\n\n## Essential Slots (targeted output)
${essentialSlots.join('\n')}`;
    }

    user += `\n\n## User response
${dto.userText}

Return this exact JSON shape:
{
  "intent": "short_snake_case_intent",
  "passed": true,
  "objectiveCompleted": ["objective text from the list"],
  "chunksUsed": ["target chunk text from the list"],
  "targetWordsUsed": ["target word used naturally"],
  "missingTargets": ["required target not expressed"],
  "inkVariables": {
    "objective_done": true,
    "user_intent": "short_snake_case_intent",
    "needs_retry": false
  },
  "feedback": "中文一句话反馈",
  "confidence": 0.86,
  "correction": "natural correction version or null",
  "upgraded": "more fluent version or null",
  "retryRequired": false,
  "retryPrompt": "friendly retry prompt in Chinese or null",
  "focusChunk": "chunk to focus on or null",
  "grammarIssues": [{"type": "grammar|collocation|chinglish|unnatural", "original": "...", "correction": "..."}]
}

Before returning JSON, check that "passed" reflects communicative success rather than target-chunk matching.
For correction/upgraded/retryRequired: only populate these when the response is understandable but unnatural. Omit or set to null when not applicable.`;

    const result = await generateText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    // 记录 token 消耗
    if (userId && result.usage) {
      this.quotaService.recordTokens(userId, result.usage.totalTokens ?? 0)
    }

    const jsonText = result.text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? result.text;
    try {
      const parsed = JSON.parse(jsonText);
      const intent = String(parsed.intent || dto.expectedIntent || 'unknown');
      const passed = Boolean(parsed.passed);
      return {
        intent,
        passed,
        objectiveCompleted: Array.isArray(parsed.objectiveCompleted) ? parsed.objectiveCompleted : [],
        chunksUsed: Array.isArray(parsed.chunksUsed) ? parsed.chunksUsed : [],
        targetWordsUsed: Array.isArray(parsed.targetWordsUsed) ? parsed.targetWordsUsed : [],
        missingTargets: Array.isArray(parsed.missingTargets) ? parsed.missingTargets : [],
        inkVariables: {
          ...(parsed.inkVariables && typeof parsed.inkVariables === 'object' ? parsed.inkVariables : {}),
          objective_done: passed,
          user_intent: intent,
          needs_retry: !passed,
        },
        feedback: String(parsed.feedback || ''),
        confidence: Number(parsed.confidence ?? 0),
        correction: parsed.correction || null,
        upgraded: parsed.upgraded || null,
        retryRequired: Boolean(parsed.retryRequired),
        retryPrompt: parsed.retryPrompt || null,
        focusChunk: parsed.focusChunk || null,
        grammarIssues: Array.isArray(parsed.grammarIssues) ? parsed.grammarIssues : [],
        raw: result.text,
      };
    } catch {
      const fallbackIntent = dto.expectedIntent || 'unknown';
      return {
        intent: fallbackIntent,
        passed: false,
        objectiveCompleted: [],
        chunksUsed: [],
        targetWordsUsed: [],
        missingTargets: targetWords.length ? [...targetWords] : [],
        inkVariables: {
          objective_done: false,
          user_intent: fallbackIntent,
          needs_retry: true,
        },
        feedback: '暂时无法稳定判断这一轮回答，请再试一次。',
        confidence: 0,
        correction: null,
        upgraded: null,
        retryRequired: false,
        retryPrompt: null,
        focusChunk: null,
        grammarIssues: [],
        raw: result.text,
      };
    }
  }

  buildPracticeSessionAnalysisPrompt(session: any): { system: string; user: string } {
    const topic = session.topicSnapshot ?? {};
    const scene = session.sceneSnapshot ?? {};
    const objectives = Array.isArray(session.objectivesSnapshot) ? session.objectivesSnapshot : [];
    const chunks = Array.isArray(session.chunksSnapshot) ? session.chunksSnapshot : [];
    const vocabularies = Array.isArray(session.vocabSnapshot) ? session.vocabSnapshot : [];
    const patterns = Array.isArray(session.sentencePatternsSnapshot) ? session.sentencePatternsSnapshot : [];
    const turns = Array.isArray(session.turns) ? session.turns : [];

    const chunkText = chunks.map((chunk, index) => {
      const examples = Array.isArray(chunk.examples)
        ? chunk.examples.slice(0, 2).map((example) => example.en).filter(Boolean).join(' / ')
        : '';
      return `${index + 1}. ${chunk.text}｜${chunk.meaning}${examples ? `｜例: ${examples}` : ''}`;
    }).join('\n') || '无';

    const vocabText = vocabularies.slice(0, 30).map((vocab, index) =>
      `${index + 1}. ${vocab.word}｜${vocab.meaning}`,
    ).join('\n') || '无';

    const patternText = patterns.map((pattern, index) =>
      `${index + 1}. ${pattern.pattern}｜${pattern.meaning ?? ''}｜${pattern.example ?? ''}`,
    ).join('\n') || '无';

    const dialogueText = turns.map((turn) => {
      const judgement = turn.judgement && typeof turn.judgement === 'object'
        ? `\n  判断: ${JSON.stringify({
            passed: turn.judgement.passed,
            intent: turn.judgement.intent,
            objectiveCompleted: turn.judgement.objectiveCompleted,
            chunksUsed: turn.judgement.chunksUsed,
          })}`
        : '';
      return `轮次 ${turn.round}:\n  NPC: ${turn.npcText}\n  用户: ${turn.userText}\n  inputNodeId: ${turn.inputNodeId ?? 'N/A'}\n  已完成目标: ${(turn.objectivesCompleted ?? []).join(', ') || '无'}\n  已用 Chunk: ${(turn.chunksUsed ?? []).join(', ') || '无'}${judgement}`;
    }).join('\n\n') || '无对话';

    const system = `你是一位专业的英语口语教练。你只评估用户输出，不评价 NPC 台词。你需要结合练习话题、场景、目标 chunk、词汇、句型和对话上下文做复盘。

重要：你必须逐轮分析用户的每一句话，不能只看最后一轮。整体评价要覆盖用户在整个对话过程中的表现和进步。

请用中文回答，语气鼓励但具体。只返回 JSON。`;

    const user = `## 场景上下文
场景: ${scene.title ?? ''}
类别: ${scene.category ?? ''}
地点: ${scene.location ?? ''}
说明: ${scene.description ?? '无'}

## 练习话题
标题: ${topic.title ?? ''}
英文题目: ${topic.promptEn ?? ''}
中文题目: ${topic.promptZh ?? ''}
讲解摘要: ${topic.description ?? '无'}
知识点: ${topic.knowledgePoints ?? '无'}
难度: ${topic.difficulty ?? ''}

## 任务目标
${objectives.map((objective, index) => `${index + 1}. ${objective}`).join('\n') || '无'}

## 目标 Chunk
${chunkText}

## 场景词汇
${vocabText}

## 句型
${patternText}

## 本次用户对话（共 ${turns.length} 轮，请逐轮分析）
${dialogueText}

请严格返回以下 JSON：

\`\`\`json
{
  "overallScore": 75,
  "status": "completed|needs_retry|incomplete",
  "summary": "2-3 句总结，评价用户在整段对话中的整体表现和进步",
  "objectiveAnalysis": [
    { "objective": "目标文本", "completed": true, "comment": "结合用户具体输出解释，标注在哪一轮完成的" }
  ],
  "chunkUsageAnalysis": [
    { "chunk": "目标 chunk", "used": true, "context": "用户在哪句话里自然使用；没用则说明可如何使用" }
  ],
  "vocabularyUsageAnalysis": [
    { "word": "词汇", "used": true, "suggestion": "可选，说明如何补进表达" }
  ],
  "grammarHighlights": [
    { "type": "grammar|collocation|chinglish|unnatural|logic", "original": "用户原文片段", "correction": "更自然表达", "round": 1 }
  ],
  "roundByRound": [
    { "round": 1, "comment": "一句话点评这一轮的表现" }
  ],
  "upgradedAnswer": {
    "clear": "清晰基础版",
    "natural": "自然口语版",
    "advanced": "进阶版"
  },
  "strengths": ["优势1", "优势2"],
  "improvements": ["改进1", "改进2"],
  "nextStepSuggestion": "下一步建议，最好指向具体 chunk/词汇/句型"
}
\`\`\`

注意：
- roundByRound 必须包含每一轮（共 ${turns.length} 轮），不可遗漏
- grammarHighlights 中每个问题必须标注 round 字段，指出是哪一轮出现的
- summary 要综合所有轮次，不能只评价最后一轮
- objectiveAnalysis 中如果某个目标在某一轮完成了，comment 要引用该轮用户的实际表达`;

    return { system, user };
  }

  async summarizePracticeSession(session: any, userId?: string) {
    const turns = Array.isArray(session.turns) ? session.turns : [];
    this.logger.log(`[summarize] 收到 ${turns.length} 轮对话，准备发送 AI 复盘`);
    turns.forEach((t: any) => {
      this.logger.log(`  → round=${t.round} | userText="${t.userText?.slice(0, 50)}..."`);
    });

    const provider = this.getProvider();
    const { system, user } = this.buildPracticeSessionAnalysisPrompt(session);

    // 打印发送给 AI 的对话片段（截取关键部分）
    const dialoguePreview = turns.map((t: any) => `[round=${t.round}] NPC:${t.npcText?.slice(0, 30)}... → 用户:${t.userText?.slice(0, 30)}...`).join(' | ');
    this.logger.log(`[summarize] 对话预览: ${dialoguePreview || '无对话'}`);

    const result = await generateText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.45,
      maxOutputTokens: 2800,
    });

    // 记录 token 消耗
    if (userId && result.usage) {
      this.quotaService.recordTokens(userId, result.usage.totalTokens ?? 0)
    }

    const jsonText = result.text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? result.text;
    let analysis: any = null;
    try {
      analysis = JSON.parse(jsonText);
    } catch {
      analysis = null;
    }

    // 自动生成复练卡片
    if (userId && analysis) {
      try {
        await this.generateReviewCardsFromAnalysis(
          userId,
          session.id,
          analysis,
          session.topicId,
        );
      } catch (err: any) {
        this.logger.warn(`[summarize] 自动生成复练卡失败: ${err.message}`);
      }
    }

    return { analysis, raw: result.text };
  }

  /** 从分析结果自动生成复练卡片（错句/Chunk/升级/词汇） */
  private async generateReviewCardsFromAnalysis(
    userId: string,
    sessionId: string,
    analysis: any,
    topicId: string,
  ) {
    // 从 grammarHighlights 生成错句卡
    for (const issue of analysis.grammarHighlights ?? []) {
      if (issue.original && issue.correction) {
        await this.createIfNotExist({
          userId, type: 'error_sentence',
          original: issue.original, corrected: issue.correction,
          sourceType: 'PracticeSession', sourceId: sessionId,
          sourceSnapshot: { round: issue.round },
          masteryStatus: 'learning', nextReviewAt: this.nextDay(),
        })
      }
    }

    // 从 chunkUsageAnalysis 生成未使用的 Chunk 卡
    for (const chunk of analysis.chunkUsageAnalysis ?? []) {
      if (!chunk.used) {
        await this.createIfNotExist({
          userId, type: 'chunk', chunkText: chunk.chunk, original: chunk.chunk,
          sourceType: 'PracticeSession', sourceId: sessionId,
          masteryStatus: 'learning', nextReviewAt: this.nextDay(),
        })
      }
    }

    // 从 upgradedAnswer 生成升级卡
    if (analysis.upgradedAnswer?.natural) {
      await this.createIfNotExist({
        userId, type: 'upgraded',
        original: analysis.upgradedAnswer.original ?? '',
        corrected: analysis.upgradedAnswer.natural,
        sourceType: 'PracticeSession', sourceId: sessionId,
        masteryStatus: 'learning', nextReviewAt: this.nextDay(),
      })
    }

    // 高优先级词汇未使用 → 词汇复练卡
    await this.generateVocabReviewCards(userId, sessionId, analysis, topicId);
  }

  /** 去重创建 ExpressionItem：组合条件去重 */
  private async createIfNotExist(data: {
    userId: string;
    type: string;
    original?: string;
    corrected?: string;
    chunkText?: string;
    sourceType?: string;
    sourceId?: string;
    sourceSnapshot?: any;
    masteryStatus?: string;
    nextReviewAt?: Date;
  }) {
    const where: any = {
      userId: data.userId,
      sourceType: data.sourceType ?? 'PracticeSession',
      sourceId: data.sourceId ?? '',
      type: data.type as any,
    };
    if (data.type === 'error_sentence' || data.type === 'upgraded') {
      where.original = data.original ?? '';
      where.corrected = data.corrected ?? '';
    } else if (data.type === 'chunk') {
      where.chunkText = data.chunkText ?? '';
    } else if (data.type === 'word') {
      where.original = data.original ?? '';
    }

    const existing = await this.prisma.expressionItem.findFirst({ where, select: { id: true } });
    if (!existing) {
      await (this.prisma as any).expressionItem.create({ data });
    }
  }

  /** 高优先级词汇未使用 → 生成词汇复练卡 */
  private async generateVocabReviewCards(
    userId: string,
    sessionId: string,
    _analysis: any,
    topicId: string,
  ) {
    if (!topicId) return;
    try {
      const highPriorityVocabs = await (this.prisma as any).trainingTopicVocab.findMany({
        where: { topicId, vocab: { outputPriority: 'high' } },
        include: { vocab: true },
      });
      for (const tv of highPriorityVocabs) {
        const usedInTurns = await (this.prisma as any).practiceTurn.findMany({
          where: {
            sessionId,
            userText: { contains: tv.vocab.word, mode: 'insensitive' },
          },
          take: 1,
        });
        if (usedInTurns.length === 0) {
          await this.createIfNotExist({
            userId,
            type: 'word',
            original: tv.vocab.word,
            sourceType: 'PracticeSession',
            sourceId: sessionId,
            masteryStatus: 'learning',
            nextReviewAt: this.nextDay(),
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`[generateVocabReviewCards] 失败: ${err.message}`);
    }
  }

  private nextDay(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  }

  /** 批量翻译：单词 + 例句列表 → { wordZh, examplesZh[] } */
  private async batchTranslate(
    word: string,
    examples: Array<{ en: string }>,
  ): Promise<{ wordZh: string; examplesZh: string[] }> {
    try {
      const provider = this.getProvider()
      const exampleLines = examples.map((ex, i) => `${i + 1}. ${ex.en}`).join('\n')
      const { text } = await generateText({
        model: provider('deepseek-chat'),
        prompt: `Translate the following English word and sentences to Simplified Chinese.

Word: "${word}"
${examples.length ? `Examples:\n${exampleLines}` : ''}

Return ONLY a JSON object (no markdown):
{
  "wordZh": "单词的中文翻译",
  "examplesZh": ["例句1中文", "例句2中文", ...]
}`,
        temperature: 0,
        maxOutputTokens: 400,
      })
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return {
        wordZh: String(parsed.wordZh ?? ''),
        examplesZh: Array.isArray(parsed.examplesZh)
          ? parsed.examplesZh.map((s: any) => String(s ?? ''))
          : [],
      }
    } catch {
      return { wordZh: '', examplesZh: [] }
    }
  }

  /** @deprecated Use DictionaryService.lookupWord() instead. Reads from dictionary_entry cache if available. */
  async enrichWord(word: string, _englishDefinitions?: string) {
    const key = word.toLowerCase().trim();

    // Check new dictionary_entry cache
    const cached = await this.prisma.dictionaryEntry.findUnique({ where: { word: key } });
    if (cached) {
      const clusters = cached.senseClusters as any[];
      const primaryCluster = clusters?.find((c: any) => c.rank === 1);
      const primarySense = primaryCluster?.senses?.[0];
      return {
        chineseTranslation: primarySense?.translations?.zh ?? '',
        phonetic: (cached.pronunciations as any[])?.find((p: any) => p.isPreferred)?.ipa ?? '',
        audioUrl: '',
        meanings: clusters?.flatMap((c: any) =>
          c.senses?.map((s: any) => ({
            partOfSpeech: s.partOfSpeech,
            chineseGloss: s.translations?.zh ?? s.definition,
          })) ?? []
        ) ?? [],
        examples: clusters?.flatMap((c: any) =>
          c.senses?.flatMap((s: any) =>
            (s.examples ?? []).map((e: any) => ({ en: e.en, zh: e.zh, level: e.relevance }))
          ) ?? []
        ) ?? [],
        memoryTip: '',
      };
    }

    // Fallback: old dictionaryapi.dev
    const dictResult = await this.enrichFromDictionary(key);
    if (dictResult) {
      const translated = await this.batchTranslate(word, dictResult.examples);
      return {
        chineseTranslation: translated.wordZh,
        phonetic: dictResult.phonetic,
        audioUrl: dictResult.audioUrl,
        meanings: dictResult.meanings,
        examples: dictResult.examples.map((ex: any, i: number) => ({
          ...ex,
          zh: translated.examplesZh[i] ?? '',
        })),
        memoryTip: '',
      };
    }

    // Last resort: DeepSeek AI
    return this.enrichFromAI(word);
  }

  /** 批量翻译：单词 + 例句列表 → { wordZh, examplesZh[] } */
  private async enrichFromDictionary(word: string) {
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      )
      if (!res.ok) return null

      const entries: DictApiEntry[] = await res.json()
      const entry = entries[0]
      if (!entry) return null

      // 发音
      const phonetic = entry.phonetic
        ?? entry.phonetics.find((p) => p.text)?.text
        ?? undefined
      const audioUrl = entry.phonetics.find((p) => p.audio)?.audio ?? undefined

      // 义项
      const meanings = entry.meanings.flatMap((m) =>
        m.definitions.map((d) => ({
          partOfSpeech: m.partOfSpeech,
          chineseGloss: d.definition,
        })),
      )

      // 例句（去重，最多 5 条）
      const seen = new Set<string>()
      const examples = entry.meanings
        .flatMap((m) =>
          m.definitions
            .filter((d) => d.example && !seen.has(d.example))
            .map((d) => {
              seen.add(d.example!)
              return { en: d.example!, zh: '', level: 'intermediate' as const }
            }),
        )
        .slice(0, 5)

      return {
        phonetic,
        audioUrl,
        meanings: meanings.slice(0, 8),
        examples,
      }
    } catch {
      return null
    }
  }

  /** DeepSeek AI 完整回退（罕见词/短语） */
  private async enrichFromAI(word: string) {
    const provider = this.getProvider();

    const prompt = `请为英语单词/短语"${word}"提供学习辅助信息。

请严格返回以下 JSON（不要 Markdown 代码块包裹）：

{
  "chineseTranslation": "中文释义",
  "meanings": [
    { "partOfSpeech": "词性", "chineseGloss": "中文义项" }
  ],
  "examples": [
    { "en": "自然英语例句。", "zh": "中文翻译。", "level": "basic" },
    { "en": "Intermediate example.", "zh": "中文翻译。", "level": "intermediate" },
    { "en": "Advanced/nuanced example.", "zh": "中文翻译。", "level": "advanced" }
  ],
  "memoryTip": "一句话记忆技巧（中文，30字以内）"
}

Rules:
- Exactly 5 examples: 2 basic, 1 intermediate, 2 advanced
- All "zh" must be natural, accurate Chinese translations
- Use diverse real-world scenarios (daily life, study, work, travel) for examples
- memoryTip must be practical and memorable for Chinese learners`;

    const { text } = await generateText({
      model: provider('deepseek-chat'),
      prompt,
      temperature: 0.3,
      maxOutputTokens: 900,
    });

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { chineseTranslation: '（数据加载失败）', meanings: [], examples: [], memoryTip: '' };
    }
  }

  /** AI 生成练习题：根据关键词和题型批量生成练习项目 */
  async generateDrills(dto: {
    type: 'chunk_substitution' | 'vocab_sentence_building' | 'sentence_decomposition' | 'pattern_drill';
    keyword: string;
    meaning?: string;
    direction?: string;
    kind?: string;
    count?: number;
    chunks?: string[];
    sentence?: string;
    zh?: string;
    generateSentence?: boolean;
    generateHints?: boolean;
    polish?: boolean;
    itemCount?: number;
    items?: Array<{ zh: string; answer: string; hint?: string }>;
  }) {
    const provider = this.getProvider();
    const count = Math.min(dto.count ?? 4, 8);
    const direction = dto.direction ?? 'zh_to_en';
    const kind = dto.kind ?? 'chunk';

    // ── Generate per-item teaching hints ──
    if (dto.generateHints && dto.items?.length) {
      const system = `You are an ESL teaching assistant for Chinese learners of English.
For each exercise item below, write a short, helpful teaching hint (1-2 sentences in Chinese).
Each hint should guide the learner on how to construct the answer without giving it away completely.

Tailor hints to the exercise type:
- chunk_substitution: hint about how to use the target chunk naturally in a sentence
- pattern_drill: hint about how to fill the pattern's slot with the right words
- vocab_sentence_building: hint about which sentence pattern or collocation to use for this specific item

Return ONLY a JSON object: { "hints": ["hint1", "hint2", ...] }`;

      const itemsJson = dto.items.map((it, i) => `[${i + 1}] ZH: ${it.zh} | Answer: ${it.answer}`).join('\n')
      const user = `Type: ${dto.type}, Keyword: "${dto.keyword}"${dto.meaning ? `, Meaning: ${dto.meaning}` : ''}\nExercises:\n${itemsJson}`;

      try {
        const { text } = await generateText({
          model: provider('deepseek-chat'),
          system,
          prompt: user,
          temperature: 0.6,
          maxOutputTokens: 500,
        });
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        return { hints: [] };
      }
    }

    // ── Polish existing items: improve Chinese prompts and English answers ──
    if (dto.polish && dto.items?.length) {
      const system = `You are an ESL content editor for Chinese learners of English.
Polish the following exercise items to make them more natural, idiomatic, and pedagogically effective.

Rules:
- Improve the Chinese prompts (zh) to sound more natural and conversational.
- Refine the English answers (answer) to be more idiomatic while keeping the target keyword "${dto.keyword}".
- Keep the original meaning and difficulty level.
- For en_to_zh direction, the "zh" field contains the English sentence and "answer" is Chinese — polish both accordingly.
- Fix any grammar issues, awkward phrasing, or unnatural collocations.
- Each answer MUST still naturally include the target chunk/pattern: "${dto.keyword}".

Return ONLY a JSON object (no markdown):
{ "items": [{ "zh": "polished Chinese", "answer": "polished English" }, ...] }`;

      const itemsJson = dto.items.map((it, i) =>
        `[${i + 1}] ZH: ${it.zh} | Answer: ${it.answer}`
      ).join('\n')
      const user = `Type: ${dto.type}, Keyword: "${dto.keyword}"${dto.meaning ? `, Meaning: ${dto.meaning}` : ''}, Direction: ${dto.direction ?? 'zh_to_en'}\nItems to polish:\n${itemsJson}`;

      try {
        const { text } = await generateText({
          model: provider('deepseek-chat'),
          system,
          prompt: user,
          temperature: 0.5,
          maxOutputTokens: 1500,
        });
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        return { items: dto.items };
      }
    }

    if (dto.type === 'chunk_substitution') {
      const system = `You are an ESL exercise generator for Chinese learners of English.
Create ${count} Chinese→English translation exercises focusing on the target word/chunk.

Rules:
- Each item has a Chinese prompt (zh) and the expected English answer (answer).
- The English answer MUST naturally include the target word/chunk: "${dto.keyword}".
- If direction is "en_to_zh", swap: the prompt is the English sentence and answer is the Chinese translation.
- Keep sentences natural, practical, and at an intermediate level.
- Vary the sentence contexts (different situations, verb tenses, subjects).

Return ONLY a JSON object (no markdown):
{ "items": [{ "zh": "中文句子", "answer": "English sentence" }, ...] }`;

      const user = `Target: "${dto.keyword}"${dto.meaning ? ` (${dto.meaning})` : ''}
Direction: ${direction}
Kind: ${kind}
Count: ${count}`;

      const { text } = await generateText({
        model: provider('deepseek-chat'),
        system,
        prompt: user,
        temperature: 0.7,
        maxOutputTokens: 1200,
      });
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return { items: (parsed.items ?? []).slice(0, count) };
      } catch {
        return { items: [] };
      }
    }

    if (dto.type === 'vocab_sentence_building') {
      const availableChunks = dto.chunks?.length ? dto.chunks.slice(0, 6).join(', ') : '';
      const system = `You are an ESL exercise generator.
Create vocabulary sentence-building exercises for the word: "${dto.keyword}".

For each pattern:
- "chunk" is a sentence starter or collocation frame using the target word (e.g., "She easily...", "I find it easy to...")
- Each pattern has 2-3 "items" with zh (Chinese prompt) and answer (English full sentence using the chunk)
- Vary the patterns to show different uses of the word

${availableChunks ? `You may use these available chunks as inspiration: ${availableChunks}` : ''}

Return ONLY a JSON object (no markdown):
{ "patterns": [{ "chunk": "sentence starter", "items": [{ "zh": "中文", "answer": "English" }, ...] }, ...] }`;

      const user = `Word: "${dto.keyword}"${dto.meaning ? ` (${dto.meaning})` : ''}
Create 3 patterns with 2-3 items each.`;

      const { text } = await generateText({
        model: provider('deepseek-chat'),
        system,
        prompt: user,
        temperature: 0.7,
        maxOutputTokens: 1500,
      });
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        return { patterns: [] };
      }
    }

    if (dto.type === 'sentence_decomposition') {
      // Mode 1: Generate a complex long sentence from a simple chunk/pattern
      if (dto.generateSentence) {
        const chunk = dto.keyword;
        const system = `You are an ESL exercise generator for Chinese learners of English.
Given a simple English chunk or pattern, generate a rich, natural long sentence that expands it into a realistic conversational context.

The sentence should:
- Be 12-25 words long
- Sound like natural spoken English
- Add time, place, reason, or manner to make it vivid
- Be suitable for sentence decomposition exercises

Return ONLY a JSON object (no markdown):
{ "fullSentence": "the generated long English sentence", "fullSentenceZh": "Chinese translation" }`;

        const user = `Chunk: "${chunk}"${dto.meaning ? `\nMeaning: ${dto.meaning}` : ''}`;

        const { text } = await generateText({
          model: provider('deepseek-chat'),
          system,
          prompt: user,
          temperature: 0.7,
          maxOutputTokens: 500,
        });
        try {
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return JSON.parse(cleaned);
        } catch {
          return { fullSentence: '', fullSentenceZh: '' };
        }
      }

      // Mode 2: Decompose a full sentence into progressive levels
      const fullSentence = dto.sentence ?? dto.keyword;
      const fullZh = dto.zh ?? '';
      const system = `You are an ESL exercise generator.
Decompose a long English sentence into 5 progressive levels, from simple to complex.

Each level builds on the previous, adding one new element (object, adverb, frequency, reason, etc.).
- level 1: core sentence (subject + verb, simplest form)
- level 2: add object or basic modifier
- level 3: add adverb or degree
- level 4: add frequency or time
- level 5: full complex sentence (the original)

Each level needs:
- "level": number 1-5
- "label": short Chinese description of what was added (e.g., "加对象", "加程度")
- "en": English sentence at this level
- "zh": Chinese translation
- "highlight": the newly added part (text that differentiates from previous level)
- "hint": Chinese hint for the learner (e.g., "试着加入地点")

Return ONLY a JSON object (no markdown):
{ "levels": [{ "level": 1, "label": "...", "en": "...", "zh": "...", "highlight": "...", "hint": "..." }, ...] }`;

      const user = `Full sentence: "${fullSentence}"${fullZh ? `\nChinese: ${fullZh}` : ''}`;

      const { text } = await generateText({
        model: provider('deepseek-chat'),
        system,
        prompt: user,
        temperature: 0.5,
        maxOutputTokens: 1500,
      });
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        return { levels: [] };
      }
    }

    if (dto.type === 'pattern_drill') {
      const system = `You are an ESL exercise generator for Chinese learners of English.
Create ${count} sentence-building exercises focusing on a target sentence pattern.

The pattern is a grammar framework with a variable slot. Learners must fill the slot to create complete sentences.

Rules:
- Each item has a Chinese prompt (zh) and the expected English answer (answer).
- The English answer MUST follow the target pattern: "${dto.keyword}".
- If direction is "en_to_zh", swap: the prompt is the English sentence using the pattern, and answer is Chinese.
- Vary the slot fillers to show different real-world uses of the same pattern.
- Keep sentences practical and at an intermediate level.

Return ONLY a JSON object (no markdown):
{ "items": [{ "zh": "中文句子", "answer": "English sentence using the pattern" }, ...] }`;

      const user = `Pattern: "${dto.keyword}"${dto.meaning ? ` (${dto.meaning})` : ''}
Direction: ${direction}
Count: ${count}
Create exercises where the learner practices this pattern with different content.`;

      const { text } = await generateText({
        model: provider('deepseek-chat'),
        system,
        prompt: user,
        temperature: 0.7,
        maxOutputTokens: 1200,
      });
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return { items: (parsed.items ?? []).slice(0, count) };
      } catch {
        return { items: [] };
      }
    }

    return { items: [] };
  }
}

// ─── 类型定义 ────────────────────────────────────────────────

interface WordEnrichmentData {
  chineseTranslation: string
  phonetic?: string
  audioUrl?: string
  meanings: Array<{ partOfSpeech: string; chineseGloss: string }>
  examples: Array<{ en: string; zh: string; level: string }>
  memoryTip: string
}

interface DictApiEntry {
  word: string
  phonetic?: string
  phonetics: Array<{ text?: string; audio?: string }>
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
      synonyms: string[]
      antonyms: string[]
    }>
    synonyms: string[]
    antonyms: string[]
  }>
}
