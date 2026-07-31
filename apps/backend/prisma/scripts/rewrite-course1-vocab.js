/**
 * rewrite-course1-vocab.js
 * 
 * Replaces all core, extension, and supplementary vocabulary in Course 1
 * with words NOT in Foundation. Each word is verified against the 
 * foundation-vocabulary-master.json list.
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'data', 'packages');
const MASTER_PATH = path.join(__dirname, '..', 'data', 'foundation-vocabulary-master.json');
const COURSE_DIR = 'course-1-opinion-communication';
const MD_PATH = path.join(PACKAGES_DIR, COURSE_DIR, '学习包的功能介绍.md');

// Load foundation set
const foundationSet = new Set(JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8')));

function check(word) {
  if (foundationSet.has(word.toLowerCase().trim())) {
    throw new Error(`WORD IN FOUNDATION: "${word}" — cannot use!`);
  }
  return true;
}

// ============================================================================
// TOPIC VOCABULARY REPLACEMENTS — Course 1: 观点表达与互动
// ============================================================================
// Each topic: { core: [4 words], ext: [2 words], supp: [2 words] }
// Words are selected from the topic's chunks/patterns to ensure relevance.
// All words verified against foundation- master list.

const replacements = {
  'Topic 01 · 询问看法': {
    core: ['timetable', 'advantages', 'views', 'collecting'],
    ext: ['worthwhile', 'fair'],
    supp: ['neutral', 'firsthand']
  },
  'Topic 02 · 清楚表态': {
    core: ['stance', 'conviction', 'backing', 'direction'],
    ext: ['manageable', 'practical'],
    supp: ['consistently', 'workable']
  },
  'Topic 03 · 表达确定程度': {
    core: ['certainty', 'uncertain', 'possibility', 'tendency'],
    ext: ['reasonably', 'leaning'],
    supp: ['cautiously', 'qualified']
  },
  'Topic 04 · 补充个人经验': {
    core: ['collaboration', 'term', 'setback', 'realization'],
    ext: ['firsthand', 'shaped'],
    supp: ['anecdote', 'takeaway']
  },
  'Topic 05 · 说明主要原因': {
    core: ['motivation', 'earnings', 'budgeting', 'workload'],
    ext: ['outcome', 'correlation'],
    supp: ['causal', 'justify']
  },
  'Topic 06 · 给具体例子': {
    core: ['commuting', 'neighbourhood', 'scenario', 'commonplace'],
    ext: ['vivid', 'widespread'],
    supp: ['anecdotal', 'illustrate']
  },
  'Topic 07 · 解释影响': {
    core: ['distraction', 'engagement', 'trade-off', 'environment'],
    ext: ['downside', 'long-term'],
    supp: ['chain-reaction', 'inevitable']
  },
  'Topic 08 · 排列多个理由': {
    core: ['flexibility', 'savings', 'commuting', 'collaboration'],
    ext: ['spontaneous', 'drawbacks'],
    supp: ['structured', 'trade-off']
  },
  'Topic 09 · 明确同意': {
    core: ['energetic', 'workout', 'eagerness', 'proposal'],
    ext: ['group-wide', 'manageable'],
    supp: ['wholehearted', 'alignment']
  },
  'Topic 10 · 部分同意': {
    core: ['accessibility', 'timeline', 'budget', 'funding'],
    ext: ['feasible', 'approval'],
    supp: ['conditional', 'provisional']
  },
  'Topic 11 · 礼貌不同意': {
    core: ['perspective', 'uniform', 'clothing', 'argue'],
    ext: ['judging', 'opposite'],
    supp: ['respectful', 'constructive']
  },
  'Topic 12 · 承接并追问': {
    core: ['elaborate', 'mentioned', 'follow-up', 'elsewhere'],
    ext: ['round-table', 'worthwhile'],
    supp: ['clarify', 'build-on']
  },
  'Topic 13 · 请求解释': {
    core: ['proposal', 'clarify', 'core', 'window'],
    ext: ['reachable', 'client-facing'],
    supp: ['practicality', 'specifics']
  },
  'Topic 14 · 重述理解': {
    core: ['paraphrase', 'consistency', 'habits', 'restriction'],
    ext: ['gradual', 'balanced'],
    supp: ['verify', 'sum-up']
  },
  'Topic 15 · 区分事实与观点': {
    core: ['factual', 'observation', 'measurable', 'screen-time'],
    ext: ['data-based', 'systematic'],
    supp: ['verify', 'interpretation']
  },
  'Topic 16 · 修正自己的表达': {
    core: ['rephrase', 'phrasing', 'misinterpret', 'clarified'],
    ext: ['light-review', 'consolidate'],
    supp: ['self-correct', 'restate']
  },
  'Topic 17 · 比较两种立场': {
    core: ['sightseeing', 'workshop', 'tourism', 'cultural-exchange'],
    ext: ['hands-on', 'enriching'],
    supp: ['side-by-side', 'trade-off']
  },
  'Topic 18 · 寻找共同点': {
    core: ['mutual', 'common-ground', 'overlap', 'concession'],
    ext: ['shared', 'priority'],
    supp: ['bridge', 'narrow-gap']
  },
  'Topic 19 · 提出折中方案': {
    core: ['compromise', 'middle-ground', 'hybrid', 'feasible'],
    ext: ['trial-period', 'staggered'],
    supp: ['pilot', 'phased']
  },
  'Topic 20 · 总结讨论': {
    core: ['recap', 'consensus', 'takeaway', 'follow-through'],
    ext: ['action-points', 'unresolved'],
    supp: ['wrap-up', 'next-steps']
  }
};

// ============================================================================
// VERIFY ALL WORDS
// ============================================================================
console.log('Verifying all replacement words against Foundation...\n');
let totalWords = 0;
let errors = [];

for (const [topicName, vocab] of Object.entries(replacements)) {
  const allWords = [...vocab.core, ...vocab.ext, ...vocab.supp];
  for (const w of allWords) {
    totalWords++;
    try {
      check(w);
    } catch (e) {
      errors.push(`${topicName}: ${e.message}`);
    }
  }
}

if (errors.length > 0) {
  console.log('❌ FOUNDATION DUPLICATES FOUND:');
  errors.forEach(e => console.log('  ' + e));
  console.log('\nFix these words before proceeding!');
  process.exit(1);
}

console.log(`✅ All ${totalWords} words verified — none in Foundation.\n`);

// ============================================================================
// APPLY REPLACEMENTS TO MD FILE
// ============================================================================
console.log('Reading course MD file...');
let content = fs.readFileSync(MD_PATH, 'utf8');
let replacedCount = 0;

for (const [topicName, vocab] of Object.entries(replacements)) {
  // Find the topic section
  const topicHeader = `### ${topicName}`;
  const topicStart = content.indexOf(topicHeader);
  if (topicStart === -1) {
    console.log(`  ⚠ Topic not found: ${topicName}`);
    continue;
  }
  
  // Find the next topic or end
  const nextTopicMatch = content.substring(topicStart + topicHeader.length).match(/\n### Topic \d{2}/);
  const topicEnd = nextTopicMatch 
    ? topicStart + topicHeader.length + nextTopicMatch.index 
    : content.length;
  
  const topicSection = content.substring(topicStart, topicEnd);
  
  // Replace core vocabulary line
  const corePattern = /(- \*\*核心词（Vocabulary）\*\*[：:]\s*).+?([。\n])/;
  const newCore = `- **核心词（Vocabulary）**：\`${vocab.core.join('`，`')}\`。`;
  let newSection = topicSection.replace(corePattern, newCore + '\n');
  
  // Replace extension vocabulary line
  const extPattern = /(- \*\*扩展词（Extension）\*\*[：:]\s*).+?([。\n])/;
  const newExt = `- **扩展词（Extension）**：\`${vocab.ext.join('`，`')}\`；补充词：\`${vocab.supp.join('`，`')}\`。`;
  newSection = newSection.replace(extPattern, newExt + '\n');
  
  if (newSection !== topicSection) {
    content = content.replace(topicSection, newSection);
    replacedCount++;
    console.log(`  ✓ ${topicName}`);
  }
}

console.log(`\n✅ Applied replacements to ${replacedCount} topics.`);

// Write back
fs.writeFileSync(MD_PATH, content, 'utf8');
console.log(`💾 Saved to ${MD_PATH}`);
console.log('\n⚠ Remember: chunks and dialogue still contain the OLD words.');
console.log('  Run the audit script to verify: node apps/backend/prisma/scripts/audit-course-vocab.js');
