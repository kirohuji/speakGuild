# 阅读包与 AI 写作练习包实施方案

> 版本：v1.0  
> 日期：2026-08-03  
> 状态：规划，尚未实施  
> 范围：阅读包、写作包、AI 辅助、后台内容生产、离线与进度；不改造今日任务本身

## 1. 核心结论

阅读与写作不应继续被视为普通学习包里的两个 `TrainingTopic` 变体，而应成为共享学习包基础设施的两种明确内容类型：

```text
packageType=reading  → EPUB 阅读器 → 阅读进度 / 标注 / 包内理解活动
packageType=writing  → 写作任务 → 草稿 / AI 反馈 / 修订 / 定稿
packageType=story    → StoryEpisode → VN / 跟读
```

三者共享 `Scene`、`LearningPackage`、商店、加入学习、zip、manifest、离线安装、资产缓存和通用学习记录，但都不进入今日任务。只有明确声明支持 Warmup 调度的包类型才允许成为今日任务候选。

本方案建议：

1. 在 `LearningPackageType` 新增 `reading`、`writing`，不靠标题、分类或“有没有 Warmup”猜测内容类型。
2. 阅读 MVP 采用 epub.js，但在业务层增加 `ReaderEngine` 适配器，不把进度数据绑定到 epub.js 私有对象。
3. 写作采用“题目约束 → 初稿 → 证据化反馈 → 用户修订 → 版本对比”的闭环；AI 先做教练，不默认替用户生成整篇答案。
4. 阅读包、写作包、剧情包统一从今日任务中排除，但包内可有自己的继续阅读、继续写作和完成进度。
5. 后台为阅读和写作提供各自的编辑工作区与类型化发布校验，不能复用普通学习包编辑页后只隐藏几个字段。

## 2. 当前代码基线与需要修正的边界

当前系统已经具备可复用的底座：

- `Scene.packageType` 与 `LearningPackage.type` 已能区分包类型。
- 后台能生成、上传、发布和导出 `LearningPackage` zip。
- manifest 已包含 `packId`、`version`、`packageType`、内容 ID、资产清单和 checksum。
- 客户端已有下载、校验、安装、SQLite 索引、Filesystem 资产缓存、暂停恢复、卸载与 outbox 同步。
- 剧情包已通过 `packageType=story` 与普通学习计划、今日任务隔离。
- 通用字典、学习本、TTS、LLM 工厂、AI 配额和学习活动可直接复用。

现有隔离仍是“排除 story”的特例。例如：

- `daily-practice.repository.ts` 只过滤 `packageType === 'story'`。
- `learning.store.ts` 用 `packageType !== 'story'` 判断是否重置今日任务。
- 学习计划页只排除 `story`。
- 后台类型、DTO、筛选和标签函数只认识 `daily | exam | story | course | foundation`。

加入阅读包和写作包之前，应将这些判断改为能力白名单。否则新增类型会被默认当成普通学习包，错误进入今日任务候选、未完成单元限制或课程式进度统计。

## 3. 包类型与产品入口

### 3.1 类型定义

```ts
type LearningPackageType =
  | 'daily'
  | 'exam'
  | 'course'
  | 'foundation'
  | 'story'
  | 'reading'
  | 'writing'
```

建议同时建立唯一的能力映射，前后端共享等价定义：

```ts
const PACKAGE_CAPABILITIES = {
  daily:      { today: true,  trainingTopics: true,  reading: false, writing: false, story: false },
  exam:       { today: true,  trainingTopics: true,  reading: false, writing: false, story: false },
  course:     { today: true,  trainingTopics: true,  reading: false, writing: false, story: false },
  foundation: { today: true,  trainingTopics: true,  reading: false, writing: false, story: false },
  story:      { today: false, trainingTopics: false, reading: false, writing: false, story: true  },
  reading:    { today: false, trainingTopics: false, reading: true,  writing: false, story: false },
  writing:    { today: false, trainingTopics: false, reading: false, writing: true,  story: false },
} as const
```

这张表是产品能力约束，不是仅供 UI 展示的标签。客户端路由、Today 候选、后台编辑器、发布校验、包构建器和进度汇总都从它派生。

### 3.2 用户端信息架构

首版不增加新的底部导航。阅读包和写作包继续出现在“学习计划 / 学习广场”，但卡片和详情页按类型呈现：

| 包类型 | 详情页主要内容 | 主按钮 | 进度口径 |
| --- | --- | --- | --- |
| reading | 封面、简介、CEFR 参考级别、目录、字数、预计时长 | 继续阅读 | 阅读位置、章节和完成百分比 |
| writing | 学习目标、任务列表、文体、字数、评分维度 | 继续写作 | 已开始、待修订、已定稿的任务数 |
| story | 角色、章节、关键表达 | 继续剧情 | 章节和作品 |

阅读和写作可以在学习广场增加类型 Tab，也可以在“我的学习”中按类型分组。它们与剧情包相同的是“不受今日任务驱动”，不是必须共用“剧本”入口。

### 3.3 与今日任务的硬边界

```text
普通训练包 ── TrainingTopic / Warmup ──→ 今日任务

阅读包 ───── EPUB / 包内理解活动 ──────→ 阅读进度
写作包 ───── WritingAssignment ───────→ 写作进度
剧情包 ───── StoryEpisode ────────────→ 剧情进度
```

必须同时满足以下约束：

- Today 构建器只读取 `today=true` 的包，而不是排除已知的特殊类型。
- 即使 URL 显式传入阅读包或写作包，也返回空候选，不生成 run。
- 后端 `/practice/daily-practice/complete` 校验 `packId` 对应包类型，拒绝同步阅读、写作、剧情的伪造排期记录。
- 安装、更新或卸载阅读/写作/剧情包时，不清空已经生成的今日任务。
- 三类包不计入“最多 N 个未完成普通学习单元”的限制。
- 首页可以展示“继续阅读 / 继续修订”的独立卡片，但不能计入今日任务完成率，也不能用今日任务未完成状态锁住内容。
- 阅读中收藏的词句、写作反馈中收藏的改写句仍可进入学习本通用复习；这属于资产复用，不代表原包进入 Today。

## 4. 分级阅读包设计

### 4.1 内容单位

MVP 规定一个阅读包包含一本 EPUB，避免第一版同时处理书架合集、跨书搜索和多书版权。后续可允许一个包包含多本出版物。

包级内容包括：

- 书名、作者、封面、简介、语言、版权与授权信息；
- 内部 L1-L5 与 CEFR 参考范围，二者分开保存；
- EPUB 原文件及 checksum；
- 目录、spine、章节标题、字数和预计阅读时间；
- 服务端抽取的纯文本分段索引，用于搜索、AI 上下文和内容检查；
- 可选的人工词表、关键表达、章末理解活动与音频；
- 阅读器主题默认值，但用户显示偏好保存在用户侧。

“分级”不能只由 AI 根据整本书给一个标签。后台应展示词汇覆盖、句长、段落长度、低频词比例等机器证据，并由编辑确认最终 `cefrReference`。在完成真实校准前，用户端使用“建议 A2-B1”而不是“CEFR 认证 B1”。

### 4.2 阅读器能力

MVP：

- 目录跳转、上一章 / 下一章；
- 分页与滚动两种模式；
- 字号、行高、页边距、主题、亮度跟随；
- 当前位置恢复；
- 文本选择后查词、翻译、TTS、收藏到学习本；
- 书签、高亮和笔记；
- 章末可选理解活动；
- 完整离线阅读。

增强阶段：

- 章节音频与句级同步；
- AI 章节问答、人物关系和上下文解释；
- 口头复述或摘要写作；
- 跨设备标注冲突合并；
- 无障碍与 EPUB Media Overlay。

### 4.3 epub.js 选型

epub.js 适合作为 MVP：官方项目提供浏览器内 EPUB 渲染、分页 / 滚动、持久化相关接口、高亮示例和内容 hooks；它与当前 React + Capacitor WebView 架构的接入成本较低。其官方说明也明确指出脚本内容默认禁用，并建议服务端清洗 EPUB 内容，因此不能把上传文件直接无检查地交给 WebView。

不建议让业务代码直接依赖 epub.js 的 rendition 实例。定义适配器：

```ts
interface ReaderEngine {
  open(source: ReaderSource): Promise<PublicationMeta>
  display(locator?: ReadingLocator): Promise<void>
  next(): Promise<void>
  prev(): Promise<void>
  setTheme(theme: ReaderTheme): void
  addAnnotation(annotation: ReaderAnnotation): Promise<void>
  removeAnnotation(id: string): Promise<void>
  onLocationChange(listener: (locator: ReadingLocator) => void): () => void
  destroy(): Promise<void>
}
```

业务层保存标准化 `ReadingLocator`：`href + progression + cfi? + selectedTextHash?`。CFI 可用于精确恢复和标注，但不能只存页码；重排版后页码会随字号和屏幕变化。适配层也为将来评估 Readium Web 或其他引擎保留替换空间。Readium Web 官方当前仍将其 Web 工具包描述为进行中的项目，首版没有必要为其更完整的出版物架构承担更高集成成本。

参考：

- [epub.js 官方仓库与能力说明](https://github.com/futurepress/epub.js)
- [Readium Web 官方说明](https://readium.org/web/)
- [Vivliostyle Viewer 官方 EPUB 支持说明](https://docs.vivliostyle.org/en/viewer/vivliostyle-viewer/)

### 4.4 EPUB 安全与发布校验

后台上传后先进入 `processing`，完成以下检查才能预览或发布：

- EPUB/ZIP 结构、MIME、container、OPF、目录和 spine 可解析；
- 防止 Zip Slip、解压炸弹、异常文件数和超大单文件；
- 拒绝加密或 DRM 内容，MVP 不承诺 DRM；
- 禁用脚本、事件属性、危险 URL scheme、远程 iframe 和未声明外链资源；
- 外部图片、字体、CSS、音频必须转为受控资产或明确拒绝；
- 校验封面、章节数量、空章节、编码、字体许可和总包大小；
- 记录源文件 checksum、解析器版本和清洗版本，以便重新构建。

服务端生成 sidecar 索引，客户端不在每台设备上重复解析全书：

```text
content/reading/publication.json
content/reading/toc.json
content/reading/sections.json
assets/books/{sha256}.epub
```

### 4.5 阅读 AI

AI 只使用当前选区、当前段落或当前章节的服务端抽取文本作为依据。答案返回引用的 section ID 与短证据片段；找不到依据时明确说“不在本章内容中”。MVP 不做全库开放式 RAG。

用户可发起：

- “解释这句话为什么这样写”；
- “用更简单的英语解释”；
- “这段中的代词指什么”；
- “给我 2 个理解问题”；
- “听我复述并指出遗漏”。

AI 问答不自动改变阅读完成度；完成度由稳定阅读位置、章节访问和显式完成动作共同决定。

## 5. AI 写作练习包设计

### 5.1 产品原则

写作练习的核心不是让 AI 生成一篇范文，而是让用户经历可观察的表达改进。每个任务至少形成两个用户版本，AI 反馈必须指向用户原文证据。

MVP 先支持三类任务：

1. 场景消息：聊天回复、请求、道歉、确认、反馈。
2. 邮件：职场邮件或生活邮件，包含对象、目的和语气。
3. 短段落：日记、观点、经历描述；IELTS 段落可以作为受控模板，不在首版做整套考试评分承诺。

暂不做长篇协作文档、实时逐字纠错、多人协作或论文查重。

### 5.2 单个任务结构

```ts
interface WritingAssignmentDefinition {
  id: string
  title: string
  genre: 'message' | 'email' | 'paragraph' | 'ielts_paragraph'
  level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  prompt: string
  audience?: string
  purpose: string
  context?: string
  requirements: string[]
  targetExpressions?: string[]
  minWords?: number
  maxWords?: number
  rubric: WritingRubric
  aiPolicy: 'coach' | 'coach_with_examples' | 'assessment'
  referenceMaterials?: WritingReference[]
}
```

题目必须包含受众、目的、情境和限制，避免只有“写一篇关于旅行的作文”这种无法稳定反馈的开放题。

### 5.3 用户闭环

```text
理解任务
  ↓
可选构思：关键词 / 提纲 / AI 追问
  ↓
用户完成初稿并提交
  ↓
确定性检查：字数、遗漏要求、重复、空内容
  ↓
AI 结构化反馈：证据 → 原因 → 最小修改建议
  ↓
用户逐项修订并提交第二版
  ↓
版本差异 + 改进总结 + 可收藏表达
  ↓
定稿 / 继续重写
```

关键交互：

- 自动保存草稿，不调用 AI、不消耗额度。
- 提交后先给 3～5 个高价值问题，避免满屏红线。
- 每条反馈锚定原文 range 或 quote，并标明维度、严重度和建议。
- “给我提示”优先返回提问、句型骨架或局部例句。
- 整句改写必须由用户主动展开；整篇参考答案只在至少一次定稿后展示。
- 接受建议不会静默覆盖原文，而是生成新版本并可撤销。
- 完成页突出“你改好了什么”，而不只显示单次分数。

### 5.4 AI 反馈维度

所有题型共享四个稳定维度，题型可以增加专属维度：

| 维度 | AI 要判断的内容 | 必须返回的证据 |
| --- | --- | --- |
| 任务完成度 | 是否回应目的、对象与明确要求 | 已覆盖 / 遗漏的 requirement ID |
| 组织与连贯 | 信息顺序、连接和指代是否清楚 | 相关句段与重排建议 |
| 词汇与语域 | 用词是否准确、自然并适合受众 | 原词、问题说明、1～2 个候选 |
| 语法与清晰度 | 是否影响理解，是否存在可复用错误模式 | 原文 range、错误类型、最小修复 |

评分使用内部 1～5 等级与文字解释。没有经过标准化校准前，不把 LLM 分数展示为正式 CEFR、IELTS Band 或考试成绩。模型输出包含 `confidence` 和 `needsHumanReview`，低置信度反馈降级为建议，不阻止用户完成。

建议的结构化响应：

```json
{
  "summary": "string",
  "requirementCoverage": [{ "requirementId": "r1", "status": "met|partial|missing", "evidence": "string" }],
  "dimensions": [{ "key": "task|organization|lexis|grammar", "level": 1, "reason": "string" }],
  "issues": [{
    "id": "i1",
    "dimension": "grammar",
    "severity": "blocking|important|polish",
    "quote": "string",
    "start": 0,
    "end": 8,
    "explanationZh": "string",
    "hint": "string",
    "suggestions": ["string"]
  }],
  "strengths": [{ "quote": "string", "reason": "string" }],
  "nextRevisionGoals": ["string"],
  "confidence": 0.0,
  "needsHumanReview": false
}
```

服务端必须用 schema 校验模型输出，并验证 quote/range 确实属于本次提交文本；无效项丢弃或重试，不能让客户端直接渲染任意模型 JSON。

### 5.5 AI 调用策略

- 复用现有 LLM provider、模型配置和 `AiQuotaService`。
- 请求由服务端组装题目、rubric、用户版本和允许的参考材料，客户端不能上传系统提示词。
- 使用稳定 prompt version 与 rubric version；反馈记录 provider、model、promptVersion、rubricVersion、latency、token usage 和错误码。
- 相同 `submissionVersion + promptVersion + model` 使用幂等键，避免网络重试重复扣额度。
- 用户文本属于私有学习内容，不用于公开展示；日志默认不写全文，只写 ID、长度和散列。
- 内容安全与提示注入防护把 EPUB/参考材料和用户文本都视为不可信数据，不允许其中的指令覆盖系统评改协议。

## 6. 建议的数据模型

保留 `Scene` 作为包容器，新增类型专属叶子，不把阅读章节或写作题伪装成 `TrainingTopic`。

### 6.1 阅读

```text
ReadingPublication
  id, sceneId, sourceAssetId, title, author, language
  internalLevel, cefrReference, wordCount, estimatedMinutes
  sourceChecksum, parserVersion, sanitizeVersion, metadata, status

ReadingSection
  id, publicationId, href, spineIndex, title, text, textHash, wordCount

UserReadingProgress
  userId, publicationId, locatorJson, progression
  startedAt, lastReadAt, completedAt, totalActiveSeconds

ReadingAnnotation
  id, userId, publicationId, type, locatorJson
  quote, quoteHash, note, color, createdAt, updatedAt, deletedAt
```

MVP 可以不逐段建立向量索引；`ReadingSection.text` 足够支持当前章节问答与检索。未来做跨书 RAG 时再增加 chunk 与 embedding。

### 6.2 写作

```text
WritingAssignment
  id, sceneId, title, genre, internalLevel
  prompt, audience, purpose, context
  requirementsJson, targetExpressionsJson, rubricJson
  minWords, maxWords, aiPolicy, sortOrder, status

WritingSubmission
  id, userId, assignmentId, status
  currentVersion, startedAt, submittedAt, completedAt

WritingDraftVersion
  id, submissionId, version, content, wordCount
  source: user | accepted_suggestion
  baseVersionId, createdAt

WritingFeedback
  id, draftVersionId, resultJson, status
  provider, model, promptVersion, rubricVersion
  confidence, tokenUsageJson, latencyMs, createdAt
```

草稿版本采用追加写，不覆盖历史正文。自动保存可以先保存在本地草稿表并节流同步；用户“提交评改”时固化不可变版本。

## 7. 后台内容生产与发布

### 7.1 后台入口

建议新增两个内容工作区：

- `/admin/reading`：阅读包、EPUB 处理、目录预览、分级证据、词表、理解活动、发布检查。
- `/admin/writing`：写作包、任务目录、题目约束、rubric、目标表达、AI 反馈预览、发布检查。

通用 `/admin/learning-packs` 继续只负责版本、zip、上传、发布和导出；它不承担具体内容创作。

普通“学习内容”页面：

- 新建时可选择阅读或写作类型，但选择后跳转到对应工作区；
- `reading` 不显示 TrainingTopic、Warmup、Ink 练习编辑器；
- `writing` 不显示 TrainingTopic、Warmup、Ink 练习编辑器；
- 剧情仍保持现有独立工作区；
- 类型一旦已有用户进度或已发布版本，禁止直接跨类型修改，只允许复制为新包。

### 7.2 类型化发布校验

| 类型 | 发布必填 |
| --- | --- |
| reading | 恰好一本可解析 EPUB、封面、语言、级别、非空目录、版权信息、安全检查通过 |
| writing | 至少一个任务、目的、要求、字数范围、完整 rubric、AI 预览通过 |
| story | 延续现有章节与 InkScript 校验 |
| 普通训练 | 延续 TrainingTopic、教学材料与 Warmup 校验 |

后台显示错误清单并阻止发布，不能仅把构建失败写进 `buildLog` 后让运营猜原因。

### 7.3 包构建

`buildLearningPackZip` 按 capability 分支：

```text
common manifest / indexes / assets
  ├── training → content/topics/*
  ├── story    → content/story/*
  ├── reading  → content/reading/* + EPUB asset
  └── writing  → content/writing/assignments.json
```

建议将 `formatVersion` 升为 2，并新增：

```json
{
  "packageType": "reading",
  "capabilities": {
    "today": false,
    "offline": true,
    "reader": "epub"
  },
  "content": {
    "readingPublicationId": "..."
  }
}
```

客户端安装前检查 `formatVersion` 和 `packageType`。旧版客户端遇到不认识的类型应提示升级，不能把它当普通训练包安装成功后显示空页面。

## 8. API 与同步边界

建议接口按领域拆分：

```text
GET    /reading/packages/:sceneId
PUT    /reading/publications/:id/progress
GET    /reading/publications/:id/progress
POST   /reading/publications/:id/annotations
PATCH  /reading/annotations/:id
DELETE /reading/annotations/:id
POST   /reading/publications/:id/ask

GET    /writing/packages/:sceneId
POST   /writing/assignments/:id/submissions
PUT    /writing/submissions/:id/draft
POST   /writing/submissions/:id/versions
POST   /writing/draft-versions/:id/feedback
POST   /writing/submissions/:id/complete
GET    /writing/submissions/:id
```

同步策略：

- 阅读 locator 按 `lastReadAt` 合并；完成状态单调前进，除非用户显式重新开始。
- 标注使用独立 ID、`updatedAt` 和软删除，按记录合并。
- 写作自动草稿允许 last-write-wins，但“已提交版本”不可覆盖。
- AI 反馈只由服务端生成；离线时可以写草稿，恢复联网后由 outbox 提交评改。
- 阅读、写作活动可以计入总学习时长和报告，但必须使用独立 activity type，不能伪装成 daily practice attempt。

## 9. 实施顺序

### Phase A：类型与隔离地基

1. Prisma enum、前后端联合类型增加 `reading | writing`。
2. 建立 package capability 单一来源，替换所有 `!== 'story'` / `=== 'story'` 的 Today 判断。
3. Today 客户端候选和后端 complete 接口同时做白名单校验。
4. 学习计划、商店、加入限制、进度统计按类型路由。
5. manifest v2 和旧客户端拒绝策略落地。

验收：安装、更新、卸载阅读/写作/剧情包均不改变当日任务；显式传它们的 `packId` 也无法创建 DailyPracticeRun。

### Phase B：阅读包 MVP

1. 新增阅读模型、后台上传 / 解析 / 清洗 / 预览 / 发布。
2. 扩展包构建与离线安装，保存 EPUB 和 sidecar 索引。
3. 实现 `ReaderEngine` 与 epub.js adapter。
4. 实现目录、主题、locator 进度、查词、TTS、收藏、书签和高亮。
5. 真机验证 Android/iOS WebView 的本地 EPUB 读取、内存、返回恢复和暗色主题。

验收：飞行模式下可完整读完一本测试 EPUB；改变字号、方向和设备后可恢复到同一语义位置；恶意 EPUB 不能执行脚本或访问外网。

### Phase C：写作包 MVP

1. 新增写作模型和后台任务 / rubric 编辑器。
2. 完成三类模板与类型化发布校验。
3. 用户端实现自动草稿、提交、反馈卡、逐项修订和版本 diff。
4. 接入结构化 AI 协议、schema 校验、额度、幂等和失败重试。
5. 支持把用户确认的改写句收藏到学习本。

验收：用户可离线写初稿，联网后提交；至少完成两版并看到有原文证据的反馈；模型失败不会丢草稿或重复扣额度。

### Phase D：学习价值增强

1. 阅读当前章节问答和口头复述。
2. 阅读结束后可选摘要写作，将阅读上下文传给一个明确的写作任务。
3. 报告增加阅读分钟、完成章节、写作版本、已解决反馈等可信指标。
4. 用人工标注样本评估 AI 反馈一致性，再决定是否展示更细等级。

注意：阅读转摘要写作是跨产品推荐，不是今日任务注入。

## 10. 代码改动清单

实施时至少覆盖以下位置：

- `apps/backend/prisma/schema.prisma`：包类型与阅读 / 写作实体。
- `apps/backend/src/modules/admin/dto/scene-admin.dto.ts`：类型联合。
- `apps/backend/src/modules/admin/learning-pack-admin.service.ts`：过滤、发布与类型校验。
- `apps/backend/src/modules/learning/learning.service.ts`：manifest 和 zip 构建分支。
- `apps/backend/src/modules/practice-ai/daily-practice.service.ts`：后端 Today 类型白名单。
- `apps/frontend/src/features/learning/api/learning-api.ts`：包类型与 DTO。
- `apps/frontend/src/features/admin/api-learning-packs.ts`：后台类型。
- `apps/frontend/src/features/admin/pages/admin-scenes-page.tsx`：类型入口与专属编辑器路由。
- `apps/frontend/src/features/admin/pages/admin-learning-packs-page.tsx`：标签与筛选。
- `apps/frontend/src/lib/offline/daily-practice.repository.ts`：Today 白名单。
- `apps/frontend/src/stores/learning.store.ts`：安装变更是否影响 Today 的判断。
- `apps/frontend/src/lib/offline/learning-pack.service.ts`：manifest v2 与类型内容安装。
- `apps/frontend/src/lib/offline/offline-storage.service.ts`：阅读 / 写作存储统计和卸载清理。

应使用 `rg "packageType|story"` 做一次全仓审计，避免遗漏局部字符串联合和“非 story 即普通学习包”的隐含判断。

## 11. 与学习本复习的关系

阅读包和写作包自身没有每日排期，但它们产生的可复用表达可以进入学习本：

- 阅读：用户主动收藏的词、短语、句子；
- 写作：用户确认有价值的错误修复、改写句和目标表达；
- 来源信息保存 `sourceType + sourceId + locator/versionId`，便于回到原上下文。

收藏后只生成一个学习本条目，由通用复习调度负责。不要同时为同一收藏内容生成 Warmup item，否则会制造真正的重复排期。

## 12. 非目标与风险

- 不在 MVP 支持 DRM EPUB；内容授权必须在后台可追溯。
- 不承诺所有 EPUB 3 脚本、复杂数学公式、固定布局漫画和媒体覆盖均可用。
- 不让 AI 自动判定正式 CEFR 或考试成绩。
- 不允许 AI 无证据地修改整篇文章，也不把模型建议当唯一正确答案。
- 不因为阅读或写作有“建议每天继续”就复用今日任务表；提醒可以复用通知基础设施，但进度与完成语义独立。
- EPUB 解析、清洗与 WebView 本地资源协议必须在真机上验证，浏览器开发环境通过不代表 Capacitor 已通过。

