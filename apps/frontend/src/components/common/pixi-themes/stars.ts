/**
 * ⭐ Stars Theme — 十字星芒 · 斗转星移
 *
 * ══════════════════ 颜色方案 ══════════════════
 *
 * Dark 模式:
 *   天空渐变: radial-gradient(ellipse at 40% 20%, rgba(120,100,180,0.25), transparent 50%),
 *            radial-gradient(ellipse at 70% 60%, rgba(60,40,120,0.2), transparent 50%),
 *            linear-gradient(160deg, #080612 0%, #0c0a1a 40%, #0a0818 100%)
 *   光晕装饰: hsla(260 50% 50% / 0.15) + hsla(200 40% 40% / 0.10)
 *   十字星:
 *     深空(80颗)  alpha 0.12-0.38  臂长 0.4-1.4px  线宽 0.12
 *     星野(50颗)  alpha 0.35-0.75  臂长 1.0-3.2px  线宽 0.22
 *     亮星(7颗)   alpha 0.55-0.95  臂长 1.8-3.8px  线宽 0.9 (核心) + 0.35 (星芒)
 *   星色分布: 60%冷白 #fff / 20%蓝白 #ddeeff / 15%暖白 #ffeedd / 5%淡金 #ffeecc
 *   亮星色:   #ffffdd, #ffeecc, #ffeedd, #ffffff, #ddeeff
 *   树影:     #030610  alpha 0.92
 *   流星:     #ffffff  直线拖尾 60-140px  alpha fade*0.4
 *
 * Light 模式:
 *   天空渐变: linear-gradient(135deg, #e8ecf4 0%, #f0f2f8 50%, #e4e8f2 100%)
 *   光晕装饰: hsla(260 50% 70% / 0.30) + hsla(220 40% 75% / 0.25)
 *   ⚠️ 当前 PixiJS 动画仅适配 Dark 模式，Light 模式下建议使用静态渐变背景
 */

import * as PIXI from 'pixi.js';
import type { ThemeSetup, Updatable } from './types';

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
    this.alpha = brightness;
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
    drawCross(this, this.half * 3, 0.35, this.starColor, a * 0.5);
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
    const tx = -this.tailLen * (this.vx / Math.hypot(this.vx, this.vy));
    const ty = -this.tailLen * (this.vy / Math.hypot(this.vx, this.vy));
    this.moveTo(0, 0);
    this.lineTo(tx, ty);
    this.stroke({ color: 0xffffff, width: 0.6, alpha: fade * 0.4 });
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

export function setupStars(app: PIXI.Application, w: number, h: number, _isDark: boolean): ThemeSetup {
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

  // ═══ 地面树影 ═══
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
  for (let i = 0; i < 6; i++) {
    pine(w * (0.0 + i * 0.045), h, h * (0.15 + Math.random() * 0.25), 30 + Math.random() * 50);
  }
  for (let i = 0; i < 4; i++) {
    pine(w * (0.82 + i * 0.04), h, h * (0.10 + Math.random() * 0.15), 20 + Math.random() * 30);
  }
  trees.fill({ color: 0x030610, alpha: 0.92 });
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
