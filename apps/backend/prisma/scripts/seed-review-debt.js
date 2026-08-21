/**
 * 为测试用户批量生成「今日复习」候选数据（user_warmup_item_progress）。
 *
 * 复习候选的判定：progress.attempts > 0 且 dueDate <= 今天（见
 * daily-practice.repository.ts 的 reviewBacklog）。itemId 必须与前端
 * createWarmupPracticeItemId 完全一致，这里原样复现了该算法。
 *
 * 用法: node apps/backend/prisma/scripts/seed-review-debt.js
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// 测试用户 user@engjourney.local
const USER_ID = '40zGOhmIMme3gtnoCu4eVvTVLJ1cvwtJ'

// ── 与前端 daily-practice.repository.ts 完全一致的 itemId 算法 ──
function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}
function stableHash(value) {
  const input = stableStringify(value)
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  return (hash >>> 0).toString(36)
}
function compactKey(value, fallback) {
  if (value == null) return fallback
  return String(value).trim() || fallback
}
function createWarmupPracticeItemId({ packId, topicId, type, item, prompt, pattern }) {
  const itemKey = compactKey(item?.id, `item-${stableHash({
    type: item?.type, title: item?.title, kind: item?.kind, direction: item?.direction,
    chunk: item?.chunk, chunkMeaning: item?.chunkMeaning, pattern: item?.pattern,
    patternMeaning: item?.patternMeaning, vocabWord: item?.vocabWord, vocabMeaning: item?.vocabMeaning,
    fullSentence: item?.fullSentence, levels: item?.levels,
  })}`)
  const patternPart = pattern ? `:p-${compactKey(pattern.id, stableHash({
    chunk: pattern.chunk, meaning: pattern.meaning, chunkMeaning: pattern.chunkMeaning, pattern: pattern.pattern,
  }))}` : ''
  const promptKey = compactKey(prompt?.id ?? prompt?.vocabId, `prompt-${stableHash({
    zh: prompt?.zh, answer: prompt?.answer, promptZh: prompt?.promptZh,
    suggestedAnswer: prompt?.suggestedAnswer, targetWords: prompt?.targetWords,
    fullSentence: prompt?.fullSentence, levels: prompt?.levels,
  })}`)
  return `${packId}:${topicId}:${itemKey}:${type}${patternPart}:i-${promptKey}`
}

function buildCandidates(scene, topic) {
  const outputTraining = topic.metadata?.outputTraining
  const pipeline = outputTraining?.enabled === false ? [] : (outputTraining?.pipeline ?? [])
  const out = []
  for (const item of pipeline) {
    const type = item.type
    const push = (prompt, extra = {}) => {
      const itemId = createWarmupPracticeItemId({
        packId: scene.id, topicId: topic.id, type, item, prompt, pattern: extra.pattern,
      })
      out.push({ itemId, packId: scene.id, topicId: topic.id, type })
    }
    if (type === 'chunk_substitution') for (const prompt of (item.items ?? [])) push(prompt)
    else if (type === 'vocab_drill') for (const prompt of (item.vocabs ?? [])) push(prompt)
    else if (type === 'vocab_sentence_building') {
      for (const pattern of (item.patterns ?? [])) {
        for (const prompt of (pattern.items ?? [])) push({ ...prompt, pattern }, { pattern })
      }
    } else if (type === 'pattern_drill') for (const prompt of (item.items ?? [])) push(prompt)
    else if (type === 'sentence_decomposition') push({ levels: item.levels, fullSentence: item.fullSentence })
  }
  return out
}

function utcDate(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function main() {
  const scenes = await prisma.scene.findMany({ where: { contentMode: 'practice' } })
  const topics = await prisma.trainingTopic.findMany({
    where: { sceneId: { in: scenes.map((s) => s.id) } },
  })

  const now = new Date()
  const DAY = 86400000
  let inserted = 0
  let packs = 0

  for (const scene of scenes) {
    const sceneTopics = topics.filter((t) => t.sceneId === scene.id)
    const candidates = []
    for (const topic of sceneTopics) candidates.push(...buildCandidates(scene, topic))
    if (candidates.length === 0) {
      console.log(`[skip] ${scene.title}: 无 outputTraining pipeline`)
      continue
    }
    packs += 1
    console.log(`[pack] ${scene.title}: ${candidates.length} 个候选，取前 8 条`)
    const selected = candidates.slice(0, 8)
    for (let i = 0; i < selected.length; i += 1) {
      const c = selected[i]
      // 交替生成：偶数为逾期（2 天前到期），奇数为今天到期。
      const overdue = i % 2 === 0
      const dueDate = utcDate(new Date(now.getTime() - (overdue ? 2 : 0) * DAY))
      const lastPracticedAt = new Date(now.getTime() - (overdue ? 5 : 3) * DAY)
      const data = {
        userId: USER_ID,
        itemId: c.itemId,
        packId: c.packId,
        topicId: c.topicId,
        type: c.type,
        status: overdue ? 'overdue' : 'review',
        dueDate,
        lastPracticedAt,
        bestScore: 'ok',
        bestScoreRank: 2,
        lastScore: overdue ? 'weak' : 'ok',
        lastScoreRank: overdue ? 1 : 2,
        attempts: overdue ? 3 : 2,
        correctCount: 1,
        reviewCount: 0,
        lapseCount: overdue ? 1 : 0,
        intervalDays: 1,
        easeFactor: 2.3,
        updatedAt: lastPracticedAt,
        createdAt: lastPracticedAt,
      }
      await prisma.userWarmupItemProgress.upsert({
        where: { userId_itemId: { userId: USER_ID, itemId: c.itemId } },
        create: data,
        update: data,
      })
      inserted += 1
    }
  }

  console.log(`\n完成：覆盖 ${packs} 个学习包，插入/更新 ${inserted} 条复习候选`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
