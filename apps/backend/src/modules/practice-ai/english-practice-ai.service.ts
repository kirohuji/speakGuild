import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import type { Response } from 'express';
import { EnglishFeedbackDto, EnglishUpgradeDto } from './dto/english-feedback.dto';

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
}
