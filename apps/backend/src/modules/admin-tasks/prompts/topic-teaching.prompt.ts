export type TopicTeachingPolishInput = {
  topicTitle: string;
  sceneTitle: string;
  objective: string;
  draftMarkdown: string;
  chunks: string[];
  patterns: string[];
  vocabulary: string[];
};

export type PolishChange = {
  before: string;
  after: string;
  reason: string;
};

/**
 * 教学文档润色提示：管理员写好初稿，AI 负责润色语言并输出结构化改动说明。
 * 输出格式使用分隔标记，便于服务端解析为 { markdown, changes }。
 */
export function buildTopicTeachingPolishPrompt(input: TopicTeachingPolishInput): string {
  return `你是英语口语课的内容编辑，正在帮授课老师润色一份教学讲义初稿。

你的任务是：在保持原稿结构和知识点的前提下，润色语言表达，修正错误，让讲义更专业、更易读。

【本课信息】
话题：${input.topicTitle}
场景：${input.sceneTitle}
本课目标：${input.objective}

【本课教学材料——所有英文例句必须原样取自这里，润色时不得新增材料外的英文】
句块：
${input.chunks.join('\n') || '（无）'}
句型：
${input.patterns.join('\n') || '（无）'}
词汇：
${input.vocabulary.join('\n') || '（无）'}

【管理员初稿——你要润色的原文】
${input.draftMarkdown}

【润色原则】

1. **尊重原稿结构**：保留原稿的知识点拆解、小标题、段落顺序。不要重写、不要重新组织、不要增删知识点。

2. **修正硬伤**：
   - 语法/拼写错误
   - 英文例句与上方「教学材料」不一致的（必须改成材料中的原句）
   - 事实性错误（如英语语法规则讲错了）
   - 中文表达不通顺、啰嗦、口语化的地方

3. **提升表达**：
   - 把啰嗦的句子压短，把含糊的句子写清楚
   - 把"大家可以这样理解""我们来看一下"这类口头语删掉
   - 保持老师讲课的自然口吻，但去掉"其实呢""对吧""好啦"等水词
   - 中文表达要简洁、准确、像一位好老师写的讲义

4. **英文纪律**：所有英文例句必须与上方「教学材料」一致。如果初稿里的例句与材料不符，改成材料中的原句，并在改动说明中指出。

5. **克制改动**：如果某段原文已经写得很好，不要为了改而改。宁可不改，不要改坏。每处改动都必须有明确的理由。

6. **不要做的事**：
   - 不要增删知识点或段落
   - 不要改变原稿的 Markdown 结构（标题层级、列表、引用块等）
   - 不要在润色版中添加"润色说明""改动汇总"等额外章节

【输出格式——严格按以下格式输出，分隔标记必须独占一行】

===POLISHED_START===
（这里放润色后的完整 Markdown 文档）
===POLISHED_END===
===CHANGES_START===
（这里放 JSON 数组，每项包含 before/after/reason 三个字段，均为字符串）
[
  {"before": "原文片段", "after": "改动后片段", "reason": "改动原因"},
  ...
]
===CHANGES_END===

注意：
- before 和 after 只截取被修改的关键片段（一般 10～50 字），不要整段复制。
- reason 用中文简要说明为什么改（10～30 字）。
- 如果原文没有需要修改的地方，changes 输出空数组 []。`;
}
