/**
 * 移动端用户操作辅助工具
 *
 * 提供符合移动端交互习惯的操作封装：
 * - tap（点击，自动等待动画完成）
 * - swipe（滑动）
 * - scrollTo（滚动）
 * - waitForPageReady（等待路由切换完成）
 */
import { Page, Locator, expect } from '@playwright/test'

/* ── 路由辅助 ── */

/** 等待 Hash 路由切换完成 + 网络请求静默 */
export async function waitForPageReady(page: Page, timeout = 10_000) {
  // 等网络空闲
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // 某些 SSE/WebSocket 连接可能一直活跃，忽略超时
  })
  // 等骨架屏消失
  await page.locator('.animate-pulse').first().waitFor({ state: 'hidden', timeout }).catch(() => {
    // 可能没有骨架屏
  })
  // 小延迟让动画完成
  await page.waitForTimeout(300)
}

/* ── 触摸操作 ── */

/** 模拟移动端 tap（点击 + 短暂等待反馈） */
export async function tap(locator: Locator) {
  await locator.tap()
  await locator.page().waitForTimeout(150)
}

/** 模拟移动端 swipe（从左向右滑动） */
export async function swipeRight(page: Page, startX = 50, startY = 400, distance = 200) {
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + distance, startY, { steps: 10 })
  await page.mouse.up()
}

/** 模拟移动端 swipe（从右向左滑动） */
export async function swipeLeft(page: Page, startX = 350, startY = 400, distance = 200) {
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - distance, startY, { steps: 10 })
  await page.mouse.up()
}

/** 向下滚动 */
export async function scrollDown(page: Page, distance = 300) {
  await page.mouse.wheel(0, distance)
  await page.waitForTimeout(200)
}

/* ── 导航辅助 ── */

/** 通过 Hash 路由直接导航 */
export async function navigateTo(page: Page, hashPath: string) {
  await page.goto(`/#${hashPath}`)
  await waitForPageReady(page)
}

/** 点击底部 Tab 导航项 */
export async function tapTab(page: Page, tabLabel: string) {
  const tab = page.locator('nav').getByText(tabLabel, { exact: false })
  await tap(tab)
  await waitForPageReady(page)
}

/* ── 断言辅助 ── */

/** 断言页面包含指定文本（用于验证页面内容） */
export async function expectVisible(page: Page, text: string) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 })
}

/** 检查是否在移动端视口 */
export function isMobileViewport(page: Page) {
  const viewport = page.viewportSize()
  return viewport ? viewport.width < 768 : false
}
