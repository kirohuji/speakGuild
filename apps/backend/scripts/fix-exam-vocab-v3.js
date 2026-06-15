const fs = require('fs');
const path = require('path');
const b = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';
const csvParse = require('csv-parse/sync');

function csvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const examPkgs = [
  'exam-cet-4', 'exam-cet-6',
  'exam-ielts-6', 'exam-ielts-6-5', 'exam-ielts-7', 'exam-ielts-7-5',
  'exam-ielts-8', 'exam-ielts-8-5', 'exam-toefl'
];

for (const pkg of examPkgs) {
  const fp = path.join(b, pkg, 'scene_vocabulary.csv');
  if (!fs.existsSync(fp)) continue;
  
  // Read original, fix by wrapping examples_json in quotes
  let content = fs.readFileSync(fp, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  // For each line, we need to find the 9th comma -> that's start of examples_json
  // The field ends at the last comma (before sort_order)
  // We need to wrap the examples_json field in CSV quotes
  
  const output = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Find the 9th comma by counting from left, but we need to handle quotes
    // Since the 9th field (description, index 8) doesn't contain commas in this dataset,
    // we can find the position of the 9th comma
    let commaCount = 0;
    let ninthCommaPos = -1;
    let lastCommaPos = -1;
    
    for (let j = 0; j < line.length; j++) {
      if (line[j] === ',') {
        commaCount++;
        if (commaCount === 9) ninthCommaPos = j;
        lastCommaPos = j; // will end up being the position of the last comma
      }
    }
    
    if (ninthCommaPos > 0 && lastCommaPos > ninthCommaPos) {
      const before = line.substring(0, ninthCommaPos + 1);
      const jsonContent = line.substring(ninthCommaPos + 1, lastCommaPos);
      const after = line.substring(lastCommaPos);
      
      // Check if already wrapped
      if (!jsonContent.startsWith('"') || !jsonContent.endsWith('"')) {
        const escaped = jsonContent.replace(/"/g, '""');
        output.push(before + '"' + escaped + '"' + after);
      } else {
        output.push(line);
      }
    } else {
      output.push(line);
    }
  }
  
  fs.writeFileSync(fp, output.join('\n'));
  console.log('Fixed ' + pkg);
}

console.log('Done');
