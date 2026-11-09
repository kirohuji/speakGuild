# iOS 订阅提前结束补偿

更新日期：2026-11-09  
状态：晚上改代码前的说明。本文只覆盖一件事：`EXPIRATION` / `REFUND` 没写进本地时，用户在原到期日之前仍被当成会员。

不改这些：

- 生产环境会配置 `REVENUECAT_WEBHOOK_AUTHORIZATION`。鉴权逻辑保持现状，本文不把它当缺陷。
- Web 支付、`grantEntitlement`。
- 前端练习 / 表达库门控。
- Bundle ID、商品 ID、权益 ID。已核对，代码常量不动。

适用代码：

- `apps/backend/src/modules/pay/pay.controller.ts`（`POST pay/revenuecat/webhook`）
- `apps/backend/src/modules/pay/revenuecat/revenuecat.service.ts`
- `apps/backend/prisma/schema.prisma`（`user_membership`、`revenuecat_webhook_event`）
- 读权限：`membership.service.ts` 的 `getCurrentMembership`、`common/ai-quota/ai-quota.service.ts`

全局前缀是 `/api/v1/manyu`。webhook 全路径：`POST /api/v1/manyu/pay/revenuecat/webhook`。

---

## 1. 现在已经成立的行为

这些晚上不要推倒重写。

**自然到期已经会停权。** `getCurrentMembership` 和 AI 额度都要求 `status === 'active'` 且 `expiredAt > now`。上次续订写入的到期日一过，即使用户库里的 `status` 还是 `active`，接口也会按免费用户处理。丢了 `EXPIRATION` 不会让人在原到期日之后继续用。

**购买后的 API sync 只加不减。** `syncCustomerMembership` 只在快照明确 `kind === 'active'` 时写入会员。空列表、查失败、解析不出权益都不会把本地会员改掉。快照没有 `eventAt`，`applyMembershipState` 里「非 webhook 且本地到期更晚」会直接返回，避免一次滞后的查询把到期日缩短。这个函数继续只负责购买 / 恢复后的补偿开通。

**事件幂等已经有一半。** `revenuecat_webhook_event.eventId` 是主键。`recordAndApplyWebhook` 把「插入事件」和「改会员」放在同一个事务里。主键冲突 `P2002` 返回 `{ success: true, duplicate: true }`，不再改会员。RevenueCat 收到 2xx 就停止重试。

**乱序和旧商品已经有保护。** webhook 带 `eventAt`。本地 `lastEventAt` 更晚或相等时，这条事件不覆盖。旧月付被年付替换后，针对旧 `product_id`、且到期日更早的非 active 事件会被丢掉。这条保留：不要让旧商品的 `EXPIRATION` 把当前年付收掉。

**取消自动续订不是停权。** `CANCELLATION` 在到期日仍在未来时保持 `status=active`、`autoRenew=false`。对账不能把「将不续订」收成过期。

**匿名事件不写会员。** 认不出本地用户时只插入 `revenuecat_webhook_event`（这张表的 `userId` 没有外键），返回 200。

---

## 2. 缺口（晚上要补的）

假会员只出现在**商店已经提前结束，本地 `expiredAt` 还在未来，`status` 仍是 `active`**。典型是退款。没有定时任务去问 RevenueCat，也没有「本地还有效、商店已经结束」的人数告警。

另外两个落库缺口：

1. `EXPIRATION` / `REFUND` 如果没有 `entitlement_ids`，或者权益对不上 `membership_plan.revenueCatEntitlementId`，现在直接打日志并返回 200，**不插入** `revenuecat_webhook_event`。RevenueCat 不会重试，本地也没有这张投递记录。
2. webhook 处理抛错时会走 `OpsAlertService`（key `revenuecat-webhook-failed`，默认 300 秒节流）并继续抛出，RevenueCat 会重试。成功、忽略、重复没有汇总，所以现在算不出失败率，也算不出「本地 active、商店已结束」的人数。

---

## 3. 晚上的目标

四件事，按这个顺序做。对账是可选的，但监控里的漂移人数依赖它的查询，建议同一晚做完。

### 3.1 Webhook 可达、鉴权、重试

代码侧保持「失败才非 2xx」：

| 结果 | HTTP | RevenueCat |
|---|---|---|
| 事件已写入，会员已按规则更新或确认无需更新 | 200 | 停止重试 |
| 同一 `event.id` 再次到达 | 200，`duplicate: true` | 停止重试 |
| 数据库或未预期异常 | 5xx | 按 RevenueCat 的策略重试 |

缺 `id` / `type` / `event_timestamp_ms` 继续 400。这不是可恢复失败。

上线前人工确认（不改代码）：

- RevenueCat webhook URL 是公网 HTTPS 的 `/api/v1/manyu/pay/revenuecat/webhook`。
- Authorization 与生产环境 `REVENUECAT_WEBHOOK_AUTHORIZATION` 一致。未配置时现有代码会放行；生产必须配置。
- RevenueCat 后台能看到测试事件是 2xx。

### 3.2 `EXPIRATION` / `REFUND` 幂等落库

已知本地用户的这两类事件，**先落 `revenuecat_webhook_event`，再决定改不改会员**。落库和改会员仍在同一个事务里，失败则整单回滚，让 RevenueCat 重试。

应用规则：

- 重复 `event.id`：200，不改会员。
- `eventAt` 不新于 `lastEventAt`：事件留在表里，不回退会员。
- `product_id` 与当前 `rcProductId` 不同，且这条结束时间早于本地 `expiredAt`：视为被替换的旧商品，不改当前会员。
- 能对上当前商品，或本地还没有 `rcProductId`：  
  - `REFUND` → `status=cancelled`，`autoRenew=false`，`cancelledAt=now`，`expiredAt` 用事件里的到期时间，没有则用现在。  
  - `EXPIRATION` → `status=expired`，`autoRenew=false`，`expiredAt` 用事件里的到期时间，没有则用现在。
- 没有权益 ID，或权益对不上计划：事件仍然落库，会员不动，返回 200，并打一条告警（不要 5xx，否则对不上计划时会无限重试）。商品和权益已核对过，这条应极少发生，留记录是为了能看见。

`INITIAL_PURCHASE`、`RENEWAL`、`CANCELLATION`、`BILLING_ISSUE` 的现有分支不动。`syncCustomerMembership` 仍然不根据空结果回收。

### 3.3 定时对账（可选，建议做）

新任务，不要塞进 `syncCustomerMembership`。那个函数的契约是「空结果不回收」，购买补偿还靠它。

扫描范围：`user_membership.status = active` 且 `expiredAt > now`，并且有 `originalTransactionId` 或 `rcProductId`。没有商店标识的行（纯赠送、纯后台开通）不查、不改。

对每一行用现有 v2 订阅查询（`projects/{project}/customers/{id}/subscriptions`）。客户 ID 用 `rcCustomerId`，没有则用 `userId`。

**可以改本地的唯一情况**（四条都要满足）：

1. HTTP 成功，响应能解析出订阅列表（列表可以是空的，但空列表不满足第 2 条）。
2. 其中一条能对上这笔本地订阅：`store_subscription_identifier === originalTransactionId`，或商店商品 ID === `rcProductId`。对不上就停。
3. 对上的那条 `status === 'expired'`，且 `gives_access === false`。`in_grace_period`、`in_billing_retry`、`paused`、`trialing`、`active`、`unknown` 都不回收。
4. 该订阅的结束时间早于本地 `expiredAt` 超过 5 分钟。结束时间缺失、无法解析、或与本地到期日只差几分钟：不改到期日。

同时还有另一条 `gives_access === true` 的订阅时，不回收。

回收写法与退款 webhook 对齐：`status` 改为 `expired`，`autoRenew=false`，`expiredAt` 改为商店结束时间。不要写 `lastEventAt`，避免一次对账挡住随后真正的 webhook。

**这些情况一律不改会员：**

- 超时、5xx、401、解析异常。
- 客户不存在、订阅列表为空、列表里没有能对上的那一笔。
- 只是关闭了自动续订，周期还没结束。
- 结束时间不早于本地到期日。邀请和新人赠送把 `expiredAt` 叠在同一行上时，商店自然结束后本地会更晚；这种差值留给监控，不在对账里裁掉。

已知限制：赠送天数和商店订阅共用一个 `expiredAt`。若退款的结束时间更早，对账会把整行收到商店结束时间，多出来的赠送天数会一起没掉。今晚不拆账本。

建议每天一次，跟现有 `OpsCapacityJob` 一样用 `@Cron`，表达式走环境变量，默认定在低峰。单次限制条数，请求之间留间隔，避免打满 RevenueCat。

### 3.4 监控

用现有 `OpsAlertService.notify`。

1. **Webhook 失败率**  
   分子：处理函数抛错的次数（现有 `revenuecat-webhook-failed`）。  
   分母：同期 `revenuecat_webhook_event` 新增行数（含重复请求里第一次成功的那条）。  
   失败率用这两个数在对账任务末尾算。过去 24 小时失败次数大于 0 且失败率超过 5% 时告警，key 固定，节流 24 小时。RevenueCat 控制台的投递曲线仍是外部对照，后端不替代它。

2. **本地仍有效、商店已提前结束的人数**  
   就是 3.3 里四条都满足、本轮本来要回收的用户数。人数大于 0 就告警，带上人数和最多 20 个 `userId`。自动回收打开时，告警表示「本轮已回收」；回收开关关闭时，告警表示「只发现、未改库」。

回收开关建议用环境变量，默认关闭，先跑几天只告警。确认名单都是退款或商店撤销后，再打开自动回收。

---

## 4. 建议改动的文件

- `revenuecat.service.ts`  
  `EXPIRATION` / `REFUND` 改为先落库再分支；抽出「对上某一笔订阅后是否允许回收」的纯判断，给 webhook 和对账共用产品匹配，避免两套条件。
- 新文件 `revenuecat-reconcile.job.ts`，注册到 `pay.module.ts`。只调用新的对账方法，不调用 `syncCustomerMembership`。
- 告警沿用 `OpsAlertService`。不必为了计数加表；失败次数若只存在进程内存里，重启会丢。抛错时除了现有告警，再记一条日志即可，失败率的分子以告警细节或日志为准。若希望重启也不丢分子，再给 `revenuecat_webhook_event` 加可选 `outcome`，今晚可以不做。

不改前端，不改商品常量，不改 `grantEntitlement`。

---

## 5. 晚上改完后怎么验

1. 同一条 `EXPIRATION` 或 `REFUND` 投递两次：会员只变一次，第二次 `duplicate: true`，表里仍是一行。
2. 构造一条没有 `entitlement_ids` 的 `REFUND`（已知用户、`product_id` 等于当前 `rcProductId`）：表里有事件，会员变为 `cancelled`，接口立即不再给会员。
3. 年付有效时，再投一条旧月付的 `EXPIRATION`：年付行不变。
4. `syncCustomerMembership` 在订阅查询返回空列表后：本地 active 和 `expiredAt` 都不变。
5. 对账：把 RC 上对得上的订阅收成 `expired` 且 `gives_access=false`、结束时间早于本地：开关打开时本地被收到该结束时间；开关关闭时只告警。
6. 对账：客户 404、空列表、请求超时、仅 `will_not_renew`、或处于 `in_billing_retry`：本地行不变。
7. 到期日已过、webhook 没来：不跑对账，`GET /membership/current` 也已经是免费用户。
