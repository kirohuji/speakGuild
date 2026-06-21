/**
 * Playwright 自定义 Fixtures
 *
 * 扩展 base test，自动：
 * - 从 auth.setup.ts 加载已保存的登录态
 * - 导航到首页并等待稳定
 *
 * 使用方式：
 *   import { test, expect } from '../helpers/fixtures'
 *   // test() 自动带有登录态
 */
import { test as base, expect } from '@playwright/test'

/**
 * 带登录态的 test fixture
 *
 * 依赖 auth.setup.ts 先执行，storageState 已保存到 e2e/.auth/state.json
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // 导航到首页
    await page.goto('/')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)

    // 如果在登录页 → auth.setup 可能失效，让测试自己 skip
    await use(page)
  },
})

export { expect }
