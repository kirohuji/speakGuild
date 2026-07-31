# Advanced 高级课程体系设计（B2 → C1）

> `advanced-*` 承接 `course-1` 至 `course-10`。Course 让学习者能够独立完成真实任务；Advanced 进一步训练精确表达、复杂论证、信息综合、语域控制和不可预测互动。

## 一、课程定位

| 维度 | 设计 |
|:-----|:-----|
| 入门水平 | CEFR B2 门槛；完成 Course 1—10 |
| 结课目标 | 稳定 B2+，达到 C1 门槛 |
| 雅思能力参考 | 入门约 5.5—6.0；结课沟通能力约 7.0—7.5 |
| 平台等级 | Advanced 1—5 为 L4；Advanced 6—10 为 L5 |
| 核心变化 | 从“完成任务”升级为“精准、灵活、有说服力地处理复杂任务” |

> 雅思分数仅用于能力定位。Advanced 是综合语言能力课程，不替代雅思阅读、写作和题型专项训练。

## 二、高级阶段训练什么

```text
准确限定观点
→ 从不同视角组织复杂叙事
→ 分析和评价论证
→ 在专业环境中影响他人
→ 处理高分歧协商
→ 综合证据并表达限制
→ 讨论公共议题和媒体话语
→ 跨文化调整表达
→ 完成长篇展示和深度问答
→ 在综合项目中达到 C1 门槛
```

高级不等于堆叠生僻词或写超长句。真正的高级能力体现在：

- 精确控制确定程度、态度和语气。
- 根据听者、关系和场合切换语域。
- 综合多个来源，而不是逐条复述。
- 承认限制、回应反例并修正立场。
- 在被打断、质疑或信息不足时继续有效沟通。

## 三、10 个学习包

| 包 | 目录 | 等级 | 核心成果 |
|:--:|:-----|:----:|:---------|
| 1 | `advanced-1-nuanced-expression` | L4 | 精确表达立场、态度、程度和保留 |
| 2 | `advanced-2-complex-storytelling` | L4 | 通过视角、时间线和重点控制复杂叙事 |
| 3 | `advanced-3-critical-reasoning` | L4 | 分析主张、证据、假设和反例 |
| 4 | `advanced-4-professional-leadership` | L4 | 主持协作、影响决策并给予高级反馈 |
| 5 | `advanced-5-negotiation-conflict` | L4 | 处理高分歧协商、冲突和关系修复 |
| 6 | `advanced-6-research-evidence` | L5 | 综合来源、解释数据并限定结论 |
| 7 | `advanced-7-media-public-issues` | L5 | 分析媒体框架并讨论复杂公共议题 |
| 8 | `advanced-8-cross-cultural-communication` | L5 | 跨文化调整语域、含蓄度和互动方式 |
| 9 | `advanced-9-extended-presentations` | L5 | 完成长篇专业展示、答辩和即兴回应 |
| 10 | `advanced-10-c1-capstone` | L5 | 在综合项目中稳定展示 C1 门槛能力 |

## 四、统一数据结构

| 文件 | 标准目标 | 高级要求 |
|:-----|:--------:|:---------|
| `scenes.csv` | 5 行 | 每个场景包含真实限制或立场冲突 |
| `training_topics.csv` | 20 行 | 每场景 4 个 Topic |
| `scene_vocabulary.csv` | 约 140—180 行 | Topic 词汇分配行；区分 new_core、review_core、extension |
| `chunks.csv` | 约 80—100 行 | 每 Topic 至少 4 个高迁移句块 |
| `sentence_patterns.csv` | 约 40—50 行 | 强调修辞功能而非机械套句 |
| `script_episodes.csv` | 10 行 | 5 章 × 2 课 |
| `episode_chunks.csv` | 约 80—100 行 | 绑定必要表达，不要求机械全覆盖 |
| `warmup_pipeline.json` | 20 组 | 包含改写、限定、反驳和综合输出 |
| `ink-scripts/` | 20 个 | 每 Topic 一个 16—24 轮复杂互动 |

## 五、Topic 结构

每个 Topic 必须拥有：

1. 具体角色、关系、场合、目标和限制。
2. 一个可验收的高级语篇功能。
3. 至少 4 个核心句块和 2 个可迁移句型。
4. 至少一个反例、异议、歧义或信息缺口。
5. 16—24 轮互动，包含立场变化或表达修复。
6. 3—8 分钟输出，以及反馈后的第二版输出。

## 六、词汇和语域策略

| 层级 | 建议占比 | 处理方式 |
|:-----|:--------:|:---------|
| Foundation/Course 复用 | 约 55% | 用于复杂任务和新的语域 |
| Advanced 核心搭配 | 约 30% | 必须进入句块、句型和对话 |
| Advanced 扩展表达 | 约 15% | 用于改写、辨析和开放输出 |

每包约 140—180 个 Topic 词汇分配行中，建议只有约 40—60 个是全系列首次出现的 `new_core`，其余用于高频复现、搭配深化、语域转换和意义辨析。重点教授搭配与语用差异，例如：

```text
say → point out / acknowledge / maintain / clarify
important → significant / central / relevant / critical
maybe → arguably / potentially / to some extent
```

不把罕见同义词、古旧表达或过度正式语言作为高级标准。

## 七、阶段验收

### Advanced 1—5：稳定 B2

- 能围绕复杂但熟悉的话题展开 4—6 分钟。
- 能限定观点、回应反例并调整措辞。
- 能在工作和社交冲突中兼顾目标与关系。
- 能切换中性、友好和专业语域。

### Advanced 6—10：B2+ → C1 门槛

- 能综合多个来源并说明证据限制。
- 能讨论抽象或公共议题而保持结构清晰。
- 能完成 6—10 分钟展示并处理深度追问。
- 能在不可预测互动中即时重组表达。

## 八、导入兼容说明

当前项目的 `LearningPackageType` 尚未包含 `advanced`。正式生成和导入 CSV 前需要同步：

```text
Prisma LearningPackageType
后端 DTO 与 package-data 前缀识别
前端 LearningPackageType
后台筛选和展示标签
```

在完成兼容前，本阶段只创建 Advanced 目录和设计 MD，不生成可导入 CSV。
