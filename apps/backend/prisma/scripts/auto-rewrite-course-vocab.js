/**
 * auto-rewrite-course-vocab.js
 * Auto-extracts keywords from chunks to replace vocabulary in course MD files.
 * Usage: node auto-rewrite-course-vocab.js <course-dir-name>
 * Example: node auto-rewrite-course-vocab.js course-4-social-relationships
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'data', 'packages');
const MASTER_PATH = path.join(__dirname, '..', 'data', 'foundation-vocabulary-master.json');
const foundationSet = new Set(JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8')));

// Common function words and very basic words to skip when extracting keywords
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'this', 'that', 'these', 'those', 'a', 'an', 'the',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'yet',
  'about', 'also', 'up', 'out', 'down', 'off', 'over', 'back',
  'get', 'got', 'make', 'made', 'know', 'think', 'say', 'said',
  'go', 'went', 'come', 'came', 'see', 'take', 'look', 'like',
  'one', 'two', 'three', 'first', 'last', 'much', 'still',
  'really', 'even', 'well', 'way', 'thing', 'things', 'something',
  'anything', 'nothing', 'everything', 'someone', 'anyone', 'everyone',
  'could', 'would', 'should', 'need', 'want', 'let', 'put',
  'right', 'left', 'good', 'bad', 'big', 'small', 'new', 'old',
  'little', 'different', 'same', 'able', 'sure', 'quite', 'rather',
  'perhaps', 'maybe', 'already', 'always', 'never', 'ever',
  'everything', 'everyone', 'anybody', 'nobody', 'somebody'
]);

function extractKeywords(chunks) {
  // Extract significant nouns and verbs from chunks
  const allWords = [];
  for (const chunk of chunks) {
    // Remove punctuation and split
    const cleaned = chunk.replace(/[.,!?;:'"()—\-—]/g, ' ').toLowerCase();
    const words = cleaned.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
    allWords.push(...words);
  }
  
  // Count frequency and filter to meaningful words
  const freq = {};
  for (const w of allWords) {
    freq[w] = (freq[w] || 0) + 1;
  }
  
  // Sort by frequency, then by length (longer = more specific)
  const ranked = Object.entries(freq)
    .filter(([w]) => !foundationSet.has(w) && w.length >= 3)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  
  return ranked.map(([w]) => w);
}

function pickVocab(keywords, count) {
  // Pick the best words: prioritize longer, more specific words
  // that appear to be nouns (not ending in -ing, -ed, -ly unless compound)
  const nouns = keywords.filter(w => 
    !w.endsWith('ing') && !w.endsWith('ly') && 
    !w.endsWith('ed') && w.length >= 4
  );
  const others = keywords.filter(w => !nouns.includes(w));
  
  const selected = [...nouns, ...others];
  const result = [];
  const seen = new Set();
  for (const w of selected) {
    if (result.length >= count) break;
    if (seen.has(w)) continue;
    seen.add(w);
    result.push(w);
  }
  
  // If not enough, pad with remaining keywords
  if (result.length < count) {
    for (const w of keywords) {
      if (result.length >= count) break;
      if (seen.has(w)) continue;
      seen.add(w);
      result.push(w);
    }
  }
  
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const courseDir = process.argv[2];
if (!courseDir) {
  console.log('Usage: node auto-rewrite-course-vocab.js <course-dir-name>');
  console.log('Example: node auto-rewrite-course-vocab.js course-4-social-relationships');
  process.exit(1);
}

const mdPath = path.join(PACKAGES_DIR, courseDir, '学习包的功能介绍.md');
if (!fs.existsSync(mdPath)) {
  console.error('File not found:', mdPath);
  process.exit(1);
}

console.log(`Processing: ${courseDir}\n`);
let content = fs.readFileSync(mdPath, 'utf8');

// Find all topics
const topicRegex = /### (Topic \d{2} · .+?)\n\n([\s\S]*?)(?=\n### Topic \d{2}|\n---\s*\n## |$)/g;
let match;
let replacedCount = 0;
let allWords = [];
const replacements = [];

while ((match = topicRegex.exec(content)) !== null) {
  const topicName = match[1];
  const topicBody = match[2];
  
  // Extract chunks — handle ** markers in the label
  const chunkMatch = topicBody.match(/核心句块（Chunks）\*{0,2}[：:]\s*(.+?)(?:[。\n]|$)/);
  if (!chunkMatch) {
    console.log(`  ⚠ No chunks found for ${topicName}`);
    continue;
  }
  
  // Parse chunks: they're in backtick-quoted strings separated by ；
  const chunkText = chunkMatch[1];
  const chunkPattern = /`([^`]+)`/g;
  const chunks = [];
  let cm;
  while ((cm = chunkPattern.exec(chunkText)) !== null) {
    chunks.push(cm[1]);
  }
  
  if (chunks.length === 0) {
    console.log(`  ⚠ No chunks parsed for ${topicName}`);
    continue;
  }
  
  // Extract keywords from chunks
  const keywords = extractKeywords(chunks);
  const coreWords = pickVocab(keywords, 4);
  const extWords = pickVocab(keywords.filter(w => !coreWords.includes(w)), 2);
  const suppWords = pickVocab(keywords.filter(w => !coreWords.includes(w) && !extWords.includes(w)), 2);
  
  replacements.push({ topicName, core: coreWords, ext: extWords, supp: suppWords });
  allWords.push(...coreWords, ...extWords, ...suppWords);
  
  console.log(`  ${topicName}: core=[${coreWords.join(', ')}] ext=[${extWords.join(', ')}] supp=[${suppWords.join(', ')}]`);
}

// Verify all words against foundation
console.log(`\nVerifying ${allWords.length} words against Foundation...`);
const errors = [];
for (const w of allWords) {
  if (foundationSet.has(w.toLowerCase().trim())) {
    errors.push(w);
  }
}

if (errors.length > 0) {
  console.log(`❌ ${errors.length} words in Foundation: ${errors.join(', ')}`);
  console.log('These slipped through — manual fix needed. Check the extractKeywords logic.');
  process.exit(1);
}

console.log('✅ All words safe.\n');

// Apply replacements
console.log('Applying replacements...');
for (const r of replacements) {
  const topicHeader = `### ${r.topicName}`;
  const topicStart = content.indexOf(topicHeader);
  if (topicStart === -1) { console.log(`  ⚠ Not found: ${r.topicName}`); continue; }
  
  const after = content.substring(topicStart + topicHeader.length);
  const nextMatch = after.match(/\n### Topic \d{2}/);
  const topicEnd = nextMatch ? topicStart + topicHeader.length + nextMatch.index : content.length;
  const section = content.substring(topicStart, topicEnd);
  
  let newSection = section.replace(
    /(- \*\*核心词（Vocabulary）\*\*[：:]\s*).+?([。\n])/,
    `- **核心词（Vocabulary）**：\`${r.core.join('`，`')}\`。\n`
  );
  newSection = newSection.replace(
    /(- \*\*扩展词（Extension）\*\*[：:]\s*).+?([。\n])/,
    `- **扩展词（Extension）**：\`${r.ext.join('`，`')}\`；补充词：\`${r.supp.join('`，`')}\`。\n`
  );
  
  if (newSection !== section) {
    content = content.replace(section, newSection);
    replacedCount++;
  }
}

fs.writeFileSync(mdPath, content, 'utf8');
console.log(`\n✅ ${replacedCount} topics updated.`);
console.log('Run audit to verify: node apps/backend/prisma/scripts/audit-course-vocab.js');
