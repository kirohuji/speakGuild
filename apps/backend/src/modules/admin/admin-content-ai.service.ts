import { Injectable } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface VocabularyAiEnrichInput {
  word: string;
  definitions: string[];
  examples: { en: string }[];
  phoneticUs?: string;
  phoneticUk?: string;
  /** 已有字段状态：缺什么补什么，避免重复生成已有内容（缺省视为缺失） */
  meaningExists?: boolean;
  descriptionExists?: boolean;
  difficultyExists?: boolean;
}

export interface VocabularyAiEnrichResult {
  phoneticUs: string;
  phoneticUk: string;
  definitionTranslations: string[];
  generatedExamples: { en: string; zh: string; level: string }[];
  meaning: string;
  description: string;
  /** 词汇难度等级 L1~L5（与语料库 difficulty 字段对齐） */
  difficulty: string;
}

/** 单次 LLM 调用的 token 用量 */
export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 兼容新旧 AI SDK 的 usage 结构 */
export function extractUsage(usage: any): AiUsage | null {
  if (!usage) return null;
  const promptTokens = usage.promptTokens ?? usage.inputTokens ?? 0;
  const completionTokens = usage.completionTokens ?? usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

export interface TextAiEnrichResult {
  meaning: string;
  description: string;
  examples: { en: string; zh: string; level: string }[];
}

/** 句块/句式条目缺失字段标记：true = 缺失，需要 AI 生成 */
export interface TextMissingFields {
  meaning: boolean;
  description: boolean;
  examples: boolean;
}

/** 批量富化输入条目 */
export interface TextBatchEnrichItem {
  id: string;
  text: string;
  meaning: string;
  missing: TextMissingFields;
}

export interface TextBatchEnrichResult {
  meaning: string;
  description: string;
  examples: { en: string; zh: string; level: string }[];
}

@Injectable()
export class AdminContentAiService {
  constructor(private readonly prisma: PrismaService) {}

  private getDeepSeekModel() {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
    const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
    return client.chat('deepseek-chat');
  }

  private parseJsonText(text: string) {
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // 容错：截取第一个 { 到最后一个 } 再解析，避免 AI 输出多余文字导致整次调用作废
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error('AI 输出不是有效 JSON');
    }
  }

  async enrichVocabulary(
    dto: VocabularyAiEnrichInput,
    onUsage?: (usage: AiUsage) => void,
  ): Promise<VocabularyAiEnrichResult> {
    const model = this.getDeepSeekModel();
    const defLines = dto.definitions.map((d, i) => `${i + 1}. ${d}`).join('\n');
    const phoneticUsInput = dto.phoneticUs || '(未提供)';
    const phoneticUkInput = dto.phoneticUk || '(未提供)';

    // 字段状态：缺什么补什么，避免重复翻译/生成已有内容
    const meaningExists = dto.meaningExists ?? false;
    const descriptionExists = dto.descriptionExists ?? false;
    const difficultyExists = dto.difficultyExists ?? false;
    const phoneticsExist = !!(dto.phoneticUs && dto.phoneticUk);
    const needExamples = dto.examples.length < 3; // 词典例句不足 3 条才需要 AI 生成
    const dictExLines = dto.examples.map((e, i) => `${i + 1}. ${e.en}`).join('\n');

    // 仅当需要生成例句时才查询相关句块作为风格参考（减少输入 token）
    let chunkRefs = '';
    if (needExamples) {
      try {
        const relatedChunks = await this.prisma.chunk.findMany({
          where: { text: { contains: dto.word, mode: 'insensitive' } },
          include: { examples: { take: 2, orderBy: { sortOrder: 'asc' } } },
          take: 5,
        });
        if (relatedChunks.length > 0) {
          chunkRefs = '\n## Reference chunks from our learning platform (use as inspiration for example style — do NOT copy verbatim):\n';
          for (const c of relatedChunks) {
            chunkRefs += `- Chunk: "${c.text}" (${c.meaning})`;
            if (c.examples.length > 0) {
              chunkRefs += ` | Examples: ${c.examples.map(e => `"${e.en}"`).join(', ')}`;
            }
            chunkRefs += '\n';
          }
        }
      } catch {
        // Reference chunks are helpful but non-critical.
      }
    }

    const fieldStatus = [
      `- Chinese meaning (中文释义): ${meaningExists ? 'EXISTS — return empty string' : 'MISSING — provide it'}`,
      `- Description (讲解): ${descriptionExists ? 'EXISTS — return empty string' : 'MISSING — provide it'}`,
      `- Difficulty (难度): ${difficultyExists ? 'EXISTS — return empty string' : 'MISSING — provide it'}`,
      `- Phonetics (音标): ${phoneticsExist ? 'EXISTS — return empty strings' : 'MISSING — generate them'}`,
      `- Example sentences (例句): ${needExamples ? 'MISSING — generate 3-5 new ones' : `EXISTS (${dto.examples.length} dictionary examples) — return empty array`}`,
    ].join('\n');

    const { text, usage } = await generateText({
      model,
      prompt: `You are a senior bilingual lexicographer building a Chinese-English learner's dictionary. Your readers are Chinese speakers learning English at intermediate level (B1-B2 CEFR). Your work must be accurate, natural, and pedagogically useful.

## Task
Given an English word and its dictionary definitions, fill ONLY the MISSING fields listed below. Do NOT regenerate fields that already exist.

## Input
Word: "${dto.word}"

Current US phonetic: ${phoneticUsInput}
Current UK phonetic: ${phoneticUkInput}

English definitions (one per line, format "POS: definition  [中文翻译]", most already include a Chinese translation in [brackets]):
${defLines || '(none)'}

Dictionary example sentences (for reference only — do NOT translate these, generate NEW ones if needed):
${dictExLines || '(none)'}
${chunkRefs}
## Current field status — fill ONLY the MISSING ones
${fieldStatus}

## Output Schema
Return exactly a JSON object with these fields — no markdown, no code fences, just the raw JSON:

{
  "phoneticUs": "仅当音标 MISSING 时给出标准美式IPA，带 / / 斜杠，如 /ˌɪntrəˈduːs/；已存在则返回空字符串",
  "phoneticUk": "仅当音标 MISSING 时给出标准英式IPA，如 /ˌɪntrəˈdjuːs/；已存在则返回空字符串",
  "definitionTranslations": ["数组长度与 definitions 一致：仅翻译没有 [中文] 的条目（保留括号说明但需地道），已有中文的条目返回空字符串；全部已有中文时返回空数组"],
  "generatedExamples": [
    { "en": "原创英文例句（不要照抄词典例句或参考句块，要全新创作）", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced" }
  ],
  "meaning": "仅当中文释义 MISSING 时提供：按词性分组的简洁中文关键词。每个词性组必须以英文缩写POS前缀开头，且只能使用：n. v. adj. adv. pron. prep. conj. interj. num. det. art. phr. modal v. other（禁止中文词性如“名词/动词”，禁止英文全词如 noun/verb，缩写必须带点号）。同一词性所有义项用；连接，不同词性用 / 分隔。示例：n. 苹果；苹果树 / v. 结果实",
  "description": "仅当讲解 MISSING 时提供：中文学习笔记，轻量 Markdown。结构按需：**核心含义：**/**用法提示：**/**易错点：**/**常见搭配：**。每个小节独立成段，在下一个 **小节标题：** 之前必须空一行分隔，段内不要换行。英文用反引号。语气亲切。80-200字。",
  "difficulty": "仅当难度 MISSING 时提供：词汇难度等级，必须是 L1|L2|L3|L4|L5 之一：L1=基础高频（中考核心，如 apple/help）、L2=常用（高考核心，如 appointment/attitude）、L3=核心（大学四级/雅思6分，如 accommodate/derive）、L4=进阶（六级/雅思6.5-7，如 ambiguous/endeavor）、L5=低频专业（雅思7.5+/托福，如 ubiquitous/paradigm）。依据：词频、学习阶段、抽象程度。"
}

## Example Generation Rules (only when 例句 MISSING)
- Generate 3-5 original example sentences that demonstrate the word's MAIN senses.
- Each example must be a NEW sentence you create — do NOT copy or translate the dictionary examples.
- If reference chunks are provided above, use them as style/level inspiration, but write completely different sentences.
- Vary difficulty: at least one basic (A2), one intermediate (B1), one advanced (B2).
- Each example must have a natural Chinese translation.

## Phonetic Standards (only when 音标 MISSING)
Use CLEAN standard IPA inside /slashes/. Normalize /ɹ/ to /r/, syllabic consonants to vowel+consonant, remove syllable boundary dots, and output both US and UK IPA.

## Quality Principles
1. Translations must sound like natural Chinese, not machine-translated English.
2. The meaning field must cover EVERY sense — no merging.
3. Description should focus on what's HARD for Chinese learners.
4. Generated examples must be DIVERSE — different sentence structures, contexts, and registers.`,
      temperature: 0.4,
      maxOutputTokens: 2500,
    });

    let result: any;
    let usageData = usage;
    try {
      result = this.parseJsonText(text);
    } catch {
      // 主调用 JSON 解析失败：降级重试一次，只要求核心字段（避免整次调用作废）
      const retryPrompt = `为英语单词 "${dto.word}" 生成中文学习内容。\n\n义项：\n${defLines}\n\n返回 JSON（无 markdown）：\n{"meaning": "按词性分组的中文释义（如 n. 苹果；苹果树 / v. 结果实）", "description": "80-150字中文讲解，含**核心含义：**/**用法提示：**/**易错点：**等小节，小节间空行分隔", "generatedExamples": [{"en": "原创英文例句", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced"}]}`;
      const retry = await generateText({
        model,
        prompt: retryPrompt,
        temperature: 0.4,
        maxOutputTokens: 1200,
      });
      usageData = retry.usage;
      result = this.parseJsonText(retry.text);
    }
    if (usageData) onUsage?.(extractUsage(usageData)!);
    return {
      phoneticUs: result.phoneticUs ?? '',
      phoneticUk: result.phoneticUk ?? '',
      definitionTranslations: Array.isArray(result.definitionTranslations) ? result.definitionTranslations : [],
      generatedExamples: (result.generatedExamples ?? []).map((e: any) => ({
        en: e.en || '',
        zh: e.zh || '',
        level: e.level || 'intermediate',
      })),
      meaning: result.meaning ?? '',
      description: result.description ?? '',
      difficulty: ['L1', 'L2', 'L3', 'L4', 'L5'].includes(result.difficulty) ? result.difficulty : '',
    };
  }

  /**
   * 轻量修补：精简冗长的中文释义 + 为缺中文翻译的例句补翻译。
   * 只传 word/释义/缺 zh 的例句，不传 definitions 等大字段，单次调用输入很小。
   */
  async polishVocabulary(
    dto: {
      word: string;
      meaning: string;
      examples: { en: string }[];
    },
    onUsage?: (usage: AiUsage) => void,
  ): Promise<{ meaning: string; translations: { en: string; zh: string }[] }> {
    const model = this.getDeepSeekModel();
    const exLines = dto.examples.map((e, i) => `${i + 1}. ${e.en}`).join('\n');
    const { text, usage } = await generateText({
      model,
      prompt: `You are maintaining a Chinese-English learner's dictionary for Chinese speakers at B1-B2 level.

## Task
Fix the word below in TWO ways:
1. CONCISE the Chinese meaning: it is currently too verbose (a full dictionary definition). Rewrite it as a short learner-friendly gloss.
2. Translate the example sentences (without Chinese) into natural Chinese.

## Input
Word: "${dto.word}"

Current Chinese meaning (too verbose, needs condensing):
${dto.meaning || '(none)'}

Example sentences needing Chinese translation:
${exLines || '(none)'}

## Rules
- meaning: keep POS abbreviations (n. v. adj. adv. etc.). Group senses of the same POS with ；, separate different POS with /. Keep only the 2-3 most common/useful senses; drop rare or redundant ones. Max ~50 Chinese characters. If the meaning is already concise (<=50 chars), return it unchanged.
- translations: natural, idiomatic Chinese. One per example, same order as input. Must not be a machine-literal translation.

## Output (raw JSON, no markdown, no code fences)
{
  "meaning": "精简后的中文释义",
  "translations": ["例句1中文翻译", "例句2中文翻译"]
}`,
      temperature: 0.3,
      maxOutputTokens: 600,
    });

    let result: any;
    try {
      result = this.parseJsonText(text);
    } catch {
      return { meaning: '', translations: [] };
    }
    if (usage) onUsage?.(extractUsage(usage)!);

    const translations = (Array.isArray(result.translations) ? result.translations : [])
      .map((zh: any, i: number) => ({ en: dto.examples[i]?.en ?? '', zh: typeof zh === 'string' ? zh : '' }))
      .filter((t: { en: string; zh: string }) => t.en && t.zh.trim());
    return { meaning: typeof result.meaning === 'string' ? result.meaning : '', translations };
  }

  async enrichChunk(
    dto: { text: string; meaning: string },
    onUsage?: (usage: AiUsage) => void,
  ): Promise<TextAiEnrichResult> {
    const model = this.getDeepSeekModel();
    const { text, usage } = await generateText({
      model,
      prompt: `You are a senior English teacher creating learning materials for Chinese speakers at B1-B2 level.

## Task
Given an English chunk (a reusable expression unit), generate a Chinese explanation and example sentences.

## Input
Chunk: "${dto.text}"
Chinese meaning: ${dto.meaning || '(未提供)'}

## Output Schema
Return exactly a JSON object — no markdown, no code fences:

{
  "meaning": "简洁地道的中文释义，一句话概括句块的核心意思并覆盖常见用法；若原有释义不准确或生硬则重写。",
  "description": "中文学习笔记，轻量 Markdown。结构按需：**核心含义：** 一句话概括这个表达的核心意思。**用法提示：** 什么场景用、语体正式/非正式、常见搭配。**易错点：** 中国学习者容易犯的错误。**类似表达：** 意思相近的其他说法（可选）。英文单词用反引号。每个小节标题前必须空一行（\n\n），段内不要换行。80-150字。语气亲切如老师。",
  "examples": [
    { "en": "原创英文例句，展示该句块在不同场景的自然用法", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced" }
  ]
}

## Example Generation Rules
- Generate 3-4 original example sentences that demonstrate the chunk in different contexts.
- Vary difficulty: at least one basic (A2), one intermediate (B1).
- Show different sentence positions and variations.
- Each example must have a natural Chinese translation.

## Quality Principles
1. Description must be practical — focus on what Chinese learners find confusing.
2. Examples should sound like real conversations, not textbook drills.
3. If the chunk has multiple meanings, cover the most common one.`,
      temperature: 0.4,
      maxOutputTokens: 1500,
    });
    const result = this.parseJsonText(text);
    if (usage) onUsage?.(extractUsage(usage)!);
    return {
      meaning: result.meaning ?? '',
      description: result.description ?? '',
      examples: (result.examples ?? []).map((e: any) => ({
        en: e.en || '',
        zh: e.zh || '',
        level: e.level || 'intermediate',
      })),
    };
  }

  async enrichPattern(
    dto: { pattern: string; meaning: string },
    onUsage?: (usage: AiUsage) => void,
  ): Promise<TextAiEnrichResult> {
    const model = this.getDeepSeekModel();
    const { text, usage } = await generateText({
      model,
      prompt: `You are a senior English teacher creating learning materials for Chinese speakers at B1-B2 level.

## Task
Given an English sentence pattern with blanks (marked as __), generate example sentences and a Chinese explanation.

## Input
Pattern: "${dto.pattern}"
Chinese meaning: ${dto.meaning || '(未提供)'}

## Output Schema
Return exactly a JSON object — no markdown, no code fences:

{
  "meaning": "简洁地道的中文释义，说明这个句型表达的逻辑关系；若原有释义不准确或生硬则重写。",
  "examples": [
    { "en": "将每个 __ 替换成具体、有趣的单词。句子自然地道，像真人说的话。", "zh": "自然的中文翻译", "level": "basic/intermediate/advanced" }
  ],
  "description": "中文讲解，轻量 Markdown 排版。结构：\n\n**句式解析：** 这个句型表达什么逻辑关系。\n\n**使用场景：** 口语/书面、正式/随意。\n\n**易错点：** 中国学习者常见错误。\n\n**替换练习：** 2-3个可填入 __ 的单词/短语，用 - 列表。\n\n小节间空行分隔。英文单词用反引号。语气亲切。120-200字。"
}

## Rules for Examples
- Generate 3-4 examples of varying difficulty (basic → intermediate → advanced).
- Vary the vocabulary and context across examples.
- Use vivid, specific vocabulary.
- Each example should sound like something a native speaker would actually say.

## Quality Standards
1. Examples MUST sound natural, not like textbook drills.
2. Description should teach something the learner didn't already know.
3. Include at least one common mistake Chinese learners make.`,
      temperature: 0.5,
      maxOutputTokens: 1500,
    });
    const result = this.parseJsonText(text);
    if (usage) onUsage?.(extractUsage(usage)!);
    return {
      meaning: result.meaning ?? '',
      examples: (result.examples ?? []).map((e: any) => ({
        en: e.en || '',
        zh: e.zh || '',
        level: e.level || 'intermediate',
      })),
      description: result.description ?? '',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 批量按缺补缺（句块/句式共用内核）
  // ─────────────────────────────────────────────────────────────

  private static TEXT_ENRICH_PROFILES = {
    chunk: {
      kindLabel: 'Chunk',
      task: 'Given an English chunk (a reusable expression unit), fill the MISSING fields: Chinese explanation, learning notes, and example sentences.',
      descSchema: '中文学习笔记，轻量 Markdown。结构按需：**核心含义：** 一句话概括这个表达的核心意思。**用法提示：** 什么场景用、语体正式/非正式、常见搭配。**易错点：** 中国学习者容易犯的错误。**类似表达：** 意思相近的其他说法（可选）。英文单词用反引号。每个小节标题前必须空一行，段内不要换行。80-150字。语气亲切如老师。',
      rules: `- Examples: 3-4 original sentences demonstrating the chunk in different contexts, each with a natural Chinese translation.
- Vary difficulty: at least one basic (A2), one intermediate (B1).
- Show different sentence positions and variations.
- Examples should sound like real conversations, not textbook drills.`,
    },
    pattern: {
      kindLabel: 'Pattern',
      task: 'Given an English sentence pattern with blanks (marked as __), fill the MISSING fields: example sentences and a Chinese explanation.',
      descSchema: '中文讲解，轻量 Markdown 排版。结构：**句式解析：** 这个句型表达什么逻辑关系。**使用场景：** 口语/书面、正式/随意。**易错点：** 中国学习者常见错误。**替换练习：** 2-3个可填入 __ 的单词/短语，用 - 列表。小节间空行分隔。英文单词用反引号。语气亲切。120-200字。',
      rules: `- Examples: 3-4 sentences of varying difficulty (basic → intermediate → advanced), each with a natural Chinese translation.
- Vary the vocabulary and context across examples; use vivid, specific vocabulary.
- Each example should sound like something a native speaker would actually say.
- Description should teach something the learner didn't already know, including at least one common mistake Chinese learners make.`,
    },
  } as const;

  private missingFieldsLabel(missing: TextMissingFields): string {
    const parts: string[] = [];
    if (missing.meaning) parts.push('meaning（中文释义）');
    if (missing.description) parts.push('description（讲解）');
    if (missing.examples) parts.push('examples（例句）');
    return parts.length > 0 ? parts.join(', ') : '(none)';
  }

  /** 批量富化句块（按缺补缺）。每批 5 条共享一次调用；批量失败时逐条降级。 */
  async enrichChunksBatch(
    items: TextBatchEnrichItem[],
    onUsage?: (usage: AiUsage) => void,
  ): Promise<Array<{ id: string; result: TextBatchEnrichResult }>> {
    return this.enrichTextsBatch(items, 'chunk', onUsage);
  }

  /** 批量富化句式（按缺补缺）。每批 5 条共享一次调用；批量失败时逐条降级。 */
  async enrichPatternsBatch(
    items: TextBatchEnrichItem[],
    onUsage?: (usage: AiUsage) => void,
  ): Promise<Array<{ id: string; result: TextBatchEnrichResult }>> {
    return this.enrichTextsBatch(items, 'pattern', onUsage);
  }

  private async enrichTextsBatch(
    items: TextBatchEnrichItem[],
    kind: 'chunk' | 'pattern',
    onUsage?: (usage: AiUsage) => void,
  ): Promise<Array<{ id: string; result: TextBatchEnrichResult }>> {
    const model = this.getDeepSeekModel();
    const BATCH_SIZE = 5;
    const results: Array<{ id: string; result: TextBatchEnrichResult }> = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      try {
        const { text, usage } = await generateText({
          model,
          prompt: this.buildBatchPrompt(batch, kind),
          temperature: 0.4,
          maxOutputTokens: 6000,
        });
        if (usage) onUsage?.(extractUsage(usage)!);
        const parsed = this.parseJsonArrayText(text);
        results.push(...batch.map((item, idx) => ({ id: item.id, result: this.normalizeTextResult(parsed[idx]) })));
      } catch {
        // 批量失败：逐条降级（仍按缺补缺），避免整批作废
        for (const item of batch) {
          try {
            const { text, usage } = await generateText({
              model,
              prompt: this.buildSinglePrompt(item, kind),
              temperature: 0.4,
              maxOutputTokens: 1500,
            });
            if (usage) onUsage?.(extractUsage(usage)!);
            results.push({ id: item.id, result: this.normalizeTextResult(this.parseJsonText(text)) });
          } catch {
            results.push({ id: item.id, result: { meaning: '', description: '', examples: [] } });
          }
        }
      }
    }
    return results;
  }

  private buildBatchPrompt(items: TextBatchEnrichItem[], kind: 'chunk' | 'pattern'): string {
    const profile = AdminContentAiService.TEXT_ENRICH_PROFILES[kind];
    const inputLines = items
      .map((item, i) => `### ${profile.kindLabel} ${i + 1}\nText: "${item.text}"\nChinese meaning (current): ${item.meaning || '(未提供)'}\nMissing fields: ${this.missingFieldsLabel(item.missing)}`)
      .join('\n\n');
    return `You are a senior English teacher creating learning materials for Chinese speakers at B1-B2 level.

## Task
${profile.task}
For each item, fill ONLY the fields marked MISSING. Do NOT regenerate fields that already exist.

## Input
${inputLines}

## Output Schema
Return exactly a raw JSON array with ${items.length} objects, one per item, in the same order as the input — no markdown, no code fences:

[
  {
    "meaning": "仅当该条 meaning 缺失时提供：简洁地道的中文释义，一句话概括句块的核心意思并覆盖常见用法；已存在则省略此字段",
    "description": "仅当该条 description 缺失时提供：${profile.descSchema}",
    "examples": [
      { "en": "原创英文例句，展示该句块在不同场景的自然用法", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced" }
    ]
  }
]

## Rules
- Omit any key whose field already exists (do NOT return empty strings for existing fields). If ALL fields exist, return {}.
- examples: only when the item's examples are MISSING, generate 3-4 original examples; every example must have a natural Chinese translation.
- meaning / description: only when the corresponding field is MISSING.
${profile.rules}`;
  }

  private buildSinglePrompt(item: TextBatchEnrichItem, kind: 'chunk' | 'pattern'): string {
    const profile = AdminContentAiService.TEXT_ENRICH_PROFILES[kind];
    return `You are a senior English teacher creating learning materials for Chinese speakers at B1-B2 level.

## Task
${profile.task}
Fill ONLY the fields marked MISSING below. Do NOT regenerate fields that already exist.

## Input
${profile.kindLabel}: "${item.text}"
Chinese meaning (current): ${item.meaning || '(未提供)'}
Missing fields: ${this.missingFieldsLabel(item.missing)}

## Output Schema
Return exactly a raw JSON object — no markdown, no code fences:

{
  "meaning": "仅当缺失时提供：简洁地道的中文释义，一句话概括核心意思；已存在则省略",
  "description": "仅当缺失时提供：${profile.descSchema}",
  "examples": [
    { "en": "原创英文例句", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced" }
  ]
}

## Rules
- Omit any key whose field already exists. If ALL fields exist, return {}.
- examples: only when missing, generate 3-4 original examples with natural Chinese translations.
${profile.rules}`;
  }

  private normalizeTextResult(raw: any): TextBatchEnrichResult {
    return {
      meaning: typeof raw?.meaning === 'string' ? raw.meaning : '',
      description: typeof raw?.description === 'string' ? raw.description : '',
      examples: Array.isArray(raw?.examples)
        ? raw.examples
            .map((e: any) => ({
              en: typeof e?.en === 'string' ? e.en : '',
              zh: typeof e?.zh === 'string' ? e.zh : '',
              level: typeof e?.level === 'string' ? e.level : 'intermediate',
            }))
            .filter((e: { en: string }) => e.en)
        : [],
    };
  }

  /**
   * 批量翻译英文句子为自然地道的中文（例句缺 zh 时补翻译用）。
   * 返回与输入同序的中文数组；解析失败返回空数组。
   */
  async translateSentencesBatch(
    sentences: { en: string }[],
    onUsage?: (usage: AiUsage) => void,
  ): Promise<string[]> {
    if (sentences.length === 0) return [];
    const model = this.getDeepSeekModel();
    const lines = sentences.map((s, i) => `${i + 1}. ${s.en}`).join('\n');
    const { text, usage } = await generateText({
      model,
      prompt: `You are a professional translator for a Chinese-English learning app. Your translations must be natural, idiomatic Chinese that Chinese learners can understand.

## Task
Translate the following English sentences into Chinese. Translate ALL of them, in the same order.

## Input
${lines}

## Output
Return exactly a raw JSON array of Chinese translations, one per sentence, in the same order as the input — no markdown, no code fences:
["翻译1", "翻译2", ...]

## Rules
- Natural, conversational Chinese. Not literal machine translation.
- Keep it concise: no explanations, no notes, no backticks.
- The output array MUST contain exactly ${sentences.length} strings.`,
      temperature: 0.3,
      maxOutputTokens: 1200,
    });
    if (usage) onUsage?.(extractUsage(usage)!);
    try {
      const parsed = this.parseJsonArrayText(text);
      if (!Array.isArray(parsed)) return [];
      return sentences.map((_, i) => (typeof parsed[i] === 'string' ? parsed[i] : ''));
    } catch {
      return [];
    }
  }

  private parseJsonArrayText(text: string) {
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // 容错：截取第一个 [ 到最后一个 ] 再解析，避免 AI 输出多余文字导致整次调用作废
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error('AI 输出不是有效 JSON 数组');
    }
  }
}
