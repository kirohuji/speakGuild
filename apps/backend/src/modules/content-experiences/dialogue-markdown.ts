/** 对话写作题 Markdown 解析（与 admin「导出 Markdown」格式一致） */

export type DialogueTurnMarkdown = {
  aText: string;
  hint: string;
  referenceAnswer: string;
  referenceExplanation: string;
};

export type ParsedDialogueMarkdown = {
  title: string;
  situation: string;
  turns: DialogueTurnMarkdown[];
  description: string;
  promptEn: string;
  promptZh: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
  );
  const match = markdown.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function extractSubSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)###\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|\\n##\\s+|$)`,
  );
  const match = markdown.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function extractLabeledBlock(section: string, label: string): string {
  const pattern = new RegExp(
    `\\*\\*${escapeRegExp(label)}\\*\\*\\s*\\n+([\\s\\S]*?)(?=\\n\\*\\*|\\n###\\s+|$)`,
  );
  const match = section.match(pattern);
  return (match?.[1] ?? '').trim();
}

export function stripMarkdownFences(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/```(?:markdown|md)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

export function parseDialogueMarkdown(markdown: string): ParsedDialogueMarkdown {
  const cleaned = stripMarkdownFences(markdown);
  const title = (cleaned.match(/^#\s+(.+)$/m)?.[1] ?? '').trim();
  const situation = extractSection(cleaned, '情境描述');
  const dialogueBody = extractSection(cleaned, '对话轮次');
  const descriptionSection = extractSection(cleaned, '话题说明');
  const promptEn = extractSubSection(descriptionSection || cleaned, '英文提示');
  const promptZh = extractSubSection(descriptionSection || cleaned, '中文提示');

  let description = descriptionSection
    .replace(/(?:^|\n)###\s+英文提示\s*\n[\s\S]*?(?=\n###\s+|$)/, '')
    .replace(/(?:^|\n)###\s+中文提示\s*\n[\s\S]*?(?=\n###\s+|$)/, '')
    .trim();

  const turnChunks = dialogueBody
    .split(/(?=###\s+第\s*\d+\s*轮)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^###\s+第\s*\d+\s*轮/.test(chunk));

  const turns: DialogueTurnMarkdown[] = turnChunks.map((chunk) => {
    const explanationMatch = chunk.match(/\*\*参考见解\*\*\s*\n+([\s\S]*)$/);
    const referenceExplanation = (explanationMatch?.[1] ?? '').replace(/\n+$/, '').trim();
    const beforeExplanation = explanationMatch ? chunk.slice(0, explanationMatch.index) : chunk;
    return {
      aText: extractLabeledBlock(beforeExplanation, 'A 台词'),
      hint: extractLabeledBlock(beforeExplanation, 'B 中文提示'),
      referenceAnswer: extractLabeledBlock(beforeExplanation, 'B 参考答案'),
      referenceExplanation,
    };
  });

  return { title, situation, turns, description, promptEn, promptZh };
}
