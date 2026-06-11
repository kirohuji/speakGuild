# 用户登录会话与在线状态设计

## 目标

用户可以在多端正常使用，但系统需要能识别和限制账号滥用。后台管理员需要看到用户是否在线、当前有哪些登录会话、绑定了哪些登录方式，并能在必要时撤销异常会话。

## 当前基础

- 认证框架：Better Auth。
- 已有表：`user`、`session`、`account`。
- `session` 已记录 `userId`、`token`、`expiresAt`、`ipAddress`、`userAgent`、`createdAt`、`updatedAt`。
- 已接入通知 WebSocket，服务端已有内存映射 `userId -> socketId[]`，可以判断当前进程内用户是否在线。

## 第一阶段：先把管理视角补齐

后台用户详情展示：

- 当前在线状态：来自 WebSocket presence，显示在线/离线和当前连接数。
- 最近有效会话：来自 `session` 表，显示设备摘要、IP、最近更新时间、过期时间。
- 绑定账号：来自 `account` 表，显示邮箱密码、微信、Apple 等登录方式。
- 核心学习指标：只保留练习会话、剧本记录、等级、经验、积分、AI 用量。

第一阶段不改变登录策略，只增强可观察性。

## 第二阶段：会话治理

建议新增后台能力：

- 踢出单个会话：删除指定 `session`。
- 踢出全部其他设备：保留当前管理员操作会话或保留用户最新会话，删除其余会话。
- 强制重新登录：删除用户所有 session，并通过 WebSocket 通知在线客户端跳转登录页。
- 会话上限：普通用户最多 2 到 3 个活跃设备，会员可放宽。

会话上限策略建议：

- 登录时统计用户未过期 session 数。
- 超过限制时，优先删除最久未活跃的 session。
- 如果短时间内 IP/设备变化异常，则拒绝新登录或要求验证码。

## 第三阶段：设备与风控记录

Better Auth 的 `session` 表只有基础字段，建议新增业务表：

```prisma
model UserLoginDevice {
  id             String   @id @default(cuid())
  userId         String
  sessionId      String?
  deviceId       String
  deviceName     String?
  platform       String?
  browser        String?
  ipAddress      String?
  userAgent      String?
  lastSeenAt     DateTime @default(now())
  firstSeenAt    DateTime @default(now())
  trusted        Boolean  @default(false)
  revokedAt      DateTime?
  revokeReason   String?

  @@index([userId])
  @@index([sessionId])
  @@unique([userId, deviceId])
}

model UserLoginEvent {
  id          String   @id @default(cuid())
  userId      String
  sessionId   String?
  type        String
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
}
```

`deviceId` 可以由前端生成并存储在 localStorage/native secure storage；服务端仍以 session 为准，不信任 deviceId，只用于聚合识别。

## 在线状态设计

单实例部署时可以直接使用当前 WebSocket 内存表。

多实例部署时需要改成 Redis presence：

- 连接时写入 `presence:user:{userId}:{socketId}`，TTL 60 秒。
- 客户端或服务端定期 heartbeat 刷新 TTL。
- 断开时删除 key。
- 查询用户在线状态时扫描或维护 `presence:user:{userId}` 集合。

后台列表只需要 `online: boolean`，详情页展示 `socketCount`、最后心跳时间即可。

## 安全策略建议

- 登录成功后记录 `UserLoginEvent(type='login_success')`。
- 登录失败后记录 `login_failed`，按账号、IP 做频率限制。
- 同账号 10 分钟内出现多个国家/地区 IP 时标记风险。
- 同账号短时间内超过设备上限时要求 OTP。
- 管理员踢会话、改角色、删账号都写审计日志。

## 这次已落地

- 后台用户列表返回 `online`。
- 用户详情返回 `presence`、最近 10 个 `sessions`、`accounts`。
- 用户详情弹窗加入在线状态、登录会话、绑定账号。
- 删除详情页中低价值的统计项：表达库、场景进度、Chunk 进度、订单。
