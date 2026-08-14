/**
 * 从 docs/常用英语500句.doc (WPS OLE2) 提取 500 句 → CSV/JSON
 *
 * 已逆向确认的格式:
 * - 正文为 UTF-16LE，从标题「英语500句」(偏移 ~0x0A00) 开始
 * - 每行: 英文句 + 空格 + 中文翻译 + \r (0D 00)
 * - 文本区结束于字体/表格二进制数据（特征签名 ee dd cc bb aa 99 88 77）之前
 *
 * 用法: node apps/backend/prisma/scripts/extract-500-sentences.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const DOC_PATH = path.join(ROOT, 'docs', '常用英语500句.doc');
const OUT_DIR = path.join(ROOT, 'apps', 'backend', 'prisma', 'data', 'packages', 'common-500-sentences');

// 仅用汉字（CJK 表意字符）作为 en/zh 切分点；
// 全角标点（？。，等）属于英文句子的标点，不应触发切分
function isCJK(ch) {
  const code = ch.codePointAt(0);
  return (
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
    (code >= 0xf900 && code <= 0xfaff)    // CJK Compatibility
  );
}

// 英文侧的全角标点归一化为半角
function normalizeEn(s) {
  return s
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u3002/g, '.') // 。
    .replace(/\uff0c/g, ',') // ，
    .replace(/\uff01/g, '!') // ！
    .replace(/\uff1f/g, '?') // ？
    .replace(/\uff08/g, '(')
    .replace(/\uff09/g, ')')
    .replace(/\u3001/g, ',') // 、
    .replace(/\uff1a/g, ':') // ：
    .replace(/\uff1b/g, ';') // ；
    .replace(/\u2014/g, '—')
    .replace(/\u2026/g, '...')
    .trim();
}

function main() {
  const buf = fs.readFileSync(DOC_PATH);

  // 定位文本起点: 标题「英语500句」
  const title = Buffer.from('英语500句', 'utf16le');
  const titleIdx = buf.indexOf(title);
  if (titleIdx < 0) {
    console.error('未找到标题「英语500句」，无法定位文本起点');
    process.exit(1);
  }

  // 定位文本终点: 第一个字体/表格二进制签名
  const sig = Buffer.from([0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88, 0x77]);
  let endIdx = buf.indexOf(sig, titleIdx);
  if (endIdx < 0) endIdx = buf.length;
  if (endIdx % 2 !== 0) endIdx -= 1;

  console.log(`文本区: 0x${titleIdx.toString(16)} → 0x${endIdx.toString(16)} (${endIdx - titleIdx} bytes)`);

  const text = buf.toString('utf16le', titleIdx, endIdx);
  const lines = text.split(/\r\n|\n|\r/);

  const entries = [];
  const dropped = [];

  for (const raw of lines) {
    const line = raw.replace(/\u0000/g, '').trim();
    if (!line) continue;

    let firstCJK = -1;
    for (let i = 0; i < line.length; i++) {
      if (isCJK(line[i])) { firstCJK = i; break; }
    }

    const hasAsciiLetter = /[A-Za-z]/.test(line);

    // 标题行（英语500句）无英文字母，直接忽略
    if (firstCJK < 0 || !hasAsciiLetter) {
      dropped.push(line);
      continue;
    }

    let en = line.slice(0, firstCJK).trim();
    let zh = line.slice(firstCJK).trim();

    if (!en || !zh) { dropped.push(line); continue; }

    en = normalizeEn(en);
    zh = zh.replace(/\u2019/g, "'").replace(/\u2018/g, "'").trim();

    entries.push({ en, zh });
  }

  console.log(`有效条目: ${entries.length}`);
  console.log(`忽略行: ${dropped.length}`);
  dropped.slice(0, 30).forEach((d, i) => console.log(`  DROP[${i}]: ${JSON.stringify(d)}`));

  // 重复检测
  const seen = new Map();
  for (const e of entries) {
    const key = e.en.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  console.log(`重复英文句: ${dups.length}`);
  dups.slice(0, 20).forEach(([k, n]) => console.log(`  DUP(${n}): ${k}`));

  // 去重：完全相同的 (en, zh) 只保留第一条（原文“500句”中的重复行）
  // 注意：en 相同但 zh 不同的（如 mark my words / hang in there 的两种译法）保留
  const unique = [];
  const pairSeen = new Set();
  for (const e of entries) {
    const key = `${e.en.toLowerCase()}\u0000${e.zh}`;
    if (pairSeen.has(key)) continue;
    pairSeen.add(key);
    unique.push(e);
  }
  console.log(`去重后条目: ${unique.length}`);

  // 输出
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const csvLines = ['id,en,zh'];
  unique.forEach((e, i) => {
    csvLines.push(`${i + 1},"${e.en.replace(/"/g, '""')}","${e.zh.replace(/"/g, '""')}"`);
  });
  fs.writeFileSync(path.join(OUT_DIR, '500-sentences.csv'), csvLines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, '500-sentences.json'), JSON.stringify(unique, null, 2), 'utf8');

  console.log('已写入:', path.join(OUT_DIR, '500-sentences.csv'));
  console.log('已写入:', path.join(OUT_DIR, '500-sentences.json'));
}

main();
