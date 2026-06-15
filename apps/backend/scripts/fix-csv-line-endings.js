const fs = require('fs');
const path = require('path');
const b = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

// Find all CSV files recursively
const files = [];
function scan(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) scan(p);
    else if (f.endsWith('.csv')) files.push(p);
  }
}
scan(b);

let fixed = 0;
for (const f of files) {
  const orig = fs.readFileSync(f, 'utf-8');
  // Remove ALL \r characters (Windows CR) from CSV files
  // This fixes the issue where \r was included inside quoted field values
  const cleaned = orig.replace(/\r/g, '');
  if (cleaned !== orig) {
    fs.writeFileSync(f, cleaned);
    console.log('Fixed: ' + path.relative(b, f));
    fixed++;
  }
}
console.log('Done. Fixed ' + fixed + ' files with stray \\r chars.');
