/**
 * 📦 数据包导入/导出控制器
 *
 * 用于后台管理员管理 contents/packages/ 数据结构：
 *  - 导入：上传 ZIP → 解压 → 清空目标包数据 → 重新写入（覆盖模式）
 *  - 导出：从数据库读取 Scene 及相关数据 → 生成 CSV + 打包 ZIP → 下载
 *
 * 注意：这是后台内容管理工具，不是移动端的学习包系统（见 learning-pack-admin.controller.ts）。
 */

import {
  Controller, Get, Post, Delete, Param, Req, Res, ForbiddenException,
  UploadedFile, UseInterceptors, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireAuthSession } from '../auth/session.util';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import {
  existsSync, mkdirSync, readdirSync, readFileSync,
  rmSync, createWriteStream,
} from 'fs';
import { resolve as pathResolve, join as pathJoin } from 'path';
import * as AdmZip from 'adm-zip';
import { Readable } from 'stream';

// ── 类型定义 ──
type CsvRow = Record<string, string>;

@Controller('admin/content/packages')
export class PackageDataController {
  constructor(private readonly prisma: PrismaService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  /** 按 FK 依赖顺序清理场景的所有关联数据，然后删除场景 */
  private async cleanupScene(sceneId: string) {
    // 1. 查找关联 ID
    const topicRecords = await this.prisma.trainingTopic.findMany({
      where: { sceneId }, select: { id: true, inkScriptId: true },
    });
    const plainTopicIds = topicRecords.map(t => t.id);
    const inkScriptIds = topicRecords.map(t => t.inkScriptId).filter(Boolean) as string[];
    const storyEpisodeIds = (await this.prisma.storyEpisode.findMany({
      where: { sceneId }, select: { id: true },
    })).map(e => e.id);

    // 2. Practice 相关（必须先删，因为 PracticeSession.topic FK 无 cascade）
    // PracticeTurn 有 onDelete: Cascade from session，删 session 会自动级联删 turn
    await this.prisma.practiceSession.deleteMany({ where: { sceneId } }).catch(() => {});
    if (plainTopicIds.length > 0) {
      await this.prisma.practiceWarmupRecord.deleteMany({ where: { topicId: { in: plainTopicIds } } }).catch(() => {});
    }

    // 3. Story 相关
    if (storyEpisodeIds.length > 0) {
      await this.prisma.storyTurn.deleteMany({ where: { episodeId: { in: storyEpisodeIds } } }).catch(() => {});
      await this.prisma.storyRecord.deleteMany({ where: { episodeId: { in: storyEpisodeIds } } }).catch(() => {});
      await this.prisma.storyEpisodeChunk.deleteMany({ where: { episodeId: { in: storyEpisodeIds } } }).catch(() => {});
      await this.prisma.storyEpisodeVocabulary.deleteMany({ where: { episodeId: { in: storyEpisodeIds } } }).catch(() => {});
      await this.prisma.storyEpisodeSentencePattern.deleteMany({ where: { episodeId: { in: storyEpisodeIds } } }).catch(() => {});
    }
    await this.prisma.storyEpisode.deleteMany({ where: { sceneId } }).catch(() => {});

    // 4. TrainingTopic 关联（必须在删 topic 之前）
    if (plainTopicIds.length > 0) {
      await this.prisma.trainingTopicChunk.deleteMany({ where: { topicId: { in: plainTopicIds } } }).catch(() => {});
      await this.prisma.trainingTopicVocab.deleteMany({ where: { topicId: { in: plainTopicIds } } }).catch(() => {});
      await this.prisma.trainingTopicSentencePattern.deleteMany({ where: { topicId: { in: plainTopicIds } } }).catch(() => {});
    }
    // 解除 InkScript 关联（使用 inkScriptIds 而非 topicIds）
    if (inkScriptIds.length > 0) {
      await this.prisma.inkScript.updateMany({
        where: { id: { in: inkScriptIds } }, data: { topicId: null },
      }).catch(() => {});
    }
    await this.prisma.trainingTopic.deleteMany({ where: { sceneId } }).catch(() => {});

    // 5. 其他关联
    await this.prisma.learningPackage.deleteMany({ where: { sceneId } }).catch(() => {});
    await this.prisma.userSceneProgress.deleteMany({ where: { sceneId } }).catch(() => {});
    await this.prisma.scenePrerequisite.deleteMany({
      where: { OR: [{ sceneId }, { prerequisiteId: sceneId }] },
    }).catch(() => {});

    // 6. 删除场景
    await this.prisma.scene.delete({ where: { id: sceneId } });
  }

  /** 安全解析 JSON 字符串，非 JSON 时当作纯文本放入数组 */
  private parseObjectives(raw?: string): string[] {
    if (!raw?.trim()) return [];
    try { return JSON.parse(raw); } catch {
      return [raw.trim()];
    }
  }

  /** 安全解析 JSON，失败返回 undefined */
  private parseJsonSafe(raw?: string): any {
    if (!raw?.trim()) return undefined;
    try { return JSON.parse(raw); } catch {
      return undefined;
    }
  }

  // ════════════════════════════════════════════════════════════
  // 导入数据包
  // ════════════════════════════════════════════════════════════

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'tmp'),
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/zip' ||
            file.originalname?.endsWith('.zip')) {
          cb(null, true);
        } else {
          cb(new Error('仅支持 ZIP 文件'), false);
        }
      },
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    }),
  )
  async importPackage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body('packageDirName') packageDirName?: string,
  ) {
    await this.requireAdmin(req);

    if (!file) throw new ForbiddenException('请上传 ZIP 文件');
    if (!packageDirName?.trim()) throw new ForbiddenException('请指定包目录名（如 course-adverbs）');

    const zipPath = file.path;
    const tmpDir = join(process.cwd(), 'uploads', 'tmp', `pkg-import-${Date.now()}`);

    try {
      mkdirSync(tmpDir, { recursive: true });

      // 1. 解压 ZIP
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tmpDir, true);

      // 2. 定位包目录
      let pkgDir = join(tmpDir, packageDirName.trim());
      if (!existsSync(pkgDir)) {
        // 尝试在 ZIP 根目录找同名目录
        const dirs = readdirSync(tmpDir, { withFileTypes: true }).filter(d => d.isDirectory());
        const match = dirs.find(d => d.name === packageDirName.trim());
        if (match) pkgDir = join(tmpDir, match.name);
        else {
          // 如果只有一个顶级目录，尝试使用它
          const topDirs = dirs.filter(d => !d.name.startsWith('__MACOSX'));
          if (topDirs.length === 1) pkgDir = join(tmpDir, topDirs[0].name);
          else throw new ForbiddenException(`ZIP 中未找到包目录 "${packageDirName}"，找到的目录: ${dirs.map(d=>d.name).join(', ')}`);
        }
      }

      // 3. 读取 CSV 数据（支持引号包裹的字段，如 JSON 值含逗号）
      const readCsv = (filename: string): CsvRow[] => {
        const filePath = join(pkgDir, filename);
        if (!existsSync(filePath)) return [];
        const raw = readFileSync(filePath, 'utf-8').trim();
        // 去除 UTF-8 BOM
        const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
        if (!content) return [];
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];
        const parseLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += ch;
            }
          }
          result.push(current.trim());
          return result;
        };
        const headers = parseLine(lines[0]);
        return lines.slice(1).map(line => {
          const values = parseLine(line);
          const row: CsvRow = {};
          headers.forEach((h, i) => { row[h] = (values[i] || ''); });
          return row;
        });
      };

      const sceneRows = readCsv('scenes.csv');
      const vocabRows = readCsv('scene_vocabulary.csv');
      const chunkRows = readCsv('chunks.csv');
      const topicRows = readCsv('training_topics.csv');
      const patternRows = readCsv('sentence_patterns.csv');
      const epRows = readCsv('script_episodes.csv');
      const epChunkRows = readCsv('episode_chunks.csv');

      // 读取 warmup_pipeline.json
      let warmupPipeline: Record<string, any> = {};
      const pipelinePath = join(pkgDir, 'warmup_pipeline.json');
      if (existsSync(pipelinePath)) {
        warmupPipeline = JSON.parse(readFileSync(pipelinePath, 'utf-8'));
      }

      // 导入 Ink 脚本（从 ink-scripts/ 子目录）
      const inkKeyToId = new Map<string, string>();
      const inkDir = join(pkgDir, 'ink-scripts');
      if (existsSync(inkDir)) {
        try {
          const inkFiles = readdirSync(inkDir).filter(f => f.endsWith('.ink'));
          for (const file of inkFiles) {
            const raw = readFileSync(join(inkDir, file), 'utf-8');
            const frontMatch = raw.match(/^---\n([\s\S]*?)\n---/);
            let key = file.replace(/\.ink$/, '');
            let title = key;
            if (frontMatch) {
              const fm = frontMatch[1];
              const km = fm.match(/^key:\s*(.+)$/m);
              const tm = fm.match(/^title:\s*(.+)$/m);
              if (km) key = km[1].trim();
              if (tm) title = tm[1].trim();
            }
            const ink = await this.prisma.inkScript.upsert({
              where: { key },
              create: { key, title, scriptType: 'practice', inkSource: raw, inkJson: {} },
              update: { inkSource: raw },
            });
            inkKeyToId.set(key, ink.id);
          }
          if (inkFiles.length > 0) console.log(`  ✓ ${inkFiles.length} 个 Ink 脚本`);
        } catch { /* no ink dir or parse error */ }
      }

      // 4. 查找已有场景（按包目录名推断 packageType 和场景标题）
      const packageType = packageDirName.startsWith('daily-') ? 'daily'
        : packageDirName.startsWith('exam-') ? 'exam'
        : packageDirName.startsWith('story-') ? 'story'
        : packageDirName.startsWith('course-') ? 'course'
        : packageDirName.startsWith('foundation-') ? 'foundation'
        : 'daily';

      let sceneTitle = sceneRows[0]?.title || packageDirName;
      const existingScene = await this.prisma.scene.findFirst({
        where: { title: sceneTitle, packageType: packageType as any },
      });

      // 5. 如果已存在，先清空关联数据
      if (existingScene) {
        await this.cleanupScene(existingScene.id);
      }

      // 6. 获取场景分类
      const categoryName = sceneRows[0]?.category_name || '';
      let category = await this.prisma.sceneCategory.findFirst({
        where: { name: categoryName },
      });
      if (!category && categoryName) {
        category = await this.prisma.sceneCategory.create({
          data: { name: categoryName, sortOrder: 99 },
        });
      }
      if (!category) {
        throw new ForbiddenException('场景分类不能为空，请在 scenes.csv 中填写 category_name');
      }

      // 7. 创建场景
      const scene = await this.prisma.scene.create({
        data: {
          categoryId: category.id,
          packageType: packageType as any,
          title: sceneTitle,
          location: sceneRows[0]?.location || '',
          description: sceneRows[0]?.description || null,
          requiredOutputLevel: sceneRows[0]?.required_output_level || 'L1',
          requiredUserLevel: parseInt(sceneRows[0]?.required_user_level || '1'),
          isFree: false,
        },
      });

      // 补建 LearningPackage 记录（移动端学习包系统依赖此记录）
      await this.prisma.learningPackage.upsert({
        where: { sceneId_version: { sceneId: scene.id, version: 1 } },
        create: {
          sceneId: scene.id, version: 1,
          title: `${scene.title} v1`,
          type: packageType as any,
          status: 'draft',
          buildLog: 'Imported from admin data package.',
        },
        update: {
          title: `${scene.title} v1`,
          type: packageType as any,
          buildLog: 'Re-imported from admin data package.',
        },
      });

      // 8. 导入词汇
      const vocabIdMap = new Map<string, string>();
      for (const row of vocabRows) {
        const vocab = await this.prisma.vocabulary.upsert({
          where: { word: row.word },
          create: {
            word: row.word,
            meaning: row.meaning,
            partOfSpeech: row.part_of_speech || null,
            difficulty: row.difficulty || 'L1',
            sortOrder: parseInt(row.sort_order) || 0,
          },
          update: { meaning: row.meaning },
        });
        vocabIdMap.set(row.word, vocab.id);
      }

      // 9. 导入句块
      const chunkIdMap = new Map<string, string>();
      for (const row of chunkRows) {
        const chunk = await this.prisma.chunk.upsert({
          where: { text: row.text },
          create: {
            text: row.text,
            meaning: row.meaning,
            category: row.category || '',
            difficulty: row.difficulty || 'L2',
          },
          update: { meaning: row.meaning, category: row.category || '' },
        });
        chunkIdMap.set(row.text, chunk.id);
      }

      // 10. 导入训练话题
      const topicIds: string[] = [];
      const topicIdMap = new Map<string, string>(); // title → id
      for (const row of topicRows) {
        // 查找绑定的 Ink 脚本
        let inkScriptId: string | null = null;
        if (row.ink_script_key?.trim()) {
          inkScriptId = inkKeyToId.get(row.ink_script_key.trim()) ?? null;
        }
        const topic = await this.prisma.trainingTopic.create({
          data: {
            sceneId: scene.id,
            type: (row as any).type === 'ielts' ? 'ielts' : 'daily',
            title: row.title,
            promptEn: row.prompt_en || '',
            promptZh: row.prompt_zh || '',
            suggestedDurationSec: parseInt(row.duration_sec || '60'),
            difficulty: row.difficulty || 'L2',
            description: row.description || null,
            knowledgePoints: row.knowledge_points || null,
            teachingMarkdown: row.teaching_markdown || null,
            inkScriptId,
            sortOrder: topicIds.length,
          },
        });

        // 关联词汇
        const allVocabIds = [...vocabIdMap.values()];
        if (allVocabIds.length > 0) {
          await this.prisma.trainingTopicVocab.createMany({
            data: allVocabIds.map((vocabId, i) => ({ topicId: topic.id, vocabId, sortOrder: i })),
            skipDuplicates: true,
          });
        }
        // 关联句块
        const allChunkIds = [...chunkIdMap.values()];
        if (allChunkIds.length > 0) {
          await this.prisma.trainingTopicChunk.createMany({
            data: allChunkIds.map((chunkId, i) => ({ topicId: topic.id, chunkId, sortOrder: i })),
            skipDuplicates: true,
          });
        }

        topicIds.push(topic.id);
        topicIdMap.set(row.title, topic.id);
      }

      // 11. 导入句型
      for (const row of patternRows) {
        const pattern = await this.prisma.sentencePattern.upsert({
          where: { pattern: row.pattern },
          create: {
            pattern: row.pattern,
            meaning: row.meaning || null,
            difficulty: row.difficulty || 'L1',
          },
          update: {},
        });
        // 关联到话题
        const topicTitle = row.topic_title || row.scene_title;
        const topicId = topicIds.find((_id, i) => topicRows[i]?.title === topicTitle || topicRows[i]?.scene_title === topicTitle);
        if (topicId) {
          await this.prisma.trainingTopicSentencePattern.create({
            data: { topicId, patternId: pattern.id, sortOrder: parseInt(row.sort_order) || 0 },
          }).catch(() => {});  // skip duplicates
        }
      }

      // 12. 导入剧本关卡
      for (const row of epRows) {
        const episode = await this.prisma.storyEpisode.create({
          data: {
            sceneId: scene.id,
            chapterKey: row.chapter_id || 'default',
            chapterName: row.chapter_title || 'Default',
            sortOrder: parseInt(row.episode_order || '1'),
            title: row.title,
            requiredOutputLevel: row.required_output_level || 'L1',
            requiredUserLevel: parseInt(row.required_user_level || '1'),
            requiredVocabularyCount: parseInt(row.vocab_required_count || '6'),
            totalVocabularyCount: parseInt(row.vocab_total_count || '10'),
            requiredChunkCount: parseInt(row.chunk_required_count || '6'),
            totalChunkCount: parseInt(row.chunk_total_count || '10'),
            objectives: this.parseObjectives(row.objectives_json),
            requiredObjectiveCount: parseInt(row.pass_objective_count || '3'),
            requiredUsedChunkCount: parseInt(row.pass_chunk_count || '2'),
            requiresRetell: false,
            minimumTurnCount: parseInt(row.pass_min_dialogues || '3'),
            characterName: row.npc_name || '',
            characterRole: row.npc_role || '',
            isPreview: row.is_preview === 'true',
            rewards: this.parseJsonSafe(row.rewards_json),
          },
        });

        // 关联词汇和句块
        const allVocabIds = [...vocabIdMap.values()];
        if (allVocabIds.length > 0) {
          await this.prisma.storyEpisodeVocabulary.createMany({
            data: allVocabIds.map((vocabId, i) => ({ episodeId: episode.id, vocabId, sortOrder: i })),
            skipDuplicates: true,
          });
        }
        const allChunkIds = [...chunkIdMap.values()];
        if (allChunkIds.length > 0) {
          await this.prisma.storyEpisodeChunk.createMany({
            data: allChunkIds.map((chunkId, i) => ({ episodeId: episode.id, chunkId, sortOrder: i })),
            skipDuplicates: true,
          });
        }
      }

      // 13. 导入 warmup_pipeline
      let warmupMatched = 0;
      for (const [topicTitle, pipelineData] of Object.entries(warmupPipeline)) {
        let topicId = topicIdMap.get(topicTitle);
        if (!topicId) {
          for (const [title, id] of topicIdMap) {
            if (title.includes(topicTitle) || topicTitle.includes(title)) {
              topicId = id;
              break;
            }
          }
        }
        if (topicId) {
          await this.prisma.trainingTopic.update({
            where: { id: topicId },
            data: { metadata: pipelineData as any },
          });
          warmupMatched++;
        }
      }
      if (warmupMatched > 0) console.log(`  ✓ ${warmupMatched}/${Object.keys(warmupPipeline).length} 个知识点练习 pipeline 已匹配`);

      return {
        code: 200,
        message: `数据包 "${packageDirName}" 导入成功`,
        data: {
          sceneId: scene.id,
          sceneTitle: scene.title,
          vocabCount: vocabRows.length,
          chunkCount: chunkRows.length,
          topicCount: topicRows.length,
          patternCount: patternRows.length,
          episodeCount: epRows.length,
          warmupTopics: warmupMatched,
        },
      };
    } finally {
      // 清理临时文件
      try { if (existsSync(zipPath)) rmSync(zipPath); } catch {}
      try { if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); } catch {}
    }
  }

  // ════════════════════════════════════════════════════════════
  // 导出数据包
  // ════════════════════════════════════════════════════════════

  @Get(':sceneId/export')
  async exportPackage(
    @Req() req: Request,
    @Res() res: Response,
    @Param('sceneId') sceneId: string,
  ) {
    await this.requireAdmin(req);

    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        category: true,
        trainingTopics: {
          orderBy: { sortOrder: 'asc' },
          include: {
            topicPatterns: { include: { pattern: true } },
            topicVocabs: { include: { vocab: true } },
            activeChunks: { include: { chunk: true } },
          },
        },
        storyEpisodes: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chunks: { include: { chunk: true } },
            vocabularies: { include: { vocabulary: true } },
          },
        },
      },
    });
    if (!scene) throw new ForbiddenException('场景不存在');

    // 推断包目录名
    const dirName = `${scene.packageType}-${scene.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '-')}`.substring(0, 50);

    const toCsvLine = (values: string[]) => values.map(v => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    }).join(',');

    const toJson = (obj: any) => JSON.stringify(obj ?? {});
    const escapeJson = (s: string) => JSON.stringify(s);

    // 1. scenes.csv
    const sceneCsv = toCsvLine(['category_name', 'title', 'location', 'required_output_level', 'required_user_level', 'description', 'package_type']) + '\n' +
      toCsvLine([
        scene.category?.name || '',
        scene.title,
        scene.location,
        scene.requiredOutputLevel,
        String(scene.requiredUserLevel),
        scene.description || '',
        scene.packageType,
      ]);

    // 2. scene_vocabulary.csv - 收集所有 topic 关联的词汇（去重）
    const vocabMap = new Map<string, { word: string; meaning: string; partOfSpeech: string; phoneticUs: string; phoneticUk: string; difficulty: string; description: string; examples: string; sortOrder: string }>();
    for (const topic of scene.trainingTopics) {
      for (const tv of topic.topicVocabs) {
        const v = tv.vocab;
        if (!vocabMap.has(v.id)) {
          vocabMap.set(v.id, {
            word: v.word,
            meaning: v.meaning,
            partOfSpeech: v.partOfSpeech || '',
            phoneticUs: v.phoneticUs || '',
            phoneticUk: v.phoneticUk || '',
            difficulty: v.difficulty,
            description: v.description || '',
            examples: toJson(v.examples),
            sortOrder: String(v.sortOrder),
          });
        }
      }
    }
    let vocabCsv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
    for (const [, v] of vocabMap) {
      vocabCsv += toCsvLine([scene.title, '', v.word, v.meaning, v.partOfSpeech, v.phoneticUs, v.phoneticUk, v.difficulty, v.description, escapeJson(v.examples), v.sortOrder]) + '\n';
    }

    // 3. chunks.csv
    const chunkMap = new Map<string, { text: string; meaning: string; category: string; difficulty: string; description: string; examples: string }>();
    for (const topic of scene.trainingTopics) {
      for (const tc of topic.activeChunks) {
        const c = tc.chunk;
        if (!chunkMap.has(c.id)) {
          chunkMap.set(c.id, {
            text: c.text,
            meaning: c.meaning,
            category: c.category || '',
            difficulty: c.difficulty,
            description: c.description || '',
            examples: '[]',
          });
        }
      }
    }
    let chunkCsv = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n';
    for (const [, c] of chunkMap) {
      chunkCsv += toCsvLine([scene.title, '', c.category, c.text, c.meaning, c.difficulty, c.description, c.examples]) + '\n';
    }

    // 4. training_topics.csv
    let topicCsv = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key\n';
    for (const topic of scene.trainingTopics) {
      topicCsv += toCsvLine([
        scene.title,
        topic.title,
        topic.promptEn,
        topic.promptZh,
        String(topic.suggestedDurationSec),
        topic.difficulty,
        topic.description || '',
        topic.knowledgePoints || '',
        topic.teachingMarkdown || '',
        '',
      ]) + '\n';
    }

    // 5. sentence_patterns.csv
    let patternCsv = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order\n';
    const seenPatterns = new Set<string>();
    for (const topic of scene.trainingTopics) {
      for (const tp of topic.topicPatterns) {
        if (seenPatterns.has(tp.pattern.id)) continue;
        seenPatterns.add(tp.pattern.id);
        patternCsv += toCsvLine([
          scene.title,
          topic.title,
          tp.pattern.pattern,
          tp.pattern.meaning || '',
          tp.pattern.slots ? toJson(tp.pattern.slots) : '',
          '',
          tp.pattern.difficulty,
          String(tp.sortOrder),
        ]) + '\n';
      }
    }

    // 6. script_episodes.csv
    let epCsv = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
    for (const ep of scene.storyEpisodes) {
      epCsv += toCsvLine([
        ep.chapterKey,
        ep.chapterName,
        String(ep.sortOrder),
        ep.title,
        scene.title,
        ep.requiredOutputLevel,
        String(ep.requiredUserLevel),
        String(ep.requiredVocabularyCount),
        String(ep.totalVocabularyCount),
        String(ep.requiredChunkCount),
        String(ep.totalChunkCount),
        toJson(ep.objectives),
        String(ep.requiredObjectiveCount),
        String(ep.requiredUsedChunkCount),
        String(ep.minimumTurnCount),
        ep.characterName,
        ep.characterRole,
        String(ep.isPreview),
        '',
        toJson(ep.rewards),
      ]) + '\n';
    }

    // 7. episode_chunks.csv
    let epChunkCsv = 'episode_chapter,episode_order,chunk_text_match,sort_order\n';
    for (const ep of scene.storyEpisodes) {
      for (const ec of ep.chunks) {
        epChunkCsv += toCsvLine([ep.chapterKey, String(ep.sortOrder), ec.chunk.text, '0']) + '\n';
      }
    }

    // 8. warmup_pipeline.json
    const warmupData: Record<string, any> = {};
    for (const topic of scene.trainingTopics) {
      if (topic.metadata && (topic.metadata as any).outputTraining) {
        const pipeline = (topic.metadata as any).outputTraining;
        if (pipeline.pipeline?.length > 0) {
          warmupData[topic.title] = { outputTraining: pipeline };
        }
      }
    }
    const warmupJson = JSON.stringify(warmupData, null, 2);

    // 9. 打包 ZIP
    const zip = new AdmZip();
    const prefix = `${dirName}/`;
    zip.addFile(prefix + 'scenes.csv', Buffer.from(sceneCsv, 'utf-8'));
    zip.addFile(prefix + 'scene_vocabulary.csv', Buffer.from(vocabCsv, 'utf-8'));
    zip.addFile(prefix + 'chunks.csv', Buffer.from(chunkCsv, 'utf-8'));
    zip.addFile(prefix + 'training_topics.csv', Buffer.from(topicCsv, 'utf-8'));
    zip.addFile(prefix + 'sentence_patterns.csv', Buffer.from(patternCsv, 'utf-8'));
    if (epCsv.split('\n').length > 2) zip.addFile(prefix + 'script_episodes.csv', Buffer.from(epCsv, 'utf-8'));
    if (epChunkCsv.split('\n').length > 2) zip.addFile(prefix + 'episode_chunks.csv', Buffer.from(epChunkCsv, 'utf-8'));
    zip.addFile(prefix + 'warmup_pipeline.json', Buffer.from(warmupJson, 'utf-8'));

    // 导出 Ink 脚本（如果有）
    const topicIds = scene.trainingTopics.map(t => t.id);
    const episodeIds = scene.storyEpisodes.map(e => e.id);
    const inkConditions: any[] = [];
    if (topicIds.length > 0) inkConditions.push({ topicId: { in: topicIds } });
    if (episodeIds.length > 0) inkConditions.push({ episodeId: { in: episodeIds } });
    const inkScripts = inkConditions.length > 0
      ? await this.prisma.inkScript.findMany({ where: { OR: inkConditions } })
      : [];
    if (inkScripts.length > 0) {
      for (const ink of inkScripts) {
        const key = ink.key || `ink_${ink.id}`;
        const filename = `ink-scripts/${key}.ink`;
        zip.addFile(prefix + filename, Buffer.from(ink.inkSource || '', 'utf-8'));
      }
    }

    const zipBuffer = zip.toBuffer();
    const filename = `${dirName}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': zipBuffer.length,
    });
    res.send(zipBuffer);
  }

  // ════════════════════════════════════════════════════════════
  // 从磁盘更新数据包（读取 prisma/data/packages/ 目录）
  // ════════════════════════════════════════════════════════════

  @Post(':sceneId/update-from-disk')
  async updateFromDisk(
    @Req() req: Request,
    @Param('sceneId') sceneId: string,
  ) {
    await this.requireAdmin(req);

    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId } });
    if (!scene) throw new ForbiddenException('场景不存在');

    // 推断包目录名
    const titleSlug = scene.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+$/g, '')
      .replace(/^-+/, '');
    const dirName = `${scene.packageType}-${titleSlug}`;

    // 查找匹配的包目录
    const packagesDir = pathJoin(process.cwd(), 'prisma', 'data', 'packages');
    const allDirs = existsSync(packagesDir)
      ? readdirSync(packagesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
      : [];

    // 精确匹配 + 模糊匹配
    let matchDir = allDirs.find(d => d === dirName);
    if (!matchDir) {
      const keywords = scene.title.toLowerCase().split(/\s+/).filter(k => k.length > 1);
      matchDir = allDirs.find(d => {
        const lower = d.toLowerCase();
        return keywords.some(k => lower.includes(k)) && d.startsWith(scene.packageType + '-');
      });
    }
    if (!matchDir) {
      throw new ForbiddenException(
        `未找到匹配的包目录。推断名: ${dirName}，可用: ${allDirs.join(', ') || '无'}`
      );
    }

    const pkgDir = pathJoin(packagesDir, matchDir);
    const result = await this.importFromDir(pkgDir, matchDir);

    return {
      code: 200,
      message: `已从磁盘目录 "${matchDir}" 更新数据包`,
      data: { oldSceneId: sceneId, newSceneId: result.sceneId, packageDir: matchDir, ...result },
    };
  }

  // ════════════════════════════════════════════════════════════
  // 共享的导入逻辑：从目录读取 CSV 并写入数据库
  // ════════════════════════════════════════════════════════════

  private async importFromDir(pkgDir: string, packageDirName: string) {
    const readCsv = (filename: string): CsvRow[] => {
      const filePath = pathJoin(pkgDir, filename);
      if (!existsSync(filePath)) return [];
      const raw = readFileSync(filePath, 'utf-8').trim();
      const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
      if (!content) return [];
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length < 2) return [];
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };
      const headers = parseLine(lines[0]);
      return lines.slice(1).map(line => {
        const values = parseLine(line);
        const row: CsvRow = {};
        headers.forEach((h, i) => { row[h] = (values[i] || ''); });
        return row;
      });
    };

    const sceneRows = readCsv('scenes.csv');
    const vocabRows = readCsv('scene_vocabulary.csv');
    const chunkRows = readCsv('chunks.csv');
    const topicRows = readCsv('training_topics.csv');
    const patternRows = readCsv('sentence_patterns.csv');
    const epRows = readCsv('script_episodes.csv');

    let warmupPipeline: Record<string, any> = {};
    const pipelinePath = pathJoin(pkgDir, 'warmup_pipeline.json');
    if (existsSync(pipelinePath)) {
      warmupPipeline = JSON.parse(readFileSync(pipelinePath, 'utf-8'));
    }

    const packageType = packageDirName.startsWith('daily-') ? 'daily'
      : packageDirName.startsWith('exam-') ? 'exam'
      : packageDirName.startsWith('story-') ? 'story'
      : packageDirName.startsWith('course-') ? 'course'
      : packageDirName.startsWith('foundation-') ? 'foundation'
      : 'daily';

    const sceneTitle = sceneRows[0]?.title || packageDirName;
    const existingScene = await this.prisma.scene.findFirst({
      where: { title: sceneTitle, packageType: packageType as any },
    });
    if (existingScene) {
      await this.cleanupScene(existingScene.id);
    }

    const categoryName = sceneRows[0]?.category_name || '';
    let category = await this.prisma.sceneCategory.findFirst({ where: { name: categoryName } });
    if (!category && categoryName) {
      category = await this.prisma.sceneCategory.create({ data: { name: categoryName, sortOrder: 99 } });
    }
    if (!category) throw new ForbiddenException('场景分类不能为空');

    const scene = await this.prisma.scene.create({
      data: {
        categoryId: category.id,
        packageType: packageType as any,
        title: sceneTitle,
        location: sceneRows[0]?.location || '',
        description: sceneRows[0]?.description || null,
        requiredOutputLevel: sceneRows[0]?.required_output_level || 'L1',
        requiredUserLevel: parseInt(sceneRows[0]?.required_user_level || '1'),
        isFree: false,
      },
    });

    // 补建 LearningPackage 记录
    await this.prisma.learningPackage.upsert({
      where: { sceneId_version: { sceneId: scene.id, version: 1 } },
      create: {
        sceneId: scene.id, version: 1,
        title: `${scene.title} v1`,
        type: packageType as any,
        status: 'draft',
        buildLog: 'Imported from admin data package.',
      },
      update: {
        title: `${scene.title} v1`,
        type: packageType as any,
        buildLog: 'Re-imported from admin data package.',
      },
    });

    const vocabIdMap = new Map<string, string>();
    for (const row of vocabRows) {
      const vocab = await this.prisma.vocabulary.upsert({
        where: { word: row.word },
        create: { word: row.word, meaning: row.meaning, partOfSpeech: row.part_of_speech || null, difficulty: row.difficulty || 'L1', sortOrder: parseInt(row.sort_order) || 0 },
        update: { meaning: row.meaning },
      });
      vocabIdMap.set(row.word, vocab.id);
    }

    const chunkIdMap = new Map<string, string>();
    for (const row of chunkRows) {
      const chunk = await this.prisma.chunk.upsert({
        where: { text: row.text },
        create: { text: row.text, meaning: row.meaning, category: row.category || '', difficulty: row.difficulty || 'L2' },
        update: { meaning: row.meaning, category: row.category || '' },
      });
      chunkIdMap.set(row.text, chunk.id);
    }

    const topicIds: string[] = [];
    const topicIdMap = new Map<string, string>();
    for (const row of topicRows) {
      const topic = await this.prisma.trainingTopic.create({
        data: {
          sceneId: scene.id, type: 'daily',
          title: row.title, promptEn: row.prompt_en || '', promptZh: row.prompt_zh || '',
          suggestedDurationSec: parseInt(row.duration_sec || '60'), difficulty: row.difficulty || 'L2',
          description: row.description || null, knowledgePoints: row.knowledge_points || null,
          teachingMarkdown: row.teaching_markdown || null,
          sortOrder: topicIds.length,
        },
      });
      topicIdMap.set(row.title, topic.id);
      const allVocabs = [...vocabIdMap.values()];
      if (allVocabs.length) await this.prisma.trainingTopicVocab.createMany({ data: allVocabs.map((v, i) => ({ topicId: topic.id, vocabId: v, sortOrder: i })), skipDuplicates: true });
      const allChunks = [...chunkIdMap.values()];
      if (allChunks.length) await this.prisma.trainingTopicChunk.createMany({ data: allChunks.map((c, i) => ({ topicId: topic.id, chunkId: c, sortOrder: i })), skipDuplicates: true });
      topicIds.push(topic.id);
    }

    for (const row of patternRows) {
      const pattern = await this.prisma.sentencePattern.upsert({
        where: { pattern: row.pattern },
        create: { pattern: row.pattern, meaning: row.meaning || null, difficulty: row.difficulty || 'L1' },
        update: {},
      });
      const topicId = topicIds.find((_id, i) => topicRows[i]?.title === (row.topic_title || row.scene_title));
      if (topicId) {
        await this.prisma.trainingTopicSentencePattern.create({
          data: { topicId, patternId: pattern.id, sortOrder: parseInt(row.sort_order) || 0 },
        }).catch(() => {});
      }
    }

    for (const row of epRows) {
      const episode = await this.prisma.storyEpisode.create({
        data: {
          sceneId: scene.id, chapterKey: row.chapter_id || 'default', chapterName: row.chapter_title || 'Default',
          sortOrder: parseInt(row.episode_order || '1'), title: row.title,
          requiredOutputLevel: row.required_output_level || 'L1', requiredUserLevel: parseInt(row.required_user_level || '1'),
          requiredVocabularyCount: parseInt(row.vocab_required_count || '6'), totalVocabularyCount: parseInt(row.vocab_total_count || '10'),
          requiredChunkCount: parseInt(row.chunk_required_count || '6'), totalChunkCount: parseInt(row.chunk_total_count || '10'),
          objectives: this.parseObjectives(row.objectives_json),
          requiredObjectiveCount: parseInt(row.pass_objective_count || '3'), requiredUsedChunkCount: parseInt(row.pass_chunk_count || '2'),
          requiresRetell: false, minimumTurnCount: parseInt(row.pass_min_dialogues || '3'),
          characterName: row.npc_name || '', characterRole: row.npc_role || '',
          isPreview: row.is_preview === 'true',
          rewards: this.parseJsonSafe(row.rewards_json),
        },
      });
      const allVocabs = [...vocabIdMap.values()];
      if (allVocabs.length) await this.prisma.storyEpisodeVocabulary.createMany({ data: allVocabs.map((v, i) => ({ episodeId: episode.id, vocabId: v, sortOrder: i })), skipDuplicates: true });
      const allChunks = [...chunkIdMap.values()];
      if (allChunks.length) await this.prisma.storyEpisodeChunk.createMany({ data: allChunks.map((c, i) => ({ episodeId: episode.id, chunkId: c, sortOrder: i })), skipDuplicates: true });
    }

    let warmupMatched = 0;
    for (const [topicTitle, pipelineData] of Object.entries(warmupPipeline)) {
      let tid = topicIdMap.get(topicTitle);
      if (!tid) {
        for (const [title, id] of topicIdMap) {
          if (title.includes(topicTitle) || topicTitle.includes(title)) { tid = id; break; }
        }
      }
      if (tid) { await this.prisma.trainingTopic.update({ where: { id: tid }, data: { metadata: pipelineData as any } }); warmupMatched++; }
    }
    if (warmupMatched > 0) console.log(`  ✓ ${warmupMatched}/${Object.keys(warmupPipeline).length} 个知识点练习 pipeline 已匹配`);

    // 导入 Ink 脚本
    const inkDir = pathJoin(pkgDir, 'ink-scripts');
    if (existsSync(inkDir)) {
      try {
        const inkFiles = readdirSync(inkDir).filter((f: string) => f.endsWith('.ink'));
        for (const file of inkFiles) {
          const raw = readFileSync(pathJoin(inkDir, file), 'utf-8');
          const frontMatch = raw.match(/^---\n([\s\S]*?)\n---/);
          let key = `ink_${Date.now()}_${file.replace(/\.ink$/, '')}`;
          let title = file.replace(/\.ink$/, '');
          if (frontMatch) {
            const fm = frontMatch[1];
            const km = fm.match(/^key:\s*(.+)$/m);
            const tm = fm.match(/^title:\s*(.+)$/m);
            if (km) key = km[1].trim();
            if (tm) title = tm[1].trim();
          }
          await this.prisma.inkScript.upsert({
            where: { key },
            create: { key, title, scriptType: 'practice', inkSource: raw, inkJson: {} },
            update: { inkSource: raw },
          });
        }
      } catch { /* no ink dir or parse error */ }
    }

    return {
      sceneId: scene.id, sceneTitle: scene.title,
      vocabCount: vocabRows.length, chunkCount: chunkRows.length,
      topicCount: topicRows.length, patternCount: patternRows.length,
      episodeCount: epRows.length, warmupTopics: warmupMatched,
    };
  }

  // ════════════════════════════════════════════════════════════
  // 删除场景（含级联清理）
  // ════════════════════════════════════════════════════════════

  @Delete(':sceneId')
  async deleteScene(
    @Req() req: Request,
    @Param('sceneId') sceneId: string,
  ) {
    await this.requireAdmin(req);
    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId } });
    if (!scene) throw new ForbiddenException('场景不存在');
    await this.cleanupScene(sceneId);
    return { code: 200, message: `已删除 "${scene.title}"` };
  }
}
