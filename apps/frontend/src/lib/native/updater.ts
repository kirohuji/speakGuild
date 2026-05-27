// ──────────────────────────────────────────────
// Updater 服务 — Capgo OTA 热更新
//
// 使用前请先安装:
//   pnpm --filter @manyu/frontend add @capgo/capacitor-updater
//
// 安装后取消下方 import 注释即可启用
// ──────────────────────────────────────────────

// import { CapacitorUpdater } from '@capgo/capacitor-updater';
import type { UpdaterAPI } from './types';

const listeners: (() => void)[] = [];

class UpdaterService implements UpdaterAPI {
  async getCurrent(): Promise<{ version: string; downloaded: string; builtinVersion: string }> {
    return { version: 'web', downloaded: 'web', builtinVersion: 'web' };
  }

  async checkUpdate(): Promise<{ newVersion?: string; url?: string }> {
    return {};
  }

  onUpdateAvailable(callback: () => void): void {
    listeners.push(callback);
  }
}

export const updater: UpdaterAPI = new UpdaterService();
