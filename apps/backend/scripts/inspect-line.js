const fs = require('fs');
const fp = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages/exam-cet-4/chunks.csv';
const raw = fs.readFileSync(fp, 'utf-8');
const lines = raw.split('\n');
for (let i = 1; i < 5; i++) {
  const line = lines[i];
  if (!line) continue;
  console.log('Line ' + (i+1) + ' (' + line.length + ' chars):');
  // Show full hex
  const buf = Buffer.from(line);
  console.log('  Full hex: ' + buf.toString('hex'));
  console.log('  Last 3 chars: ' + JSON.stringify(line.slice(-3)));
  console.log('  Last 3 bytes hex: ' + buf.slice(-3).toString('hex'));
  // Show character codes
  console.log('  Ends with "?: ' + line.endsWith('"'));
  if (line.length > 0) {
    const lastCode = line.charCodeAt(line.length - 1);
    console.log('  Last char code: ' + lastCode + ' (' + (lastCode === 10 ? 'LF' : lastCode === 13 ? 'CR' : String.fromCharCode(lastCode)) + ')');
  }
}
