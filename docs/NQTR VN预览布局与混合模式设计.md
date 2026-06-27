# NQTR VN 预览布局与混合模式设计

## 背景

当前后台路径 `#/admin/nqtr` 的故事工坊预览由 `InkStoryEditor` 挂载 `VnStoryPreview`，再由 `VnStoryPreview` 驱动 `InkEngine` 和 `VnPlayer` 渲染。

现状特点：

- `VnStoryPreview` 自己维护 `InkEngine`、`history`、`choices`、`isWaiting`、`currentTags`、`activeBackground`。
- `VnPlayer` 默认是竖屏 VN 容器，宽度约 `420px-520px`，底部覆盖对白框。
- `VnPlayer` 内部已有 `displayMode: 'vn' | 'chat'`，但这是播放器设置里的 VN / 聊天列表切换，不等同于本次要做的「预览布局模式」。
- 项目中已有 `parseComposer()` 函数，可以将 Ink 脚本解析为结构化的 `ComposerScene[]`（每景包含 line/choice/background/wait/divert 等 item）。当前它在 `ink-story-editor.tsx` 内部，落地前需要先抽到 admin 共享模块。
- 竖屏/横屏模式继续使用 InkJS 引擎驱动，保持现有逻辑不变。

本设计只针对 admin 预览区先落地，避免影响正式练习页。确认体验稳定后，再把通用能力沉淀到 `features/vn-engine`。

## 核心设计决策

**混合模式不使用 InkJS 引擎**。它直接将 `parseComposer()` 产出的 `ComposerScene[]` 铺平成一条线性帧列表（`MixedTimelineFrame[]`），像视频时间轴一样可以任意 seek。每帧自包含渲染所需的全部场景状态，点击任意帧即为 seek 到该位置。

## 目标

在故事工坊「预览」tab 增加三种预览布局：

1. **竖屏**：保持当前手机竖屏 VN 预览。
2. **横屏**：新增按钮切换为横屏舞台，适合检查背景、立绘在 16:9 画幅里的表现。
3. **混合模式**：整体仍是竖屏预览容器，上半区显示横屏 Pixi VN 舞台，下半区显示类似歌词栏的滚动台词列表。它是纯线性时间轴预览模式，**不使用 InkJS 引擎驱动**，而是直接将 `parseComposer()` 解析出的 `ComposerScene[]` 铺平成一条扁平帧列表。点击任意帧即跳转到对应位置（类似视频进度条的 seek 逻辑），Pixi 舞台同步渲染该帧的场景状态。

## 非目标

- 不在第一版改正式用户练习页。
- 不改变 Ink 脚本语法。
- 不重写 `InkEngine` 的核心运行逻辑（竖屏/横屏模式继续使用 InkJS 引擎）。
- 不把 `VnPlayer` 的内部 `displayMode` 当作本次布局模式；两个概念需要分开。
- 混合模式不做分支预览 —— 遇到选项节点时只展示当前选项组，并默认沿第一个选项的 target 展开后续帧，不展示多分支分叉。

## Wait/Input 默认回答

混合模式需要能完整播放一段包含 `# wait:input` 的 VN，但它本身不允许管理员手动输入。因此故事工坊的「等待用户输入」节点需要新增一个属性：**默认回答**。

建议 Ink tag：

```ink
# objective:Greet the receptionist and introduce yourself
# hint:Try using "I'm here to check in."
# chunks:I'm here to..., My name is...
# defaultAnswer:Hi, I'm Alex. I'm here to check in.
# wait:input
```

规则：

- `defaultAnswer` 只用于 admin 混合模式自动推进，不代表正式用户答案，也不用于竖屏/横屏试玩模式的自动填充。
- 竖屏/横屏模式仍显示输入框，管理员可以手动输入；如果需要，也可以提供一个"一键填入默认回答"的辅助按钮。
- 混合模式不显示输入框。遇到 `# wait:input` / `# input` 时：
  - 有 `defaultAnswer`：在线性帧列表中追加一条 `You` 的 `userInput` 帧，然后从静态 composer 数据继续展开后续帧。
  - 没有 `defaultAnswer`：停在当前等待节点，在歌词栏显示"缺少默认回答"，并提示回到编排区补充。
- 混合模式不显示 `objective`、`hint`、`chunks` 等练习目标和提示；这些标签仍可被竖屏/横屏试玩模式和正式练习使用。
- 如果开启 AI 评估，混合模式第一版建议跳过 AI 请求，直接使用默认回答推进，避免只读预览被异步评估卡住。AI 评估仍保留给竖屏/横屏试玩模式。

编辑器改造：

- `ComposerItem.type === 'wait'` 增加 `defaultAnswer?: string`。
- 属性面板在"等待用户输入"开启时显示"默认回答"输入框。
- `serializeComposer()` 在 `# wait:input` 前输出 `# defaultAnswer:${encodeURIComponent(defaultAnswer)}`。
- `parseComposer()` 支持从 `# defaultAnswer:` 读回该字段，并用 `decodeURIComponent()` 解码；解码失败时保留原始字符串。解析时如果上一项是 wait，则挂到上一项；否则先创建一个 `requiresInput: true` 的 wait item，后续 `# wait:input` 再更新同一个 item。
- `defaultAnswer` 只允许单行文本；如果属性面板未来支持多行，保存前需要把换行折叠为空格或转义成安全文本，避免破坏 Ink tag 结构。

## 交互设计

### 预览模式按钮

在故事工坊「预览」tab 的预览卡片顶部增加一组 segmented control：

- 竖屏
- 横屏
- 混合

建议图标：

- 竖屏：`Smartphone`
- 横屏：`Monitor`
- 混合：`PanelTop`

状态持久化：

- 使用 `localStorage` 保存 admin 预览布局，例如 `manyu-admin-vn-preview-layout`。
- 只影响 admin 预览，不影响 `manyu-vn-player-settings`。

### 竖屏模式

继续使用当前布局：

- 左侧预览容器 `h-[78vh] max-h-[760px] max-w-[420px]`。
- `VnPlayer` 完整显示 Pixi 舞台、对白框、选项、输入框、重置按钮。
- 当前行为保持不变。

### 横屏模式

横屏模式用于检查 VN 画面本身：

- 预览容器切换为移动端横屏尺寸，建议按 `844:390` 比例渲染，最大宽度约 `720px`，避免在后台调试区显得过宽。
- 舞台按移动端横屏画幅渲染，不再按桌面宽屏铺满调试区。
- 对白框仍保留在底部，但高度需要按横屏显著缩小，避免遮挡过多画面。
- 调试面板仍在右侧。

建议第一版实现方式：

- 给 `VnStoryPreview` 增加 `previewLayout: 'portrait' | 'landscape' | 'mixed'`。
- 给 `VnPlayer` 增加轻量 prop：`frameVariant?: 'portrait' | 'landscape'`。
- `landscape` 下调整容器 class：
  - 去掉 `max-w-[520px]` 限制，改为 `max-w-[720px]`。
  - stage 使用移动端横屏比例，例如 `aspect-[844/390]`。
  - `getDialogueHeight()` 的横屏策略改为更低，例如 `min(max(height * 0.18, 72), 112)`。

### 混合模式

混合模式整体是竖屏容器，但内部上下分区：

```text
┌─────────────────────────┐
│  横屏 Pixi VN 舞台       │  上半区，16:9
│  背景 + 立绘 + 选项       │
├─────────────────────────┤
│  歌词式滚动帧列表         │  下半区
│  当前帧高亮              │
│  点击任意帧 seek 到该位置  │
└─────────────────────────┘
```

布局建议：

- 外层仍保持手机竖屏宽度，约 `max-w-[420px]`。
- 上半区固定 `aspect-video`，只显示横屏 VN 舞台。
- 上半区底部信息层第一行显示角色名，第二行显示当前内容；不显示 `start`、帧序号、场景名等调试信息。
- 下半区 `flex-1 overflow-y-auto`，显示帧列表。
- 当前帧自动滚动到可视区域居中。
- 不显示用户输入框；它是纯线性时间轴预览。
- 不显示当前轮的目标、提示、推荐句块等练习辅助信息，只保留剧情预览所需内容。
- **点击任意帧** → 像视频进度条一样 seek：
  - 列表高亮该帧。
  - 上方 Pixi 背景、立绘、角色位置、当前对白直接切换到该帧携带的场景状态。
  - 无需 InkJS 引擎参与，帧数据自包含所有渲染所需信息。
- 支持**拖拽时间轴**（可选的增强交互）：在列表旁加一条迷你进度条，拖拽快速定位。

### 混合模式播放设置

mixed 模式需要支持把已生成 TTS 的台词当作逐句练习材料播放。交互应参考竖屏/横屏 `VnPlayer`：主界面保留播放、跟读和设置按钮，具体播放参数放进设置 Dialog。

- 播放 / 暂停按钮：按当前 `activeFrameIndex` 开始自动播放。
- 设置按钮：打开 mixed 专用播放设置 Dialog。
- 设置 Dialog 字段：
  - 句间间隔：默认 `1s`，可选 `0.5s / 1s / 2s / 3s`。
  - 循环次数：默认 `1`，可选 `1 / 2 / 无限循环`。
- 自动推进规则：
  - 当前帧有 `audioUrl`：播放 TTS，音频结束后等待句间间隔，再跳到下一帧。
  - 当前帧没有 `audioUrl`：按文本长度估算展示时长（第一版可用 `max(1.2s, text.length * 80ms)`），再等待句间间隔。
  - `choice` 帧：显示选项约 `1s` 后继续默认分支下一帧。
  - `missingInput` 帧：停止自动播放，避免无限跳过内容缺口。
  - 到达末尾：如果循环次数未用完，从第一帧重新播放；无限循环则持续循环。
- 播放设置只保存在 mixed player 本地 state，第一版不写入 `VnPlayer` 全局设置，避免影响正式练习页。

### 混合模式跟读 Drawer

因为 VN 台词会批量生成 TTS，mixed 模式可以承担“逐句听读 / 跟读检查”的内容生产辅助场景。

第一版在 mixed player 中增加一个“跟读”按钮：

- 打开 drawer 后展示当前帧文本、角色名和可选翻译。
- 支持播放当前句 TTS。
- 支持本地录音、停止、回放、重录。
- 录音结果第一版只保存在当前 drawer 会话中，用于人工听感检查；不上传、不转写、不请求 AI、不写入练习记录。
- 列表中的每一项都显示跟读按钮；`missingInput` 帧禁用跟读入口。录音完成后，该行跟读按钮下方显示回放按钮。
- 后续增强可以接入发音评分、保存样例录音、或把跟读结果沉淀到内容质检记录。

## 混合模式数据模型

混合模式**不使用 InkJS 引擎**，不依赖 `saveState()` / `loadState()`。数据模型的核心是一条**自包含的线性帧列表**，从 `parseComposer()` 的结果直接扁平化生成。

### 帧数据结构

```ts
type PreviewLayout = 'portrait' | 'landscape' | 'mixed'

/** 混合模式时间轴中的一帧 */
interface MixedTimelineFrame {
  /** 帧序号（从 0 开始） */
  index: number
  /** 帧类型 */
  kind: 'line' | 'choice' | 'userInput' | 'missingInput'
  /** 角色名（You / NPC名 / 空=旁白） */
  speaker: string
  /** 对白文本 */
  text: string
  /** 表情名 */
  expression: string
  /** 立绘位置 */
  position: 'left' | 'center' | 'right'
  /** 翻译 */
  translation?: string
  /** 音频 URL */
  audioUrl?: string
  /** 数据来源 */
  source: 'ink' | 'choice' | 'defaultAnswer' | 'system'
  /** 所在场景名 */
  sceneName: string
  /** 场景内 item 索引（可追溯回 ComposerScene） */
  sceneItemIndex: number

  /** 背景信息（自包含 — 不需要引擎上下文推导） */
  background: {
    url?: string
    fit?: 'cover' | 'contain' | 'stretch' | 'repeat'
  }

  /** 立绘信息（自包含 — 已解析完的完整 URL） */
  sprite: {
    speaker?: string
    expression?: string
    position: 'left' | 'center' | 'right'
    url?: string
    avatarUrl?: string
  }

  // ─── 仅 choice 帧 ───
  /** 选项列表（仅 kind === 'choice'） */
  choices?: { index: number; text: string; target: string }[]
  /** 选项时是否隐藏角色立绘 */
  hideSpriteForChoices?: boolean
  /** 默认跟随的分支目标场景名 */
  defaultBranchTarget?: string

  // ─── 仅 missingInput 帧 ───
  /** 缺少默认回答标记（仅 kind === 'missingInput'） */
  missingDefaultAnswer?: boolean

  // ─── 分支标记 ───
  /** 是否在默认分支路径上（用于 UI 视觉标记） */
  onDefaultBranch?: boolean
}
```

### 关键设计要点

- **帧自包含**：每帧携带渲染该时刻所需的全部场景状态（speaker / expression / position / background / sprite），不需要引擎运行时上下文。
- **无引擎依赖**：帧列表是纯粹的静态数据，不依赖 InkJS 引擎的 `saveState()` / `loadState()` / `continue()` / `choose()`。混合模式的 `VnMixedPreviewPlayer` 是一个纯展示组件。
- **背景继承**：线性化过程中，遇到 `background` item 时更新"当前背景"，后续帧自动携带该背景。每帧的 `background` 字段始终正确，不需要推断。
- **选项组处理**：当前 composer 里每个选项是一个独立 `choice` item。线性化时需要把连续的 `choice` items 合并成一个 choice group，生成一个 `kind: 'choice'` 帧；该帧的 `choices` 数组包含同组选项。
- **默认分支处理**：遇到 choice group 时，默认跟随第一个选项的 `target` 路径继续展开。生成的后续帧标记 `onDefaultBranch: true` 以便 UI 层做视觉区分（如时间轴上标注「默认分支」）。
- **跳转跟随**：遇到 `divert` item 时，查找目标场景并从该场景开头继续展开，保持线性顺序。divert 本身不生成帧。
- **等待输入处理**：遇到 `requiresInput` 的 wait item 时，如果存在 `defaultAnswer`，追加一条 `kind: 'userInput'` 的 `You` 帧；如果没有，追加一条 `kind: 'missingInput'` 帧并停止继续展开。这里不设置 Ink 变量，也不运行 Ink 引擎。
- **安全上限**：最大帧数设 500 帧上限，防止循环跳转导致无限展开。

## 混合模式跳转方案（无引擎，纯数据 seek）

混合模式的跳转不涉及 InkJS 引擎，是纯数据 seek：

1. 用户点击歌词栏中的 `MixedTimelineFrame[index]`。
2. `setActiveFrameIndex(index)`。
3. 上方 Pixi 舞台直接从 `frames[index]` 读取所有自包含字段（`background`、`sprite`、`speaker`、`text`、`choices` 等）渲染。
4. 下方帧列表高亮当前帧，自动滚动到可视区域。
5. 不需要 saveState / loadState，不需要恢复 `pendingRef`，不需要处理 AI 评估状态，也不存在"跳回后继续推进并改写后续 timeline"。

混合模式的帧列表在 `inkSource`、角色素材、默认背景变化时重新生成。点击只改变 `activeFrameIndex`，不会改变 frames 本身。

## 组件改造建议

### `InkStoryEditor`

职责：

- 增加 `previewLayout` state。
- 在预览 tab 顶部显示模式切换按钮。
- 把 `previewLayout` 传给 `VnStoryPreview`。
- 把当前私有的 `ComposerItem`、`ComposerScene`、`parseComposer()`、`serializeComposer()` 抽到共享模块，例如 `apps/frontend/src/features/admin/components/composer-parser.ts`，供编辑器和 mixed 线性化逻辑共同使用。
- 按 layout 调整预览区域 grid：
  - 竖屏/混合：左列维持 `minmax(360px,460px)`。
  - 横屏：左列可扩为 `minmax(560px,900px)`，或在 `xl` 下给预览更大空间。

### `VnStoryPreview`

职责：

- 接收 `previewLayout`。
- **竖屏/横屏模式**：继续使用 InkJS 引擎驱动，维护 `history`、`choices`、`isWaiting`、`activeBackground` 等现有状态，负责 AI preview、debug payload。
- **混合模式**：根据 `inkSource` 调用共享 `parseComposer()`，再调用 `flattenComposerToTimeline()` 生成 `MixedTimelineFrame[]`，维护 `activeFrameIndex`。不初始化 InkJS 引擎，不调用 `InkEngine.load()`，也不触发 AI preview。
- 根据 layout 渲染：
  - `portrait` / `landscape`：使用 `VnPlayer`。
  - `mixed`：使用新的 `VnMixedPreviewPlayer`。

建议把"从 speaker / expression / position 推导立绘、头像和位置"的逻辑提成 helper，避免 `VnPlayer` 和混合播放器重复。mixed 模式不从 `currentTags` 推导状态，而是从 `ComposerItem` 和继承上下文生成帧。

### `flattenComposerToTimeline()`

建议路径：`apps/frontend/src/features/admin/components/vn-mixed-timeline.ts`

职责：

- 输入 `ComposerScene[]`、角色立绘映射、头像映射、角色默认位置、默认背景。
- 输出自包含的 `MixedTimelineFrame[]`。
- 合并连续的 `choice` items 为一个 choice group。
- choice group 默认取第一个选项的 target 继续展开。
- `wait.requiresInput && defaultAnswer` 时生成 `userInput` 帧。
- `wait.requiresInput && !defaultAnswer` 时生成 `missingInput` 帧并停止展开。
- `divert` 跳转到目标 scene；目标为 `END` 时停止。
- 使用 `visited` / `safetyCounter` 防止循环，最大 500 帧。

### `VnPlayer`

第一版只做低风险扩展：

- 新增 `frameVariant?: 'portrait' | 'landscape'`。
- 横屏时改变外层 max width、stage 高度、对白框高度。
- 不把歌词栏逻辑塞进 `VnPlayer`，避免播放器继续膨胀。

### `VnMixedPreviewPlayer`

新建 admin 专用组件：

路径建议：`apps/frontend/src/features/admin/components/vn-mixed-preview-player.tsx`

职责：

- 上半区渲染横屏 Pixi VN 舞台。
- 下半区渲染 timeline list。
- 接收 `frames: MixedTimelineFrame[]`、`activeIndex: number`、`onJumpTo(index: number)`。
- 纯展示组件，不依赖 InkJS 引擎。
- 点击帧列表项 → seek 到该帧，Pixi 舞台直接从帧数据渲染。
- 内部维护 mixed 专用播放设置：播放状态、句间间隔、循环次数、当前循环轮次。
- 提供跟读 drawer：当前帧 TTS 播放 + 本地录音回放，不触发正式练习提交。

不显示：

- 用户输入框。
- AI 评估输入反馈。
- 目标、提示、推荐句块等练习辅助信息。

### `PixiVnStage`

当前 `PixiVnStage` 在 `vn-player.tsx` 内部。为了 mixed 模式复用横屏舞台，建议先抽成独立组件，例如：

`apps/frontend/src/features/vn-engine/pixi-vn-stage.tsx`

扩展点：

- `stageVariant?: 'portrait' | 'landscape' | 'mixed'`
- `dialogueOverlay?: boolean`
- `spriteBottomInset?: number`

竖屏/横屏 `VnPlayer` 可以继续传 `dialogueOverlay=true`，mixed 上半区传 `dialogueOverlay=false`，避免立绘布局仍按底部对白框预留空间导致偏高或偏小。

## 歌词栏视觉规则

列表项内容：

- 角色名 / You / 旁白。
- 原文。
- 可选翻译。
- 默认回答生成的 `You` 句用右侧或浅色强调，并可显示一个"默认回答"小标记。
- 列表项不要做卡片边框和独立背景，整体更像歌词列表。
- 当前句只做文字高亮，不加整块背景，不贴卡片边缘。
- 每一行不显示序号和左侧类型图标。
- 每一行右侧显示跟读按钮，点击后跳转到该帧并打开跟读 drawer；录音完成后在跟读按钮下方显示该句录音回放按钮。
- 缺少默认回答时显示错误态列表项，提示补充 `defaultAnswer`。

滚动行为：

- `activeIndex` 改变时自动滚到当前句。
- 用户手动滚动时不强制抢滚，除非 activeIndex 因点击或键盘操作改变。
- 点击句子后滚动到该句并高亮。

空状态：

- 帧列表为空时显示"当前脚本没有可预览台词"。
- Ink 编译失败时沿用当前错误展示。

## Debug 面板调整

`PreviewDebugPanel` 可以新增两个字段：

- 当前布局：`portrait / landscape / mixed`
- Timeline：`${timeline.length} 条`

竖屏/横屏模式的 AI payload 仍从 `history` 生成。mixed 模式不生成 AI payload，只展示 frame count、active frame 和缺失默认回答数量。

## 验收标准

1. 预览 tab 有竖屏、横屏、混合三个按钮，刷新后保留上次选择。
2. 竖屏模式视觉和现有行为一致。
3. 横屏模式能以 16:9 检查背景和立绘，不出现画面空白、对白框严重遮挡或按钮溢出。
4. 混合模式上半区是横屏 VN 舞台，下半区是可滚动台词列表。
5. 混合模式不显示用户输入框。
6. 混合模式不显示 objective、hint、chunks 等目标和提示信息。
7. 混合模式遇到等待用户输入 tag 时，使用 `defaultAnswer` 生成 `You` 帧，并从静态 composer 数据继续展开后续帧。
8. 混合模式遇到缺少 `defaultAnswer` 的等待输入节点时，停止展开后续帧并在歌词栏提示缺失默认回答。
9. 混合模式当前句自动高亮，并在 activeIndex 变化时滚动到可见位置。
10. 点击任意帧后，Pixi 背景、立绘、当前对白与该帧自包含状态一致。
11. 混合模式不调用 InkJS，不使用 `saveState()` / `loadState()`，不设置 `user_last_input`，不触发 AI 评估。
12. mixed 播放设置可控制播放/暂停、句间间隔、循环一次/两次/无限循环。
13. mixed 当前句有 TTS 时优先按 TTS 结束推进，没有 TTS 时按文本时长估算推进。
14. mixed 跟读 drawer 可以播放当前句 TTS、录音、停止、回放、重录，且不上传、不转写、不触发 AI。
15. 竖屏/横屏试玩模式里的选项、等待输入、AI 评估通过/失败都能保持现有逻辑。
16. 不影响正式练习页的 `VnPlayer` 默认体验。

## 推荐实施顺序

1. 抽出 `composer-parser.ts`，共享 `ComposerItem`、`ComposerScene`、`parseComposer()`、`serializeComposer()`。
2. 给等待节点增加 `defaultAnswer` 的 parse/serialize 和属性面板，序列化时使用 `encodeURIComponent()`。
3. 先加 `PreviewLayout` state 和三个模式按钮。
4. 抽出 `PixiVnStage`，给 `VnPlayer` 增加 `frameVariant='landscape'`，完成横屏模式。
5. 实现 `flattenComposerToTimeline()`：背景继承、连续 choice 合并、默认取第一个选项、divert 跳转、defaultAnswer userInput、missingInput 停止。
6. 新建 `VnMixedPreviewPlayer`，接入 timeline list 和纯数据 seek。
7. 增加 mixed 播放控制：播放/暂停、句间间隔、循环次数、TTS 结束后自动推进。
8. 增加 mixed 跟读 drawer：当前句 TTS 播放、本地录音、回放、重录。
9. 在 `VnStoryPreview` 里接入 mixed 分支：mixed 不初始化 InkJS，不触发 AI preview。
10. 补充最小测试或手动用例：普通对白、连续选项默认第一项、divert、等待输入、缺少默认回答、默认回答生成 You 帧、横屏布局、自动播放、循环、跟读录音、竖屏/横屏 AI 评估不回归。

## 风险点

- 混合模式是只读自动推进，不能把 `defaultAnswer` 写入正式用户练习结果，也不能让它影响竖屏/横屏试玩模式的输入行为。
- mixed 模式不跑 InkJS，因此任何 Ink 运行时变量、条件判断、函数调用都不会生效。第一版只支持 composer 能静态表达的线性内容。
- 连续 choice items 必须作为一组选项处理；如果逐条处理，会把同一组选项错误展开成多个节点。
- `defaultAnswer` 必须编码序列化，避免特殊字符破坏 tag。
- mixed 自动播放要在组件卸载、切换布局、手动 seek、打开跟读录音时停止当前 TTS，避免多个音频同时播放。
- 跟读 drawer 第一版只做本地录音回放，不要复用会转写并提交的正式输入 drawer。
- 横屏和混合模式会改变 Pixi 容器尺寸，需要确认 `ResizeObserver` 能触发布局刷新。
- 当前 `PixiVnStage` 在 `vn-player.tsx` 内部，混合模式要复用时需要拆出，避免复制 Pixi 初始化逻辑。
