# NQTR 架构与流程说明

> 基于当前代码实现（`features/nqtr/`、`modules/nqtr/`、`Game*` / `NqtrChapter` 模型）。  
> 目标：先把**概念**和**玩家怎么玩**讲清楚，再对照代码位置。  
> 核对日期：2026-11-11

---

## 0. 一句话

**NQTR**（本项目里的「互动小说 / 探索式剧本」）=  
**一张可探索的地图世界**（地点 → 房间 → 热点）  
+ **游戏内时钟**（天 / 时段）  
+ **谁在什么时候出现**（日程 Commitment）  
+ **能点什么事**（行为 Activity）  
+ **任务阶段如何解锁内容**（Quest）  
+ **点开后播一段 Ink 对白**（复用 VN 引擎 `VnStoryPreview`）  
+ **本地优先存档**。

它和「轻量剧情包（`packageType=story`）」的差别：轻量包基本是**线性集数 + Ink**；NQTR 是**开放探索 + 时间 + 任务门控**，对白仍用同一套 Ink / VN。

产品文案里常叫「互动小说」；代码 / 包类型叫 `nqtr`。

---

## 1. 先建立心理模型（概念词典）

按「玩家眼里看到的东西」记，不要先背表名。

| 概念 | 玩家感受 | 代码里大致是 |
|---|---|---|
| **剧情包 Scene** | 一个可下载的互动剧本 | `Scene`，`packageType=nqtr` |
| **章 Chapter** | 剧本被切成几章；前一章通关才开下一章 | `NqtrChapter` |
| **地图 Map** | 整张世界底图 | `GameMap` + `editorData` |
| **地点 Location** | 地图上的可点区域（咖啡店、邮局…） | `GameLocation` |
| **房间 Room** | 地点里的具体场景（大厅、后院…） | `GameRoom` |
| **热点 Hotspot** | 场景上可点的交互钉（门、物体、出口） | `map.editorData.sceneInteractions` |
| **行为 Activity** | 「点咖啡」「查邮箱」这类可执行动作 | `GameActivity` |
| **日程 Commitment** | 「某角色在某时段出现在某房间」 | `GameCommitment` |
| **任务 Quest** | 多阶段目标；阶段开始可挂行为 / 启用日程 | `GameQuest` + `GameQuestStage` |
| **对白 Ink** | 点开行为/日程后进入的 VN 对话 | `InkScript` → `VnStoryPreview` |
| **会话 Session** | 本章正在跑的运行时状态（天、时间、任务进度…） | 前端 `NqtrSession` |
| **存档 Save** | 进度持久化 | `GameSave` + localStorage hybrid |
| **Chrome** | 右上角按钮、图标尺寸等 UI 皮 | `Scene.nqtrChrome` |
| **Time** | 一天起止、时段名、默认耗时 | `Scene.nqtrTime` |

### 1.1 空间层级（最重要）

```
地图 Map
  └── 地点 Location（钉在地图坐标上）
        └── 房间 Room（地点内场景；有入口 isEntrance）
              └── 热点 / 行为钉 / 角色日程钉
```

玩家位置用 `NqtrPlace` 四种模式表示：

- `map`：看整张地图  
- `location`：站在某个地点总览（看房间钉）  
- `room`：在某个房间里探索  
- `talk`：正在播对白（仍绑定某个 `roomId`）

### 1.2 时间怎么记

与 Pixi-VN 习惯一致：**`18.30` 表示 18:30**，小数部分是「分钟」，不是小时的小数。

- `gameDay`：游戏第几天（从 1 起）  
- `gameTime`：当天时刻  
- `timeSlots`：早晨 / 下午 / 傍晚… 用于显示时段名、选立绘槽  
- 行为 `minutes`、默认 `defaultTimeSpent`：做完一件事推进多少时间  

跨过 `dayEndTime` 会进下一天，时间折回 `dayStartTime` 附近。

### 1.3 行为 vs 日程（最容易混）

| | **Activity 行为** | **Commitment 日程** |
|---|---|---|
| 是什么 | 「房间里能做的事」 | 「某角色在某时段待在某房」 |
| 出现条件 | 房间已链接，或任务阶段临时挂上；再过时间窗 / 日期窗 | 房间匹配 + 时间窗；若被任务门控，还需 `enabledCommitmentIds` |
| 点了之后 | 可带 Ink；可 `start` / `continue` 任务；推进时间 | 同上；并记 `metCommitmentKeys`（见过谁） |
| 同一角色多条日程 | — | 同时刻只保留 **priority 最高** 的一条 |

可以记成：

- **行为** = 事  
- **日程** = 人什么时候在哪  

对白都挂在各自的 `inkScriptId` 上，不挂在房间本体上（房间也可以有自己的 `inkScriptId`，但主交互路径是行为/日程）。

### 1.4 任务怎么推进

```
领取 start
  → 进入第一阶段 stageKey
  → 到天数 / flags 满足后，执行 on_start actions
       （add_activity 挂到房间 / add_commitment 启用日程）
  → 玩家再点关联行为或日程的 continue
  → 执行 on_continue，进入下一阶段或 completed
```

关键字段：

- `questProgress[questKey] = { stageKey, status, startedOnDay }`  
- `applied[]`：已经执行过的阶段动作键，防止重复挂内容  
- `attached[]`：任务临时挂到房间的 `{ activityId, roomId }`  
- `enabledCommitmentIds[]`：被任务启用的日程  
- `flags`：**整包携带**的标记（换章不丢）；通关会写 `chapterPassed:<chapterId>=true`

### 1.5 章怎么解锁

- 章按 `sortOrder` 排序  
- 第 1 章默认解锁；后面章要求**前一章已通关**  
- 通关判定：本章所有 Quest 都 `completed`；若本章没有 Quest，则至少成功谈过一次话（`talkedOnce`）  
- 通关标记写进 `flags`，所以存档跨章仍认得「哪章过了」

---

## 2. 和轻量剧情包、练习包的关系

| | 练习包 | 轻量剧情 `story` | **NQTR `nqtr`** |
|---|---|---|---|
| 主玩法 | 知识点练习 | 线性集数 Ink / 跟读 | 地图探索 + 时间 + 任务 + Ink |
| 内容单元 | Topic | Episode | **Chapter** |
| 离线 | learning pack | story pack | **`offlineNqtrBundle`** 整包 |
| 播放器 | 练习页 | `VnPlayer` 等 | **`NqtrWorldShell` + `VnStoryPreview`** |
| 学习名额 | 占「同时 3 包」 | 不占（剧本线） | 不占（剧本线） |

商店 / 剧本中心把 `story` 与 `nqtr` 都归在「剧本」侧；过滤时用 `packageType === 'nqtr' || contentMode === 'nqtr'`。

---

## 3. 端到端流程（玩家）

```
剧本中心看到互动小说包
  → 下载安装 Learning Package（内含 offlineNqtrBundle）
  → 打开包详情选章
  → 路由 /scripts/nqtr/:packageId?chapterId=...
  → NqtrPlayPage
       1. readStoredUnitDetail → 取 offlineNqtrBundle
       2. resolveInstalledNqtrBundle（媒体 URL 本地化）
       3. 读 hybrid 存档，算章节解锁
       4. 按本章 locationIds 过滤可见地点/房间
       5. 挂上 NqtrWorldShell（variant=player）
  → 玩家：地图 ↔ 地点 ↔ 房间 ↔ 点行为/角色
  → 进入 talk：loadStory(inkScriptId) → VnStoryPreview
  → 对白结束 finishTalk：推进任务 + 时间 + 存档
  → 退出 / 切后台：flushSave
```

### 3.1 一次「对话」在运行时发生了什么

```
openTalk
  → place = talk
  → 加载 Ink（inkJson / inkSource + assetMap）
  → VnStoryPreview 播放（holdLastLine，可关掉显示模式切换）
  → onDismiss / 结束 → finishTalk
       applyQuest(start|continue)
       addSpent(时间)
       syncStages（检查新阶段是否该挂内容）
       可能 markChapterPassed
       writeNqtrSaveHybrid
  → place 回到 room
```

没有 Ink 的行为/日程：仍会 `finishTalk`，只推进任务和时间，并 Toast 提示。

`trigger === 'auto'` 的行为或日程：进入房间且时间窗匹配时自动开谈（同一天同时段只自动一次）。

---

## 4. 运行时核心：`NqtrWorldShell`

这是 NQTR 的「游戏循环」容器。

**输入（世界数据）**：map / locations / rooms / activities / commitments / quests / characters / time / chrome  

**可变状态**：

- `session`：天、时、任务、flags、attached、enabledCommitmentIds、applied、log  
- `place`：当前空间模式  
- `metCommitmentKeys`：见过的日程键  
- 当前 Ink 与 debug  

**可见性规则（房间内）**：

1. **行为**：房间链接 **或** session.attached；且落在时间窗；且落在 `availableFromDate`～`availableUntilDate`  
2. **日程**：`roomId` 匹配；时间窗匹配；若该日程出现在某任务的 `add_commitment` 动作里，则必须已被 `enabledCommitmentIds` 启用；同角色只留最高 priority  

**存档时机**：位置变化防抖 400ms；对白结束立刻写；pagehide / 切后台 / 退出页 flush。

---

## 5. 数据包：`offlineNqtrBundle`

安装学习包时，后端 `buildOfflineNqtrBundle` 把 NQTR 世界打进详情：

- 包级：`map`、`time`、`chrome`、`characters`、全图 `locations` / `rooms`、`inkScripts`  
- 章级：`chapters[]`（标题、选用的 characterIds / locationIds，以及**该章**的 activities / commitments / quests）  

玩家进某一章时，前端用本章 `locationIds` 过滤地点，再过滤房间。  
**地图素材是整包共享的；行为 / 日程 / 任务是按章配置的。**

进入玩法前会 `resolveInstalledNqtrBundle`：把 bundle 里的远程媒体改成本地已装文件 URL（与轻量 VN 的「边播边 resolve」策略不同，NQTR 偏**进房前一次解析**）。

---

## 6. 存档模型

### 6.1 存什么

| 字段 | 含义 | 换章是否保留 |
|---|---|---|
| `gameDay` / `gameTime` | 时钟 | 保留 |
| `flags` | 全局标记（含通关） | **保留** |
| `questProgress` | 任务进度 | 保留（读档时带过来） |
| `currentMap/Location/RoomId` | 位置 | 仅同章恢复位置 |
| `runtime.attached` | 临时挂上的行为 | **仅同章** |
| `runtime.enabledCommitmentIds` | 启用的日程 | **仅同章** |
| `runtime.applied` | 已执行阶段动作 | **仅同章** |
| `runtime.metCommitmentKeys` | 见过谁 | **仅同章** |
| `inkState` | 预留；当前写存时常为 null | — |

读档时若存档章 ≠ 当前章：时钟 / flags / 任务带着；房间级 runtime 清空，从地图重新开始本章探索。

### 6.2 本地优先 Hybrid

```
读：有 localStorage → 立刻用；后台软拉云端，云端更新才覆盖
写：先写 localStorage → 再 PUT /nqtr/saves；失败进 sync outbox
```

后端：`GET/PUT /api/v1/manyu/nqtr/saves`，唯一键 `(userId, sceneId, slot)`，默认 slot=1。  
另有 `GET /nqtr/chapters?sceneId=` 供管理/列表用。

---

## 7. 作者侧数据怎么挂（编辑时想清楚）

推荐心智顺序：

1. **建包** `packageType=nqtr`，绑一张 `GameMap`，配 `nqtrTime` / `nqtrChrome` / 角色阵容  
2. **地图编辑**：地点坐标、房间、热点（写进 `editorData`）  
3. **建章**：选本章开放的地点与出场角色；可写教学 Markdown  
4. **本章内容**：  
   - 写 Ink 脚本  
   - 建 Activity，链到房间，设时间窗 / 耗时 / 任务动作  
   - 建 Commitment（角色 + 房间 + 时段 + Ink）  
   - 建 Quest 与 Stages；阶段 actions 决定「何时挂行为 / 启用日程」  
5. **发布学习包** → 生成带 `offlineNqtrBundle` 的安装包  

后台入口大致在：`admin-nqtr-page`、章工作室 `nqtr-chapter-studio`、地图 `maps/nqtr-model`、预览 `nqtr-package-preview`。

---

## 8. 代码地图

| 职责 | 位置 |
|---|---|
| 玩家页 | `features/nqtr/pages/nqtr-play-page.tsx` |
| 世界循环 UI | `features/nqtr/components/nqtr-world-shell.tsx` |
| 会话/任务/时间纯函数 | `features/nqtr/model/nqtr-session.ts` |
| 类型 | `features/nqtr/model/types.ts` |
| 时间与 Chrome | `features/nqtr/model/nqtr-time-chrome.ts` |
| 热点/房间布局读取 | `features/nqtr/model/exploration-read.ts` |
| 章节解锁 | `features/nqtr/lib/nqtr-chapter-progress.ts` |
| Hybrid 存档 | `features/nqtr/api/nqtr-local-save.ts` |
| 对白渲染 | `VnStoryPreview`（admin 组件，玩家页复用） |
| 离线媒体 | `lib/offline/installed-pack-media.ts` → `resolveInstalledNqtrBundle` |
| 后端存档 API | `modules/nqtr/nqtr.controller.ts` |
| 离线 bundle 构建 | `learning.service.ts` → `buildOfflineNqtrBundle` |
| Prisma | `GameMap/Location/Room/Activity/Commitment/Quest*`、`NqtrChapter*`、`GameSave`、`InkScript` |

---

## 9. 一张总图

```
                    ┌─────────────────────┐
                    │  NqtrChapter        │
                    │  开放地点 / 角色     │
                    │  本章 Quest/行为/日程 │
                    └──────────┬──────────┘
                               │ 过滤可见世界
┌──────────────┐    ┌──────────▼──────────┐    ┌─────────────────┐
│ GameMap      │───►│ NqtrWorldShell      │───►│ VnStoryPreview  │
│ Location     │    │ session + place     │    │ Ink 对白        │
│ Room + 热点  │    │ 可见 Activity/日程  │◄───│ 结束 → finishTalk│
└──────────────┘    └──────────┬──────────┘    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Hybrid GameSave     │
                    │ flags / quest / 时钟 │
                    └─────────────────────┘
```

---

## 10. 读代码时建议的顺序

1. `types.ts`：把表头概念对上 Type  
2. `nqtr-session.ts`：`applyQuest` / `syncStages` / `addSpent`（逻辑内核）  
3. `nqtr-world-shell.tsx`：`visible*` → `openTalk` → `finishTalk`（循环）  
4. `nqtr-play-page.tsx`：安装包如何进世界  
5. `nqtr-chapter-progress.ts` + `nqtr-local-save.ts`：章锁与存档  
6. Prisma `Game*` / `NqtrChapter` 注释：作者数据怎么落库  

---

## 11. 常见误解

| 误解 | 实际 |
|---|---|
| NQTR 是另一套对白引擎 | 对白仍是 Ink + VN；NQTR 管的是**探索与门控** |
| 房间上直接写剧情 | 主路径是 Activity / Commitment 的 `inkScriptId` |
| 任务完成 = 立刻播片 | 任务只改世界状态；播片要玩家再点（或 auto trigger） |
| 换章会丢掉 flags | flags 跨章保留；丢掉的是本章 runtime 挂载 |
| 和轻量包抢学习名额 | 两者都算剧本线，不占「同时 3 个学习包」 |

---

## 12. 与 Pixi-VN NQTR 对照

官方 NQTR 五块：**Navigation → Time → Activity → Routine → Quest**。  
本项目是「自研壳 + Ink/VN 对白」，概念对齐，但**不是**直接嵌入 `@drincs/nqtr` 运行时。

| Pixi-VN | 本项目现状 |
|---|---|
| Map → Location → Room + navigator | 有；用 `NqtrPlace` 状态机，无完整导航历史栈 |
| `timeTracker`（时钟 / 时段 / 跨天） | 有；记法同 `18.30 = 18:30` |
| Activity 挂房间、运行时 `addActivity` | 有（`roomLinks` + `session.attached`） |
| Commitment（人 + 房 + 时段 + priority） | 有 |
| Quest stage + start/continue + onStart 挂内容 | 有（`on_start` / `on_continue`） |
| 存档带运行时挂载 | Hybrid 存档有 |
| Inventory / 物品 | **无**（学习产品通常不需要） |
| Activity 任意 `onRun` 脚本 | **无**；固定「开 Ink / 推任务 / 耗时」 |
| Registered* 全局注册表 | **无**；数据在 DB + `offlineNqtrBundle` |

**结论：** 英语探索剧本所需的骨架已齐；缺口主要在「条件系统闭环」和若干已建模未接线的字段，而不是缺整块 NQTR 支柱。

---

## 13. 功能缺口（相对概念完整度）

### 13.1 高优先级：半实现（作者配了也未必生效）

| 缺口 | 现状 | 影响 |
|---|---|---|
| **Ink → flags 回写** | `InkEngine` 绑了 `setFlag`，NQTR 进 `VnStoryPreview` 时**未**写回 `session.flags` | `requiredFlags` 很难靠对白驱动；任务阶段易永久不就绪 |
| **`hiddenFlag` / `disabledFlag`** | Activity 库表与后台有；`NqtrWorldShell` 可见性**未读** | 不能「对话后藏掉某行为」，只能靠时间窗 / 任务挂载 |
| **地点/房间解锁条件** | `requiredFlags`、`requiredOutputLevel`、`requiredSceneIds` 有模型 | 运行时基本不用；章级仅靠 `locationIds` 白名单 |
| **`visitedRoomIds` 累计** | 存档每次几乎只写当前房间 | 「去过某地才开任务」做不了 |
| **`inkState`** | 字段在，写存时常为 `null` | 对白中途退出再进，Ink 进度不恢复（只恢复世界壳） |

若作者要写复杂门控，建议优先打通：**setFlag → session.flags**、**hidden/disabled/required 过滤**、**visited 累计 + 换章后 `syncStages`**。

### 13.2 中优先级：体验完整度

| 缺口 | 说明 |
|---|---|
| BGM / 环境音 | bundle 已解析 `bgmUrl` / `ambientUrl`，壳内不播 |
| 任务追踪 UI | 无「当前阶段 / startNote」面板（仅有内部 log） |
| 玩家跳时 | admin 有「下一时段/天」；player 几乎只能靠行为耗时 |
| 多档位存档 | slot 模型有，产品固定 slot=1 |
| 学习闭环 | 玩家页 `aiEvaluationEnabled={false}`；章词汇/chunk 与探索弱关联 |
| 离线契约 | 进房前一次 `resolveInstalledNqtrBundle`，不如轻量 VN 的 `offlineOnly` 严格 |

### 13.3 低优先级：Pixi-VN 有、本产品可长期不做

- Inventory / 物品系统  
- 完整 navigator 历史栈  
- `weekendStartDay` 真正参与日程逻辑（配置有，运行时几乎不用）  
- 任意 `onRun` / 全局 Registered 注册表（与 DB 导向架构重复）

---

## 14. 边界与失败场景

| 场景 | 风险 / 实际行为 |
|---|---|
| 对白里 `setFlag`，任务仍卡住 | flags 未进 session → `stageReady` 一直 false（见 §13.1） |
| 换章 | flags / questProgress 保留；`attached` / `enabledCommitmentIds` / `applied` 清空。A 章挂的行为在 B 章可能看不见，像「任务卡死」；内容需规范或换章重跑 `syncStages` |
| 无 Quest 的章通关 | 靠「至少谈过一次」；随便点一次也可能通关，锁章偏松 |
| `trigger=auto` | 进房且时间窗匹配即自动开谈；同日同时段只一次。快速进出 / 跳时段可能漏触发或突兀 |
| 同角色多条日程重叠 | 只保留 priority 最高；低 priority 完全不可见，作者难排查 |
| 跨午夜时间窗 `from > to` | 已支持；与 `addSpent` 跨 `dayEndTime` 叠加时需内容侧实测 |
| 对白中途 dismiss | 直接 `finishTalk`（推任务 + 时间），不等于「读完才算完成」 |
| Hybrid 存档双端 | 本地优先；双设备可能旧本地盖住云端或反之 |
| 媒体一次解析失败 | 可能静默空底，不会像 `VnPlayer offlineOnly` 硬失败 |
| 章未解锁仍带深链 `chapterId` | 播放页挡回「请先完成前面的章节」 |

---

## 15. 一句话收束

> **NQTR = 带时钟的探索壳；Ink = 壳上挂的对话；Quest = 控制壳上何时出现什么；存档 = 把壳的状态本地优先写下。**  
> **相对 Pixi-VN：五块骨架已齐；优先补「对白 ↔ flags / 显隐条件」闭环，而不是补 inventory。**
