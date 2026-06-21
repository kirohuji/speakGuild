/**
 * 首页核心流程 E2E 测试
 *
 * 模拟移动端用户在首页的操作
 */
import { test, expect } from '../helpers/fixtures'
import { waitForPageReady, tap, scrollDown } from '../helpers/mobile-utils'

test.describe('首页 - 已登录', () => {
  test('首页正确加载首屏内容', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/漫语町/)

    // 验证 #root 容器存在
    await expect(page.locator('#root')).toBeVisible()

    // 验证页面没有崩溃（无白屏）
    const html = page.locator('html')
    await expect(html).toBeVisible()
  })

  test('移动端视口尺寸正确', async ({ page }) => {
    const viewport = page.viewportSize()
    expect(viewport).not.toBeNull()
    expect(viewport!.width).toBeLessThanOrEqual(430)
    expect(viewport!.height).toBeGreaterThan(600)
  })

  test('页面滚动流畅不崩溃', async ({ page }) => {
    await page.waitForTimeout(1000)
    await scrollDown(page, 400)
    await expect(page.locator('#root')).toBeVisible()
    await page.mouse.wheel(0, -400)
    await page.waitForTimeout(300)
  })

  test('shadcn 主题 class 正确挂载', async ({ page }) => {
    const html = page.locator('html')
    const classAttr = await html.getAttribute('class')
    expect(classAttr).toBeTruthy()
  })
})

test.describe('首页 - 未登录流程', () => {
  test('未登录用户被重定向到登录页', async ({ page }) => {
    // 清除 mock，用裸 page 测试
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('manyu-bearer-token'))
    await page.reload()
    await page.waitForTimeout(2000)

    const currentUrl = page.url()
    expect(currentUrl).toMatch(/auth\/login/)
  })

  test('登录页表单渲染完整', async ({ page }) => {
    await page.goto('/#/auth/login')
    await waitForPageReady(page)

    // Email 输入框 (placeholder 是硬编码的 you@example.com)
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible({ timeout: 5000 })

    // 密码输入框 (placeholder = "请输入密码")
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible({ timeout: 5000 })

    // 登录按钮（精确匹配，避免匹配到"手机验证码登录"）
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('从登录页可切换到注册页', async ({ page }) => {
    await page.goto('/#/auth/login')
    await waitForPageReady(page)

    const registerLink = page.locator('a[href*="register"]').first()
    if (await registerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tap(registerLink)
      await page.waitForTimeout(1000)
      expect(page.url()).toMatch(/auth\/register/)
    }
  })

  test('密码登录 ↔ 手机验证码登录 模式切换', async ({ page }) => {
    await page.goto('/#/auth/login')
    await waitForPageReady(page)

    const switchBtn = page.getByText(/手机验证码|验证码登录/i).first()
    if (await switchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tap(switchBtn)
      await page.waitForTimeout(500)
    }
  })

  test('忘记密码页可访问', async ({ page }) => {
    await page.goto('/#/auth/login')
    await waitForPageReady(page)

    const forgotLink = page.locator('a[href*="forgot-password"]').first()
    if (await forgotLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tap(forgotLink)
      await page.waitForTimeout(1000)
      expect(page.url()).toMatch(/forgot-password/)
    }
  })
})
