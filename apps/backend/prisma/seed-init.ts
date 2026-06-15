/**
 * 🏗️ 初始化包 — 系统基础设施数据
 *
 * 从 data/init/ 读取 CSV，创建所有跨场景共享的基础数据。
 * 包括：场景分类、通用句块（独立 Chunk 表）、NPC、地图、地点、成就、Ink 脚本。
 */

import { PrismaClient, AchievementCategory, AchievementRarity } from '@prisma/client'
import { readCsv, parseJson } from './seed-csv'
import * as fs from 'fs'
import * as path from 'path'

const INIT_DIR = 'init'
const INK_DIR = path.resolve(__dirname, 'data', INIT_DIR, 'ink-scripts')

// ── CSV 类型 ──
type CsvSceneCategory = { name: string; icon: string; sort_order: string }
type CsvChunk = { scene_title: string; category: string; text: string; meaning: string; difficulty: string; description: string; examples_json: string }
type CsvChar = { name: string; display_name: string; role: string; personality: string; default_position: string; avatar_url: string; sprite_base_url: string }
type CsvMap = { name: string; display_name: string; required_output_level: string; is_preview: string; sort_order: string }
type CsvLocation = { map_name: string; name: string; display_name: string; description: string; pos_x: string; pos_y: string; location_type: string; is_preview: string; required_output_level: string; background_url: string }
type CsvLocNpc = { location_name: string; character_name: string; default_greeting: string; sort_order: string }
type CsvLocExit = { from_location: string; to_location: string; label: string }
type CsvAchievement = { key: string; title: string; description: string; category: string; rarity: string; sort_order: string; is_hidden: string; hint_text: string; condition_json: string; reward_xp: string }

export async function seedInit(prisma: PrismaClient) {
  console.log('🏗️  初始化包 ── 基础设施数据\n')

  // ═══ 1. 场景分类 ═══
  const catRows = readCsv<CsvSceneCategory>('scene_categories.csv', INIT_DIR)
  const catMap = new Map<string, string>()
  for (const row of catRows) {
    const cat = await prisma.sceneCategory.create({
      data: { name: row.name, icon: row.icon || null, sortOrder: parseInt(row.sort_order) },
    })
    catMap.set(row.name, cat.id)
  }
  console.log(`  ✓ ${catRows.length} 个场景分类`)

  // ═══ 2. 通用句块（无 scene_title 或 scene_title=通用） ═══
  const chunkRows = readCsv<CsvChunk>('general_chunks.csv', INIT_DIR)
  let chunkCount = 0
  for (const row of chunkRows) {
    const examples = parseJson<{ en: string; zh: string; note?: string; level?: string }[]>(row.examples_json)
    await prisma.chunk.upsert({
      where: { text: row.text },
      create: {
        text: row.text,
        meaning: row.meaning,
        category: row.category,
        difficulty: row.difficulty || 'L2',
        description: row.description || null,
        examples: examples?.length
          ? { create: examples.map((ex, i) => ({ en: ex.en, zh: ex.zh, note: ex.note || null, level: ex.level || 'basic', sortOrder: i })) }
          : undefined,
      },
      update: {
        meaning: row.meaning,
        category: row.category,
        difficulty: row.difficulty || 'L2',
        description: row.description || null,
        examples: examples?.length
          ? {
              deleteMany: {},
              create: examples.map((ex, i) => ({ en: ex.en, zh: ex.zh, note: ex.note || null, level: ex.level || 'basic', sortOrder: i })),
            }
          : undefined,
      },
    })
    chunkCount++
  }
  console.log(`  ✓ ${chunkCount} 个通用句块`)

  // ═══ 3. Ink 对话脚本 ═══
  try {
    const inkFiles = fs.readdirSync(INK_DIR).filter((f: string) => f.endsWith('.json'))
    let inkCount = 0
    for (const file of inkFiles) {
      const inkData = JSON.parse(fs.readFileSync(path.resolve(INK_DIR, file), 'utf-8'))
      await prisma.inkScript.upsert({
        where: { key: inkData.key },
        create: inkData,
        update: {},
      })
      inkCount++
    }
    console.log(`  ✓ ${inkCount} 个 Ink 对话脚本`)
  } catch {
    console.log('  ⚠️  未找到 Ink 脚本目录')
  }

  // ═══ 4. NPC 角色 ═══
  const charRows = readCsv<CsvChar>('game_characters.csv', INIT_DIR)
  const charNameToId = new Map<string, string>()
  for (const row of charRows) {
    const char = await prisma.gameCharacter.create({
      data: {
        name: row.name,
        displayName: row.display_name,
        role: row.role,
        personality: row.personality || null,
        defaultPosition: row.default_position || 'center',
        avatarUrl: row.avatar_url || null,
        spriteBaseUrl: row.sprite_base_url || null,
      },
    })
    charNameToId.set(row.name, char.id)
  }
  console.log(`  ✓ ${charRows.length} 个 NPC 角色`)

  // ═══ 5. 探索地图 + 地点 ═══
  const mapRows = readCsv<CsvMap>('game_maps.csv', INIT_DIR)
  const mapNameToId = new Map<string, string>()
  for (const row of mapRows) {
    const map = await prisma.gameMap.create({
      data: {
        name: row.name,
        displayName: row.display_name,
        requiredOutputLevel: row.required_output_level || 'L1',
        isPreview: row.is_preview === 'true',
        sortOrder: parseInt(row.sort_order) || 0,
      },
    })
    mapNameToId.set(row.name, map.id)
  }

  const locRows = readCsv<CsvLocation>('game_locations.csv', INIT_DIR)
  const locNameToId = new Map<string, string>()
  for (const row of locRows) {
    const mapId = mapNameToId.get(row.map_name)
    if (!mapId) continue
    const loc = await prisma.gameLocation.create({
      data: {
        mapId,
        name: row.name,
        displayName: row.display_name,
        description: row.description || null,
        posX: parseFloat(row.pos_x) || 0,
        posY: parseFloat(row.pos_y) || 0,
        locationType: row.location_type || 'vn_scene',
        isPreview: row.is_preview === 'true',
        requiredOutputLevel: row.required_output_level || 'L1',
        backgroundUrl: row.background_url || null,
      },
    })
    locNameToId.set(row.name, loc.id)
  }
  console.log(`  ✓ ${mapRows.length} 个地图 + ${locRows.length} 个地点`)

  // ═══ 6. 地点↔NPC 关联 ═══
  const locNpcRows = readCsv<CsvLocNpc>('location_npcs.csv', INIT_DIR)
  for (const row of locNpcRows) {
    const locId = locNameToId.get(row.location_name)
    const charId = charNameToId.get(row.character_name)
    if (!locId || !charId) continue
    await prisma.gameLocationNpc.create({
      data: { locationId: locId, characterId: charId, defaultGreeting: row.default_greeting || null, sortOrder: parseInt(row.sort_order) || 0 },
    })
  }

  // ═══ 7. 地点出口 ═══
  const exitRows = readCsv<CsvLocExit>('location_exits.csv', INIT_DIR)
  for (const row of exitRows) {
    const fromId = locNameToId.get(row.from_location)
    const toId = locNameToId.get(row.to_location)
    if (!fromId || !toId) continue
    await prisma.gameLocationExit.create({
      data: { fromId, toId, label: row.label || '→' },
    })
  }
  console.log(`  ✓ ${locNpcRows.length} 个地点↔NPC + ${exitRows.length} 个出口`)

  // ═══ 8. 成就定义 ═══
  const achRows = readCsv<CsvAchievement>('achievement_defs.csv', INIT_DIR)
  for (const row of achRows) {
    const rarity = row.rarity as AchievementRarity
    const rewardXp = row.rarity === 'legendary' ? 100 : row.rarity === 'epic' ? 50 : row.rarity === 'rare' ? 20 : 10
    await prisma.achievementDef.upsert({
      where: { key: row.key },
      create: {
        key: row.key, title: row.title, description: row.description,
        category: row.category as AchievementCategory, rarity,
        icon: null, sortOrder: parseInt(row.sort_order) || 0,
        isHidden: row.is_hidden === 'true', hintText: row.hint_text || null,
        condition: parseJson(row.condition_json) || {},
        rewardXp: parseInt(row.reward_xp) || rewardXp, rewardTitle: null,
      },
      update: {},
    })
  }
  console.log(`  ✓ ${achRows.length} 个成就定义`)

  console.log('\n✅ 初始化包完成！')

  return { catMap, charNameToId, locNameToId }
}
