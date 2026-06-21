/**
 * 底部导航栏 E2E 测试
 *
 * 模拟移动端用户在 4 个主 Tab 之间切换
 */
import { test, expect } from '../helpers/fixtures'
import { waitForPageReady, tap } from '../helpers/mobile-utils'

test.describe('底部导航 - Tab 切换', () => {
  test('底部导航 Tab 数量正确', async ({ page }) => {
    await waitForPageReady(page)
    const navItems = page.locator('nav a')
    const count = await navItems.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('点击「今日任务」Tab 跳转正确', async ({ page }) => {
    await waitForPageReady(page)
    const todayLink = page.locator('nav a[href="/today"]')
    await expect(todayLink).toBeVisible({ timeout: 5000 })
    await tap(todayLink)
    await waitForPageReady(page)
    expect(page.url()).toContain('/today')
  })

  test('点击「学习计划」Tab 跳转正确', async ({ page }) => {
    await waitForPageReady(page)
    const learningLink = page.locator('nav a[href="/learning"]')
    await expect(learningLink).toBeVisible({ timeout: 5000 })
    await tap(learningLink)
    await waitForPageReady(page)
    expect(page.url()).toContain('/learning')
  })

  test('点击「我的词库」Tab 跳转正确', async ({ page }) => {
    await waitForPageReady(page)
    const libraryLink = page.locator('nav a[href="/expressions"]')
    await expect(libraryLink).toBeVisible({ timeout: 5000 })
    await tap(libraryLink)
    await waitForPageReady(page)
    expect(page.url()).toContain('/expressions')
  })

  test('从子页面 Tab 切回首页正常', async ({ page }) => {
    await page.goto('/#/learning')
    await waitForPageReady(page)
    const homeLink = page.locator('nav a[href="/"]')
    await expect(homeLink).toBeVisible({ timeout: 5000 })
    await tap(homeLink)
    await waitForPageReady(page)
    // 回到首页后 URL hash 是 #/ 或只是 /
    expect(page.url()).not.toContain('/learning')
  })
})
