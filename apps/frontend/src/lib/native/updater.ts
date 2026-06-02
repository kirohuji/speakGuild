// ──────────────────────────────────────────────
// Updater 服务 — Capgo OTA 热更新（self-hosted）
//
// 依赖: @capgo/capacitor-updater
// 安装: pnpm --filter @manyu/frontend add @capgo/capacitor-updater
//
// 工作流程（autoUpdate: 'atBackground'）:
//   1. App 启动/恢复时，插件自动请求 updateUrl
//   2. 有新版本 → 后台下载 zip
//   3. 用户切后台 → 插件标记新 bundle 为下次使用
//   4. 下次启动 → 加载新 bundle
//   5. 启动失败 → 自动回滚到上一个可用版本
// ──────────────────────────────────────────────

import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNative, getPlatform } from './platform';
import type { UpdaterAPI } from './types';

type UpdateListener = (info: { version: string; url?: string }) => void;

const listeners: UpdateListener[] = [];

class UpdaterService implements UpdaterAPI {
  private _readyNotified = false;

  /**
   * 通知插件当前 bundle 启动成功。
   * 必须在 appReadyTimeout（默认 10s）内调用，否则插件认为 bundle 损坏并回滚。
   * 由 NativeBridgeProvider 在初始化时自动调用。
   */
  async notifyAppReady(): Promise<void> {
    if (!isNative()) return;
    if (this._readyNotified) return;

    try {
      await CapacitorUpdater.notifyAppReady();
      this._readyNotified = true;
      console.log('[Updater] notifyAppReady succeeded');
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
      const current = await CapacitorUpdater.getCurrent();
      // getCurrent 返回 { current: string; builtin: string }
      // 注意 capacitor-updater v8 返回格式可能不同
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

  /** 手动检查更新（通常不需要，autoUpdate 模式下插件自动处理） */
  async checkUpdate(): Promise<{ newVersion?: string; url?: string }> {
    if (!isNative()) return {};
    // 交由插件自动处理，这里保留手动触发能力
    return {};
  }

  /** 获取当前平台 */
  getPlatform(): 'ios' | 'android' | 'web' {
    return getPlatform();
  }

  /** 注册更新可用回调（插件检测到新版本时触发） */
  onUpdateAvailable(callback: (info: { version: string; url?: string }) => void): void {
    listeners.push(callback);
  }

  /** 设置下载进度回调 */
  onDownload(callback: (percent: number) => void): void {
    if (!isNative()) return;

    try {
      CapacitorUpdater.addListener('download', (state: any) => {
        callback(state?.percent ?? 0);
      });
    } catch {
      // 忽略非原生环境错误
    }
  }

  /** 设置更新失败回调 */
  onFailed(callback: (error: any) => void): void {
    if (!isNative()) return;

    try {
      CapacitorUpdater.addListener('updateFailed', (state: any) => {
        callback(state);
      });
    } catch {
      // 忽略非原生环境错误
    }
  }
}

export const updater = new UpdaterService();
export type { UpdaterService };

