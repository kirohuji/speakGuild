import { PrismaClient } from '@prisma/client';
import { auth } from '../src/modules/auth/auth';
import { seedThemes } from './seed-themes';
import { seedInit } from './seed-init';
import { seedLearningPackages } from './seed-learning-packages';
import { seedDailySentences } from './seed-daily-sentences';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════
// SystemConfig — 后台可配置的系统参数
// ══════════════════════════════════════════════════════════

const defaultConfigs = [
  // ── 功能开关 ──
  { key: 'registration_open',   value: 'true',                 group: 'feature', label: '开放注册',     type: 'boolean',  description: '是否允许新用户注册' },
  { key: 'feature_leaderboard', value: 'false',                group: 'feature', label: '排行榜',       type: 'boolean',  description: '启用排行榜（用户量足够时开启）' },
  { key: 'maintenance_mode',    value: 'false',                group: 'feature', label: '维护模式',     type: 'boolean',  description: '开启后非管理员将看到维护提示' },
  { key: 'maintenance_message', value: '系统维护中，请稍后再试', group: 'feature', label: '维护提示文案', type: 'textarea', description: '维护模式下的提示信息' },

  // ── 邀请与推广 ──
  { key: 'invite_trial_days',        value: '5',   group: 'growth',  label: '邀请人奖励天数',   type: 'number', description: '邀请成功后邀请人获得的会员天数' },
  { key: 'promo_trial_days',         value: '5',   group: 'growth',  label: '新人推广试用天数',   type: 'number', description: '前N名注册用户免费试用天数（需配合 promo_trial_max_claims）' },
  { key: 'promo_trial_max_claims',   value: '100', group: 'growth',  label: '试用名额上限',       type: 'number', description: '最多允许多少人领取推广试用（配合 promo_trial_days）' },
  { key: 'promo_trial_claimed_count',value: '0',   group: 'growth',  label: '已领取试用人数',     type: 'number', description: '已成功领取推广试用的人数（自动递增，勿手动修改）' },

  // ── 技术参数 ──
  { key: 'api_rate_limit',      value: '60',                   group: 'technical', label: 'API 限流（次/分钟）', type: 'number', description: '每个 IP 每分钟最大请求数' },
  { key: 'upload_max_size_mb',  value: '10',                   group: 'technical', label: '文件上传限制（MB）', type: 'number', description: '单文件最大上传大小' },
  { key: 'session_timeout_min', value: '4320',                 group: 'technical', label: '会话超时（分钟）', type: 'number', description: '用户会话过期时间（默认 3 天）' },

  // ── AI 配额 ──
  { key: 'free_ai_corrections', value: '5',                    group: 'quota',   label: '免费每日纠错次数', type: 'number', description: '免费用户每日对话判定次数上限' },
  { key: 'free_ai_summaries',   value: '1',                    group: 'quota',   label: '免费每日汇总次数', type: 'number', description: '免费用户每日汇总分析次数上限' },
];

async function seedSystemConfigs() {
  for (const cfg of defaultConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      create: cfg,
      update: cfg,
    })
  }
  console.log(`    ↳ ${defaultConfigs.length} 项系统配置`)
}

// ══════════════════════════════════════════════════════════
// 会员计划
// ══════════════════════════════════════════════════════════

async function seedMembershipPlans() {
  await prisma.membershipPlan.create({
    data: {
      name: '漫语会员', level: 'standard', price: 1900, yearlyPrice: 19800, period: 'month', durationDays: 30,
      features: [
        'AI 评价与复盘次数更多',
        '完整剧本模式',
        '更多主题化练习',
        '练习完成后的自由练习模式',
        '更多表达库收纳空间',
      ],
      sortOrder: 1, highlighted: true, revenueCatEntitlementId: 'pro_member',
    },
  })
  console.log('    ↳ 1 个会员计划')
}

// ══════════════════════════════════════════════════════════
// 用户 & 认证
// ══════════════════════════════════════════════════════════

async function seedUsers() {
  await auth.api.signUpEmail({ body: { name: 'Admin', email: 'admin@engjourney.local', password: 'admin123456' } })
  const adminUser = await prisma.user.update({
    where: { email: 'admin@engjourney.local' },
    data: { role: 'admin', outputLevel: 'L5', userLevel: 10, totalXp: 1200, learningGoals: ['留学生活', '职场交流'] },
  })

  await auth.api.signUpEmail({ body: { name: 'Test User', email: 'user@engjourney.local', password: 'user123456' } })
  const normalUser = await prisma.user.update({
    where: { email: 'user@engjourney.local' },
    data: { outputLevel: 'L2', userLevel: 3, totalXp: 350, learningGoals: ['留学生活', '日常社交', '提升英语思维'] },
  })

  // System user for file references (TTS cache, etc.)
  await prisma.user.upsert({
    where: { id: 'system' },
    create: { id: 'system', name: 'System', email: 'system@engjourney.local', emailVerified: true },
    update: {},
  })

  console.log('    ↳ 3 个用户（管理员 + 测试用户 + 系统用户）')
  return { adminUser, normalUser }
}

// ══════════════════════════════════════════════════════════
// 邀请码 & 反馈
// ══════════════════════════════════════════════════════════

async function seedExtras(adminUser: any, normalUser: any) {
  if (adminUser) {
    await prisma.referralCode.create({
      data: { userId: adminUser.id, code: 'ADMIN001', totalInvited: 0, totalReward: 0 },
    })
  }
  if (normalUser) {
    await prisma.referralCode.create({
      data: { userId: normalUser.id, code: 'USER001', totalInvited: 0, totalReward: 0 },
    })
    await prisma.feedback.create({
      data: { userId: normalUser.id, type: 'suggestion', content: '希望增加更多留学生活场景，比如银行开户、预约看病等。', status: 'pending' },
    })
    await prisma.feedback.create({
      data: { userId: normalUser.id, type: 'suggestion', content: '建议在练习模式中增加跟读评分功能。', status: 'resolved', adminNote: '感谢建议！已在规划中。' },
    })
  }
  console.log('    ↳ 2 个邀请码 + 2 条反馈')
}

// ══════════════════════════════════════════════════════════
// Main — 全量种子入口
// ══════════════════════════════════════════════════════════

async function main() {
  // 可选指定学习包：环境变量 SEED_PACKAGE 或 CLI 参数 --package <name>
  const cliIndex = process.argv.indexOf('--package')
  const targetPackage = process.env.SEED_PACKAGE?.trim()
    || (cliIndex !== -1 ? process.argv[cliIndex + 1]?.trim() : undefined)
    || undefined

  if (targetPackage) {
    // ── 追加模式：仅导入指定学习包，不动其他数据 ──
    console.log(`🎯 SEED_PACKAGE=${targetPackage} — 追加模式，仅导入指定学习包\n`)
    console.log('🌱 跳过清空 & 基础设施，直接导入学习包\n')
    await seedLearningPackages(prisma, targetPackage)
    console.log('\n🎉 Seed complete!')
    return
  }

  // ═══ 清空可重建数据（按 FK 依赖顺序） ═══
  //
  // 公共内容库（Vocabulary / Chunk / SentencePattern / DictionaryEntry）保留。
  // 学习包 seed 会通过 upsert 复用这些记录，只重建场景、话题、关卡以及关联表。
  //
  // 🎮 角色 & 地图数据（gameCharacter / gameMap / gameLocation / ...）保留，
  //    这些由后台"角色管理""地图管理"维护，seed 不再清空。
  console.log('🧹 清空旧数据...')
  await prisma.inkScript.deleteMany()
  await prisma.storyTurn.deleteMany()
  await prisma.storyRecord.deleteMany()
  await prisma.storyEpisodeChunk.deleteMany()
  await prisma.storyEpisodeVocabulary.deleteMany()
  await prisma.storyEpisodeSentencePattern.deleteMany()
  await prisma.storyEpisode.deleteMany()
  await prisma.practiceTurn.deleteMany()
  await prisma.practiceSession.deleteMany()
  await prisma.trainingTopicChunk.deleteMany()
  await prisma.trainingTopicVocab.deleteMany()
  await prisma.trainingTopicSentencePattern.deleteMany()
  await prisma.trainingTopic.deleteMany()
  await prisma.learningPackage.deleteMany()
  await prisma.userChunkProgress.deleteMany()
  await prisma.scenePrerequisite.deleteMany()
  await prisma.userSceneProgress.deleteMany()
  await prisma.scene.deleteMany()
  await prisma.sceneCategory.deleteMany()
  await prisma.themePreset.deleteMany()
  await prisma.dailySentence.deleteMany()
  await prisma.expressionItem.deleteMany()
  await prisma.userAchievementV2.deleteMany()
  await prisma.achievementDef.deleteMany()

  await prisma.userMembership.deleteMany()
  await prisma.order.deleteMany()
  await prisma.membershipPlan.deleteMany()
  await prisma.feedback.deleteMany()
  await prisma.notificationRead.deleteMany()
  await prisma.notificationTarget.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.referral.deleteMany()
  await prisma.referralCode.deleteMany()
  await prisma.dailyActivity.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.userPreference.deleteMany()
  await prisma.user.deleteMany()
  await prisma.systemConfig.deleteMany()
  console.log('  ✓ 已清空所有数据\n')

  // ══════════════════════════════════════════════════════
  // 第一阶段：系统基础设施（初始化包）
  // ══════════════════════════════════════════════════════
  console.log('🌱 第一阶段：初始化包\n')
  await seedSystemConfigs()
  console.log('  ✓ 系统配置')
  await seedMembershipPlans()
  console.log('  ✓ 会员计划')
  const { adminUser, normalUser } = await seedUsers()
  console.log('  ✓ 用户')
  await seedExtras(adminUser, normalUser)
  console.log('  ✓ 邀请码 + 反馈')
  await seedDailySentences()
  console.log('  ✓ 每日一句')
  await seedThemes(prisma)
  console.log('  ✓ 主题预设')

  // ══════════════════════════════════════════════════════
  // 第二阶段：基础设施数据（场景分类/NPC/地图/成就等）
  // ══════════════════════════════════════════════════════
  console.log('\n🌱 第二阶段：基础设施数据')
  await seedInit(prisma)

  // ══════════════════════════════════════════════════════
  // 第三阶段：学习包（已改为后台管理页面上传 ZIP 导入）
  // ══════════════════════════════════════════════════════
  // ⚠️ 以下代码已注释，改用后台 UI：
  //    http://localhost:5173/#/admin/learning-content → 上传数据包
  //    导出后修改 CSV → 再上传即可覆盖
  //   如需命令行导入单个包，仍可使用 SEED_PACKAGE 环境变量
  console.log('\n🌱 第三阶段：学习包（跳过，请通过后台管理页面上传 ZIP 导入）')
  // await seedLearningPackages(prisma, targetPackage)


  console.log('\n🎉 Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
