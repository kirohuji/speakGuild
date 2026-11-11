/**
 * 临时预览数据：为每种通知详情变体插入样例通知。
 * 用法：pnpm exec node scripts/seed-notification-preview.mjs [userId?]
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SAMPLES = [
  {
    key: 'campaign',
    title: '春季学习节来啦',
    type: 'broadcast',
    isSpecial: true,
    imageUrl: 'https://picsum.photos/seed/manyu-campaign/800/560',
    content: [
      '这周把**剧本**和**场景练习**打包做成限时体验。',
      '',
      '- 新剧本入口更好找',
      '- 完成练习有额外积分彩蛋',
      '',
      '打开首页就能看到活动贴图，点进去开练。',
    ].join('\n'),
  },
  {
    key: 'broadcast',
    title: '漫语町小更新说明',
    type: 'broadcast',
    isSpecial: false,
    imageUrl: null,
    content: [
      '这次最想让你先试的是**剧本功能**：选角色开口演，练真实对话节奏。',
      '',
      '- 台词跟着剧情走',
      '- 演完可回看卡壳处',
      '',
      '去应用商店 update 一下就能开演。',
    ].join('\n'),
  },
  {
    key: 'direct',
    title: '给你留了个学习提醒',
    type: 'targeted',
    isSpecial: false,
    imageUrl: null,
    content: [
      '今天的知识点练习还差一点点就完成了。',
      '',
      '有空就回来收个尾，保持手感最重要。',
    ].join('\n'),
  },
  {
    key: 'membership',
    title: '新人会员已到账',
    type: 'targeted',
    isSpecial: false,
    imageUrl: null,
    content: '欢迎来到漫语町！系统已为你赠送 7 天漫语会员，可直接体验完整练习权益。',
  },
  {
    key: 'membership-invite',
    title: '邀请奖励已到账',
    type: 'targeted',
    isSpecial: false,
    imageUrl: null,
    content: '你邀请的好友已完成注册，系统已为你延长 5 天漫语会员。',
  },
  {
    key: 'feedback',
    title: '您的反馈已收到回复',
    type: 'targeted',
    isSpecial: false,
    imageUrl: null,
    content: [
      '> 剧本广场点赞后列表偶尔不刷新',
      '',
      '---',
      '',
      '已定位并修复。下次更新后点赞会即时同步，感谢反馈！',
    ].join('\n'),
  },
  {
    key: 'success',
    title: '知识点练习已生成：咖啡店点单',
    type: 'targeted',
    isSpecial: false,
    imageUrl: null,
    content: [
      '已为「街角咖啡店 / 咖啡店点单」补齐 6 个练习题组，点击可直接检查结果。',
      '',
      '[打开对应话题](/admin/learning-content)',
    ].join('\n'),
  },
  {
    key: 'success-batch',
    title: '学习包内容批量生成完成：机场出行',
    type: 'targeted',
    isSpecial: false,
    imageUrl: null,
    content: [
      '共处理 8 个话题：教学文档生成 6 篇，知识点训练生成 8 组。',
      '',
      '[打开对应话题](/admin/learning-content)',
    ].join('\n'),
  },
  {
    key: 'maintenance',
    title: '系统维护通知',
    type: 'broadcast',
    isSpecial: false,
    imageUrl: null,
    content: [
      '本周六 **02:00-04:00** 进行短时维护，期间练习提交可能短暂不可用。',
      '',
      '预计准时恢复，给学习节奏带来的打扰先说声抱歉。',
    ].join('\n'),
  },
]

async function main() {
  const argUserId = process.argv[2]
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true },
  })
  const fallbackUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true },
  })
  const sender = admin ?? fallbackUser
  if (!sender) throw new Error('数据库里没有用户，无法插入通知')

  const target =
    (argUserId
      ? await prisma.user.findUnique({
          where: { id: argUserId },
          select: { id: true, name: true, email: true, role: true },
        })
      : null) ?? sender

  if (!target) throw new Error(`找不到目标用户: ${argUserId}`)

  console.log(`发送者: ${sender.name || sender.email} (${sender.id})`)
  console.log(`接收者: ${target.name || target.email} (${target.id})`)

  let created = 0
  for (const sample of SAMPLES) {
    const notification = await prisma.notification.create({
      data: {
        title: `[预览·${sample.key}] ${sample.title}`,
        content: sample.content,
        type: sample.type,
        isSpecial: sample.isSpecial,
        imageUrl: sample.imageUrl,
        sentById: sender.id,
        ...(sample.type === 'targeted'
          ? { targets: { create: { userId: target.id } } }
          : {}),
      },
    })
    created += 1
    console.log(`✓ ${notification.id}  ${notification.title}`)
  }

  console.log(`\n完成：插入 ${created} 条预览通知。刷新通知中心即可查看。`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
