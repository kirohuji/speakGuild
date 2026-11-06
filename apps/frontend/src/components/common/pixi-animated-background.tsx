import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Application, useApplication, useTick } from '@pixi/react';
import type { ThemeSetup } from './pixi-themes/types';
import { isNative } from '@/lib/native/platform';

type ThemeSetupFn = (
  app: any,
  width: number,
  height: number,
  isDark: boolean,
  testMode?: boolean,
) => ThemeSetup;

function loadThemeSetup(themeId?: string): Promise<ThemeSetupFn> {
  if (themeId?.includes('ocean')) {
    return import('./pixi-themes/ocean').then((m) => m.setupOcean);
  }
  if (themeId?.includes('rain')) {
    return import('./pixi-themes/rain').then((m) => m.setupRain);
  }
  if (themeId?.includes('aurora')) {
    return import('./pixi-themes/aurora').then((m) => m.setupAurora);
  }
  if (themeId?.includes('little-prince')) {
    return import('./pixi-themes/little-prince').then((m) => m.setupLittlePrince);
  }
  return import('./pixi-themes/stars').then((m) => m.setupStars);
}

interface AnimatedBackgroundProps {
  themeId?: string;
  className?: string;
  /** 测试模式：强制显示月亮和银河 */
  testMode?: boolean;
}

type StageChild = {
  parent?: { removeChild: (child: StageChild) => void } | null;
  destroy: (options?: unknown) => void;
};

interface ActiveThemeSetup {
  setup: ThemeSetup;
  roots: StageChild[];
}

function getViewportSize(app: any) {
  const canvas = app.canvas as HTMLCanvasElement | undefined;
  const width = Math.round(canvas?.clientWidth || app.screen.width || 0);
  const height = Math.round(canvas?.clientHeight || app.screen.height || 0);
  return { width, height };
}

function applyVisualScale(app: any, width: number, scale: number) {
  if (!app.stage) return;
  app.stage.pivot.set(width / 2, 0);
  app.stage.position.set(width / 2, 0);
  app.stage.scale.set(scale);
}

function cleanupTheme(active: ActiveThemeSetup | null) {
  if (!active) return;
  const rootSet = new Set(active.roots);

  for (const item of active.setup.items) {
    if (rootSet.has(item as unknown as StageChild)) continue;
    if (item.parent) item.parent.removeChild(item);
    item.destroy();
  }

  for (const root of active.roots) {
    if (root.parent) root.parent.removeChild(root);
    root.destroy({ children: true });
  }
}

// ═══════════════════════════════════════════════════════════
// Main Component — <Application> manages PixiJS lifecycle
// ═══════════════════════════════════════════════════════════

export function PixiAnimatedBackground({ themeId, testMode }: AnimatedBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const resolution = Math.min(window.devicePixelRatio || 1, 2);

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
        autoDensity
        resolution={resolution}
      >
        <PixiThemeLayer
          themeId={themeId}
          isDark={isDark}
          testMode={testMode}
          visualScale={resolution}
        />
      </Application>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Inner Layer — runs inside <Application> context, has access
// to the PIXI.Application via useApplication() hook.
// ═══════════════════════════════════════════════════════════

function PixiThemeLayer({ themeId, isDark, testMode, visualScale }: {
  themeId?: string;
  isDark: boolean;
  testMode?: boolean;
  visualScale: number;
}) {
  const { app, isInitialised } = useApplication();
  const setupRef = useRef<ActiveThemeSetup | null>(null);

  // ── DevTools (dev only) ──
  useEffect(() => {
    if (!isInitialised || !import.meta.env.DEV) return;
    let cancelled = false;
    void import('@pixi/devtools')
      .then(({ initDevtools }) => {
        if (!cancelled) return initDevtools({ app });
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [app, isInitialised]);

  // ── Theme setup / teardown ──
  useEffect(() => {
    if (!isInitialised) return;
    let cancelled = false;

    cleanupTheme(setupRef.current);
    setupRef.current = null;

    void loadThemeSetup(themeId).then((setupFn) => {
      if (cancelled) return;
      const { width: w, height: h } = getViewportSize(app);
      if (w === 0 || h === 0) return;

      applyVisualScale(app, w, visualScale);
      const before = new Set(app.stage.children as StageChild[]);
      const setup = setupFn(app, w, h, isDark, testMode);
      const roots = (app.stage.children as StageChild[]).filter((child) => !before.has(child));
      setupRef.current = { setup, roots };
    });

    return () => {
      cancelled = true;
      cleanupTheme(setupRef.current);
      setupRef.current = null;
    };
  }, [app, isInitialised, themeId, isDark, testMode, visualScale]);

  // ── Per-frame animation loop ──
  useTick((ticker) => {
    const active = setupRef.current;
    if (!active || !app.stage) return;

    // ★ 键盘弹出或 VN 激活时跳过渲染
    if (
      document.body.dataset.keyboardOpen === 'true' ||
      document.body.dataset.vnActive === 'true'
    ) return;

    const dt = ticker.deltaTime;
    const { width: w, height: h } = getViewportSize(app);
    const { items, onTick } = active.setup;
    applyVisualScale(app, w, visualScale);

    for (let i = items.length - 1; i >= 0; i--) {
      if (typeof items[i].update !== 'function' || !items[i].update(dt, w, h)) {
        if (app.stage) app.stage.removeChild(items[i]);
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
