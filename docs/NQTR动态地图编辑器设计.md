# NQTR 动态地图编辑器设计

## 结论先说

当前 `http://localhost:5173/#/admin/nqtr?tab=maps` 里的空间视图已经在用 PixiJS 实现。`MapPixiCanvas` 使用 `@pixi/react` 的 `Application`，内部通过 `pixi.js` 的 `Container`、`Graphics`、`Sprite`、`Texture`、`Assets.load` 渲染地图底图、自定义图层和地点节点。

但现在的“预览模式”和“编辑模式”不是两套地图系统，它们共用同一个 Pixi 画布，差别主要是交互能力：

- 预览模式：可以点击/hover 地点，展示地点标题，不能拖拽。
- 编辑模式：可以拖拽地点，松开后保存 `GameLocation.posX/posY`。
- 图层面板：目前只是前端临时状态，支持添加自定义图片层、显示/隐藏、锁定、上下移动，但自定义图层没有持久化到数据库。

所以现在它更准确地说是“Pixi 地图锚点编辑器”，还不是完整的“动态、分层、交互地图编辑器”。

## 当前实现拆解

### 已经存在的能力

前端主要结构：

- `maps-tab.tsx`
  - 管理地图、地点、房间的数据加载与保存。
  - 维护 `canvasMode: 'preview' | 'edit'`。
  - 维护 `canvasLayers`、`layerVisible`、`layerLocked` 等画布状态。
  - 负责把地点拖拽后的坐标保存到后端。

- `map-pixi-canvas.tsx`
  - 创建 Pixi `Application`。
  - 加载地图背景纹理。
  - 加载自定义图层纹理。
  - 加载地点 icon 纹理。
  - 渲染背景、叠加层、地点节点。
  - 处理 hover、click、drag、wheel resize。

- `map-management-shared.ts`
  - 定义 `CanvasMode`、`CanvasLayer`、默认图层等轻量类型。

后端数据模型：

- `GameMap`
  - `backgroundUrl`
  - `width`
  - `height`
  - `locations`

- `GameLocation`
  - `posX`
  - `posY`
  - `icon`
  - `iconWidth`
  - `iconHeight`
  - `backgroundUrl`
  - `locationType`
  - `rooms`

- `GameRoom`
  - `backgroundUrl`
  - `icon`
  - `roomType`
  - `inkScriptId`
  - `npcs`

### 当前混乱点

1. 地图对象和编辑器对象混在一起

`GameLocation` 既是游戏语义里的地点，也是 Pixi 画布上的可拖拽物。短期可用，长期会限制建筑、装饰、动画机关、触发区、碰撞区等对象的表达。

2. 图层不是正式数据

`CanvasLayer` 现在只在 React state 里存在。刷新页面后自定义图层、顺序、锁定状态都会消失。它适合原型，不适合内容生产。

3. Sprite 还不是完整资产单元

地点 icon 现在只是静态图片。你提到的飞车旋转齿轮，本质上应该是“地图对象 + sprite/animation + 行为脚本/参数”，而不是只给某个地点换 icon。

4. 坐标系统还偏展示层

前端使用百分比坐标保存地点位置，这对响应式底图很方便。但动态地图编辑器还需要世界坐标、画布缩放、网格吸附、对象尺寸、旋转、锚点、层级排序、碰撞范围等。

5. 编辑状态和运行时状态没有分离

编辑器需要选择、框选、拖拽、对齐、撤销、复制、锁定；玩家运行时需要触发、寻路、碰撞、动画、进入房间。两者可以共用同一份地图数据，但不应该共用同一套交互逻辑。

## 推荐核心理念

### 1. Pixi 负责渲染和高频交互，React 负责编辑器 UI

Pixi 擅长：

- 大量 sprite 渲染。
- 动画循环。
- 粒子、滤镜、遮罩。
- 拖拽、命中测试、摄像机缩放平移。
- 游戏运行态的高频画面更新。

React 擅长：

- 左侧资源库。
- 图层面板。
- 属性面板。
- 表单、弹窗、保存状态。
- 时间轴、对象列表、快捷操作。

推荐边界：

- Pixi stage 只关心“如何画”和“画布内指针事件”。
- React editor shell 关心“选中了什么、属性怎么改、是否保存、面板如何组织”。
- 中间用一个明确的 editor store 管理当前地图文档。

### 2. 地图应该是一个文档，不只是 Map + Location

建议把地图编辑器的数据理解成 `MapDocument`：

```ts
type MapDocument = {
  map: {
    id: string
    name: string
    width: number
    height: number
    backgroundColor?: string
  }
  layers: MapLayer[]
  objects: MapObject[]
}
```

地图内的东西统一叫 `MapObject`，地点只是其中一种：

```ts
type MapObject =
  | LocationObject
  | StaticSpriteObject
  | AnimatedSpriteObject
  | TriggerObject
  | CollisionObject
  | DecorationObject
  | PathObject
```

这样“建筑物”“旋转齿轮”“发光传送门”“NPC 站位”“空气墙”“点击进入房间的触发区”都能在同一个编辑器里表达。

### 3. 分层是内容结构，不只是视觉开关

建议内置图层类型：

- `background`：底图、远景、天空、室内背景。
- `terrain`：地面、道路、水面、不可走区域。
- `decor`：建筑、树、招牌、家具、静态装饰。
- `interactive`：可点击建筑、门、房间入口、机关。
- `characters`：NPC、角色站位、巡逻路径。
- `effects`：粒子、光效、旋转齿轮、动态广告牌。
- `collision`：碰撞、多边形阻挡、触发区域。
- `debug`：网格、坐标、辅助线，只在编辑器显示。

每个图层应该持久化：

```ts
type MapLayer = {
  id: string
  name: string
  kind: 'background' | 'terrain' | 'decor' | 'interactive' | 'characters' | 'effects' | 'collision' | 'debug'
  visible: boolean
  locked: boolean
  opacity: number
  order: number
}
```

### 4. Sprite 是资产，Animation 是资产配置，Behavior 是运行规则

你说“sprite 也是一组动画”，这个方向是对的，但要拆开三层：

- `Asset`：图片、spritesheet、spine、video、音频。
- `Animation`：使用哪个资产、帧序列、fps、loop、默认状态。
- `Behavior`：什么时候播放、能否点击、是否旋转、是否触发剧情。

例如旋转齿轮：

```ts
type AnimatedSpriteObject = {
  id: string
  type: 'animated_sprite'
  layerId: string
  name: string
  transform: {
    x: number
    y: number
    scaleX: number
    scaleY: number
    rotation: number
    anchorX: number
    anchorY: number
  }
  asset: {
    kind: 'spritesheet'
    url: string
    defaultAnimation: string
  }
  animation: {
    state: string
    fps: number
    loop: boolean
    autoplay: boolean
  }
  behavior?: {
    kind: 'rotate' | 'click_trigger' | 'room_entry' | 'custom'
    params: Record<string, unknown>
  }
}
```

如果只是循环旋转，不一定需要 spritesheet。可以用单张图片 `Sprite`，每 tick 修改 `rotation`。如果是角色走路、门开合、齿轮破碎、霓虹闪烁，才更适合 spritesheet 或 Spine。

## 编辑器应该有的功能

### 第一阶段：把现有地图编辑器整理干净

目标：不大改玩法，只让现有 Pixi 地图变成稳定生产工具。

应该补齐：

- 地图宽高进入前端类型，不只使用容器尺寸。
- 底图使用地图世界坐标适配，区分 `contain`、`cover`、`stretch`。
- 图层持久化，刷新后不丢。
- 地点 icon 尺寸调整要保存到后端，现在只是本地 state。
- 加入画布缩放、平移、重置视角。
- 加入网格、吸附、坐标显示。
- 加入撤销/重做。
- 加入多选、框选、复制、删除。
- 属性面板统一编辑位置、尺寸、图标、可见、锁定、类型。

### 第二阶段：引入正式地图对象

目标：让建筑、装饰、齿轮、入口、触发区都变成可编辑对象。

新增概念：

- `MapLayer`
- `MapObject`
- `MapAsset`
- `MapAnimation`
- `MapTrigger`

编辑器能力：

- 从资源库拖 sprite 到地图。
- 对象支持移动、缩放、旋转、层级排序。
- 支持对象类型：静态图片、动画图片、地点入口、触发区域、碰撞区域。
- 支持对象属性：名称、资源、位置、尺寸、旋转、透明度、可点击、运行时可见条件。
- 支持绑定行为：进入房间、播放脚本、打开对话、播放音效、改变 flag。

### 第三阶段：运行时预览接近真实游戏

目标：预览模式不只是“不能拖”，而是接近玩家看到的地图。

预览模式应该支持：

- 动画自动播放。
- 可交互对象 hover/click。
- 进入 Location/Room 的真实跳转逻辑。
- 根据玩家进度隐藏或禁用对象。
- 播放环境音、BGM。
- 显示 NPC 或任务状态。
- Debug 开关：显示碰撞、触发区、对象 id、性能指标。

编辑模式应该支持：

- 所见即所得。
- 对象选择框、变换手柄。
- 图层锁定后不能选中。
- 碰撞层半透明显示。
- 对象 inspector。
- 快捷键：删除、复制、撤销、重做、方向键微调。

## 推荐技术架构

### 目录建议

```txt
apps/frontend/src/features/admin/components/maps/
  editor/
    map-editor-shell.tsx
    map-editor-toolbar.tsx
    map-layer-panel.tsx
    map-asset-panel.tsx
    map-object-inspector.tsx
    map-readiness-panel.tsx
  pixi/
    map-stage.tsx
    layers/
      background-layer.tsx
      object-layer.tsx
      location-layer.tsx
      collision-layer.tsx
      debug-layer.tsx
    objects/
      static-sprite-node.tsx
      animated-sprite-node.tsx
      location-node.tsx
      trigger-node.tsx
    hooks/
      use-pixi-texture.ts
      use-map-camera.ts
      use-object-drag.ts
      use-selection-box.ts
  store/
    map-editor-store.ts
    map-document-types.ts
    map-editor-commands.ts
```

### 状态流

推荐用 command 模式管理编辑操作：

```ts
type EditorCommand =
  | { type: 'object.move'; objectId: string; from: Point; to: Point }
  | { type: 'object.resize'; objectId: string; from: Size; to: Size }
  | { type: 'object.create'; object: MapObject }
  | { type: 'object.delete'; objectId: string }
  | { type: 'layer.reorder'; layerId: string; from: number; to: number }
```

好处：

- 撤销/重做自然。
- 批量保存更安全。
- 可以显示“未保存更改”。
- Pixi 的拖拽可以只更新 draft，松开后提交 command。

### Pixi 运行循环

动画对象不要靠 React state 每帧 setState。应该让 Pixi 自己在 ticker 里更新：

- React 负责生成对象。
- Pixi ticker 负责 rotation、frame、particle、shader。
- 数据改变时才回到 React/store。

比如旋转齿轮：

```ts
app.ticker.add((ticker) => {
  gear.rotation += ticker.deltaTime * speed
})
```

如果使用 `@pixi/react`，可以封装 `AnimatedSpriteNode`，内部用 `useTick` 或直接注册 ticker。

## 数据模型建议

短期可以不新建很多表，先给 `GameMap` 增加一个 `editorData Json?` 或 `mapDocument Json?` 字段，用来快速迭代编辑器结构。

```prisma
model GameMap {
  id            String         @id @default(cuid())
  name          String
  displayName   String
  backgroundUrl String?
  thumbnailUrl  String?
  icon          String?
  width         Int            @default(1920)
  height        Int            @default(1080)
  editorData    Json?
  locations     GameLocation[]
  // ...
}
```

等结构稳定后，再拆成正式表：

- `GameMapLayer`
- `GameMapObject`
- `GameMapAsset`
- `GameMapTrigger`

推荐过渡策略：

1. `GameLocation` 继续作为游戏导航实体。
2. 地图上能点击进入地点的对象，保存为 `MapObject`，并通过 `targetLocationId` 关联 `GameLocation`。
3. 老的 `GameLocation.posX/posY/icon` 可以迁移成一批 `LocationObject`。
4. 最终运行时读取 `MapDocument`，而不是直接把 location 列表当画布对象。

## 预览模式和编辑模式应该如何分工

### 预览模式

预览模式要回答：“玩家会看到什么，会点到什么，会触发什么？”

特点：

- 隐藏编辑辅助 UI。
- 图层按运行时规则显示。
- 动画真实播放。
- 点击交互真实执行或模拟执行。
- 不允许拖动和修改对象。
- 可切换玩家状态：等级、章节、flag、已解锁地点。

### 编辑模式

编辑模式要回答：“内容编辑者如何快速、准确、安全地搭地图？”

特点：

- 显示网格、选区、对象边框、锚点、碰撞区。
- 可拖拽、缩放、旋转。
- 支持图层锁定、隐藏、排序。
- 支持对象属性面板。
- 支持撤销/重做和保存状态。
- 支持批量操作。

### 两者共用什么

共用：

- `MapDocument`
- Pixi 渲染组件的大部分节点。
- 资源加载系统。
- 动画系统。
- 坐标转换。

不同：

- pointer 事件处理。
- debug/edit overlay。
- toolbar 和 inspector。
- 是否提交编辑命令。
- 点击对象后的行为。

## 推荐迭代路线

## 当前执行状态

已经按“不新增表”的约束开始落地：

- `GameMap` 增加 `editorData Json?`，并补充 migration：`20260624090000_game_map_editor_data`。
- 前端 `GameMapData` 补齐 `width`、`height`、`editorData`。
- `CanvasLayer` 已升级为可持久化的 `MapLayer`。
- 新增 `MapDocument`、`MapObject`、`MapPrefab`、`MapBehaviorKind` 类型。
- 新增默认 prefab：
  - 建筑入口：同一套入口逻辑，换图片即可变成宿舍/图书馆/商店等。
  - 装饰建筑：只负责视觉表现。
  - 旋转机关：单图 procedural rotation，适合飞车齿轮、风扇、机械装置。
  - 触发区域：可绑定点击/脚本/房间。
  - 碰撞阻挡：用于运行时不可通行区域的编辑表达。
- `MapPixiCanvas` 已开始渲染 `MapDocument.objects`，并支持对象选择、拖拽、替换皮肤、尺寸、旋转、透明度、行为、地点/房间绑定。
- 原来的地点节点拖拽仍保留，并把 icon 滚轮缩放改为保存到后端。

这一步的核心意义是：prefab 负责“同类功能模板”，object 负责“地图上的实例”。比如同样是建筑入口 prefab，不同实例只需要换皮肤、位置、尺寸和绑定地点。

### Milestone 1：整理现有 Pixi 地图

- 把 `MapPixiCanvas` 拆成 stage、layers、nodes。
- 前端类型补齐 `GameMap.width/height`。
- 保存 icon resize。
- 持久化图层基础信息。
- 加入缩放、平移、重置视角。

产出：稳定的地图锚点编辑器。

### Milestone 2：地图对象化

- 定义 `MapDocument`。
- 用 JSON 字段先保存 layers 和 objects。
- 新增对象类型：静态 sprite、动画 sprite、地点入口。
- 支持资源库拖拽到画布。
- 支持对象 inspector。

产出：可以摆建筑、装饰、动画元素。

### Milestone 3：交互和运行时预览

- 新增 trigger/collision。
- 支持进入房间、播放脚本、改变 flag。
- 支持预览玩家状态。
- 支持调试 overlay。

产出：真正接近游戏运行态的交互地图。

### Milestone 4：资产和动画工作流

- 支持 spritesheet 上传与解析。
- 支持动画状态配置。
- 支持单图旋转、呼吸、闪烁等 procedural animation。
- 支持粒子和滤镜预设。

产出：可以制作“飞车齿轮”这类动态机关，也能做地点氛围效果。

## 对当前代码的直接建议

短期不要继续把所有能力堆到 `maps-tab.tsx` 和 `map-pixi-canvas.tsx`。这两个文件已经开始承担太多职责：

- `maps-tab.tsx` 应该退回到“数据装配 + 页面布局”。
- `map-pixi-canvas.tsx` 应该退回到“Pixi stage 容器”。
- 图层、对象、编辑命令、属性面板都应该拆出去。

最先值得做的重构：

1. 把 `MapPixiLayer` 拆成 `MapStage`、`BackgroundLayer`、`CustomImageLayer`、`LocationLayer`、`LocationNode`。
2. 把 `CanvasLayer` 从临时 UI 类型升级为可保存的 `MapLayer`。
3. 把“地点节点”抽象成第一种 `MapObject`，后续建筑和齿轮都复用同一套选择、拖拽、变换逻辑。
4. 给编辑器引入 command/history，不然后面撤销、批量修改、保存失败回滚都会越来越难。

## 一句话方向

PixiJS 应该成为这套动态地图的“舞台和运行引擎”，React 应该成为“编辑器外壳和属性面板”，数据库保存的应该是一份清晰的 `MapDocument`。不要把地点、建筑、齿轮、触发器都塞进 `Location`；把它们统一成地图对象，Location/Room 只负责游戏导航语义。
