// ──────────────────────────────────────────────
// KeyboardProvider — 原生键盘事件管理
//
// 解决 Capacitor 端键盘弹出时的卡顿和布局问题：
//   - 将键盘高度写入 CSS 变量 --keyboard-height
//   - 在 body 上设置 data-keyboard-open 属性（Pixi 背景据此暂停）
//   - 键盘弹出/收起时暂停/恢复动态背景
//   - 仅原生环境生效，Web 端为 no-op
//
// 用法：在 App.tsx 的 Provider 链中加入 <KeyboardProvider>
// ──────────────────────────────────────────────

import { useEffect, type ReactNode } from 'react';
import { isNative } from '@/lib/native/platform';

/** 在原生端初始化键盘监听，Web 端无操作 */
function useNativeKeyboard() {
  useEffect(() => {
    if (!isNative()) return;

    let listeners: { remove?: () => void }[] = [];

    import('@capacitor/keyboard')
      .then(({ Keyboard }) => {
        const onShow = Keyboard.addListener('keyboardWillShow', (info) => {
          const height = info.keyboardHeight ?? 0;
          document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
          document.body.dataset.keyboardOpen = 'true';
        });

        const onHide = Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.style.setProperty('--keyboard-height', '0px');
          delete document.body.dataset.keyboardOpen;
        });

        listeners = [onShow, onHide];
      })
      .catch((err) => {
        console.warn('[KeyboardProvider] Failed to load @capacitor/keyboard:', err);
      });

    return () => {
      listeners.forEach((l) => l?.remove?.());
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      delete document.body.dataset.keyboardOpen;
    };
  }, []);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  useNativeKeyboard();
  return <>{children}</>;
}
