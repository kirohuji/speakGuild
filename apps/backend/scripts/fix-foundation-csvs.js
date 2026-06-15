const fs = require('fs');
const path = require('path');

// Step 1: Fix all foundation scene_vocabulary.csv files
// The issue: examples_json field contains commas but isn't CSV-quoted
function fixCsvFile(fp) {
  if (!fs.existsSync(fp)) return false;
  let c = fs.readFileSync(fp, 'utf-8');
  const lines = c.split('\n');
  const out = [lines[0]];
  let fixed = false;
  
  for (let i = 1; i < lines.length; i++) {
    let l = lines[i];
    if (!l.trim()) continue;
    
    // Count commas (simple approach since none of the first 9 fields contain commas)
    let cc = 0, p9 = -1, pl = -1;
    for (let j = 0; j < l.length; j++) {
      if (l[j] === ',') {
        cc++;
        if (cc === 9 && p9 < 0) p9 = j;
        pl = j;
      }
    }
    
    if (p9 > 0 && pl > p9) {
      const before = l.substring(0, p9 + 1);
      const jsonField = l.substring(p9 + 1, pl);
      const after = l.substring(pl);
      
      // Check if already properly quoted
      if (jsonField.startsWith('"') && jsonField.endsWith('"')) {
        out.push(l);
      } else {
        // Escape internal quotes and wrap
        const escaped = jsonField.replace(/"/g, '""');
        out.push(before + '"' + escaped + '"' + after);
        fixed = true;
      }
    } else {
      out.push(l);
    }
  }
  
  if (fixed) {
    fs.writeFileSync(fp, out.join('\n'));
    return true;
  }
  return false;
}

const base = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

// Fix foundation packages
const foundationPkgs = [
  'foundation-daily-life', 'foundation-daily-work',
  'foundation-essential-phrases', 'foundation-opinion-basics',
  'foundation-social-express', 'foundation-travel-basic',
  'foundation-weather-nature'
];

let fixCount = 0;
for (const pkg of foundationPkgs) {
  const fp = path.join(base, pkg, 'scene_vocabulary.csv');
  if (fixCsvFile(fp)) {
    console.log('Fixed ' + pkg + '/scene_vocabulary.csv');
    fixCount++;
  }
}

// Also fix chunks.csv for foundation packages (same issue)
for (const pkg of foundationPkgs) {
  const fp = path.join(base, pkg, 'chunks.csv');
  // chunks.csv has 8 columns, examples_json is at index 7 (8th column, 7 commas before)
  if (!fs.existsSync(fp)) continue;
  let c = fs.readFileSync(fp, 'utf-8');
  const lines = c.split('\n');
  const out = [lines[0]];
  let fixed = false;
  
  for (let i = 1; i < lines.length; i++) {
    let l = lines[i];
    if (!l.trim()) continue;
    
    let cc = 0, p7 = -1, pl = -1;
    for (let j = 0; j < l.length; j++) {
      if (l[j] === ',') {
        cc++;
        if (cc === 7 && p7 < 0) p7 = j;
        pl = j;
      }
    }
    
    if (p7 > 0 && pl > p7) {
      const before = l.substring(0, p7 + 1);
      const jsonField = l.substring(p7 + 1, pl);
      const after = l.substring(pl);
      
      if (!jsonField.startsWith('"') || !jsonField.endsWith('"')) {
        const escaped = jsonField.replace(/"/g, '""');
        out.push(before + '"' + escaped + '"' + after);
        fixed = true;
      } else {
        out.push(l);
      }
    } else {
      out.push(l);
    }
  }
  
  if (fixed) {
    fs.writeFileSync(fp, out.join('\n'));
    console.log('Fixed ' + pkg + '/chunks.csv');
    fixCount++;
  }
}

// Step 2: Add missing scene categories
const catFile = path.join(base, '../init/scene_categories.csv');
let catContent = fs.readFileSync(catFile, 'utf-8');

const newCategories = [
  ['托福', 'FileText', '21'],
  ['基础口语', 'BookOpenCheck', '22'],
];

for (const [name, icon, sort] of newCategories) {
  if (!catContent.includes(name + ',')) {
    catContent += '\n' + [name, icon, sort].join(',');
    console.log('Added category: ' + name);
  }
}
fs.writeFileSync(catFile, catContent);

console.log('\nDone. Fixed ' + fixCount + ' files.');
