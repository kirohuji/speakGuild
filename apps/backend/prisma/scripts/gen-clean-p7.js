const fs = require('fs');
const dir = 'apps/backend/prisma/data/packages';

// Load packs 1-6 master
const master = new Set();
['foundation-1-beginner','foundation-2-daily-life','foundation-3-daily-work',
 'foundation-4-essential-phrases','foundation-5-opinion-basics','foundation-6-social-express']
.forEach(p => {
  const c = fs.readFileSync(dir+'/'+p+'/学习包的功能介绍.md','utf8');
  const sec = c.match(/## 核心词汇（逐话题分配[\s\S]*?## 附：/);
  if (!sec) return;
  for (const l of sec[0].split('\n')) {
    const m = l.match(/\| 核心 \| \*\*([^*]+)\*\*/);
    if (m) m[1].split(/[,，、]/).map(w=>w.trim().toLowerCase()).filter(Boolean).forEach(w=>master.add(w));
  }
});

// Read current pack 7 vocab
const p7c = fs.readFileSync(dir+'/foundation-7-travel-basic/学习包的功能介绍.md','utf8');
const start = p7c.indexOf('## 核心词汇（逐话题分配');
const end = p7c.indexOf('## 附：将来时');
const sec = p7c.substring(start, end);

// Parse topics
const topics = [];
let cur = null;
for (const l of sec.split('\n')) {
  const tm = l.match(/^#### (Topic \d+) · (.+)/);
  if (tm) {
    if (cur) topics.push(cur);
    cur = { id: tm[1], title: tm[2], coreLine: '', extLine: '', core: [], ext: [] };
    continue;
  }
  if (!cur) continue;
  if (l.includes('| 核心 |')) {
    cur.coreLine = l;
    const m = l.match(/\*\*([^*]+)\*\*/);
    if (m) cur.core = m[1].split(/[,，、]/).map(w=>w.trim()).filter(Boolean);
  }
  if (l.includes('| 扩展 |')) {
    cur.extLine = l;
    const m = l.match(/\*([^*]+)\*/);
    if (m) cur.ext = m[1].split(/[,，、]/).map(w=>w.trim()).filter(Boolean);
  }
}
if (cur) topics.push(cur);

// For each topic, classify core words and fix
const out = [];
out.push('## 核心词汇（逐话题分配，严格零跨包重叠）');
out.push('');
out.push('> **设计说明**：本包是语法驱动型学习包。核心词汇**严格限定为包①-⑥未出现过的词**。所有在包①-⑥已出现的实义词一律标为扩展。多词句块（如 by then、from now on）作为整体是新的学习目标，标注于核心行。');
out.push('');

let sceneIdx = 0;
const sceneHeaders = [
  '### 🅰️ 计划与预测（5 主题）',
  '### 🅱️ 能力与请求（5 主题）',
  '### 🅲 建议与义务（5 主题）',
  '### 🅳 情态综合与礼貌表达（5 主题）',
  '### 🅴 祝愿与承诺（5 主题）',
];
const sceneNote = [
  '',
  '',
  '',
  '',
  '\n> 🧠 **设计说明**：本场景以**句块教学**为主——祝福、承诺、鼓励等社交用语在英语中是多词固定搭配（formulaic expressions），不宜拆成单词教学。核心词仅标注验证过的新词，真正的学习重心在句块参考和句型模板中。\n',
];

topics.forEach((t, i) => {
  // Scene header
  const si = Math.min(Math.floor(i / 5), 4);
  if (i % 5 === 0) {
    out.push(sceneHeaders[si]);
    if (sceneNote[si]) out.push(sceneNote[si]);
  }
  
  // Classify core words
  const safeCore = [];
  const overlapCore = [];
  t.core.forEach(w => {
    const clean = w.replace(/[.,!?;:'"()（）]/g, '').trim().toLowerCase();
    if (clean === "won't" || clean === "'ll") { safeCore.push(w); return; }
    if (master.has(clean)) {
      overlapCore.push(w);
    } else {
      safeCore.push(w);
    }
  });
  
  // Build new extension: original ext + overlapping core words
  const allExt = [...new Set([...t.ext, ...overlapCore])];
  
  out.push(`#### ${t.id} · ${t.title}`);
  out.push('| 层级 | 词汇 | 服务于 |');
  out.push('|------|------|--------|');
  
  // Extract serve text from original core line
  const serveMatch = t.coreLine.match(/\| ([^|]+)$/);
  const serve = serveMatch ? serveMatch[1].trim() : '';
  
  if (safeCore.length > 0) {
    out.push(`| 核心 | **${safeCore.join(', ')}** | ${serve} |`);
  } else {
    // No safe core words — use grammar chunks as core
    out.push(`| 核心 | （本主题核心为语法句型本身，词汇均为复用） | ${serve} |`);
  }
  
  const extShort = allExt.slice(0, 20);
  const extText = extShort.join(', ');
  out.push(`| 扩展 | *${extText}*（复用包①-⑥） | ${serve} |`);
  out.push('');
});

// Write
const outPath = dir + '/foundation-7-travel-basic/_clean_vocab.md';
fs.writeFileSync(outPath, out.join('\n'), 'utf8');

// Stats
let totalSafe = 0, totalOverlap = 0;
topics.forEach(t => {
  t.core.forEach(w => {
    const clean = w.replace(/[.,!?;:'"()（）]/g, '').trim().toLowerCase();
    if (clean === "won't" || clean === "'ll") { totalSafe++; return; }
    if (master.has(clean)) totalOverlap++;
    else totalSafe++;
  });
});
console.log('Topics:', topics.length);
console.log('Safe core words:', totalSafe);
console.log('Overlap words moved to ext:', totalOverlap);
console.log('Written to', outPath);
