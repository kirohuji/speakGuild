/**
 * 导入「应试议论文写作｜十大题材与论证」
 * 设计稿：docs/应试议论文写作学习包设计.md
 *
 * 用法：cd apps/backend && pnpm exec ts-node prisma/seed-exam-essay-writing.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DESIGN_DOC = 'docs/应试议论文写作学习包设计.md'
const SCENE_TITLE = '应试议论文写作｜十大题材与论证'

type TaskType =
  | 'agree_disagree'
  | 'discuss_both'
  | 'advantages_disadvantages'
  | 'problem_solution'
  | 'cause_effect'

type ExamFit = 'IELTS' | 'CET4' | 'CET6'

type PlannedItem = {
  role: 'mother' | 'variant'
  promptEn: string
  promptZh: string
  focus?: string
}

type TopicDef = {
  sortOrder: number
  title: string
  theme: string
  taskType: TaskType
  difficulty: 'L3' | 'L4'
  examFit: ExamFit[]
  description: string
  promptEn: string
  promptZh: string
  situation: string
  candidateRole: string
  purpose: string
  knowledgePoints: string
  motherPromptEn: string
  requirements: string[]
  plannedItems: PlannedItem[]
  suggestedDurationSec: number
}

const RUBRIC = ['任务回应', '连贯与衔接', '词汇资源', '语法准确', '论证充分']

function buildQuestionMarkdown(topic: TopicDef): string {
  const examLabel = topic.examFit.join(' / ')
  return `### 情境

你正在备考英语议论文写作（适用 ${examLabel}）。请在约 40 分钟内完成一篇立场清晰、论证完整的议论文。

### 写作任务

请根据下列英文题目写作（目标约 **200–280 词**；雅思建议 250 词以上）：

> ${topic.motherPromptEn}

### 写作要求

1. ${topic.requirements[0]}
2. ${topic.requirements[1]}
3. ${topic.requirements[2]}
4. ${topic.requirements[3] ?? '结尾总结立场，不要引入全新论点。'}
5. 使用正式书面语；可用连接手段推进段落，但避免空模板堆砌。`
}

const TOPICS: TopicDef[] = [
  {
    sortOrder: 0,
    title: '01｜教育的个人与社会功能',
    theme: '教育',
    taskType: 'discuss_both',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET6'],
    description: '围绕教育对个人发展与社会福祉的双重功能展开论证。',
    promptEn: 'Discuss what education should include to serve both individuals and society.',
    promptZh: '讨论教育应包含什么内容，才能同时服务个人与社会。',
    situation: '备考议论文：教育的功能与内容构成',
    candidateRole: '备考考生',
    purpose: '论证教育如何同时促进个人发展与社会进步',
    knowledgePoints:
      '个人：思维模式、就业、生活质量\n社会：经济发展、社会流动 social mobility、社会稳定\n关键词：well-being, curriculum, civic responsibility',
    motherPromptEn:
      'It is generally believed that education is of vital importance to the development of individuals and the well-being of societies. What should education consist of to fulfil both these functions?',
    requirements: [
      '明确回应「教育应包含什么」这一问题，而不是只赞美教育重要',
      '分别从个人角度与社会角度各给出至少一条有解释的理由',
      '用至少一个具体例子或场景支撑论点',
      '结尾给出清晰立场或优先排序，避免两边完全平均而无结论',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'It is generally believed that education is of vital importance to the development of individuals and the well-being of societies. What should education consist of to fulfil both these functions?',
        promptZh: '教育对个人与社会都很重要。教育应包含什么才能同时实现这两大功能？',
        focus: '功能双轨：个人 + 社会',
      },
      {
        role: 'variant',
        promptEn:
          'Some people think universities should prepare students to be good citizens, while others believe universities should mainly help students succeed personally. Discuss both views and give your opinion.',
        promptZh: '大学应培养合格公民，还是主要帮助学生个人成功？讨论双方并给出你的看法。',
        focus: '公民 vs 个人收益',
      },
      {
        role: 'variant',
        promptEn:
          'Some people think secondary schools should provide a broad general education, while others think students should specialise early. Discuss both views and give your opinion.',
        promptZh: '中学应提供通才教育还是尽早专才教育？',
        focus: '通才 vs 专才',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 1,
    title: '02｜大学：理论还是实践技能',
    theme: '教育',
    taskType: 'discuss_both',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET6'],
    description: '讨论大学应侧重理论知识还是可就业实践技能。',
    promptEn: 'Discuss whether universities should focus on theory or practical skills.',
    promptZh: '讨论大学应侧重理论还是实践技能。',
    situation: '备考议论文：高等教育的课程取向',
    candidateRole: '备考考生',
    purpose: '比较理论与实践在大学教育中的价值并给出立场',
    knowledgePoints:
      '理论：批判思维、迁移能力、学科基础\n实践：就业 readiness、项目经验、行业对接\n关键词：theoretical knowledge, employability, internship',
    motherPromptEn:
      'Some people think university education should focus on theoretical knowledge, while others believe practical skills are more important. Discuss both views and give your own opinion.',
    requirements: [
      '公平呈现「理论优先」与「实践优先」双方的主要理由',
      '给出你自己的立场，并说明取舍标准（如专业类型、阶段）',
      '至少用一个可检验的例子（专业、课程或实习）支撑',
      '避免写成「两者都重要」却无优先排序',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Some people think university education should focus on theoretical knowledge, while others believe practical skills are more important. Discuss both views and give your own opinion.',
        promptZh: '大学应侧重理论还是实践技能？讨论双方并给出看法。',
      },
      {
        role: 'variant',
        promptEn:
          'The best way to prepare for a career is to leave school early and gain work experience rather than go to university. To what extent do you agree or disagree?',
        promptZh: '为职业做准备，最好尽早离校积累经验而不是上大学——你在多大程度上同意？',
      },
      {
        role: 'variant',
        promptEn: 'Should universities expand enrolment even if teaching quality may decline? Discuss.',
        promptZh: '大学是否应该扩招，即使教学品质可能下降？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 2,
    title: '03｜远程学习能否替代面授',
    theme: '教育',
    taskType: 'agree_disagree',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET4', 'CET6'],
    description: '评估远程教育相对传统面授的收益与局限。',
    promptEn: 'Evaluate whether distance learning can replace attending college in person.',
    promptZh: '评估远程学习能否替代当面上课。',
    situation: '备考议论文：在线学习与传统课堂',
    candidateRole: '备考考生',
    purpose: '论证远程学习的价值边界，并表明是否可完全替代面授',
    knowledgePoints:
      '优势：anybody / anywhere / anytime；成本与灵活度\n劣势：互动不足、督导与道德引导、久坐健康\n关键词：distance learning, interaction, self-discipline',
    motherPromptEn:
      'Many people use distance-learning programmes (study materials by post, TV, Internet, etc.) to study at home, but some people think that they cannot bring as many benefits as attending college or university. To what extent do you agree or disagree?',
    requirements: [
      '直接表明同意程度（完全同意 / 部分同意 / 不同意）',
      '至少分析远程学习的 1 个核心优势与 1 个核心局限',
      '说明「替代」是否成立的条件（课程类型、学习者自律等）',
      '结尾回扣题干中的对比，而不是另开新话题',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Many people use distance-learning programmes to study at home, but some people think they cannot bring as many benefits as attending college. To what extent do you agree or disagree?',
        promptZh: '远程学习能否带来与上大学同等的好处？你在多大程度上同意？',
      },
      {
        role: 'variant',
        promptEn: 'Online education will eventually replace traditional classrooms. Do you agree or disagree?',
        promptZh: '在线教育最终会取代传统课堂吗？',
      },
      {
        role: 'variant',
        promptEn: 'Is studying abroad always better than studying in one’s home country? Discuss both views.',
        promptZh: '留学是否总是优于在本国学习？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 3,
    title: '04｜Gap year 的利与弊',
    theme: '教育',
    taskType: 'advantages_disadvantages',
    difficulty: 'L3',
    examFit: ['IELTS'],
    description: '分析毕业后间隔年旅行或工作的优缺点。',
    promptEn: 'Analyse the advantages and disadvantages of taking a gap year.',
    promptZh: '分析间隔年（旅行或工作一年）的利弊。',
    situation: '备考议论文：间隔年体验',
    candidateRole: '备考考生',
    purpose: '权衡 gap year 对个人成长与风险的影响并作结',
    knowledgePoints:
      '利：独立性、视野、职业探索\n弊：恶习影响、学业中断成本、家庭经济压力\n关键词：gap year, maturity, deferred enrolment',
    motherPromptEn:
      'Some school leavers travel or work for a period of time instead of going directly to university. What are the advantages and disadvantages?',
    requirements: [
      '利与弊两侧都要写到，且各自有解释',
      '避免只列关键词；每点至少一句展开',
      '可简要说明对哪类学生更值得',
      '结尾给出总体判断（利大于弊或视条件而定）',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Some school leavers travel or work for a period of time instead of going directly to university. What are the advantages and disadvantages?',
        promptZh: '部分中学毕业生选择先旅行或工作再上大学。利弊是什么？',
      },
      {
        role: 'variant',
        promptEn: 'Should students take part in unpaid community work? Discuss the benefits and drawbacks.',
        promptZh: '学生应否参加无偿社会劳动？讨论利弊。',
      },
      {
        role: 'variant',
        promptEn: 'Is it good for young people to live away from their parents from an early age?',
        promptZh: '年轻人尽早离开父母独立居住好不好？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 4,
    title: '05｜校园学习：自律与数字 distraction',
    theme: '教育',
    taskType: 'problem_solution',
    difficulty: 'L3',
    examFit: ['CET4', 'CET6'],
    description: '分析大学生学习分心的原因并提出可行对策（四六级校园向）。',
    promptEn: 'Explain why campus learners get distracted by digital devices and suggest solutions.',
    promptZh: '说明校园学习者为何被电子设备分心，并提出解决办法。',
    situation: '四六级风格：校园学习与手机干扰',
    candidateRole: '大学生考生',
    purpose: '分析数字分心成因并提出个人/学校层面对策',
    knowledgePoints:
      '原因：通知推送、短视频、缺少目标管理\n对策：番茄钟、无扰模式、同伴监督、课程设计\n关键词：self-discipline, distraction, time management',
    motherPromptEn:
      'Many university students find it hard to concentrate on study because of smartphones and online entertainment. Why is this happening, and what can be done to solve the problem?',
    requirements: [
      '至少写出 2 个具体原因，并解释机制（为何导致分心）',
      '提出至少 2 条可操作对策，分别落到个人与学校/社群',
      '对策需能回扣前文原因，避免空泛「加强教育」',
      '语言正式，结构可用「现象—原因—对策」',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Many university students find it hard to concentrate on study because of smartphones and online entertainment. Why is this happening, and what can be done to solve the problem?',
        promptZh: '许多大学生因手机与网络娱乐难以专心学习。原因与对策？',
        focus: 'CET 现象+对策',
      },
      {
        role: 'variant',
        promptEn: 'How can college students make better use of online learning resources? Give your suggestions.',
        promptZh: '大学生如何更好地利用在线学习资源？给出建议。',
      },
      {
        role: 'variant',
        promptEn: 'Some students prefer group study while others prefer studying alone. Discuss both preferences.',
        promptZh: '有人喜欢小组学习，有人喜欢独自学习。讨论两种偏好。',
      },
    ],
    suggestedDurationSec: 2100,
  },
  {
    sortOrder: 5,
    title: '06｜环保该由谁负责',
    theme: '环境',
    taskType: 'agree_disagree',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET4', 'CET6'],
    description: '讨论环境保护应主要在国际层面还是多主体共同负责。',
    promptEn: 'Argue whether environmental protection must be solved only at an international level.',
    promptZh: '论证环保是否只能靠国际层面解决。',
    situation: '备考议论文：环保责任归属',
    candidateRole: '备考考生',
    purpose: '驳斥「只有国际合作才有用」的绝对说法，并分配多主体责任',
    knowledgePoints:
      '主体：国际合作、政府、企业、个人\n关键词：international cooperation, regulation, carbon footprint',
    motherPromptEn:
      'Environmental problems are too big for individual countries and individual people to address. In other words, the only way to protect the environment is at an international level. To what extent do you agree or disagree?',
    requirements: [
      '明确回应「唯一方式是国际层面」这一绝对表述',
      '说明国际合作确实必要的理由',
      '同时论证政府/企业/个人仍可发挥作用',
      '结尾提出分层责任，而非简单二选一',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Environmental problems are too big for individual countries and people to address; the only way is international action. To what extent do you agree or disagree?',
        promptZh: '环境问题个人与国家无力解决，只能靠国际层面——你多大程度上同意？',
      },
      {
        role: 'variant',
        promptEn: 'Only governments and large companies can protect the environment; individuals can do little. Do you agree?',
        promptZh: '只有政府和大公司能保护环境，个人作用很小——同意吗？',
      },
      {
        role: 'variant',
        promptEn:
          'Many people know environmental protection is important but take little action. Why, and how can this be changed?',
        promptZh: '很多人知道环保重要却不行动。为什么？如何改变？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 6,
    title: '07｜保护野生动物是否浪费资源',
    theme: '环境',
    taskType: 'agree_disagree',
    difficulty: 'L4',
    examFit: ['IELTS'],
    description: '反驳「把钱花在动物保护上不如花在人身上」的观点。',
    promptEn: 'Respond to the claim that money for wildlife protection is wasted.',
    promptZh: '回应「保护野生动物浪费钱」的说法。',
    situation: '备考议论文：动物保护与资源分配',
    candidateRole: '备考考生',
    purpose: '论证野生动物保护的生态与经济价值',
    knowledgePoints:
      '生态平衡、生物多样性、生态旅游补偿成本\n关键词：biodiversity, ecosystem, wildlife tourism',
    motherPromptEn:
      'Now many people think that we are spending too much money and time on protecting wild animals. The money should be better spent on the human population. Do you agree or disagree?',
    requirements: [
      '先直接回应「浪费」指控（同意或反驳）',
      '至少给出 2 个保护动物的实质理由（生态/经济/伦理选其二）',
      '可简要说明与人类福祉并不必然冲突',
      '语气正式，避免情绪化口号',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Many people think too much money is spent on protecting wild animals and it should be spent on humans instead. Do you agree or disagree?',
        promptZh: '花太多钱保护野生动物不如花在人身上——同意吗？',
      },
      {
        role: 'variant',
        promptEn: 'Is it acceptable to keep animals in zoos? Discuss both views.',
        promptZh: '把动物关在动物园可以接受吗？讨论双方。',
      },
      {
        role: 'variant',
        promptEn: 'Should animal testing for medical research be banned? Give your opinion.',
        promptZh: '是否应禁止用于医学研究的动物实验？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 7,
    title: '08｜一次性消费文化',
    theme: '环境',
    taskType: 'cause_effect',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET6'],
    description: '分析「用完即弃」文化的原因、后果与减量措施。',
    promptEn: 'Analyse throw-away culture: causes, effects, and solutions.',
    promptZh: '分析一次性消费文化的原因、后果与对策。',
    situation: '备考议论文：塑料与一次性用品',
    candidateRole: '备考考生',
    purpose: '解释一次性文化成因并给出 reduce/reuse/recycle 路径',
    knowledgePoints:
      '原因：便利与卫生追求\n后果：水源/土壤/空气污染\n对策：3R — reduce, reuse, recycle\n关键词：throw-away culture, disposable, landfill',
    motherPromptEn:
      'Many people say that we have developed into a “throw-away” culture, because we are filling up our environment with so many plastic bags and rubbish that we cannot fully dispose of. To what extent do you agree, and what measures can you recommend to reduce this problem?',
    requirements: [
      '说明你是否认同「一次性文化」的判断及主要原因',
      '指出至少 2 类环境后果',
      '提出至少 2 条可执行减量措施（个人/企业/政策）',
      '措施需具体，避免只写「提高意识」',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'We have developed into a “throw-away” culture with plastic bags and rubbish we cannot fully dispose of. To what extent do you agree, and what measures can reduce this problem?',
        promptZh: '我们是否已形成「用完即弃」文化？如何减轻该问题？',
      },
      {
        role: 'variant',
        promptEn:
          'The increase in consumer goods damages the natural environment. What are the causes and solutions?',
        promptZh: '消费品增加破坏自然环境。原因与解决办法？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 8,
    title: '09｜新能源替代化石燃料',
    theme: '环境',
    taskType: 'advantages_disadvantages',
    difficulty: 'L4',
    examFit: ['IELTS', 'CET6'],
    description: '评估鼓励风能、太阳能等替代能源的发展是利是弊。',
    promptEn: 'Evaluate whether encouraging alternative energy is a positive development.',
    promptZh: '评估鼓励替代能源是积极还是消极发展。',
    situation: '备考议论文：替代能源政策',
    candidateRole: '备考考生',
    purpose: '权衡新能源的环境收益与成本/局限',
    knowledgePoints:
      '利：inexhaustible、environmentally friendly\n弊：成本、生态扰动、储能与稳定性\n关键词：fossil fuels, renewable energy, solar/wind power',
    motherPromptEn:
      'Fossil fuels such as coal, oil and natural gas are used in many countries. But in some countries, the use of alternative sources of energy, including wind and solar power, is encouraged. Is this trend a positive or a negative development?',
    requirements: [
      '明确判断该趋势总体积极或消极（可附带条件）',
      '写出新能源的主要优势与至少 1 个现实局限',
      '可用对比说明为何仍值得推广',
      '避免把核能等议题完全跑题，除非作为有限补充',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Some countries encourage alternative energy such as wind and solar power instead of fossil fuels. Is this a positive or negative development?',
        promptZh: '鼓励风能太阳能等替代化石燃料，是积极还是消极发展？',
      },
      {
        role: 'variant',
        promptEn: 'Is raising the price of petrol the best way to solve environmental problems?',
        promptZh: '提高油价是解决环境问题的最佳方法吗？',
      },
      {
        role: 'variant',
        promptEn: 'What causes shortages of oil, forests and fresh water, and how can they be addressed?',
        promptZh: '石油、森林与淡水紧张的原因与解决办法？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 9,
    title: '10｜无脸化交易对社会的影响',
    theme: '科技',
    taskType: 'cause_effect',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET4', 'CET6'],
    description: '分析网购、网银等无需面对面交易对个人与社会的影响。',
    promptEn: 'Analyse effects of doing everyday tasks without face-to-face contact.',
    promptZh: '分析日常事务无需面对面完成对个人与社会的影响。',
    situation: '备考议论文：数字化交易与社交疏离',
    candidateRole: '备考考生',
    purpose: '分析无脸化交易的双面影响并给出总体评价',
    knowledgePoints:
      '效率、便利、覆盖面 vs 社交弱化、信任与欺诈、数字鸿沟\n关键词：face-to-face, online banking, social isolation, digital divide',
    motherPromptEn:
      'People can perform everyday tasks such as shopping and banking as well as business transactions without meeting other people face-to-face. What are the effects of this on individuals and society as a whole?',
    requirements: [
      '分别写到对个人与对社会的影响（至少各 1 点）',
      '正面与负面都要涉及，避免单边',
      '用具体场景（购物/银行/会议）举例',
      '结尾给出总体影响判断',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'People can shop, bank and do business without meeting others face-to-face. What are the effects on individuals and society?',
        promptZh: '购物、银行与商务可无需面对面。对个人与社会有何影响？',
      },
      {
        role: 'variant',
        promptEn: 'Has technology made people more isolated? Give your opinion with examples.',
        promptZh: '科技是否让人们更加疏离？（四六级高频）',
        focus: 'CET 科技与人际关系',
      },
      {
        role: 'variant',
        promptEn: 'Do the benefits of online shopping outweigh the disadvantages?',
        promptZh: '网购利大于弊吗？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 10,
    title: '11｜远程办公对雇主与员工',
    theme: '科技',
    taskType: 'agree_disagree',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET6'],
    description: '反驳「远程办公只利员工不利雇主」的观点。',
    promptEn: 'Argue whether working from home benefits only employees, not employers.',
    promptZh: '论证居家办公是否只利员工不利雇主。',
    situation: '备考议论文：远程办公 telecommuting',
    candidateRole: '备考考生',
    purpose: '说明远程办公对劳资双方的双向收益与管理代价',
    knowledgePoints:
      '员工：通勤、灵活、专注\n雇主：场地成本、人才池、产出管理挑战\n关键词：telecommute, productivity, workplace culture',
    motherPromptEn:
      'Many employees may work at home with modern technology. Some people claim that it can benefit only the workers, not the employers. Do you agree or disagree?',
    requirements: [
      '明确同意或不同意「只利员工」',
      '至少写 1 个对雇主的好处与 1 个管理挑战',
      '可用条件句说明何种岗位更适合远程',
      '结尾回扣题干主张',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Working from home with modern technology benefits only workers, not employers. Do you agree or disagree?',
        promptZh: '远程办公只利员工不利雇主——同意吗？',
      },
      {
        role: 'variant',
        promptEn: 'Should companies allow employees to choose remote work permanently after the pandemic era?',
        promptZh: '公司是否应允许员工长期选择远程办公？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 11,
    title: '12｜手机与屏幕时间对青少年',
    theme: '科技',
    taskType: 'discuss_both',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET4', 'CET6'],
    description: '讨论电视、游戏与屏幕时间对儿童/青少年的正负影响。',
    promptEn: 'Discuss both sides of screen time value for children and give your opinion.',
    promptZh: '讨论屏幕时间对儿童的价值与危害并给出看法。',
    situation: '备考议论文：媒体使用与青少年发展',
    candidateRole: '备考考生',
    purpose: '权衡娱乐/学习收益与健康/社交风险',
    knowledgePoints:
      '正：学习资源、创造力、数字素养\n负：成瘾、睡眠、社交与视力\n关键词：screen time, video games, parental guidance',
    motherPromptEn:
      'Some people believe that time spent on television, video and computer games can be valuable for children. Others believe this has negative effects on a child. Discuss both views and give your own opinion.',
    requirements: [
      '双方观点都要呈现，并各有一条有力理由',
      '给出你的立场（可附带「有监督的适度使用」等条件）',
      '至少涉及学习或健康中的一个具体维度',
      '避免只骂手机或只吹科技',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Time spent on TV, video and computer games can be valuable for children / has negative effects. Discuss both views and give your opinion.',
        promptZh: '电视与游戏对儿童有价值还是有害？讨论双方并表态。',
      },
      {
        role: 'variant',
        promptEn:
          'There are social, medical and technical problems associated with mobile phones. Do the problems outweigh the benefits?',
        promptZh: '手机的社会/健康/技术问题是否大于好处？',
      },
      {
        role: 'variant',
        promptEn: 'Computers cannot help children learn; they only cause physical and mental harm. Do you agree?',
        promptZh: '电脑不能帮助儿童学习，只会身心伤害——同意吗？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 12,
    title: '13｜新闻媒体影响力是福是祸',
    theme: '媒体',
    taskType: 'agree_disagree',
    difficulty: 'L4',
    examFit: ['IELTS', 'CET6'],
    description: '评估新闻媒体影响力增强是消极发展还是利弊并存。',
    promptEn: 'Evaluate whether growing news-media influence is a negative development.',
    promptZh: '评估新闻媒体影响力增强是否为消极发展。',
    situation: '备考议论文：媒体影响力',
    candidateRole: '备考考生',
    purpose: '辩证分析媒体赋权与误导风险',
    knowledgePoints:
      '监督权力、信息获取 vs 虚假信息、焦虑、议程设置\n关键词：news media, misinformation, public opinion',
    motherPromptEn:
      'News media is more influential nowadays. Some people think it is a negative development. To what extent do you agree or disagree?',
    requirements: [
      '表明同意程度',
      '至少写出媒体的 1 个积极作用与 1 个消极作用',
      '可用「影响力本身中性、关键在于使用与监管」类限定',
      '结尾给出清晰总评',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn: 'News media is more influential nowadays. Some people think this is negative. To what extent do you agree?',
        promptZh: '新闻媒体影响力更大，有人认为这是消极发展。你多大程度上同意？',
      },
      {
        role: 'variant',
        promptEn: 'Should the government control the news media? Discuss both views.',
        promptZh: '政府是否应管控新闻媒体？讨论双方。',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 13,
    title: '14｜广告：信息还是操控',
    theme: '媒体',
    taskType: 'discuss_both',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET6'],
    description: '讨论广告是有用的产品信息还是对消费者的操控。',
    promptEn: 'Discuss whether advertising mainly informs or manipulates consumers.',
    promptZh: '讨论广告主要是告知还是操控消费者。',
    situation: '备考议论文：广告的社会角色',
    candidateRole: '备考考生',
    purpose: '比较广告的信息功能与诱导风险并表态',
    knowledgePoints:
      '信息：比较产品、降低搜寻成本\n操控：制造需求、针对儿童、夸大宣传\n关键词：advertising, consumer, persuasive',
    motherPromptEn:
      'Some people say that advertising encourages us to buy things we do not need. Others say advertising is useful because it informs people about new products. Discuss both views and give your own opinion.',
    requirements: [
      '双方观点各至少 1 条展开论证',
      '给出你的总体看法（可区分广告类型）',
      '至少举一类具体广告场景',
      '结尾避免「各有利弊」无立场',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Advertising encourages unnecessary buying / informs people about new products. Discuss both views and give your opinion.',
        promptZh: '广告鼓励不必要消费，还是告知新产品信息？讨论并表态。',
      },
      {
        role: 'variant',
        promptEn: 'Should advertising aimed at children be banned?',
        promptZh: '是否应禁止针对儿童的广告？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 14,
    title: '15｜政府该投艺术还是公共服务',
    theme: '政府',
    taskType: 'discuss_both',
    difficulty: 'L4',
    examFit: ['IELTS'],
    description: '讨论政府资金应优先投入艺术还是公共设施与服务。',
    promptEn: 'Discuss government spending priorities: arts versus public services.',
    promptZh: '讨论政府开支优先：艺术还是公共服务。',
    situation: '备考议论文：公共财政优先级',
    candidateRole: '备考考生',
    purpose: '在有限预算下论证艺术与公共服务的取舍',
    knowledgePoints:
      '艺术：文化认同、精神生活、创意产业\n公共服务：医疗、教育、交通基础设施\n关键词：public services, arts funding, quality of life',
    motherPromptEn:
      'Some people say arts such as music and painting cannot directly improve the quality of people’s life, so the government should not put money into the arts; instead, they should spend more on public services. Do you agree or disagree?',
    requirements: [
      '直接回应「不该投艺术、应投公共服务」的主张',
      '承认公共服务紧迫性的同时，论证艺术的非直接但真实价值',
      '或提出预算分配原则（基本服务优先 + 保留文化投入）',
      '避免情绪化贬低任一方',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Governments should not fund arts and should spend more on public services instead. Do you agree or disagree?',
        promptZh: '政府不该资助艺术，应把钱花在公共服务上——同意吗？',
      },
      {
        role: 'variant',
        promptEn: 'Should the government decide which subjects university students study?',
        promptZh: '大学科目是否应由政府决定？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 15,
    title: '16｜城市化带来的问题与对策',
    theme: '政府',
    taskType: 'problem_solution',
    difficulty: 'L4',
    examFit: ['IELTS', 'CET6'],
    description: '分析快速城市化的主要问题并提出对策。',
    promptEn: 'Explain urbanisation problems and propose solutions.',
    promptZh: '说明城市化问题并提出解决办法。',
    situation: '备考议论文：城市扩张与宜居性',
    candidateRole: '备考考生',
    purpose: '诊断城市化病症并给出政策/社区级方案',
    knowledgePoints:
      '住房、交通拥堵、污染、公共服务压力、城乡差距\n关键词：urbanisation, infrastructure, affordable housing',
    motherPromptEn:
      'In many countries, more and more people are moving to cities. What problems does this cause, and what solutions can you suggest?',
    requirements: [
      '至少指出 2 个城市化带来的具体问题',
      '每个问题尽量对应 1 条对策',
      '对策需可执行（交通、住房、规划等），避免空话',
      '可简要提及农村发展作为分流手段',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'More and more people are moving to cities. What problems does this cause, and what solutions can you suggest?',
        promptZh: '越来越多人迁入城市。造成哪些问题？如何解决？',
      },
      {
        role: 'variant',
        promptEn: 'Is living in a big city better than living in the countryside? Discuss both views.',
        promptZh: '住大城市是否优于住乡村？讨论双方。',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 16,
    title: '17｜家庭管教：规则还是自由度',
    theme: '社会家庭',
    taskType: 'discuss_both',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET4'],
    description: '讨论儿童应严格服从规则还是需要足够自由以准备成人生活。',
    promptEn: 'Discuss obedience versus freedom in raising children.',
    promptZh: '讨论养育中服从规则与给予自由的取舍。',
    situation: '备考议论文：家庭与学校教育方式',
    candidateRole: '备考考生',
    purpose: '比较管教与自主的功能并给出分龄建议',
    knowledgePoints:
      '规则：是非判断、安全边界\n自由：兴趣发展、独立决策\n关键词：obedience, autonomy, peer pressure',
    motherPromptEn:
      'Some people say that children should obey the rules of their parents and teachers, while other people think children will not be well-prepared for adult life if they are given too much control. Discuss both sides and give your opinion.',
    requirements: [
      '双方都要写到',
      '给出你的综合立场（可按年龄阶段区分）',
      '至少提及家庭或学校中的一个具体场景',
      '结尾明确「早年规则 + 渐进自主」或你的替代框架',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Children should obey parents/teachers vs too much control harms adult readiness. Discuss both sides and give your opinion.',
        promptZh: '儿童应服从规则，还是管太多不利于成年？讨论并表态。',
      },
      {
        role: 'variant',
        promptEn: 'Do teachers play a greater role than parents in children’s intellectual and social development?',
        promptZh: '老师对儿童智力与社会发展的作用是否大于家长？',
      },
      {
        role: 'variant',
        promptEn: 'What are the advantages and disadvantages of peer pressure?',
        promptZh: '同龄人压力的利弊？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 17,
    title: '18｜工作与生活失衡',
    theme: '社会家庭',
    taskType: 'cause_effect',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET4', 'CET6'],
    description: '分析忙于工作无暇陪伴家人的原因与社会影响。',
    promptEn: 'Analyse why people lack family time and how this affects society.',
    promptZh: '分析人们缺少家庭时间的原因及对社会的影响。',
    situation: '备考议论文 / 四六级：工作生活平衡',
    candidateRole: '备考考生',
    purpose: '解释失衡成因并评估对家庭与社会的后果',
    knowledgePoints:
      '原因：竞争、加班文化、经济压力、远程工作边界模糊\n影响：亲子关系、心理健康、生育意愿\n关键词：work-life balance, overtime, burnout',
    motherPromptEn:
      'Nowadays many people are too busy with work to spend enough time with family and friends. Why is this happening, and what effects can it have on family life and society?',
    requirements: [
      '给出至少 2 个原因并解释',
      '写出对家庭与对社会的影响各至少 1 点',
      '可附带 1 条简要改善建议（非必须展开成全文对策）',
      '保持议论文正式语气',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Many people are too busy with work to spend time with family and friends. Why, and what effects does this have?',
        promptZh: '很多人忙于工作无暇陪伴家人朋友。为什么？有何影响？',
      },
      {
        role: 'variant',
        promptEn: 'Should governments limit working hours by law?',
        promptZh: '政府是否应立法限制工作时间？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 18,
    title: '19｜青少年犯罪：原因与惩处',
    theme: '犯罪法律',
    taskType: 'problem_solution',
    difficulty: 'L4',
    examFit: ['IELTS'],
    description: '分析青少年犯罪上升的原因及合适的惩处/干预方式。',
    promptEn: 'Explain youth crime causes and appropriate responses.',
    promptZh: '说明青少年犯罪原因及恰当应对。',
    situation: '备考议论文：juvenile delinquency',
    candidateRole: '备考考生',
    purpose: '从家庭/社会/媒体分析成因并提出改造导向对策',
    knowledgePoints:
      '家庭、学校、同伴、媒体暴力\n惩处：教育改造、社区服务、监禁的限度\n关键词：juvenile delinquency, rehabilitation, community service',
    motherPromptEn:
      'In many parts of the world, children and teenagers are committing more crimes. Why is this happening? How should children or teenagers be punished?',
    requirements: [
      '至少分析 2 个原因（建议覆盖不同层面）',
      '惩处部分需区分「惩罚」与「改造」，给出你的偏好',
      '避免极端化（一味严刑或一味纵容）',
      '结尾总结预防重于事后惩罚的观点（若认同）',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Children and teenagers are committing more crimes. Why? How should they be punished?',
        promptZh: '青少年犯罪增多。为什么？应如何惩处？',
      },
      {
        role: 'variant',
        promptEn: 'Is crime part of human nature, or can it be prevented?',
        promptZh: '犯罪是人类本性，还是可以预防？',
      },
      {
        role: 'variant',
        promptEn: 'Many young people show anti-social behaviour. What are the causes and solutions?',
        promptZh: '许多年轻人有反社会行为。原因与解决办法？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 19,
    title: '20｜监禁 vs 教育改造',
    theme: '犯罪法律',
    taskType: 'agree_disagree',
    difficulty: 'L4',
    examFit: ['IELTS'],
    description: '讨论教育与职业培训是否比监禁更能帮助罪犯改造。',
    promptEn: 'Argue whether education and job training beat prison for offenders.',
    promptZh: '论证教育与职业培训是否优于监禁。',
    situation: '备考议论文：刑罚目的——惩罚还是改造',
    candidateRole: '备考考生',
    purpose: '比较监禁与再教育对再犯率与社会安全的影响',
    knowledgePoints:
      '监禁：威慑、隔离危险个体\n教育培训：再就业、降低再犯\n关键词：imprisonment, rehabilitate, reoffending',
    motherPromptEn:
      'Sending criminals to prison is not the best method of dealing with them. Education and job training are better ways to help them. Do you agree or disagree?',
    requirements: [
      '明确同意程度（可区分轻罪/初犯与重罪）',
      '比较两种路径的至少各 1 个优点或局限',
      '用「再犯率/回归社会」作为评价标准之一',
      '结尾给出可执行的组合方案亦可',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Prison is not the best method; education and job training are better for criminals. Do you agree or disagree?',
        promptZh: '监禁不是最好办法，教育与职业培训更好——同意吗？',
      },
      {
        role: 'variant',
        promptEn: 'Is a longer prison sentence the best way to reduce crime?',
        promptZh: '延长刑期是降低犯罪的最佳方法吗？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 20,
    title: '21｜国际旅游：利大于弊？',
    theme: '文化全球化',
    taskType: 'advantages_disadvantages',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET6'],
    description: '权衡国际旅游业的经济文化交流收益与负面冲击。',
    promptEn: 'Weigh advantages and disadvantages of international tourism.',
    promptZh: '权衡国际旅游的利弊。',
    situation: '备考议论文：国际旅游业',
    candidateRole: '备考考生',
    purpose: '评估国际旅游对目的地的综合影响',
    knowledgePoints:
      '利：经济、跨文化理解、遗产保护资金\n弊：环境压力、文化商品化、物价与过度拥挤\n关键词：international tourism, cultural exchange, overtourism',
    motherPromptEn:
      'International tourism has become a huge industry. Do the problems of international travel outweigh its advantages?',
    requirements: [
      '利弊两侧都要充分展开',
      '给出「是否利大于弊」的明确判断',
      '至少提到经济与文化/环境中的两个维度',
      '可用管理措施说明弊端可缓解（可选）',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn: 'Do the problems of international tourism outweigh its advantages?',
        promptZh: '国际旅游的问题是否大于好处？',
      },
      {
        role: 'variant',
        promptEn: 'Does international tourism cause cultural conflict or promote understanding?',
        promptZh: '国际旅游导致文化冲突还是促进理解？',
      },
      {
        role: 'variant',
        promptEn: 'Since we can learn about countries online, is travelling still necessary?',
        promptZh: '既然网上就能了解国家，是否还有必要旅游？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 21,
    title: '22｜全球化与文化认同',
    theme: '文化全球化',
    taskType: 'discuss_both',
    difficulty: 'L4',
    examFit: ['IELTS', 'CET6'],
    description: '讨论跨国商业文化交流带来的积极影响与国家认同流失担忧。',
    promptEn: 'Discuss global contact benefits versus loss of national identity.',
    promptZh: '讨论全球联系的好处与国家认同流失之忧。',
    situation: '备考议论文：全球化双刃剑',
    candidateRole: '备考考生',
    purpose: '辩证看待全球化对文化认同的影响并表态',
    knowledgePoints:
      '正：创新、机会、跨文化能力\n负：同化、本土传统弱化、不平等\n关键词：globalisation, national identity, cultural diversity',
    motherPromptEn:
      'Some people think the increasing business and cultural contact between countries brings many positive effects. Others say it causes the loss of national identities. Discuss both sides and give your opinion.',
    requirements: [
      '双方观点充分展开',
      '给出你的立场（可主张「接触与认同可并存」并说明如何）',
      '至少举一个文化或商业全球化例子',
      '结尾回扣「认同流失」是否必然',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Increasing business and cultural contact brings positives / causes loss of national identities. Discuss both sides and give your opinion.',
        promptZh: '跨国商业文化交流利多，还是导致国家认同流失？讨论并表态。',
      },
      {
        role: 'variant',
        promptEn:
          'The spread of multinational companies and globalisation produces positive effects for everyone. Do you agree?',
        promptZh: '跨国公司扩张与全球化对所有人都有积极影响——同意吗？',
      },
      {
        role: 'variant',
        promptEn: 'Every year several languages die out. Is this unimportant because fewer languages make life easier?',
        promptZh: '每年有语言消失。这是否无关紧要，因为语言少了交流更方便？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 22,
    title: '23｜工作满意度从何而来',
    theme: '职业生活',
    taskType: 'cause_effect',
    difficulty: 'L3',
    examFit: ['IELTS', 'CET6'],
    description: '分析影响工作满意度的因素，并讨论人人满意是否现实。',
    promptEn: 'Explain factors of job satisfaction and how realistic it is for all.',
    promptZh: '说明工作满意度的因素，以及人人满意是否现实。',
    situation: '备考议论文：job satisfaction',
    candidateRole: '备考考生',
    purpose: '拆解满意度构成并评估全员满意的可行性',
    knowledgePoints:
      '薪酬、工时、环境、保障、人际关系、意义感\n关键词：job satisfaction, well-being, job security',
    motherPromptEn:
      'As most people spend a major part of their adult life at work, job satisfaction is an important element of individual well-being. What factors contribute to job satisfaction? How realistic is the expectation of job satisfaction for all workers?',
    requirements: [
      '列出至少 3 个影响因素并简要解释',
      '专门回答「所有人都能满意吗」是否现实',
      '可用雇主与雇员双边努力作为收束',
      '结构清晰，避免变成求职鸡汤',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'What factors contribute to job satisfaction? How realistic is job satisfaction for all workers?',
        promptZh: '哪些因素影响工作满意度？期望所有人都满意现实吗？',
      },
      {
        role: 'variant',
        promptEn: 'Is job-hopping a positive trend for young people?',
        promptZh: '年轻人频繁跳槽是积极趋势吗？',
      },
      {
        role: 'variant',
        promptEn: 'Should doctors, nurses and teachers be paid more than sports and entertainment stars?',
        promptZh: '医生护士教师是否应比文体明星收入更高？',
      },
    ],
    suggestedDurationSec: 2400,
  },
  {
    sortOrder: 23,
    title: '24｜竞争与合作哪个更重要',
    theme: '抽象',
    taskType: 'discuss_both',
    difficulty: 'L4',
    examFit: ['IELTS', 'CET4', 'CET6'],
    description: '抽象价值题：教育儿童竞争还是合作，并迁移到社会层面。',
    promptEn: 'Discuss whether children should be taught to compete or cooperate.',
    promptZh: '讨论应教育儿童竞争还是合作。',
    situation: '备考议论文：竞争与合作的价值取向',
    candidateRole: '备考考生',
    purpose: '在抽象议题上落地到教育场景并给出可辩护立场',
    knowledgePoints:
      '竞争：动机、抗压、创新激励\n合作：沟通、共情、复杂任务\n关键词：competition, cooperation, teamwork',
    motherPromptEn:
      'Some people think children should be taught to compete; others think cooperation is more important. Discuss both views and give your own opinion.',
    requirements: [
      '把抽象价值落到教育或团队场景，避免空谈',
      '双方各至少 1 条有力理由',
      '给出你的综合立场（可主张情境依赖）',
      '结尾可用简短例子收束',
    ],
    plannedItems: [
      {
        role: 'mother',
        promptEn:
          'Should children be taught to compete or to cooperate? Discuss both views and give your opinion.',
        promptZh: '应教育儿童竞争还是合作？讨论双方并表态。',
      },
      {
        role: 'variant',
        promptEn: 'Does economic success always bring happiness?',
        promptZh: '经济成功一定带来幸福吗？',
      },
      {
        role: 'variant',
        promptEn: 'Is economic strength the only measure of a country’s success?',
        promptZh: '经济实力是衡量国家成功的唯一因素吗？',
      },
      {
        role: 'variant',
        promptEn: 'Team sports teach more useful skills than individual sports. Do you agree?',
        promptZh: '团队运动比个人运动能学到更多有用技能——同意吗？',
      },
    ],
    suggestedDurationSec: 2400,
  },
]

async function ensureCategory() {
  const existing = await prisma.sceneCategory.findFirst({ where: { name: '学术挑战' } })
  if (existing) return existing
  return prisma.sceneCategory.create({
    data: { name: '学术挑战', icon: 'BookOpen', sortOrder: 50 },
  })
}

async function main() {
  console.log(`→ 导入：${SCENE_TITLE}`)
  const category = await ensureCategory()

  const existing = await prisma.scene.findFirst({
    where: { title: SCENE_TITLE, packageType: 'exam' },
    select: { id: true },
  })
  if (existing) {
    await prisma.trainingTopic.deleteMany({ where: { sceneId: existing.id } })
    await prisma.scene.delete({ where: { id: existing.id } })
    console.log('  已删除旧 Scene/Topics，准备重建')
  }

  const scene = await prisma.scene.create({
    data: {
      categoryId: category.id,
      packageType: 'exam',
      contentMode: 'writing',
      title: SCENE_TITLE,
      location: '雅思 / 四六级写作备考',
      description: [
        `设计稿：${DESIGN_DOC}`,
        '',
        '一句话定位：就十大公共题材完成限时议论文，训练题型识别与论元复用。',
        '',
        'exam / writing；genre=essay；24 话题覆盖雅思十大题材并与四六级校园/社会热点交叉。',
        '与《观点与论证写作》错位：彼包练日常论证骨架，本包练考试公共议题。',
        '本阶段写入可作答题面与 plannedItems；范文/词块 enrichmentStatus=pending。',
      ].join('\n'),
      requiredOutputLevel: 'L3',
      requiredUserLevel: 3,
      isFree: true,
    },
  })

  for (const topic of TOPICS) {
    const writing = {
      genre: 'essay' as const,
      questionMarkdown: buildQuestionMarkdown(topic),
      situation: topic.situation,
      minWords: 200,
      maxWords: 280,
      candidateRole: topic.candidateRole,
      audience: '考官 / 阅卷人',
      purpose: topic.purpose,
      requirements: topic.requirements,
      rubric: RUBRIC,
    }

    await prisma.trainingTopic.create({
      data: {
        sceneId: scene.id,
        type: topic.examFit.includes('IELTS') ? 'ielts' : 'daily',
        activityType: 'writing',
        title: topic.title,
        description: topic.description,
        knowledgePoints: topic.knowledgePoints,
        promptEn: topic.promptEn,
        promptZh: topic.promptZh,
        suggestedDurationSec: topic.suggestedDurationSec,
        difficulty: topic.difficulty,
        sortOrder: topic.sortOrder,
        contentConfig: { writing },
        metadata: {
          designDoc: DESIGN_DOC,
          enrichmentStatus: 'pending',
          contentBlueprint: {
            kind: 'exam_essay',
            source: DESIGN_DOC,
            enrichmentStatus: 'pending',
            theme: topic.theme,
            taskType: topic.taskType,
            examFit: topic.examFit,
            itemCount: topic.plannedItems.length,
            dataSpec: {
              primaryMaterial: 'writing_prompt',
              alsoCreate: ['chunk', 'vocabulary'],
              perItemFields: [
                'promptEn / promptZh → 变体题库',
                'focus → 论证焦点',
                '富化：referenceAnswer + referenceExplanation',
                '富化：题材词块 Chunk 6–10 + Vocab 8–12',
              ],
              teachingMarkdown: '审题策略、题型结构、母题论元、常见跑题点、自检清单',
            },
            plannedItems: topic.plannedItems,
          },
        },
      },
    })
  }

  console.log(`✓ Scene ${scene.id}`)
  console.log(`✓ Topics ${TOPICS.length}`)
  console.log(`✓ Category ${category.name}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
