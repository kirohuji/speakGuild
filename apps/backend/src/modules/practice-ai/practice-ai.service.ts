import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetFeedbackDto, GetTeachingDto, WordEnrichmentDto } from './dto/get-feedback.dto';

export interface WordExampleItem {
  en: string;
  zh: string;
  level: 'basic' | 'intermediate' | 'advanced';
  note?: string;
}

export interface WordEnrichmentResult {
  chineseTranslation: string;
  meanings: Array<{ partOfSpeech: string; chineseGloss: string }>;
  examples: WordExampleItem[];
  memoryTip: string;
}

@Injectable()
export class PracticeAiService {
  private readonly logger = new Logger(PracticeAiService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async loadQuestion(questionId: string) {
    const q = await this.prisma.questionItem.findUnique({
      where: { id: questionId },
      include: { content: true },
    });
    if (!q) throw new NotFoundException('题目不存在');
    return q;
  }

  private getProvider() {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new BadRequestException('未配置 DEEPSEEK_API_KEY');
    const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
    // DeepSeek only supports Chat Completions (/v1/chat/completions), not Responses API
    return (model: string) => client.chat(model);
  }

  /** 将 AI SDK textStream 手动 pipe 到 Express Response */
  private async pipeStream(
    textStream: AsyncIterable<string>,
    res: Response,
  ) {
    for await (const chunk of textStream) {
      if (!res.writableEnded) {
        res.write(chunk);
      }
    }
    if (!res.writableEnded) {
      res.end();
    }
  }

  // ======================================================
  // 1. 作答评分（streaming text/plain）
  // ======================================================
  async streamFeedback(dto: GetFeedbackDto, res: Response) {
    const q = await this.loadQuestion(dto.questionId);
    const provider = this.getProvider();

    const questionText    = (q as any).content?.promptEn ?? (q as any).title ?? '';
    const referenceAnswer = (q as any).content?.answerEn ?? '';
    const keywords        = (q as any).keywords ?? [];

    const systemPrompt = `You are a supportive English language coach for Chinese tour guide exam candidates.
Your role is to give balanced, encouraging, and practical feedback.
Key principles:
- If the student's answer covers the main points of the reference answer, recognize that as a good answer.
- Only point out improvements that are genuinely significant (not minor stylistic preferences).
- Be warm and specific. Avoid over-criticism.
Always respond in Chinese. Use markdown for clear structure.`;

    const userPrompt = `## 题目
${questionText}

## 参考答案要点
${referenceAnswer}

## 关键词
${keywords.length ? keywords.join('、') : '无'}

## 学生作答
${dto.userAnswer}
${dto.isVoice ? '\n（以上为语音录音转写，请额外关注表达流畅度）' : ''}

请给出简洁实用的点评，结构如下：

### 📊 综合评分
0-100 分，一句话说明（与参考答案要点的覆盖程度为主要依据，不要因表达方式不同而扣分）。

### ✅ 答得好的地方
2-3 个具体亮点，鼓励到位。

### 🎯 可以更好的地方
**仅列出参考答案中学生明显遗漏或表达有误的内容**（若基本覆盖则可写"整体表达完整，继续保持"），限 1-2 条。

### 📝 关键词使用
简短说明关键词覆盖情况（用到哪些 / 遗漏了哪些），若全部覆盖则肯定一下。${dto.isVoice ? '\n\n### 🎙️ 流畅度\n根据转写文本简短评价表达的自然流畅程度。' : ''}`;

    const result = streamText({
      model: provider('deepseek-chat'),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.4,
      maxOutputTokens: 800,
    });

    await this.pipeStream(result.textStream, res);
  }

  // ======================================================
  // 2. 教学指导（streaming + tools）
  // ======================================================
  async streamTeaching(dto: GetTeachingDto, res: Response) {
    const q = await this.loadQuestion(dto.questionId);
    const provider = this.getProvider();

    const questionText    = (q as any).content?.promptEn ?? (q as any).title ?? '';
    const keywords        = (q as any).keywords ?? [];
    const focusWords      = (q as any).focusWords ?? [];

    const systemPrompt = `You are a warm, patient, and deeply knowledgeable English tutor specializing in Chinese tour guide oral exams.
Your teaching style:
- Never give the full answer directly — guide through hints and questions
- Explain WHY things work (grammar logic, cultural context)
- Use concrete examples from everyday English
- Break complex answers into manageable building blocks
- Celebrate small wins and progress
Always respond in Chinese. Use markdown for clear structure.`;

    const userPrompt = `## 题目
${questionText}

## 学生草稿
${dto.userDraft?.trim() || '（学生尚未开始作答）'}

## 需要覆盖的要点
关键词：${keywords.length ? keywords.join('、') : '无'}
重点词汇：${focusWords.length ? focusWords.join('、') : '无'}

请扮演一位贴心的英语老师，为学生提供**学习指导**（不是直接给答案）：

### 🧭 审题指引
帮助学生理解题目在问什么，应该从哪些角度回答。

### 📚 知识点梳理
列出回答这道题需要了解的 2-3 个**关键知识点或文化背景**（中英文对照）。

### 🔤 句型结构建议
推荐 2-3 个适合这道题的**英文句型框架**，附中文说明和填空示例。

### 💬 词汇提示
列出 4-6 个**建议使用的词汇或短语**，附词性、中文意思和例句。

### ✍️ 第一步提示
给出构建答案的第一个具体步骤或提示句，引导学生开始动笔。`;

    const result = streamText({
      model: provider('deepseek-chat'),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.6,
      maxOutputTokens: 1000,
    });

    await this.pipeStream(result.textStream, res);
  }

  // ======================================================
  // 3. 单词增强：中文翻译 + 分级例句（返回 JSON）
  // ======================================================
  async enrichWord(dto: WordEnrichmentDto): Promise<WordEnrichmentResult> {
    const provider = this.getProvider();

    const prompt = `You are an English vocabulary teacher helping Chinese learners.
For the English word "${dto.word}"${dto.englishDefinitions ? `, which has these English meanings:\n${dto.englishDefinitions}` : ''}, provide rich learning material.

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "chineseTranslation": "简明中文释义（20字以内，覆盖主要词义）",
  "meanings": [
    { "partOfSpeech": "noun", "chineseGloss": "该词性的中文说明" }
  ],
  "examples": [
    { "en": "Simple everyday sentence.", "zh": "对应中文翻译。", "level": "basic" },
    { "en": "Another natural sentence with context.", "zh": "对应中文翻译。", "level": "basic" },
    { "en": "Intermediate sentence with richer context.", "zh": "对应中文翻译。", "level": "intermediate", "note": "可选学习提示" },
    { "en": "Advanced usage in professional or academic writing.", "zh": "对应中文翻译。", "level": "advanced" },
    { "en": "Complex sentence showing nuanced or idiomatic usage.", "zh": "对应中文翻译。", "level": "advanced" }
  ],
  "memoryTip": "一句话记忆技巧或词根词缀分析（中文，30字以内）"
}

Rules:
- Exactly 5 examples: 2 basic, 1 intermediate, 2 advanced
- All "zh" must be natural, accurate Chinese translations
- Use realistic, diverse sentences — avoid repetitive patterns
- If relevant to travel/tourism/tour guide context, include at least one such example
- memoryTip must be practical and memorable for Chinese learners`;

    const { text } = await generateText({
      model: provider('deepseek-chat'),
      prompt,
      temperature: 0.3,
      maxOutputTokens: 900,
    });

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as WordEnrichmentResult;
    } catch {
      return { chineseTranslation: '（数据加载失败）', meanings: [], examples: [], memoryTip: '' };
    }
  }
}
