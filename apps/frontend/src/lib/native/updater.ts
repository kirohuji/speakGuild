// ──────────────────────────────────────────────
// Updater 服务 — Capgo OTA 热更新（self-hosted）
//
// 依赖: @capgo/capacitor-updater
// 安装: pnpm --filter @manyu/frontend add @capgo/capacitor-updater
//
// 工作流程（autoUpdate: 'atBackground'）:
//   1. App 启动/恢复时，插件自动请求 updateUrl
//   2. 有新版本 → 后台静默下载 zip（不打扰用户操作）
//   3. 普通更新：用户切后台 → 插件自动标记新 bundle 为下次使用 → 下次启动生效
//   4. 强制更新：下载完成后，本服务检测 isMandatory → 调 set() 立即重启
//   5. 启动失败 → 自动回滚到上一个可用版本
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

/** 模块级存储：最近一次 /mobile-updates/check 返回的 isMandatory 标记 */
let latestIsMandatory = false;

class UpdaterService implements UpdaterAPI {
  private _readyNotified = false;
  private _listenersRegistered = false;

  /**
   * 一次性注册所有 CapacitorUpdater 原生事件监听。
   * 幂等调用，由 NativeBridgeProvider 初始化时调用。
   */
  private registerListeners(): void {
    if (!isNative() || this._listenersRegistered) return;
    this._listenersRegistered = true;

    // 下载进度
    CapacitorUpdater.addListener('download', (state: any) => {
      const percent = state?.percent ?? 0;
      downloadListeners.forEach((cb) => cb(percent));
    });

    // 下载完成 → 判断是否强制更新
    CapacitorUpdater.addListener('downloadComplete', async (state: any) => {
      const bundleId: string = state?.bundleId ?? state?.id ?? '';
      const version: string = state?.version ?? state?.bundle?.version ?? '';

      // 通知所有监听器
      downloadCompleteListeners.forEach((cb) => cb({ bundleId, version }));

      // 强制更新：立即重启 App 应用新 bundle
      if (latestIsMandatory && bundleId) {
        console.log(`[Updater] Mandatory update detected, applying: ${version}`);
        try {
          // set() 会立即销毁 JS 上下文并重新加载，之后的代码不会执行
          await CapacitorUpdater.set({ id: bundleId });
        } catch (err) {
          console.error('[Updater] Mandatory set() failed:', err);
        }
      }
    });

    // 更新可用（插件检测到新版本，尚未下载）
    CapacitorUpdater.addListener('updateAvailable', (state: any) => {
      const info: UpdateInfo = {
        version: state?.version ?? state?.bundle?.version ?? '',
        url: state?.url,
        isMandatory: latestIsMandatory,
      };
      updateListeners.forEach((cb) => cb(info));
    });

    // 更新失败
    CapacitorUpdater.addListener('updateFailed', (state: any) => {
      failedListeners.forEach((cb) => cb(state));
    });
  }

  /**
   * 通知插件当前 bundle 启动成功。
   * 必须在 appReadyTimeout（默认 10s）内调用，否则插件认为 bundle 损坏并回滚。
   * 由 NativeBridgeProvider 在初始化时自动调用。
   *
   * 同时并行请求 /mobile-updates/check 以获取最新 isMandatory 标记，
   * 供 downloadComplete 事件中判断是否需要强制更新。
   */
  async notifyAppReady(): Promise<void> {
    if (!isNative()) return;
    if (this._readyNotified) return;

    // 首次调用时注册所有事件监听
    this.registerListeners();

    try {
      await CapacitorUpdater.notifyAppReady();
      this._readyNotified = true;
      console.log('[Updater] notifyAppReady succeeded');
    } catch (err) {
      console.warn('[Updater] notifyAppReady failed:', err);
    }

    // 并行请求检查强制更新标记（不阻塞，静默失败）
    this.fetchMandatoryFlag();
  }

  /**
   * 请求后端检查接口，仅提取 isMandatory 标记存入 latestIsMandatory。
   * 插件 autoUpdate 会自动处理实际的版本检查和下载。
   */
  private async fetchMandatoryFlag(): Promise<void> {
    try {
      const current = await this.getCurrent();
      const platform = getPlatform();
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://hope.lourd.top:2605';

      const res = await fetch(`${baseUrl}/mobile-updates/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          currentBundleVersion: current.version,
          channel: 'production',
        }),
      });

      const data = await res.json();
      latestIsMandatory = data.isMandatory ?? false;

      if (latestIsMandatory) {
        console.log('[Updater] Mandatory update available:', data.version);
      }
    } catch (err) {
      // 静默失败，不影响主流程
      console.warn('[Updater] fetchMandatoryFlag failed:', err);
    }
  }

  /** 获取当前包版本信息 */
  async getCurrent(): Promise<{ version: string; downloaded: string; builtinVersion: string }> {
    if (!isNative()) {
      return { version: 'web', downloaded: 'web', builtinVersion: 'web' };
    }

    try {
      const current = await CapacitorUpdater.current();
      const currentBundle = (current as any).current ?? (current as any).version ?? 'unknown';
      const builtin = (current as any).builtin ?? (current as any).builtinVersion ?? 'unknown';

      return {
        version: currentBundle,
        downloaded: currentBundle,
        builtinVersion: builtin,
      };
    } catch {
      return { version: 'unknown', downloaded: 'unknown', builtinVersion: 'unknown' };
    }
  }

  /**
   * 手动检查更新。
   * 注意：autoUpdate: 'atBackground' 模式下插件已自动处理。
   * 此方法直接请求后端检查接口，更新 latestIsMandatory 标记。
   * 如果发现强制更新且插件未自动下载，则手动触发下载+安装。
   */
  async checkUpdate(): Promise<{ newVersion?: string; url?: string; isMandatory?: boolean }> {
    if (!isNative()) return {};

    this.registerListeners();

    try {
      const current = await this.getCurrent();
      const platform = getPlatform();

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? 'https://hope.lourd.top:2605'}/mobile-updates/check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            currentBundleVersion: current.version,
            channel: 'production',
          }),
        },
      );

      const data = await res.json();
      if (data.version && data.url) {
        latestIsMandatory = data.isMandatory ?? false;

        // 强制更新：手动下载并立即安装
        if (latestIsMandatory) {
          const bundle = await CapacitorUpdater.download({
            url: data.url,
            version: data.version,
          });
          await CapacitorUpdater.set({ id: bundle.id });
          // set() 成功时会立即重新加载 App，不会执行到这行以下
        }

        return {
          newVersion: data.version,
          url: data.url,
          isMandatory: latestIsMandatory,
        };
      }
    } catch (err) {
      console.warn('[Updater] Manual checkUpdate failed:', err);
    }
    return {};
  }

  /** 获取当前平台 */
  getPlatform(): 'ios' | 'android' | 'web' {
    return getPlatform();
  }

  /** 注册更新可用回调（插件检测到新版本时触发，含 isMandatory 标记） */
  onUpdateAvailable(callback: (info: UpdateInfo) => void): void {
    this.registerListeners();
    updateListeners.push(callback);
  }

  /** 注册下载进度回调 */
  onDownload(callback: (percent: number) => void): void {
    this.registerListeners();
    downloadListeners.push(callback);
  }

  /** 注册下载完成回调 */
  onDownloadComplete(callback: (info: { bundleId: string; version: string }) => void): void {
    this.registerListeners();
    downloadCompleteListeners.push(callback);
  }

  /** 注册更新失败回调 */
  onFailed(callback: (error: any) => void): void {
    this.registerListeners();
    failedListeners.push(callback);
  }

  /**
   * 强制应用已下载的更新（立即重启 App）。
   * @param bundleId - 已下载 bundle 的 ID（从 downloadComplete 事件获取）
   */
  async applyMandatoryUpdate(bundleId: string): Promise<void> {
    if (!isNative()) return;

    try {
      console.log(`[Updater] Applying mandatory update: bundle ${bundleId}`);
      // set() 会立即销毁 JS 上下文并重新加载
      await CapacitorUpdater.set({ id: bundleId });
    } catch (err) {
      console.error('[Updater] Mandatory update failed:', err);
      throw err;
    }
  }
}

export const updater = new UpdaterService();
export type { UpdaterService, UpdateInfo };

