/**
 * 🌊 Ocean Theme — 热带海水 · 多频复合浪 · 水面波光
 *
 * ══════════════════ 颜色方案 ══════════════════
 *
 * Dark 模式（热带夜海）:
 *   天空:   linear-gradient(155deg, #0a1628 0%, #0d2847 40%, #061220 100%)
 *   海浪层（6层）:
 *     远层   #042d45  alpha 0.07  @ 38%  缓波长波
 *     中远   #084e6e  alpha 0.11  @ 48%
 *     中层   #0e6e8e  alpha 0.15  @ 58%
 *     中近   #1a8aba  alpha 0.19  @ 67%
 *     近层   #2ab0cc  alpha 0.23  @ 76%
 *     最近   #4acce0  alpha 0.28  @ 86%  高频碎波
 *   浪尖白线: #ffffff  alpha 0.35  width 1.2  仅波峰段
 *   水面波光: #ffffff 十字星芒  size 2-4
 *   光晕装饰: hsla(200 80% 50% / 0.12) + hsla(170 60% 45% / 0.10)
 *
 * Light 模式（热带昼海）:
 *   天空:   linear-gradient(180deg, #d4f1f9 0%, #e8f6f9 30%, #b8e4f0 70%, #c9e8f2 100%)
 *   海浪层（6层）:
 *     远层   #3a6a8a  alpha 0.05
 *     中远   #4a8aaa  alpha 0.08
 *     中层   #5aaaba  alpha 0.11
 *     中近   #7ac4d8  alpha 0.14
 *     近层   #8ad4e4  alpha 0.17
 *     最近   #aae4f0  alpha 0.21
 *   浪尖白线: #ffffff  alpha 0.25
 *   水面波光: #ffffff 十字星芒
 *   光晕装饰: hsla(195 80% 70% / 0.35) + hsla(170 70% 75% / 0.30)
 */

import * as PIXI from 'pixi.js';
import type { ThemeSetup, Updatable } from './types';

// ═══════════════════════════════════════════════════════════
// 海浪层 — 多频率复合波形 + 锐峰柔谷（动画风格海面）
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

  /** 复合波形：主波 + 两个次波，锐峰柔谷整形 */
  private waveY(x: number): number {
    const t = x * this.frequency + this.phase;
    const raw = Math.sin(t);
    // 锐峰 (raw<0 时放大) + 柔谷 (raw>0 时压缩)
    const shaped = raw < 0
      ? raw * this.amplitude * 1.25
      : raw * this.amplitude * 0.50;
    // 次波叠加增加自然感
    const sub1 = Math.sin(t * 2.7 + this.phase * 0.6) * this.amplitude * 0.22;
    const sub2 = Math.sin(t * 5.3 + this.phase * 1.4) * this.amplitude * 0.08;
    return this.baseY + shaped + sub1 + sub2;
  }

  draw(w: number) {
    this.clear();
    const ys = this.xPoints.map(x => this.waveY(x));

    // ── 填充波形 ──
    this.moveTo(0, this.baseY + 400);
    for (let i = 0; i < ys.length; i++) {
      this.lineTo(this.xPoints[i], ys[i]);
    }
    this.lineTo(w, this.baseY + 400);
    this.closePath();
    this.fill({ color: this.color, alpha: this.fillAlpha });

    // ── 浪尖白线 — 仅在波峰段绘制 ──
    // 计算每个点的一阶导数（前后差分）判断上升/下降
    this.moveTo(this.xPoints[0], ys[0]);
    for (let i = 1; i < ys.length; i++) {
      // 仅在波峰附近绘制 (斜率变号处: 从上升变下降 = 波峰)
      const prevSlope = ys[i] - ys[i - 1];
      const nextSlope = i < ys.length - 1 ? ys[i + 1] - ys[i] : 0;
      // 波峰：prevSlope < 0 (上升) 且 nextSlope > 0 (下降)
      // 注：Y向下增加，所以上升是负斜率
      if (prevSlope < 0 && nextSlope > 0 && ys[i] < this.baseY) {
        // 波峰处画一段白线点缀
        this.stroke({ color: 0xffffff, width: 1.2, alpha: 0.40 });
        this.moveTo(this.xPoints[i], ys[i]);
      } else {
        this.lineTo(this.xPoints[i], ys[i]);
      }
    }
    // 补上描边保证连续
    this.stroke({ color: 0xffffff, width: 0.6, alpha: 0.15 });
  }

  update(dt: number, w: number) { this.phase += this.speed * 0.015 * dt; this.draw(w); return true; }
}

// ═══════════════════════════════════════════════════════════
// 水面波光 — 十字星芒闪烁
// ═══════════════════════════════════════════════════════════

class SunSparkle extends PIXI.Graphics {
  life = 0;
  maxLife: number;
  private sz: number;

  constructor(w: number, h: number) {
    super();
    this.maxLife = 30 + Math.random() * 35;
    this.sz = 1.5 + Math.random() * 2.5;
    this.alpha = 0;

    // 十字星
    this.moveTo(-this.sz, 0);
    this.lineTo(this.sz, 0);
    this.moveTo(0, -this.sz);
    this.lineTo(0, this.sz);
    this.stroke({ color: 0xffffff, width: 0.8, alpha: 1 });

    this.position.set(
      Math.random() * w,
      h * (0.40 + Math.random() * 0.50),
    );
  }

  update(dt: number) {
    this.life += dt;
    const t = this.life / this.maxLife;
    // 闪入 → 保持 → 闪出
    this.alpha = t < 0.15 ? t / 0.15
      : t > 0.70 ? (1 - t) / 0.30
      : 1;
    return this.life < this.maxLife;
  }
}

// ═══════════════════════════════════════════════════════════
// 漂流瓶 — 玻璃瓶身 + 软木塞 + 信纸 + 波浪漂浮
// ═══════════════════════════════════════════════════════════

class DriftBottle extends PIXI.Graphics {
  vx: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmp: number;
  baseY: number;
  tiltPhase: number;

  constructor(w: number, h: number, isDark: boolean) {
    super();
    this.vx = -(0.08 + Math.random() * 0.12);
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobSpeed = 0.006 + Math.random() * 0.008;
    this.bobAmp = 2 + Math.random() * 3;
    this.baseY = h * (0.24 + Math.random() * 0.46);
    this.tiltPhase = Math.random() * Math.PI * 2;

    this.drawBottle(isDark);
    this.alpha = 0.55 + Math.random() * 0.35;
    // 初始倾斜角度（10~30 度，正负随机），让瓶子斜着漂
    this.rotation = (Math.random() - 0.5) * 0.6;
    this.position.set(
      Math.random() * (w + 200) - 100,
      this.baseY,
    );
  }

  private drawBottle(isDark: boolean) {
    this.clear();
    const s = 0.5 + Math.random() * 0.5;
    const glass = 0x88ddee;

    // ── 玻璃瓶身（主体椭圆） ──
    this.fill({ color: glass, alpha: 0.30 });
    this.ellipse(0, 0, 5 * s, 7 * s);
    this.fill();

    // ── 瓶颈 ──
    this.fill({ color: glass, alpha: 0.30 });
    this.ellipse(0, -7 * s, 2.2 * s, 2 * s);
    this.fill();

    // ── 玻璃高光（反光条） ──
    this.fill({ color: 0xffffff, alpha: 0.18 });
    this.ellipse(-2 * s, -1 * s, 1.5 * s, 4 * s);
    this.fill();

    // ── 软木塞 ──
    this.fill({ color: isDark ? 0x775533 : 0xaa7744, alpha: 0.85 });
    this.roundRect(-1.5 * s, -9.5 * s, 3 * s, 2.2 * s, 0.6 * s);
    this.fill();

    // ── 瓶中信纸 ──
    this.fill({ color: 0xffeecc, alpha: 0.55 });
    this.rect(-2.2 * s, -1.8 * s, 4.4 * s, 3.2 * s);
    this.fill();
    // 信纸上的字迹（小点）
    this.fill({ color: 0x886644, alpha: 0.4 });
    for (let i = 0; i < 3; i++) {
      this.circle(-1 * s + i * 1.2 * s, -1 * s + 0.5 * s, 0.3 * s);
    }
    this.fill();
  }

  update(dt: number, w: number, _h: number) {
    this.bobPhase += this.bobSpeed * dt;
    this.tiltPhase += 0.003 * dt;
    this.position.x += this.vx * dt;
    this.position.y = this.baseY + Math.sin(this.bobPhase) * this.bobAmp;
    // 在初始倾斜角度上轻微晃动，保留斜漂感
    this.rotation += Math.sin(this.tiltPhase) * 0.0008 * dt;

    if (this.position.x < -80) {
      this.position.x = w + 80;
      this.baseY = _h * (0.24 + Math.random() * 0.46);
    }
    return true;
  }
}

// ═══════════════════════════════════════════════════════════
// 月光闪烁
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// Theme entry
// ═══════════════════════════════════════════════════════════

export function setupOcean(
  app: PIXI.Application,
  w: number,
  h: number,
  isDark: boolean,
  testMode?: boolean,
): ThemeSetup {
  const items: Updatable[] = [];
  const alphaMul = isDark ? 1 : 1.4;
  const ptCount = 160;
  const xPoints: number[] = [];
  for (let i = 0; i <= ptCount; i++) xPoints.push((i / ptCount) * w);

  // ── 海浪（6层，更丰富的波形密度） ──
  const waveDefs = [
    // 远层 — 缓波长波
    { y: h * 0.22, amp: 8,  freq: 0.004, color: isDark ? 0x042d45 : 0x3a6a8a, alpha: (isDark ? 0.07 : 0.05) * alphaMul, speed: 0.18 },
    // 中远
    { y: h * 0.34, amp: 14, freq: 0.006, color: isDark ? 0x084e6e : 0x4a8aaa, alpha: (isDark ? 0.11 : 0.08) * alphaMul, speed: 0.32 },
    // 中层
    { y: h * 0.46, amp: 22, freq: 0.008, color: isDark ? 0x0e6e8e : 0x5aaaba, alpha: (isDark ? 0.15 : 0.11) * alphaMul, speed: 0.48 },
    // 中近
    { y: h * 0.67, amp: 30, freq: 0.010, color: isDark ? 0x1a8aba : 0x7ac4d8, alpha: (isDark ? 0.19 : 0.14) * alphaMul, speed: 0.65 },
    // 近层
    { y: h * 0.78, amp: 38, freq: 0.013, color: isDark ? 0x2ab0cc : 0x8ad4e4, alpha: (isDark ? 0.23 : 0.17) * alphaMul, speed: 0.85 },
    // 最近层 — 高频碎波细节
    { y: h * 0.90, amp: 48, freq: 0.017, color: isDark ? 0x4acce0 : 0xaae4f0, alpha: (isDark ? 0.28 : 0.21) * alphaMul, speed: 1.10 },
  ];
  for (const def of waveDefs) {
    const wave = new OceanWaveLayer(def.amp, def.freq, def.y, def.color, def.alpha, def.speed, xPoints);
    wave.draw(w);
    app.stage.addChild(wave as any);
    items.push(wave as any);
  }

  // ── 计时器 ──
  // ── 漂流瓶（初始 3 个） ──
  for (let i = 0; i < 3; i++) {
    const b = new DriftBottle(w, h, isDark);
    b.position.x = (i / 3) * (w + 200) - 100;
    app.stage.addChild(b as any);
    items.push(b as any);
  }

  let shimmer: MoonShimmer | null = null;
  let shimmerCooldown = 200 + Math.random() * 300;
  let sparkleTimer = 10 + Math.random() * 20;
  let bottleTimer = 400 + Math.random() * 300;
  const maxSparkles = 20;
  const maxBottles = 5;

  const onTick = (_dt: number, _w: number, _h: number) => {
    const dt = _dt;

    // ── 水面波光 ──
    sparkleTimer -= dt;
    if (sparkleTimer <= 0) {
      const current = items.filter(i => i instanceof SunSparkle).length;
      if (current < maxSparkles) {
        const s = new SunSparkle(w, h);
        app.stage.addChild(s as any);
        items.push(s as any);
      }
      sparkleTimer = 6 + Math.random() * 14;
    }

    // ── 漂流瓶（偶尔补充） ──
    bottleTimer -= dt;
    if (bottleTimer <= 0) {
      const current = items.filter(i => i instanceof DriftBottle).length;
      if (current < maxBottles) {
        const b = new DriftBottle(w, h, isDark);
        app.stage.addChild(b as any);
        items.push(b as any);
      }
      bottleTimer = 500 + Math.random() * 400;
    }

    // ── 月光闪烁 ──
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
