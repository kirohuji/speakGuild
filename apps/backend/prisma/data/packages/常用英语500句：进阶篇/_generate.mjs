/**
 * 一次性生成进阶篇 CSV / MD / warmup_pipeline.json
 * 运行：node _generate.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCENE = '常用英语500句 · 进阶篇'
const OUT = __dirname

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvLine(cols) {
  return cols.map(csvEscape).join(',')
}

/** @type {any[]} */
const topics = [
  {
    title: "评价、保留与不完全同意",
    promptEn: "Give opinions with room to soften or partially disagree.",
    promptZh: "表达评价时留余地，或只同意一部分。",
    description: "在日常评价里表达看法，同时保留空间、缓和语气或不完全同意。",
    knowledgePoints: "保留评价；不完全同意；缓和语气；说明重点",
    duration: 900,
    goal: "能提出看法并留余地，而不是一锤定音。",
    tip: "先给态度，再补一句原因或限定。",
    docIntro: "这一课练「有看法，但不全盘拍板」：评价、保留、不完全同意，让对话还能继续。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "That's true.",
        meaning: "那是真的 / 说得对。",
        insight: "先承认对方有理，常再接 but... 补充另一面。",
        active: true,
        examples: [
          { en: "You're tired. — That's true.", zh: "你累了。——说得对。" },
          { en: "That's true, but timing is bad.", zh: "说得对，但时机不好。" },
        ],
      },
      {
        text: "No wonder.",
        meaning: "难怪。",
        insight: "听完原因后的恍然；常接 you're late / it failed。",
        active: true,
        examples: [
          { en: "The train was delayed. — No wonder.", zh: "火车延误了。——难怪。" },
          { en: "No wonder you look exhausted.", zh: "难怪你看起来这么累。" },
        ],
      },
      {
        text: "That's weird.",
        meaning: "太奇怪了。",
        insight: "对异常情况的轻松评价；比 ridiculous 更轻。",
        active: true,
        examples: [
          { en: "The door opened by itself. — That's weird.", zh: "门自己开了。——太奇怪了。" },
          { en: "That's weird. Can you check again?", zh: "太奇怪了。你能再查一下吗？" },
        ],
      },
      {
        text: "That's ridiculous.",
        meaning: "这太荒唐了。",
        insight: "明显不合理时的反对；语气比 weird 更强。",
        active: true,
        examples: [
          { en: "They want us to pay twice. — That's ridiculous.", zh: "他们要我们付两次。——太荒唐了。" },
          { en: "That's ridiculous. Let's refuse.", zh: "太荒唐了。我们拒绝吧。" },
        ],
      },
      {
        text: "That's impossible.",
        meaning: "这不可能。",
        insight: "强烈否定可能性；可接解释或要求核对。",
        active: true,
        examples: [
          { en: "He finished in ten minutes. — That's impossible.", zh: "他十分钟就做完了。——不可能。" },
          { en: "That's impossible. We locked the door.", zh: "不可能。我们锁过门了。" },
        ],
      },
      {
        text: "Nonsense.",
        meaning: "瞎说 / 胡说。",
        insight: "直接否定对方说法；熟人间更常见，正式场合慎用。",
        active: true,
        examples: [
          { en: "I never agreed. — Nonsense.", zh: "我从没同意过。——瞎说。" },
          { en: "Nonsense. You said yes yesterday.", zh: "胡说。你昨天说了可以。" },
        ],
      },
      {
        text: "Don't be silly.",
        meaning: "别傻了。",
        insight: "轻松否定对方担心或夸张说法。",
        active: true,
        examples: [
          { en: "Maybe they hate me. — Don't be silly.", zh: "也许他们讨厌我。——别傻了。" },
          { en: "Don't be silly. Of course you can ask.", zh: "别傻了。你当然可以问。" },
        ],
      },
      {
        text: "Not like that.",
        meaning: "不是那样的。",
        insight: "纠正方式或理解；可接演示或说明。",
        active: true,
        examples: [
          { en: "So I press this? — Not like that.", zh: "所以按这个？——不是那样。" },
          { en: "Not like that. Let me show you.", zh: "不是那样。我来示范。" },
        ],
      },
      {
        text: "Who cares.",
        meaning: "谁在乎呢。",
        insight: "表示不在意；语气偏冲，关系近才用。",
        active: false,
        examples: [
          { en: "They canceled the party. — Who cares.", zh: "派对取消了。——谁在乎呢。" },
          { en: "Who cares about the ranking?", zh: "谁在乎排名？" },
        ],
      },
      {
        text: "Good reason.",
        meaning: "理由不错。",
        insight: "认可对方解释；可单独回应。",
        active: true,
        examples: [
          { en: "I stayed home because I was sick. — Good reason.", zh: "我待在家里是因为生病了。——理由不错。" },
          { en: "Good reason. Thanks for telling me.", zh: "理由不错。谢谢告诉我。" },
        ],
      },
      {
        text: "I can tell.",
        meaning: "我看得出来。",
        insight: "表示已从表情/语气读出信息。",
        active: true,
        examples: [
          { en: "You're upset. — I can tell.", zh: "你不开心。——我看得出来。" },
          { en: "I can tell you're not convinced.", zh: "我看得出来你没被说服。" },
        ],
      },
      {
        text: "All that matters.",
        meaning: "最重要的是。",
        insight: "常接 is... 引出真正关键点。",
        active: false,
        examples: [
          { en: "All that matters is we finish today.", zh: "最重要的是我们今天做完。" },
          { en: "Mistakes happen. All that matters is the fix.", zh: "出错难免。最重要的是修好。" },
        ],
      },
    ],
  },
  {
    title: "附和、补充与换角度看",
    promptEn: "Agree in part, add another side, or reframe the point.",
    promptZh: "部分附和、补充另一面，或换个角度看。",
    description: "在对方观点上附和、补充或换角度，让讨论更完整。",
    knowledgePoints: "部分附和；补充另一面；换角度看；轻松接话",
    duration: 900,
    goal: "能附和一部分并自然补上另一面。",
    tip: "先接住对方，再加一句自己的角度。",
    docIntro: "这一课练「接住对方，再补一句」：附和、补充、换角度看，而不是只会说 yes/no。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "I bet you do.",
        meaning: "我想也是 / 我猜你也是。",
        insight: "附和对方自称的喜好或习惯；偏口语。",
        active: true,
        examples: [
          { en: "I love late-night snacks. — I bet you do.", zh: "我爱吃宵夜。——我想也是。" },
          { en: "I bet you do. Same here.", zh: "我想也是。我也一样。" },
        ],
      },
      {
        text: "I'm not.",
        meaning: "才没有呢。",
        insight: "快速否认对方猜测；语气轻松或急着澄清。",
        active: true,
        examples: [
          { en: "You're angry. — I'm not.", zh: "你生气了。——才没有。" },
          { en: "I'm not. Just tired.", zh: "才没有。只是累了。" },
        ],
      },
      {
        text: "Now you're talking",
        meaning: "这才像话嘛。",
        insight: "对方终于提出靠谱方案时的附和；口语感强。",
        active: true,
        examples: [
          { en: "Let's split the cost. — Now you're talking.", zh: "我们分摊费用吧。——这才像话。" },
          { en: "Now you're talking. That works.", zh: "这才像话。这样可以。" },
        ],
      },
      {
        text: "That's always the case.",
        meaning: "总是这样 / 习以为常了。",
        insight: "表示情况反复出现；略带无奈。",
        active: true,
        examples: [
          { en: "The meeting ran long again. — That's always the case.", zh: "会又开超时了。——总是这样。" },
          { en: "That's always the case with Monday traffic.", zh: "周一堵车总是这样。" },
        ],
      },
      {
        text: "It's the best of both worlds.",
        meaning: "两全其美。",
        insight: "两个好处兼得时的总结评价。",
        active: true,
        examples: [
          { en: "Remote work and office days? — It's the best of both worlds.", zh: "远程再加办公室？——两全其美。" },
          { en: "It's the best of both worlds for us.", zh: "对我们来说两全其美。" },
        ],
      },
      {
        text: "give him the benefit of the doubt.",
        meaning: "姑且相信他吧。",
        insight: "证据不足时先往好处想；也可换成 her/them。",
        active: true,
        examples: [
          { en: "Maybe he forgot. Let's give him the benefit of the doubt.", zh: "也许他忘了。先姑且相信他吧。" },
          { en: "I'd give him the benefit of the doubt this time.", zh: "这次我愿意先相信他。" },
        ],
      },
      {
        text: "Oh,you are kidding me.",
        meaning: "哦，你别拿我开玩笑了。",
        insight: "语料写法含逗号贴合；表示不信或觉得夸张。",
        active: true,
        examples: [
          { en: "They want it tonight. — Oh,you are kidding me.", zh: "他们今晚就要。——你别开玩笑了。" },
          { en: "Oh,you are kidding me. Say that again?", zh: "你别开玩笑了。再说一遍？" },
        ],
      },
      {
        text: "It was close.",
        meaning: "差一点点 / 好险。",
        insight: "差一点就成功或出事；事后评价。",
        active: false,
        examples: [
          { en: "We almost missed the train. — It was close.", zh: "差点误了火车。——好险。" },
          { en: "It was close, but we made it.", zh: "好险，但我们赶上了。" },
        ],
      },
      {
        text: "It felt good.",
        meaning: "感觉真好。",
        insight: "事后回味体验；也可接 to help / to finish。",
        active: false,
        examples: [
          { en: "After the talk, it felt good.", zh: "谈完之后感觉真好。" },
          { en: "It felt good to finally decide.", zh: "终于决定了，感觉真好。" },
        ],
      },
      {
        text: "It felt funny.",
        meaning: "感觉挺好笑的 / 感觉怪怪的。",
        insight: "funny 可指好笑或怪异，看语境。",
        active: false,
        examples: [
          { en: "His excuse felt funny.", zh: "他的借口听着怪怪的。" },
          { en: "It felt funny, so I asked again.", zh: "感觉不对，所以我又问了一次。" },
        ],
      },
      {
        text: "I bet it felt good.",
        meaning: "应该感觉很爽吧。",
        insight: "替对方推测感受；语气轻松。",
        active: false,
        examples: [
          { en: "You finished early. — I bet it felt good.", zh: "你提前做完了。——应该很爽吧。" },
          { en: "I bet it felt good to hear that.", zh: "听到那个应该很开心吧。" },
        ],
      },
      {
        text: "You're gloating.",
        meaning: "你很得意嘛。",
        insight: "指出对方在炫耀；可玩笑可认真。",
        active: false,
        examples: [
          { en: "I told you I'd win. — You're gloating.", zh: "我说了我会赢。——你很得意嘛。" },
          { en: "Stop. You're gloating.", zh: "行了。你太得意了。" },
        ],
      },
    ],
  },
  {
    title: "边界、缓和与轻度拒绝",
    promptEn: "Set boundaries, calm things down, and refuse without escalating.",
    promptZh: "划清边界、缓和气氛，并轻度拒绝。",
    description: "在被催促、被冒犯或被逼时，缓和语气并守住边界。",
    knowledgePoints: "划清边界；缓和语气；轻度拒绝；提醒分寸",
    duration: 900,
    goal: "能守住边界并避免把冲突升级。",
    tip: "先停住对方，再给一句清楚的底线。",
    docIntro: "这一课练「别被带着走」：缓和、划边界、轻度拒绝，把对话拉回可控范围。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "Don't push me.",
        meaning: "别逼我。",
        insight: "被催太紧时的边界；语气硬，慎用于正式场合。",
        active: true,
        examples: [
          { en: "Decide now! — Don't push me.", zh: "现在就定！——别逼我。" },
          { en: "Don't push me. I need a minute.", zh: "别逼我。给我一分钟。" },
        ],
      },
      {
        text: "Don't talk to me like that.",
        meaning: "别这样跟我说话。",
        insight: "指出语气不当；要求对方换个说法。",
        active: true,
        examples: [
          { en: "Hurry up, idiot. — Don't talk to me like that.", zh: "快点，笨蛋。——别这样跟我说话。" },
          { en: "Don't talk to me like that. I'm helping.", zh: "别这样跟我说话。我在帮忙。" },
        ],
      },
      {
        text: "Don't lie to me.",
        meaning: "不要对我说谎。",
        insight: "要求诚实；关系语境更常见。",
        active: true,
        examples: [
          { en: "I wasn't there. — Don't lie to me.", zh: "我当时不在。——别对我说谎。" },
          { en: "Don't lie to me. I saw the message.", zh: "别骗我。我看到消息了。" },
        ],
      },
      {
        text: "Settle down",
        meaning: "安静 / 冷静点。",
        insight: "让对方别激动；也可用于课堂或孩子场景。",
        active: true,
        examples: [
          { en: "Everyone, settle down.", zh: "各位，安静。" },
          { en: "Settle down. We can talk.", zh: "冷静点。我们能谈。" },
        ],
      },
      {
        text: "Get over yourself.",
        meaning: "别自以为是了。",
        insight: "批评对方自我中心；冲，仅熟人或冲突场景。",
        active: true,
        examples: [
          { en: "Only my plan works. — Get over yourself.", zh: "只有我的方案行。——别自以为是了。" },
          { en: "Get over yourself and listen.", zh: "别自以为是，听一下。" },
        ],
      },
      {
        text: "Get a life.",
        meaning: "去做点正经事吧。",
        insight: "嫌对方瞎操心或无聊；很冲，少用。",
        active: false,
        examples: [
          { en: "I track all your posts. — Get a life.", zh: "我盯着你所有动态。——去做点正经事吧。" },
          { en: "Get a life. This isn't worth it.", zh: "去做点正经事吧。这不值得。" },
        ],
      },
      {
        text: "You mustn't aim too high",
        meaning: "你不可好高骛远。",
        insight: "提醒目标别不切实际；语气偏提醒。",
        active: true,
        examples: [
          { en: "You mustn't aim too high this month.", zh: "这个月你别好高骛远。" },
          { en: "Start small. You mustn't aim too high.", zh: "从小处开始。别好高骛远。" },
        ],
      },
      {
        text: "Do as I say.",
        meaning: "照我说的做。",
        insight: "强指令；上下级或紧急时更常见。",
        active: false,
        examples: [
          { en: "Do as I say. Stay outside.", zh: "照我说的做。待在外面。" },
          { en: "Just do as I say for now.", zh: "现在先照我说的做。" },
        ],
      },
      {
        text: "And don't tell.",
        meaning: "别告诉别人。",
        insight: "叮嘱保密；常接 anyone。",
        active: true,
        examples: [
          { en: "This is a surprise. And don't tell.", zh: "这是个惊喜。别告诉别人。" },
          { en: "And don't tell Mom yet.", zh: "也先别告诉妈妈。" },
        ],
      },
      {
        text: "Do you have to take the car?",
        meaning: "你非要把车开走吗？",
        insight: "质疑必要性；have to 表必须。",
        active: true,
        examples: [
          { en: "Do you have to take the car? I need it later.", zh: "非要把车开走吗？我等会儿要用。" },
          { en: "Do you have to take the car every day?", zh: "你每天都必须开车吗？" },
        ],
      },
      {
        text: "show me.",
        meaning: "给我看看 / 教我一下。",
        insight: "请求演示；口语里常不大写。",
        active: true,
        examples: [
          { en: "I don't get it. Show me.", zh: "我不懂。给我看一下。" },
          { en: "Show me how you fixed it.", zh: "教我你是怎么修好的。" },
        ],
      },
      {
        text: "show it to me.",
        meaning: "给我看看。",
        insight: "强调把「它」拿过来看；比 show me 更指向具体物品。",
        active: false,
        examples: [
          { en: "Is this the note? Show it to me.", zh: "这是那张纸条吗？给我看看。" },
          { en: "Show it to me on your phone.", zh: "在你手机上给我看一下。" },
        ],
      },
    ],
  },
  {
    title: "惊喜、吐槽与情绪接话",
    promptEn: "React to surprises, vent lightly, and keep emotional replies natural.",
    promptZh: "对惊喜与吐槽自然接话，并保持情绪回应得体。",
    description: "听到意外、离谱或好笑的消息时，用短句自然接住。",
    knowledgePoints: "惊喜回应；轻度吐槽；情绪接话；语气词",
    duration: 900,
    goal: "能对好坏消息给出自然短回应。",
    tip: "先接情绪，再决定要不要追问细节。",
    docIntro: "这一课练「先接住情绪」：惊喜、吐槽、无奈，用短句把对话续上。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "Hilarious.",
        meaning: "真搞笑。",
        insight: "觉得好笑时的短评；可褒可刺，看语气。",
        active: true,
        examples: [
          { en: "He wore two different shoes. — Hilarious.", zh: "他穿了两只不一样的鞋。——真搞笑。" },
          { en: "Hilarious. Tell me more.", zh: "真搞笑。再说细点。" },
        ],
      },
      {
        text: "This is incredible.",
        meaning: "这太不可思议了。",
        insight: "强烈惊讶；可好可坏。",
        active: true,
        examples: [
          { en: "We got free tickets. — This is incredible.", zh: "我们拿到免费票。——太不可思议了。" },
          { en: "This is incredible. How did you do it?", zh: "太不可思议了。你怎么做到的？" },
        ],
      },
      {
        text: "This is insane.",
        meaning: "这太疯狂了。",
        insight: "觉得离谱或过激；口语感强。",
        active: true,
        examples: [
          { en: "They moved the deadline to tonight. — This is insane.", zh: "截止日期改到今晚。——太疯狂了。" },
          { en: "This is insane. We need help.", zh: "太疯狂了。我们需要帮忙。" },
        ],
      },
      {
        text: "It's amazing.",
        meaning: "太amazing了 / 不可思议。",
        insight: "正面惊叹更多；也可泛指惊讶。",
        active: true,
        examples: [
          { en: "The view from here is amazing. — It's amazing.", zh: "这里的景色太棒了。——真不可思议。" },
          { en: "It's amazing you finished so fast.", zh: "你这么快做完，太厉害了。" },
        ],
      },
      {
        text: "You're really killing me!",
        meaning: "真是笑死我了！",
        insight: "被逗狠了的夸张反应；熟人间用。",
        active: true,
        examples: [
          { en: "Then the dog stole the cake. — You're really killing me!", zh: "然后狗把蛋糕叼走了。——笑死我了！" },
          { en: "You're really killing me! Stop.", zh: "笑死我了！别说了。" },
        ],
      },
      {
        text: "For crying out loud!",
        meaning: "我的天啊！",
        insight: "不耐烦或吃惊的感叹；偏口语。",
        active: true,
        examples: [
          { en: "For crying out loud! Not again.", zh: "我的天！又来了。" },
          { en: "For crying out loud, just call them.", zh: "我的天，直接打电话啊。" },
        ],
      },
      {
        text: "For god's sake.",
        meaning: "拜托 / 有没有搞错。",
        insight: "催促或不满；语气冲，注意场合。",
        active: true,
        examples: [
          { en: "For god's sake, hurry up.", zh: "拜托，快点。" },
          { en: "For god's sake. We already paid.", zh: "有没有搞错。我们付过了。" },
        ],
      },
      {
        text: "What's so funny.",
        meaning: "有什么好笑的。",
        insight: "质疑对方笑点；可认真可玩笑。",
        active: true,
        examples: [
          { en: "Why are you laughing? What's so funny.", zh: "你笑什么？有什么好笑的。" },
          { en: "What's so funny about my idea?", zh: "我的主意有什么好笑的？" },
        ],
      },
      {
        text: "In a what?",
        meaning: "什么？",
        insight: "没听清关键词时的短追问；口语。",
        active: true,
        examples: [
          { en: "Meet me in a foyer. — In a what?", zh: "在门厅见。——在什么？" },
          { en: "In a what? Say that slower.", zh: "在什么？说慢一点。" },
        ],
      },
      {
        text: "Tired of.",
        meaning: "受够了。",
        insight: "常接名词/动名词：Tired of waiting。",
        active: true,
        examples: [
          { en: "I'm tired of waiting.", zh: "我等烦了。" },
          { en: "Tired of excuses. Just fix it.", zh: "受够借口了。修好就行。" },
        ],
      },
      {
        text: "You're mad.",
        meaning: "你生气了 / 你疯了。",
        insight: "mad 可指生气或发疯，看语境。",
        active: false,
        examples: [
          { en: "You're mad. I can see it.", zh: "你生气了。我看得出来。" },
          { en: "Wait, you're mad at me?", zh: "等等，你在生我的气？" },
        ],
      },
      {
        text: "It rather surprised me.",
        meaning: "那事使我颇感惊讶。",
        insight: "偏正式的惊讶；rather 缓和语气。",
        active: false,
        examples: [
          { en: "It rather surprised me that they agreed.", zh: "他们居然同意了，我颇感惊讶。" },
          { en: "The result rather surprised me.", zh: "结果让我有些惊讶。" },
        ],
      },
    ],
  },
  {
    title: "关系感受与疲惫表达",
    promptEn: "Talk about relationship feelings, fatigue, and soft conflict.",
    promptZh: "表达关系感受、疲惫和轻度冲突。",
    description: "说明累、委屈、在意或关系里的感受，并继续沟通。",
    knowledgePoints: "表达疲惫；关系感受；轻度冲突；收束情绪",
    duration: 900,
    goal: "能说出感受并让对方听懂你的处境。",
    tip: "先说感受，再补一句你需要什么。",
    docIntro: "这一课练「把感受说清楚」：疲惫、在意、委屈，用短句让对方接得住。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "Do you have any idea how tired I am?",
        meaning: "你知不知道我有多累？",
        insight: "强调疲惫程度；略带抱怨，可软化语气。",
        active: true,
        examples: [
          { en: "Do you have any idea how tired I am?", zh: "你知不知道我有多累？" },
          { en: "Do you have any idea how tired I am after today?", zh: "你知道我今天有多累吗？" },
        ],
      },
      {
        text: "Being criticized is awful!",
        meaning: "被人批评真是痛苦！",
        insight: "表达被批评的难受；可接 but I'll improve。",
        active: true,
        examples: [
          { en: "Being criticized is awful!", zh: "被人批评真是痛苦！" },
          { en: "Being criticized is awful, but I learned something.", zh: "被批评很痛苦，但我学到了东西。" },
        ],
      },
      {
        text: "What kind of a person does that.",
        meaning: "怎么会有这样的人。",
        insight: "对不当行为的评价；略带指责。",
        active: true,
        examples: [
          { en: "He left without paying. What kind of a person does that.", zh: "他没付钱就走了。怎么会有这样的人。" },
          { en: "What kind of a person does that to a friend?", zh: "怎么能这样对朋友？" },
        ],
      },
      {
        text: "I would do anything for you.",
        meaning: "我愿意为你做任何事。",
        insight: "表达强烈支持；关系近时更自然。",
        active: true,
        examples: [
          { en: "I would do anything for you. Just ask.", zh: "我愿意为你做任何事。说就行。" },
          { en: "You know I would do anything for you.", zh: "你知道我愿意为你做任何事。" },
        ],
      },
      {
        text: "I'm not leaving you.",
        meaning: "我不会离开你的。",
        insight: "安抚担心被抛弃的对方。",
        active: true,
        examples: [
          { en: "I'm scared. — I'm not leaving you.", zh: "我害怕。——我不会离开你。" },
          { en: "I'm not leaving you in this mess.", zh: "我不会丢下你不管的。" },
        ],
      },
      {
        text: "He doesn't care about me.",
        meaning: "他并不在乎我。",
        insight: "表达被忽视的感受；也可换成 she/they。",
        active: true,
        examples: [
          { en: "He doesn't care about me. He never calls.", zh: "他并不在乎我。从不打电话。" },
          { en: "Maybe he doesn't care about me.", zh: "也许他并不在乎我。" },
        ],
      },
      {
        text: "I'm nothing really.",
        meaning: "我真的什么也不是。",
        insight: "自我贬低；安慰场景中需小心接住。",
        active: false,
        examples: [
          { en: "I'm nothing really. Don't wait for me.", zh: "我真的什么也不是。别等我。" },
          { en: "Why so sad? — I'm nothing really.", zh: "怎么这么难过？——我觉得自己什么也不是。" },
        ],
      },
      {
        text: "I felt no regret for it.",
        meaning: "对这件事我不觉得后悔。",
        insight: "表明立场：做过的选择不后悔。",
        active: false,
        examples: [
          { en: "I felt no regret for it.", zh: "对这件事我不后悔。" },
          { en: "Looking back, I felt no regret for it.", zh: "回头看，我并不后悔。" },
        ],
      },
      {
        text: "We're even.",
        meaning: "咱们打平 / 谁也不欠谁。",
        insight: "互帮后清账，或比分打平。",
        active: true,
        examples: [
          { en: "You paid last time. We're even.", zh: "上次你付的。咱们打平。" },
          { en: "Thanks for covering me. — We're even.", zh: "谢谢你帮我顶。——谁也不欠谁。" },
        ],
      },
      {
        text: "You are a chicken.",
        meaning: "你是个胆小鬼。",
        insight: "激将或玩笑指责胆小；易伤人，慎用。",
        active: false,
        examples: [
          { en: "Come on, jump. You are a chicken.", zh: "来啊，跳。你是个胆小鬼。" },
          { en: "Don't call me that. — You are a chicken.", zh: "别这么叫我。——你就是胆小鬼。" },
        ],
      },
      {
        text: "And you know nothing.",
        meaning: "而你什么都不知道。",
        insight: "指出对方信息不完整；语气易冲。",
        active: false,
        examples: [
          { en: "You say it's easy, and you know nothing.", zh: "你说容易，而你什么都不知道。" },
          { en: "And you know nothing about the pressure here.", zh: "而你根本不知道这里的压力。" },
        ],
      },
      {
        text: "happy birthday.",
        meaning: "生日快乐。",
        insight: "祝福生日；可加名字或 to you。",
        active: true,
        examples: [
          { en: "Happy birthday. Did you get my message?", zh: "生日快乐。收到我消息了吗？" },
          { en: "Hey, happy birthday!", zh: "嘿，生日快乐！" },
        ],
      },
    ],
  },
  {
    title: "决定、行动与惯用提醒",
    promptEn: "Push decisions and action with practical idioms.",
    promptZh: "用惯用语推动决定与行动。",
    description: "在犹豫、风险和行动之间，用惯用语提醒对方或自己。",
    knowledgePoints: "推动决定；行动提醒；风险惯用语；和解",
    duration: 900,
    goal: "能用惯用语推动决定或提醒风险。",
    tip: "惯用语先理解场景，再决定要不要主动说。",
    docIntro: "这一课是「决定与行动」向的惯用语：提醒、推动、和解，先听懂，再挑选能用的。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "mark my words.",
        meaning: "记住我说的 / 不信走着瞧。",
        insight: "强调自己的预判；语气坚定。",
        active: true,
        examples: [
          { en: "Mark my words. This plan will work.", zh: "记住我说的。这计划行得通。" },
          { en: "It'll rain later. Mark my words.", zh: "等会儿会下雨。不信走着瞧。" },
        ],
      },
      {
        text: "The ball is in your court.",
        meaning: "该你采取行动了。",
        insight: "下一步取决于对方；协商收尾常用。",
        active: true,
        examples: [
          { en: "I sent the offer. The ball is in your court.", zh: "报价发了。下一步看你。" },
          { en: "The ball is in your court now.", zh: "现在该你行动了。" },
        ],
      },
      {
        text: "He's still sitting on the fence.",
        meaning: "他还没做出决定。",
        insight: "比喻犹豫不决；可换其他人称。",
        active: true,
        examples: [
          { en: "About the job offer: he's still sitting on the fence.", zh: "工作邀请那事：他还在犹豫。" },
          { en: "Don't sit on the fence too long.", zh: "别犹豫太久。" },
        ],
      },
      {
        text: "Bring it on.",
        meaning: "放马过来。",
        insight: "接受挑战；自信或硬气时用。",
        active: true,
        examples: [
          { en: "The hard part starts now. — Bring it on.", zh: "难的部分开始了。——放马过来。" },
          { en: "Bring it on. I'm ready.", zh: "放马过来。我准备好了。" },
        ],
      },
      {
        text: "You have to bite the bullet.",
        meaning: "你得硬着头皮去做。",
        insight: "不喜欢也得做；劝对方扛住。",
        active: true,
        examples: [
          { en: "You have to bite the bullet and call them.", zh: "你得硬着头皮给他们打电话。" },
          { en: "I hate it, but I'll bite the bullet.", zh: "我讨厌这样，但我会硬着头皮做。" },
        ],
      },
      {
        text: "Don't let chances pass by.",
        meaning: "不要让机遇溜走。",
        insight: "鼓励抓住机会。",
        active: true,
        examples: [
          { en: "Don't let chances pass by. Apply today.", zh: "别让机会溜走。今天就申请。" },
          { en: "I won't let chances pass by this time.", zh: "这次我不会再错过机会。" },
        ],
      },
      {
        text: "Don't shoot yourself in the foot.",
        meaning: "别搬石头砸自己的脚。",
        insight: "劝对方别做自找麻烦的事。",
        active: true,
        examples: [
          { en: "Don't shoot yourself in the foot. Keep the receipt.", zh: "别自找麻烦。留着收据。" },
          { en: "Quitting now would shoot yourself in the foot.", zh: "现在辞职是砸自己的脚。" },
        ],
      },
      {
        text: "You've dodged a bullet.",
        meaning: "你成功逃过一劫。",
        insight: "庆幸避开麻烦；事后评论。",
        active: true,
        examples: [
          { en: "The flight was canceled? You've dodged a bullet. Storms ahead.", zh: "航班取消了？你逃过一劫。前面有风暴。" },
          { en: "You've dodged a bullet this time.", zh: "这次你逃过一劫。" },
        ],
      },
      {
        text: "Let's bury the hatchet.",
        meaning: "我们握手言和吧。",
        insight: "提议和解、结束争执。",
        active: true,
        examples: [
          { en: "I'm tired of fighting. Let's bury the hatchet.", zh: "我吵烦了。我们握手言和吧。" },
          { en: "Let's bury the hatchet and move on.", zh: "握手言和，继续往前。" },
        ],
      },
      {
        text: "Don't cry over spilled milk.",
        meaning: "不要为无法挽回的事后悔。",
        insight: "劝对方别纠结已发生的失误。",
        active: true,
        examples: [
          { en: "I deleted the file. — Don't cry over spilled milk.", zh: "我把文件删了。——覆水难收，别纠结了。" },
          { en: "Don't cry over spilled milk. We'll redo it.", zh: "别为打翻的牛奶哭了。我们重做。" },
        ],
      },
      {
        text: "It's a blessing in disguise.",
        meaning: "因祸得福。",
        insight: "坏事带来意外好处时的总结。",
        active: false,
        examples: [
          { en: "Missing that job was a blessing in disguise.", zh: "错过那份工作反而是因祸得福。" },
          { en: "Maybe it's a blessing in disguise.", zh: "也许是因祸得福。" },
        ],
      },
      {
        text: "He was caught red-handed.",
        meaning: "他被逮个正着。",
        insight: "当场抓获；red-handed 为习语。",
        active: false,
        examples: [
          { en: "He was caught red-handed cheating.", zh: "他作弊被逮个正着。" },
          { en: "They caught him red-handed.", zh: "他们当场抓住了他。" },
        ],
      },
    ],
  },
  {
    title: "态度、立场与口语惯用语",
    promptEn: "Show stance and attitude with everyday idioms.",
    promptZh: "用口语惯用语表明态度与立场。",
    description: "用低风险惯用语表明态度、立场或人生常理。",
    knowledgePoints: "表明态度；口语惯用语；关系距离；识别优先",
    duration: 900,
    goal: "能听懂并选用合适的态度类惯用语。",
    tip: "识别型先保证听懂；主动说选最稳妥的。",
    docIntro: "这一课是态度向惯用语：表明立场、轻松接话。先听懂场景，再决定要不要主动用。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "I'm an open book.",
        meaning: "我没有什么秘密 / 我很好懂。",
        insight: "表示自己坦率；可安抚疑虑。",
        active: true,
        examples: [
          { en: "You can ask me anything. I'm an open book.", zh: "你什么都能问。我很好懂。" },
          { en: "I'm an open book with my team.", zh: "我对团队没什么隐瞒。" },
        ],
      },
      {
        text: "You don't say.",
        meaning: "这还要你说 / 是吗。",
        insight: "可表「早就知道」或轻微讽刺；看语气。",
        active: true,
        examples: [
          { en: "Traffic is bad. — You don't say.", zh: "路况很差。——这还用你说。" },
          { en: "You don't say. I noticed.", zh: "是吗。我注意到了。" },
        ],
      },
      {
        text: "Pardon my French.",
        meaning: "原谅我说脏话。",
        insight: "说了粗口后的玩笑式道歉；正式场合少用。",
        active: false,
        examples: [
          { en: "Pardon my French, but that was stupid.", zh: "恕我说句粗的，但那太蠢了。" },
          { en: "That idea is, pardon my French, awful.", zh: "那主意，恕我直言，糟透了。" },
        ],
      },
      {
        text: "East,west,home is best.",
        meaning: "金窝银窝不如自己的草窝。",
        insight: "强调家最舒服；分隔写法依语料。",
        active: true,
        examples: [
          { en: "After the trip: East,west,home is best.", zh: "旅行结束：还是自家最好。" },
          { en: "East,west,home is best. I'm staying in.", zh: "还是家好。我待在家里。" },
        ],
      },
      {
        text: "All for one,one for all.",
        meaning: "我为人人，人人为我。",
        insight: "团队互助口号式表达。",
        active: true,
        examples: [
          { en: "Team rule: All for one,one for all.", zh: "团队规矩：我为人人，人人为我。" },
          { en: "All for one,one for all. We finish together.", zh: "人人为我。我们一起做完。" },
        ],
      },
      {
        text: "They seem like nice people.",
        meaning: "他们看起来像好人。",
        insight: "初步印象评价；seem 表不确定。",
        active: true,
        examples: [
          { en: "They seem like nice people. Let's say hi.", zh: "他们看起来不错。我们去打个招呼。" },
          { en: "First meeting: they seem like nice people.", zh: "第一次见面：他们看起来像好人。" },
        ],
      },
      {
        text: "You should have seen yourself.",
        meaning: "你真该看看你自己那样子。",
        insight: "事后调侃对方当时的样子。",
        active: false,
        examples: [
          { en: "You should have seen yourself on stage.", zh: "你真该看看自己在台上的样子。" },
          { en: "You should have seen yourself. So nervous!", zh: "你真该看看自己。紧张成那样！" },
        ],
      },
      {
        text: "Close your eyes.",
        meaning: "闭上眼睛。",
        insight: "引导放松或准备惊喜时的短指令。",
        active: false,
        examples: [
          { en: "Close your eyes. I have a surprise.", zh: "闭上眼睛。我有惊喜。" },
          { en: "Close your eyes and count to ten.", zh: "闭上眼睛，数到十。" },
        ],
      },
      {
        text: "Do I start now?",
        meaning: "我可以开始了吗？",
        insight: "开始前确认许可。",
        active: true,
        examples: [
          { en: "I'm ready. Do I start now?", zh: "我准备好了。现在可以开始吗？" },
          { en: "Do I start now, or wait?", zh: "我现在开始，还是等一下？" },
        ],
      },
      {
        text: "Which book we talking about?",
        meaning: "哪一本书？",
        insight: "口语省略 are；确认讨论对象。",
        active: true,
        examples: [
          { en: "Which book we talking about for class?", zh: "课上说的是哪本书？" },
          { en: "Wait, which book we talking about?", zh: "等等，我们说的是哪本？" },
        ],
      },
      {
        text: "Remember what the doctor said.",
        meaning: "记得医生的叮嘱。",
        insight: "提醒遵守医嘱或关键注意事项。",
        active: true,
        examples: [
          { en: "Remember what the doctor said: rest today.", zh: "记得医生的叮嘱：今天休息。" },
          { en: "Before the trip, remember what the doctor said.", zh: "出发前，记得医生怎么说的。" },
        ],
      },
      {
        text: "I have the right to know",
        meaning: "我有权知道。",
        insight: "主张知情权；语气偏正式、坚定。",
        active: false,
        examples: [
          { en: "I have the right to know what happened.", zh: "我有权知道发生了什么。" },
          { en: "As a client, I have the right to know.", zh: "作为客户，我有权知道。" },
        ],
      },
    ],
  },
  {
    title: "说明情况、补救与确认",
    promptEn: "Explain situations, offer fixes, and confirm next steps.",
    promptZh: "说明情况、提出补救，并确认下一步。",
    description: "把丢东西、失误、补救和确认说清楚，推动问题解决。",
    knowledgePoints: "说明情况；承诺补救；确认对象；收尾",
    duration: 900,
    goal: "能说明问题并给出补救或确认。",
    tip: "先说事实，再承诺你会怎么做。",
    docIntro: "这一课练「说清楚并补救」：说明情况、承认疏忽、确认对象，把事往前推。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "I left it right here.",
        meaning: "我明明放在这儿的。",
        insight: "强调位置；常接 but it's gone。",
        active: true,
        examples: [
          { en: "I left it right here. Where did it go?", zh: "我明明放这儿的。去哪了？" },
          { en: "I left it right here on the desk.", zh: "我就放在这张桌子上。" },
        ],
      },
      {
        text: "My car needs washing.",
        meaning: "我的车需要洗一洗。",
        insight: "need + V-ing 表需要被……。",
        active: false,
        examples: [
          { en: "My car needs washing this weekend.", zh: "这周末车得洗一下。" },
          { en: "My car needs washing. It's filthy.", zh: "车得洗了。太脏了。" },
        ],
      },
      {
        text: "I will be more careful.",
        meaning: "我会更小心的。",
        insight: "道歉后承诺改正；可缩写 I'll。",
        active: true,
        examples: [
          { en: "Sorry about that. I will be more careful.", zh: "抱歉。我会更小心。" },
          { en: "I will be more careful next time.", zh: "下次我会更小心。" },
        ],
      },
      {
        text: "I will never forget it.",
        meaning: "我会记着的。",
        insight: "强调不会忘记帮助、教训或约定。",
        active: true,
        examples: [
          { en: "Thanks for helping. I will never forget it.", zh: "谢谢帮忙。我会记着的。" },
          { en: "I will never forget it. You saved me.", zh: "我不会忘。你帮了我大忙。" },
        ],
      },
      {
        text: "Is the cut still painful?",
        meaning: "伤口还在痛吗？",
        insight: "关心伤势；也可引申询问是否还难受。",
        active: false,
        examples: [
          { en: "Is the cut still painful?", zh: "伤口还在痛吗？" },
          { en: "Is the cut still painful, or better now?", zh: "伤口还痛吗，还是好些了？" },
        ],
      },
      {
        text: "I can't breathe.",
        meaning: "我喘不上气 / 我无法呼吸。",
        insight: "可指身体不适，也可夸张表示太紧张/太挤。",
        active: false,
        examples: [
          { en: "Open a window. I can't breathe.", zh: "开窗。我喘不上气。" },
          { en: "This elevator is packed. I can't breathe.", zh: "电梯太挤了。我喘不上气。" },
        ],
      },
      {
        text: "I'm gonna memorize them.",
        meaning: "我要把它们记下来。",
        insight: "gonna 偏口语；表打算记住。",
        active: false,
        examples: [
          { en: "These phrases help. I'm gonna memorize them.", zh: "这些表达有用。我要记下来。" },
          { en: "I'm gonna memorize them before the test.", zh: "考试前我要把它们背下来。" },
        ],
      },
      {
        text: "In my mind.",
        meaning: "在我看来 / 在我脑子里。",
        insight: "可表想法所在，或「依我看」。",
        active: false,
        examples: [
          { en: "In my mind, we should wait.", zh: "在我看来，我们应该再等等。" },
          { en: "I keep replaying it in my mind.", zh: "我脑子里一直在回放这件事。" },
        ],
      },
      {
        text: "I'm being punished.",
        meaning: "我被处罚了 / 我在受罚。",
        insight: "说明正在受罚；也可夸张自嘲。",
        active: false,
        examples: [
          { en: "No phone today. I'm being punished.", zh: "今天不能玩手机。我在受罚。" },
          { en: "Why early shift? — I'm being punished.", zh: "为什么上早班？——我在受罚。" },
        ],
      },
      {
        text: "I got no use.",
        meaning: "我用不上。",
        insight: "口语否定用途；也可说 I have no use for it。",
        active: false,
        examples: [
          { en: "Keep the adapter. I got no use.", zh: "适配器你留着。我用不上。" },
          { en: "I got no use for that app.", zh: "那个应用我用不上。" },
        ],
      },
      {
        text: "Just for entertainment.",
        meaning: "只是为了消遣一下。",
        insight: "说明目的轻松，无严肃企图。",
        active: false,
        examples: [
          { en: "I'm watching it just for entertainment.", zh: "我看这个只是消遣。" },
          { en: "Just for entertainment, not for study.", zh: "只是消遣，不是为了学习。" },
        ],
      },
      {
        text: "I heard some one laughing",
        meaning: "我听见有人在笑。",
        insight: "语料拼写为 some one；转述听到的声音。",
        active: false,
        examples: [
          { en: "I heard some one laughing next door.", zh: "我听见隔壁有人在笑。" },
          { en: "Quiet. I heard some one laughing.", zh: "安静。我听见有人在笑。" },
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
  const id = () => `l3-t${topicIndex + 1}-${idn++}`

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
    '观点保留、轻度分歧与惯用语',
    'L3',
    '3',
    '常用英语500句进阶篇：在保留评价、附和补充、边界拒绝、情绪接话、关系感受、决定行动和惯用语中完成自然回应。',
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
    'L3',
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

const design = `# 常用英语500句 · 进阶篇

## 管理信息

| 字段 | 值 |
| --- | --- |
| 管理状态 | ready |
| 用户标题 | 常用英语500句 · 进阶篇 |
| 一级类型 | 课程（\`course\`） |
| 二级主题 | 基础口语 |
| 内容体验 | 知识点练习（\`practice\`） |
| 所属系列 | 常用英语500句 |
| seriesSlug | \`common-english-expressions\` |
| 系列顺序 | 3 |
| 卷册名称 | 进阶篇 |
| requiredOutputLevel | \`L3\` |
| requiredUserLevel | 3 |
| 前置学习包 | 常用英语500句 · 基础篇 |
| requiredPrevious | \`true\`


## 包配置

- \`contentMode\`: \`practice\`
- \`packageType\`: \`course\`
- \`requiredOutputLevel\`: \`L3\`
- 规模：${totalChunks} 条表达；首轮优先开口 ${totalActive} 条

## 学习目标

学习者能表达保留意见、委婉态度、共情和轻度分歧，让日常对话保持自然连贯。

## 8 个场景组

1. 评价、保留与不完全同意
2. 附和、补充与换角度看
3. 边界、缓和与轻度拒绝
4. 惊喜、吐槽与情绪接话
5. 关系感受与疲惫表达
6. 决定、行动与惯用提醒
7. 态度、立场与口语惯用语
8. 说明情况、补救与确认

## 内容与训练标准

惯用语只选较易理解、不过时且无冒犯风险的内容，并注意关系距离。每课新学 4–7 条，重点比较语气与上下文。识别型俚语不强制主动使用。

最终要求是连续回应追问、解释理由并自然收束。

## 文件清单

- \`scenes.csv\` / \`training_topics.csv\` / \`chunks.csv\`（仅 scene_title,topic_title,text,sort_order）
- \`scene_vocabulary.csv\` / \`sentence_patterns.csv\`
- \`warmup_pipeline.json\`（id 前缀 \`l3-tN-M\`）
- \`teaching-docs/*.md\`（用户可见教学文档）

## 数据说明

进阶篇按「保留评价、边界与惯用语」重组；句子来自原版常用英语500句，且不与入门篇、基础篇重复。影视脏话与高冲突表达不进入本卷。冲突时以本卷教学文档为准。
`

writeFileSync(join(OUT, 'teaching-docs', '00-课程总设计.md'), design, 'utf8')

// ── self-check ──
const origPath = join(OUT, '..', '常用英语500句', 'chunks.csv')
const introPath = join(OUT, '..', '常用英语500句：入门篇', 'chunks.csv')
const basePath = join(OUT, '..', '常用英语500句：基础篇', 'chunks.csv')
const origTexts = parseCsvTexts(origPath)
const introTexts = parseCsvTexts(introPath)
const baseTexts = parseCsvTexts(basePath)
const origSet = new Set(origTexts.map(normalizeExpr))
const priorSet = new Set([...introTexts, ...baseTexts].map(normalizeExpr))

const ourTexts = topics.flatMap((t) => t.expressions.map((e) => e.text))
const misses = ourTexts.filter((t) => !origSet.has(normalizeExpr(t)))
const overlap = ourTexts.filter((t) => priorSet.has(normalizeExpr(t)))
const seen = new Set()
const dups = []
for (const t of ourTexts) {
  const n = normalizeExpr(t)
  if (seen.has(n)) dups.push(t)
  seen.add(n)
}

console.log(`原文命中数 / ${ourTexts.length}：${ourTexts.length - misses.length} / ${ourTexts.length}`)
if (misses.length) {
  console.log('未命中列表：')
  for (const m of misses) console.log(' -', m)
}
if (overlap.length) {
  console.warn(`提示：与入门/基础篇重叠 ${overlap.length} 条（教学文档已生成；句块去重另议）`)
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
