const fs = require('fs');

// The 110 verified NEW words
const new110 = new Set([
  "'ll", "absolutely", "allow", "anytime", "arrive", "assist", "become", "bravo!",
  "briefly", "carefully", "certainly", "clearly", "climb", "close", "code",
  "comfortably", "communicate", "congratulations!", "conveniently", "count", "cross",
  "definitely", "design", "directly", "dive", "draw", "drink", "drive", "eat", "end",
  "enter", "excellent!", "explain", "feed", "fix", "follow", "godspeed", "gonna", "hand",
  "ignore", "jog", "kindly", "leave", "let", "likely", "litter", "lock", "loudly",
  "move", "obey", "occur", "offer", "open", "overeat", "paint", "panic", "park",
  "participate", "pass", "patiently", "permit", "politely", "possibly", "practice",
  "probably", "program", "promise", "properly", "quickly", "quietly", "quit", "record",
  "repair", "respect", "safely", "say", "shall", "shine", "shout", "simply", "sing",
  "skate", "ski", "sleep", "slowly", "smoke", "softly", "solve", "stay", "stop",
  "stress", "study", "sure", "surely", "swear", "teach", "touch", "train", "travel",
  "try", "type", "ultimately", "understand", "unlikely", "unlock", "visit", "wait",
  "will", "won't", "worsen"
]);

// Proposed core words (all should be in new110)
const proposal = {
  'Topic 01': ['will', "'ll", 'gonna', 'shall', 'travel', 'visit', 'move'],
  'Topic 02': ['probably', 'definitely', 'certainly', 'absolutely', 'surely', 'likely', 'unlikely'],
  'Topic 03': ['ultimately', 'arrive', 'leave', 'stay'],
  'Topic 04': ['won\'t'],
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

// Check each word
let allIn110 = true;
const seen = new Map();
let intraDupes = [];

for (const [topic, words] of Object.entries(proposal)) {
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[.,!?;:'"()（）]/g, '').trim();
    if (!new110.has(clean)) {
      console.log('NOT IN 110:', clean, '(Topic:', topic + ')');
      allIn110 = false;
    }
    if (seen.has(clean)) {
      intraDupes.push(clean + ' (Topics: ' + seen.get(clean) + ' + ' + topic + ')');
    } else {
      seen.set(clean, topic);
    }
  }
}

console.log('All in 110:', allIn110);
console.log('Intra dupes:', intraDupes.length);
if (intraDupes.length) intraDupes.forEach(d => console.log('  -', d));
console.log('Total words:', seen.size);

// Check which 110 words are NOT used
const unused = [...new110].filter(w => !seen.has(w.toLowerCase()));
console.log('Unused NEW words:', unused.length);
if (unused.length > 0) console.log(unused.join(', '));
