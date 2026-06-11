import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useTheme } from 'next-themes';
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
// Main Component
// ═══════════════════════════════════════════════════════════

export function PixiAnimatedBackground({ themeId, testMode }: AnimatedBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const setupRef = useRef<ThemeSetup | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  useEffect(() => {
    if (appRef.current) {
      appRef.current.destroy(true, { children: true });
      appRef.current = null;
    }
    setupRef.current = null;

    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;

    // ★ 原生移动端降低分辨率到 1
    const resolution = isNative() ? 1 : Math.min(window.devicePixelRatio, 2);

    const app = new PIXI.Application();
    let cancelled = false;

    app.init({
      width: w, height: h,
      backgroundAlpha: 0,
      antialias: !isNative(),
      resolution,
    }).then(() => {
      if (cancelled) { app.destroy(true); return; }
      container.appendChild(app.canvas);
      appRef.current = app;

      const setup: ThemeSetup =
        themeId?.includes('ocean')         ? setupOcean(app, w, h, isDark, testMode) :
        themeId?.includes('rain')          ? setupRain(app, w, h, isDark, testMode) :
        themeId?.includes('aurora')        ? setupAurora(app, w, h, isDark) :
        themeId?.includes('little-prince') ? setupLittlePrince(app, w, h, isDark) :
                                             setupStars(app, w, h, isDark, testMode);
      setupRef.current = setup;

      app.ticker.add((ticker) => {
        // ★ 键盘弹出或 VN 激活时跳过渲染
        if (
          document.body.dataset.keyboardOpen === 'true' ||
          document.body.dataset.vnActive === 'true'
        ) return;

        const dt = ticker.deltaTime;
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
    });

    // ★ 页面不可见时暂停 ticker
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        app.ticker.stop();
      } else {
        app.ticker.start();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [themeId]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
    />
  );
}
