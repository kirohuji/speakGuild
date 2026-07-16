const fs = require('fs');
const dir = 'apps/backend/prisma/data/packages';
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

const check = ['probably','definitely','certainly','absolutely','likely','unlikely','surely',
'ultimately','arrive','stay','leave','shine','become','occur','drive','sing','draw','paint',
'count','solve','explain','type','fix','repair','design','program','code','assist','pass',
'hand','open','close','lock','unlock','kindly','simply','record','try','eat','quickly',
'slowly','carefully','safely','directly','conveniently','comfortably','politely','properly',
'clearly','loudly','quietly','softly','patiently','briefly','ski','skate','dive','climb',
'jog','understand','communicate','stop','follow','obey','respect','study','sleep','practice',
'participate','train','submit','attend','report','provide','smoke','drink','park','touch',
'feed','cross','shout','litter','enter'];

const overlap = check.filter(w => master.has(w));
const safe = check.filter(w => !master.has(w));

const out = [];
out.push('SAFE (can be core): ' + safe.length);
safe.forEach(w => out.push('  ✓ ' + w));
out.push('');
out.push('OVERLAP with packs 1-6 (must be ext): ' + overlap.length);
overlap.forEach(w => out.push('  ❌ ' + w));

fs.writeFileSync('apps/backend/prisma/scripts/_check_result.txt', out.join('\n'));
console.log('Done');
