import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { DialogueTurnJudgeDto, WarmupTurnJudgeDto } from './dto/english-feedback.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiQuotaService } from '../../common/ai-quota/ai-quota.service';
import { LlmProviderFactory, type LlmConfig } from '../../common/llm/llm-provider.factory';
import { AiModelService } from '../ai-model/ai-model.service';
import {
  WARMUP_PIPELINE_SYSTEM_PROMPT,
  buildWarmupPipelineUserPrompt,
} from './prompts/warmup-pipeline.prompt';

const PLACEMENT_GOAL_PACKAGE_TYPES: Record<string, string> = {
  foundation_start: 'foundation',
  daily_scenes: 'daily',
  exam_ielts: 'exam',
  story_roleplay: 'story',
  course_system: 'course',
};

type PlacementSceneBase = {
  id: string;
  packageType: unknown;
  requiredOutputLevel: string;
  _count: { trainingTopics: number; storyEpisodes: number };
};

type DrillGenerationDto = {
  type: 'chunk_substitution' | 'vocab_sentence_building' | 'sentence_decomposition' | 'pattern_drill';
  keyword: string;
  meaning?: string;
  direction?: string;
  kind?: string;
  count?: number;
  chunks?: string[];
  topicTitle?: string;
  difficulty?: string;
  sentence?: string;
  zh?: string;
  generateSentence?: boolean;
  generateHints?: boolean;
  polish?: boolean;
  itemCount?: number;
  items?: Array<{ zh?: string; en?: string; answer?: string; hint?: string }>;
  materials?: {
    vocabs?: Array<{ id?: string; word?: string; meaning?: string }>;
    chunks?: Array<{ id?: string; text?: string; meaning?: string }>;
    patterns?: Array<{ id?: string; pattern?: string; meaning?: string }>;
  };
  usedRefs?: {
    vocabIds?: string[];
    chunkIds?: string[];
    patternIds?: string[];
  };
};

type WarmupPipelineGenerationDto = {
  topicTitle?: string;
  difficulty?: string;
  materials?: {
    vocabs?: Array<{ id?: string; word?: string; meaning?: string; count?: number; tier?: 'core' | 'ext' | 'carry' }>;
    chunks?: Array<{ id?: string; text?: string; meaning?: string; count?: number }>;
    patterns?: Array<{ id?: string; pattern?: string; meaning?: string; count?: number }>;
  };
  structure?: {
    zhToEnItems?: number;
    enToZhItems?: number;
    patternItems?: number;
    expansionUnits?: number;
    steps?: number;
    totalItems?: number;
  };
  /** 之前已生成的 pipeline 内容，供 AI 参考避免重复并改进质量 */
  previousPipeline?: Array<Record<string, unknown>>;
};

@Injectable()
export class EnglishPracticeAiService {
  private readonly logger = new Logger(EnglishPracticeAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: AiQuotaService,
    private readonly llmFactory: LlmProviderFactory,
    private readonly aiModel: AiModelService,
  ) {}

  private async getLlmConfigOrThrow() {
    const config = await this.aiModel.getLlmConfig();
    if (!config.apiKey) throw new BadRequestException('未配置 LLM API Key');
    return config;
  }

  private async getProvider() {
    const config = await this.getLlmConfigOrThrow();
    const model = this.llmFactory.create(config);
    return () => model;
  }

  private async getLlmRuntime() {
    const config = await this.getLlmConfigOrThrow();
    const model = this.llmFactory.create(config);
    return { config, provider: () => model };
  }

  private parseLevel(value: unknown) {
    const match = String(value ?? '').match(/L[1-5]/i);
    return match ? match[0].toUpperCase() : 'L1';
  }

  private extractJson(text: string) {
    return text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? text;
  }

  private buildChatCompletionsUrl(baseUrl: string) {
    const normalized = (baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    return normalized.endsWith('/chat/completions')
      ? normalized
      : `${normalized}/chat/completions`;
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

  private levelToNumber(level: unknown) {
    const parsed = Number.parseInt(this.parseLevel(level).slice(1), 10);
    return Number.isFinite(parsed) ? parsed : 1;
  }

  private hashString(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private buildGoalPackageWeights(goals: string[]) {
    const weights = new Map<string, number>();
    goals.forEach((goal, index) => {
      const packageType = PLACEMENT_GOAL_PACKAGE_TYPES[goal];
      if (!packageType) return;
      weights.set(packageType, (weights.get(packageType) ?? 0) + (index === 0 ? 4 : index === 1 ? 2 : 1));
    });
    return weights;
  }

  private rankPlacementScenes<T extends PlacementSceneBase>(params: {
    scenes: T[];
    goals: string[];
    outputLevel: string;
    aiRecommendedIds: Set<string>;
    userId: string;
  }) {
    const packageWeights = this.buildGoalPackageWeights(params.goals);
    const targetLevel = this.levelToNumber(params.outputLevel);

    return [...params.scenes].sort((a, b) => {
      const score = (scene: T) => {
        const packageType = String(scene.packageType);
        const goalScore = packageWeights.size ? packageWeights.get(packageType) ?? 0 : 1;
        const levelDistance = Math.abs(this.levelToNumber(scene.requiredOutputLevel) - targetLevel);
        const levelScore = Math.max(0, 3 - levelDistance);
        const contentScore = Math.min(scene._count.trainingTopics + scene._count.storyEpisodes, 8) * 0.15;
        const aiScore = params.aiRecommendedIds.has(scene.id) ? 0.75 : 0;
        const tieBreaker = (this.hashString(`${params.userId}:${params.goals.join(',')}:${scene.id}`) % 1000) / 10000;
        return goalScore * 3 + levelScore + contentScore + aiScore + tieBreaker;
      };
      return score(b) - score(a);
    });
  }

  private selectPlacementRecommendations<T extends PlacementSceneBase>(params: {
    scenes: T[];
    goals: string[];
    outputLevel: string;
    aiRecommendedIds: Set<string>;
    userId: string;
  }) {
    const rankedScenes = this.rankPlacementScenes(params);
    const preferredPackageTypes = [...new Set(params.goals.map((goal) => PLACEMENT_GOAL_PACKAGE_TYPES[goal]).filter(Boolean))];
    const selected: typeof rankedScenes = [];
    const selectedIds = new Set<string>();

    for (const packageType of preferredPackageTypes) {
      if (selected.length >= 3) break;
      const scene = rankedScenes.find((item) => String(item.packageType) === packageType && !selectedIds.has(item.id));
      if (!scene) continue;
      selected.push(scene);
      selectedIds.add(scene.id);
    }

    for (const scene of rankedScenes) {
      if (selected.length >= 3) break;
      if (selectedIds.has(scene.id)) continue;
      selected.push(scene);
      selectedIds.add(scene.id);
    }

    return selected;
  }

  async assessPlacement(
    dto: {
      learningGoals: string[];
      answers: Array<{ promptId: string; prompt: string; answer: string }>;
    },
    userId: string,
  ) {
    const provider = await this.getProvider();
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
      take: 80,
    });

    const preferredPackageTypes = [...new Set(cleanGoals.map((goal) => PLACEMENT_GOAL_PACKAGE_TYPES[goal]).filter(Boolean))];

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

Important separation:
- Decide outputLevel from the learner's answer quality only. Do not raise or lower the level because of selected goals.
- Use selected goals only for recommendationReason, nextStep, and suggested unit ids.

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
      model: provider(),
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

    const recommendedIdValues: string[] = Array.isArray(parsed?.recommendedUnitIds)
      ? parsed.recommendedUnitIds.map((id: unknown) => String(id))
      : [];
    const recommendedIds = new Set<string>(recommendedIdValues);
    const fallbackLevel = cleanAnswers.some((answer) => answer.answer.length > 120) ? 'L3' : cleanAnswers.some((answer) => answer.answer.length > 50) ? 'L2' : 'L1';
    const outputLevel = this.parseLevel(parsed?.outputLevel ?? fallbackLevel);
    const recommendedScenes = this.selectPlacementRecommendations({
      scenes,
      goals: cleanGoals,
      outputLevel,
      aiRecommendedIds: recommendedIds,
      userId,
    });
    const finalRecommendedUnits = recommendedScenes.map((scene) => ({
      id: scene.id,
      packageType: String(scene.packageType),
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
      primaryGoal: cleanGoals[0] ?? null,
      preferredPackageTypes,
      recommendationStrategy: 'answer_level_plus_weighted_goal_mix',
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
    const provider = await this.getProvider();
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
      model: provider(),
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

  // z.enum 会触发 AI SDK generateObject 泛型推导爆栈 (TS2589)，调用处用 as any 绕过
  private warmupJudgeSchema = z.object({
    passed: z.boolean(),
    score: z.enum(['strong', 'ok', 'weak', 'miss']),
    feedback: z.string(),
    correction: z.string().nullable(),
  });

  private drillHintsSchema = z.object({
    hints: z.array(z.string()),
  });

  private normalizeDrillHints(hints: unknown, dto: {
    type: 'chunk_substitution' | 'vocab_sentence_building' | 'sentence_decomposition' | 'pattern_drill';
    keyword: string;
    direction?: string;
    itemCount?: number;
    items?: Array<{ zh?: string; en?: string; answer?: string; hint?: string }>;
  }) {
    const itemCount = dto.items?.length || dto.itemCount || 0;
    const normalized = Array.isArray(hints)
      ? hints.map((hint) => String(hint ?? '').trim())
      : [];
    const fallback = this.buildFallbackDrillHints(dto);
    return Array.from({ length: itemCount }, (_, index) => normalized[index] || fallback[index] || '先抓住题目的核心意思，再用自然的表达完成句子。');
  }

  private parseDrillHintText(text: string) {
    const cleaned = this.extractJson(text).trim();
    try {
      const parsed = JSON.parse(cleaned);
      const result = this.drillHintsSchema.safeParse(parsed);
      if (result.success) return result.data.hints;
    } catch {
      // Fall through to line-based parsing. Some providers truncate or mangle JSON.
    }

    const lines = text
      .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*\n?/gi, '').replace(/```/g, ''))
      .split(/\r?\n/)
      .map((line) => line
        .trim()
        .replace(/^[-*]\s*/, '')
        .replace(/^(?:HINT\s*)?\d+[\).:：]\s*/i, '')
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .trim())
      .filter((line) => (
        line
        && !/^\{|\}|\[|\]$/.test(line)
        && !/^["']?hints?["']?\s*[:：]?$/i.test(line)
        && !/^"hints"\s*:\s*\[?$/i.test(line)
      ));

    if (lines.length) return lines;

    const quoted = [...text.matchAll(/"([^"\n]{6,})"/g)]
      .map((match) => match[1].trim())
      .filter((value) => value && value !== 'hints');
    return quoted;
  }

  private async generateDrillHintsObject(params: {
    config: LlmConfig;
    provider: () => ReturnType<LlmProviderFactory['create']>;
    system: string;
    prompt: string;
    dto: DrillGenerationDto;
  }) {
    const maxOutputTokens = Math.max(1000, (params.dto.items?.length ?? params.dto.itemCount ?? 4) * 180);
    const providerName = params.config.provider.trim().toLowerCase();

    if (providerName === 'deepseek') {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(this.buildChatCompletionsUrl(params.config.baseUrl), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${params.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: params.config.model,
              messages: [
                { role: 'system', content: params.system },
                {
                  role: 'user',
                  content: `${params.prompt}\n\nReturn a complete JSON object only. It must start with {"hints":[ and must be valid JSON.`,
                },
              ],
              response_format: { type: 'json_object' },
              temperature: attempt === 0 ? 0.2 : 0,
              max_tokens: maxOutputTokens,
            }),
          });

          const payload = await response.json().catch(() => null) as any;
          if (!response.ok) {
            throw new Error(payload?.error?.message || payload?.message || `DeepSeek JSON output failed (${response.status})`);
          }

          const content = String(payload?.choices?.[0]?.message?.content ?? '').trim();
          if (!content) {
            throw new Error(`DeepSeek JSON output was empty; finish_reason=${payload?.choices?.[0]?.finish_reason ?? 'unknown'}`);
          }

          const parsed = JSON.parse(this.extractJson(content).trim());
          const result = this.drillHintsSchema.safeParse(parsed);
          if (!result.success) throw new Error(`DeepSeek JSON output schema mismatch: ${result.error.message}`);
          return result.data;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

    const result = await generateObject({
      model: params.provider(),
      system: params.system,
      prompt: params.prompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: this.drillHintsSchema as any,
      temperature: 0.6,
      maxOutputTokens,
    });
    return result.object as { hints: string[] };
  }

  private buildFallbackDrillHints(dto: {
    type: 'chunk_substitution' | 'vocab_sentence_building' | 'sentence_decomposition' | 'pattern_drill';
    keyword: string;
    direction?: string;
    itemCount?: number;
    items?: Array<{ zh?: string; en?: string; answer?: string; hint?: string }>;
  }) {
    const isEnToZh = dto.direction === 'en_to_zh';
    const target = dto.keyword?.trim();
    const items: Array<{ zh?: string; en?: string; answer?: string; hint?: string }> = dto.items?.length
      ? dto.items
      : Array.from({ length: dto.itemCount ?? 0 }, () => ({}));
    return items.map((item) => {
      if (item.hint?.trim()) return item.hint.trim();
      const promptText = this.getDrillPromptText(item, dto.direction);
      const answerText = this.getDrillAnswerText(item, dto.direction);
      if (dto.type === 'pattern_drill') {
        return isEnToZh
          ? `先看英文句子的结构，抓住句型「${target}」表达的关系，再翻成自然中文。`
          : `先套住句型「${target}」，再把中文里的具体信息放进空位，最后检查语序。`;
      }
      if (dto.type === 'vocab_sentence_building') {
        return isEnToZh
          ? '先找出英文里的核心词和搭配，再用中文说清楚完整意思。'
          : `先确定要表达的场景，再参考答案里的搭配，把「${target || '核心词'}」放进完整句子。`;
      }
      if (!promptText && answerText) {
        return isEnToZh
          ? '这道题目前只有参考中文，先补上英文原句，再根据英文意思生成更具体的提示。'
          : `这道题目前只有中文内容，先把它当作题干，再尝试用「${target || '核心表达'}」写出自然英文。`;
      }
      return isEnToZh
        ? '先理解英文原句的核心意思，再翻成自然中文，不必逐词硬翻。'
        : `先看中文要表达的核心意思，再参考答案的说法；如果适合，用「${target || '核心表达'}」完成自然英文句子。`;
    });
  }

  private getDrillPromptText(item: { zh?: string; en?: string; answer?: string }, direction?: string) {
    if (direction !== 'en_to_zh') return item.zh ?? item.en ?? '';
    if (item.en) return item.en;
    if (this.looksEnglish(item.answer) && item.zh) return item.answer ?? '';
    return item.zh ?? item.answer ?? '';
  }

  private getDrillAnswerText(item: { zh?: string; en?: string; answer?: string }, direction?: string) {
    if (direction === 'en_to_zh') {
      if (item.en) return item.answer ?? item.zh ?? '';
      if (this.looksEnglish(item.answer) && item.zh) return item.zh;
    }
    return item.answer ?? '';
  }

  private looksEnglish(value?: string) {
    return /[A-Za-z]/.test(value ?? '');
  }

  private buildDrillGenerationContext(dto: DrillGenerationDto) {
    const materialLines: string[] = [];
    const used = dto.usedRefs ?? {};
    const vocabs = dto.materials?.vocabs ?? [];
    const chunks = dto.materials?.chunks ?? [];
    const patterns = dto.materials?.patterns ?? [];
    const isUsed = (id: string | undefined, ids?: string[]) => Boolean(id && ids?.includes(id));

    if (dto.topicTitle) materialLines.push(`Topic: ${dto.topicTitle}`);
    if (dto.difficulty) materialLines.push(`Difficulty: ${dto.difficulty}`);

    if (vocabs.length) {
      materialLines.push('Topic vocabulary:');
      for (const vocab of vocabs.slice(0, 30)) {
        materialLines.push(`- ${vocab.word}${vocab.meaning ? `: ${vocab.meaning}` : ''}${isUsed(vocab.id, used.vocabIds) ? ' [used]' : ' [unused]'}`);
      }
    }
    if (chunks.length) {
      materialLines.push('Topic chunks:');
      for (const chunk of chunks.slice(0, 30)) {
        materialLines.push(`- ${chunk.text}${chunk.meaning ? `: ${chunk.meaning}` : ''}${isUsed(chunk.id, used.chunkIds) ? ' [used]' : ' [unused]'}`);
      }
    }
    if (patterns.length) {
      materialLines.push('Topic sentence patterns:');
      for (const pattern of patterns.slice(0, 30)) {
        materialLines.push(`- ${pattern.pattern}${pattern.meaning ? `: ${pattern.meaning}` : ''}${isUsed(pattern.id, used.patternIds) ? ' [used]' : ' [unused]'}`);
      }
    }

    if (!materialLines.length) return '';
    return `\n\nCurrent topic material pool. Prefer unused materials when possible, but keep the required keyword/pattern. Avoid repetitive items that only change a name, pronoun, or adjective.\n${materialLines.join('\n')}`;
  }

  private addFallbackHintsToItems<T extends { zh?: string; en?: string; answer?: string; hint?: string }>(items: T[], dto: DrillGenerationDto) {
    const hints = this.buildFallbackDrillHints({ ...dto, itemCount: items.length, items });
    return items.map((item, index) => ({ ...item, hint: item.hint?.trim() || hints[index] || '' }));
  }

  /** 知识点热身单题快速判定：Zod 约束 AI 必须返回合法 JSON */
  async judgeWarmupTurn(dto: WarmupTurnJudgeDto, userId?: string) {
    const provider = await this.getProvider();
    const system = `You are a fast ESL warmup judge.

Rules:
- Judge only this single warmup item. expectedAnswer is just ONE example — synonyms and equivalent expressions are equally correct.
- Be tolerant of minor grammar, spelling, casing, or speech-to-text errors.
- For zh_to_en, PASS when the user's English correctly expresses the Chinese prompt, even if word choice differs from expectedAnswer. Synonyms like prepared/ready, big/large, happy/glad are all fine.
- For en_to_zh, pass when the user's Chinese captures the core meaning.
- "strong": natural and correct; "ok": understandable with minor issues; "weak": meaning partly right or needed target is awkward; "miss": wrong/off-topic/empty.
- Give correction only for weak or miss, using expectedAnswer when useful.`;

    const prompt = [
      `stepType: ${dto.stepType}`,
      `direction: ${dto.direction ?? 'zh_to_en'}`,
      `prompt: ${dto.prompt}`,
      dto.expectedAnswer ? `expectedAnswer(参考示例，非唯一答案): ${dto.expectedAnswer}` : null,
      dto.targetText ? `targetText: ${dto.targetText}` : null,
      dto.targetMeaning ? `targetMeaning: ${dto.targetMeaning}` : null,
      `userAnswer: ${dto.userAnswer}`,
    ].filter(Boolean).join('\n');

    try {
      const result = await generateObject({
        model: provider(),
        system,
        prompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: this.warmupJudgeSchema as any, // TS2589: z.enum 泛型推导过深
        temperature: 0.1,
        maxOutputTokens: 180,
      });

      if (userId && result.usage) {
        this.quotaService.recordTokens(userId, result.usage.totalTokens ?? 0);
      }

      const raw = result.object as { passed: boolean; score: string; feedback: string; correction: string | null };
      const validScore = (['strong', 'ok', 'weak', 'miss'] as const).find((s) => s === raw.score);
      return {
        passed: Boolean(raw.passed),
        score: validScore ?? (raw.passed ? 'ok' : 'miss'),
        feedback: raw.feedback || (raw.passed ? '表达可以，继续。' : '再调整一下表达。'),
        correction: raw.correction ?? null,
        raw: JSON.stringify(raw),
      };
    } catch {
      // Zod 校验失败或模型调用失败 → 规则兜底
      return this.fallbackJudgeWarmupTurn(dto);
    }
  }

  /** 规则兜底：AI 返回无效 JSON 时做基础字符串比对 */
  private fallbackJudgeWarmupTurn(dto: WarmupTurnJudgeDto) {
    const userAnswer = (dto.userAnswer ?? '').trim();
    const expectedAnswer = (dto.expectedAnswer ?? '').trim();

    // 空答案直接判错
    if (!userAnswer) {
      return { passed: false, score: 'miss' as const, feedback: '请尝试用英语回答。', correction: expectedAnswer || null, raw: '' };
    }

    // 大小写不敏感精确匹配 → strong
    if (expectedAnswer && userAnswer.toLowerCase() === expectedAnswer.toLowerCase()) {
      return { passed: true, score: 'strong' as const, feedback: '回答正确！', correction: null, raw: '' };
    }

    // 去除标点后匹配 → ok
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    if (expectedAnswer && normalize(userAnswer) === normalize(expectedAnswer)) {
      return { passed: true, score: 'ok' as const, feedback: '正确，注意标点。', correction: null, raw: '' };
    }

    // 关键词覆盖检测：提取 expectedAnswer 中的实词，检查是否出现在 userAnswer 中
    if (expectedAnswer) {
      const keywords = expectedAnswer.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['the', 'and', 'are', 'was', 'were', 'does', 'did', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'this', 'that', 'these', 'those', 'they', 'what', 'when', 'where', 'which', 'who', 'whom', 'how'].includes(w));
      const userLower = userAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const matchedCount = keywords.filter((kw) => userLower.includes(kw)).length;
      const coverage = keywords.length > 0 ? matchedCount / keywords.length : 0;

      // 覆盖 >= 60% → ok
      if (coverage >= 0.6) {
        return {
          passed: true,
          score: 'ok' as const,
          feedback: coverage >= 0.8 ? '表达正确！' : '基本正确，换个说法也可以。',
          correction: null,
          raw: '',
        };
      }

      // 覆盖 >= 30% → weak
      if (coverage >= 0.3) {
        return {
          passed: false,
          score: 'weak' as const,
          feedback: '意思部分正确，参考示例调整。',
          correction: expectedAnswer,
          raw: '',
        };
      }
    }

    // 无法判断 → 宽松通过，不显示 correction 避免误导
    if (userAnswer.length > 0) {
      return {
        passed: true,
        score: 'weak' as const,
        feedback: '回答已记录，继续加油！',
        correction: null,
        raw: '',
      };
    }

    return { passed: false, score: 'miss' as const, feedback: '暂时无法判断，请再试一次。', correction: expectedAnswer || null, raw: '' };
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

    const provider = await this.getProvider();
    const { system, user } = this.buildPracticeSessionAnalysisPrompt(session);

    // 打印发送给 AI 的对话片段（截取关键部分）
    const dialoguePreview = turns.map((t: any) => `[round=${t.round}] NPC:${t.npcText?.slice(0, 30)}... → 用户:${t.userText?.slice(0, 30)}...`).join(' | ');
    this.logger.log(`[summarize] 对话预览: ${dialoguePreview || '无对话'}`);

    const result = await generateText({
      model: provider(),
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
      const provider = await this.getProvider()
      const exampleLines = examples.map((ex, i) => `${i + 1}. ${ex.en}`).join('\n')
      const { text } = await generateText({
        model: provider(),
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
    const provider = await this.getProvider();

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
      model: provider(),
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

  /** 一次性生成知识点练习补齐题组：同时考虑结构要求和材料覆盖 */
  async generateWarmupPipeline(dto: WarmupPipelineGenerationDto) {
    const provider = await this.getProvider();
    const vocabs = dto.materials?.vocabs ?? [];
    const chunks = dto.materials?.chunks ?? [];
    const patterns = dto.materials?.patterns ?? [];
    const missingVocabs = vocabs.filter((item) => (item.count ?? 0) === 0);
    const missingChunks = chunks.filter((item) => (item.count ?? 0) === 0);
    const missingPatterns = patterns.filter((item) => (item.count ?? 0) === 0);
    const structure = dto.structure ?? {};
    const previousPipeline = dto.previousPipeline ?? [];

    /** 把已有的 pipeline item 压缩成一行摘要（去掉 id/audio 等冗余字段） */
    const summarizePreviousItem = (item: Record<string, unknown>): string => {
      const type = String(item.type ?? '');
      const title = String(item.title ?? '');
      const direction = item.direction ? `[${item.direction}]` : '';
      const base = `${type} ${direction} ${title}`.trim();

      if (type === 'chunk_substitution') {
        const chunk = String(item.chunk ?? '');
        const chunkMeaning = item.chunkMeaning ? `(${item.chunkMeaning})` : '';
        const kind = item.kind ? ` kind=${item.kind}` : '';
        const sampleItems = (item.items as Array<Record<string, unknown>> ?? [])
          .slice(0, 3)
          .map((it: Record<string, unknown>) => {
            const prompt = String(it.zh ?? it.en ?? '');
            const answer = String(it.answer ?? '');
            return `${prompt} → ${answer}`;
          })
          .join(' | ');
        return `${base}: ${chunk}${chunkMeaning}${kind} | items: ${sampleItems}`;
      }

      if (type === 'pattern_drill') {
        const pattern = String(item.pattern ?? '');
        const patternMeaning = item.patternMeaning ? `(${item.patternMeaning})` : '';
        const sampleItems = (item.items as Array<Record<string, unknown>> ?? [])
          .slice(0, 3)
          .map((it: Record<string, unknown>) => {
            const prompt = String(it.zh ?? it.en ?? '');
            const answer = String(it.answer ?? '');
            return `${prompt} → ${answer}`;
          })
          .join(' | ');
        return `${base}: ${pattern}${patternMeaning} | items: ${sampleItems}`;
      }

      if (type === 'vocab_sentence_building') {
        const vocabWord = String(item.vocabWord ?? '');
        const vocabMeaning = item.vocabMeaning ? `(${item.vocabMeaning})` : '';
        const patternSummaries = (item.patterns as Array<Record<string, unknown>> ?? [])
          .map((p: Record<string, unknown>) => {
            const chunk = String(p.chunk ?? '');
            const sampleItems = (p.items as Array<Record<string, unknown>> ?? [])
              .slice(0, 2)
              .map((it: Record<string, unknown>) => `${String(it.zh ?? '')} → ${String(it.answer ?? '')}`)
              .join(' | ');
            return `${chunk}: ${sampleItems}`;
          })
          .join(' ;; ');
        return `${base}: ${vocabWord}${vocabMeaning} | patterns: ${patternSummaries}`;
      }

      if (type === 'sentence_decomposition') {
        const fullSentence = String(item.fullSentence ?? '');
        const fullSentenceZh = item.fullSentenceZh ? ` (${item.fullSentenceZh})` : '';
        const sourceText = item.sourceText ? ` src=${item.sourceText}` : '';
        const levelsPreview = (item.levels as Array<Record<string, unknown>> ?? [])
          .slice(0, 3)
          .map((l: Record<string, unknown>) => `${String(l.en ?? '')} [${String(l.zh ?? '')}]`)
          .join(' | ');
        return `${base}: ${fullSentence}${fullSentenceZh}${sourceText} | levels: ${levelsPreview}`;
      }

      return base;
    };

    const previousSummary = previousPipeline.length
      ? [
          '',
          '=== PREVIOUSLY GENERATED ITEMS (DO NOT duplicate; improve upon these) ===',
          ...previousPipeline.map((item, i) => `  ${i + 1}. ${summarizePreviousItem(item)}`),
          '=== END PREVIOUS ITEMS ===',
          '',
        ].join('\n')
      : '';

    // ── Classify vocabs by tier ──
    const tier = (t?: string): 'core' | 'ext' | 'carry' => {
      if (t === 'ext' || t === 'carry') return t;
      return 'core'; // default
    };
    const missingCoreVocabs = missingVocabs.filter((v) => tier(v.tier) === 'core');
    const missingExtVocabs = missingVocabs.filter((v) => tier(v.tier) === 'ext');
    const missingCarryVocabs = missingVocabs.filter((v) => tier(v.tier) === 'carry');
    const totalMissing = missingVocabs.length + missingChunks.length + missingPatterns.length;

    const vocabPoolSummary = vocabs.length
      ? vocabs.map((v) => {
          const status = (v.count ?? 0) > 0 ? 'used' : 'missing';
          return `${v.word} [${tier(v.tier)}] [${status}]`;
        }).join(', ')
      : 'none';

    const chunkPoolSummary = chunks.length
      ? chunks.map((c) => `${c.text}${(c.count ?? 0) > 0 ? ' [used]' : ' [missing]'}`).join(' | ')
      : 'none';

    const patternPoolSummary = patterns.length
      ? patterns.map((p) => `${p.pattern}${(p.count ?? 0) > 0 ? ' [used]' : ' [missing]'}`).join(' | ')
      : 'none';

    const prompt = buildWarmupPipelineUserPrompt({
      topicTitle: dto.topicTitle || 'Untitled topic',
      difficulty: dto.difficulty || 'L2',
      previousSummary,
      totalMissing,
      structure: {
        totalItems: structure.totalItems ?? 0,
        steps: structure.steps ?? 0,
        zhToEnItems: structure.zhToEnItems ?? 0,
        enToZhItems: structure.enToZhItems ?? 0,
        patternItems: structure.patternItems ?? 0,
        expansionUnits: structure.expansionUnits ?? 0,
      },
      materials: {
        missingCoreVocabs: missingCoreVocabs.map((v) => ({ word: v.word ?? '', meaning: v.meaning })),
        missingExtVocabs: missingExtVocabs.map((v) => ({ word: v.word ?? '', meaning: v.meaning })),
        missingCarryVocabs: missingCarryVocabs.map((v) => ({ word: v.word ?? '', meaning: v.meaning })),
        missingChunks: missingChunks.map((c) => ({ text: c.text ?? '', meaning: c.meaning })),
        missingPatterns: missingPatterns.map((p) => ({ pattern: p.pattern ?? '', meaning: p.meaning })),
        vocabPoolSummary,
        chunkPoolSummary,
        patternPoolSummary,
      },
    });

    try {
      const { text } = await generateText({
        model: provider(),
        system: WARMUP_PIPELINE_SYSTEM_PROMPT,
        prompt,
        temperature: 0.65,
        maxOutputTokens: 16000,
      });
      const parsed = JSON.parse(this.extractJson(text).trim());
      return { pipeline: Array.isArray(parsed.pipeline) ? parsed.pipeline : [] };
    } catch (error) {
      this.logger.warn(`Warmup pipeline generation failed: ${error instanceof Error ? error.message : String(error)}`);
      return { pipeline: [] };
    }
  }

  /** AI 生成练习题：根据关键词和题型批量生成练习项目 */
  async generateDrills(dto: DrillGenerationDto) {
    const runtime = await this.getLlmRuntime();
    const provider = runtime.provider;
    const count = Math.min(dto.count ?? 4, 8);
    const direction = dto.direction ?? 'zh_to_en';
    const kind = dto.kind ?? 'chunk';
    const generationContext = this.buildDrillGenerationContext(dto);

    // ── Generate per-item teaching hints ──
    if (dto.generateHints && dto.items?.length) {
      const system = `You are an ESL teaching assistant for Chinese learners of English.
For each exercise item below, write one short, helpful teaching hint in Chinese.
Each hint should guide the learner on how to construct the answer without giving it away completely.

Tailor hints to the exercise type:
- chunk_substitution: hint about how to use the target chunk naturally in a sentence
- pattern_drill: hint about how to fill the pattern's slot with the right words
- vocab_sentence_building: hint about which sentence pattern or collocation to use for this specific item

Return exactly ${dto.items.length} hints.
Return ONLY valid JSON. Do not return markdown, code fences, comments, or extra text.
The JSON schema is exactly:
{ "hints": ["提示1", "提示2"] }

The word JSON must appear in your response only as part of the valid JSON object.`;

      const isEnToZh = dto.direction === 'en_to_zh';
      const promptLabel = isEnToZh ? 'English prompt' : 'Chinese prompt';
      const answerLabel = isEnToZh ? 'Chinese answer' : 'English answer';
      const itemsJson = dto.items.map((it, i) => {
        const promptText = this.getDrillPromptText(it, dto.direction);
        const answerText = this.getDrillAnswerText(it, dto.direction);
        return `[${i + 1}] ${promptLabel}: ${promptText || '(missing)'} | ${answerLabel}: ${answerText || '(missing)'}`;
      }).join('\n')
      const user = `Type: ${dto.type}, Keyword: "${dto.keyword}"${dto.meaning ? `, Meaning: ${dto.meaning}` : ''}, Direction: ${dto.direction ?? 'zh_to_en'}${generationContext}\nExercises:\n${itemsJson}`;

      try {
        const object = await this.generateDrillHintsObject({
          config: runtime.config,
          provider,
          system,
          prompt: user,
          dto,
        });
        return { hints: this.normalizeDrillHints(object.hints, dto) };
      } catch (error) {
        this.logger.debug(`Structured drill hint generation fell back to text JSON: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        const { text } = await generateText({
          model: provider(),
          system,
          prompt: user,
          temperature: 0.6,
          maxOutputTokens: Math.max(500, dto.items.length * 120),
        });
        return { hints: this.normalizeDrillHints(this.parseDrillHintText(text), dto) };
      } catch (error) {
        this.logger.warn(`Text drill hint generation failed: ${error instanceof Error ? error.message : String(error)}`);
        return { hints: this.buildFallbackDrillHints(dto) };
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
          model: provider(),
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
- Add a short Chinese "hint" for every item.
- Use the topic material pool below. Prefer unused vocabulary/chunks when they fit.

Return ONLY a JSON object (no markdown):
{ "items": [{ "zh": "中文句子", "answer": "English sentence", "hint": "中文提示" }, ...] }`;

      const user = `Target: "${dto.keyword}"${dto.meaning ? ` (${dto.meaning})` : ''}
Direction: ${direction}
Kind: ${kind}
Count: ${count}${generationContext}`;

      const { text } = await generateText({
        model: provider(),
        system,
        prompt: user,
        temperature: 0.7,
        maxOutputTokens: 1200,
      });
      try {
        const cleaned = this.extractJson(text).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return { items: this.addFallbackHintsToItems((parsed.items ?? []).slice(0, count), dto) };
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
- Add a short Chinese "hint" for every item.
- Use the topic material pool below. Prefer unused sentence patterns/chunks when they fit.

${availableChunks ? `You may use these available chunks as inspiration: ${availableChunks}` : ''}

Return ONLY a JSON object (no markdown):
{ "patterns": [{ "chunk": "sentence starter", "items": [{ "zh": "中文", "answer": "English", "hint": "中文提示" }, ...] }, ...] }`;

      const user = `Word: "${dto.keyword}"${dto.meaning ? ` (${dto.meaning})` : ''}
Create 3 patterns with 2-3 items each.${generationContext}`;

      const { text } = await generateText({
        model: provider(),
        system,
        prompt: user,
        temperature: 0.7,
        maxOutputTokens: 1500,
      });
      try {
        const cleaned = this.extractJson(text).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        let hintIndex = 0;
        const allItems = (parsed.patterns ?? []).flatMap((pattern: any) => pattern.items ?? []);
        const hints = this.buildFallbackDrillHints({ ...dto, itemCount: allItems.length, items: allItems });
        return {
          patterns: (parsed.patterns ?? []).map((pattern: any) => ({
            ...pattern,
            items: (pattern.items ?? []).map((item: any) => ({ ...item, hint: item.hint?.trim() || hints[hintIndex++] || '' })),
          })),
        };
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
- Fit the topic material pool and difficulty below.

Return ONLY a JSON object (no markdown):
{ "fullSentence": "the generated long English sentence", "fullSentenceZh": "Chinese translation" }`;

        const user = `Chunk: "${chunk}"${dto.meaning ? `\nMeaning: ${dto.meaning}` : ''}${generationContext}`;

        const { text } = await generateText({
          model: provider(),
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

      const user = `Full sentence: "${fullSentence}"${fullZh ? `\nChinese: ${fullZh}` : ''}${generationContext}`;

      const { text } = await generateText({
        model: provider(),
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
- Add a short Chinese "hint" for every item.
- Use the topic material pool below. Prefer unused vocabulary/chunks when they fit.

Return ONLY a JSON object (no markdown):
{ "items": [{ "zh": "中文句子", "answer": "English sentence using the pattern", "hint": "中文提示" }, ...] }`;

      const user = `Pattern: "${dto.keyword}"${dto.meaning ? ` (${dto.meaning})` : ''}
Direction: ${direction}
Count: ${count}
Create exercises where the learner practices this pattern with different content.${generationContext}`;

      const { text } = await generateText({
        model: provider(),
        system,
        prompt: user,
        temperature: 0.7,
        maxOutputTokens: 1200,
      });
      try {
        const cleaned = this.extractJson(text).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return { items: this.addFallbackHintsToItems((parsed.items ?? []).slice(0, count), dto) };
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
