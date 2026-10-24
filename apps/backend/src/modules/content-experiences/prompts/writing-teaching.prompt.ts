/** 普通写作题（消息、邮件、段落、日记、议论文）的独立教学文档提示词。 */
export function buildWritingTeachingPrompt(input: {
  title?: string;
  description?: string;
  difficulty?: string;
  promptEn?: string;
  promptZh?: string;
  genre?: string;
  minWords?: number;
  maxWords?: number;
  questionMarkdown: string;
  situation?: string;
  audience?: string;
  purpose?: string;
  requirements?: string[];
  rubric?: string[];
  referenceAnswer?: string;
  referenceExplanation?: string;
}): string {
  const genre = ({ journal: '日记', message: '消息', email: '邮件', paragraph: '短段落', essay: '议论文' } as Record<string, string>)[input.genre ?? ''] ?? '写作';
  const requirements = input.requirements?.filter(Boolean).map((item) => `- ${item}`).join('\n') || '（未单独填写，以题目正文为准）';
  const rubric = input.rubric?.filter(Boolean).map((item) => `- ${item}`).join('\n') || '（未填写）';
  const messageRule = input.genre === 'message'
    ? `\n## 消息文体的额外硬性要求\n\n这是短信、聊天消息或微信消息，不是邮件。请专门讲清：\n\n- 如何在首句直接回应事情，不需要独立的称呼行和落款；\n- 口语化但仍礼貌的道歉、说明原因、改期／确认／请求等表达；\n- 1–3 个短句或两个短段如何承载完整信息；\n- **不能**把 Dear、Best regards、签名等邮件格式写进范文或表达建议。\n\n本题通常只需 30–80 词。文档目标为约 6,000–10,000 个中文及英文字符；深度要足够，但不要把短消息扩写成邮件或议论文。`
    : `\n文档目标为约 8,000–13,000 个中文及英文字符；以知识密度决定篇幅，不能靠重复凑字数。`;

  return `# 角色与任务

你是一名资深英语写作教师与学习内容编辑。请根据下面一份已经定稿的 ${genre} 题，编写可独立阅读的英语教学文档，供中文学习者在作答前理解任务、组织内容并迁移表达。

教学文档的主体必须是可迁移的英语知识：高价值词汇、搭配、句块、句型、语法选择、语域与表达差别。题目正文学习者已经看过，因此不要复述题意、角色、对象、要求或评分标准，也不要把它们改写成大段“审题指导”。不要写学习计划、打卡、课后练习、鼓励口号或对生成过程的说明。不要只给一篇范文了事。
${messageRule}

## 固定排版

直接输出 Markdown。除标题外，必须包含以下四个大节（可在每节下按题目需要增加小节）。其中第二、三节合计应占正文至少 70%；第一节只给写作顺序，不能重复题面。

# 写作教学：题目标题

## 一、写作框架

按实际文体讲清自然的内容顺序。用「表达功能 | 可直接借鉴的英文表达 | 使用提示」表格展示；只保留写作组织所必需的信息，不重复题目已给出的背景。

## 二、核心表达与搭配

按交流功能分 4–7 个小节。每个小节有表达表格：| 英文表达 | 用法与语气 | 可迁移例句 |。英文表达和例句加粗，例句带自然中文翻译。讲清搭配、语气、结构或近义区别，不堆砌基础词；优先解释学习者容易误用、却能迁移到相似沟通场景的表达。

## 三、关键句型与语言选择

选 5–10 个和本题直接相关的句型、连接方式或语法难点，逐项解释使用条件、常见错误和可迁移例句。必要时用小表比较相近说法；要解释为什么此处选这个说法更自然，而非只贴语法公式。

## 四、示范写作与语言拆解

给出一篇符合本题词数、对象和文体的自然英文示范，然后只挑选其中 5–8 处最有教学价值的表达或语言选择拆解。示范不能出现题目没有要求的事实，也不能写成另一个文体。

示范写作必须位于文档后段；前三节应提供足以自行写作的知识支架。不要额外生成“这道题要完成什么”“审题”“提交前自查”“学习建议”或类似章节。所有表格使用标准 Markdown，单元格保持简洁。使用简体中文；英文表达和例句自然准确。不要使用表情符号，也不要使用“不是……而是……”这种模板化表述。

## 输入材料

题目标题：${input.title?.trim() || '（未填写）'}
题目摘要：${input.description?.trim() || '（未填写）'}
难度：${input.difficulty?.trim() || '（未填写）'}
英文提示：${input.promptEn?.trim() || '（未填写）'}
中文提示：${input.promptZh?.trim() || '（未填写）'}
文体：${genre}
目标词数：${input.minWords ?? '（未填写）'}–${input.maxWords ?? '（未填写）'}
情境：${input.situation?.trim() || '（未填写）'}
对象：${input.audience?.trim() || '（未填写）'}
沟通目的：${input.purpose?.trim() || '（未填写）'}

### 题目正文

${input.questionMarkdown.trim()}

### 写作要点

${requirements}

### 评分维度

${rubric}

### 现有参考答案（只用于核对任务与语气；不要逐句照抄或泄露成唯一答案）

${input.referenceAnswer?.trim() || '（未填写）'}

### 现有编写见解（只作背景参考）

${input.referenceExplanation?.trim() || '（未填写）'}

只返回完整 Markdown 教学文档。`;
}
