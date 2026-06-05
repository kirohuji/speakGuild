// ──────────────────────────────────────────────
// Updater 服务 — Capgo OTA 热更新（self-hosted / 纯手动模式）
//
// 依赖: @capgo/capacitor-updater
// 安装: pnpm --filter @manyu/frontend add @capgo/capacitor-updater
//
// 设计原则:
//   - capacitor.config.ts 中 autoUpdate: 'off'，插件不做任何自动操作
//   - 所有检查、下载、安装均由 updater.checkUpdate() 一手控制
//   - 不做并行请求，不依赖插件事件做控制流决策
//
// 工作流程:
//   1. 用户触发 checkUpdate()（或 App 启动时自动调用一次）
//   2. 请求 POST /mobile-updates/check → 获取 { version, url, isMandatory }
//   3. 有新版本 → CapacitorUpdater.download({ url, version }) → 后台下载
//   4. 强制更新 (isMandatory=true)  → download 完成后立即 set() 重启
//   5. 普通更新 (isMandatory=false) → download 完成后 next()，切后台后下次启动生效
//   6. 启动失败 → 自动回滚到上一个可用版本
// ──────────────────────────────────────────────

import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNative, getPlatform } from './platform';
import type { UpdaterAPI } from './types';

type UpdateInfo = { version: string; url?: string; isMandatory?: boolean };
type UpdateListener = (info: UpdateInfo) => void;
type DownloadCompleteListener = (info: { bundleId: string; version: string }) => void;
type DownloadListener = (percent: number) => void;
type FailedListener = (error: any) => void;

const updateListeners: UpdateListener[] = [];
const downloadCompleteListeners: DownloadCompleteListener[] = [];
const downloadListeners: DownloadListener[] = [];
const failedListeners: FailedListener[] = [];

class UpdaterService implements UpdaterAPI {
  private _readyNotified = false;
  private _listenersRegistered = false;
  /** 防止 checkUpdate() 重复调用 */
  private _checking = false;

  /**
   * 一次性注册 CapacitorUpdater 原生事件监听（仅用于进度上报和错误日志）。
   * 不做任何控制流决策——控制流完全在 checkUpdate() 中。
   */
  private registerListeners(): void {
    if (!isNative() || this._listenersRegistered) return;
    this._listenersRegistered = true;

    // 下载进度
    CapacitorUpdater.addListener('download', (state: any) => {
      const percent = state?.percent ?? 0;
      downloadListeners.forEach((cb) => cb(percent));
    });

    // 下载完成（仅日志 + 通知 UI 监听器，不做安装决策）
    CapacitorUpdater.addListener('downloadComplete', (state: any) => {
      const bundleId: string = state?.bundleId ?? state?.id ?? '';
      const version: string = state?.version ?? state?.bundle?.version ?? '';
      console.log(`[Updater] 📦 Download complete: v${version} (bundle: ${bundleId})`);
      downloadCompleteListeners.forEach((cb) => cb({ bundleId, version }));
    });

    // 更新失败
    CapacitorUpdater.addListener('updateFailed', (state: any) => {
      console.error('[Updater] ❌ Update failed:', state);
      failedListeners.forEach((cb) => cb(state));
    });

    console.log('[Updater] Native listeners registered ✅');
  }

  /**
   * 通知插件当前 bundle 启动成功。
   * 必须在 appReadyTimeout（默认 10s）内调用，否则插件认为 bundle 损坏并回滚。
   * 由 NativeBridgeProvider 在初始化时自动调用。
   *
   * 注意：纯手动模式下，不在此处检查更新。
   * 如需启动时自动检查，请在业务层调用 checkUpdate()。
   */
  async notifyAppReady(): Promise<void> {
    if (!isNative()) return;
    if (this._readyNotified) return;

    console.log('[Updater] 🚀 notifyAppReady — confirming bundle...');

    // 首次调用时注册事件监听（仅用于进度/错误上报）
    this.registerListeners();

    try {
      await CapacitorUpdater.notifyAppReady();
      this._readyNotified = true;
      console.log('[Updater] notifyAppReady succeeded ✅');
    } catch (err) {
      console.warn('[Updater] notifyAppReady failed:', err);
    }
  }

  /** 获取当前包版本信息 */
  async getCurrent(): Promise<{ version: string; downloaded: string; builtinVersion: string }> {
    if (!isNative()) {
      return { version: 'web', downloaded: 'web', builtinVersion: 'web' };
    }

    try {
      const current = await CapacitorUpdater.current();
      // 插件返回 { bundle: { id, version, ... }, native: "x.x.x" }
      const bundle = (current as any)?.bundle;
      const currentBundle = bundle?.version || (current as any)?.current || '';
      const builtin = (current as any)?.native || (current as any)?.builtin || bundle?.version || '';

      return {
        version: currentBundle,
        downloaded: currentBundle,
        builtinVersion: builtin,
      };
    } catch {
      // 首次安装时插件可能尚未初始化，返回空字符串让后端识别为首次安装
      return { version: '', downloaded: '', builtinVersion: '' };
    }
  }

  /**
   * ★ 核心方法：手动检查并应用更新。
   *
   * 完全由调用方控制时机。调用一次 = 检查 + 下载 + 安装 一条龙。
   * 有防重入保护（_checking 锁）。
   *
   * @returns 更新信息，无更新时返回空对象
   */
  async checkUpdate(): Promise<{ newVersion?: string; url?: string; isMandatory?: boolean }> {
    if (!isNative()) return {};
    if (this._checking) {
      console.log('[Updater] ⏳ Already checking, skip duplicate call');
      return {};
    }

    this._checking = true;
    this.registerListeners();

    try {
      const current = await this.getCurrent();
      const platform = getPlatform();
      // const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://hope.lourd.top:3605';

      // // 生产环境 nginx 把 /api/ 代理到后端，本地直连不需要 /api 前缀
      // const checkUrl = baseUrl.includes('localhost')
      //   ? `${baseUrl}/mobile-updates/check`
      //   : `${baseUrl}/api/mobile-updates/check`;

      const checkUrl = 'https://hope.lourd.top:3605/api/mobile-updates/check';
      console.log(`[Updater] 📡 Checking update: platform=${platform}, current=${current.version}, url=${checkUrl}`);

      // 1. 请求后端检查接口
      const res = await fetch(checkUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          currentBundleVersion: current.version,
          channel: 'production',
        }),
      });

      const data = await res.json();

      // 2. 无更新
      if (!data.version || !data.url) {
        console.log('[Updater] 📡 No update available');
        return {};
      }

      const isMandatory: boolean = data.isMandatory ?? false;
      console.log(`[Updater] 📡 Update found: v${data.version} (mandatory=${isMandatory})`);

      // 3. 通知监听器：发现新版本
      updateListeners.forEach((cb) => cb({ version: data.version, url: data.url, isMandatory }));

      // 4. 下载 bundle
      console.log(`[Updater] ⬇️ Downloading v${data.version}...`);
      const bundle = await CapacitorUpdater.download({
        url: data.url,
        version: data.version,
      });

      // 5. 根据是否强制更新决定安装方式
      if (isMandatory) {
        // 强制更新：立即重启应用新 bundle
        console.log(`[Updater] 🔥 Mandatory — applying NOW: v${data.version}`);
        await CapacitorUpdater.set({ id: bundle.id });
        // set() 成功时 JS 上下文立即销毁，不会执行到此行以下
      } else {
        // 普通更新：标记为下次启动时使用（切后台后生效）
        console.log(`[Updater] 📦 Normal — set as next bundle: v${data.version}`);
        await CapacitorUpdater.next({ id: bundle.id });
      }

      return {
        newVersion: data.version,
        url: data.url,
        isMandatory,
      };
    } catch (err) {
      console.error('[Updater] checkUpdate failed:', err);
      return {};
    } finally {
      this._checking = false;
    }
  }

  /** 获取当前平台 */
  getPlatform(): 'ios' | 'android' | 'web' {
    return getPlatform();
  }

  /** 注册：发现新版本回调 */
  onUpdateAvailable(callback: (info: UpdateInfo) => void): void {
    this.registerListeners();
    updateListeners.push(callback);
  }

  /** 注册：下载进度回调 (0-100) */
  onDownload(callback: (percent: number) => void): void {
    this.registerListeners();
    downloadListeners.push(callback);
  }

  /** 注册：下载完成回调 */
  onDownloadComplete(callback: (info: { bundleId: string; version: string }) => void): void {
    this.registerListeners();
    downloadCompleteListeners.push(callback);
  }

  /** 注册：更新失败回调 */
  onFailed(callback: (error: any) => void): void {
    this.registerListeners();
    failedListeners.push(callback);
  }
}

export const updater = new UpdaterService();
export type { UpdaterService, UpdateInfo };

