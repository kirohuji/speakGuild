// ──────────────────────────────────────────────
// SplashScreen 服务 — 控制原生启动画面
// ──────────────────────────────────────────────

import { SplashScreen } from '@capacitor/splash-screen';
import type { SplashScreenAPI } from './types';
import { isNative } from './platform';

class SplashScreenService implements SplashScreenAPI {
  async show(): Promise<void> {
    if (!isNative()) return;
    await SplashScreen.show({ autoHide: false, fadeInDuration: 200 });
  }

  async hide(options?: { fadeOutDuration?: number }): Promise<void> {
    if (!isNative()) return;
    await SplashScreen.hide({ fadeOutDuration: options?.fadeOutDuration ?? 300 });
    console.log('[NativeBridge] SplashScreen hidden');
  }
}

export const splashScreen: SplashScreenAPI = new SplashScreenService();
