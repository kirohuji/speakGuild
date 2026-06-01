/**
 * 更新所有 training_topics.csv，自动生成 ink_script_key
 * 运行: npx tsx apps/backend/prisma/scripts/update-csv-keys.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const PKG_DIR = resolve(__dirname, '..', 'data', 'packages')

function sanitize(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .slice(0, 80)
}

function main() {
  const dirs = readdirSync(PKG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  for (const dir of dirs) {
    const csvPath = resolve(PKG_DIR, dir, 'training_topics.csv')
    if (!existsSync(csvPath)) continue

    const csv = readFileSync(csvPath, 'utf-8')
    const lines = csv.split('\n')
    if (lines.length <= 1) continue

    const headers = lines[0].split(',')
    const keyIdx = headers.findIndex((h) => h.trim() === 'ink_script_key')
    const sceneIdx = headers.findIndex((h) => h.trim() === 'scene_title')
    const titleIdx = headers.findIndex((h) => h.trim() === 'title')

    if (keyIdx < 0) continue

    const updated = [lines[0]]

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      const existingKey = (cols[keyIdx] || '').trim()
      
      if (!existingKey && sceneIdx >= 0 && titleIdx >= 0) {
        const scene = (cols[sceneIdx] || '').trim()
        const title = (cols[titleIdx] || '').trim()
        cols[keyIdx] = `practice_${dir}_${sanitize(scene)}_${sanitize(title)}`
      }

      updated.push(cols.join(','))
    }

    writeFileSync(csvPath, updated.join('\n') + '\n')
    console.log(`  ✓ ${dir}/training_topics.csv`)
  }

  console.log('\n✅ CSV 更新完成')
}

main()
