import { PrismaClient } from '@prisma/client';
import { auth } from '../src/modules/auth/auth';
import { seedThemes } from './seed-themes';
import { seedInit } from './seed-init';
import { seedLearningPackages } from './seed-learning-packages';
import { seedDailySentences } from './seed-daily-sentences';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════
// SystemConfig 默认值
// ══════════════════════════════════════════════════════════

const defaultConfigs = [
  { key: 'app_name',            value: '英游记',             group: 'basic', label: '应用名称',       type: 'string',   description: 'App 显示名称' },
  { key: 'app_logo_url',        value: '',                     group: 'basic', label: 'Logo URL',        type: 'string',   description: 'App Logo 图片链接' },
  { key: 'contact_email',       value: '',                     group: 'basic', label: '联系邮箱',       type: 'string',   description: '客服/联系邮箱地址' },
  { key: 'icp_number',          value: '',                     group: 'basic', label: 'ICP 备案号',     type: 'string',   description: 'ICP 备案号' },
  { key: 'registration_open',   value: 'true',                 group: 'feature', label: '开放注册',     type: 'boolean',  description: '是否允许新用户注册' },
  { key: 'maintenance_mode',    value: 'false',                group: 'feature', label: '维护模式',     type: 'boolean',  description: '开启后非管理员用户将看到维护提示' },
  { key: 'maintenance_message', value: '系统维护中，请稍后再试。', group: 'feature', label: '维护提示文案', type: 'textarea', description: '维护模式下展示的提示信息' },
  { key: 'feature_ai_practice', value: 'true',                 group: 'feature', label: 'AI 纠错',      type: 'boolean',  description: '启用/禁用 AI 口语纠错功能' },
  { key: 'feature_script_mode', value: 'true',                 group: 'feature', label: '剧本模式',     type: 'boolean',  description: '启用/禁用剧本模式' },
  { key: 'feature_explore_mode',value: 'true',                 group: 'feature', label: '探索模式',     type: 'boolean',  description: '启用/禁用探索模式' },
  { key: 'feature_leaderboard', value: 'true',                 group: 'feature', label: '排行榜',       type: 'boolean',  description: '启用/禁用排行榜功能' },
  { key: 'api_rate_limit',      value: '60',                   group: 'technical', label: 'API 限流（次/分钟）', type: 'number', description: '每个 IP 每分钟最大请求数' },
  { key: 'upload_max_size_mb',  value: '10',                   group: 'technical', label: '文件上传限制（MB）', type: 'number', description: '单文件上传最大大小（MB）' },
  { key: 'session_timeout_min', value: '4320',                 group: 'technical', label: '会话超时（分钟）', type: 'number', description: '用户会话过期时间（默认 3 天）' },
  { key: 'free_ai_corrections', value: '10',                   group: 'feature', label: '免费 AI 纠错次数', type: 'number', description: '免费用户每日 AI 纠错次数上限' },
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
      name: '标准会员', level: 'standard', price: 9800, yearlyPrice: 98000, period: 'month', durationDays: 30,
      features: ['完整练习模式', '每日 30 次 AI 纠错', '表达库', '剧本 Chapter 0', '探索模式预览'],
      sortOrder: 1, highlighted: false, revenueCatEntitlementId: 'pro_standard',
    },
  })
  await prisma.membershipPlan.create({
    data: {
      name: '进阶会员', level: 'advanced', price: 19800, yearlyPrice: 198000, period: 'month', durationDays: 30,
      features: ['所有标准功能', '无限 AI 纠错', '完整剧本模式', '探索模式全部地点', '场景准备度分析', '输出式复习', '优先客服'],
      sortOrder: 2, highlighted: true, revenueCatEntitlementId: 'pro_advanced',
    },
  })
  console.log('    ↳ 2 个会员计划')
}

// ══════════════════════════════════════════════════════════
// 优惠券
// ══════════════════════════════════════════════════════════

async function seedCoupons() {
  const coupons = [
    { code: 'NEWUSER20', type: 'percentage' as const, value: 20, minAmount: 9800, maxUses: 100, validFrom: new Date('2026-01-01'), validUntil: new Date('2027-12-31'), isActive: true },
    { code: 'WELCOME10', type: 'fixed' as const, value: 1000, maxUses: 50, validFrom: new Date(), isActive: true },
    { code: 'FREETRIAL7', type: 'free_trial' as const, value: 7, maxUses: 200, validUntil: new Date('2027-06-30'), isActive: true },
  ]
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, create: c, update: {} })
  }
  console.log('    ↳ 3 张优惠券')
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
  // ═══ 清空所有数据（按 FK 依赖顺序） ═══
  console.log('🧹 清空旧数据...')
  await prisma.explorationRecord.deleteMany()
  await prisma.gameSave.deleteMany()
  await prisma.gameLocationExit.deleteMany()
  await prisma.gameLocationNpc.deleteMany()
  await prisma.gameLocation.deleteMany()
  await prisma.gameMap.deleteMany()
  await prisma.gameCharacter.deleteMany()
  await prisma.inkScript.deleteMany()
  await prisma.scriptDialogue.deleteMany()
  await prisma.scriptRecord.deleteMany()
  await prisma.scriptEpisodeChunk.deleteMany()
  await prisma.scriptEpisodeVocab.deleteMany()
  await prisma.scriptEpisode.deleteMany()
  await prisma.practiceTurn.deleteMany()
  await prisma.practiceSession.deleteMany()
  await prisma.trainingTopicChunk.deleteMany()
  await prisma.trainingTopic.deleteMany()
  await prisma.userChunkProgress.deleteMany()
  await prisma.chunkExample.deleteMany()
  await prisma.chunk.deleteMany()
  await prisma.sceneVocabulary.deleteMany()
  await prisma.scenePrerequisite.deleteMany()
  await prisma.userSceneProgress.deleteMany()
  await prisma.scene.deleteMany()
  await prisma.sceneCategory.deleteMany()
  await prisma.themePreset.deleteMany()
  await prisma.dailySentence.deleteMany()
  await prisma.expressionItem.deleteMany()
  await prisma.userAchievementV2.deleteMany()
  await prisma.achievementDef.deleteMany()
  await prisma.onboardingStatus.deleteMany()

  // 旧表清理
  await prisma.mockExamRecord.deleteMany()
  await prisma.mockPaperQuestion.deleteMany()
  await prisma.mockPaper.deleteMany()
  await prisma.practiceRecord.deleteMany()
  await prisma.practiceProgress.deleteMany()
  await prisma.favoriteQuestion.deleteMany()
  await prisma.vocabularyWord.deleteMany()
  await prisma.questionContent.deleteMany()
  await prisma.questionItem.deleteMany()
  await prisma.questionTopic.deleteMany()
  await prisma.userBindingConfig.deleteMany()
  await prisma.userMembership.deleteMany()
  await prisma.order.deleteMany()
  await prisma.membershipPlan.deleteMany()
  await prisma.questionBank.deleteMany()
  await prisma.userAchievement.deleteMany()
  await prisma.achievement.deleteMany()
  await prisma.resourceNode.updateMany({ data: { parentId: null } })
  await prisma.resourceNode.deleteMany()

  await prisma.feedback.deleteMany()
  await prisma.referral.deleteMany()
  await prisma.referralCode.deleteMany()
  await prisma.coupon.deleteMany()
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
  await seedCoupons()
  console.log('  ✓ 优惠券')
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
  // 第三阶段：学习包（按场景分类组织的内容数据）
  // ══════════════════════════════════════════════════════
  console.log('\n🌱 第三阶段：学习包')
  await seedLearningPackages(prisma)

  console.log('\n🎉 Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
