/**
 * rewrite-course2-vocab.js
 * Replaces all core/ext/supp vocabulary in Course 2 with Foundation-safe words.
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'data', 'packages');
const MASTER_PATH = path.join(__dirname, '..', 'data', 'foundation-vocabulary-master.json');
const COURSE_DIR = 'course-2-storytelling-experiences';
const MD_PATH = path.join(PACKAGES_DIR, COURSE_DIR, '学习包的功能介绍.md');

const foundationSet = new Set(JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8')));

function check(word) {
  if (foundationSet.has(word.toLowerCase().trim())) {
    throw new Error(`IN FOUNDATION: "${word}"`);
  }
}

const replacements = {
  'Topic 01 · 时间地点': {
    core: ['september', 'unfamiliar', 'rainy', 'hallway'],
    ext: ['fourteen', 'isolated'],
    supp: ['backdrop', 'mood']
  },
  'Topic 02 · 人物关系': {
    core: ['impulsive', 'organised', 'dynamic', 'cousin'],
    ext: ['trip', 'thrilled'],
    supp: ['companion', 'bond']
  },
  'Topic 03 · 当时状态': {
    core: ['nervousness', 'determination', 'restless', 'tense'],
    ext: ['unprepared', 'weeks'],
    supp: ['buildup', 'pre-exam']
  },
  'Topic 04 · 故事开场': {
    core: ['principal', 'tuesday', 'clearing', 'reshaped'],
    ext: ['hush', 'abrupt'],
    supp: ['mishap', 'turning-point']
  },
  'Topic 05 · 先后顺序': {
    core: ['ingredients', 'recipe', 'missing', 'downhill'],
    ext: ['roommate', 'zone'],
    supp: ['step-by-step', 'disaster']
  },
  'Topic 06 · 同时发生': {
    core: ['windows', 'brother', 'parents', 'neighbourhood'],
    ext: ['stronger', 'unfolding'],
    supp: ['simultaneous', 'chaos']
  },
  'Topic 07 · 原因结果': {
    core: ['assumption', 'underestimated', 'buffer', 'miscalculation'],
    ext: ['root-cause', 'overconfident'],
    supp: ['ruin', 'predictable']
  },
  'Topic 08 · 添加关键细节': {
    core: ['engraving', 'silver', 'corner', 'keepsake'],
    ext: ['sentimental', 'personal'],
    supp: ['priceless', 'memento']
  },
  'Topic 09 · 突发事件': {
    core: ['halfway', 'blank', 'timing', 'worse'],
    ext: ['stare', 'improvised'],
    supp: ['abruptly', 'off-script']
  },
  'Topic 10 · 计划改变': {
    core: ['cancelled', 'itinerary', 'worthless', 'sixteen-hour'],
    ext: ['hindsight', 'train-journey'],
    supp: ['reroute', 'unplanned']
  },
  'Topic 11 · 误解与发现': {
    core: ['assumed', 'teammate', 'crisis', 'embarrassment'],
    ext: ['avoiding', 'purpose'],
    supp: ['misunderstanding', 'clarified']
  },
  'Topic 12 · 高潮时刻': {
    core: ['crowd', 'deafening', 'tied', 'erupted'],
    ext: ['clock', 'score'],
    supp: ['climax', 'final-play']
  },
  'Topic 13 · 当时感受': {
    core: ['disbelief', 'shaking', 'joy', 'fade'],
    ext: ['overwhelming', 'surreal'],
    supp: ['stunned', 'unforgettable']
  },
  'Topic 14 · 他人反应': {
    core: ['tears', 'hugged', 'cheering', 'speechless'],
    ext: ['supportive', 'surrounding'],
    supp: ['communal', 'touching']
  },
  'Topic 15 · 困难与应对': {
    core: ['exhaustion', 'setback', 'push-through', 'mentally'],
    ext: ['obstacle', 'physically'],
    supp: ['perseverance', 'resilience']
  },
  'Topic 16 · 最终结果': {
    core: ['wound-up', 'relief', 'gratitude', 'transformed'],
    ext: ['outcome', 'resolution'],
    supp: ['aftermath', 'closure']
  },
  'Topic 17 · 总结经历': {
    core: ['rollercoaster', 'worthwhile', 'hardship', 'strengthened'],
    ext: ['sum-up', 'growth'],
    supp: ['reflecting', 'accomplishment']
  },
  'Topic 18 · 学到什么': {
    core: ['takeaway', 'lesson', 'mindset', 'patience'],
    ext: ['growth', 'self-aware'],
    supp: ['hindsight', 'wisdom']
  },
  'Topic 19 · 如果重来': {
    core: ['undo', 'differently', 'regret', 'wiser'],
    ext: ['redo', 'prepared'],
    supp: ['hypothetical', 'second-chance']
  },
  'Topic 20 · 回答追问': {
    core: ['elaborate', 'follow-up', 'curious', 'clarify'],
    ext: ['questioner', 'expound'],
    supp: ['prompt', 'wrap-up']
  }
};

// Verify all words
console.log('Verifying Course 2 replacement words...\n');
let totalWords = 0;
let errors = [];
for (const [topicName, vocab] of Object.entries(replacements)) {
  for (const w of [...vocab.core, ...vocab.ext, ...vocab.supp]) {
    totalWords++;
    try { check(w); } catch (e) { errors.push(`${topicName}: ${e.message}`); }
  }
}
if (errors.length > 0) {
  console.log('❌ ERRORS:');
  errors.forEach(e => console.log('  ' + e));
  process.exit(1);
}
console.log(`✅ All ${totalWords} words safe.\n`);

// Apply replacements
let content = fs.readFileSync(MD_PATH, 'utf8');
let replacedCount = 0;

for (const [topicName, vocab] of Object.entries(replacements)) {
  const topicHeader = `### ${topicName}`;
  const topicStart = content.indexOf(topicHeader);
  if (topicStart === -1) { console.log(`  ⚠ Not found: ${topicName}`); continue; }
  
  const searchAfter = content.substring(topicStart + topicHeader.length);
  const nextMatch = searchAfter.match(/\n### Topic \d{2}/);
  const topicEnd = nextMatch ? topicStart + topicHeader.length + nextMatch.index : content.length;
  const topicSection = content.substring(topicStart, topicEnd);
  
  const corePattern = /(- \*\*核心词（Vocabulary）\*\*[：:]\s*).+?([。\n])/;
  let newSection = topicSection.replace(corePattern, `- **核心词（Vocabulary）**：\`${vocab.core.join('`，`')}\`。\n`);
  
  const extPattern = /(- \*\*扩展词（Extension）\*\*[：:]\s*).+?([。\n])/;
  newSection = newSection.replace(extPattern, `- **扩展词（Extension）**：\`${vocab.ext.join('`，`')}\`；补充词：\`${vocab.supp.join('`，`')}\`。\n`);
  
  if (newSection !== topicSection) {
    content = content.replace(topicSection, newSection);
    replacedCount++;
    console.log(`  ✓ ${topicName}`);
  }
}

fs.writeFileSync(MD_PATH, content, 'utf8');
console.log(`\n✅ ${replacedCount} topics updated.`);
