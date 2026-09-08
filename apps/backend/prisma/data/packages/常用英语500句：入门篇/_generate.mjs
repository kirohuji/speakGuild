/**
 * 一次性生成入门篇 CSV / MD / warmup_pipeline.json
 * 运行：node _generate.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCENE = '常用英语500句 · 入门篇'
const OUT = __dirname

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvLine(cols) {
  return cols.map(csvEscape).join(',')
}

function examplesJson(examples) {
  return JSON.stringify(examples.map((e) => ({ en: e.en, zh: e.zh, level: e.level || 'basic' })))
}

/**
 * @typedef {{ text: string, meaning: string, insight: string, active?: boolean, examples: {en:string,zh:string}[], vocabs?: string[], pattern?: string }} Expr
 * @typedef {{ title: string, promptEn: string, promptZh: string, description: string, knowledgePoints: string, duration: number, goal: string, tip: string, expressions: Expr[], patterns: {pattern:string,meaning:string,slots:string,example:string}[], vocabs: string[] }} Topic
 */

/** @type {Topic[]} */
const topics = [
  {
    title: '问候、告别与自我介绍',
    promptEn: 'Open a chat, keep small talk moving, and close naturally.',
    promptZh: '自然开场、接话和告别。',
    description: '对齐原版「问候与寒暄」：熟人开场、话题接续与自然收尾。',
    knowledgePoints: '寒暄开场；告别；话题接续；会话收尾',
    duration: 900,
    goal: '学习者能用原版高频寒暄短句开场、接话并自然告别。',
    tip: '',
    docIntro: '这一课直接对齐原版「问候与寒暄」里的常用短句：怎么打招呼、怎么接话、怎么收尾。太基础的 Hi / Hello / My name is 不再单列。',
    patterns: [],
    vocabs: [
      'later', 'touch', 'care', 'deal', 'story', 'home', 'aboard', 'forget',
      'going', 'lovely', 'case', 'back', 'station', 'rain',
    ],
    expressions: [
      {
        text: "What's up?",
        meaning: '你好 / 怎么啦？（打招呼）',
        insight: '原版短句。熟人间轻松开场；对方通常简短回应近况，不适合正式初次见面。',
        active: true,
        examples: [
          { en: "Hey! What's up?", zh: '嘿！最近怎么样？' },
          { en: "You look worried. What's up?", zh: '你看起来有心事。怎么了？' },
        ],
      },
      {
        text: "How's it going?",
        meaning: '最近怎么样',
        insight: '原版短句。问近况的随意说法；适合熟人，回答简短即可。',
        active: true,
        examples: [
          { en: "Hi, Emma. How's it going?", zh: '嗨，Emma。最近怎么样？' },
          { en: "How's it going at work?", zh: '工作还顺利吗？' },
        ],
      },
      {
        text: 'How have you been?',
        meaning: '最近怎么样（久别）',
        insight: '原版短句。关心一段时间以来的状态；比 How are you? 更适合久别重逢。',
        active: true,
        examples: [
          { en: "It's been ages! How have you been?", zh: '好久不见！你最近怎么样？' },
          { en: 'How have you been since the move?', zh: '搬家之后最近怎么样？' },
        ],
      },
      {
        text: 'Not bad.',
        meaning: '还不错 / 还行',
        insight: '原版短句。回答近况时很自然，语气轻松。',
        active: true,
        examples: [
          { en: "How's it going? — Not bad.", zh: '最近怎么样？——还行。' },
          { en: 'How was your day? — Not bad, actually.', zh: '今天怎么样？——其实还不错。' },
        ],
      },
      {
        text: 'See you later.',
        meaning: '待会见',
        insight: '原版短句。自然告别，默认还会再见；比 Goodbye 更轻。',
        active: true,
        examples: [
          { en: "I'm heading out. See you later.", zh: '我先走了。待会见。' },
          { en: "I'll call you tomorrow. See you later.", zh: '我明天给你电话。待会见。' },
        ],
      },
      {
        text: "I'll see you then.",
        meaning: '到时候见',
        insight: '原版短句。确认未来某个已约定的时间或地点；then 指双方都知道的安排。',
        active: true,
        examples: [
          { en: "Let's meet outside the station at six. I'll see you then.", zh: '六点车站外见。到时候见。' },
          { en: 'Saturday works. See you then.', zh: '周六可以。到时候见。' },
        ],
      },
      {
        text: 'Take care.',
        meaning: '保重',
        insight: '原版短句。告别时表达关心；对方赶路、身体不适时特别合适。',
        active: true,
        examples: [
          { en: "You're driving home in the rain? Take care.", zh: '你下雨天开车回家？路上小心。' },
          { en: 'Good night. Take care.', zh: '晚安。保重。' },
        ],
      },
      {
        text: 'Keep in touch.',
        meaning: '保持联系',
        insight: '原版短句。分别后仍希望联系；适合朋友、同事或刚认识的人。',
        active: true,
        examples: [
          { en: 'It was lovely meeting you. Keep in touch.', zh: '很高兴认识你。保持联系。' },
          { en: "I'm moving next month, but let's keep in touch.", zh: '我下个月搬家，不过我们保持联系。' },
        ],
      },
      {
        text: "I'll be right back.",
        meaning: '我马上回来',
        insight: '原版短句。暂时离开但会回来；让对方知道不用结束等待。',
        active: false,
        examples: [
          { en: "Please save my seat. I'll be right back.", zh: '请帮我占一下座位。我马上回来。' },
          { en: "I'll be right back—just grabbing water.", zh: '我马上回来——去拿点水。' },
        ],
      },
      {
        text: 'Speaking of which.',
        meaning: '话说到这',
        insight: '原版短句。把当前话题接到刚提到的内容上，避免突然转题。',
        active: false,
        examples: [
          { en: 'I tried that café yesterday. Speaking of which, have you eaten?', zh: '我昨天去了那家咖啡馆。话说，你吃过了吗？' },
          { en: "She's in Shanghai now. Speaking of which, are you free this weekend?", zh: '她现在在上海。对了，你这周末有空吗？' },
        ],
      },
      {
        text: "Here's the deal.",
        meaning: '这样吧',
        insight: '原版短句。用来提出方案或说明接下来的安排；后面通常要补具体内容。',
        active: false,
        examples: [
          { en: "We only have ten minutes. Here's the deal: you call, and I'll email.", zh: '我们只剩十分钟。这样吧：你打电话，我发邮件。' },
          { en: "Here's the deal. We split the bill.", zh: '这样吧。我们AA。' },
        ],
      },
      {
        text: 'In that case.',
        meaning: '这样的话',
        insight: '原版短句。根据前面的条件推出下一步，常用于回应别人的信息。',
        active: false,
        examples: [
          { en: "The train is cancelled. In that case, let's take a taxi.", zh: '火车取消了。这样的话，我们打车吧。' },
          { en: "You're free after six? In that case, dinner works.", zh: '你六点后有空？这样的话，吃晚饭可以。' },
        ],
      },
      {
        text: 'Long story.',
        meaning: '说来话长',
        insight: '原版短句。表示事情太长，当前不打算细说；语气可以轻松，也可能带无奈。',
        active: false,
        examples: [
          { en: 'Why did I leave my job? Long story.', zh: '我为什么离职？说来话长。' },
          { en: "Don't ask. Long story.", zh: '别问了。说来话长。' },
        ],
      },
      {
        text: 'One more thing.',
        meaning: '还有一件事',
        insight: '原版短句。补充遗漏的信息；说完后通常紧接具体补充。',
        active: true,
        examples: [
          { en: 'One more thing: the meeting starts at nine, not ten.', zh: '还有一件事：会议九点开始，不是十点。' },
          { en: 'Thanks. Oh—one more thing.', zh: '谢谢。哦——还有一件事。' },
        ],
      },
      {
        text: 'Before I forget.',
        meaning: '趁我还记得',
        insight: '原版短句。担心忘记而提前插入一件事；是礼貌的打断方式。',
        active: false,
        examples: [
          { en: 'Before I forget, could you send me the address?', zh: '趁我还记得，你能把地址发给我吗？' },
          { en: 'Before I forget—happy birthday!', zh: '趁我还记得——生日快乐！' },
        ],
      },
      {
        text: "That'll be all.",
        meaning: '就这样吧 / 没有别的了',
        insight: '原版短句。表示事情到此结束；常用于点单、付款或结束说明。和点餐课的 That\'s all. 接近，但更完整。',
        active: false,
        examples: [
          { en: 'Would you like anything else? — No, that\'ll be all.', zh: '还要别的吗？——不用，就这些。' },
          { en: "That's everything from me. That'll be all.", zh: '我这边就这些。没有别的了。' },
        ],
      },
      {
        text: 'Welcome aboard.',
        meaning: '欢迎加入',
        insight: '原版短句。欢迎新成员加入团队、交通工具或组织；aboard 带有“上来/加入”的感觉。',
        active: false,
        examples: [
          { en: 'Welcome aboard. Your seat is just over there.', zh: '欢迎登机。你的座位就在那边。' },
          { en: 'Welcome aboard the team!', zh: '欢迎加入团队！' },
        ],
      },
      {
        text: 'Off we go.',
        meaning: '我们出发',
        insight: '原版短句。大家准备出发时的集体口语；不是逐词理解为“离开”。',
        active: false,
        examples: [
          { en: 'Everyone has their bags? Off we go.', zh: '大家都带好包了吗？我们出发。' },
          { en: 'Ready? Off we go!', zh: '好了吗？走吧！' },
        ],
      },
      {
        text: 'Make yourself at home.',
        meaning: '别拘束 / 当自己家一样',
        insight: '原版短句。请客人自在一些；通常用于家中或私人空间。',
        active: false,
        examples: [
          { en: 'Please take a seat and make yourself at home.', zh: '请坐，别拘束。' },
          { en: 'Come in! Make yourself at home.', zh: '进来！当自己家一样。' },
        ],
      },
      {
        text: "A lovely day, isn't it?",
        meaning: '好天气，是吗？',
        insight: '原版短句。用天气开启轻松对话；反意问句是在邀请回应，不是真的索取天气信息。',
        active: false,
        examples: [
          { en: "A lovely day, isn't it? — Yes, perfect for a walk.", zh: '天气真好，是吧？——是啊，很适合散步。' },
          { en: "Nice weather today, isn't it?", zh: '今天天气不错，是吧？' },
        ],
      },
    ],
  },
  {
    title: '感谢、简单道歉与回应',
    promptEn: 'Thank someone, apologize for a small mistake, and respond naturally.',
    promptZh: '表达感谢、为小失误道歉，并自然回应对方。',
    description: '把感谢说完整，把道歉说清楚，并把回应落到对关系有帮助的地方。',
    knowledgePoints: '感谢；道歉；回应；礼貌打断',
    duration: 900,
    goal: '学习者能在帮助、小碰撞、打扰他人时，用短句完成感谢、道歉和回应。',
    tip: 'Thank you 比 Thanks 稍正式；You\'re welcome / No problem 都可回感谢。Excuse me 既可引起注意，也可表示借过。',
    docIntro: '别人帮了你、你不小心碰到人、或者想礼貌打断对方时，用哪几句最稳？这里把感谢、道歉和常见回应都摆在一起，方便你对照着用。',
    patterns: [],
    vocabs: [
      'thank', 'thanks', 'sorry', 'welcome', 'problem', 'excuse', 'please', 'sure',
      'fault', 'interrupt', 'luck', 'fun', 'okay', 'worries',
    ],
    expressions: [
      {
        text: 'Thank you.',
        meaning: '谢谢你',
        insight: '最稳妥的感谢；可单独说，也可加 so much / for your help。',
        active: true,
        examples: [
          { en: 'Thank you. That helps a lot.', zh: '谢谢你。这帮大忙了。' },
          { en: 'Here is your bag. — Thank you.', zh: '这是你的包。——谢谢。' },
        ],
      },
      {
        text: 'Thanks.',
        meaning: '谢谢',
        insight: 'Thank you 的口语短式，朋友之间更自然。',
        active: true,
        examples: [
          { en: 'I got you some water. — Thanks!', zh: '我给你拿了点水。——谢谢！' },
          { en: 'Thanks for waiting.', zh: '谢谢你等我。' },
        ],
      },
      {
        text: 'Thank you so much.',
        meaning: '太谢谢你了',
        insight: '感谢程度更强，用于对方帮了明显的忙。',
        active: true,
        examples: [
          { en: 'Thank you so much for picking me up.', zh: '太谢谢你来接我了。' },
          { en: 'You found my phone? Thank you so much!', zh: '你找到我的手机了？太谢谢了！' },
        ],
      },
      {
        text: 'Thanks a lot.',
        meaning: '多谢了',
        insight: '口语里常表真心感谢；注意语气，讽刺时也可表示不满，入门先按正面感谢用。',
        active: false,
        examples: [
          { en: 'Thanks a lot for your time.', zh: '多谢你抽时间。' },
          { en: 'You fixed it? Thanks a lot!', zh: '你修好了？多谢！' },
        ],
      },
      {
        text: "You're welcome.",
        meaning: '不客气',
        insight: '回应感谢的经典句；服务场景和正式一点的对话都适用。',
        active: true,
        examples: [
          { en: 'Thank you. — You\'re welcome.', zh: '谢谢。——不客气。' },
          { en: "You're welcome. Anytime.", zh: '不客气。随时找我。' },
        ],
      },
      {
        text: 'No problem.',
        meaning: '没事 / 没问题',
        insight: '回应感谢或小请求都很常见，语气轻松。',
        active: true,
        examples: [
          { en: 'Thanks for the ride. — No problem.', zh: '谢谢你载我一程。——没事。' },
          { en: 'Can you open the door? — No problem.', zh: '能帮我开下门吗？——没问题。' },
        ],
      },
      {
        text: 'Good luck.',
        meaning: '祝你好运',
        insight: '原版短句。对方要考试、面试、出发前都可以说。',
        active: false,
        examples: [
          { en: 'I have an interview tomorrow. — Good luck!', zh: '我明天面试。——祝你好运！' },
          { en: 'Good luck on your test.', zh: '祝你考试顺利。' },
        ],
      },
      {
        text: 'Have fun.',
        meaning: '玩得开心',
        insight: '原版短句。对方要出门玩或度假时说。',
        active: false,
        examples: [
          { en: "We're going to the park. — Have fun!", zh: '我们要去公园。——玩得开心！' },
          { en: 'Have fun at the party.', zh: '聚会计玩得开心。' },
        ],
      },
      {
        text: 'My fault.',
        meaning: '我的错',
        insight: '原版短句。快速认错，常接 I\'m sorry.',
        active: true,
        examples: [
          { en: 'My fault. I sent the wrong file.', zh: '我的错。我发错文件了。' },
          { en: 'Was that you? — Yeah. My fault.', zh: '是你吗？——对。我的错。' },
        ],
      },
      {
        text: 'Sorry to interrupt.',
        meaning: '抱歉打扰了',
        insight: '原版短句。打断别人说话或插话前先说这句。',
        active: false,
        examples: [
          { en: 'Sorry to interrupt. Can I ask one thing?', zh: '抱歉打断一下。我能问一件事吗？' },
          { en: 'Sorry to interrupt, but your bag is open.', zh: '抱歉打扰，你的包开了。' },
        ],
      },
      {
        text: 'Excuse me.',
        meaning: '劳驾 / 借过 / 抱歉打扰',
        insight: '引起注意、借过、礼貌打断都可以；比 Hey 更礼貌。求助开场也常用。',
        active: true,
        examples: [
          { en: 'Excuse me, is this seat free?', zh: '打扰一下，这个座位有人吗？' },
          { en: 'Excuse me. Coming through.', zh: '借过一下。' },
        ],
      },
      {
        text: 'Sorry.',
        meaning: '抱歉 / 对不起',
        insight: '最短道歉；也可用于没听清时请对方再说一遍。',
        active: true,
        examples: [
          { en: 'Sorry. I stepped on your bag.', zh: '抱歉。我踩到你的包了。' },
          { en: 'Sorry? I didn\'t catch that.', zh: '抱歉？我没听清。' },
        ],
      },
      {
        text: "I'm sorry.",
        meaning: '对不起',
        insight: '比单独 Sorry 稍完整，适合明确承认自己的失误。',
        active: true,
        examples: [
          { en: "I'm sorry I'm late.", zh: '对不起，我迟到了。' },
          { en: "I'm sorry about the mess.", zh: '抱歉弄乱了。' },
        ],
      },
      {
        text: "I'm sorry about that.",
        meaning: '那件事我很抱歉',
        insight: '对具体情况道歉；不必展开长解释，先表态再补一句即可。',
        active: false,
        examples: [
          { en: "The order is wrong. I'm sorry about that.", zh: '订单错了。对此我很抱歉。' },
          { en: "I'm sorry about that. Let me fix it.", zh: '抱歉。我来改一下。' },
        ],
      },
      {
        text: "That's okay.",
        meaning: '没关系',
        insight: '接受道歉、让对方放心；语气要真诚，别听起来不耐烦。',
        active: true,
        examples: [
          { en: "I'm sorry. — That's okay.", zh: '对不起。——没关系。' },
          { en: "That's okay. Don't worry.", zh: '没关系。别担心。' },
        ],
      },
      {
        text: "It's fine.",
        meaning: '没事的',
        insight: '和 That\'s okay 接近，安抚对方小失误。',
        active: false,
        examples: [
          { en: 'Did I take your seat? — It\'s fine.', zh: '我坐了你的位子吗？——没事。' },
          { en: "It's fine. Accidents happen.", zh: '没事。难免的。' },
        ],
      },
      {
        text: "Don't worry about it.",
        meaning: '别放在心上',
        insight: '明确告诉对方这件事不用再纠结。',
        active: false,
        examples: [
          { en: "I'm so sorry. — Don't worry about it.", zh: '真的对不起。——别放在心上。' },
          { en: "Don't worry about it. I can wait.", zh: '别担心。我可以等。' },
        ],
      },
      {
        text: 'No worries.',
        meaning: '没事 / 别担心',
        insight: '轻松回应感谢或道歉；偏口语，熟人场景很自然。',
        active: false,
        examples: [
          { en: 'Thanks for waiting. — No worries.', zh: '谢谢你等我。——没事。' },
          { en: 'Sorry I forgot. — No worries.', zh: '抱歉我忘了。——没事。' },
        ],
      },
      {
        text: 'After you.',
        meaning: '你先请',
        insight: '让对方先走、先上车、先进门时的礼貌短句。',
        active: false,
        examples: [
          { en: 'After you. Please go first.', zh: '你先请。请先走。' },
          { en: 'The door is open. After you.', zh: '门开着。你先请。' },
        ],
      },
      {
        text: 'Thank you for your help.',
        meaning: '谢谢你的帮助',
        insight: '把感谢对象说清楚；对方帮完忙后用这句收尾很完整。',
        active: false,
        examples: [
          { en: 'Thank you for your help today.', zh: '谢谢你今天的帮助。' },
          { en: 'I found the office. Thank you for your help.', zh: '我找到办公室了。谢谢你的帮助。' },
        ],
      },
    ],
  },
  {
    title: '点餐、数量与付款',
    promptEn: 'Order food or drinks, talk about quantity, and ask for the check.',
    promptZh: '点餐或点饮料，说明数量和偏好，并请人买单。',
    description: '在咖啡店或餐厅用短句点单、确认数量与偏好，并请结账。',
    knowledgePoints: '点餐；堂食外带；数量规格；买单',
    duration: 900,
    goal: '学习者能独立完成一次简单点单，并请对方结账。',
    tip: '',
    docIntro: '柜台点单时，最常说的就是「我想要…」「外带还是堂食」「就这些」「买单」。刷卡、现金这些付钱细节，放在下一课「找商品、问价格与结账」里。',
    patterns: [],
    vocabs: [
      'order', 'menu', 'coffee', 'water', 'check', 'size', 'spicy', 'ice',
      'takeout', 'change', 'sugar', 'table', 'sandwich', 'glass',
    ],
    expressions: [
      {
        text: "I'd like a coffee, please.",
        meaning: '我想要一杯咖啡',
        insight: '点餐礼貌完整句。本系列点单场景优先用 I\'d like...；比 I want 更得体。',
        active: true,
        examples: [
          { en: "Good morning. I'd like a coffee, please.", zh: '早上好。我想要一杯咖啡。' },
          { en: "I'd like the chicken sandwich.", zh: '我想要鸡肉三明治。' },
        ],
      },
      {
        text: 'Can I have a glass of water?',
        meaning: '可以给我一杯水吗？',
        insight: '点单、加水时的完整礼貌句；换菜单可以说 Can I have the menu, please?',
        active: true,
        examples: [
          { en: "It's hot today. Can I have a glass of water?", zh: '今天好热。可以给我一杯水吗？' },
          { en: 'Can I have the menu, please?', zh: '可以给我菜单吗？' },
        ],
      },
      {
        text: 'A coffee, please.',
        meaning: '请来杯咖啡',
        insight: '「名词 + please」是最短点单模板：A tea, please. / Two waters, please. 都同一套。',
        active: true,
        examples: [
          { en: 'What can I get you? — A coffee, please.', zh: '您要点什么？——请来杯咖啡。' },
          { en: 'Two iced teas, please.', zh: '请来两杯冰茶。' },
        ],
      },
      {
        text: 'For here or to go?',
        meaning: '在这里用还是外带？',
        insight: '店员常问。你只要会答：To go, please. / For here, please. 即可。',
        active: true,
        examples: [
          { en: 'For here or to go? — To go, please.', zh: '堂食还是外带？——外带，谢谢。' },
          { en: 'For here or to go? — For here, please.', zh: '堂食还是外带？——堂食，谢谢。' },
        ],
      },
      {
        text: 'To go, please.',
        meaning: '外带，谢谢',
        insight: '外带标准回答；也可说 Takeout, please。堂食用 For here, please。',
        active: true,
        examples: [
          { en: "To go, please. I'm in a hurry.", zh: '外带，谢谢。我赶时间。' },
          { en: 'One burger to go, please.', zh: '一个汉堡外带，谢谢。' },
        ],
      },
      {
        text: 'Anything else?',
        meaning: '还要别的吗？',
        insight: '原版高频短句，店员点完后常问。听懂后用 That\'s all. 或再加一样东西。',
        active: true,
        examples: [
          { en: 'Anything else? — That\'s all. Thanks.', zh: '还要别的吗？——就这些，谢谢。' },
          { en: 'Anything else to drink?', zh: '还要喝点什么吗？' },
        ],
      },
      {
        text: "That's all.",
        meaning: '就这些',
        insight: '回答 Anything else? 时表示不再加单。',
        active: true,
        examples: [
          { en: "Anything else? — That's all.", zh: '还要别的吗？——就这些。' },
          { en: "One tea and a muffin. That's all.", zh: '一杯茶和一个松饼。就这些。' },
        ],
      },
      {
        text: 'One more, please.',
        meaning: '请再来一份 / 再来一个',
        insight: '加单最短说法；也可说 One more coffee, please。',
        active: false,
        examples: [
          { en: 'One more water, please.', zh: '请再来一杯水。' },
          { en: 'Can I get one more?', zh: '可以再来一份吗？' },
        ],
      },
      {
        text: 'Small, please.',
        meaning: '小杯 / 小号，谢谢',
        insight: '回答 What size?；也可说 Medium / Large, please。',
        active: false,
        examples: [
          { en: 'What size? — Small, please.', zh: '要什么规格？——小杯，谢谢。' },
          { en: 'A small latte, please.', zh: '请来一杯小拿铁。' },
        ],
      },
      {
        text: 'Without sugar, please.',
        meaning: '请不要加糖',
        insight: '说明不要的配料。不要冰可说 Without ice, please。',
        active: true,
        examples: [
          { en: 'Coffee without sugar, please.', zh: '请来杯不加糖的咖啡。' },
          { en: 'Can I have it without ice?', zh: '可以不要冰吗？' },
        ],
      },
      {
        text: 'The menu, please.',
        meaning: '请给我菜单',
        insight: '刚坐下或还没看清选项时用；也可说 Can I see the menu?',
        active: false,
        examples: [
          { en: "We just sat down. The menu, please.", zh: '我们刚坐下。请给我菜单。' },
          { en: 'Can we see the menu, please?', zh: '可以看一下菜单吗？' },
        ],
      },
      {
        text: "I'm ready to order.",
        meaning: '我可以点餐了',
        insight: '你这边准备好了就说；对方问 Are you ready to order? 时也可直接开始点。',
        active: false,
        examples: [
          { en: "We've decided. I'm ready to order.", zh: '我们想好了。可以点餐了。' },
          { en: "We're ready to order now.", zh: '我们现在可以点了。' },
        ],
      },
      {
        text: 'Table for two.',
        meaning: '两位',
        insight: '进门告诉服务员人数；也可说 Table for one / three。',
        active: false,
        examples: [
          { en: 'Hi. Table for two, please.', zh: '你好。两位，谢谢。' },
          { en: 'Table for two, by the window if possible.', zh: '两位，如果可以靠窗。' },
        ],
      },
      {
        text: 'Is it spicy?',
        meaning: '这个辣吗？',
        insight: '点菜前确认口味；也可问 Does it have peanuts? 等简单忌口问题。',
        active: false,
        examples: [
          { en: 'Is it spicy? — A little.', zh: '这个辣吗？——有一点。' },
          { en: 'Is this soup spicy?', zh: '这汤辣吗？' },
        ],
      },
      {
        text: 'No ice, please.',
        meaning: '请不要加冰',
        insight: '饮料高频偏好；同类还有 No sugar, please。',
        active: false,
        examples: [
          { en: 'Water, no ice, please.', zh: '请来杯水，不要冰。' },
          { en: 'Iced tea—no ice, please.', zh: '冰茶——请不要加冰。' },
        ],
      },
      {
        text: 'Just a minute.',
        meaning: '稍等一下',
        insight: '还没想好点什么时用；比沉默更自然。',
        active: false,
        examples: [
          { en: 'Are you ready? — Just a minute.', zh: '可以点了吗？——稍等一下。' },
          { en: 'Just a minute. Still looking at the menu.', zh: '稍等。还在看菜单。' },
        ],
      },
      {
        text: 'The check, please.',
        meaning: '请结账 / 买单',
        insight: '餐厅买单主句。美式常用 check，英式更常说 the bill。怎么付钱见下一课。',
        active: true,
        examples: [
          { en: "We're done. The check, please.", zh: '我们吃完了。请结账。' },
          { en: 'Can we get the check, please?', zh: '可以给我们账单吗？' },
        ],
      },
      {
        text: 'Keep the change.',
        meaning: '不用找了',
        insight: '原版日常短句。现金付款时表示不用找零，也可带一点小费意思。',
        active: false,
        examples: [
          { en: "That's twenty. Keep the change.", zh: '这是二十。不用找了。' },
          { en: 'Keep the change. Thanks!', zh: '不用找了。谢谢！' },
        ],
      },
      {
        text: 'Same for me.',
        meaning: '我也要一样的',
        insight: '和同伴点相同餐品时很省事。',
        active: false,
        examples: [
          { en: "I'll have the pasta. — Same for me.", zh: '我要意面。——我也一样。' },
          { en: 'Same for me, please.', zh: '我也要一样的，谢谢。' },
        ],
      },
      {
        text: 'Takeout, please.',
        meaning: '外带，谢谢',
        insight: '和 To go, please. 同义，有的店更常说 takeout。',
        active: false,
        examples: [
          { en: 'For here or to go? — Takeout, please.', zh: '堂食还是外带？——外带，谢谢。' },
          { en: 'One burger, takeout, please.', zh: '一个汉堡，外带，谢谢。' },
        ],
      },
    ],
  },
  {
    title: '找商品、问价格与结账',
    promptEn: 'Find an item in a store, ask the price, and check out.',
    promptZh: '在店里找商品、询问价格并结账。',
    description: '购物时定位商品、确认价格、决定购买并完成结账。',
    knowledgePoints: '询问商品；价格；尺码颜色；结账',
    duration: 900,
    goal: '学习者能在商店里找到目标商品、问清价格，并完成简单购买。',
    tip: '找货用 Where is... / Do you have...；决定购买说 I\'ll take it；结账听 Cash or card? 并要收据 Receipt, please。',
    docIntro: '进店找东西、问贵不贵、决定买不买、现金还是刷卡——购物和付钱的主场在这里。点餐课只管「点什么 / 买单」，刷卡细节看本课。',
    patterns: [],
    vocabs: [
      'milk', 'blue', 'price', 'size', 'receipt', 'bag', 'sale', 'expensive',
      'card', 'cash', 'stock', 'return', 'perfect', 'shirt',
    ],
    expressions: [
      {
        text: 'Where is the milk?',
        meaning: '牛奶在哪里？',
        insight: '找货完整句。试衣间可说 Where is the fitting room?',
        active: true,
        examples: [
          { en: 'Excuse me, where is the milk?', zh: '请问，牛奶在哪里？' },
          { en: 'Excuse me, where is the fitting room?', zh: '请问试衣间在哪里？' },
        ],
      },
      {
        text: 'Do you have this in blue?',
        meaning: '这件有蓝色的吗？',
        insight: '确认颜色/款式是否有货的完整句。',
        active: true,
        examples: [
          { en: 'I like this shirt. Do you have this in blue?', zh: '我喜欢这件衬衫。有蓝色的吗？' },
          { en: 'Do you have batteries?', zh: '有电池吗？' },
        ],
      },
      {
        text: 'How much is this?',
        meaning: '这个多少钱？',
        insight: '指着商品问价；远处的用 How much is that?',
        active: true,
        examples: [
          { en: 'How much is this shirt?', zh: '这件衬衫多少钱？' },
          { en: 'Excuse me, how much is this?', zh: '请问，这个多少钱？' },
        ],
      },
      {
        text: "It's too expensive.",
        meaning: '太贵了',
        insight: '表达价格超出预算；可接 Do you have anything cheaper?',
        active: false,
        examples: [
          { en: "It's too expensive for me.", zh: '对我来说太贵了。' },
          { en: "Hmm, it's too expensive. Do you have a sale?", zh: '嗯，太贵了。有打折吗？' },
        ],
      },
      {
        text: "I'll take it.",
        meaning: '我要这个 / 就买这个',
        insight: '决定购买的明确信号，店员通常会带你去结账。',
        active: true,
        examples: [
          { en: "This fits well. I'll take it.", zh: '这件很合适。我要了。' },
          { en: "I'll take these two, please.", zh: '这两件我要了。' },
        ],
      },
      {
        text: 'Can I try this on?',
        meaning: '我可以试穿吗？',
        insight: '服装店高频；试衣间是 fitting room。',
        active: true,
        examples: [
          { en: 'Can I try this on? Where is the fitting room?', zh: '我可以试穿吗？试衣间在哪？' },
          { en: 'Can I try these shoes on?', zh: '这双鞋可以试穿吗？' },
        ],
      },
      {
        text: 'What size?',
        meaning: '什么尺码？',
        insight: '店员常问；回答 Medium / Size M / Size 38 等。',
        active: false,
        examples: [
          { en: 'What size are you looking for?', zh: '你在找什么尺码？' },
          { en: 'What size? — Medium, please.', zh: '什么尺码？——中号，谢谢。' },
        ],
      },
      {
        text: 'Do you have a smaller size?',
        meaning: '有小一号的吗？',
        insight: '尺码不合适时用；大一号说 a bigger size。',
        active: false,
        examples: [
          { en: 'Do you have a smaller size in black?', zh: '黑色有小一号的吗？' },
          { en: 'This is tight. Do you have a bigger size?', zh: '这件有点紧。有大一号吗？' },
        ],
      },
      {
        text: "I'm just looking.",
        meaning: '我只是看看',
        insight: '店员上前推销时的礼貌回应，表示暂不需要帮助。',
        active: true,
        examples: [
          { en: 'Can I help you? — No thanks. I\'m just looking.', zh: '需要帮忙吗？——不用，我只是看看。' },
          { en: "I'm just looking for now. Thanks.", zh: '我先看看，谢谢。' },
        ],
      },
      {
        text: 'Cash or card?',
        meaning: '现金还是刷卡？',
        insight: '结账时店员常问；听懂并用 Cash / Card 回答。',
        active: true,
        examples: [
          { en: 'Cash or card? — Card, please.', zh: '现金还是刷卡？——刷卡。' },
          { en: 'How would you like to pay? Cash or card?', zh: '您怎么付款？现金还是刷卡？' },
        ],
      },
      {
        text: 'Receipt, please.',
        meaning: '请给我收据',
        insight: '结账后要小票；也可说 Can I have a receipt?',
        active: true,
        examples: [
          { en: 'Receipt, please. I may return it.', zh: '请给我收据。我可能要退货。' },
          { en: 'Can I get the receipt, please?', zh: '可以给我收据吗？' },
        ],
      },
      {
        text: 'Do you have a bag?',
        meaning: '有袋子吗？',
        insight: '结账时要袋子；有的店会问 Paper or plastic?',
        active: false,
        examples: [
          { en: 'Do you have a bag? — Yes, one bag please.', zh: '有袋子吗？——要一个，谢谢。' },
          { en: 'No bag, thanks. I have one.', zh: '不用袋子，谢谢。我自己有。' },
        ],
      },
      {
        text: 'Is this on sale?',
        meaning: '这个在打折吗？',
        insight: '确认是否促销价；也可问 Any discount?',
        active: false,
        examples: [
          { en: 'Is this on sale today?', zh: '这个今天打折吗？' },
          { en: 'Excuse me, is this sweater on sale?', zh: '请问这件毛衣在打折吗？' },
        ],
      },
      {
        text: 'This one, please.',
        meaning: '要这个',
        insight: '指着商品做选择；对比 That one（那个）。',
        active: false,
        examples: [
          { en: 'Which one? — This one, please.', zh: '哪一个？——要这个。' },
          { en: 'I\'ll take this one in red.', zh: '我要这个，红色的。' },
        ],
      },
      {
        text: "We're out of stock.",
        meaning: '没货了 / 售罄了',
        insight: '店员告知缺货；听懂后可问 Do you have another color/size?',
        active: false,
        examples: [
          { en: "Sorry, we're out of stock in medium.", zh: '抱歉，中号没货了。' },
          { en: 'Is the blue one out of stock?', zh: '蓝色的卖完了吗？' },
        ],
      },
      {
        text: "I'll pay now.",
        meaning: '我现在付款',
        insight: '表示准备结账；也可说 I\'m ready to check out。',
        active: false,
        examples: [
          { en: "I'll pay now. Card, please.", zh: '我现在付款。刷卡。' },
          { en: "I'm ready. I'll pay now.", zh: '好了。我现在结账。' },
        ],
      },
      {
        text: 'Can I return this?',
        meaning: '这个可以退吗？',
        insight: '入门阶段能问退换即可；通常需要收据。',
        active: false,
        examples: [
          { en: 'Can I return this with the receipt?', zh: '有收据的话可以退吗？' },
          { en: 'Can I return this or exchange it?', zh: '这个可以退还是换？' },
        ],
      },
      {
        text: 'Can I pay by card?',
        meaning: '可以刷卡吗？',
        insight: '付钱方式主句放在本课；点餐课只学 The check, please. 买单，不重复练刷卡。',
        active: true,
        examples: [
          { en: 'Can I pay by card? — Yes, of course.', zh: '可以刷卡吗？——当然可以。' },
          { en: 'Can I pay by card, or cash only?', zh: '可以刷卡吗，还是只收现金？' },
        ],
      },
      {
        text: 'How much for both?',
        meaning: '两个一共多少钱？',
        insight: '买多件时问总价。',
        active: false,
        examples: [
          { en: 'How much for both of these?', zh: '这两个一共多少钱？' },
          { en: 'If I take two, how much for both?', zh: '如果买两个，一共多少？' },
        ],
      },
      {
        text: 'That\'s perfect.',
        meaning: '太合适了 / 完美',
        insight: '对尺码、颜色或方案表示满意。',
        active: false,
        examples: [
          { en: 'This size is good. That\'s perfect.', zh: '这个尺码刚好。太合适了。' },
          { en: 'You have it in blue? That\'s perfect.', zh: '有蓝色的？太好了。' },
        ],
      },
    ],
  },
  {
    title: '询问地点、方向和交通',
    promptEn: 'Handle getting around: being lost, on the way, tickets, trains, and place cues from the original set.',
    promptZh: '处理路上场景：迷路、在路上、买票、等车、指位置——对齐原版相关短句。',
    description: '对齐原版里与迷路、路上、车站、远近和指位置相关的口语短句。',
    knowledgePoints: '迷路；路上；车票火车；远近位置',
    duration: 900,
    goal: '学习者能用原版短句说明迷路/在路上/到了，并问票与下一班车。',
    tip: '原版几乎没有 Turn left / Go straight 这类课本句；本课改收路上、找位置、交通相关原句。',
    docIntro: '原版几乎不教「左转直行」课本指路。这一课换成原版里会说的：迷路了、在路上、到了、买票、下一班车、洗手间在这边、离城里不远。',
    patterns: [],
    vocabs: [
      'lost', 'way', 'ticket', 'train', 'bathroom', 'far', 'road', 'corner',
      'town', 'hotel', 'park', 'gate', 'trip', 'station',
    ],
    expressions: [
      {
        text: "Now I'm lost.",
        meaning: '我现在迷路了',
        insight: '原版短句。比单纯说 lost 更口语；适合当场承认找不着路、请人帮忙。',
        active: true,
        examples: [
          { en: "Wait—this doesn't look right. Now I'm lost.", zh: '等等——这里看着不对。我现在迷路了。' },
          { en: "Now I'm lost. Can you point me to the station?", zh: '我现在迷路了。你能指一下车站吗？' },
        ],
      },
      {
        text: 'On my way.',
        meaning: '我在路上了',
        insight: '原版短句。回复「你到哪了」时很自然；表示已经出发、马上到。',
        active: true,
        examples: [
          { en: "Where are you? — On my way.", zh: '你在哪？——在路上了。' },
          { en: "Don't leave without me. I'm on my way.", zh: '别丢下我。我在路上了。' },
        ],
      },
      {
        text: 'Here we are.',
        meaning: '我们到了',
        insight: '原版短句。到达目的地时说；也可指「就是这里」。',
        active: true,
        examples: [
          { en: 'Here we are. This is your hotel.', zh: '到了。这就是你的酒店。' },
          { en: 'After twenty minutes—here we are.', zh: '二十分钟后——到了。' },
        ],
      },
      {
        text: 'Where can I buy a ticket?',
        meaning: '在哪里能买到票？',
        insight: '原版短句。车站/景点高频；buy a ticket 可换成 get a map / find a taxi。',
        active: true,
        examples: [
          { en: 'Excuse me, where can I buy a ticket?', zh: '请问，在哪里能买到票？' },
          { en: 'Where can I buy a ticket for the next train?', zh: '下一班火车的票在哪里买？' },
        ],
      },
      {
        text: 'When is the next train?',
        meaning: '下趟火车什么时候到？',
        insight: '原版短句。等车时直接问班次；bus / subway 也可套用。',
        active: true,
        examples: [
          { en: 'When is the next train to Boston?', zh: '去波士顿的下一班火车几点？' },
          { en: "We're late. When is the next train?", zh: '我们迟到了。下一班火车什么时候？' },
        ],
      },
      {
        text: 'Over here is the bathroom.',
        meaning: '这边是浴室 / 洗手间',
        insight: '原版短句。用手势指位置时很自然；over here 强调「这边」。',
        active: true,
        examples: [
          { en: 'Need a break? Over here is the bathroom.', zh: '要休息一下？洗手间在这边。' },
          { en: 'Over here is the bathroom, and the exit is over there.', zh: '洗手间在这边，出口在那边。' },
        ],
      },
      {
        text: "It's not that far into town.",
        meaning: '这离城市也不远',
        insight: '原版短句。安慰「不远/走得动」；that far 减弱距离感。',
        active: true,
        examples: [
          { en: "Don't worry. It's not that far into town.", zh: '别担心。离城里并不远。' },
          { en: 'We can walk—it\'s not that far into town.', zh: '可以走着去——离城里不远。' },
        ],
      },
      {
        text: 'Just around the corner.',
        meaning: '就在附近 / 转角就到',
        insight: '原版惯用语（原文拼写作 comer，这里按常用写法）。表示很近，常配手势。',
        active: true,
        examples: [
          { en: 'The café is just around the corner.', zh: '咖啡馆就在转角。' },
          { en: "You're close—just around the corner.", zh: '你很近了——转个弯就到。' },
        ],
      },
      {
        text: 'The road divides here.',
        meaning: '这条路在这里分岔',
        insight: '原版短句。听指路或自己说明岔口时用；后面常补 left / right fork。',
        active: false,
        examples: [
          { en: 'Careful—the road divides here.', zh: '小心——这条路在这里分岔。' },
          { en: 'The road divides here. Take the left one.', zh: '路在这里分岔。走左边那条。' },
        ],
      },
      {
        text: "I'll be right there.",
        meaning: '我马上来',
        insight: '原版短句。人已在别处、马上赶到；和问候课的 I\'ll be right back（马上回来）不同。',
        active: false,
        examples: [
          { en: "Stay at the gate. I'll be right there.", zh: '在门口等着。我马上来。' },
          { en: "Don't hang up—I'll be right there.", zh: '别挂电话——我马上到。' },
        ],
      },
      {
        text: 'Go on in.',
        meaning: '赶紧进去吧',
        insight: '原版短句。请人先进门/先进屋；比 Come in 更催促一点。',
        active: false,
        examples: [
          { en: "It's cold outside. Go on in.", zh: '外面冷。赶紧进去吧。' },
          { en: "They're waiting. Go on in.", zh: '他们在等。先进去吧。' },
        ],
      },
      {
        text: "I'm home.",
        meaning: '我回来了',
        insight: '原版短句。进门招呼家人；也可表示「到家了」这条状态。',
        active: false,
        examples: [
          { en: "I'm home! Anyone here?", zh: '我回来了！有人在吗？' },
          { en: 'Call me when I\'m home.', zh: '我到家了再给我电话。' },
        ],
      },
      {
        text: "I'm here to take you home.",
        meaning: '我是来接你回家的',
        insight: '原版短句。接人场景；点明来意，减少对方猜疑。',
        active: false,
        examples: [
          { en: "Don't worry. I'm here to take you home.", zh: '别担心。我是来接你回家的。' },
          { en: "Mom sent me. I'm here to take you home.", zh: '妈妈让我来的。我是来接你回家的。' },
        ],
      },
      {
        text: 'I left it right here.',
        meaning: '我明明放在这里的',
        insight: '原版短句。找东西时强调「就在这个位置」；right here 加强语气。',
        active: false,
        examples: [
          { en: 'Where is my bag? I left it right here.', zh: '我的包呢？我明明放在这里的。' },
          { en: 'I left it right here a minute ago.', zh: '一分钟前我还放在这儿。' },
        ],
      },
      {
        text: 'I walked across the park.',
        meaning: '我穿过了公园',
        insight: '原版短句。交代怎么过来的；across 强调「穿过去」。',
        active: false,
        examples: [
          { en: 'How did you get here? — I walked across the park.', zh: '你怎么过来的？——我穿过公园走过来的。' },
          { en: 'I walked across the park to save time.', zh: '为了省时间，我穿过公园。' },
        ],
      },
      {
        text: 'Out of my way.',
        meaning: '给我让开',
        insight: '原版短句。语气冲，赶路或紧急时用；日常礼貌场景慎用。',
        active: false,
        examples: [
          { en: 'Coming through—out of my way!', zh: '借过——让开！' },
          { en: 'The trolley is coming. Out of my way.', zh: '手推车过来了。让开。' },
        ],
      },
      {
        text: 'Stay where you are.',
        meaning: '待在那里别动',
        insight: '原版短句。让对方原地等候，方便去接或避免走散。',
        active: false,
        examples: [
          { en: "Stay where you are. I'll find you.", zh: '待在那里别动。我来找你。' },
          { en: 'If you get separated, stay where you are.', zh: '如果走散了，就待在原地。' },
        ],
      },
      {
        text: 'Get out of here.',
        meaning: '快离开这里',
        insight: '原版短句。可表催促离开，也可表惊讶「不会吧」；入门先掌握字面「离开此地」。',
        active: false,
        examples: [
          { en: 'This place is unsafe. Get out of here.', zh: '这里不安全。快走。' },
          { en: 'Security is coming—get out of here.', zh: '安保来了——快走。' },
        ],
      },
      {
        text: 'Business trip.',
        meaning: '出差',
        insight: '原版短句。解释出行目的时很短很清楚；常作答语。',
        active: false,
        examples: [
          { en: 'Why are you in Tokyo? — Business trip.', zh: '你怎么在东京？——出差。' },
          { en: "I'm away on a business trip this week.", zh: '我这周出差。' },
        ],
      },
      {
        text: 'Home sweet home.',
        meaning: '到家了（金窝银窝不如自己的草窝）',
        insight: '原版惯用语。回到家时的感叹；轻松、带一点情感。',
        active: false,
        examples: [
          { en: 'After a long flight—home sweet home.', zh: '飞了很久——终于到家了。' },
          { en: 'Home sweet home. I missed this couch.', zh: '到家真好。我想念这张沙发。' },
        ],
      },
    ],
  },
  {
    title: '表达想要、需要和基本喜恶',
    promptEn: 'Say what you want, need, like, or do not like in simple situations.',
    promptZh: '在简单情境里说出想要、需要、喜欢或不喜欢。',
    description: '用短句表达偏好与需求，并回应别人的提议。',
    knowledgePoints: '想要；需要；喜恶；接受拒绝',
    duration: 900,
    goal: '学习者能清楚说出 I want / I need / I like / I don\'t like，并对提议做出接受或婉拒。',
    tip: '需求用 I need；愿望用 I\'d like（更礼貌）或 I want。拒绝时 No, thanks 比直接 No 更柔和。',
    docIntro: '想要什么、需不需要、喜不喜欢、答应对方还是礼貌拒绝——把「我的想法」说清楚，看这里。点餐时的 I\'d like a coffee 在「点餐」课。',
    patterns: [],
    vocabs: [
      'want', 'need', 'like', 'hungry', 'thirsty', 'tired', 'water', 'hope',
      'absolutely', 'dessert', 'tea', 'song', 'party', 'break',
    ],
    expressions: [
      {
        text: 'I want some water.',
        meaning: '我想要点水',
        insight: '直接表达愿望的完整句；对店员或正式场合，优先改用 I\'d like...。',
        active: true,
        examples: [
          { en: "I'm thirsty. I want some water.", zh: '我渴了。我想要点水。' },
          { en: 'I want to go home now.', zh: '我现在想回家。' },
        ],
      },
      {
        text: "Yes, I'd like to.",
        meaning: '好，我也想 / 好的，我愿意',
        insight: '原版短句。别人邀请或提议时，礼貌表示同意参与；点餐礼貌句 I\'d like... 见「点餐」课。',
        active: true,
        examples: [
          { en: 'Want to come with us? — Yes, I\'d like to.', zh: '要不要一起？——好，我想去。' },
          { en: 'Would you like to try again? — Yes, I\'d like to.', zh: '要再试一次吗？——好，我想试。' },
        ],
      },
      {
        text: 'It is just what I need.',
        meaning: '这正是我所需要的',
        insight: '原版短句。看到合适的东西或方案时表示「正合我意」；比单纯说 I need... 更完整。',
        active: true,
        examples: [
          { en: 'This size? It is just what I need.', zh: '这个尺码？正是我需要的。' },
          { en: 'A quiet room—it is just what I need.', zh: '安静的房间——正是我需要的。' },
        ],
      },
      {
        text: 'I like this.',
        meaning: '我喜欢这个',
        insight: '表达喜好的完整短句；否定用 I don\'t like this.',
        active: true,
        examples: [
          { en: 'I like this song.', zh: '我喜欢这首歌。' },
          { en: 'I like tea more than coffee.', zh: '比起咖啡，我更喜欢茶。' },
        ],
      },
      {
        text: "I don't like this.",
        meaning: '我不喜欢这个',
        insight: '直接但不攻击；可加 very much 减弱语气。',
        active: true,
        examples: [
          { en: "I don't like spicy food.", zh: '我不喜欢辣的。' },
          { en: "I don't like this color very much.", zh: '我不太喜欢这个颜色。' },
        ],
      },
      {
        text: 'I hope so.',
        meaning: '希望如此',
        insight: '原版短句。对还不确定、但抱有期待的事情这样回应。',
        active: false,
        examples: [
          { en: 'Will it be sunny tomorrow? — I hope so.', zh: '明天会晴吗？——希望如此。' },
          { en: 'Do you think we can finish? — I hope so.', zh: '你觉得我们能做完吗？——希望可以。' },
        ],
      },
      {
        text: 'Do you like this?',
        meaning: '你喜欢这个吗？',
        insight: '开启偏好话题的完整句；回答可用 Yes / Not really / It\'s okay。',
        active: false,
        examples: [
          { en: 'Do you like coffee?', zh: '你喜欢咖啡吗？' },
          { en: 'Do you like this place?', zh: '你喜欢这个地方吗？' },
        ],
      },
      {
        text: 'Me too.',
        meaning: '我也是',
        insight: '快速表示相同感受；否定相同用 Me neither。',
        active: true,
        examples: [
          { en: "I'm hungry. — Me too.", zh: '我饿了。——我也是。' },
          { en: 'I like this movie. — Me too!', zh: '我喜欢这部电影。——我也是！' },
        ],
      },
      {
        text: 'Not really.',
        meaning: '不算 / 不太',
        insight: '柔和否定，比 No 更不生硬。',
        active: true,
        examples: [
          { en: 'Do you like seafood? — Not really.', zh: '你喜欢海鲜吗？——不太喜欢。' },
          { en: 'Are you free tonight? — Not really.', zh: '你今晚有空吗？——不太有。' },
        ],
      },
      {
        text: 'Sounds good.',
        meaning: '听起来不错',
        insight: '接受提议的高频短句。',
        active: true,
        examples: [
          { en: 'Let\'s meet at six. — Sounds good.', zh: '我们六点见。——听起来不错。' },
          { en: 'Pizza for dinner? — Sounds good to me.', zh: '晚饭吃披萨？——我觉得不错。' },
        ],
      },
      {
        text: 'So do I.',
        meaning: '我也是（接在肯定句后）',
        insight: '原版短句。别人说 I like tea. 后用 So do I.；否定句后用 Me neither。和 Me too. 都常见。',
        active: false,
        examples: [
          { en: 'I like tea. — So do I.', zh: '我喜欢茶。——我也是。' },
          { en: 'I need a break. — So do I.', zh: '我需要休息一下。——我也是。' },
        ],
      },
      {
        text: "I'm hungry.",
        meaning: '我饿了',
        insight: '状态短句，常用来提议吃饭。原版情绪类也有 I\'m tired. 一类状态表达。',
        active: false,
        examples: [
          { en: "I'm hungry. Let's eat.", zh: '我饿了。我们吃饭吧。' },
          { en: "Are you hungry too?", zh: '你也饿了吗？' },
        ],
      },
      {
        text: "I'm tired.",
        meaning: '我累了',
        insight: '原版情绪短句。说明状态，可用来婉拒继续活动。',
        active: false,
        examples: [
          { en: "I'm tired. Can we go home?", zh: '我累了。我们能回家吗？' },
          { en: "I'm a little tired today.", zh: '我今天有点累。' },
        ],
      },
      {
        text: 'Absolutely.',
        meaning: '当然 / 肯定的',
        insight: '原版短句。比 Yes 更用力，表示完全同意或非常想要。',
        active: false,
        examples: [
          { en: 'Do you want to go? — Absolutely.', zh: '你想去吗？——当然。' },
          { en: 'Was that helpful? — Absolutely.', zh: '有帮助吗？——非常有。' },
        ],
      },
      {
        text: 'Yes, please.',
        meaning: '好的，麻烦了',
        insight: '接受提供时的礼貌肯定。',
        active: true,
        examples: [
          { en: 'Would you like some tea? — Yes, please.', zh: '要喝茶吗？——好的，谢谢。' },
          { en: 'More water? — Yes, please.', zh: '再加点水？——好的。' },
        ],
      },
      {
        text: 'No, thanks.',
        meaning: '不用了，谢谢',
        insight: '礼貌拒绝；比单独 No 更完整。',
        active: true,
        examples: [
          { en: 'Want dessert? — No, thanks.', zh: '要甜点吗？——不用了，谢谢。' },
          { en: 'Need a bag? — No, thanks. I have one.', zh: '要袋子吗？——不用，我有。' },
        ],
      },
      {
        text: 'Maybe next time.',
        meaning: '也许下次吧',
        insight: '原版短句。这次先不去/不做，但把门留着。',
        active: false,
        examples: [
          { en: 'Coming to the party? — Maybe next time.', zh: '来聚会吗？——也许下次吧。' },
          { en: 'Want dessert? — Maybe next time.', zh: '要甜点吗？——下次再说吧。' },
        ],
      },
      {
        text: 'No need.',
        meaning: '不用了',
        insight: '原版短句。婉拒帮助或额外服务时很干脆。',
        active: false,
        examples: [
          { en: 'Do you need a bag? — No need. Thanks.', zh: '要袋子吗？——不用了，谢谢。' },
          { en: 'I can help. — No need. I got it.', zh: '我可以帮忙。——不用。我自己行。' },
        ],
      },
      {
        text: 'Not yet.',
        meaning: '还没有 / 还没',
        insight: '原版短句。表示事情尚未发生。',
        active: false,
        examples: [
          { en: 'Are you done? — Not yet.', zh: '做完了吗？——还没有。' },
          { en: 'Have you eaten? — Not yet.', zh: '吃过了吗？——还没有。' },
        ],
      },
      {
        text: 'Me neither.',
        meaning: '我也不 / 我也没有',
        insight: '原版短句。接在否定句后：I don\'t like it. — Me neither.',
        active: false,
        examples: [
          { en: "I don't like spicy food. — Me neither.", zh: '我不喜欢辣的。——我也不。' },
          { en: "I can't go tonight. — Me neither.", zh: '我今晚去不了。——我也去不了。' },
        ],
      },
    ],
  },
  {
    title: '请求重复、说慢一点和确认听懂',
    promptEn: 'Ask someone to repeat, slow down, and confirm what you understood.',
    promptZh: '请对方重复、说慢一点，并确认自己听懂了。',
    description: '听不清或不懂时及时求助，而不是假装听懂。',
    knowledgePoints: '请求重复；放慢语速；确认理解；澄清',
    duration: 900,
    goal: '学习者在没听懂时，能在 8 秒内用短句请求重复或确认意思。',
    tip: '没听清先说 Sorry? / Pardon?；需要完整重复用 Can you say that again?；确认理解用 Got it / I see / Do you mean...?',
    docIntro: '没听清、跟不上语速、不确定对方什么意思时，别硬撑。这份文档就是教你怎么自然地请对方再说一遍、说慢一点，并确认自己听懂了。',
    patterns: [],
    vocabs: [
      'repeat', 'slowly', 'understand', 'mean', 'again', 'check', 'right', 'write',
      'clear', 'English', 'explain', 'tomorrow', 'basic', 'address',
    ],
    expressions: [
      {
        text: 'Sorry?',
        meaning: '什么？ / 你说什么？（没听清）',
        insight: '请对方再说一遍的最短方式；语气上扬，不是道歉。',
        active: true,
        examples: [
          { en: 'Sorry? I didn\'t hear you.', zh: '什么？我没听见。' },
          { en: 'Meet at five. — Sorry?', zh: '五点见。——什么？' },
        ],
      },
      {
        text: 'Pardon?',
        meaning: '请再说一遍？',
        insight: '比 Sorry? 稍正式，同样用于没听清。',
        active: false,
        examples: [
          { en: 'Pardon? Could you say that again?', zh: '请再说一遍？' },
          { en: 'Your gate is B12. — Pardon?', zh: '登机口是 B12。——请再说一遍？' },
        ],
      },
      {
        text: 'Can you repeat that?',
        meaning: '你能重复一下吗？',
        insight: '明确请求重复整句；服务窗口、课堂都适用。',
        active: true,
        examples: [
          { en: 'Can you repeat that, please?', zh: '请你重复一下好吗？' },
          { en: 'Sorry, can you repeat that more slowly?', zh: '抱歉，能慢一点再重复一遍吗？' },
        ],
      },
      {
        text: 'Can you say that again?',
        meaning: '你能再说一遍吗？',
        insight: '和 Can you repeat that? 几乎同义，口语里都很自然。',
        active: true,
        examples: [
          { en: 'Can you say that again? I missed it.', zh: '能再说一遍吗？我没听到。' },
          { en: 'One more time—can you say that again?', zh: '再来一次——能再说一遍吗？' },
        ],
      },
      {
        text: 'More slowly, please.',
        meaning: '请慢一点',
        insight: '语速太快时用；也可说 Please speak slowly。',
        active: true,
        examples: [
          { en: 'More slowly, please. My English is basic.', zh: '请慢一点。我的英语还比较基础。' },
          { en: 'Can you speak more slowly, please?', zh: '能请你说慢一点吗？' },
        ],
      },
      {
        text: 'Please speak slowly.',
        meaning: '请说慢一点',
        insight: '完整礼貌请求；适合正式或紧张场景。',
        active: false,
        examples: [
          { en: 'Please speak slowly. Thank you.', zh: '请说慢一点。谢谢。' },
          { en: 'I\'m learning. Please speak slowly.', zh: '我还在学。请说慢一点。' },
        ],
      },
      {
        text: "I don't understand.",
        meaning: '我不明白',
        insight: '诚实表明没懂；可立刻接 Can you say that again?',
        active: true,
        examples: [
          { en: "I don't understand. Can you explain?", zh: '我不明白。你能解释一下吗？' },
          { en: "Sorry, I don't understand this part.", zh: '抱歉，这部分我不懂。' },
        ],
      },
      {
        text: 'What does that mean?',
        meaning: '那是什么意思？',
        insight: '对词或整句含义发问；也可说 What does this word mean?',
        active: true,
        examples: [
          { en: 'What does that mean in English?', zh: '那用英语是什么意思？' },
          { en: '"Sold out"—what does that mean?', zh: '“Sold out”——那是什么意思？' },
        ],
      },
      {
        text: 'Do you mean tomorrow?',
        meaning: '你是说明天吗？',
        insight: '用完整猜测句确认；比反复让对方重说更高效。',
        active: true,
        examples: [
          { en: 'Do you mean tomorrow morning?', zh: '你是说明天早上吗？' },
          { en: 'Do you mean this train, not that one?', zh: '你是说这趟车，不是那趟？' },
        ],
      },
      {
        text: 'Got it.',
        meaning: '明白了',
        insight: '确认听懂；比 OK 更能告诉对方“你可以继续”。',
        active: true,
        examples: [
          { en: 'Stay where you are. — Got it.', zh: '待在那里别动。——明白了。' },
          { en: 'So we meet at six. Got it.', zh: '所以我们六点见。明白了。' },
        ],
      },
      {
        text: 'I see.',
        meaning: '我懂了 / 原来如此',
        insight: '原版短句。表示理解对方说明；不一定等于完全同意。',
        active: true,
        examples: [
          { en: 'The shop is closed on Monday. — I see.', zh: '店周一关门。——原来如此。' },
          { en: 'I see. Thanks for explaining.', zh: '明白了。谢谢解释。' },
        ],
      },
      {
        text: 'Okay.',
        meaning: '好的',
        insight: '最轻确认；重要信息最好再用 Got it 或复述一次。',
        active: false,
        examples: [
          { en: 'Wait here. — Okay.', zh: '在这里等。——好的。' },
          { en: 'Okay. I\'ll call you back.', zh: '好。我回头给你电话。' },
        ],
      },
      {
        text: 'One more time.',
        meaning: '再来一次',
        insight: '请对方再重复；课堂跟读和听指令时都很常用。',
        active: false,
        examples: [
          { en: 'One more time, please.', zh: '请再来一次。' },
          { en: 'Sorry—one more time from the start.', zh: '抱歉——从头再来一次。' },
        ],
      },
      {
        text: 'Could you write it down?',
        meaning: '你能写下来吗？',
        insight: '听不懂地址、名字、号码时非常管用。',
        active: false,
        examples: [
          { en: 'Could you write it down, please?', zh: '能请你写下来吗？' },
          { en: 'I can\'t catch the name. Could you write it?', zh: '名字我听不清。你能写一下吗？' },
        ],
      },
      {
        text: 'How do you say this in English?',
        meaning: '这个用英语怎么说？',
        insight: '主动索取表达的完整句；学习与生活场景都适用。',
        active: false,
        examples: [
          { en: 'How do you say “收据” in English?', zh: '“收据”用英语怎么说？' },
          { en: 'How do you say this in English?', zh: '这个用英语怎么说？' },
        ],
      },
      {
        text: 'Is that right?',
        meaning: '这样对吗？',
        insight: '复述后请对方确认，避免理解偏差。',
        active: true,
        examples: [
          { en: 'So the meeting is at two, is that right?', zh: '所以会议两点开始，对吗？' },
          { en: 'Left, then straight—is that right?', zh: '先左转再直行——对吗？' },
        ],
      },
      {
        text: 'Let me check.',
        meaning: '我确认一下',
        insight: '给自己几秒核对信息，避免匆忙答错。',
        active: false,
        examples: [
          { en: 'Is this your order? — Let me check.', zh: '这是你的单吗？——我确认一下。' },
          { en: 'Let me check the address again.', zh: '我再核对一下地址。' },
        ],
      },
      {
        text: "Yes, that's it.",
        meaning: '对，就是这样',
        insight: '确认对方理解正确。',
        active: false,
        examples: [
          { en: 'You mean Gate B? — Yes, that\'s it.', zh: '你是说 B 登机口？——对，就是那个。' },
          { en: 'This one? — Yes, that\'s it.', zh: '是这个吗？——对，就是这个。' },
        ],
      },
      {
        text: 'Almost.',
        meaning: '差不多 / 接近了',
        insight: '部分正确时用，接着补出真正答案。',
        active: false,
        examples: [
          { en: 'Is it Room 12? — Almost. It\'s Room 14.', zh: '是 12 号房吗？——差不多。是 14 号。' },
          { en: 'Did I say it right? — Almost. Try again.', zh: '我说对了吗？——接近了。再试一次。' },
        ],
      },
      {
        text: 'Is that clear?',
        meaning: '明白了吗？',
        insight: '原版短句。确认对方是否听懂；你自己确认时更常用 Is that right? / Got it.',
        active: false,
        examples: [
          { en: 'Meet at six outside. Is that clear?', zh: '六点在外面见。明白了吗？' },
          { en: 'No photos inside. Is that clear?', zh: '里面不能拍照。明白了吗？' },
        ],
      },
    ],
  },
  {
    title: '遇到困难时请求帮助',
    promptEn: 'Ask for help when you have a problem, feel unwell, or cannot find something.',
    promptZh: '遇到问题、身体不适或找不到东西时请求帮助。',
    description: '在困难场景里清楚求助，并说明自己的状况。',
    knowledgePoints: '求助；说明问题；紧急情况；语言障碍',
    duration: 900,
    goal: '学习者能在迷路、不适、物品丢失等情况下，用短句成功求助。',
    tip: '先引起注意 Excuse me，再说 Can you help me? 然后补一句具体问题。语言不够时可以说 I don\'t speak English well。',
    docIntro: '东西找不到、身体不舒服、机器坏了、英语一时卡住——需要开口求助时先看这里。洗手间位置见「询问地点」课的 Over here is the bathroom.；Excuse me 开场见「感谢」课。',
    patterns: [],
    vocabs: [
      'help', 'problem', 'find', 'sick', 'urgent', 'phone', 'wallet', 'book',
      'doctor', 'careful', 'wrong', 'wifi', 'charger', 'machine',
    ],
    expressions: [
      {
        text: 'Can you help me?',
        meaning: '你能帮我吗？',
        insight: '求助核心句；说完立刻补具体困难效果最好。',
        active: true,
        examples: [
          { en: 'Excuse me, can you help me?', zh: '打扰一下，你能帮我吗？' },
          { en: 'Can you help me find Gate 5?', zh: '你能帮我找 5 号登机口吗？' },
        ],
      },
      {
        text: 'I need help.',
        meaning: '我需要帮助',
        insight: '比提问更直接，适合明显困境或紧急一点的场合。',
        active: true,
        examples: [
          { en: 'I need help. I\'m lost.', zh: '我需要帮助。我迷路了。' },
          { en: 'Please, I need help with my bag.', zh: '拜托，我需要有人帮我拿行李。' },
        ],
      },
      {
        text: 'Something\'s wrong.',
        meaning: '有点不对劲',
        insight: '原版短句。设备、身体或情况异常时先概括一句，再补细节。',
        active: true,
        examples: [
          { en: "Something's wrong with my card.", zh: '我的卡有点问题。' },
          { en: "Something's wrong. Can you check?", zh: '有点不对劲。你能看看吗？' },
        ],
      },
      {
        text: "It doesn't work.",
        meaning: '用不了 / 坏了',
        insight: '原版短句。机器、链接、门禁失灵时很常用。',
        active: true,
        examples: [
          { en: "The machine doesn't work.", zh: '这台机器用不了。' },
          { en: "My phone doesn't work here.", zh: '我的手机在这里用不了。' },
        ],
      },
      {
        text: 'Hold up.',
        meaning: '等一下',
        insight: '原版短句。让对方先停一下；比 Wait a minute 更口语。',
        active: false,
        examples: [
          { en: 'Hold up. I need my bag.', zh: '等一下。我要拿包。' },
          { en: 'Hold up—did you say Gate 5?', zh: '等一下——你是说 5 号门吗？' },
        ],
      },
      {
        text: "I can't find my book.",
        meaning: '我找不到我的书',
        insight: '原版短句。说明找不到某物；手机可说 I can\'t find my phone.',
        active: true,
        examples: [
          { en: "Excuse me, I can't find my book.", zh: '请问，我找不到我的书。' },
          { en: "I can't find my hotel on the map.", zh: '我在地图上找不到酒店。' },
        ],
      },
      {
        text: 'I lost my wallet.',
        meaning: '我钱包丢了',
        insight: '明确“丢失”的完整句；比 can\'t find 更肯定东西已不在身边。',
        active: true,
        examples: [
          { en: 'Can you help me? I lost my wallet.', zh: '你能帮我吗？我钱包丢了。' },
          { en: 'I lost my ticket. What should I do?', zh: '我票丢了。我该怎么办？' },
        ],
      },
      {
        text: 'I have a problem.',
        meaning: '我遇到麻烦了',
        insight: '先概括再展开细节，适合对工作人员开口。',
        active: true,
        examples: [
          { en: 'Hi, I have a problem with my order.', zh: '你好，我的订单有问题。' },
          { en: 'I have a problem. My card isn\'t working.', zh: '我有个问题。我的卡刷不了。' },
        ],
      },
      {
        text: 'I feel sick.',
        meaning: '我感觉不舒服',
        insight: '身体不适时的清楚表达；严重时可继续说 I need a doctor。',
        active: true,
        examples: [
          { en: 'I feel sick. Can I sit down?', zh: '我不舒服。我可以坐下吗？' },
          { en: 'I feel sick. Where is the clinic?', zh: '我不舒服。诊所在哪里？' },
        ],
      },
      {
        text: 'Be careful.',
        meaning: '小心',
        insight: '原版短句。提醒对方注意安全；同类还有 Watch out.',
        active: false,
        examples: [
          { en: 'Be careful. The floor is wet.', zh: '小心。地板湿。' },
          { en: 'Be careful with that bag.', zh: '那个包小心点。' },
        ],
      },
      {
        text: 'Watch out.',
        meaning: '当心',
        insight: '原版短句。突发危险时的提醒，比 Be careful 更急。',
        active: false,
        examples: [
          { en: 'Watch out! That car is coming.', zh: '当心！那辆车过来了。' },
          { en: 'Watch out for the step.', zh: '当心台阶。' },
        ],
      },
      {
        text: "What's wrong?",
        meaning: '怎么了？',
        insight: '关心对方或询问故障原因；你也可能被这样问到。',
        active: false,
        examples: [
          { en: "What's wrong? Are you okay?", zh: '怎么了？你还好吗？' },
          { en: "What's wrong with the machine?", zh: '这机器怎么了？' },
        ],
      },
      {
        text: 'Are you okay?',
        meaning: '你还好吗？',
        insight: '看到别人不适或摔倒时的关心；也可用于确认自己是否需要帮助。',
        active: false,
        examples: [
          { en: 'Are you okay? Do you need help?', zh: '你还好吗？需要帮助吗？' },
          { en: 'You look pale. Are you okay?', zh: '你脸色不太好。还好吗？' },
        ],
      },
      {
        text: 'Please help.',
        meaning: '请帮帮我',
        insight: '紧急、简短、清楚；随后尽量补关键信息。',
        active: false,
        examples: [
          { en: 'Please help. Someone fell down.', zh: '请帮忙。有人摔倒了。' },
          { en: 'Please help me. I can\'t open this.', zh: '请帮帮我。我打不开这个。' },
        ],
      },
      {
        text: "It's urgent.",
        meaning: '这很紧急',
        insight: '提高优先级；不要滥用，真紧急时再用。',
        active: false,
        examples: [
          { en: "I need a doctor. It's urgent.", zh: '我需要医生。很紧急。' },
          { en: "Please, it's urgent. My child is missing.", zh: '拜托，很紧急。我的孩子不见了。' },
        ],
      },
      {
        text: 'My phone died.',
        meaning: '我手机没电了',
        insight: '旅行中高频麻烦；可接 Can I borrow a charger?',
        active: false,
        examples: [
          { en: 'My phone died. Can I borrow a charger?', zh: '手机没电了。能借个充电器吗？' },
          { en: 'Sorry I\'m late. My phone died.', zh: '抱歉迟到了。手机没电了。' },
        ],
      },
      {
        text: "There's no Wi-Fi.",
        meaning: '没有无线网',
        insight: '说明连接问题；也可说 The Wi-Fi isn\'t working。',
        active: false,
        examples: [
          { en: "There's no Wi-Fi here.", zh: '这里没有无线网。' },
          { en: "I can't check in online. There's no Wi-Fi.", zh: '我没法在线值机。没有无线网。' },
        ],
      },
      {
        text: "I don't speak English well.",
        meaning: '我英语说得不太好',
        insight: '降低对方语速预期，并请求对方配合。',
        active: true,
        examples: [
          { en: "I don't speak English well. Please speak slowly.", zh: '我英语不太好。请说慢一点。' },
          { en: "Sorry, I don't speak English well. Can you help me?", zh: '抱歉，我英语不太好。你能帮我吗？' },
        ],
      },
      {
        text: 'Do you speak Chinese?',
        meaning: '你会说中文吗？',
        insight: '寻找语言支持；也可问 Is there anyone who speaks Chinese?',
        active: false,
        examples: [
          { en: 'Do you speak Chinese? — A little.', zh: '你会说中文吗？——一点。' },
          { en: 'Excuse me, do you speak Chinese?', zh: '请问，你会说中文吗？' },
        ],
      },
      {
        text: 'I need a doctor.',
        meaning: '我需要医生',
        insight: '医疗求助的清楚表达；可补 I feel sick / It hurts here。',
        active: false,
        examples: [
          { en: 'I need a doctor. I feel very sick.', zh: '我需要医生。我很不舒服。' },
          { en: 'Please, I need a doctor now.', zh: '拜托，我现在需要医生。' },
        ],
      },
    ],
  },
]

function normalizeExpr(s) {
  return String(s || '')
    .replace(/[.?!…]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** 速查表优先用不等于核心句、带场景的例句 */
function pickNaturalExample(expr) {
  const examples = expr.examples || []
  if (!examples.length) return { en: '', zh: '' }
  const core = normalizeExpr(expr.text)
  const scored = examples.map((ex) => {
    const en = ex.en || ''
    const same = normalizeExpr(en) === core
    const hasContext = /[—–?]/.test(en) || /,|;|:/.test(en) || en.length > expr.text.length + 8
    const hasDialogue = /—|–/.test(en)
    let score = 0
    if (!same) score += 5
    if (hasContext) score += 2
    if (hasDialogue) score += 2
    if (en.length > expr.text.length) score += 1
    return { ex, score, same }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].ex
}

function buildTeachingMd(topic) {
  const lines = []
  lines.push(`# ${topic.title}`)
  lines.push('')
  lines.push('## 小提示')
  lines.push('')
  lines.push(topic.docIntro)
  lines.push('')
  lines.push('## 表达、中文意思与使用见解')
  lines.push('')

  topic.expressions.forEach((expr, index) => {
    lines.push(`### ${index + 1} · ${expr.text}`)
    lines.push('')
    if (expr.active) {
      lines.push('**重点：** 优先开口')
      lines.push('')
    }
    lines.push('**中文意思**')
    lines.push('')
    lines.push(expr.meaning)
    lines.push('')
    lines.push('**使用见解**')
    lines.push('')
    lines.push(expr.insight)
    lines.push('')
    lines.push('**例句**')
    lines.push('')
    for (const ex of expr.examples) {
      lines.push(`- ${ex.en}`)
      lines.push(`  ${ex.zh}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  lines.push('## 表达速查表')
  lines.push('')
  lines.push('| # | 表达 | 中文意思 | 自然例句 |')
  lines.push('|---:|---|---|---|')
  topic.expressions.forEach((expr, index) => {
    const sample = pickNaturalExample(expr).en?.replace(/\|/g, '\\|') || ''
    lines.push(`| ${index + 1} | ${expr.text.replace(/\|/g, '\\|')} | ${expr.meaning.replace(/\|/g, '\\|')} | ${sample} |`)
  })
  lines.push('')
  return lines.join('\n')
}

function buildWarmup(topic, topicIndex) {
  const actives = topic.expressions.filter((e) => e.active)
  const picks = actives.slice(0, 6)
  const pipeline = []
  let idn = 1
  const id = () => `l1-t${topicIndex + 1}-${idn++}`

  // 1) zh_to_en chunk substitution groups (2-3 chunks)
  for (const expr of picks.slice(0, 3)) {
    const items = expr.examples.slice(0, 2).map((ex) => ({
      zh: ex.zh,
      answer: ex.en,
      hint: `用「${expr.text}」来表达`,
    }))
    // ensure at least 2 items
    if (items.length === 1) {
      items.push({
        zh: `${expr.meaning}（换个场景再说一次）`,
        answer: expr.text.includes('___') ? expr.text.replace('___', '...') : expr.text,
        hint: `核心表达：${expr.text}`,
      })
    }
    pipeline.push({
      id: id(),
      type: 'chunk_substitution',
      title: `${expr.text} 句块替换`,
      chunk: expr.text,
      chunkMeaning: expr.meaning,
      direction: 'zh_to_en',
      kind: 'chunk',
      items,
    })
  }

  // 2) en_to_zh comprehension
  const enItems = picks.slice(0, 3).map((expr) => {
    const ex = expr.examples[0]
    return {
      en: ex?.en || expr.text,
      answer: ex?.zh || expr.meaning,
      hint: '先抓住关键词，再说出中文意思',
    }
  })
  if (enItems.length >= 2) {
    pipeline.push({
      id: id(),
      type: 'chunk_substitution',
      title: `${topic.title} 听辨理解`,
      chunk: picks[0]?.text || topic.title,
      chunkMeaning: picks[0]?.meaning || '',
      direction: 'en_to_zh',
      kind: 'chunk',
      items: enItems,
    })
  }

  // 3) pattern drill
  const pattern = topic.patterns[0]
  if (pattern) {
    const patternItems = actives
      .filter((e) => e.text.includes('___') || e.text.includes(pattern.pattern.split(' ')[0]))
      .slice(0, 3)
      .map((e) => {
        const ex = e.examples[0]
        return {
          zh: ex?.zh || e.meaning,
          answer: ex?.en || e.text,
          hint: `套用句型：${pattern.pattern}`,
        }
      })
    while (patternItems.length < 2) {
      const e = actives[patternItems.length]
      if (!e) break
      patternItems.push({
        zh: e.examples[0]?.zh || e.meaning,
        answer: e.examples[0]?.en || e.text,
        hint: `套用句型：${pattern.pattern}`,
      })
    }
    if (patternItems.length >= 2) {
      pipeline.push({
        id: id(),
        type: 'pattern_drill',
        title: `${pattern.pattern} 句型操练`,
        pattern: pattern.pattern,
        patternMeaning: pattern.meaning,
        direction: 'zh_to_en',
        items: patternItems,
      })
    }
  }

  // 4) sentence decomposition on one full example
  const decompSrc = picks[0]
  if (decompSrc?.examples?.[0]) {
    const full = decompSrc.examples[0].en
    const fullZh = decompSrc.examples[0].zh
    const core = decompSrc.text.includes('___') ? decompSrc.text.replace('___', '...').replace(/\.\.\./, 'it') : decompSrc.text
    pipeline.push({
      id: id(),
      type: 'sentence_decomposition',
      title: `${decompSrc.text} 句子拆解`,
      sourceText: decompSrc.text,
      sourceKind: 'chunk',
      fullSentence: full,
      fullSentenceZh: fullZh,
      levels: [
        {
          level: 1,
          label: '核心句',
          en: core.endsWith('.') || core.endsWith('?') ? core : `${core}`,
          zh: decompSrc.meaning,
          highlight: '',
          hint: '先说出本课核心表达',
        },
        {
          level: 2,
          label: '完整句',
          en: full,
          zh: fullZh,
          highlight: full.replace(core.replace(/\.$/, ''), '').trim() || full,
          hint: '补上场景信息，说成一句完整话',
        },
      ],
    })
  }

  return {
    outputTraining: {
      enabled: true,
      version: 1,
      pipeline,
      materialUsage: {
        totals: { chunks: [], vocabs: [], patterns: [] },
        usedRefs: { chunkIds: [], vocabIds: [], patternIds: [] },
        itemStats: [],
      },
    },
  }
}

// ── write files ──
mkdirSync(join(OUT, 'teaching-docs'), { recursive: true })

const sceneCsv = [
  'category_name,title,location,required_output_level,required_user_level,description,package_type',
  csvLine([
    '基础口语',
    SCENE,
    '日常生活与生存开口',
    'L1',
    '1',
    '常用英语500句入门篇：在见面、点餐、购物、问路和求助中，用短语和简单句完成听懂与立即回应。',
    'foundation',
  ]),
].join('\n') + '\n'

const topicRows = [
  'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown_file,ink_script_key',
]
const chunkRows = [
  'scene_title,topic_title,text,sort_order',
]
const vocabRows = [
  'scene_title,topic_title,word,sort_order',
]
const patternRows = [
  'scene_title,topic_title,pattern,sort_order',
]
const warmup = {}

let totalChunks = 0
let totalActive = 0

topics.forEach((topic, ti) => {
  const mdName = `${topic.title}.md`
  writeFileSync(join(OUT, 'teaching-docs', mdName), buildTeachingMd(topic), 'utf8')

  topicRows.push(csvLine([
    SCENE,
    topic.title,
    topic.promptEn,
    topic.promptZh,
    String(topic.duration),
    'L1',
    topic.description,
    topic.knowledgePoints,
    mdName,
    '',
  ]))

  topic.expressions.forEach((expr, ei) => {
    totalChunks += 1
    if (expr.active) totalActive += 1
    chunkRows.push(csvLine([
      SCENE,
      topic.title,
      expr.text,
      String(ei + 1),
    ]))
  })

  topic.vocabs.forEach((word, vi) => {
    vocabRows.push(csvLine([
      SCENE,
      topic.title,
      word,
      String(vi + 1),
    ]))
  })

  topic.patterns.forEach((p, pi) => {
    patternRows.push(csvLine([
      SCENE,
      topic.title,
      p.pattern,
      String(pi + 1),
    ]))
  })

  warmup[topic.title] = buildWarmup(topic, ti)
})

writeFileSync(join(OUT, 'scenes.csv'), sceneCsv, 'utf8')
writeFileSync(join(OUT, 'training_topics.csv'), topicRows.join('\n') + '\n', 'utf8')
writeFileSync(join(OUT, 'chunks.csv'), chunkRows.join('\n') + '\n', 'utf8')
writeFileSync(join(OUT, 'scene_vocabulary.csv'), vocabRows.join('\n') + '\n', 'utf8')
writeFileSync(join(OUT, 'sentence_patterns.csv'), patternRows.join('\n') + '\n', 'utf8')
writeFileSync(join(OUT, 'warmup_pipeline.json'), JSON.stringify(warmup, null, 2), 'utf8')
writeFileSync(join(OUT, 'script_episodes.csv'), 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n', 'utf8')
writeFileSync(join(OUT, 'episode_chunks.csv'), 'episode_chapter,episode_order,chunk_text_match,sort_order\n', 'utf8')

const design = `# 常用英语500句 · 入门篇

## 管理信息

| 字段 | 值 |
| --- | --- |
| 管理状态 | ready |
| 用户标题 | 常用英语500句 · 入门篇 |
| 一级类型 | 零基础（\`foundation\`） |
| 二级主题 | 基础口语 |
| 内容体验 | 知识点练习（\`practice\`） |
| 所属系列 | 常用英语500句 |
| seriesSlug | \`common-english-expressions\` |
| 系列顺序 | 1 |
| 卷册名称 | 入门篇 |
| requiredOutputLevel | \`L1\` |
| requiredUserLevel | 1 |
| 前置学习包 | 无 |
| requiredPrevious | \`false\` |


## 包配置

- \`contentMode\`: \`practice\`
- \`packageType\`: \`foundation\`
- \`requiredOutputLevel\`: \`L1\`
- 规模：${totalChunks} 条表达；首轮优先开口 ${totalActive} 条

## 学习目标

学习者能在初次见面、点餐、购物、问路和基本求助中听懂常见表达，并用短语或简单句立即回应。

## 8 个场景组

1. 问候、告别与自我介绍（对齐原版「问候与寒暄」）
2. 感谢、简单道歉与回应
3. 点餐、数量与付款
4. 找商品、问价格与结账
5. 询问地点、方向和交通（对齐原版路上/找位置/交通相关短句）
6. 表达想要、需要和基本喜恶
7. 请求重复、说慢一点和确认听懂
8. 遇到困难时请求帮助

## 内容与训练标准

每组收录约 20 条表达，其中约 8–10 条标为「优先开口」。每课只新学 5–8 条，经过听辨、跟读、信息替换、两轮回应和变化场景复习。表达必须短、高频、低风险；较委婉或带语气色彩的说法放入后卷。

最终要求是在 8 秒内开始回答，并完成 2–4 轮基本交流，不要求一次背完全部表达。

## 文件清单

- \`scenes.csv\` / \`training_topics.csv\` / \`chunks.csv\`（仅 scene_title,topic_title,text,sort_order；释义/例句走语料库富化）
- \`scene_vocabulary.csv\`（仅 scene_title,topic_title,word,sort_order；释义/发音走语料库） / \`sentence_patterns.csv\`（仅 scene_title,topic_title,pattern,sort_order）
- \`warmup_pipeline.json\`（每话题含中译英、英译中、句型操练与句子拆解）
- \`teaching-docs/*.md\`（用户可见教学文档：意思、见解、例句、速查表）

## 数据说明

入门篇按「生存场景」重组，不整主题搬运旧包。旧包中可用的短句与高频回应（如 Anything else? / Keep the change. / Good luck. / My fault. / I see. / It doesn't work. 等）已对齐迁入；影视脏话、高冲突、低频表达不进入本卷。冲突时以本卷教学文档为准。
`

writeFileSync(join(OUT, 'teaching-docs', '00-课程总设计.md'), design, 'utf8')

console.log(`OK: ${topics.length} topics, ${totalChunks} chunks, ${totalActive} active`)
