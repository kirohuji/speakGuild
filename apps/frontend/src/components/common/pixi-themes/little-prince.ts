/**
 * 🪐 Little Prince Theme — 小王子 · 星之旅（移动端优先）
 *
 * 程序化绘制，深空背景 + 5颗主题星球 + 小王子剪影 + 星空闪烁
 * - B-612 小行星（火山、猴面包树苗、路灯）
 * - 玫瑰星球（玻璃罩下的玫瑰）
 * - 潮汐海洋星（漂流瓶、波浪、小帆船）
 * - 小岛星（棕榈树、沙滩、海浪）
 * - 麦田星（麦浪、麦穗、狐狸剪影）
 * - 沙漠星（沙丘、水井、星光倒影）
 */

import * as PIXI from 'pixi.js'
import type { ThemeSetup, Updatable } from './types'

/* ── 类型 ─────────────────────────────────────────────── */

type PlanetType = 'b612' | 'rose' | 'ocean' | 'island' | 'wheat' | 'desert'

interface PlanetColors {
  base: number; accent: number; detail: number; glow: number
}

interface PlanetData {
  cx: number; cy: number; radius: number; type: PlanetType
  wobbleAmp: number; wobbleSpeed: number; wobbleOffset: number
}

/* ── 调色板 ─────────────────────────────────────────────── */

const LIGHT: Record<PlanetType, PlanetColors> = {
  b612:   { base: 0xd4a574, accent: 0x8b4513, detail: 0x2e8b57, glow: 0xffd700 },
  rose:   { base: 0xf0d5d5, accent: 0xcc3366, detail: 0x228b22, glow: 0xffb6c1 },
  ocean:  { base: 0x87ceeb, accent: 0x1e90ff, detail: 0xf5f5dc, glow: 0xe0ffff },
  island: { base: 0x90ee90, accent: 0x228b22, detail: 0xf5deb3, glow: 0x98fb98 },
  wheat:  { base: 0xf0d060, accent: 0xdaa520, detail: 0xcd853f, glow: 0xfff8dc },
  desert: { base: 0xedc9af, accent: 0xd2691e, detail: 0x4682b4, glow: 0xffdead },
}

const DARK: Record<PlanetType, PlanetColors> = {
  b612:   { base: 0x8b7355, accent: 0xcd853f, detail: 0x3cb371, glow: 0xffd700 },
  rose:   { base: 0x6b3a4a, accent: 0xff69b4, detail: 0x2d5a27, glow: 0xffb6c1 },
  ocean:  { base: 0x1c3a5c, accent: 0x4169e1, detail: 0xf0e68c, glow: 0x87ceeb },
  island: { base: 0x2d5a27, accent: 0x3cb371, detail: 0xdeb887, glow: 0x90ee90 },
  wheat:  { base: 0x8b7500, accent: 0xdaa520, detail: 0xa0522d, glow: 0xfffacd },
  desert: { base: 0x6b5344, accent: 0xcd853f, detail: 0x4169e1, glow: 0xffdead },
}

/* ── 辅助绘制 ─────────────────────────────────────────── */

function star4(g: PIXI.Graphics, x: number, y: number, size: number, color: number, alpha: number) {
  const s = size
  g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y)
  g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y)
  g.quadraticCurveTo(x, y, x, y - s); g.closePath()
  g.fill({ color, alpha })
}

function bottle(g: PIXI.Graphics, x: number, y: number, s: number) {
  g.roundRect(x - 3 * s, y - 2 * s, 6 * s, 10 * s, 2 * s)
  g.fill({ color: 0xffffff, alpha: 0.1 })
  g.stroke({ color: 0xffffff, width: Math.max(0.5, 0.8 * s), alpha: 0.25 })
  g.roundRect(x - 1.5 * s, y - 5 * s, 3 * s, 4 * s, 1.5 * s)
  g.fill({ color: 0xffffff, alpha: 0.08 })
  g.stroke({ color: 0xffffff, width: Math.max(0.4, 0.6 * s), alpha: 0.2 })
  g.roundRect(x - 2 * s, y - 6 * s, 4 * s, 2 * s, 1 * s)
  g.fill({ color: 0xcd853f, alpha: 0.3 })
  g.roundRect(x - 1.5 * s, y + 1 * s, 3 * s, 5 * s, 1 * s)
  g.fill({ color: 0xfffacd, alpha: 0.15 })
  g.arc(x, y - 4 * s, 1.5 * s, -0.5, 0.5)
  g.stroke({ color: 0xffffff, width: Math.max(0.3, 0.5 * s), alpha: 0.3 })
}

/* ══════════════════════════════════════════════════════════════
   星球绘制（相对于原点 0,0，半径 r。所有尺寸相对 r 缩放）
   ══════════════════════════════════════════════════════════════ */

function drawB612(g: PIXI.Graphics, r: number, c: PlanetColors) {
  g.circle(0, 0, r); g.fill({ color: c.base, alpha: 0.88 })
  // 环形山
  for (let i = 0; i < 5; i++) {
    g.circle(
      Math.cos(i * 1.6 + 0.3) * r * 0.5,
      Math.sin(i * 1.6 + 0.3) * r * 0.4,
      r * (0.06 + i * 0.02),
    ); g.fill({ color: c.accent, alpha: 0.3 })
  }
  // 三座火山
  const vs = [
    { x: -r * 0.22, y: -r * 0.32, h: r * 0.18 },
    { x: r * 0.28, y: -r * 0.12, h: r * 0.13 },
    { x: -r * 0.35, y: r * 0.18, h: r * 0.1 },
  ]
  for (const v of vs) {
    g.moveTo(v.x - v.h * 0.38, v.y + v.h * 0.28)
    g.lineTo(v.x, v.y - v.h); g.lineTo(v.x + v.h * 0.38, v.y + v.h * 0.28)
    g.closePath(); g.fill({ color: c.accent, alpha: 0.7 })
  }
  for (let i = 0; i < 2; i++) {
    g.circle(vs[i].x, vs[i].y - vs[i].h - 2, r * 0.06)
    g.fill({ color: 0xffffff, alpha: 0.15 })
  }
  // 猴面包树苗 + 树冠
  const bx = r * 0.42, by = r * 0.48
  g.moveTo(bx, by); g.lineTo(bx - 2, by - r * 0.16)
  g.stroke({ color: c.detail, width: Math.max(1.5, r * 0.035), alpha: 0.75 })
  g.circle(bx - 1, by - r * 0.17, r * 0.08); g.fill({ color: c.detail, alpha: 0.35 })
  // 路灯
  const lx = -r * 0.35, ly = r * 0.42
  g.roundRect(lx - r * 0.05, ly - r * 0.2, r * 0.08, r * 0.22, r * 0.03)
  g.fill({ color: c.accent, alpha: 0.55 })
  g.circle(lx - r * 0.01, ly - r * 0.22, r * 0.11)
  g.fill({ color: c.glow, alpha: 0.3 })
  g.circle(lx - r * 0.01, ly - r * 0.22, r * 0.18)
  g.fill({ color: c.glow, alpha: 0.05 })
  // 小天文台
  const ox = r * 0.2, oy = -r * 0.45
  g.roundRect(ox - r * 0.08, oy, r * 0.16, r * 0.1, r * 0.03)
  g.fill({ color: 0xddd5c0, alpha: 0.4 })
  g.arc(ox, oy, r * 0.08, Math.PI, 0)
  g.fill({ color: 0xccbbaa, alpha: 0.5 })
}

function drawRose(g: PIXI.Graphics, r: number, c: PlanetColors) {
  g.circle(0, 0, r); g.fill({ color: c.base, alpha: 0.82 })
  // 草丛
  const gy = r * 0.18
  for (let i = 0; i < 9; i++) {
    const gx = -r * 0.58 + i * r * 0.14
    g.moveTo(gx, gy); g.lineTo(gx + 2, gy - r * 0.1); g.lineTo(gx - 2, gy - r * 0.05)
    g.closePath(); g.fill({ color: c.detail, alpha: 0.45 })
  }
  // 散落的小花
  for (let i = 0; i < 5; i++) {
    const fx = -r * 0.4 + i * r * 0.2, fy = gy + r * 0.05 + (i % 2) * r * 0.08
    g.circle(fx, fy, r * 0.03); g.fill({ color: 0xffccdd, alpha: 0.4 })
    g.circle(fx, fy, r * 0.015); g.fill({ color: 0xffd700, alpha: 0.5 })
  }
  // 蝴蝶
  const bx = r * 0.35, by = gy - r * 0.05
  g.ellipse(bx - r * 0.03, by, r * 0.04, r * 0.025); g.fill({ color: 0xffffff, alpha: 0.25 })
  g.ellipse(bx + r * 0.03, by, r * 0.04, r * 0.025); g.fill({ color: 0xffffff, alpha: 0.2 })
  // 玻璃罩 + 玫瑰
  const domeR = r * 0.2, domeCy = gy - r * 0.08
  g.circle(0, domeCy - domeR * 0.3, domeR)
  g.fill({ color: 0xffffff, alpha: 0.07 })
  g.stroke({ color: 0xffffff, alpha: 0.22, width: Math.max(0.8, r * 0.02) })
  g.roundRect(-domeR * 0.55, domeCy + domeR * 0.48, domeR * 1.1, r * 0.05, r * 0.02)
  g.fill({ color: 0x8b7355, alpha: 0.55 })
  const stemY = domeCy - domeR * 0.08
  g.moveTo(0, domeCy + domeR * 0.42); g.lineTo(2, stemY + 2)
  g.stroke({ color: c.detail, width: Math.max(1.2, r * 0.025), alpha: 0.85 })
  for (let i = 0; i < 5; i++) {
    g.circle(Math.cos(i * 1.25) * r * 0.09, stemY + Math.sin(i * 1.25) * r * 0.07, r * 0.07)
    g.fill({ color: c.accent, alpha: 0.75 })
  }
  g.circle(0, stemY, r * 0.05); g.fill({ color: 0xffd700, alpha: 0.55 })
}

function drawOcean(g: PIXI.Graphics, r: number, c: PlanetColors, t: number) {
  g.circle(0, 0, r); g.fill({ color: c.base, alpha: 0.88 })
  // 波浪
  for (let i = 1; i <= 3; i++) {
    const wr = r * (0.35 + i * 0.2)
    g.arc(0, r * 0.04, wr,
      Math.PI * 0.12 + Math.sin(t + i) * 0.12,
      Math.PI * 0.88 + Math.cos(t + i) * 0.1)
    g.stroke({ color: 0xffffff, width: Math.max(0.8, r * 0.02), alpha: 0.1 + i * 0.06 })
  }
  g.arc(r * 0.12, -r * 0.18, r * 0.5, -0.5, 1.1)
  g.fill({ color: c.accent, alpha: 0.12 })
  // 小灯塔（礁石上）
  const lx = r * 0.45, ly = -r * 0.25
  g.roundRect(lx - r * 0.04, ly, r * 0.08, r * 0.14, r * 0.02)
  g.fill({ color: 0xffffff, alpha: 0.25 })
  g.roundRect(lx - r * 0.04, ly, r * 0.08, r * 0.14, r * 0.02)
  g.stroke({ color: 0xcccccc, width: Math.max(0.5, r * 0.01), alpha: 0.3 })
  // 塔顶灯笼
  g.circle(lx, ly, r * 0.05); g.fill({ color: c.glow, alpha: 0.2 })
  // 灯塔光柱
  g.moveTo(lx, ly); g.lineTo(lx + r * 0.15, ly - r * 0.08)
  g.stroke({ color: c.glow, width: Math.max(0.5, r * 0.01), alpha: 0.06 })
  // 漂流瓶
  const b1x = Math.cos(t * 0.7) * r * 0.48, b1y = Math.sin(t * 0.9) * r * 0.32 + r * 0.04
  bottle(g, b1x, b1y, Math.max(0.3, r * 0.012))
  g.circle(b1x, b1y, r * 0.06); g.stroke({ color: 0xffffff, width: 0.6, alpha: 0.15 })
  const b2x = Math.cos(t * 0.7 + 2.5) * r * 0.36, b2y = Math.sin(t * 0.9 + 2.5) * r * 0.26 - r * 0.08
  bottle(g, b2x, b2y, Math.max(0.2, r * 0.008))
  // 小帆船
  const sx = Math.cos(t * 0.5 + 1.2) * r * 0.32, sy = Math.sin(t * 0.5 + 1.2) * r * 0.18 - r * 0.04
  g.moveTo(sx - 4, sy + 3); g.lineTo(sx + 2, sy - 5); g.lineTo(sx + 5, sy + 3)
  g.closePath(); g.fill({ color: c.detail, alpha: 0.45 })
  // 海鸥
  for (let i = 0; i < 2; i++) {
    const gx = -r * 0.3 + i * r * 0.2 + Math.sin(t * 0.8 + i) * r * 0.08
    const gy = -r * 0.28 + i * r * 0.06
    g.moveTo(gx - r * 0.03, gy); g.lineTo(gx, gy - r * 0.025); g.lineTo(gx + r * 0.03, gy)
    g.stroke({ color: 0xffffff, width: Math.max(0.4, r * 0.01), alpha: 0.35 })
  }
}

function drawIsland(g: PIXI.Graphics, r: number, c: PlanetColors, t: number) {
  // 沙洲基底
  g.ellipse(0, r * 0.08, r * 0.85, r * 0.5); g.fill({ color: c.detail, alpha: 0.65 })
  // 绿色植被
  g.ellipse(0, -r * 0.04, r * 0.65, r * 0.32); g.fill({ color: c.base, alpha: 0.6 })
  // 棕榈树
  const px = -r * 0.12, py = -r * 0.18
  g.moveTo(px, py + r * 0.3); g.lineTo(px + 2, py)
  g.stroke({ color: c.accent, width: Math.max(2, r * 0.06), alpha: 0.65 })
  for (let i = 0; i < 5; i++) {
    const a = i * 0.5 - 0.6
    g.moveTo(px + 2, py); g.lineTo(px + Math.cos(a) * r * 0.18, py + Math.sin(a) * r * 0.18)
    g.stroke({ color: c.detail, width: Math.max(1, r * 0.03), alpha: 0.55 })
  }
  g.circle(px + 2, py + r * 0.04, r * 0.05); g.fill({ color: c.accent, alpha: 0.45 })
  // 小木屋
  const hx = r * 0.22, hy = -r * 0.08
  g.roundRect(hx - r * 0.08, hy, r * 0.16, r * 0.14, r * 0.02)
  g.fill({ color: 0xdeb887, alpha: 0.5 })
  g.roundRect(hx - r * 0.08, hy, r * 0.16, r * 0.14, r * 0.02)
  g.stroke({ color: 0xa08060, width: Math.max(0.5, r * 0.012), alpha: 0.4 })
  // 屋顶（三角）
  g.moveTo(hx - r * 0.1, hy); g.lineTo(hx, hy - r * 0.1); g.lineTo(hx + r * 0.1, hy)
  g.closePath(); g.fill({ color: 0xcc5533, alpha: 0.5 })
  // 门
  g.roundRect(hx - r * 0.02, hy + r * 0.04, r * 0.04, r * 0.1, r * 0.01)
  g.fill({ color: 0x6b4226, alpha: 0.4 })
  // 窗户
  g.circle(hx - r * 0.04, hy + r * 0.03, r * 0.025)
  g.fill({ color: 0xffeebb, alpha: 0.3 })
  g.circle(hx + r * 0.04, hy + r * 0.03, r * 0.025)
  g.fill({ color: 0xffeebb, alpha: 0.3 })
  // 小码头
  const dx = r * 0.35, dy = r * 0.18
  g.roundRect(dx - r * 0.06, dy - r * 0.02, r * 0.12, r * 0.04, r * 0.01)
  g.fill({ color: 0xc0a080, alpha: 0.4 })
  // 贝壳
  for (let i = 0; i < 2; i++) {
    g.circle(r * 0.18 + i * r * 0.12, r * 0.14 + i * r * 0.08, r * 0.04)
    g.fill({ color: 0xffffff, alpha: 0.25 })
  }
  // 海浪
  g.arc(-r * 0.38, r * 0.12, r * 0.5, -0.18 + Math.sin(t) * 0.06, 0.45)
  g.stroke({ color: 0xffffff, width: Math.max(0.8, r * 0.02), alpha: 0.18 })
}

function drawWheat(g: PIXI.Graphics, r: number, c: PlanetColors, t: number) {
  g.circle(0, 0, r); g.fill({ color: c.base, alpha: 0.82 })
  // 麦浪纹理
  for (let i = 0; i < 5; i++) {
    g.arc(0, -r * 0.22 + i * r * 0.11, r * 0.65,
      -0.25 + Math.sin(t + i * 0.4) * 0.08,
      0.25 + Math.cos(t + i * 0.4) * 0.08)
    g.stroke({ color: c.accent, width: Math.max(0.8, r * 0.02), alpha: 0.18 })
  }
  // 麦穗
  for (let i = 0; i < 6; i++) {
    const wx = -r * 0.4 + i * r * 0.16, wy = r * 0.08 - Math.abs(i - 2.5) * r * 0.06
    const h = r * 0.18 + Math.abs(i - 2.5) * r * 0.05
    g.moveTo(wx, wy); g.lineTo(wx + Math.sin(t + i) * 2, wy - h)
    g.stroke({ color: c.accent, width: Math.max(1, r * 0.025), alpha: 0.5 })
    for (let j = 0; j < 2; j++) {
      g.circle(wx + Math.sin(t + i + j) * 2, wy - h * (0.35 + j * 0.25), r * 0.03)
      g.fill({ color: c.glow, alpha: 0.3 })
    }
  }
  // 农舍
  const fx = -r * 0.3, fy = -r * 0.2
  g.roundRect(fx - r * 0.07, fy, r * 0.14, r * 0.12, r * 0.02)
  g.fill({ color: 0xe8d5b0, alpha: 0.5 })
  g.moveTo(fx - r * 0.09, fy); g.lineTo(fx, fy - r * 0.08); g.lineTo(fx + r * 0.09, fy)
  g.closePath(); g.fill({ color: 0xcc5533, alpha: 0.45 })
  // 烟囱
  g.roundRect(fx + r * 0.02, fy - r * 0.06, r * 0.03, r * 0.05, r * 0.01)
  g.fill({ color: 0x8b7355, alpha: 0.4 })
  // 狐狸剪影
  const foxX = r * 0.28, foxY = -r * 0.06
  g.ellipse(foxX, foxY, r * 0.09, r * 0.06); g.fill({ color: c.detail, alpha: 0.45 })
  g.circle(foxX + r * 0.09, foxY - r * 0.02, r * 0.05); g.fill({ color: c.detail, alpha: 0.45 })
  g.moveTo(foxX + r * 0.07, foxY - r * 0.06); g.lineTo(foxX + r * 0.05, foxY - r * 0.1); g.lineTo(foxX + r * 0.1, foxY - r * 0.05)
  g.closePath(); g.fill({ color: c.detail, alpha: 0.4 })
  g.moveTo(foxX - r * 0.07, foxY)
  g.quadraticCurveTo(foxX - r * 0.16, foxY - r * 0.08, foxX - r * 0.1, foxY - r * 0.13)
  g.stroke({ color: c.detail, width: Math.max(2, r * 0.04), alpha: 0.4 })
  // 飞鸟
  for (let i = 0; i < 2; i++) {
    const birdX = -r * 0.35 + i * 0.25 + Math.sin(t * 1.5 + i) * r * 0.1
    const birdY = -r * 0.35 + i * r * 0.1
    g.moveTo(birdX - r * 0.04, birdY); g.lineTo(birdX, birdY - r * 0.03); g.lineTo(birdX + r * 0.04, birdY)
    g.stroke({ color: c.accent, width: Math.max(0.5, r * 0.012), alpha: 0.4 })
  }
}

function drawDesert(g: PIXI.Graphics, r: number, c: PlanetColors) {
  g.circle(0, 0, r); g.fill({ color: c.base, alpha: 0.88 })
  // 沙丘纹理
  for (let i = 0; i < 4; i++) {
    g.arc(0, -r * 0.12 + i * r * 0.1, r * 0.5, -0.45, 0.45)
    g.stroke({ color: c.accent, width: Math.max(0.8, r * 0.02), alpha: 0.18 })
  }
  // 金字塔
  const px = r * 0.35, py = r * 0.05, ph = r * 0.22, pw = r * 0.16
  g.moveTo(px - pw, py + ph * 0.3); g.lineTo(px, py - ph); g.lineTo(px + pw, py + ph * 0.3)
  g.closePath(); g.fill({ color: c.accent, alpha: 0.4 })
  g.moveTo(px - pw, py + ph * 0.3); g.lineTo(px, py - ph); g.lineTo(px + pw, py + ph * 0.3)
  g.stroke({ color: c.detail, width: Math.max(0.5, r * 0.012), alpha: 0.35 })
  // 小金字塔
  const p2x = px + r * 0.12, p2h = ph * 0.5, p2w = pw * 0.5
  g.moveTo(p2x - p2w, py + ph * 0.3); g.lineTo(p2x, py - p2h + ph * 0.3); g.lineTo(p2x + p2w, py + ph * 0.3)
  g.closePath(); g.fill({ color: c.accent, alpha: 0.3 })
  // 水井
  const ww = r * 0.12, wx = -r * 0.2, wy = -r * 0.06
  g.roundRect(wx - ww, wy - ww * 0.7, ww * 2, ww * 1.1, r * 0.03); g.fill({ color: c.accent, alpha: 0.35 })
  g.roundRect(wx - ww, wy - ww * 0.7, ww * 2, ww * 1.1, r * 0.03); g.stroke({ color: c.detail, width: Math.max(0.8, r * 0.015), alpha: 0.45 })
  g.ellipse(wx, wy - ww * 0.7, ww * 0.7, ww * 0.25); g.fill({ color: c.detail, alpha: 0.35 })
  g.circle(wx, wy - ww * 0.75, ww * 0.12); g.fill({ color: c.glow, alpha: 0.2 })
  g.moveTo(wx - ww * 0.5, wy - ww * 0.7); g.lineTo(wx, wy - ww * 1.15); g.lineTo(wx + ww * 0.5, wy - ww * 0.7)
  g.stroke({ color: c.accent, width: Math.max(1, r * 0.025), alpha: 0.45 })
  g.roundRect(wx - r * 0.06, wy - ww * 0.9, r * 0.1, r * 0.08, r * 0.02); g.fill({ color: c.detail, alpha: 0.35 })
  // 仙人掌
  const cx = -r * 0.4, cy = r * 0.1
  g.roundRect(cx - r * 0.02, cy - r * 0.12, r * 0.04, r * 0.18, r * 0.02)
  g.fill({ color: c.detail, alpha: 0.4 })
  g.moveTo(cx + r * 0.02, cy - r * 0.04); g.lineTo(cx + r * 0.07, cy - r * 0.04); g.lineTo(cx + r * 0.07, cy - r * 0.12)
  g.lineTo(cx + r * 0.12, cy - r * 0.12); g.lineTo(cx + r * 0.12, cy - r * 0.06)
  g.stroke({ color: c.detail, width: Math.max(1, r * 0.018), alpha: 0.4 })
  // 表面星星
  for (let i = 0; i < 5; i++) {
    star4(g, Math.cos(i * 1.3 + 0.4) * r * 0.45, Math.sin(i * 1.3 + 0.4) * r * 0.35 + r * 0.08, r * 0.05, c.glow, 0.2)
  }
}

/* ══════════════════════════════════════════════════════════════
   setupLittlePrince — 移动端优先
   ══════════════════════════════════════════════════════════════ */

const TYPES: PlanetType[] = ['b612', 'rose', 'ocean', 'island', 'wheat', 'desert']

const drawFns: Record<PlanetType, (g: PIXI.Graphics, r: number, c: PlanetColors, t: number) => void> = {
  b612:   (g, r, c)    => drawB612(g, r, c),
  rose:   (g, r, c)    => drawRose(g, r, c),
  ocean:  (g, r, c, t) => drawOcean(g, r, c, t),
  island: (g, r, c, t) => drawIsland(g, r, c, t),
  wheat:  (g, r, c, t) => drawWheat(g, r, c, t),
  desert: (g, r, c)    => drawDesert(g, r, c),
}

export function setupLittlePrince(
  app: PIXI.Application,
  w: number,
  h: number,
  isDark: boolean,
): ThemeSetup {
  const W = w
  const H = h
  const isPortrait = H > W

  // 基准尺寸：短边的比例来缩放所有元素
  const S = Math.min(W, H)
  const planetBaseR = S * (isPortrait ? 0.065 : 0.08)
  const palette = isDark ? DARK : LIGHT
  const bgColor = isDark ? 0x0a0a1a : 0xf5f0e8
  const starColor = isDark ? 0xfff5cc : 0xffd700

  // ── 背景 + 星云 ──
  const bg = new PIXI.Graphics()
  bg.rect(0, 0, W, H); bg.fill({ color: bgColor, alpha: 1 })
  app.stage.addChild(bg)

  const nebula = new PIXI.Graphics()
  const nebulaColors = isDark ? [0x4a3080, 0x1a3a5c, 0x3a2050] : [0xffd5c0, 0xc0e0ff, 0xffe0d0]
  for (let i = 0; i < 3; i++) {
    nebula.circle(W * (0.2 + i * 0.3), H * (0.25 + i * 0.2), S * 0.3)
    nebula.fill({ color: nebulaColors[i], alpha: 0.025 })
  }
  app.stage.addChild(nebula)

  // ── 星星（移动端减量：50颗）──
  const starCount = 50
  const stars = Array.from({ length: starCount }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.8,
    size: S * (0.001 + Math.random() * 0.004),
    speed: 0.3 + Math.random() * 1.5,
    phase: Math.random() * Math.PI * 2,
  }))
  const starGfx = new PIXI.Graphics()
  app.stage.addChild(starGfx)

  const constellation = new PIXI.Graphics()
  app.stage.addChild(constellation)

  // ── 星球布局 ──
  // 竖屏：左上角为锚点，沿左侧纵向错落（留给右侧 UI 空间）
  // 横屏：环绕中心分布
  const planetCount = 5
  const shuffled = [...TYPES].sort(() => Math.random() - 0.5).slice(0, planetCount)
  const planets: PlanetData[] = shuffled.map((type, i) => {
    let cx: number, cy: number
    if (isPortrait) {
      const frac = (i + 0.5) / planetCount
      // 左侧 8%-38% 宽度区间内 zigzag
      cx = W * (0.1 + Math.sin(frac * Math.PI * 2.2) * 0.15)
      // 顶部 6% 到底部 68% 纵向分布
      cy = H * (0.1 + frac * 0.62)
    } else {
      const angle = (i / planetCount) * Math.PI * 2 + Math.random() * 0.5
      const dist = W * (0.18 + i * 0.05)
      cx = W * 0.5 + Math.cos(angle) * dist
      cy = H * 0.5 + Math.sin(angle) * dist * 0.55
    }
    return {
      cx, cy,
      radius: planetBaseR * (0.8 + Math.random() * 1.1) + (i === 0 ? planetBaseR * 0.4 : 0),
      type,
      wobbleAmp: S * (0.003 + Math.random() * 0.008),
      wobbleSpeed: 0.25 + Math.random() * 0.5,
      wobbleOffset: Math.random() * Math.PI * 2,
    }
  })

  const planetGfxs: { gfx: PIXI.Graphics; data: PlanetData; glow: PIXI.Graphics }[] = []
  for (const p of planets) {
    const gfx = new PIXI.Graphics()
    gfx.x = p.cx; gfx.y = p.cy
    const glow = new PIXI.Graphics()
    glow.circle(p.cx, p.cy, p.radius * 1.4)
    glow.fill({ color: palette[p.type].glow, alpha: 0.05 })
    app.stage.addChild(glow)
    app.stage.addChild(gfx)
    planetGfxs.push({ gfx, data: p, glow })
    drawFns[p.type](gfx, p.radius, palette[p.type], 0)
  }

  // ── 小王子 + 飞机 ──
  // 小飞机在星球间穿梭的基准路径
  const planePath = {
    cx: W * (isPortrait ? 0.75 : 0.5),
    cy: H * (isPortrait ? 0.78 : 0.68),
    rx: W * (isPortrait ? 0.12 : 0.25),
    ry: H * (isPortrait ? 0.06 : 0.10),
  }
  const planeContainer = new PIXI.Container()
  planeContainer.alpha = 0.55
  app.stage.addChild(planeContainer)

  // 绘制小王子双翼飞机
  const planeGfx = new PIXI.Graphics()
  const drawPlane = (s: number) => {
    planeGfx.clear()
    // 机身
    planeGfx.roundRect(-10 * s, -3 * s, 20 * s, 5 * s, 2 * s)
    planeGfx.fill({ color: 0xd4a574, alpha: 0.7 })
    // 上翼
    planeGfx.roundRect(-7 * s, -8 * s, 14 * s, 2.5 * s, 1.5 * s)
    planeGfx.fill({ color: 0xcd853f, alpha: 0.6 })
    // 下翼
    planeGfx.roundRect(-6 * s, 4 * s, 12 * s, 2 * s, 1 * s)
    planeGfx.fill({ color: 0xcd853f, alpha: 0.5 })
    // 翼间支柱
    for (let i = -1; i <= 1; i += 2) {
      planeGfx.moveTo(i * 4 * s, -5.5 * s); planeGfx.lineTo(i * 3.5 * s, 4 * s)
      planeGfx.stroke({ color: 0x8b7355, width: Math.max(0.8, s * 2), alpha: 0.5 })
    }
    // 尾翼
    planeGfx.moveTo(8 * s, -2 * s); planeGfx.lineTo(12 * s, -5 * s); planeGfx.lineTo(12 * s, -1 * s)
    planeGfx.closePath(); planeGfx.fill({ color: 0xcd853f, alpha: 0.5 })
    // 螺旋桨
    planeGfx.moveTo(-10 * s, -1 * s); planeGfx.lineTo(-13 * s, 1.5 * s)
    planeGfx.stroke({ color: 0x8b7355, width: Math.max(1, s * 2.5), alpha: 0.6 })
    // 驾驶舱（小王子）
    planeGfx.circle(-2 * s, -1.5 * s, 3 * s)
    planeGfx.fill({ color: 0xffdead, alpha: 0.55 })
    // 金色围巾飘在机舱后
    planeGfx.moveTo(1 * s, -1 * s)
    planeGfx.quadraticCurveTo(5 * s, -4 * s, 8 * s, 0)
    planeGfx.quadraticCurveTo(4 * s, -1 * s, 1 * s, 0)
    planeGfx.fill({ color: 0xffd700, alpha: 0.4 })
  }
  const planeScale = Math.max(0.6, S * 0.001)
  drawPlane(planeScale)
  planeContainer.addChild(planeGfx)

  // ── 纸飞机（在星球之间飘荡）──
  const paperPlanes = planets.slice(1).map((planet, i) => {
    // 每架纸飞机从一颗星球附近出发，飞向另一颗
    const from = planet
    const to = planets[(i + 2) % planets.length]
    const t0 = Math.random() * Math.PI * 2
    return {
      fromX: from.cx, fromY: from.cy,
      toX: to.cx, toY: to.cy,
      t: t0,
      speed: 0.3 + Math.random() * 0.5,
      size: Math.max(0.4, S * (0.0006 + Math.random() * 0.0004)),
      wobble: Math.random() * Math.PI * 2,
    }
  })
  // 额外加 2 架自由漂的纸飞机
  for (let i = 0; i < 2; i++) {
    const a = planets[i % planets.length]
    const b = planets[(i + 3) % planets.length]
    paperPlanes.push({
      fromX: a.cx, fromY: a.cy,
      toX: b.cx, toY: b.cy,
      t: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.3,
      size: Math.max(0.3, S * (0.0005 + Math.random() * 0.0003)),
      wobble: Math.random() * Math.PI * 2,
    })
  }
  const paperPlaneGfx = new PIXI.Graphics()
  app.stage.addChild(paperPlaneGfx)

  // 绘制纸飞机
  const drawPaperPlane = (g: PIXI.Graphics, x: number, y: number, s: number, angle: number) => {
    g.setTransform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), x, y)
    g.moveTo(12 * s, 0); g.lineTo(-10 * s, -5 * s); g.lineTo(-8 * s, 0); g.lineTo(-10 * s, 5 * s)
    g.closePath()
    g.fill({ color: 0xffffff, alpha: 0.25 })
    g.stroke({ color: 0xffffff, width: Math.max(0.5, s * 2), alpha: 0.2 })
    g.moveTo(4 * s, 0); g.lineTo(-5 * s, -3 * s); g.lineTo(-4 * s, 0); g.lineTo(-5 * s, 3 * s)
    g.closePath()
    g.fill({ color: 0xffffff, alpha: 0.12 })
  }

  // ── 小行星带（移动端减量：18颗）──
  const beltStars = Array.from({ length: 18 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: 0.8 + Math.random() * 1.8,
    speed: 0.15 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
  }))
  const beltGfx = new PIXI.Graphics()
  app.stage.addChild(beltGfx)

  // ── Tick ──
  let time = 0
  const onTick = (dt: number, _w2: number, _h2: number, _items: Updatable[]) => {
    time += dt * 0.016

    starGfx.clear()
    for (const s of stars) {
      starGfx.circle(s.x, s.y, s.size)
      starGfx.fill({ color: starColor, alpha: Math.max(0.08, 0.2 + 0.35 * Math.sin(time * s.speed + s.phase)) })
    }

    constellation.clear()
    for (let i = 0; i < stars.length; i += 12) {
      const a = stars[i], b = stars[(i + 6) % stars.length]
      if (Math.hypot(a.x - b.x, a.y - b.y) < S * 0.3 && a.size > S * 0.0015 && b.size > S * 0.0015) {
        constellation.moveTo(a.x, a.y); constellation.lineTo(b.x, b.y)
        constellation.stroke({ color: starColor, width: 0.3, alpha: 0.05 })
      }
    }

    const col = isDark ? DARK : LIGHT
    for (const pg of planetGfxs) {
      pg.gfx.clear()
      const wx = pg.data.cx + Math.cos(time * pg.data.wobbleSpeed + pg.data.wobbleOffset) * pg.data.wobbleAmp
      const wy = pg.data.cy + Math.sin(time * pg.data.wobbleSpeed * 1.3 + pg.data.wobbleOffset) * pg.data.wobbleAmp * 0.7
      pg.gfx.x = wx; pg.gfx.y = wy; pg.glow.x = wx; pg.glow.y = wy
      drawFns[pg.data.type](pg.gfx, pg.data.radius, col[pg.data.type], time)
    }

    beltGfx.clear()
    for (const bs of beltStars) {
      beltGfx.circle(
        bs.x + Math.cos(time * bs.speed + bs.phase) * 6,
        bs.y + Math.sin(time * bs.speed + bs.phase) * 5,
        bs.r,
      )
      beltGfx.fill({ color: starColor, alpha: 0.1 + 0.08 * Math.sin(time + bs.phase) })
    }

    // 小飞机沿椭圆路径飞行
    const planeAngle = time * 0.35
    planeContainer.x = planePath.cx + Math.cos(planeAngle) * planePath.rx
    planeContainer.y = planePath.cy + Math.sin(planeAngle * 1.3) * planePath.ry
    planeContainer.rotation = Math.sin(planeAngle * 0.7) * 0.3 + 0.1
    // 围巾飘动重绘
    if (Math.floor(time * 4) % 2 === 0) {
      drawPlane(planeScale)
    }
    planeContainer.alpha = 0.45 + 0.1 * Math.sin(time * 0.5)

    // 纸飞机
    paperPlaneGfx.clear()
    for (const pp of paperPlanes) {
      pp.t += pp.speed * 0.008
      const frac = (Math.sin(pp.t) + 1) / 2 // 0→1→0 来回
      const px = pp.fromX + (pp.toX - pp.fromX) * frac
      const py = pp.fromY + (pp.toY - pp.fromY) * frac + Math.sin(pp.t * 3) * S * 0.02
      const angle = Math.atan2(pp.toY - pp.fromY, pp.toX - pp.fromX) + Math.sin(pp.t * 4 + pp.wobble) * 0.25
      drawPaperPlane(paperPlaneGfx, px, py, pp.size, angle)
    }

    // 纸飞机呼吸式透明度
    paperPlaneGfx.alpha = 0.7 + 0.2 * Math.sin(time * 0.3)
  }

  return { items: [], onTick }
}
