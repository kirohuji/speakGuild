# RevenueCat 与 Apple 订阅配置方案

本文档记录漫语町当前阶段的会员设计：不做永久买断，先做月度和年度自动续订会员，并兼容积分、新用户赠送和邀请码赠送。

## 结论

推荐采用：

- 一个会员权益：`pro_member`
- 两个自动续订订阅商品：月会员、年会员
- 一个默认售卖页 Offering：`default`
- 后端 `user_membership` 作为业务判权来源
- RevenueCat webhook 同步 Apple 订阅状态到后端
- 新用户 5 天、邀请码 5 天走后端赠送会员天数
- 月费 19 元、年费 198 元

这个设计可以。月付 19 元、年付 198 元没有结构性问题，但最终价格必须选择 App Store Connect 支持的价格点。中国区通常可以配置接近或等于该金额的人民币价格点，提交前需要在 App Store Connect 的价格表里确认。

## 当前代码需要统一的点

实现前前后端的 RevenueCat 权益 ID 曾不一致：

- 前端：`apps/frontend/src/lib/native/revenuecat.ts` 中曾是 `漫语町 Unlimited`
- 后端 seed：`apps/backend/prisma/seed.ts` 中是 `pro_member`

现已统一为：

```ts
pro_member
```

原因：

- 技术 ID 应保持稳定、英文、无空格。
- 中文名称只用于 UI 展示。
- Apple、RevenueCat、后端三处必须一致，否则会出现支付成功但会员不生效。

当前阶段不卖永久会员，前端 RevenueCat 包类型只保留 `monthly` 和 `yearly`，避免 RevenueCat Offering 中没有 lifetime package 时触发 package not found。

## 商品模型

### 后端会员计划

后端可以继续只保留一个会员计划：

```text
name: 漫语町会员
level: standard
price: 1900
yearlyPrice: 19800
durationDays: 30
revenueCatEntitlementId: pro_member
```

说明：

- `price = 1900` 表示月付 19 元。
- `yearlyPrice = 19800` 表示年付 198 元，可按运营策略调整。
- 后端的 `yearlyPrice` 主要用于 Web/支付宝/微信支付展示和创建订单。
- iOS App 内实际价格以 App Store Connect 配置为准，不应由前端硬编码金额。

### Apple 商品

在 App Store Connect 中创建一个订阅组，例如：

```text
Subscription Group: ManYuDing Pro
```

在该订阅组下创建两个 auto-renewable subscriptions：

```text
Product ID: lourd.manyuding.app.monthly
Reference Name: 漫语町会员月度订阅
Duration: 1 Month
Base Price: CNY 19

Product ID: lourd.manyuding.app.yearly
Reference Name: 漫语町会员年度订阅
Duration: 1 Year
Base Price: CNY 198
```

Product ID 保存后不可编辑，也不能删除后复用。因为旧的 `lourd.manyu.pro.yearly` 已经配置错，当前建议不要继续补救旧 ID，而是新建一组统一、对称的 Product ID：

```text
lourd.manyuding.app.monthly
lourd.manyuding.app.yearly
```

旧的 `lourd.manyu.pro.monthly` / `lourd.manyu.pro.yearly` 如果还没有提交审核，可以留在 App Store Connect 里不使用；RevenueCat 和前端只接入新的这组商品。

## Apple Store Connect 配置步骤

### 1. 前置项

在 App Store Connect 确认：

- App 已创建，Bundle ID 与 Capacitor 配置一致：`lourd.manyu.app`
- Paid Apps Agreement 已签署
- 税务、银行、联系人信息已配置
- App 内购买能力可用

当前 Capacitor 配置：

```ts
appId: 'lourd.manyu.app'
appName: '漫语町'
```

### 2. 创建订阅组

路径：

```text
App Store Connect -> My Apps -> 漫语町 -> Monetization -> Subscriptions
```

创建订阅组：

```text
ManYuDing Pro
```

订阅组展示名称可以本地化，例如：

```text
zh-Hans: 漫语町会员
en-US: ManYuDing Pro
```

同一订阅组里的商品代表同一类权益的不同周期。月会员和年会员应该放在同一个订阅组里，这样用户可以在 Apple 订阅管理中升级、降级或切换周期。

### 3. 创建月会员

创建 auto-renewable subscription：

```text
Product ID: lourd.manyuding.app.monthly
Reference Name: 漫语町会员月度订阅
Subscription Duration: 1 Month
Price: CNY 19
```

本地化展示：

```text
Display Name: 漫语町会员月卡
Description: 解锁完整学习内容、AI 练习反馈和会员权益
```

### 4. 创建年会员

创建 auto-renewable subscription：

```text
Product ID: lourd.manyuding.app.yearly
Reference Name: 漫语町会员年度订阅
Subscription Duration: 1 Year
Price: CNY 198
```

本地化展示：

```text
Display Name: 漫语町会员年卡
Description: 解锁完整学习内容、AI 练习反馈和会员权益
```

### 5. 可选配置首月优惠

当前默认价格是月费 19 元、年费 198 元。如果以后要做新订阅用户首月优惠，推荐使用 Apple introductory offer：

```text
Offer Type: Pay As You Go
Duration: 1 Month
Introductory Price: 按运营活动配置
Applies To: monthly subscription
```

注意：

- Introductory offer 通常只对该订阅组的新订阅用户可用。
- 用户是否符合资格由 Apple 判断。
- 如果用户已经用过同订阅组的新用户优惠，不能再次享受。
- 前端文案应写成“符合条件的新订阅用户首月优惠”，不要承诺所有用户都一定可用。

如果以后想做“邀请码用户首月优惠”，而不是所有新订阅用户首月优惠，可以考虑：

- Apple offer codes
- Apple promotional offers
- RevenueCat targeting / paywall placement

但这会比 introductory offer 复杂，需要服务端或 RevenueCat 判断 eligibility，并且在 iOS 端购买指定 offer。

### 6. 审核信息

每个订阅商品需要补齐：

- Review Screenshot
- Display Name
- Description
- Price
- Availability
- Subscription Group localization

如果 App 还没有正式发版，IAP 商品通常需要随 App 版本一起提交审核。

## RevenueCat 配置步骤

### 1. 创建项目和 App

在 RevenueCat 中创建项目，然后添加 iOS App：

```text
Bundle ID: lourd.manyu.app
```

从 RevenueCat 获取 iOS public SDK key，填入前端环境变量：

```env
VITE_REVENUECAT_API_KEY=appl_xxx
```

不要在正式环境使用测试 key 或硬编码 fallback key。

### 2. 连接 App Store Connect

在 RevenueCat 的 Apple App 配置中连接 App Store Connect API key。连接后 RevenueCat 可以同步 Apple 商品和订阅状态。

### 3. 导入 Products

导入两个 Apple 商品：

```text
lourd.manyuding.app.monthly
lourd.manyuding.app.yearly
```

### 4. 创建 Entitlement

创建权益：

```text
Identifier: pro_member
Display Name: 漫语町会员
```

将两个 products 都挂到同一个 entitlement：

```text
lourd.manyuding.app.monthly -> pro_member
lourd.manyuding.app.yearly -> pro_member
```

这样无论用户买月付还是年付，App 都只需要判断 `pro_member` 是否 active。

### 5. 创建 Offering

创建默认 Offering：

```text
Identifier: default
```

添加 packages：

```text
Monthly package -> lourd.manyuding.app.monthly
Annual package -> lourd.manyuding.app.yearly
```

如果使用 RevenueCat Paywalls UI，则在 Paywall 编辑器里只展示月付和年付，不展示 lifetime。

### 6. 配置 Webhook

RevenueCat webhook 应指向后端：

```text
POST https://你的域名/api/v1/manyu/pay/revenuecat/webhook
```

建议处理事件：

- `INITIAL_PURCHASE`
- `RENEWAL`
- `UNCANCELLATION`
- `CANCELLATION`
- `EXPIRATION`
- `BILLING_ISSUE`
- `PRODUCT_CHANGE`
- `REFUND`

后端收到事件后，以 RevenueCat 事件为准更新 `user_membership`：

```text
active entitlement -> status=active, expiredAt=expires_at
expired/refunded -> status=expired 或 cancelled
cancelled but not expired -> autoRenew=false, 会员继续有效到 expires_at
```

RevenueCat 的 `app_user_id` 应使用你自己的用户 ID。当前前端已经在登录后调用：

```ts
revenueCat.identify(session.user.id)
```

这是正确方向。

## 新用户 5 天与邀请码 5 天

这两类建议不要做成 Apple 订阅商品，也不要放到 App Store Connect。

推荐做法：

- 新用户注册成功后，后端直接给 5 天 `user_membership`
- 用户输入有效邀请码后，后端再延长 5 天
- 如果已经是活跃会员，在当前 `expiredAt` 基础上叠加
- 如果不是活跃会员，从当前时间开始计算

示例规则：

```text
新用户奖励：+5 天
邀请码奖励：被邀请人 +5 天
邀请人奖励：可给积分、天数或其他权益
```

需要注意：

- 免费赠送天数属于 App 自己的业务权益，不需要 Apple IAP。
- iOS App 内不要引导用户到外部支付购买数字内容。
- 免费权益结束后，可以弹 RevenueCat paywall 引导订阅。

## 积分体系

积分建议只用于 App 内非现金权益或 Web/国内支付侧的优惠，不建议直接影响 iOS IAP 价格。

推荐边界：

```text
iOS App 内订阅价格：由 Apple 管
Web/支付宝/微信订单价格：后端可用积分抵扣
免费天数/体验会员：后端可发放
```

原因：

- Apple IAP 的实际扣款价格不能由你的后端临时改。
- 积分抵扣如果用于 iOS 数字订阅，容易和 App Store 审核规则冲突。
- 如果想给 iOS 用户优惠，应优先使用 Apple introductory offer、offer codes 或 promotional offers。

## 首月优惠方案

### 当前 MVP 方案

当前先不配置首月优惠，直接使用固定订阅价格：

```text
月会员：19 元/月
年会员：198 元/年
```

前端文案：

```text
月卡 ¥19/月
年卡 ¥198，约 ¥16.5/月
```

如果以后启用 introductory offer，更严谨文案：

```text
符合条件的新订阅用户首月优惠，之后 ¥19/月
```

### 不推荐的方案

不要在 iOS App 内做：

```text
用积分把 Apple 月会员从 19 元抵扣成其他价格
```

这类价格不由 Apple 结算，容易造成支付和审核问题。

### 可选进阶方案

如果以后要做更细的运营：

- 普通新用户：首月优惠
- 邀请码用户：专属优惠
- 流失用户召回：限时优惠

可以研究：

- Apple offer codes
- Apple promotional offers
- RevenueCat targeting
- 自建服务端 eligibility

这部分建议等基础订阅跑通后再做。

## 后端同步设计

后端应新增 RevenueCat webhook controller/service。

核心字段：

```text
app_user_id -> user.id
entitlement_ids -> pro_member
product_id -> lourd.manyuding.app.monthly / lourd.manyuding.app.yearly
expiration_at_ms 或 expires_at -> expiredAt
period_type -> trial / intro / normal
environment -> SANDBOX / PRODUCTION
```

建议新增或复用字段：

```text
UserMembership.rcCustomerId
UserMembership.autoRenew
UserMembership.cancelledAt
Order.metadata
```

是否要为 Apple IAP 创建 `Order` 记录可以分两期：

第一期：

- webhook 只更新 `user_membership`
- RevenueCat 后台作为订单明细来源

第二期：

- webhook 同步一份 Apple/RevenueCat 订单到本地 `order`
- 后台收入统计统一看本地订单表

当前 MVP 更建议第一期，简单且不容易出错。

## 前端行为

iOS Native：

- 展示 RevenueCat paywall
- 购买、恢复购买、管理订阅走 RevenueCat / Apple
- 不展示支付宝、微信购买按钮

Web：

- 保留支付宝、微信、积分抵扣
- 购买成功后后端更新 `user_membership`
- 如需跨端同步，可由后端调用 RevenueCat promotional entitlement

Android：

- 如果上 Google Play，走 Google Play Billing + RevenueCat
- 如果国内安卓渠道，可能仍需要支付宝/微信，具体要按渠道规则拆

## 测试清单

### Apple Sandbox

- Sandbox Apple ID 能看到月付和年付商品
- 月付首月优惠显示正确
- 购买成功后 RevenueCat customerInfo 有 `pro_member`
- 后端 webhook 收到 `INITIAL_PURCHASE`
- 后端 `user_membership` 被更新为 active
- 退出登录再登录，`app_user_id` 归因正确
- 恢复购买能恢复 `pro_member`
- 取消自动续订后，会员在过期前仍有效
- 过期后后端状态变为 expired

### 本地业务

- 新注册用户自动获得 5 天
- 输入邀请码后再增加 5 天
- 已有会员领取赠送天数时按当前 `expiredAt` 叠加
- 免费权益到期后弹出 paywall
- Web 支付成功后会员状态生效
- iOS 内没有外部支付入口

## 上线前必须完成

- `REVENUECAT_UNLIMITED_ENTITLEMENT_ID` 已改为 `pro_member`
- 已移除当前阶段不用的 `lifetime`
- 已移除前端硬编码 RevenueCat test key，正式环境需配置 `VITE_REVENUECAT_API_KEY`
- 生产环境配置 `REVENUECAT_WEBHOOK_AUTHORIZATION`
- App Store Connect 创建新的月付和年付订阅：`lourd.manyuding.app.monthly` / `lourd.manyuding.app.yearly`
- RevenueCat 只导入新的 `manyuding` products，并配置 entitlement/offering
- 后端已增加 RevenueCat webhook：`POST /api/v1/manyu/pay/revenuecat/webhook`
- iOS 审核截图和订阅本地化补齐
- 隐私政策和服务条款说明自动续订、取消订阅、价格和权益

## 参考链接

- Apple 自动续订订阅：https://developer.apple.com/app-store/subscriptions/
- App Store Connect 订阅配置：https://developer.apple.com/help/app-store-connect/manage-subscriptions/overview-for-configuring-auto-renewable-subscriptions
- Apple introductory offers：https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions
- Apple offer codes：https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-offer-codes
- Apple promotional offers：https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-promotional-offers-for-auto-renewable-subscriptions
- App Review Guidelines：https://developer.apple.com/app-store/review/guidelines/
- RevenueCat Entitlements：https://www.revenuecat.com/docs/getting-started/entitlements
- RevenueCat Offerings：https://www.revenuecat.com/docs/offerings/overview
- RevenueCat Webhooks：https://www.revenuecat.com/docs/integrations/webhooks
