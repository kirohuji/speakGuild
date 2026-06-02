import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { DialogueTurnJudgeDto } from './dto/english-feedback.dto';

@Injectable()
export class EnglishPracticeAiService {
  private readonly logger = new Logger(EnglishPracticeAiService.name);

  private getProvider() {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new BadRequestException('未配置 DEEPSEEK_API_KEY');
    const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
    return (model: string) => client.chat(model);
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

  /** 单词增强：中文释义 + 分级例句 */
  async enrichWord(word: string, englishDefinitions?: string) {
    const provider = this.getProvider();
    const defHint = englishDefinitions ? `\n英文释义参考：${englishDefinitions}` : '';

    const prompt = `请为英语单词/短语"${word}"提供学习辅助信息。${defHint}

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
}
