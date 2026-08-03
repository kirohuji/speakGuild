# 多形态学习包统一内容模型与实施方案

> 版本：v2.1
>
> 日期：2026-08-03
>
> 状态：MVP 已实现，待真机内容验收与体验增强
>
> 范围：练习包、写作包、阅读包、听力包、小说包、剧情包、包分组、后台生产、离线与进度

> 代码入口：`content-experiences` 后端模块、后台场景编辑页的“内容体验”区、用户端 `content-mode-experience`、学习包离线聚合服务

> 当前边界：写作与阅读已支持提交及 AI 证据化反馈，但尚未做版本差异视图；小说已支持 EPUB 上传、目录解析、后台预览、用户阅读与位置同步，原生端 EPUB 离线文件 URL 仍需真机验收；听力字幕首期使用结构化 JSON 编辑，后续再增加可视化校时轨道。

## 1. 核心结论

这些内容不是六套互不相干的产品。它们应共享一套学习包骨架，只在内容单元、主交互和完成口径上分化：

```text
统一学习包
├── 通用：商店 / 权限 / 版本 / 离线 / 进度 / 分类 / 系列
├── 通用知识：单词 / 句块 / 句型 / 收藏 / 词典 / TTS
└── 内容能力
    ├── practice：教学与练习
    ├── writing：题目、草稿、AI 反馈与修订
    ├── reading：文章、理解题与内容回答
    ├── listening：音频、逐句列表与词级时间戳
    ├── novel：EPUB 长篇阅读与阅读位置
    └── story：剧情章节、VN 与输出互动
```

设计原则：

1. 不为每种包复制商店、离线、资源、学习本和进度基础设施。
2. 单词、句块、句型是所有包都可挂载的通用知识层，不属于某一种练习页面。
3. 写作包和阅读包仍可按“话题/单元”组织；区别是话题中的核心任务分别是写作和阅读理解。
4. 小说包不强制制作练习话题。目录和章节来自 EPUB，通用知识可挂在整本书或 EPUB 定位点上。
5. 听力包以可逐句定位、循环和跟随高亮的播放器为核心；句级和词级时间戳是正式内容数据。
6. `group` 表示有顺序、有系列进度的强学习关联；它不等同于用于检索的 category/tag。
7. 上述体验型包都不进入今日任务。只有显式声明 `participatesInToday=true` 的练习能力才能被 Today 调度。

## 2. 先拆开当前混在一起的概念

当前 `LearningPackageType` 包含 `daily | exam | story | course | foundation`，同时承担了课程归类和页面能力两个职责。新增类型时继续扩充这个枚举，会逐渐出现“foundation 到底该打开练习页还是阅读器”之类的歧义。

目标模型应拆成三条轴：

| 维度 | 作用 | 示例 |
| --- | --- | --- |
| `contentMode` | 决定内容结构、用户路由、编辑器和发布校验 | `practice`、`writing`、`reading`、`listening`、`novel`、`story` |
| category/tag | 发现、筛选、难度和主题归类 | 基础、考试、职场、L2、旅行 |
| `group` | 一套强关联内容的成员、顺序和系列进度 | 英语写作入门 1～4、某小说三部曲 |

目前 `/learning/tags` 实际返回 `SceneCategory`，不是独立多对多 Tag。实施时可以先保留现状，但 API 和界面文案不应再把 category、tag、group 混为一谈。

### 2.1 推荐的渐进迁移

软件尚未发布，不需要为旧客户端保留兼容分支，但仍应控制一次改造的范围：

1. 在 `Scene` 增加 `contentMode`，以它作为渲染与能力判断的唯一依据。
2. 现有 `daily | exam | course | foundation` 暂时保留为课程归类，后续迁移到 category/tag。
3. `story` 的用户路由改由 `contentMode=story` 决定，不再依赖“只排除 story”的黑名单。
4. `LearningPackage.type` 不再独立表达另一份真相；离线包 manifest 直接固化 Scene 的 `contentMode` 和能力快照。

建议能力表：

| contentMode | 有普通话题 | 核心交互 | 单词/句块/句型 | 进入 Today |
| --- | --- | --- | --- | --- |
| `practice` | 是 | 教学、Warmup、输出练习 | 是 | 可配置，默认是 |
| `writing` | 是 | 写作、AI 反馈、修订 | 是 | 否 |
| `reading` | 是 | 阅读、理解题、内容回答 | 是 | 否 |
| `listening` | 是 | 逐句听力、循环、听力题 | 是 | 否 |
| `novel` | 否，允许选配 | EPUB 长篇阅读 | 是 | 否 |
| `story` | 使用剧情章节 | VN、对话和剧情输出 | 是 | 否 |

## 3. 统一包骨架

### 3.1 包级数据

继续以 `Scene` 表示用户看到和加入学习的内容包，以 `LearningPackage` 表示它的已构建离线版本。通用字段至少包括：

- 标题、简介、封面、作者/来源、参考等级、预计时长。
- `contentMode`、category、tags、`groupId`。
- 权限、价格/免费状态、发布状态、版本。
- 通用知识引用：单词、句块、句型。
- 能力快照：是否有音频、题目、AI、EPUB、Today、离线。
- 用户包级进度和最后访问位置。

### 3.2 复用现有话题模型

不新增 `ContentUnit` 以及 `ContentUnitVocabulary`、`ContentUnitChunk`、`ContentUnitSentencePattern`。它们会与现有话题及知识绑定形成一套平行模型，增加后台编辑、离线打包、进度统计和查询维护成本。

写作、阅读、听力和普通练习直接复用现有 `TrainingTopic`：

```text
TrainingTopic
  id / sceneId / title / description / sortOrder
  activityType            // practice | writing | reading | listening
  contentConfig           // 对应题型的结构化配置
  mediaAssetId            // 听力音频等资源
  transcript              // 句子和单词时间戳
  vocabularies / activeChunks / sentencePatterns
```

`Scene.contentMode` 决定整个包的产品体验和允许的话题类型；`TrainingTopic.activityType` 保存具体题型，发布时校验二者一致。写作和阅读的题型配置首期保存在 `contentConfig`，对高频查询字段和稳定实体再按实际需求拆表，避免未经验证的过度建模。

剧情包继续使用现有 `StoryEpisode`。小说包直接使用 EPUB 目录和阅读进度，不创建无意义的话题或占位单元。

### 3.3 通用知识绑定

单词、句块、句型支持两级绑定：

- 包级：这整套内容的核心知识，适合商店预览、学习目标和总复习。
- 单元级：某篇文章、某个写作题或某段音频直接使用的知识。

小说还需要来源定位：

```ts
type EpubResourceLocator = {
  href: string
  cfi?: string
  quote?: string
  textHash?: string
}
```

`quote` 用于后台核对，`href + cfi` 用于跳转，`textHash` 用于 EPUB 更新后的漂移检测。知识本体仍复用已有 Vocabulary、Chunk、SentencePattern，不另建“小说单词表”。

## 4. 各类包的产品定义

### 4.1 写作包

写作包保留“话题/单元”，但话题中的题目就是用户要完成的写作任务，不再先做一套普通选择题才能写。

每个写作话题的 `contentConfig` 至少包含：

- 题目、场景、受众、写作目的和文体。
- 必须覆盖的要点、建议结构、字数范围和参考等级。
- 推荐单词、句块、句型，以及是否必须使用。
- 评分量表：任务完成、结构、清晰度、语言准确度、表达丰富度。
- AI 策略：允许提示、允许局部改写、是否展示范文、提交限制。

用户闭环：

```text
理解题目 → 列提纲 → 初稿 → 本地确定性检查
        → AI 证据化反馈 → 用户修订 → 版本对比 → 定稿
```

AI 默认是教练，不是代写器：

1. 先指出具体文本证据、问题原因和修改方向。
2. 优先提问或给局部提示，不默认生成整篇成品。
3. 反馈必须符合结构化协议，保存模型版本、量表版本和配额消耗。
4. 用户必须通过新版本修订形成学习闭环；“查看 AI 答案”不算完成。
5. 对拼写、字数、段落、题目要点覆盖等确定性规则先本地检查，减少不必要的 LLM 调用。

进度按任务状态统计：未开始、草稿、待修订、已定稿。草稿和反馈需要版本化并支持离线保存，AI 请求在联网后执行。

### 4.2 阅读包

阅读包也保留话题/单元。每个单元是一篇受控长度的文章或材料，配合阅读理解题和内容回答：

- 正文、段落、来源、字数、参考等级、主题。
- 目标知识和可选朗读音频。
- 选择、排序、判断、简答、开放回答等理解题。
- 标准答案、可接受答案、原文证据和解释。

推荐流程：

```text
阅读正文 → 点词/收藏 → 回答理解题 → 查看证据与解释
        → 可选口头复述或摘要写作 → 完成单元
```

客观题优先规则判定；简答和开放回答由 AI 判断语义覆盖、引用证据和表达清晰度。AI 不应只返回一个分数，必须指出文章中的依据。

阅读包与小说包的边界是：阅读包是“策划好的短篇课程单元”，理解题是核心；小说包是“长篇出版物阅读”，阅读本身是核心。

### 4.3 小说包

小说包 MVP 推荐使用 EPUB，并在客户端以 epub.js 为首个 `ReaderEngine` 实现。业务数据不得直接保存 epub.js 内部对象，避免以后更换阅读内核时无法迁移。

```ts
interface ReaderEngine {
  open(source: ArrayBuffer): Promise<void>
  getToc(): Promise<ReaderTocItem[]>
  display(locator?: ReaderLocator): Promise<void>
  getLocator(): Promise<ReaderLocator>
  search(query: string): Promise<ReaderSearchResult[]>
  destroy(): void
}
```

MVP 约束：

- 一个小说包对应一本 EPUB；系列关系交给 `group`。
- 目录和章节来自 EPUB spine/TOC，不要求后台再创建练习话题。
- 保存 `href + EPUB CFI + progression`，同步最后阅读位置、章节进度和整书进度。
- 支持主题、字号、行距、翻页/滚动、目录、搜索、书签、点词、收藏到学习本。
- 单词、句块、句型可挂整本书，也可通过 EPUB locator 跳到原文。
- 章节后的理解题、摘要或 AI 聊书是可选扩展，不是发布小说包的必填项。
- 后台导入时解析并清洗 EPUB，禁用脚本和外部主动内容；DRM EPUB 不进入 MVP。

### 4.4 听力包

听力包仍按话题/单元组织，但主页面是播放器和类似歌词的句子列表。用户可以点击任意句子跳转、只循环该句、调整语速，并看到当前句和当前词高亮。

正式数据结构：

```text
ListeningTrack
  mediaAssetId / durationMs / language / version
  TranscriptSegment[]
    id / startMs / endMs / text / translation / speaker / sortOrder
    TranscriptWord[]
      token / startMs / endMs / normalizedText / sortOrder
```

播放器能力：

- 当前句自动滚动和高亮。
- 点击句子 seek；单句循环和 A-B 循环。
- 0.5～2.0 倍速；显示/隐藏原文和翻译。
- 逐句播放结束保留当前位置，便于反复听。
- 后续可在同一数据上增加听写、挖空、影子跟读和内容理解题。

时间戳发布校验：

- segment 按时间单调递增，且不超过媒体时长。
- word 必须位于所属 segment 范围内，重叠只能在容差内。
- 文本顺序、句子顺序和时间顺序一致。
- 离线 manifest 必须收齐媒体、字幕和时间戳版本。

时间戳可先由 STT/forced alignment 生成，再由后台波形与字幕编辑器人工校正。播放器高亮以媒体时钟为准，用二分定位当前 segment/word，不依赖大量定时器逐词触发。

### 4.5 剧情包与普通练习包

- 剧情包继续使用 `StoryEpisode`、Ink/VN、角色和地图资产，但共享包级资源、系列、离线和学习活动。
- 普通练习包继续使用现有教学、Warmup 与输出管线，是唯一默认参与 Today 的模式。
- 不要求为统一而立即重写这两条已存在链路；先给它们增加统一能力描述和目录适配器。

## 5. PackageGroup：强关联系列

### 5.1 与 category/tag 的区别

| 能力 | category/tag | PackageGroup |
| --- | --- | --- |
| 用途 | 搜索和筛选 | 表达“一套内容” |
| 成员关系 | 可多选、多对多 | MVP 每个包最多属于一个 group |
| 顺序 | 通常无 | 必须有稳定顺序 |
| 影响学习流程 | 否 | 前后包导航、系列进度、可选解锁 |
| 示例 | 商务、L2、听力 | 商务听力 1～6 |

“都是 listening”只说明它们打开同一种播放器；“属于商务听力进阶 group”才说明它们是一套有顺序的内容。

### 5.2 推荐模型

```prisma
model PackageGroup {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?
  coverImage String?
  contentMode ContentMode?
  status      PackageGroupStatus @default(draft)
  items       PackageGroupItem[]
}

model PackageGroupItem {
  id          String @id @default(cuid())
  groupId     String
  sceneId     String @unique
  sortOrder   Int
  volumeLabel String?
  requiredPrevious Boolean @default(false)

  @@unique([groupId, sortOrder])
}
```

规则：

1. 一个包允许没有 group；一旦加入，MVP 只能属于一个 group。
2. group 默认约束相同 `contentMode`，后台只有显式创建“混合学习路径”时才允许不同模式。
3. 调整顺序必须事务化，发布时不允许重复序号、重复成员或引用未发布成员而无提示。
4. `requiredPrevious` 表达真正的前置解锁；单纯排在前面不等于强制完成。
5. 加入或下载一个包不自动下载整个 group，避免小说和音频系列占满设备；用户可主动“加入/下载整套”。
6. 用户端显示“系列第 2/5 包”、上一包/下一包、系列总进度和锁定原因。

离线 manifest 保存 group 快照（id、名称、当前成员顺序、版本），但各成员包仍独立构建、更新和卸载。在线同步后以最新 group 为准，不因改顺序破坏已完成记录。

## 6. 今日任务、进度与学习报告

不能再使用 `packageType !== 'story'` 这类黑名单。统一由能力映射判断：

```ts
participatesInToday(contentMode) === contentMode === 'practice'
```

- writing、reading、listening、novel、story 不进入 Today，也不受“今日未完成”限制。
- 它们的包内题目只是本模式的活动，不自动成为 Warmup/Today item。
- 各模式仍统一产生 `LearningActivity`：阅读时长、听力时长、完成理解题、提交写作版本、完成剧情章节等。
- 学习报告按活动类型聚合，不能把“读完一章”和“答对一道 Warmup”都伪装成同一个题目数。
- group 进度由成员包进度聚合，不额外复制一份可独立修改的完成状态。

## 7. 后台内容生产

后台采用“通用包表单 + 模式专属工作区”：

### 7.1 通用区

- 基本信息、contentMode、category/tag、参考等级、封面和权限。
- group 选择、新建 group、成员排序、前置规则和系列预览。
- 单词、句块、句型的包级绑定。
- 资产、版本、构建、发布和离线预览。

### 7.2 模式专属区

| 模式 | 编辑器 | 发布阻断条件示例 |
| --- | --- | --- |
| practice | 教学/Warmup/输出编辑器 | 管线无题目、引用丢失 |
| writing | 题目、要求、量表、AI 策略 | 无题目、字数非法、量表缺失 |
| reading | 富文本文章、理解题、证据 | 正文为空、题目无答案/证据 |
| listening | 音频、波形、字幕、时间轴 | 媒体缺失、时间戳越界/乱序 |
| novel | EPUB 导入、目录、元数据、知识定位 | EPUB 不合法、目录不可解析、外部主动内容 |
| story | 现有剧情工作台 | Ink/资产/章节校验失败 |

AI 可以帮助生成题目、初始字幕、分级建议和写作量表，但所有生成内容进入草稿，必须人工审核后才能发布。

## 8. 离线 manifest 与客户端路由

统一 manifest 建议至少包含：

```json
{
  "formatVersion": 3,
  "packId": "scene-id",
  "version": 1,
  "contentMode": "listening",
  "capabilities": {
    "today": false,
    "audio": true,
    "wordTimings": true,
    "ai": false
  },
  "group": {
    "id": "group-id",
    "name": "商务听力进阶",
    "position": 2,
    "total": 6,
    "version": 1
  },
  "units": [],
  "knowledge": {},
  "assets": []
}
```

安装、checksum、SQLite、Filesystem 和资源引用计数继续共用。模式层只注册自己的内容表与播放器/编辑器：

```text
打开 Scene
  → 读取 contentMode
  → PackageExperienceRegistry.resolve(contentMode)
  → practice / writing / reading / listening / novel / story
```

未知模式必须提示客户端升级，不能安装成功后落入普通练习页或显示空页面。

## 9. 实施顺序

### Phase A：统一语义与后台基础

1. 新增 `contentMode` 和统一能力映射，清除“非 story 即普通练习”的判断。
2. 新增 `PackageGroup`、成员排序、系列校验和用户端系列信息。
3. 统一 manifest 的 contentMode、capabilities 和 group 快照。
4. 复用 `TrainingTopic` 的知识绑定，并增加 Scene 包级知识绑定；不新增平行的 ContentUnit 模型。

### Phase B：写作包 MVP

实现写作题、草稿版本、确定性检查、结构化 AI 反馈、修订对比、离线草稿和后台编辑器。

### Phase C：阅读包 MVP

实现文章单元、理解题、证据化反馈、阅读进度、点词和后台内容生产。短篇阅读不依赖 EPUB。

### Phase D：听力包 MVP

实现音频/字幕/词级时间戳模型、后台校时、逐句歌词列表、seek、单句循环、倍速和离线播放。

### Phase E：小说包 MVP

接入 `ReaderEngine` 与 epub.js，实现安全导入、目录、阅读位置、主题、书签、点词和通用知识定位。

## 10. 验收标准

1. 六种模式共享同一个商店、加入、下载、更新、卸载和权限链路。
2. 单词、句块、句型可被任一模式绑定、查看、收藏和复习。
3. 页面路由和 Today 候选只读取 `contentMode/capabilities`，不存在散落的包类型黑名单。
4. 写作题可完成“草稿—反馈—修订—定稿”；阅读题能返回答案和原文证据。
5. 听力播放器可稳定逐句 seek、循环，并用词级时间戳高亮；离线行为一致。
6. 小说包无需创建练习话题即可发布和阅读，能可靠恢复 EPUB 阅读位置。
7. group 可排序、校验、展示系列进度和前后包导航；tag/category 不承担解锁或顺序职责。
8. 每种模式都有独立发布校验，任何缺失必需资产的包都无法发布。

## 11. 本方案明确不做

- 不为每种包新建一套商店、下载器、学习本或字典。
- 不把 category/tag 改名为 group 后继续沿用弱关联语义。
- 不强迫小说创建无意义的话题和理解题。
- 不用普通音频的粗粒度进度冒充词级时间戳。
- 不让 AI 默认代写整篇作文，也不把无证据的模型打分作为权威评分。
- 不因为包内存在题目，就自动把它加入今日任务。
