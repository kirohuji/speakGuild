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

/** 从 Ink 文本的 YAML front matter 中提取 key、title 和 scriptType */
function parseInkMeta(raw: string): { key: string; title: string; scriptType: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return { key: '', title: '', scriptType: 'practice' }
  const front = match[1]
  const keyMatch = front.match(/^key:\s*(.+)$/m)
  const titleMatch = front.match(/^title:\s*(.+)$/m)
  const typeMatch = front.match(/^scriptType:\s*(.+)$/m)
  return {
    key: (keyMatch?.[1] || '').trim(),
    title: (titleMatch?.[1] || '').trim(),
    scriptType: (typeMatch?.[1] || 'practice').trim(),
  }
}

// ── CSV 类型 ──
type CsvSceneCategory = { name: string; icon: string; sort_order: string }
type CsvChunk = { scene_title: string; category: string; text: string; meaning: string; difficulty: string; description: string; examples_json: string }
type CsvChar = { name: string; display_name: string; role: string; personality: string; default_position: string; avatar_url: string; sprite_base_url: string }
type CsvMap = { name: string; display_name: string; required_output_level: string; is_preview: string; sort_order: string }
type CsvLocation = { map_name: string; name: string; display_name: string; description: string; pos_x: string; pos_y: string; location_type: string; is_preview: string; required_output_level: string; background_url: string }
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
    const inkFiles = fs.readdirSync(INK_DIR).filter((f: string) => f.endsWith('.ink'))
    let inkCount = 0
    for (const file of inkFiles) {
      const raw = fs.readFileSync(path.resolve(INK_DIR, file), 'utf-8')
      const { key, title, scriptType } = parseInkMeta(raw)
      if (!key) continue
      await prisma.inkScript.upsert({
        where: { key },
        create: { key, title: title || key, scriptType: scriptType || 'practice', inkSource: raw, inkJson: {} },
        update: { inkSource: raw },
      })
      inkCount++
    }
    console.log(`  ✓ ${inkCount} 个 Ink 对话脚本`)
  } catch {
    console.log('  ⚠️  未找到 Ink 脚本目录')
  }

  // ═══ 4. NPC 角色（仅首次创建，后续由后台"角色管理"维护） ═══
  const charRows = readCsv<CsvChar>('game_characters.csv', INIT_DIR)
  const charNameToId = new Map<string, string>()
  const existingCharCount = await prisma.gameCharacter.count()
  if (existingCharCount === 0) {
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
  } else {
    // 已有角色数据，仅加载 name→id 映射供后续关联使用
    const existingChars = await prisma.gameCharacter.findMany({ select: { id: true, name: true } })
    for (const c of existingChars) charNameToId.set(c.name, c.id)
  }
  console.log(`  ✓ ${charRows.length} 个 NPC 角色${existingCharCount > 0 ? '（已存在，跳过创建）' : ''}`)

  // ═══ 5. 探索地图 + 地点（仅首次创建，后续由后台"地图管理"维护） ═══
  const mapRows = readCsv<CsvMap>('game_maps.csv', INIT_DIR)
  const mapNameToId = new Map<string, string>()
  const existingMapCount = await prisma.gameMap.count()
  if (existingMapCount === 0) {
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
  } else {
    const existingMaps = await prisma.gameMap.findMany({ select: { id: true, name: true } })
    for (const m of existingMaps) mapNameToId.set(m.name, m.id)
  }

  const locRows = readCsv<CsvLocation>('game_locations.csv', INIT_DIR)
  const locNameToId = new Map<string, string>()
  const existingLocCount = await prisma.gameLocation.count()
  if (existingLocCount === 0) {
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
  } else {
    const existingLocs = await prisma.gameLocation.findMany({ select: { id: true, name: true } })
    for (const l of existingLocs) locNameToId.set(l.name, l.id)
  }
  console.log(`  ✓ ${mapRows.length} 个地图 + ${locRows.length} 个地点${existingMapCount > 0 ? '（已存在，跳过创建）' : ''}`)

  // ═══ 6. 地点↔NPC 关联 — 已迁移至 GameRoomNpc 模型，请使用 seed-rooms 等新种子脚本 ═══
  // ═══ 7. 地点出口 — 已移除独立模型，后续通过 GameRoom 层级导航 ═══
  console.log(`  ⚠️  地点↔NPC 关联与出口已迁移至 Room 层级，此种子不再处理`)

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
