# 沉浸式英语输出训练 App — 需求文档 V3

> 版本：V3.0 — 实测盘点版  
> 日期：2026-05-27  
> 说明：基于 V2 PRD 和实际代码盘点生成的「当前状态 + 剩余工作」文档

---

## 目录

1. [一句话状态](#1-一句话状态)
2. [MVP 功能实现清单](#2-mvp-功能实现清单)
3. [内容规模盘点](#3-内容规模盘点)
4. [已实现 vs 待实现的完整清单](#4-已实现-vs-待实现的完整清单)
5. [五大优先级任务](#5-五大优先级任务)
6. [后续阶段规划](#6-后续阶段规划)

---

## 1. 一句话状态

> **MVP 核心功能已全部可用，但内容量仅为目标的 10%~30%，补内容是第一优先级。**

| 指标 | 数值 |
|------|------|
| 后端模块 | 28 个，全部实现 |
| 前端页面 | 24 个功能域，全部实现 |
| 剧本关卡 | 3 关 (Chapter 0)，目标 5~10 关 |
| Chunk 数 | 43 个，目标 300~600 个 |
| 词汇数 | 80 个，目标 300~500 个 |
| 训练话题 | 34 个，目标 30~50 个 ✅ |
| 成就 | 13 个，满足 MVP |

---

## 2. MVP 功能实现清单

### 2.1 对照 PRD V2 第 21.1 节「MVP 必须做」

| MVP 要求 | 当前状态 | 验证方式 |
|----------|---------|---------|
| **新手流程** (目标选择+能力自选) | ✅ **已完成** | `/onboarding/goals` + `/onboarding/ability` 前后端均已实现 |
| **练习模式** (话题/Chunk/录音/纠错/升级/复述) | ✅ **已完成** | `PracticeHubPage` → `PracticeSessionPage` 完整闭环 |
| **表达库** (保存错句/Chunk/升级表达) | ✅ **已完成** | `ExpressionLibraryPage` + CRUD API |
| **简单等级** (输出等级 L1-L5 + 用户等级 XP) | ✅ **已完成** | `Level` 模块 + `GrowthPage` 展示页 |
| **剧本体验** (Chapter 0 关卡) | ✅ **已完成** | 3 个体验关 (宿舍大厅/咖啡店/室友见面) |
| **场景准备度** | ✅ **已完成** | 剧本卡片上展示词汇/Chunk 要求 |

### 2.2 超出 MVP 范围的已实现功能

| 功能 | 说明 | 实际水平 |
|------|------|---------|
| **VN 引擎** (inkjs + PIXI.js) | 剧本和探索共用 VN 渲染层 | Phase 5 级别 |
| **探索模式** (地图→地点→NPC) | 1 张地图 + 3 个地点 + 3 个 NPC | Phase 4 级别 |
| **成就系统 V2** (事件驱动+稀有度+隐藏成就) | `AchievementEngineService` + `AchievementHallPage` | 完整实现 |
| **学习计划** (教材→学习单元→今日任务) | `LearningPlanPage` + `LearningUnitPage` + `TodayTaskPage` | 完整实现 |
| **管理员后台 8 新页面** | 场景/Chunk/剧本/角色/地图/成就/故事/NQTR | 完整实现 |
| **PIXI.js 渲染** | `PixiVnStage` 背景+立绘渲染 | 已集成可切换 |

---

## 3. 内容规模盘点

### 3.1 逐项对比

| 内容项 | MVP 要求 | 当前 | 缺口 | 缺口率 |
|--------|:--------:|:----:|:----:|:------:|
| 场景分类 | 6~8 | **5** | -1~3 | 17%~38% |
| 场景 | 6~8 | **8** | ✅ | 0% |
| 场景词汇 | 300~500 | **80** | -220~420 | **73%~84%** |
| 核心 Chunk | 300~600 | **43** | **-257~557** | **86%~93%** |
| 训练话题 | 30~50 | **34** | ✅ | 0%~32% |
| 剧本关卡 | 5~10 | **3** | -2~7 | 40%~70% |
| NPC | 3~5 | **3** | ✅ | 0% |
| 探索地图 | 1+ | **1** | ✅ | 0% |

### 3.2 详细种子数据清单

| 场景 | 词汇 | Chunk | 话题 | 剧本关卡 |
|------|:----:|:-----:|:----:|:--------:|
| 宿舍入住 | 10 | 7 | 6 | Chapter 0-1 |
| 机场入境 | 10 | 4 | 4 | — |
| 认识室友 | 10 | 5 | 5 | Chapter 0-3 |
| 咖啡店点餐 | 10 | 5 | 5 | Chapter 0-2 |
| 超市购物 | 10 | 4 | 4 | — |
| 打车出行 | 10 | 3 | 4 | — |
| 面试自我介绍 | 10 | 3 | 3 | — |
| 小组讨论 | 10 | 4 | 3 | — |
| 通用日常 | — | 8 | — | — |
| **总计** | **80** | **43** | **34** | **3** |

### 3.3 成就数据

当前 13 个成就定义，覆盖：
- `first_time` (3)：初次开口/初出茅庐/过目不忘
- `milestone` (4)：开口十次/话筒常客/表达学徒/表达达人
- `streak` (2)：七日之约/铁嘴铜牙
- `mastery` (1)：能说完整 (L3)
- `challenge` (2)：初来乍到/一遍过
- `hidden` (1)：彬彬有礼

---

## 4. 已实现 vs 待实现的完整清单

### 4.1 ✅ 功能 —— 已实现

| 模块 | 后端 | 前端 | 种子数据 |
|------|:----:|:----:|:--------:|
| 场景管理 | ✅ Scene/SceneCategory CRUD | — | ✅ 8 场景 |
| Chunk 管理 | ✅ CHUNK CRUD + 掌握度状态机 | — | ✅ 43 Chunk |
| 训练话题 | ✅ TrainingTopic CRUD | ✅ PracticeHubPage | ✅ 34 话题 |
| 练习会话 | ✅ EnglishPracticeController | ✅ PracticeSessionPage | — |
| AI 纠错 | ✅ EnglishPracticeAiController (SSE) | ✅ 流式展示 | — |
| 表达库 | ✅ Expression CRUD + 简单复习 | ✅ ExpressionLibraryPage | — |
| 剧本关卡 | ✅ Script CRUD + ScriptJudgeService | ✅ ScriptHubPage + ScriptPlayPage | ✅ 3 关 |
| 探索模式 | ✅ Exploration (地图/角色/存档) | ✅ ExploreMapPage + ExploreLocationPage | ✅ 1 地图+3 地点 |
| VN 引擎 | — | ✅ VnPlayer + InkEngine + PIXI.js | ✅ Ink 脚本 |
| 等级系统 | ✅ Level (XP/输出等级/准备度) | ✅ GrowthPage | — |
| 成就系统 | ✅ AchievementDef + 事件引擎 | ✅ AchievementHallPage | ✅ 13 成就 |
| 新手引导 | ✅ Onboarding (目标+能力+诊断) | ✅ GoalsSelectionPage + AbilitySelectionPage | — |
| 学习计划 | ✅ Learning | ✅ LearningPlanPage + LearningUnitPage + TodayTaskPage | — |
| 管理员后台 | — | ✅ 16 子页面 | — |
| 认证/支付 | ✅ Auth/Membership/Pay | ✅ 登录/会员 | — |

### 4.2 ❌ 缺口 —— 需要补充

#### P0 — 功能缺失

| # | 缺失项 | 说明 | 工作量估算 |
|---|--------|------|-----------|
| 1 | **口语诊断前端页面** | 后端 `POST /onboarding/diagnostic/result` API 已实现，但前端**没有** `/onboarding/diagnostic` 路由和页面。用户无法完成 2 分钟口语诊断步骤 | ~3 天 |
| 2 | **间隔复习算法优化** | 当前 `expression.service.ts` 使用简单算法 `interval = reviewCount + 1 (天)`，可替换为 **SM-2 算法** 提高复习效率 | ~2 天 |

#### P1 — 内容严重不足

| # | 内容 | 当前 | 目标 | 需补充 |
|---|------|:----:|:----:|:------:|
| 1 | **Chunk 表达块** | **43** | 300~600 | **+257~+557** |
| 2 | **场景词汇** | **80** | 300~500 | **+220~+420** |
| 3 | **剧本关卡** | **3** | 5~10 | **+2~+7** |
| 4 | **场景分类** | **5** | 6~8 | **+1~+3** |

#### P2 — 系统优化

| # | 优化项 | 当前状态 | 建议 |
|---|--------|---------|------|
| 1 | **Ink 脚本质量** | Chapter 0 的 Ink 脚本为简单线性对话，无分支/无 AI 判断注入 | 改为真实分支剧情脚本 |
| 2 | **AI Prompt 效果** | Prompt 已结构化但未经过大规模测试 | 建立 Prompt 测试用例集 |
| 3 | **种子数据注释不准确** | 顶部写 "60+ 个 Chunk" 但实际只有 43 | 修正注释 |

#### P3 — 清理/重构

| # | 事项 | 说明 |
|---|------|------|
| 1 | **旧表清理** | `QuestionBank`/`QuestionItem`/`MockPaper` 加 `_deprecated` 后缀 |
| 2 | **PIXI.js 全量迁移** | 当前同时支持 PIXI 和 CSS fallback |

---

## 5. 五大优先级任务

按投入产出比排序：

### 🥇 P1 — 补充 Chunk 和词汇内容

**为什么最重要：** 练习模式和剧本模式的核心体验直接取决于 Chunk 和词汇量。43 个 Chunk 覆盖 8 个场景平均每个只有 4~7 个，用户几分钟就练完了。

**目标：**
1. 每个场景至少 30~50 个 Chunk（当前 3~7 个）
2. 每个场景至少 20~30 个词汇（当前 10 个）

**怎么做：**
- 新增内容团队工具：管理员后台 Chunk 批量导入
- 按 PRD Chapter 1~5 的场景列表分批发
- 每条 Chunk 必须含：`text` + `meaning` + `category` + `difficulty` + `example`

### 🥇 P1 — 补充剧本关卡

**为什么重要：** 当前只有 3 个体验关，用户 15 分钟玩完。没有后续关卡留存不住用户。

**建议分批：**

| 批次 | 关卡数 | 内容 | 前置条件 |
|:----:|:------:|------|:--------:|
| 第 1 批 | 5 | Chapter 1 (机场入境→打车→宿舍 Check-in→认识室友→买 SIM卡) | 对应场景 Chunk 达到 20+ |
| 第 2 批 | 5 | Chapter 2 (新生说明会→找教室→课堂认识同学→问作业→图书馆) | Chunk 达到 100+ |
| 第 3 批 | 5 | Chapter 3 (超市购物→银行开户→邮局→报修→预约看病) | Chunk 达到 200+ |

### 🥈 P0 — 补充口语诊断前端

**工作量：** ~3 天  
**具体页面：**
1. `diagnostic-page.tsx` — 选择开始口语诊断
2. `diagnostic-recording-page.tsx`（暂定名）— 录制 3 个问题的回答
3. `diagnostic-result-page.tsx` — 展示诊断报告

前端可复用 `PracticeSessionPage` 的录音 + AI 分析组件。

### 🥉 P2 — 升级间隔复习算法

**工作量：** ~2 天  
将 `expression.service.ts` 的：
```typescript
const intervalDays = (item.reviewCount + 1) * 1;
```
替换为 SM-2 算法：
```typescript
// SM-2: based on quality rating (0-5)
if (quality >= 3) {
  if (reviewCount === 0) interval = 1
  else if (reviewCount === 1) interval = 6
  else interval = Math.round(prevInterval * easinessFactor)
  reviewCount++
} else {
  reviewCount = 0
  interval = 1
}
```

### 🏅 辅助 — 修正种子数据注释

当前 `seed-english.ts` 第 9 行写 "60+ 个 Chunk"，实际 43 个。修正为准确数字。

---

## 6. 后续阶段规划

### 6.1 Stage 1：内容填充（预计 2~4 周）

| 周次 | 工作内容 | 产出 |
|:----:|---------|------|
| 第 1 周 | Chunk 批量导入工具 + 管理员后台批量编辑 | 工具就绪 |
| 第 1~2 周 | 补充 Chunk 至 200+，场景词汇至 200+ | 内容翻倍 |
| 第 2 周 | Chapter 1 首批 5 关 Ink 脚本编写 | 5 个剧本关卡 |
| 第 3 周 | Chapter 1 关卡联调 + AI 判断调优 | 5 关可玩 |
| 第 4 周 | 口语诊断前端页面实现 | 完整新手闭环 |

### 6.2 Stage 2：体验打磨（预计 2 周）

| 工作 | 说明 |
|------|------|
| AI Prompt 调优 | 建立测试用例集，对比纠错/任务判断准确率 |
| 间隔复习 SM-2 | 替换为 SM-2 算法 |
| UI/UX 细节 | 加载状态、空状态、错误处理、动画过渡 |
| 剧本 Ink 脚本升级 | 从线性对话改为分支剧情 |

### 6.3 Stage 3：运营准备（预计 1 周）

| 工作 | 说明 |
|------|------|
| 旧表清理 | 加 `_deprecated` 后缀 |
| 种子数据注释修正 | 同步为准确数字 |
| 技术文档同步 | 更新 `english_output_app_tech_plan.md` |
| 部署检查 | 环境变量、Docker 配置 |

### 6.4 Stage 4：扩展（V1.1+）

| 版本 | 内容 |
|:----:|------|
| V1.1 | PIXI.js 全量迁移、Chapter 2 内容 |
| V1.2 | 探索模式扩展 (更多地点+支线任务) |
| V2.0 | 完整多章节剧情、自由探索 |

---

## 附录 A：当前文件清单

### 后端模块 (28 个)

```
modules/scene/          ✅ 场景管理
modules/chunk/          ✅ Chunk 管理 + 掌握度
modules/script/         ✅ 剧本关卡 + Judge
modules/expression/     ✅ 表达库 + 复习
modules/level/          ✅ 等级系统
modules/learning/       ✅ 学习计划
modules/onboarding/     ✅ 新手引导
modules/exploration/    ✅ 探索模式
modules/practice/       ✅ 练习 (双轨)
modules/practice-ai/    ✅ AI 纠错 (双轨)
modules/achievement/    ✅ V2 成就系统
modules/admin/          ✅ 管理后台
modules/auth/           ✅ 认证
modules/tts/            ✅ TTS + Whisper
modules/file-assets/    ✅ COS 存储
modules/membership/     ✅ 会员
modules/pay/            ✅ 支付
modules/notification/   ✅ 通知
modules/coupon/         ✅ 优惠券
modules/referral/       ✅ 推荐
modules/feedback/       ✅ 反馈
modules/leaderboard/    ✅ 排行榜
modules/profile/        ✅ 个人中心
modules/config-guide/   ⏸️ 休眠
modules/question-bank/  ⏸️ 休眠
modules/resource-library/ ⏸️ 休眠
modules/mock-exam/      ⏸️ 休眠
modules/assets/         ⏸️ 休眠
```

### 前端功能域 (24 个)

```
features/practice/      ✅ 练习模式
features/script/        ✅ 剧本模式
features/explore/       ✅ 探索模式
features/expression/    ✅ 表达库
features/growth/        ✅ 我的成长
features/achievement/   ✅ 成就殿堂
features/learning/      ✅ 学习计划
features/onboarding/    ✅ 新手引导 (缺诊断页)
features/vn-engine/     ✅ VN 引擎
features/question-bank/ ✅ 首页 (EnglishHomePage)
features/admin/         ✅ 管理后台
features/auth/          ✅ 认证
features/membership/    ✅ 会员
features/account/       ✅ 账号
features/profile/       ✅ 个人中心
features/notification/  ✅ 通知
features/feedback/      ✅ 反馈
features/leaderboard/   ✅ 排行榜
features/referral/      ✅ 邀请
features/portal/        ✅ 落地页
features/system/        ✅ 法律条款
features/coupon/        ✅ 优惠券
features/file-assets/   ✅ 文件上传
features/mock-exam/     ⏸️ 休眠
```

---

> **总结：** 当前项目处于 **功能完整但内容不足** 的状态。代码基础设施非常健壮（VN 引擎/PIXI/探索模式/成就系统等远超 MVP 要求），但核心教学内容（Chunk + 词汇 + 剧本关卡）仅达到目标的 10%~30%。建议集中火力补充内容，同时补齐口语诊断页面这个最后的功能缺口。
