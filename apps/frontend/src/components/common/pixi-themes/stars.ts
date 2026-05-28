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
 * Light 模式（暮光星色）:
 *   天空渐变: linear-gradient(135deg, #e8ecf4 0%, #f0f2f8 50%, #e4e8f2 100%)
 *   光晕装饰: hsla(260 50% 70% / 0.30) + hsla(220 40% 75% / 0.25)
 *   星空策略: 用深色星替代白色星（深蓝/钢蓝/暖棕），在浅背景上产生对比度
 *     深空(50颗)  alpha 0.15-0.35  色: 深蓝#334466 / 钢蓝#445577 / 暖棕#554433
 *     星野(30颗)  alpha 0.35-0.60  色: 同上
 *     亮星(5颗)   alpha 0.50-0.80  色: 深蓝#223355 / 深紫#443355 / 暖棕#554422
 *   树影:     #5a6b5a  alpha 0.55 (灰绿, 融入浅色天空)
 *   流星:     使用深蓝拖尾 #445577
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

function starColor(isDark: boolean): number {
  if (isDark) {
    const r = Math.random();
    if (r < 0.60) return 0xffffff;
    if (r < 0.80) return 0xddeeff;
    if (r < 0.95) return 0xffeedd;
    return 0xffeecc;
  }
  // Light 模式：深色星在浅背景上产生对比度（暮光星）
  const r = Math.random();
  if (r < 0.40) return 0x334466; // 深蓝
  if (r < 0.65) return 0x445577; // 钢蓝
  if (r < 0.85) return 0x554433; // 暖棕
  return 0x554455;                // 暗紫
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
    drawCross(this, this.half, this.thickness, this.starColor, 1);
  }
  update(dt: number) {
    this.twinklePhase += this.twinkleSpeed * dt;
    const raw = organicTwinkle(this.twinklePhase);
    const blink = 1 - this.twinkleAmp + this.twinkleAmp * (0.5 + 0.5 * raw);
    this.alpha = this.baseAlpha * blink;
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
    this.draw(brightness);
    return true;
  }
}

// ── 流星：亮点 + 直线拖尾 ──
class Comet extends PIXI.Graphics {
  vx = 0; vy = 0; life = 0; maxLife = 0; tailLen = 0;
  private tailColor: number;
  private headColor: number;
  constructor(w: number, h: number, isDark: boolean) {
    super();
    this.vx = -3 - Math.random() * 2;
    this.vy = 1 + Math.random() * 1.5;
    this.maxLife = 45 + Math.random() * 45;
    this.life = this.maxLife;
    this.tailLen = 60 + Math.random() * 80;
    this.tailColor = isDark ? 0xffffff : 0x445577;
    this.headColor = isDark ? 0xffffff : 0x334466;
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
    this.stroke({ color: this.tailColor, width: 0.6, alpha: fade * 0.4 });
    this.moveTo(-3, 0); this.lineTo(3, 0);
    this.moveTo(0, -3); this.lineTo(0, 3);
    this.stroke({ color: this.headColor, width: 1, alpha: fade });
  }
  update(dt: number) {
    this.life -= dt;
    this.position.x += this.vx * dt;
    this.position.y += this.vy * dt;
    this.draw();
    return this.life > 0;
  }
}

// ── 月亮：根据日期显示月相（新月→弦月→满月） ──
function moonPhase(): number {
  // 以 2000-01-06 (已知新月) 为基准，周期 29.53 天
  const refNewMoon = new Date('2000-01-06').getTime();
  const daysSince = (Date.now() - refNewMoon) / 86400000;
  return (daysSince % 29.53) / 29.53; // 0=新月, 0.25=上弦, 0.5=满月, 0.75=下弦
}

class Moon extends PIXI.Graphics {
  life = 0; maxLife = 0;
  private phase: number;
  constructor(w: number, h: number) {
    super();
    this.maxLife = 350 + Math.random() * 450;
    this.life = 0;
    this.phase = moonPhase();
    this.position.set(w * (0.04 + Math.random() * 0.10), h * (0.02 + Math.random() * 0.05));
    this.draw(0);
  }
  private draw(fade: number) {
    this.clear();
    const r = 7;
    // 外层柔光（始终满圆）
    this.fill({ color: 0xffeedd, alpha: fade * 0.08 });
    this.circle(0, 0, r * 3);
    this.fill();
    // 月轮本体
    this.fill({ color: 0xfffff0, alpha: fade * 0.95 });
    this.circle(0, 0, r);
    this.fill();
    // 阴影圆
    const shadowOffset = r * 1.8 * Math.cos(this.phase * Math.PI * 2);
    this.fill({ color: 0x0a0818, alpha: fade * 0.85 });
    this.circle(shadowOffset, 0, r * 1.05);
    this.fill();
  }
  update(dt: number) {
    this.life += dt;
    const t = this.life / this.maxLife;
    const fade = t < 0.10 ? t / 0.10 : t > 0.90 ? (1 - t) / 0.10 : 1;
    this.draw(fade);
    return this.life < this.maxLife;
  }
}

export function setupStars(app: PIXI.Application, w: number, h: number, isDark: boolean, testMode?: boolean): ThemeSetup {
  const items: Updatable[] = [];

  // Light 模式：星少但更明显，顶部加微暗渐变营造暮光感
  const deepCount = isDark ? 80 : 50;
  const fieldCount = isDark ? 50 : 30;
  const brightCount = isDark ? 7 : 5;
  const brightColors = isDark
    ? [0xffffdd, 0xffeecc, 0xffeedd, 0xffffff, 0xddeeff, 0xffffff, 0xffffdd]
    : [0x223355, 0x334466, 0x443355, 0x554422, 0x334455];

  // ═══ 深空纹理 ═══
  for (let i = 0; i < deepCount; i++) {
    const pos = clusterPos(w, h, 0.92);
    const s = new Star(starColor(isDark), 0.4 + Math.random() * 1.0, 0.12, 0.20 + Math.random() * 0.30, 0.003 + Math.random() * 0.01, 0.15 + Math.random() * 0.25);
    s.position.set(pos.x, pos.y);
    app.stage.addChild(s as any); items.push(s as any);
  }

  // ═══ 星野 ═══
  for (let i = 0; i < fieldCount; i++) {
    const pos = clusterPos(w, h, 0.85);
    const s = new Star(starColor(isDark), 1 + Math.random() * 2.2, 0.22, 0.45 + Math.random() * 0.40, 0.010 + Math.random() * 0.022, 0.40 + Math.random() * 0.40);
    s.position.set(pos.x, pos.y);
    app.stage.addChild(s as any); items.push(s as any);
  }

  // ═══ 亮星 ═══
  for (let i = 0; i < brightCount; i++) {
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
  trees.fill({ color: isDark ? 0x030610 : 0x5a6b5a, alpha: isDark ? 0.92 : 0.55 });
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

  // ═══ 测试模式：月亮常驻 + 银河粒子带 ═══
  if (testMode && isDark) {
    const moon = new Moon(w, h);
    moon.life = moon.maxLife * 0.5;
    // 测试模式下月亮永不销毁
    const origUpdate = moon.update.bind(moon);
    (moon as any).update = (dt: number) => { origUpdate(dt); moon.life = moon.maxLife * 0.5; return true; };
    app.stage.addChild(moon as any);
    items.push(moon as any); // 月亮不旋转，留在 stage

    // 银河粒子带：位置上移 + 无光晕 + 星尘宽带 + 暗尘缝 + 非均匀聚簇
    const galaxy = new PIXI.Container();
    const galaxyDust = new PIXI.Graphics();

    /** 正态分布随机：让星星集中在银河中心线附近，而不是平均铺开 */
    const gaussian = () => {
      const u = 1 - Math.random();
      const v = 1 - Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
    };

    /** 银河中心线：整体靠上，带一点弯曲，不是死直线 */
    const galaxyCenter = (t: number) => {
      const x = w * (-0.14 + t * 1.28);
      const y = h * (0.005 + t * 0.205 + Math.sin(t * Math.PI * 2 - 0.75) * 0.026);
      return { x, y };
    };

    /** 宽度：中间厚，两端散 */
    const galaxyWidth = (t: number) => {
      return h * (0.026 + Math.sin(t * Math.PI) * 0.060);
    };

    /** 密度：中间更密，两端稀疏 */
    const galaxyDensity = (t: number) => {
      const core = Math.exp(-Math.pow((t - 0.48) / 0.22, 2));
      const side = Math.exp(-Math.pow((t - 0.70) / 0.13, 2)) * 0.36;
      return Math.min(1, 0.16 + core * 0.78 + side);
    };

    /** 按银河斜率计算法线方向，让星带沿斜向自然散开 */
    const galaxyPoint = (t: number, offset: number) => {
      const c = galaxyCenter(t);
      const c2 = galaxyCenter(Math.min(1, t + 0.01));
      const dx = c2.x - c.x;
      const dy = c2.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      return {
        x: c.x + nx * offset,
        y: c.y + ny * offset,
      };
    };

    // 暗尘缝：没有光晕，只用暗裂缝切开星尘，让银河更像真实的银河带
    for (let i = 0; i < 18; i++) {
      const t = 0.08 + i / 20 + (Math.random() - 0.5) * 0.028;
      const width = galaxyWidth(t);
      const c = galaxyPoint(t, gaussian() * width * 0.22);

      galaxyDust.fill({ color: 0x05040c, alpha: 0.10 + Math.random() * 0.10 });
      galaxyDust.ellipse(
        c.x - w / 2,
        c.y - h / 2,
        width * (0.30 + Math.random() * 0.58),
        width * (0.035 + Math.random() * 0.055),
      );
      galaxyDust.fill();
    }

    galaxy.addChild(galaxyDust as any);

    // 星点颜色：银河主体偏冷白，核心混一点暖金
    const galaxyColor = (t: number) => {
      const r = Math.random();
      const coreWarm = Math.exp(-Math.pow((t - 0.48) / 0.18, 2));
      if (r < 0.40 + coreWarm * 0.16) return 0xffffff;
      if (r < 0.66) return 0xddeeff;
      if (r < 0.84) return 0xffeedd;
      if (r < 0.95) return 0xffeecc;
      return 0xbfd7ff;
    };

    const galaxyStars: Updatable[] = [];

    // 主银河星尘：大量小星 + 少量中星 + 极少大星，避免间距平均
    const dustCount = 1250;
    for (let i = 0; i < dustCount; i++) {
      let t: number;

      // 大部分集中在核心附近，少部分散到两端
      if (Math.random() < 0.64) {
        t = Math.max(0, Math.min(1, 0.48 + gaussian() * 0.22));
      } else {
        t = Math.random();
      }

      const density = galaxyDensity(t);
      if (Math.random() > density) continue;

      const width = galaxyWidth(t);
      const offset = gaussian() * width * (0.34 + Math.random() * 0.52);
      const p = galaxyPoint(t, offset);

      if (p.x < -w * 0.12 || p.x > w * 1.12 || p.y < -h * 0.08 || p.y > h * 0.42) continue;

      const r = Math.random();
      const size =
        r < 0.76 ? 0.14 + Math.random() * 0.42 :
        r < 0.94 ? 0.52 + Math.random() * 0.82 :
                   1.20 + Math.random() * 1.45;

      const thickness =
        size < 0.50 ? 0.07 :
        size < 1.15 ? 0.11 :
                      0.17;

      const alpha =
        size < 0.50 ? 0.14 + Math.random() * 0.26 :
        size < 1.15 ? 0.24 + Math.random() * 0.36 :
                      0.36 + Math.random() * 0.40;

      const s = new Star(
        galaxyColor(t),
        size,
        thickness,
        alpha,
        0.003 + Math.random() * 0.012,
        0.08 + Math.random() * 0.20,
      );

      s.position.set(p.x - w / 2, p.y - h / 2);
      galaxy.addChild(s as any);
      items.push(s as any);
      galaxyStars.push(s as any);
    }

    // 局部星团：打破“平均撒点”，形成几块自然的银河亮斑
    const clusters = [
      { t: 0.22, count: 45, spread: 0.72 },
      { t: 0.36, count: 80, spread: 0.60 },
      { t: 0.49, count: 120, spread: 0.52 },
      { t: 0.61, count: 70, spread: 0.62 },
      { t: 0.76, count: 40, spread: 0.78 },
    ];

    for (const cluster of clusters) {
      for (let i = 0; i < cluster.count; i++) {
        const t = Math.max(0, Math.min(1, cluster.t + gaussian() * 0.030));
        const width = galaxyWidth(t);
        const p = galaxyPoint(t, gaussian() * width * cluster.spread);

        const r = Math.random();
        const size =
          r < 0.58 ? 0.30 + Math.random() * 0.50 :
          r < 0.90 ? 0.78 + Math.random() * 1.00 :
                     1.65 + Math.random() * 1.55;

        const s = new Star(
          galaxyColor(t),
          size,
          size > 1.45 ? 0.20 : 0.11,
          0.24 + Math.random() * 0.46,
          0.004 + Math.random() * 0.014,
          0.10 + Math.random() * 0.24,
        );

        s.position.set(p.x - w / 2, p.y - h / 2);
        galaxy.addChild(s as any);
        items.push(s as any);
        galaxyStars.push(s as any);
      }
    }

    // 少量亮星：增强层次，但不做光晕
    for (let i = 0; i < 12; i++) {
      const t = Math.max(0, Math.min(1, 0.47 + gaussian() * 0.25));
      const width = galaxyWidth(t);
      const p = galaxyPoint(t, gaussian() * width * 0.66);
      const c = [0xffffdd, 0xffeecc, 0xffeedd, 0xffffff, 0xddeeff][Math.floor(Math.random() * 5)];

      const s = new BrightStar(
        c,
        1.25 + Math.random() * 1.65,
        0.30 + Math.random() * 0.34,
        0.008 + Math.random() * 0.015,
      );

      s.position.set(p.x - w / 2, p.y - h / 2);
      galaxy.addChild(s as any);
      items.push(s as any);
      galaxyStars.push(s as any);
    }

    // 银河整体放在普通星空后面，避免抢走所有层级
    cosmos.addChildAt(galaxy as any, 0);
  }

  let cometTimer = 80 + Math.random() * 140;
  let moonTimer = testMode ? 999999 : 600 + Math.random() * 800;
  const onTick = (dt: number) => {
    cosmos.rotation += 0.00006 * dt;
    cometTimer -= dt;
    if (cometTimer <= 0) {
      cometTimer = 80 + Math.random() * 160;
      const comet = new Comet(w, h, isDark);
      comet.position.x -= w / 2;
      comet.position.y -= h / 2;
      cosmos.addChild(comet as any);
      items.push(comet as any);
    }
    moonTimer -= dt;
    if (moonTimer <= 0) {
      moonTimer = 600 + Math.random() * 1000;
      const moon = new Moon(w, h);
      app.stage.addChild(moon as any);
      items.push(moon as any);
    }
  };

  return { items, onTick };
}