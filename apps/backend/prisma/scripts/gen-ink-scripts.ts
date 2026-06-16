/**
 * 🔑 Ink Script Key & JSON Generator
 *
 * 为所有学习包中 ink_script_key 为空的话题自动生成 key，
 * 更新 training_topics.csv 和 script_episodes.csv，并创建 ink script JSON 文件。
 *
 * 运行：cd apps/backend && npx ts-node prisma/scripts/gen-ink-scripts.ts
 */

import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, join } from 'path'
import { createHash } from 'crypto'

const PKG_DIR = resolve(__dirname, '..', 'data', 'packages')

// ── CSV helpers ──
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim()); current = ''
    } else { current += ch }
  }
  result.push(current.trim())
  return result
}

function escapeCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`
  return v
}

function readCsvRaw(fp: string): { header: string; lines: string[] } | null {
  if (!existsSync(fp)) return null
  const c = readFileSync(fp, 'utf-8').trim()
  if (!c) return null
  const parts = c.split('\n')
  if (parts.length < 2) return null
  return { header: parts[0], lines: parts.slice(1) }
}

function colIdx(header: string, name: string): number {
  return header.split(',').map(h => h.trim()).indexOf(name)
}

// ── Key generation ──
function makeKey(pkg: string, scene: string, topic: string): string {
  const slug = (s: string) =>
    s.replace(/[·\s、，,]+/g, '_')
     .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '')
     .replace(/_+/g, '_')
     .replace(/^_|_$/g, '')
  const raw = `practice_${pkg}_${slug(scene)}_${slug(topic)}`
  // Truncate to avoid overly long keys
  if (raw.length > 120) {
    const hash = createHash('sha1').update(raw).digest('hex').slice(0, 8)
    return raw.slice(0, 110) + '_' + hash
  }
  return raw
}

// ── Ink script JSON builder ──
function buildInkJson(
  key: string, sceneTitle: string, topicTitle: string,
  chunks: string[], npcName: string, objectives: string[],
): { key: string; title: string; scriptType: string; inkSource: string } {
  const chunkStr = chunks.length > 0
    ? chunks.slice(0, 4).join(',')
    : "I'd like to talk about...,Let me explain...,In my opinion...,Could you tell me more?"
  const obj1 = objectives[0] || `Practice talking about ${topicTitle}`
  const obj2 = objectives[1] || 'Add more details and follow up'

  const source = [
    '---',
    `key: ${key}`,
    `title: ${sceneTitle} - ${topicTitle}`,
    'scriptType: practice',
    '---',
    `${npcName}: Let's talk about ${topicTitle}. What do you think about it?`,
    `#objective: ${obj1}`,
    `#chunks: ${chunkStr}`,
    '#user_input',
    `${npcName}: That's interesting! Can you tell me more about that?`,
    `#objective: ${obj2}`,
    `#chunks: ${chunkStr}`,
    '#user_input',
    `${npcName}: Great conversation! I've learned a lot. Thanks for sharing with me.`,
    '-> END',
  ].join('\n')

  return { key, title: `${sceneTitle} - ${topicTitle}`, scriptType: 'practice', inkSource: source }
}

// ── Main ──
function main() {
  const dirs = readdirSync(PKG_DIR).filter(d => {
    try { return require('fs').statSync(join(PKG_DIR, d)).isDirectory() }
    catch { return false }
  })

  let totalKeys = 0, totalInk = 0

  for (const pkgName of dirs) {
    const pkgPath = join(PKG_DIR, pkgName)
    const topicFile = join(pkgPath, 'training_topics.csv')
    const episodeFile = join(pkgPath, 'script_episodes.csv')
    const chunkFile = join(pkgPath, 'chunks.csv')

    const topicRaw = readCsvRaw(topicFile)
    if (!topicRaw) continue

    const tKeyIdx = colIdx(topicRaw.header, 'ink_script_key')
    const tSceneIdx = colIdx(topicRaw.header, 'scene_title')
    const tTitleIdx = colIdx(topicRaw.header, 'title')
    if (tKeyIdx === -1) continue

    // Parse topics
    const parsed = topicRaw.lines.map(l => parseCsvLine(l))

    // Find topics needing keys
    const needsKey: Array<{ scene: string; title: string }> = []
    for (const f of parsed) {
      if (!f[tKeyIdx] && f[tSceneIdx] && f[tTitleIdx]) {
        needsKey.push({ scene: f[tSceneIdx], title: f[tTitleIdx] })
      }
    }

    if (needsKey.length === 0) continue

    // Build key map
    const keyMap = new Map<string, string>()
    for (const t of needsKey) {
      keyMap.set(`${t.scene}|${t.title}`, makeKey(pkgName, t.scene, t.title))
    }

    // Update training_topics.csv
    const newTopicLines = topicRaw.lines.map(line => {
      const f = parseCsvLine(line)
      const k = keyMap.get(`${f[tSceneIdx]}|${f[tTitleIdx]}`)
      if (k) f[tKeyIdx] = k
      return f.map(escapeCsv).join(',')
    })
    writeFileSync(topicFile, topicRaw.header + '\n' + newTopicLines.join('\n') + '\n', 'utf-8')

    // Update script_episodes.csv if present
    const epRaw = readCsvRaw(episodeFile)
    if (epRaw) {
      const epKeyIdx = colIdx(epRaw.header, 'ink_script_key')
      const epSceneIdx = colIdx(epRaw.header, 'scene_title')
      const epTitleIdx = colIdx(epRaw.header, 'title')
      if (epKeyIdx !== -1) {
        const newEpLines = epRaw.lines.map(line => {
          const f = parseCsvLine(line)
          const k = keyMap.get(`${f[epSceneIdx]}|${f[epTitleIdx]}`)
          if (k) f[epKeyIdx] = k
          return f.map(escapeCsv).join(',')
        })
        writeFileSync(episodeFile, epRaw.header + '\n' + newEpLines.join('\n') + '\n', 'utf-8')
      }
    }

    // ── Generate ink script JSONs ──
    const inkDir = join(pkgPath, 'ink-scripts')
    if (!existsSync(inkDir)) mkdirSync(inkDir, { recursive: true })

    // Read chunks for reference
    const chunkRaw = readCsvRaw(chunkFile)
    const chunkMap = new Map<string, string[]>()
    if (chunkRaw) {
      const cSceneIdx = colIdx(chunkRaw.header, 'scene_title')
      const cTopicIdx = colIdx(chunkRaw.header, 'topic_title')
      const cTextIdx = colIdx(chunkRaw.header, 'text')
      for (const cl of chunkRaw.lines) {
        const cf = parseCsvLine(cl)
        const ck = `${cf[cSceneIdx]}|${cf[cTopicIdx]}`
        if (!chunkMap.has(ck)) chunkMap.set(ck, [])
        chunkMap.get(ck)!.push(cf[cTextIdx] || '')
      }
    }

    // Read episodes for NPC names & objectives
    const epForNpc = readCsvRaw(episodeFile)
    const npcMap = new Map<string, { npc: string; objectives: string[] }>()
    if (epForNpc) {
      const eSceneIdx = colIdx(epForNpc.header, 'scene_title')
      const eTitleIdx = colIdx(epForNpc.header, 'title')
      const eNpcIdx = colIdx(epForNpc.header, 'npc_name')
      const eObjIdx = colIdx(epForNpc.header, 'objectives_json')
      for (const el of epForNpc.lines) {
        const ef = parseCsvLine(el)
        const ek = `${ef[eSceneIdx]}|${ef[eTitleIdx]}`
        let obj: string[] = []
        try { obj = JSON.parse(ef[eObjIdx] || '[]') } catch { /* ignore */ }
        npcMap.set(ek, { npc: ef[eNpcIdx] || 'NPC', objectives: obj })
      }
    }

    // Re-read updated topics to get keys
    const updatedRaw = readCsvRaw(topicFile)
    if (!updatedRaw) continue
    const uKeyIdx = colIdx(updatedRaw.header, 'ink_script_key')
    const uSceneIdx = colIdx(updatedRaw.header, 'scene_title')
    const uTitleIdx = colIdx(updatedRaw.header, 'title')

    let pkgInk = 0
    for (const line of updatedRaw.lines) {
      const f = parseCsvLine(line)
      const key = f[uKeyIdx]
      if (!key) continue
      const sceneTitle = f[uSceneIdx]
      const topicTitle = f[uTitleIdx]

      const inkFile = join(inkDir, `${key}.ink`)
      if (existsSync(inkFile)) continue

      const chunks = chunkMap.get(`${sceneTitle}|${topicTitle}`) || []
      const npcInfo = npcMap.get(`${sceneTitle}|${topicTitle}`)
      const npcName = npcInfo?.npc || 'Instructor'
      const objectives = npcInfo?.objectives || []

      const json = buildInkJson(key, sceneTitle, topicTitle, chunks, npcName, objectives)
      writeFileSync(inkFile, json.inkSource, 'utf-8')
      pkgInk++
    }

    totalKeys += needsKey.length
    totalInk += pkgInk
    console.log(`  ${pkgName}: ${needsKey.length} keys, ${pkgInk} ink scripts`)
  }

  console.log(`\n✅ Total: ${totalKeys} keys generated, ${totalInk} ink scripts created`)
}

main()
