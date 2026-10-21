/**
 * 从零重建学习商店标签（不改 schema）。
 *
 * 一级类型（保留 packageType 枚举、重定义商店显示语义）：
 * foundation = 英语基础（L1–L2）
 * daily      = 生活表达（L2）
 * course     = 写作与翻译（L2–L4）
 * exam       = 学术与考试（L3+）
 * story      = 故事沉浸（L2+）
 *
 * 二级主题：SceneCategory；所属系列：PackageGroup。
 * 运行：cd apps/backend && npx ts-node prisma/refresh-store-taxonomy.ts
 */
import { PrismaClient, type ContentMode, type LearningPackageType } from '@prisma/client'

const prisma = new PrismaClient()

type Series = { slug: string; name: string; description: string; contentMode: ContentMode; status: 'draft' | 'published' }
type Placement = { title: string; primary: LearningPackageType; topic?: string; series?: string; order?: number; label?: string; level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' }

const SERIES: Series[] = [
  { slug: 'build-your-first-sentences', name: '从词到句', description: '由高频动词、基础句式到介词和搭配，建立可直接使用的英语底座。', contentMode: 'practice', status: 'draft' },
  { slug: 'real-life-communication', name: '真实沟通', description: '把短消息和自然对话放回真实的人际沟通场景。', contentMode: 'writing', status: 'draft' },
  { slug: 'telling-your-story', name: '我的故事', description: '从一个经历到一次转折，练习把个人故事说清楚、写完整。', contentMode: 'writing', status: 'draft' },
  { slug: 'life-topic-writing', name: '生活写作', description: '围绕住处、工作、城市、兴趣与选择，写出具体连贯的个人表达。', contentMode: 'writing', status: 'draft' },
  { slug: 'bilingual-writing-lab', name: '双向成文', description: '把中文思路写成自然英文，也把英文准确重述为自然中文。', contentMode: 'writing', status: 'draft' },
  { slug: 'reason-and-evidence', name: '理由证据', description: '围绕有分歧的话题建立立场、理由和论证。', contentMode: 'writing', status: 'draft' },
  { slug: 'topic-reading', name: '主题阅读', description: '通过生活、社会和科学主题提升理解、判断与信息整合能力。', contentMode: 'reading', status: 'published' },
  { slug: 'culture-stories', name: '文化故事', description: '从文化与人物故事进入更有沉浸感的英语内容。', contentMode: 'practice', status: 'draft' },
]

const PLACEMENTS: Placement[] = [
  { title: '常用动词300个:高频核心', primary: 'foundation', topic: '高频动词', series: 'build-your-first-sentences', order: 0, label: '高频动词', level: 'L1' },
  { title: '不规则动词专区', primary: 'foundation', topic: '高频动词', series: 'build-your-first-sentences', order: 1, label: '动词变化', level: 'L1' },
  { title: '英语常用句式', primary: 'foundation', topic: '核心语法', series: 'build-your-first-sentences', order: 2, label: '基础句式', level: 'L1' },
  { title: '介词活用：位置、时间与关系', primary: 'foundation', topic: '核心语法', series: 'build-your-first-sentences', order: 3, label: '介词关系', level: 'L2' },
  { title: '固定搭配：动词与介词', primary: 'foundation', topic: '核心语法', series: 'build-your-first-sentences', order: 4, label: '固定搭配', level: 'L2' },
  { title: '语法和用法', primary: 'foundation', topic: '核心语法', series: 'build-your-first-sentences', order: 5, label: '综合用法', level: 'L2' },

  { title: '日常简讯写作', primary: 'daily', topic: '即时沟通', series: 'real-life-communication', order: 0, label: '短消息', level: 'L2' },
  { title: '英语对话：自然开场与接话', primary: 'daily', topic: '即时沟通', series: 'real-life-communication', order: 1, label: '自然对话', level: 'L2' },
  { title: '我的故事：经历与转折', primary: 'daily', topic: '个人叙事', series: 'telling-your-story', order: 0, label: '经历转折', level: 'L2' },

  { title: '生活主题 1：住处与家乡', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 0, label: '住处家乡', level: 'L2' },
  { title: '生活主题 2：学习与工作', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 1, label: '学习工作', level: 'L2' },
  { title: '生活主题 3：出行与城市', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 2, label: '出行城市', level: 'L2' },
  { title: '生活主题 4：物品与数字习惯', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 3, label: '数字习惯', level: 'L2' },
  { title: '生活主题 5：社交与生活节奏', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 4, label: '社交节奏', level: 'L2' },
  { title: '生活主题 6：兴趣与休闲', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 5, label: '兴趣休闲', level: 'L2' },
  { title: '生活主题 7：人物、物品与兴趣', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 6, label: '细节描述', level: 'L3' },
  { title: '生活主题 8：经历、地点与事件', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 7, label: '经历事件', level: 'L3' },
  { title: '生活主题 9：变化、选择与世界', primary: 'course', topic: '主题写作', series: 'life-topic-writing', order: 8, label: '变化选择', level: 'L3' },
  { title: '中文翻译题集', primary: 'course', topic: '中英互译', series: 'bilingual-writing-lab', order: 0, label: '中译英', level: 'L2' },
  { title: '英文翻译题集', primary: 'course', topic: '中英互译', series: 'bilingual-writing-lab', order: 1, label: '英译中', level: 'L2' },

  { title: '看法与理由：十个重要话题', primary: 'exam', topic: '论证写作', series: 'reason-and-evidence', order: 0, label: '立场论证', level: 'L3' },
  { title: '生活、教育与身心健康', primary: 'exam', topic: '主题阅读', series: 'topic-reading', order: 0, label: '生活教育', level: 'L3' },
  { title: '科学、自然与技术探索', primary: 'exam', topic: '主题阅读', series: 'topic-reading', order: 1, label: '科技自然', level: 'L3' },
  { title: '社会、商业、文化与媒介', primary: 'exam', topic: '主题阅读', series: 'topic-reading', order: 2, label: '社会媒介', level: 'L3' },

  { title: '漫语町', primary: 'story', topic: '文化故事', series: 'culture-stories', order: 0, label: '文化探索', level: 'L2' },
  // 保留内部测试资产，但不挂用户可见主题或系列。
  { title: '[TEST] 全题型｜剧情包：雨天的车站', primary: 'story', level: 'L1' },
]

async function main() {
  const scenes = await prisma.scene.findMany({ select: { id: true, title: true } })
  const byTitle = new Map(scenes.map((scene) => [scene.title, scene]))
  if (scenes.length !== PLACEMENTS.length) throw new Error(`安全停止：当前 ${scenes.length} 个学习包，映射表 ${PLACEMENTS.length} 个。`)
  for (const item of PLACEMENTS) if (!byTitle.has(item.title)) throw new Error(`找不到学习包：${item.title}`)

  // 先解除外键，再删除全部旧二级主题和旧系列。
  await prisma.$transaction([
    prisma.packageGroupItem.deleteMany(),
    prisma.scene.updateMany({ data: { categoryId: null, groupId: null, sortOrder: 0 } }),
  ])
  await prisma.sceneCategory.deleteMany()
  await prisma.packageGroup.deleteMany()

  const topicNames = [...new Set(PLACEMENTS.map((item) => item.topic).filter((item): item is string => Boolean(item)))]
  const topics = new Map<string, string>()
  for (const [index, name] of topicNames.entries()) {
    const category = await prisma.sceneCategory.create({ data: { name, sortOrder: index } })
    topics.set(name, category.id)
  }
  const series = new Map<string, string>()
  for (const item of SERIES) {
    const group = await prisma.packageGroup.create({ data: item })
    series.set(item.slug, group.id)
  }

  for (const item of PLACEMENTS) {
    const scene = byTitle.get(item.title)!
    await prisma.scene.update({ where: { id: scene.id }, data: { packageType: item.primary, categoryId: item.topic ? topics.get(item.topic)! : null, groupId: item.series ? series.get(item.series)! : null, sortOrder: item.order ?? 0, requiredOutputLevel: item.level } })
    if (item.series) await prisma.packageGroupItem.create({ data: { groupId: series.get(item.series)!, sceneId: scene.id, sortOrder: item.order ?? 0, volumeLabel: item.label, requiredPrevious: false } })
  }
  const report = await prisma.scene.groupBy({ by: ['packageType', 'requiredOutputLevel'], _count: { _all: true }, orderBy: [{ packageType: 'asc' }, { requiredOutputLevel: 'asc' }] })
  console.table(report.map((row) => ({ primary: row.packageType, level: row.requiredOutputLevel, packages: row._count._all })))
  console.log(`重建完成：清除旧标签后，建立 ${topicNames.length} 个二级主题、${SERIES.length} 个所属系列，映射 ${PLACEMENTS.length} 个学习包。`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
