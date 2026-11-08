const ALIAS: Record<string, string> = {
  核心含义: '核心含义',
  含义: '核心含义',
  意思: '核心含义',
  句式解析: '核心含义',
  用法提示: '用法提示',
  用法: '用法提示',
  使用场景: '用法提示',
  场景: '用法提示',
  易错点: '易错点',
  注意: '易错点',
  辨析: '易错点',
  常见搭配: '常见搭配',
  搭配: '常见搭配',
  类似表达: '常见搭配',
  同义词: '常见搭配',
  替换练习: '常见搭配',
};

const ORDER = ['核心含义', '用法提示', '易错点', '常见搭配'];

/** 词汇、句块、句式的讲解共用这一套排版。生成提示词和检查规范都以此为准。 */
export const DESCRIPTION_LAYOUT_RULE = '讲解排版必须和词汇、句块、句式完全一致。轻量 Markdown，依次写全四个小节，不能省略、不能改名，也不能用句式解析、使用场景、替换练习、类似表达等别名。每个小节先写标题再直接写正文，标题只能是「**核心含义：**」「**用法提示：**」「**易错点：**」「**常见搭配：**」。冒号在加粗里面，标题结束后直接接正文，禁止再加一组 **。小节之间空一行，每一小节只有一段，段内不要换行，不要用列表或项目符号。常见搭配写成同一行，用顿号连接，英文短语放在反引号里。';

const HEADING_SOURCE = Object.keys(ALIAS).sort((left, right) => right.length - left.length).join('|');
/** 库里的标题是 **核心含义：** ，冒号在加粗里面。也接受 **核心含义**： 和纯文本「核心含义：」。 */
const HEADING_RE = new RegExp(
  `(?:^|\\n)\\s*(?:\\*\\*)?\\s*(${HEADING_SOURCE})\\s*(?:[：:]\\s*\\*\\*|\\*\\*\\s*[：:]|[：:])\\s*`,
  'g',
);

/** 模型常在「**标题：**」后面再写一组 **，正文开头就多出加粗。 */
function stripStrayBold(body: string): string {
  return body.replace(/^(?:\*\*\s*)+/, '').trim();
}

function normalizeBody(body: string): string {
  return stripStrayBold(body)
    .split('\n')
    .map((line) => stripStrayBold(line.trim()).replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean)
    .join('');
}

/** 常见搭配和单词讲解一样：同一行，顿号连接，不用列表。 */
function flattenCollocations(body: string): string {
  const lines = stripStrayBold(body).split('\n').map((line) => stripStrayBold(line.trim())).filter(Boolean);
  if (!lines.some((line) => /^[-*•]\s+/.test(line))) return lines.join('');
  const prose = lines
    .map((line) => line.replace(/^[-*•]\s+/, '').replace(/\(([^)]*)\)/g, '（$1）').replace(/[。；;，,、]\s*$/, '').trim())
    .filter(Boolean)
    .join('、');
  return prose ? (prose.endsWith('。') ? prose : `${prose}。`) : '';
}

function collapsePlain(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, '').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** 四个标准小节都在，而且每节都有正文。标题按库里的 **核心含义：** 来认。 */
export function descriptionHasCanonicalLayout(raw: string): boolean {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return false;
  const re = new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*)?\\s*(${ORDER.join('|')})\\s*(?:[：:]\\s*\\*\\*|\\*\\*\\s*[：:]|[：:])\\s*`,
    'g',
  );
  const matches = [...text.matchAll(re)];
  const bodies = new Map<string, string>();
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    if (body) bodies.set(match[1], body);
  });
  return ORDER.every((name) => Boolean(bodies.get(name)?.trim()));
}

/** 标题后多了一组 **、用了别名标题，或任一小节写成了列表。这种只需要本地重排。 */
export function descriptionHasLayoutDefect(raw: string): boolean {
  const text = raw.replace(/\r\n/g, '\n');
  if (/：\*\*\s*\*\*/.test(text)) return true;
  if (/(?:^|\n)\s*[-*•]\s+/.test(text)) return true;
  return /(?:^|\n)\s*(?:\*\*)?\s*(?:句式解析|使用场景|替换练习|类似表达|同义词|辨析)\s*(?:[：:]\s*\*\*|\*\*\s*[：:]|[：:])/.test(text);
}

/** 把讲解收成同一套小节：核心含义 / 用法提示 / 易错点 / 常见搭配，小节之间空一行。 */
export function alignDescriptionLayout(raw: string): string {
  const text = raw.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) return '';
  const matches = [...text.matchAll(new RegExp(HEADING_RE.source, 'g'))];
  if (!matches.length) return collapsePlain(text);

  const sections = new Map<string, string[]>();
  const push = (name: string, body: string) => {
    if (!body) return;
    const list = sections.get(name) ?? [];
    list.push(body);
    sections.set(name, list);
  };

  const lead = text.slice(0, matches[0].index ?? 0).trim();
  if (lead) push('核心含义', normalizeBody(lead));
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const name = ALIAS[match[1]] ?? match[1];
    const body = text.slice(start, end);
    push(name, name === '常见搭配' ? flattenCollocations(body) : normalizeBody(body));
  });

  const parts: string[] = [];
  const used = new Set<string>();
  for (const name of ORDER) {
    const bodies = sections.get(name);
    if (!bodies?.length) continue;
    used.add(name);
    parts.push(`**${name}：** ${bodies.join(bodies.some((body) => body.includes('\n')) ? '\n' : '')}`);
  }
  for (const [name, bodies] of sections) {
    if (used.has(name) || !bodies.length) continue;
    parts.push(`**${name}：** ${bodies.join(bodies.some((body) => body.includes('\n')) ? '\n' : '')}`);
  }
  return parts.join('\n\n');
}
