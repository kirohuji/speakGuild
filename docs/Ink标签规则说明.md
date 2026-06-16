# Ink 剧本标签规则说明（AI 参考手册）

> **用途**：为 AI 助手（如 GitHub Copilot、Cursor 等）提供参考，理解漫语町项目中 Ink 剧本使用的 `#tag` 系统。
> **更新日期**：2026-06-16
> **适用场景**：`apps/backend/prisma/data/packages/*/ink-scripts/*.ink`

---

## 一、Ink 基础语法

```ink
=== knot_name ===    // 节点（场景段落）定义
-> knot_name         // 跳转到指定节点
-> END               // 剧情结束
* [文本] -> knot     // 用户选项，带展示文本
```

---

## 二、标签系统

### 两种标签格式

本项目使用**两种不同的标签格式**，由标签所在位置决定：

| 位置 | 格式 | 示例 |
|------|------|------|
| **NPC 台词行之前**（角色/场景元信息） | `# tag:value` — `#` 后**有空格**，冒号后**无空格** | `# speaker:Emma` |
| **NPC 台词行之后**（指令/内容） | `#tag:value` — `#` 后**无空格**，冒号后**无空格** | `# objective:用副词描述` |
| 输入等待（台词之后） | `# wait:input` — 固定格式 | `# wait:input` |

---

### 2.1 场景设置标签（NPC 台词之前）

格式：`# tag:value`（# 后有空格，冒号后无空格）

#### `# bg` — 场景背景图

```ink
# bg:/assets/bg/kitchen.png
```

- 放在 `=== knot_name ===` 之后的第一行
- 路径相对于 `public/` 目录

#### `# bgFit` — 背景填充模式

```ink
# bgFit:cover
```

- CSS `object-fit` 值：`cover` / `contain` / `fill`
- 通常与 `# bg` 搭配使用

#### `# speaker` — 发言角色

```ink
# speaker:Emma
# speaker:Shop Assistant
```

- 每句 NPC 台词前必须标记
- 角色名与数据库 `Npc` 表中 `name` 字段一致

#### `# expression` — 角色表情

```ink
# expression:happy
# expression:thinking
# expression:default
# expression:surprised
# expression:sad
# expression:angry
```

- 放在 `# speaker` 之后
- 常见值：`default` / `happy` / `thinking` / `surprised` / `sad` / `angry`

#### `# position` — 角色位置

```ink
# position:center
# position:left
# position:right
```

- 多角色对话时区分左右站位
- 单角色时默认 `center`，可省略

#### `# translation` — 中文翻译

```ink
# translation:%E6%AC%A2%E8%BF%8E%E6%9D%A5%E5%88%B0%E6%88%91%E7%9A%84%E5%8E%A8%E6%88%BF%E5%A4%A7%E5%86%92%E9%99%A9%EF%BC%81
```

- 放在 NPC 英文台词行**之前**，紧接在 `# position` 之后
- 值必须为 **URL 编码**（`encodeURIComponent`）
- 用户可点击切换显示/隐藏

---

### 2.2 指令标签（NPC 台词之后）

格式：`#tag:value`（# 后无空格，冒号后无空格）

#### `# objective` — 对话目标

```ink
# objective:用方式副词描述你阅读食谱的方式（carefully/quickly/easily）
# objective:用程度副词评价你看到的商品（very/quite/rather/extremely/too）
# objective:向宿管说明你要办理入住
```

- 放在 NPC 台词行**之后**，紧接在 NPC 台词下一行
- 每个轮次**有且仅有一个**
- 括号内补充关键词提示

#### `# hint` — 提示语

```ink
# hint:用 "I read it carefully", "I quickly looked through it", "I can easily follow it" 来描述你看完食谱后的感觉
```

- 放在 `# objective` 之后
- 中文描述 + 英文示例加引号

#### `# chunks` — 目标句块

```ink
# chunks:Please read carefully.,He quickly finished his homework.,She easily solved the problem.,She speaks English well.
```

- 放在 `# hint` 之后
- 句块之间用**英文逗号 + 空格**分隔

#### `# wait:input` — 等待用户输入

```ink
# wait:input
```

- **固定格式**：# 后有空格，: 前后无空格
- 必须放在所有指令标签的**最后一行**
- 前端 VnPlayer 读到后暂停剧情、启动麦克风/输入框

---

### 2.3 纯等待标签

#### `# wait` — 点击继续

```ink
# wait
```

- 用于剧情末尾，用户点击"继续"结束对话
- 不带输入，纯确认

---

## 三、标签顺序（完整模板）

### 一轮对话的完整标签序列

```
=== knot_name ===
# bg:/assets/bg/xxx.png           ① 背景图（仅节点开头）
# bgFit:cover                      ② 背景填充（仅节点开头）
# speaker:角色名                    ③ 发言角色
# expression:表情                   ④ 角色表情
# position:位置                     ⑤ 角色站位
# translation:URL编码的中文翻译      ⑥ 中文翻译
NPC: English dialogue line.        — NPC 台词
# objective:本轮目标                 ⑦ 对话目标
# hint:提示语                       ⑧ 可选提示
# chunks:句块1.,句块2.,句块3.       ⑨ 目标句块
# wait:input                        ⑩ 等待输入
-> knot_name                        ⑪ 跳转下一节点
```

### 节点开头的完整示例

```ink
---
key: practice_course-adverbs_副词_方式与评论副词_方式副词
title: 副词·方式与评论副词 - 方式副词
---

-> start

=== start ===
# bg:/assets/bg/kitchen.png
# bgFit:cover
# speaker:Emma
# expression:happy
# position:center
# translation:%E6%AC%A2%E8%BF%8E%E6%9D%A5%E5%88%B0%E6%88%91%E7%9A%84%E5%8E%A8%E6%88%BF%E5%A4%A7%E5%86%92%E9%99%A9%EF%BC%81%E4%BB%8A%E6%99%9A%E6%88%91%E4%BB%AC%E8%A6%81%E6%8C%91%E6%88%98%E7%9A%84%E6%98%AF%E2%80%94%E2%80%94%E6%88%91%E5%A5%B6%E5%A5%B6%E7%9A%84%E7%A7%98%E5%88%B6%E7%BA%A2%E7%83%A7%E8%82%89%E9%A3%9F%E8%B0%B1%EF%BC%81
Emma: Welcome to my kitchen adventure! Tonight's challenge — my grandma's secret braised pork recipe!

# speaker:Emma
# expression:default
# position:center
# translation:%E4%B8%8D%E8%BF%87%E8%80%81%E5%AE%9E%E8%AF%B4%E2%80%A6%E2%80%A6%E6%88%91%E4%B8%8A%E6%AC%A1%E5%81%9A%E8%BF%99%E4%B8%AA%E6%8A%8A%E5%8E%A8%E6%88%BF%E5%B7%AE%E7%82%B9%E7%83%A7%E4%BA%86%E3%80%82%E6%89%80%E4%BB%A5%E8%BF%99%E6%AC%A1%E6%88%91%E4%BB%AC%E6%9D%A5%E5%88%86%E5%B7%A5%E5%90%88%E4%BD%9C%E3%80%82%E4%BD%A0%E7%9C%8B%E5%AE%8C%E9%A3%9F%E8%B0%B1%E4%BA%86%E5%90%97%EF%BC%9F
Emma: But honestly... last time I almost burned the kitchen down. So let's work together. Have you read through the recipe?
# objective:用方式副词描述你阅读食谱的方式（carefully/quickly/easily）
# hint:用 "I read it carefully", "I quickly looked through it", "I can easily follow it" 来描述你看完食谱后的感觉
# chunks:Please read carefully.,He quickly finished his homework.,She easily solved the problem.,She speaks English well.
# wait:input
-> prep_work
```

---

## 四、其他语法

### 文件头 YAML Frontmatter

```yaml
---
key: practice_course-adverbs_副词_方式与评论副词_方式副词
title: 副词·方式与评论副词 - 方式副词
---
```

| 字段 | 说明 |
|------|------|
| `key` | 全局唯一键 |
| `title` | 剧本展示标题 |

> 注意：脚本生成的文件头**不含** `scriptType` 字段。

### 节点跳转

```ink
-> start           // 跳转到 start 节点
-> prep_work       // 跳转到 prep_work 节点
-> END             // 剧情结束
```

### 用户选项（仅旧版剧本使用）

```ink
* [选项文本] -> target_knot
```

选项与 `# wait:input` 是互斥的，不会同时出现。

---

## 五、标签速查表

| 标签 | 位置 | 格式 | 说明 |
|------|------|------|------|
| `# bg` | NPC 台词前 | `# bg:/path` | 背景图 |
| `# bgFit` | NPC 台词前 | `# bgFit:cover` | 背景填充 |
| `# speaker` | NPC 台词前 | `# speaker:Emma` | 发言角色 |
| `# expression` | NPC 台词前 | `# expression:happy` | 角色表情 |
| `# position` | NPC 台词前 | `# position:center` | 角色站位 |
| `# translation` | NPC 台词前 | `# translation:URL编码` | 中文翻译 |
| `# objective` | NPC 台词后 | `# objective:文本` | 对话目标 |
| `# hint` | NPC 台词后 | `# hint:文本` | 提示语 |
| `# chunks` | NPC 台词后 | `# chunks:句块列表` | 目标句块 |
| `# wait:input` | NPC 台词后 | `# wait:input` | 等待用户输入（固定格式） |
| `# wait` | 剧情末尾 | `# wait` | 纯等待 |

---

## 六、前端解析逻辑（供参考）

VnPlayer 解析 `.ink` 文件时：

1. 读取 YAML frontmatter → 获取 `key`、`title`
2. 逐行扫描，遇到标签时：
   - `# speaker` / `# expression` / `# position` → 更新对话 UI 状态
   - `# bg` / `# bgFit` → 更新背景图片和填充模式
   - `# translation` → 缓存当前台词的中文翻译（URL 自动解码）
   - `# objective` → 显示目标指示器
   - `# chunks` → 解析句块列表供评分/提示
   - `# hint` → 注册可选提示
   - `# wait` → 暂停，等待用户点击"继续"
   - `# wait:input` → 暂停并激活输入模式（语音/文本）
3. 遇到 `-> knot_name` → 跳转到指定节点继续执行
4. 遇到 `-> END` → 结束对话，进入结算

---

## 七、常见问题

### Q: 为什么同样的标签有两种格式（`# tag` 和 `#tag`）？
这是脚本生成器的设计规范：
- **NPC 台词前**的角色/场景信息用 `# tag:value`（# 后有空格）
- **NPC 台词后**的指令信息用 `#tag:value`（# 后无空格）
- 请按此规则编写，不要混用

### Q: 一个轮次可以有多个 `# objective` 吗？
不可以。每个 `# wait:input` 前只能有一个 `# objective`。

### Q: `# chunks` 中的句块有数量限制吗？
建议 2~4 个。

### Q: `# translation` 的值为什么要 URL 编码？
脚本生成时为了规避特殊字符编码问题，使用 `encodeURIComponent()` 编码。解析时前端会自动解码，无需手动处理。

### Q: 标签名大小写敏感吗？
敏感。统一使用小写：`# objective` 而非 `# Objective`，`# wait:input` 而非 `# Wait:Input`。
