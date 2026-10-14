/**
 * 从对话写作题 Markdown 回填 TrainingTopic 字段。
 *
 * Markdown 格式与 admin「导出对话 Markdown」一致：
 * - ## 情境描述 → contentConfig.writing.situation
 * - ## 对话轮次 / **参考见解** → contentConfig.writing.turns[].referenceExplanation
 *   （同时回填 aText / hint / referenceAnswer，保持轮次一致）
 * - ## 话题说明 → description
 * - ### 英文提示 → promptEn
 * - ### 中文提示 → promptZh
 *
 * 用法：
 *   cd apps/backend
 *   npx ts-node prisma/update-dialogue-from-md.ts \
 *     --topicId cmv0g4et4000715oclrxfcmdj \
 *     --md /Users/lourd/Downloads/修改出行计划.md
 *
 * 加 --dry-run 只打印解析结果，不写库。
 */

import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

type DialogueTurn = {
  aText: string
  hint: string
  referenceAnswer: string
  referenceExplanation: string
  aAudioUrl?: string
  referenceAudioUrl?: string
}

type ParsedDialogueMd = {
  title: string
  situation: string
  turns: DialogueTurn[]
  description: string
  promptEn: string
  promptZh: string
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i++
    }
  }
  return args
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
  )
  const match = markdown.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function extractSubSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)###\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|\\n##\\s+|$)`,
  )
  const match = markdown.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractLabeledBlock(section: string, label: string): string {
  const pattern = new RegExp(
    `\\*\\*${escapeRegExp(label)}\\*\\*\\s*\\n+([\\s\\S]*?)(?=\\n\\*\\*|\\n###\\s+|$)`,
  )
  const match = section.match(pattern)
  return (match?.[1] ?? '').trim()
}

function parseDialogueMarkdown(markdown: string): ParsedDialogueMd {
  const title = (markdown.match(/^#\s+(.+)$/m)?.[1] ?? '').trim()
  const situation = extractSection(markdown, '情境描述')
  const dialogueBody = extractSection(markdown, '对话轮次')
  const descriptionSection = extractSection(markdown, '话题说明')
  const promptEn = extractSubSection(descriptionSection || markdown, '英文提示')
  const promptZh = extractSubSection(descriptionSection || markdown, '中文提示')

  // 话题说明正文 = 去掉英文/中文提示子节后的剩余内容
  let description = descriptionSection
  description = description
    .replace(/(?:^|\n)###\s+英文提示\s*\n[\s\S]*?(?=\n###\s+|$)/, '')
    .replace(/(?:^|\n)###\s+中文提示\s*\n[\s\S]*?(?=\n###\s+|$)/, '')
    .trim()

  const turnChunks = dialogueBody
    .split(/(?=###\s+第\s*\d+\s*轮)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^###\s+第\s*\d+\s*轮/.test(chunk))

  const turns: DialogueTurn[] = turnChunks.map((chunk) => {
    // 参考见解：从 **参考见解** 之后到下一个 ### 第 N 轮 或文件结束
    // 块内可能含 ### 语法点 / ### 知识点 / ### 怎么说
    const explanationMatch = chunk.match(
      /\*\*参考见解\*\*\s*\n+([\s\S]*)$/,
    )
    let referenceExplanation = (explanationMatch?.[1] ?? '').trim()
    // 去掉末尾可能误带的空行
    referenceExplanation = referenceExplanation.replace(/\n+$/, '').trim()

    // 为避免把见解里的 ### 干扰，先截掉见解再取标签块
    const beforeExplanation = explanationMatch
      ? chunk.slice(0, explanationMatch.index)
      : chunk

    return {
      aText: extractLabeledBlock(beforeExplanation, 'A 台词'),
      hint: extractLabeledBlock(beforeExplanation, 'B 中文提示'),
      referenceAnswer: extractLabeledBlock(beforeExplanation, 'B 参考答案'),
      referenceExplanation,
    }
  })

  return { title, situation, turns, description, promptEn, promptZh }
}

function preview(value: string, max = 80) {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const topicId = String(args.topicId || '')
  const mdPath = String(args.md || '')
  const dryRun = Boolean(args['dry-run'])

  if (!topicId || !mdPath) {
    console.error(
      '用法: npx ts-node prisma/update-dialogue-from-md.ts --topicId <id> --md <path> [--dry-run]',
    )
    process.exit(1)
  }

  const absoluteMd = path.resolve(mdPath)
  if (!fs.existsSync(absoluteMd)) {
    console.error(`Markdown 文件不存在: ${absoluteMd}`)
    process.exit(1)
  }

  const markdown = fs.readFileSync(absoluteMd, 'utf8')
  const parsed = parseDialogueMarkdown(markdown)

  console.log('=== 解析结果 ===')
  console.log(`标题: ${parsed.title}`)
  console.log(`情境描述: ${preview(parsed.situation)}`)
  console.log(`话题说明: ${preview(parsed.description)}`)
  console.log(`英文提示: ${preview(parsed.promptEn)}`)
  console.log(`中文提示: ${preview(parsed.promptZh)}`)
  console.log(`对话轮次: ${parsed.turns.length}`)
  parsed.turns.forEach((turn, index) => {
    console.log(
      `  #${index + 1} A=${preview(turn.aText, 40)} | hint=${preview(turn.hint, 30)} | expl=${turn.referenceExplanation.length}字`,
    )
  })

  if (!parsed.situation || !parsed.description || !parsed.promptEn || !parsed.promptZh) {
    console.error('解析失败：情境描述 / 话题说明 / 英文提示 / 中文提示 存在空值')
    process.exit(1)
  }
  if (!parsed.turns.length) {
    console.error('解析失败：未解析到对话轮次')
    process.exit(1)
  }
  if (parsed.turns.some((t) => !t.aText || !t.referenceExplanation)) {
    console.error('解析失败：存在缺少 A 台词或参考见解的轮次')
    process.exit(1)
  }

  if (dryRun) {
    console.log('\n--dry-run：未写入数据库')
    return
  }

  const prisma = new PrismaClient()
  try {
    const topic = await prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: { id: true, title: true, contentConfig: true },
    })
    if (!topic) {
      console.error(`Topic 不存在: ${topicId}`)
      process.exit(1)
    }

    const contentConfig = (topic.contentConfig ?? {}) as Record<string, any>
    const writing = { ...(contentConfig.writing ?? {}) }
    const existingTurns: DialogueTurn[] = Array.isArray(writing.turns) ? writing.turns : []

    if (existingTurns.length && existingTurns.length !== parsed.turns.length) {
      console.warn(
        `警告：库中轮次数 ${existingTurns.length} ≠ Markdown ${parsed.turns.length}，将按 Markdown 覆盖 turns`,
      )
    }

    // 保留已有音频 URL（按轮次索引对齐）
    const nextTurns = parsed.turns.map((turn, index) => {
      const prev = existingTurns[index]
      return {
        ...turn,
        ...(prev?.aAudioUrl ? { aAudioUrl: prev.aAudioUrl } : {}),
        ...(prev?.referenceAudioUrl ? { referenceAudioUrl: prev.referenceAudioUrl } : {}),
      }
    })

    writing.situation = parsed.situation
    writing.turns = nextTurns
    writing.genre = writing.genre || 'dialogue'

    await prisma.trainingTopic.update({
      where: { id: topicId },
      data: {
        description: parsed.description,
        promptEn: parsed.promptEn,
        promptZh: parsed.promptZh,
        contentConfig: {
          ...contentConfig,
          writing,
        },
      },
    })

    console.log(`\n已更新 topic ${topicId}（${topic.title}）`)
    console.log(
      `字段: description / promptEn / promptZh / writing.situation / writing.turns[${nextTurns.length}].referenceExplanation(+aText/hint/referenceAnswer)`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
