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

    let disposed = false;
    let listeners: { remove: () => Promise<void> | void }[] = [];
    let focusScrollTimer: number | undefined;

    const getKeyboardContext = () => {
      const activeElement = document.activeElement;
      if (activeElement?.closest('[data-keyboard-overlay]')) return 'overlay';
      if (document.querySelector('[data-keyboard-overlay]')) return 'overlay';
      return 'page';
    };

    const syncKeyboardContext = () => {
      if (document.body.dataset.keyboardOpen !== 'true') return;
      document.body.dataset.keyboardContext = getKeyboardContext();
    };

    const findScrollParent = (element: HTMLElement) => {
      const overlay = element.closest<HTMLElement>('[data-keyboard-overlay]');
      let current: HTMLElement | null = element.parentElement;
      while (current) {
        const style = window.getComputedStyle(current);
        const canScroll = /(auto|scroll)/.test(`${style.overflowY}${style.overflow}`);
        if (canScroll && current.scrollHeight > current.clientHeight) return current;
        if (current === overlay) break;
        current = current.parentElement;
      }
      return overlay;
    };

    const scrollFocusedInputIntoView = () => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return;
      if (!activeElement.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!activeElement.closest('[data-keyboard-overlay]')) return;

      const scrollParent = findScrollParent(activeElement);
      if (!scrollParent) return;

      const parentRect = scrollParent.getBoundingClientRect();
      const inputRect = activeElement.getBoundingClientRect();
      const targetTop = inputRect.top - parentRect.top + scrollParent.scrollTop;
      const centeredTop = targetTop - (parentRect.height - inputRect.height) / 2;

      scrollParent.scrollTo({
        top: Math.max(0, centeredTop),
        behavior: 'smooth',
      });
    };

    const scheduleFocusedInputScroll = () => {
      window.clearTimeout(focusScrollTimer);
      focusScrollTimer = window.setTimeout(scrollFocusedInputIntoView, 300); // 键盘动画完成后再滚动，避免冲突
    };

    const handleFocusIn = () => {
      syncKeyboardContext();
      scheduleFocusedInputScroll();
    };

    const setKeyboardOpen = (height: number) => {
      document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
      document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(height / -2)}px`);
      document.body.dataset.keyboardOpen = 'true';
      document.body.dataset.keyboardContext = getKeyboardContext();
      scheduleFocusedInputScroll();
    };

    const setKeyboardClosed = () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
      delete document.body.dataset.keyboardOpen;
      delete document.body.dataset.keyboardContext;
    };

    const overlayObserver = new MutationObserver(syncKeyboardContext);
    overlayObserver.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('focusin', handleFocusIn);

    import('@capacitor/keyboard')
      .then(async ({ Keyboard }) => {
        const onWillShow = await Keyboard.addListener('keyboardWillShow', (info) => {
          setKeyboardOpen(info.keyboardHeight ?? 0);
        });

        const onDidShow = await Keyboard.addListener('keyboardDidShow', (info) => {
          setKeyboardOpen(info.keyboardHeight ?? 0);
        });

        const onWillHide = await Keyboard.addListener('keyboardWillHide', setKeyboardClosed);
        const onDidHide = await Keyboard.addListener('keyboardDidHide', setKeyboardClosed);

        listeners = [onWillShow, onDidShow, onWillHide, onDidHide];
        if (disposed) {
          listeners.forEach((listener) => void listener.remove());
          listeners = [];
        }
      })
      .catch((err) => {
        console.warn('[KeyboardProvider] Failed to load @capacitor/keyboard:', err);
      });

    return () => {
      disposed = true;
      window.clearTimeout(focusScrollTimer);
      listeners.forEach((listener) => void listener.remove());
      overlayObserver.disconnect();
      document.removeEventListener('focusin', handleFocusIn);
      setKeyboardClosed();
    };
  }, []);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  useNativeKeyboard();
  return <>{children}</>;
}
