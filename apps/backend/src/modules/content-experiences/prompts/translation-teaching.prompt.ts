/** 中英互译题「教学文档」生成提示词。 */
export function buildTranslationTeachingPrompt(input: {
  title?: string
  description?: string
  difficulty?: string
  promptEn?: string
  promptZh?: string
  direction: 'zh_to_en' | 'en_to_zh'
  scope: 'sentence' | 'article'
  sourceTitle?: string
  segments: Array<{
    source: string
    reference?: string
    hint?: string
    referenceExplanation?: string
  }>
}): string {
  const directionLabel = input.direction === 'zh_to_en' ? '中译英' : '英译中'
  const scopeLabel = input.scope === 'article' ? '篇章翻译' : '单句翻译'
  const sourceLang = input.direction === 'zh_to_en' ? '中文' : '英文'
  const targetLang = input.direction === 'zh_to_en' ? '英文' : '中文'
  const segmentsBlock = input.segments
    .map((segment, index) => {
      const label = input.scope === 'article' ? `第 ${index + 1} 段` : '翻译句'
      return [
        `#### ${label}`,
        `原文（${sourceLang}）：`,
        segment.source.trim() || '（未填写）',
        '',
        `参考译文（${targetLang}，仅供教学核对，不是唯一答案）：`,
        segment.reference?.trim() || '（未填写）',
        '',
        `提示（学习者可见策略，勿在文档中原样照抄成答案）：`,
        segment.hint?.trim() || '（未填写）',
        '',
        `编写见解（编辑/AI 背景，勿泄露成唯一标准）：`,
        segment.referenceExplanation?.trim() || '（未填写）',
      ].join('\n')
    })
    .join('\n\n')

  const lengthHint = input.scope === 'sentence'
    ? '文档目标约 4,000–8,000 个中英文字符；单句题也要讲清结构、搭配与可迁移表达，不要写成空泛的翻译技巧总论。'
    : '文档目标约 7,000–12,000 个中英文字符；按段落组织知识，但章节要按语言功能重组，不要机械复述每一段原文。'

  return `# 角色与任务

你是一名资深中英互译教师与学习内容编辑。请根据下面一份已经定稿的${directionLabel}${scopeLabel}题，编写可独立阅读的英语教学文档，供中文学习者在作答前理解表达选择、组织译文并迁移知识。

教学文档的主体必须是可迁移的语言知识：高价值词汇、搭配、句块、句型、语序与信息结构、语域与语气。学习者已经能看到原文，因此不要复述题意、逐句翻译原稿，也不要写成“这道题要做什么”的审题说明。不要写学习计划、打卡、课后练习、鼓励口号或对生成过程的说明。不要只给一篇译文了事。

${lengthHint}

## 固定排版

直接输出 Markdown。除标题外，必须包含以下四个大节（可在每节下按题目需要增加小节）。其中第二、三节合计应占正文至少 70%。

# 翻译教学：题目标题

## 一、翻译思路与信息结构

用「表达功能 | 可直接借鉴的目标语表达 | 使用提示」表格，说明本题自然的信息顺序与翻译策略（如先抓核心谓语、再补时间地点、如何处理汉语流水句／英语从句）。只保留组织译文必需的信息，不重复题目已给出的背景。

## 二、核心表达与搭配

按语义或交流功能分 3–7 个小节。每个小节有表达表格：| 目标语表达 | 用法与语气 | 可迁移例句 |。目标语表达和例句加粗，例句带自然双语对照。优先讲解学习者容易逐词硬翻、却能迁移到相似场景的搭配与句块。

## 三、关键句型与语言选择

选 4–10 个与本题直接相关的句型、语序、时态／情态或衔接方式，逐项解释使用条件、常见中式英语／误译，以及可迁移例句。必要时用小表比较相近说法；要解释为什么此处这样译更自然。

## 四、示范译文与语言拆解

给出一篇符合本题方向与篇幅的自然示范译文，然后只挑选其中 5–8 处最有教学价值的表达或语言选择拆解。示范不能出现题目没有要求的事实；若已有参考译文，可吸收其优点，但不要逐句照抄成唯一标准答案。

示范译文必须位于文档后段；前三节应提供足以自行翻译的知识支架。不要额外生成“审题”“提交前自查”“学习建议”类章节。所有表格使用标准 Markdown，单元格保持简洁。使用简体中文；英文表达和例句自然准确。不要使用表情符号，也不要使用“不是……而是……”这种模板化表述。

## 输入材料

题目标题：${input.title?.trim() || '（未填写）'}
题目摘要：${input.description?.trim() || '（未填写）'}
难度：${input.difficulty?.trim() || '（未填写）'}
英文提示：${input.promptEn?.trim() || '（未填写）'}
中文提示：${input.promptZh?.trim() || '（未填写）'}
翻译方向：${directionLabel}
练习范围：${scopeLabel}
来源标题：${input.sourceTitle?.trim() || '（未填写）'}

### 原文与参考资料

${segmentsBlock}

只返回完整 Markdown 教学文档。`
}
