const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Find all CSV files across ALL exam packages that fail to parse
// and fix them by re-encoding with proper CSV escaping
const base = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';
const examPkgs = ['exam-cet-4','exam-cet-6','exam-ielts-6','exam-ielts-6-5','exam-ielts-7','exam-ielts-7-5','exam-ielts-8','exam-ielts-8-5','exam-toefl'];

function csvField(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

for (const pkg of examPkgs) {
  const dir = path.join(base, pkg);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.csv')) continue;
    const fp = path.join(dir, f);
    
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      // First try to parse
      const normalized = raw.replace(/\r/g, '');
      const recs = parse(normalized, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: false,
        relax_column_count: true,
        relax_quotes: true,
      });
      // If it parses OK, just re-encode properly
      if (recs.length > 0) {
        const cols = Object.keys(recs[0]);
        const out = [cols.map(csvField).join(',')];
        for (const r of recs) {
          out.push(cols.map(c => csvField(r[c])).join(','));
        }
        fs.writeFileSync(fp, out.join('\n') + '\n');
        console.log('✅ ' + pkg + '/' + f + ' (' + recs.length + ' rows)');
      }
    } catch (e) {
      console.log('❌ ' + pkg + '/' + f + ': ' + e.message);
    }
  }
}
console.log('\nDone');
