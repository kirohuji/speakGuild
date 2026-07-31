# Course 中级课程体系设计（B1 → B2 门槛）

> `course-*` 是 `foundation-1` 至 `foundation-10` 之后的中级主线。Foundation 负责建立语言骨架；Course 负责把这些骨架转化为真实生活、社交和工作中的持续沟通能力。

## 一、课程定位

| 维度 | 设计 |
|:-----|:-----|
| 入门水平 | CEFR B1 起点；已完成 Foundation 1—10 |
| 结课目标 | 稳定 B1+，接近 B2 门槛 |
| 参考雅思区间 | 入门约 4.5—5.0；结课沟通能力约 5.5—6.5 |
| 平台等级 | Course 1—5 为 L3；Course 6 为 L3~L4；Course 7—10 为 L4 |
| 核心变化 | 从“句子正确”升级为“任务完成、语篇连贯、互动自然” |

> 雅思区间只用于能力定位，不代表完成课程即可自动获得对应考试成绩；雅思写作、阅读和考试策略仍需独立训练。

## 二、为什么不继续按语法点拆包

Foundation 已覆盖时态、情态动词、连词、比较、从句和非谓语等核心骨架。中级阶段若继续按语法目录推进，学习者容易“知道更多规则，却仍不会聊一件事”。

Course 系列改用任务驱动：

```text
表达立场
→ 讲清经历
→ 独立处理生活事务
→ 建立和维护关系
→ 参与职场协作
→ 理解并转述信息
→ 协商和作决定
→ 处理问题与投诉
→ 完成展示和问答
→ 在综合项目中独立沟通
```

语法仍然教学，但服务于任务，不再作为包名和课程终点。

## 三、10 个学习包

| 包 | 目录 | 等级 | 核心成果 |
|:--:|:-----|:----:|:---------|
| 1 | `course-1-opinion-communication` | L3 | 清楚表达观点、理由、同意与不同意见 |
| 2 | `course-2-storytelling-experiences` | L3 | 连贯讲述经历，并交代背景、转折和结果 |
| 3 | `course-3-independent-living` | L3 | 独立办理住房、医疗、银行和出行事务 |
| 4 | `course-4-social-relationships` | L3 | 建立关系、表达感受、处理误解和边界 |
| 5 | `course-5-workplace-collaboration` | L3 | 参与会议、汇报进度、分工和反馈 |
| 6 | `course-6-information-media` | L3~L4 | 理解、概括、核实并转述信息 |
| 7 | `course-7-decisions-negotiation` | L4 | 比较方案、讨论取舍、协商并形成决定 |
| 8 | `course-8-problem-solving-services` | L4 | 描述复杂问题、投诉、提出补救方案并跟进 |
| 9 | `course-9-presentations-discussion` | L4 | 完成结构化展示并应对追问 |
| 10 | `course-10-integrated-capstone` | L4 | 在生活、社交和工作综合项目中独立沟通 |

## 四、统一数据结构

每个 Course 包沿用 Foundation 的数据模型，保持导入器兼容：

| 文件 | 标准目标 | 说明 |
|:-----|:--------:|:-----|
| `scenes.csv` | 5 行 | 每个场景承担一种不同的真实任务 |
| `training_topics.csv` | 20 行 | 每场景 4 个 Topic |
| `scene_vocabulary.csv` | 约 120—160 行 | Topic 词汇分配行；区分 new_core、review_core、extension |
| `chunks.csv` | 约 80 行 | 每 Topic 至少 4 个主动句块 |
| `sentence_patterns.csv` | 约 40 行 | 每 Topic 约 2 个可迁移句型 |
| `script_episodes.csv` | 10 行 | 5 章 × 2 课 |
| `episode_chunks.csv` | 约 80 行 | 每个 Episode 绑定约 8 个核心句块 |
| `warmup_pipeline.json` | 20 组 | 每 Topic 一组输出训练 |
| `ink-scripts/` | 20 个 | 每 Topic 一个 12—16 轮互动任务 |

CSV 列结构继续与 Foundation 一致。Course 数据必须设置：

```text
package_type = course
required_output_level = L3 / L3~L4 / L4
required_user_level = 2（正式生成 CSV 时统一确认）
```

## 五、Topic 内部结构

每个 Topic 必须包含：

1. 一个具体时间、地点、人物和交流任务。
2. 一个可独立验收的核心能力。
3. 至少 4 个核心句块、2 个句型。
4. 至少一次追问、澄清、修复或协商。
5. 一段 12—16 轮、真正完成任务的互动对话。
6. 一个 60—120 秒的个人输出或双人任务。

中级 Topic 不以“说出目标句”为通过标准，而以“完成交流任务”为标准。

## 六、词汇策略

| 层级 | 占比建议 | 处理方式 |
|:-----|:--------:|:---------|
| Foundation 复用词 | 约 60% | 直接用于更复杂语境，不重复讲基础词义 |
| Course 新核心词 | 约 25% | 必须进入 chunks、patterns 和对话 |
| Course 扩展词 | 约 15% | 进入 Warmup 和开放输出 |

每包建议配置约 120—160 个 Topic 词汇分配行，其中约 30—50 个为全系列首次出现的 `new_core`，其余为必须主动调用的 `review_core` 与 `extension`。不要把分配行数误报为唯一新词数，也不要通过堆叠低频同义词制造“中级感”；中级感主要来自表达长度、逻辑、语气、互动和任务复杂度。

## 七、统一语篇能力

所有包持续训练六条横向能力：

```text
组织：first / however / as a result / overall
展开：原因 / 例子 / 细节 / 对比
互动：追问 / 回应 / 接话 / 轮次管理
修复：澄清 / 重述 / 自我纠正 / 确认理解
语气：直接程度 / 礼貌程度 / 确定程度
总结：形成结论 / 决定 / 下一步行动
```

## 八、阶段验收

### Course 1—5：B1 稳固

- 能围绕熟悉话题持续交流 2—3 分钟。
- 能用原因、例子和细节展开，而非只给一句答案。
- 能讲述有时间顺序、背景和结果的经历。
- 能处理常见生活和工作事务。

### Course 6—10：B1+ → B2 门槛

- 能概括信息并区分事实、观点和推测。
- 能讨论方案取舍并进行礼貌协商。
- 能处理误解、投诉和非预期变化。
- 能完成 3—5 分钟结构化表达并回答问题。

## 九、生成顺序

```text
课程 MD 定稿
→ training_topics
→ chunks / sentence_patterns
→ scene_vocabulary
→ script_episodes / episode_chunks
→ warmup_pipeline
→ ink-scripts
→ 引用完整性和等级校验
```

当前阶段只建立目录和 MD 设计，不生成空 CSV，避免空壳数据被误认为可导入课程。
