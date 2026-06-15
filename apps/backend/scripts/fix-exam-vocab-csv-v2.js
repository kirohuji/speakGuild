const fs = require('fs');
const path = require('path');
const b = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

// Proper CSV field encoder
function csvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // If contains comma, double-quote, newline, or starts with space, wrap in quotes
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.startsWith(' ') || s.endsWith(' ')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Regenerate scene_vocabulary.csv for exam packages with proper CSV quoting
const examPkgs = [
  'exam-cet-4', 'exam-cet-6',
  'exam-ielts-6', 'exam-ielts-6-5', 'exam-ielts-7', 'exam-ielts-7-5',
  'exam-ielts-8', 'exam-ielts-8-5', 'exam-toefl'
];

for (const pkg of examPkgs) {
  const fp = path.join(b, pkg, 'scene_vocabulary.csv');
  if (!fs.existsSync(fp)) { console.log('SKIP ' + pkg + ' - no file'); continue; }

  const content = fs.readFileSync(fp, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) continue;

  // Parse each line using a simple state machine
  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  const header = parseCsvLine(lines[0]);
  const output = [header.map(csvField).join(',')];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    // Ensure we have at least 11 fields
    while (fields.length < 11) fields.push('');
    // Properly CSV-encode each field
    const encoded = fields.map(csvField);
    output.push(encoded.join(','));
  }

  fs.writeFileSync(fp, output.join('\n'));
  console.log('Fixed ' + pkg + ' (' + (lines.length - 1) + ' rows)');
}

console.log('All exam packages fixed');
