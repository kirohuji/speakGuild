const fs = require('fs');

// Load actual master vocab from packs 1-6
const masterFile = 'apps/backend/prisma/data/packages/_master_vocab.txt';
const masterRaw = fs.readFileSync(masterFile, 'utf8');
const masterWords = new Set();
for (const l of masterRaw.split('\n')) {
  const w = l.trim().toLowerCase();
  if (w && !w.startsWith('#') && !w.startsWith('=')) masterWords.add(w);
}
console.log('Master words:', masterWords.size);

// Verify each proposed word
const proposal = {
  'Topic 01': ['will', "'ll", 'gonna', 'shall', 'travel', 'visit', 'move'],
  'Topic 02': ['probably', 'definitely', 'certainly', 'absolutely', 'surely', 'likely', 'unlikely'],
  'Topic 03': ['ultimately', 'arrive', 'leave', 'stay'],
  'Topic 04': ["won't"],
  'Topic 05': ['shine', 'become', 'occur'],
  'Topic 06': ['drive', 'sing', 'draw', 'paint', 'count', 'solve', 'explain', 'type', 'fix', 'repair', 'design', 'program', 'code'],
  'Topic 07': ['assist', 'pass', 'hand', 'open', 'close', 'lock', 'unlock', 'kindly', 'simply'],
  'Topic 08': ['record', 'try', 'eat'],
  'Topic 09': ['quickly', 'slowly', 'carefully', 'safely', 'directly', 'conveniently', 'comfortably', 'politely', 'properly', 'clearly', 'loudly', 'quietly', 'softly', 'patiently', 'briefly'],
  'Topic 10': ['ski', 'skate', 'dive', 'climb', 'jog', 'understand', 'communicate'],
  'Topic 11': ['stop', 'follow', 'obey', 'respect', 'study', 'sleep', 'practice'],
  'Topic 12': ['participate', 'train', 'submit', 'attend', 'report', 'provide'],
  'Topic 13': ['smoke', 'drink', 'park', 'touch', 'feed', 'cross', 'shout', 'litter', 'enter'],
  'Topic 14': ['ignore', 'quit', 'stress', 'panic', 'overeat', 'worsen', 'end'],
  'Topic 15': ['highly', 'strongly', 'totally', 'completely', 'entirely', 'genuinely'],
  'Topic 16': ['possibly', 'presumably', 'supposedly', 'seemingly'],
  'Topic 17': ['offer', 'treat', 'host', 'entertain', 'gather', 'socialize', 'welcome'],
  'Topic 18': ['allow', 'let', 'permit', 'volunteer', 'handle', 'manage', 'arrange', 'organize', 'fetch', 'deliver'],
  'Topic 19': ['propose', 'alternative', 'instead', 'rather', 'fancy', 'prefer', 'opt'],
  'Topic 20': ['sure', 'anytime', 'accept', 'refuse', 'decline', 'appreciate', 'grateful', 'unfortunately'],
  'Topic 21': ['wish', 'bless', 'congratulate', 'celebrate', 'cheer', 'toast', 'godspeed'],
  'Topic 22': ['promise', 'swear', 'guarantee', 'assure', 'vow', 'pledge', 'commit', 'faithfully', 'sincerely'],
  'Topic 23': ['contribute', 'cooperate', 'coordinate', 'facilitate', 'aid', 'rescue', 'donate', 'serve'],
  'Topic 24': ['encourage', 'motivate', 'inspire', 'support', 'believe', 'trust', 'confidence', 'courage', 'effort', 'progress'],
  'Topic 25': ['willing', 'eager', 'keen', 'enthusiastic', 'motivated', 'determined', 'committed', 'dedicated', 'reluctant', 'hesitant'],
};

let crossOverlaps = [];
const seen = new Map();
let intraDupes = [];
let totalSafe = 0, totalOverlap = 0;

for (const [topic, words] of Object.entries(proposal)) {
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[.,!?;:'"()（）]/g, '').trim();
    if (clean === "won't") continue; // special: contraction won't is unique
    
    if (masterWords.has(clean)) {
      crossOverlaps.push(clean + ' (Topic: ' + topic + ')');
      totalOverlap++;
    } else {
      totalSafe++;
    }
    
    if (seen.has(clean)) {
      intraDupes.push(clean + ' (' + seen.get(clean) + ' + ' + topic + ')');
    } else {
      seen.set(clean, topic);
    }
  }
}

console.log('Safe (not in packs 1-6):', totalSafe);
console.log('Overlap with packs 1-6:', totalOverlap);
console.log('Intra dupes:', intraDupes.length);

if (crossOverlaps.length > 0) {
  console.log('\nCROSS-PACK OVERLAPS:');
  crossOverlaps.forEach(c => console.log('  ❌', c));
}

if (intraDupes.length > 0) {
  console.log('\nINTRA-PACK DUPES:');
  intraDupes.forEach(d => console.log('  ⚠️', d));
}

if (crossOverlaps.length === 0 && intraDupes.length === 0) {
  console.log('\n✅ ALL CLEAN — zero cross-pack + zero intra-pack');
}
