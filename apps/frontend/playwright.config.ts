import { defineConfig, devices } from '@playwright/test'

/**
 * 漫语町 E2E 测试配置
 *
 * 专注于移动端用户操作模拟：
 * - iPhone 15 (390×844) — 主要测试设备
 * - Pixel 7 (412×915) — Android 覆盖
 * - 触摸事件、手势、视口行为全覆盖
 * - 使用种子测试账户走真实登录流程
 *
 * ══════════════════════════════════════════
 * 运行前准备：
 *   1. 启动 PostgreSQL
 *   2. 种子数据库：  cd apps/backend && pnpm prisma:seed
 *   3. 启动后端：    pnpm dev:backend   (端口 3001)
 *   4. 运行测试：    cd apps/frontend && npx playwright test
 * ══════════════════════════════════════════
 *
 * 常用命令：
 *   npx playwright test                          # 全部测试
 *   npx playwright test --ui                     # UI 模式
 *   npx playwright test --project=iPhone15       # 仅 iPhone
 *   npx playwright test --debug                  # 单步调试
 *   npx playwright test --project=iPhone15 --headed  # 显示浏览器
 */

const PORT = 5173
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* ── Web Server：自动启动 Vite 开发服务器 ── */
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    cwd: './',
    timeout: 30_000,
  },

  /* ── 项目：按设备定义 ── */
  projects: [
    /* ── Setup：鉴权准备（先于所有测试运行）── */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        browserName: 'chromium',
        // 使用移动端视口 + 触摸，确保 .tap() 可用
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },

    /* ── 移动端核心设备（Chromium 模拟）── */
    {
      name: 'iPhone15',
      use: {
        // 基于 Chromium 模拟 iPhone 15 — 无需安装 WebKit
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        storageState: 'e2e/.auth/state.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'Pixel7',
      use: {
        browserName: 'chromium',
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        storageState: 'e2e/.auth/state.json',
      },
      dependencies: ['setup'],
    },

    /* ── 桌面端 Chromium（用于管理员后台测试）── */
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
})
