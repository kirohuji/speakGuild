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
import { Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';

const capabilities: NativeCapabilities = {
  splashScreen,
  statusBar,
  updater,
  preferences,
  pushNotifications,
  filesystem,
};

const NativeBridgeContext = createContext<NativeCapabilities | null>(null);

const InitReadyContext = createContext<(() => void) | null>(null);

export function NativeBridgeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const initializedRef = React.useRef(false);

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

  // 自动隐藏 SplashScreen + 设置状态栏 + 通知 OTA 就绪 + 检查更新
  React.useEffect(() => {
    if (ready && isNative()) {
      void capabilities.splashScreen.hide().catch(() => {});
      void capabilities.statusBar.setStyle({ style: Style.Dark }).catch(() => {});

      // 告诉 CapacitorUpdater 当前 bundle 启动成功，防止误回滚
      void capabilities.updater.notifyAppReady().catch((err) => {
        console.warn('[NativeBridge] notifyAppReady failed:', err);
      });
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')
      console.log('.........我是最新版,我是最新')

      // ★ App 启动时检查 OTA 更新
      void capabilities.updater.checkUpdate().catch((err) => {
        console.warn('[NativeBridge] Startup checkUpdate failed:', err);
      });
    }
  }, [ready]);

  // ★ 监听 App 从后台恢复：每次回来都检查一次更新
  React.useEffect(() => {
    if (!isNative()) return;

    let handle: { remove?: () => void } | null = null;

    App.addListener('resume', () => {
      console.log('[NativeBridge] App resumed — checking update...');
      void capabilities.updater.checkUpdate().catch((err) => {
        console.warn('[NativeBridge] Resume checkUpdate failed:', err);
      });
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
