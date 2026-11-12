# iOS 后台恢复「闪一下」排查

> 范围：Capacitor Native / iOS  
> 现象：切后台再回来界面闪一下（长后台更明显，**短后台「过一小会」也会出现**）  
> 状态：已完成根因排查（双路径），待修复

## 1. 结论

闪屏不是单一原因，至少有两条独立路径：

| 路径 | 触发条件 | 本质 |
|------|----------|------|
| **A. 冷启 / 进程重建** | 后台较久、内存压力、划掉 App、pending OTA 换包 | Splash → HTML 底色 → React 重挂 |
| **B. 同进程合成层闪烁** | 短后台也能复现 | WebView 仍在，但 GPU / 模糊 / Canvas / fixed 背景在前台恢复时重绘一帧 |

之前文档偏重路径 A。你补充的「不长时间、过一小会切回来也会闪」说明 **路径 B 真实存在**，而且日常使用里可能更常见。

## 2. 现象对照

| 场景 | 更可能的路径 | 用户感知 |
|------|--------------|----------|
| 隔夜 / 挂很久 | A（进程被杀） | 深蓝 Splash、整页像重新打开 |
| 短后台几秒～几分钟 | B（合成层） | 当前页「白一下 / 抖一下 / 底栏磨砂闪一下」 |
| 刚下过普通 OTA 后任意切后台 | A（`next()` 换包） | 像冷启，可能伴随版本切换 |
| 首页（有 Pixi 背景） | B 更重 | Canvas 空白一帧 + 模糊层重绘 |
| 非首页（`app-surface` + 底栏 blur） | B | 背景或底栏闪一下 |

## 3. 路径 A：冷启 / 进程重建

### 3.1 系统行为

挂久后 iOS 常会：

1. 杀掉整个 App 进程，或
2. 只杀掉 WKWebView 内容进程

再打开时：

```text
系统快照 → SplashScreen → HTML/WebView 底色 → React 重新挂载 → 正式界面
```

### 3.2 放大闪烁的点

**Splash 与页面底色不一致**

- Splash / StatusBar：`#0F172A`（`capacitor.config.ts`）
- HTML light：`#F4FAF7` / dark：`#090713`（`index.html`）

**Native 鉴权加载中渲染 `null`**

```ts
// auth-route-guard.tsx
if (isLoading) return isNative() ? null : <GuardLoading />
```

Splash 隐藏后若短暂空白，闪感更强。

**OTA `next()`**

普通更新下载后调用 `CapacitorUpdater.next()`：切后台后再进可能换 bundle 冷启。  
这不要求「挂很久」——只要 pending update 存在，短后台也可能触发整页重载。

### 3.3 如何确认是路径 A

日志重新出现：

- `[NativeBridge] initialized (native)`
- `[Updater] notifyAppReady`

或看到完整深蓝 Splash，基本就是 A。

## 4. 路径 B：短后台同进程闪烁（重点补充）

进程没死、JS 也没重跑时，仍可能闪。常见机制：

```text
进后台：iOS 拍一张快照
停在后台：WebView 层可能被卸掉 GPU 资源（blur / WebGL / fixed bg）
回前台：先显示快照 → 再切到 live WebView → 合成层重建一帧 → 闪
```

### 4.1 `backdrop-blur` 磨砂层（高嫌疑）

底栏等大量使用半透明 + 强模糊，例如：

```tsx
// layout/bottom-nav.tsx
className="... bg-background/48 ... backdrop-blur-2xl ..."
```

首页顶栏、各类 drawer / sheet 也有 `backdrop-blur-xl` / `2xl`。  
iOS WKWebView 从后台恢复时，模糊合成层经常会短暂失效再重建，表现为**白闪 / 半透明层闪一下**。

短后台即可复现，不依赖冷启。

### 4.2 首页 Pixi / WebGL 背景（高嫌疑）

首页 `ImmersiveBackground` → `PixiAnimatedBackground`：

- `visibilitychange` 时 `ticker.stop()` / `ticker.start()`
- WebGL context 在后台可能丢失或需恢复

回前台时 Canvas 常有一帧空白或黑/白，叠在页面上就是「闪一下」。

### 4.3 `.app-surface` 的 `background-attachment: fixed`（高嫌疑）

```css
/* index.css */
.app-surface {
  background-attachment: fixed; /* light */
}
.dark .app-surface {
  background-attachment: scroll; /* dark 已规避 */
}
```

`fixed` 背景在 iOS Safari / WKWebView 上是老问题：滚动或前后台切换时容易整页闪白。  
非首页布局挂了 `app-surface`（`root-layout.tsx`），**浅色主题更易中招**。

### 4.4 系统快照与 live 画面不一致

进后台时 `App.pause` 会 `pauseActivePackTasks`（下载 UI 状态可能变）。  
回前台：快照还是旧态 → live 已是新态 → 也会感到闪一下（通常比 blur/Canvas 轻）。

### 4.5 路径 B 里「一般不是主因」的东西

- `visibilitychange` 触发的 offline sync（不拆整页）
- resume 节流后的 OTA / 学习包检查 / RevenueCat（后台工作，不直接 blank 整页）
- Auth `isLoading` 被重新置 true（短 resume 不会）

`dev:host` 例外：resume 会 `localDb.reset()`，仅开发 live-reload。

## 5. 两条路径的启动 / 恢复时序

### 路径 A（冷启）

```text
1. 系统快照
2. Splash（#0F172A）
3. index.html 底色
4. React 挂载 / AuthRouteGate（native loading 可能 null）
5. hide Splash → 正式 UI
```

### 路径 B（短后台）

```text
1. 系统快照盖住 WebView
2. 切到 live WebView
3. 同帧附近发生：
   - backdrop-blur 层重建
   - Pixi/WebGL 恢复（若在首页）
   - fixed 背景重绘（若 light + app-surface）
4. 用户感知为「闪一下」，通常无 Splash、无 notifyAppReady 重打
```

## 6. 建议验证（用来分清 A / B）

1. **看有没有重新冷启日志**
   - 有 → 路径 A
   - 无，但画面仍闪 → 路径 B

2. **对照页面**
   - 首页闪、学习计划也闪 → 更像 blur / 全局合成
   - 主要首页闪 → 优先查 Pixi
   - 主要非首页 + 浅色闪 → 优先查 `background-attachment: fixed`

3. **临时对照实验（真机）**
   - 关掉底栏 `backdrop-blur`，看短后台是否还闪
   - 首页暂时不用 Pixi，看是否还闪
   - light 下把 `.app-surface` 改成 `background-attachment: scroll`，看是否还闪
   - 确认无 pending OTA（`manyu-pending-downloaded-update`）后再测短后台

4. **录屏逐帧**
   - 先深蓝 Splash → A
   - 无 Splash，只是当前页白一下 / 底栏闪 → B

## 7. 修复方向（待做）

### 路径 B（优先，覆盖「短后台也会闪」）

1. **底栏等常驻层减少 / 去掉强 `backdrop-blur`**，或改用不依赖 blur 的实色半透明
2. **`.app-surface` light 也改为 `background-attachment: scroll`**（与 dark 对齐）
3. **首页 Pixi**
   - resume 时避免整 canvas 清空一帧
   - 或恢复完成前用静态主题底图盖住
4. 评估 drawer / sheet 上过重的 blur 是否可降级

### 路径 A（长后台 / 换包）

1. 统一 Splash / StatusBar / `index.html` / `#root` 底色
2. Native loading 不要 `return null`，用同色占位
3. OTA `next()` 换包过渡保持同色 Splash，减少色差感

## 8. 相关文件

| 文件 | 与哪条路径相关 |
|------|----------------|
| `apps/frontend/capacitor.config.ts` | A：Splash 色 |
| `apps/frontend/index.html` | A：HTML 底色 |
| `apps/frontend/src/providers/auth-route-guard.tsx` | A：loading=`null`、hide splash |
| `apps/frontend/src/lib/native/updater.ts` | A：OTA `next()` |
| `apps/frontend/src/lib/native/native-bridge.provider.tsx` | A/B 边界：resume 任务 |
| `apps/frontend/src/index.css`（`.app-surface`） | **B：fixed 背景** |
| `apps/frontend/src/layout/bottom-nav.tsx` | **B：backdrop-blur** |
| `apps/frontend/src/components/common/immersive-background.tsx` | **B：首页 Pixi** |
| `apps/frontend/src/components/common/pixi-animated-background.tsx` | **B：visibility ticker** |
| `apps/frontend/src/layout/root-layout.tsx` | B：非首页挂 `app-surface` |

## 9. 小结

- **长后台闪**：多半是进程重建 + 启动色不一致（路径 A）。
- **短后台也会闪**：更符合 WKWebView 合成层问题——尤其是 **`backdrop-blur`、首页 Pixi、light 主题 `background-attachment: fixed`**（路径 B）；若当时有 pending OTA，短后台也可能走 A。
- 修复应 **先做路径 B 的低成本改动**（fixed → scroll、减弱 blur、Pixi 恢复遮罩），再补齐路径 A 的启动色统一。
