# 阅读/写作包 AI 评估对齐 VN 练习模式 — 实施计划

> 状态：草稿 | 日期：2026-08-06
>
> 目标：将阅读包和写作包的 AI 反馈从"每题独立调 AI"改为"每次练习完成 → 一条 Session 记录 → 一份独立综合评估"，对齐 VN 对话练习的 `PracticeSession → analyze → PracticeAnalysisPanel` 模式。同时补齐离线草稿同步。

---

## 一、核心设计原则

### 每次练习完成 = 一条独立的 Session 记录 = 一份独立的综合评估

- 用户对同一个阅读/写作 topic 可以**多次重做**，每次重做产生一条新的 `TopicSession`
- 每条 `TopicSession` 都有自己独立的 `analysisResult`（综合评估），**不覆盖、不丢失**
- 用户可以回看历史练习记录（`GET .../sessions?topicId=xxx`），每条记录都有当时的完整评估（分数、逐题分析、改进建议）
- 这与 VN 练习完全对齐：每次对话结束都有一条独立的 `PracticeSession`，每条 session 都有自己独立的分析

```
用户第 1 次完成阅读 topic A
  → TopicSession #1 { answers, analysisResult_v1, score_v1, completedAt }

用户第 2 次重做阅读 topic A
  → TopicSession #2 { answers, analysisResult_v2, score_v2, completedAt }

用户第 3 次重做阅读 topic A
  → TopicSession #3 { answers, analysisResult_v3, score_v3, completedAt }
```

**当前问题**：
- `TrainingTopicSubmission` 有 `revision` 字段，但 `feedback` 每次覆盖最新一条——无法区分"第 1 次完成"和"第 2 次完成"
- `reviewTopicSubmission` 是**逐条答案调 AI**，不是"所有答案答完后一次性评估"
- 没有独立的 Session 概念，历史记录无法追溯

---

## 二、背景对照

### VN 练习的正确模式（reference）

```
用户对话（每轮即时判定 judgeDialogueTurn）
     ↓
全部完成 → POST /practice-ai/sessions/:sessionId/analyze
     ↓
summarizePracticeSession() → 一次性 AI 综合评估
     ↓
存储 PracticeSession.analysisResult / analysisRaw（每条 session 独立）
     ↓
前端 PracticeAnalysisPanel 展示当前 session 的统一评估页
     ↓
用户可回看历史 session 列表，每条都有独立分析
```

特征：
- **参考答案**：NPC 文本 + objectives + chunks 在 topicSnapshot 中
- **每题不调完整 AI**，仅轻量即时判定（正误/引导）
- **最终一个入口**把所有轮次 + 上下文一次性发给 AI
- **每次完成产生一条独立 session**，每条 session 有独立的 analysisResult

### 阅读/写作当前实现（问题矩阵）

| 维度 | 当前 | 应有 |
|------|------|------|
| 参考答案 | 已在 `contentConfig` 后端存储（`correctAnswer`/`acceptedAnswers`/`evidence`），`sanitizeTopicContentConfig` 过滤不发给前端 | ✅ 数据层已就绪 |
| 提交答案 | `saveTopicSubmission` 在线直调 → `TrainingTopicSubmission.response` | 需离线草稿队列 |
| AI 评估入口 | `reviewTopicSubmission` — **每次提交都调 AI**，逐条生成完整 feedback | 全部答完后一次性调综合评估 |
| AI 评估内容 | `generateFeedback()` 每调用一次返回 `{ score, summary, strengths, improvements, evidence, nextRevisionFocus }` | 综合所有答案 + 参考答案 + 题干，生成统一复盘 |
| 评估记录独立性 | `feedback` 每次提交覆盖，无法区分"第 1 次完成"和"第 2 次完成" | 每次完成 = 一条独立 `TopicSession`，各自存储 `analysisResult` |
| 前端评估页 | 每题答完后内联展示 feedback | 独立评估页，参考答案对比 + AI 综合反馈，支持回看历史 |
| 离线草稿 | ❌ 无（断网连草稿都存不了） | 应走 outbox 入队，联网后同步 |

---

## 三、数据模型层

### 2.1 现有模型调整

**`TrainingTopicSubmission`** — 保留用于存储 session 内的答案草稿/提交。需要以下变更：

1. **新增 `sessionId` 外键**：关联 `TopicSession`，明确"这次答案属于哪次完成"
2. **修改唯一约束**：从 `@@unique([userId, topicId, revision])` 改为 `@@unique([userId, sessionId, revision])`——同一 session 内按 revision 区分，不同 session 互不干扰
3. **移除 `feedback` 字段**：旧链路产物，新链路分析全部走 `TopicSession.analysisResult`。App 未发布，无需兼容，直接删除

### 2.2 新增模型：`TopicSession`（或复用现有模式）

**方案 A（推荐）：新增轻量 `TopicSession`**

```prisma
model TopicSession {
  id           String    @id @default(cuid())
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String
  topic        TrainingTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)
  topicId      String
  sceneId      String
  status       String    @default("active")  // active | completed | analyzed
  startedAt    DateTime  @default(now())
  completedAt  DateTime?
  analyzedAt   DateTime?
  // 评估结果
  analysisResult Json?
  analysisRaw    String?  @db.Text
  analysisError  String?  @db.Text
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  submissions  TrainingTopicSubmission[]

  @@index([userId, topicId])
  @@index([userId, createdAt(sort: Desc)])
  @@map("topic_session")
}

// TrainingTopic 需新增反向关系（与 practiceSessions 并列）：
// model TrainingTopic {
//   ...existing fields...
//   sessions      TopicSession[]              // 新增
// }
}
```

### Session 与完成记录的关系

```
TopicSession（每次练习完成 = 1 条记录）   TrainingTopicSubmission（该 session 内的答案）
┌──────────────────────────────┐       ┌──────────────────────────────┐
│ id                           │ 1   N │ id                           │
│ userId                       │←──────│ userId                       │
│ topicId                      │       │ topicId                      │
│ sceneId                      │       │ sessionId  ← 归属某次完成     │
│ status: active/completed     │       │ revision                     │
│   /analyzed                  │       │ response: JSON（答案）        │
│ analysisResult ← 本次综合评估│       │ createdAt                    │
│ analysisRaw                  │       └──────────────────────────────┘
│ startedAt                    │
│ completedAt                  │
│ analyzedAt                   │
└──────────────────────────────┘
```

- **一个用户对同一个 topic 可以有多条 `TopicSession`**——允许多次重做，历史不丢失
- **每条 `TopicSession` 拥有独立的 `analysisResult`**——第 1 次和第 2 次的评估各自独立
- `TrainingTopicSubmission` 通过 `sessionId` 关联到具体那次完成，而非全局 topic
- 与 `PracticeSession` 设计完全对齐：每次对话练习也是一条独立 session + 独立 analysis

### Session 交互契约

```
用户进入阅读/写作话题
  ├─ 有历史 session？→ 展示"历史记录"列表（只读，每条可见当时的分数和分析）
  └─ 点击"开始练习" → 创建全新 TopicSession，空白答题区
       │
       ├─ 中途退出 → session 保留为 active，下次恢复继续答
       │
       └─ 全部答完 → 提交评估 → session 标记 completed → analyze → analyzed
            │
            └─ 分析完成后 session 变为只读历史记录
                 └─ 用户再次进入该话题 → 看到新的"开始练习"按钮 + 历史列表
```

关键规则：
- **每次点击"开始练习"都是新 session**，不会覆盖或续写以前的 session
- **已完成的 session 是只读的练习记录**，不可重新作答（要重做就开新 session）
- **只有一个 active session** 可以在中途恢复（`getLatestSession`），完成后不能再恢复
- 这与 VN `PracticeSession` 完全一致：每次对话结束就存为历史，下次打开场景就是新对话

**不推荐方案 B**：复用 `TrainingTopicSubmission` 加 `analysisResult` 字段。无法表达"多次完成"的独立性，也无法区分"这次正在做的"和"上次已经完成的"。

### 2.3 同步相关（outbox + pull）

在 `SyncEntityType` 新增：
- `topic_session` — 用户完成一次阅读/写作练习时入队（含最终答案和分析），联网后 push
- `topic_submission` — **仅"提交评估"时一次性入队**，不用于答题过程中的逐条草稿同步

在 `SyncService.pull()` 的 changed 中新增：
- `topicSessions` — 拉取远端已分析完成的 session（含 `analysisResult` 和关联的 `submissions`）

### 2.4 三个关键设计决策（App 未发布，直接执行，无需兼容）

**① `TrainingTopicSubmission.revision` 唯一约束调整**

当前：`@@unique([userId, topicId, revision])`——revision 在全局 topic 范围内自增，多个 session 共享编号空间，会冲突。
改为：`@@unique([userId, sessionId, revision])`——revision 的作用域缩小到一次 session 内。`sessionId` 本身就是版本边界，revision 仅用于同一 session 内的多次草稿修订。实际上大多数情况下一次 session 只有一条 submission（`revision=1`）。

**② `TrainingTopicSubmission.feedback` 字段删除**

当前 `feedback` 是旧 `reviewTopicSubmission` 逐条 AI 调用写入的。新链路分析全部走 `TopicSession.analysisResult`——session 级存储，与 submission 脱钩。App 未发布，直接删字段，不保留 deprecated 路径。

**③ 离线草稿策略：本地暂存，全部提交后才同步**

阅读/写作的答案草稿**不进入 outbox 逐条同步**。策略：
- 答题过程中：答案仅保存在本地 SQLite `topic_submissions` store（纯本地，不触发 sync）
- 用户点"提交评估"时：一次性将完整答案 push 到服务端（`saveTopicSubmission` + `completeTopicSession`），此时答案才进入服务端 `TrainingTopicSubmission` 表
- 如果断网：答案留在本地，用户下次打开时恢复草稿继续答，联网后再提交

这与 warmup 的逐题同步不同——阅读/写作是"全部答完才有意义"的场景，部分答案没有独立价值。
离线包不再携带 `latestSubmission`，改为从本地 SQLite 的最新 `topic_session` + 关联 `topic_submissions` 中恢复上次答案。

---

## 四、后端改动

### 4.1 ContentExperienceService 改造

**删除或废弃** `reviewLatestSubmission()` 中的逐条 AI 调用。

**新增方法**：

```typescript
// POST /learning/experiences/topics/:topicId/sessions/start
async startTopicSession(userId: string, topicId: string): Promise<TopicSession>

// POST /learning/experiences/topics/:topicId/sessions/:sessionId/complete
async completeTopicSession(userId: string, sessionId: string): Promise<TopicSession>

// POST /learning/experiences/topics/:topicId/sessions/:sessionId/analyze
async analyzeTopicSession(userId: string, sessionId: string): Promise<{ analysis, raw }>
```

**`analyzeTopicSession` 核心逻辑**（对齐 `summarizePracticeSession`）：

1. 取出该 session 关联的所有 `TrainingTopicSubmission`（仅本次 session 的答案，不是该 topic 的全部历史）
2. 从 `TrainingTopic.contentConfig` 取出参考答案（`correctAnswer`/`acceptedAnswers`/`evidence`）
3. 构建分析 prompt，包含：
   - 题干（`questionMarkdown` 或 `promptEn/promptZh`）
   - 每道题的题目 + **本次**用户答案 + 参考答案 + 证据
   - 题目类型（choice/short_answer/boolean）
4. 调用 LLM（`LlmProviderFactory`），temperature 0.3-0.45，maxOutputTokens 2000-2800
5. 返回结构化分析结果，存入**该 session 的** `analysisResult`（仅影响本次完成，不影响历史 session）
6. 更新 session status → `analyzed`，记录 `analyzedAt`

**分析结果结构**（对齐 VN `DialogueAnalysisResult`）：

```typescript
interface TopicAnalysisResult {
  overallScore?: number           // 0-100
  summary?: string                // 中文总结
  questionByQuestion?: Array<{
    index: number
    prompt: string
    userAnswer: string
    referenceAnswer: string       // 参考答案
    isCorrect: boolean
    comment?: string              // 逐题点评
    evidence?: string             // 从原文来的证据
  }>
  strengths?: string[]
  improvements?: string[]
  nextStepSuggestion?: string
}
```

对于**写作包**，评估结构简化（先不做多维度拆分）：

```typescript
interface WritingAnalysisResult {
  overallScore?: number          // 0-100
  summary?: string               // 中文总结
  strengths?: string[]
  improvements?: string[]        // 具体改进点，带证据引用
  upgradedVersion?: string       // AI 升级改写全文（可选，类似 VN upgradedAnswer）
  nextStepSuggestion?: string
}
```

写作 AI prompt 核心指令：
- 评估任务完成度（是否覆盖写作要求中的要点）
- 指出 2-4 个具体改进点，引用原文证据
- （可选）生成一个升级改写版本供对比学习

不拆多维度分数——先做总分 + 改进列表，后续按需求再加维度。

### 4.2 AI 额度扣减

阅读/写作的最终评估属于**一次性综合调用**，应在 `AiQuotaService` 中作为 `summary` 类型扣减（与 VN analyze 一致），**不再每题扣一次**。

### 4.3 Controller 路由

```
POST   /learning/experiences/topics/:topicId/sessions/start      → startTopicSession（开始新一轮练习）
POST   /learning/experiences/topics/:topicId/sessions/:id/complete → completeTopicSession
POST   /learning/experiences/topics/:topicId/sessions/:id/analyze  → analyzeTopicSession（生成本次综合评估）
GET    /learning/experiences/topics/:topicId/sessions              → listTopicSessions（回看历史完成记录）
GET    /learning/experiences/topics/:topicId/sessions/latest       → getLatestSession（恢复上次未完成的）

POST   /learning/experiences/topics/:topicId/submissions          → saveTopicSubmission（保留，仅存答案）
```

### 4.4 SyncService 扩展

在 `pushItem()` 中新增：
- `entityType === 'topic_submission'` + `operation === 'create'` → 写入 `TrainingTopicSubmission`（仅"提交评估"时触发）
- `entityType === 'topic_session'` + `operation === 'create'` → 写入 `TopicSession` + 关联 submissions
- `entityType === 'topic_session'` + `operation === 'complete'` → 标记完成，触发分析

在 `pull()` 的 `changed` 中新增：
- `topicSessions: TopicSession[]`（仅 `status === 'analyzed'` 的，含 `analysisResult` 和关联的 `submissions`）

在 `applyUserPullChanges()` 中新增 `topicSessions` 写入逻辑：
- 每条 session 写入本地 SQLite `topic_sessions` store（id = `session:{remoteId}`）
- 关联的 submissions 写入 `topic_submissions` store
- 已有的本地记录按 `remoteId` 去重更新，不重复插入

---

## 五、前端改动

### 5.1 阅读页（`reading-session-page.tsx`）

**改造后流程**：
```
进入话题页
  ├─ 有历史 session？→ 展示"历史记录"入口（只读）
  └─ 点击"开始练习" → startTopicSession（全新 session，空白答题区）
       │
       ├─ 上次有未完成的 active session？→ getLatestSession 恢复继续答
       │
       ├─ 每次答案变更：写入本地 SQLite + 入 outbox
       │
       ├─ 全部答完 → 点击"提交评估"
       │     → completeTopicSession + analyzeTopicSession（在线）
       │     → 渲染评估页（本次结果）
       │
       └─ 用户在话题页点"历史记录"
             → GET .../sessions → 按时间倒序列出已完成 session
             → 点击某条 → 进入只读分析详情（当时分数+逐题对比）
```

关键改动：
1. **"开始练习"创建新 session**，不覆盖历史。若存在未完成的 active session（`getLatestSession` 返回 `status='active'`），自动恢复继续答；若无或已完成，创建新 session
2. 答案变更时：仅写入本地 SQLite `topic_submissions` store（**不入 outbox**，纯本地草稿）。阅读答案是单个 `{ answers }` 对象
3. 点击"提交评估"时：
   - 将完整答案一次性 push 到服务端（`saveTopicSubmission`）
   - 然后 `completeTopicSession` → `analyzeTopicSession`（带 loading overlay）
   - 至此答案才从本地草稿变为服务端记录
4. 断网时：答案留在本地 SQLite，下次打开恢复草稿；联网后再提交
5. 评估页展示：总分圆环 + 逐题对错 + 参考答案对比 + AI 点评 + 原文证据
6. 话题页增加"历史记录"入口 → 列出该 topic 的所有已完成 session（按时间倒序）→ 点击可回看任何一次的分析（只读）

### 5.2 写作页（`writing-session-page.tsx`）

同上结构，区别：
- 写作通常就一篇文章，但仍需显式的"提交评估"按钮
- 草稿自动保存到本地 SQLite（不出 outbox，纯本地）
- 同样支持历史记录：每次提交都是一条新 session

### 5.3 评估页面 & 历史记录

**练习记录统一展示位置**：移动端 `learning-plan-page.tsx` 的 `recordsOpen` Drawer（第 120-129 行）和 `today-task-page.tsx` 的 `TodayRecordsDrawer`。阅读和写作的 session 记录应**同样接入这个统一 Drawer**，与已有的对话练习/今日任务记录并列。每条 session 显示：
- 时间、话题名称、分数（颜色分档）
- 点击进入该 session 的只读分析详情

组件设计：

复用或参考 `PracticeAnalysisPanel` 的设计模式：

- **`ReadingAnalysisPanel`** — 当前 session 的阅读评估
  - 总分圆环（颜色分档：绿 ≥80 / 黄 ≥60 / 红 <60）
  - 逐题：正确/错误 + 用户作答 + 参考答案 + AI 点评 + 原文证据引用
  - 总结：strengths + improvements + nextStepSuggestion
- **`WritingAnalysisPanel`** — 当前 session 的写作评估
  - 总分圆环 + 分维度评分条
  - 逐段/逐句证据点评
  - 升级改写建议（类似 VN `upgradedAnswer`）
- **`SessionHistoryList`** — 通用组件
  - 按时间倒序列出该 topic 的已完成 session
  - 每项显示：完成时间、分数、简要摘要
  - 点击进入该 session 的历史分析详情（只读模式）

### 5.4 离线同步

在 `sync-outbox.ts` 的 `SyncEntityType` 中新增：
```typescript
| 'topic_session'
| 'topic_submission'    // 仅"提交评估"时入队，非逐题草稿
```

在 `offline-sync.service.ts` 的 `replayItem()` 中新增对应 handler。

本地 SQLite stores（`unified-storage.ts` 表注册）：
- `topic_sessions` — 离线完成记录 + 分析结果，syncStatus 跟踪
- `topic_submissions` — 本地草稿（答题过程中纯本地存储，提交时才入 outbox）

**离线草稿流程**：
```
答题中: 答案 → 本地 SQLite (不入 outbox)
点提交: 本地答案 → saveTopicSubmission API → 然后 complete → analyze
断网时: 答案留在本地 SQLite，下次打开恢复
联网后: 重试提交 → complete → analyze
```

**`latestSubmission` 不再从离线包快照取**。`learning.repository.ts` 中 `detail.topic?.latestSubmission` 改为从本地 SQLite 恢复——本地数据由 pull 同步或本地草稿提供，不会像打包快照一样过期。

---

## 六、数据库迁移

```bash
cd apps/backend
pnpm prisma:migrate --name add_topic_session
pnpm prisma:generate
```

迁移内容：
1. 创建 `topic_session` 表（含 `analysisResult`/`analysisRaw`/`analysisError`）
2. `TrainingTopic` 新增 `sessions TopicSession[]` 反向关系
3. `TrainingTopicSubmission`：
   - 新增 `sessionId` 外键（可选，关联 `TopicSession`）
   - 新增 `session TopicSession?` relation
   - 删除 `feedback` 字段
   - 唯一约束从 `@@unique([userId, topicId, revision])` 改为 `@@unique([userId, sessionId, revision])`
4. Prisma Client 重新生成后，检查所有 `.feedback` 引用已移除（步骤 1 已完成清理）

### Schema 最终关系

```
TrainingTopic                         TopicSession（每次完成 = 1 条）
├─ practiceSessions[]                 ├─ analysisResult（本次综合评估）
├─ submissions[]                      ├─ submissions[] → TrainingTopicSubmission
└─ sessions[]  ← 新增                  │    ├─ response: JSON
                                       │    ├─ revision（session 内自增）
     TopicSession 1 ──── N             │    └─ sessionId
          TrainingTopicSubmission      └─ status: analyzed
```

---

## 七、实施顺序

| 步骤 | 范围 | 预估工作 | 说明 |
|------|------|--------|------|
| 1. 旧代码清理 | 移除 `reviewLatestSubmission` + `generateFeedback` 中对 `feedback` 字段的写入 | 小 | **必须先做**：否则 Schema 删 `feedback` 后编译失败 |
| 2. Prisma Schema | 新增 `TopicSession` + `TrainingTopic.sessions[]` 反向关系 + 删 `feedback` + 改唯一约束 + 迁移 | 小 | 每次练习完成 = 一条 session |
| 3. 后端 Session CRUD | `start / complete / list / latest` | 小 | 基础生命周期 |
| 4. 后端 analyze | `analyzeTopicSession`（阅读+写作两套 prompt） | 中 | 核心：每次完成生成独立评估 |
| 5. 后端 Sync 扩展 | push/pull 新增 `topic_session` + `topic_submission`，pull 的 `applyUserPullChanges` 新增写入逻辑 | 中 | 离线完成记录同步 |
| 6. 前端 Session 流 | 阅读/写作页接入 start → complete → analyze 生命周期 | 中 | 每次答题都走 session |
| 7. 前端评估页 | `ReadingAnalysisPanel` + `WritingAnalysisPanel` | 中 | 展示本次 session 的分析 |
| 8. 前端历史记录 | `SessionHistoryList` + 话题页入口 | 小 | 回看历次完成的评估 |
| 9. 前端离线同步 | outbox 入队（仅最终提交）+ replay handler + 本地 SQLite 草稿存储 | 中 | 答题过程纯本地，提交时一次性同步 |
| 10. 测试验收 | 在线 + 离线 + 断网恢复 + 历史记录完整性 | 中 | 端到端验证 |

---

## 八、待确认事项

1. **阅读包题目字段**：后台阅读话题编辑 Dialog（`topic-experience-fields.tsx` 的 `ReadingFields`，第 384-484 行）当前已有 `type`/`prompt`/`options`/`answer`/`evidence`。需新增 `acceptedAnswers: string[]`（可接受的替代答案，用于 AI 评估时的容错）。`answer` 字段即参考答案，已存在无需改动。后台改动范围小，加一个数组输入框即可。
2. ~~**写作包评估维度**~~ → 已确定：先做总分 + 改进列表，不拆多维度
3. ~~**离线策略**~~ → 已确定：答题过程纯本地存储，提交时一次性同步
4. ~~**TopicSession 粒度**：允许多次重做~~ → 已确定：允许多次重做，每条独立保留
