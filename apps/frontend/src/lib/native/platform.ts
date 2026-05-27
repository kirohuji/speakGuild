// ──────────────────────────────────────────────
// 平台检测 & 环境判断工具
// ──────────────────────────────────────────────

/** 是否运行在 Capacitor 原生环境中 */
export function isNative(): boolean {
  // Capacitor 在原生 WebView 时会注入 Capacitor 全局对象
  return typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor.isNative;
}

/** 获取当前平台: ios | android | web */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (!isNative()) return 'web';
  return (window as any).Capacitor.getPlatform() as 'ios' | 'android';
}

/** 是否为 iOS */
export function isIOS(): boolean { return getPlatform() === 'ios'; }

/** 是否为 Android */
export function isAndroid(): boolean { return getPlatform() === 'android'; }

/** 是否为 Web（浏览器） */
export function isWeb(): boolean { return getPlatform() === 'web'; }
