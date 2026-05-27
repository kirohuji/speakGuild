// ──────────────────────────────────────────────
// 平台检测 & 环境判断工具
// ──────────────────────────────────────────────

import { Capacitor } from '@capacitor/core';

/** 是否运行在 Capacitor 原生环境中 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** 获取当前平台: ios | android | web */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

/** 是否为 iOS */
export function isIOS(): boolean { return getPlatform() === 'ios'; }

/** 是否为 Android */
export function isAndroid(): boolean { return getPlatform() === 'android'; }

/** 是否为 Web（浏览器） */
export function isWeb(): boolean { return getPlatform() === 'web'; }
