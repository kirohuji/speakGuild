import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type MaterialKind = 'vocab' | 'chunk' | 'pattern';

export interface MaterialClaim {
  kind: MaterialKind;
  materialId: string;
  role: 'learn' | 'review';
  topicId: string | null;
  topicTitle?: string | null;
}

export interface GroupSceneInfo {
  sceneId: string;
  title: string;
  sortOrder: number;
  claims: MaterialClaim[];
}

export interface GroupContext {
  /** 本包所属组；null = 未入组（无组内顺序约束，只做包内话题约束） */
  groupId: string | null;
  groupName: string | null;
  /** 本包在组内顺序（从 0 开始） */
  sortOrder: number;
  /** 组内前序包（sortOrder < 本包），含其全部认领（learn + review） */
  earlierScenes: GroupSceneInfo[];
  /** 组内后序包（sortOrder > 本包），含其新学认领（learn） */
  laterScenes: GroupSceneInfo[];
}

export interface ClaimConflict {
  kind: MaterialKind;
  materialId: string;
  text: string;
  sourceType: 'pack' | 'topic';
  source: string; // 包标题或话题标题
  sourceSortOrder: number;
}

export interface SceneClaimInput {
  vocabIds?: string[];
  chunkIds?: string[];
  patternIds?: string[];
}

/**
 * 学习包材料引用约束服务
 *
 * 两层顺序约束：
 *  - 层 1（组内包与包之间）：Scene.groupId + Scene.sortOrder，后包不得认领前包已认领的材料
 *  - 层 2（包内话题之间）：TrainingTopic.sortOrder，后话题不得认领前话题已认领的材料
 *
 * 引用表 scene_material_reference 记录每个包/话题"认领"（learn）或"复习复用"（review）的材料。
 * 前序材料允许出现在后包例句/练习题中（review），只是不作为"新学目标"。
 */
@Injectable()
export class MaterialConstraintService {
  constructor(private readonly prisma: PrismaService) {}

  /** 解析材料文本（冲突提示 / AI 上下文用） */
  async resolveMaterialTexts(ids: Array<{ kind: MaterialKind; materialId: string }>): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!ids.length) return result;
    const byKind = (kind: MaterialKind) => ids.filter((item) => item.kind === kind).map((item) => item.materialId);

    const vocabIds = byKind('vocab');
    if (vocabIds.length) {
      const rows = await this.prisma.vocabulary.findMany({ where: { id: { in: vocabIds } }, select: { id: true, word: true } });
      rows.forEach((row) => result.set(`vocab:${row.id}`, row.word));
    }
    const chunkIds = byKind('chunk');
    if (chunkIds.length) {
      const rows = await this.prisma.chunk.findMany({ where: { id: { in: chunkIds } }, select: { id: true, text: true } });
      rows.forEach((row) => result.set(`chunk:${row.id}`, row.text));
    }
    const patternIds = byKind('pattern');
    if (patternIds.length) {
      const rows = await this.prisma.sentencePattern.findMany({ where: { id: { in: patternIds } }, select: { id: true, pattern: true } });
      rows.forEach((row) => result.set(`pattern:${row.id}`, row.pattern));
    }
    return result;
  }

  /**
   * 组上下文：读 Scene.groupId / Scene.sortOrder，返回同组前序/后序包及各自认领。
   * 未入组时 groupId 为 null，仅剩包内话题约束。
   */
  async getGroupContext(sceneId: string): Promise<GroupContext> {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { groupId: true, sortOrder: true },
    });
    if (!scene?.groupId) {
      return { groupId: null, groupName: null, sortOrder: 0, earlierScenes: [], laterScenes: [] };
    }

    const group = await this.prisma.packageGroup.findUnique({
      where: { id: scene.groupId },
      select: { name: true, scenes: { select: { id: true, title: true, sortOrder: true } } },
    });
    const scenes = group?.scenes ?? [];
    const ordered = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder);

    const refs = await this.prisma.sceneMaterialReference.findMany({
      where: { sceneId: { in: ordered.map((item) => item.id) } },
      select: { sceneId: true, materialType: true, materialId: true, role: true, topicId: true },
    });
    const refsByScene = new Map<string, MaterialClaim[]>();
    for (const ref of refs) {
      const list = refsByScene.get(ref.sceneId) ?? [];
      list.push({
        kind: ref.materialType as MaterialKind,
        materialId: ref.materialId,
        role: ref.role,
        topicId: ref.topicId,
      });
      refsByScene.set(ref.sceneId, list);
    }

    const toSceneInfo = (item: { id: string; title: string; sortOrder: number }): GroupSceneInfo => ({
      sceneId: item.id,
      title: item.title,
      sortOrder: item.sortOrder,
      claims: refsByScene.get(item.id) ?? [],
    });

    return {
      groupId: scene.groupId,
      groupName: group?.name ?? null,
      sortOrder: scene.sortOrder,
      earlierScenes: ordered.filter((item) => item.sortOrder < scene.sortOrder).map(toSceneInfo),
      laterScenes: ordered.filter((item) => item.sortOrder > scene.sortOrder).map(toSceneInfo),
    };
  }

  /**
   * 计算"新增/更新话题"时的认领冲突：
   *  - 组内前序包（learn + review）+ 本包前序话题（learn）中已出现的材料，
   *    若被当前话题作为新学目标（learn）绑定，则产生冲突。
   */
  async computeTopicClaimConflicts(params: {
    sceneId: string;
    topicId?: string | null;
    topicSortOrder: number;
    claims: SceneClaimInput;
  }): Promise<ClaimConflict[]> {
    const { sceneId, topicId, topicSortOrder, claims } = params;
    const blocked = new Map<string, { sourceType: 'pack' | 'topic'; source: string; sourceSortOrder: number }>();

    // 层 1：组内前序包认领（learn + review 都算，防止任何重复学习）
    const context = await this.getGroupContext(sceneId);
    for (const earlier of context.earlierScenes) {
      for (const claim of earlier.claims) {
        const key = `${claim.kind}:${claim.materialId}`;
        if (!blocked.has(key)) {
          blocked.set(key, { sourceType: 'pack', source: earlier.title, sourceSortOrder: earlier.sortOrder });
        }
      }
    }

    // 层 2：本包前序话题认领（learn）
    if (topicId || topicSortOrder > 0) {
      const earlierTopics = await this.prisma.trainingTopic.findMany({
        where: { sceneId, sortOrder: { lt: topicSortOrder }, ...(topicId ? { id: { not: topicId } } : {}) },
        select: { id: true, title: true, sortOrder: true },
      });
      if (earlierTopics.length) {
        const topicRefs = await this.prisma.sceneMaterialReference.findMany({
          where: { sceneId, topicId: { in: earlierTopics.map((item) => item.id) }, role: 'learn' },
          select: { materialType: true, materialId: true, topicId: true },
        });
        const topicById = new Map(earlierTopics.map((item) => [item.id, item]));
        for (const ref of topicRefs) {
          const topic = ref.topicId ? topicById.get(ref.topicId) : undefined;
          const key = `${ref.materialType}:${ref.materialId}`;
          if (!blocked.has(key) && topic) {
            blocked.set(key, { sourceType: 'topic', source: topic.title, sourceSortOrder: topic.sortOrder });
          }
        }
      }
    }

    const requested: Array<{ kind: MaterialKind; materialId: string }> = [
      ...(claims.vocabIds ?? []).map((materialId) => ({ kind: 'vocab' as MaterialKind, materialId })),
      ...(claims.chunkIds ?? []).map((materialId) => ({ kind: 'chunk' as MaterialKind, materialId })),
      ...(claims.patternIds ?? []).map((materialId) => ({ kind: 'pattern' as MaterialKind, materialId })),
    ];

    const conflicting = requested.filter((item) => blocked.has(`${item.kind}:${item.materialId}`));
    if (!conflicting.length) return [];

    const texts = await this.resolveMaterialTexts(conflicting);
    return conflicting.map((item) => {
      const source = blocked.get(`${item.kind}:${item.materialId}`)!;
      return {
        kind: item.kind,
        materialId: item.materialId,
        text: texts.get(`${item.kind}:${item.materialId}`) ?? item.materialId,
        ...source,
      };
    });
  }

  /**
   * 同步话题级引用：先删后建，conflictMaterialIds 中的材料记为 review（复习复用），其余为 learn。
   * 必须在保存话题的同一事务内调用。
   */
  async syncTopicReferences(
    tx: Prisma.TransactionClient,
    sceneId: string,
    topicId: string,
    claims: SceneClaimInput,
    conflictMaterialIds: string[] = [],
  ) {
    // 话题归属单一学习包，直接按 topicId 清理，避免话题换包后残留旧引用
    await tx.sceneMaterialReference.deleteMany({ where: { topicId } });
    const conflictSet = new Set(conflictMaterialIds);
    const rows: Prisma.SceneMaterialReferenceCreateManyInput[] = [];
    const push = (kind: MaterialKind, materialId: string) => {
      rows.push({
        sceneId,
        topicId,
        materialType: kind,
        materialId,
        role: conflictSet.has(materialId) ? 'review' : 'learn',
      });
    };
    (claims.vocabIds ?? []).forEach((id) => push('vocab', id));
    (claims.chunkIds ?? []).forEach((id) => push('chunk', id));
    (claims.patternIds ?? []).forEach((id) => push('pattern', id));
    if (rows.length) await tx.sceneMaterialReference.createMany({ data: rows });
  }

  /**
   * 同步包级引用（topicId = null，用于小说包等无话题场景）。
   * 必须在保存包级知识的同一事务内调用。
   */
  async syncSceneLevelReferences(
    tx: Prisma.TransactionClient,
    sceneId: string,
    claims: SceneClaimInput,
    conflictMaterialIds: string[] = [],
  ) {
    await tx.sceneMaterialReference.deleteMany({ where: { sceneId, topicId: null } });
    const conflictSet = new Set(conflictMaterialIds);
    const rows: Prisma.SceneMaterialReferenceCreateManyInput[] = [];
    const push = (kind: MaterialKind, materialId: string) => {
      rows.push({ sceneId, topicId: null, materialType: kind, materialId, role: conflictSet.has(materialId) ? 'review' : 'learn' });
    };
    (claims.vocabIds ?? []).forEach((id) => push('vocab', id));
    (claims.chunkIds ?? []).forEach((id) => push('chunk', id));
    (claims.patternIds ?? []).forEach((id) => push('pattern', id));
    if (rows.length) await tx.sceneMaterialReference.createMany({ data: rows });
  }

  /**
   * 组内重排冲突扫描：按 sortOrder 升序，后包 learn 认领命中前包（learn + review）认领的，记为冲突。
   * 用于"系列设置"保存重排后展示警告。
   */
  async scanGroupConflicts(groupId: string) {
    const group = await this.prisma.packageGroup.findUnique({
      where: { id: groupId },
      select: {
        name: true,
        scenes: {
          select: { id: true, title: true, sortOrder: true, materialReferences: { select: { materialType: true, materialId: true, role: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!group) return [];

    const used = new Map<string, { sceneId: string; title: string; sortOrder: number }>();
    const results: Array<{
      sceneId: string;
      sceneTitle: string;
      sortOrder: number;
      conflicts: Array<{ kind: MaterialKind; materialId: string; text: string; source: string; sourceSortOrder: number }>;
    }> = [];

    for (const scene of group.scenes) {
      const learnClaims = scene.materialReferences
        .filter((ref) => ref.role === 'learn')
        .map((ref) => ({ kind: ref.materialType as MaterialKind, materialId: ref.materialId }));

      const hits: Array<{ kind: MaterialKind; materialId: string; source: string; sourceSortOrder: number }> = [];
      for (const claim of learnClaims) {
        const source = used.get(`${claim.kind}:${claim.materialId}`);
        if (source) {
          hits.push({ ...claim, source: source.title, sourceSortOrder: source.sortOrder });
        }
      }

      if (hits.length) {
        const texts = await this.resolveMaterialTexts(hits);
        results.push({
          sceneId: scene.id,
          sceneTitle: scene.title,
          sortOrder: scene.sortOrder,
          conflicts: hits.map((hit) => ({
            ...hit,
            text: texts.get(`${hit.kind}:${hit.materialId}`) ?? hit.materialId,
          })),
        });
      }

      // 当前包全部认领（learn + review）进入"已使用"集合，供后续包校验
      for (const ref of scene.materialReferences) {
        const key = `${ref.materialType}:${ref.materialId}`;
        if (!used.has(key)) used.set(key, { sceneId: scene.id, title: scene.title, sortOrder: scene.sortOrder });
      }
    }
    return results;
  }
}
