import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

interface AnimatedBackgroundProps {
  themeId?: string;
  className?: string;
}

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type Updatable = PIXI.Container & { update(dt: number, w: number, h: number): boolean };

interface ThemeSetup {
  items: Updatable[];
  onTick: (dt: number, w: number, h: number, items: Updatable[]) => void;
}

// ═══════════════════════════════════════════════════════════
// 🌊 Ocean — 月光潮汐 + 海浪泡沫 + 发光气泡
// ═══════════════════════════════════════════════════════════

class OceanWaveLayer extends PIXI.Graphics {
  phase = 0;
  constructor(
    private amplitude: number,
    private frequency: number,
    private baseY: number,
    private color: number,
    private fillAlpha: number,
    private speed: number,
    private xPoints: number[],
  ) { super(); this.phase = Math.random() * Math.PI * 2; }

  draw(w: number) {
    this.clear();
    this.moveTo(0, this.baseY + 400);
    for (const x of this.xPoints) {
      this.lineTo(x, this.baseY + Math.sin(x * this.frequency + this.phase) * this.amplitude);
    }
    this.lineTo(w, this.baseY + 400);
    this.closePath();
    this.fill({ color: this.color, alpha: this.fillAlpha });

    const firstY = this.baseY + Math.sin(this.xPoints[0] * this.frequency + this.phase) * this.amplitude;
    this.moveTo(this.xPoints[0], firstY);
    for (let i = 1; i < this.xPoints.length; i++) {
      this.lineTo(this.xPoints[i], this.baseY + Math.sin(this.xPoints[i] * this.frequency + this.phase) * this.amplitude);
    }
    this.stroke({ color: 0xffffff, width: 1.8, alpha: 0.5 });
  }

  update(dt: number, w: number) { this.phase += this.speed * 0.015 * dt; this.draw(w); return true; }
}

class GlowBubble extends PIXI.Graphics {
  vx = 0; vy = 0; life = 1; maxLife = 1; baseAlpha = 0;
  constructor(x: number, y: number) {
    super();
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vy = -0.3 - Math.random() * 0.7;
    this.maxLife = 60 + Math.random() * 80;
    this.life = this.maxLife;
    this.baseAlpha = 0.3 + Math.random() * 0.4;
    const r = 2 + Math.random() * 4;
    this.fill({ color: 0xaaddff, alpha: 1 });
    this.circle(0, 0, r * 2.5);
    this.fill();
    this.fill({ color: 0xffffff, alpha: 1 });
    this.circle(0, 0, r);
    this.fill();
    this.position.set(x, y);
    this.alpha = this.baseAlpha;
  }
  update(dt: number) {
    this.life -= dt;
    this.position.x += this.vx * dt;
    this.position.y += this.vy * dt;
    this.alpha = this.baseAlpha * Math.max(0, this.life / this.maxLife);
    return this.life > 0;
  }
}

class MoonShimmer extends PIXI.Graphics {
  life = 0; maxLife = 0;
  constructor(w: number, private baseY: number) {
    super();
    this.maxLife = 90 + Math.random() * 60;
    this.moveTo(0, 0);
    this.lineTo(w, 0);
    this.stroke({ color: 0xffffff, width: 2, alpha: 1 });
    this.position.y = baseY;
    this.alpha = 0;
  }
  update(dt: number) {
    this.life += dt;
    const t = this.life / this.maxLife;
    this.alpha = (t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1) * 0.06;
    return this.life < this.maxLife;
  }
}

function setupOcean(app: PIXI.Application, w: number, h: number): ThemeSetup {
  const items: Updatable[] = [];
  const xPoints: number[] = [];
  for (let i = 0; i <= 100; i++) xPoints.push((i / 100) * w);

  const waveDefs = [
    { y: h * 0.22, amp: 10, freq: 0.005, color: 0x0a3d5c, alpha: 0.07, speed: 0.22 },
    { y: h * 0.35, amp: 18, freq: 0.007, color: 0x0d5e8c, alpha: 0.10, speed: 0.40 },
    { y: h * 0.50, amp: 28, freq: 0.009, color: 0x1a8cba, alpha: 0.14, speed: 0.60 },
    { y: h * 0.66, amp: 40, freq: 0.012, color: 0x2db5d4, alpha: 0.18, speed: 0.85 },
  ];
  for (const def of waveDefs) {
    const wave = new OceanWaveLayer(def.amp, def.freq, def.y, def.color, def.alpha, def.speed, xPoints);
    wave.draw(w);
    app.stage.addChild(wave as any);
    items.push(wave as any);
  }

  for (let i = 0; i < 12; i++) {
    const b = new GlowBubble(Math.random() * w, h * (0.4 + Math.random() * 0.5));
    app.stage.addChild(b as any);
    items.push(b as any);
  }

  let bubbleTimer = 0;
  let shimmer: MoonShimmer | null = null;
  let shimmerCooldown = 200 + Math.random() * 300;

  const onTick = (dt: number) => {
    bubbleTimer += dt;
    if (bubbleTimer > 25) {
      bubbleTimer = 0;
      const b = new GlowBubble(Math.random() * w, h * (0.35 + Math.random() * 0.55));
      app.stage.addChild(b as any);
      items.push(b as any);
      while (items.filter(i => i instanceof GlowBubble).length > 20) {
        const idx = items.findIndex(i => i instanceof GlowBubble);
        if (idx >= 0) { app.stage.removeChild(items[idx]); items[idx].destroy(); items.splice(idx, 1); } else break;
      }
    }
    shimmerCooldown -= dt;
    if (!shimmer && shimmerCooldown <= 0) {
      shimmer = new MoonShimmer(w, h * (0.2 + Math.random() * 0.5));
      app.stage.addChild(shimmer as any);
      items.push(shimmer as any);
    }
    if (shimmer && !items.includes(shimmer as any)) {
      shimmer = null;
      shimmerCooldown = 200 + Math.random() * 400;
    }
  };

  return { items, onTick };
}

// ═══════════════════════════════════════════════════════════
// ⭐ Stars — 深空星河 + 星座连线 + 彗星拖尾
// ═══════════════════════════════════════════════════════════

/** 用路径画圆（与 Ocean/Aurora 相同的可靠模式） */
function drawCirclePath(g: PIXI.Graphics, cx: number, cy: number, r: number) {
  const segs = 8;
  g.moveTo(cx + r, cy);
  for (let i = 1; i <= segs; i++) {
    const a = (Math.PI * 2 * i) / segs;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

class GalaxyStar extends PIXI.Graphics {
  twinklePhase = 0; twinkleSpeed = 0;
  constructor(
    x: number, y: number, color: number, size: number,
    private baseAlpha: number, private driftVx = 0,
  ) {
    super();
    this.twinklePhase = Math.random() * Math.PI * 2;
    this.twinkleSpeed = 0.03 + Math.random() * 0.07;
    drawCirclePath(this, 0, 0, size);
    this.fill({ color, alpha: 1 });
    this.position.set(x, y);
    this.alpha = baseAlpha;
  }
  update(dt: number, _w: number, _h: number) {
    this.position.x += this.driftVx * dt * 0.02;
    if (this.position.x < -10) this.position.x = _w + 10;
    if (this.position.x > _w + 10) this.position.x = -10;
    this.twinklePhase += this.twinkleSpeed * dt;
    this.alpha = this.baseAlpha * (0.4 + 0.6 * Math.sin(this.twinklePhase));
    return true;
  }
}

class Comet extends PIXI.Graphics {
  vx = 0; vy = 0; life = 0; maxLife = 0; tailLen = 0;
  constructor(w: number, h: number) {
    super();
    this.vx = -3 - Math.random() * 2;
    this.vy = 1 + Math.random() * 1.5;
    this.maxLife = 50 + Math.random() * 50;
    this.life = this.maxLife;
    this.tailLen = 6 + Math.floor(Math.random() * 4);
    drawCirclePath(this, 0, 0, 2.5);
    this.fill({ color: 0xffffff, alpha: 1 });
    this.position.set(w * (0.3 + Math.random() * 0.5), h * (0.05 + Math.random() * 0.25));
  }
  update(dt: number) {
    this.life -= dt;
    this.position.x += this.vx * dt;
    this.position.y += this.vy * dt;
    this.clear();
    const fade = Math.max(0, this.life / this.maxLife);
    // 拖尾（从远到近画，远的更淡更小）
    for (let i = this.tailLen; i >= 0; i--) {
      const tx = -i * 10 * this.vx * 0.3;
      const ty = -i * 10 * this.vy * 0.3;
      drawCirclePath(this, tx, ty, 2 - i * 0.2);
      this.fill({ color: 0xffffff, alpha: fade * (1 - i / (this.tailLen + 1)) * 0.6 });
    }
    // 头部亮点
    drawCirclePath(this, 0, 0, 2.5);
    this.fill({ color: 0xffffff, alpha: fade });
    return this.life > 0;
  }
}

function setupStars(app: PIXI.Application, w: number, h: number): ThemeSetup {
  console.log('[PixiBG] setupStars() called, w=%d h=%d', w, h);
  const items: Updatable[] = [];
  const starColors = [0xffffff, 0xaaccff, 0xffeedd, 0xffccaa, 0xffccee];

  // 远景星（小、多、慢速视差漂移）
  for (let i = 0; i < 180; i++) {
    const s = new GalaxyStar(
      Math.random() * w, Math.random() * h * 0.88,
      starColors[i % 5], 1.2 + Math.random() * 2.5,
      0.3 + Math.random() * 0.45, 0.03 + Math.random() * 0.12,
    );
    app.stage.addChild(s as any); items.push(s as any);
  }
  // 中景星（中等大小和亮度）
  for (let i = 0; i < 60; i++) {
    const s = new GalaxyStar(
      Math.random() * w, Math.random() * h * 0.78,
      starColors[i % 5], 2 + Math.random() * 3.5,
      0.45 + Math.random() * 0.4, 0.08 + Math.random() * 0.2,
    );
    app.stage.addChild(s as any); items.push(s as any);
  }
  // 亮星 + 光晕（路径画圆）
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * w; const y = Math.random() * h * 0.6;
    const halo = new PIXI.Graphics();
    drawCirclePath(halo, 0, 0, 16 + Math.random() * 16);
    halo.fill({ color: 0xffffff, alpha: 0.08 });
    halo.position.set(x, y);
    (halo as any).update = () => true;
    app.stage.addChild(halo as any); items.push(halo as any);

    const s = new GalaxyStar(x, y, 0xffffdd, 3 + Math.random() * 4, 0.6 + Math.random() * 0.35);
    app.stage.addChild(s as any); items.push(s as any);
  }

  console.log('[PixiBG] stars created: %d items on stage', items.length);

  let cometTimer = 40 + Math.random() * 60;

  const onTick = (dt: number) => {
    cometTimer -= dt;
    if (cometTimer <= 0) {
      cometTimer = 40 + Math.random() * 80;
      const comet = new Comet(w, h);
      app.stage.addChild(comet as any); items.push(comet as any);
    }
  };

  return { items, onTick };
}

// ═══════════════════════════════════════════════════════════
// 🌧️ Rain — 窗边雨夜 + 斜雨 + 涟漪 + 闪电
// ═══════════════════════════════════════════════════════════

class WindRain extends PIXI.Graphics {
  vx = 0; vy = 0;
  constructor(w: number, private maxY: number, speed: number, alphaBase: number, isNear: boolean) {
    super();
    const len = isNear ? 10 + Math.random() * 20 : 5 + Math.random() * 10;
    const angle = isNear ? 0.35 : 0.25;
    this.vx = Math.sin(angle) * speed;
    this.vy = Math.cos(angle) * speed;
    this.moveTo(0, 0);
    this.lineTo(-Math.sin(angle) * len, -Math.cos(angle) * len);
    this.stroke({ color: 0xaaccff, width: isNear ? 1.2 : 0.5, alpha: alphaBase });
    this.position.set(Math.random() * w * 1.5 - w * 0.25, -Math.random() * maxY);
  }
  update(dt: number, _w: number, _h: number) {
    this.position.x += this.vx * dt;
    this.position.y += this.vy * dt;
    if (this.position.y > this.maxY + 20) {
      this.position.y = -40 - Math.random() * 60;
      this.position.x = Math.random() * _w * 1.5 - _w * 0.25;
    }
    return true;
  }
}

class GroundRipple extends PIXI.Graphics {
  life = 0; maxLife = 0; baseAlpha = 0;
  constructor(x: number, y: number) {
    super();
    this.maxLife = 30 + Math.random() * 30;
    this.life = this.maxLife;
    this.baseAlpha = 0.25 + Math.random() * 0.2;
    this.position.set(x, y);
  }
  update(dt: number) {
    this.life -= dt;
    this.clear();
    const r = 2 + (1 - this.life / this.maxLife) * 25;
    this.circle(0, 0, r);
    this.stroke({ color: 0xaaccff, width: 0.8, alpha: this.baseAlpha * (this.life / this.maxLife) });
    return this.life > 0;
  }
}

class WaterStreak extends PIXI.Graphics {
  life = 0; maxLife = 0; vy = 0;
  constructor(w: number) {
    super();
    this.maxLife = 100 + Math.random() * 150;
    this.life = this.maxLife;
    this.vy = 0.3 + Math.random() * 0.5;
    const len = 20 + Math.random() * 50;
    const ww = 1.5 + Math.random() * 3;
    this.fill({ color: 0xaaddff, alpha: 0.1 });
    this.ellipse(0, 0, ww, len);
    this.fill();
    this.position.set(Math.random() * w, -len - Math.random() * 200);
  }
  update(dt: number, _w: number, _h: number) {
    this.life -= dt;
    this.position.y += this.vy * dt;
    this.alpha = Math.max(0, this.life / this.maxLife) * 0.6;
    if (this.position.y > _h + 60) {
      this.position.y = -60 - Math.random() * 80;
      this.position.x = Math.random() * _w;
      this.life = this.maxLife;
    }
    return true;
  }
}

function setupRain(app: PIXI.Application, w: number, h: number): ThemeSetup {
  const items: Updatable[] = [];

  // 远景雨（细、淡、慢）
  for (let i = 0; i < 50; i++) {
    const r = new WindRain(w, h, 3 + Math.random() * 2, 0.12 + Math.random() * 0.15, false);
    app.stage.addChild(r as any); items.push(r as any);
  }
  // 近景雨（粗、亮、快）
  for (let i = 0; i < 25; i++) {
    const r = new WindRain(w, h, 5 + Math.random() * 4, 0.22 + Math.random() * 0.2, true);
    app.stage.addChild(r as any); items.push(r as any);
  }

  let rippleTimer = 0;
  let streakTimer = 0;
  let lightningTimer = 200 + Math.random() * 400;
  const flash = new PIXI.Graphics();
  flash.fill({ color: 0xffffff, alpha: 0 });
  flash.rect(0, 0, w, h);
  flash.fill();
  app.stage.addChild(flash as any);
  let flashFrames = 0;

  const onTick = (dt: number) => {
    rippleTimer += dt;
    if (rippleTimer > 8) {
      rippleTimer = 0;
      const rip = new GroundRipple(Math.random() * w, h * (0.85 + Math.random() * 0.12));
      app.stage.addChild(rip as any); items.push(rip as any);
    }
    streakTimer += dt;
    if (streakTimer > 40) {
      streakTimer = 0;
      const ws = new WaterStreak(w);
      app.stage.addChild(ws as any); items.push(ws as any);
    }
    if (flashFrames > 0) {
      flashFrames--;
      flash.alpha = flashFrames === 0 ? 0 : flashFrames === 1 ? 0.04 : 0.08;
    }
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningTimer = 250 + Math.random() * 500;
      flash.alpha = 0.08;
      flashFrames = 4;
    }
  };

  return { items, onTick };
}

// ═══════════════════════════════════════════════════════════
// 🌌 Aurora — 垂直极光帘幕 + 星光夜空
// ═══════════════════════════════════════════════════════════

class AuroraCurtain extends PIXI.Graphics {
  phase = 0; private yPoints: number[];
  constructor(
    screenH: number,
    private baseX: number,
    private bandWidth: number,
    private color: number,
    private baseAlpha: number,
    private speed: number,
  ) {
    super();
    this.phase = Math.random() * Math.PI * 2;
    this.yPoints = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) this.yPoints.push((i / steps) * screenH * 0.65);
  }

  draw() {
    this.clear();
    // 右侧（飘摆大）从上到下
    this.moveTo(this.baseX, 0);
    for (const y of this.yPoints) {
      const wave =
        Math.sin(y * 0.015 + this.phase) * 32 +
        Math.sin(y * 0.035 + this.phase * 1.6) * 20 +
        Math.sin(y * 0.008 + this.phase * 0.7) * 16;
      this.lineTo(this.baseX + this.bandWidth + wave, y);
    }
    // 底部收口
    const lastY = this.yPoints[this.yPoints.length - 1];
    this.lineTo(this.baseX - 5, lastY);
    // 左侧（飘摆小）从下往上
    for (let i = this.yPoints.length - 1; i >= 0; i--) {
      const y = this.yPoints[i];
      const wave =
        Math.sin(y * 0.015 + this.phase) * 7 +
        Math.sin(y * 0.035 + this.phase * 1.6) * 5;
      this.lineTo(this.baseX + wave, y);
    }
    this.closePath();
    this.fill({ color: this.color, alpha: this.baseAlpha });
  }

  update(dt: number) {
    this.phase += this.speed * 0.012 * dt;
    this.draw();
    return true;
  }
}

function setupAurora(app: PIXI.Application, w: number, h: number): ThemeSetup {
  const items: Updatable[] = [];

  // 7 条垂直帘幕，翠绿/青绿/紫/蓝/粉多色交织
  const curtainDefs = [
    { x: w * -0.01, width: 140, color: 0x00ff88, alpha: 0.13, speed: 0.35 },
    { x: w * 0.13, width: 110, color: 0x00ddbb, alpha: 0.11, speed: 0.50 },
    { x: w * 0.27, width: 160, color: 0x8844ff, alpha: 0.10, speed: 0.30 },
    { x: w * 0.41, width: 120, color: 0x00ff88, alpha: 0.14, speed: 0.45 },
    { x: w * 0.55, width: 110, color: 0x4488ff, alpha: 0.11, speed: 0.40 },
    { x: w * 0.69, width: 140, color: 0x00ddbb, alpha: 0.12, speed: 0.55 },
    { x: w * 0.83, width: 110, color: 0xff66aa, alpha: 0.09, speed: 0.48 },
  ];
  for (const def of curtainDefs) {
    const curtain = new AuroraCurtain(h, def.x, def.width, def.color, def.alpha, def.speed);
    curtain.draw();
    app.stage.addChild(curtain as any);
    items.push(curtain as any);
  }

  // 背景星光
  const starColors = [0xffffff, 0xaaccff, 0xffeedd];
  for (let i = 0; i < 50; i++) {
    const g = new PIXI.Graphics();
    g.fill({ color: starColors[i % 3], alpha: 0.2 + Math.random() * 0.4 });
    g.circle(0, 0, 0.5 + Math.random() * 1.5);
    g.fill();
    g.position.set(Math.random() * w, Math.random() * h * 0.8);
    app.stage.addChild(g as any);
    (g as any).update = () => true;
    items.push(g as any);
  }

  const onTick = () => {}; // 帘幕和星星均为静态，无需持续生成

  return { items, onTick };
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export function PixiAnimatedBackground({ themeId }: AnimatedBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const setupRef = useRef<ThemeSetup | null>(null);

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
    console.log('[PixiBG] useEffect fired, themeId=%s, size=%dx%d', themeId, w, h);
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

      console.log('[PixiBG] app.init() done, themeId=%s, picking setup...', themeId);
      const setup: ThemeSetup =
        themeId?.includes('ocean')  ? (console.log('[PixiBG] → ocean'), setupOcean(app, w, h)) :
        themeId?.includes('rain')   ? (console.log('[PixiBG] → rain'), setupRain(app, w, h)) :
        themeId?.includes('aurora') ? (console.log('[PixiBG] → aurora'), setupAurora(app, w, h)) :
                                      (console.log('[PixiBG] → stars (default)'), setupStars(app, w, h));
      setupRef.current = setup;
      console.log('[PixiBG] setup done, items=%d', setup.items.length);

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
