/**
 * 在数据库 TrainingTopic.teachingMarkdown 与 apps/docs-md 之间同步教学文档。
 *
 *   pnpm docs:export              数据库 -> Markdown（会覆盖清单内的本地文件）
 *   pnpm docs:sync               Markdown -> 数据库
 *   pnpm docs:sync -- --dry-run  只预览，不写数据库
 */
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { loadEnvFile } from 'process'
import { dirname, isAbsolute, relative, resolve, sep } from 'path'
import { PrismaClient } from '@prisma/client'

const REPO_ROOT = resolve(__dirname, '../../..')
const DOCS_ROOT = resolve(REPO_ROOT, 'apps', 'docs-md')
const MANIFEST_PATH = resolve(DOCS_ROOT, '.teaching-docs.json')
const ENV_PATH = resolve(REPO_ROOT, '.env')

const CONTENT_MODE_DIRS = {
  practice: '学习包',
  listening: '听力包',
  reading: '阅读包',
  writing: '写作包',
} as const

type SupportedContentMode = keyof typeof CONTENT_MODE_DIRS

type ManifestDocument = {
  topicId: string
  sceneId: string
  contentMode: SupportedContentMode
  packageTitle: string
  topicTitle: string
  path: string
  exportedSha256: string
}

type Manifest = {
  version: 1
  generatedAt: string
  documents: ManifestDocument[]
}

function loadRootEnv() {
  if (!process.env.DATABASE_URL && existsSync(ENV_PATH)) loadEnvFile(ENV_PATH)
  if (!process.env.DATABASE_URL) {
    throw new Error(`缺少 DATABASE_URL。请在 ${ENV_PATH} 中配置，或在命令行环境中传入。`)
  }
}

function sha256(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function safePathSegment(value: string, fallback: string) {
  const cleaned = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  const usable = cleaned || fallback
  const shortened = usable.slice(0, 120).replace(/[. ]+$/g, '') || fallback
  return reserved.test(shortened) ? `${shortened}_` : shortened
}

function toManifestPath(absolutePath: string) {
  return relative(DOCS_ROOT, absolutePath).split(sep).join('/')
}

function resolveManifestPath(manifestPath: string) {
  const absolutePath = resolve(DOCS_ROOT, ...manifestPath.split('/'))
  const relativePath = relative(DOCS_ROOT, absolutePath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`清单包含 docs-md 目录之外的路径：${manifestPath}`)
  }
  return absolutePath
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`找不到 ${MANIFEST_PATH}，请先运行 pnpm docs:export。`)
  }
  const value = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Partial<Manifest>
  if (value.version !== 1 || !Array.isArray(value.documents)) {
    throw new Error('教学文档清单格式无效，请重新运行 pnpm docs:export。')
  }
  return value as Manifest
}

function uniqueDocumentPath(
  usedPaths: Set<string>,
  mode: SupportedContentMode,
  packageTitle: string,
  topicTitle: string,
  topicId: string,
) {
  const directory = resolve(
    DOCS_ROOT,
    CONTENT_MODE_DIRS[mode],
    safePathSegment(packageTitle, `未命名学习包-${topicId.slice(-6)}`),
  )
  const baseName = safePathSegment(topicTitle, `未命名话题-${topicId.slice(-6)}`)
  let absolutePath = resolve(directory, `${baseName}.md`)
  let key = absolutePath.toLocaleLowerCase('en-US')
  if (usedPaths.has(key)) {
    absolutePath = resolve(directory, `${baseName}-${topicId.slice(-6)}.md`)
    key = absolutePath.toLocaleLowerCase('en-US')
  }
  usedPaths.add(key)
  return absolutePath
}

async function exportDocuments(prisma: PrismaClient) {
  const topics = await prisma.trainingTopic.findMany({
    where: { scene: { contentMode: { in: Object.keys(CONTENT_MODE_DIRS) as SupportedContentMode[] } } },
    select: {
      id: true,
      title: true,
      teachingMarkdown: true,
      scene: { select: { id: true, title: true, contentMode: true, sortOrder: true } },
    },
    orderBy: [{ scene: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const usedPaths = new Set<string>()
  const documents: ManifestDocument[] = []
  for (const topic of topics) {
    const mode = topic.scene.contentMode as SupportedContentMode
    const absolutePath = uniqueDocumentPath(usedPaths, mode, topic.scene.title, topic.title, topic.id)
    const content = topic.teachingMarkdown ?? ''
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, content, 'utf8')
    documents.push({
      topicId: topic.id,
      sceneId: topic.scene.id,
      contentMode: mode,
      packageTitle: topic.scene.title,
      topicTitle: topic.title,
      path: toManifestPath(absolutePath),
      exportedSha256: sha256(content),
    })
  }

  const manifest: Manifest = { version: 1, generatedAt: new Date().toISOString(), documents }
  mkdirSync(DOCS_ROOT, { recursive: true })
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const nonEmpty = topics.filter((topic) => Boolean(topic.teachingMarkdown?.trim())).length
  console.log(`已导出 ${documents.length} 份教学文档（${nonEmpty} 份有内容，${documents.length - nonEmpty} 份为空）。`)
  console.log(`目录：${DOCS_ROOT}`)
}

async function syncDocuments(prisma: PrismaClient, dryRun: boolean) {
  const manifest = readManifest()
  const missing: string[] = []
  const changed: Array<ManifestDocument & { content: string }> = []
  const databaseChanged: string[] = []
  const conflicts: string[] = []
  let unchanged = 0

  const databaseTopics = await prisma.trainingTopic.findMany({
    where: { id: { in: manifest.documents.map((document) => document.topicId) } },
    select: { id: true, sceneId: true, teachingMarkdown: true },
  })
  const topicById = new Map(databaseTopics.map((topic) => [topic.id, topic]))

  for (const document of manifest.documents) {
    const absolutePath = resolveManifestPath(document.path)
    if (!existsSync(absolutePath)) {
      missing.push(document.path)
      continue
    }
    const topic = topicById.get(document.topicId)
    if (!topic) throw new Error(`数据库中找不到话题 ${document.topicId}（${document.path}）。请重新导出清单。`)
    if (topic.sceneId !== document.sceneId) {
      throw new Error(`话题所属学习包已变化：${document.path}。请重新运行 pnpm docs:export。`)
    }
    const content = readFileSync(absolutePath, 'utf8')
    const databaseContent = topic.teachingMarkdown ?? ''
    const localHash = sha256(content)
    const databaseHash = sha256(databaseContent)
    if (localHash === databaseHash) {
      unchanged++
    } else if (localHash === document.exportedSha256) {
      databaseChanged.push(document.path)
    } else if (databaseHash !== document.exportedSha256) {
      conflicts.push(document.path)
    } else {
      changed.push({ ...document, content })
    }
  }

  if (missing.length) {
    console.warn(`跳过 ${missing.length} 个已从本地删除的文件（不会清空数据库）：`)
    missing.forEach((path) => console.warn(`  - ${path}`))
  }

  if (databaseChanged.length) {
    console.warn(`跳过 ${databaseChanged.length} 份仅数据库有新改动的文档，请先重新导出后再编辑：`)
    databaseChanged.forEach((path) => console.warn(`  - ${path}`))
  }

  if (conflicts.length) {
    console.error(`发现 ${conflicts.length} 份本地和数据库都已修改的冲突文档：`)
    conflicts.forEach((path) => console.error(`  - ${path}`))
    throw new Error('同步已取消，数据库未写入。请先备份本地改动并重新导出，再合并冲突内容。')
  }

  if (dryRun) {
    console.log(`预览：将更新 ${changed.length} 份，未变化 ${unchanged} 份，仅数据库变化 ${databaseChanged.length} 份，缺失 ${missing.length} 份。`)
    changed.forEach((document) => console.log(`  - ${document.path}`))
    return
  }

  if (changed.length) {
    console.log(`即将更新 ${changed.length} 份教学文档：`)
    changed.forEach((document) => console.log(`  - ${document.path}`))
    await prisma.$transaction(
      changed.map((document) => prisma.trainingTopic.update({
        where: { id: document.topicId },
        data: { teachingMarkdown: document.content },
      })),
    )
    const changedById = new Map(changed.map((document) => [document.topicId, sha256(document.content)]))
    manifest.documents = manifest.documents.map((document) => ({
      ...document,
      exportedSha256: changedById.get(document.topicId) ?? document.exportedSha256,
    }))
    manifest.generatedAt = new Date().toISOString()
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }
  console.log(`同步完成：更新 ${changed.length} 份，未变化 ${unchanged} 份，仅数据库变化并跳过 ${databaseChanged.length} 份，缺失并跳过 ${missing.length} 份。`)
}

async function main() {
  const command = process.argv.slice(2).find((argument) => argument === 'export' || argument === 'sync')
  const dryRun = process.argv.includes('--dry-run')
  if (!command) throw new Error('用法：sync-teaching-docs.ts <export|sync> [--dry-run]')
  if (command === 'export' && dryRun) throw new Error('export 命令不支持 --dry-run。')

  loadRootEnv()
  const prisma = new PrismaClient()
  try {
    if (command === 'export') await exportDocuments(prisma)
    else await syncDocuments(prisma, dryRun)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
