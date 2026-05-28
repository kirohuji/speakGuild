/**
 * 🌧️ Rain Theme — 窗边雨夜 + 斜雨 + 涟漪 + 闪电
 *
 * ══════════════════ 颜色方案 ══════════════════
 *
 * Dark 模式:
 *   天空:   linear-gradient(160deg, #0a1510 0%, #0c1812 40%, #08120c 100%)
 *   光晕:   hsla(150 35% 45% / 0.12) + hsla(130 30% 40% / 0.08)
 *   远景雨: #aaccff  alpha 0.12-0.27  width 0.5  speed 3-5  角度 ~14°
 *   近景雨: #aaccff  alpha 0.22-0.42  width 1.2  speed 5-9  角度 ~20°
 *   涟漪:   #aaccff  alpha 0.25-0.45→0  stroke 0.8  半径 2→27px
 *   水痕:   #aaddff  alpha 0.1  fill  ellipse
 *   闪电:   #ffffff  alpha 0.08(3帧)→0.04(1帧)→0  全屏 rect
 *
 * Light 模式:
 *   天空:   linear-gradient(180deg, #d4e8dc 0%, #e2f0e6 40%, #c8ddd2 80%, #dce8e2 100%)
 *   光晕:   hsla(150 40% 65% / 0.30) + hsla(130 30% 70% / 0.25)
 *   雨滴色: 可适当加深为 #8899bb
 */

import * as PIXI from 'pixi.js';
import type { ThemeSetup, Updatable } from './types';

// ── 斜雨 ──
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

// ── 涟漪 ──
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

// ── 玻璃水痕 ──
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

// ═══════════════════════════════════════════════════════════
// 大树 — 纯黑剪影 · 全部用 fill（树干 + 枝）
// ═══════════════════════════════════════════════════════════

export function setupRain(app: PIXI.Application, w: number, h: number, isDark: boolean, testMode?: boolean): ThemeSetup {
  const items: Updatable[] = [];
  const alphaMul = isDark ? 1 : 1.5;

  for (let i = 0; i < 50; i++) {
    const r = new WindRain(w, h, 3 + Math.random() * 2, (0.12 + Math.random() * 0.15) * alphaMul, false);
    app.stage.addChild(r as any); items.push(r as any);
  }
  for (let i = 0; i < 25; i++) {
    const r = new WindRain(w, h, 5 + Math.random() * 4, (0.22 + Math.random() * 0.2) * alphaMul, true);
    app.stage.addChild(r as any); items.push(r as any);
  }

  let rippleTimer = 0;
  let streakTimer = 0;
  let lightningTimer = testMode ? 60 : 200 + Math.random() * 300;
  const flash = new PIXI.Graphics();
  flash.fill({ color: 0xffffff, alpha: 0 });
  flash.rect(0, 0, w, h);
  flash.fill();
  app.stage.addChild(flash as any);
  let flashFrames = 0;

  const onTick = (_dt: number) => {
    const dt = _dt;
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
      lightningTimer = testMode ? 80 + Math.random() * 80 : 250 + Math.random() * 400;
      flash.alpha = 0.08;
      flashFrames = 4;
    }
  };

  return { items, onTick };
}
