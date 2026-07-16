const fs = require('fs');
const dir = 'apps/backend/prisma/data/packages';
const outPath = 'apps/backend/prisma/scripts/_p7_final_check.txt';
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

const p7c = fs.readFileSync(dir+'/foundation-7-travel-basic/学习包的功能介绍.md','utf8');
const start = p7c.indexOf('## 核心词汇（逐话题分配');
const end = p7c.indexOf('## 附：将来时');
const sec = p7c.substring(start, end);

const out = [];
const seen = new Map();
let cross = 0, intra = 0;

for (const l of sec.split('\n')) {
  const m = l.match(/\| 核心 \| \*\*([^*]+)\*\*/);
  if (m) {
    m[1].split(/[,，、]/).map(w=>w.trim().toLowerCase()).filter(Boolean).forEach(w => {
      if (master.has(w)) { out.push('CROSS: ' + w); cross++; }
      if (seen.has(w)) { out.push('INTRA: ' + w); intra++; }
      else seen.set(w, '');
    });
  }
}

out.push('');
out.push('Slots: ' + [...seen.keys()].length + ' (all unique words in core rows)');
out.push('Cross overlap: ' + cross);
out.push('Intra dupes: ' + intra);
out.push(cross === 0 && intra === 0 ? 'ALL CLEAN' : 'ISSUES REMAIN - need to fix!');

fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('Done');
