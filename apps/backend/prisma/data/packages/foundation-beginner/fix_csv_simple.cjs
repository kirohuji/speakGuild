const fs = require('fs');
const path = require('path');
const { parse } = require(path.resolve(__dirname, '../../../../node_modules/csv-parse/sync'));

const dir = __dirname;
const files = [
  'scenes.csv', 'training_topics.csv', 'chunks.csv',
  'scene_vocabulary.csv', 'sentence_patterns.csv',
  'script_episodes.csv', 'episode_chunks.csv'
];

function esc(v) {
  const s = String(v).trim();
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

for (const f of files) {
  const fp = path.join(dir, f);
  if (!fs.existsSync(fp)) { console.log('SKIP ' + f); continue; }
  try {
    let raw = fs.readFileSync(fp, 'utf-8');
    // Fix Chinese quotes in scene_vocabulary
    if (f === 'scene_vocabulary.csv') {
      raw = raw.replace(/([\u4e00-\u9fff])"([\u4e00-\u9fff\w\/]+)"/g, '$1「$2」');
    }
    const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true, relax: true, relax_column_count: true });
    const cols = Object.keys(records[0]);
    const out = [cols.join(',')];
    for (const r of records) {
      out.push(cols.map(c => esc(r[c] || '')).join(','));
    }
    fs.writeFileSync(fp, out.join('\r\n'), 'utf-8');
    // Verify
    const v = parse(fs.readFileSync(fp, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true });
    console.log('OK: ' + f + ' -> ' + v.length + ' rows');
  } catch(e) {
    console.log('FAIL: ' + f + ' - ' + e.message.substring(0, 80));
  }
}
console.log('DONE');
