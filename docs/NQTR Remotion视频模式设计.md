# NQTR Remotion 视频模式设计

## 背景

当前 `#/admin/nqtr` 的 mixed 模式已经把 VN 脚本从 InkJS 运行态里抽出来，转成一条可 seek 的 `MixedTimelineFrame[]`：

- 上半区：横屏 VN 舞台。
- 下半区：歌词式台词 list。
- 支持逐句播放、句间间隔、循环次数。
- 支持每一项跟读、录音、回放。
- `# wait:input` 可以通过默认回答生成 `You` 帧。
- 默认回答也可以生成 MiniMax 音频，用于 mixed 自动播放。

下一步需要新增一个 **视频模式**：业务能力与 mixed 模式一致，但渲染层使用 React + Remotion。第一阶段先在 admin 里实现可播放的视频预览；后续再接入服务端导出 MP4。

Remotion 选型依据：

- `@remotion/player` 可以嵌入普通 React/Vite 应用，并用 React component + `inputProps` 动态播放视频内容。
- `@remotion/renderer` 的 `renderMedia()` 可以在 Node 侧程序化渲染视频或音频，为后续导出 MP4 留出路径。

参考官方文档：

- Remotion Player: https://www.remotion.dev/docs/player/player
- Remotion renderMedia: https://www.remotion.dev/docs/renderer/render-media
- Remotion Player examples: https://www.remotion.dev/docs/player/examples

## 目标

在故事工坊预览 tab 中，在现有三种布局之外增加第四种：

1. 竖屏：现有 InkJS + VN Player。
2. 横屏：现有 InkJS + VN Player 横屏容器。
3. 混合：现有 Pixi stage + 歌词 list + 跟读。
4. **视频**：Remotion Player + 歌词 list + 跟读，后续支持导出 MP4。

视频模式需要满足 mixed 模式同一套业务需求：

- 上下布局：上半区是 VN 视频画面，下半区是歌词 list。
- 台词 list：逐句高亮、点击 seek、自动滚动。
- 播放设置：自动播放、句间间隔、循环次数。
- 跟读 drawer：每一项都能跟读、录音、回放。
- 默认回答：`# wait:input` 用 `defaultAnswer` 生成 `You` 帧，并可播放 `defaultAnswerAudio`。
- 音频：优先播放帧上的 `audioUrl`，没有音频则按文本长度估算时长。

新增视频模式特有能力：

- 用 Remotion 的时间轴表达每一句台词的起止帧。
- 用 Remotion Player 做 frame-accurate 预览和 seek。
- 后续可把同一份 composition 输入给后端 `renderMedia()` 导出 MP4。
- 支持基于用户跟读录音生成个性化视频：某一句有用户录音时使用用户录音，没有用户录音时回退原始 TTS。

## 非目标

- 第一版不替换 mixed 模式。mixed 继续保留 Pixi 实时预览。
- 第一版不把跟读录音渲染进视频文件；跟读仍是 admin 交互 UI。
- 第一版不在正式用户练习页启用视频模式。
- 第一版不要求视频导出完成；先完成 Remotion Player 预览结构。
- 第一版不复用 Pixi canvas 进入 Remotion。视频模式应使用 React DOM / CSS / image / audio 重新表达 VN 画面，避免 WebGL/canvas 在无头渲染和导出时不稳定。

## 用户体验

### 预览模式入口

预览 tab 顶部 segmented control 增加：

- 竖屏
- 横屏
- 混合
- 视频

建议图标：

- 视频：`Clapperboard` 或 `Film`

`localStorage` 的布局值扩展为：

```ts
type PreviewLayout = 'portrait' | 'landscape' | 'mixed' | 'video'
```

### 视频模式布局

视频模式整体仍是手机竖屏工作台，结构与 mixed 一致：

```text
┌────────────────────────────┐
│ Remotion Player             │
│ VN 背景 / 立绘 / 当前台词     │
├────────────────────────────┤
│ 歌词式台词 list              │
│ 当前句高亮                   │
│ 每项跟读 / 录音回放           │
└────────────────────────────┘
```

建议尺寸：

- 外层：`max-w-[420px]`，高度沿用 mixed 的 `h-[78vh] max-h-[760px]`。
- 视频画布：第一版使用 `1080 x 1920` 竖屏 composition。
- composition 内部上半区是 `16:9` VN 舞台，下半区可以渲染当前歌词/字幕。
- admin UI 的歌词 list 仍在 Remotion Player 下方，由普通 React 控件渲染，不进入视频画面。

### 视频画面内容

Remotion composition 画面建议分为两层：

1. VN Stage 层
   - 背景图。
   - 立绘图。
   - 当前角色名。
   - 当前台词。
   - 可选翻译。

2. Caption / Lyric 层
   - 当前句大字幕。
   - 上一句 / 下一句弱化显示。
   - 当前进度条。

注意：admin 页面下方已经有完整歌词 list，因此 composition 内部不要再塞完整 list，避免画面拥挤。导出视频时可以保留当前句字幕和上下文提示。

### 歌词 list

与 mixed 保持一致：

- 不显示序号。
- 不显示左侧类型 icon。
- 当前项只用文字高亮。
- 每项右侧有跟读按钮。
- 跟读录音完成后，在跟读按钮下方显示回放按钮。
- 点击某一项时：
  - Remotion Player seek 到该项起始 frame。
  - list 高亮该项。
  - 当前自动播放/TTS/录音回放状态需要互斥。

### 播放设置

视频模式复用 mixed 的播放设置 Dialog：

- 句间间隔：`0.5s / 1s / 2s / 3s`
- 循环次数：`1 / 2 / 无限循环`
- 自动播放按钮：播放 / 暂停
- 设置按钮：打开 Dialog

区别：

- mixed 模式现在由 JS timer + HTMLAudioElement 驱动。
- 视频模式应优先由 Remotion frame 驱动：
  - 每个 frame 有 `startFrame` / `endFrame`。
  - 点击播放时调用 Player 播放。
  - 点击暂停时调用 Player 暂停。
  - 点击 list 时调用 `playerRef.current.seekTo(startFrame)`。

### 跟读 drawer

跟读 drawer 仍是 admin UI，不进入 Remotion composition：

- 打开 drawer 后暂停 Remotion Player。
- 展示当前台词、翻译、角色名。
- 支持播放当前 TTS。
- 支持录音、停止、回放、重录。
- 录音结果仅保存在当前编辑会话内。

## 数据模型

视频模式不重新解析 Ink，而是复用 mixed 的 `MixedTimelineFrame[]`。

新增一个派生结构：

```ts
interface RemotionTimelineFrame extends MixedTimelineFrame {
  startFrame: number
  endFrame: number
  durationFrames: number
  startSeconds: number
  endSeconds: number
}

interface RemotionVideoInput {
  fps: 30
  width: 1080
  height: 1920
  frames: RemotionTimelineFrame[]
  theme: {
    backgroundColor: string
    textColor: string
    accentColor: string
  }
}
```

帧时长规则：

- 有 `audioUrl`：优先使用音频真实时长。
- 没有 `audioUrl`：使用估算时长 `max(1.2s, text.length * 80ms)`。
- choice 帧：默认 `1s`。
- missingInput 帧：默认 `2s`，并停止自动播放。
- 每一帧之后追加句间间隔。

第一版如果音频时长不易拿到，可以先沿用 mixed 的估算逻辑；后续通过浏览器 `HTMLAudioElement.loadedmetadata` 或后端音频 metadata 缓存补准。

## Remotion 组件结构

建议新增目录：

```text
apps/frontend/src/features/admin/remotion/
  nqtr-video-composition.tsx
  nqtr-video-player.tsx
  nqtr-video-timeline.ts
  nqtr-video-types.ts
```

组件职责：

### `buildRemotionTimeline()`

输入：

- `MixedTimelineFrame[]`
- 播放设置：`gapSeconds`, `fps`

输出：

- `RemotionTimelineFrame[]`
- `durationInFrames`

职责：

- 计算每个台词帧的起止 frame。
- 建立 `frameIndex -> startFrame` 映射。
- 建立 `currentFrame -> activeTimelineIndex` 映射。

### `NqtrVideoComposition`

Remotion composition 本体。

职责：

- 使用 `useCurrentFrame()` 获取当前 frame。
- 根据当前 frame 找到 active timeline item。
- 渲染背景、立绘、角色名、台词、翻译、字幕和进度。
- 使用 Remotion `<Audio />` 播放当前帧音频。

注意：

- 图片必须可被浏览器和渲染端访问。
- COS 私有 URL 有过期时间，后续导出 MP4 时需要确保 URL 在渲染期间有效，或改用后端代理/临时签名。
- 尽量使用普通 `<img>`、CSS transform、opacity 动画，不依赖 Pixi/WebGL。

### `NqtrVideoPlayer`

admin 页面里的包装组件。

职责：

- 渲染 `@remotion/player` 的 `<Player />`。
- 持有 `PlayerRef`。
- 同步 `activeFrameIndex`。
- 暴露 `seekToTimelineFrame(index)`。
- 接收播放设置。

### `NqtrVideoPreviewPlayer`

与 `VnMixedPreviewPlayer` 对齐的完整业务组件。

职责：

- 上半区：`NqtrVideoPlayer`
- 下半区：歌词 list
- 顶部控制：播放、跟读、设置
- Drawer：跟读录音
- 播放互斥：TTS / Remotion / 用户录音只能同时播放一个

## 与 mixed 模式的关系

建议抽一个共享 hook，避免 mixed 和 video 两边复制业务逻辑：

```ts
function useNqtrPracticeTimeline(frames: MixedTimelineFrame[]) {
  return {
    activeIndex,
    setActiveIndex,
    recordingUrls,
    saveRecordingUrl,
    playingRecordingIndex,
    playRecording,
    stopRecordingPlayback,
    canFollowFrame,
  }
}
```

mixed 和 video 的区别应该只在“上半区渲染器”：

- mixed：`PixiVnStage`
- video：`Remotion Player`

下方歌词 list、跟读 drawer、录音回放、播放设置尽量共用。

## 后端导出方案

第一版不实现导出，但文档先定义路径。

建议新增接口：

```text
POST /admin/content/stories/:id/render-video
```

后端流程：

1. 读取故事 Ink source。
2. 复用 parser/flatten 逻辑生成 `MixedTimelineFrame[]`。
3. 补齐音频时长和资源 URL。
4. 调用 Remotion renderer：
   - bundle composition。
   - select composition。
   - renderMedia 输出 MP4。
5. 上传到 COS。
6. 返回 file asset URL。

### 用户录音替换音轨

视频模式最终需要支持一个很重要的学习闭环：**用用户自己的跟读录音生成新视频**。

业务规则：

- 每个 `MixedTimelineFrame` 都有原始音频来源：
  - NPC / 旁白台词：`frame.audioUrl`。
  - `You` 默认回答：`frame.audioUrl`，通常来自 `# defaultAnswerAudio`。
- 每个可跟读帧也可以有用户录音：
  - admin 预览第一版：录音先存在本地 blob URL。
  - 导出前：需要把用户录音上传到 COS，得到持久化 `userRecordingUrl`。
- 导出视频时逐帧选择音频：
  - 如果该帧存在 `userRecordingUrl`：使用用户录音。
  - 否则使用 `frame.audioUrl`。
  - 两者都没有：按无声帧处理，用估算时长。

建议派生结构：

```ts
interface RemotionTimelineFrame extends MixedTimelineFrame {
  startFrame: number
  endFrame: number
  durationFrames: number
  startSeconds: number
  endSeconds: number
  userRecordingUrl?: string
  resolvedAudioUrl?: string
  audioSource: 'userRecording' | 'tts' | 'none'
}
```

音频选择逻辑：

```ts
function resolveFrameAudio(frame: MixedTimelineFrame, userRecordings: Record<number, string>) {
  const userRecordingUrl = userRecordings[frame.index]
  if (userRecordingUrl) {
    return { resolvedAudioUrl: userRecordingUrl, audioSource: 'userRecording' as const }
  }
  if (frame.audioUrl) {
    return { resolvedAudioUrl: frame.audioUrl, audioSource: 'tts' as const }
  }
  return { resolvedAudioUrl: undefined, audioSource: 'none' as const }
}
```

时长规则：

- 使用用户录音时，以用户录音真实 duration 为准。
- 没有用户录音但有 TTS 时，以 TTS duration 为准。
- 没有任何音频时，按文本估算时长。
- 句间间隔仍追加在每帧之后。

UI 建议：

- 视频模式跟读完成后，该歌词项显示“将用于视频”的状态。
- 每项可清空用户录音，清空后导出自动回退原 TTS。
- 导出按钮旁显示统计：`用户录音 5/18`、`其余使用 TTS`。
- 导出设置提供开关：`优先使用用户录音`，默认开启。

导出请求建议：

```ts
interface RenderVideoPayload {
  storyId: string
  layout: 'video'
  preferUserRecordings: boolean
  userRecordings: Array<{
    frameIndex: number
    assetId?: string
    url: string
  }>
  playback: {
    gapSeconds: number
    loopCount: 1 | 2 | 'infinite'
  }
}
```

后端渲染流程补充：

1. 接收 `userRecordings`。
2. 校验录音资源归属、可访问性和 MIME 类型。
3. 为每帧生成 `resolvedAudioUrl`。
4. 根据最终音频计算 timeline duration。
5. 调用 Remotion `renderMedia()`。
6. 输出个性化 MP4。

注意事项：

- 用户录音比原 TTS 长时，视频帧跟随用户录音变长，不裁掉用户声音。
- 用户录音非常短时，设置最小时长，例如 `1.2s`，避免画面闪过。
- 用户录音可能是 `webm/ogg/mp4`，服务端导出前要确认 Remotion/Chromium 可播放；必要时后端转码为 `mp3` 或 `wav`。
- 个性化视频属于用户生成内容，文件引用关系需要能追溯到 `storyId`、`userId`、录音资产。

注意：当前 `parseComposer()` 在前端，后端导出前需要把解析/flatten 逻辑沉淀为可共享包，或在后端实现等价 parser。为了避免前后端逻辑漂移，推荐后续拆到 workspace package：

```text
packages/nqtr-vn/
  composer-parser.ts
  mixed-timeline.ts
  remotion-timeline.ts
```

前端 admin 和后端 renderer 共用这套纯 TypeScript 逻辑。

## 实施步骤

### Phase 1：文档与数据准备

- 扩展 `PreviewLayout`：加入 `video`。
- 复用 `flattenComposerToTimeline()`。
- 新增 `buildRemotionTimeline()`。
- 不接导出，只验证 timeline 数据正确。

### Phase 2：Remotion Player 预览

- 安装 Remotion 相关包：
  - `remotion`
  - `@remotion/player`
- 新增 `NqtrVideoComposition`。
- 新增 `NqtrVideoPreviewPlayer`。
- 在预览 tab 增加“视频”按钮。
- 视频模式可以播放、暂停、seek。

### Phase 3：业务能力对齐 mixed

- 接入歌词 list。
- 接入播放设置 Dialog。
- 接入每项跟读按钮。
- 接入 drawer 录音、回放、重录。
- 点击录音回放时暂停 Remotion Player。
- 打开 drawer 时暂停 Remotion Player。

### Phase 4：资源与时长精确化

- 读取音频真实 duration。
- 缓存 `audioUrl -> duration`。
- 私有 COS URL 过期处理。
- 图片预加载和失败兜底。

### Phase 5：服务端导出 MP4

- 抽共享 parser/timeline 包。
- 后端新增 render job。
- 使用 Remotion `renderMedia()` 输出 MP4。
- 上传 COS。
- 在 admin 页面显示导出进度和结果。

### Phase 6：用户录音个性化视频

- 跟读录音上传 COS。
- 建立 `frameIndex -> userRecordingUrl` 映射。
- Remotion timeline 支持 `resolvedAudioUrl` 和 `audioSource`。
- 导出时优先使用用户录音，没有用户录音则回退原 TTS。
- 导出结果标记为个性化视频。

## 风险与处理

### 音频自动播放限制

浏览器可能限制带音频的 autoplay。视频模式中仍要求用户点击播放按钮后开始播放，避免自动播放失败。

### Pixi 与 Remotion 不兼容

不要把 Pixi stage 直接塞进 Remotion composition。导出 MP4 时 WebGL/canvas 和无头浏览器更容易出问题。视频模式使用 DOM/CSS 重建 VN 画面。

### 私有资源 URL 过期

导出视频可能比普通预览更久。后端渲染时需要使用足够长的签名 URL，或由后端代理读取资源。

### 前后端 parser 漂移

如果导出由后端执行，不能让前端和后端各自维护一份 parser。应抽共享包。

### 视频画面和 admin UI 的边界

跟读 drawer、录音回放按钮、设置 dialog 是 admin UI，不进入导出视频。导出视频只包含 VN 舞台、字幕、必要的歌词上下文。

## 第一版验收标准

- 预览 tab 有“视频”模式。
- 视频模式上半区渲染 Remotion Player，下半区渲染歌词 list。
- 点击歌词 list 任意项，Remotion Player seek 到对应句。
- 播放时当前歌词自动高亮并滚动。
- 有音频的帧播放音频；无音频的帧按估算时长展示。
- `You` 默认回答帧能播放 `defaultAnswerAudio`。
- 每一项都有跟读按钮。
- 跟读 drawer 支持 TTS 播放、本地录音、回放、重录。
- 用户录音回放时暂停 Remotion Player。
- 打开跟读 drawer 时暂停 Remotion Player。
- 导出个性化视频时，有用户录音的句子使用用户录音，没有用户录音的句子使用原 TTS。
- 不影响竖屏、横屏、mixed 现有行为。
