const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'data', 'packages');
const pkgs = fs.readdirSync(packagesDir)
  .filter(d => d.startsWith('foundation-') && fs.statSync(path.join(packagesDir, d)).isDirectory())
  .sort();

function extractColumn(csvPath, colIndex) {
  try {
    const csv = fs.readFileSync(csvPath, 'utf8');
    const rows = csv.trim().split('\n').slice(1);
    return rows.map(r => {
      // Handle quoted CSV fields
      const cols = [];
      let inQuote = false, current = '';
      for (let i = 0; i < r.length; i++) {
        if (r[i] === '"') { inQuote = !inQuote; continue; }
        if (r[i] === ',' && !inQuote) { cols.push(current); current = ''; continue; }
        current += r[i];
      }
      cols.push(current);
      return cols[colIndex] || '';
    }).filter(c => c);
  } catch (e) {
    return [];
  }
}

function extractAllColumns(csvPath) {
  try {
    const csv = fs.readFileSync(csvPath, 'utf8');
    const rows = csv.trim().split('\n').slice(1);
    return rows.map(r => {
      const cols = [];
      let inQuote = false, current = '';
      for (let i = 0; i < r.length; i++) {
        if (r[i] === '"') { inQuote = !inQuote; continue; }
        if (r[i] === ',' && !inQuote) { cols.push(current.trim()); current = ''; continue; }
        current += r[i];
      }
      cols.push(current.trim());
      return cols;
    });
  } catch (e) {
    return [];
  }
}

let out = '# Foundation 学习包 — 词汇/句块/句型总览追踪\n\n';
out += '> 此文件记录所有 Foundation 学习包已使用的词汇、句块和句型。\n';
out += '> **新增学习包时，必须对照此文件检查，确保不重复使用已登记的词/句块/句型。**\n';
out += '> 已有 11 个包（foundation-1 ~ foundation-11），覆盖基础①到基础⑪。\n\n';
out += '---\n\n';

// Collect all vocabulary for cross-package check
const allVocab = {};
const allChunks = {};
const allPatterns = {};

pkgs.forEach(p => {
  const pkgNum = p.match(/foundation-(\d+)/)?.[1] || '?';
  const pkgPath = path.join(packagesDir, p);
  out += '## 基础' + pkgNum + ' · ' + p + '\n\n';

  // Vocabulary
  const vPath = path.join(pkgPath, 'scene_vocabulary.csv');
  if (fs.existsSync(vPath)) {
    const words = extractColumn(vPath, 2); // word is column 2
    const unique = [...new Set(words)].sort((a, b) => a.localeCompare(b));
    out += '### 词汇（' + unique.length + ' 个唯一词）\n\n';
    out += unique.map(w => '`' + w + '`').join(' ') + '\n\n';

    // Internal duplicate check
    const counts = {};
    words.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    const dupes = Object.entries(counts).filter(([, c]) => c > 1);
    if (dupes.length) {
      out += '⚠️ **内部重复**: ' + dupes.map(([w, c]) => '`' + w + '`(' + c + '次)').join(', ') + '\n\n';
    }
    allVocab[p] = unique;
  } else {
    out += '_无词汇文件_\n\n';
    allVocab[p] = [];
  }

  // Chunks
  const cPath = path.join(pkgPath, 'chunks.csv');
  if (fs.existsSync(cPath)) {
    const chunks = extractColumn(cPath, 3); // chunk text is column 3
    out += '### 句块（' + chunks.length + ' 个）\n\n';
    out += chunks.map(c => '`' + c + '`').join(' ') + '\n\n';
    allChunks[p] = chunks;
  } else {
    out += '_无句块文件_\n\n';
    allChunks[p] = [];
  }

  // Patterns
  const pPath = path.join(pkgPath, 'sentence_patterns.csv');
  if (fs.existsSync(pPath)) {
    const patterns = extractColumn(pPath, 2); // pattern text is column 2
    out += '### 句型模板（' + patterns.length + ' 个）\n\n';
    out += patterns.map(pt => '`' + pt + '`').join(' ') + '\n\n';
    allPatterns[p] = patterns;
  } else {
    out += '_无句型文件_\n\n';
    allPatterns[p] = [];
  }

  out += '---\n\n';
});

// Cross-package vocabulary overlap
out += '## 跨包词汇重叠检查\n\n';
const pkgNames = Object.keys(allVocab);
for (let i = 0; i < pkgNames.length; i++) {
  for (let j = i + 1; j < pkgNames.length; j++) {
    const setA = new Set(allVocab[pkgNames[i]]);
    const overlap = allVocab[pkgNames[j]].filter(w => setA.has(w));
    if (overlap.length) {
      out += '- ⚠️ **' + pkgNames[i] + ' ∩ ' + pkgNames[j] + '**: ' +
        overlap.map(w => '`' + w + '`').join(', ') + ' (' + overlap.length + '词)\n';
    } else {
      out += '- ✅ **' + pkgNames[i] + ' ∩ ' + pkgNames[j] + '**: 无重复\n';
    }
  }
}

// Cross-package chunk overlap
out += '\n## 跨包句块重叠检查\n\n';
for (let i = 0; i < pkgNames.length; i++) {
  for (let j = i + 1; j < pkgNames.length; j++) {
    if (!allChunks[pkgNames[i]].length || !allChunks[pkgNames[j]].length) continue;
    const setA = new Set(allChunks[pkgNames[i]]);
    const overlap = allChunks[pkgNames[j]].filter(c => setA.has(c));
    if (overlap.length) {
      out += '- ⚠️ **' + pkgNames[i] + ' ∩ ' + pkgNames[j] + '**: ' +
        overlap.map(c => '`' + c + '`').join(', ') + '\n';
    } else {
      out += '- ✅ **' + pkgNames[i] + ' ∩ ' + pkgNames[j] + '**: 无重复\n';
    }
  }
}

// Cross-package pattern overlap
out += '\n## 跨包句型重叠检查\n\n';
for (let i = 0; i < pkgNames.length; i++) {
  for (let j = i + 1; j < pkgNames.length; j++) {
    if (!allPatterns[pkgNames[i]].length || !allPatterns[pkgNames[j]].length) continue;
    const setA = new Set(allPatterns[pkgNames[i]]);
    const overlap = allPatterns[pkgNames[j]].filter(pt => setA.has(pt));
    if (overlap.length) {
      out += '- ⚠️ **' + pkgNames[i] + ' ∩ ' + pkgNames[j] + '**: ' +
        overlap.map(pt => '`' + pt + '`').join(', ') + '\n';
    } else {
      out += '- ✅ **' + pkgNames[i] + ' ∩ ' + pkgNames[j] + '**: 无重复\n';
    }
  }
}

out += '\n---\n';
out += '_最后更新: ' + new Date().toISOString().split('T')[0] +
  '_  |  累计 ' + pkgs.length + ' 个学习包（foundation-1 ~ foundation-' +
  (pkgs.length) + '）_\n';

const outPath = path.join(packagesDir, '_master-vocabulary-tracker.md');
fs.writeFileSync(outPath, out);
console.log('Written to:', outPath);
console.log('Packages:', pkgs.length);
