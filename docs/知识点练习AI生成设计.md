# 知识点练习 AI 生成设计

本文档描述后台「学习内容 / 编辑话题 / 知识点练习」中的 AI 生成、教学提示、教学文档和英文音频批量生成方案。

## 目标

- AI 生成必须按题型生成：单词/句块替换、一词多句、句子拆解、句型操练分别使用不同约束。
- AI 可用材料必须来自当前话题：词汇表、句块表、句型表。
- 生成时带上当前难度、已用材料、未用材料，降低同质化。
- 每道题生成时同步生成教学提示，避免生成题目后还要二次补提示。
- 记录题目使用过哪些词汇、句块、句型和例句来源，后续可按剩余材料继续生成。
- 知识点练习增加话题级教学文档，和 NQTR 内容工坊的教学文档统一管理。
- 批量音频只处理英 -> 中题型的英文题干；中文不生成音频。

## 材料池

前端在知识点练习 tab 中通过「材料池」popover 展示三个材料列表：

- 词汇 list：来自 `trainingTopic.topicVocabs[].vocab`
- 句块 list：来自 `trainingTopic.activeChunks[].chunk`
- 句型 list：来自 `trainingTopic.topicPatterns[].pattern`

AI 请求需要携带这些材料：

```ts
materials: {
  vocabs: Array<{ id: string; word: string; meaning?: string }>
  chunks: Array<{ id: string; text: string; meaning?: string }>
  patterns: Array<{ id: string; pattern: string; meaning?: string }>
}
```

UI 约定：

- 主界面保持紧凑，不常驻展示完整材料列表。
- 顶部「材料池」按钮打开 popover，显示每个材料的已用/未用状态和使用次数。
- 左侧每个练习组标记本组匹配到的单词、句块、句型；点击可查看本组材料使用次数。

## 覆盖记录

知识点练习配置继续存储在话题 `metadata.outputTraining` 中。每次前端渲染时从当前题目反推覆盖情况：

- 单词：匹配 `vocabWord`、题干、答案、提示中的英文词。
- 句块：匹配 `chunk`、题干、答案、句子拆解来源。
- 句型：匹配 `pattern`、句型操练题组、句子拆解来源。

AI 生成请求同时携带覆盖摘要：

```ts
usedRefs: {
  vocabIds: string[]
  chunkIds: string[]
  patternIds: string[]
}
```

生成策略：

- 优先使用未覆盖材料。
- 同一题组中避免只替换人称或单个形容词。
- 同一话题中不同题型要覆盖不同表达功能。
- 题干场景要贴近话题标题和难度，不脱离当前训练目标。

## 题型约束

单词/句块替换：

- `kind=word` 时 keyword 必须来自词汇 list。
- `kind=chunk` 时 keyword 必须来自句块 list。
- 英 -> 中时英文放题干，中文放答案；音频只绑定英文题干。

一词多句：

- 核心词来自词汇 list。
- patterns 优先使用句型 list 或句块 list。
- 每个核心词生成多种语义场景，不只改变主语。

句子拆解：

- 来源句优先使用句块例句或句型例句。
- 按难度生成从短到长的层级。
- 每层都保留清晰的中文意思。

句型操练：

- 句型来自句型 list。
- 例句使用不同语义槽位，避免整组题高度重复。

## 教学提示和教学文档

题目级教学提示：

- 生成题目时默认同时返回 `hint`。
- 批量「全部 AI 提示」继续保留，用于补齐旧题或人工改题后的提示。

话题级教学文档：

- 在知识点练习 tab 的右侧主工作区增加「题目编辑 / 教学文档」内部 tab。
- 「AI 生成教学文档」根据话题标题、描述、训练目标、难度、词汇、句块、句型和当前练习题生成。
- 教学文档使用项目统一的 Markdown 编辑组件，支持编辑和预览切换。
- 生成结果保存到 `trainingTopic.teachingMarkdown`。
- 学习端继续从同一字段读取教学文档。

## 批量英文音频

新增「全部 AI 音频」按钮：

- 只扫描英 -> 中题组。
- 只为英文题干生成音频。
- 已有 `audioAssetId` 的题目默认跳过，避免重复覆盖。
- 中 -> 英题组不批量生成音频，因为题干是中文，中文 TTS 对练习没有意义。

## 后端接口

练习题生成继续使用：

```http
POST /api/v1/manyu/practice-ai/generate-drills
```

新增/扩展字段：

```ts
{
  topicTitle?: string
  difficulty?: string
  materials?: {
    vocabs?: Array<{ id: string; word: string; meaning?: string }>
    chunks?: Array<{ id: string; text: string; meaning?: string }>
    patterns?: Array<{ id: string; pattern: string; meaning?: string }>
  }
  usedRefs?: {
    vocabIds?: string[]
    chunkIds?: string[]
    patternIds?: string[]
  }
}
```

话题教学文档新增：

```http
POST /api/v1/manyu/admin/content/training-topics/:id/generate-teaching
```

返回：

```ts
{ markdown: string }
```

## 验收点

- 知识点练习 tab 能看到词汇、句块、句型材料池和已用/未用数量。
- AI 生成题目会带当前材料池、覆盖摘要和难度。
- AI 生成出来的题目有 hint。
- 英 -> 中批量音频只生成英文题干音频。
- 教学文档可 AI 生成、编辑、保存，保存后进入学习端。
