import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useTheme } from 'next-themes';
import type { ThemeSetup } from './pixi-themes/types';
import { setupOcean } from './pixi-themes/ocean';
import { setupStars } from './pixi-themes/stars';
import { setupRain } from './pixi-themes/rain';
import { setupAurora } from './pixi-themes/aurora';

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

    const app = new PIXI.Application();
    let cancelled = false;

    app.init({
      width: w, height: h,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    }).then(() => {
      if (cancelled) { app.destroy(true); return; }
      container.appendChild(app.canvas);
      appRef.current = app;

      const setup: ThemeSetup =
        themeId?.includes('ocean')  ? setupOcean(app, w, h, isDark) :
        themeId?.includes('rain')   ? setupRain(app, w, h, isDark) :
        themeId?.includes('aurora') ? setupAurora(app, w, h, isDark) :
                                      setupStars(app, w, h, isDark, testMode);
      setupRef.current = setup;

      app.ticker.add((ticker) => {
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

    return () => {
      cancelled = true;
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
