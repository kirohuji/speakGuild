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

    // ── 连续浪线（基础描边，贯穿始终） ──
    this.moveTo(this.xPoints[0], ys[0]);
    for (let i = 1; i < ys.length; i++) {
      this.lineTo(this.xPoints[i], ys[i]);
    }
    this.stroke({ color: 0xffffff, width: 0.7, alpha: 0.18 });

    // ── 波峰高光（峰顶独立短线段，不打断主线条） ──
    for (let i = 2; i < ys.length - 2; i++) {
      const prevSlope = ys[i] - ys[i - 1];
      const nextSlope = ys[i + 1] - ys[i];
      if (prevSlope < 0 && nextSlope > 0 && ys[i] < this.baseY) {
        this.moveTo(this.xPoints[i - 1], ys[i - 1]);
        this.lineTo(this.xPoints[i], ys[i]);
        this.lineTo(this.xPoints[i + 1], ys[i + 1]);
        this.stroke({ color: 0xffffff, width: 1.0, alpha: 0.30 });
      }
    }
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
// 远岛 — 山影 · 灯塔
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 远山 — 山体剪影 + 棕榈树
// ═══════════════════════════════════════════════════════════

class Mountain extends PIXI.Container {
  constructor(w: number, h: number, isDark: boolean) {
    super();

    this.position.set(w * (0.02 + Math.random() * 0.06), h * 0.19);
    const s = 0.6 + Math.random() * 0.4;
    const color = isDark ? 0x061a2e : 0x5a7a6a;
    const treeColor = isDark ? 0x040e1a : 0x3a5a4a;

    // ── 山体 ──
    const land = new PIXI.Graphics();
    land.fill({ color, alpha: 1 });
    land.moveTo(-28 * s, 0);
    land.lineTo(-22 * s, -8 * s);
    land.lineTo(-16 * s, -22 * s);
    land.lineTo(-10 * s, -28 * s);
    land.lineTo(-4 * s, -20 * s);
    land.lineTo(3 * s, -26 * s);
    land.lineTo(10 * s, -34 * s);
    land.lineTo(18 * s, -20 * s);
    land.lineTo(25 * s, -6 * s);
    land.lineTo(30 * s, 0);
    land.lineTo(30 * s, 6 * s);
    land.lineTo(-30 * s, 6 * s);
    land.closePath();
    land.fill();
    this.addChild(land);

    // ── 棕榈树 ──
    const trees = new PIXI.Graphics();
    trees.fill({ color: treeColor, alpha: 1 });
    const plantAt = (x: number, y: number, hh: number) => {
      // 树干
      trees.rect(x - 0.4 * s, y - hh, 0.8 * s, hh);
      trees.fill();
      // 树冠（3~4 片叶子）
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.3;
        const l = (3 + Math.random() * 3) * s;
        trees.moveTo(x, y - hh);
        trees.lineTo(x + Math.cos(angle) * l, y - hh - Math.sin(angle) * l * 0.6);
      }
      trees.stroke({ color: treeColor, width: 1.2 * s, alpha: 0.85 });
    };
    // 在山脊上种 4 棵树
    plantAt(-12 * s, -20 * s, 6 * s);
    plantAt(-4 * s, -18 * s, 5 * s);
    plantAt(5 * s, -22 * s, 7 * s);
    plantAt(14 * s, -16 * s, 5 * s);
    this.addChild(trees);

    this.alpha = isDark ? 0.35 : 0.25;
  }

  update() { return true; }
}

// ═══════════════════════════════════════════════════════════
// 灯塔 — 水上塔身 + 旋转光束（scale 动画实现扫射）
// ═══════════════════════════════════════════════════════════

class Lighthouse extends PIXI.Container {
  private beam: PIXI.Graphics;
  private beamAngle = Math.random() * Math.PI * 2;
  private rotSpeed: number;
  private _s: number;

  constructor(w: number, h: number, isDark: boolean) {
    super();

    this.position.set(w * (0.03 + Math.random() * 0.06), h * 0.19);
    this._s = 0.7 + Math.random() * 0.4;
    const s = this._s;

    // ── 塔身 ──
    const tower = new PIXI.Graphics();
    tower.fill({ color: 0xeeeeee, alpha: isDark ? 0.65 : 0.45 });
    tower.moveTo(-3 * s, 0);
    tower.lineTo(-2.2 * s, -26 * s);
    tower.lineTo(2.2 * s, -26 * s);
    tower.lineTo(3 * s, 0);
    tower.closePath();
    tower.fill();
    for (let i = 0; i < 3; i++) {
      const y1 = -6 * s - i * 7 * s;
      tower.fill({ color: 0xcc3333, alpha: isDark ? 0.55 : 0.35 });
      tower.rect(-2.7 * s + i * 0.15 * s, y1, 5.4 * s - i * 0.3 * s, 2.5 * s);
      tower.fill();
    }
    tower.fill({ color: 0x443322, alpha: isDark ? 0.6 : 0.4 });
    tower.rect(-0.8 * s, -4 * s, 1.6 * s, 4 * s);
    tower.fill();
    this.addChild(tower);

    // ── 灯室 ──
    const lantern = new PIXI.Graphics();
    lantern.fill({ color: 0xdddddd, alpha: isDark ? 0.70 : 0.50 });
    lantern.rect(-3.2 * s, -30 * s, 6.4 * s, 4 * s);
    lantern.fill();
    lantern.fill({ color: 0xaaccee, alpha: isDark ? 0.25 : 0.15 });
    lantern.rect(-2.5 * s, -29.5 * s, 5 * s, 2.5 * s);
    lantern.fill();
    lantern.fill({ color: 0xcc4444, alpha: isDark ? 0.6 : 0.4 });
    lantern.moveTo(-3.5 * s, -30 * s);
    lantern.lineTo(0, -34 * s);
    lantern.lineTo(3.5 * s, -30 * s);
    lantern.closePath();
    lantern.fill();
    this.addChild(lantern);

    // ── 光束容器（放在灯室位置） ──
    this.beam = new PIXI.Graphics();
    this.beam.position.set(0, -29 * s);
    this.addChild(this.beam);

    this.rotSpeed = Math.random() > 0.5 ? 0.015 : -0.015;
    this.alpha = isDark ? 0.92 : 0.55;
  }

  update(dt: number) {
    this.beamAngle += this.rotSpeed * dt;

    // angle：0° 朝右 → 90° 朝屏幕 → 180° 朝左 → 270° 朝背面
    const a = ((this.beamAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    const s = this._s;
    const L = 32 * s;          // 光束全长
    const H = 12 * s;          // 半高

    const cosA = Math.cos(a);
    const rightVis = Math.max(0, cosA);
    const leftVis = Math.max(0, -cosA);
    const centerGlow = Math.max(0, 1 - Math.abs(cosA) * 4);

    // 锥口宽度 & 垂直高度（中心时展开为十字）
    const wF = Math.max(centerGlow * 0.35, 0.04 + 0.96 * Math.abs(cosA));
    const tipH = H * wF;
    const vertH = tipH * centerGlow * 1.5;        // 中心时十字垂直臂，侧面时为 0 退化为三角形

    const rightLen = L * (rightVis + centerGlow * 0.2);
    const leftLen = L * (leftVis + centerGlow * 0.2);

    // 连续菱形：窄腰在灯塔(0,0)，宽口在两端
    // 侧面时一侧长度 0，退化为一个三角形（窄在灯塔、宽在尖端）
    // 中心时左右展开，上下尖形成十字垂直臂
    this.beam.clear();
    this.beam.fill({ color: 0xffffdd, alpha: 1 });
    this.beam.moveTo(-leftLen, -tipH);  // 左上尖
    this.beam.lineTo(0, -vertH);         // 正上尖（十字垂直）
    this.beam.lineTo(rightLen, -tipH);   // 右上尖
    this.beam.lineTo(rightLen, tipH);    // 右下尖
    this.beam.lineTo(0, vertH);          // 正下尖（十字垂直）
    this.beam.lineTo(-leftLen, tipH);    // 左下尖
    this.beam.closePath();
    this.beam.fill();

    // 中心内核光晕
    if (centerGlow > 0.05) {
      this.beam.fill({ color: 0xffffff, alpha: centerGlow * 0.35 });
      this.beam.circle(0, 0, 5 * s);
      this.beam.fill();
    }

    // 朝背面时渐隐，朝正面时增亮
    const backVis = Math.cos(a - Math.PI * 1.5);
    const fade = backVis > 0.5 ? 1 - backVis * 0.8 : 1;
    const brightBoost = 1 + Math.abs(Math.sin(a)) * 0.8; // 越靠近正面越亮，平滑过渡
    this.beam.alpha = 0.40 * fade * brightBoost;

    return true;
  }
}

// ═══════════════════════════════════════════════════════════
// 海豚 — 抛物线跃水 · 流线型体 · 中下海域
// ═══════════════════════════════════════════════════════════

class Dolphin extends PIXI.Graphics {
  progress = 0;
  speed: number;
  jumpWidth: number;
  jumpHeight: number;
  baseY: number;
  startX: number;
  direction: number;
  bodyColor: number;
  bellyColor: number;
  private sz: number;

  constructor(w: number, h: number, isDark: boolean) {
    super();
    this.speed = 0.006 + Math.random() * 0.005;
    this.jumpWidth = 130 + Math.random() * 100;
    this.jumpHeight = 50 + Math.random() * 40;
    // 中下海域跳跃（50%~75% 屏高，正是海浪翻涌区域）
    this.baseY = h * (0.50 + Math.random() * 0.25);
    this.direction = Math.random() > 0.5 ? 1 : -1;
    // 真实海豚色：深蓝灰背 + 浅灰白腹
    this.bodyColor = isDark ? 0x1a2a3a : 0x2a3a4a;
    this.bellyColor = isDark ? 0x5a6a7a : 0x7a8a9a;
    this.sz = 0.6 + Math.random() * 0.5;

    this.startX = this.direction > 0 ? -80 : w + 80;
    this.scale.x = this.direction;
    this.drawShape();
    this.alpha = 0;
  }

  private drawShape() {
    this.clear();
    const s = this.sz;
    const col = this.bodyColor;
    const belly = this.bellyColor;

    // ── 身体（3 个椭圆融合为流畅流线型） ──
    this.fill({ color: col, alpha: 0.92 });
    this.ellipse(2 * s, 0, 12 * s, 3.6 * s);       // 躯干
    this.ellipse(10 * s, 0.3 * s, 5 * s, 3 * s);   // 胸/头
    this.ellipse(-7 * s, 0, 6 * s, 2.8 * s);        // 尾柄（收窄）
    this.fill();

    // ── 腹部（浅色，偏下方） ──
    this.fill({ color: belly, alpha: 0.50 });
    this.ellipse(3 * s, 1.6 * s, 10 * s, 1.6 * s);
    this.fill();

    // ── 喙（前伸尖嘴） ──
    this.fill({ color: col, alpha: 0.90 });
    this.ellipse(16 * s, 1.0 * s, 3 * s, 0.9 * s);
    this.fill();

    // ── 背鳍（弧形，不是直三角） ──
    this.fill({ color: col, alpha: 0.85 });
    this.moveTo(-1 * s, -3.6 * s);
    this.quadraticCurveTo(0, -8 * s, 3 * s, -3.6 * s);
    this.lineTo(4.5 * s, -3.6 * s);
    this.lineTo(1 * s, -0.5 * s);
    this.closePath();
    this.fill();

    // ── 尾鳍上叶 ──
    this.fill({ color: col, alpha: 0.85 });
    this.moveTo(-13 * s, 0);
    this.lineTo(-18 * s, -3.5 * s);
    this.lineTo(-15.5 * s, -0.3 * s);
    this.closePath();
    this.fill();

    // ── 尾鳍下叶 ──
    this.fill({ color: col, alpha: 0.85 });
    this.moveTo(-13 * s, 0);
    this.lineTo(-18 * s, 3.5 * s);
    this.lineTo(-15.5 * s, 0.3 * s);
    this.closePath();
    this.fill();

    // ── 眼睛 + 高光 ──
    this.fill({ color: 0x000000, alpha: 0.75 });
    this.circle(10 * s, -0.8 * s, 0.6 * s);
    this.fill();
    this.fill({ color: 0xffffff, alpha: 0.35 });
    this.circle(10.3 * s, -1.1 * s, 0.2 * s);
    this.fill();

    // ── 胸鳍（小三角，偏下） ──
    this.fill({ color: col, alpha: 0.70 });
    this.moveTo(4 * s, 1.8 * s);
    this.lineTo(3 * s, 4 * s);
    this.lineTo(5.5 * s, 4 * s);
    this.closePath();
    this.fill();
  }

  update(dt: number, _w: number) {
    this.progress += this.speed * dt;
    if (this.progress > 1) return false;

    const t = this.progress;
    // 抛物线：y = -4 * h * t * (1 - t)
    const x = (t * this.jumpWidth - this.jumpWidth * 0.5);
    const y = -4 * this.jumpHeight * t * (1 - t);

    // 速度方向（抛物线切线）
    const dx = this.jumpWidth;
    const dy = -4 * this.jumpHeight * (1 - 2 * t);
    this.rotation = Math.atan2(dy, dx);

    this.position.x = this.startX + x * this.direction;
    this.position.y = this.baseY + y;

    // 出入水渐隐
    const fadeIn = Math.min(1, t / 0.12);
    const fadeOut = Math.min(1, (1 - t) / 0.12);
    this.alpha = Math.min(fadeIn, fadeOut) * 0.88;

    // 透视缩放：顶点处略小
    const peakScale = 0.82;
    this.scale.y = 1 - (1 - peakScale) * Math.sin(t * Math.PI);

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
// 帆船 — 小型帆船 · 缓慢漂行
// ═══════════════════════════════════════════════════════════

class Sailboat extends PIXI.Graphics {
  vx: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmp: number;
  baseY: number;

  constructor(w: number, h: number, isDark: boolean) {
    super();
    this.vx = 0.15 + Math.random() * 0.2;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobSpeed = 0.008 + Math.random() * 0.006;
    this.bobAmp = 1.5 + Math.random() * 2;
    this.baseY = h * (0.28 + Math.random() * 0.15);

    const hullColor = isDark ? 0x334455 : 0x5a6a7a;
    const sailColor = isDark ? 0xdddddd : 0xeeeeee;
    const mastColor = isDark ? 0x445566 : 0x667788;
    const s = 0.6 + Math.random() * 0.4;

    // 船身
    this.fill({ color: hullColor, alpha: 0.85 });
    this.moveTo(-6 * s, 0);
    this.lineTo(6 * s, 0);
    this.lineTo(5 * s, 2.5 * s);
    this.lineTo(-5 * s, 2.5 * s);
    this.closePath();
    this.fill();

    // 桅杆
    this.moveTo(0, 0);
    this.lineTo(0, -10 * s);
    this.stroke({ color: mastColor, width: 0.6 * s, alpha: 0.7 });

    // 帆
    this.fill({ color: sailColor, alpha: 0.50 });
    this.moveTo(0, -9 * s);
    this.lineTo(5 * s, -4 * s);
    this.lineTo(0, -2 * s);
    this.closePath();
    this.fill();

    this.alpha = 0.70;
    this.position.set(
      Math.random() * (w + 300) - 150,
      this.baseY,
    );
  }

  update(dt: number, w: number) {
    this.bobPhase += this.bobSpeed * dt;
    this.position.x += this.vx * dt;
    this.position.y = this.baseY + Math.sin(this.bobPhase) * this.bobAmp;

    if (this.position.x > w + 100) {
      this.position.x = -100;
    }
    return true;
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
  // ── 远景：测试模式出小岛（带树），正常模式随机山或灯塔 ──
  if (testMode) {
    // 测试模式只显示小岛（带棕榈树）
    const view = new Mountain(w, h, isDark);
    app.stage.addChild(view as any);
    items.push(view as any);
  } else if (Math.random() < 0.5) {
    const view = Math.random() < 0.3
      ? new Mountain(w, h, isDark)
      : new Lighthouse(w, h, isDark);
    app.stage.addChild(view as any);
    items.push(view as any);
  }

  // ── 帆船（测试模式必出） ──
  // if (testMode) {
  //   const boat = new Sailboat(w, h, isDark);
  //   app.stage.addChild(boat as any);
  //   items.push(boat as any);
  // }

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
  let dolphinTimer = testMode ? 60 : 200 + Math.random() * 200;
  const maxSparkles = 20;
  const maxBottles = 5;
  const maxDolphins = 2;

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

    // ── 海豚跃水 ──
    dolphinTimer -= dt;
    if (dolphinTimer <= 0) {
      const current = items.filter(i => i instanceof Dolphin).length;
      if (current < maxDolphins) {
        const count = testMode ? 1 + Math.floor(Math.random() * 2) : 1;
        for (let i = 0; i < count; i++) {
          const d = new Dolphin(w, h, isDark);
          d.position.x += i * 30 * d.direction;
          app.stage.addChild(d as any);
          items.push(d as any);
        }
      }
      dolphinTimer = testMode
        ? 80 + Math.random() * 80
        : 300 + Math.random() * 350;
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
