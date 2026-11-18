# 移动端 OTA 热更新

> **核对日期**：2026-11-18  
> **范围**：Capacitor App 的 **MobileBundle**（前端代码包）热更新。  
> **重要区分**：这与 [学习包](./离线学习与沉浸式播放器手册.md)（LearningPack，内容 zip）不是同一条链路。  
> **副作用排查**：[iOS 长时间后台恢复闪屏排查](./iOS长时间后台恢复闪屏排查.md)

---

## 1. 技术栈与原则

| 项 | 说明 |
|----|------|
| 插件 | `@capgo/capacitor-updater` |
| 实现 | `apps/frontend/src/lib/native/updater.ts` |
| 配置 | `capacitor.config.ts` 中 `autoUpdate: 'off'`（纯手动） |
| UI 状态 | `stores/app-update.store.ts`、`AppUpdateDialog` |
| 后端 | `modules/mobile-updates/`，检查接口多路径挂载 |

设计原则：

- 插件不做自动检查／安装；全部由 `updater.checkUpdate()` 一手控制。
- 不做并行请求，不依赖插件事件做控制流决策（事件只用于进度与错误日志）。
- 启动失败可回滚到上一可用 bundle（`notifyAppReady` 须在 `appReadyTimeout` 内调用，默认 10s）。

---

## 2. 流程

```text
启动 / 设置页手动检查 / resume 节流检查
  → notifyAppReady（仅确认当前 bundle 可用）
  → checkUpdate()
      → POST …/mobile-updates/check
         body: platform、deviceId、nativeVersion、currentBundleVersion…
      → 无 version/url → 结束
      → CapacitorUpdater.download({ url, version })
      → isMandatory=true  → set() 立即换包重启
      → isMandatory=false → next()，切后台后下次启动生效
                           并写入 manyu-pending-downloaded-update
```

检查 URL 由 `VITE_API_BASE_URL` 推导，默认 `{apiBase}/mobile-updates/check`。后端同时接受：

- `/api/v1/manyu/mobile-updates/check`
- `/api/mobile-updates/check`
- `/mobile-updates/check`

---

## 3. 触发时机（客户端）

`NativeBridgeProvider`（仅 Native）：

1. 首帧：`SplashScreen.hide`、状态栏、`notifyAppReady`、RevenueCat 等。
2. 启动后：调用一次 `checkUpdate`（与学习包 `checkPackUpdates` 等并列、各自独立）。
3. App resume：节流后再检查 OTA。

用户也可在移动端设置页手动「检查更新」。

---

## 4. 与学习包、模型的边界

| 子系统 | 更新什么 | 入口 |
|--------|----------|------|
| **MobileBundle** | Web 资源／JS 代码包 | 本文 OTA |
| **LearningPack** | 场景／剧本内容与媒体 | 学习包下载队列 |
| **OfflineModel** | Whisper／MiniLM 权重 | 模型设置页 |

三者队列、存储目录与失败回滚相互独立，不要混用「安装包」一词而不加限定。

---

## 5. 运维注意

- 后台发布 OTA 版本后，客户端下次 `checkUpdate` 才会拉取。
- 普通更新依赖 `next()`：用户可能在「已下载、待重启」状态；闪屏／冷启感见 iOS 排查文档。
- 强制更新会立刻 `set()`，当前 JS 上下文销毁。
- 不要在文档或运营文案中把 OTA 说成「学习包更新」。
