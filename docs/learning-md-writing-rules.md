# `.learning.md` 编写规则（最终版）

## 一、设计目标

`.learning.md` 用于声明教学话题的学习材料及知识点练习配置。

整个学习体系以**英语主动输出能力**为核心。

学习者不需要在初期就能完全自由地表达，但应逐步建立以下能力：

1. 看到表达意图，能够主动回忆相应的英语。
2. 掌握常用词汇和固定搭配的实际使用方法。
3. 能够将已经学过的词块放进不同的句式中。
4. 能够结合时态、情态动词、状语、从句等知识组织完整表达。
5. 逐渐减少对中文翻译、固定例句和显式语法分析的依赖。

学习模式强调语言组块的积累和调用，而不是单纯记忆语法规则或大量孤立句子。

**核心原则：学习材料尽量真实、精简；练习生成尽量灵活、多样；最终目标始终是主动输出。**

---

## 二、文件结构

每个教学话题包含一对文件：

```text
话题.md           # 面向学习者的教学正文
话题.learning.md  # 面向内容维护与同步的材料、练习配置
```

`.learning.md` 使用 YAML Front Matter。

```yaml
---
learning:
  vocabulary: []
  chunks: []
  patterns: []

  chunk_models: []

  exercises:
    enabled: true
    pipeline: []
---
```

### 2.1 字段职责

| 字段 | 是否面向用户 | 核心职责 |
|---|---|---|
| `vocabulary` | 是 | 单词与固定搭配学习 |
| `chunks` | 是 | 真实英语词块与完整表达学习 |
| `patterns` | 是 | 高频、可复用的句型学习 |
| `chunk_models` | 否 | 描述词块背后的抽象结构，指导练习生成 |
| `exercises` | 练习 | 组合、变形和输出训练 |

**用户学习的材料类型始终只有 Vocabulary、Chunks、Patterns 三种。**

`chunk_models` 是内部教学元数据，不属于第四种学习材料。

### 2.2 材料同步规则

`vocabulary`、`chunks`、`patterns` 继续遵循现有全局材料同步逻辑：

- 优先按文本复用已有材料。
- 不存在时创建最小记录。
- 数组顺序代表展示和练习优先级。
- 避免重复认领已经由前序话题引入的材料。

`chunk_models`：

- 不同步为全局学习材料。
- 不展示给学习者。
- 不单独计入学习数量。
- 不生成独立复习任务。
- 仅供教学内容维护、AI 练习生成和结构覆盖检查使用。

新增字段需要解析器与生成器提供支持；本文定义其目标行为，不代表旧版程序已经具备这些能力。

---

## 三、总体教学架构

学习体系分为四个层次。

### 3.1 Vocabulary：表达基础

提供单词与固定搭配。

例如：

- get
- take
- make
- get rid of
- decision
- confident

### 3.2 Chunks：真实语言单位

提供学习者可以直接认识、记忆和调用的自然英语。

例如：

- get to work
- get ready
- get better
- take responsibility for the mistake
- I'll get back to you.

Chunks 应尽量使用具体、真实、自然的英语表达，而不是大量抽象槽位。

### 3.3 Patterns：高复用句型

提供少量值得独立掌握的句型骨架。

例如：

- I need to [do].
- How can I [do]?
- It takes [someone] [time] to [do].
- What matters is [clause].

Patterns 不需要为每个动词及每种语法变化分别创建。

### 3.4 Exercises：语言组合与主动输出

通过知识点练习，使学习者将已有材料组合为不同句式。

例如，围绕 `get to work`，可以练习：

**I usually get to work at nine.**

我通常九点到公司。

**Did you get to work on time?**

你按时到公司了吗？

**I couldn't get to work because of the traffic.**

因为堵车，我没能到公司。

**I called her after I got to work.**

我到公司后给她打了电话。

这些句子主要属于练习生成内容，不需要全部保存为新的学习材料。

---

## 四、三类材料的边界

| 类型 | 应收录 | 不应收录 |
|---|---|---|
| `vocabulary` | 单词、短语动词、固定搭配、语境词 | 完整句子、带槽位的抽象模板 |
| `chunks` | 真实词块、常用搭配实例、自然完整表达 | 大量 `get to [place]` 式抽象模型、随机例句 |
| `patterns` | 高复用、具有独立学习价值的完整句型骨架 | 普通语法标签、机械派生的陈述句和疑问句 |

### 4.1 分类原则

分类依据是材料的学习价值和使用目的。

例如：

| 内容 | 类型 |
|---|---|
| `get` | Vocabulary |
| `get rid of` | Vocabulary |
| `get to work` | Chunk |
| `get to [place]` | Chunk Model |
| `I need to [do].` | Pattern |
| `I couldn't get to work yesterday.` | 通常作为练习句 |

一个表达可以在不同层次发挥作用，但不应仅为了增加材料数量而重复收录。

---

## 五、单词：`vocabulary`

### 5.1 定义

`vocabulary` 收录值得作为独立词汇单位学习的单词和固定搭配。

包括：

- 核心动词。
- 常用名词、形容词和副词。
- 高频短语动词。
- 常用固定搭配。
- 为句型和词块输出提供内容的语境词。

例如：

```yaml
vocabulary:
  - get
  - take
  - make
  - get ready
  - get rid of
  - take responsibility for
  - decision
  - deadline
  - confident
  - carefully
```

### 5.2 词汇应服务于输出

不能只收录教学话题中的目标动词。

学习 `get` 时，可以增加：

- confident
- nervous
- better
- worse

学习 `make` 时，可以增加：

- decision
- progress
- effort
- mistake

这些词可以帮助学习者产生不同的表达。

但不要机械地收录冠词、代词、介词等普通功能词。

### 5.3 固定搭配

以下可以作为 Vocabulary：

```yaml
vocabulary:
  - get rid of
  - take responsibility for
  - make a decision
  - pay attention to
```

如果教学目标不仅是理解这些搭配，还包括在具体语境中使用，可以同时选择真实的 Chunks。

例如：

```yaml
chunks:
  - get rid of old clothes
  - take responsibility for the mistake
  - make a decision
  - pay attention to the details
```

但应避免没有必要的重复。

---

## 六、句块：`chunks`

### 6.1 定义

`chunks` 是学习者可以作为整体识别、记忆和调用的自然英语语言单位。

它可以是：

1. 常用词组。
2. 具有明确意义的动词搭配实例。
3. 半固定表达的具体实现。
4. 高频、完整的交际话语。

Chunks 不要求必须是完整句子。

但应尽量保持真实、自然、具体，而不是使用大量抽象占位符。

### 6.2 优先使用具体表达

例如：

推荐：

```yaml
chunks:
  - get to work
  - get to school
  - get ready
  - get better
  - get someone to agree
```

其中 `get someone to agree` 仍保留了泛指成分；如果本课希望完全使用具体实例，更推荐：

```yaml
chunks:
  - get to work
  - get ready
  - get better
  - get him to agree
```

不推荐把以下内容直接放入 Chunks：

```yaml
chunks:
  - get to [place]
  - get [adjective]
  - get [someone] to [do]
```

这些抽象结构应放入 `chunk_models`。

### 6.3 Chunks 应具有真实使用价值

优先选择：

- 高频日常搭配。
- 常见生活或工作场景表达。
- 容易出现搭配错误的结构实例。
- 值得整体调用的自然表达。
- 能帮助学习者理解重要动词用法的典型实例。

例如：

```yaml
chunks:
  - get to work
  - get ready
  - get used to it
  - get rid of old clothes
  - get the job done
  - I'll get back to you.
```

### 6.4 不机械枚举所有实例

例如，`get to [place]` 可以生成：

- get to work
- get to school
- get to the office
- get to the station
- get to London

但没有必要将所有地点都收录为新的 Chunk。

通常选择最有代表性、最常用的具体实例即可。

其余内容由 `chunk_models` 指导练习生成。

### 6.5 完整交际表达

以下内容也属于 Chunks：

```yaml
chunks:
  - I got it.
  - That makes sense.
  - Hold on.
  - Let me think about it.
  - I'll get back to you.
  - Let me know if you need any help.
```

这类表达可以直接用于真实交流，具有整体调用价值。

### 6.6 不把普通例句全部变成 Chunks

例如：

**I accidentally left my wallet at home this morning.**

如果它主要用于展示 `leave something somewhere` 的用法，则应保留在教学正文或练习中。

不必把整句话单独作为一个 Chunk。

### 6.7 Chunks 的筛选标准

一个 Chunk 应尽量满足以下条件：

- 真实、自然。
- 有明确意义。
- 高频或具有重要教学价值。
- 值得作为一个整体记忆。
- 能够与其他已学知识组合。
- 不只是为了展示某条语法规则而临时拼凑的句子。

**Chunks 强调实际英语材料的积累，不负责穷尽动词结构的全部变化。**

---

## 七、隐藏结构：`chunk_models`

### 7.1 定义

`chunk_models` 是面向内容维护与 AI 练习生成的隐藏结构描述。

它的作用是让生成器理解：

- 具体 Chunk 背后使用了什么结构。
- 哪些部分可以替换。
- 哪些介词和语法形式必须保留。
- 该结构通常表达什么意义。
- 怎样围绕这个结构生成不同句式和语境的练习。

**Chunk Models 是练习生成依据，不是用户需要额外记忆的材料。**

### 7.2 基本格式

推荐使用 `structure` 和 `examples` 建立明确映射。

```yaml
chunk_models:
  - structure: get to [place]
    examples:
      - get to work

  - structure: get [adjective]
    examples:
      - get ready
      - get better

  - structure: get [someone] to [do]
    examples:
      - get him to agree
```

其中：

- `structure`：抽象的核心结构。
- `examples`：与该结构对应的真实 Chunks。

`examples` 中的内容应与本话题 `chunks` 中声明的材料一致。

### 7.3 建议增加语义说明

同一个动词可能有多个不同用法。

为了减少练习生成时的歧义，可以增加 `meaning`：

```yaml
chunk_models:
  - structure: get to [place]
    meaning: 到达某地
    examples:
      - get to work

  - structure: get [adjective]
    meaning: 变得或进入某种状态
    examples:
      - get ready
      - get better

  - structure: get [someone] to [do]
    meaning: 通过请求、说服或安排使某人做某事
    examples:
      - get him to agree
```

`meaning` 是内部说明，不展示为新的学习材料。

### 7.4 推荐的字段结构

```yaml
chunk_models:
  - structure: get to [place]
    meaning: 到达某地
    examples:
      - get to work
    notes:
      - home 和 there 等地点副词通常不加 to
```

字段说明：

| 字段 | 作用 |
|---|---|
| `structure` | 必填，核心抽象结构 |
| `examples` | 必填，对应的真实 Chunk |
| `meaning` | 推荐，明确结构意义 |
| `notes` | 可选，记录特殊搭配和使用限制 |

保持结构简洁，不要增加大量可以由练习生成器自行处理的配置。

### 7.5 一个 Model 可以对应多个 Chunks

例如：

```yaml
chunk_models:
  - structure: get [adjective]
    meaning: 变得或进入某种状态
    examples:
      - get ready
      - get better
      - get worse
```

这三个 Chunks 可以共享一个核心结构。

没有必要为每个 Chunk 创建一个独立 Model。

### 7.6 不同意义的结构应分开

例如：

```yaml
chunk_models:
  - structure: get to [place]
    meaning: 到达某地
    examples:
      - get to work

  - structure: get to [do]
    meaning: 有机会做某事
    examples:
      - get to meet her
```

虽然两者都包含 `get to`，但意义和后续成分不同。

必须分开描述。

### 7.7 不把所有语法变化写入 Chunk Models

`chunk_models` 只描述核心组合结构。

不需要预先保存：

- 一般现在时。
- 一般过去时。
- 疑问句。
- 否定句。
- 情态动词。
- 进行时。
- 完成时。
- 副词。
- 时间状语。
- 连接词。
- 复合句。

这些变化交给 `exercises`。

例如：

```yaml
chunk_models:
  - structure: get to [place]
    meaning: 到达某地
    examples:
      - get to work
```

就足以指导生成器围绕此结构训练不同句式。

### 7.8 不强制每个 Chunk 都有 Model

例如：

`I got it.`

`That makes sense.`

`Hold on.`

这些完整表达可以直接进行整句回忆和情境调用训练。

如果没有明显的结构迁移需求，可以不创建对应的 Chunk Model。

**只有需要结构替换和迁移的 Chunks，才优先配置 Chunk Models。**

### 7.9 Chunk Model 的去重

如果多个 Chunks 共享同一结构，应使用一个 Model。

如果两个 Model 只是主语、时态或具体名词不同，应优先合并。

如果两者意义、搭配关系或语法功能不同，应保留。

---

## 八、句型：`patterns`

### 8.1 定义

`patterns` 收录具有独立学习价值、能够跨词汇和语境复用的完整句型骨架。

例如：

```yaml
patterns:
  - I need to [do].
  - How can I [do]?
  - It takes [someone] [time] to [do].
  - What matters is [clause].
  - I find it [adjective] to [do].
```

Patterns 仍是用户实际学习的材料。

### 8.2 句型应尽可能精简

这里的精简指：

- 不收录多余的具体信息。
- 不机械重复主语和时态变化。
- 不为每个动词重新创建相似句型。
- 不把所有练习句子保存为 Patterns。

例如：

```yaml
patterns:
  - I need to [do].
```

就可以结合多个 Chunks。

不需要分别保存：

```text
I need to get to work.
I need to get my laptop fixed.
I need to take responsibility for this.
```

这些句子属于实际应用。

### 8.3 不为每个 Chunk 配置多个 Patterns

例如：

Chunk：

`get to work`

Model：

`get to [place]`

以下内容通常不需要单独收录为 Patterns：

```text
I usually get to [place] at [time].
What time did you get to [place]?
I couldn't get to [place].
Can you get to [place]?
```

这些句子可以由练习生成器根据句式知识生成。

### 8.4 Patterns 优先收录特殊且高复用的句型

例如：

```yaml
patterns:
  - It takes [someone] [time] to [do].
  - What matters is [clause].
  - I find it [adjective] to [do].
  - The reason is that [clause].
  - The more [clause], the more [clause].
```

这些句型具有值得独立掌握的表达结构。

### 8.5 普通语法变化不创建 Pattern

通常不为以下内容创建独立 Pattern：

- 一般陈述句。
- 一般疑问句。
- 特殊疑问句。
- 否定句。
- 主语变化。
- 时态变化。
- 普通情态动词组合。
- 常见副词和状语修饰。
- 已掌握连接词形成的复合句。

这些变化应由练习完成。

但当某一种句式结构本身是本课教学目标时，可以例外。

### 8.6 Pattern 可以跨话题复用

例如：

`I need to [do].`

可以与下列词块组合：

- get to work
- get the job done
- take responsibility for something

输出：

**I need to get to work early.**

**I need to get the job done.**

**I need to take responsibility for this.**

已有 Pattern 应优先复用，不需要每个话题重新声明。

### 8.7 不强制每个话题都有 Patterns

如果一个话题主要教学动词结构，而没有新增值得独立学习的句型：

```yaml
patterns: []
```

是允许的。

不应为了填满三个数组而人为增加材料。

---

## 九、统一槽位规范

`patterns` 和 `chunk_models.structure` 可以使用方括号槽位。

| 槽位 | 含义 |
|---|---|
| `[someone]` | 人 |
| `[something]` | 事物或抽象内容 |
| `[place]` | 地点 |
| `[somewhere]` | 地点状语 |
| `[time]` | 时间 |
| `[noun]` | 名词或名词短语 |
| `[adjective]` | 形容词 |
| `[do]` | 动词原形及必要后续成分 |
| `[doing]` | V-ing 形式及必要后续成分 |
| `[past participle]` | 过去分词 |
| `[clause]` | 从句 |

### 9.1 编写要求

- 固定的介词和语法标记必须保留。
- 相同概念使用统一槽位。
- 不能因为有槽位就认为任意内容都可以替换。
- 实际生成时必须符合自然英语搭配。
- 完整 Patterns 使用正常标点。
- Chunk Models 不要求句末标点。
- Chunks 尽量使用具体表达，不使用抽象槽位。

### 9.2 不把槽位当成机械字符串替换

例如：

`get to [place]`

生成器应知道：

- get to London
- get to the office
- get home
- get there

其中 `get home`、`get there` 不使用 `to`。

这属于结构使用规则，而不是简单替换字符串。

---

## 十、材料数量与学习负担

### 10.1 核心原则

**减少独立学习目标，不减少有效应用机会。**

一个 Chunk Model 可以支持许多练习。

一个 Pattern 可以与不同 Chunks 组合。

因此，练习数量不应该直接决定材料数量。

### 10.2 Chunks 不追求穷尽

例如：

`get to [place]`

可以对应大量真实表达，但只需要选择少量代表性 Chunks。

不必将每一种地点都收录为独立材料。

### 10.3 Patterns 不按动词平均分配

有些动词具有特殊句型，需要单独学习。

有些动词只需要词块和普通语法组合训练。

不能强制每个动词都配置相同数量的 Patterns。

### 10.4 Chunk Models 不作为学习负担

不展示、不计数、不生成独立复习。

它的数量只应由真正不同的核心结构决定。

### 10.5 已学材料可以再次使用

在新话题的知识点练习中，可以重新使用已经学过的：

- Vocabulary。
- Chunks。
- Patterns。
- 语法知识。

但不需要重新声明为新材料。

---

## 十一、知识点练习：`exercises`

练习继续使用现有的 `outputTraining.pipeline` 格式。

支持以下类型：

- `vocab_drill`
- `vocab_sentence_building`
- `chunk_substitution`
- `pattern_drill`
- `vn_dialogue`
- `sentence_decomposition`

每个题组必须有稳定、唯一的 `key`。

### 11.1 练习目标

知识点练习负责将真实学习材料转化为可迁移的输出能力。

主要包括：

1. 单词回忆。
2. 词块激活。
3. 核心结构迁移。
4. 高频句型调用。
5. 句式与时态变化。
6. 语法组合。
7. 情境表达。
8. 简单句到复合句的扩展。

这些是训练目标，不要求增加新的练习类型。

---

## 十二、Vocabulary 练习

### 12.1 主要任务

- 识别词义。
- 回忆目标词汇。
- 掌握固定搭配。
- 在真实英语句子中使用。
- 根据表达意图选择合适词汇。

### 12.2 练习示例

目标：

`take responsibility for`

**I need to take responsibility for this mistake.**

我需要为这个错误负责。

**He refused to take responsibility for the problem.**

他拒绝为这个问题负责。

应尽量在不同场景中使用同一搭配。

不要让词汇练习全部停留在词义匹配或选择题上。

---

## 十三、Chunks 与 Chunk Models 的练习

这是本规则最重要的部分。

### 13.1 双层训练目标

对于：

```yaml
chunks:
  - get to work

chunk_models:
  - structure: get to [place]
    meaning: 到达某地
    examples:
      - get to work
```

练习必须区分：

**第一层：原型激活。**

用户是否能够理解并使用学过的 `get to work`？

**第二层：结构迁移。**

用户是否能够把 `get to [place]` 应用到其他地点、主语和句式？

这两个目标可以在同一题组中完成，也可以分别安排。

### 13.2 原型激活

首先使用用户已经学习的具体 Chunk。

例如：

**I usually get to work at nine.**

我通常九点到公司。

**I got to work late yesterday.**

我昨天上班迟到了。

这个阶段重点是让用户熟悉真实表达。

### 13.3 结构迁移

随后在同一个 Chunk Model 下改变具体内容。

例如：

**I got to the station at six.**

我六点到了车站。

**Did you get to school on time?**

你按时到学校了吗？

**I couldn't get to the office.**

我没能到办公室。

这些句子可以训练同一核心结构，但不需要创建对应的新 Chunks。

### 13.4 句式变化

结合已学语法进行：

- 陈述。
- 疑问。
- 否定。
- 祈使。
- 时态变化。
- 情态动词。
- 动名词。
- 不定式。

例如：

目标：

`get to [place]`

**I got to London yesterday.**

**When did you get to London?**

**I might get to London tomorrow.**

**Getting to London took longer than expected.**

### 13.5 修饰成分

可以增加：

- 时间状语。
- 地点状语。
- 频率副词。
- 方式副词。
- 程度副词。

例如：

**I got to the station.**

**I finally got to the station.**

**I finally got to the station at midnight.**

这些变化属于练习内容，不新增学习材料。

### 13.6 复合句

可以结合已经学过的连接词：

- after
- before
- when
- because
- if
- although

例如：

**I called her after I got to the station.**

我到车站后给她打了电话。

**I couldn't get to work because the road was closed.**

因为道路封闭，我没办法去上班。

学习 `get` 时，连接词只是辅助表达。

学习 `after`、`because` 等连接关系时，才把对应结构作为主要学习目标。

### 13.7 不机械覆盖全部变化

不要求每个 Chunk Model 都生成：

- 一条陈述句。
- 一条疑问句。
- 一条否定句。
- 一条完成时。
- 一条情态动词句。
- 一条复合句。

应根据目标结构、学习者水平和实际表达价值选择变化方式。

**练习多样性不等于机械枚举所有语法形式。**

### 13.8 不将结构迁移误判为原样覆盖

例如：

目标 Chunk：

`get to work`

生成：

**I got to the station.**

这体现 `get to [place]` 的迁移，但没有直接使用 `get to work`。

因此，应区分：

- Chunk 原型覆盖。
- Chunk Model 结构覆盖。

不能用结构迁移替代所有原型学习，也不能只检查原始字符串来判断结构是否掌握。

---

## 十四、Pattern 练习

### 14.1 核心目标

使学习者能够调用高复用句型，并替换不同内容。

例如：

`It takes [someone] [time] to [do].`

可以生成：

**It takes me an hour to get to work.**

我去上班要一个小时。

**It took her two days to finish the report.**

她花了两天完成报告。

**How long does it take you to get home?**

你回家需要多久？

### 14.2 不机械保存变化句型

这些都是同一个 Pattern 的应用。

不需要分别创建三个独立 Patterns。

### 14.3 与 Chunks 组合

例如：

Pattern：

`I need to [do].`

Chunk：

`get to work`

可以生成：

**I need to get to work early.**

如果存在可兼容的其他词块，也可以在后续练习中组合使用。

### 14.4 不强制每道题都有 Pattern

很多英语句子可以通过 Chunk 和普通语法知识直接生成。

不需要为了让练习使用 `patterns` 而强行套入某个句型。

---

## 十五、从简单句到复杂句

`sentence_decomposition` 主要用于训练语言组合和信息扩展。

例如：

1. **I got home.**
2. **I got home late.**
3. **I got home late last night.**
4. **I called her after I got home late last night.**

每一层增加有意义的信息或结构。

可以训练：

- 时间。
- 地点。
- 方式。
- 原因。
- 条件。
- 时间关系。
- 句子之间的连接。

最终目标是让学习者理解如何在简单表达基础上增加信息，而不是机械背诵越来越长的句子。

扩展必须保持自然、语义清晰。

---

## 十六、对话与情境输出

`vn_dialogue` 用于模拟真实交流。

例如：

A: **Why are you late?**

B: **I couldn't get to work on time because of the traffic.**

或者：

A: **Have you finished the report?**

B: **Not yet. I'm still working on it.**

练习可以同时调用：

- 已学词汇。
- Chunks。
- Patterns。
- 已掌握的语法。

重点是让学习者根据情境选择合适表达，而不是复述固定对话。

### 16.1 允许自然变体

例如：

目标结构：

`get to [place]`

用户输出：

**I arrived at the office at nine.**

句子本身正确，但没有激活指定的 `get` 结构。

练习反馈应区分：

- 英语表达是否正确。
- 是否符合交流意图。
- 是否使用目标结构。

不能因为没有命中目标材料，就把自然且正确的英语直接判定为语法错误。

---

## 十七、练习递进原则

建议按照以下顺序安排：

### 第一阶段：理解

知道词汇、词块或句型的意义。

### 第二阶段：主动回忆

根据中文或交流意图回忆英语。

### 第三阶段：结构替换

改变人物、事物、动作或场景。

### 第四阶段：句式变化

结合时态、疑问、否定、情态动词等进行输出。

### 第五阶段：综合表达

结合副词、状语、连接词及其他已学材料。

### 第六阶段：情境迁移

减少提示，根据具体交流情境主动选择表达。

不要求每个话题都完整配置六个独立题组。

可以通过现有练习类型组合完成。

---

## 十八、练习生成原则

### 18.1 以输出为核心

优先让学习者实际产生英语，而不是只判断、识别或选择答案。

### 18.2 先掌握核心，再增加复杂度

一个练习应有明确的主要目标。

不要同时增加太多陌生词汇和复杂语法。

### 18.3 内容变化应具有实际意义

避免：

- I got to London.
- I got to Paris.
- I got to Tokyo.

这样连续进行大量机械地点替换。

应适度变化：

- 句式。
- 时间。
- 人物。
- 情境。
- 意图。
- 修饰成分。
- 句子结构。

### 18.4 允许组合旧知识

已学习的词汇、Chunk、Pattern 可以在后续练习中重新使用。

但不需要重新作为新材料声明。

### 18.5 不把生成结果自动保存为学习材料

AI 生成的普通句子，仅作为练习实例。

不能因为生成了一句话，就创建新的 Chunk 或 Pattern。

### 18.6 不追求练习数量最大化

优先保证核心结构得到有效、多样的激活。

对于已经熟练掌握的内容，可减少机械重复，增加情境迁移。

### 18.7 练习应自然

所有句子必须符合英语语法、搭配和语义习惯。

不能机械地将任意 Chunk 填入任意 Pattern。

---

## 十九、练习材料覆盖与校验

每个声明的学习材料应有实际学习或练习机会。

### 19.1 Vocabulary 覆盖

应在真实英语题干或答案中体现目标意义或搭配。

### 19.2 Chunk 覆盖

对固定表达，专项练习可以要求完整保留。

对具体词块，可允许合理的时态和形态变化。

例如：

`get to work`

可以在答案中实现为：

**I got to work late.**

但是否算作原型覆盖，需要识别其目标词块，而不是简单全文字符串匹配。

### 19.3 Chunk Model 覆盖

可以通过不同结构实例验证。

例如：

`get to [place]`

对应：

**I got to the office.**

**Did you get to school?**

**I couldn't get to the station.**

这些句子体现结构迁移。

### 19.4 Pattern 覆盖

应在实际英语表达中体现目标句型骨架。

允许合理的主语、时态和句式变化。

### 19.5 覆盖与掌握是不同概念

一道题出现某个材料，表示它获得了练习机会。

不代表用户已经掌握。

熟练度需要结合学习者的实际答题表现判断。

---

## 二十、数量与去重规则

### 20.1 Vocabulary

收录教学目标词汇和必要的语境词。

避免机械增加无关词汇。

### 20.2 Chunks

优先选择具有代表性的真实表达。

一个 Chunk Model 通常只需少量具体 Chunk 作为初始学习实例。

### 20.3 Chunk Models

按照不同语义和核心搭配结构建立。

相同结构共享一个 Model。

### 20.4 Patterns

优先选择高复用、具有独立价值的句型。

不按动词数量平均分配。

### 20.5 Exercises

主要通过组合已学知识增加练习多样性。

不通过无限增加学习材料扩展练习覆盖。

### 20.6 跨话题去重

编写前检查同包前序话题和前序学习包。

已经认领的材料，在新话题中可以被调用，但不应无意义地重复认领。

---

## 二十一、完整配置示例

以下以 `get` 为例：

```yaml
---
learning:
  vocabulary:
    - get
    - get ready
    - get better
    - get worse
    - get used to
    - get rid of
    - get back to
    - confident
    - nervous
    - message

  chunks:
    - get to work
    - get ready
    - get better
    - get worse
    - get used to it
    - get rid of old clothes
    - get him to agree
    - get my laptop fixed
    - I got it.
    - I'll get back to you.

  patterns:
    - I need to [do].
    - How can I [do]?

  chunk_models:
    - structure: get to [place]
      meaning: 到达某地
      examples:
        - get to work
      notes:
        - home 和 there 等地点副词通常不加 to

    - structure: get [adjective]
      meaning: 变得或进入某种状态
      examples:
        - get ready
        - get better
        - get worse

    - structure: get used to [noun/doing]
      meaning: 逐渐习惯某事
      examples:
        - get used to it

    - structure: get rid of [something]
      meaning: 摆脱或去掉某物
      examples:
        - get rid of old clothes

    - structure: get [someone] to [do]
      meaning: 让某人做某事
      examples:
        - get him to agree

    - structure: get [something] [past participle]
      meaning: 让某事得到处理或完成
      examples:
        - get my laptop fixed

  exercises:
    enabled: true
    pipeline: []
---
```

### 21.1 示例说明

Vocabulary 提供词汇基础。

Chunks 提供用户真正接触、记忆的英语表达。

Patterns 提供能够跨场景复用的句型。

Chunk Models 描述 Chunks 背后的抽象结构。

Exercises 结合上述材料生成多种输出训练。

这里没有把所有 `get` 的例句保存成 Patterns。

### 21.2 Pipeline 说明

示例中的：

```yaml
exercises:
  enabled: true
  pipeline: []
```

仅用于说明基本结构。

正式生成学习包时，应按照项目已有的 `outputTraining.pipeline` 格式填写实际题组及稳定 `key`。

不要自行创造生成器尚未支持的练习类型。

---

## 二十二、内容编写流程

### 第一步：分析教学正文

识别：

- 核心词义。
- 高频搭配。
- 不同动词结构。
- 特殊语法用法。
- 高频完整表达。

### 第二步：生成 Vocabulary

收录核心词汇和必要的语境词。

### 第三步：生成 Chunks

选择具体、真实、有代表性的英语表达。

优先使用学习者在日常交流中可能遇到或使用的内容。

### 第四步：生成 Chunk Models

从已选择的 Chunks 中提炼核心结构。

明确：

- `structure`
- `meaning`
- `examples`
- 必要时的 `notes`

不要为普通句式变化重复建立 Model。

### 第五步：生成 Patterns

检查是否存在值得独立学习的高复用句型。

优先复用已有句型。

没有必要时允许 `patterns: []`。

### 第六步：编排 Exercises

按照当前目标选择适当练习类型。

优先安排：

1. 核心材料激活。
2. 结构迁移。
3. 句式变化。
4. 知识组合。
5. 情境输出。

### 第七步：检查材料规模

删除：

- 不必要的重复词汇。
- 大量只替换一个名词的 Chunks。
- 普通语法变化派生出的 Patterns。
- 重复描述相同结构的 Chunk Models。
- 没有实际学习价值的具体例句。

### 第八步：检查输出价值

检查学习者完成话题后能否：

- 主动调用学过的 Chunk。
- 使用同一结构表达不同内容。
- 将不同知识组合成句子。
- 在情境中选择合适表达。

如果只能复述原句，就需要提高练习的迁移性。

---

## 二十三、生成器适配要求

本规则增加了内部字段 `chunk_models`，同时明确 Chunks 应尽量使用真实的具体表达。

因此，需要保证生成器能够正确处理以下关系。

### 23.1 三类材料仍按原方式同步

`vocabulary`、`chunks`、`patterns` 继续作为用户学习材料。

### 23.2 Chunk Models 只参与内部生成

不创建全局学习记录，不进入用户的材料列表，不作为独立复习目标。

### 23.3 生成器应理解 Model 与 Chunk 的映射

例如：

`get to work`

对应：

`get to [place]`

允许生成器在训练结构迁移时使用其他合适地点。

### 23.4 必须区分原型和迁移

使用 `get to work` 的题目用于激活已学具体表达。

使用 `get to school` 的题目可以用于检验相同结构的迁移能力。

两者不能混为同一种覆盖。

### 23.5 不能依赖简单字符串匹配

动词可以发生自然变化：

- get → got
- get → getting
- take → took
- make → made

生成器和校验器应能够区分合法形态变化与结构使用错误。

### 23.6 不任意拼接材料

Chunk Model 只提供可迁移的结构信息。

生成器仍需判断语法、搭配、语义和语境是否合理。

### 23.7 保留现有题型

不因增加 `chunk_models` 而新增一套独立练习类型。

优先让现有 `chunk_substitution`、`pattern_drill`、`vocab_sentence_building`、`vn_dialogue` 等利用隐藏结构信息生成更有变化的内容。

---

## 二十四、最终设计原则

**Vocabulary：提供词汇。**

用户认识表达所需的单词和固定搭配。

**Chunks：提供真实语言单位。**

用户学习自然、具体、可整体调用的词块与完整表达。

**Patterns：提供精简句型。**

用户掌握少量具有独立价值、可跨场景复用的句型骨架。

**Chunk Models：提供隐藏的结构指导。**

AI 理解具体词块背后的语义、搭配结构和可迁移方式。

**Exercises：负责主动输出。**

通过句式、时态、情态、修饰成分、连接词、复杂句和实际对话，让学习者反复调用和组合已有知识。

### 最高原则

**用户不需要记住所有可能的英语句子，只需要逐步掌握高价值语言单位，并学会在不同情境中灵活调用。**

材料尽量精简，表达尽量真实，组合尽量灵活，练习始终以主动输出为目标。
