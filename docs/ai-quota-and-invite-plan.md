# 漫语町 — 会员体系 & AI 额度 & 邀请码 设计方案（终版）

> 日期：2026-06-03  
> 状态：已更新  
> 定价：**¥20/月 | ¥199/年（iOS only，Apple 15% 抽成后到手 ¥17/月）**  
> 🎯 第一阶段目标：**100 付费用户，MRR ¥1,700/月**

---

## 一、目标：100 付费用户

```
当前：0 → 内容上线 + ASO → 6个月 → 100 付费用户
                                    ↓
                          MRR ¥1,700/月（到手）
                          年收入 ~¥20,000
                          AI成本 ~¥100/月（可忽略）
```

| 阶段 | 时间 | 付费用户 | 月到手 |
|------|:--:|:--:|:--:|
| 冷启动 | 第 1-2 月 | 5-15 | ¥85-255 |
| 增长 | 第 3-4 月 | 30-50 | ¥510-850 |
| 初步验证 | 第 5-6 月 | 60-80 | ¥1,020-1,360 |
| 🎯 **达标** | **第 6-8 月** | **100** | **¥1,700** |

> 100 人不是终点，是验证「产品有人愿意付费」的里程碑。之后靠内容驱动 + 邀请裂变滚雪球。

---

## 二、会员体系一览

### 两档，简单清晰

| | 🆓 免费 | ⭐ 会员 ¥20/月 |
|---|:--:|:--:|
| AI 纠错 | 5次/天 | **50次/天** |
| AI 对话判定 | 5次/天 | 50次/天 |
| 额度耗尽后 | 积分兑换（10分/次） | — |
| 学习计划单元 | 寝室入住等基础 | **全部解锁** |
| 表达库容量 | 20条 | 无限 |
| 输出等级追踪 | 基础 | 完整报告 |
| 邀请好友 | +5天+100积分 | +5天+100积分 |
| 被邀请奖励 | +50积分 | +50积分 |
| 前100名注册 | **+5天免费试用** | **+5天免费试用** |

---

## 三、收入模型（iOS only，Apple 小企业计划 15% 抽成）

### 单用户到手

| | 月付 | 年付 |
|---|:--:|:--:|
| 用户支付 | ¥20 | ¥199 |
| Apple 抽成 15% | -¥3.00 | -¥29.85 |
| **到手** | **¥17.00** | **¥169.15** |

### 100 付费用户 = ¥1,700/月

```
月到手：100 × ¥17 = ¥1,700
年付占比 30%：30 × ¥169.15 / 12 ≈ ¥423
实际月到手：70 × ¥17 + ¥423 ≈ ¥1,613
AI 成本：100 × 50次 × 30天 × ¥0.004 × 20%使用率 = ¥120
服务器：~¥300
─────────────
月净利润：~¥1,200
```

---

## 四、AI 额度系统

### 4.1 核心流程

```
用户请求 AI 纠错
  → 查会员等级
    → 会员：直接放行（50次/天足够，不做扣减）
    → 免费：查今日用量
      → 未满 5 次 → 扣减 → 调用 AI
      → 已满 5 次 → 返回提示：「今日额度用完，10积分换1次，或 ¥20 开通会员无限畅练」
```

### 4.2 数据模型

```prisma
model AiUsageDaily {
  id       String   @id @default(cuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date     DateTime @db.Date

  feedback    Int  @default(0)
  dialogue    Int  @default(0)
  summary     Int  @default(0)

  @@unique([userId, date])
  @@map("ai_usage_daily")
}
```

### 4.3 配额配置

| | 纠错 | 对话判定 | 汇总分析 |
|---|:--:|:--:|:--:|
| 免费 | 5/天 | 5/天 | 1/天 |
| 会员 | ∞ (不检查) | ∞ | ∞ |

### 4.4 新增后端文件

```
apps/backend/src/common/ai-quota/
├── ai-quota.module.ts        # 全局模块
├── ai-quota.service.ts       # checkAndDeduct() + exchangeByPoints()
└── ai-quota.controller.ts    # GET /ai-quota/status  POST /ai-quota/exchange
```

> 仅在免费用户的端点前做检查。会员不写入 `AiUsageDaily`，减少 DB 开销。

---

## 五、积分系统

### 5.1 定位

积分的本质是**留存工具**，不是折扣工具。

```
签到 → 攒积分 → 到期没积分 → 充会员
                       ↓ 有积分
                   换一次 AI 纠错 → 上头 → 明天还来签到
                                          ↓ 养成习惯
                                        充会员
```

### 5.2 积分来源

| 行为 | 积分 |
|------|:--:|
| 每日签到 | 10 分 |
| 连续签到加成 | +1/天（第2天+1, 第3天+2, ..., 封顶+5） |
| 邀请好友注册 | +100 分 |
| 被邀请注册 | +50 分 |
| 成就解锁 | 不定 |

### 5.3 积分消耗

| 兑换 | 消耗 |
|------|:--:|
| +1 次 AI 纠错 | 10 积分 |

### 5.4 积分设计原则

- ❌ 不兑换会员（¥20 太便宜，积分不可能跟钱等价）
- ❌ 不兑换优惠券（已废弃整个优惠券系统）
- ❌ 不上排行榜（用户量不够时没意义，等 500+ 月活再考虑）
- ✅ 只换 AI 次数（培养使用习惯，促进付费转化）

---

## 六、邀请码

### 改动

| 角色 | 改前 | 改后 |
|------|------|------|
| 邀请人 | +7 天会员 + 100 积分 | **+5 天会员 + 100 积分** |
| 被邀请人 | +50 积分 | **+50 积分**（不变） |

> 只给邀请人会员天数，被邀请人获得 50 积分用于体验 AI 纠错，形成「试用→上瘾→付费」路径。
> 奖励天数可通过后台 `invite_trial_days` 动态调整（默认 5 天）。

仅修改 `referral.service.ts` 中的 `applyReferral()`：

```typescript
const config = await this.prisma.systemConfig.findUnique({ where: { key: 'invite_trial_days' } });
const trialDays = parseInt(config?.value || '5', 10);
await this.grantTrialDays(referrerCode.userId, trialDays);
await this.grantPoints(referrerCode.userId, 100, 'invite_reward', '邀请好友奖励');
await this.grantPoints(referredUserId, 50, 'invited_bonus', '通过邀请码注册');
```

---

## 七、前 100 名注册免费试用

### 规则

- 前 100 名注册用户自动获得 **5 天免费会员**
- 通过 `promo_trial_days` 配置控制试用天数（默认 5）
- 通过 `promo_trial_max_claims` 配置控制名额上限（默认 100）
- 通过 `promo_trial_claimed_count` 跟踪已领取人数
- 注册后前端调用 `POST /auth/promo-trial` 领取

### 实现

```typescript
// auth.controller.ts — claimPromoTrial()
const maxClaims = parseInt(
  (await this.prisma.systemConfig.findUnique({ where: { key: 'promo_trial_max_claims' } }))?.value || '100',
  10
);
const claimedCount = parseInt(
  (await this.prisma.systemConfig.findUnique({ where: { key: 'promo_trial_claimed_count' } }))?.value || '0',
  10
);

if (claimedCount >= maxClaims) {
  return { granted: false, message: '试用名额已满，欢迎直接开通会员' };
}

// ... grant trial days ...

// 递增已领取计数
await this.prisma.systemConfig.update({
  where: { key: 'promo_trial_claimed_count' },
  data: { value: String(claimedCount + 1) },
});
```

---

## 八、学习计划内容分级

| 会员 | 可用单元 |
|------|---------|
| 🆓 免费 | **寝室入住** 等基础场景（2-3 个单元） |
| ⭐ 会员 | **全部单元** |

实现：`LearningService` 查询时加 `userMembership` 过滤。

---

## 九、已废弃

| 系统 | 原因 |
|------|------|
| 优惠券 (Coupon) | ¥20 定价太低，优惠券无意义；积分兑换替代促活功能 |
| 进阶会员 (advanced) | 精简为免费+会员两档 |
| 排行榜 | 用户量不足时无社交效应，等 500+ 月活再上 |

---

## 十、实施步骤

| # | 内容 | 估时 |
|:--:|------|:--:|
| 1 | Prisma 新增 `AiUsageDaily` → migrate + generate | ✅ 已完成 |
| 2 | 创建 `AiQuotaService` + `AiQuotaModule` + Controller | ✅ 已完成 |
| 3 | `EnglishPracticeAiController` + `PracticeAiController` 加配额检查 | ✅ 已完成 |
| 4 | 邀请奖励：7→5天 + 积分发放 | ✅ 已完成 |
| 5 | `LearningService` 加会员过滤 | ✅ 已完成 |
| 6 | 定价更新：¥15→¥20/月，¥108→¥199/年 | 🔧 本次更新 |
| 7 | 前 100 名注册免费 5 天试用 | 🔧 本次新增 |
| 8 | 硬编码价格改为动态读取 | 🔧 本次修复 |

---

## 十一、DeepSeek 成本参考

| 端点 | 单次成本 |
|------|:--:|
| 纠错 feedback | ¥0.0042 |
| 对话判定 | ¥0.0014 |
| 汇总分析 | ¥0.0060 |

> DeepSeek 定价：输入 ¥1/百万tokens、输出 ¥2/百万tokens。  
> 比 GPT-4o 便宜 20 倍，比 Claude 便宜 30 倍。
