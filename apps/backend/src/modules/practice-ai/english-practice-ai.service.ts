import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import type { Response } from 'express';
import { DialogueTurnJudgeDto, EnglishFeedbackDto, EnglishUpgradeDto } from './dto/english-feedback.dto';

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  L1: '能说简单单句，但容易卡住',
  L2: '能回答日常问题，有简单原因',
  L3: '能说30~60秒，有原因和例子',
  L4: '能处理真实生活场景对话',
  L5: '能讨论观点和抽象话题',
};

const ENGLISH_COACH_SYSTEM = `You are an encouraging English speaking coach. Your job is to help Chinese learners improve their spoken English through gentle, specific feedback.

Key principles:
- Be warm and supportive. Always start with what the learner did well.
- Correct only significant errors (grammar, collocation, unnatural phrasing). Do not nitpick minor style preferences.
- When correcting, explain WHY in simple Chinese so the learner understands the logic.
- Provide upgraded versions that keep the learner's original meaning but sound more natural.
- Extract reusable chunks (collocations, sentence starters, transitions) the learner can use in other situations.
- Match your suggestions to the learner's output level.

Always respond in Chinese. Use markdown for structure. Return your analysis as structured JSON within a code block.`;

@Injectable()
export class EnglishPracticeAiService {
  private readonly logger = new Logger(EnglishPracticeAiService.name);

  private getProvider() {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new BadRequestException('未配置 DEEPSEEK_API_KEY');
    const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
    return (model: string) => client.chat(model);
  }

  /** 构建纠错反馈 Prompt */
  buildFeedbackPrompt(dto: EnglishFeedbackDto): { system: string; user: string } {
    const levelDesc = LEVEL_DESCRIPTIONS[dto.outputLevel ?? 'L1'] ?? '初学者';
    const sceneInfo = dto.sceneTitle ? `\n场景：${dto.sceneTitle}` : '';
    const topicInfo = dto.topicTitle ? `\n话题：${dto.topicTitle}` : '';
    const promptInfo = dto.promptEn ? `\n题目：${dto.promptEn}` : '';

    const system = ENGLISH_COACH_SYSTEM;

    const user = `## 学生当前水平
${dto.outputLevel ?? 'L1'} — ${levelDesc}
${sceneInfo}${topicInfo}${promptInfo}

## 学生录音转写
${dto.userTranscript}

请按以下 JSON 格式分析（仅返回 JSON，放在 \`\`\`json 代码块中）：

\`\`\`json
{
  "errorCorrection": [
    {
      "type": "grammar|collocation|chinglish|unnatural|logic",
      "original": "原句片段",
      "correction": "修正后",
      "explanation": "用中文简要解释"
    }
  ],
  "expressionUpgrade": {
    "clear": "清楚版——语法正确、意思清楚的基础版本",
    "natural": "自然版——更符合英语母语者习惯的版本",
    "advanced": "进阶版——使用更丰富表达的高级版本（L3及以上提供）"
  },
  "extractedChunks": [
    {
      "chunk": "可复用的表达块",
      "meaning": "中文含义",
      "type": "collocation|sentence_starter|transition|idiom"
    }
  ],
  "score": {
    "answerLength": "short|medium|long",
    "grammarAccuracy": 8,
    "chunkUsage": 5,
    "logicCompleteness": 6,
    "naturalness": 7,
    "fluency": 7
  },
  "overallComment": "用中文给出2-3句总体评价和鼓励"
}
\`\`\``;

    return { system, user };
  }

  /** SSE 流式纠错反馈 */
  async streamFeedback(dto: EnglishFeedbackDto, res: Response) {
    const provider = this.getProvider();
    const { system, user } = this.buildFeedbackPrompt(dto);

    const result = streamText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    for await (const chunk of result.textStream) {
      if (!res.writableEnded) res.write(chunk);
    }
    if (!res.writableEnded) res.end();
  }

  /** 构建表达升级 Prompt（非流式） */
  buildUpgradePrompt(dto: EnglishUpgradeDto): { system: string; user: string } {
    const levelDesc = LEVEL_DESCRIPTIONS[dto.outputLevel ?? 'L1'] ?? '初学者';

    const system = ENGLISH_COACH_SYSTEM;

    const user = `## 学生当前水平
${dto.outputLevel ?? 'L1'} — ${levelDesc}

## 学生原文
${dto.userTranscript}

请把这段话升级为更自然的英语表达，提供三个版本并提取可复用的表达块。

\`\`\`json
{
  "clear": "语法正确、意思清楚的基础版本",
  "natural": "更符合母语者习惯的自然版本",
  "advanced": "更丰富的进阶版本",
  "chunks": [
    { "chunk": "表达块", "meaning": "中文释义", "type": "collocation|sentence_starter" }
  ]
}
\`\`\``;

    return { system, user };
  }

  /** 非流式表达升级 */
  async upgradeExpression(dto: EnglishUpgradeDto) {
    const provider = this.getProvider();
    const { system, user } = this.buildUpgradePrompt(dto);

    const result = await generateText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.7,
      maxOutputTokens: 1500,
    });

    return { result: result.text };
  }

  /** 单轮 NPC 对话输入判定：把开放式用户输入转换为 Ink 可消费的变量 */
  async judgeDialogueTurn(dto: DialogueTurnJudgeDto) {
    const provider = this.getProvider();
    const objectives = dto.objectives?.length ? dto.objectives : ['respond_to_npc'];
    const targetChunks = dto.targetChunks ?? [];

    const system = `You evaluate one turn in an English speaking practice dialogue.
Return only JSON. Be practical and learner-friendly.
Determine whether the user's message satisfies the expected communicative intent, which objectives it completes, and which target chunks are naturally used.
Use short snake_case strings for intent and Ink variables.`;

    const user = `## Context
Input node: ${dto.inputNodeId ?? 'unknown'}
Expected intent: ${dto.expectedIntent ?? 'infer_from_context'}
NPC says: ${dto.npcText}

## Practice objectives
${objectives.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## Target chunks
${targetChunks.length ? targetChunks.join('\n') : 'None'}

## User response
${dto.userText}

Return this exact JSON shape:
{
  "intent": "short_snake_case_intent",
  "passed": true,
  "objectiveCompleted": ["objective text from the list"],
  "chunksUsed": ["target chunk text from the list"],
  "inkVariables": {
    "objective_done": true,
    "user_intent": "short_snake_case_intent",
    "needs_retry": false
  },
  "feedback": "中文一句话反馈",
  "confidence": 0.86
}`;

    const result = await generateText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.2,
      maxOutputTokens: 900,
    });

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
        inkVariables: {
          objective_done: passed,
          user_intent: intent,
          needs_retry: !passed,
          ...(parsed.inkVariables && typeof parsed.inkVariables === 'object' ? parsed.inkVariables : {}),
        },
        feedback: String(parsed.feedback || ''),
        confidence: Number(parsed.confidence ?? 0),
        raw: result.text,
      };
    } catch {
      const fallbackIntent = dto.expectedIntent || 'unknown';
      return {
        intent: fallbackIntent,
        passed: false,
        objectiveCompleted: [],
        chunksUsed: [],
        inkVariables: {
          objective_done: false,
          user_intent: fallbackIntent,
          needs_retry: true,
        },
        feedback: '暂时无法稳定判断这一轮回答，请再试一次。',
        confidence: 0,
        raw: result.text,
      };
    }
  }

  /** 构建对话汇总分析 Prompt */
  buildDialogueSummaryPrompt(params: {
    topicTitle: string;
    promptEn: string;
    dialogues: Array<{
      round: number;
      npcText: string;
      userText: string;
      isOnTopic?: boolean;
      objectivesCompleted?: string[];
      chunksUsed?: string[];
      grammarIssues?: any;
    }>;
    objectives: string[];
    coreChunks: string[];
  }): { system: string; user: string } {
    const dialogueLog = params.dialogues
      .map(
        (d) =>
          `轮次 ${d.round}:\n  NPC: ${d.npcText}\n  用户: ${d.userText}\n  切题: ${d.isOnTopic ?? 'N/A'}\n  完成目标: ${(d.objectivesCompleted ?? []).join(', ') || '无'}\n  使用Chunk: ${(d.chunksUsed ?? []).join(', ') || '无'}`,
      )
      .join('\n\n');

    const system = `你是一位专业的英语口语教练。你需要对学生的多轮对话练习进行全面的复盘分析。请用中文回复，结构清晰，语气鼓励为主。`;

    const user = `## 练习话题
${params.topicTitle}
题目：${params.promptEn}

## 任务目标
${params.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

## 核心表达 (Chunks)
${params.coreChunks.join('\n')}

## 对话记录
${dialogueLog}

请按以下 JSON 格式进行复盘分析（仅返回 JSON，放在 \`\`\`json 代码块中）：

\`\`\`json
{
  "overallScore": 75,
  "summary": "用2-3句话总体评价这次对话练习的表现",
  "objectiveAnalysis": [
    { "objective": "目标文本", "completed": true, "comment": "完成情况评价" }
  ],
  "chunkUsageAnalysis": [
    { "chunk": "表达文本", "used": true, "context": "在哪个轮次使用的" }
  ],
  "grammarHighlights": [
    { "type": "grammar|collocation|chinglish|unnatural", "original": "原文", "correction": "修正", "round": 1 }
  ],
  "strengths": ["优势1", "优势2"],
  "improvements": ["改进建议1", "改进建议2"],
  "nextStepSuggestion": "下一步学习建议"
}
\`\`\``;

    return { system, user };
  }

  /** 对话汇总分析（非流式） */
  async summarizeDialogue(params: {
    topicTitle: string;
    promptEn: string;
    dialogues: Array<any>;
    objectives: string[];
    coreChunks: string[];
  }) {
    const provider = this.getProvider();
    const { system, user } = this.buildDialogueSummaryPrompt(params);

    const result = await generateText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.7,
      maxOutputTokens: 2500,
    });

    // Try to parse JSON from response
    const jsonMatch = result.text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return { analysis: JSON.parse(jsonMatch[1]), raw: result.text };
      } catch {
        return { analysis: null, raw: result.text };
      }
    }
    return { analysis: null, raw: result.text };
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

    const system = `你是一位专业的英语口语教练。你只评估用户输出，不评价 NPC 台词。你需要结合练习话题、场景、目标 chunk、词汇、句型和对话上下文做复盘。请用中文回答，语气鼓励但具体。只返回 JSON。`;

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

## 本次用户对话
${dialogueText}

请严格返回以下 JSON：

\`\`\`json
{
  "overallScore": 75,
  "status": "completed|needs_retry|incomplete",
  "summary": "2-3 句总结，只评价用户本次输出",
  "objectiveAnalysis": [
    { "objective": "目标文本", "completed": true, "comment": "结合用户具体输出解释" }
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
  "upgradedAnswer": {
    "clear": "清晰基础版",
    "natural": "自然口语版",
    "advanced": "进阶版"
  },
  "strengths": ["优势1", "优势2"],
  "improvements": ["改进1", "改进2"],
  "nextStepSuggestion": "下一步建议，最好指向具体 chunk/词汇/句型"
}
\`\`\``;

    return { system, user };
  }

  async summarizePracticeSession(session: any) {
    const provider = this.getProvider();
    const { system, user } = this.buildPracticeSessionAnalysisPrompt(session);
    const result = await generateText({
      model: provider('deepseek-chat'),
      system,
      prompt: user,
      temperature: 0.45,
      maxOutputTokens: 2800,
    });

    const jsonText = result.text.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? result.text;
    try {
      return { analysis: JSON.parse(jsonText), raw: result.text };
    } catch {
      return { analysis: null, raw: result.text };
    }
  }
}
