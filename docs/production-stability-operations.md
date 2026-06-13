# 漫语町生产稳定性最小方案

目标：先把上线后最容易出问题的地方兜住，不做复杂大屏和重客服系统。

## 1. App Store 隐私与 Privacy Manifest

已添加 iOS 清单：

- `apps/frontend/ios/App/App/PrivacyInfo.xcprivacy`
- 已加入 Xcode `Copy Bundle Resources`

当前清单覆盖：

- Required Reason API：`UserDefaults`、文件时间戳、磁盘空间
- 数据类型：姓名、邮箱、手机号、用户 ID、录音音频、用户内容、购买记录、崩溃数据、性能数据
- 不声明追踪：`NSPrivacyTracking=false`

App Store Connect 隐私问卷建议保持一致：

| 数据 | 是否关联用户 | 用途 |
|---|---:|---|
| 姓名、邮箱、手机号、用户 ID | 是 | App 功能、账号管理、客服 |
| 录音音频、用户输入内容 | 是 | 语音识别、AI 测评、学习反馈 |
| 购买记录 | 是 | 订阅权益、恢复购买、客服核查 |
| 崩溃数据、性能数据 | 否 | 稳定性监控 |

提交前在 Xcode 里生成 Privacy Report，再对照第三方 SDK 的隐私说明，尤其是 RevenueCat、Capacitor 插件、Sentry。

## 2. 崩溃和错误监控

这部分解决的问题：用户白屏、接口 500、支付回调异常、AI 服务异常时，开发者能知道“哪里坏了、什么时候坏的、影响什么路径”。

已实现监控上报：

- 前端 `window.error`、`unhandledrejection`、接口 5xx 会上报到后端 `/client-errors`
- 如果配置 `VITE_SENTRY_DSN`，前端会通过官方 `@sentry/capacitor` + `@sentry/react` 上报到 Sentry/GlitchTip
- 后端 5xx 会通过全局异常过滤器触发告警
- 如果配置 `SENTRY_DSN`，后端告警会通过 Sentry-compatible envelope 同步上报到 Sentry/GlitchTip

环境变量：

```env
VITE_SENTRY_DSN=
SENTRY_DSN=
```

变量说明：

| 变量 | 用途 | 不配置时 |
|---|---|---|
| `VITE_SENTRY_DSN` | 前端/App 错误直接上报到 Sentry 或 GlitchTip，例如白屏、未捕获 Promise、接口 5xx | 前端仍会把错误发到后端 `/client-errors` |
| `SENTRY_DSN` | 后端错误和运营告警同步上报到 Sentry 或 GlitchTip | 只写后端日志，并按配置发 webhook |

Sentry 的作用不是替代日志，而是帮你把错误聚合起来：同一种白屏会合并成一个 issue，可以看到浏览器、系统、路由、出现次数。

当前前端依赖：

```text
@sentry/capacitor
@sentry/react
```

GlitchTip 兼容 Sentry SDK/DSN，所以自建 GlitchTip 后，把 GlitchTip 项目里的 DSN 填到 `VITE_SENTRY_DSN` 和 `SENTRY_DSN` 即可。

自托管说明：

- 可以自托管 Sentry，官方 self-hosted 使用 Docker Compose。
- 低配机器也能跑起来，但 Sentry 组件较多，长期稳定运行不建议和业务服务混在同一个 compose 里。
- 低配自托管建议只开错误监控，先不要开 Replay、Profiling、高采样性能追踪。
- 如果想低配自建，GlitchTip 通常比 Sentry self-hosted 更轻，更适合个人或小团队。

## 3. 运营告警

这部分解决的问题：不需要天天盯后台，一旦关键服务异常，能推送到飞书、企业微信、Slack 或你自己的 webhook。

已实现一个轻量 webhook 告警服务。默认关闭，配置后启用：

```env
OPS_ALERT_WEBHOOK_URL=
OPS_ALERT_WEBHOOK_AUTHORIZATION=
OPS_ALERT_MIN_INTERVAL_SECONDS=300
```

变量说明：

| 变量 | 用途 | 示例 |
|---|---|---|
| `OPS_ALERT_WEBHOOK_URL` | 告警接收地址。可以是飞书/企业微信机器人，也可以是你自己的接口 | `https://open.feishu.cn/open-apis/bot/v2/hook/...` |
| `OPS_ALERT_WEBHOOK_AUTHORIZATION` | webhook 鉴权头。机器人通常不用填，自建接口可填 | `Bearer your-secret-token` |
| `OPS_ALERT_MIN_INTERVAL_SECONDS` | 同类告警最小间隔，防止错误风暴刷屏 | `300` |

会触发告警的情况：

- 后端 5xx
- 前端白屏/运行时错误
- RevenueCat webhook 处理失败
- RevenueCat 订阅扣费异常
- 数据库或文件资产容量接近阈值

健康检查地址：

```text
GET /api/v1/manyu/health
```

健康检查的作用：让外部监控确认后端进程和数据库连接都还活着。它会执行一次简单数据库查询。

建议用 UptimeRobot、Better Stack、腾讯云拨测等外部服务监控这个地址。服务完全挂掉时，应用自己无法发告警，必须靠外部拨测。

容量阈值：

```env
OPS_CAPACITY_CHECK_CRON=0 15 9 * * *
OPS_DB_MAX_BYTES=0
OPS_FILE_ASSET_MAX_BYTES=0
```

变量说明：

| 变量 | 用途 | 示例 |
|---|---|---|
| `OPS_CAPACITY_CHECK_CRON` | 每天什么时候检查容量 | `0 15 9 * * *` 表示每天 09:15 |
| `OPS_DB_MAX_BYTES` | 数据库套餐上限，单位字节 | 10GB = `10737418240` |
| `OPS_FILE_ASSET_MAX_BYTES` | 后端登记的文件资源上限，单位字节 | 50GB = `53687091200` |

`0` 表示不启用阈值。COS/CDN 的真实容量和账单告警仍建议在云厂商控制台配置。

推荐最小配置：

```env
OPS_ALERT_WEBHOOK_URL=你的飞书或企业微信机器人地址
OPS_ALERT_WEBHOOK_AUTHORIZATION=
OPS_ALERT_MIN_INTERVAL_SECONDS=300
OPS_DB_MAX_BYTES=10737418240
OPS_FILE_ASSET_MAX_BYTES=53687091200
```

## 4. 内容发布与回滚

这部分解决的问题：学习包、内容库、移动热更新出错时，能快速停用、回滚，而不是重新发版救火。

保持最小流程：

1. 管理员在后台预览内容、学习包或移动 bundle。
2. 先发 staging 或低灰度 `rolloutPercent=5~20`。
3. 确认无错误后提高灰度到 100。
4. 出错时先把对应 bundle/包 `enabled=false`，不要直接删除。
5. 保留上一版可用包，必要时重新启用旧版本。

规则：

- 只有管理员能发布和停用。
- 发布前必须能预览。
- 线上异常优先停用问题包，再慢慢修内容。
- 删除只用于确认长期不再使用的旧资产。

功能对应：

| 功能 | 干嘛用 |
|---|---|
| `enabled=false` | 快速停用某个移动 bundle 或内容包 |
| `rolloutPercent` | 灰度发布，先给少量用户 |
| `channel=staging/production` | 区分测试通道和正式通道 |
| `minNativeVersion` | 防止旧 App 拉到不兼容的新 bundle |
| 保留旧版本 | 出错时重新启用旧版本实现回滚 |

## 5. 客服闭环

这部分解决的问题：用户反馈之后不是“黑洞”，管理员能看到、能回复、能标记严重程度、能查历史。

已具备：

- 用户提交反馈
- 管理员查看历史
- 管理员回复用户并发送通知
- 反馈状态：待处理、已解决、已关闭
- 联系方式
- 严重问题标记

最小处理规则：

- 崩溃、支付、无法登录、数据丢失：标记严重。
- 严重问题当天处理，普通反馈按批处理。
- 回复用户后，状态改为已解决。
- 无法复现但已记录的问题，先保留待处理，不直接关闭。

字段说明：

| 字段 | 用途 |
|---|---|
| `status=pending` | 新反馈或还没处理完 |
| `status=resolved` | 已回复或已修复 |
| `status=closed` | 无需继续处理或重复问题 |
| `isCritical=true` | 严重问题，优先处理 |
| `adminNote` | 管理员回复内容，会通知用户 |
| `contact` | 用户留下的联系方式 |
