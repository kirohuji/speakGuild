/**
 * audit-course-vocab.js
 * 
 * Step 1: Parse _master-vocabulary-tracker.md → extract ALL foundation vocabulary as a Set
 * Step 2: Parse each course's 学习包的功能介绍.md → extract core & extension vocabulary
 * Step 3: Cross-reference → flag every duplicate
 * Step 4: Output foundation master list as JSON for future use
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'data', 'packages');
const TRACKER_PATH = path.join(PACKAGES_DIR, '_master-vocabulary-tracker.md');

// ─── Step 1: Parse master vocabulary tracker ───────────────────────────────

function parseMasterTracker() {
  const content = fs.readFileSync(TRACKER_PATH, 'utf8');
  const sections = content.split(/\n## 基础\d+/);
  
  // First section is the header, skip it
  const foundationWords = new Map(); // packageName → Set of words
  let totalRaw = 0;

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    // Extract package name like "foundation-1-beginner"
    const pkgMatch = section.match(/foundation-[\d]+-[\w-]+/);
    if (!pkgMatch) continue;
    const pkgName = pkgMatch[0];
    
    // Find the vocabulary section: starts with "### 词汇" and ends at next "###" or "---"
    const vocabStart = section.indexOf('### 词汇');
    if (vocabStart === -1) {
      console.log(`  ⚠ ${pkgName}: no vocabulary section`);
      continue;
    }
    
    // Find the end — next "###" or "---" after vocabStart
    const afterVocab = section.substring(vocabStart);
    const nextHeader = afterVocab.search(/\n(?:###|---)/);
    const vocabBlock = nextHeader === -1 ? afterVocab : afterVocab.substring(0, nextHeader);
    
    // Extract words: they're in backtick-quoted strings
    const wordMatches = vocabBlock.matchAll(/`([^`]+)`/g);
    const words = new Set();
    for (const m of wordMatches) {
      const w = m[1].trim().toLowerCase();
      if (w && !w.startsWith('//') && w.length > 0) {
        words.add(w);
      }
    }
    
    if (words.size === 0) {
      console.log(`  ⚠ ${pkgName}: no words found in vocab section`);
      continue;
    }
    
    foundationWords.set(pkgName, words);
    totalRaw += words.size;
    console.log(`  ✓ ${pkgName}: ${words.size} words`);
  }

  // Build master set (deduplicated)
  const masterSet = new Set();
  for (const words of foundationWords.values()) {
    for (const w of words) {
      masterSet.add(w);
    }
  }

  console.log(`\n📊 Foundation total: ${totalRaw} raw → ${masterSet.size} unique across ${foundationWords.size} packages`);
  return { foundationWords, masterSet };
}

// ─── Step 2: Parse course MD files ─────────────────────────────────────────

function parseCourseVocab(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract package-level supplementary vocab (本包补充词汇)
  const pkgVocabMatch = content.match(/### 本包补充词汇\s*\n\s*> 以下[\s\S]*?\n\n((?:`[^`]+`[，, ]*)+)/);
  const pkgVocab = [];
  if (pkgVocabMatch) {
    const words = pkgVocabMatch[1].matchAll(/`([^`]+)`/g);
    for (const m of words) pkgVocab.push(m[1].trim().toLowerCase());
  }
  
  // Extract per-topic vocabulary
  const topics = [];
  
  // Find all Topic sections
  const topicRegex = /### Topic (\d{2}) · (.+?)\n\n([\s\S]*?)(?=\n### Topic \d{2}|$)/g;
  let topicMatch;
  
  while ((topicMatch = topicRegex.exec(content)) !== null) {
    const topicId = topicMatch[1];
    const topicName = topicMatch[2];
    const topicBody = topicMatch[3];
    
    // Extract core vocab: - **核心词（Vocabulary）**：`word1`，`word2`，...
    // The line may end with 。or just newline. Words in backticks, separated by ，(Chinese comma) or ,
    const coreMatch = topicBody.match(/核心词（Vocabulary）\*{0,2}[：:]\s*(.+?)(?:[。\n]|$)/);
    const coreWords = [];
    if (coreMatch) {
      const words = coreMatch[1].matchAll(/`([^`]+)`/g);
      for (const m of words) coreWords.push(m[1].trim().toLowerCase());
    }
    
    // Extract extension vocab: 扩展词（Extension）
    const extMatch = topicBody.match(/扩展词（Extension）\*{0,2}[：:]\s*(.+?)(?:[。\n]|$)/);
    const extWords = [];
    if (extMatch) {
      const words = extMatch[1].matchAll(/`([^`]+)`/g);
      for (const m of words) extWords.push(m[1].trim().toLowerCase());
    }
    
    // Extract 补充词
    const suppMatch = topicBody.match(/补充词[：:]\s*(.+?)(?:[。\n]|$)/);
    const suppWords = [];
    if (suppMatch) {
      const words = suppMatch[1].matchAll(/`([^`]+)`/g);
      for (const m of words) suppWords.push(m[1].trim().toLowerCase());
    }
    
    topics.push({ id: topicId, name: topicName, coreWords, extWords, suppWords });
  }
  
  return { pkgVocab, topics };
}

// ─── Step 3: Cross-reference ────────────────────────────────────────────────

function checkDuplicates(masterSet, courseName, courseData) {
  const duplicates = {
    pkgVocab: [],    // package-level supplementary vocab dupes
    coreWords: [],   // { topicId, topicName, word }
    extWords: [],    // { topicId, topicName, word }
    suppWords: [],   // { topicId, topicName, word }
  };
  
  // Check package-level vocab
  for (const w of courseData.pkgVocab) {
    if (masterSet.has(w)) {
      duplicates.pkgVocab.push(w);
    }
  }
  
  // Check per-topic vocab
  for (const topic of courseData.topics) {
    for (const w of topic.coreWords) {
      if (masterSet.has(w)) {
        duplicates.coreWords.push({ topicId: topic.id, topicName: topic.name, word: w });
      }
    }
    for (const w of topic.extWords) {
      if (masterSet.has(w)) {
        duplicates.extWords.push({ topicId: topic.id, topicName: topic.name, word: w });
      }
    }
    for (const w of topic.suppWords) {
      if (masterSet.has(w)) {
        duplicates.suppWords.push({ topicId: topic.id, topicName: topic.name, word: w });
      }
    }
  }
  
  return duplicates;
}

// ─── Display helper ─────────────────────────────────────────────────────────

function formatDuplicates(dup, label) {
  if (dup.length === 0) return '';
  
  // Count by word
  const byWord = {};
  for (const d of dup) {
    const w = typeof d === 'string' ? d : d.word;
    if (!byWord[w]) byWord[w] = [];
    if (typeof d !== 'string') {
      byWord[w].push(`T${d.topicId}·${d.topicName}`);
    }
  }
  
  let out = `\n  🔴 ${label} (${dup.length} 项):\n`;
  for (const [w, locations] of Object.entries(byWord)) {
    if (locations.length > 0) {
      out += `     \`${w}\` ← ${locations.join(', ')}\n`;
    } else {
      out += `     \`${w}\`\n`;
    }
  }
  return out;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════');
console.log('  Course Vocabulary vs Foundation Audit');
console.log('═══════════════════════════════════════════\n');

console.log('📖 Parsing Foundation master vocabulary tracker...\n');
const { masterSet } = parseMasterTracker();

// Save master set as JSON
const masterArr = [...masterSet].sort();
const outDir = path.join(__dirname, '..', 'data');
fs.writeFileSync(
  path.join(outDir, 'foundation-vocabulary-master.json'),
  JSON.stringify(masterArr, null, 2),
  'utf8'
);
console.log(`\n💾 Saved foundation master list (${masterArr.length} words) to foundation-vocabulary-master.json\n`);

// Process all courses
const courseDirs = fs.readdirSync(PACKAGES_DIR).filter(d => d.startsWith('course-'));
courseDirs.sort();

console.log('═'.repeat(60));
console.log('  CROSS-REFERENCE RESULTS');
console.log('═'.repeat(60));

let totalCoreDupes = 0;
let totalExtDupes = 0;
let totalSuppDupes = 0;
let totalPkgDupes = 0;

for (const dir of courseDirs) {
  const mdPath = path.join(PACKAGES_DIR, dir, '学习包的功能介绍.md');
  if (!fs.existsSync(mdPath)) {
    console.log(`\n⚠ ${dir}: no MD file, skipping`);
    continue;
  }
  
  const courseData = parseCourseVocab(mdPath);
  const dupes = checkDuplicates(masterSet, dir, courseData);
  
  const hasDupes = dupes.pkgVocab.length > 0 || 
                   dupes.coreWords.length > 0 || 
                   dupes.extWords.length > 0 || 
                   dupes.suppWords.length > 0;
  
  if (!hasDupes) {
    console.log(`\n✅ ${dir}: NO duplicates found`);
    continue;
  }
  
  console.log(`\n📦 ${dir}`);
  console.log(`   Topics: ${courseData.topics.length} | 核心词总计: ${courseData.topics.reduce((s,t)=>s+t.coreWords.length,0)} | 扩展词总计: ${courseData.topics.reduce((s,t)=>s+t.extWords.length,0)}`);
  
  if (dupes.pkgVocab.length > 0) {
    console.log(formatDuplicates(dupes.pkgVocab, '本包补充词汇与Foundation重复'));
    totalPkgDupes += dupes.pkgVocab.length;
  }
  if (dupes.coreWords.length > 0) {
    console.log(formatDuplicates(dupes.coreWords, '核心词与Foundation重复'));
    totalCoreDupes += dupes.coreWords.length;
  }
  if (dupes.extWords.length > 0) {
    console.log(formatDuplicates(dupes.extWords, '扩展词与Foundation重复'));
    totalExtDupes += dupes.extWords.length;
  }
  if (dupes.suppWords.length > 0) {
    console.log(formatDuplicates(dupes.suppWords, '补充词与Foundation重复'));
    totalSuppDupes += dupes.suppWords.length;
  }
}

console.log('\n' + '═'.repeat(60));
console.log('  SUMMARY');
console.log('═'.repeat(60));
console.log(`  Foundation 唯一词: ${masterSet.size}`);
console.log(`  本包补充词汇重复: ${totalPkgDupes}`);
console.log(`  核心词重复:       ${totalCoreDupes}`);
console.log(`  扩展词重复:       ${totalExtDupes}`);
console.log(`  补充词重复:       ${totalSuppDupes}`);
console.log(`  总计重复:         ${totalPkgDupes + totalCoreDupes + totalExtDupes + totalSuppDupes}`);
console.log('\n✅ Audit complete.');
