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
 * @typedef {{ title: string, promptEn: string, promptZh: string, description: string, knowledgePoints: string, duration: number, goal: string, tip: string, expressions: Expr[], patterns: {pattern:string,meaning:string,slots:string,example:string}[], vocabs: {word:string,meaning:string,pos:string}[] }} Topic
 */

/** @type {Topic[]} */
const topics = [
  {
    title: '问候、告别与自我介绍',
    promptEn: 'Meet someone new. Greet them, introduce yourself, and say goodbye naturally.',
    promptZh: '认识新朋友：打招呼、自我介绍，并自然告别。',
    description: '用最短的问候和自我介绍打开对话，再用自然的告别收尾。',
    knowledgePoints: '问候；自我介绍；告别；近况回应',
    duration: 900,
    goal: '学习者能在初次见面时用短语和简单句打招呼、报出名字，并完成自然告别。',
    tip: '正式场合优先用 Hello / Nice to meet you；熟人可用 Hi / How\'s it going？回答 How are you? 不必长篇汇报，一句状态即可。',
    docIntro: '这份文档帮你收齐「见面怎么开场、怎么介绍自己、怎么道别」的常用说法。先看意思和什么时候用，例句拿来对照场景就行；标了「优先开口」的，平时最容易用到。',
    patterns: [
      { pattern: "I'm ___.", meaning: '我是…… / 我叫……', slots: '["name / role / feeling"]', example: "I'm Mina." },
      { pattern: 'Nice to meet you.', meaning: '初次见面的礼貌开场', slots: '[]', example: 'Nice to meet you.' },
      { pattern: 'See you ___.', meaning: '再见（可补时间）', slots: '["later / tomorrow / soon"]', example: 'See you later.' },
    ],
    vocabs: [
      { word: 'hello', meaning: '你好', pos: 'interjection' },
      { word: 'meet', meaning: '遇见；认识', pos: 'verb' },
      { word: 'name', meaning: '名字', pos: 'noun' },
      { word: 'fine', meaning: '还好；不错', pos: 'adjective' },
      { word: 'goodbye', meaning: '再见', pos: 'interjection' },
      { word: 'later', meaning: '稍后；待会', pos: 'adverb' },
      { word: 'morning', meaning: '早上', pos: 'noun' },
      { word: 'welcome', meaning: '欢迎', pos: 'interjection' },
    ],
    expressions: [
      {
        text: 'Hi.',
        meaning: '嗨 / 你好',
        insight: '最轻的打招呼，适合朋友、同事或轻松场合；第一次正式见面可改用 Hello。',
        active: true,
        examples: [
          { en: 'Hi! Are you free now?', zh: '嗨！你现在有空吗？' },
          { en: 'Hi, Mina. Long time no see.', zh: '嗨，Mina。好久不见。' },
        ],
      },
      {
        text: 'Hello.',
        meaning: '你好',
        insight: '比 Hi 稍正式一点，电话开场、服务窗口、初次见面都很稳妥。',
        active: true,
        examples: [
          { en: 'Hello. My name is Tom.', zh: '你好。我叫 Tom。' },
          { en: 'Hello, is this the front desk?', zh: '你好，请问是前台吗？' },
        ],
      },
      {
        text: 'Good morning.',
        meaning: '早上好',
        insight: '上午常用问候；下午用 Good afternoon，傍晚用 Good evening。注意 Good night 一般用于道别，不是见面问候。',
        active: false,
        examples: [
          { en: 'Good morning. How are you today?', zh: '早上好。你今天怎么样？' },
          { en: 'Good morning, everyone.', zh: '大家早上好。' },
        ],
      },
      {
        text: "How are you?",
        meaning: '你好吗？ / 最近怎么样？',
        insight: '见面寒暄，多数时候期待短回应，不是真要听完整汇报。',
        active: true,
        examples: [
          { en: 'Hi, Anna. How are you?', zh: '嗨，Anna。你好吗？' },
          { en: 'How are you? Long time no see.', zh: '你好吗？好久不见。' },
        ],
      },
      {
        text: "I'm fine, thanks.",
        meaning: '我还好，谢谢',
        insight: '回答 How are you? 的安全默认句；后面可再补一句近况。',
        active: true,
        examples: [
          { en: "I'm fine, thanks. And you?", zh: '我还好，谢谢。你呢？' },
          { en: "I'm fine, thanks. Just a little busy.", zh: '我还好，谢谢。只是有点忙。' },
        ],
      },
      {
        text: "Not bad.",
        meaning: '还不错 / 还行',
        insight: '比 I\'m fine 更随意，适合熟人；语气轻松，不表示很糟糕。',
        active: false,
        examples: [
          { en: 'How are you doing? — Not bad.', zh: '最近怎么样？——还行。' },
          { en: 'How was your day? — Not bad, actually.', zh: '今天怎么样？——其实还不错。' },
        ],
      },
      {
        text: "How's it going?",
        meaning: '最近怎么样？',
        insight: '熟人之间的轻松问法；回答同样简短即可。',
        active: false,
        examples: [
          { en: "Hey! How's it going?", zh: '嘿！最近怎么样？' },
          { en: "How's it going at work?", zh: '工作还顺利吗？' },
        ],
      },
      {
        text: "What's your name?",
        meaning: '你叫什么名字？',
        insight: '直接问名字；更礼貌时可说 May I have your name?，但入门先掌握这句。',
        active: false,
        examples: [
          { en: "Hi. What's your name?", zh: '你好。你叫什么名字？' },
          { en: "Sorry, what's your name again?", zh: '抱歉，你叫什么来着？' },
        ],
      },
      {
        text: "My name is ___.",
        meaning: '我叫……',
        insight: '自我介绍的标准句；口语里也常简化成 I\'m + 名字。',
        active: false,
        examples: [
          { en: 'My name is Li Wei.', zh: '我叫李伟。' },
          { en: "Hello. My name is Sara.", zh: '你好。我叫 Sara。' },
        ],
      },
      {
        text: "I'm ___.",
        meaning: '我是…… / 我叫……',
        insight: '最短自我介绍：可接名字、身份或当下状态。',
        active: true,
        examples: [
          { en: "I'm Ken.", zh: '我是 Ken。' },
          { en: "I'm a student here.", zh: '我是这里的学生。' },
        ],
      },
      {
        text: 'Nice to meet you.',
        meaning: '很高兴认识你',
        insight: '第一次见面的礼貌句；对方常回 Nice to meet you too。',
        active: true,
        examples: [
          { en: "Hi, I'm Amy. Nice to meet you.", zh: '嗨，我是 Amy。很高兴认识你。' },
          { en: 'This is my friend Ben. — Nice to meet you.', zh: '这是我朋友 Ben。——很高兴认识你。' },
        ],
      },
      {
        text: 'Nice to meet you too.',
        meaning: '我也很高兴认识你',
        insight: '回应 Nice to meet you 的固定搭配，几乎不用改。',
        active: false,
        examples: [
          { en: 'Nice to meet you. — Nice to meet you too.', zh: '很高兴认识你。——我也很高兴认识你。' },
          { en: 'Nice to meet you, Mr. Park. — Nice to meet you too.', zh: 'Park 先生，很高兴认识你。——我也是。' },
        ],
      },
      {
        text: 'This is ___.',
        meaning: '这位是……',
        insight: '介绍第三人时用；说完名字后，可补一句关系，如 my friend / my coworker。',
        active: false,
        examples: [
          { en: 'This is my friend Maya.', zh: '这位是我朋友 Maya。' },
          { en: 'Mom, this is Alex.', zh: '妈妈，这位是 Alex。' },
        ],
      },
      {
        text: 'Welcome.',
        meaning: '欢迎',
        insight: '欢迎对方到来；可单独说，也可说 Welcome to + 地点。',
        active: false,
        examples: [
          { en: 'Welcome! Please come in.', zh: '欢迎！请进。' },
          { en: 'Welcome to our class.', zh: '欢迎来到我们班。' },
        ],
      },
      {
        text: 'Goodbye.',
        meaning: '再见',
        insight: '通用告别；口语中熟人更常用 Bye / See you。',
        active: false,
        examples: [
          { en: 'Goodbye. Have a nice day.', zh: '再见。祝你今天愉快。' },
          { en: "I have to go. Goodbye!", zh: '我得走了。再见！' },
        ],
      },
      {
        text: 'Bye.',
        meaning: '再见',
        insight: 'Goodbye 的口语短式，轻松随意。',
        active: false,
        examples: [
          { en: 'Okay, bye!', zh: '好，再见！' },
          { en: 'Talk later. Bye.', zh: '回头聊。再见。' },
        ],
      },
      {
        text: 'See you.',
        meaning: '再见 / 回头见',
        insight: '默认还会再见；比 Goodbye 更轻。可扩展成 See you later / tomorrow。',
        active: true,
        examples: [
          { en: 'I need to run. See you!', zh: '我得走了。回头见！' },
          { en: "Class is over. See you tomorrow.", zh: '下课了。明天见。' },
        ],
      },
      {
        text: 'See you later.',
        meaning: '待会见',
        insight: '不一定真的“稍后立刻见”，常作自然告别。',
        active: false,
        examples: [
          { en: "I'm heading out. See you later.", zh: '我先走了。待会见。' },
          { en: 'See you later at the café.', zh: '待会咖啡馆见。' },
        ],
      },
      {
        text: 'Take care.',
        meaning: '保重 / 慢走',
        insight: '告别时表达关心；对方生病、赶路或分别时特别合适。',
        active: true,
        examples: [
          { en: "It's raining. Take care.", zh: '在下雨。路上小心。' },
          { en: 'Good night. Take care.', zh: '晚安。保重。' },
        ],
      },
      {
        text: 'Have a good day.',
        meaning: '祝你今天愉快',
        insight: '服务场景和服务后告别很常见；也可对同事、同学说。',
        active: false,
        examples: [
          { en: 'Thanks for your help. Have a good day.', zh: '谢谢你的帮助。祝你今天愉快。' },
          { en: 'Bye! Have a good day at work.', zh: '再见！祝你工作顺利。' },
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
    patterns: [
      { pattern: 'Thank you for ___.', meaning: '谢谢你……', slots: '["helping me / waiting / the coffee"]', example: 'Thank you for your help.' },
      { pattern: "I'm sorry.", meaning: '对不起', slots: '[]', example: "I'm sorry." },
      { pattern: "That's okay.", meaning: '没关系', slots: '[]', example: "That's okay." },
    ],
    vocabs: [
      { word: 'thank', meaning: '感谢', pos: 'verb' },
      { word: 'thanks', meaning: '谢谢', pos: 'noun' },
      { word: 'sorry', meaning: '抱歉的', pos: 'adjective' },
      { word: 'welcome', meaning: '别客气（回应感谢）', pos: 'adjective' },
      { word: 'problem', meaning: '问题；麻烦', pos: 'noun' },
      { word: 'excuse', meaning: '原谅；劳驾', pos: 'verb' },
      { word: 'please', meaning: '请', pos: 'adverb' },
      { word: 'sure', meaning: '当然；没问题', pos: 'adjective' },
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
        text: 'Of course.',
        meaning: '当然',
        insight: '爽快答应请求，或回应感谢时表示“这是应该的”。',
        active: false,
        examples: [
          { en: 'Could you help me? — Of course.', zh: '你能帮我吗？——当然。' },
          { en: 'Thanks again. — Of course.', zh: '再次谢谢。——应该的。' },
        ],
      },
      {
        text: 'Sure.',
        meaning: '好的 / 可以',
        insight: '最轻的答应词，点头附和、接受小请求都常用。',
        active: false,
        examples: [
          { en: 'Can I sit here? — Sure.', zh: '我可以坐这里吗？——可以。' },
          { en: 'Pass me the menu? — Sure.', zh: '把菜单递给我？——好。' },
        ],
      },
      {
        text: 'Please.',
        meaning: '请 / 麻烦了',
        insight: '让请求更礼貌；也可单独说，表示“拜托了”。',
        active: false,
        examples: [
          { en: 'A coffee, please.', zh: '请来杯咖啡。' },
          { en: 'Please wait a moment.', zh: '请稍等一下。' },
        ],
      },
      {
        text: 'Excuse me.',
        meaning: '劳驾 / 借过 / 抱歉打扰',
        insight: '引起注意、借过、礼貌打断都可以；比 Hey 更礼貌。',
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
      {
        text: 'I appreciate it.',
        meaning: '我很感激',
        insight: '比 Thanks 稍郑重一点，适合对方额外花了时间或精力时。',
        active: false,
        examples: [
          { en: 'Thanks for staying late. I appreciate it.', zh: '谢谢你加班留下来。我很感激。' },
          { en: 'You explained everything clearly. I appreciate it.', zh: '你解释得很清楚。谢谢。' },
        ],
      },
    ],
  },
  {
    title: '点餐、数量与付款',
    promptEn: 'Order food or drinks, talk about quantity, and pay the bill.',
    promptZh: '点餐或点饮料，说明数量，并完成付款。',
    description: '在咖啡店或餐厅用短句点单、确认数量并付款。',
    knowledgePoints: '点餐；数量；堂食外带；付款',
    duration: 900,
    goal: '学习者能独立完成一次简单点单：说出想要的东西、数量，并询问账单或支付方式。',
    tip: '点单常用 I\'d like... / Can I have...；先说物品，再补大小、数量、外带。结账说 The check, please. 或 Can I pay by card?',
    docIntro: '去咖啡店或餐厅时，点什么、要几份、堂食还是外带、怎么结账——这些短句都在这里。看一眼就能对上你常遇到的柜台对话。',
    patterns: [
      { pattern: "I'd like ___.", meaning: '我想要……', slots: '["a coffee / the soup / two tacos"]', example: "I'd like a latte." },
      { pattern: 'Can I have ___?', meaning: '可以给我……吗？', slots: '["a water / the bill / one more"]', example: 'Can I have a menu?' },
      { pattern: '___ , please.', meaning: '请给我……', slots: '["A coffee / The check / Two waters"]', example: 'A coffee, please.' },
    ],
    vocabs: [
      { word: 'order', meaning: '点单；订单', pos: 'noun' },
      { word: 'menu', meaning: '菜单', pos: 'noun' },
      { word: 'coffee', meaning: '咖啡', pos: 'noun' },
      { word: 'water', meaning: '水', pos: 'noun' },
      { word: 'bill', meaning: '账单', pos: 'noun' },
      { word: 'card', meaning: '卡；银行卡', pos: 'noun' },
      { word: 'cash', meaning: '现金', pos: 'noun' },
      { word: 'size', meaning: '尺寸；规格', pos: 'noun' },
    ],
    expressions: [
      {
        text: "I'd like ___.",
        meaning: '我想要……',
        insight: '点餐最常用礼貌句；比 I want 更得体。',
        active: true,
        examples: [
          { en: "I'd like a coffee, please.", zh: '我想要一杯咖啡。' },
          { en: "I'd like the chicken sandwich.", zh: '我想要鸡肉三明治。' },
        ],
      },
      {
        text: 'Can I have ___?',
        meaning: '可以给我……吗？',
        insight: '点单、要菜单、加水都很通用。',
        active: true,
        examples: [
          { en: 'Can I have a glass of water?', zh: '可以给我一杯水吗？' },
          { en: 'Can I have the menu, please?', zh: '可以给我菜单吗？' },
        ],
      },
      {
        text: 'A coffee, please.',
        meaning: '请来杯咖啡',
        insight: '名词 + please 是最短点单方式，柜台场景非常高频。',
        active: true,
        examples: [
          { en: 'A coffee, please. For here.', zh: '请来杯咖啡。堂食。' },
          { en: 'Two iced teas, please.', zh: '请来两杯冰茶。' },
        ],
      },
      {
        text: 'For here or to go?',
        meaning: '在这里用还是外带？',
        insight: '店员常问；听懂后用 For here / To go 回答即可。',
        active: true,
        examples: [
          { en: 'For here or to go? — To go, please.', zh: '堂食还是外带？——外带，谢谢。' },
          { en: 'Is that for here or to go?', zh: '是在这里用还是外带？' },
        ],
      },
      {
        text: 'To go, please.',
        meaning: '外带，谢谢',
        insight: '外带点单的标准回答；也可说 Takeout, please。',
        active: true,
        examples: [
          { en: 'To go, please. I\'m in a hurry.', zh: '外带，谢谢。我赶时间。' },
          { en: 'One burger to go, please.', zh: '一个汉堡外带，谢谢。' },
        ],
      },
      {
        text: 'For here, please.',
        meaning: '在这里用，谢谢',
        insight: '堂食回答；有时可说 Dine in。',
        active: false,
        examples: [
          { en: 'For here, please. I\'ll find a table.', zh: '堂食，谢谢。我去找座位。' },
          { en: 'Is this for here? — Yes, for here, please.', zh: '是堂食吗？——对，堂食。' },
        ],
      },
      {
        text: 'How much is it?',
        meaning: '多少钱？',
        insight: '问价格的万能短句；可指单品或整单。',
        active: true,
        examples: [
          { en: 'How much is it with tax?', zh: '含税多少钱？' },
          { en: 'Two coffees. How much is it?', zh: '两杯咖啡。一共多少钱？' },
        ],
      },
      {
        text: 'Are you ready to order?',
        meaning: '可以点餐了吗？',
        insight: '服务员常用问句；若还没好可说 Just a minute, please。',
        active: false,
        examples: [
          { en: 'Are you ready to order? — Yes. I\'d like the soup.', zh: '可以点餐了吗？——可以。我想要汤。' },
          { en: 'Are you ready to order, or do you need more time?', zh: '可以点了吗，还是再看一会？' },
        ],
      },
      {
        text: "That's all.",
        meaning: '就这些',
        insight: '点完后告诉对方不再加单。',
        active: true,
        examples: [
          { en: 'Anything else? — That\'s all. Thanks.', zh: '还要别的吗？——就这些，谢谢。' },
          { en: 'One tea and a muffin. That\'s all.', zh: '一杯茶和一个松饼。就这些。' },
        ],
      },
      {
        text: 'One more, please.',
        meaning: '请再来一份 / 再来一个',
        insight: '加单最短说法；可补具体物品：One more coffee, please。',
        active: false,
        examples: [
          { en: 'One more water, please.', zh: '请再来一杯水。' },
          { en: 'Can I get one more?', zh: '可以再来一份吗？' },
        ],
      },
      {
        text: 'Small, please.',
        meaning: '小杯 / 小号，谢谢',
        insight: '回答规格；也可说 Medium / Large, please。',
        active: false,
        examples: [
          { en: 'What size? — Small, please.', zh: '要什么规格？——小杯，谢谢。' },
          { en: 'A small latte, please.', zh: '请来一杯小拿铁。' },
        ],
      },
      {
        text: 'Without sugar, please.',
        meaning: '请不要加糖',
        insight: '说明偏好：Without + 不想要的东西。With milk 表示要加奶。',
        active: false,
        examples: [
          { en: 'Coffee without sugar, please.', zh: '请来杯不加糖的咖啡。' },
          { en: 'Can I have it without ice?', zh: '可以不要冰吗？' },
        ],
      },
      {
        text: 'With milk, please.',
        meaning: '请加奶',
        insight: '补充配料的短句模板：With + 想加的东西。',
        active: false,
        examples: [
          { en: 'Tea with milk, please.', zh: '请来杯加奶的茶。' },
          { en: 'I\'d like oatmeal with fruit, please.', zh: '我想要加水果的燕麦。' },
        ],
      },
      {
        text: 'The check, please.',
        meaning: '请结账 / 买单',
        insight: '美式常用 check；英式更常说 the bill。',
        active: true,
        examples: [
          { en: 'We\'re done. The check, please.', zh: '我们吃完了。请结账。' },
          { en: 'Can we get the check, please?', zh: '可以给我们账单吗？' },
        ],
      },
      {
        text: 'Can I pay by card?',
        meaning: '可以刷卡吗？',
        insight: '确认支付方式；也可说 Do you take cards?',
        active: true,
        examples: [
          { en: 'Can I pay by card? — Yes, of course.', zh: '可以刷卡吗？——当然可以。' },
          { en: 'Can I pay by card, or cash only?', zh: '可以刷卡吗，还是只收现金？' },
        ],
      },
      {
        text: 'Cash, please.',
        meaning: '付现金',
        insight: '说明支付方式；店员问 Cash or card? 时可直接回答。',
        active: false,
        examples: [
          { en: 'Cash or card? — Cash, please.', zh: '现金还是刷卡？——现金。' },
          { en: 'I\'ll pay cash, please.', zh: '我付现金。' },
        ],
      },
      {
        text: "Here's my card.",
        meaning: '这是我的卡',
        insight: '递卡付款时说；也可说 Here you go。',
        active: false,
        examples: [
          { en: "Here's my card. Please charge it.", zh: '这是我的卡。请刷这张。' },
          { en: "Here's my card for the deposit.", zh: '押金刷这张卡。' },
        ],
      },
      {
        text: 'Keep the change.',
        meaning: '不用找了',
        insight: '现金付款给小费或不需要找零时用。',
        active: false,
        examples: [
          { en: "That's twenty. Keep the change.", zh: '这是二十。不用找了。' },
          { en: 'Keep the change. Thanks for your help.', zh: '不用找了。谢谢帮忙。' },
        ],
      },
      {
        text: 'Water, please.',
        meaning: '请来杯水',
        insight: '餐厅高频短请求；可说 Still water / Sparkling water 若需要区分。',
        active: false,
        examples: [
          { en: 'Water, please. No ice.', zh: '请来杯水。不要冰。' },
          { en: 'Can we get some water, please?', zh: '可以给我们来点水吗？' },
        ],
      },
      {
        text: 'Is the tip included?',
        meaning: '小费包含在内了吗？',
        insight: '结账时确认是否已含服务费；入门能听懂并会问即可。',
        active: false,
        examples: [
          { en: 'Is the tip included in the bill?', zh: '账单里包含小费了吗？' },
          { en: 'Excuse me, is service included?', zh: '请问服务费包含了吗？' },
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
    docIntro: '进店找东西、问贵不贵、决定买不买、最后怎么付钱——购物里最常用的那几句，都整理在这份文档里了。',
    patterns: [
      { pattern: 'Where is ___?', meaning: '……在哪里？', slots: '["the milk / the fitting room"]', example: 'Where is the milk?' },
      { pattern: 'Do you have ___?', meaning: '你们有……吗？', slots: '["this in blue / a smaller size"]', example: 'Do you have this in medium?' },
      { pattern: "I'll take it.", meaning: '我要这个', slots: '[]', example: "I'll take it." },
    ],
    vocabs: [
      { word: 'price', meaning: '价格', pos: 'noun' },
      { word: 'size', meaning: '尺码', pos: 'noun' },
      { word: 'color', meaning: '颜色', pos: 'noun' },
      { word: 'receipt', meaning: '收据', pos: 'noun' },
      { word: 'bag', meaning: '袋子', pos: 'noun' },
      { word: 'sale', meaning: '打折；促销', pos: 'noun' },
      { word: 'expensive', meaning: '贵的', pos: 'adjective' },
      { word: 'cheap', meaning: '便宜的', pos: 'adjective' },
    ],
    expressions: [
      {
        text: 'Where is ___?',
        meaning: '……在哪里？',
        insight: '找货架、收银台、试衣间的最短问法。',
        active: true,
        examples: [
          { en: 'Where is the milk?', zh: '牛奶在哪里？' },
          { en: 'Excuse me, where is the fitting room?', zh: '请问试衣间在哪里？' },
        ],
      },
      {
        text: 'Do you have ___?',
        meaning: '你们有……吗？',
        insight: '确认有没有某商品、某颜色或某尺码。',
        active: true,
        examples: [
          { en: 'Do you have this in blue?', zh: '这件有蓝色的吗？' },
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
        text: 'Do you take cards?',
        meaning: '你们收卡吗？',
        insight: '进店或结账前确认支付方式。',
        active: false,
        examples: [
          { en: 'Do you take cards? — Yes, we do.', zh: '收卡吗？——收。' },
          { en: 'Do you take credit cards?', zh: '收信用卡吗？' },
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
    promptEn: 'Ask for directions, understand basic route words, and check transport info.',
    promptZh: '问路、听懂基本方向词，并确认交通信息。',
    description: '在街上或车站问地点、听懂左右直行，并确认怎么去。',
    knowledgePoints: '问路；方向；远近；公交地铁',
    duration: 900,
    goal: '学习者能问出目的地位置，听懂 turn left / go straight 等基本指引，并确认是否走对。',
    tip: '问路先说 Excuse me；核心句 Where is... / How do I get to...。听方向时抓住 left / right / straight / near。',
    docIntro: '迷路了、想找车站、听人指路时抓不住关键词？这里是问路和听方向最常用的说法，左右直行、远近、坐哪班车都有。',
    patterns: [
      { pattern: 'Where is the ___?', meaning: '……在哪里？', slots: '["station / bathroom / exit"]', example: 'Where is the station?' },
      { pattern: 'How do I get to ___?', meaning: '去……怎么走？', slots: '["the park / the hotel"]', example: 'How do I get to the museum?' },
      { pattern: 'Turn ___.', meaning: '向……转', slots: '["left / right"]', example: 'Turn left.' },
    ],
    vocabs: [
      { word: 'station', meaning: '车站', pos: 'noun' },
      { word: 'left', meaning: '左边；向左', pos: 'noun' },
      { word: 'right', meaning: '右边；向右', pos: 'noun' },
      { word: 'straight', meaning: '直行', pos: 'adverb' },
      { word: 'near', meaning: '附近的', pos: 'adjective' },
      { word: 'far', meaning: '远的', pos: 'adjective' },
      { word: 'bus', meaning: '公交车', pos: 'noun' },
      { word: 'map', meaning: '地图', pos: 'noun' },
    ],
    expressions: [
      {
        text: 'Where is the station?',
        meaning: '车站在哪里？',
        insight: 'Where is + 地点 是问路母句；station 可换成 bathroom / exit / hotel。',
        active: true,
        examples: [
          { en: 'Excuse me, where is the station?', zh: '请问，车站在哪里？' },
          { en: 'Where is the nearest subway station?', zh: '最近的地铁站在哪里？' },
        ],
      },
      {
        text: 'How do I get to ___?',
        meaning: '去……怎么走？',
        insight: '比 Where is 更强调路线；适合稍远或需要换乘时。',
        active: true,
        examples: [
          { en: 'How do I get to the museum?', zh: '去博物馆怎么走？' },
          { en: 'How do I get to the airport from here?', zh: '从这里去机场怎么走？' },
        ],
      },
      {
        text: 'Turn left.',
        meaning: '左转',
        insight: '基本方向指令；Turn right 是右转。',
        active: true,
        examples: [
          { en: 'Go straight and turn left.', zh: '直行然后左转。' },
          { en: 'At the light, turn left.', zh: '到红绿灯左转。' },
        ],
      },
      {
        text: 'Turn right.',
        meaning: '右转',
        insight: '与 Turn left 成对掌握即可覆盖大半步行指引。',
        active: true,
        examples: [
          { en: 'Turn right at the corner.', zh: '在拐角右转。' },
          { en: 'Then turn right. You\'ll see the bank.', zh: '然后右转。你会看到银行。' },
        ],
      },
      {
        text: 'Go straight.',
        meaning: '直行',
        insight: '最常见的路线词之一；可说 Go straight ahead。',
        active: true,
        examples: [
          { en: 'Go straight for two blocks.', zh: '直行过两个街区。' },
          { en: 'Don\'t turn. Just go straight.', zh: '别转弯。一直走。' },
        ],
      },
      {
        text: 'Is it far?',
        meaning: '远吗？',
        insight: '确认步行是否可行；对方常答 It\'s near / About five minutes。',
        active: true,
        examples: [
          { en: 'Is it far from here?', zh: '离这里远吗？' },
          { en: 'Is the hotel far? Can I walk?', zh: '酒店远吗？我能走着去吗？' },
        ],
      },
      {
        text: "It's near here.",
        meaning: '就在附近',
        insight: '表示不远；也可说 It\'s close / It\'s right here。',
        active: false,
        examples: [
          { en: "Don't worry. It's near here.", zh: '别担心。就在附近。' },
          { en: "The café is near here, on the left.", zh: '咖啡店就在附近，在左边。' },
        ],
      },
      {
        text: "It's on the left.",
        meaning: '在左边',
        insight: '定位建筑物；右边用 on the right。',
        active: true,
        examples: [
          { en: "The entrance is on the left.", zh: '入口在左边。' },
          { en: "You'll see a park on the right.", zh: '你会在右边看到一个公园。' },
        ],
      },
      {
        text: 'Next to the bank.',
        meaning: '在银行旁边',
        insight: '用参照物定位：next to / across from / behind。',
        active: false,
        examples: [
          { en: 'The pharmacy is next to the bank.', zh: '药店在银行旁边。' },
          { en: 'It\'s next to the convenience store.', zh: '就在便利店旁边。' },
        ],
      },
      {
        text: 'Across from the park.',
        meaning: '在公园对面',
        insight: '隔街相对的位置关系。',
        active: false,
        examples: [
          { en: 'The hotel is across from the park.', zh: '酒店在公园对面。' },
          { en: 'It\'s across from the station exit.', zh: '就在车站出口对面。' },
        ],
      },
      {
        text: 'Which bus should I take?',
        meaning: '我该坐哪路公交？',
        insight: '确认交通线路；地铁可说 Which train / line?',
        active: true,
        examples: [
          { en: 'Which bus should I take to the library?', zh: '去图书馆该坐哪路公交？' },
          { en: 'Excuse me, which bus goes downtown?', zh: '请问哪路车去市中心？' },
        ],
      },
      {
        text: 'How long does it take?',
        meaning: '要多久？',
        insight: '问路程时间；回答常是 About 10 minutes。',
        active: false,
        examples: [
          { en: 'How long does it take by bus?', zh: '坐公交要多久？' },
          { en: 'How long does it take to walk there?', zh: '走过去要多久？' },
        ],
      },
      {
        text: "I'm lost.",
        meaning: '我迷路了',
        insight: '明确说明困境，方便对方主动指路。',
        active: true,
        examples: [
          { en: "Excuse me, I'm lost. Where is Main Street?", zh: '请问，我迷路了。主街在哪？' },
          { en: "I think I'm lost. Can you help me?", zh: '我好像迷路了。你能帮我吗？' },
        ],
      },
      {
        text: 'Can you show me on the map?',
        meaning: '能在地图上指给我看吗？',
        insight: '语言不够时用地图辅助，非常实用。',
        active: false,
        examples: [
          { en: 'Can you show me on the map, please?', zh: '能在地图上指给我看吗？' },
          { en: 'I have a map. Can you show me?', zh: '我有地图。你能指一下吗？' },
        ],
      },
      {
        text: 'Is this the way to ___?',
        meaning: '这条路是去……的吗？',
        insight: '边走边确认，避免走错。',
        active: false,
        examples: [
          { en: 'Is this the way to the station?', zh: '这条路是去车站的吗？' },
          { en: 'Excuse me, is this the way to Gate 3?', zh: '请问，这是去 3 号门的路吗？' },
        ],
      },
      {
        text: 'Over there.',
        meaning: '在那边',
        insight: '近指用 here，远指用 over there；常配手势。',
        active: false,
        examples: [
          { en: 'The restroom is over there.', zh: '洗手间在那边。' },
          { en: 'Look over there. That\'s the exit.', zh: '看那边。那是出口。' },
        ],
      },
      {
        text: 'This way, please.',
        meaning: '请这边走',
        insight: '引导他人时说；被引导时听懂即可跟随。',
        active: false,
        examples: [
          { en: 'This way, please. Follow me.', zh: '请这边走。跟我来。' },
          { en: 'Your table is ready. This way, please.', zh: '您的位子好了。请这边。' },
        ],
      },
      {
        text: 'Get off here.',
        meaning: '在这里下车',
        insight: '公交/地铁到站提示；你也可问 Do I get off here?',
        active: false,
        examples: [
          { en: 'This is your stop. Get off here.', zh: '到站了。在这里下车。' },
          { en: 'Should I get off here for the museum?', zh: '去博物馆是在这里下车吗？' },
        ],
      },
      {
        text: 'Two stops from here.',
        meaning: '从这里再过两站',
        insight: '用站数描述距离，比分钟更具体。',
        active: false,
        examples: [
          { en: 'The library is two stops from here.', zh: '图书馆从这里再过两站。' },
          { en: 'Get off in two stops.', zh: '再过两站下车。' },
        ],
      },
      {
        text: 'Excuse me, where is the bathroom?',
        meaning: '请问洗手间在哪里？',
        insight: '超高频生活句；美式 bathroom，英式常说 toilet / restroom。',
        active: true,
        examples: [
          { en: 'Excuse me, where is the bathroom?', zh: '请问洗手间在哪里？' },
          { en: 'Where is the restroom on this floor?', zh: '这层洗手间在哪？' },
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
    docIntro: '想要什么、需要什么、喜不喜欢、答应对方还是礼貌拒绝——把这些「我的想法」说清楚，用的就是下面这些短句。',
    patterns: [
      { pattern: 'I want ___.', meaning: '我想要……', slots: '["water / to go home"]', example: 'I want some water.' },
      { pattern: 'I need ___.', meaning: '我需要……', slots: '["help / a break"]', example: 'I need help.' },
      { pattern: 'I like ___.', meaning: '我喜欢……', slots: '["tea / this song"]', example: 'I like this.' },
    ],
    vocabs: [
      { word: 'want', meaning: '想要', pos: 'verb' },
      { word: 'need', meaning: '需要', pos: 'verb' },
      { word: 'like', meaning: '喜欢', pos: 'verb' },
      { word: 'love', meaning: '很喜欢；爱', pos: 'verb' },
      { word: 'prefer', meaning: '更喜欢', pos: 'verb' },
      { word: 'hungry', meaning: '饿的', pos: 'adjective' },
      { word: 'thirsty', meaning: '渴的', pos: 'adjective' },
      { word: 'tired', meaning: '累的', pos: 'adjective' },
    ],
    expressions: [
      {
        text: 'I want ___.',
        meaning: '我想要……',
        insight: '直接表达愿望；对店员或正式场合，优先改用 I\'d like。',
        active: true,
        examples: [
          { en: 'I want some water.', zh: '我想要点水。' },
          { en: 'I want to go home now.', zh: '我现在想回家。' },
        ],
      },
      {
        text: "I'd like ___.",
        meaning: '我想要……（更礼貌）',
        insight: '比 I want 更得体，点单和提请求时优先用。',
        active: true,
        examples: [
          { en: "I'd like a quiet table.", zh: '我想要一张安静的桌子。' },
          { en: "I'd like to try this one.", zh: '我想试试这个。' },
        ],
      },
      {
        text: 'I need ___.',
        meaning: '我需要……',
        insight: '强调必要性，不只是想要；常用于求助或说明困难。',
        active: true,
        examples: [
          { en: 'I need help with this form.', zh: '我需要有人帮我填这张表。' },
          { en: 'I need a minute.', zh: '我需要一分钟。' },
        ],
      },
      {
        text: 'I like ___.',
        meaning: '我喜欢……',
        insight: '表达喜好；否定用 I don\'t like。',
        active: true,
        examples: [
          { en: 'I like this song.', zh: '我喜欢这首歌。' },
          { en: 'I like tea more than coffee.', zh: '比起咖啡，我更喜欢茶。' },
        ],
      },
      {
        text: "I don't like ___.",
        meaning: '我不喜欢……',
        insight: '直接但不攻击；可补 very much / that much 来减弱语气。',
        active: true,
        examples: [
          { en: "I don't like spicy food.", zh: '我不喜欢辣的。' },
          { en: "I don't like this color very much.", zh: '我不太喜欢这个颜色。' },
        ],
      },
      {
        text: 'I love it.',
        meaning: '我太喜欢了',
        insight: '比 I like 程度更强，用于明确的正面评价。',
        active: false,
        examples: [
          { en: 'This cake is great. I love it!', zh: '这蛋糕太棒了。我超喜欢！' },
          { en: 'Do you like the view? — I love it.', zh: '你喜欢这景色吗？——太喜欢了。' },
        ],
      },
      {
        text: 'Do you like ___?',
        meaning: '你喜欢……吗？',
        insight: '开启偏好话题；回答可用 Yes / Not really / It\'s okay。',
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
        text: 'I prefer ___.',
        meaning: '我更喜欢……',
        insight: '在两个选项里做选择时比 I like 更精准。',
        active: false,
        examples: [
          { en: 'I prefer tea.', zh: '我更喜欢茶。' },
          { en: 'I prefer the window seat.', zh: '我更喜欢靠窗的座位。' },
        ],
      },
      {
        text: "I'm hungry.",
        meaning: '我饿了',
        insight: '状态短句，常用来提议吃饭。',
        active: false,
        examples: [
          { en: "I'm hungry. Let's eat.", zh: '我饿了。我们吃饭吧。' },
          { en: "Are you hungry too?", zh: '你也饿了吗？' },
        ],
      },
      {
        text: "I'm thirsty.",
        meaning: '我渴了',
        insight: '搭配 Can I have some water? 很自然。',
        active: false,
        examples: [
          { en: "I'm thirsty. Can I have some water?", zh: '我渴了。可以喝点水吗？' },
          { en: "I'm so thirsty after the walk.", zh: '走完路我太渴了。' },
        ],
      },
      {
        text: "I'm tired.",
        meaning: '我累了',
        insight: '说明状态，可用来婉拒继续活动。',
        active: false,
        examples: [
          { en: "I'm tired. Can we go home?", zh: '我累了。我们能回家吗？' },
          { en: "I'm a little tired today.", zh: '我今天有点累。' },
        ],
      },
      {
        text: "That's fine.",
        meaning: '可以 / 没问题',
        insight: '接受方案或表示不挑剔。',
        active: false,
        examples: [
          { en: 'Is 3 p.m. okay? — That\'s fine.', zh: '下午三点可以吗？——可以。' },
          { en: "We only have tea. — That's fine.", zh: '我们只有茶。——没关系。' },
        ],
      },
      {
        text: 'Perfect.',
        meaning: '太好了 / 正好',
        insight: '对结果非常满意时的短回应。',
        active: false,
        examples: [
          { en: 'I found two seats together. — Perfect!', zh: '我找到两个一起的座位。——太好了！' },
          { en: 'Does 10 work? — Perfect.', zh: '十点可以吗？——正好。' },
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
        text: 'Maybe later.',
        meaning: '也许稍后再说',
        insight: '既不立刻答应也不强硬拒绝，给自己留空间。',
        active: false,
        examples: [
          { en: 'Want to watch a movie? — Maybe later.', zh: '想看电影吗？——也许稍后再说。' },
          { en: 'Coffee now? — Maybe later. I\'m okay.', zh: '现在喝咖啡？——晚点吧。我还好。' },
        ],
      },
      {
        text: "I don't mind.",
        meaning: '我不介意 / 都可以',
        insight: '表示没有强烈偏好，把选择权交给对方。',
        active: false,
        examples: [
          { en: 'Tea or coffee? — I don\'t mind.', zh: '茶还是咖啡？——都可以。' },
          { en: 'Window or aisle? — I don\'t mind.', zh: '靠窗还是靠过道？——我不介意。' },
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
    patterns: [
      { pattern: 'Can you ___?', meaning: '你能……吗？', slots: '["repeat that / say that again / speak slowly"]', example: 'Can you repeat that?' },
      { pattern: 'What does ___ mean?', meaning: '……是什么意思？', slots: '["this word / that"]', example: 'What does this mean?' },
      { pattern: 'Do you mean ___?', meaning: '你是说……吗？', slots: '["tomorrow / this one"]', example: 'Do you mean tomorrow?' },
    ],
    vocabs: [
      { word: 'repeat', meaning: '重复', pos: 'verb' },
      { word: 'slowly', meaning: '慢慢地', pos: 'adverb' },
      { word: 'understand', meaning: '理解', pos: 'verb' },
      { word: 'mean', meaning: '意思是', pos: 'verb' },
      { word: 'again', meaning: '再一次', pos: 'adverb' },
      { word: 'check', meaning: '核对；检查', pos: 'verb' },
      { word: 'right', meaning: '对的', pos: 'adjective' },
      { word: 'write', meaning: '写', pos: 'verb' },
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
        text: 'Do you mean ___?',
        meaning: '你是说……吗？',
        insight: '用猜测确认，比反复让对方重说更高效。',
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
          { en: 'Turn left at the light. — Got it.', zh: '到红绿灯左转。——明白了。' },
          { en: 'So we meet at six. Got it.', zh: '所以我们六点见。明白了。' },
        ],
      },
      {
        text: 'I see.',
        meaning: '我懂了 / 原来如此',
        insight: '表示理解对方说明；不一定等于完全同意。',
        active: false,
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
        text: 'How do you say ___ in English?',
        meaning: '……用英语怎么说？',
        insight: '主动索取表达，学习场景和生活场景都适用。',
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
        text: "I didn't catch that.",
        meaning: '我没听清',
        insight: '比 I don\'t understand 更强调“没听见”，适合噪音大或语速快。',
        active: false,
        examples: [
          { en: "Sorry, I didn't catch that. One more time?", zh: '抱歉，我没听清。再说一遍？' },
          { en: "I didn't catch the last part.", zh: '最后一部分我没听清。' },
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
    docIntro: '东西找不到、身体不舒服、英语一时卡住——需要开口求助时，先看这里。短句够用，把问题说清楚就行。',
    patterns: [
      { pattern: 'Can you help me?', meaning: '你能帮我吗？', slots: '[]', example: 'Can you help me?' },
      { pattern: "I can't find ___.", meaning: '我找不到……', slots: '["my phone / the gate"]', example: "I can't find my bag." },
      { pattern: 'I have a problem.', meaning: '我有个问题 / 麻烦', slots: '[]', example: 'I have a problem.' },
    ],
    vocabs: [
      { word: 'help', meaning: '帮助', pos: 'noun' },
      { word: 'problem', meaning: '问题', pos: 'noun' },
      { word: 'lost', meaning: '丢失的；迷路的', pos: 'adjective' },
      { word: 'find', meaning: '找到', pos: 'verb' },
      { word: 'sick', meaning: '不舒服的', pos: 'adjective' },
      { word: 'urgent', meaning: '紧急的', pos: 'adjective' },
      { word: 'phone', meaning: '手机', pos: 'noun' },
      { word: 'wait', meaning: '等待', pos: 'verb' },
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
        text: 'Excuse me.',
        meaning: '打扰一下',
        insight: '求助前先礼貌引起注意，再进入正题。',
        active: true,
        examples: [
          { en: 'Excuse me. Can you help me?', zh: '打扰一下。你能帮我吗？' },
          { en: 'Excuse me, is anyone working here?', zh: '请问，这里有工作人员吗？' },
        ],
      },
      {
        text: "I can't find ___.",
        meaning: '我找不到……',
        insight: '说明丢失或找不到的对象：phone / bag / gate / room。',
        active: true,
        examples: [
          { en: "I can't find my phone.", zh: '我找不到手机。' },
          { en: "I can't find my hotel on the map.", zh: '我在地图上找不到酒店。' },
        ],
      },
      {
        text: 'I lost my ___.',
        meaning: '我丢了……',
        insight: '明确“丢失”；比 can\'t find 更肯定已经不在身边。',
        active: true,
        examples: [
          { en: 'I lost my wallet.', zh: '我钱包丢了。' },
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
        text: 'Where is the bathroom?',
        meaning: '洗手间在哪里？',
        insight: '困难场景里的刚需句；紧急时同样适用。',
        active: true,
        examples: [
          { en: 'Where is the bathroom, please?', zh: '请问洗手间在哪里？' },
          { en: 'I need the bathroom. Where is it?', zh: '我要去洗手间。在哪里？' },
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
        text: 'Wait a minute.',
        meaning: '等一下',
        insight: '争取时间找人、找东西或想词。',
        active: false,
        examples: [
          { en: 'Wait a minute. Let me check.', zh: '等一下。我确认一下。' },
          { en: 'Wait a minute, please. I\'ll be right back.', zh: '请等一下。我马上回来。' },
        ],
      },
      {
        text: 'Is anyone here?',
        meaning: '这里有人吗？',
        insight: '柜台空无、需要工作人员时用。',
        active: false,
        examples: [
          { en: 'Hello? Is anyone here?', zh: '你好？这里有人吗？' },
          { en: 'Is anyone here to help with check-in?', zh: '有人帮忙办理入住吗？' },
        ],
      },
      {
        text: 'Call the police.',
        meaning: '报警',
        insight: '紧急安全问题；入门阶段能听懂并会说这句即可。',
        active: false,
        examples: [
          { en: 'Please call the police.', zh: '请报警。' },
          { en: 'Someone stole my bag. Call the police!', zh: '有人偷了我的包。报警！' },
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
    const sample = expr.examples[0]?.en?.replace(/\|/g, '\\|') || ''
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
  'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json',
]
const vocabRows = [
  'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order',
]
const patternRows = [
  'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order',
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

  topic.expressions.forEach((expr) => {
    totalChunks += 1
    if (expr.active) totalActive += 1
    chunkRows.push(csvLine([
      SCENE,
      topic.title,
      '核心句块',
      expr.text,
      expr.meaning,
      'L1',
      expr.active ? '优先开口' : '听辨复习',
      examplesJson(expr.examples),
    ]))
  })

  topic.vocabs.forEach((v, vi) => {
    vocabRows.push(csvLine([
      SCENE,
      topic.title,
      v.word,
      v.meaning,
      v.pos,
      '',
      '',
      'L1',
      '',
      '[]',
      String(vi + 1),
    ]))
  })

  topic.patterns.forEach((p, pi) => {
    patternRows.push(csvLine([
      SCENE,
      topic.title,
      p.pattern,
      p.meaning,
      p.slots,
      p.example,
      'L1',
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

1. 问候、告别与自我介绍
2. 感谢、简单道歉与回应
3. 点餐、数量与付款
4. 找商品、问价格与结账
5. 询问地点、方向和交通
6. 表达想要、需要和基本喜恶
7. 请求重复、说慢一点和确认听懂
8. 遇到困难时请求帮助

## 内容与训练标准

每组收录约 20 条表达，其中约 8–10 条标为「优先开口」。每课只新学 5–8 条，经过听辨、跟读、信息替换、两轮回应和变化场景复习。表达必须短、高频、低风险；较委婉或带语气色彩的说法放入后卷。

最终要求是在 8 秒内开始回答，并完成 2–4 轮基本交流，不要求一次背完全部表达。

## 文件清单

- \`scenes.csv\` / \`training_topics.csv\` / \`chunks.csv\`
- \`scene_vocabulary.csv\` / \`sentence_patterns.csv\`
- \`warmup_pipeline.json\`（每话题含中译英、英译中、句型操练与句子拆解）
- \`teaching-docs/*.md\`（用户可见教学文档：意思、见解、例句、速查表）

## 数据说明

本卷为新编入门内容，不以旧包 \`difficulty\` 标签自动切分。旧包「常用英语500句」仅作迁移核对；冲突时以本卷教学文档为准。
`

writeFileSync(join(OUT, 'teaching-docs', '00-课程总设计.md'), design, 'utf8')

console.log(`OK: ${topics.length} topics, ${totalChunks} chunks, ${totalActive} active`)
