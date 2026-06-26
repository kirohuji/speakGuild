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
}

export interface VocabularyAiEnrichResult {
  phoneticUs: string;
  phoneticUk: string;
  definitionTranslations: string[];
  generatedExamples: { en: string; zh: string; level: string }[];
  meaning: string;
  description: string;
}

export interface TextAiEnrichResult {
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
    return JSON.parse(cleaned);
  }

  async enrichVocabulary(dto: VocabularyAiEnrichInput): Promise<VocabularyAiEnrichResult> {
    const model = this.getDeepSeekModel();
    const defLines = dto.definitions.map((d, i) => `${i + 1}. ${d}`).join('\n');
    const dictExLines = dto.examples.map((e, i) => `${i + 1}. ${e.en}`).join('\n');
    const phoneticUsInput = dto.phoneticUs || '(未提供)';
    const phoneticUkInput = dto.phoneticUk || '(未提供)';

    let chunkRefs = '';
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

    const { text } = await generateText({
      model,
      prompt: `You are a senior bilingual lexicographer building a Chinese-English learner's dictionary. Your readers are Chinese speakers learning English at intermediate level (B1-B2 CEFR). Your work must be accurate, natural, and pedagogically useful.

## Task
Given an English word and its dictionary definitions, produce Chinese translations, generate NEW original example sentences, clean IPA phonetics, and learning notes.

## Input
Word: "${dto.word}"

Current US phonetic: ${phoneticUsInput}
Current UK phonetic: ${phoneticUkInput}

English definitions (one per line, format "POS: definition"):
${defLines || '(none)'}

Dictionary example sentences (for reference only — do NOT translate these, generate NEW ones):
${dictExLines || '(none)'}
${chunkRefs}
## Output Schema
Return exactly a JSON object with these fields — no markdown, no code fences, just the raw JSON:

{
  "phoneticUs": "标准美式IPA音标，带 / / 斜杠。如无输入则根据单词知识生成。例：/ˌɪntrəˈduːs/",
  "phoneticUk": "标准英式IPA音标，带 / / 斜杠。如无输入则根据单词知识生成。例：/ˌɪntrəˈdjuːs/",
  "definitionTranslations": ["数组，长度与 definitions 相同。每条英文释义的自然中文翻译。保留括号说明但需地道。"],
  "generatedExamples": [
    { "en": "原创英文例句（不要照抄词典例句或参考句块，要全新创作）", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced" }
  ],
  "meaning": "按词性分组的简洁中文关键词。同一词性只写一个POS前缀，所有该词性义项用；连接。不同词性用 / 分隔。",
  "description": "中文学习笔记，轻量 Markdown。结构按需：**核心含义：**/**用法提示：**/**易错点：**/**常见搭配：**。英文用反引号。语气亲切。80-200字。无释义时返回空字符串"
}

## Example Generation Rules
- Generate 3-5 original example sentences that demonstrate the word's MAIN senses.
- Each example must be a NEW sentence you create — do NOT copy or translate the dictionary examples.
- If reference chunks are provided above, use them as style/level inspiration, but write completely different sentences.
- Vary difficulty: at least one basic (A2), one intermediate (B1), one advanced (B2).
- Each example must have a natural Chinese translation.

## Phonetic Standards
Use CLEAN standard IPA inside /slashes/. Normalize /ɹ/ to /r/, syllabic consonants to vowel+consonant, remove syllable boundary dots, and output both US and UK IPA even if input is missing.

## Quality Principles
1. Translations must sound like natural Chinese, not machine-translated English.
2. The meaning field must cover EVERY sense — no merging.
3. Description should focus on what's HARD for Chinese learners.
4. Generated examples must be DIVERSE — different sentence structures, contexts, and registers.`,
      temperature: 0.4,
      maxOutputTokens: 2500,
    });

    const result = this.parseJsonText(text);
    return {
      phoneticUs: result.phoneticUs ?? '',
      phoneticUk: result.phoneticUk ?? '',
      definitionTranslations: result.definitionTranslations ?? [],
      generatedExamples: (result.generatedExamples ?? []).map((e: any) => ({
        en: e.en || '',
        zh: e.zh || '',
        level: e.level || 'intermediate',
      })),
      meaning: result.meaning ?? '',
      description: result.description ?? '',
    };
  }

  async enrichChunk(dto: { text: string; meaning: string }): Promise<TextAiEnrichResult> {
    const model = this.getDeepSeekModel();
    const { text } = await generateText({
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
  "description": "中文学习笔记，轻量 Markdown。结构按需：**核心含义：** 一句话概括这个表达的核心意思。**用法提示：** 什么场景用、语体正式/非正式、常见搭配。**易错点：** 中国学习者容易犯的错误。**类似表达：** 意思相近的其他说法（可选）。英文单词用反引号。小节之间空行分隔。80-150字。语气亲切如老师。",
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
    return {
      description: result.description ?? '',
      examples: (result.examples ?? []).map((e: any) => ({
        en: e.en || '',
        zh: e.zh || '',
        level: e.level || 'intermediate',
      })),
    };
  }

  async enrichPattern(dto: { pattern: string; meaning: string }): Promise<TextAiEnrichResult> {
    const model = this.getDeepSeekModel();
    const { text } = await generateText({
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
  "examples": [
    { "en": "将每个 __ 替换成具体、有趣的单词。句子自然地道，像真人说的话。", "zh": "自然的中文翻译", "level": "basic/intermediate/advanced" }
  ],
  "description": "中文讲解，轻量 Markdown 排版。结构：\\n\\n**句式解析：** 这个句型表达什么逻辑关系。\\n\\n**使用场景：** 口语/书面、正式/随意。\\n\\n**易错点：** 中国学习者常见错误。\\n\\n**替换练习：** 2-3个可填入 __ 的单词/短语，用 - 列表。\\n\\n小节间空行分隔。英文单词用反引号。语气亲切。120-200字。"
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
    return {
      examples: (result.examples ?? []).map((e: any) => ({
        en: e.en || '',
        zh: e.zh || '',
        level: e.level || 'intermediate',
      })),
      description: result.description ?? '',
    };
  }
}
