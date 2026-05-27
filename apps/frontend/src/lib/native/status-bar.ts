// ──────────────────────────────────────────────
// StatusBar 服务 — 控制状态栏样式
// ──────────────────────────────────────────────

import { StatusBar, Style } from '@capacitor/status-bar';
import type { StatusBarAPI, StatusBarStyle } from './types';
import { isNative } from './platform';

class StatusBarService implements StatusBarAPI {
  async setStyle(options: { style: StatusBarStyle }): Promise<void> {
    if (!isNative()) return;
    await StatusBar.setStyle({ style: options.style as any });
  }

  async setBackgroundColor(options: { color: string }): Promise<void> {
    if (!isNative()) return;
    await StatusBar.setBackgroundColor({ color: options.color });
  }

  async show(): Promise<void> {
    if (!isNative()) return;
    await StatusBar.show();
  }

  async hide(): Promise<void> {
    if (!isNative()) return;
    await StatusBar.hide();
  }

  async getInfo(): Promise<{ visible: boolean; style: StatusBarStyle; color: string; overlays: boolean }> {
    if (!isNative()) return { visible: true, style: 'Dark' as StatusBarStyle, color: '#000000', overlays: false };
    return StatusBar.getInfo() as any;
  }
}

export const statusBar: StatusBarAPI = new StatusBarService();
