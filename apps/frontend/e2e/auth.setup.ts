/**
 * 鉴权准备脚本 — 在所有 E2E 测试之前运行
 *
 * 使用种子数据中的测试账户通过真实登录流程获取 session：
 *   Email:    user@engjourney.local
 *   Password: user123456
 *
 * 前置条件：
 *   1. PostgreSQL 运行中，已执行 `pnpm prisma:seed`
 *   2. 后端运行中：`pnpm dev:backend` (端口 3001)
 *   3. 前端由 Playwright webServer 自动启动 (端口 5173)
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const AUTH_DIR = path.resolve(__dirname, '.auth')

const TEST_USER = {
  email: 'user@engjourney.local',
  password: 'user123456',
  name: 'Test User',
}

setup('真实登录获取 session', async ({ page }) => {
  // 确保 .auth 目录存在
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  // ── 1. 导航到登录页 ──
  await page.goto('/#/auth/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1000)

  // ── 2. 填写邮箱 ──
  const emailInput = page.getByPlaceholder('you@example.com')
  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await emailInput.fill(TEST_USER.email)

  // ── 3. 填写密码 ──
  const passwordInput = page.getByPlaceholder('请输入密码')
  await expect(passwordInput).toBeVisible({ timeout: 5_000 })
  await passwordInput.fill(TEST_USER.password)

  // ── 4. 点击登录按钮 ──
  const loginButton = page.getByRole('button', { name: '登录', exact: true })
  await expect(loginButton).toBeVisible({ timeout: 5_000 })
  await loginButton.tap()

  // ── 5. 等待登录成功，跳转到首页 ──
  // 登录成功后 URL 会从 /auth/login 变为 /
  await page.waitForURL((url) => !url.toString().includes('/auth/login'), {
    timeout: 15_000,
  }).catch(async () => {
    // 如果超时，检查是否有错误提示
    const errorText = await page.textContent('body').catch(() => '')
    console.error('[auth.setup] 登录超时，页面内容:', errorText?.slice(0, 500))
    throw new Error('登录失败：未能跳转到首页，请检查后端是否运行且数据库已 seed')
  })

  // 等页面稳定
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1500)

  // ── 6. 验证登录成功：localStorage 中应有 token ──
  const token = await page.evaluate(() => localStorage.getItem('manyu-bearer-token'))
  if (!token) {
    throw new Error('登录失败：localStorage 中没有 manyu-bearer-token')
  }
  console.log(`[auth.setup] ✅ 登录成功，token 长度: ${token.length}`)

  // ── 7. 验证首页可见 ──
  await expect(page.locator('#root')).toBeVisible()

  // ── 8. 保存浏览器状态（cookies + localStorage）──
  await page.context().storageState({ path: path.join(AUTH_DIR, 'state.json') })
  console.log('[auth.setup] ✅ 鉴权状态已保存到 e2e/.auth/state.json')

  // ── 9. ★ 重置 onboarding 状态 ★ ──
  // 下次测试时能力测评 + 引导流程会再次出现
  // 因为 test=2 模式下不会回写 DB，所以这里确保 DB 也是干净状态
  const token2 = await page.evaluate(() => localStorage.getItem('manyu-bearer-token'))
  if (token2) {
    try {
      const res = await page.evaluate(async (t) => {
        const r = await fetch('/api/v1/manyu/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
          body: JSON.stringify({ hasCompletedOnboarding: false, outputLevelDetail: null }),
        })
        return { ok: r.ok, status: r.status }
      }, token2)
      console.log(`[auth.setup] 🔄 重置 onboarding: ${res.ok ? 'OK' : `HTTP ${res.status}`}`)
    } catch (err) {
      console.warn('[auth.setup] ⚠️ 重置 onboarding 失败（如后端未运行可忽略）:', String(err))
    }
  }
})
