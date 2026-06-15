const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

const b = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';
const ps = ['exam-cet-4','exam-cet-6','exam-ielts-6','exam-ielts-6-5','exam-ielts-7','exam-ielts-7-5','exam-ielts-8','exam-ielts-8-5','exam-toefl'];

function esc(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

for (const p of ps) {
  const fp = path.join(b, p, 'scene_vocabulary.csv');
  if (!fs.existsSync(fp)) continue;
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    const recs = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });
    if (recs.length === 0) continue;
    const cols = Object.keys(recs[0]);
    const out = [cols.map(esc).join(',')];
    for (const r of recs) {
      out.push(cols.map(c => esc(r[c])).join(','));
    }
    fs.writeFileSync(fp, out.join('\n') + '\n');
    console.log('OK ' + p + ' (' + recs.length + ' rows)');
  } catch (e) {
    console.log('ERR ' + p + ': ' + e.message);
  }
}
console.log('All done');
