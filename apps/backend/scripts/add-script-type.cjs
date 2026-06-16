// 给所有 .ink 文件补上 scriptType
const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(fp); continue; }
    if (!entry.name.endsWith('.ink')) continue;
    let content = fs.readFileSync(fp, 'utf-8');
    if (content.includes('scriptType:')) continue;
    content = content.replace(/^(---\nkey:.+\ntitle:.+\n)/m, '$1scriptType: practice\n');
    fs.writeFileSync(fp, content, 'utf-8');
    console.log('OK:', path.basename(fp));
  }
}

walk(path.resolve(__dirname, '..', 'prisma', 'data', 'packages'));
console.log('Done');
