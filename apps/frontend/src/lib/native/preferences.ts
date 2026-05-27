// ──────────────────────────────────────────────
// Preferences 服务 — 原生键值存储（替代 localStorage）
//
// 设计要点:
//   • 原生环境 → @capacitor/preferences (Native bridge)
//   • Web 环境   → localStorage (fallback)
//   • 值自动 JSON 序列化/反序列化
//   • 读失败返回 null，不抛异常
// ──────────────────────────────────────────────

import { Preferences } from '@capacitor/preferences';
import type { PreferencesAPI } from './types';
import { isNative } from './platform';

class PreferencesService implements PreferencesAPI {
  async get<T = any>(key: string): Promise<T | null> {
    if (isNative()) {
      try {
        const result = await Preferences.get({ key });
        if (result.value === null || result.value === undefined) return null;
        try { return JSON.parse(result.value) as T; } catch { return result.value as any; }
      } catch { /* fall through to localStorage */ }
    }

    // Web fallback
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      try { return JSON.parse(raw) as T; } catch { return raw as any; }
    } catch { return null; }
  }

  async set(key: string, value: any): Promise<void> {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (isNative()) {
      try { await Preferences.set({ key, value: strValue }); return; } catch { /* fall through */ }
    }

    try { localStorage.setItem(key, strValue); } catch {
      console.warn('[Preferences] localStorage quota exceeded');
    }
  }

  async remove(key: string): Promise<void> {
    if (isNative()) {
      try { await Preferences.remove({ key }); return; } catch { /* ignore */ }
    }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  async clear(): Promise<void> {
    if (isNative()) {
      try { await Preferences.clear(); return; } catch { /* ignore */ }
    }
    try { localStorage.clear(); } catch { /* ignore */ }
  }

  async keys(): Promise<string[]> {
    if (isNative()) {
      try { const result = await Preferences.keys(); return result.keys; } catch { return []; }
    }
    return Object.keys(localStorage);
  }
}

export const preferences: PreferencesAPI = new PreferencesService();
