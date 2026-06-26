const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const dir = __dirname;
const files = [
  'scenes.csv', 'training_topics.csv', 'chunks.csv',
  'scene_vocabulary.csv', 'sentence_patterns.csv',
  'script_episodes.csv', 'episode_chunks.csv'
];

let ok = 0, fail = 0;
for (const f of files) {
  const fp = path.join(dir, f);
  try {
    const raw = fs.readFileSync(fp, 'utf-8').replace(/^\ufeff/, '');
    const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
    // Also verify no field has embedded newlines
    let hasNewline = false;
    for (const r of records) {
      for (const v of Object.values(r)) {
        if (v && v.includes('\n')) { hasNewline = true; break; }
      }
      if (hasNewline) break;
    }
    console.log('OK: ' + f.padEnd(20) + ' ' + records.length + ' rows' + (hasNewline ? ' [WARN: has newlines]' : ''));
    ok++;
  } catch(e) {
    console.log('FAIL: ' + f.padEnd(20) + ' ' + e.message.substring(0, 80));
    fail++;
  }
}
// Validate warmup_pipeline.json
try {
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'warmup_pipeline.json'), 'utf-8'));
  const topics = Object.keys(w);
  let exCount = 0;
  topics.forEach(t => { exCount += (w[t].outputTraining.pipeline || []).length; });
  console.log('OK: warmup_pipeline.json    ' + topics.length + ' topics, ' + exCount + ' exercises');
  ok++;
} catch(e) {
  console.log('FAIL: warmup_pipeline.json    ' + e.message.substring(0, 80));
  fail++;
}
console.log('\nResult: ' + ok + '/' + (files.length + 1) + ' passed, ' + fail + ' failed');
