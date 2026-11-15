import { alignDescriptionLayout, descriptionHasCanonicalLayout, descriptionHasLayoutDefect } from './description-layout';

export const LEARNER_EXAMPLE_RULE = '例句严格生成3–4条原创中英对照；用词自然、情境具体，展示常见义项或结构，不写文学化、生僻或牵强句子。每句优先6–16个英文单词，必要时可更短，不扩写成段落。覆盖不同日常场景和表达结构，以A2/B1为主，最多一条B2。中文翻译准确、自然，保留语气；英文不能只是换人称或换名词的机械重复。不要复制参考例句，不附无关解释或虚构音频地址。';

export function normalizeTeachingDescription(value: unknown): string {
  return alignDescriptionLayout(typeof value === 'string' ? value : '');
}

export function teachingDescriptionIssue(value: string): string | null {
  if (!descriptionHasCanonicalLayout(value) || descriptionHasLayoutDefect(value)) return '讲解必须依次包含四个完整小节，并使用统一的短段落排版';
  const names = ['核心含义', '用法提示', '易错点', '常见搭配'];
  const positions = names.map(name => value.indexOf(`**${name}：**`));
  if (positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1]))) return '四个小节的标题或顺序不正确';
  const body = value.replace(/\*\*[^*]+\*\*/g, '');
  const chineseCount = (body.match(/[\u3400-\u9fff]/g) ?? []).length;
  if (chineseCount < 80) return '讲解过于简略，需要具体用法和一个真实易错点，而不是四句泛泛概述';
  if (chineseCount > 320 || body.length > 1600) return '讲解过长，请压缩重复内容，中文正文不超过320字';
  const collocations = value.slice(positions[3]);
  const translated = [...collocations.matchAll(/`[^`\n]+`\s*（[^）\n]*[\u3400-\u9fff][^）\n]*）/g)];
  if (translated.length < 2) return '常见搭配至少两条，优先三条，每条用 `英文搭配`（中文译法）';
  if (translated.length > 4) return '常见搭配最多四条，保留最常用、最有价值的搭配';
  return null;
}

export function normalizeTeachingExamples(value: unknown): Array<{ en: string; zh: string; level: string }> {
  if (!Array.isArray(value)) return [];
  return value.map(example => ({
    en: typeof example?.en === 'string' ? example.en.trim() : '',
    zh: typeof example?.zh === 'string' ? example.zh.trim() : '',
    level: ['basic', 'intermediate', 'advanced'].includes(example?.level) ? example.level : 'intermediate',
  }));
}

export function teachingExamplesIssue(examples: Array<{ en: string; zh: string }>): string | null {
  if (examples.length < 3 || examples.length > 4) return '必须提供3–4条例句';
  if (examples.some(example => !/[A-Za-z]/.test(example.en) || !/[\u3400-\u9fff]/.test(example.zh) || example.en.length > 240 || example.zh.length > 160)) return '每条例句都要有简洁英文和中文翻译，不能缺失或写成长段';
  if (new Set(examples.map(example => example.en.toLowerCase().replace(/[^a-z0-9]/g, ''))).size !== examples.length) return '例句不能重复';
  return null;
}
