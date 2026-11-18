# iOS 会员订阅与 RevenueCat 技术实现

> **范围：仅 iOS App Store 订阅（经 RevenueCat）。**  
> 不包含 Android、Web、支付宝、微信支付。  
> 核对日期：2026-11-11（以当前代码为准）

---

## 1. 设计原则

| 原则 | 说明 |
|---|---|
| **本地库是鉴权权威** | 受保护功能一律读 `UserMembership`，不信任客户端 `CustomerInfo` |
| **商店事件以 Webhook 为准** | App Store 订阅生命周期由 RevenueCat webhook 驱动；API 快照只做补偿，**绝不回收权益** |
| **iOS 唯一付费通道** | Capacitor iOS App → StoreKit → RevenueCat → 后端 webhook / sync |
| **乱序安全** | webhook 用 `eventId` 幂等 + `lastEventAt` 单调前进；旧事件不能回退状态 |

Entitlement：`pro_member`（前端 `REVENUECAT_UNLIMITED_ENTITLEMENT_ID`，seed 写入 `MembershipPlan.revenueCatEntitlementId`）。

| 周期 | Store Product ID |
|---|---|
| 月付 | `lourd.manyuding.app.monthly` |
| 年付 | `lourd.manyuding.app.yearly` |

---

## 2. 模块与数据模型

### 2.1 代码位置

| 层 | 路径 | 职责 |
|---|---|---|
| 后端会员 | `modules/membership/` | 套餐、当前态、购买记录、购买后 RC 补偿同步 |
| 后端 RC | `modules/pay/revenuecat/` | Webhook、API 同步、购买账本、对账 Job |
| Webhook 入口 | `modules/pay/pay.controller.ts` | `POST pay/revenuecat/webhook` |
| 前端 SDK | `lib/native/revenuecat.ts` | Purchases Capacitor 封装（iOS） |
| 前端会员页 | `features/membership/` | 购买 / 恢复 / Customer Center |
| 身份绑定 | `providers/auth-provider.tsx` | 登录 `identify(userId)` / 登出 `reset()` |
| 前台恢复 | `lib/native/native-bridge.provider.tsx` | App resume 节流刷新 → 必要时服务端 sync |

### 2.2 核心表（iOS 路径）

```
MembershipPlan            套餐（含 revenueCatEntitlementId = pro_member）
UserMembership            用户当前会员快照（一人一行）
MembershipPurchase        RC 订阅账本（rcSubscriptionId 去重）
RevenueCatWebhookEvent    webhook 投递记录（eventId 幂等）
```

`UserMembership` 关键字段：

| 字段 | 用途 |
|---|---|
| `status` | `active` / `expired` / `cancelled` |
| `expiredAt` | 权益截止；鉴权：`status=active && expiredAt > now` |
| `autoRenew` / `cancelledAt` | 关自动续费但周期未结束时仍为 active |
| `rcCustomerId` | RC customer id（通常 = 本地 userId） |
| `rcProductId` | 当前产生权益的商店商品 ID |
| `pendingProductId` | 周期结束后将切换的商品（如年→月） |
| `originalTransactionId` | Apple 原始交易链，对账用 |
| `lastEventAt` | 最近 webhook 事件时间；只允许更晚事件覆盖 |
| `billingIssueAt` | 扣费异常标记 |

管理员绕过：`user.role === 'admin'` → 直接视为全功能。

---

## 3. 端到端流程

```
┌──────────────┐     StoreKit      ┌─────────────┐     webhook      ┌────────────────┐
│  iOS App     │ ───────────────►  │ RevenueCat  │ ───────────────► │  Backend       │
│  Purchases   │                   │             │                  │  UserMembership│
│  SDK         │ ◄── CustomerInfo ─│             │ ◄── sync API ────│  (鉴权真相)    │
└──────────────┘                   └─────────────┘                  └────────────────┘
```

会员开通主路径只有一条：**App Store 订阅**。  
（新人试用 / 邀请赠送会直接写本地会员，不经 App Store；与付费通道无关，见 §7。）

---

## 4. 客户端流程

### 4.1 初始化与身份

1. App 启动：`NativeBridgeProvider` → `revenueCat.configure()`（可匿名）
2. 登录：`AuthProvider` → `Purchases.logIn({ appUserID: userId })`
3. 登出：`Purchases.logOut()` + 清空本地 user store

**边界**：未 identify 前的匿名购买，webhook 的 `app_user_id` 可能对不上本地用户。服务端记投递但不写会员行；登录后 restore / sync 对齐。

### 4.2 购买

```
identify(userId)
  → purchasePackage(monthly|yearly)     // StoreKit
  → POST /membership/revenuecat/sync    // 服务端查 RC v2 subscriptions
  → 更新 UserStore + 购买记录
```

- 客户端**不上传** CustomerInfo；sync 只用已认证 `userId`。
- sync 对 active 快照最多重试 3 次（间隔 1.2s）。
- 仍 `!isActive`：提示「同步中」，等 webhook。

### 4.3 恢复购买

```
restorePurchases() → sync → 以服务端 isActive 为准
```

### 4.4 管理订阅

```
presentCustomerCenter() → refreshCustomerInfo → sync
```

系统设置里改订阅时，App 在后台可能收不到 SDK listener。resume 每 **5 分钟**节流刷新 CustomerInfo，有变化才 sync。

### 4.5 前端展示边界

| 场景 | 行为 |
|---|---|
| 会员状态文案 | 优先后端 `current`；首屏未返回前短暂用 SDK `hasUnlimited` 防闪烁 |
| 功能门槛 | store `isActive` 做 UI；最终以服务端鉴权为准 |
| 扣费异常 | `billingIssueAt` |
| 已关自动续费 | `autoRenew=false` 且仍 active → 权益保留至到期日 |
| 年改月待生效 | `pendingProductId === monthly` |

SDK 有 entitlement、后端未 sync 成功前，受保护 API 仍拒绝。

---

## 5. Webhook（权威路径）

入口：`POST /api/v1/manyu/pay/revenuecat/webhook`  
鉴权：`REVENUECAT_WEBHOOK_AUTHORIZATION`（兼容旧名 `REVENUECAT_WEBHOOK_SECRET`）。

处理骨架：

1. 校验 Authorization  
2. 要求 `event.id` + `type` + `event_timestamp_ms`  
3. `TRANSFER` 单独处理  
4. 解析已知本地 userId（`app_user_id` / `original_app_user_id` / `aliases`）  
5. 未知用户 → 记 ignored 投递，返回 2xx  
6. 事务：`RevenueCatWebhookEvent.create`（`eventId` 唯一）→ `applyMembershipState`

| 事件 | 本地效果 |
|---|---|
| `INITIAL_PURCHASE` / `RENEWAL` / `UNCANCELLATION` / `PRODUCT_CHANGE` / `SUBSCRIPTION_EXTENDED` / `TEMPORARY_ENTITLEMENT_GRANT` | `active`，`autoRenew=true` |
| `CANCELLATION` | 未到期：`active` + `autoRenew=false`；已到期：`cancelled` |
| `EXPIRATION` | `expired` |
| `REFUND` | `cancelled` + `cancelledAt` |
| `BILLING_ISSUE` | 未到期：保持 `active`，记 `billingIssueAt`；已到期：按 expiration；并发告警 |
| `TRANSFER` | 源用户过期；目标用户 `syncCustomerMembership` |

**乱序与产品切换**（`applyMembershipState`）：

- `existing.lastEventAt >= eventAt` → 忽略  
- 非 active 事件：本地仍 active、本地到期更晚、且 **productId 不同** → 视为被替换旧商品的迟到取消，忽略  
- API 快照（无 `eventAt`）：**禁止缩短**已有 `expiredAt`；空结果**禁止回收**

`EXPIRATION` / `REFUND` 即使缺 entitlement，也用本地 `planId` 兜底回收，并先落库再 2xx。

---

## 6. 补偿同步与对账

### 6.1 购买后 sync（非权威）

`POST /membership/revenuecat/sync` → `syncCustomerMembership`：

- 仅当 API 解析出 **active + 未来到期 + 匹配 plan** 时写入  
- 随后 `syncPurchaseLedger` upsert `MembershipPurchase`  
- **空结果不撤销本地会员**（回收只靠 webhook / 对账）

### 6.2 日对账 Job

`RevenueCatReconcileJob`，默认 `0 35 4 * * *`：

1. 扫描本地仍 active、带商店指纹的会员  
2. 对比 RC：商店已 expired、无其他 access、本地到期明显晚于商店（>5min）→ drift  
3. 默认只告警；`REVENUECAT_RECONCILE_AUTO_RECLAIM=true` 才自动改 `expired`  
4. 同 Job 检查近 24h webhook 失败率，>5% critical 告警

---

## 7. 非商店会员（旁路，简述）

新人试用、邀请奖励会直接写 `UserMembership`，**不经 App Store / RevenueCat**。  
它们影响同一张本地会员表，因此可能与订阅并存时需注意：订阅 webhook / sync 仍按 RC 状态覆盖商店相关字段；赠送本身不会出现在 Customer Center。

购买历史 `GET /membership/purchases` 对 iOS 用户主要看 `MembershipPurchase`（RC 账本）；赠送记录目前从通知标题拼出，属于旁路展示。

---

## 8. 边界与失败矩阵

> 本节是**已实现行为说明**，不是待修缺陷清单。  
> 按「是否必须改代码」分级。

### 8.1 必须保证（运维配置，不是改业务逻辑）

| 项 | 说明 |
|---|---|
| 生产配置 `REVENUECAT_WEBHOOK_AUTHORIZATION` | 未配会放行任意 webhook，属于安全必配 |
| 生产配置 `REVENUECAT_API_KEY` + `REVENUECAT_PROJECT_ID` | 否则购买后 sync 跳过，只能干等 webhook |

### 8.2 已覆盖、不必再修

| 场景 | 现状 |
|---|---|
| Webhook 重复 / 乱序 | `eventId` + `lastEventAt` 已处理 |
| 年↔月迟到 CANCEL | 不同 `productId` 忽略已处理 |
| 购买后 webhook 延迟 | sync 重试 3 次已处理 |
| RC API 短暂空结果 | 明确不回收会员 |
| 退款/到期缺 entitlement | 本地 `planId` 兜底 |
| TRANSFER | 源过期 + 目标 sync |
| 商店提前结束漏 EXPIRATION | 日对账告警；auto reclaim 默认关（有意） |

### 8.3 可忽略（概率低 / 非主路径）

| 场景 | 说明 |
|---|---|
| 匿名购买后登录 | 购买前已 `identify(userId)`；匿名成交概率极低，现有 ignored webhook + restore 够用，**不必专项修** |

---

## 9. 冗余检查（iOS）— 有没有必须修的？

**结论：就当前 iOS 订阅正确性而言，没有必须立刻修的冗余。**  
下列都是可维护性 / 旁路体验，不是「不修就会错发或漏发会员」。

### 9.1 有意分层（保留，不要合并）

| 项 | 说明 |
|---|---|
| Webhook vs Client sync | 权威 vs 购买瞬时补偿 |
| Webhook vs Reconcile Job | 实时事件 vs 漏单兜底 |
| SDK 态 vs 后端会员 | UI 提示 vs 鉴权权威 |
| `_AUTHORIZATION` vs `_SECRET` | 兼容回退 |

### 9.2 真实重复，但非必须修

| 问题 | 优先级 | 说明 |
|---|---|---|
| RC subscriptions 拉取/映射约 4 处重复 | 低（重构债） | 不影响对错，只影响以后改字段时漏改 |
| 购买历史赠送靠中文通知标题 | 低（旁路展示） | 与 App Store 权益无关 |
| admin cancel 只改本地 | 无（行为正确） | 本来就不能替用户退 App Store；文档说清即可 |

### 9.3 易混淆（认知，非缺陷）

- `cancelled` ≠ 「已关自动续费但仍在有效期」（后者仍是 `active` + `autoRenew=false`）
- 赠送会员不会出现在 Customer Center

> 仓库里仍有支付宝/微信、`Order`、`grantEntitlement` 等代码，**当前 iOS 产品不用**；不要当主流程维护。

---

## 10. API 速查（iOS）

| Method | Path | 说明 |
|---|---|---|
| GET | `/membership/plans` | 套餐 |
| GET | `/membership/current` | 当前会员 |
| GET | `/membership/benefits` | 权益表 |
| GET | `/membership/purchases` | 购买历史（含 RC 账本） |
| POST | `/membership/revenuecat/sync` | 购买/恢复后补偿同步 |
| POST | `/pay/revenuecat/webhook` | RevenueCat 事件（权威） |
| GET | `/admin/revenuecat/subscribers` | 后台订阅列表 |
| GET | `/admin/revenuecat/subscribers/:id` | 后台订阅详情 |

业务前缀：`/api/v1/manyu`。

---

## 11. 环境变量（iOS）

| 变量 | 端 | 说明 |
|---|---|---|
| `VITE_REVENUECAT_API_KEY` | 前端 | iOS Public SDK Key（`appl_…`） |
| `REVENUECAT_API_KEY` | 后端 | Secret API Key |
| `REVENUECAT_PROJECT_ID` | 后端 | Project ID |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | 后端 | Webhook Authorization（生产必配） |
| `REVENUECAT_WEBHOOK_SECRET` | 后端 | 旧名回退 |
| `REVENUECAT_RECONCILE_*` | 后端 | 对账 cron / 限流 / 自动回收 |

---

## 12. 排障顺序

1. **App 有 entitlement、本地无会员** → webhook 是否到达、Authorization、appUserId 是否已 identify、sync 是否 `not-configured`  
2. **本地有会员、App 无 entitlement** → 是否赠送旁路；identify 是否绑对 userId  
3. **已关续费仍显示会员** → 正常（周期未结束）；看 `autoRenew` / `cancelledAt`  
4. **退款后仍可用** → `REFUND` 是否落库；对账是否报 drift  
5. **年↔月状态怪** → `rcProductId` / `pendingProductId` + 迟到 CANCEL 忽略逻辑  
6. **购买历史缺记录** → `syncPurchaseLedger` / `MembershipPurchase` upsert  

---

## 13. 一句话

> **iOS 订阅生命周期听 RevenueCat webhook；购买瞬时体验靠客户端 sync；业务开关只认 Postgres `UserMembership`。**
