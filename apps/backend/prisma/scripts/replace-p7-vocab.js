const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../data/packages');

// Read main file
const mainPath = path.join(dir, 'foundation-7-travel-basic', '学习包的功能介绍.md');
const main = fs.readFileSync(mainPath, 'utf8');
const mainLines = main.split('\n');

// Read clean vocab
const cleanPath = path.join(dir, 'foundation-7-travel-basic', '_clean_vocab.md');
let clean = fs.readFileSync(cleanPath, 'utf8');

// Fix the clean version: add 服务于 text and proper formatting
// The clean version has empty 服务于 columns — we'll keep them minimal
// Add trailing --- separator
clean = clean.trimEnd() + '\n\n---';

// Find line numbers (1-indexed)
let vocabStart = -1, attachStart = -1;
mainLines.forEach((l, i) => {
  if (l.startsWith('## 核心词汇（逐话题分配')) vocabStart = i;
  if (l.startsWith('## 附：将来时')) attachStart = i;
});

console.log('Vocab section: line', vocabStart + 1, 'to', attachStart);

// Replace: keep lines before vocabStart, insert clean, keep lines from attachStart
const before = mainLines.slice(0, vocabStart);
const after = mainLines.slice(attachStart);

const newContent = [...before, ...clean.split('\n'), ...after].join('\n');

fs.writeFileSync(mainPath, newContent, 'utf8');
console.log('Replaced. New file length:', newContent.length, 'lines:', newContent.split('\n').length);
