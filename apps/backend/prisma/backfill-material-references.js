/**
 * 一次性回填脚本：
 * 1. 把「基础①~⑩」学习包按顺序加入「基础知识」组（同步 scene.groupId / scene.sortOrder）
 * 2. 从现有话题级/包级绑定回填引用表 scene_material_reference（幂等，可重复执行）
 * 3. 扫描组内跨包引用冲突并输出报告
 *
 * 运行：cd apps/backend && node prisma/backfill-material-references.js
 */
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

// 圈号 → 数字
const CIRCLED = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10 };

async function ensureGroupMembership(group) {
  if (!group) {
    console.log('⚠️ 未找到「基础知识」组，跳过入组步骤');
    return;
  }
  console.log(`\n── 步骤 1/3：把基础①~⑩ 加入组「${group.name}」 ──`);

  const scenes = await p.scene.findMany({
    where: { title: { startsWith: '基础' } },
    select: { id: true, title: true },
  });

  const members = scenes
    .map((scene) => {
      // 写作版（基础①·…（写作））是同一课的不同体验，不占组内顺序位
      if (scene.title.includes('（写作）')) return null;
      const match = /^基础([①②③④⑤⑥⑦⑧⑨⑩])·/.exec(scene.title);
      if (!match) return null;
      const order = CIRCLED[match[1]];
      if (!order || order < 1 || order > 10) return null;
      return { ...scene, order };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  if (!members.length) {
    console.log('⚠️ 没有匹配到基础①~⑩ 学习包');
    return;
  }

  console.log('将按以下顺序入组：');
  members.forEach((m) => console.log(`  ${m.order} → sortOrder ${m.order - 1}: ${m.title}`));

  await p.$transaction(async (tx) => {
    // 把组内旧条目 sortOrder 整体抬高，避免唯一约束冲突（与 assignSceneGroup 同样策略）
    await tx.$executeRawUnsafe(`UPDATE package_group_item SET "sortOrder" = "sortOrder" + 100000 WHERE "groupId" = $1`, group.id);

    for (const member of members) {
      const sortOrder = member.order - 1;
      await tx.$executeRawUnsafe(
        `INSERT INTO package_group_item ("id", "groupId", "sceneId", "sortOrder", "volumeLabel", "requiredPrevious", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NULL, false, now(), now())
         ON CONFLICT ("sceneId") DO UPDATE SET "groupId" = EXCLUDED."groupId", "sortOrder" = EXCLUDED."sortOrder"`,
        `pgi_backfill_${member.id}`, group.id, member.id, sortOrder,
      );
      // 同步顺序约束字段（层 1 事实源）
      await tx.scene.update({ where: { id: member.id }, data: { groupId: group.id, sortOrder } });
    }
  });

  console.log(`✅ 已入组 ${members.length} 个学习包`);
}

async function backfillReferences() {
  console.log(`\n── 步骤 2/3：回填引用表 scene_material_reference ──`);

  await p.$executeRawUnsafe('DELETE FROM scene_material_reference');

  const scenes = await p.scene.findMany({ select: { id: true, title: true } });
  let totalLearn = 0;
  let totalSkip = 0;

  for (const scene of scenes) {
    // 话题级绑定（按话题 sortOrder 升序，材料第一次出现记 learn，包内重复跳过）
    const topics = await p.trainingTopic.findMany({
      where: { sceneId: scene.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, sortOrder: true },
    });

    const seen = new Set();
    const rows = [];

    for (const topic of topics) {
      const [vocabs, chunks, patterns] = await Promise.all([
        p.trainingTopicVocab.findMany({ where: { topicId: topic.id }, select: { vocabId: true } }),
        p.trainingTopicChunk.findMany({ where: { topicId: topic.id }, select: { chunkId: true } }),
        p.trainingTopicSentencePattern.findMany({ where: { topicId: topic.id }, select: { patternId: true } }),
      ]);
      const push = (kind, materialId) => {
        const key = `${kind}:${materialId}`;
        if (seen.has(key)) { totalSkip += 1; return; }
        seen.add(key);
        rows.push({ sceneId: scene.id, topicId: topic.id, materialType: kind, materialId, role: 'learn' });
      };
      vocabs.forEach((v) => push('vocab', v.vocabId));
      chunks.forEach((c) => push('chunk', c.chunkId));
      patterns.forEach((pt) => push('pattern', pt.patternId));
    }

    // 包级绑定（topicId = null）
    const [sv, sc, sp] = await Promise.all([
      p.sceneVocabulary.findMany({ where: { sceneId: scene.id }, select: { vocabularyId: true } }),
      p.sceneChunk.findMany({ where: { sceneId: scene.id }, select: { chunkId: true } }),
      p.sceneSentencePattern.findMany({ where: { sceneId: scene.id }, select: { patternId: true } }),
    ]);
    const pushPack = (kind, materialId) => {
      const key = `${kind}:${materialId}`;
      if (seen.has(key)) { totalSkip += 1; return; }
      seen.add(key);
      rows.push({ sceneId: scene.id, topicId: null, materialType: kind, materialId, role: 'learn' });
    };
    sv.forEach((v) => pushPack('vocab', v.vocabularyId));
    sc.forEach((c) => pushPack('chunk', c.chunkId));
    sp.forEach((pt) => pushPack('pattern', pt.patternId));

    if (rows.length) {
      await p.sceneMaterialReference.createMany({ data: rows, skipDuplicates: true });
      totalLearn += rows.length;
    }
    console.log(`  ${scene.title}: ${rows.length} 条 learn（话题 ${topics.length} 个）`);
  }

  console.log(`✅ 引用表回填完成：共 ${totalLearn} 条 learn（包内重复跳过 ${totalSkip} 条）`);
}

async function scanGroupConflicts() {
  console.log(`\n── 步骤 3/3：扫描组内跨包引用冲突 ──`);

  const groups = await p.packageGroup.findMany({ select: { id: true, name: true } });
  for (const group of groups) {
    const scenes = await p.scene.findMany({
      where: { groupId: group.id },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, title: true, sortOrder: true,
        materialReferences: { select: { materialType: true, materialId: true, role: true } },
      },
    });
    if (!scenes.length) {
      console.log(`组「${group.name}」暂无成员`);
      continue;
    }

    console.log(`\n组「${group.name}」成员：${scenes.map((s) => `#${s.sortOrder + 1} ${s.title}`).join(' → ')}`);

    const used = new Map(); // key → 前序包
    let conflictTotal = 0;
    for (const scene of scenes) {
      const learnClaims = scene.materialReferences.filter((ref) => ref.role === 'learn');
      const hits = [];
      for (const claim of learnClaims) {
        const source = used.get(`${claim.materialType}:${claim.materialId}`);
        if (source) hits.push({ ...claim, source });
      }
      if (hits.length) {
        // 解析材料文本
        const texts = await resolveTexts(hits);
        conflictTotal += hits.length;
        console.log(`\n  ⚠️ ${scene.title}（#${scene.sortOrder + 1}）有 ${hits.length} 处重复认领：`);
        for (const hit of hits) {
          const text = texts.get(`${hit.materialType}:${hit.materialId}`) ?? hit.materialId;
          const kindLabel = hit.materialType === 'vocab' ? '单词' : hit.materialType === 'chunk' ? '句块' : '句型';
          console.log(`     - ${kindLabel}「${text}」 已在「${hit.source.title}」（#${hit.source.sortOrder + 1}）认领`);
        }
      }
      for (const ref of scene.materialReferences) {
        const key = `${ref.materialType}:${ref.materialId}`;
        if (!used.has(key)) used.set(key, { title: scene.title, sortOrder: scene.sortOrder });
      }
    }
    console.log(conflictTotal ? `\n  📊 组内共 ${conflictTotal} 处重复认领` : '\n  ✅ 组内无跨包重复认领');
  }
}

/** 后包重复认领自动降级为 review（复习复用）：后包不重复学习前包知识点 */
async function demoteDuplicateClaims() {
  console.log(`\n── 步骤 4/4：把组内后包重复认领降级为 review ──`);

  const groups = await p.packageGroup.findMany({ select: { id: true, name: true } });
  let demoted = 0;
  for (const group of groups) {
    const scenes = await p.scene.findMany({
      where: { groupId: group.id },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, title: true, sortOrder: true,
        materialReferences: { select: { id: true, materialType: true, materialId: true, role: true } },
      },
    });
    const used = new Set();
    for (const scene of scenes) {
      const toDemote = [];
      for (const ref of scene.materialReferences) {
        const key = `${ref.materialType}:${ref.materialId}`;
        if (used.has(key)) {
          if (ref.role === 'learn') toDemote.push(ref.id);
        } else {
          used.add(key);
        }
      }
      if (toDemote.length) {
        await p.sceneMaterialReference.updateMany({ where: { id: { in: toDemote } }, data: { role: 'review' } });
        demoted += toDemote.length;
        console.log(`  ${scene.title}: 降级 ${toDemote.length} 条（learn → review）`);
      }
    }
  }
  console.log(demoted ? `✅ 共降级 ${demoted} 条重复认领为 review` : '✅ 无重复需要降级');
}

async function resolveTexts(claims) {
  const result = new Map();
  const ids = (kind) => claims.filter((c) => c.materialType === kind).map((c) => c.materialId);
  const v = ids('vocab');
  const c = ids('chunk');
  const pt = ids('pattern');
  const [vocabs, chunks, patterns] = await Promise.all([
    v.length ? p.vocabulary.findMany({ where: { id: { in: v } }, select: { id: true, word: true } }) : [],
    c.length ? p.chunk.findMany({ where: { id: { in: c } }, select: { id: true, text: true } }) : [],
    pt.length ? p.sentencePattern.findMany({ where: { id: { in: pt } }, select: { id: true, pattern: true } }) : [],
  ]);
  vocabs.forEach((row) => result.set(`vocab:${row.id}`, row.word));
  chunks.forEach((row) => result.set(`chunk:${row.id}`, row.text));
  patterns.forEach((row) => result.set(`pattern:${row.id}`, row.pattern));
  return result;
}

async function main() {
  const group = await p.packageGroup.findFirst({ where: { slug: 'basic-knowledge' } });
  await ensureGroupMembership(group);
  await backfillReferences();
  await demoteDuplicateClaims();
  await scanGroupConflicts();
}

main()
  .catch((error) => { console.error('执行失败：', error); process.exitCode = 1; })
  .finally(() => p.$disconnect());
