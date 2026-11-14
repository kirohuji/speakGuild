import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { FileAssetGroup, Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import AdmZip = require('adm-zip');
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { OFFLINE_MODEL_CATALOG, OFFLINE_MODEL_JOB, OFFLINE_MODEL_QUEUE, modelPreset, ModelResourceFile, validateModelContents, validateResourceManifest } from './offline-model-catalog';
import { PrepareOfflineModelDto, ValidateOfflineModelDto } from './offline-models.dto';
import { writeModelArchive } from './model-archive';
import { modelSourceEndpoint } from './model-source';

@Injectable()
export class OfflineModelsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly assets: FileAssetsService,
    @InjectQueue(OFFLINE_MODEL_QUEUE) private readonly queue: Queue) {}

  get taskQueue() { return this.queue; }

  async onModuleInit() {
    const versions = await this.prisma.offlineModelVersion.findMany({ where: { status: { in: ['queued', 'downloading'] } } });
    for (const version of versions) {
      if (!version.taskId) continue;
      const task = await this.prisma.adminTask.findUnique({ where: { id: version.taskId } });
      if (!task || task.status === 'canceled') {
        await this.prisma.offlineModelVersion.updateMany({ where: { id: version.id, taskId: version.taskId }, data: { status: 'canceled' } });
        continue;
      }
      const job = task.bullJobId ? await this.queue.getJob(task.bullJobId) : null;
      if (job && ['active', 'waiting', 'delayed', 'prioritized'].includes(await job.getState())) continue;
      if (job) await job.remove();
      await this.enqueueTask(task.id, version.id);
    }
  }
  async list() {
    const versions = await this.prisma.offlineModelVersion.findMany({ orderBy: { createdAt: 'desc' } });
    const taskIds = versions.map(v => v.taskId).filter(Boolean);
    const tasks = taskIds.length ? await this.prisma.adminTask.findMany({ where: { id: { in: taskIds } } }) : [];
    return { catalog: OFFLINE_MODEL_CATALOG, versions: versions.map(v => ({ ...v, task: tasks.find(t => t.id === v.taskId) ?? null })) };
  }
  async detail(id: string) {
    const version = await this.ownedVersion(id);
    const task = version.taskId ? await this.prisma.adminTask.findUnique({ where: { id: version.taskId }, include: { logs: { orderBy: { createdAt: 'desc' }, take: 50 } } }) : null;
    return { ...version, task, bundleUrl: version.bundleAssetId ? this.assets.getAssetReference(version.bundleAssetId) : null };
  }
  private async ownedVersion(id: string) {
    const row = await this.prisma.offlineModelVersion.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('模型版本不存在');
    return row;
  }
  async prepare(userId: string, input: PrepareOfflineModelDto) {
    const preset = modelPreset(input.variantId);
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(input.version ?? '') || !/^[a-zA-Z0-9._-]{1,100}$/.test(input.sourceRevision ?? 'main')) throw new BadRequestException('版本号或来源版本格式不正确');
    if (input.importAssetId) {
      const asset = await this.prisma.fileAsset.findUnique({ where: { id: input.importAssetId } });
      if (!asset || !asset.filename.toLowerCase().endsWith('.zip') || asset.size > 600 * 1024 * 1024) throw new BadRequestException('请选择资源库中的离线模型 ZIP 包（最大 600 MB）');
    }
    let created: { id: string; taskId: string };
    try {
      created = await this.prisma.$transaction(async tx => {
        const version = await tx.offlineModelVersion.create({ data: {
          variantId: preset.variantId, version: input.version, modelId: preset.modelId, purpose: preset.purpose, dtype: preset.dtype,
          sourceRevision: input.sourceRevision ?? 'main', importAssetId: input.importAssetId, createdById: userId,
        } });
        const task = await tx.adminTask.create({ data: { type: OFFLINE_MODEL_JOB, title: `${input.importAssetId ? '导入' : '下载'} ${preset.label} · ${input.version}`, targetType: 'offline_model', targetId: version.id,
          totalItems: preset.files.length, createdById: userId, payload: { versionId: version.id } } });
        await tx.offlineModelVersion.update({ where: { id: version.id }, data: { taskId: task.id } });
        if (input.importAssetId) await this.assets.syncPersistentAssetReferences(tx, userId, 'offline_model_version', version.id, [this.assets.getAssetReference(input.importAssetId)]);
        return { id: version.id, taskId: task.id };
      });
    } catch (error: any) { if (error.code === 'P2002') throw new ConflictException('该型号的版本号已存在，请重试原任务或使用新版本号'); throw error; }
    await this.enqueueTask(created.taskId, created.id);
    return this.detail(created.id);
  }
  private async enqueueTask(taskId: string, versionId: string) {
    try {
      const job = await this.queue.add(OFFLINE_MODEL_JOB, { taskId, versionId }, { jobId: `offline-${taskId}`, attempts: 1, removeOnComplete: { age: 7 * 86400 }, removeOnFail: { age: 30 * 86400 } });
      await this.prisma.adminTask.update({ where: { id: taskId }, data: { bullJobId: job.id } });
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.adminTask.updateMany({ where: { id: taskId, status: { not: 'canceled' } }, data: { status: 'failed', errorMessage: '模型任务入队失败，请检查任务队列后重试' } }),
        this.prisma.offlineModelVersion.updateMany({ where: { id: versionId, taskId }, data: { status: 'failed', errorMessage: '模型任务入队失败' } }),
      ]);
      throw error;
    }
  }
  async retry(id: string, userId: string) {
    const result = await this.prisma.$transaction(async tx => {
      const row = await tx.offlineModelVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('模型版本不存在');
      if (row.isPublished || row.status === 'ready') throw new BadRequestException('已准备好的版本不需要重试');
      const current = row.taskId ? await tx.adminTask.findUnique({ where: { id: row.taskId } }) : null;
      if (current && ['queued', 'running'].includes(current.status)) return { taskId: current.id, queued: true };
      const task = await tx.adminTask.create({ data: { type: OFFLINE_MODEL_JOB, title: `重试 ${modelPreset(row.variantId).label} · ${row.version}`, targetType: 'offline_model', targetId: id,
        totalItems: modelPreset(row.variantId).files.length, createdById: userId, payload: { versionId: id } } });
      await tx.offlineModelVersion.update({ where: { id }, data: { status: 'queued', taskId: task.id, errorMessage: null } });
      return { taskId: task.id, queued: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result.queued) await this.enqueueTask(result.taskId, id);
    return this.detail(id);
  }
  async cancel(id: string, expectedTaskId?: string) {
    const row = await this.ownedVersion(id);
    if (expectedTaskId && row.taskId !== expectedTaskId) throw new BadRequestException('该版本已创建新任务，请操作当前任务');
    if (!['queued', 'downloading'].includes(row.status)) throw new BadRequestException('只能取消准备中的模型');
    await this.prisma.$transaction(async tx => {
      await tx.offlineModelVersion.updateMany({ where: { id, taskId: row.taskId, status: { in: ['queued', 'downloading'] } }, data: { status: 'canceled', errorMessage: '管理员已取消任务' } });
      if (row.taskId) await tx.adminTask.updateMany({ where: { id: row.taskId, status: { in: ['queued', 'running'] } }, data: { status: 'canceled', finishedAt: new Date(), currentStep: '已取消' } });
    });
    return this.detail(id);
  }
  async validate(id: string, input: ValidateOfflineModelDto) {
    if (!['unverified', 'passed', 'failed'].includes(input.deviceValidation) || (input.validationNote?.length ?? 0) > 2000) throw new BadRequestException('验证信息格式不正确');
    const row = await this.ownedVersion(id);
    if (row.isPublished && input.deviceValidation === 'failed') throw new BadRequestException('请先下架该版本，再标记验证失败');
    return this.prisma.offlineModelVersion.update({ where: { id }, data: input });
  }
  async publish(id: string) {
    return this.prisma.$transaction(async tx => {
      const row = await tx.offlineModelVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('模型版本不存在');
      if (row.status !== 'ready' || !row.bundleAssetId || row.deviceValidation === 'failed') throw new BadRequestException('模型尚未校验完成，或真机验证失败');
      const files = row.files as unknown as ModelResourceFile[];
      validateResourceManifest(modelPreset(row.variantId), files);
      const stored = await tx.fileAsset.findMany({ where: { id: { in: [...files.map(f => f.assetId), row.bundleAssetId] } } });
      if (files.some(file => !stored.some(asset => asset.id === file.assetId && asset.sha256 === file.sha256 && asset.size === file.size)) || !stored.some(a => a.id === row.bundleAssetId)) throw new BadRequestException('模型资源缺失或校验信息不一致');
      await tx.offlineModelVersion.updateMany({ where: { variantId: row.variantId, isPublished: true }, data: { isPublished: false } });
      return tx.offlineModelVersion.update({ where: { id }, data: { isPublished: true, publishedAt: new Date() } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async unpublish(id: string) { await this.ownedVersion(id); return this.prisma.offlineModelVersion.update({ where: { id }, data: { isPublished: false } }); }
  async remove(id: string) {
    return this.prisma.$transaction(async tx => {
      const row = await tx.offlineModelVersion.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('模型版本不存在');
      if (row.isPublished || ['queued', 'downloading'].includes(row.status)) throw new BadRequestException('请先下架或取消任务，再删除版本');
      await tx.fileReference.deleteMany({ where: { bizType: 'offline_model_version', bizId: id } });
      await tx.offlineModelVersion.delete({ where: { id } });
      return { removed: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async manifest(variantId: string) {
    modelPreset(variantId);
    const row = await this.prisma.offlineModelVersion.findFirst({ where: { variantId, isPublished: true, status: 'ready' } });
    if (!row) throw new NotFoundException('管理员尚未发布此型号的离线模型');
    const files = row.files as unknown as ModelResourceFile[];
    validateResourceManifest(modelPreset(variantId), files);
    return { id: row.id, version: row.version, modelId: row.modelId, variantId, dtype: row.dtype, totalBytes: row.totalBytes,
      files: files.map(file => ({ ...file, url: this.assets.getAssetReference(file.assetId) })) };
  }

  private async step(taskId: string, text: string, progress: number, summary?: object) {
    const updated = await this.prisma.adminTask.updateMany({ where: { id: taskId, status: { in: ['queued', 'running'] } }, data: {
      status: 'running', currentStep: text, progress: Math.min(99, progress), ...(summary ? { summary: summary as Prisma.InputJsonValue } : {}),
    } });
    if (!updated.count) throw new Error('任务已取消');
  }
  private async fetchToFile(url: string, target: string, signal: AbortSignal, maxBytes: number, onProgress?: (bytes: number, expected: number, bytesPerSecond: number) => Promise<void>) {
    const response = await fetch(url, { signal, headers: { 'Accept-Encoding': 'identity' } });
    if (!response.ok || !response.body) throw new Error(`下载源返回 HTTP ${response.status}`);
    const expected = Number(response.headers.get('content-length') ?? 0);
    if (expected > maxBytes) throw new Error('下载文件超过允许大小');
    let bytes = 0, lastProgress = 0;
    const started = Date.now();
    const speed = () => Math.round(bytes / Math.max(0.1, (Date.now() - started) / 1000));
    await mkdir(dirname(target), { recursive: true });
    const counter = new Transform({ transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > maxBytes ? new Error('下载文件超过允许大小') : null, chunk);
    } });
    counter.on('data', () => {
      if (onProgress && Date.now() - lastProgress > 1000) { lastProgress = Date.now(); void onProgress(bytes, expected, speed()).catch(() => undefined); }
    });
    await pipeline(Readable.fromWeb(response.body as any), counter, createWriteStream(target), { signal });
    if (!bytes || (expected && expected !== bytes)) throw new Error('下载文件不完整');
    await onProgress?.(bytes, expected || bytes, speed());
  }

  async run(taskId: string, id: string) {
    let version = await this.ownedVersion(id);
    const task = await this.prisma.adminTask.findUnique({ where: { id: taskId } });
    if (version.taskId !== taskId || !task || task.status === 'canceled' || version.status === 'ready') return;
    const abort = new AbortController();
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const [latest, current] = await Promise.all([this.prisma.offlineModelVersion.findUnique({ where: { id } }), this.prisma.adminTask.findUnique({ where: { id: taskId } })]);
        if (!latest || latest.taskId !== taskId || current?.status === 'canceled') abort.abort();
      } catch { abort.abort(new Error('无法确认任务状态，已停止下载')); } finally { polling = false; }
    }, 1500);
    const timeout = setTimeout(() => abort.abort(new Error('模型准备超过 30 分钟，请重试')), 30 * 60_000);
    let directory = '';
    const preset = modelPreset(version.variantId);
    const ready = (version.files as unknown as ModelResourceFile[]).slice();
    try {
      directory = await mkdtemp(join(tmpdir(), 'manyu-model-'));
      await this.prisma.offlineModelVersion.updateMany({ where: { id, taskId }, data: { status: 'downloading', errorMessage: null } });
      await this.prisma.adminTask.updateMany({ where: { id: taskId, status: { in: ['queued', 'running'] } }, data: { status: 'running', startedAt: new Date() } });
      let archive: AdmZip | null = null;
      let sourceMetadata: any = null;
      let sourceEndpoint = '';
      if (version.importAssetId) {
        await this.step(taskId, '读取资源库中的模型包', 1);
        const asset = await this.assets.getPrivateUrlByAssetId(version.importAssetId);
        const sourceZip = join(directory, 'import.zip');
        await this.fetchToFile(asset.url, sourceZip, abort.signal, 600 * 1024 * 1024, (loaded, total, bytesPerSecond) => this.step(taskId, '下载导入包', total ? Math.round(loaded / total * 10) : 2, { loadedBytes: loaded, expectedBytes: total, bytesPerSecond }));
        archive = new AdmZip(sourceZip);
        const entries = archive.getEntries();
        if (entries.length > 1000 || entries.some(entry => entry.entryName.startsWith('/') || entry.entryName.includes('\\') || entry.entryName.split('/').includes('..') || (entry.attr >>> 16 & 0xf000) === 0xa000) || entries.reduce((n, e) => n + e.header.size, 0) > 1200 * 1024 * 1024) throw new Error('模型包目录不安全或解压内容过大');
      } else {
        sourceEndpoint = modelSourceEndpoint();
        await this.step(taskId, `连接下载源 ${sourceEndpoint}，固定模型版本`, 1);
        await this.prisma.adminTaskLog.create({ data: { taskId, level: 'info', step: 'model-source', message: `模型下载源：${sourceEndpoint}` } });
        const revision = version.sourceCommit || version.sourceRevision;
        const response = await fetch(`${sourceEndpoint}/api/models/${preset.modelId}/revision/${encodeURIComponent(revision)}?blobs=true`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]) });
        if (!response.ok) throw new Error(`读取模型版本失败，下载源 HTTP ${response.status}`);
        sourceMetadata = await response.json();
        if (!/^[a-f0-9]{40}$/.test(sourceMetadata.sha)) throw new Error('下载源没有返回可固定的模型版本');
        const pinned = await this.prisma.offlineModelVersion.updateMany({ where: { id, taskId, status: 'downloading' }, data: { sourceCommit: sourceMetadata.sha } });
        if (!pinned.count) throw new Error('任务已取消');
        version = await this.ownedVersion(id);
      }
      const diskFiles: Array<{ path: string; diskPath: string }> = [];
      for (let index = 0; index < preset.files.length; index++) {
        if (abort.signal.aborted) throw new Error('任务已取消或超时');
        const path = preset.files[index], target = join(directory, path);
        await this.step(taskId, `准备 ${path}`, 10 + Math.round(index / preset.files.length * 75));
        const cached = ready.find(file => file.path === path);
        const stored = cached ? await this.prisma.fileAsset.findUnique({ where: { id: cached.assetId } }) : null;
        if (stored && stored.sha256 === cached!.sha256 && stored.size === cached!.size) {
          const asset = await this.assets.getPrivateUrlByAssetId(stored.id);
          await this.fetchToFile(asset.url, target, abort.signal, 600 * 1024 * 1024);
        } else if (archive) {
          const matches = archive.getEntries().filter(entry => !entry.isDirectory && (entry.entryName === path || entry.entryName.endsWith(`/${path}`)));
          if (matches.length !== 1 || matches[0].header.size > (path.endsWith('.json') ? 8 : 600) * 1024 * 1024) throw new Error(`模型包缺少或重复包含 ${path}`);
          const data = matches[0].getData();
          validateModelContents(path, data, preset.purpose);
          await mkdir(dirname(target), { recursive: true }); await writeFile(target, data);
        } else {
          const source = sourceMetadata.siblings?.find((entry: any) => entry.rfilename === path);
          if (!source) throw new Error(`固定版本缺少 ${path}`);
          const expected = Number(source.lfs?.size ?? source.size ?? 0);
          await this.fetchToFile(`${sourceEndpoint}/${preset.modelId}/resolve/${version.sourceCommit}/${path}`, target, AbortSignal.any([abort.signal, AbortSignal.timeout(10 * 60_000)]), (path.endsWith('.json') ? 8 : 600) * 1024 * 1024,
            (loaded, total, bytesPerSecond) => this.step(taskId, `下载 ${path}`, 10 + Math.round((index + (total || expected ? loaded / (total || expected) : 0)) / preset.files.length * 75), { file: path, loadedBytes: loaded, expectedBytes: total || expected, bytesPerSecond }));
          const size = (await stat(target)).size;
          if (expected && size !== expected) throw new Error(`文件大小不匹配：${path}`);
          const expectedSha = source.lfs?.sha256 || source.lfs?.oid?.replace(/^sha256:/, '');
          if (source.lfs && !expectedSha) throw new Error(`来源缺少权重校验信息：${path}`);
          if (expectedSha) {
            const hash = createHash('sha256'); for await (const chunk of (await import('node:fs')).createReadStream(target)) hash.update(chunk);
            if (hash.digest('hex') !== expectedSha) throw new Error(`SHA-256 校验失败：${path}`);
          } else if (source.blobId) {
            const data = await readFile(target);
            if (createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') !== source.blobId) throw new Error(`来源文件校验失败：${path}`);
          }
        }
        const size = (await stat(target)).size;
        if (path.endsWith('.json')) validateModelContents(path, await readFile(target), preset.purpose);
        else if (size < 1024 * 1024) throw new Error(`权重文件不完整：${path}`);
        const asset = await this.assets.createAssetFromPath({ path: target, filename: path.split('/').at(-1)!, mimeType: path.endsWith('.json') ? 'application/json' : 'application/octet-stream', group: FileAssetGroup.offline_model });
        // Pin each successful file immediately; failed jobs can resume using these resources.
        await this.assets.createSystemReference(asset.id, 'offline_model_version', id);
        const record = { path, assetId: asset.id, size: asset.size, sha256: asset.sha256 };
        const existingIndex = ready.findIndex(file => file.path === path);
        if (existingIndex >= 0) ready[existingIndex] = record; else ready.push(record);
        await this.prisma.offlineModelVersion.updateMany({ where: { id, taskId }, data: { files: ready as unknown as Prisma.InputJsonValue } });
        await this.prisma.adminTask.updateMany({ where: { id: taskId, status: 'running' }, data: { processedItems: index + 1, successItems: index + 1 } });
        await this.prisma.adminTaskLog.create({ data: { taskId, level: 'info', step: 'file-complete', message: `已校验并保存 ${path}`, meta: { assetId: asset.id, size: asset.size, sha256: asset.sha256 } } });
        diskFiles.push({ path, diskPath: target });
      }
      validateResourceManifest(preset, ready);
      await this.step(taskId, '生成完整模型包', 90);
      const manifestFile = join(directory, 'manifest.json');
      await writeFile(manifestFile, JSON.stringify({ modelId: preset.modelId, variantId: preset.variantId, version: version.version, sourceCommit: version.sourceCommit, files: ready }, null, 2));
      const bundle = join(directory, 'model.zip');
      await writeModelArchive(bundle, [...diskFiles, { path: 'manifest.json', diskPath: manifestFile }]);
      const asset = await this.assets.createAssetFromPath({ path: bundle, filename: `${preset.variantId}-${version.version}.zip`, mimeType: 'application/zip', group: FileAssetGroup.offline_model });
      await this.assets.createSystemReference(asset.id, 'offline_model_version', id);
      await this.prisma.$transaction(async tx => {
        const current = await tx.adminTask.findUnique({ where: { id: taskId } });
        const latest = await tx.offlineModelVersion.findUnique({ where: { id } });
        if (current?.status === 'canceled' || latest?.taskId !== taskId) throw new Error('任务已取消');
        await this.assets.syncPersistentAssetReferences(tx, version.createdById, 'offline_model_version', id, [...ready.map(file => this.assets.getAssetReference(file.assetId)), this.assets.getAssetReference(asset.id), ...(version.importAssetId ? [this.assets.getAssetReference(version.importAssetId)] : [])]);
        await tx.offlineModelVersion.update({ where: { id }, data: { status: 'ready', files: ready as unknown as Prisma.InputJsonValue, totalBytes: ready.reduce((sum, f) => sum + f.size, 0), bundleAssetId: asset.id } });
        await tx.adminTask.update({ where: { id: taskId }, data: { status: 'completed', progress: 100, currentStep: '模型文件校验完成，可发布', finishedAt: new Date(), summary: { versionId: id, files: ready.length, totalBytes: ready.reduce((sum, f) => sum + f.size, 0) } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      const current = await this.prisma.adminTask.findUnique({ where: { id: taskId } });
      const canceled = current?.status === 'canceled';
      const code = error.cause?.code || error.code;
      const message = canceled ? '管理员已取消任务' : /TIMEOUT|TIMEDOUT|ENOTFOUND|ECONNRESET|ECONNREFUSED/.test(code ?? '')
        ? `无法连接模型下载源（${code}），可重试或从资源库导入完整模型包`
        : `${error.message || '模型准备失败'}${code ? `（${code}）` : ''}`;
      await this.prisma.offlineModelVersion.updateMany({ where: { id, taskId }, data: { status: canceled ? 'canceled' : 'failed', errorMessage: message } });
      if (!canceled) await this.prisma.adminTask.updateMany({ where: { id: taskId, status: { not: 'canceled' } }, data: { status: 'failed', errorMessage: message, finishedAt: new Date() } });
      await this.prisma.adminTaskLog.create({ data: { taskId, level: canceled ? 'warn' : 'error', step: 'prepare-model', message } });
      if (!canceled) throw error;
    } finally { clearInterval(timer); clearTimeout(timeout); if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined); }
  }
}
