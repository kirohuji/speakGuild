const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../data/packages');
const outPath = path.resolve(__dirname, '_p7_rebuilt_vocab.txt');

// ===== 1. Load master words from packs 1-6 =====
const masterWords = new Set();
const packs1to6 = [
  'foundation-1-beginner', 'foundation-2-daily-life', 'foundation-3-daily-work',
  'foundation-4-essential-phrases', 'foundation-5-opinion-basics', 'foundation-6-social-express',
];
packs1to6.forEach(p => {
  const f = path.join(dir, p, '学习包的功能介绍.md');
  const c = fs.readFileSync(f, 'utf8');
  const sec = c.match(/## 核心词汇（逐话题分配[\s\S]*?## 附：/);
  if (!sec) return;
  for (const l of sec[0].split('\n')) {
    const m = l.match(/\| 核心 \| \*\*([^*]+)\*\*/);
    if (m) {
      m[1].split(/[,，、]/).map(w => w.trim().toLowerCase()).filter(Boolean).forEach(w => masterWords.add(w));
    }
  }
});
console.log('Master words (packs 1-6):', masterWords.size);

// ===== 2. Parse current pack 7 vocab =====
const p7f = path.join(dir, 'foundation-7-travel-basic', '学习包的功能介绍.md');
const p7c = fs.readFileSync(p7f, 'utf8');
const start = p7c.indexOf('## 核心词汇（逐话题分配');
const end = p7c.indexOf('## 附：将来时');
const sec = p7c.substring(start, end);

// Parse topics
const topics = [];
let currentTopic = null;
let currentScene = '';

for (const l of sec.split('\n')) {
  // Scene header
  const sceneM = l.match(/^### (🅰️|🅱️|🅲|🅳|🅴) (.+)/);
  if (sceneM) {
    currentScene = sceneM[1] + ' ' + sceneM[2];
    continue;
  }
  
  // Design note (skip)
  if (l.startsWith('> ')) continue;
  
  // Topic header
  const topicM = l.match(/^#### (Topic \d+) · (.+)/);
  if (topicM) {
    if (currentTopic) topics.push(currentTopic);
    currentTopic = {
      id: topicM[1],
      title: topicM[2],
      scene: currentScene,
      core: [],
      ext: [],
      serve: '',
      coreLine: '',
      extLine: '',
    };
    continue;
  }
  
  if (!currentTopic) continue;
  
  // Core row
  if (l.includes('| 核心 |')) {
    currentTopic.coreLine = l;
    const m = l.match(/\*\*([^*]+)\*\*/);
    if (m) {
      currentTopic.core = m[1].split(/[,，、]/).map(w => w.trim()).filter(Boolean);
    }
    // Extract 服务于
    const cells = l.split('|');
    if (cells.length >= 4) currentTopic.serve = cells[3].trim();
  }
  
  // Extension row
  if (l.includes('| 扩展 |')) {
    currentTopic.extLine = l;
  }
}
if (currentTopic) topics.push(currentTopic);

console.log('Topics found:', topics.length);

// ===== 3. Classify core words: NEW vs OVERLAP =====
const out = [];
out.push('# PACK 7 — CORE WORD CLASSIFICATION');
out.push('');

topics.forEach(t => {
  const newWords = [];
  const overlapWords = [];
  t.core.forEach(w => {
    const clean = w.replace(/[.,!?;:'"()（）]/g, '').trim().toLowerCase();
    if (masterWords.has(clean)) {
      overlapWords.push(w);
    } else {
      newWords.push(w);
    }
  });
  
  out.push(`## ${t.id} · ${t.title}`);
  out.push(`  Scene: ${t.scene}`);
  out.push(`  Serve: ${t.serve}`);
  out.push(`  ✅ NEW (keep as core): ${newWords.length > 0 ? '**' + newWords.join(', ') + '**' : '(none!)'}`);
  out.push(`  ❌ OVERLAP (move to ext): ${overlapWords.length > 0 ? overlapWords.join(', ') : '(none)'}`);
  out.push('');
});

// Summary
let totalNew = 0, totalOverlap = 0;
topics.forEach(t => {
  t.core.forEach(w => {
    const clean = w.replace(/[.,!?;:'"()（）]/g, '').trim().toLowerCase();
    if (masterWords.has(clean)) totalOverlap++;
    else totalNew++;
  });
});
out.push(`## SUMMARY`);
out.push(`Total core slots: ${totalNew + totalOverlap}`);
out.push(`✅ Truly NEW: ${totalNew}`);
out.push(`❌ Overlap with packs 1-6: ${totalOverlap}`);

fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('Written to', outPath);
