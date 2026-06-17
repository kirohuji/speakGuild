# 知识点练习（Warmup Pipeline）题型说明

> 本文档描述「知识点练习」流水线中的所有题型，覆盖的语言素材，以及是否满足输出训练需求。

---

## 一、现有题型总览

| # | 题型 | 类型标识 | 覆盖素材 | 方向 | 核心目的 |
|---|------|---------|---------|------|---------|
| 1 | **句块/单词替换** | `chunk_substitution` | 单词 / 句块 | 中→英 / 英→中 | 在设定语境中反复使用目标表达 |
| 2 | **一词多句** | `vocab_sentence_building` | 单词 + 句块 | 中→英 / 英→中 | 一个词在多种句型框架中的灵活运用 |
| 3 | **长句拆解** | `sentence_decomposition` | 句子 | 中→英 | 从简单句逐级扩展到复杂长句 |
| 4 | **句型操练** | `pattern_drill` | 句型 | 中→英 / 英→中 | 语法框架固定 + 槽位内容可变，同一结构表达不同意思 |

---

## 二、各题型详解

### 2.1 句块/单词替换（`chunk_substitution`）

**定位**：基础输出训练。给定一个核心词或句块，让学习者在多条中文提示下反复输出含该词/句块的英文句子。

**覆盖素材**：
- `kind='word'` → **单词**（如 `carefully`、`easily`）
- `kind='chunk'` → **句块**（如 `I'd like to...`、`check in`）

**练习方向**：
| 方向 | 说明 | 适用场景 |
|------|------|---------|
| `zh_to_en` | 看中文说出含目标表达的英文 | **输出训练**（默认） |
| `en_to_zh` | 看英文理解中文含义 | 理解训练 / 词汇认知 |

**数据结构**：
```json
{
  "type": "chunk_substitution",
  "kind": "word",
  "direction": "zh_to_en",
  "title": "用 carefully 造句",
  "chunk": "carefully",
  "chunkMeaning": "仔细地",
  "items": [
    { "zh": "仔细听老师说。", "answer": "Listen to the teacher carefully." },
    { "zh": "请仔细检查你的作业。", "answer": "Please check your homework carefully." }
  ]
}
```

**学习者交互**：
1. 显示中文提示 + 目标词/句块标签
2. 学习者在 textarea 中输入英文
3. 点击「查看答案」对比参考答案
4. 自评通过/再试一次

---

### 2.2 一词多句（`vocab_sentence_building`）

**定位**：扩展输出训练。一个核心词汇搭配多个句型框架（chunk），每个框架下有多条练习。让学习者体会同一个词在不同句式中的用法。

**覆盖素材**：
- **单词**（核心词汇，如 `easily`）
- **句块**（句型框架，如 `She easily...`、`He easily...`）

**数据结构**：
```json
{
  "type": "vocab_sentence_building",
  "title": "easily 搭配练习",
  "vocabWord": "easily",
  "vocabMeaning": "容易地",
  "direction": "zh_to_en",
  "patterns": [
    {
      "chunk": "She easily...",
      "items": [
        { "zh": "她轻松解决了问题。", "answer": "She easily solved the problem." },
        { "zh": "她轻松通过了考试。", "answer": "She easily passed the exam." }
      ]
    },
    {
      "chunk": "He easily...",
      "items": [
        { "zh": "他轻松赢得了比赛。", "answer": "He easily won the game." }
      ]
    }
  ]
}
```

**学习者交互**：
1. 顶部显示核心词汇 + 中文含义
2. 每个 pattern 作为一个独立卡片
3. 卡片内逐题练习，显示句型框架作为提示
4. 自评通过/再试

**与 2.1 的区别**：
- `chunk_substitution`（word 模式）：单一目标词，多语境造句
- `vocab_sentence_building`：一个词 × 多个句型框架，每个框架下多条例句

---

### 2.3 长句拆解（`sentence_decomposition`）

**定位**：渐进式复杂度训练。将一个复杂长句拆解为 5 个难度递增的层级，从核心主谓结构开始，逐步添加修饰成分（宾语 → 程度副词 → 频率 → 原因从句），最终达到完整表达。

**覆盖素材**：
- **句子**（完整的复杂句）

**数据结构**：
```json
{
  "type": "sentence_decomposition",
  "title": "句子拆解：从简单到复杂",
  "levels": [
    { "level": 1, "label": "核心句",   "en": "She speaks well.", "zh": "她说得好。" },
    { "level": 2, "label": "加对象",   "en": "She speaks English well.", "zh": "她英语说得好。", "highlight": "English" },
    { "level": 3, "label": "加程度",   "en": "She speaks English very well.", "zh": "她英语说得非常好。", "highlight": "very" },
    { "level": 4, "label": "加频率",   "en": "She always speaks English very well.", "zh": "她总是英语说得非常好。", "highlight": "always" },
    { "level": 5, "label": "完整表达", "en": "She always speaks English very well because she practices every day.", "zh": "她总是英语说得非常好，因为她每天练习。", "highlight": "because she practices every day" }
  ]
}
```

**每级元数据**：
| 字段 | 说明 |
|------|------|
| `level` | 层级编号（1-5） |
| `label` | 中文描述（如"加程度"） |
| `en` | 本层英文句子 |
| `zh` | 本层中文翻译 |
| `highlight` | 相比上一级新增的文本片段（前端高亮显示） |
| `hint` | 中文提示（如"试着加入地点"） |

**学习者交互**：
1. 从 Level 1（最简单）开始
2. 每级显示上一级的英文 + 本级的 hint 提示
3. 学习者在 textarea 中尝试写出本级的完整句子
4. 点击「查看答案」对比，新增部分高亮显示
5. 逐级进阶直到 Level 5

---

## 三、语言素材覆盖分析

| 语言素材 | 数据库表 | 被覆盖 | 覆盖方式 |
|---------|---------|--------|---------|
| **单词** (Vocabulary) | `vocabulary` | ✅ 充分 | `chunk_substitution` (kind=word) + `vocab_sentence_building` |
| **句块** (Chunk) | `chunk` | ✅ 充分 | `chunk_substitution` (kind=chunk) + `vocab_sentence_building` 的 patterns |
| **句型** (Sentence Pattern) | `sentence_pattern` | ✅ 充分 | `pattern_drill` 句型操练，语法框架 + 槽位替换 |
| **句子** (Sentence) | — | ✅ 充分 | `sentence_decomposition` 渐进式长句构建 |

### 句型（Sentence Pattern）与句块（Chunk）的区别

| 维度 | 句型 (Pattern) | 句块 (Chunk) |
|------|---------------|-------------|
| 本质 | **语法框架模板**，有可变槽位 | **固定/半固定表达块** |
| 示例 | `I'd like to [verb]...`、`Have you ever [past participle]?` | `check in`、`make a reservation`、`I'd like to` |
| 练习重点 | 掌握结构 + 替换槽位内容 | 整体记忆 + 在语境中使用 |
| 典型操练 | "用 `Could you tell me ___?` 造句"（槽位填不同内容） | "用 `check in` 造句"（在不同语境中使用） |

> **当前状态**：`chunk_substitution` 在 `kind='chunk'` 模式下可以接受 `I'd like to` 这样的句型片段作为 chunk 使用，界面交互上可以覆盖句型操练。但从概念清晰度和学习科学角度，句型应有独立的操练模式。

---

## 四、练习输出需求评估

从二语习得（SLA）的输出训练阶梯来看：

| 阶梯 | 描述 | 现有覆盖 | 评估 |
|------|------|---------|------|
| ① 理解识别 | 看到英文→理解中文含义 | `chunk_substitution` en→zh 方向 | ✅ |
| ② 控制性输出 | 给定中文+目标词→输出含该词的英文 | `chunk_substitution` zh→en | ✅ |
| ③ 多框架输出 | 一个词在多种句型框架中运用 | `vocab_sentence_building` | ✅ |
| ④ 结构化输出 | 在语法框架中替换内容，掌握句型 | `pattern_drill` | ✅ |
| ⑤ 渐进复杂度 | 从简单到复杂的句子构建 | `sentence_decomposition` | ✅ |
| ⑥ 自由输出 | 开放对话中的自然运用 | 由后续**场景练习**（Ink 对话）承接 | ✅（不属于 warmup） |

### 结论

- **单词、句块、句型、句子**：全部覆盖充分 ✅
- 输出训练阶梯六层全部补齐 ✅

---

## 五、句型操练（`pattern_drill`）✅ 已实现

### 设计思路

句型操练的核心是：**语法框架固定 + 槽位内容可变**。区别于 chunk_substitution（目标表达固定），句型操练强调"用同一个结构表达不同意思"。

### 示例

```
句型: I'd like to [verb]...
含义: 我想...

练习:
1. 我想点一杯咖啡。     → I'd like to order a coffee.
2. 我想预订一个房间。   → I'd like to book a room.
3. 我想换一些钱。       → I'd like to change some money.
4. 我想问一个问题。     → I'd like to ask a question.
```

### 建议数据结构

```json
{
  "type": "pattern_drill",
  "title": "I'd like to 句型操练",
  "pattern": "I'd like to [verb]...",
  "patternMeaning": "我想要...",
  "slots": ["verb"],
  "direction": "zh_to_en",
  "items": [
    { "zh": "我想点一杯咖啡。", "answer": "I'd like to order a coffee.", "slotValues": { "verb": "order" } },
    { "zh": "我想预订一个房间。", "answer": "I'd like to book a room.", "slotValues": { "verb": "book" } }
  ]
}
```

### 实现文件

| 层 | 文件 |
|----|------|
| 类型定义 | `features/practice/api/english-practice-api.ts` → `PatternDrillItem` |
| 管理后台表单 | `features/admin/components/pattern-drill-form.tsx` |
| 管理后台集成 | `features/admin/components/warmup-pipeline-tab.tsx` |
| AI 生成 | `modules/practice-ai/english-practice-ai.service.ts` → `generateDrills()` case `pattern_drill` |
| 移动端练习卡片 | `features/practice/components/pattern-drill-card.tsx` |
| 移动端流水线集成 | `features/practice/pages/practice-session-page.tsx` → `flatSteps` |

---

## 六、总结

| 项目 | 状态 |
|------|------|
| 单词练习 | ✅ 充分（chunk_substitution word 模式 + vocab_sentence_building） |
| 句块练习 | ✅ 充分（chunk_substitution chunk 模式 + vocab_sentence_building） |
| 句型练习 | ✅ 充分（pattern_drill 句型操练） |
| 句子构建 | ✅ 充分（sentence_decomposition 渐进拆解） |
| 输出训练阶梯 | ✅ 六层全部补齐 |

**四种题型覆盖全部语言素材（单词、句块、句型、句子），输出训练阶梯完整。**
