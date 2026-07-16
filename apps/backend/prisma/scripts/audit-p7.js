const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../data/packages');
const outPath = path.resolve(__dirname, '_p7_audit.txt');

// Load master vocab from packs 1-6
const masterWords = new Set();
const masterWordsByPack = {}; // word -> pack name

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
      m[1].split(/[,，、]/).map(w => w.trim().toLowerCase()).filter(Boolean).forEach(w => {
        masterWords.add(w);
        if (!masterWordsByPack[w]) masterWordsByPack[w] = [];
        masterWordsByPack[w].push(p.replace('foundation-', ''));
      });
    }
  }
});

// Parse pack 7 vocab section
const p7f = path.join(dir, 'foundation-7-travel-basic', '学习包的功能介绍.md');
const p7c = fs.readFileSync(p7f, 'utf8');
const vocabSec = p7c.match(/## 核心词汇（按场景 \+ 语法全局词汇[\s\S]*?(?=\n## 附：)/);
if (!vocabSec) { console.log('No vocab section found'); process.exit(1); }

const out = [];
out.push('=== PACK 7 VOCAB CROSS-REFERENCE ===');
out.push('Master words (packs 1-6): ' + masterWords.size);
out.push('');

// Parse vocab by scene category
let currentScene = '';
const scenes = {};

for (const l of vocabSec[0].split('\n')) {
  // Scene header: ### 🅰️ 计划与预测（75 词）
  const sceneM = l.match(/### (🅰️|🅱️|🅲|🅳|🅴) (.+?)（(\d+) 词）/);
  if (sceneM) {
    currentScene = sceneM[1] + ' ' + sceneM[2];
    scenes[currentScene] = { categories: [], newWords: [], extWords: [], chunks: [] };
    continue;
  }
  
  // Category row: | **将来时结构** | will / 'll / won't / ... |
  const catM = l.match(/\| \*\*(.+?)\*\* \| (.+?) \|/);
  if (catM && currentScene) {
    const catName = catM[1].trim();
    const rawVocab = catM[2].trim();
    
    // Split by / and extract individual items
    const items = rawVocab.split('/').map(s => s.trim()).filter(Boolean);
    
    const newW = [];
    const extW = [];
    const chk = [];
    
    items.forEach(item => {
      const clean = item.replace(/[.,!?;:'"()]/g, '').trim().toLowerCase();
      if (!clean || clean.length < 2) return;
      
      // Check if multi-word
      if (clean.includes(' ')) {
        chk.push(item.trim());
        return;
      }
      
      // Single word - check against master
      if (masterWords.has(clean)) {
        extW.push({ word: item.trim(), from: masterWordsByPack[clean] });
      } else {
        newW.push(item.trim());
      }
    });
    
    if (newW.length > 0 || extW.length > 0) {
      scenes[currentScene].categories.push({
        name: catName,
        newWords: newW,
        extWords: extW,
        chunks: chk,
      });
    }
  }
}

// Output results
for (const [scene, data] of Object.entries(scenes)) {
  out.push('--- ' + scene + ' ---');
  let sceneNew = 0, sceneExt = 0;
  
  for (const cat of data.categories) {
    if (cat.newWords.length === 0 && cat.extWords.length === 0) continue;
    out.push('  [' + cat.name + ']');
    if (cat.newWords.length > 0) {
      out.push('    NEW (' + cat.newWords.length + '): ' + cat.newWords.join(', '));
      sceneNew += cat.newWords.length;
    }
    if (cat.extWords.length > 0) {
      const extList = cat.extWords.map(e => e.word + '(←' + e.from.join(',') + ')').join(', ');
      out.push('    EXT (' + cat.extWords.length + '): ' + extList);
      sceneExt += cat.extWords.length;
    }
    if (cat.chunks.length > 0) {
      out.push('    CHUNKS (' + cat.chunks.length + '): ' + cat.chunks.join(' | '));
    }
  }
  out.push('  Scene total: ' + sceneNew + ' new + ' + sceneExt + ' ext');
  out.push('');
}

// Summary
let totalNew = 0, totalExt = 0;
for (const [, data] of Object.entries(scenes)) {
  for (const cat of data.categories) {
    totalNew += cat.newWords.length;
    totalExt += cat.extWords.length;
  }
}
out.push('=== SUMMARY ===');
out.push('Total NEW words: ' + totalNew);
out.push('Total EXT words (overlap with packs 1-6): ' + totalExt);
out.push('Total unique new words available for core allocation: ' + totalNew);

fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('Done. Written to ' + outPath);
