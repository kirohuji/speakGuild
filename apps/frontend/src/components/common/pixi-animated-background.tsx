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
// ⭐ Stars — 十字星芒 · 斗转星移
// ═══════════════════════════════════════════════════════════

/** 画十字星：两条垂直相交的线 */
function drawCross(g: PIXI.Graphics, half: number, thickness: number, color: number, alpha: number) {
  g.moveTo(-half, 0);
  g.lineTo(half, 0);
  g.moveTo(0, -half);
  g.lineTo(0, half);
  g.stroke({ color, width: thickness, alpha });
}

/** 不规则闪烁：多频叠加，自然的"抖动感" */
function organicTwinkle(phase: number): number {
  return Math.sin(phase) * 0.6 + Math.sin(phase * 2.7 + 0.8) * 0.25 + Math.sin(phase * 5.3 + 1.5) * 0.15;
}

/** 聚簇随机位置 */
function clusterPos(w: number, h: number, maxY: number): { x: number; y: number } {
  if (Math.random() < 0.3) {
    const cx = w * (0.15 + Math.random() * 0.7);
    const cy = h * (0.1 + Math.random() * maxY * 0.6);
    const a = Math.random() * Math.PI * 2;
    const d = (Math.random() + Math.random() + Math.random()) / 3 * w * 0.12;
    return {
      x: Math.max(0, Math.min(w, cx + Math.cos(a) * d)),
      y: Math.max(0, Math.min(h * maxY, cy + Math.sin(a) * d)),
    };
  }
  return { x: Math.random() * w, y: Math.random() * h * maxY };
}

function starColor(): number {
  const r = Math.random();
  if (r < 0.60) return 0xffffff;
  if (r < 0.80) return 0xddeeff;
  if (r < 0.95) return 0xffeedd;
  return 0xffeecc;
}

// ── 十字星 ──
class Star extends PIXI.Graphics {
  twinklePhase = 0;
  constructor(
    private starColor: number,
    private half: number,
    private thickness: number,
    private baseAlpha: number,
    private twinkleSpeed: number,
    private twinkleAmp: number,
  ) {
    super();
    this.twinklePhase = Math.random() * Math.PI * 2;
    this.redraw(1);
  }
  private redraw(brightness: number) {
    this.clear();
    const a = this.baseAlpha * brightness;
    drawCross(this, this.half, this.thickness, this.starColor, a);
  }
  update(dt: number) {
    this.twinklePhase += this.twinkleSpeed * dt;
    const raw = organicTwinkle(this.twinklePhase);
    const brightness = 1 - this.twinkleAmp + this.twinkleAmp * (0.5 + 0.5 * raw);
    this.alpha = brightness; // DisplayObject alpha 控制整体
    return true;
  }
}

// ── 亮星：单层十字星芒 ──
class BrightStar extends PIXI.Graphics {
  twinklePhase = 0;
  private starColor: number;
  private half: number;
  private baseAlpha: number;
  private twinkleSpd: number;

  constructor(color: number, half: number, baseAlpha: number, twinkleSpeed: number) {
    super();
    this.starColor = color;
    this.half = half;
    this.baseAlpha = baseAlpha;
    this.twinkleSpd = twinkleSpeed;
    this.twinklePhase = Math.random() * Math.PI * 2;
    this.draw(1);
  }
  private draw(brightness: number) {
    this.clear();
    const a = this.baseAlpha * brightness;
    // 单层十字星芒：细长
    drawCross(this, this.half * 3, 0.35, this.starColor, a * 0.5);
    // 核心粗十字
    drawCross(this, this.half, 0.9, this.starColor, a);
  }
  update(dt: number) {
    this.twinklePhase += this.twinkleSpd * dt;
    const raw = organicTwinkle(this.twinklePhase);
    const brightness = 0.4 + 0.6 * (0.5 + 0.5 * raw);
    this.alpha = brightness;
    return true;
  }
}

// ── 流星：亮点 + 直线拖尾 ──
class Comet extends PIXI.Graphics {
  vx = 0; vy = 0; life = 0; maxLife = 0; tailLen = 0;
  constructor(w: number, h: number) {
    super();
    this.vx = -3 - Math.random() * 2;
    this.vy = 1 + Math.random() * 1.5;
    this.maxLife = 45 + Math.random() * 45;
    this.life = this.maxLife;
    this.tailLen = 60 + Math.random() * 80;
    this.position.set(w * (0.3 + Math.random() * 0.5), h * (0.05 + Math.random() * 0.2));
    this.draw();
  }
  private draw() {
    this.clear();
    const fade = Math.max(0, this.life / this.maxLife);
    // 直线拖尾
    const tx = -this.tailLen * (this.vx / Math.hypot(this.vx, this.vy));
    const ty = -this.tailLen * (this.vy / Math.hypot(this.vx, this.vy));
    this.moveTo(0, 0);
    this.lineTo(tx, ty);
    this.stroke({ color: 0xffffff, width: 0.6, alpha: fade * 0.4 });
    // 头部亮点（十字）
    this.moveTo(-3, 0); this.lineTo(3, 0);
    this.moveTo(0, -3); this.lineTo(0, 3);
    this.stroke({ color: 0xffffff, width: 1, alpha: fade });
  }
  update(dt: number) {
    this.life -= dt;
    this.position.x += this.vx * dt;
    this.position.y += this.vy * dt;
    this.draw();
    return this.life > 0;
  }
}

function setupStars(app: PIXI.Application, w: number, h: number): ThemeSetup {
  const items: Updatable[] = [];

  // ═══ 深空纹理：极微十字星，密密麻麻 ═══
  for (let i = 0; i < 80; i++) {
    const pos = clusterPos(w, h, 0.92);
    const s = new Star(starColor(), 0.4 + Math.random() * 1.0, 0.12, 0.12 + Math.random() * 0.26, 0.003 + Math.random() * 0.01, 0.15 + Math.random() * 0.25);
    s.position.set(pos.x, pos.y);
    app.stage.addChild(s as any); items.push(s as any);
  }

  // ═══ 星野：可见十字星，密集分布 ═══
  for (let i = 0; i < 50; i++) {
    const pos = clusterPos(w, h, 0.85);
    const s = new Star(starColor(), 1 + Math.random() * 2.2, 0.22, 0.35 + Math.random() * 0.40, 0.010 + Math.random() * 0.022, 0.40 + Math.random() * 0.40);
    s.position.set(pos.x, pos.y);
    app.stage.addChild(s as any); items.push(s as any);
  }

  // ═══ 亮星：单层十字星芒 ═══
  const brightColors = [0xffffdd, 0xffeecc, 0xffeedd, 0xffffff, 0xddeeff, 0xffffff, 0xffffdd];
  for (let i = 0; i < 7; i++) {
    const pos = clusterPos(w, h, 0.6);
    const s = new BrightStar(brightColors[i], 1.8 + Math.random() * 2, 0.55 + Math.random() * 0.40, 0.015 + Math.random() * 0.020);
    s.position.set(pos.x, pos.y);
    app.stage.addChild(s as any); items.push(s as any);
  }

  // ═══ 左下角地面树影 ═══
  const treeColor = 0x030610;
  const treeAlpha = 0.92;
  const trees = new PIXI.Graphics();
  const pine = (tx: number, baseY: number, treeH: number, treeW: number) => {
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const topY = baseY - treeH + (i / layers) * treeH * 0.75;
      const botY = topY + (treeH / layers) * 1.4;
      const lw = treeW * (1 - i * 0.22);
      trees.moveTo(tx, topY);
      trees.lineTo(tx - lw / 2, botY);
      trees.lineTo(tx + lw / 2, botY);
      trees.closePath();
    }
    trees.moveTo(tx - 2, baseY);
    trees.lineTo(tx - 2, baseY + treeH * 0.15);
    trees.lineTo(tx + 2, baseY + treeH * 0.15);
    trees.lineTo(tx + 2, baseY);
    trees.closePath();
  };
  // 从左边延伸过来的树线，作为地面轮廓
  for (let i = 0; i < 6; i++) {
    const tx = w * (0.0 + i * 0.045);
    const th = h * (0.15 + Math.random() * 0.25);
    const tw = 30 + Math.random() * 50;
    pine(tx, h, th, tw);
  }
  // 右下角也来几棵小的，形成地面线
  for (let i = 0; i < 4; i++) {
    const tx = w * (0.82 + i * 0.04);
    const th = h * (0.10 + Math.random() * 0.15);
    const tw = 20 + Math.random() * 30;
    pine(tx, h, th, tw);
  }
  trees.fill({ color: treeColor, alpha: treeAlpha });
  app.stage.addChild(trees as any);

  // ═══ 斗转星移 ═══
  const cosmos = new PIXI.Container();
  cosmos.x = w / 2;
  cosmos.y = h / 2;
  for (const item of items) {
    app.stage.removeChild(item);
    item.position.x -= w / 2;
    item.position.y -= h / 2;
    cosmos.addChild(item);
  }
  app.stage.addChild(cosmos as any);

  let cometTimer = 80 + Math.random() * 140;
  const onTick = (dt: number) => {
    cosmos.rotation += 0.00006 * dt;
    cometTimer -= dt;
    if (cometTimer <= 0) {
      cometTimer = 80 + Math.random() * 160;
      const comet = new Comet(w, h);
      comet.position.x -= w / 2;
      comet.position.y -= h / 2;
      cosmos.addChild(comet as any);
      items.push(comet as any);
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
        themeId?.includes('ocean')  ? setupOcean(app, w, h) :
        themeId?.includes('rain')   ? setupRain(app, w, h) :
        themeId?.includes('aurora') ? setupAurora(app, w, h) :
                                      setupStars(app, w, h);
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
