import { PrismaClient } from '@prisma/client'

/**
 * 口语万能造句（50 个高频骨架）
 *
 * 设计原则：不按原始文档的 220 个句式照搬，而是保留日常对话里最容易
 * 复用的句子骨架。每个句式配 3 个跨话题例句，便于后续在后台继续润色。
 *
 * 运行：cd apps/backend && npx ts-node prisma/seed-spoken-sentence-formulas.ts
 */

type Example = { en: string; zh: string; level: 'basic' | 'intermediate' | 'advanced' }

type Formula = {
  topic: string
  pattern: string
  meaning: string
  description: string
  slots: { name: string; hint: string; examples: string[] }[]
  examples: Example[]
}

type TopicDefinition = {
  title: string
  promptEn: string
  promptZh: string
  description: string
  knowledgePoints: string
  duration: number
}

const PACKAGE_TITLE = '口语万能造句：50 个高频句式'
const CATEGORY_NAME = '基础口语'
const PATTERN_CATEGORY = '日常口语造句'

const TOPICS: TopicDefinition[] = [
  { title: '01 介绍自己与近况', promptEn: 'You have just met someone at a casual event. Introduce yourself and share one thing about your current life.', promptZh: '你在一个轻松的活动上认识了新朋友。介绍自己，并聊一件你最近的事。', description: '用最短的句子介绍身份、兴趣与最近状态。', knowledgePoints: '身份介绍；兴趣表达；现在进行时', duration: 60 },
  { title: '02 日常计划与待办', promptEn: 'Talk about what you need to do today and one plan you are considering.', promptZh: '说说你今天要做的事，以及一个你正在考虑的计划。', description: '把“必须做”“准备做”“考虑做”说清楚。', knowledgePoints: 'need to；going to；thinking of', duration: 60 },
  { title: '03 想做与不想做', promptEn: 'A friend asks what you want to do tonight. Say what you would like, feel like, or do not feel like doing.', promptZh: '朋友问你今晚想做什么。说说你想做、想吃或不太想做的事。', description: '自然表达偏好、心情和临时想法。', knowledgePoints: 'would like to；feel like；don’t feel like', duration: 60 },
  { title: '04 礼貌请求', promptEn: 'You are in a café or shop. Ask for something politely and ask another person for a small favor.', promptZh: '你在咖啡店或商店里。礼貌地索取物品，并向别人请求一个小帮助。', description: '练习日常最常用的点单、询问和请人帮忙。', knowledgePoints: 'Can I；Could you；Could I have；Would you mind', duration: 75 },
  { title: '05 主动帮忙与回应', promptEn: 'Your friend is carrying many bags and seems busy. Offer help in two natural ways.', promptZh: '朋友拿着很多东西，看起来很忙。用两种自然的方式主动帮忙。', description: '不用太正式，也能让帮助听起来贴心自然。', knowledgePoints: 'Let me；Do you want me to；Can I help you with', duration: 60 },
  { title: '06 聊兴趣与经历', promptEn: 'Ask a new friend about a movie, a hobby, and something they have experienced before.', promptZh: '向新朋友聊一部电影、一个爱好，以及他们以前是否有过某种经历。', description: '用开放问题把闲聊接下去。', knowledgePoints: 'What do you think；How do you feel；Have you ever；Are you up for', duration: 75 },
  { title: '07 发出邀请与约时间', promptEn: 'Invite a friend to do something this weekend and check when they are available.', promptZh: '邀请朋友这周末一起做件事，并确认他们什么时候有空。', description: '用自然、不强迫的方式约人。', knowledgePoints: 'Do you want to；Why don’t we；Are you free', duration: 60 },
  { title: '08 听不懂时怎么问', promptEn: 'You did not understand part of a conversation. Ask for clarification without sounding awkward.', promptZh: '你没有听懂对话的一部分。自然地请对方解释或重复。', description: '不懂时及时确认，避免假装听懂。', knowledgePoints: 'What do you mean；I’m not sure if；Could you say that again', duration: 60 },
  { title: '09 表示同意与保留意见', promptEn: 'Discuss where to eat with a friend. Agree with one idea and politely disagree with another.', promptZh: '和朋友讨论去哪儿吃饭。同意一个建议，也礼貌地表达一个不同意见。', description: '学会给观点留空间，不把表达说死。', knowledgePoints: 'I agree；I see what you mean；It depends on', duration: 75 },
  { title: '10 自然反应与共情', promptEn: 'Your friend tells you good news, surprising news, and a small problem. Respond naturally to each.', promptZh: '朋友告诉你一个好消息、一个让人意外的消息和一个小麻烦。分别自然回应。', description: '用短句快速表达惊喜、开心和抱歉。', knowledgePoints: 'That sounds；I can’t believe；I’m glad', duration: 60 },
  { title: '11 生活小故障', promptEn: 'Your phone or app is not working and you cannot find an important item. Explain the problem and ask what to do.', promptZh: '你的手机或应用不好用，也找不到一个重要物品。说明问题并询问怎么解决。', description: '覆盖设备、出行、住宿中高频的故障说明。', knowledgePoints: 'Something’s wrong with；isn’t working；can’t find', duration: 75 },
  { title: '12 工作学习进度', promptEn: 'Tell a classmate what you are working on, what is difficult, and what you have already finished.', promptZh: '告诉同学你正在做什么、哪里有困难，以及已经完成了什么。', description: '把进度、困难和责任讲得简洁准确。', knowledgePoints: 'working on；having trouble；supposed to；done with', duration: 75 },
  { title: '13 聊过去经历', promptEn: 'Talk about a habit you had before, something you just did, and something you have never tried.', promptZh: '聊聊你以前的一个习惯、刚刚做完的事，以及从没尝试过的事。', description: '用三个高频骨架把过去和现在连起来。', knowledgePoints: 'used to；have just；have never', duration: 75 },
  { title: '14 期待与不确定的未来', promptEn: 'Talk about a coming plan. Say what you are looking forward to, what you cannot wait to do, and what might happen.', promptZh: '聊聊即将到来的计划。说说你期待什么、迫不及待想做什么，以及可能发生什么。', description: '既能表达期待，也能保留不确定性。', knowledgePoints: 'looking forward to；can’t wait；will probably；might', duration: 75 },
  { title: '15 给建议与找解决办法', promptEn: 'A friend is stressed about a problem. Give one direct suggestion, one softer suggestion, and ask about a possible solution.', promptZh: '朋友正为一个问题烦恼。给一个直接建议、一个更委婉的建议，并一起问问有什么解决方式。', description: '区分直接建议、委婉建议和一起找办法。', knowledgePoints: 'should；How about；If I were you；Is there a way to', duration: 90 },
]

const FORMULAS: Formula[] = [
  { topic: '01 介绍自己与近况', pattern: "I'm [adjective / noun].", meaning: '我是…… / 我现在感觉……。', description: '介绍身份、状态或当下感受的最短开场。', slots: [{ name: 'adjective / noun', hint: '身份、心情或状态', examples: ['a designer', 'a little tired', 'new here'] }], examples: [{ en: "I'm new here, so I don't know many people yet.", zh: '我刚来这里，所以认识的人还不多。', level: 'basic' }, { en: "I'm a little nervous, but I'm excited to be here.", zh: '我有点紧张，但也很高兴来到这里。', level: 'intermediate' }, { en: "I'm not much of a morning person, to be honest.", zh: '说实话，我不太是早起的人。', level: 'advanced' }] },
  { topic: '01 介绍自己与近况', pattern: "I'm from [place].", meaning: '我来自……。', description: '自然说明自己来自哪里，也可以顺势补一句近况。', slots: [{ name: 'place', hint: '城市、国家或地区', examples: ['Shanghai', 'a small town near Chengdu', 'Canada'] }], examples: [{ en: "I'm from Shanghai, but I live in Hangzhou now.", zh: '我来自上海，不过现在住在杭州。', level: 'basic' }, { en: "I'm from a small town near Chengdu.", zh: '我来自成都附近的一个小城。', level: 'intermediate' }, { en: "I'm originally from Beijing, but I moved here for work.", zh: '我本来来自北京，不过是为了工作搬到这里的。', level: 'advanced' }] },
  { topic: '01 介绍自己与近况', pattern: "I'm into [noun / V-ing].", meaning: '我很喜欢…… / 我对……很感兴趣。', description: '比 I like 更口语，适合聊兴趣。', slots: [{ name: 'noun / V-ing', hint: '兴趣、活动或内容', examples: ['coffee', 'hiking', 'watching documentaries'] }], examples: [{ en: "I'm really into street photography these days.", zh: '我最近很喜欢街头摄影。', level: 'basic' }, { en: "I'm into anything with a good story.", zh: '只要故事讲得好，我都喜欢。', level: 'intermediate' }, { en: "I'm not really into horror movies.", zh: '我不太喜欢恐怖电影。', level: 'advanced' }] },

  { topic: '02 日常计划与待办', pattern: 'I need to [verb].', meaning: '我得…… / 我需要……。', description: '说明必要事项，语气比 have to 稍缓。', slots: [{ name: 'verb', hint: '动词原形', examples: ['leave soon', 'call my mom', 'pick up some groceries'] }], examples: [{ en: 'I need to leave in about ten minutes.', zh: '我大概十分钟后得走了。', level: 'basic' }, { en: 'I need to pick up some groceries after work.', zh: '下班后我得去买点菜。', level: 'intermediate' }, { en: 'I need to think about it before I decide.', zh: '我得想一想再决定。', level: 'advanced' }] },
  { topic: '02 日常计划与待办', pattern: "I'm going to [verb].", meaning: '我打算…… / 我马上要……。', description: '用于已经有明确打算的近期计划。', slots: [{ name: 'verb', hint: '动词原形', examples: ['make dinner', 'take a break', 'see a doctor'] }], examples: [{ en: "I'm going to make dinner when I get home.", zh: '我到家后打算做晚饭。', level: 'basic' }, { en: "I'm going to take a short break first.", zh: '我先打算休息一会儿。', level: 'intermediate' }, { en: "I'm going to talk to my manager about it tomorrow.", zh: '我明天打算和经理聊聊这件事。', level: 'advanced' }] },
  { topic: '02 日常计划与待办', pattern: "I'm thinking of [V-ing].", meaning: '我在考虑……。', description: '计划还没定下来时的自然说法。', slots: [{ name: 'V-ing', hint: '动名词', examples: ['taking a class', 'getting a new phone', 'going away this weekend'] }], examples: [{ en: "I'm thinking of taking a class this fall.", zh: '我在考虑今年秋天报个课。', level: 'basic' }, { en: "I'm thinking of getting a new phone soon.", zh: '我在考虑最近换个新手机。', level: 'intermediate' }, { en: "I'm thinking of going away for the weekend.", zh: '我在考虑周末出去玩两天。', level: 'advanced' }] },

  { topic: '03 想做与不想做', pattern: "I'd like to [verb].", meaning: '我想……。', description: '表达愿望或点单时自然礼貌。', slots: [{ name: 'verb', hint: '动词原形', examples: ['try this', 'book a table', 'know more'] }], examples: [{ en: "I'd like to try the chicken sandwich.", zh: '我想试试这个鸡肉三明治。', level: 'basic' }, { en: "I'd like to know more about the job.", zh: '我想多了解一下这份工作。', level: 'intermediate' }, { en: "I'd like to book a table for two at seven.", zh: '我想订晚上七点两个人的位子。', level: 'advanced' }] },
  { topic: '03 想做与不想做', pattern: 'I feel like [V-ing].', meaning: '我想…… / 我有点想……。', description: '跟随当下心情的随意表达。', slots: [{ name: 'V-ing', hint: '动名词', examples: ['staying in', 'getting coffee', 'watching something funny'] }], examples: [{ en: 'I feel like staying in tonight.', zh: '我今晚有点想待在家里。', level: 'basic' }, { en: 'I feel like getting coffee before class.', zh: '上课前我想去喝杯咖啡。', level: 'intermediate' }, { en: 'I feel like watching something funny tonight.', zh: '我今晚想看点轻松好笑的。', level: 'advanced' }] },
  { topic: '03 想做与不想做', pattern: "I don't feel like [V-ing].", meaning: '我不太想……。', description: '委婉表达不想做某事，不必显得生硬。', slots: [{ name: 'V-ing', hint: '动名词', examples: ['cooking', 'going out', 'talking about work'] }], examples: [{ en: "I don't feel like cooking tonight.", zh: '我今晚不太想做饭。', level: 'basic' }, { en: "I don't feel like going out in the rain.", zh: '下雨天我不太想出门。', level: 'intermediate' }, { en: "I don't feel like talking about work right now.", zh: '我现在不太想聊工作。', level: 'advanced' }] },

  { topic: '04 礼貌请求', pattern: 'Can I [verb]?', meaning: '我可以……吗？', description: '最常用的直接许可请求。', slots: [{ name: 'verb', hint: '动词原形', examples: ['sit here', 'pay by card', 'ask a question'] }], examples: [{ en: 'Can I sit here?', zh: '我可以坐这儿吗？', level: 'basic' }, { en: 'Can I pay by card?', zh: '我可以刷卡吗？', level: 'intermediate' }, { en: 'Can I ask you a quick question?', zh: '我可以问你一个小问题吗？', level: 'advanced' }] },
  { topic: '04 礼貌请求', pattern: 'Could you [verb]?', meaning: '你能……吗？', description: '请求别人做事，比 Can you 更柔和一点。', slots: [{ name: 'verb', hint: '动词原形', examples: ['help me', 'speak slower', 'send it again'] }], examples: [{ en: 'Could you help me with this?', zh: '你能帮我弄一下这个吗？', level: 'basic' }, { en: 'Could you speak a little slower?', zh: '你能说慢一点吗？', level: 'intermediate' }, { en: 'Could you send me the address again?', zh: '你能再把地址发我一次吗？', level: 'advanced' }] },
  { topic: '04 礼貌请求', pattern: 'Could I have [noun]?', meaning: '我能要……吗？', description: '点单、索取物品时很自然的说法。', slots: [{ name: 'noun', hint: '物品、食物或信息', examples: ['some water', 'the bill', 'your email address'] }], examples: [{ en: 'Could I have some water, please?', zh: '可以给我一些水吗？', level: 'basic' }, { en: 'Could I have the bill when you have a moment?', zh: '方便的时候可以给我账单吗？', level: 'intermediate' }, { en: 'Could I have your email address?', zh: '我可以要一下你的邮箱地址吗？', level: 'advanced' }] },
  { topic: '04 礼貌请求', pattern: 'Would you mind [V-ing]?', meaning: '你介意……吗？', description: '请求时更客气；回答 yes 表示介意，no 表示不介意。', slots: [{ name: 'V-ing', hint: '动名词', examples: ['opening the window', 'waiting a minute', 'taking a photo'] }], examples: [{ en: 'Would you mind opening the window?', zh: '你介意开一下窗吗？', level: 'basic' }, { en: 'Would you mind waiting a minute?', zh: '你介意等一分钟吗？', level: 'intermediate' }, { en: 'Would you mind taking a photo for us?', zh: '你介意帮我们拍张照吗？', level: 'advanced' }] },

  { topic: '05 主动帮忙与回应', pattern: 'Let me [verb].', meaning: '让我来……。', description: '主动接手一件小事，语气自然友好。', slots: [{ name: 'verb', hint: '动词原形', examples: ['help you', 'check', 'get the door'] }], examples: [{ en: 'Let me help you with those bags.', zh: '让我帮你拿这些包吧。', level: 'basic' }, { en: 'Let me check if they are still open.', zh: '让我看看他们是不是还开着。', level: 'intermediate' }, { en: 'Let me get the door for you.', zh: '我来帮你开门。', level: 'advanced' }] },
  { topic: '05 主动帮忙与回应', pattern: 'Do you want me to [verb]?', meaning: '你要不要我……？', description: '先征询对方意愿的帮忙方式。', slots: [{ name: 'verb', hint: '动词原形', examples: ['come with you', 'carry that', 'save you a seat'] }], examples: [{ en: 'Do you want me to come with you?', zh: '你要不要我和你一起去？', level: 'basic' }, { en: 'Do you want me to carry that for you?', zh: '你要不要我帮你拿那个？', level: 'intermediate' }, { en: 'Do you want me to save you a seat?', zh: '要不要我帮你留个座？', level: 'advanced' }] },
  { topic: '05 主动帮忙与回应', pattern: 'Can I help you with [noun]?', meaning: '我能帮你处理……吗？', description: '适合具体说明想帮对方哪件事。', slots: [{ name: 'noun', hint: '任务或麻烦', examples: ['your homework', 'the boxes', 'the form'] }], examples: [{ en: 'Can I help you with the boxes?', zh: '我能帮你搬这些箱子吗？', level: 'basic' }, { en: 'Can I help you with the form?', zh: '我能帮你填这个表吗？', level: 'intermediate' }, { en: 'Can I help you with anything before I go?', zh: '我走之前有什么能帮你的吗？', level: 'advanced' }] },

  { topic: '06 聊兴趣与经历', pattern: 'What do you think about [noun]?', meaning: '你觉得……怎么样？', description: '邀请对方说看法的日常问法。', slots: [{ name: 'noun', hint: '人、事、物或计划', examples: ['this place', 'the new update', 'going by train'] }], examples: [{ en: 'What do you think about this place?', zh: '你觉得这个地方怎么样？', level: 'basic' }, { en: 'What do you think about the new update?', zh: '你觉得这次新更新怎么样？', level: 'intermediate' }, { en: 'What do you think about going by train instead?', zh: '你觉得改坐火车怎么样？', level: 'advanced' }] },
  { topic: '06 聊兴趣与经历', pattern: 'How do you feel about [noun / V-ing]?', meaning: '你对……感觉怎么样？', description: '比 What do you think 更关注感受或态度。', slots: [{ name: 'noun / V-ing', hint: '事情、计划或做法', examples: ['the plan', 'working from home', 'meeting earlier'] }], examples: [{ en: 'How do you feel about the plan?', zh: '你觉得这个计划怎么样？', level: 'basic' }, { en: 'How do you feel about working from home?', zh: '你觉得在家办公怎么样？', level: 'intermediate' }, { en: 'How do you feel about meeting a little earlier?', zh: '你觉得我们早点见面怎么样？', level: 'advanced' }] },
  { topic: '06 聊兴趣与经历', pattern: 'Have you ever [past participle]?', meaning: '你有没有……过？', description: '聊经历、旅行和兴趣时的高频问法。', slots: [{ name: 'past participle', hint: '过去分词', examples: ['tried this', 'been there', 'met someone famous'] }], examples: [{ en: 'Have you ever tried this dish?', zh: '你吃过这道菜吗？', level: 'basic' }, { en: 'Have you ever been to Seoul?', zh: '你去过首尔吗？', level: 'intermediate' }, { en: 'Have you ever met someone famous?', zh: '你见过名人吗？', level: 'advanced' }] },
  { topic: '06 聊兴趣与经历', pattern: 'Are you up for [noun / V-ing]?', meaning: '你想不想……？/ 你有兴趣……吗？', description: '随意地邀请对方做某件事。', slots: [{ name: 'noun / V-ing', hint: '活动、食物或计划', examples: ['coffee', 'getting lunch', 'a walk'] }], examples: [{ en: 'Are you up for coffee later?', zh: '你晚点想不想喝杯咖啡？', level: 'basic' }, { en: 'Are you up for getting lunch after class?', zh: '下课后你想不想一起吃午饭？', level: 'intermediate' }, { en: 'Are you up for a walk before dinner?', zh: '晚饭前你想不想散个步？', level: 'advanced' }] },

  { topic: '07 发出邀请与约时间', pattern: 'Do you want to [verb]?', meaning: '你想不想……？', description: '最直接、自然的邀请句。', slots: [{ name: 'verb', hint: '动词原形', examples: ['come with us', 'grab lunch', 'watch a movie'] }], examples: [{ en: 'Do you want to come with us?', zh: '你想不想和我们一起去？', level: 'basic' }, { en: 'Do you want to grab lunch after this?', zh: '弄完这个你想不想一起吃午饭？', level: 'intermediate' }, { en: 'Do you want to watch a movie this weekend?', zh: '你周末想不想看电影？', level: 'advanced' }] },
  { topic: '07 发出邀请与约时间', pattern: "Why don't we [verb]?", meaning: '我们不如……吧？', description: '提出建议时比 Let’s 更有一起商量的感觉。', slots: [{ name: 'verb', hint: '动词原形', examples: ['go now', 'split it', 'try somewhere else'] }], examples: [{ en: "Why don't we go now before it gets busy?", zh: '我们趁还没忙起来现在去怎么样？', level: 'basic' }, { en: "Why don't we split it?", zh: '我们平摊怎么样？', level: 'intermediate' }, { en: "Why don't we try somewhere else?", zh: '我们不如换个地方试试？', level: 'advanced' }] },
  { topic: '07 发出邀请与约时间', pattern: 'Are you free [time]?', meaning: '你……有空吗？', description: '先问时间，再邀请对方，显得更体贴。', slots: [{ name: 'time', hint: '具体时间', examples: ['tomorrow', 'this afternoon', 'after six'] }], examples: [{ en: 'Are you free tomorrow?', zh: '你明天有空吗？', level: 'basic' }, { en: 'Are you free this afternoon?', zh: '你今天下午有空吗？', level: 'intermediate' }, { en: 'Are you free after six?', zh: '你六点以后有空吗？', level: 'advanced' }] },

  { topic: '08 听不懂时怎么问', pattern: 'What do you mean by [word / that]?', meaning: '你说的……是什么意思？', description: '不懂词、说法或对方意思时直接确认。', slots: [{ name: 'word / that', hint: '一个词、短语或 that', examples: ['“flexible”', 'that', '“on the house”'] }], examples: [{ en: 'What do you mean by “flexible”?', zh: '你说 flexible 是什么意思？', level: 'basic' }, { en: 'What do you mean by that?', zh: '你这话是什么意思？', level: 'intermediate' }, { en: 'What do you mean by “on the house”?', zh: 'on the house 是什么意思？', level: 'advanced' }] },
  { topic: '08 听不懂时怎么问', pattern: "I'm not sure if [clause].", meaning: '我不太确定是否……。', description: '表达不确定，也可委婉地提出疑问。', slots: [{ name: 'clause', hint: '完整从句', examples: ['I heard you right', 'this is the right bus', 'we need a reservation'] }], examples: [{ en: "I'm not sure if I heard you right.", zh: '我不太确定是不是听对了。', level: 'basic' }, { en: "I'm not sure if this is the right bus.", zh: '我不太确定这是不是对的公交车。', level: 'intermediate' }, { en: "I'm not sure if we need a reservation.", zh: '我不太确定我们需不需要预约。', level: 'advanced' }] },
  { topic: '08 听不懂时怎么问', pattern: 'Could you say that again?', meaning: '你能再说一遍吗？', description: '最自然的请求重复，口语中非常实用。', slots: [], examples: [{ en: 'Sorry, could you say that again?', zh: '不好意思，你能再说一遍吗？', level: 'basic' }, { en: 'Could you say that again a little slower?', zh: '你能再说一遍，稍微慢一点吗？', level: 'intermediate' }, { en: "I didn't catch the last part. Could you say that again?", zh: '最后那部分我没听清，你能再说一遍吗？', level: 'advanced' }] },

  { topic: '09 表示同意与保留意见', pattern: 'I agree with [someone / that].', meaning: '我同意……。', description: '同意某人的看法，或同意一个具体观点。', slots: [{ name: 'someone / that', hint: '人名、代词或观点', examples: ['you', 'her', 'that idea'] }], examples: [{ en: 'I agree with you.', zh: '我同意你。', level: 'basic' }, { en: 'I agree with her on that.', zh: '关于这件事，我同意她的看法。', level: 'intermediate' }, { en: 'I agree with that idea, especially for beginners.', zh: '我同意那个想法，特别是对初学者来说。', level: 'advanced' }] },
  { topic: '09 表示同意与保留意见', pattern: 'I see what you mean, but [clause].', meaning: '我明白你的意思，不过……。', description: '先承接对方，再温和地表达不同看法。', slots: [{ name: 'clause', hint: '完整从句', examples: ["it's too expensive", "I'm still worried", "we need more time"] }], examples: [{ en: "I see what you mean, but it's a little expensive.", zh: '我明白你的意思，不过有点贵。', level: 'basic' }, { en: "I see what you mean, but I'm still worried about the timing.", zh: '我明白你的意思，不过我还是担心时间安排。', level: 'intermediate' }, { en: "I see what you mean, but we need more information first.", zh: '我明白你的意思，不过我们得先了解更多信息。', level: 'advanced' }] },
  { topic: '09 表示同意与保留意见', pattern: 'It depends on [noun].', meaning: '这取决于……。', description: '不想给绝对答案时很万能。', slots: [{ name: 'noun', hint: '条件、情况或对象', examples: ['the weather', 'your budget', 'what you need'] }], examples: [{ en: 'It depends on the weather.', zh: '这要看天气。', level: 'basic' }, { en: 'It depends on your budget.', zh: '这要看你的预算。', level: 'intermediate' }, { en: 'It depends on what you need it for.', zh: '这取决于你用它来做什么。', level: 'advanced' }] },

  { topic: '10 自然反应与共情', pattern: 'That sounds [adjective].', meaning: '听起来很……。', description: '回应对方消息时最通用的短句。', slots: [{ name: 'adjective', hint: '感受类形容词', examples: ['great', 'stressful', 'fun'] }], examples: [{ en: 'That sounds great!', zh: '听起来很棒！', level: 'basic' }, { en: 'That sounds stressful. Are you okay?', zh: '听起来压力很大。你还好吗？', level: 'intermediate' }, { en: 'That sounds like a lot of fun.', zh: '听起来会很好玩。', level: 'advanced' }] },
  { topic: '10 自然反应与共情', pattern: "I can't believe [clause].", meaning: '我真不敢相信……。', description: '表达惊讶，可用于好消息或意外情况。', slots: [{ name: 'clause', hint: '完整从句', examples: ['you got the job', 'it is already Friday', 'we made it'] }], examples: [{ en: "I can't believe you got the job!", zh: '我真不敢相信你拿到这份工作了！', level: 'basic' }, { en: "I can't believe it's already Friday.", zh: '我真不敢相信已经周五了。', level: 'intermediate' }, { en: "I can't believe we made it on time.", zh: '我真不敢相信我们居然准时赶到了。', level: 'advanced' }] },
  { topic: '10 自然反应与共情', pattern: "I'm glad [clause].", meaning: '我很高兴……。', description: '表达关心或对结果感到开心。', slots: [{ name: 'clause', hint: '完整从句', examples: ['you are okay', 'it worked out', 'we talked'] }], examples: [{ en: "I'm glad you're okay.", zh: '我很高兴你没事。', level: 'basic' }, { en: "I'm glad it worked out.", zh: '我很高兴事情解决了。', level: 'intermediate' }, { en: "I'm glad we finally got to talk.", zh: '我很高兴我们终于聊上了。', level: 'advanced' }] },

  { topic: '11 生活小故障', pattern: "Something's wrong with [thing].", meaning: '……出问题了。', description: '不知道具体故障原因时，先用它说明问题。', slots: [{ name: 'thing', hint: '设备、物品或服务', examples: ['my phone', 'the Wi-Fi', 'the air conditioner'] }], examples: [{ en: "Something's wrong with my phone.", zh: '我的手机出问题了。', level: 'basic' }, { en: "Something's wrong with the Wi-Fi.", zh: 'Wi-Fi 出问题了。', level: 'intermediate' }, { en: "I think something's wrong with the air conditioner.", zh: '我觉得空调可能出问题了。', level: 'advanced' }] },
  { topic: '11 生活小故障', pattern: "[Thing] isn't working.", meaning: '……不能用了 / 不工作。', description: '明确说某个设备或功能失效。', slots: [{ name: 'Thing', hint: '设备、功能或物品', examples: ['My card', 'The elevator', 'The link'] }], examples: [{ en: "My card isn't working.", zh: '我的卡刷不了了。', level: 'basic' }, { en: "The elevator isn't working today.", zh: '今天电梯坏了。', level: 'intermediate' }, { en: "The link isn't working on my phone.", zh: '这个链接在我手机上打不开。', level: 'advanced' }] },
  { topic: '11 生活小故障', pattern: "I can't find [thing].", meaning: '我找不到……。', description: '找不到物品、地点或信息时的基础句。', slots: [{ name: 'thing', hint: '物品、地点或信息', examples: ['my keys', 'the station', 'the confirmation email'] }], examples: [{ en: "I can't find my keys.", zh: '我找不到钥匙了。', level: 'basic' }, { en: "I can't find the station on the map.", zh: '我在地图上找不到车站。', level: 'intermediate' }, { en: "I can't find the confirmation email.", zh: '我找不到确认邮件。', level: 'advanced' }] },

  { topic: '12 工作学习进度', pattern: "I'm working on [noun].", meaning: '我正在做……。', description: '说明正在推进的工作、任务或个人项目。', slots: [{ name: 'noun', hint: '项目、作业或任务', examples: ['a report', 'my presentation', 'a side project'] }], examples: [{ en: "I'm working on a report right now.", zh: '我现在在写一份报告。', level: 'basic' }, { en: "I'm working on my presentation for Monday.", zh: '我在准备周一的演讲。', level: 'intermediate' }, { en: "I've been working on a small side project.", zh: '我最近一直在做一个小的个人项目。', level: 'advanced' }] },
  { topic: '12 工作学习进度', pattern: "I'm having trouble [V-ing].", meaning: '我在……上有困难。', description: '说清具体卡在哪里，便于向人求助。', slots: [{ name: 'V-ing', hint: '动名词', examples: ['logging in', 'understanding this', 'staying focused'] }], examples: [{ en: "I'm having trouble logging in.", zh: '我登录不上去。', level: 'basic' }, { en: "I'm having trouble understanding this part.", zh: '我不太理解这部分。', level: 'intermediate' }, { en: "I'm having trouble staying focused today.", zh: '我今天很难集中注意力。', level: 'advanced' }] },
  { topic: '12 工作学习进度', pattern: "I'm supposed to [verb].", meaning: '我应该…… / 按理我得……。', description: '用于职责、安排或别人交代的事。', slots: [{ name: 'verb', hint: '动词原形', examples: ['send it today', 'meet them at two', 'bring my ID'] }], examples: [{ en: "I'm supposed to send it today.", zh: '我本来应该今天发出去。', level: 'basic' }, { en: "I'm supposed to meet them at two.", zh: '我约好两点见他们。', level: 'intermediate' }, { en: "Am I supposed to bring my ID?", zh: '我需要带身份证件吗？', level: 'advanced' }] },
  { topic: '12 工作学习进度', pattern: "I'm done with [noun].", meaning: '我做完……了 / 我不再弄……了。', description: '最常用于说明一项任务已完成。', slots: [{ name: 'noun', hint: '任务、物品或事情', examples: ['my homework', 'the report', 'work for today'] }], examples: [{ en: "I'm done with my homework.", zh: '我作业做完了。', level: 'basic' }, { en: "I'm done with the report.", zh: '我报告写完了。', level: 'intermediate' }, { en: "I'm done with work for today.", zh: '我今天的工作做完了。', level: 'advanced' }] },

  { topic: '13 聊过去经历', pattern: 'I used to [verb].', meaning: '我以前常常……。', description: '说过去的习惯或状态，现在通常已经不同。', slots: [{ name: 'verb', hint: '动词原形', examples: ['live here', 'play basketball', 'drink coffee'] }], examples: [{ en: 'I used to live here.', zh: '我以前住在这里。', level: 'basic' }, { en: 'I used to play basketball every weekend.', zh: '我以前每个周末都打篮球。', level: 'intermediate' }, { en: "I used to drink coffee, but now I mostly drink tea.", zh: '我以前喝咖啡，不过现在主要喝茶。', level: 'advanced' }] },
  { topic: '13 聊过去经历', pattern: "I've just [past participle].", meaning: '我刚刚……。', description: '刚完成某事时的自然表达，英式英语更常用。', slots: [{ name: 'past participle', hint: '过去分词', examples: ['arrived', 'finished lunch', 'sent it'] }], examples: [{ en: "I've just arrived.", zh: '我刚到。', level: 'basic' }, { en: "I've just finished lunch.", zh: '我刚吃完午饭。', level: 'intermediate' }, { en: "I've just sent you the file.", zh: '我刚把文件发给你了。', level: 'advanced' }] },
  { topic: '13 聊过去经历', pattern: "I've never [past participle].", meaning: '我从来没有……过。', description: '谈到从未有过的体验时使用。', slots: [{ name: 'past participle', hint: '过去分词', examples: ['tried skiing', 'been there', 'seen snow'] }], examples: [{ en: "I've never tried skiing.", zh: '我从来没滑过雪。', level: 'basic' }, { en: "I've never been there before.", zh: '我以前从没去过那里。', level: 'intermediate' }, { en: "I've never seen snow in real life.", zh: '我从没在现实中见过雪。', level: 'advanced' }] },

  { topic: '14 期待与不确定的未来', pattern: "I'm looking forward to [noun / V-ing].", meaning: '我很期待……。', description: '用于期待未来的活动或见面，语气积极自然。', slots: [{ name: 'noun / V-ing', hint: '活动、事情或动名词', examples: ['the weekend', 'seeing you', 'my trip'] }], examples: [{ en: "I'm looking forward to the weekend.", zh: '我很期待周末。', level: 'basic' }, { en: "I'm looking forward to seeing you.", zh: '我很期待见到你。', level: 'intermediate' }, { en: "I'm really looking forward to my trip next month.", zh: '我非常期待下个月的旅行。', level: 'advanced' }] },
  { topic: '14 期待与不确定的未来', pattern: "I can't wait to [verb].", meaning: '我迫不及待想……。', description: '比 looking forward to 更兴奋、更有即时感。', slots: [{ name: 'verb', hint: '动词原形', examples: ['go home', 'try it', 'see everyone'] }], examples: [{ en: "I can't wait to go home.", zh: '我迫不及待想回家。', level: 'basic' }, { en: "I can't wait to try it.", zh: '我迫不及待想试试。', level: 'intermediate' }, { en: "I can't wait to see everyone again.", zh: '我迫不及待想再见到大家。', level: 'advanced' }] },
  { topic: '14 期待与不确定的未来', pattern: "I'll probably [verb].", meaning: '我大概会……。', description: '对未来给出大概率但不绝对的回答。', slots: [{ name: 'verb', hint: '动词原形', examples: ['stay home', 'take a taxi', 'go later'] }], examples: [{ en: "I'll probably stay home tonight.", zh: '我今晚大概会待在家。', level: 'basic' }, { en: "I'll probably take a taxi there.", zh: '我大概会打车去那里。', level: 'intermediate' }, { en: "I'll probably go later if I finish early.", zh: '如果我早点做完，大概会晚点过去。', level: 'advanced' }] },
  { topic: '14 期待与不确定的未来', pattern: 'I might [verb].', meaning: '我可能会……。', description: '比 probably 更不确定，适合还没决定的事。', slots: [{ name: 'verb', hint: '动词原形', examples: ['join you', 'be late', 'change my mind'] }], examples: [{ en: 'I might join you later.', zh: '我可能晚点来找你们。', level: 'basic' }, { en: 'I might be a little late.', zh: '我可能会稍微迟到。', level: 'intermediate' }, { en: 'I might change my mind after I sleep on it.', zh: '我想一晚上后可能会改变主意。', level: 'advanced' }] },

  { topic: '15 给建议与找解决办法', pattern: 'You should [verb].', meaning: '你应该……。', description: '给直接、善意的建议；对陌生人可适当软化语气。', slots: [{ name: 'verb', hint: '动词原形', examples: ['get some rest', 'ask them', 'back up your files'] }], examples: [{ en: 'You should get some rest.', zh: '你应该休息一下。', level: 'basic' }, { en: 'You should ask them before you decide.', zh: '你决定前应该先问问他们。', level: 'intermediate' }, { en: 'You should back up your files just in case.', zh: '你最好备份一下文件，以防万一。', level: 'advanced' }] },
  { topic: '15 给建议与找解决办法', pattern: 'How about [V-ing]?', meaning: '……怎么样？', description: '委婉提建议，尤其适合一起讨论方案。', slots: [{ name: 'V-ing', hint: '动名词', examples: ['taking a break', 'calling them', 'trying again later'] }], examples: [{ en: 'How about taking a break?', zh: '休息一下怎么样？', level: 'basic' }, { en: 'How about calling them first?', zh: '先给他们打个电话怎么样？', level: 'intermediate' }, { en: 'How about trying again later?', zh: '我们晚点再试一次怎么样？', level: 'advanced' }] },
  { topic: '15 给建议与找解决办法', pattern: 'If I were you, I would [verb].', meaning: '如果我是你，我会……。', description: '基于对方处境给个人建议。', slots: [{ name: 'verb', hint: '动词原形', examples: ['wait a day', 'talk to her', 'keep it simple'] }], examples: [{ en: 'If I were you, I would wait a day.', zh: '如果我是你，我会等一天。', level: 'basic' }, { en: 'If I were you, I would talk to her first.', zh: '如果我是你，我会先和她谈谈。', level: 'intermediate' }, { en: 'If I were you, I would keep it simple.', zh: '如果我是你，我会把事情简单化。', level: 'advanced' }] },
  { topic: '15 给建议与找解决办法', pattern: 'Is there a way to [verb]?', meaning: '有没有办法……？', description: '向人求解决方案，适用于服务、设备和日常问题。', slots: [{ name: 'verb', hint: '动词原形', examples: ['change it', 'pay online', 'fix this'] }], examples: [{ en: 'Is there a way to change it?', zh: '有没有办法改一下？', level: 'basic' }, { en: 'Is there a way to pay online?', zh: '有没有办法在线支付？', level: 'intermediate' }, { en: 'Is there a way to fix this without starting over?', zh: '有没有办法修好这个，不用从头再来？', level: 'advanced' }] },
]

async function main() {
  const prisma = new PrismaClient()
  try {
    if (FORMULAS.length !== 50) throw new Error(`Expected 50 formulas, found ${FORMULAS.length}`)

    const category = await prisma.sceneCategory.findFirst({ where: { name: CATEGORY_NAME } })
      ?? await prisma.sceneCategory.create({ data: { name: CATEGORY_NAME, icon: 'BookOpenCheck', sortOrder: 22 } })

    const scene = await prisma.scene.findFirst({
      where: { categoryId: category.id, title: PACKAGE_TITLE },
    }) ?? await prisma.scene.create({
      data: {
        categoryId: category.id,
        packageType: 'foundation',
        contentMode: 'practice',
        title: PACKAGE_TITLE,
        location: '日常生活与轻松聊天',
        description: '从 220 条原始公式中筛选出的 50 个高频口语骨架。按 15 个真实话题练习，每个句式附 3 条自然例句，可直接替换词槽开口说。',
        requiredOutputLevel: 'L1',
        requiredUserLevel: 1,
        isFree: true,
      },
    })

    const patternIds = new Map<string, string>()
    for (const item of FORMULAS) {
      const pattern = await prisma.sentencePattern.upsert({
        where: { pattern: item.pattern },
        create: {
          pattern: item.pattern,
          meaning: item.meaning,
          category: PATTERN_CATEGORY,
          description: item.description,
          slots: item.slots,
          examples: item.examples,
          difficulty: 'L1',
        },
        update: {
          meaning: item.meaning,
          category: PATTERN_CATEGORY,
          description: item.description,
          slots: item.slots,
          examples: item.examples,
          difficulty: 'L1',
        },
      })
      patternIds.set(item.pattern, pattern.id)
    }

    // This scene owns the 50 patterns. Rebuild its visible pattern table on every run.
    await prisma.sceneSentencePattern.deleteMany({ where: { sceneId: scene.id } })
    await prisma.sceneSentencePattern.createMany({
      data: FORMULAS.map((item, sortOrder) => ({
        sceneId: scene.id,
        patternId: patternIds.get(item.pattern)!,
        sortOrder,
      })),
    })
    await prisma.sceneMaterialReference.createMany({
      data: FORMULAS.map((item) => ({
        sceneId: scene.id,
        materialType: 'pattern' as const,
        materialId: patternIds.get(item.pattern)!,
        role: 'learn' as const,
      })),
      skipDuplicates: true,
    })

    for (const [sortOrder, topicDef] of TOPICS.entries()) {
      const topic = await prisma.trainingTopic.findFirst({
        where: { sceneId: scene.id, title: topicDef.title },
      })
      const topicData = {
        type: 'daily' as const,
        activityType: 'practice' as const,
        title: topicDef.title,
        description: topicDef.description,
        knowledgePoints: topicDef.knowledgePoints,
        teachingMarkdown: `## 练习目标\n\n${topicDef.description}\n\n先用 1 个句式说真实信息，再用同一句式换一个生活话题重说一次。例句仅作参考，优先说你自己的内容。`,
        promptEn: topicDef.promptEn,
        promptZh: topicDef.promptZh,
        suggestedDurationSec: topicDef.duration,
        difficulty: 'L1',
        metadata: { source: 'spoken-sentence-formulas-50', topic: topicDef.title, practiceMode: 'pattern-substitution' },
        sortOrder,
      }
      const savedTopic = topic
        ? await prisma.trainingTopic.update({ where: { id: topic.id }, data: topicData })
        : await prisma.trainingTopic.create({ data: { sceneId: scene.id, ...topicData } })

      const topicPatterns = FORMULAS.filter((item) => item.topic === topicDef.title)
      await prisma.trainingTopicSentencePattern.deleteMany({ where: { topicId: savedTopic.id } })
      await prisma.trainingTopicSentencePattern.createMany({
        data: topicPatterns.map((item, patternOrder) => ({
          topicId: savedTopic.id,
          patternId: patternIds.get(item.pattern)!,
          sortOrder: patternOrder,
        })),
      })
    }

    await prisma.learningPackage.upsert({
      where: { sceneId_version: { sceneId: scene.id, version: 1 } },
      create: {
        sceneId: scene.id,
        version: 1,
        title: `${PACKAGE_TITLE} v1`,
        type: 'foundation',
        status: 'draft',
        manifestSnapshot: { source: '万能造句公式(220个).docx', selectedFormulaCount: FORMULAS.length, topicCount: TOPICS.length, register: 'spoken' },
        buildLog: 'Seeded directly from the spoken-sentence-formulas script. Content is ready for editorial polishing before package ZIP publishing.',
      },
      update: {
        title: `${PACKAGE_TITLE} v1`,
        type: 'foundation',
        manifestSnapshot: { source: '万能造句公式(220个).docx', selectedFormulaCount: FORMULAS.length, topicCount: TOPICS.length, register: 'spoken' },
        buildLog: 'Refreshed directly from the spoken-sentence-formulas script. Content is ready for editorial polishing before package ZIP publishing.',
      },
    })

    console.log(`✅ ${PACKAGE_TITLE}`)
    console.log(`   ${TOPICS.length} 个话题 · ${FORMULAS.length} 个口语句式 · ${FORMULAS.length * 3} 条例句`)
    console.log(`   sceneId: ${scene.id}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
