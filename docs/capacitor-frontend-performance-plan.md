# Capacitor 前端性能优化方案

本文档用于评估并规划前端打包到 Capacitor 后的性能优化，重点解决移动端不需要的 PC 页面、后台页面和重型依赖进入移动端首包的问题。

## 1. 当前结论

当前 Capacitor 端可以运行，但前端首包偏重。问题主要不在 Capacitor，而在 Web 前端构建结果：

- 主 JS 包：`assets/index-ptI1PZ1D.js`，约 4.35 MB，gzip 后约 1.28 MB。
- CSS：约 174 KB。
- SQLite Web 适配相关资源：`sql-wasm-1.11.0.wasm` 和 `sql-wasm.wasm`，各约 653 KB。
- `logo.png`：约 985 KB。
- Vite 已提示存在超过 500 KB 的大 chunk。

在 Capacitor 中资源从本地加载，网络下载不是主要瓶颈。真正影响启动体验的是 WebView 对 JS 的解析、编译和执行。4 MB 以上的主包在中高端 iOS 设备上通常可接受，但在低端 Android、旧设备、首次冷启动、OTA 更新后的首次启动中，容易造成白屏时间变长、首屏交互延迟和路由切换卡顿。

## 2. 主要原因

### 2.1 路由全部静态导入

`apps/frontend/src/App.tsx` 当前静态导入了用户端、认证页、系统页、公司页、Portal 页和全部后台页面。即使移动端用户永远不会访问 `/admin/*`，这些模块仍有机会被打进主包或参与主包依赖图。

受影响的页面包括：

- `/admin/*` 后台管理页。
- 管理端内容工坊、词典、主题管理、OTA 包管理。
- 数据统计页及图表依赖。
- PC/官网类页面，如 `/portal`、`/company`。
- 系统文档页。

### 2.2 移动端用不到的重依赖被主依赖图牵入

当前依赖中对移动端首包敏感的库包括：

- `pixi.js`：VN 场景、动态背景、主题背景。
- `recharts`：后台统计图表。
- `@wavesurfer/react` / `wavesurfer.js`：音频波形。
- `react-markdown` / `remark-gfm`：Markdown 渲染。
- `@uiw/react-md-editor`：后台编辑器。
- `html2canvas`：分享海报，已按需加载，方向是对的。
- `sql.js` / `jeep-sqlite`：Web SQLite 适配，原生 Capacitor 端理论上不应加载 Web adapter。

### 2.3 管理端类型和 API 被用户端引用

存在用户端代码引用 `features/admin` 内类型或工具的情况，例如：

- `dialogue-list-view.tsx` 引用 `@/features/admin/api-dictionary` 的类型。
- `practice-session-page.tsx` 引用 `@/features/admin/components/ink-compiler`。
- 主题相关 store/component 引用 `@/features/admin/theme-manage/api/theme-api` 的类型或 API。

这类引用会让移动端用户侧代码与后台目录产生耦合，增加拆包和移动端专用构建的难度。

## 3. 优化目标

建议目标分两档：

| 阶段 | 目标 | 预期效果 |
| --- | --- | --- |
| 第一阶段 | 路由级拆包，重页面按需加载 | 主包从约 4.35 MB 降到约 1.5-2.5 MB |
| 第二阶段 | 移动端专用构建，排除 PC/后台入口 | Capacitor 包不包含后台页面与 PC 页面运行代码 |
| 第三阶段 | 运行时性能优化 | 降低首屏 JS 执行、WebView 内存和页面切换卡顿 |

## 4. 第一阶段：低风险拆包

第一阶段不改变产品形态，只改变加载方式，适合优先落地。

### 4.1 路由页面改为 `React.lazy`

将 `App.tsx` 中页面组件从静态导入改为懒加载：

```tsx
import { lazy, Suspense } from 'react'

const AdminUsersPage = lazy(() =>
  import('@/features/admin/pages/admin-users-page').then((m) => ({ default: m.AdminUsersPage })),
)
```

建议先拆：

- 全部 `/admin/*` 页面。
- `/portal`、`/company`。
- `/system/*` 页面。
- `/script/:episodeId`、`/explore`、`/practice/session/:topicId` 等较重互动页面。

保留首屏必须页面静态加载：

- `/`
- `/learning`
- `/today`
- `/auth/login`

### 4.2 后台整组拆包

不要只懒加载每个后台页面，建议把后台路由单独拆成 `admin-routes.tsx`：

```tsx
const AdminRoutes = lazy(() => import('@/routes/admin-routes'))
```

这样移动端用户不访问 `/admin` 时，不会初始化后台路由树和后台布局。

### 4.3 重依赖按组件延迟加载

优先处理：

- `recharts`：只在 `AdminAnalyticsPage` 内加载。
- `@uiw/react-md-editor`：只在后台编辑器弹窗或编辑页加载。
- `wavesurfer`：只在音频播放器可见时加载。
- `pixi.js`：只在进入 VN 播放、探索地图、动态背景真正启用时加载。
- `react-markdown`：系统文档和富文本内容页再加载。

### 4.4 避免无效 dynamic import

Vite build 里已经提示：一些模块既被动态导入，又被静态导入，导致动态导入不能拆包。需要把这些模块的静态导入链清掉，否则拆包不会生效。

重点检查：

- `src/lib/request.ts`
- `features/file-assets/api.ts`
- `lib/dictionary-api.ts`
- `features/auth/api.ts`
- `features/admin/api-content-admin.ts`
- `features/system/content/*.md?raw`

## 5. 第二阶段：移动端专用构建

如果目标是“移动端包里根本不包含 PC/后台代码”，只做懒加载还不够。懒加载只能让代码不进首包，但 chunk 仍可能留在 `dist` 中并被打入 Capacitor 资源目录。移动端专用构建可以进一步移除这些代码。

### 5.1 增加移动端入口

建议新增：

- `src/App.tsx`：Web 全量入口，保留后台和 PC 页面。
- `src/App.mobile.tsx`：Capacitor 移动端入口，只保留移动端用户流程。
- `src/routes/web-routes.tsx`
- `src/routes/mobile-routes.tsx`
- `src/routes/admin-routes.tsx`

移动端入口只包含：

- 首页。
- 学习计划、学习单元、今日任务。
- 练习会话。
- 剧本播放。
- 探索。
- 表达库。
- 成就、个人中心、会员、通知、反馈、邀请。
- 登录注册和必要系统协议页。

移动端入口排除：

- `/admin/*`。
- `/portal`。
- `/company`。
- 后台内容工坊、编辑器、图表、词典管理。

### 5.2 Vite 使用移动端 mode 或独立配置

新增脚本示例：

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:mobile": "tsc && vite build --mode mobile",
    "cap:sync": "pnpm build:mobile && pnpm exec cap sync"
  }
}
```

`vite.config.ts` 可根据 `mode === 'mobile'` 指向移动端入口，或通过 alias 替换：

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@/App': mode === 'mobile'
      ? path.resolve(__dirname, './src/App.mobile.tsx')
      : path.resolve(__dirname, './src/App.tsx'),
  },
}
```

更稳的做法是新增 `src/main.mobile.tsx`，移动端 build 使用独立 HTML 或 Rollup input。

### 5.3 移动端 stub 掉后台模块

对移动端不允许出现的模块，可以使用 alias 指向空实现，防止误引用：

```ts
if (mode === 'mobile') {
  alias['@/features/admin'] = path.resolve(__dirname, './src/mobile-stubs/admin')
}
```

这样如果用户端不小心引用后台运行时代码，会在构建期暴露问题。

### 5.4 类型和共享逻辑迁移

不要让用户端从 `features/admin` 引类型。建议迁移到共享目录：

- `src/features/dictionary/types.ts`
- `src/features/theme/types.ts`
- `src/features/content/types.ts`
- `src/lib/ink/ink-compiler.ts`

后台 API 可以继续留在 `features/admin`，但纯类型、纯算法、用户端也需要的编译器应放到不依赖后台页面的共享模块。

## 6. SQLite 与离线存储优化

当前构建产物里有 `sql-wasm` 和 `jeep-sqlite`。对于 Capacitor 原生端：

- 原生端应优先使用 `@capacitor-community/sqlite` 原生插件。
- Web 端才需要 `jeep-sqlite` 和 `sql.js`。
- 移动端原生构建中应避免加载 Web SQLite adapter。

建议检查 `lib/offline/unified-storage.ts`：

- 原生路径和 Web 路径保持动态导入。
- `web-sqlite-storage.ts` 不应被任何原生首屏模块静态引用。
- 移动端 build 可以通过 alias 将 Web SQLite adapter 替换为空模块或构建期不可用模块。

## 7. 资源优化

### 7.1 压缩启动图片和 logo

`dist/logo.png` 约 985 KB，偏大。建议：

- 压缩 PNG 或转 WebP。
- 首页展示图使用响应式尺寸。
- App icon、splash 和站内 logo 分开管理，不复用超大图。

### 7.2 检查 CSS warning

build 中出现多处 `Unterminated string token`，与 font-family 引号有关。虽然当前构建成功，但建议修复，避免 CSS minify 后产生不可预期样式。

## 8. 推荐实施顺序

### P0：先拿到明显收益

1. `App.tsx` 路由懒加载。
2. `/admin/*` 移到 `admin-routes.tsx` 并整体 lazy。
3. `recharts`、编辑器、wavesurfer、pixi 按页面或组件 lazy。
4. 修复 Vite 提示的“动态导入但仍被静态导入”的模块。
5. 压缩 `logo.png`。

### P1：移动端专用构建

1. 新增 `App.mobile.tsx` 或 `main.mobile.tsx`。
2. 新增 `build:mobile`，`cap:sync` 改用移动端构建。
3. 移动端路由排除 `/admin/*`、`/portal`、`/company`。
4. 将用户端引用的后台类型迁移到 shared/domain 目录。
5. 为后台模块设置移动端构建隔离规则。

### P2：运行时体验

1. 首屏只请求必要接口，非关键数据延后。
2. 长列表使用虚拟滚动，避免一次渲染大量卡片。
3. Pixi 背景默认降级，低端设备或省电模式关闭动态背景。
4. 音频波形只在用户展开播放器后初始化。
5. Capacitor 插件调用批处理，减少 JS-native bridge 往返。

## 9. 验收指标

建议每轮优化后记录：

- `dist/assets/index-*.js` 原始大小和 gzip 大小。
- `dist` 总大小。
- 最大 chunk 列表。
- iOS 真机冷启动到首页可交互时间。
- Android 中低端真机冷启动到首页可交互时间。
- 首页路由切换到学习页、练习页、剧本页的耗时。
- WebView 内存峰值。

建议目标：

- 主 JS 首包小于 2 MB。
- gzip 后首包小于 700 KB。
- 移动端专用构建中不包含后台页面 chunk。
- 冷启动首页 2 秒内可交互，中低端 Android 控制在 3 秒内。

## 10. 风险与注意事项

- 只做 lazy 不等于从 Capacitor 包中删除代码；它主要降低首屏解析执行成本。
- 移动端专用构建会带来双入口维护成本，需要明确 Web 与 App 的路由边界。
- 后台类型放在 `features/admin` 会持续污染移动端依赖图，应优先解耦。
- 离线存储要确保原生端和 Web 端路径清晰，避免原生端加载 Web SQLite wasm。
- OTA 更新包大小会受 `dist` 总大小影响，移动端专用构建对 OTA 体验也有收益。

## 11. 移动端偶发卡住几秒的专项排查

移动端测试中如果出现“界面还在，但点击、滑动几秒没有反应”，通常说明 WebView JS 主线程被长任务阻塞，或者原生插件/网络/数据库任务在短时间内触发了大量回调和状态更新。它不一定是崩溃，也不一定是网络慢。

### 11.1 当前高嫌疑点

#### OTA 检查和下载触发时机

`NativeBridgeProvider` 在 App 启动后会调用：

- `updater.notifyAppReady()`
- `updater.checkUpdate()`

同时在 App 从后台恢复时也会再次调用：

- `updater.checkUpdate()`

`checkUpdate()` 如果发现新版本，会直接执行：

- 请求更新检查接口。
- 下载 bundle。
- 强制更新时立即 `set()`。
- 普通更新时 `next()` 标记下一次启动使用。

这条链路发生在启动和 resume 阶段，用户很容易感知为“刚打开或切回来时卡住”。即使下载在原生层执行，进度事件、日志、状态回调和安装标记仍可能让 WebView 在短时间内变忙。

建议：

- 启动后延迟 10-30 秒再检查 OTA。
- App 首屏可交互前不要下载更新包。
- resume 不要每次都检查，至少加 10-30 分钟节流。
- 普通更新只在 Wi-Fi、充电或用户空闲时下载。
- 强制更新显示阻塞式 UI，明确告诉用户正在更新，避免用户误以为卡死。

#### 离线同步在登录态加载后立即执行

`AuthProvider` 中 `useAppForegroundSync(session?.user?.id)` 会在有用户后立刻执行：

- `offlineSyncService.sync(userId)`
- `flush()`
- `pull()`
- `refreshContentUpdates()`

其中包含：

- SQLite 多次读写。
- outbox 批量上传和逐条 replay。
- 服务端增量拉取。
- 公共内容 manifest 检查。
- 已下载学习包过期后调用 `learningPackService.installUnit(packId)` 刷新学习包。

如果用户本地有较多离线记录、学习包、练习记录或表达库条目，这条同步链路会有明显卡顿风险。

建议：

- 首屏渲染完成后再启动同步。
- 同步任务分片执行，每批处理后让出主线程。
- 学习包刷新不要放在启动同步主流程里，改成后台队列或用户进入学习包时再刷新。
- 对 `pull()` 的分页循环设置单轮最大页数，避免一次启动拉太多。
- 同步期间避免大量 toast 和全局 store 更新。

#### Pixi 动态背景和主题动画

`PixiAnimatedBackground` 会初始化 `pixi.js`，并在 ticker 中持续更新画面。低端设备上，WebGL 初始化、纹理创建、粒子更新和高 DPR 渲染都可能抢占主线程/GPU。

建议：

- 原生移动端默认关闭复杂 Pixi 背景，或只在高性能设备开启。
- `resolution` 在移动端限制为 `1`，不要使用 `devicePixelRatio: 2`。
- 页面不可见、切后台、弹窗打开时暂停 ticker。
- 低电量、低端 Android、过热时降级到静态背景。

#### 大包解析与页面切换时的 chunk 执行

当前主 JS 约 4.35 MB。即使 App 已经启动，首次进入某些重页面时，如果一次性初始化 Pixi、音频波形、Markdown、图表或大量列表，也会出现几秒无响应。

建议：

- 路由 lazy 后，为重页面加轻量 loading。
- 页面内重组件二级懒加载，首屏先展示框架，再加载重功能。
- 列表渲染分批或虚拟滚动。
- Markdown、词典、练习记录等大文本/大数组处理避免同步一次性完成。

#### VN 输入框 focus 与软键盘弹起

VN 练习中点击输入框时，如果偶发卡住，可能与移动端软键盘弹起有关。当前项目尚未安装 `@capacitor/keyboard`，VN 输入面板使用普通 `textarea`，并在文本变化时同步读取 `scrollHeight` 做高度自适应。

输入框 focus 时，移动端可能同时发生：

- 原生键盘弹出。
- WebView viewport resize。
- 页面滚动到输入框可见区域。
- 底部输入栏重新布局。
- textarea 高度测量。
- VN 画面、对话列表、Pixi 背景继续渲染。

这些任务叠在一起时，用户会感知为“点了输入框后卡住几秒”。

建议引入官方 `@capacitor/keyboard` 插件，让键盘行为更可控：

```bash
pnpm.cmd --filter @manyu/frontend add @capacitor/keyboard
pnpm.cmd --filter @manyu/frontend exec cap sync
```

`capacitor.config.ts` 中建议先使用保守配置：

```ts
plugins: {
  Keyboard: {
    resize: 'body',
    resizeOnFullScreen: true,
  },
}
```

建议新增一个 `KeyboardProvider` 或 `useNativeKeyboard`：

- 监听 `keyboardWillShow` / `keyboardDidShow` / `keyboardWillHide` / `keyboardDidHide`。
- 将 keyboard height 写入 CSS 变量，例如 `--keyboard-height`。
- VN 输入栏使用该变量调整 bottom padding，而不是依赖浏览器自动滚动。
- 键盘弹出时暂停 Pixi ticker 或降低动态背景复杂度。
- 键盘弹出期间禁用横滑手势，避免 touch 事件和输入焦点抢控制权。
- iPhone 可以隐藏 accessory bar，减少输入区高度抖动。

示例：

```ts
import { Keyboard } from '@capacitor/keyboard'

Keyboard.addListener('keyboardWillShow', (info) => {
  document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
  document.body.dataset.keyboardOpen = 'true'
})

Keyboard.addListener('keyboardWillHide', () => {
  document.documentElement.style.setProperty('--keyboard-height', '0px')
  delete document.body.dataset.keyboardOpen
})
```

需要注意：`@capacitor/keyboard` 主要解决键盘 resize、滚动、遮挡和时机控制。如果卡顿根因是 JS 长任务，例如同步、OTA、Pixi 初始化或大列表渲染，它只能缓解输入体验，不能完全消除主线程阻塞。因此应和 long task 监控一起验证。

### 11.2 建议增加卡顿监控

可以在移动端开发包中增加 long task 监控，记录超过 200ms 的主线程阻塞：

```ts
export function installLongTaskMonitor() {
  if (typeof PerformanceObserver === 'undefined') return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= 200) {
          console.warn('[perf] long task', {
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
            route: location.hash || location.pathname,
          })
        }
      }
    })
    observer.observe({ entryTypes: ['longtask'] })
  } catch {
    // 部分 WebView 不支持 longtask，忽略即可。
  }
}
```

同时建议给关键异步任务加耗时日志：

- `updater.checkUpdate()`
- `offlineSyncService.sync()`
- `offlineSyncService.pull()`
- `offlineSyncService.refreshContentUpdates()`
- `learningPackService.installUnit()`
- SQLite backend 初始化。
- Pixi 初始化。

示例：

```ts
async function measure<T>(name: string, task: () => Promise<T>): Promise<T> {
  const startedAt = performance.now()
  try {
    return await task()
  } finally {
    const duration = Math.round(performance.now() - startedAt)
    if (duration > 300) {
      console.warn(`[perf] ${name} took ${duration}ms`)
    }
  }
}
```

### 11.3 立即可做的缓解措施

优先级从高到低：

1. OTA 检查从启动立即执行改为首屏稳定后延迟执行，并给 resume 检查加节流。
2. 离线同步从登录态加载后立即执行改为延迟执行，例如首屏后 5-10 秒。
3. `refreshContentUpdates()` 从启动同步中拆出去，不要在用户刚打开 App 时刷新学习包。
4. Pixi 动态背景在 Capacitor 端默认降级或延迟初始化。
5. 引入 `@capacitor/keyboard`，统一管理键盘弹出时的布局、滚动和动态背景暂停。
6. 增加 long task 和关键任务耗时日志，先定位卡顿发生在 OTA、同步、SQLite、Pixi、键盘 resize 还是页面渲染。

### 11.4 判断卡顿来源的方法

测试时可以按场景记录：

- 是否刚打开 App 后 0-10 秒发生。
- 是否从后台切回前台后发生。
- 是否刚进入学习页、剧本页、探索页、个人中心后发生。
- 是否发生在点击 VN 输入框、键盘弹出或键盘收起时。
- 是否安装了多个离线学习包。
- 是否刚发布了 OTA 新版本。
- 卡住时是否伴随下载、同步、toast、页面 loading 或动态背景。

如果卡顿集中在启动或切回前台，优先查 OTA 和离线同步。如果集中在进入剧本、探索或主题页，优先查 Pixi 和页面渲染。如果集中在点击输入框或键盘弹出，优先查 Keyboard resize、输入栏布局和 Pixi 暂停策略。如果集中在表达库、学习记录、个人中心，优先查大列表和 SQLite 查询。

## 12. 建议下一步

建议先做 P0，风险低且收益明显。完成后重新运行：

```bash
pnpm.cmd --filter @manyu/frontend build
```

对比主包和 chunk 分布。如果主包仍超过 2.5 MB，再启动 P1 的移动端专用构建。
