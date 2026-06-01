import { Compiler } from 'inkjs/full'
import { readdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const INK_DIR = resolve(__dirname, '../../../../backend/prisma/data/packages')
let total = 0, ok = 0, fail = 0

for (const dir of ['academic','campus','daily-social','healthcare','hotel','study-abroad','travel','workplace']) {
  try {
    const p = resolve(INK_DIR, dir, 'ink-scripts')
    const files = readdirSync(p).filter((f: string) => f.endsWith('.json'))
    for (const f of files) {
      total++
      const d = JSON.parse(readFileSync(resolve(p, f), 'utf-8'))
      const body = (d.inkSource || '').replace(/^---[\s\S]*?---\n?/, '').trim()
      try { new Compiler(body, null).Compile(); ok++ }
      catch(e: any) { fail++; console.log('FAIL', dir, f) }
    }
  } catch {}
}
console.log(`${ok}/${total} compiled OK, ${fail} failed`)
