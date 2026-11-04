# `.learning.md` 编写规则

每个教学话题有一对文件：

```text
话题.md           # 面向学习者的教学正文
话题.learning.md  # 面向内容维护与同步的材料、练习配置
```

`.learning.md` 使用 YAML Front Matter，`learning` 下的每个数组声明该话题要关联的全局材料。同步时会优先按文本复用已有材料；不存在才创建最小记录。数组的顺序就是该话题的展示和练习优先级。

```md
---
learning:
  vocabulary: []
  chunks: []
  patterns: []
  exercises:
    enabled: true
    pipeline: []
---
```

## 三类材料的边界

| 类型 | 写什么 | 不写什么 |
| --- | --- | --- |
| `vocabulary` | 单词或可作为词典词条学习的固定词组，如 `get`、`take responsibility for` | 完整句子、带可替换槽位的框架 |
| `chunks` | 可独立说出的完整、自然英语话语，带正常标点 | 单词、纯搭配、残缺短语、只有公式的结构 |
| `patterns` | 带槽位的、完整且可反复替换的句子框架 | `verb + noun` 这类语法标签；没有语境的抽象公式 |

## 单词：`vocabulary`

写英文词条，既可以是单词，也可以是需要作为一个词汇单位记忆的固定词组。词组应是不可随意替换内部成分的搭配、短语动词或动词搭配；若它是完整交际话语，应归入 `chunks`；若它有可替换槽位，应归入 `patterns`。

词汇不能只列本课的动词。为使学习者能真正造句，应一并收录教学正文反复使用、且会改变表达内容的高频搭配词和语境词，例如搭配的名词（`decision`、`deadline`）、状态形容词（`calm`、`clear`）及方式/程度副词（`carefully`、`eventually`）。不要把冠词、代词、介词等纯功能词机械地加入；只收录值得独立识别、复现和练习的词。

```yaml
vocabulary:
  - get
  - take
  - make
  - take responsibility for
  - get rid of
```

## 句块：`chunks`

句块是学习者可以整体取用的完整表达。它可以是陈述、提问、请求、回应或感叹，但必须是自然、可独立理解的英语句子，并以 `.`, `?`, `!` 结束。

```yaml
chunks:
  - I need to get my laptop fixed before Monday.
  - Could you take a quick look at my code?
  - Let me know if you need any help.
```

以下内容不属于句块，应分别放入单词或句型：

```yaml
# 错误：只是搭配或短语
- take a break
- get rid of
- pay attention to

# 错误：只是语法公式
- get + adjective
```

选择句块时优先保留有高复用价值、真实交流中会整句说出的表达。句块在 AI 练习中被视为固定目标：生成的完整答案必须完整保留该表达，不能只命中其中几个词；因此不要写过长、信息过于具体或只能在单一场景使用的句子。

## 句型：`patterns`

句型是“固定语言骨架 + 可替换槽位”。项目数据库中已有的优质句型采用完整句框架和方括号槽位，例如：

```yaml
patterns:
  - I need to get [something] [past participle].
  - It takes me [time] to [verb phrase].
  - I'll take [someone] to [place].
  - What matters is [clause].
```

编写要求：

- 固定部分本身要构成可说的完整句子，而不是语法术语。
- 用 `[something]`、`[someone]`、`[place]`、`[time]`、`[adjective]`、`[verb phrase]`、`[clause]` 等描述槽位；同一概念在一个文件里保持同一种写法。
- 保留必要的冠词、介词、助动词、时态与标点，例如写 `I'm saving up for [something].`，不要只写 `save up for + something`。
- 一个句型应代表一个稳定交际意图。相同结构仅主语或时态不同，不要重复收录。
- 优先选择能和本话题单词组合产出不同内容的框架。AI 会用槽位替换来生成 `pattern_drill` 练习。

```yaml
# 不推荐：无法直接用于句型操练
- get + noun
- take responsibility for + noun

# 推荐：完整、可替换、带意图
- I got [something] from [someone].
- I need to take responsibility for [something].
```

## 数量与顺序

材料应以教学目标为准，而不是为了凑数量。普通话题可从词汇词条（单词和词组合计）3–10 个、句块 3–8 个、句型 2–6 个开始。系统性总览课（例如一课覆盖多个高频核心动词）可以显著更多：先确保每个正文知识点都有一个可输出的代表性材料，再补充能让搭配落地的名词、形容词和副词；不必把正文的每一个例句原样收录。

在编辑已有学习包前，先检查同包前序话题和前序包是否已认领该材料。后续包若只想在例句里复现前序知识，不应把它再次声明为新的话题材料。

## 练习：`exercises`

练习仍使用现有 `outputTraining.pipeline` 格式。每个题组必须有唯一稳定的 `key`；支持 `chunk_substitution`、`vocab_drill`、`vn_dialogue`、`vocab_sentence_building`、`sentence_decomposition`、`pattern_drill`。先确认三类材料边界正确，再编排练习。

练习设计遵循现有 AI 生成器的覆盖规则：每个已声明的材料，至少应在一道真实英语题的答案或英文题干中出现一次；只写在标题、中文提示或说明里不算覆盖。优先顺序是：

1. 以 `chunk_substitution` 做中译英输出激活，再补至少一组英译中理解检查；句块必须在英文题干/答案中完整保留。
2. 用 `pattern_drill` 让同一句型在不同槽位和生活情境中变化；不要只替换人名或一个名词。
3. 用 `vocab_sentence_building` 将单词或词组放进不同句型；词组必须作为连续整体出现在英文句中。
4. 只在确有清晰递进结构时，用 `sentence_decomposition` 做最后的整合；每层必须是在前一层上增加一个成分，最后一层是完整句。

每一题的中文提示必须是英文答案的完整、准确翻译；不要把情境说明混进翻译题。每组至少两题，英语句子要自然且变换交际目的、人物关系、时态或场景。总览课要让核心动词、典型搭配及其常见对象在不同题组中轮换出现；练习引擎当前一轮最多 60 个作答、30 个题组，超出时应拆成后续主题或下一轮练习，而不能用几道题“假装覆盖”全部材料。
