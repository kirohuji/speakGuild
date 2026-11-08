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

const HEADING_SOURCE = Object.keys(ALIAS).sort((left, right) => right.length - left.length).join('|');
/** 库里的标题是 **核心含义：** ，冒号在加粗里面。也接受 **核心含义**： 和纯文本「核心含义：」。 */
const HEADING_RE = new RegExp(
  `(?:^|\\n)\\s*(?:\\*\\*)?\\s*(${HEADING_SOURCE})\\s*(?:[：:]\\s*\\*\\*|\\*\\*\\s*[：:]|[：:])\\s*`,
  'g',
);

function normalizeBody(body: string): string {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  const blocks: string[] = [];
  let prose = '';
  const flush = () => {
    if (!prose) return;
    blocks.push(prose);
    prose = '';
  };
  for (const line of lines) {
    if (line.startsWith('- ')) {
      flush();
      blocks.push(line);
      continue;
    }
    prose += line;
  }
  flush();
  return blocks.join('\n');
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
    push(ALIAS[match[1]] ?? match[1], normalizeBody(text.slice(start, end)));
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
