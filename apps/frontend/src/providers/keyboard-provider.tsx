// ──────────────────────────────────────────────
// KeyboardProvider — 原生键盘事件管理
//
// 解决 Capacitor 端键盘弹出时的卡顿和布局问题：
//   - 将键盘高度写入 CSS 变量 --keyboard-height
//   - 在 body 上设置 data-keyboard-open 属性（Pixi 背景据此暂停）
//   - 通过 React Context 暴露 open / height / availableHeight，供全屏页主动缩壳
//   - 仅原生环境生效，Web 端为 no-op
//
// 用法：在 App.tsx 的 Provider 链中加入 <KeyboardProvider>
//       页面内用 useKeyboard() 订阅状态
// ──────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isNative } from '@/lib/native/platform';

export type KeyboardState = {
  /** 软键盘是否打开（仅原生） */
  open: boolean
  /** 键盘高度 px */
  height: number
  /** 键盘上方可用高度 px（稳定视口 - 键盘） */
  availableHeight: number
}

const DEFAULT_KEYBOARD_STATE: KeyboardState = {
  open: false,
  height: 0,
  availableHeight: typeof window === 'undefined' ? 800 : window.innerHeight,
}

const KeyboardContext = createContext<KeyboardState>(DEFAULT_KEYBOARD_STATE)

export function useKeyboard() {
  return useContext(KeyboardContext);
}

/** 在原生端初始化键盘监听，Web 端无操作 */
function useNativeKeyboardController(setState: (next: KeyboardState) => void) {
  useEffect(() => {
    if (!isNative()) return;

    let disposed = false;
    let listeners: { remove: () => Promise<void> | void }[] = [];
    let focusScrollTimer: number | undefined;
    let stableViewportHeight = window.innerHeight;
    let currentKeyboardHeight = 0;

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
      const writingRegion = element.closest<HTMLElement>('[data-writing-scroll-region]');
      if (writingRegion) return writingRegion;

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
      // 普通写作 / 互译长文由页面按光标行滚；对话写作不带此标记，走整框滚。
      if (activeElement.closest('[data-writing-caret-scroll]')) return;

      const scrollParent = findScrollParent(activeElement);
      if (!scrollParent) return;

      const scrollTarget =
        activeElement.closest<HTMLElement>('[data-writing-block-scroll]') ?? activeElement;

      const parentRect = scrollParent.getBoundingClientRect();
      const inputRect = scrollTarget.getBoundingClientRect();
      const padding = 16;
      const safeTop = parentRect.top + padding;
      const safeBottom = Math.min(parentRect.bottom, stableViewportHeight - currentKeyboardHeight) - padding;

      if (inputRect.top >= safeTop && inputRect.bottom <= safeBottom) return;

      const scrollDelta =
        inputRect.bottom > safeBottom
          ? inputRect.bottom - safeBottom
          : inputRect.top - safeTop;

      scrollParent.scrollTo({
        top: Math.max(0, scrollParent.scrollTop + scrollDelta),
        behavior: 'auto',
      });
    };

    const scheduleFocusedInputScroll = () => {
      window.clearTimeout(focusScrollTimer);
      focusScrollTimer = window.setTimeout(scrollFocusedInputIntoView, 300);
    };

    const handleFocusIn = () => {
      syncKeyboardContext();
      scheduleFocusedInputScroll();
    };

    const setKeyboardOpen = (height: number) => {
      const keyboardHeight = Math.max(0, height || 0);
      currentKeyboardHeight = keyboardHeight;
      // KeyboardResize.None：innerHeight 不随键盘变，可用高度 = 稳定视口 - 键盘。
      if (stableViewportHeight < window.innerHeight) {
        stableViewportHeight = window.innerHeight;
      }
      const availableHeight = Math.max(240, stableViewportHeight - keyboardHeight);

      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(keyboardHeight / -2)}px`);
      document.documentElement.style.setProperty('--keyboard-available-height', `${Math.round(availableHeight)}px`);
      document.body.dataset.keyboardOpen = 'true';
      document.body.dataset.keyboardContext = getKeyboardContext();
      setState({ open: true, height: keyboardHeight, availableHeight });
      scheduleFocusedInputScroll();
    };

    const setKeyboardClosed = () => {
      currentKeyboardHeight = 0;
      stableViewportHeight = window.innerHeight;
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
      document.documentElement.style.setProperty('--keyboard-available-height', '100dvh');
      delete document.body.dataset.keyboardOpen;
      delete document.body.dataset.keyboardContext;
      setState({
        open: false,
        height: 0,
        availableHeight: stableViewportHeight,
      });
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
  }, [setState]);
}

type MockKeyboardChangeDetail = {
  visible?: boolean
  heightPx?: number
  viewportHeightPx?: number
}

/** Let the Mock Keyboard Chrome extension drive the existing layout in local development. */
function useWebMockKeyboardController(setState: (next: KeyboardState) => void) {
  useEffect(() => {
    if (!import.meta.env.DEV || isNative()) return;

    let mockKeyboardActive = false;

    const getKeyboardContext = () => {
      const activeElement = document.activeElement;
      if (activeElement?.closest('[data-keyboard-overlay]')) return 'overlay';
      if (document.querySelector('[data-keyboard-overlay]')) return 'overlay';
      return 'page';
    };

    const setKeyboardClosed = (availableHeight = window.innerHeight) => {
      mockKeyboardActive = false;
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
      document.documentElement.style.setProperty('--keyboard-available-height', '100dvh');
      delete document.body.dataset.keyboardOpen;
      delete document.body.dataset.keyboardContext;
      setState({ open: false, height: 0, availableHeight });
    };

    const handleMockKeyboardChange = (event: Event) => {
      const detail = (event as CustomEvent<MockKeyboardChangeDetail>).detail;
      const keyboardHeight = Math.max(0, detail?.heightPx ?? 0);
      const viewportHeight = Math.max(0, detail?.viewportHeightPx ?? window.innerHeight);

      if (!detail?.visible || keyboardHeight === 0) {
        setKeyboardClosed(viewportHeight);
        return;
      }

      mockKeyboardActive = true;
      const availableHeight = Math.max(240, viewportHeight - keyboardHeight);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(keyboardHeight / -2)}px`);
      document.documentElement.style.setProperty('--keyboard-available-height', `${Math.round(availableHeight)}px`);
      document.body.dataset.keyboardOpen = 'true';
      document.body.dataset.keyboardContext = getKeyboardContext();
      setState({ open: true, height: keyboardHeight, availableHeight });
    };

    window.addEventListener('mockkeyboardchange', handleMockKeyboardChange);

    return () => {
      window.removeEventListener('mockkeyboardchange', handleMockKeyboardChange);
      if (mockKeyboardActive) setKeyboardClosed();
    };
  }, [setState]);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KeyboardState>(DEFAULT_KEYBOARD_STATE);
  useNativeKeyboardController(setState);
  useWebMockKeyboardController(setState);
  const value = useMemo(() => state, [state]);
  return <KeyboardContext.Provider value={value}>{children}</KeyboardContext.Provider>;
}
