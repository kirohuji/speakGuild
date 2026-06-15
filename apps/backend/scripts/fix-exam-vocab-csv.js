const fs = require('fs');
const path = require('path');
const b = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

// Fix scene_vocabulary.csv files - wrap examples_json in CSV quotes
const examPkgs = [
  'exam-cet-4','exam-cet-6',
  'exam-ielts-6','exam-ielts-6-5','exam-ielts-7','exam-ielts-7-5',
  'exam-ielts-8','exam-ielts-8-5','exam-toefl'
];

let fixed = 0;
for (const p of examPkgs) {
  const fp = path.join(b, p, 'scene_vocabulary.csv');
  if (!fs.existsSync(fp)) continue;
  let c = fs.readFileSync(fp, 'utf-8');
  const lines = c.split('\n');
  const newLines = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    let l = lines[i];
    if (!l.trim()) { newLines.push(l); continue; }

    // Find the 9th and 10th comma to locate examples_json field
    let commaCount = 0, exStart = -1, exEnd = -1;
    for (let j = 0; j < l.length; j++) {
      if (l[j] === ',') {
        commaCount++;
        if (commaCount === 9) exStart = j + 1;
        if (commaCount === 10) exEnd = j;
      }
    }

    if (exStart > 0 && exEnd > exStart) {
      const before = l.substring(0, exStart);
      const json = l.substring(exStart, exEnd);
      const after = l.substring(exEnd);
      // Escape internal double quotes and wrap in CSV quotes
      const escapedJson = json.replace(/"/g, '""');
      newLines.push(before + '"' + escapedJson + '"' + after);
      fixed++;
    } else {
      newLines.push(l);
    }
  }

  fs.writeFileSync(fp, newLines.join('\n'));
}
console.log('Fixed ' + fixed + ' lines across ' + examPkgs.length + ' packages');
