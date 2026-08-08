/* 一次性数据修复：统一基础系列学习包的分类与命名
 * 1. 备份 scene_category / scene 表
 * 2. 所有 foundation 场景合并到「基础入门」分类
 * 3. 标题统一为「基础N·主题」格式
 * 4. 3 个 daily 场景迁到新分类「日常拓展」
 * 5. 删除全部空分类
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const FOUNDATION_CATEGORY_NAME = '基础入门';
const DAILY_EXTRA_CATEGORY_NAME = '日常拓展';

// 场景标题统一映射（key = sceneId）
const titleMap: Record<string, string> = {
  cmsb87zv7001gsbncthe65yu7: '基础①·寒暄与基本信息',
  cmsda23ph0009sbfqrxqhyi09: '基础①·寒暄与基本信息（写作）',
  cmse4lbgp000w15road8ernpc: '基础②·喜好与选择',
  cmsh8mjq6000a1508j6ia5mko: '基础③·认识同事与团队',
  cmsizqr7e001413fk7enlwprm: '基础④·动作、状态与整理',
  cmsj06i6a000d13vd59hj4k5e: '基础⑤·频率与现在进行时',
  cmsj153vr01on13vd95kuyayj: '基础⑥·过去的状态',
  cmsj15n6u04m113vdk0wg2g3p: '基础⑦·计划与预测',
  cmsj166io06rk13vdf82ta7n8: '基础⑧·并列与转折',
  cmsjjbpfc00m7sbfwlx730wd3: '基础⑨·比较事物',
  cmsjjn6wp000esbytr6b2yage: '基础⑩·表达想法',
};

async function main() {
  // ── 1. 备份 ──
  const [categoriesBackup, scenesBackup] = await Promise.all([
    prisma.sceneCategory.findMany(),
    prisma.scene.findMany(),
  ]);
  const backupDir = path.join(__dirname, 'backup');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(backupDir, `scene-categories-${stamp}.json`), JSON.stringify(categoriesBackup, null, 2));
  fs.writeFileSync(path.join(backupDir, `scenes-${stamp}.json`), JSON.stringify(scenesBackup, null, 2));
  console.log(`✅ 已备份 ${categoriesBackup.length} 个分类、${scenesBackup.length} 个场景 → prisma/scripts/backup/`);

  await prisma.$transaction(async (tx) => {
    // ── 2. 分类准备 ──
    const foundationCat = await tx.sceneCategory.findFirstOrThrow({
      where: { name: FOUNDATION_CATEGORY_NAME },
    });
    let dailyExtraCat = await tx.sceneCategory.findFirst({
      where: { name: DAILY_EXTRA_CATEGORY_NAME },
    });
    if (!dailyExtraCat) {
      dailyExtraCat = await tx.sceneCategory.create({
        data: { name: DAILY_EXTRA_CATEGORY_NAME, icon: 'BookOpen', sortOrder: 2 },
      });
      console.log(`✅ 创建分类「${DAILY_EXTRA_CATEGORY_NAME}」`);
    }
    await tx.sceneCategory.update({
      where: { id: foundationCat.id },
      data: { sortOrder: 1 },
    });

    // ── 3. foundation 场景迁移 + 改标题 ──
    const foundationScenes = await tx.scene.findMany({
      where: { packageType: 'foundation' },
    });
    for (const scene of foundationScenes) {
      const newTitle = titleMap[scene.id];
      if (!newTitle) {
        console.warn(`  ⚠️ 无标题映射，跳过: ${scene.title} (${scene.id})`);
        continue;
      }
      await tx.scene.update({
        where: { id: scene.id },
        data: { categoryId: foundationCat.id, title: newTitle },
      });
      console.log(`  → 迁移+改名: ${scene.title} → 「${newTitle}」`);
    }

    // ── 4. 非基础 daily 场景迁到「日常拓展」 ──
    // 原挂在「基础①」分类下的 3 个日常场景（不属于基础系列）
    const dailyExtraSceneIds = [
      'cmse1kffr000z15hc7namyuh7', // 文章阅读
      'cmse4qygd02qx15rogodbzq5p', // 练习听力
      'cmse4w65s000915tsn36ti44j', // 小说包
    ];
    const dailyExtraScenes = await tx.scene.findMany({
      where: { id: { in: dailyExtraSceneIds } },
    });
    for (const scene of dailyExtraScenes) {
      await tx.scene.update({
        where: { id: scene.id },
        data: { categoryId: dailyExtraCat.id },
      });
      console.log(`  → 迁移到「${DAILY_EXTRA_CATEGORY_NAME}」: ${scene.title}`);
    }

    // ── 5. 删除空分类（保留有场景的） ──
    const allCategories = await tx.sceneCategory.findMany({
      include: { _count: { select: { scenes: true } } },
    });
    const keepIds = new Set<string>([foundationCat.id, dailyExtraCat.id]);
    let deleted = 0;
    for (const cat of allCategories) {
      if (keepIds.has(cat.id)) continue;
      if (cat._count.scenes > 0) {
        console.log(`  ⏭ 保留（有 ${cat._count.scenes} 个场景）: ${cat.name}`);
        continue;
      }
      await tx.sceneCategory.delete({ where: { id: cat.id } });
      deleted++;
      console.log(`  🗑 删除空分类: ${cat.name}`);
    }
    console.log(`✅ 共删除 ${deleted} 个空分类`);
  });

  // ── 6. 结果校验 ──
  const verify = await prisma.sceneCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { scenes: true } } },
  });
  console.log('\n=== 修复后分类 ===');
  verify.forEach((c) => console.log(`${c.name} (sort=${c.sortOrder}) scenes=${c._count.scenes}`));
  const foundationScenes = await prisma.scene.findMany({
    where: { packageType: 'foundation' },
    orderBy: { title: 'asc' },
    include: { category: true },
  });
  console.log('\n=== 修复后基础系列场景 ===');
  foundationScenes.forEach((s) => console.log(`${s.category.name} | ${s.title} | ${s.contentMode}`));
}

main()
  .catch((e) => {
    console.error('❌ 执行失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
