/**
 * check-word.js — Quick check: is a word in the foundation vocabulary?
 * Usage: node apps/backend/prisma/scripts/check-word.js <word1> <word2> ...
 */
const fs = require('fs');
const path = require('path');

const masterPath = path.join(__dirname, '..', 'data', 'foundation-vocabulary-master.json');
const foundationSet = new Set(JSON.parse(fs.readFileSync(masterPath, 'utf8')));

const words = process.argv.slice(2);
if (words.length === 0) {
  console.log('Usage: node check-word.js <word1> <word2> ...');
  process.exit(0);
}

console.log(`Checking ${words.length} word(s) against Foundation (${foundationSet.size} words):\n`);

let allClear = true;
for (const w of words) {
  const normalized = w.toLowerCase().trim();
  const inFoundation = foundationSet.has(normalized);
  const status = inFoundation ? '🔴 IN FOUNDATION — DO NOT USE' : '✅ CLEAR — safe to use';
  console.log(`  ${status}: "${w}"`);
  if (inFoundation) allClear = false;
}

console.log(allClear ? '\n✅ All words are safe to use.' : '\n🔴 Some words are in Foundation — replace them!');
