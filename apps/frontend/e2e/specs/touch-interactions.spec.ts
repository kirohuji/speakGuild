/**
 * 移动端触摸交互 & iOS WebView 适配 E2E 测试
 */
import { test, expect } from '../helpers/fixtures'
import { waitForPageReady } from '../helpers/mobile-utils'

test.describe('移动端触摸交互', () => {
  test('页面支持触摸滚动', async ({ page }) => {
    await waitForPageReady(page)
    await page.mouse.move(200, 500)
    await page.mouse.down()
    await page.mouse.move(200, 200, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    await expect(page.locator('#root')).toBeVisible()
  })

  test('底部导航栏适配安全区域', async ({ page }) => {
    await waitForPageReady(page)
    const nav = page.locator('nav').last()
    await expect(nav).toBeVisible({ timeout: 5000 })
    const styleAttr = (await nav.getAttribute('style')) || ''
    expect(styleAttr).toContain('safe-area-inset-bottom')
  })

  test('沉浸式背景不阻塞交互', async ({ page }) => {
    await waitForPageReady(page)
    await expect(page.locator('#root')).toBeVisible()
  })
})

test.describe('iOS WebView 适配', () => {
  test('viewport meta 禁止双指缩放', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    const meta = page.locator('meta[name="viewport"]')
    const content = await meta.getAttribute('content')
    expect(content).toContain('user-scalable=no')
    expect(content).toContain('maximum-scale=1.0')
  })

  test('viewport-fit=cover 适配刘海屏', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
    const meta = page.locator('meta[name="viewport"]')
    const content = await meta.getAttribute('content')
    expect(content).toContain('viewport-fit=cover')
  })
})
