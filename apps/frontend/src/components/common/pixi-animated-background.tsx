import { useEffect, useRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Application, useApplication, useTick } from '@pixi/react';
import { initDevtools } from '@pixi/devtools';
import type { ThemeSetup } from './pixi-themes/types';
import { setupOcean } from './pixi-themes/ocean';
import { setupStars } from './pixi-themes/stars';
import { setupRain } from './pixi-themes/rain';
import { setupAurora } from './pixi-themes/aurora';
import { setupLittlePrince } from './pixi-themes/little-prince';
import { isNative } from '@/lib/native/platform';

interface AnimatedBackgroundProps {
  themeId?: string;
  className?: string;
  /** 测试模式：强制显示月亮和银河 */
  testMode?: boolean;
}

// ═══════════════════════════════════════════════════════════
// Main Component — <Application> manages PixiJS lifecycle
// ═══════════════════════════════════════════════════════════

export function PixiAnimatedBackground({ themeId, testMode }: AnimatedBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const resolution = isNative() ? 1 : Math.min(window.devicePixelRatio, 2);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      <Application
        resizeTo={containerRef as React.RefObject<HTMLElement>}
        backgroundAlpha={0}
        antialias={!isNative()}
        resolution={resolution}
      >
        <PixiThemeLayer
          themeId={themeId}
          isDark={isDark}
          testMode={testMode}
        />
      </Application>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Inner Layer — runs inside <Application> context, has access
// to the PIXI.Application via useApplication() hook.
// ═══════════════════════════════════════════════════════════

function PixiThemeLayer({ themeId, isDark, testMode }: {
  themeId?: string;
  isDark: boolean;
  testMode?: boolean;
}) {
  const { app, isInitialised } = useApplication();
  const setupRef = useRef<ThemeSetup | null>(null);

  // Stable reference to the theme setup function
  const setupFn = useMemo(() => {
    if (themeId?.includes('ocean')) return setupOcean;
    if (themeId?.includes('rain')) return setupRain;
    if (themeId?.includes('aurora')) return setupAurora;
    if (themeId?.includes('little-prince')) return setupLittlePrince;
    return setupStars;
  }, [themeId]);

  // ── DevTools (dev only) ──
  useEffect(() => {
    if (!isInitialised || !import.meta.env.DEV) return;
    initDevtools({ app }).catch(() => { /* ignore */ });
  }, [app, isInitialised]);

  // ── Theme setup / teardown ──
  useEffect(() => {
    if (!isInitialised) return;

    // Clean up previous theme
    if (setupRef.current) {
      for (const item of setupRef.current.items) {
        app.stage.removeChild(item);
        item.destroy();
      }
      setupRef.current = null;
    }

    const w = app.screen.width;
    const h = app.screen.height;
    if (w === 0 || h === 0) return;

    const setup = setupFn(app, w, h, isDark, testMode);
    setupRef.current = setup;

    return () => {
      if (setupRef.current) {
        for (const item of setupRef.current.items) {
          app.stage.removeChild(item);
          item.destroy();
        }
        setupRef.current = null;
      }
    };
  }, [app, isInitialised, setupFn, isDark, testMode]);

  // ── Per-frame animation loop ──
  useTick((ticker) => {
    const setup = setupRef.current;
    if (!setup) return;

    // ★ 键盘弹出或 VN 激活时跳过渲染
    if (
      document.body.dataset.keyboardOpen === 'true' ||
      document.body.dataset.vnActive === 'true'
    ) return;

    const dt = ticker.deltaTime;
    const w = app.screen.width;
    const h = app.screen.height;
    const { items, onTick } = setup;

    for (let i = items.length - 1; i >= 0; i--) {
      if (typeof items[i].update !== 'function' || !items[i].update(dt, w, h)) {
        app.stage.removeChild(items[i]);
        items[i].destroy();
        items.splice(i, 1);
      }
    }
    onTick(dt, w, h, items);
  });

  // ── Pause ticker when page is hidden ──
  useEffect(() => {
    if (!isInitialised) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        app.ticker.stop();
      } else {
        app.ticker.start();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [app, isInitialised]);

  // This component doesn't render PixiJS children — all rendering is
  // done imperatively via the theme setup functions.
  return null;
}
