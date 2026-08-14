// 验证 irregular-verbs-mastery 在数据库中为单一学习包
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const cat = await p.sceneCategory.findFirst({ where: { name: '基础口语' } })
  if (!cat) { console.log('❌ 无基础口语分类'); return }
  const scenes = await p.scene.findMany({ where: { categoryId: cat.id } })
  console.log('基础口语下场景数:', scenes.length)

  for (const s of scenes) {
    const lpCount = await p.learningPackage.count({ where: { sceneId: s.id } })
    const lps = await p.learningPackage.findMany({ where: { sceneId: s.id } })
    const topics = await p.trainingTopic.findMany({ where: { sceneId: s.id }, orderBy: { sortOrder: 'asc' } })
    console.log('场景:', s.title, '| packageType:', s.packageType, '| 学习包记录数:', lpCount, '| type:', lps.map(x => x.type).join(','))
    console.log('  话题(' + topics.length + '):', topics.map(t => t.title).join(' / '))
    let tc = 0, tp = 0, tv = 0
    for (const t of topics) {
      tc += await p.trainingTopicChunk.count({ where: { topicId: t.id } })
      tp += await p.trainingTopicSentencePattern.count({ where: { topicId: t.id } })
      tv += await p.trainingTopicVocab.count({ where: { topicId: t.id } })
    }
    console.log('  句块关联合计:', tc, '| 句型关联合计:', tp, '| 词汇关联合计:', tv)
  }

  const all = await p.trainingTopic.findMany({ select: { title: true } })
  const dup = all.filter((t, i) => all.findIndex(x => x.title === t.title) !== i).map(x => x.title)
  console.log('重复话题标题:', [...new Set(dup)].join(', ') || '无')
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) }).finally(() => p.$disconnect())
