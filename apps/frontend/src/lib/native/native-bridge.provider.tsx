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
import { Style } from '@capacitor/status-bar/dist/esm/definitions';

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

  const init = React.useCallback(() => {
    if (!ready) {
      setReady(true);
      console.log('[NativeBridge] initialized, platform:', isNative() ? 'native' : 'web');
    }
  }, [ready]);

  // 自动隐藏 SplashScreen + 设置状态栏
  React.useEffect(() => {
    if (ready && isNative()) {
      capabilities.splashScreen.hide();
      capabilities.statusBar.setStyle({ style: Style.Dark}).catch(() => {}); // 兼容不支持的环境
    }
  }, [ready]);

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
