# AI 额度系统 & 邀请码增强 — 设计方案

> 日期：2026-05-30  
> 状态：待实施

---

## 一、背景

### 1.1 问题

1. **AI 纠错无额度控制**：`EnglishPracticeAiController` 和 `PracticeAiController` 的所有 AI 端点均未做调用次数限制，任何登录用户可无限调用 DeepSeek API，成本不可控。
2. **邀请奖励太弱**：当前邀请码双方各得 **3 天**会员，吸引力不足。应提升为 **7 天**标准会员 + 额外积分，作为新用户激活抓手。

### 1.2 AI 调用成本分析

**DeepSeek 定价**（`deepseek-chat` / V3）：输入 ¥1/百万 tokens，输出 ¥2/百万 tokens。

#### 按端点逐项计算

| 端点 | 估算输入 | 估算输出 | 单次成本 | 计算过程 |
|------|:--:|:--:|:--:|------|
| `feedback` (纠错) | ~1,200 | ~1,500 (max 2000) | **¥0.0042** | (1200/1M×1)+(1500/1M×2) |
| `upgrade` (升级) | ~800 | ~1,200 (max 1500) | **¥0.0032** | (800/1M×1)+(1200/1M×2) |
| `dialogue-turn` (对话判定) | ~600 | ~400 | **¥0.0014** | (600/1M×1)+(400/1M×2) |
| `dialogue-summary` (汇总) | ~1,500 | ~1,000 | **¥0.0035** | (1500/1M×1)+(1000/1M×2) |
| `analyze` (会话分析) | ~2,000 | ~2,000 | **¥0.0060** | (2000/1M×1)+(2000/1M×2) |

> **结论：约 0.4 分钱/次纠错。DeepSeek 是目前性价比最高的 LLM，成本极低。**

#### 按配额估算月成本

| 场景 | 免费用户 (5次/天) | 会员 (50次/天) |
|------|:--:|:--:|
| 100 人 | ¥6.3/月 | ¥63/月 |
| 500 人 | ¥31.5/月 | ¥315/月 |
| 1,000 人 | ¥63/月 | ¥630/月 |
| 10,000 人 | ¥630/月 | ¥6,300/月 |

> 500 会员 × ¥20/月 = ¥10,000 收入，AI 成本仅 ¥315，**毛利 ¥9,685（97%）**。
> 即使 1 万日活全付费，月 AI 成本也仅 ¥6,300。

---

## 二、AI 额度系统设计

### 2.1 核心思路

**每日配额制 + 会员梯度 + 调用前扣减**

```
用户请求 → 查会员等级 → 查今日用量 → 配额足够? 
  ├─ 是 → 扣减1次 → 调用 AI
  └─ 否 → 返回 403 + 引导升级文案
```

### 2.2 数据模型

新增 `AiUsageDaily` 表，按 `(userId, date)` 唯一约束：

```prisma
model AiUsageDaily {
  id       String   @id @default(cuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date     DateTime @db.Date

  feedback    Int  @default(0)   // 纠错反馈次数
  upgrade     Int  @default(0)   // 表达升级次数
  dialogue    Int  @default(0)   // 对话判定次数
  summary     Int  @default(0)   // 汇总/分析次数

  @@unique([userId, date])
  @@index([userId])
  @@map("ai_usage_daily")
}
```

### 2.3 配额配置

| 会员等级 | 纠错 feedback | 升级 upgrade | 对话 dialogue | 汇总 summary |
|----------|:------------:|:------------:|:------------:|:------------:|
| 🆓 free | **5 次/天** | 3 次/天 | 5 次/天 | 1 次/天 |
| ⭐ member | **50 次/天** | 20 次/天 | 50 次/天 | 10 次/天 |

- 仅两个等级：免费 vs 会员，简单清晰
- 免费 5 次/天：完整体验闭环，用完想继续 → 付费或积分兑换
- 会员 50 次/天：认真练习 1 小时仅消耗 30%，无受限感
- 每日 00:00 UTC+8 自动重置（按 `date` 字段天然分区）

### 2.4 免费额度耗尽后：积分兑换

免费用户当日额度用完后，可通过**积分兑换**继续使用 AI：

| 兑换项 | 消耗积分 | 获得 |
|--------|:--:|------|
| +1 次纠错 | **10 积分** | 当日追加 1 次 feedback |
| +1 次升级 | 10 积分 | 当日追加 1 次 upgrade |

- 积分来源：每日签到 10 分 + 连续签到额外奖励（第 2 天 +1，第 3 天 +2，封顶 +5）
- 邀请好友：邀请人 +100 分，被邀请人 +200 分
- 成就奖励：解锁成就获得积分
- 兑换接口：`POST /ai-quota/exchange` `{ type: 'feedback' }` → 扣 10 积分 + 追加 1 次
- 会员不受此限制（50 次/天已远超实际需求）

### 2.5 废弃：优惠券系统

原有 `Coupon` 模块在会员定价 ¥12.9 的低价策略下不再需要：
- 低价本身已降低决策门槛，优惠券的必要性大大下降
- 减少系统复杂度（Coupon 表、CRUD、管理后台、订单关联）
- 种子数据中的 `NEWUSER20`、`WELCOME10`、`FREETRIAL7` 不再维护
- 用「积分兑换」替代优惠券的促活功能

> 后续清理：`prisma/schema.prisma` 中 `Coupon` 模型及相关关联可标记 `@deprecated`，不急于删除以保证向后兼容。

### 2.6 新增文件

```
apps/backend/src/common/ai-quota/
├── ai-quota.module.ts        # 全局模块，exports AiQuotaService
├── ai-quota.service.ts       # 核心逻辑：checkAndDeduct() + exchangeByPoints()
└── ai-quota.controller.ts    # GET /ai-quota/status + POST /ai-quota/exchange
```

### 2.7 集成方式（最小侵入）

在每个 AI Controller 方法前加一行配额检查：

```typescript
// 修改前
@Post('feedback')
async streamFeedback(@Body() dto: EnglishFeedbackDto, @Res() res: Response) {
  await this.service.streamFeedback(dto, res);
}

// 修改后
@Post('feedback')
async streamFeedback(
  @Req() req: Request,
  @Body() dto: EnglishFeedbackDto,
  @Res() res: Response,
) {
  const session = await requireAuthSession(req);
  const check = await this.quotaService.checkAndDeduct(session.user.id, 'feedback');
  if (!check.allowed) {
    return res.status(403).json({
      code: 403,
      message: check.message,  // 例："今日纠错额度已用完（10/10），可用 50 积分兑换 5 次"
      data: { remaining: 0, canExchange: true, exchangeCost: 50 },
    });
  }
  await this.service.streamFeedback(dto, res);
}
```

### 2.8 涉及修改的文件

| 文件 | 修改内容 |
|------|---------|
| `prisma/schema.prisma` | 新增 `AiUsageDaily` 模型 |
| `src/common/ai-quota/ai-quota.module.ts` | 新建全局模块 |
| `src/common/ai-quota/ai-quota.service.ts` | 配额检查+扣减 + 积分兑换 |
| `src/common/ai-quota/ai-quota.controller.ts` | GET status + POST exchange |
| `src/modules/practice-ai/english-practice-ai.controller.ts` | 4 个端点加配额检查 |
| `src/modules/practice-ai/practice-ai.controller.ts` | 3 个端点加配额检查 |
| `src/modules/practice-ai/practice-ai.module.ts` | 导入 AiQuotaModule |

---

## 三、邀请码增强

### 3.1 改动内容

**将邀请奖励从 3 天 → 7 天标准会员，并增加积分奖励。**

| 角色 | 原奖励 | 新奖励 |
|------|--------|--------|
| 邀请人 | +3 天会员 | **+7 天会员 + 100 积分** |
| 被邀请人 | +3 天会员 | **+7 天会员 + 200 积分** |

### 3.2 修改位置

仅需修改 `apps/backend/src/modules/referral/referral.service.ts` 中的 `applyReferral()` 方法：

```typescript
// 改动前
await this.grantTrialDays(referrerCode.userId, 3);
await this.grantTrialDays(referredUserId, 3);

// 改动后
await this.grantTrialDays(referrerCode.userId, 7);
await this.grantTrialDays(referredUserId, 7);

// 🆕 新增加积分奖励
await this.grantPoints(referrerCode.userId, 100, 'invite_reward', '邀请好友注册奖励');
await this.grantPoints(referredUserId, 200, 'invited_bonus', '通过邀请码注册新人礼包');
```

### 3.3 涉及修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/modules/referral/referral.service.ts` | 3→7天，新增积分发放 |

---

## 四、学习计划单元 — 免费/会员内容分级

### 4.1 设计

学习计划（`LearningPlan`）的单元按会员等级解锁：

| 会员 | 可用单元 |
|------|---------|
| 🆓 免费 | **寝室入住** 等基础场景（约 2-3 个单元） |
| ⭐ 会员 | **全部单元** |

- 免费用户体验核心闭环：寝室场景 → 话题训练 → AI 纠错（5次/天）
- 免费用户点击未解锁单元时，弹出升级引导
- 实现方式：`LearningService` 查询时按 `userMembership.level` 过滤

### 4.2 涉及修改

| 文件 | 修改内容 |
|------|---------|
| `src/modules/learning/learning.service.ts` | 查询单元时加会员过滤逻辑 |

---

## 五、实施步骤（按顺序）

| 步骤 | 内容 | 估时 |
|:--:|------|:--:|
| 1 | Prisma Schema 新增 `AiUsageDaily` | 5 min |
| 2 | 运行 `prisma migrate` + `prisma generate` | 2 min |
| 3 | 创建 `AiQuotaService` + `AiQuotaModule` + Controller | 25 min |
| 4 | Controller 集成配额检查（6 个端点） | 20 min |
| 5 | 修改邀请奖励 3→7天 + 积分发放 | 10 min |
| 6 | 学习计划单元加会员过滤 | 15 min |
| 7 | 验证：启动 dev，测试各端点 | 10 min |

---

## 六、会员功能定价总结

基于以上设计，整理当前完整的会员差异化体系：

| 功能 | 🆓 免费 | ⭐ 会员 ¥20/月 |
|------|:--:|:--:|
| AI 纠错 | 5次/天 | **50次/天** |
| AI 表达升级 | 3次/天 | 20次/天 |
| AI 对话判定 | 5次/天 | 50次/天 |
| 额度耗尽后 | 积分兑换（10分/次） | — |
| 学习计划单元 | 寝室入住等基础 | **全部解锁** |
| 剧本模式 | Ch.0 体验 | 全部章节 |
| 探索模式 | ❌ | 全部地点 |
| 表达库容量 | 20条 | 无限 |
| 场景化训练 | 预览 | 无限 |
| 输出等级追踪 | 基础 | 完整报告 |
| 客服 | ❌ | 工作日 |
| 邀请好友 | +7天+100积分 | +7天+100积分 |
| 被邀请奖励 | +7天+200积分 | +7天+200积分 |

### 定价理由

| 因素 | 说明 |
|------|------|
| AI 成本 | 单用户月均 ~¥1.25（50次×30天×¥0.004×20%实际使用率） |
| 毛利率 | **~97%**，AI 成本几乎可忽略 |
| 用户心理 | ¥20 = 两瓶饮料钱，介于「免费」和「正经产品」之间 |
| 竞品对标 | 百词斩 ¥12-18，流利说 ¥49，我们居中合理 |
| 500 人收入 | ¥10,000/月，AI 成本仅 ¥315，净利 ~¥9,000+ |
| 年付优惠 | ¥149/年（¥12.4/月，约 6.2 折），拉升 LTV |
