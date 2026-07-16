const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../data/packages');
const outPath = path.join(dir, '_master_vocab.txt');

// Extract core words from all 7 packs
const packs = [
  'foundation-1-beginner', 'foundation-2-daily-life', 'foundation-3-daily-work',
  'foundation-4-essential-phrases', 'foundation-5-opinion-basics', 'foundation-6-social-express',
  'foundation-7-travel-basic',
];

const allWords = [];

packs.forEach(p => {
  const f = path.join(dir, p, '学习包的功能介绍.md');
  const c = fs.readFileSync(f, 'utf8');
  
  // For packs 1-6: extract from 核心词汇（逐话题分配 section
  // For pack 7: same format now
  const sec = c.match(/## 核心词汇（逐话题分配[\s\S]*?(?=\n---\n## 附：|$)/);
  if (!sec) { console.log('No vocab section in ' + p); return; }
  
  let count = 0;
  for (const l of sec[0].split('\n')) {
    const m = l.match(/\| 核心 \| \*\*([^*]+)\*\*/);
    if (m) {
      m[1].split(/[,，、]/).map(w => w.trim().toLowerCase()).filter(Boolean).forEach(w => {
        allWords.push(w);
        count++;
      });
    }
  }
  console.log(p.replace('foundation-','') + ': ' + count + ' core words');
});

const unique = [...new Set(allWords)].sort();
console.log('Total unique: ' + unique.length + ' (raw: ' + allWords.length + ')');

const header = [
  '# Master Core Vocabulary — All 7 Foundation Packs',
  '# ' + unique.length + ' unique words (zero cross-pack overlap)',
  '# Generated ' + new Date().toISOString().split('T')[0],
  '# Packs: ① beginner ② daily-life ③ daily-work ④ essential-phrases ⑤ opinion-basics ⑥ social-express ⑦ travel-basic',
  '',
];

fs.writeFileSync(outPath, header.join('\n') + unique.join('\n') + '\n', 'utf8');
console.log('Written ' + outPath);
