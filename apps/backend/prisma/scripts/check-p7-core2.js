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

const check = [
  'ignore','quit','stress','panic','overeat','worsen','end',
  'highly','strongly','totally','completely','entirely','genuinely',
  'possibly','presumably','supposedly','seemingly',
  'offer','treat','host','entertain','gather','socialize','welcome',
  'allow','let','permit','volunteer','handle','manage','arrange','organize','fetch','deliver',
  'propose','alternative','instead','rather','fancy','prefer','opt',
  'sure','anytime','accept','refuse','decline','appreciate','grateful','unfortunately',
  'wish','bless','congratulate','celebrate','cheer','toast','godspeed',
  'promise','swear','guarantee','assure','vow','pledge','commit','faithfully','sincerely',
  'contribute','cooperate','coordinate','facilitate','aid','rescue','donate','serve',
  'encourage','motivate','inspire','support','believe','trust','confidence','courage','effort','progress',
  'willing','eager','keen','enthusiastic','motivated','determined','committed','dedicated','reluctant','hesitant',
  'congratulations','excellent','bravo','say','teach','anytime'
];

const safe = check.filter(w => !master.has(w));
const overlap = check.filter(w => master.has(w));

const out = [];
out.push('SAFE: ' + safe.length);
safe.forEach(w => out.push('  ✓ ' + w));
out.push('');
out.push('OVERLAP: ' + overlap.length);
overlap.forEach(w => out.push('  ❌ ' + w));

fs.writeFileSync('apps/backend/prisma/scripts/_check_result2.txt', out.join('\n'));
console.log('Done. Safe:', safe.length, 'Overlap:', overlap.length);
