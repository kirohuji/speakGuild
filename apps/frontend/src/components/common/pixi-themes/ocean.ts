/**
 * 🌊 Ocean Theme — 月光潮汐 + 海浪泡沫 + 发光气泡
 *
 * ══════════════════ 颜色方案 ══════════════════
 *
 * Dark 模式:
 *   天空:   linear-gradient(155deg, #0a1628 0%, #0d2847 40%, #061220 100%)
 *   海浪层:
 *     远层   #0a3d5c  alpha 0.07  @ 22%屏高  小振幅 慢速
 *     中远   #0d5e8c  alpha 0.10  @ 35%屏高
 *     中近   #1a8cba  alpha 0.14  @ 50%屏高
 *     近层   #2db5d4  alpha 0.18  @ 66%屏高  大振幅 快速
 *   浪尖白线: #ffffff  alpha 0.50  width 1.8
 *   气泡光晕: #aaddff  alpha 0.3-0.7 (外层) + #ffffff (核心)
 *   月光闪烁: #ffffff  alpha 最多 0.06  width 2
 *   光晕装饰: hsla(200 80% 50% / 0.12) + hsla(170 60% 45% / 0.10)
 *
 * Light 模式:
 *   天空:   linear-gradient(180deg, #d4f1f9 0%, #e8f6f9 30%, #b8e4f0 70%, #c9e8f2 100%)
 *   海浪层:
 *     远层   #0a3d5c  alpha 0.05
 *     中远   #0d5e8c  alpha 0.07
 *     中近   #1a8cba  alpha 0.10
 *     近层   #2db5d4  alpha 0.13
 *   浪尖白线: #ffffff  alpha 0.35
 *   气泡光晕: 同 dark
 *   月光闪烁: 同 dark
 *   光晕装饰: hsla(195 80% 70% / 0.35) + hsla(170 70% 75% / 0.30)
 */

import * as PIXI from 'pixi.js';
import type { ThemeSetup, Updatable } from './types';

// ── 海浪层 ──
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

// ── 发光气泡 ──
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

// ── 月光闪烁 ──
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

export function setupOcean(app: PIXI.Application, w: number, h: number): ThemeSetup {
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
