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
    title: "澄清、确认与追问",
    promptEn: "Clarify meaning, confirm details, and ask follow-up questions.",
    promptZh: "澄清意思、确认细节，并追问补充信息。",
    description: "在预约或计划沟通中听不懂、不确定时，主动澄清并确认对方意图。",
    knowledgePoints: "澄清意思；确认细节；不确定回应；补充追问",
    duration: 900,
    goal: "学习者能在信息不清楚时礼貌追问、确认，并用短句表达不确定。",
    tip: "",
    docIntro: "这一课练「没听清 / 没听懂 / 还不确定」时怎么开口：澄清、确认、追问下一步，而不是假装听懂。",
    patterns: [
    ],
    vocabs: [
      "mean", "pardon", "miss", "serious", "kidding", "sure", "depend", "gotcha",
      "question", "possible", "confirm", "detail", "clarify", "follow-up",
    ],
    expressions: [
      {
        text: "Are you kidding?",
        meaning: "你在开玩笑吧？",
        insight: "更口语的惊讶；熟人间用，正式场合慎用。",
        active: true,
        examples: [
          { en: "No rooms left? Are you kidding?", zh: "没房了？你在开玩笑吧？" },
          { en: "Are you kidding? That was our only slot.", zh: "开玩笑吧？那是我们唯一的时段。" },
        ],
      },
      {
        text: "That depends.",
        meaning: "那得看情况",
        insight: "回答「能不能 / 要不要」前先设条件；常接 on...。",
        active: true,
        examples: [
          { en: "Can we reschedule? — That depends on my shift.", zh: "能改期吗？——要看我班次。" },
          { en: "That depends. What time works for you?", zh: "那得看情况。你什么时间方便？" },
        ],
      },
      {
        text: "Then what?",
        meaning: "然后呢？",
        insight: "追问下一步；适合计划变化后继续推进。",
        active: true,
        examples: [
          { en: "The flight is delayed. — Then what?", zh: "航班延误了。——然后呢？" },
          { en: "Okay, we cancel tonight. — Then what?", zh: "好，今晚取消。——然后呢？" },
        ],
      },
      {
        text: "How is that possible?",
        meaning: "怎么可能呢？",
        insight: "对不合理结果表示困惑；可接着澄清事实。",
        active: true,
        examples: [
          { en: "The key doesn't work. How is that possible?", zh: "钥匙打不开。怎么可能呢？" },
          { en: "How is that possible? We confirmed yesterday.", zh: "怎么可能？我们昨天确认过了。" },
        ],
      },
      {
        text: "Why didn't you tell me?",
        meaning: "你为什么不告诉我？",
        insight: "信息滞后时的追问；语气容易冲，可软化表达。",
        active: true,
        examples: [
          { en: "The meeting moved. Why didn't you tell me?", zh: "会议改了。你为什么不告诉我？" },
          { en: "Why didn't you tell me about the delay?", zh: "延误的事你为什么不告诉我？" },
        ],
      },
      {
        text: "Who told you?",
        meaning: "谁告诉你的？",
        insight: "追问消息来源；语气可软可硬，看场合。",
        active: true,
        examples: [
          { en: "Who told you I was leaving?", zh: "谁告诉你我要走了？" },
          { en: "I didn't post that. — Who told you?", zh: "我没发过。——谁告诉你的？" },
        ],
      },
      {
        text: "How should I know.",
        meaning: "我哪知道。",
        insight: "表示自己不知情；比 I don't know 更冲一点。",
        active: true,
        examples: [
          { en: "Where's the charger? — How should I know.", zh: "充电器呢？——我哪知道。" },
          { en: "How should I know. Ask Maya.", zh: "我哪知道。问 Maya。" },
        ],
      },
      {
        text: "What can I say?",
        meaning: "我还能说什么？",
        insight: "无奈或默认事实时用；常接抱怨或妥协。",
        active: true,
        examples: [
          { en: "The price went up again. What can I say?", zh: "又涨价了。我还能说什么？" },
          { en: "What can I say? You were right.", zh: "我还能说什么？你是对的。" },
        ],
      },
      {
        text: "You didn't see it, did you?",
        meaning: "你没看到，对吗？",
        insight: "反意疑问：期待对方说「没看到」；也可试探对方是否知情。",
        active: true,
        examples: [
          { en: "You didn't see it, did you? I hid the gift.", zh: "你没看到，对吗？礼物我藏起来了。" },
          { en: "Wait, you didn't see it, did you?", zh: "等等，你没看到吧？" },
        ],
      },
      {
        text: "What's wrong with you?",
        meaning: "你怎么回事？",
        insight: "指责或吃惊对方行为；熟人之间更常见，语气偏硬。",
        active: false,
        examples: [
          { en: "You skipped the meeting. What's wrong with you?", zh: "你翘会了。你怎么回事？" },
          { en: "What's wrong with you? That was rude.", zh: "你怎么回事？那样很无礼。" },
        ],
      },
      {
        text: "Why are you doing this?",
        meaning: "你为什么要这样做？",
        insight: "质疑动机；可软可硬，看语气。",
        active: false,
        examples: [
          { en: "Why are you doing this? We already agreed.", zh: "你为什么要这样？我们已经说好了。" },
          { en: "Stop. Why are you doing this?", zh: "停下。你为什么要这样做？" },
        ],
      },
      {
        text: "Who else.",
        meaning: "还有谁。",
        insight: "补问名单或范围；口语里常省略问号语气。",
        active: false,
        examples: [
          { en: "Tom is coming. — Who else.", zh: "Tom 会来。——还有谁。" },
          { en: "Who else needs a copy?", zh: "还有谁要一份？" },
        ],
      },
      {
        text: "Not yet.",
        meaning: "还没。",
        insight: "否定完成；常接 but / I'm on it。",
        active: false,
        examples: [
          { en: "Did you book the room? — Not yet.", zh: "订房了吗？——还没。" },
          { en: "Not yet. Give me five minutes.", zh: "还没。再给我五分钟。" },
        ],
      },
      {
        text: "I doubt it.",
        meaning: "我怀疑 / 不太信。",
        insight: "礼貌表达不信；比 No way 更克制。",
        active: false,
        examples: [
          { en: "Will they finish today? — I doubt it.", zh: "他们今天能做完吗？——我怀疑。" },
          { en: "I doubt it. The traffic is awful.", zh: "不太信。路况很差。" },
        ],
      },
      {
        text: "I knew it.",
        meaning: "我就知道。",
        insight: "预感被证实；可得意也可无奈。",
        active: false,
        examples: [
          { en: "The Wi-Fi is down again. — I knew it.", zh: "网又挂了。——我就知道。" },
          { en: "I knew it. You forgot the key.", zh: "我就知道。你忘带钥匙了。" },
        ],
      },
      {
        text: "It doesn't make sense.",
        meaning: "这说不通。",
        insight: "指出逻辑问题；常作为澄清开场。",
        active: false,
        examples: [
          { en: "He said 3 p.m., then 5. It doesn't make sense.", zh: "他说三点，又说五点。这说不通。" },
          { en: "It doesn't make sense. Can you explain?", zh: "这说不通。你能解释一下吗？" },
        ],
      },
      {
        text: "Stop beating around the bush.",
        meaning: "别拐弯抹角了。",
        insight: "催对方直说重点；语气偏催促。",
        active: false,
        examples: [
          { en: "Stop beating around the bush. Just tell me the price.", zh: "别拐弯抹角了。直接告诉我价格。" },
          { en: "Okay, stop beating around the bush. What's the issue?", zh: "好了，别绕了。问题是什么？" },
        ],
      },
      {
        text: "Just a heads-up.",
        meaning: "提前提醒一下。",
        insight: "预告信息或风险；常接 about / that...。",
        active: false,
        examples: [
          { en: "Just a heads-up: the meeting moved to 4.", zh: "提前提醒一下：会议改到四点了。" },
          { en: "Just a heads-up about the delay.", zh: "关于延误，先跟你说一声。" },
        ],
      },
      {
        text: "A penny for your thoughts?",
        meaning: "你在想什么？",
        insight: "看到对方发呆时的轻松询问；偏口语、略俏皮。",
        active: false,
        examples: [
          { en: "You've been quiet. A penny for your thoughts?", zh: "你一直不说话。在想什么呢？" },
          { en: "A penny for your thoughts? You look worried.", zh: "在想什么？你看起来有心事。" },
        ],
      },
      {
        text: "What I understand.",
        meaning: "据我理解 / 据我所知。",
        insight: "复述自己理解时用；常接 is / that...。",
        active: false,
        examples: [
          { en: "What I understand is we leave at eight.", zh: "据我理解，我们八点出发。" },
          { en: "So, what I understand: no refunds, right?", zh: "所以据我理解：不能退款，对吗？" },
        ],
      }
    ],
  },
  {
    title: "邀约、答应、拒绝与改期",
    promptEn: "Invite someone, accept or decline, and reschedule politely.",
    promptZh: "发出邀请，接受或拒绝，并礼貌改期。",
    description: "在约见、聚餐或同行安排中提出邀请，并处理接受、拒绝与灵活改期。",
    knowledgePoints: "发出邀请；接受；拒绝；改期协商",
    duration: 900,
    goal: "学习者能发出简单邀请，清晰接受或拒绝，并提出可执行的改期方案。",
    tip: "",
    docIntro: "这一课练「要约 / 答应 / 婉拒 / 改时间」：把态度说清楚，同时给人台阶和备选。",
    patterns: [
    ],
    vocabs: [
      "invite", "drink", "tonight", "prefer", "accept", "decline", "reschedule", "chance",
      "bother", "wish", "means", "flexible", "pickup", "call",
    ],
    expressions: [
      {
        text: "What shall we do tonight?",
        meaning: "我们今晚做什么？",
        insight: "开放式征询安排；适合已约上但未定细节。",
        active: true,
        examples: [
          { en: "What shall we do tonight: dinner or a walk?", zh: "今晚做什么：吃饭还是散步？" },
          { en: "We're both free. What shall we do tonight?", zh: "我们都有空。今晚做什么？" },
        ],
      },
      {
        text: "Let's play it by ear.",
        meaning: "到时再说 / 随机应变",
        insight: "计划先不定死，到时候再看情况。",
        active: true,
        examples: [
          { en: "Traffic looks bad. Let's play it by ear.", zh: "路况不好。我们见机行事吧。" },
          { en: "I might finish late. Let's play it by ear.", zh: "我可能晚点结束。我们灵活一点吧。" },
        ],
      },
      {
        text: "Not today.",
        meaning: "今天不行",
        insight: "直接但简短的拒绝；可补 another day。",
        active: true,
        examples: [
          { en: "Can we meet today? — Not today.", zh: "今天能见面吗？——今天不行。" },
          { en: "Not today. How about tomorrow?", zh: "今天不行。明天怎么样？" },
        ],
      },
      {
        text: "Not now.",
        meaning: "现在不行",
        insight: "暂时拒绝，不否定以后；适合忙的时候。",
        active: true,
        examples: [
          { en: "Can you talk? — Not now.", zh: "能聊吗？——现在不行。" },
          { en: "Not now. I'm checking in at the hotel.", zh: "现在不行。我在酒店办理入住。" },
        ],
      },
      {
        text: "She comes along?",
        meaning: "她也一起来吗？",
        insight: "确认同行人员；口语里用陈述语序+问号很常见。",
        active: true,
        examples: [
          { en: "We're going for coffee. She comes along?", zh: "我们去喝咖啡。她也一起来吗？" },
          { en: "She comes along? I can pick you both up.", zh: "她也来吗？我可以一起接你们。" },
        ],
      },
      {
        text: "Why bother?",
        meaning: "何必呢 / 何必费这个劲",
        insight: "觉得不值得去做；可接解释。",
        active: true,
        examples: [
          { en: "Why bother changing it again?", zh: "何必再改一次？" },
          { en: "The place is closed. Why bother going?", zh: "那地方关门了。何必还去？" },
        ],
      },
      {
        text: "Afraid so.",
        meaning: "恐怕是的",
        insight: "不情愿地承认「是这样」。",
        active: true,
        examples: [
          { en: "Is the restaurant full? — Afraid so.", zh: "餐厅满了吗？——恐怕是的。" },
          { en: "Afraid so. We'll need another day.", zh: "恐怕是的。我们得另约一天。" },
        ],
      },
      {
        text: "What are you gonna do at night?",
        meaning: "你晚上打算做什么？",
        insight: "邀约或闲聊开场；gonna 偏口语。",
        active: true,
        examples: [
          { en: "What are you gonna do at night? Want to grab dinner?", zh: "晚上打算干什么？要不要一起吃饭？" },
          { en: "What are you gonna do at night after the class?", zh: "上完课晚上打算做什么？" },
        ],
      },
      {
        text: "I'll just play it by ear.",
        meaning: "我到时随机应变。",
        insight: "表示暂不定死计划；偏口语。",
        active: true,
        examples: [
          { en: "No fixed plan. I'll just play it by ear.", zh: "没固定计划。我到时随机应变。" },
          { en: "If traffic is bad, I'll just play it by ear.", zh: "如果堵车，我就临场看看。" },
        ],
      },
      {
        text: "Now or never.",
        meaning: "机不可失 / 现在不做以后就没机会了。",
        insight: "强调时机紧迫；可作劝说或自我打气。",
        active: false,
        examples: [
          { en: "Book it now. Now or never.", zh: "现在就订。机不可失。" },
          { en: "It's now or never. Ask her today.", zh: "再不说就没机会了。今天就去问她。" },
        ],
      },
      {
        text: "Absolutely.",
        meaning: "当然 / 绝对是。",
        insight: "强肯定；可单独回答，也可接理由。",
        active: false,
        examples: [
          { en: "Can you cover for me? — Absolutely.", zh: "你能帮我顶一下吗？——当然。" },
          { en: "Absolutely. That works for me.", zh: "绝对可以。我没问题。" },
        ],
      },
      {
        text: "I won't.",
        meaning: "我不会（去做）。",
        insight: "拒绝或承诺不做某事；语气短而硬。",
        active: false,
        examples: [
          { en: "Don't tell anyone. — I won't.", zh: "别告诉任何人。——我不会的。" },
          { en: "I won't miss the deadline.", zh: "我不会错过截止日期。" },
        ],
      },
      {
        text: "Me neither.",
        meaning: "我也不 / 我也没有。",
        insight: "附和否定句；肯定附和用 Me too / So do I。",
        active: false,
        examples: [
          { en: "I don't like spicy food. — Me neither.", zh: "我不爱吃辣。——我也不。" },
          { en: "I haven't finished. — Me neither.", zh: "我还没做完。——我也没有。" },
        ],
      },
      {
        text: "So do I.",
        meaning: "我也是。",
        insight: "附和肯定句（助动词 do）；否定用 Neither do I。",
        active: false,
        examples: [
          { en: "I love this cafe. — So do I.", zh: "我喜欢这家咖啡店。——我也是。" },
          { en: "So do I. Let's go again.", zh: "我也是。我们再去一次吧。" },
        ],
      },
      {
        text: "Don't even think about it.",
        meaning: "想都别想。",
        insight: "强硬拒绝；熟人间玩笑或认真制止都可用。",
        active: false,
        examples: [
          { en: "Can I borrow your car? — Don't even think about it.", zh: "车能借我吗？——想都别想。" },
          { en: "Don't even think about quitting now.", zh: "现在想放弃？想都别想。" },
        ],
      },
      {
        text: "Just do it.",
        meaning: "尽管去做 / 去做就行。",
        insight: "催促行动、少纠结；语气直接。",
        active: false,
        examples: [
          { en: "Stop overthinking. Just do it.", zh: "别想太多。去做就行。" },
          { en: "Just do it. Send the email.", zh: "尽管去做。把邮件发出去。" },
        ],
      },
      {
        text: "As my guest.",
        meaning: "以我客人的身份 / 当作我的客人。",
        insight: "邀请对方以客人身份加入；语气偏正式或客气。",
        active: false,
        examples: [
          { en: "Come to the dinner as my guest.", zh: "来晚宴吧，当我的客人。" },
          { en: "You can stay as my guest tonight.", zh: "今晚你可以当我的客人留下来。" },
        ],
      },
      {
        text: "Whatever it takes.",
        meaning: "不惜一切代价。",
        insight: "表决心；常接 I'll do... / We'll...。",
        active: false,
        examples: [
          { en: "We'll finish on time, whatever it takes.", zh: "我们会按时完成，不惜一切代价。" },
          { en: "Whatever it takes to fix this.", zh: "不管怎样都要把这修好。" },
        ],
      },
      {
        text: "She got cold feet.",
        meaning: "她临阵退缩了。",
        insight: "cold feet = 临阵胆怯；也可说 I got cold feet。",
        active: false,
        examples: [
          { en: "She got cold feet and canceled the trip.", zh: "她临阵退缩，取消了旅行。" },
          { en: "Don't get cold feet now.", zh: "现在别打退堂鼓。" },
        ],
      },
      {
        text: "We'll see about that.",
        meaning: "走着瞧 / 那可不一定。",
        insight: "对对方断言表示不服或保留；略带挑战。",
        active: false,
        examples: [
          { en: "You can't finish today. — We'll see about that.", zh: "你今天做不完。——走着瞧。" },
          { en: "We'll see about that after the meeting.", zh: "开完会再说。" },
        ],
      }
    ],
  },
  {
    title: "叫醒、安顿与出门准备",
    promptEn: "Handle waking up, settling in, and getting ready to go out.",
    promptZh: "叫醒、安顿和出门准备。",
    description: "叫醒与起床、收拾安顿，以及出门前的准备与接待。",
    knowledgePoints: "叫醒起床；安顿收拾；出门准备；简单接待",
    duration: 900,
    goal: "能说明叫醒、安顿和出门准备，并回应简单接待。",
    tip: "先说时间或动作，再补一句原因或安排。",
    docIntro: "这一课围着叫醒、收拾安顿和出门准备：把时间说清，再把下一步讲明白。",
    patterns: [
    ],
    vocabs: [],
    expressions: [
      {
        text: "Wake me up at five thirty.",
        meaning: "请在五点半叫醒我。",
        insight: "请人叫醒时把时间说清楚；也可改成其他整点。",
        active: true,
        examples: [
          { en: "Wake me up at five thirty, please. I have an early train.", zh: "请五点半叫醒我。我有早班火车。" },
          { en: "Could you wake me up at five thirty tomorrow?", zh: "明天能五点半叫醒我吗？" },
        ],
      },
      {
        text: "What are you still doing in bed?",
        meaning: "你怎么还不起床？",
        insight: "催对方起床；语气偏直接，熟人间更常见。",
        active: true,
        examples: [
          { en: "It's already eight. What are you still doing in bed?", zh: "都八点了。你怎么还不起床？" },
          { en: "What are you still doing in bed? We need to leave.", zh: "你怎么还不起床？我们该走了。" },
        ],
      },
      {
        text: "I get up at six o'clock.",
        meaning: "我六点起床。",
        insight: "说明作息；把时间换成你的即可。",
        active: true,
        examples: [
          { en: "I get up at six o'clock on weekdays.", zh: "工作日我六点起床。" },
          { en: "I get up at six o'clock, so mornings are quiet.", zh: "我六点起，所以早上比较安静。" },
        ],
      },
      {
        text: "I had to take a shower.",
        meaning: "我得冲个澡。",
        insight: "had to 表示不得不；常用来解释耽误了一会儿。",
        active: false,
        examples: [
          { en: "Sorry I'm late. I had to take a shower.", zh: "抱歉迟到。我得先冲个澡。" },
          { en: "I had to take a shower after the gym.", zh: "健身后我得洗个澡。" },
        ],
      },
      {
        text: "Get dressed now.",
        meaning: "现在就穿好衣服。",
        insight: "催促出门前穿戴；语气短而直接。",
        active: true,
        examples: [
          { en: "We're late. Get dressed now.", zh: "我们迟到了。现在就穿好衣服。" },
          { en: "Get dressed now. The taxi is here.", zh: "赶紧穿好。出租车到了。" },
        ],
      },
      {
        text: "Mother doesn't make up.",
        meaning: "妈妈不化妆。",
        insight: "陈述出门前习惯；也可换成其他人称。",
        active: false,
        examples: [
          { en: "Mother doesn't make up before work.", zh: "妈妈上班前不化妆。" },
          { en: "Mother doesn't make up, but she still looks neat.", zh: "妈妈不化妆，但看起来还是很整洁。" },
        ],
      },
      {
        text: "Take your time to unpack.",
        meaning: "慢慢收拾行李。",
        insight: "让对方先安顿；常和 get settled in 一起说。",
        active: true,
        examples: [
          { en: "Take your time to unpack. Dinner can wait.", zh: "慢慢收拾行李。晚饭可以等。" },
          { en: "Please take your time to unpack first.", zh: "请先慢慢收拾行李。" },
        ],
      },
      {
        text: "And get settled in.",
        meaning: "先安顿下来。",
        insight: "常接在 unpack 后；表示先安顿再谈别的。",
        active: true,
        examples: [
          { en: "Rest a bit and get settled in.", zh: "先休息一下，安顿下来。" },
          { en: "Get settled in, then we'll check the schedule.", zh: "先安顿下来，再看日程。" },
        ],
      },
      {
        text: "You should go pack.",
        meaning: "你该去打包了。",
        insight: "提醒准备出发或退房；可补离开时间。",
        active: true,
        examples: [
          { en: "It's getting late. You should go pack.", zh: "不早了。你该去打包了。" },
          { en: "You should go pack. The shuttle leaves at nine.", zh: "你该去打包。班车九点走。" },
        ],
      },
      {
        text: "It's only for 2 weeks.",
        meaning: "只不过两个星期。",
        insight: "说明停留或安排时长，减轻对方顾虑。",
        active: false,
        examples: [
          { en: "Don't worry. It's only for 2 weeks.", zh: "别担心。只不过两个星期。" },
          { en: "It's only for 2 weeks. Can I extend later?", zh: "只住两周。之后能续吗？" },
        ],
      },
      {
        text: "Business trip.",
        meaning: "出差。",
        insight: "简短说明行程性质；常说 I'm on a business trip。",
        active: false,
        examples: [
          { en: "I'm on a business trip next week.", zh: "我下周出差。" },
          { en: "Business trip. Back on Friday.", zh: "出差。周五回来。" },
        ],
      },
      {
        text: "Thank you so much for helping me move yesterday.",
        meaning: "非常感谢你昨天帮我搬家。",
        insight: "搬家后道谢；也可改成其他帮忙场景。",
        active: false,
        examples: [
          { en: "Thank you so much for helping me move yesterday.", zh: "非常感谢你昨天帮我搬家。" },
          { en: "Thank you so much for helping me move yesterday. I owe you dinner.", zh: "非常感谢你昨天帮我搬家。我请你吃饭。" },
        ],
      },
      {
        text: "Go on in.",
        meaning: "请进 / 你先进去。",
        insight: "让对方先进门；口语短句。",
        active: true,
        examples: [
          { en: "Can I come in? — Go on in.", zh: "我能进来吗？——请进。" },
          { en: "Go on in. I'll park the car.", zh: "你先进去。我去停车。" },
        ],
      },
      {
        text: "Allow me.",
        meaning: "让我来。",
        insight: "主动代劳开门、提行李等；礼貌介入。",
        active: true,
        examples: [
          { en: "That bag looks heavy. — Allow me.", zh: "那个包看着很重。——让我来。" },
          { en: "Allow me. I can carry that bag.", zh: "让我来。我可以提那个包。" },
        ],
      },
      {
        text: "We got company.",
        meaning: "有人来了。",
        insight: "提醒家里来客人了；got 偏口语。",
        active: false,
        examples: [
          { en: "Quiet down. We got company.", zh: "小声点。有人来了。" },
          { en: "We got company. Can you get the door?", zh: "有人来了。你去开下门？" },
        ],
      },
      {
        text: "I would chaperone.",
        meaning: "我会陪同。",
        insight: "表示愿意陪对方去；语气偏正式一点。",
        active: false,
        examples: [
          { en: "If you need someone there, I would chaperone.", zh: "如果你需要人陪，我可以陪同。" },
          { en: "I would chaperone the kids to the station.", zh: "我可以陪孩子们去车站。" },
        ],
      },
      {
        text: "Don't be rude.",
        meaning: "注意礼貌 / 别失礼。",
        insight: "提醒对方对客人或长辈有礼貌。",
        active: false,
        examples: [
          { en: "Don't be rude. Say hello first.", zh: "注意礼貌。先打个招呼。" },
          { en: "Don't be rude to our guests.", zh: "别对客人不礼貌。" },
        ],
      },
      {
        text: "Why did you stay at home?",
        meaning: "你为什么待在家里？",
        insight: "追问没出门的原因；过去时。",
        active: false,
        examples: [
          { en: "Why did you stay at home? Was it raining?", zh: "你为什么待在家里？下雨了吗？" },
          { en: "Why did you stay at home all weekend?", zh: "整个周末你为什么都待在家里？" },
        ],
      },
      {
        text: "What horrible weather!",
        meaning: "这天气真糟糕！",
        insight: "出门前或路上抱怨天气；感叹句。",
        active: false,
        examples: [
          { en: "What horrible weather! Take an umbrella.", zh: "这天气真糟糕！带把伞。" },
          { en: "What horrible weather! Let's stay in.", zh: "这天气真糟糕！我们待在家里吧。" },
        ],
      },
      {
        text: "He was not a bit tired.",
        meaning: "他一点也不累。",
        insight: "not a bit = 一点也不；描述精力状态。",
        active: false,
        examples: [
          { en: "After the long walk, he was not a bit tired.", zh: "走了那么远，他一点也不累。" },
          { en: "He was not a bit tired, so we kept going.", zh: "他一点也不累，所以我们继续走。" },
        ],
      }
    ],
  },
  {
    title: "迟到、延误与计划变化",
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
    ],
    vocabs: [
      "sudden", "delay", "late", "plane", "breakfast", "explain", "deal", "meantime",
      "choice", "complicated", "close", "waiting", "change", "schedule",
    ],
    expressions: [
      {
        text: "All of a sudden.",
        meaning: "突然之间",
        insight: "描述突发变化的开场；后面补具体事件。",
        active: true,
        examples: [
          { en: "All of a sudden, the app went down.", zh: "突然之间，应用挂了。" },
          { en: "All of a sudden they changed the gate.", zh: "突然之间他们改了登机口。" },
        ],
      },
      {
        text: "Something's up.",
        meaning: "有情况 / 出事了",
        insight: "察觉不对劲；可接询问。",
        active: true,
        examples: [
          { en: "He's not answering. Something's up.", zh: "他不回消息。有情况。" },
          { en: "Something's up with the schedule.", zh: "日程好像有问题。" },
        ],
      },
      {
        text: "I can explain.",
        meaning: "我可以解释",
        insight: "迟到或违约后先争取解释机会。",
        active: true,
        examples: [
          { en: "I'm late, but I can explain.", zh: "我迟到了，但我可以解释。" },
          { en: "Wait. I can explain the delay.", zh: "等等。延误的事我可以解释。" },
        ],
      },
      {
        text: "I thought I told you.",
        meaning: "我好像跟你说过",
        insight: "以为信息已同步；可能略带抱怨。",
        active: true,
        examples: [
          { en: "I thought I told you about the new time.", zh: "我以为跟你说过新时间了。" },
          { en: "I thought I told you: bring your ID.", zh: "我以为说过了：带上证件。" },
        ],
      },
      {
        text: "We had a deal.",
        meaning: "我们说好了的",
        insight: "强调原约定；用于改期争议或提醒对方。",
        active: true,
        examples: [
          { en: "We had a deal: no last-minute changes.", zh: "我们说好了：不临时改。" },
          { en: "Come on. We had a deal.", zh: "拜托。我们说好了的。" },
        ],
      },
      {
        text: "Time's up.",
        meaning: "时间到了",
        insight: "截止或限时结束；会议、考试、等待都可用。",
        active: true,
        examples: [
          { en: "Time's up. We need to check out.", zh: "时间到了。我们该退房了。" },
          { en: "Sorry, time's up for this slot.", zh: "抱歉，这个时段时间到了。" },
        ],
      },
      {
        text: "In the meantime.",
        meaning: "与此同时 / 在此期间",
        insight: "说明并行安排；后面接临时方案。",
        active: true,
        examples: [
          { en: "In the meantime, I'll call the hotel.", zh: "与此同时，我给酒店打电话。" },
          { en: "The repair will take an hour. In the meantime, have a seat.", zh: "修理要一小时。这期间请先坐。" },
        ],
      },
      {
        text: "From now on.",
        meaning: "从现在开始",
        insight: "宣布新规则或新习惯；收束混乱。",
        active: true,
        examples: [
          { en: "From now on, let's confirm by text.", zh: "从现在起，我们用短信确认。" },
          { en: "From now on, I'll leave earlier.", zh: "从现在起，我会早点出门。" },
        ],
      },
      {
        text: "As always.",
        meaning: "一如既往",
        insight: "表示情况照旧；可褒可贬。",
        active: true,
        examples: [
          { en: "He's late, as always.", zh: "他迟到了，一如既往。" },
          { en: "Thanks for helping, as always.", zh: "一如既往谢谢你帮忙。" },
        ],
      },
      {
        text: "Not again.",
        meaning: "又来了",
        insight: "对重复问题的无奈；延误多次时很自然。",
        active: false,
        examples: [
          { en: "The train is delayed? — Not again.", zh: "火车延误？——又来了。" },
          { en: "Not again. My phone died.", zh: "又来了。手机没电了。" },
        ],
      },
      {
        text: "That was close.",
        meaning: "好险",
        insight: "差一点出事或差一点迟到后的感叹。",
        active: false,
        examples: [
          { en: "We almost missed it. That was close.", zh: "差点错过。好险。" },
          { en: "That was close. Next time leave earlier.", zh: "好险。下次早点出门。" },
        ],
      },
      {
        text: "I don't remember.",
        meaning: "我不记得了",
        insight: "承认记不清约定细节；可接让我查一下。",
        active: false,
        examples: [
          { en: "What time did we book? — I don't remember.", zh: "我们订的几点？——我不记得了。" },
          { en: "I don't remember the confirmation number.", zh: "我不记得确认号了。" },
        ],
      },
      {
        text: "Doesn't say.",
        meaning: "上面没写 / 没提到",
        insight: "查看通知或短信后发现信息缺失。",
        active: false,
        examples: [
          { en: "Does the email list a time? — Doesn't say.", zh: "邮件写了时间吗？——没写。" },
          { en: "Doesn't say. I'll call to confirm.", zh: "没写。我打电话确认。" },
        ],
      },
      {
        text: "I have no choice.",
        meaning: "我没得选",
        insight: "被迫接受延误或改期时的说明。",
        active: false,
        examples: [
          { en: "The only flight is at midnight. I have no choice.", zh: "只有午夜航班。我没得选。" },
          { en: "I have no choice but to reschedule.", zh: "我只能改期了。" },
        ],
      },
      {
        text: "It's complicated.",
        meaning: "这很复杂",
        insight: "不便细说原因时的挡箭牌；可稍后补充。",
        active: false,
        examples: [
          { en: "Why the delay? — It's complicated.", zh: "为什么延误？——比较复杂。" },
          { en: "It's complicated. Can I explain later?", zh: "比较复杂。我晚点解释行吗？" },
        ],
      },
      {
        text: "Not even close.",
        meaning: "差远了。",
        insight: "否定「差不多」；可玩笑也可认真纠正。",
        active: false,
        examples: [
          { en: "Is this done? — Not even close.", zh: "做完了吗？——差远了。" },
          { en: "Not even close. Try again.", zh: "差远了。再试一次。" },
        ],
      },
      {
        text: "I have a lot on my plate.",
        meaning: "我手头事情很多。",
        insight: "比喻工作/事务繁忙；比 I'm busy 更具体。",
        active: false,
        examples: [
          { en: "I can't join tonight. I have a lot on my plate.", zh: "今晚去不了。我手头事情很多。" },
          { en: "I have a lot on my plate this week.", zh: "这周我事情特别多。" },
        ],
      },
      {
        text: "I'll let you know when I recall.",
        meaning: "等我想起来再告诉你。",
        insight: "暂时想不起来时的缓冲；recall = 回想起来。",
        active: false,
        examples: [
          { en: "What's his name? — I'll let you know when I recall.", zh: "他叫什么？——我想起来再告诉你。" },
          { en: "I'll let you know when I recall the address.", zh: "等我想起地址再跟你说。" },
        ],
      },
      {
        text: "On my own.",
        meaning: "靠我自己 / 我一个人。",
        insight: "强调独自完成或独处；常接 I did it...。",
        active: false,
        examples: [
          { en: "I fixed it on my own.", zh: "我自己修好的。" },
          { en: "I'll go on my own if you're busy.", zh: "你忙的话我就自己去。" },
        ],
      },
      {
        text: "As he likes to remind me.",
        meaning: "就像他常提醒我的那样。",
        insight: "插入语，带一点无奈或吐槽。",
        active: false,
        examples: [
          { en: "I'm always late, as he likes to remind me.", zh: "我总是迟到，他也爱这么提醒我。" },
          { en: "As he likes to remind me, deadlines matter.", zh: "就像他常提醒的，截止日期很重要。" },
        ],
      }
    ],
  },
  {
    title: "出问题、求助与冷静处理",
    promptEn: "Name a problem, ask for help, and stay calm.",
    promptZh: "说出问题、请求帮助，并让场面冷静下来。",
    description: "出问题、求助、试一试，以及冷静、重来。",
    knowledgePoints: "说明麻烦；请求帮助；冷静处理；重新开始",
    duration: 900,
    goal: "能说明麻烦、求助，并稳住情绪再处理。",
    tip: "先说问题，再明确要对方做什么。",
    docIntro: "出事了、帮把手、先冷静——把处理和求助短句说出口。",
    patterns: [
    ],
    vocabs: [
      "problem", "favor", "hand", "try", "supposed", "breaking", "patient", "panic",
      "noise", "repair", "signal", "break", "together", "screw", "pull", "over",
    ],
    expressions: [
      {
        text: "What am I supposed to do?",
        meaning: "我该怎么办？",
        insight: "不知所措时的求助；可带一点焦虑。",
        active: true,
        examples: [
          { en: "The key is missing. What am I supposed to do?", zh: "钥匙不见了。我该怎么办？" },
          { en: "What am I supposed to do if it happens again?", zh: "要是再这样我该怎么办？" },
        ],
      },
      {
        text: "You're breaking up.",
        meaning: "你的信号不好",
        insight: "通话信号差时即时反馈；请对方重复或换方式。",
        active: true,
        examples: [
          { en: "You're breaking up. Can you text me instead?", zh: "信号不好。能不能改发短信？" },
          { en: "Sorry, you're breaking up. Say that again?", zh: "抱歉信号不好。再说一遍？" },
        ],
      },
      {
        text: "Start over.",
        meaning: "重新开始",
        insight: "流程出错后要求重来；预约填表、设置都常用。",
        active: true,
        examples: [
          { en: "That form is wrong. Start over.", zh: "表格填错了。重新来。" },
          { en: "Let's start over from the beginning.", zh: "我们从头再来。" },
        ],
      },
      {
        text: "Take a break.",
        meaning: "休息一下",
        insight: "情绪或体力到极限时建议暂停。",
        active: true,
        examples: [
          { en: "You're stressed. Take a break.", zh: "你压力太大了。休息一下。" },
          { en: "Take a break, then try again.", zh: "休息一下，再试。" },
        ],
      },
      {
        text: "Calm down.",
        meaning: "冷静",
        insight: "安抚激动情绪；语气要柔，否则像命令。",
        active: true,
        examples: [
          { en: "Calm down. We'll fix this.", zh: "冷静。我们会处理好。" },
          { en: "Please calm down and tell me what happened.", zh: "请冷静，告诉我发生了什么。" },
        ],
      },
      {
        text: "Be patient.",
        meaning: "耐心点",
        insight: "提醒等待处理；服务排队时常见。",
        active: true,
        examples: [
          { en: "Be patient. The technician is coming.", zh: "耐心点。技术员在路上。" },
          { en: "Be patient. These things take time.", zh: "耐心点。这种事需要时间。" },
        ],
      },
      {
        text: "Let's not waste our time.",
        meaning: "咱们别浪费时间了。",
        insight: "推动尽快处理；略带催促。",
        active: true,
        examples: [
          { en: "Let's not waste our time. Call support now.", zh: "别浪费时间了。现在就打支持电话。" },
          { en: "The line is long. Let's not waste our time here.", zh: "队很长。别在这浪费时间了。" },
        ],
      },
      {
        text: "Stop making such a noise.",
        meaning: "别吵了。",
        insight: "要求降低噪音；注意礼貌场合。",
        active: true,
        examples: [
          { en: "Please stop making such a noise. People are resting.", zh: "请别这么吵。别人在休息。" },
          { en: "Stop making such a noise with that alarm.", zh: "别让那个闹钟一直响。" },
        ],
      },
      {
        text: "I screwed up.",
        meaning: "我搞砸了",
        insight: "承认失误；便于对方一起善后。",
        active: true,
        examples: [
          { en: "I screwed up the booking date.", zh: "我把预订日期搞砸了。" },
          { en: "Sorry, I screwed up. Can we fix it?", zh: "抱歉，我搞砸了。能补救吗？" },
        ],
      },
      {
        text: "I've had it.",
        meaning: "我受够了",
        insight: "忍无可忍；情绪强，对事不对人更安全。",
        active: false,
        examples: [
          { en: "I've had it with this buggy app.", zh: "这个破应用我受够了。" },
          { en: "I've had it. Let's get help.", zh: "受够了。我们找人帮忙吧。" },
        ],
      },
      {
        text: "Get yourself together.",
        meaning: "振作点 / 打起精神",
        insight: "催自己或熟人振作；对生人可能显得硬。",
        active: false,
        examples: [
          { en: "Get yourself together. We'll handle it.", zh: "振作点。我们会处理。" },
          { en: "Come on, get yourself together.", zh: "拜托，打起精神来。" },
        ],
      },
      {
        text: "I got it.",
        meaning: "我懂了 / 我来处理",
        insight: "可表示听懂，也可表示「我来搞定」。",
        active: false,
        examples: [
          { en: "The sink is leaking. — I got it.", zh: "水槽漏水。——我去处理。" },
          { en: "I got it. You rest.", zh: "我来搞定。你休息。" },
        ],
      },
      {
        text: "I quit.",
        meaning: "我不干了。",
        insight: "辞职或放弃某事；语气决绝。",
        active: false,
        examples: [
          { en: "This is too much. I quit.", zh: "这也太过分了。我不干了。" },
          { en: "I quit the project yesterday.", zh: "我昨天退出了那个项目。" },
        ],
      },
      {
        text: "I can't sleep.",
        meaning: "我睡不着。",
        insight: "陈述失眠或焦虑；可接 because...。",
        active: false,
        examples: [
          { en: "I can't sleep. Too much on my mind.", zh: "我睡不着。心事太多。" },
          { en: "I can't sleep when it's this hot.", zh: "这么热我睡不着。" },
        ],
      },
      {
        text: "Give me a break.",
        meaning: "饶了我吧 / 得了吧。",
        insight: "嫌烦或觉得夸张；也可求对方宽松一点。",
        active: false,
        examples: [
          { en: "Another meeting? — Give me a break.", zh: "又要开会？——饶了我吧。" },
          { en: "Give me a break. I just got here.", zh: "得了吧。我刚到。" },
        ],
      },
      {
        text: "It's not rocket science.",
        meaning: "这又不是多难的事。",
        insight: "强调并不复杂；略带催促或安慰。",
        active: false,
        examples: [
          { en: "Just follow the steps. It's not rocket science.", zh: "按步骤来。又不难。" },
          { en: "It's not rocket science. You can do it.", zh: "没那么难。你行的。" },
        ],
      },
      {
        text: "Don't bite off more than you can chew.",
        meaning: "别贪多嚼不烂 / 量力而行。",
        insight: "劝对方别接太多；习语。",
        active: false,
        examples: [
          { en: "Don't bite off more than you can chew this term.", zh: "这学期别贪多。" },
          { en: "Slow down. Don't bite off more than you can chew.", zh: "慢一点。量力而行。" },
        ],
      },
      {
        text: "You're off the hook.",
        meaning: "你没事了 / 不用你负责了。",
        insight: "off the hook = 摆脱麻烦或责任。",
        active: false,
        examples: [
          { en: "We found the bug. You're off the hook.", zh: "bug 找到了。没你的事了。" },
          { en: "You're off the hook. I'll handle it.", zh: "你解放了。我来处理。" },
        ],
      },
      {
        text: "Knock it off.",
        meaning: "别闹了 / 住手。",
        insight: "制止烦人行为；语气冲，熟人间用。",
        active: false,
        examples: [
          { en: "Knock it off. I'm trying to work.", zh: "别闹了。我在干活。" },
          { en: "Hey, knock it off!", zh: "嘿，住手！" },
        ],
      },
      {
        text: "Just say it.",
        meaning: "有话直说。",
        insight: "催对方别隐瞒；语气直接。",
        active: false,
        examples: [
          { en: "You look upset. Just say it.", zh: "你看起来不开心。有话直说。" },
          { en: "Just say it. What's wrong?", zh: "直说吧。怎么了？" },
        ],
      }
    ],
  },
  {
    title: "情绪、安慰与支持",
    promptEn: "Share feelings, comfort others, and offer support.",
    promptZh: "表达感受、安慰对方，并给出支持。",
    description: "情绪状态、安慰打气，以及支持与关心。",
    knowledgePoints: "表达感受；安慰鼓励；支持对方；关心近况",
    duration: 900,
    goal: "能说出感受，并给予安慰或支持。",
    tip: "先接住情绪，再给短安慰或实际支持。",
    docIntro: "累、烦、紧张或低落时，怎么说感受，怎么安慰和支持别人。",
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
      },
    ],
    vocabs: [
      "back", "easy", "hang", "cheer", "mood", "exhausted", "confused", "weather",
      "nervous", "spirit", "rough", "support", "sorry", "fed",
    ],
    expressions: [
      {
        text: "I'll make it up to you.",
        meaning: "我会补偿你的",
        insight: "因失误或爽约后承诺弥补。",
        active: true,
        examples: [
          { en: "I cancelled last minute. I'll make it up to you.", zh: "我临时取消了。我会补偿你。" },
          { en: "I'll make it up to you with coffee tomorrow.", zh: "明天请你喝咖啡补偿。" },
        ],
      },
      {
        text: "I am not mad.",
        meaning: "我没有生气",
        insight: "安抚对方别误会情绪；澄清关系。",
        active: true,
        examples: [
          { en: "It's okay. I am not mad.", zh: "没关系。我没有生气。" },
          { en: "I am not mad, just tired.", zh: "我没生气，只是累了。" },
        ],
      },
      {
        text: "You're making me nervous.",
        meaning: "你会让我紧张的",
        insight: "反馈对方行为带来的压力；请求放慢或停止催促。",
        active: true,
        examples: [
          { en: "Please stop rushing me. You're making me nervous.", zh: "别再催我了。你让我很紧张。" },
          { en: "You're making me nervous with that ticking clock.", zh: "那个滴答的钟让我紧张。" },
        ],
      },
      {
        text: "I'm exhausted.",
        meaning: "我累坏了",
        insight: "清楚表达疲惫；可接需要休息。",
        active: true,
        examples: [
          { en: "After the move, I'm exhausted.", zh: "搬家之后我累坏了。" },
          { en: "I'm exhausted. Can we reschedule?", zh: "我累坏了。能改期吗？" },
        ],
      },
      {
        text: "She's under the weather.",
        meaning: "她身体不舒服",
        insight: "惯用语：身体不适；不是在评价天气。",
        active: true,
        examples: [
          { en: "She's under the weather, so she'll stay home.", zh: "她有点不舒服，所以留在家里。" },
          { en: "Tell them she's under the weather today.", zh: "跟他们说她今天身体不适。" },
        ],
      },
      {
        text: "He seems a little nervous.",
        meaning: "他显得有点紧张。",
        insight: "观察并描述他人状态；便于调整沟通方式。",
        active: true,
        examples: [
          { en: "He seems a little nervous before the interview.", zh: "面试前他显得有点紧张。" },
          { en: "He seems a little nervous. Give him a minute.", zh: "他有点紧张。给他一分钟。" },
        ],
      },
      {
        text: "I'm fed up with my work!",
        meaning: "我对工作烦死了！",
        insight: "强烈表达厌烦；熟人间宣泄，正式场合慎用。",
        active: true,
        examples: [
          { en: "I'm fed up with my work! I need a break.", zh: "工作烦死了！我需要休息。" },
          { en: "Honestly, I'm fed up with my work!", zh: "说实话，我对工作烦透了！" },
        ],
      },
      {
        text: "There there.",
        meaning: "好啦好啦",
        insight: "安慰哭闹或难过的人；偏哄劝。",
        active: true,
        examples: [
          { en: "There there. It's going to be okay.", zh: "好啦好啦。会没事的。" },
          { en: "There there. Don't cry.", zh: "好啦。别哭。" },
        ],
      },
      {
        text: "Poor thing.",
        meaning: "真可怜 / 真不容易",
        insight: "表达同情；语气要真诚，避免屈尊感。",
        active: true,
        examples: [
          { en: "You waited two hours? Poor thing.", zh: "你等了两小时？真不容易。" },
          { en: "Poor thing. Let me help.", zh: "真够呛。我来帮你。" },
        ],
      },
      {
        text: "That's the spirit.",
        meaning: "这样才对嘛",
        insight: "肯定对方振作或积极态度。",
        active: false,
        examples: [
          { en: "You're trying again? That's the spirit.", zh: "你又试一次？这就对了。" },
          { en: "That's the spirit. Keep going.", zh: "这就对了。继续。" },
        ],
      },
      {
        text: "I'm tired.",
        meaning: "我累了。",
        insight: "身体或情绪疲惫；可接 of... 表厌烦。",
        active: false,
        examples: [
          { en: "I'm tired. Can we continue tomorrow?", zh: "我累了。明天再继续好吗？" },
          { en: "I'm tired of waiting.", zh: "我等烦了。" },
        ],
      },
      {
        text: "Don't cry.",
        meaning: "别哭。",
        insight: "安慰；常接 It's okay / I'm here。",
        active: false,
        examples: [
          { en: "Don't cry. We'll figure it out.", zh: "别哭。我们会想办法。" },
          { en: "Hey, don't cry. I'm right here.", zh: "嘿，别哭。我就在这儿。" },
        ],
      },
      {
        text: "Don't leave me.",
        meaning: "别离开我。",
        insight: "情绪强烈时的挽留；关系语境更常见。",
        active: false,
        examples: [
          { en: "Please don't leave me alone tonight.", zh: "今晚请别留下我一个人。" },
          { en: "Don't leave me. Wait for me.", zh: "别丢下我。等我一下。" },
        ],
      },
      {
        text: "I miss you.",
        meaning: "我想你。",
        insight: "表达思念；可对人或对地方。",
        active: false,
        examples: [
          { en: "I miss you. Call me when you can.", zh: "我想你。方便时打给我。" },
          { en: "I miss you already.", zh: "我已经开始想你了。" },
        ],
      },
      {
        text: "Unbelievable.",
        meaning: "难以置信。",
        insight: "惊讶或不满；可褒可贬看语气。",
        active: false,
        examples: [
          { en: "They canceled again. — Unbelievable.", zh: "又取消了。——难以置信。" },
          { en: "Unbelievable! You finished early!", zh: "太不可思议了！你提前做完了！" },
        ],
      },
      {
        text: "Awesome.",
        meaning: "太棒了。",
        insight: "热情肯定；口语轻松。",
        active: false,
        examples: [
          { en: "We got the table. — Awesome.", zh: "订到位子了。——太棒了。" },
          { en: "Awesome. See you at seven.", zh: "太好了。七点见。" },
        ],
      },
      {
        text: "Outstanding.",
        meaning: "出色 / 好极了。",
        insight: "比 awesome 略正式；常夸表现或结果。",
        active: false,
        examples: [
          { en: "How was the presentation? — Outstanding.", zh: "汇报怎么样？——好极了。" },
          { en: "Outstanding work on this.", zh: "这事做得漂亮。" },
        ],
      },
      {
        text: "I'm bored.",
        meaning: "我好无聊。",
        insight: "陈述无聊；可接 Let's... 找事做。",
        active: false,
        examples: [
          { en: "I'm bored. Want to take a walk?", zh: "好无聊。要不要去走走？" },
          { en: "I'm bored of this show.", zh: "这个节目我看腻了。" },
        ],
      },
      {
        text: "Don't get me started.",
        meaning: "别让我开始吐槽 / 说到这个我就来气。",
        insight: "暗示一开口就停不下来；常带抱怨。",
        active: false,
        examples: [
          { en: "How was the service? — Don't get me started.", zh: "服务怎么样？——别让我开始吐槽。" },
          { en: "Don't get me started on the traffic.", zh: "交通这事别提，一提我就气。" },
        ],
      },
      {
        text: "Let bygones be bygones.",
        meaning: "过去的事就让它过去吧。",
        insight: "劝和解、别再翻旧账。",
        active: false,
        examples: [
          { en: "We argued last week. Let bygones be bygones.", zh: "上周吵过了。过去的就让它过去。" },
          { en: "Come on, let bygones be bygones.", zh: "得了，别再翻旧账了。" },
        ],
      }
    ],
  },
  {
    title: "进展、保证与评价",
    promptEn: "Report progress, give praise, and make simple promises.",
    promptZh: "说进展、给评价，并做简单保证。",
    description: "进展是否顺利、夸奖表现，以及承诺与轮次。",
    knowledgePoints: "报告进展；夸奖评价；承诺保证；轮次交接",
    duration: 900,
    goal: "能汇报进展、评价表现，并给出可信的简短承诺。",
    tip: "先说进展，再评价或承诺下一步。",
    docIntro: "做得怎样、谁该上场、能不能算数——把进展和保证说清楚。",
    patterns: [
      {
        pattern: "I'll do my best.",
        meaning: "我会尽力。",
        slots: "无",
        example: "The deadline is tight, but I'll do my best.",
      },
    ],
    vocabs: [
      "best", "finished", "progress", "impressed", "promise", "turn", "deadline", "sure",
      "deal", "down", "busy", "word", "next", "draft",
    ],
    expressions: [
      {
        text: "I'll do my best.",
        meaning: "我会尽全力",
        insight: "承诺努力但不虚报必成；适合紧截止。",
        active: true,
        examples: [
          { en: "The deadline is tight, but I'll do my best.", zh: "截止很紧，但我会尽力。" },
          { en: "I'll do my best to finish before noon.", zh: "我会尽力中午前完成。" },
        ],
      },
      {
        text: "Went well.",
        meaning: "进展顺利",
        insight: "简短汇报结果正面；可补细节。",
        active: true,
        examples: [
          { en: "How was the meeting? — Went well.", zh: "会开得怎样？——挺顺利。" },
          { en: "The check-in went well.", zh: "入住办理顺利。" },
        ],
      },
      {
        text: "We are all busy with work.",
        meaning: "我们都忙于工作。",
        insight: "说明集体忙碌，解释响应慢或进度受限。",
        active: true,
        examples: [
          { en: "Sorry for the delay. We are all busy with work.", zh: "抱歉延误。大家工作都很忙。" },
          { en: "We are all busy with work this week.", zh: "这周我们都忙于工作。" },
        ],
      },
      {
        text: "You have my word.",
        meaning: "我保证 / 说话算数",
        insight: "加重承诺可信度；比 I promise 略郑重。",
        active: true,
        examples: [
          { en: "I'll send it tonight. You have my word.", zh: "今晚发出。我保证。" },
          { en: "You have my word: no more delays.", zh: "我保证：不再延误。" },
        ],
      },
      {
        text: "I promise.",
        meaning: "我保证",
        insight: "直接承诺；最好接可验证的行动。",
        active: true,
        examples: [
          { en: "I promise I'll confirm by five.", zh: "我保证五点前确认。" },
          { en: "Please don't forget. — I promise.", zh: "请别忘了。——我保证。" },
        ],
      },
      {
        text: "My turn.",
        meaning: "轮到我了",
        insight: "交接任务或发言权。",
        active: true,
        examples: [
          { en: "You're done? My turn.", zh: "你弄完了？轮到我了。" },
          { en: "My turn to update the status.", zh: "轮到我更新进度了。" },
        ],
      },
      {
        text: "Who's turn?",
        meaning: "该谁了？",
        insight: "确认下一位负责人或发言人。",
        active: true,
        examples: [
          { en: "Who's turn to present?", zh: "该谁汇报了？" },
          { en: "Who's turn to call the hotel?", zh: "该谁给酒店打电话了？" },
        ],
      },
      {
        text: "At this point.",
        meaning: "目前 / 到这一步",
        insight: "总结现状并引出下一步。",
        active: true,
        examples: [
          { en: "At this point, we need one more day.", zh: "目前我们还需要一天。" },
          { en: "At this point, let's pause and check.", zh: "到这一步，先暂停检查一下。" },
        ],
      },
      {
        text: "You promised me.",
        meaning: "你答应过我的",
        insight: "提醒对方先前承诺；适合催进度或兑现约定。",
        active: true,
        examples: [
          { en: "You promised me the draft by Friday.", zh: "你答应过周五给我草稿。" },
          { en: "Remember: you promised me you'd call.", zh: "记得：你答应过会打电话。" },
        ],
      },
      {
        text: "That's for sure.",
        meaning: "那是肯定的",
        insight: "确认判断或承诺；给下一步定调。",
        active: false,
        examples: [
          { en: "We'll hit the deadline. That's for sure.", zh: "我们会赶上截止。那是肯定的。" },
          { en: "Need one more review? That's for sure.", zh: "还要再审一遍？肯定要。" },
        ],
      },
      {
        text: "It's a big deal.",
        meaning: "这是件大事",
        insight: "强调重要性；提醒对方认真对待。",
        active: false,
        examples: [
          { en: "Missing the deadline is a big deal.", zh: "错过截止是大事。" },
          { en: "To the client, it's a big deal.", zh: "对客户来说这很重要。" },
        ],
      },
      {
        text: "Don't let me down.",
        meaning: "别让我失望",
        insight: "施加期望与信任；语气可重，慎用。",
        active: false,
        examples: [
          { en: "I'm counting on you. Don't let me down.", zh: "我就靠你了。别让我失望。" },
          { en: "Don't let me down on this delivery.", zh: "这次交付别让我失望。" },
        ],
      },
      {
        text: "I mean it.",
        meaning: "我说真的",
        insight: "强调态度认真，不是随口一说。",
        active: false,
        examples: [
          { en: "Please rest today. I mean it.", zh: "今天请休息。我说真的。" },
          { en: "I'll help you. I mean it.", zh: "我会帮你。是认真的。" },
        ],
      },
      {
        text: "Bingo",
        meaning: "答对了 / 搞定。",
        insight: "表示猜中或事情成了；口语感叹。",
        active: false,
        examples: [
          { en: "Is this the right key? — Bingo.", zh: "是这把钥匙吗？——对了。" },
          { en: "Bingo! That fixed it.", zh: "搞定！这样就好了。" },
        ],
      },
      {
        text: "Great minds think alike.",
        meaning: "英雄所见略同。",
        insight: "两人想到一块时的轻松评论。",
        active: false,
        examples: [
          { en: "Let's book the same cafe. — Great minds think alike.", zh: "咱们订同一家咖啡店吧。——英雄所见略同。" },
          { en: "Great minds think alike. Same restaurant!", zh: "英雄所见略同。同一家餐厅！" },
        ],
      },
      {
        text: "You deserve it.",
        meaning: "这是你应得的。",
        insight: "可夸赞（奖励）也可反讽（报应）；看语气。",
        active: false,
        examples: [
          { en: "You worked so hard. You deserve it.", zh: "你这么拼。这是你应得的。" },
          { en: "A day off? — You deserve it.", zh: "休息一天？——你应得的。" },
        ],
      },
      {
        text: "That's more like it.",
        meaning: "这还差不多 / 这才像样。",
        insight: "结果终于达标时的评价。",
        active: false,
        examples: [
          { en: "Is this better? — That's more like it.", zh: "这样好点了吗？——这还差不多。" },
          { en: "That's more like it. Thanks.", zh: "这才像样。谢了。" },
        ],
      },
      {
        text: "Nice try.",
        meaning: "想得美 / 不错的尝试。",
        insight: "可讽刺拒绝，也可鼓励没成功的尝试。",
        active: false,
        examples: [
          { en: "Can I skip the fee? — Nice try.", zh: "能免费用吗？——想得美。" },
          { en: "Nice try. You'll get it next time.", zh: "差一点点。下次就行。" },
        ],
      },
      {
        text: "I can see that.",
        meaning: "看得出来。",
        insight: "承认显而易见的事实；可附和或略带无奈。",
        active: false,
        examples: [
          { en: "You're exhausted. — I can see that.", zh: "你累坏了。——看得出来。" },
          { en: "I can see that you're upset.", zh: "我看得出你不开心。" },
        ],
      },
      {
        text: "They praised him highly.",
        meaning: "他们大大地表扬了他。",
        insight: "陈述评价；highly 加强程度。",
        active: false,
        examples: [
          { en: "They praised him highly after the talk.", zh: "演讲后他们大大地表扬了他。" },
          { en: "They praised him highly for the fix.", zh: "因为他修好了，大家对他评价很高。" },
        ],
      }
    ],
  },
  {
    title: "建议、判断与敲定方案",
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
    ],
    vocabs: [
      "point", "idea", "worth", "settled", "honest", "difference", "trust", "advice",
      "guess", "complain", "best", "exercise", "wrong", "confirm",
    ],
    expressions: [
      {
        text: "You've got a point there.",
        meaning: "你说得挺有道理的。",
        insight: "部分同意对方观点；常接补充。",
        active: true,
        examples: [
          { en: "You've got a point there. Let's move the meeting.", zh: "你说得有理。我们改会议吧。" },
          { en: "Hmm, you've got a point there.", zh: "嗯，你说得挺有道理。" },
        ],
      },
      {
        text: "That's a terrific idea!",
        meaning: "真是好主意！",
        insight: "热情肯定建议；推动落地。",
        active: true,
        examples: [
          { en: "Book a morning slot? — That's a terrific idea!", zh: "订上午时段？——真是好主意！" },
          { en: "That's a terrific idea! Let's do it.", zh: "好主意！就这么办。" },
        ],
      },
      {
        text: "For your own good.",
        meaning: "为了你好",
        insight: "劝告时说明动机；注意别显得说教。",
        active: true,
        examples: [
          { en: "Leave earlier, for your own good.", zh: "为了你好，早点出门。" },
          { en: "I'm saying this for your own good.", zh: "我这是为你好才说。" },
        ],
      },
      {
        text: "Some exercise will do you good.",
        meaning: "做点运动对你有益",
        insight: "具体健康建议；也可换成 rest / sleep。",
        active: true,
        examples: [
          { en: "You've been stressed. Some exercise will do you good.", zh: "你压力大。运动对你有好处。" },
          { en: "Some exercise will do you good after sitting all day.", zh: "坐了一天，运动对你有益。" },
        ],
      },
      {
        text: "I would guess that.",
        meaning: "我猜是这样",
        insight: "谨慎推测；避免说成事实。",
        active: true,
        examples: [
          { en: "Will they approve it? — I would guess that.", zh: "他们会批吗？——我猜会。" },
          { en: "I would guess that the delay is traffic.", zh: "我猜延误是因为堵车。" },
        ],
      },
      {
        text: "To be honest.",
        meaning: "老实说",
        insight: "引出真实看法；后面接可能不顺耳的内容。",
        active: true,
        examples: [
          { en: "To be honest, that schedule is too tight.", zh: "老实说，那个日程太紧了。" },
          { en: "To be honest, I prefer the other plan.", zh: "老实说，我更喜欢另一个方案。" },
        ],
      },
      {
        text: "You were right.",
        meaning: "你说得对",
        insight: "承认对方先前判断正确；利于合作。",
        active: true,
        examples: [
          { en: "You were right about leaving early.", zh: "你说该早点出门是对的。" },
          { en: "Okay, you were right.", zh: "好吧，你是对的。" },
        ],
      },
      {
        text: "I think so.",
        meaning: "我想是的",
        insight: "温和同意；把握不是 100% 时也好用。",
        active: true,
        examples: [
          { en: "Is this the best option? — I think so.", zh: "这是最好选项吗？——我想是。" },
          { en: "I think so, but let's double-check.", zh: "我想是，不过再核对一下。" },
        ],
      },
      {
        text: "Don't get me wrong.",
        meaning: "别误会我",
        insight: "接下来说可能被误解的话时先垫一句。",
        active: true,
        examples: [
          { en: "Don't get me wrong. I like the idea, but timing is off.", zh: "别误会。我喜欢这主意，但时机不对。" },
          { en: "Don't get me wrong. I'm not blaming you.", zh: "别误会。我不是在怪你。" },
        ],
      },
      {
        text: "It's no use complaining",
        meaning: "发牢骚没什么用。",
        insight: "劝转向行动；可接 Let's fix it。",
        active: false,
        examples: [
          { en: "It's no use complaining. Let's call support.", zh: "抱怨没用。我们打支持电话吧。" },
          { en: "I know it sucks, but it's no use complaining.", zh: "我知道糟心，但抱怨没用。" },
        ],
      },
      {
        text: "That makes no difference.",
        meaning: "没什么区别",
        insight: "说明选项等价或影响可忽略。",
        active: false,
        examples: [
          { en: "Tuesday or Wednesday? — That makes no difference to me.", zh: "周二或周三？——对我没区别。" },
          { en: "That makes no difference. Either works.", zh: "没区别。哪个都行。" },
        ],
      },
      {
        text: "What's the point?",
        meaning: "有什么意义？",
        insight: "质疑行动价值；语气可消极，注意场合。",
        active: false,
        examples: [
          { en: "If they already decided, what's the point?", zh: "如果他们已决定，还有什么意义？" },
          { en: "What's the point of waiting longer?", zh: "再等下去有什么意义？" },
        ],
      },
      {
        text: "Go for it.",
        meaning: "去试试 / 放手做吧",
        insight: "鼓励对方采取行动。",
        active: false,
        examples: [
          { en: "If you want that slot, go for it.", zh: "想要那个时段就去订。" },
          { en: "Go for it. I'll support you.", zh: "去做吧。我支持你。" },
        ],
      },
      {
        text: "Trust me.",
        meaning: "相信我",
        insight: "请求对方信任自己的判断或承诺。",
        active: false,
        examples: [
          { en: "Trust me. This plan will work.", zh: "相信我。这方案行得通。" },
          { en: "Just trust me on this one.", zh: "这件事相信我一次。" },
        ],
      },
      {
        text: "Hear me out.",
        meaning: "听我说完",
        insight: "提出方案前先争取把话说完。",
        active: false,
        examples: [
          { en: "Hear me out before you say no.", zh: "先听我说完再拒绝。" },
          { en: "Please hear me out. I have another option.", zh: "请听我说完。我还有一个方案。" },
        ],
      },
      {
        text: "If I were you.",
        meaning: "我要是你的话。",
        insight: "虚拟语气给建议；常接 I'd...。",
        active: false,
        examples: [
          { en: "If I were you, I'd call now.", zh: "我要是你，现在就打电话。" },
          { en: "If I were you, I wouldn't wait.", zh: "我要是你，就不会再等了。" },
        ],
      },
      {
        text: "With all due respect.",
        meaning: "恕我直言。",
        insight: "提出不同意见前的缓冲；后面常接 but...。",
        active: false,
        examples: [
          { en: "With all due respect, that won't work.", zh: "恕我直言，那样行不通。" },
          { en: "With all due respect, I disagree.", zh: "恕我直言，我不同意。" },
        ],
      },
      {
        text: "It's a win-win situation.",
        meaning: "这是双赢。",
        insight: "强调双方都受益；商务/协商常用。",
        active: false,
        examples: [
          { en: "If we share the cost, it's a win-win situation.", zh: "如果分摊费用，就是双赢。" },
          { en: "It's a win-win situation for both teams.", zh: "对两队都是双赢。" },
        ],
      },
      {
        text: "The other way around.",
        meaning: "正好相反 / 反过来。",
        insight: "纠正顺序或方向；也可说 the other way round。",
        active: false,
        examples: [
          { en: "I thought you called first. — The other way around.", zh: "我以为你先打的。——正好相反。" },
          { en: "Try it the other way around.", zh: "反过来试一下。" },
        ],
      },
      {
        text: "That's easy for you to say.",
        meaning: "你说得倒容易。",
        insight: "觉得对方站着说话不腰疼；略带抱怨。",
        active: false,
        examples: [
          { en: "Just relax. — That's easy for you to say.", zh: "放松点。——你说得倒容易。" },
          { en: "That's easy for you to say. You have help.", zh: "你说得倒容易。你有人帮忙。" },
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

/**
 * 拆对话话轮。依赖例句原文约定：
 * - 真对话：英文用「空格—空格」，中文用「——」
 * - 同人一句：不用上述分隔（逗号/句号续写）
 */
function splitDialogueTurns(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  if (!/(?:\s+[—–]\s+|——)/u.test(raw)) return []
  const parts = raw
    .split(/\s+[—–]\s+|——/u)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length >= 2 ? parts : []
}

function formatTurnsAB(turns) {
  return turns.map((t, i) => `${i % 2 === 0 ? 'A' : 'B'}: ${t}`)
}

/** 例句渲染：对话按 A/B 换行，中文跟在对应话轮下；非对话保持原样 */
function renderExampleLines(ex) {
  const enTurns = splitDialogueTurns(ex.en)
  const lines = []
  if (enTurns.length) {
    let zhTurns = splitDialogueTurns(ex.zh)
    if (zhTurns.length !== enTurns.length) {
      const byStop = String(ex.zh || '')
        .split(/(?<=[。！？])/u)
        .map((s) => s.trim())
        .filter(Boolean)
      if (byStop.length === enTurns.length) zhTurns = byStop
    }
    enTurns.forEach((turn, i) => {
      const who = i % 2 === 0 ? 'A' : 'B'
      lines.push(`${who}: ${turn}`)
      if (zhTurns.length === enTurns.length) {
        lines.push(`   ${zhTurns[i]}`)
      }
    })
    if (zhTurns.length !== enTurns.length && ex.zh) {
      lines.push(ex.zh)
    }
  } else {
    lines.push(ex.en)
    lines.push(ex.zh)
  }
  return lines
}

function compactDialogueForTable(en) {
  const turns = splitDialogueTurns(en)
  if (!turns.length) return en
  return formatTurnsAB(turns).join(' / ')
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
    expr.examples.forEach((ex, ei) => {
      const block = renderExampleLines(ex)
      if (ei > 0) lines.push('')
      block.forEach((line, li) => {
        lines.push(li === 0 ? `- ${line}` : `  ${line}`)
      })
    })
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  lines.push('## 表达速查表')
  lines.push('')
  lines.push('| # | 表达 | 中文意思 | 自然例句 |')
  lines.push('|---:|---|---|---|')
  topic.expressions.forEach((expr, index) => {
    const sample = compactDialogueForTable(pickNaturalExample(expr).en || '').replace(/\|/g, '\\|')
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
    '常用英语500句基础篇：在澄清追问、邀约改期、叫醒安顿、计划变化、出问题处理、情绪支持、进展评价和建议敲定中完成听懂与回应。',
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

学习者能在澄清追问、邀约改期、叫醒安顿、计划变化、出问题处理和建议敲定中说明情况、确认信息并继续回应。

## 8 个场景组

1. 澄清、确认与追问
2. 邀约、答应、拒绝与改期
3. 叫醒、安顿与出门准备
4. 迟到、延误与计划变化
5. 出问题、求助与冷静处理
6. 情绪、安慰与支持
7. 进展、保证与评价
8. 建议、判断与敲定方案

## 内容与训练标准

学习 \`Could you...?\`、\`I'd like to...\`、\`The problem is...\`、\`Would ... work for you?\`、\`Let me check...\` 等功能表达。每课新学 5–8 条，必须进入 3–5 轮任务型对话；低于 L2 的表达作为复习，不重复计算。每组约 20 条表达，其中约 8–10 条标为「优先开口」。

最终要求是独立完成一轮生活任务，能够补充时间、原因或影响，并在对方追问后继续交流。

## 文件清单

- \`scenes.csv\` / \`training_topics.csv\` / \`chunks.csv\`（仅 scene_title,topic_title,text,sort_order；释义/例句走语料库富化）
- \`scene_vocabulary.csv\`（仅 scene_title,topic_title,word,sort_order；释义/发音走语料库） / \`sentence_patterns.csv\`（仅 scene_title,topic_title,pattern,sort_order）
- \`warmup_pipeline.json\`（每话题含中译英、英译中、句型操练与句子拆解；id 前缀 \`l2-tN-M\`）
- \`teaching-docs/*.md\`（用户可见教学文档：意思、见解、例句、速查表）

## 数据说明

基础篇按「安顿出门、计划变化与问题处理」重组，不整主题搬运旧包。句子优先对齐；已进入门篇的表达不重复收录。影视脏话、高冲突、低频表达不进入本卷。冲突时以本卷教学文档为准。
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
  console.warn(`提示：与入门篇重叠 ${overlap.length} 条（教学文档已生成；句块去重另议）`)
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
