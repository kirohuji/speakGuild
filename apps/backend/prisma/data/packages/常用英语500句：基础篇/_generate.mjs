/**
 * 一次性生成基础篇 CSV / MD / warmup_pipeline.json
 * 运行：node _generate.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCENE = '常用英语500句 · 基础篇'
const OUT = __dirname

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvLine(cols) {
  return cols.map(csvEscape).join(',')
}

/**
 * @typedef {{ text: string, meaning: string, insight: string, active?: boolean, examples: {en:string,zh:string}[], vocabs?: string[], pattern?: string }} Expr
 * @typedef {{ title: string, promptEn: string, promptZh: string, description: string, knowledgePoints: string, duration: number, goal: string, tip: string, docIntro: string, expressions: Expr[], patterns: {pattern:string,meaning:string,slots:string,example:string}[], vocabs: string[] }} Topic
 */

/** @type {Topic[]} */
const topics = [
  {
    title: "澄清、确认与补充问题",
    promptEn: "Clarify meaning, confirm details, and ask follow-up questions.",
    promptZh: "澄清意思、确认细节，并追问补充信息。",
    description: "在预约或计划沟通中听不懂、不确定时，主动澄清并确认对方意图。",
    knowledgePoints: "澄清意思；确认细节；不确定回应；补充追问",
    duration: 900,
    goal: "学习者能在信息不清楚时礼貌追问、确认，并用短句表达不确定。",
    tip: "",
    docIntro: "这一课练「没听清 / 没听懂 / 还不确定」时怎么开口：澄清、确认、追问下一步，而不是假装听懂。",
    patterns: [
      {
        pattern: "What do you mean by ___?",
        meaning: "你说的___是什么意思？",
        slots: "词语或安排",
        example: "What do you mean by 'flexible time'?",
      },
      {
        pattern: "May I ask ___?",
        meaning: "我可以问___吗？",
        slots: "问题",
        example: "May I ask a few questions about the booking?",
      }
    ],
    vocabs: [
      "mean", "pardon", "miss", "serious", "kidding", "sure", "depend", "gotcha",
      "question", "possible", "confirm", "detail", "clarify", "follow-up",
    ],
    expressions: [
      {
        text: "What do you mean?",
        meaning: "你什么意思？",
        insight: "原版短句。没听懂对方意图时直接澄清；语气要中性，避免听起来像质问。",
        active: true,
        examples: [
          { en: "What do you mean by 'maybe next week'?", zh: "你说「也许下周」是什么意思？" },
          { en: "Sorry—what do you mean?", zh: "抱歉——你是什么意思？" },
        ],
      },
      {
        text: "I beg your pardon.",
        meaning: "你能再说一遍吗 / 请再说一遍",
        insight: "原版短句。正式一点的「请再说一遍」；也可表达轻微惊讶。",
        active: true,
        examples: [
          { en: "I beg your pardon? Could you say that again?", zh: "请再说一遍？你能再说一次吗？" },
          { en: "I beg your pardon—I didn't catch the time.", zh: "请再说一遍——我没听清时间。" },
        ],
      },
      {
        text: "What did I miss?",
        meaning: "我错过什么啦？",
        insight: "原版短句。中途加入或漏听信息时用；适合会议、群聊或改期说明。",
        active: false,
        examples: [
          { en: "I just joined. What did I miss?", zh: "我刚进来。我错过什么了？" },
          { en: "Wait—what did I miss about the reservation?", zh: "等等——预约那边我漏听了什么？" },
        ],
      },
      {
        text: "Where were we?",
        meaning: "我们说到哪了？",
        insight: "原版短句。被打断后把话题拉回；比重新开场更自然。",
        active: false,
        examples: [
          { en: "Sorry about the call. Where were we?", zh: "抱歉接了个电话。我们说到哪了？" },
          { en: "Okay, back. Where were we on the plan?", zh: "好，回来了。计划说到哪了？" },
        ],
      },
      {
        text: "Is that so?",
        meaning: "是这样吗？",
        insight: "原版短句。轻确认或带一点惊讶；后面常接追问。",
        active: false,
        examples: [
          { en: "The room is unavailable? Is that so?", zh: "房间没空？是这样吗？" },
          { en: "Is that so? Then what should we do?", zh: "是这样吗？那我们该怎么办？" },
        ],
      },
      {
        text: "Are you serious?",
        meaning: "你是认真的吗？",
        insight: "原版短句。对意外信息表示难以置信；注意语气，别显得冲。",
        active: true,
        examples: [
          { en: "They cancelled the booking? Are you serious?", zh: "他们取消预约了？你是认真的吗？" },
          { en: "Are you serious about moving it to Friday?", zh: "你是认真要把时间改到周五吗？" },
        ],
      },
      {
        text: "Are you kidding?",
        meaning: "你在开玩笑吧？",
        insight: "原版短句。更口语的惊讶；熟人间用，正式场合慎用。",
        active: false,
        examples: [
          { en: "No rooms left? Are you kidding?", zh: "没房了？你在开玩笑吧？" },
          { en: "Are you kidding? That was our only slot.", zh: "开玩笑吧？那是我们唯一的时段。" },
        ],
      },
      {
        text: "What's going on?",
        meaning: "怎么回事？",
        insight: "原版短句。感觉情况不对时先摸清状况；适合延误、故障或突发变化。",
        active: true,
        examples: [
          { en: "The app won't load. What's going on?", zh: "应用打不开。怎么回事？" },
          { en: "Hey, what's going on with tonight's plan?", zh: "嘿，今晚的计划怎么回事？" },
        ],
      },
      {
        text: "I'm not sure yet.",
        meaning: "我还不确定",
        insight: "原版短句。还没想好或信息不够时诚实说明；可补 I'll check and confirm。",
        active: true,
        examples: [
          { en: "Can we confirm Friday? — I'm not sure yet.", zh: "周五能定吗？——我还不确定。" },
          { en: "I'm not sure yet. Let me check my calendar.", zh: "我还不确定。我先看一下日历。" },
        ],
      },
      {
        text: "I don't know for sure.",
        meaning: "我不是很确定",
        insight: "原版短句。比 I'm not sure 更强调「没把握」；避免给错承诺。",
        active: false,
        examples: [
          { en: "Will the repair finish today? — I don't know for sure.", zh: "今天能修好吗？——我不是很确定。" },
          { en: "I don't know for sure. I'll ask the front desk.", zh: "我不是很确定。我去问前台。" },
        ],
      },
      {
        text: "Hard to say.",
        meaning: "很难说",
        insight: "原版短句。无法简单判断时用；后面可给一个倾向。",
        active: false,
        examples: [
          { en: "Will traffic be bad? — Hard to say.", zh: "会堵车吗？——很难说。" },
          { en: "Hard to say. It depends on the weather.", zh: "很难说。要看天气。" },
        ],
      },
      {
        text: "That depends.",
        meaning: "那得看情况",
        insight: "原版短句。回答「能不能 / 要不要」前先设条件；常接 on...。",
        active: true,
        examples: [
          { en: "Can we reschedule? — That depends on my shift.", zh: "能改期吗？——要看我班次。" },
          { en: "That depends. What time works for you?", zh: "那得看情况。你什么时间方便？" },
        ],
      },
      {
        text: "Then what?",
        meaning: "然后呢？",
        insight: "原版短句。追问下一步；适合计划变化后继续推进。",
        active: false,
        examples: [
          { en: "The flight is delayed. Then what?", zh: "航班延误了。然后呢？" },
          { en: "Okay, we cancel tonight. Then what?", zh: "好，今晚取消。然后呢？" },
        ],
      },
      {
        text: "Gotcha.",
        meaning: "明白了",
        insight: "原版短句。确认听懂的轻松说法；正式场合可用 I see / Understood。",
        active: true,
        examples: [
          { en: "So we meet at three. — Gotcha.", zh: "那我们三点见。——明白了。" },
          { en: "Gotcha. I'll update the booking.", zh: "明白了。我会更新预约。" },
        ],
      },
      {
        text: "May I ask some questions?",
        meaning: "我可以问几个问题吗？",
        insight: "原版短句。开始追问前的礼貌铺垫；适合预约、入住或课程咨询。",
        active: false,
        examples: [
          { en: "Before we book, may I ask some questions?", zh: "预约前，我可以问几个问题吗？" },
          { en: "May I ask some questions about the cancellation policy?", zh: "我可以问几个关于取消政策的问题吗？" },
        ],
      },
      {
        text: "Hold on, let me think.",
        meaning: "等等，让我想一下",
        insight: "原版短句。需要时间思考时先占住话轮；比沉默更礼貌。",
        active: true,
        examples: [
          { en: "Which date? — Hold on, let me think.", zh: "哪个日期？——等等，让我想一下。" },
          { en: "Hold on, let me think. Tuesday might work.", zh: "等等，让我想一下。周二可能可以。" },
        ],
      },
      {
        text: "How is that possible?",
        meaning: "怎么可能呢？",
        insight: "原版短句。对不合理结果表示困惑；可接着澄清事实。",
        active: false,
        examples: [
          { en: "The key doesn't work. How is that possible?", zh: "钥匙打不开。怎么可能呢？" },
          { en: "How is that possible? We confirmed yesterday.", zh: "怎么可能？我们昨天确认过了。" },
        ],
      },
      {
        text: "Why didn't you tell me?",
        meaning: "你为什么不告诉我？",
        insight: "原版短句。信息滞后时的追问；语气容易冲，可软化表达。",
        active: false,
        examples: [
          { en: "The meeting moved. Why didn't you tell me?", zh: "会议改了。你为什么不告诉我？" },
          { en: "Why didn't you tell me about the delay?", zh: "延误的事你为什么不告诉我？" },
        ],
      },
      {
        text: "What's the word for it?",
        meaning: "那个字怎么说来着？",
        insight: "原版短句。一时卡词时求助；也可用 How do you say...?",
        active: false,
        examples: [
          { en: "The thing for unlocking—what's the word for it?", zh: "用来开锁的那个——那个词怎么说来着？" },
          { en: "What's the word for it in English?", zh: "那个用英语怎么说？" },
        ],
      },
      {
        text: "Is that what you want?",
        meaning: "这就是你想要的吗？",
        insight: "原版短句。方案确认收口；避免按自己猜测执行。",
        active: false,
        examples: [
          { en: "A morning slot on Friday—is that what you want?", zh: "周五上午时段——这是你想要的吗？" },
          { en: "Is that what you want, or should we change it?", zh: "这是你想要的，还是我们改一下？" },
        ],
      }
    ],
  },
  {
    title: "邀请、接受、拒绝和改期",
    promptEn: "Invite someone, accept or decline, and reschedule politely.",
    promptZh: "发出邀请，接受或拒绝，并礼貌改期。",
    description: "在约见、聚餐或同行安排中提出邀请，并处理接受、拒绝与灵活改期。",
    knowledgePoints: "发出邀请；接受；拒绝；改期协商",
    duration: 900,
    goal: "学习者能发出简单邀请，清晰接受或拒绝，并提出可执行的改期方案。",
    tip: "",
    docIntro: "这一课练「要约 / 答应 / 婉拒 / 改时间」：把态度说清楚，同时给人台阶和备选。",
    patterns: [
      {
        pattern: "How about ___?",
        meaning: "……怎么样？",
        slots: "活动或时间",
        example: "How about coffee tomorrow?",
      },
      {
        pattern: "Would ___ work for you?",
        meaning: "……对你方便吗？",
        slots: "时间方案",
        example: "Would Thursday work for you?",
      }
    ],
    vocabs: [
      "invite", "drink", "tonight", "prefer", "accept", "decline", "reschedule", "chance",
      "bother", "wish", "means", "flexible", "pickup", "call",
    ],
    expressions: [
      {
        text: "How about a drink tonight?",
        meaning: "今晚喝一杯怎样？",
        insight: "原版短句。轻松邀约；也可换成 coffee / dinner。",
        active: true,
        examples: [
          { en: "How about a drink tonight after work?", zh: "下班后今晚喝一杯怎样？" },
          { en: "I'm free later. How about a drink tonight?", zh: "我晚点有空。今晚喝一杯怎样？" },
        ],
      },
      {
        text: "What shall we do tonight?",
        meaning: "我们今晚做什么？",
        insight: "原版短句。开放式征询安排；适合已约上但未定细节。",
        active: false,
        examples: [
          { en: "What shall we do tonight—dinner or a walk?", zh: "今晚做什么——吃饭还是散步？" },
          { en: "We're both free. What shall we do tonight?", zh: "我们都有空。今晚做什么？" },
        ],
      },
      {
        text: "Shall we?",
        meaning: "要不要一起？",
        insight: "原版短句。简短邀对方一起行动；常接 go / start。",
        active: true,
        examples: [
          { en: "The table is ready. Shall we?", zh: "位子好了。走吧？" },
          { en: "Shall we head out now?", zh: "我们现在出发好吗？" },
        ],
      },
      {
        text: "That would be great.",
        meaning: "那太好了",
        insight: "原版短句。爽快接受提议；语气积极。",
        active: true,
        examples: [
          { en: "Friday at six? — That would be great.", zh: "周五六点？——那太好了。" },
          { en: "That would be great. Thanks for adjusting.", zh: "那太好了。谢谢你调整时间。" },
        ],
      },
      {
        text: "Let's play it by ear.",
        meaning: "我们随情况决定吧",
        insight: "原版短句。时间未定或可能变化时保留弹性；适合改期协商。",
        active: true,
        examples: [
          { en: "Traffic looks bad. Let's play it by ear.", zh: "路况不好。我们见机行事吧。" },
          { en: "I might finish late—let's play it by ear.", zh: "我可能晚点结束——我们灵活一点吧。" },
        ],
      },
      {
        text: "I wish I could.",
        meaning: "我希望我能（但恐怕不行）",
        insight: "原版短句。温和拒绝，暗示有心无力；常补原因。",
        active: true,
        examples: [
          { en: "I wish I could, but I have a class.", zh: "我也想去，但我有课。" },
          { en: "Dinner tonight? — I wish I could.", zh: "今晚吃饭？——我也想，但去不了。" },
        ],
      },
      {
        text: "Not today.",
        meaning: "今天不行",
        insight: "原版短句。直接但简短的拒绝；可补 another day。",
        active: true,
        examples: [
          { en: "Can we meet today? — Not today.", zh: "今天能见面吗？——今天不行。" },
          { en: "Not today. How about tomorrow?", zh: "今天不行。明天怎么样？" },
        ],
      },
      {
        text: "Not now.",
        meaning: "现在不行",
        insight: "原版短句。暂时拒绝，不否定以后；适合忙的时候。",
        active: false,
        examples: [
          { en: "Can you talk? — Not now.", zh: "能聊吗？——现在不行。" },
          { en: "Not now—I'm checking in at the hotel.", zh: "现在不行——我在酒店办理入住。" },
        ],
      },
      {
        text: "She comes along?",
        meaning: "她也一起来吗？",
        insight: "原版短句。确认同行人员；口语里用陈述语序+问号很常见。",
        active: false,
        examples: [
          { en: "We're going for coffee. She comes along?", zh: "我们去喝咖啡。她也一起来吗？" },
          { en: "She comes along? I can pick you both up.", zh: "她也来吗？我可以一起接你们。" },
        ],
      },
      {
        text: "Which would you prefer?",
        meaning: "你更想要哪个？",
        insight: "原版短句。给出选项请对方选；适合时间或地点二选一。",
        active: false,
        examples: [
          { en: "Saturday or Sunday—which would you prefer?", zh: "周六还是周日——你更想哪天？" },
          { en: "Which would you prefer, a call or a text?", zh: "你更想电话还是短信？" },
        ],
      },
      {
        text: "I'm not used to drinking.",
        meaning: "我不习惯喝酒。",
        insight: "原版短句。礼貌说明个人习惯，婉拒酒局；可提替代方案。",
        active: false,
        examples: [
          { en: "I'm not used to drinking. Could we get coffee instead?", zh: "我不习惯喝酒。我们改喝咖啡好吗？" },
          { en: "Thanks, but I'm not used to drinking.", zh: "谢谢，但我不习惯喝酒。" },
        ],
      },
      {
        text: "By all means.",
        meaning: "当然可以",
        insight: "原版短句。热情同意请求或邀请；比 sure 更正式一点。",
        active: true,
        examples: [
          { en: "May I bring a friend? — By all means.", zh: "我能带朋友吗？——当然可以。" },
          { en: "By all means, join us.", zh: "当然可以，一起来吧。" },
        ],
      },
      {
        text: "As you wish.",
        meaning: "如你所愿",
        insight: "原版短句。顺从对方安排；语气可中性也可略带无奈。",
        active: false,
        examples: [
          { en: "Let's make it earlier. — As you wish.", zh: "我们提前一点吧。——如你所愿。" },
          { en: "As you wish. I'll change the booking.", zh: "如你所愿。我去改预约。" },
        ],
      },
      {
        text: "Whatever you say.",
        meaning: "随你怎么说 / 听你的",
        insight: "原版短句。把决定权交给对方；有时略带放弃争辩。",
        active: false,
        examples: [
          { en: "Whatever you say—I'll follow your plan.", zh: "听你的——我跟你的计划走。" },
          { en: "Okay, whatever you say.", zh: "好，听你的。" },
        ],
      },
      {
        text: "You do what you want.",
        meaning: "你做你想做的吧",
        insight: "原版短句。放手让对方自行决定；可能略冷，慎用。",
        active: false,
        examples: [
          { en: "If you can't come, you do what you want.", zh: "如果你来不了，你自己决定吧。" },
          { en: "You do what you want. I'll stay home.", zh: "你做你想做的。我留在家里。" },
        ],
      },
      {
        text: "Not a chance.",
        meaning: "想都别想 / 绝不可能",
        insight: "原版短句。强硬拒绝；熟人或玩笑时用，正式场合太冲。",
        active: false,
        examples: [
          { en: "Skip the meeting? — Not a chance.", zh: "翘会？——想都别想。" },
          { en: "Not a chance. We already promised.", zh: "绝不可能。我们已经答应了。" },
        ],
      },
      {
        text: "Why bother?",
        meaning: "何必呢 / 何必费这个劲",
        insight: "原版短句。觉得不值得去做；可接解释。",
        active: false,
        examples: [
          { en: "Why bother changing it again?", zh: "何必再改一次？" },
          { en: "The place is closed. Why bother going?", zh: "那地方关门了。何必还去？" },
        ],
      },
      {
        text: "I'd pick her up.",
        meaning: "我会去接她",
        insight: "原版短句。主动提出接人安排；也可改成 pick you up。",
        active: false,
        examples: [
          { en: "Don't worry about the taxi. I'd pick her up.", zh: "别担心打车。我会去接她。" },
          { en: "I'd pick her up at the station at seven.", zh: "我七点去车站接她。" },
        ],
      },
      {
        text: "You can call me any time.",
        meaning: "你可以随时打电话给我。",
        insight: "原版短句。保持联系通道；适合改期后继续协调。",
        active: true,
        examples: [
          { en: "If the time changes, you can call me any time.", zh: "如果时间变了，你可以随时打给我。" },
          { en: "You can call me any time tomorrow morning.", zh: "你明天早上随时可以打给我。" },
        ],
      },
      {
        text: "Afraid so.",
        meaning: "恐怕是的",
        insight: "原版短句。不情愿地确认坏消息；语气偏委婉。",
        active: false,
        examples: [
          { en: "Is the restaurant full? — Afraid so.", zh: "餐厅满了吗？——恐怕是的。" },
          { en: "Afraid so. We'll need another day.", zh: "恐怕是的。我们得另约一天。" },
        ],
      }
    ],
  },
  {
    title: "酒店、课程与服务预约",
    promptEn: "Handle hotel, class, and service bookings with clear requests.",
    promptZh: "处理酒店、课程与服务预约中的清楚请求。",
    description: "在酒店入住、课程报名或服务预约中确认预订、价格、时间并完成基本手续。",
    knowledgePoints: "确认预订；付款方式；入住安顿；服务请求",
    duration: 900,
    goal: "学习者能完成预约与入住相关的核心开口：确认预订、提出请求、回应安排。",
    tip: "",
    docIntro: "这一课对齐预约与入住场景：确认有没有订、怎么付款、怎么安顿，以及服务人员常用的简短回应。",
    patterns: [
      {
        pattern: "I'd like to ___.",
        meaning: "我想要……",
        slots: "预约动作",
        example: "I'd like to book a room for two nights.",
      },
      {
        pattern: "Do you ___?",
        meaning: "你们……吗？",
        slots: "服务或条件",
        example: "Do you accept credit cards?",
      },
      {
        pattern: "Let me check ___.",
        meaning: "让我查一下……",
        slots: "预订/时间/空房",
        example: "Let me check availability for tonight.",
      },
    ],
    vocabs: [
      "reservation", "credit", "card", "unpack", "settled", "pack", "reasonable", "price",
      "guest", "wake", "check", "service", "booking", "room", "course", "sleep", "book",
    ],
    expressions: [
      {
        text: "Do you have a reservation?",
        meaning: "您预订了吗？",
        insight: "原版短句。前台核对预订；也可自问 Do I need a reservation?",
        active: true,
        examples: [
          { en: "Good evening. Do you have a reservation?", zh: "晚上好。您有预订吗？" },
          { en: "Do you have a reservation under Lee?", zh: "您有 Lee 名下的预订吗？" },
        ],
      },
      {
        text: "Do you accept credit cards?",
        meaning: "你们收信用卡吗？",
        insight: "原版短句。付款前确认支付方式；也可问 cash / mobile pay。",
        active: true,
        examples: [
          { en: "Before we check in—do you accept credit cards?", zh: "入住前问一下——你们收信用卡吗？" },
          { en: "Do you accept credit cards for the deposit?", zh: "押金可以用信用卡吗？" },
        ],
      },
      {
        text: "Wake me up at five thirty.",
        meaning: "请在五点半叫醒我。",
        insight: "原版短句。酒店叫醒服务请求；把时间说清楚。",
        active: true,
        examples: [
          { en: "Wake me up at five thirty, please. I have an early train.", zh: "请五点半叫醒我。我有早班火车。" },
          { en: "Could you wake me up at five thirty tomorrow?", zh: "明天能五点半叫醒我吗？" },
        ],
      },
      {
        text: "Take your time to unpack.",
        meaning: "慢慢来收拾行李",
        insight: "原版短句。让对方安心安顿；常与 get settled in 连用。",
        active: false,
        examples: [
          { en: "Take your time to unpack. Dinner can wait.", zh: "慢慢收拾行李。晚饭可以等。" },
          { en: "Please take your time to unpack first.", zh: "请先慢慢收拾行李。" },
        ],
      },
      {
        text: "And get settled in.",
        meaning: "安顿下来",
        insight: "原版短句。常接在 unpack 后；表示先安顿再谈别的。",
        active: false,
        examples: [
          { en: "Take your time to unpack and get settled in.", zh: "慢慢收拾行李，先安顿下来。" },
          { en: "Get settled in, then we'll check the schedule.", zh: "先安顿下来，再看日程。" },
        ],
      },
      {
        text: "You should go pack.",
        meaning: "你该去打包行李了",
        insight: "原版短句。提醒准备出发或退房；语气直接。",
        active: false,
        examples: [
          { en: "It's getting late. You should go pack.", zh: "不早了。你该去打包了。" },
          { en: "You should go pack. The shuttle leaves at nine.", zh: "你该去打包。班车九点走。" },
        ],
      },
      {
        text: "Do I start now?",
        meaning: "我可以开始了吗？",
        insight: "原版短句。课程或服务开始前确认；避免贸然动手。",
        active: true,
        examples: [
          { en: "I'm ready. Do I start now?", zh: "我准备好了。现在可以开始吗？" },
          { en: "Do I start now, or wait for the others?", zh: "我现在开始，还是等其他人？" },
        ],
      },
      {
        text: "The price is reasonable.",
        meaning: "价格还算合理。",
        insight: "原版短句。评价报价；可接 I'll take it / Let me think。",
        active: false,
        examples: [
          { en: "For a week, the price is reasonable.", zh: "住一周的话，价格还算合理。" },
          { en: "The price is reasonable. We'll book it.", zh: "价格合理。我们订了。" },
        ],
      },
      {
        text: "It's only for 2 weeks.",
        meaning: "只不过两个星期",
        insight: "原版短句。说明时长，降低对方顾虑；也可用于课程周期。",
        active: false,
        examples: [
          { en: "Don't worry—it's only for 2 weeks.", zh: "别担心——只不过两个星期。" },
          { en: "It's only for 2 weeks. Can I extend later?", zh: "只订两周。之后能续吗？" },
        ],
      },
      {
        text: "Show it to me.",
        meaning: "给我看看",
        insight: "原版短句。请求展示确认单、房间或材料；短促清楚。",
        active: true,
        examples: [
          { en: "Is this the confirmation? Show it to me.", zh: "这是确认单吗？给我看看。" },
          { en: "Show it to me on your phone.", zh: "在你手机上给我看一下。" },
        ],
      },
      {
        text: "Allow me.",
        meaning: "让我来",
        insight: "原版短句。主动代劳开门、拿行李等；礼貌介入。",
        active: false,
        examples: [
          { en: "Allow me—I'll get the door.", zh: "让我来——我来开门。" },
          { en: "Allow me. I can carry that bag.", zh: "让我来。我可以提那个包。" },
        ],
      },
      {
        text: "Be my guest.",
        meaning: "请自便",
        insight: "原版短句。允许对方使用或尝试；语气友好。",
        active: false,
        examples: [
          { en: "Can I use the charger? — Be my guest.", zh: "能用一下充电器吗？——请自便。" },
          { en: "Be my guest. The lounge is open.", zh: "请自便。休息室开着。" },
        ],
      },
      {
        text: "Take your time.",
        meaning: "别着急",
        insight: "原版短句。让对方不用赶；服务、填表、考虑时都好用。",
        active: true,
        examples: [
          { en: "Take your time. There's no rush.", zh: "别着急。不着急。" },
          { en: "Take your time choosing a date.", zh: "选日期别着急。" },
        ],
      },
      {
        text: "Sit tight.",
        meaning: "先坐着等 / 先别动",
        insight: "原版短句。请对方稍等处理；有时略口语。",
        active: false,
        examples: [
          { en: "Sit tight. I'll check with the front desk.", zh: "先等一下。我去问前台。" },
          { en: "Just sit tight—help is on the way.", zh: "先等着——人马上到。" },
        ],
      },
      {
        text: "Sure thing.",
        meaning: "没问题",
        insight: "原版短句。爽快答应请求；服务场景很自然。",
        active: true,
        examples: [
          { en: "Can I get an extra towel? — Sure thing.", zh: "能再要一条毛巾吗？——没问题。" },
          { en: "Sure thing. I'll book that for you.", zh: "没问题。我帮你订。" },
        ],
      },
      {
        text: "Check it out.",
        meaning: "快看 / 去看看",
        insight: "原版短句。邀请对方查看房间、设施或信息。",
        active: false,
        examples: [
          { en: "Your room is ready. Check it out.", zh: "房间好了。去看看吧。" },
          { en: "Check it out—the gym is on the second floor.", zh: "去看看——健身房在二楼。" },
        ],
      },
      {
        text: "Remember what the doctor said.",
        meaning: "记得医生的叮嘱",
        insight: "原版短句。提醒遵守医嘱或注意事项；也可引申为记住关键提醒。",
        active: false,
        examples: [
          { en: "Remember what the doctor said: rest today.", zh: "记得医生的叮嘱：今天休息。" },
          { en: "Before the trip, remember what the doctor said.", zh: "出发前，记得医生怎么说的。" },
        ],
      },
      {
        text: "Sleep tight.",
        meaning: "睡个好觉",
        insight: "原版短句。酒店或过夜道别时的关心；比 Good night 更口语。",
        active: false,
        examples: [
          { en: "Here's your key card. Sleep tight.", zh: "这是房卡。睡个好觉。" },
          { en: "Early start tomorrow—sleep tight.", zh: "明天要早起——睡好。" },
        ],
      },
      {
        text: "Which book we talking about?",
        meaning: "哪一本书？",
        insight: "原版短句。课程/教材预约时确认对象；口语省略 are。",
        active: false,
        examples: [
          { en: "For the evening class—which book we talking about?", zh: "晚课那本——我们说的是哪本？" },
          { en: "Which book we talking about for level two?", zh: "二级课说的是哪本书？" },
        ],
      },
      {
        text: "Have a nice day.",
        meaning: "祝你愉快",
        insight: "原版短句。服务结束时的礼貌收尾；也可说 Have a good one。",
        active: true,
        examples: [
          { en: "Here's your key. Have a nice day.", zh: "这是您的钥匙。祝您愉快。" },
          { en: "Thanks for booking with us. Have a nice day.", zh: "感谢预约。祝您愉快。" },
        ],
      }
    ],
  },
  {
    title: "说明迟到、延误和计划变化",
    promptEn: "Explain being late, delays, and sudden plan changes.",
    promptZh: "说明迟到、延误和突然的计划变化。",
    description: "在迟到、交通延误或约定变化时说明情况、解释原因并协商下一步。",
    knowledgePoints: "说明延误；解释原因；约定变化；时间压力",
    duration: 900,
    goal: "学习者能说明延误与计划变化，并推动对方一起决定下一步。",
    tip: "",
    docIntro: "这一课练突发变化时怎么开口：说明状况、解释、守约压力，以及「从现在起 / 与此同时」怎么往下接。",
    patterns: [
      {
        pattern: "I can explain.",
        meaning: "我可以解释。",
        slots: "无",
        example: "I can explain—the train was delayed.",
      },
      {
        pattern: "From now on, ___.",
        meaning: "从现在起……",
        slots: "新安排",
        example: "From now on, let's confirm by message.",
      }
    ],
    vocabs: [
      "sudden", "delay", "late", "plane", "breakfast", "explain", "deal", "meantime",
      "choice", "complicated", "close", "waiting", "change", "schedule",
    ],
    expressions: [
      {
        text: "All of a sudden.",
        meaning: "突然之间",
        insight: "原版短句。描述突发变化的开场；后面补具体事件。",
        active: false,
        examples: [
          { en: "All of a sudden, the app went down.", zh: "突然之间，应用挂了。" },
          { en: "All of a sudden they changed the gate.", zh: "突然之间他们改了登机口。" },
        ],
      },
      {
        text: "Just in time.",
        meaning: "刚好赶上",
        insight: "原版短句。险些迟到但赶上了；可表庆幸。",
        active: true,
        examples: [
          { en: "We arrived just in time for check-in.", zh: "我们刚好赶上办理入住。" },
          { en: "Just in time—the class is starting.", zh: "刚好赶上——课要开始了。" },
        ],
      },
      {
        text: "We just caught the plane.",
        meaning: "我们刚好赶上了飞机。",
        insight: "原版短句。叙述险些误机的经历；也可改成 bus / train。",
        active: false,
        examples: [
          { en: "That was stressful, but we just caught the plane.", zh: "好紧张，但我们刚好赶上飞机。" },
          { en: "We just caught the plane by five minutes.", zh: "我们差五分钟就误机，刚好赶上。" },
        ],
      },
      {
        text: "You're gonna miss breakfast.",
        meaning: "你要错过早餐时间了",
        insight: "原版短句。催促对方抓紧；酒店场景很贴切。",
        active: false,
        examples: [
          { en: "Hurry up—you're gonna miss breakfast.", zh: "快点——你要错过早餐了。" },
          { en: "If you sleep in, you're gonna miss breakfast.", zh: "再睡懒觉就要错过早餐了。" },
        ],
      },
      {
        text: "What are you waiting for?",
        meaning: "你在等什么呢？",
        insight: "原版短句。催促行动；语气可急也可玩笑。",
        active: false,
        examples: [
          { en: "The taxi is here. What are you waiting for?", zh: "出租车到了。你还在等什么？" },
          { en: "What are you waiting for? Let's go.", zh: "还等什么？走吧。" },
        ],
      },
      {
        text: "Something's up.",
        meaning: "有情况 / 出事了",
        insight: "原版短句。察觉不对劲；可接询问。",
        active: true,
        examples: [
          { en: "He's not answering. Something's up.", zh: "他不回消息。有情况。" },
          { en: "Something's up with the schedule.", zh: "日程好像有问题。" },
        ],
      },
      {
        text: "I can explain.",
        meaning: "我可以解释",
        insight: "原版短句。迟到或违约后先争取解释机会。",
        active: true,
        examples: [
          { en: "I'm late, but I can explain.", zh: "我迟到了，但我可以解释。" },
          { en: "Wait—I can explain the delay.", zh: "等等——延误的事我可以解释。" },
        ],
      },
      {
        text: "I thought I told you.",
        meaning: "我好像跟你说过",
        insight: "原版短句。以为信息已同步；可能略带抱怨。",
        active: false,
        examples: [
          { en: "I thought I told you about the new time.", zh: "我以为跟你说过新时间了。" },
          { en: "I thought I told you—bring your ID.", zh: "我以为说过了——带上证件。" },
        ],
      },
      {
        text: "We had a deal.",
        meaning: "我们说好了的",
        insight: "原版短句。强调原约定；用于改期争议或提醒对方。",
        active: true,
        examples: [
          { en: "We had a deal: no last-minute changes.", zh: "我们说好了：不临时改。" },
          { en: "Come on. We had a deal.", zh: "拜托。我们说好了的。" },
        ],
      },
      {
        text: "Time's up.",
        meaning: "时间到了",
        insight: "原版短句。截止或限时结束；会议、考试、等待都可用。",
        active: true,
        examples: [
          { en: "Time's up. We need to check out.", zh: "时间到了。我们该退房了。" },
          { en: "Sorry, time's up for this slot.", zh: "抱歉，这个时段时间到了。" },
        ],
      },
      {
        text: "In the meantime.",
        meaning: "与此同时 / 在此期间",
        insight: "原版短句。说明并行安排；后面接临时方案。",
        active: true,
        examples: [
          { en: "In the meantime, I'll call the hotel.", zh: "与此同时，我给酒店打电话。" },
          { en: "The repair will take an hour. In the meantime, have a seat.", zh: "修理要一小时。这期间请先坐。" },
        ],
      },
      {
        text: "From now on.",
        meaning: "从现在开始",
        insight: "原版短句。宣布新规则或新习惯；收束混乱。",
        active: true,
        examples: [
          { en: "From now on, let's confirm by text.", zh: "从现在起，我们用短信确认。" },
          { en: "From now on, I'll leave earlier.", zh: "从现在起，我会早点出门。" },
        ],
      },
      {
        text: "As always.",
        meaning: "一如既往",
        insight: "原版短句。表示情况照旧；可褒可贬。",
        active: false,
        examples: [
          { en: "He's late, as always.", zh: "他迟到了，一如既往。" },
          { en: "Thanks for helping, as always.", zh: "一如既往谢谢你帮忙。" },
        ],
      },
      {
        text: "Not again.",
        meaning: "又来了",
        insight: "原版短句。对重复问题的无奈；延误多次时很自然。",
        active: true,
        examples: [
          { en: "The train is delayed? Not again.", zh: "火车延误？又来了。" },
          { en: "Not again—my phone died.", zh: "又来了——手机没电了。" },
        ],
      },
      {
        text: "That was close.",
        meaning: "好险啊",
        insight: "原版短句。险些出问题后的感叹。",
        active: false,
        examples: [
          { en: "We almost missed it. That was close.", zh: "差点错过。好险。" },
          { en: "That was close. Next time leave earlier.", zh: "好险。下次早点出门。" },
        ],
      },
      {
        text: "It was close.",
        meaning: "差一点点",
        insight: "原版短句。与 That was close 相近，偏叙述。",
        active: false,
        examples: [
          { en: "It was close, but we made the appointment.", zh: "很悬，但我们赶上预约了。" },
          { en: "It was close. The door almost locked.", zh: "差一点点。门差点锁上。" },
        ],
      },
      {
        text: "I don't remember.",
        meaning: "我不记得了",
        insight: "原版短句。承认记不清约定细节；可接让我查一下。",
        active: false,
        examples: [
          { en: "What time did we book? — I don't remember.", zh: "我们订的几点？——我不记得了。" },
          { en: "I don't remember the confirmation number.", zh: "我不记得确认号了。" },
        ],
      },
      {
        text: "Doesn't say.",
        meaning: "上面没写 / 没提到",
        insight: "原版短句。查看通知或短信后发现信息缺失。",
        active: false,
        examples: [
          { en: "Does the email list a time? — Doesn't say.", zh: "邮件写了时间吗？——没写。" },
          { en: "Doesn't say. I'll call to confirm.", zh: "没写。我打电话确认。" },
        ],
      },
      {
        text: "I have no choice.",
        meaning: "我没得选",
        insight: "原版短句。被迫接受延误或改期时的说明。",
        active: false,
        examples: [
          { en: "The only flight is at midnight. I have no choice.", zh: "只有午夜航班。我没得选。" },
          { en: "I have no choice but to reschedule.", zh: "我只能改期了。" },
        ],
      },
      {
        text: "It's complicated.",
        meaning: "这很复杂",
        insight: "原版短句。不便细说原因时的挡箭牌；可稍后补充。",
        active: true,
        examples: [
          { en: "Why the delay? — It's complicated.", zh: "为什么延误？——比较复杂。" },
          { en: "It's complicated. Can I explain later?", zh: "比较复杂。我晚点解释行吗？" },
        ],
      }
    ],
  },
  {
    title: "描述生活小故障并请求处理",
    promptEn: "Describe small life problems and ask for help or fixes.",
    promptZh: "描述生活小故障并请求处理或协助。",
    description: "在设备故障、信号不好或生活麻烦中说明问题、请求帮忙并稳定情绪。",
    knowledgePoints: "说明故障；请求帮忙；尝试处理；安抚情绪",
    duration: 900,
    goal: "学习者能清楚描述小故障，提出请求，并回应处理方案。",
    tip: "",
    docIntro: "这一课练「出了点问题」：怎么说麻烦、怎么请人帮忙、怎么让自己和对方先冷静下来再处理。",
    patterns: [
      {
        pattern: "The problem is ___.",
        meaning: "问题是……",
        slots: "故障描述",
        example: "The problem is the Wi-Fi keeps dropping.",
      },
      {
        pattern: "Could you ___?",
        meaning: "你能……吗？",
        slots: "请求动作",
        example: "Could you give me a hand with this?",
      }
    ],
    vocabs: [
      "problem", "favor", "hand", "try", "supposed", "breaking", "patient", "panic",
      "noise", "repair", "signal", "break", "together", "screw", "pull", "over",
    ],
    expressions: [
      {
        text: "We got a problem.",
        meaning: "我们有麻烦了",
        insight: "原版短句。快速告知出现问题；接着说明是什么。",
        active: true,
        examples: [
          { en: "We got a problem—the lock won't open.", zh: "有麻烦了——锁打不开。" },
          { en: "Uh-oh. We got a problem with the booking.", zh: "糟了。预约出问题了。" },
        ],
      },
      {
        text: "Do me a favor.",
        meaning: "帮我个忙",
        insight: "原版短句。开口请托；后面要紧接具体请求。",
        active: true,
        examples: [
          { en: "Do me a favor and hold the door.", zh: "帮个忙，扶一下门。" },
          { en: "Do me a favor: call the front desk.", zh: "帮个忙：给前台打个电话。" },
        ],
      },
      {
        text: "Give me a hand.",
        meaning: "帮个忙",
        insight: "原版短句。请求体力或操作协助；很口语。",
        active: true,
        examples: [
          { en: "Give me a hand with these bags.", zh: "帮我提一下这些包。" },
          { en: "Can you give me a hand? The suitcase is stuck.", zh: "能帮把手吗？箱子卡住了。" },
        ],
      },
      {
        text: "Give it a try.",
        meaning: "试试吧",
        insight: "原版短句。鼓励尝试解决办法；不必保证成功。",
        active: false,
        examples: [
          { en: "Restart the router and give it a try.", zh: "重启路由器试试。" },
          { en: "I'm not sure, but give it a try.", zh: "我不确定，但试试看。" },
        ],
      },
      {
        text: "Is there anything I can do?",
        meaning: "有什么我可以帮忙的吗？",
        insight: "原版短句。主动提供帮助；故障现场很得体。",
        active: true,
        examples: [
          { en: "You look stuck. Is there anything I can do?", zh: "你好像卡住了。有什么我能帮忙的吗？" },
          { en: "Is there anything I can do while we wait?", zh: "等待的时候我能做点什么吗？" },
        ],
      },
      {
        text: "Tell me what to do.",
        meaning: "告诉我该怎么做",
        insight: "原版短句。愿意按指示行动；适合求助专业人员。",
        active: false,
        examples: [
          { en: "I'm ready. Tell me what to do.", zh: "我准备好了。告诉我怎么做。" },
          { en: "Tell me what to do next.", zh: "告诉我下一步做什么。" },
        ],
      },
      {
        text: "What am I supposed to do?",
        meaning: "我该怎么办？",
        insight: "原版短句。不知所措时的求助；可带一点焦虑。",
        active: true,
        examples: [
          { en: "The key is missing. What am I supposed to do?", zh: "钥匙不见了。我该怎么办？" },
          { en: "What am I supposed to do if it happens again?", zh: "要是再这样我该怎么办？" },
        ],
      },
      {
        text: "Pull over.",
        meaning: "靠边停车",
        insight: "原版短句。路上出状况时请司机靠边；也可自述 I need to pull over。",
        active: false,
        examples: [
          { en: "Something's wrong with the engine—pull over.", zh: "发动机不对劲——靠边停。" },
          { en: "Pull over. I need to check the tire.", zh: "靠边停。我要看一下轮胎。" },
        ],
      },
      {
        text: "You're breaking up.",
        meaning: "你的信号不好",
        insight: "原版短句。通话信号差时即时反馈；请对方重复或换方式。",
        active: false,
        examples: [
          { en: "You're breaking up. Can you text me instead?", zh: "信号不好。能不能改发短信？" },
          { en: "Sorry, you're breaking up—say that again?", zh: "抱歉信号不好——再说一遍？" },
        ],
      },
      {
        text: "Start over.",
        meaning: "重新开始",
        insight: "原版短句。流程出错后要求重来；预约填表、设置都常用。",
        active: false,
        examples: [
          { en: "That form is wrong. Start over.", zh: "表格填错了。重新来。" },
          { en: "Let's start over from the beginning.", zh: "我们从头再来。" },
        ],
      },
      {
        text: "Take a break.",
        meaning: "休息一下",
        insight: "原版短句。情绪或体力到极限时建议暂停。",
        active: false,
        examples: [
          { en: "You're stressed. Take a break.", zh: "你压力太大了。休息一下。" },
          { en: "Take a break, then try again.", zh: "休息一下，再试。" },
        ],
      },
      {
        text: "Calm down.",
        meaning: "冷静",
        insight: "原版短句。安抚激动情绪；语气要柔，否则像命令。",
        active: true,
        examples: [
          { en: "Calm down. We'll fix this.", zh: "冷静。我们会处理好。" },
          { en: "Please calm down and tell me what happened.", zh: "请冷静，告诉我发生了什么。" },
        ],
      },
      {
        text: "Be patient.",
        meaning: "耐心点",
        insight: "原版短句。提醒等待处理；服务排队时常见。",
        active: false,
        examples: [
          { en: "Be patient—the technician is coming.", zh: "耐心点——技术员在路上。" },
          { en: "Be patient. These things take time.", zh: "耐心点。这种事需要时间。" },
        ],
      },
      {
        text: "Let's not waste our time.",
        meaning: "咱们别浪费时间了。",
        insight: "原版短句。推动尽快处理；略带催促。",
        active: false,
        examples: [
          { en: "Let's not waste our time. Call support now.", zh: "别浪费时间了。现在就打支持电话。" },
          { en: "The line is long. Let's not waste our time here.", zh: "队很长。别在这浪费时间了。" },
        ],
      },
      {
        text: "Stop making such a noise.",
        meaning: "别吵了。",
        insight: "原版短句。要求降低噪音；注意礼貌场合。",
        active: false,
        examples: [
          { en: "Please stop making such a noise. People are resting.", zh: "请别这么吵。别人在休息。" },
          { en: "Stop making such a noise with that alarm.", zh: "别让那个闹钟一直响。" },
        ],
      },
      {
        text: "I screwed up.",
        meaning: "我搞砸了",
        insight: "原版短句。承认失误；便于对方一起善后。",
        active: true,
        examples: [
          { en: "I screwed up the booking date.", zh: "我把预订日期搞砸了。" },
          { en: "Sorry, I screwed up. Can we fix it?", zh: "抱歉，我搞砸了。能补救吗？" },
        ],
      },
      {
        text: "I've had it.",
        meaning: "我受够了",
        insight: "原版短句。忍无可忍；情绪强，对事不对人更安全。",
        active: false,
        examples: [
          { en: "I've had it with this buggy app.", zh: "这个破应用我受够了。" },
          { en: "I've had it. Let's get help.", zh: "受够了。我们找人帮忙吧。" },
        ],
      },
      {
        text: "Don't panic.",
        meaning: "别慌",
        insight: "原版短句。稳定场面；常接具体下一步。",
        active: true,
        examples: [
          { en: "Don't panic. We still have time.", zh: "别慌。我们还有时间。" },
          { en: "Don't panic—backup power is on.", zh: "别慌——备用电源开着。" },
        ],
      },
      {
        text: "Get yourself together.",
        meaning: "振作点 / 打起精神",
        insight: "原版短句。催自己或熟人振作；对生人可能显得硬。",
        active: false,
        examples: [
          { en: "Get yourself together. We'll handle it.", zh: "振作点。我们会处理。" },
          { en: "Come on, get yourself together.", zh: "拜托，打起精神来。" },
        ],
      },
      {
        text: "I got it.",
        meaning: "我去处理 / 我懂了",
        insight: "原版偏「我来搞定」；也可表听懂。本课按处理故障用。",
        active: true,
        examples: [
          { en: "The sink is leaking. — I got it.", zh: "水槽漏水。——我去处理。" },
          { en: "I got it. You rest.", zh: "我来搞定。你休息。" },
        ],
      }
    ],
  },
  {
    title: "表达感受、安慰和实际支持",
    promptEn: "Share feelings, comfort someone, and offer real support.",
    promptZh: "表达感受，安慰他人，并给出实际支持。",
    description: "在压力、疲惫或情绪低落时表达感受，并给出安慰与支持。",
    knowledgePoints: "表达感受；安慰鼓励；道歉补偿；支持承诺",
    duration: 900,
    goal: "学习者能说出自己的状态，也能用短句安慰别人并表示站在对方一边。",
    tip: "",
    docIntro: "这一课练情绪与支持：怎么说累、烦、紧张，怎么安慰，以及怎么用行动性的支持（我挺你 / 我会补偿）。",
    patterns: [
      {
        pattern: "I got your back.",
        meaning: "我支持你。",
        slots: "无",
        example: "Don't worry about the meeting—I got your back.",
      },
      {
        pattern: "Hang in there.",
        meaning: "坚持住。",
        slots: "无",
        example: "Hang in there. Tomorrow will be better.",
      }
    ],
    vocabs: [
      "back", "easy", "hang", "cheer", "mood", "exhausted", "confused", "weather",
      "nervous", "spirit", "rough", "support", "sorry", "fed",
    ],
    expressions: [
      {
        text: "I got your back.",
        meaning: "我支持你 / 我罩着你",
        insight: "原版短句。承诺站在对方一边；比抽象安慰更有力量。",
        active: true,
        examples: [
          { en: "If they push back, I got your back.", zh: "如果他们为难你，我挺你。" },
          { en: "Don't worry. I got your back on this.", zh: "别担心。这件事我支持你。" },
        ],
      },
      {
        text: "Take it easy.",
        meaning: "放轻松",
        insight: "原版短句。劝对方别太紧张或别太拼。",
        active: true,
        examples: [
          { en: "Take it easy. You still have time.", zh: "放轻松。你还有时间。" },
          { en: "Hey, take it easy—one thing at a time.", zh: "嘿，放轻松——一次一件事。" },
        ],
      },
      {
        text: "Hang in there.",
        meaning: "坚持下去",
        insight: "原版短句。鼓励度过难关；适合赶工、康复、低潮。",
        active: true,
        examples: [
          { en: "Hang in there. The repair is almost done.", zh: "再坚持一下。快修好了。" },
          { en: "I know it's hard. Hang in there.", zh: "我知道很难。坚持住。" },
        ],
      },
      {
        text: "Cheer up.",
        meaning: "开心点 / 振作起来",
        insight: "原版短句。轻快安慰；严重情绪时可能显得轻描淡写。",
        active: true,
        examples: [
          { en: "Cheer up. We'll figure it out.", zh: "开心点。我们会想到办法。" },
          { en: "Cheer up—dinner's on me tonight.", zh: "振作点——今晚我请客。" },
        ],
      },
      {
        text: "Don't give up.",
        meaning: "别放弃",
        insight: "原版短句。鼓励继续尝试；可接具体小下一步。",
        active: true,
        examples: [
          { en: "Don't give up. Try one more time.", zh: "别放弃。再试一次。" },
          { en: "Don't give up on the class yet.", zh: "先别放弃这门课。" },
        ],
      },
      {
        text: "I'll make it up to you.",
        meaning: "我会补偿你的",
        insight: "原版短句。因失误或爽约后承诺弥补。",
        active: true,
        examples: [
          { en: "I cancelled last minute. I'll make it up to you.", zh: "我临时取消了。我会补偿你。" },
          { en: "I'll make it up to you with coffee tomorrow.", zh: "明天请你喝咖啡补偿。" },
        ],
      },
      {
        text: "I am so sorry about this.",
        meaning: "对此我非常抱歉",
        insight: "原版短句。为造成的麻烦郑重道歉；适合延误、故障影响他人。",
        active: true,
        examples: [
          { en: "I am so sorry about this delay.", zh: "对这次延误我非常抱歉。" },
          { en: "I am so sorry about this. We'll fix it today.", zh: "对此非常抱歉。我们今天修好。" },
        ],
      },
      {
        text: "I am not mad.",
        meaning: "我没有生气",
        insight: "原版短句。安抚对方别误会情绪；澄清关系。",
        active: false,
        examples: [
          { en: "It's okay. I am not mad.", zh: "没关系。我没有生气。" },
          { en: "I am not mad—just tired.", zh: "我没生气——只是累了。" },
        ],
      },
      {
        text: "I'm not in the mood.",
        meaning: "我心情不好 / 没兴致",
        insight: "原版短句。诚实说明状态，婉拒活动。",
        active: false,
        examples: [
          { en: "I'm not in the mood for a party tonight.", zh: "今晚没兴致参加派对。" },
          { en: "Can we talk later? I'm not in the mood.", zh: "晚点再聊好吗？我心情不好。" },
        ],
      },
      {
        text: "You're making me nervous.",
        meaning: "你会让我紧张的",
        insight: "原版短句。反馈对方行为带来的压力；请求放慢或停止催促。",
        active: false,
        examples: [
          { en: "Please stop rushing me. You're making me nervous.", zh: "别再催我了。你让我很紧张。" },
          { en: "You're making me nervous with that ticking clock.", zh: "那个滴答的钟让我紧张。" },
        ],
      },
      {
        text: "I'm exhausted.",
        meaning: "我累坏了",
        insight: "原版短句。清楚表达疲惫；可接需要休息。",
        active: true,
        examples: [
          { en: "After the move, I'm exhausted.", zh: "搬家之后我累坏了。" },
          { en: "I'm exhausted. Can we reschedule?", zh: "我累坏了。能改期吗？" },
        ],
      },
      {
        text: "I'm confused.",
        meaning: "我搞不懂 / 我很困惑",
        insight: "原版短句。承认信息混乱；常接请求澄清。",
        active: false,
        examples: [
          { en: "I'm confused. Which room is mine?", zh: "我搞不懂。哪间是我的房？" },
          { en: "I'm confused by these two emails.", zh: "这两封邮件把我搞糊涂了。" },
        ],
      },
      {
        text: "She's under the weather.",
        meaning: "她身体不舒服 / 有点不适",
        insight: "原版短句。委婉说身体不适；也可说 a bit under the weather。",
        active: false,
        examples: [
          { en: "She's under the weather, so she'll stay home.", zh: "她有点不舒服，所以留在家里。" },
          { en: "Tell them she's under the weather today.", zh: "跟他们说她今天身体不适。" },
        ],
      },
      {
        text: "He seems a little nervous.",
        meaning: "他显得有点紧张。",
        insight: "原版短句。观察并描述他人状态；便于调整沟通方式。",
        active: false,
        examples: [
          { en: "He seems a little nervous before the interview.", zh: "面试前他显得有点紧张。" },
          { en: "He seems a little nervous. Give him a minute.", zh: "他有点紧张。给他一分钟。" },
        ],
      },
      {
        text: "I really enjoyed myself.",
        meaning: "我玩得很开心。",
        insight: "原版短句。活动结束后的正面反馈；也可说 I had a great time。",
        active: false,
        examples: [
          { en: "Thanks for hosting. I really enjoyed myself.", zh: "谢谢招待。我玩得很开心。" },
          { en: "I really enjoyed myself at the class.", zh: "这堂课我很享受。" },
        ],
      },
      {
        text: "I'm fed up with my work!",
        meaning: "我对工作烦死了！",
        insight: "原版短句。强烈表达厌烦；熟人间宣泄，正式场合慎用。",
        active: false,
        examples: [
          { en: "I'm fed up with my work! I need a break.", zh: "工作烦死了！我需要休息。" },
          { en: "Honestly, I'm fed up with my work!", zh: "说实话，我对工作烦透了！" },
        ],
      },
      {
        text: "There there.",
        meaning: "好啦好啦（安慰）",
        insight: "原版短句。轻拍式安慰，多对孩子或很亲近的人；注意场合。",
        active: false,
        examples: [
          { en: "There there. It's going to be okay.", zh: "好啦好啦。会没事的。" },
          { en: "There there. Don't cry.", zh: "好啦。别哭。" },
        ],
      },
      {
        text: "Poor thing.",
        meaning: "真可怜 / 真不容易",
        insight: "原版短句。表达同情；语气要真诚，避免屈尊感。",
        active: false,
        examples: [
          { en: "You waited two hours? Poor thing.", zh: "你等了两小时？真不容易。" },
          { en: "Poor thing. Let me help.", zh: "真够呛。我来帮你。" },
        ],
      },
      {
        text: "That's the spirit.",
        meaning: "这样才对嘛",
        insight: "原版短句。肯定对方振作或积极态度。",
        active: true,
        examples: [
          { en: "You're trying again? That's the spirit.", zh: "你又试一次？这就对了。" },
          { en: "That's the spirit. Keep going.", zh: "这就对了。继续。" },
        ],
      },
      {
        text: "Rough day?",
        meaning: "今天不顺利吗？",
        insight: "原版短句。关心对方是否过得艰难；打开倾诉。",
        active: true,
        examples: [
          { en: "You look tired. Rough day?", zh: "你看起来很累。今天不顺？" },
          { en: "Rough day? Want to talk?", zh: "今天很难？想聊聊吗？" },
        ],
      }
    ],
  },
  {
    title: "报告进度、截止时间和下一步",
    promptEn: "Report progress, deadlines, and the next step.",
    promptZh: "报告进度、截止时间，并说明下一步。",
    description: "在任务推进中汇报进度、给出承诺，并明确下一步行动。",
    knowledgePoints: "汇报进度；肯定反馈；承诺保证；下一步行动",
    duration: 900,
    goal: "学习者能简短汇报进展、做出可靠承诺，并回应截止压力。",
    tip: "",
    docIntro: "这一课练任务推进语言：进展如何、谁的回合、保证做到，以及别让对方失望。",
    patterns: [
      {
        pattern: "I'll do my best.",
        meaning: "我会尽力。",
        slots: "无",
        example: "The deadline is tight, but I'll do my best.",
      },
      {
        pattern: "At this point, ___.",
        meaning: "目前……",
        slots: "现状",
        example: "At this point, we need one more day.",
      }
    ],
    vocabs: [
      "best", "finished", "progress", "impressed", "promise", "turn", "deadline", "sure",
      "deal", "down", "busy", "word", "next", "draft",
    ],
    expressions: [
      {
        text: "I'll do my best.",
        meaning: "我会尽全力",
        insight: "原版短句。承诺努力但不虚报必成；适合紧截止。",
        active: true,
        examples: [
          { en: "The deadline is tight, but I'll do my best.", zh: "截止很紧，但我会尽力。" },
          { en: "I'll do my best to finish before noon.", zh: "我会尽力中午前完成。" },
        ],
      },
      {
        text: "Finished already?",
        meaning: "已经完成了吗？",
        insight: "原版短句。惊讶或确认进度；可褒可中性。",
        active: false,
        examples: [
          { en: "Finished already? That was fast.", zh: "已经做完了？好快。" },
          { en: "Finished already? Great—send it over.", zh: "做完了？太好——发过来吧。" },
        ],
      },
      {
        text: "Went well.",
        meaning: "进展顺利",
        insight: "原版短句。简短汇报结果正面；可补细节。",
        active: true,
        examples: [
          { en: "How was the meeting? — Went well.", zh: "会开得怎样？——挺顺利。" },
          { en: "The check-in went well.", zh: "入住办理顺利。" },
        ],
      },
      {
        text: "Will do.",
        meaning: "好的 / 我会做",
        insight: "原版短句。爽快接下任务；比 Okay 更行动导向。",
        active: true,
        examples: [
          { en: "Please update the doc. — Will do.", zh: "请更新文档。——好的。" },
          { en: "Will do. I'll message you after.", zh: "好的。弄完给你消息。" },
        ],
      },
      {
        text: "Good job.",
        meaning: "做得好",
        insight: "原版短句。肯定对方完成质量；简短有力。",
        active: true,
        examples: [
          { en: "You fixed the form. Good job.", zh: "你把表格修好了。做得好。" },
          { en: "Good job on the presentation.", zh: "演示做得好。" },
        ],
      },
      {
        text: "Well done.",
        meaning: "干得好",
        insight: "原版短句。与 Good job 相近，略正式。",
        active: false,
        examples: [
          { en: "Well done. That saved us time.", zh: "干得好。这省了我们时间。" },
          { en: "Well done on hitting the deadline.", zh: "赶上截止，干得好。" },
        ],
      },
      {
        text: "Way to go.",
        meaning: "真棒 / 干得漂亮",
        insight: "原版短句。更口语的表扬。",
        active: false,
        examples: [
          { en: "You got the booking. Way to go!", zh: "订到位了。真棒！" },
          { en: "Way to go—you finished early.", zh: "漂亮——你提前完成了。" },
        ],
      },
      {
        text: "Proud of you.",
        meaning: "为你骄傲",
        insight: "原版短句。情感支持式肯定；适合努力后的成果。",
        active: false,
        examples: [
          { en: "You handled that calmly. Proud of you.", zh: "你处理得很冷静。为你骄傲。" },
          { en: "Proud of you for asking for help.", zh: "你愿意求助，我为你骄傲。" },
        ],
      },
      {
        text: "I'm impressed.",
        meaning: "我很佩服 / 印象深刻",
        insight: "原版短句。对表现超出预期的评价。",
        active: false,
        examples: [
          { en: "I'm impressed by how fast you fixed it.", zh: "你修得这么快，我很佩服。" },
          { en: "Honestly, I'm impressed.", zh: "说实话，我很佩服。" },
        ],
      },
      {
        text: "We are all busy with work.",
        meaning: "我们都忙于工作。",
        insight: "原版短句。说明集体忙碌，解释响应慢或进度受限。",
        active: false,
        examples: [
          { en: "Sorry for the delay. We are all busy with work.", zh: "抱歉延误。大家工作都很忙。" },
          { en: "We are all busy with work this week.", zh: "这周我们都忙于工作。" },
        ],
      },
      {
        text: "You have my word.",
        meaning: "我保证 / 说话算数",
        insight: "原版短句。加重承诺可信度；比 I promise 略郑重。",
        active: true,
        examples: [
          { en: "I'll send it tonight. You have my word.", zh: "今晚发出。我保证。" },
          { en: "You have my word—no more delays.", zh: "我保证——不再延误。" },
        ],
      },
      {
        text: "I promise.",
        meaning: "我保证",
        insight: "原版短句。直接承诺；最好接可验证的行动。",
        active: true,
        examples: [
          { en: "I promise I'll confirm by five.", zh: "我保证五点前确认。" },
          { en: "I won't forget. I promise.", zh: "我不会忘。我保证。" },
        ],
      },
      {
        text: "My turn.",
        meaning: "轮到我了",
        insight: "原版短句。交接任务或发言权。",
        active: false,
        examples: [
          { en: "You're done? My turn.", zh: "你弄完了？轮到我了。" },
          { en: "My turn to update the status.", zh: "轮到我更新进度了。" },
        ],
      },
      {
        text: "Who's turn?",
        meaning: "该谁了？",
        insight: "原版短句。确认下一位负责人或发言人。",
        active: false,
        examples: [
          { en: "Who's turn to present?", zh: "该谁汇报了？" },
          { en: "Who's turn to call the hotel?", zh: "该谁给酒店打电话了？" },
        ],
      },
      {
        text: "At this point.",
        meaning: "目前 / 到这一步",
        insight: "原版短句。总结现状并引出下一步。",
        active: true,
        examples: [
          { en: "At this point, we need one more day.", zh: "目前我们还需要一天。" },
          { en: "At this point, let's pause and check.", zh: "到这一步，先暂停检查一下。" },
        ],
      },
      {
        text: "You promised me.",
        meaning: "你答应过我的",
        insight: "原版短句。提醒对方先前承诺；适合催进度或兑现约定。",
        active: false,
        examples: [
          { en: "You promised me the draft by Friday.", zh: "你答应过周五给我草稿。" },
          { en: "Remember—you promised me you'd call.", zh: "记得——你答应过会打电话。" },
        ],
      },
      {
        text: "That's for sure.",
        meaning: "那是肯定的",
        insight: "原版短句。确认判断或承诺；给下一步定调。",
        active: false,
        examples: [
          { en: "We'll hit the deadline. That's for sure.", zh: "我们会赶上截止。那是肯定的。" },
          { en: "Need one more review? That's for sure.", zh: "还要再审一遍？肯定要。" },
        ],
      },
      {
        text: "It's a big deal.",
        meaning: "这是件大事",
        insight: "原版短句。强调重要性；提醒对方认真对待。",
        active: false,
        examples: [
          { en: "Missing the deadline is a big deal.", zh: "错过截止是大事。" },
          { en: "To the client, it's a big deal.", zh: "对客户来说这很重要。" },
        ],
      },
      {
        text: "Don't let me down.",
        meaning: "别让我失望",
        insight: "原版短句。施加期望与信任；语气可重，慎用。",
        active: true,
        examples: [
          { en: "I'm counting on you. Don't let me down.", zh: "我就靠你了。别让我失望。" },
          { en: "Don't let me down on this delivery.", zh: "这次交付别让我失望。" },
        ],
      },
      {
        text: "I mean it.",
        meaning: "我说真的",
        insight: "原版短句。强调态度认真，不是随口一说。",
        active: true,
        examples: [
          { en: "Please rest today. I mean it.", zh: "今天请休息。我说真的。" },
          { en: "I'll help you. I mean it.", zh: "我会帮你。是认真的。" },
        ],
      }
    ],
  },
  {
    title: "给建议并确认最终方案",
    promptEn: "Give advice and confirm the final plan.",
    promptZh: "提出建议，并确认最终方案。",
    description: "在方案讨论中给出建议、权衡利弊，并收口确认最终决定。",
    knowledgePoints: "提出建议；权衡利弊；表达立场；确认方案",
    duration: 900,
    goal: "学习者能提出建议、表达真实看法，并用短句把方案敲定。",
    tip: "",
    docIntro: "这一课练「出主意 + 拍板」：怎么肯定别人的点子、怎么劝 prioritise、怎么说定 It's settled。",
    patterns: [
      {
        pattern: "It's settled, then.",
        meaning: "那就这么定了。",
        slots: "无",
        example: "Friday at three. It's settled, then.",
      },
      {
        pattern: "To be honest, ___.",
        meaning: "老实说……",
        slots: "真实看法",
        example: "To be honest, that plan is too tight.",
      }
    ],
    vocabs: [
      "point", "idea", "worth", "settled", "honest", "difference", "trust", "advice",
      "guess", "complain", "best", "exercise", "wrong", "confirm",
    ],
    expressions: [
      {
        text: "You've got a point there.",
        meaning: "你说得挺有道理的。",
        insight: "原版短句。部分同意对方观点；常接补充。",
        active: true,
        examples: [
          { en: "You've got a point there. Let's move the meeting.", zh: "你说得有理。我们改会议吧。" },
          { en: "Hmm, you've got a point there.", zh: "嗯，你说得挺有道理。" },
        ],
      },
      {
        text: "That's a terrific idea!",
        meaning: "真是好主意！",
        insight: "原版短句。热情肯定建议；推动落地。",
        active: true,
        examples: [
          { en: "Book a morning slot? That's a terrific idea!", zh: "订上午时段？真是好主意！" },
          { en: "That's a terrific idea! Let's do it.", zh: "好主意！就这么办。" },
        ],
      },
      {
        text: "For your own good.",
        meaning: "为了你好",
        insight: "原版短句。劝告时说明动机；注意别显得说教。",
        active: false,
        examples: [
          { en: "Leave earlier, for your own good.", zh: "为了你好，早点出门。" },
          { en: "I'm saying this for your own good.", zh: "我这是为你好才说。" },
        ],
      },
      {
        text: "Some exercise will do you good.",
        meaning: "做点运动对你有益",
        insight: "原版短句。具体健康建议；也可换成 rest / sleep。",
        active: false,
        examples: [
          { en: "You've been stressed. Some exercise will do you good.", zh: "你压力大。运动对你有好处。" },
          { en: "Some exercise will do you good after sitting all day.", zh: "坐了一天，运动对你有益。" },
        ],
      },
      {
        text: "You should get back.",
        meaning: "你该回去了",
        insight: "原版短句。建议对方返回原处/工作/家；也可 get back to work。",
        active: false,
        examples: [
          { en: "It's late. You should get back.", zh: "不早了。你该回去了。" },
          { en: "You should get back before the rain.", zh: "你该在下雨前回去。" },
        ],
      },
      {
        text: "It's not worth it.",
        meaning: "这不值得",
        insight: "原版短句。劝对方别浪费时间或情绪。",
        active: true,
        examples: [
          { en: "Arguing about it? It's not worth it.", zh: "为此争论？不值得。" },
          { en: "It's not worth it. Pick another option.", zh: "不值得。换个方案吧。" },
        ],
      },
      {
        text: "It's for the best.",
        meaning: "这样也许最好",
        insight: "原版短句。安慰接受不完美结果或艰难决定。",
        active: false,
        examples: [
          { en: "The cancellation hurts, but it's for the best.", zh: "取消让人难受，但也许最好。" },
          { en: "Maybe it's for the best.", zh: "也许这样最好。" },
        ],
      },
      {
        text: "That should do nicely.",
        meaning: "这样就很好了",
        insight: "原版短句。确认方案够用；收尾满意。",
        active: false,
        examples: [
          { en: "Two extra chairs? That should do nicely.", zh: "再加两把椅子？这样就很好了。" },
          { en: "That should do nicely for tonight.", zh: "今晚这样就够好了。" },
        ],
      },
      {
        text: "It's settled, then.",
        meaning: "那就这么定了",
        insight: "原版短句。双方达成一致后的收口句。",
        active: true,
        examples: [
          { en: "Friday at three. It's settled, then.", zh: "周五三点。那就这么定了。" },
          { en: "It's settled, then. I'll send the confirmation.", zh: "就这么定了。我发确认。" },
        ],
      },
      {
        text: "I would guess that.",
        meaning: "我猜是这样",
        insight: "原版短句。谨慎推测；避免说成事实。",
        active: false,
        examples: [
          { en: "Will they approve it? I would guess that.", zh: "他们会批吗？我猜会。" },
          { en: "I would guess that the delay is traffic.", zh: "我猜延误是因为堵车。" },
        ],
      },
      {
        text: "To be honest.",
        meaning: "老实说",
        insight: "原版短句。引出真实看法；后面接可能不顺耳的内容。",
        active: true,
        examples: [
          { en: "To be honest, that schedule is too tight.", zh: "老实说，那个日程太紧了。" },
          { en: "To be honest, I prefer the other plan.", zh: "老实说，我更喜欢另一个方案。" },
        ],
      },
      {
        text: "You were right.",
        meaning: "你说得对",
        insight: "原版短句。承认对方先前判断正确；利于合作。",
        active: false,
        examples: [
          { en: "You were right about leaving early.", zh: "你说该早点出门是对的。" },
          { en: "Okay, you were right.", zh: "好吧，你是对的。" },
        ],
      },
      {
        text: "I think so.",
        meaning: "我想是的",
        insight: "原版短句。温和同意；把握不是 100% 时也好用。",
        active: false,
        examples: [
          { en: "Is this the best option? — I think so.", zh: "这是最好选项吗？——我想是。" },
          { en: "I think so, but let's double-check.", zh: "我想是，不过再核对一下。" },
        ],
      },
      {
        text: "Don't get me wrong.",
        meaning: "别误会我",
        insight: "原版短句。提出批评或不同意见前的缓冲。",
        active: true,
        examples: [
          { en: "Don't get me wrong—I like the idea, but timing is off.", zh: "别误会——我喜欢这主意，但时机不对。" },
          { en: "Don't get me wrong. I'm not blaming you.", zh: "别误会。我不是在怪你。" },
        ],
      },
      {
        text: "It's no use complaining.",
        meaning: "发牢骚没什么用。",
        insight: "原版短句。劝转向行动；可接 Let's fix it。",
        active: false,
        examples: [
          { en: "It's no use complaining. Let's call support.", zh: "抱怨没用。我们打支持电话吧。" },
          { en: "I know it sucks, but it's no use complaining.", zh: "我知道糟心，但抱怨没用。" },
        ],
      },
      {
        text: "That makes no difference.",
        meaning: "没什么区别",
        insight: "原版短句。说明选项等价或影响可忽略。",
        active: false,
        examples: [
          { en: "Tuesday or Wednesday? That makes no difference to me.", zh: "周二或周三？对我没区别。" },
          { en: "That makes no difference. Either works.", zh: "没区别。哪个都行。" },
        ],
      },
      {
        text: "What's the point?",
        meaning: "有什么意义？",
        insight: "原版短句。质疑行动价值；语气可消极，注意场合。",
        active: false,
        examples: [
          { en: "If they already decided, what's the point?", zh: "如果他们已决定，还有什么意义？" },
          { en: "What's the point of waiting longer?", zh: "再等下去有什么意义？" },
        ],
      },
      {
        text: "Go for it.",
        meaning: "去试试 / 放手做吧",
        insight: "原版短句。鼓励对方采取行动。",
        active: true,
        examples: [
          { en: "If you want that slot, go for it.", zh: "想要那个时段就去订。" },
          { en: "Go for it. I'll support you.", zh: "去做吧。我支持你。" },
        ],
      },
      {
        text: "Trust me.",
        meaning: "相信我",
        insight: "原版短句。请求对方信任自己的判断或承诺。",
        active: true,
        examples: [
          { en: "Trust me. This plan will work.", zh: "相信我。这方案行得通。" },
          { en: "Just trust me on this one.", zh: "这件事相信我一次。" },
        ],
      },
      {
        text: "Hear me out.",
        meaning: "听我说完",
        insight: "原版短句。提出方案前先争取完整陈述机会。",
        active: true,
        examples: [
          { en: "Hear me out before you say no.", zh: "先听我说完再拒绝。" },
          { en: "Please hear me out. I have another option.", zh: "请听我说完。我还有一个方案。" },
        ],
      }
    ],
  }
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
  const id = () => `l2-t${topicIndex + 1}-${idn++}`

  for (const expr of picks.slice(0, 3)) {
    const items = expr.examples.slice(0, 2).map((ex) => ({
      zh: ex.zh,
      answer: ex.en,
      hint: `用「${expr.text}」来表达`,
    }))
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

  const decompSrc = picks[0]
  if (decompSrc?.examples?.[0]) {
    const full = decompSrc.examples[0].en
    const fullZh = decompSrc.examples[0].zh
    const core = decompSrc.text.includes('___')
      ? decompSrc.text.replace('___', '...').replace(/\.\.\./, 'it')
      : decompSrc.text
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

function parseCsvTexts(path) {
  const raw = readFileSync(path, 'utf8')
  const lines = raw.trim().split(/\r?\n/)
  const header = lines[0].split(',')
  const textIdx = header.indexOf('text')
  const texts = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const cols = []
    let cur = ''
    let inQ = false
    for (let j = 0; j < line.length; j++) {
      const c = line[j]
      if (inQ) {
        if (c === '"' && line[j + 1] === '"') {
          cur += '"'
          j++
        } else if (c === '"') inQ = false
        else cur += c
      } else {
        if (c === '"') inQ = true
        else if (c === ',') {
          cols.push(cur)
          cur = ''
        } else cur += c
      }
    }
    cols.push(cur)
    texts.push(cols[textIdx])
  }
  return texts
}

// ── write files ──
mkdirSync(join(OUT, 'teaching-docs'), { recursive: true })

const sceneCsv = [
  'category_name,title,location,required_output_level,required_user_level,description,package_type',
  csvLine([
    '基础口语',
    SCENE,
    '预约、计划变化与问题处理',
    'L2',
    '2',
    '常用英语500句基础篇：在预约、入住、计划变化和简单问题处理中说明背景、确认信息、提出请求并回应解决方案。',
    'course',
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
    'L2',
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

const design = `# 常用英语500句 · 基础篇

## 管理信息

| 字段 | 值 |
| --- | --- |
| 管理状态 | ready |
| 用户标题 | 常用英语500句 · 基础篇 |
| 一级类型 | 课程（\`course\`） |
| 二级主题 | 基础口语 |
| 内容体验 | 知识点练习（\`practice\`） |
| 所属系列 | 常用英语500句 |
| seriesSlug | \`common-english-expressions\` |
| 系列顺序 | 2 |
| 卷册名称 | 基础篇 |
| requiredOutputLevel | \`L2\` |
| requiredUserLevel | 2 |
| 前置学习包 | 常用英语500句 · 入门篇 |
| requiredPrevious | \`true\` |


## 包配置

- \`contentMode\`: \`practice\`
- \`packageType\`: \`course\`
- \`requiredOutputLevel\`: \`L2\`
- 规模：${totalChunks} 条表达；首轮优先开口 ${totalActive} 条

## 学习目标

学习者能在预约、入住、计划变化和简单问题处理中说明背景、确认信息、提出请求并回应解决方案。

## 8 个场景组

1. 澄清、确认与补充问题
2. 邀请、接受、拒绝和改期
3. 酒店、课程与服务预约
4. 说明迟到、延误和计划变化
5. 描述生活小故障并请求处理
6. 表达感受、安慰和实际支持
7. 报告进度、截止时间和下一步
8. 给建议并确认最终方案

## 内容与训练标准

学习 \`Could you...?\`、\`I'd like to...\`、\`The problem is...\`、\`Would ... work for you?\`、\`Let me check...\` 等功能表达。每课新学 5–8 条，必须进入 3–5 轮任务型对话；低于 L2 的表达作为复习，不重复计算。每组约 20 条表达，其中约 8–10 条标为「优先开口」。

最终要求是独立完成一轮生活任务，能够补充时间、原因或影响，并在对方追问后继续交流。

## 文件清单

- \`scenes.csv\` / \`training_topics.csv\` / \`chunks.csv\`（仅 scene_title,topic_title,text,sort_order；释义/例句走语料库富化）
- \`scene_vocabulary.csv\`（仅 scene_title,topic_title,word,sort_order；释义/发音走语料库） / \`sentence_patterns.csv\`（仅 scene_title,topic_title,pattern,sort_order）
- \`warmup_pipeline.json\`（每话题含中译英、英译中、句型操练与句子拆解；id 前缀 \`l2-tN-M\`）
- \`teaching-docs/*.md\`（用户可见教学文档：意思、见解、例句、速查表）

## 数据说明

基础篇按「预约、计划变化与问题处理」重组，不整主题搬运旧包。句子优先对齐原版短句；已进入门篇的表达不重复收录。影视脏话、高冲突、低频表达不进入本卷。冲突时以本卷教学文档为准。
`

writeFileSync(join(OUT, 'teaching-docs', '00-课程总设计.md'), design, 'utf8')

// ── self-check ──
const origPath = join(OUT, '..', '常用英语500句', 'chunks.csv')
const introPath = join(OUT, '..', '常用英语500句：入门篇', 'chunks.csv')
const origTexts = parseCsvTexts(origPath)
const introTexts = parseCsvTexts(introPath)
const origSet = new Set(origTexts.map(normalizeExpr))
const introSet = new Set(introTexts.map(normalizeExpr))

const ourTexts = topics.flatMap((t) => t.expressions.map((e) => e.text))
const misses = ourTexts.filter((t) => !origSet.has(normalizeExpr(t)))
const overlap = ourTexts.filter((t) => introSet.has(normalizeExpr(t)))
const seen = new Set()
const dups = []
for (const t of ourTexts) {
  const n = normalizeExpr(t)
  if (seen.has(n)) dups.push(t)
  seen.add(n)
}

console.log(`原文命中数 / 160：${160 - misses.length} / 160`)
if (misses.length) {
  console.log('未命中列表：')
  for (const m of misses) console.log(' -', m)
}
if (overlap.length) {
  throw new Error(`与入门篇重叠 ${overlap.length} 条：${overlap.join(' | ')}`)
}
if (dups.length) {
  throw new Error(`包内重复：${dups.join(' | ')}`)
}

const functional = topics.flatMap((t) =>
  t.expressions.filter((e) => String(e.insight || '').startsWith('本卷功能句')).map((e) => e.text),
)
if (functional.length) {
  console.log(`功能补句 ${functional.length} 条：`, functional.join(' | '))
}
if (functional.length > 8) {
  throw new Error(`功能补句超过 8 条：${functional.length}`)
}

console.log(`OK: ${topics.length} topics, ${totalChunks} chunks, ${totalActive} active`)
