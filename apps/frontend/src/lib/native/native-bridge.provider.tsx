// ──────────────────────────────────────────────
// NativeBridgeProvider — React Context
//
// 用法:
//   const { splashScreen, statusBar, preferences, pushNotifications, filesystem } = useNativeBridge();
//
// 在 App.tsx 中包裹:
//   <NativeBridgeProvider>
//     <App />
//   </NativeBridgeProvider>
//
//   - notifyAppReady 首帧立即调用（有 10s 超时）
//   - OTA 检查延迟 15s，学习包检查延迟 10s
//   - resume 时检查至少间隔 5 分钟
// ──────────────────────────────────────────────

import React, { createContext, useContext } from 'react';
import type { NativeCapabilities } from './types';
import { isNative } from './platform';

// 静态导入所有服务实例（编译时确定，无异步开销）
import { splashScreen }   from './splash-screen';
import { statusBar }      from './status-bar';
import { updater }        from './updater';
import { preferences }    from './preferences';
import { pushNotifications } from './push-notifications';
import { filesystem }     from './filesystem';
import { revenueCat }     from './revenuecat';
import { Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { useLearningStore } from '@/stores/learning.store';

const capabilities: NativeCapabilities = {
  splashScreen,
  statusBar,
  updater,
  preferences,
  pushNotifications,
  filesystem,
  revenueCat,
};

const NativeBridgeContext = createContext<NativeCapabilities | null>(null);

const InitReadyContext = createContext<(() => void) | null>(null);

const RESUME_THROTTLE_MS = 5 * 60 * 1000; // 5 分钟

export function NativeBridgeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const initializedRef = React.useRef(false);
  const lastResumeCheckRef = React.useRef(0);

  const init = React.useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setReady(true);
    console.log('[NativeBridge] initialized, platform:', isNative() ? 'native' : 'web');
  }, []);

  React.useEffect(() => {
    const raf = window.requestAnimationFrame(init);
    return () => window.cancelAnimationFrame(raf);
  }, [init]);

  // 首帧就绪后：隐藏 SplashScreen + 设置状态栏 + 通知 OTA 就绪
  // notifyAppReady 必须在 10s 内调用，但 checkUpdate 和 pack check 延迟执行
  React.useEffect(() => {
    if (ready && isNative()) {
      // ★ 这些必须在首帧立即执行（尤其是 notifyAppReady，有 10s 超时）
      void capabilities.splashScreen.hide().catch(() => {});
      void capabilities.statusBar.setStyle({ style: Style.Dark }).catch(() => {});

      void capabilities.updater.notifyAppReady().catch((err) => {
        console.warn('[NativeBridge] notifyAppReady failed:', err);
      });

      void capabilities.revenueCat.configure().catch((err) => {
        console.warn('[NativeBridge] RevenueCat configure failed:', err);
      });

      // ★ OTA 检查延迟 15 秒
      setTimeout(() => {
        void capabilities.updater.checkUpdate().catch((err) => {
          console.warn('[NativeBridge] Startup checkUpdate failed:', err);
        });
      }, 15_000);

      // ★ 学习包检查延迟 10 秒
      setTimeout(() => {
        void useLearningStore.getState().checkPackUpdates(true).catch((err) => {
          console.warn('[NativeBridge] Startup learning pack check failed:', err);
        });
      }, 10_000);
    }
  }, [ready]);

  // ★ 监听 App 从后台恢复：节流检查，至少间隔 5 分钟
  React.useEffect(() => {
    if (!isNative()) return;

    let handle: { remove?: () => void } | null = null;

    App.addListener('resume', () => {
      const now = Date.now();
      if (now - lastResumeCheckRef.current < RESUME_THROTTLE_MS) {
        console.log('[NativeBridge] App resumed — skipped (throttled, last check was', Math.round((now - lastResumeCheckRef.current) / 1000), 's ago)');
        return;
      }
      lastResumeCheckRef.current = now;

      console.log('[NativeBridge] App resumed — scheduling update check...');

      setTimeout(() => {
        void capabilities.updater.checkUpdate().catch((err) => {
          console.warn('[NativeBridge] Resume checkUpdate failed:', err);
        });
      }, 5000);

      setTimeout(() => {
        void useLearningStore.getState().checkPackUpdates(true).catch((err) => {
          console.warn('[NativeBridge] Resume learning pack check failed:', err);
        });
      }, 8000);
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove?.();
    };
  }, []);

  return (
    <NativeBridgeContext.Provider value={capabilities}>
      <InitReadyContext.Provider value={init}>
        {children}
      </InitReadyContext.Provider>
    </NativeBridgeContext.Provider>
  );
}

export function useNativeBridge(): NativeCapabilities {
  const ctx = useContext(NativeBridgeContext);
  if (!ctx) {
    // Provider 未挂载时使用静态实例
    return capabilities;
  }
  return ctx;
}

/** 非 React 场景获取能力实例 */
export function getNativeBridge(): NativeCapabilities {
  return capabilities;
}

export function useNativeInitReady(): () => void {
  const init = useContext(InitReadyContext);
  if (!init) return () => {};
  return init;
}
