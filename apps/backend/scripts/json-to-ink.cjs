/**
 * 将 ink-scripts/ 目录下的 JSON 文件转换为 .ink 文件
 * 用法: node scripts/json-to-ink.cjs
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'prisma', 'data', 'packages');
let converted = 0;
let skipped = 0;

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.json') && fullPath.includes('ink-scripts')) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(raw);
        const source = data.inkSource;
        if (!source) {
          console.log(`⏭️  跳过（无 inkSource）: ${path.relative(DATA_DIR, fullPath)}`);
          skipped++;
          continue;
        }
        // 写入 .ink 文件（同名，换后缀）
        const inkPath = fullPath.replace(/\.json$/, '.ink');
        fs.writeFileSync(inkPath, source, 'utf-8');
        console.log(`✅ ${path.relative(DATA_DIR, fullPath)} → ${path.basename(inkPath)}`);
        converted++;
        // 删除原 JSON 文件
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error(`❌ 失败: ${path.relative(DATA_DIR, fullPath)} — ${err.message}`);
      }
    }
  }
}

console.log('🔍 扫描 ink-scripts/ 目录...\n');
walkDir(DATA_DIR);
console.log(`\n📊 完成: ${converted} 个转换, ${skipped} 个跳过`);
