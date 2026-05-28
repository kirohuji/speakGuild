/**
 * 🌌 Aurora Theme — 垂直极光帘幕 + 星光夜空
 *
 * ══════════════════ 颜色方案 ══════════════════
 *
 * Dark 模式:
 *   天空:   radial-gradient(ellipse at 30% 20%, rgba(80,200,180,0.2), transparent 45%),
 *           radial-gradient(ellipse at 70% 50%, rgba(100,180,220,0.15), transparent 45%),
 *           linear-gradient(155deg, #050a10 0%, #080e18 50%, #060c14 100%)
 *   光晕:   hsla(160 60% 50% / 0.15) + hsla(200 50% 48% / 0.10)
 *   极光帘幕 (7条, 从屏幕顶垂到 ~65%):
 *     翠绿 #00ff88  alpha 0.13-0.14  @ 2%, 41%
 *     青绿 #00ddbb  alpha 0.11-0.12  @ 13%, 69%
 *     紫   #8844ff  alpha 0.10        @ 27%
 *     蓝   #4488ff  alpha 0.11        @ 55%
 *     粉   #ff66aa  alpha 0.09        @ 83%
 *   背景星(50颗): #fff / #aaccff / #ffeedd  alpha 0.2-0.6  size 0.5-2px
 *
 * Light 模式:
 *   天空:   linear-gradient(135deg, #e0ecf0 0%, #ecf4f6 50%, #d8e8f0 100%)
 *   光晕:   hsla(180 60% 70% / 0.35) + hsla(220 50% 72% / 0.30)
 *   极光色: 同 dark，alpha 降至 dark 的 45%（更柔和的浅色极光）
 */

import * as PIXI from 'pixi.js';
import type { ThemeSetup, Updatable } from './types';

// ── 极光帘幕 ──
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
    this.moveTo(this.baseX, 0);
    for (const y of this.yPoints) {
      const wave =
        Math.sin(y * 0.015 + this.phase) * 32 +
        Math.sin(y * 0.035 + this.phase * 1.6) * 20 +
        Math.sin(y * 0.008 + this.phase * 0.7) * 16;
      this.lineTo(this.baseX + this.bandWidth + wave, y);
    }
    const lastY = this.yPoints[this.yPoints.length - 1];
    this.lineTo(this.baseX - 5, lastY);
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

export function setupAurora(app: PIXI.Application, w: number, h: number, isDark: boolean): ThemeSetup {
  const items: Updatable[] = [];

  // Light 模式下降低 alpha、用更浅色星点
  const alphaMul = isDark ? 1 : 0.45;
  const starColors = isDark
    ? [0xffffff, 0xaaccff, 0xffeedd]
    : [0xbbccdd, 0xaabbdd, 0xccbbaa]; // light 模式用浅灰蓝/暖灰

  const curtainDefs = [
    { x: w * -0.01, width: 140, color: 0x00ff88, alpha: 0.13 * alphaMul, speed: 0.35 },
    { x: w * 0.13, width: 110, color: 0x00ddbb, alpha: 0.11 * alphaMul, speed: 0.50 },
    { x: w * 0.27, width: 160, color: 0x8844ff, alpha: 0.10 * alphaMul, speed: 0.30 },
    { x: w * 0.41, width: 120, color: 0x00ff88, alpha: 0.14 * alphaMul, speed: 0.45 },
    { x: w * 0.55, width: 110, color: 0x4488ff, alpha: 0.11 * alphaMul, speed: 0.40 },
    { x: w * 0.69, width: 140, color: 0x00ddbb, alpha: 0.12 * alphaMul, speed: 0.55 },
    { x: w * 0.83, width: 110, color: 0xff66aa, alpha: 0.09 * alphaMul, speed: 0.48 },
  ];
  for (const def of curtainDefs) {
    const curtain = new AuroraCurtain(h, def.x, def.width, def.color, def.alpha, def.speed);
    curtain.draw();
    app.stage.addChild(curtain as any);
    items.push(curtain as any);
  }

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

  const onTick = () => {};

  return { items, onTick };
}
