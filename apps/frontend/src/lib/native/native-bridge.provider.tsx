// ──────────────────────────────────────────────
// NativeBridgeProvider — React Context
//
// 用法:
//   const { splashScreen, statusBar, preferences } = useNativeBridge();
//
// Provider 链位置：<ThemeProvider> → <NativeBridgeProvider> → ...
//
// 启动时序（防止首帧卡顿）：
//   Frame 0 (rAF): SplashScreen.hide + StatusBar + notifyAppReady + RevenueCat
//   +10s:         学习包更新检查
//   +15s:         OTA 更新检查
//   resume:       节流 ≥5min，OTA+5s / 学习包+8s
// ──────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useRef } from 'react';
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
import type { PluginListenerHandle } from '@capacitor/core';
import { useLearningStore } from '@/stores/learning.store';
import { isDevHost } from '@/lib/dev-host';
import { localDb } from '@/lib/offline/unified-storage';

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

const RESUME_THROTTLE_MS = 5 * 60 * 1000; // 5 分钟

export function NativeBridgeProvider({ children }: { children: React.ReactNode }) {
  const lastResumeCheckRef = useRef(0);

  useEffect(() => {
    if (!isNative()) return;

    // ── 首帧立即执行（notifyAppReady 有 10s 超时硬要求）──
    void capabilities.splashScreen.hide().catch(() => {});
    void capabilities.statusBar.setStyle({ style: Style.Dark }).catch(() => {});
    void capabilities.updater.notifyAppReady().catch((err) => {
      console.warn('[NativeBridge] notifyAppReady failed:', err);
    });
    void capabilities.revenueCat.configure().catch((err) => {
      console.warn('[NativeBridge] RevenueCat configure failed:', err);
    });

    console.log('[NativeBridge] initialized (native)');

    // ── 延迟的重任务（避免竞争首帧渲染）──
    const t1 = setTimeout(() => {
      void useLearningStore.getState().checkPackUpdates(true).catch((err) => {
        console.warn('[NativeBridge] Startup learning pack check failed:', err);
      });
    }, 10_000);

    const t2 = setTimeout(() => {
      void capabilities.updater.checkUpdate().catch((err) => {
        console.warn('[NativeBridge] Startup checkUpdate failed:', err);
      });
    }, 15_000);

    // ── App 从后台恢复：节流检查 ──
    let resumeHandle: PluginListenerHandle | null = null;
    let pauseHandle: PluginListenerHandle | null = null;
    void (async () => {
      pauseHandle = await App.addListener('pause', () => {
        useLearningStore.getState().pauseActivePackTasks('应用已进入后台')
      })

      resumeHandle = await App.addListener('resume', () => {
        const now = Date.now();

        // ── dev:host: force SQLite reset + sync (no throttle) ──
        if (isDevHost) {
          console.log('[NativeBridge] dev:host resume — reset SQLite + sync...')
          // Drop all cached connection state so the next DB access
          // creates a fresh native connection.
          localDb.reset()
          // Sync checks on short timers so developers can verify the
          // offline/data pipeline without waiting 5 minutes.
          setTimeout(() => {
            void capabilities.updater.checkUpdate().catch((err) => {
              console.warn('[NativeBridge] dev:host checkUpdate failed:', err)
            })
          }, 2_000)
          setTimeout(() => {
            void useLearningStore.getState().checkPackUpdates(true).catch((err) => {
              console.warn('[NativeBridge] dev:host learning pack check failed:', err)
            })
          }, 4_000)
          lastResumeCheckRef.current = now
          return
        }

        if (now - lastResumeCheckRef.current < RESUME_THROTTLE_MS) {
          console.log('[NativeBridge] App resumed — skipped (throttled, last check was',
            Math.round((now - lastResumeCheckRef.current) / 1000), 's ago)');
          return;
        }
        lastResumeCheckRef.current = now;
        console.log('[NativeBridge] App resumed — scheduling update check...');

        setTimeout(() => {
          void capabilities.updater.checkUpdate().catch((err) => {
            console.warn('[NativeBridge] Resume checkUpdate failed:', err);
          });
        }, 5_000);

        setTimeout(() => {
          void useLearningStore.getState().checkPackUpdates(true).catch((err) => {
            console.warn('[NativeBridge] Resume learning pack check failed:', err);
          });
        }, 8_000);
      });
    })();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      pauseHandle?.remove();
      resumeHandle?.remove();
    };
  }, []);

  return (
    <NativeBridgeContext.Provider value={capabilities}>
      {children}
    </NativeBridgeContext.Provider>
  );
}

export function useNativeBridge(): NativeCapabilities {
  const ctx = useContext(NativeBridgeContext);
  // Provider 未挂载时回退到静态实例（SSR / 测试 / 非 React 场景安全）
  return ctx ?? capabilities;
}

/** 非 React 场景获取能力实例（如 request.ts 拦截器） */
export function getNativeBridge(): NativeCapabilities {
  return capabilities;
}
