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
export const DESCRIPTION_LAYOUT_RULE = '面向中国 B1-B2 学习者，具体、准确、详细但精炼，中文正文建议160–260字，复杂内容最多320字，不计算标题、英文及标记。依次写全四节：**核心含义：**、**用法提示：**、**易错点：**、**常见搭配：**，标题不能改名。冒号在加粗内，后面空一格再写正文，禁止重复加粗标记。每节一个短段，小节间空一行；段内不用列表、编号或堆叠换行。核心含义说清最常用意思或句式槽位关系，不罗列冷僻义；用法提示给具体结构、使用场景或必要的语气区别；易错点指出一个真实易错点并给简短正确用法，不能只说注意语境或多练习。不重复释义，不写空泛套话，不扩写成长文。常见搭配优先3条自然、常用且互不重复的搭配（可靠搭配不足可2条，必要时最多4条），每条写成“`English phrase`（简短中文译法）”，用顿号连接为同一短段；句型则给可自然填入槽位的搭配。英文用反引号，中文翻译用全角括号（），不得凭空编造译法。';

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
    .map((line) => stripStrayBold(line.trim()).replace(/^(?:[-*•]|\d+[.)、])\s+/, '').trim())
    .filter(Boolean)
    .reduce((text, line) => !text ? line : `${text}${/[。！？；：.!?;:]$/.test(text) ? '' : '；'}${line}`, '');
}

/** 常见搭配和单词讲解一样：同一行，顿号连接，不用列表。 */
function flattenCollocations(body: string): string {
  const lines = stripStrayBold(body).split('\n').map((line) => stripStrayBold(line.trim())).filter(Boolean);
  if (!lines.some((line) => /^(?:[-*•]|\d+[.)、])\s+/.test(line))) return lines.join('').replace(/\(([^)]*)\)/g, '（$1）');
  const prose = lines
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)、])\s+/, '').replace(/\(([^)]*)\)/g, '（$1）').replace(/[。；;，,、]\s*$/, '').trim())
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
