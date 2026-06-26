const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const dir = path.resolve(__dirname);

const files = [
  'scenes.csv',
  'training_topics.csv', 
  'chunks.csv',
  'scene_vocabulary.csv',
  'sentence_patterns.csv',
  'script_episodes.csv',
  'episode_chunks.csv',
];

/** Properly quote a CSV field */
function quoteField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  // Need quoting if contains comma, double-quote, or newline
  if (/[,"\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Write records as CSV with proper quoting, using header from first record */
function writeCsv(records, filePath) {
  const cols = Object.keys(records[0]);
  const lines = [cols.join(',')];
  for (const r of records) {
    const vals = cols.map(c => quoteField(r[c]));
    lines.push(vals.join(','));
  }
  const content = lines.join('\r\n');
  fs.writeFileSync(filePath, content, 'utf-8');
  // Verify strict parse
  const verify = parse(content, { 
    columns: true, skip_empty_lines: true, trim: true 
  });
  return verify.length;
}

let ok = 0, fail = 0;
for (const f of files) {
  const fp = path.join(dir, f);
  if (!fs.existsSync(fp)) {
    console.log('SKIP ' + f + ' (not found)');
    continue;
  }
  try {
    let raw = fs.readFileSync(fp, 'utf-8').replace(/^\ufeff/, '');
    
    // Pre-process scene_vocabulary: fix Chinese quotes like 疑问词"什么" -> 疑问词"什么"
    // These are ASCII quotes in Chinese text that break CSV parsers
    if (f === 'scene_vocabulary.csv') {
      // Replace patterns like: Chinese_char"Chinese_text" inside non-JSON fields
      // Use a regex that matches a CJK char followed by ASCII quote, text, ASCII quote
      raw = raw.replace(/([\u4e00-\u9fff])"([\u4e00-\u9fff\w]+)"/g, '$1\u300c$2\u300d');
      // Also handle remaining standalone quotes in Chinese text fields
      raw = raw.replace(/([\u4e00-\u9fff])"([^,]{1,10})"/g, '$1\u300c$2\u300d');
    }
    
    const records = parse(raw, { 
      columns: true, skip_empty_lines: true, trim: true,
      relax: true, relax_column_count: true 
    });
    // Normalize: all records get the same columns as the first record
    const cols = Object.keys(records[0]);
    for (const r of records) {
      for (const c of cols) {
        if (r[c] === undefined) r[c] = '';
      }
    }
    const count = writeCsv(records, fp);
    console.log('OK: ' + f + ' -> ' + count + ' rows');
    ok++;
  } catch (e) {
    console.log('FAIL: ' + f + ' - ' + e.message.split('\n')[0]);
    fail++;
  }
}
console.log('\nDone: ' + ok + ' fixed, ' + fail + ' failed');
