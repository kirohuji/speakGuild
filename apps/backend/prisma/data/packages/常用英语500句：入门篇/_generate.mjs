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
    title: "寒暄、接话与祝福",
    promptEn: "Open a chat, keep small talk moving, and close naturally.",
    promptZh: "自然开场、接话和告别。",
    description: "用高频寒暄、评价与收尾短句开场、接话、告别。",
    knowledgePoints: "寒暄开场；评价回应；告别祝福；话题接续",
    duration: 900,
    goal: "能用短句开场、接话并自然收尾。",
    tip: "先学会开场和收尾；评价类短句用来接话最自然。",
    docIntro: "见面怎么开口、怎么接一句、怎么收尾——挑最常说、最好记的短句。",
    patterns: [
      { pattern: "Have a [adjective] day.", meaning: "祝你有个……的一天", slots: "adjective", example: "Have a nice day." },
      { pattern: "You look [adjective].", meaning: "你看起来……", slots: "adjective", example: "You look great." },
      { pattern: "What a [noun / clause]!", meaning: "真是……！", slots: "noun / clause", example: "What a coincidence." },
    ],
    vocabs: [],
    expressions: [
      {
        text: "What's going on?",
        meaning: "怎么回事？",
        insight: "熟人见面或发现情况时的开场；比 What's wrong 更中性。",
        active: true,
        examples: [
          { en: "Hey, what's going on?", zh: "嘿，怎么回事？" },
          { en: "What's going on here?", zh: "这里怎么回事？" },
        ],
      },
      {
        text: "Not bad.",
        meaning: "还不错",
        insight: "回应 How's it going 一类问题时的轻松评价。",
        active: true,
        examples: [
          { en: "How's work? — Not bad.", zh: "工作怎么样？——还不错。" },
          { en: "The food is not bad.", zh: "这饭还不错。" },
        ],
      },
      {
        text: "Rough day?",
        meaning: "今天不顺利吗？",
        insight: "看对方累或心情不好时的关心问句。",
        active: true,
        examples: [
          { en: "You look tired. Rough day?", zh: "你看着累。今天不顺利吗？" },
          { en: "Rough day? Want some water?", zh: "今天不顺？要不要喝点水？" },
        ],
      },
      {
        text: "How do I look?",
        meaning: "我看起来怎么样?",
        insight: "出门前或换装后征求看法。",
        active: true,
        examples: [
          { en: "How do I look in this jacket?", zh: "我穿这件外套怎么样？" },
          { en: "Wait, how do I look?", zh: "等等，我看起来怎么样？" },
        ],
      },
      {
        text: "You look great.",
        meaning: "你看起来棒极了",
        insight: "见面时的轻松夸赞。",
        active: true,
        examples: [
          { en: "Wow, you look great today.", zh: "哇，你今天看起来真棒。" },
          { en: "You look great. Ready to go?", zh: "你看起来很棒。可以走了吗？" },
        ],
      },
      {
        text: "What a coincidence.",
        meaning: "真巧啊",
        insight: "碰巧遇上或话题撞车时用。",
        active: true,
        examples: [
          { en: "You're here too? What a coincidence.", zh: "你也在？真巧。" },
          { en: "Same bus, what a coincidence.", zh: "同一班车，真巧。" },
        ],
      },
      {
        text: "What a nice day it is!",
        meaning: "今天天气真好!",
        insight: "用天气打开聊天。",
        active: true,
        examples: [
          { en: "What a nice day it is! Let's walk.", zh: "今天天气真好！走走吧。" },
          { en: "Open the window. What a nice day it is!", zh: "开窗吧。今天天气真好！" },
        ],
      },
      {
        text: "Shall we?",
        meaning: "一起……吧？ / 走吧？",
        insight: "邀请立刻一起行动；常跟在 Ready? 或指着门口说，不等于 Shall we discuss。",
        active: true,
        examples: [
          { en: "The table is free. Shall we?", zh: "那桌空了。坐吗？" },
          { en: "Ready? Shall we?", zh: "好了吗？走吧？" },
        ],
      },
      {
        text: "Sleep tight.",
        meaning: "睡个好觉",
        insight: "道别或道晚安时的关心。",
        active: true,
        examples: [
          { en: "Good night. Sleep tight.", zh: "晚安。睡个好觉。" },
          { en: "I'm heading to bed. Sleep tight.", zh: "我去睡了。你也睡好。" },
        ],
      },
      {
        text: "Have a nice day.",
        meaning: "祝你愉快",
        insight: "分手或离开柜台时的礼貌收尾。",
        active: true,
        examples: [
          { en: "Thanks. Have a nice day.", zh: "谢谢。祝你愉快。" },
          { en: "Here's your bag. Have a nice day.", zh: "这是您的包。祝你愉快。" },
        ],
      },
      {
        text: "Have fun.",
        meaning: "玩得开心",
        insight: "对方要去玩、赴约时送行；Cheer up 才是对方心情低落时的打气。",
        active: false,
        examples: [
          { en: "Have fun at the party!", zh: "聚会计玩得开心！" },
          { en: "See you later. Have fun.", zh: "回头见。玩得开心。" },
        ],
      },
      {
        text: "Good luck.",
        meaning: "祝你好运",
        insight: "对方要考试、面试或挑战前的鼓励。",
        active: false,
        examples: [
          { en: "Good luck on your test!", zh: "考试好运！" },
          { en: "Interview tomorrow? Good luck.", zh: "明天面试？祝你好运。" },
        ],
      },
      {
        text: "Take it easy.",
        meaning: "放轻松 / 别太拼",
        insight: "劝对方放松心态；和 Take your time（别催、慢慢来）侧重点不同。",
        active: false,
        examples: [
          { en: "Take it easy. No rush.", zh: "放轻松。不着急。" },
          { en: "You worked all day. Take it easy.", zh: "你忙了一天。放松点。" },
        ],
      },
      {
        text: "Take your time.",
        meaning: "不着急，慢慢来",
        insight: "表示不催促；不是劝人「人生放轻松」（那是 Take it easy）。",
        active: false,
        examples: [
          { en: "Take your time. I'll wait.", zh: "慢慢来。我等你。" },
          { en: "No rush. Take your time.", zh: "别急。慢慢来。" },
        ],
      },
      {
        text: "Home sweet home.",
        meaning: "家真好 / 到家了",
        insight: "到家或想到家时的感叹，不是正式报到用语。",
        active: false,
        examples: [
          { en: "Finally, home sweet home.", zh: "终于，到家了。" },
          { en: "After the trip: home sweet home.", zh: "旅行结束：还是家好。" },
        ],
      },
      {
        text: "Better late than never.",
        meaning: "晚做总比不做好",
        insight: "为迟到或拖延打圆场；也可自嘲「总算做了」。",
        active: false,
        examples: [
          { en: "You're late, but better late than never.", zh: "你迟到了，但晚到总比不到好。" },
          { en: "I finished it today. Better late than never.", zh: "我今天才做完。晚做总比不做强。" },
        ],
      },
      {
        text: "You can call me any time.",
        meaning: "你可以随时打电话给我",
        insight: "留下联系方式、表示随时可联系。",
        active: false,
        examples: [
          { en: "Need help? You can call me any time.", zh: "需要帮忙？随时给我电话。" },
          { en: "You can call me any time after six.", zh: "六点后随时可以打给我。" },
        ],
      },
      {
        text: "Break a leg.",
        meaning: "加油，祝顺利（演出用语）",
        insight: "上台、面试前的加油；字面不是真摔跤。",
        active: false,
        examples: [
          { en: "Break a leg tonight!", zh: "今晚演出加油！" },
          { en: "Your show starts soon. Break a leg.", zh: "演出快开始了。加油。" },
        ],
      },
      {
        text: "Cheer up.",
        meaning: "振作一点 / 开心点",
        insight: "对方情绪低落时鼓励；不是送行用语。",
        active: false,
        examples: [
          { en: "Cheer up. It'll get better.", zh: "振作点。会好起来的。" },
          { en: "Hey, cheer up. I'm here.", zh: "嘿，开心点。我在呢。" },
        ],
      },
      {
        text: "Lucky me.",
        meaning: "我真走运",
        insight: "庆幸或带点自嘲；常接在好事发生后。",
        active: false,
        examples: [
          { en: "Found a seat. Lucky me.", zh: "找到座位了。我真走运。" },
          { en: "They had one left. Lucky me.", zh: "还剩最后一个。我真走运。" },
        ],
      },
    ],
  },
  {
    title: "感谢、简单道歉与回应",
    promptEn: "Thank someone, apologize simply, and respond politely.",
    promptZh: "感谢、简单道歉并礼貌回应。",
    description: "感谢、道歉、夸奖与化解尴尬的短句。",
    knowledgePoints: "感谢夸奖；道歉；礼貌回应；化解尴尬",
    duration: 900,
    goal: "能完成感谢、道歉与基本回应。",
    tip: "道歉先认错，再补一句；夸奖宜短。",
    docIntro: "夸一句、道个歉、把场面接住——都是高频短句。",
    patterns: [
      { pattern: "I'm [adjective].", meaning: "我感到……（佩服/抱歉等）", slots: "adjective", example: "I'm impressed." },
      { pattern: "That's so [adjective].", meaning: "那真是太……了", slots: "adjective", example: "That's so sweet." },
      { pattern: "That's very [adjective].", meaning: "非常……", slots: "adjective", example: "That's very impressive." },
    ],
    vocabs: [],
    expressions: [
      {
        text: "Good job.",
        meaning: "干得好",
        insight: "事刚做完时立刻夸；偏具体表现。",
        active: true,
        examples: [
          { en: "Good job on the report.", zh: "报告做得好。" },
          { en: "You fixed it? Good job.", zh: "你修好了？干得好。" },
        ],
      },
      {
        text: "Congratulations.",
        meaning: "恭喜",
        insight: "祝贺成就或喜事。",
        active: true,
        examples: [
          { en: "Congratulations on the new job!", zh: "恭喜你找到新工作！" },
          { en: "You passed? Congratulations!", zh: "你过了？恭喜！" },
        ],
      },
      {
        text: "Proud of you.",
        meaning: "为你骄傲",
        insight: "更私人的肯定与支持。",
        active: true,
        examples: [
          { en: "I'm so proud of you.", zh: "我真为你骄傲。" },
          { en: "You did it. Proud of you.", zh: "你做到了。为你骄傲。" },
        ],
      },
      {
        text: "My fault.",
        meaning: "我的错",
        insight: "快速认错，不推责。",
        active: true,
        examples: [
          { en: "Sorry, my fault.", zh: "抱歉，我的错。" },
          { en: "The delay was my fault.", zh: "晚点是我的错。" },
        ],
      },
      {
        text: "Way to go.",
        meaning: "好样的",
        insight: "口语夸奖，相当于 Well done；不是指路「往那边走」。",
        active: true,
        examples: [
          { en: "You made it. Way to go!", zh: "你做到了。好样的！" },
          { en: "Way to go on that score.", zh: "这次得分好样的。" },
        ],
      },
      {
        text: "I'm impressed.",
        meaning: "我很佩服",
        insight: "对表现感到佩服。",
        active: true,
        examples: [
          { en: "I'm impressed by your English.", zh: "你的英语让我佩服。" },
          { en: "You finished early. I'm impressed.", zh: "你提前做完了。我很佩服。" },
        ],
      },
      {
        text: "That's so sweet.",
        meaning: "太贴心了",
        insight: "感谢对方体贴的举动。",
        active: true,
        examples: [
          { en: "You brought coffee? That's so sweet.", zh: "你带了咖啡？太贴心了。" },
          { en: "Thanks for waiting. That's so sweet.", zh: "谢谢你等我。太贴心了。" },
        ],
      },
      {
        text: "My apologies.",
        meaning: "抱歉 / 我道歉",
        insight: "比 Sorry 稍正式；适合弄错时间、打扰别人等。",
        active: true,
        examples: [
          { en: "My apologies for the wait.", zh: "抱歉让你久等了。" },
          { en: "My apologies. I got the time wrong.", zh: "抱歉。我弄错时间了。" },
        ],
      },
      {
        text: "Forgive me.",
        meaning: "原谅我",
        insight: "请对方原谅，语气更郑重。",
        active: true,
        examples: [
          { en: "Forgive me. I didn't mean that.", zh: "原谅我。我不是那个意思。" },
          { en: "Please forgive me for being late.", zh: "请原谅我迟到了。" },
        ],
      },
      {
        text: "Well done.",
        meaning: "干得漂亮",
        insight: "肯定完成质量和结果；语气比 Good job 稍稳一点。",
        active: true,
        examples: [
          { en: "Well done. That was clear.", zh: "很好。说得很清楚。" },
          { en: "You cooked this? Well done.", zh: "这是你做的？干得好。" },
        ],
      },
      {
        text: "Bless you.",
        meaning: "保重（别人打喷嚏时）",
        insight: "听到别人打喷嚏时的固定礼貌回应，几乎脱口而出；日常里很少用来当「保佑你」的泛祝福。也可说 God bless you，更短时就说 Bless you。",
        active: false,
        examples: [
          { en: "Achoo! — Bless you.", zh: "阿嚏！——保重。" },
          { en: "Bless you. Here's a tissue.", zh: "保重。纸巾给你。" },
        ],
      },
      {
        text: "You're amazing.",
        meaning: "你很出色",
        insight: "强烈夸奖对方。",
        active: false,
        examples: [
          { en: "You helped everyone. You're amazing.", zh: "你帮了所有人。你真棒。" },
          { en: "You're amazing at this.", zh: "你在这方面真出色。" },
        ],
      },
      {
        text: "You saved my life.",
        meaning: "你可救了我了",
        insight: "感谢很大帮助；日常常夸张，未必真救命。",
        active: false,
        examples: [
          { en: "Thanks. You saved my life with that tip.", zh: "谢谢。你那一招真救了我。" },
          { en: "You found my keys. You saved my life!", zh: "你找到我的钥匙了。太救我了！" },
        ],
      },
      {
        text: "Sorry to interrupt.",
        meaning: "抱歉打扰了",
        insight: "插话前的礼貌铺垫。",
        active: false,
        examples: [
          { en: "Sorry to interrupt. Your phone is ringing.", zh: "抱歉打扰。你电话响了。" },
          { en: "Sorry to interrupt. May I ask one thing?", zh: "抱歉打断一下。我能问一件事吗？" },
        ],
      },
      {
        text: "That's very impressive.",
        meaning: "真厉害",
        insight: "更完整的夸赞句。",
        active: false,
        examples: [
          { en: "You learned that fast. That's very impressive.", zh: "你学得真快。非常厉害。" },
          { en: "That's very impressive work.", zh: "这工作非常出色。" },
        ],
      },
      {
        text: "I am so sorry about this.",
        meaning: "对此我非常抱歉(遗憾)",
        insight: "为造成的麻烦郑重道歉。",
        active: false,
        examples: [
          { en: "I am so sorry about this delay.", zh: "这次延误我非常抱歉。" },
          { en: "I am so sorry about this mistake.", zh: "这个错误我非常抱歉。" },
        ],
      },
      {
        text: "No hard feelings.",
        meaning: "别往心里去 / 不计前嫌",
        insight: "争执或拒绝之后，希望双方别记仇。",
        active: false,
        examples: [
          { en: "We're fine. No hard feelings.", zh: "我们没事。别往心里去。" },
          { en: "I get it. No hard feelings.", zh: "我理解。别介意。" },
        ],
      },
      {
        text: "No offense.",
        meaning: "无意冒犯",
        insight: "接下来要说直话或不中听的话时先垫一句。",
        active: false,
        examples: [
          { en: "No offense, but this is too spicy.", zh: "无意冒犯，但这太辣了。" },
          { en: "No offense, I just need more time.", zh: "无意冒犯，我只是还需要点时间。" },
        ],
      },
      {
        text: "It doesn't matter.",
        meaning: "没关系 / 无所谓",
        insight: "把小事轻轻放下：迟到、选错、弄乱一点都可以这样接。语气比 That's okay 更偏「这事不重要」；对方在道歉时用，能帮对方松一口气。",
        active: false,
        examples: [
          { en: "Late again? — It doesn't matter.", zh: "又迟到？——没关系。" },
          { en: "It doesn't matter. We can go later.", zh: "没关系。我们晚点再去。" },
        ],
      },
      {
        text: "I don't blame you.",
        meaning: "我不怪你",
        insight: "先认对方的处境合理，再表态不追责。适合对方已经解释原因或做了艰难选择时；比 It doesn't matter 更强调「错不在你 / 情有可原」。",
        active: false,
        examples: [
          { en: "You were tired. I don't blame you.", zh: "你累了。我不怪你。" },
          { en: "I don't blame you for saying no.", zh: "你拒绝我不怪你。" },
        ],
      },
    ],
  },
  {
    title: "约饭、结账与用餐回应",
    promptEn: "Make meal plans, settle the bill, and respond at the table.",
    promptZh: "约饭、结账，并在餐桌边做出回应。",
    description: "约吃饭、确认偏好、结账付款，以及餐桌边常用的回应短句。",
    knowledgePoints: "约饭邀约；偏好确认；结账付款；用餐回应",
    duration: 900,
    goal: "能在约饭与用餐场景完成邀约、确认和结账相关短句。",
    tip: "先说要约什么、选什么，再处理结账；答应提议和判断「够不够」不要混用。",
    docIntro: "约一顿饭、问还要不要、怎么结、桌上怎么接一句——围着用餐的短句。",
    patterns: [
      { pattern: "How about a [drink] tonight?", meaning: "今晚……怎么样？", slots: "drink", example: "How about a drink tonight?" },
      { pattern: "Do you accept [payment]?", meaning: "你们收……吗？", slots: "payment", example: "Do you accept credit cards?" },
      { pattern: "Which would you [verb]?", meaning: "你要选哪个？", slots: "verb", example: "Which would you prefer?" },
      { pattern: "That would be [adjective].", meaning: "那会很……", slots: "adjective", example: "That would be great." },
    ],
    vocabs: [],
    expressions: [
      {
        text: "Anything else?",
        meaning: "还要别的吗？",
        insight: "店员点完单后常问；你当客人时多半答 No, thanks. / That's all. 自己请客或帮人点单时，也可以反过来问对方还要不要加。",
        active: true,
        examples: [
          { en: "A coffee, please. — Anything else? — No, thanks.", zh: "请来杯咖啡。——还要别的吗？——不用了，谢谢。" },
          { en: "Anything else for you? — Just water.", zh: "还要别的吗？——只要水。" },
        ],
      },
      {
        text: "Keep the change.",
        meaning: "不用找了",
        insight: "付现金时把零钱当小费或嫌找零麻烦；不是「留着找零以后再用」。",
        active: true,
        examples: [
          { en: "Here's twenty. Keep the change.", zh: "这是二十。不用找了。" },
          { en: "That'll be twelve. — Here's fifteen. Keep the change.", zh: "一共十二。——这是十五。不用找了。" },
        ],
      },
      {
        text: "Do you accept credit cards?",
        meaning: "你们收信用卡吗?",
        insight: "付款前确认支付方式。",
        active: true,
        examples: [
          { en: "Do you accept credit cards? — Yes, we do.", zh: "你们收信用卡吗？——收。" },
          { en: "Before I order, do you accept credit cards?", zh: "点之前问一下，收信用卡吗？" },
        ],
      },
      {
        text: "How about a drink tonight?",
        meaning: "今晚喝一杯怎样？",
        insight: "轻松邀约；a drink 常指喝酒，也可说得含糊。",
        active: true,
        examples: [
          { en: "How about a drink tonight after work?", zh: "下班后今晚喝一杯怎样？" },
          { en: "I'm free. How about a drink tonight?", zh: "我有空。今晚喝一杯怎样？" },
        ],
      },
      {
        text: "That would be great.",
        meaning: "那太好了",
        insight: "别人提出帮助、邀请或选项时，用来热情答应：「这个好，我要」。重点是欢迎对方的提议，语气积极。",
        active: true,
        examples: [
          { en: "Want a window seat? — That would be great.", zh: "要靠窗吗？——那太好了。" },
          { en: "I can help. — That would be great.", zh: "我可以帮忙。——那太好了。" },
        ],
      },
      {
        text: "That should do nicely.",
        meaning: "这样就够了 / 刚好合适",
        insight: "看完份量、座位、方案后做判断：「这个刚好、够用」，不是在欢呼接受邀请。和 That would be great 比：后者偏「太好了，我乐意」；本句偏「这样就可以了」。",
        active: true,
        examples: [
          { en: "Is this table okay? — That should do nicely.", zh: "这桌行吗？——这样就很好。" },
          { en: "Two sandwiches? That should do nicely.", zh: "两个三明治？这样就够了。" },
        ],
      },
      {
        text: "Finished already?",
        meaning: "这就好了？ / 吃完了？",
        insight: "带点惊讶：对方结束得比预期快。",
        active: true,
        examples: [
          { en: "Finished already? That was fast.", zh: "已经吃完了？真快。" },
          { en: "You're done? Finished already?", zh: "好了？这么快就结束了？" },
        ],
      },
      {
        text: "You're gonna miss breakfast.",
        meaning: "你要错过早餐时间了",
        insight: "提醒对方别错过早餐。",
        active: true,
        examples: [
          { en: "Hurry up. You're gonna miss breakfast.", zh: "快点。你要错过早餐了。" },
          { en: "It's almost nine. You're gonna miss breakfast.", zh: "快九点了。你要赶不上早餐了。" },
        ],
      },
      {
        text: "Supper is ready at six.",
        meaning: "晚餐六点钟就好了",
        insight: "告知开饭时间。",
        active: true,
        examples: [
          { en: "Supper is ready at six. Don't be late.", zh: "晚餐六点好。别迟到。" },
          { en: "Just so you know, supper is ready at six.", zh: "跟你说一声，晚餐六点好。" },
        ],
      },
      {
        text: "I owe you for my dinner.",
        meaning: "我欠你晚餐的钱",
        insight: "别人先帮你付了餐费时用，表示这顿饭的钱回头再还。",
        active: true,
        examples: [
          { en: "You covered the bill. I owe you for my dinner.", zh: "账单你先付了。这顿晚饭的钱我欠你。" },
          { en: "I owe you for my dinner. I'll pay you back tomorrow.", zh: "这顿晚饭的钱我欠你。我明天还给你。" },
        ],
      },
      {
        text: "I'm not used to drinking.",
        meaning: "我不习惯喝酒",
        insight: "说明自己不太喝酒。",
        active: false,
        examples: [
          { en: "Just water for me. I'm not used to drinking.", zh: "我只要水。我不习惯喝酒。" },
          { en: "I'm not used to drinking. One is enough.", zh: "我不习惯喝酒。一杯就够。" },
        ],
      },
      {
        text: "Those are watermelons.",
        meaning: "那些是西瓜",
        insight: "指认食物或商品。",
        active: false,
        examples: [
          { en: "What's in the box? — Those are watermelons.", zh: "盒子里是什么？——那些是西瓜。" },
          { en: "Those are watermelons, not melons.", zh: "那些是西瓜，不是甜瓜。" },
        ],
      },
      {
        text: "Do you have a reservation?",
        meaning: "您预订了吗？",
        insight: "确认是否预订。",
        active: false,
        examples: [
          { en: "Hi. Do you have a reservation?", zh: "您好。您有预订吗？" },
          { en: "Do you have a reservation under Lee?", zh: "有李先生的预订吗？" },
        ],
      },
      {
        text: "First come first served.",
        meaning: "先到先得",
        insight: "说明没有预约、按到达顺序；常用来解释排队规则。",
        active: false,
        examples: [
          { en: "No tickets left? First come first served.", zh: "票没了？先到先得。" },
          { en: "Seats are first come first served.", zh: "座位先到先得。" },
        ],
      },
      {
        text: "Which would you prefer?",
        meaning: "你要选哪个?",
        insight: "请对方做选择。",
        active: false,
        examples: [
          { en: "Tea or coffee, which would you prefer?", zh: "茶还是咖啡，你更想要哪个？" },
          { en: "Which would you prefer, inside or outside?", zh: "你更想坐里面还是外面？" },
        ],
      },
      {
        text: "Yes,I'd like to.",
        meaning: "好，我想……",
        insight: "I'd like to = I would like to，礼貌答应邀请或提议。",
        active: false,
        examples: [
          { en: "Want to join us? — Yes,I'd like to.", zh: "要一起吗？——好，我想去。" },
          { en: "Would you like to try it? — Yes,I'd like to.", zh: "要试试吗？——好，我想试。" },
        ],
      },
      {
        text: "It's settled, then.",
        meaning: "那就这么定了",
        insight: "双方谈妥后收尾确认。",
        active: false,
        examples: [
          { en: "Six o'clock works. It's settled, then.", zh: "六点可以。那就这么定了。" },
          { en: "We'll take this one. It's settled, then.", zh: "我们要这个。那就定了。" },
        ],
      },
      {
        text: "Just in time.",
        meaning: "刚好赶上",
        insight: "差一点迟到却赶上了；事后感叹。",
        active: false,
        examples: [
          { en: "The bus is here. Just in time.", zh: "车来了。刚好赶上。" },
          { en: "You made it, just in time.", zh: "你赶到了，刚好。" },
        ],
      },
      {
        text: "Will do.",
        meaning: "好的，我会做",
        insight: "回答别人拜托/吩咐：答应去办。不是笼统的「没问题」万能句。",
        active: false,
        examples: [
          { en: "Please call them. — Will do.", zh: "请给他们打电话。——好的，我会。" },
          { en: "Send me the address. — Will do.", zh: "把地址发我。——好的。" },
        ],
      },
      {
        text: "Come on sit.",
        meaning: "过来坐",
        insight: "招呼对方坐下。",
        active: false,
        examples: [
          { en: "Come on sit. The food is ready.", zh: "过来坐。饭好了。" },
          { en: "Don't stand there. Come on sit.", zh: "别站着。过来坐。" },
        ],
      },
    ],
  },
  {
    title: "评价价格、取舍与许可回应",
    promptEn: "Judge the price, decide whether to take it, and give a clear yes or no.",
    promptZh: "评价价格贵不贵、决定买不买，并清楚表示同意或拒绝。",
    description: "评价价格是否合理、值不值得买，以及同意、拒绝、随你便等回应短句。",
    knowledgePoints: "价格评价；买得起与值不值；同意许可；拒绝与随你便",
    duration: 900,
    goal: "能评价价格、做出取舍，并用短句回应许可或拒绝。",
    tip: "先说贵不贵、值不值，再表态；同意与拒绝各记一两句即可。",
    docIntro: "贵不贵、买不买、能不能——判断与回应时真正用得上的短句。",
    patterns: [
      { pattern: "The price is [adjective].", meaning: "价格……", slots: "adjective", example: "The price is reasonable." },
      { pattern: "I can't afford [thing].", meaning: "我买不起……", slots: "thing", example: "I can't afford a new car." },
      { pattern: "It's not worth [it / noun].", meaning: "……不值得", slots: "it / noun", example: "It's not worth it." },
      { pattern: "Of course, it's all [yours].", meaning: "当然都是……的", slots: "yours", example: "Of course, it's all yours." },
    ],
    vocabs: [],
    expressions: [
      {
        text: "The price is reasonable.",
        meaning: "价格还算合理",
        insight: "评价价格可以接受。",
        active: true,
        examples: [
          { en: "For this quality, the price is reasonable.", zh: "按这个质量，价格还算合理。" },
          { en: "I checked online. The price is reasonable.", zh: "我上网查了。价格合理。" },
        ],
      },
      {
        text: "I can't afford a new car.",
        meaning: "我买不起一部新车",
        insight: "说明买不起某物。",
        active: true,
        examples: [
          { en: "I like it, but I can't afford a new car.", zh: "我喜欢，但买不起新车。" },
          { en: "Right now I can't afford a new car.", zh: "目前我买不起新车。" },
        ],
      },
      {
        text: "It's not worth it.",
        meaning: "这不值得",
        insight: "表示不划算、不值得。",
        active: true,
        examples: [
          { en: "Too expensive. It's not worth it.", zh: "太贵了。不值得。" },
          { en: "The wait is long. It's not worth it.", zh: "排队太久。不划算。" },
        ],
      },
      {
        text: "Money is not everything.",
        meaning: "金钱不是一切",
        insight: "提醒别只看钱。",
        active: true,
        examples: [
          { en: "Take the better job. Money is not everything.", zh: "选更好的工作。钱不是一切。" },
          { en: "I know money is not everything, but I still need a job.", zh: "我知道钱不是一切，但我还是需要工作。" },
        ],
      },
      {
        text: "It's too good to be true!",
        meaning: "好得不像真的",
        insight: "觉得优惠或消息可疑、别轻易全信。",
        active: true,
        examples: [
          { en: "Half price? It's too good to be true!", zh: "半价？好得不像真的！" },
          { en: "Free delivery? It's too good to be true!", zh: "免运费？好得难以置信！" },
        ],
      },
      {
        text: "Check it out.",
        meaning: "瞧瞧这个",
        insight: "招呼对方过来看；偏轻松口语。",
        active: true,
        examples: [
          { en: "New colors are in. Check it out.", zh: "新颜色到了。看看。" },
          { en: "Check it out. This one is on sale.", zh: "看看。这个在打折。" },
        ],
      },
      {
        text: "Be my guest.",
        meaning: "请自便 / 请吧",
        insight: "允许对方做某事，态度大方；和 Suit yourself（随你，可带无奈）语气不同。",
        active: true,
        examples: [
          { en: "Can I try this? — Be my guest.", zh: "我能试试吗？——请自便。" },
          { en: "Be my guest. The fitting room is there.", zh: "请自便。试衣间在那边。" },
        ],
      },
      {
        text: "Suit yourself.",
        meaning: "随你便",
        insight: "把选择丢回给对方；可中性，也可略不耐烦。",
        active: true,
        examples: [
          { en: "I won't take it. — Suit yourself.", zh: "我不买了。——随你便。" },
          { en: "Suit yourself. I'll wait outside.", zh: "随你。我在外面等。" },
        ],
      },
      {
        text: "No can do.",
        meaning: "办不到 / 不行",
        insight: "口语直拒，比 Sorry, I can't 更硬、更短。",
        active: true,
        examples: [
          { en: "Can you open early? — No can do.", zh: "能早点开门吗？——不行。" },
          { en: "Refund today? No can do.", zh: "今天退款？办不到。" },
        ],
      },
      {
        text: "As you wish.",
        meaning: "按你的意思",
        insight: "照对方意愿做；语气可礼貌，也可略疏远。",
        active: true,
        examples: [
          { en: "I want the blue one. — As you wish.", zh: "我要蓝色那件。——按你的意思。" },
          { en: "As you wish. I'll wrap it.", zh: "好的。我帮你包起来。" },
        ],
      },
      {
        text: "Whatever you say.",
        meaning: "听你的",
        insight: "让步同意；有时也带一点无奈「随便你」。",
        active: false,
        examples: [
          { en: "Let's get the cheaper one. — Whatever you say.", zh: "买便宜那个吧。——听你的。" },
          { en: "Whatever you say. You're paying.", zh: "听你的。你付钱。" },
        ],
      },
      {
        text: "By all means.",
        meaning: "当然可以，请吧",
        insight: "正式一点地允许；鼓励对方尽管做。",
        active: false,
        examples: [
          { en: "May I look around? — By all means.", zh: "我可以随便看看吗？——当然可以。" },
          { en: "By all means, try it on.", zh: "当然可以，试穿吧。" },
        ],
      },
      {
        text: "Sure thing.",
        meaning: "没问题",
        insight: "没问题。",
        active: false,
        examples: [
          { en: "Can you hold this? — Sure thing.", zh: "能帮我拿一下吗？——没问题。" },
          { en: "Sure thing. I'll bring a bag.", zh: "没问题。我拿个袋子。" },
        ],
      },
      {
        text: "You bet.",
        meaning: "当然 / 一定",
        insight: "爽快肯定；不是真的在打赌。",
        active: false,
        examples: [
          { en: "Is this washable? — You bet.", zh: "这个能洗吗？——当然。" },
          { en: "You bet. It's our best seller.", zh: "当然。这是最畅销的。" },
        ],
      },
      {
        text: "It's for the best.",
        meaning: "或许是件好事",
        insight: "表示这样或许更好。",
        active: false,
        examples: [
          { en: "I didn't buy it. It's for the best.", zh: "我没买。这样或许更好。" },
          { en: "Returning it is okay. It's for the best.", zh: "退掉也行。这样更好。" },
        ],
      },
      {
        text: "This is all mine?",
        meaning: "这些都是我的？",
        insight: "确认这些是否都属于自己。",
        active: false,
        examples: [
          { en: "This is all mine? I only ordered one.", zh: "这些都是我的？我只点了一件。" },
          { en: "Wow, this is all mine?", zh: "哇，这些都给我？" },
        ],
      },
      {
        text: "And this is yours.",
        meaning: "这是你的",
        insight: "把东西交给对方。",
        active: false,
        examples: [
          { en: "Here's my bag, and this is yours.", zh: "这是我的包，这是你的。" },
          { en: "And this is yours. Don't forget it.", zh: "这是你的。别忘了。" },
        ],
      },
      {
        text: "Of course, it's all yours.",
        meaning: "当然都是你的",
        insight: "大方表示都给你。",
        active: false,
        examples: [
          { en: "Can I take these samples? — Of course, it's all yours.", zh: "样品能拿吗？——当然都给你。" },
          { en: "Of course, it's all yours. Enjoy.", zh: "当然都是你的。慢慢挑。" },
        ],
      },
      {
        text: "Give it a try.",
        meaning: "试试吧",
        insight: "鼓励试一下。",
        active: false,
        examples: [
          { en: "Not sure about the size? Give it a try.", zh: "不确定尺码？试试吧。" },
          { en: "Give it a try. You can return it.", zh: "试试看。可以退。" },
        ],
      },
      {
        text: "No biggie.",
        meaning: "小事 / 没关系",
        insight: "把对方道歉或小麻烦轻轻放下；偏随意口语。",
        active: false,
        examples: [
          { en: "I broke a cup. — No biggie.", zh: "我打碎杯子了。——小事。" },
          { en: "Sorry I'm late. — No biggie.", zh: "抱歉迟到。——没事。" },
        ],
      },
    ],
  },
  {
    title: "迷路、在路上与接人",
    promptEn: "Talk about being on the way, lost, and getting around.",
    promptZh: "说路上、迷路和出行相关短句。",
    description: "迷路、在路上、交通与接人相关短句。",
    knowledgePoints: "迷路定位；出行交通；接人等候；到站到家",
    duration: 900,
    goal: "能在出行场景说明位置、交通与接人安排。",
    tip: "先说你在哪、要去哪；听不清方位时用短句确认。",
    docIntro: "迷路、在路上、买票、接人——出门常说的短句。",
    patterns: [
      { pattern: "Where can I buy a [thing]?", meaning: "哪里能买到……？", slots: "thing", example: "Where can I buy a ticket?" },
      { pattern: "When is the next [transport]?", meaning: "下一班……什么时候？", slots: "transport", example: "When is the next train?" },
      { pattern: "I'm here to take you [place].", meaning: "我是来接你去……的", slots: "place", example: "I'm here to take you home." },
      { pattern: "I'd pick [someone] up.", meaning: "我会来接……", slots: "someone", example: "I'd pick her up." },
    ],
    vocabs: [],
    expressions: [
      {
        text: "Now I'm lost.",
        meaning: "我现在迷路了",
        insight: "当场承认迷路。",
        active: true,
        examples: [
          { en: "Wait, this street looks wrong. Now I'm lost.", zh: "等等，这条街不对。我迷路了。" },
          { en: "I missed the turn. Now I'm lost.", zh: "我拐错弯了。现在迷路了。" },
        ],
      },
      {
        text: "On my way.",
        meaning: "在路上了",
        insight: "回答「你到哪了」：已经出发、正在赶来。",
        active: true,
        examples: [
          { en: "Where are you? — On my way.", zh: "你在哪？——在路上了。" },
          { en: "Don't leave. I'm on my way.", zh: "别走。我在路上了。" },
        ],
      },
      {
        text: "Here we are.",
        meaning: "我们到了",
        insight: "到地方时说一声「到了」。",
        active: true,
        examples: [
          { en: "Here we are. This is your stop.", zh: "到了。这是你的站。" },
          { en: "Here we are. Let's go in.", zh: "到了。我们进去吧。" },
        ],
      },
      {
        text: "Where can I buy a ticket?",
        meaning: "在哪里能买到票？",
        insight: "询问购票地点。",
        active: true,
        examples: [
          { en: "Excuse me, where can I buy a ticket?", zh: "请问哪里能买到票？" },
          { en: "Where can I buy a ticket for the train?", zh: "哪里能买火车票？" },
        ],
      },
      {
        text: "When is the next train?",
        meaning: "下趟火车什么时候到？",
        insight: "问下一班车时间。",
        active: true,
        examples: [
          { en: "When is the next train to the city?", zh: "去城里的下一班火车什么时候？" },
          { en: "I missed it. When is the next train?", zh: "我错过了。下一班呢？" },
        ],
      },
      {
        text: "Over here is the bathroom.",
        meaning: "这边是浴室",
        insight: "带人看地方时，指一下洗手间在哪。",
        active: true,
        examples: [
          { en: "Come this way. Over here is the bathroom.", zh: "这边走。洗手间在这边。" },
          { en: "Over here is the bathroom, next to the stairs.", zh: "洗手间在这边，楼梯旁边。" },
        ],
      },
      {
        text: "It's not that far into town.",
        meaning: "这离城市也不远",
        insight: "说明距离不远。",
        active: true,
        examples: [
          { en: "We can walk. It's not that far into town.", zh: "可以走着去。离城里不远。" },
          { en: "Don't worry, it's not that far into town.", zh: "别担心，进城不远。" },
        ],
      },
      {
        text: "Just around the comer.",
        meaning: "就在附近 / 转角就到",
        insight: "表示很近，走几步就到。",
        active: true,
        examples: [
          { en: "The station is just around the comer.", zh: "车站就在附近。" },
          { en: "Keep walking. Just around the comer.", zh: "继续走。转角就到。" },
        ],
      },
      {
        text: "The road divides here.",
        meaning: "这条路在这里分岔",
        insight: "说明岔路口。",
        active: true,
        examples: [
          { en: "Careful, the road divides here.", zh: "小心，路在这里分岔。" },
          { en: "The road divides here. Take the left one.", zh: "路在这里分岔。走左边。" },
        ],
      },
      {
        text: "I'll be right there.",
        meaning: "我马上到",
        insight: "强调很快赶到；比 On my way 更短、更急。",
        active: true,
        examples: [
          { en: "Stay at the gate. I'll be right there.", zh: "在门口等。我马上到。" },
          { en: "Don't hang up. I'll be right there.", zh: "别挂。我马上到。" },
        ],
      },
      {
        text: "Pull over.",
        meaning: "靠边停一下",
        insight: "对开车的人说；让车停到路边。",
        active: false,
        examples: [
          { en: "Pull over. I need to check the map.", zh: "靠边停。我要看地图。" },
          { en: "Pull over here, please.", zh: "请在这里靠边停。" },
        ],
      },
      {
        text: "I'm home.",
        meaning: "我回来了",
        insight: "进门或报平安到家。",
        active: false,
        examples: [
          { en: "I'm home! Anyone here?", zh: "我回来了！有人在吗？" },
          { en: "Call me when I'm home.", zh: "我到家了再给我电话。" },
        ],
      },
      {
        text: "I'm here to take you home.",
        meaning: "我是来接你回家的",
        insight: "说明来接人回家。",
        active: false,
        examples: [
          { en: "Hi. I'm here to take you home.", zh: "嗨。我是来接你回家的。" },
          { en: "Don't call a taxi. I'm here to take you home.", zh: "别打车。我来接你回家。" },
        ],
      },
      {
        text: "I'd pick her up.",
        meaning: "我会来接她",
        insight: "I'd = I would（我会……）；这里表示愿意/打算去接她。",
        active: false,
        examples: [
          { en: "Don't worry. I'd pick her up.", zh: "别担心。我会去接她。" },
          { en: "After class, I'd pick her up.", zh: "下课后我会接她。" },
        ],
      },
      {
        text: "I walked across the park.",
        meaning: "我穿过了公园",
        insight: "说明怎么过来的。",
        active: false,
        examples: [
          { en: "How did you get here? — I walked across the park.", zh: "你怎么来的？——穿过公园走过来的。" },
          { en: "I walked across the park to save time.", zh: "为了省时间，我穿过公园。" },
        ],
      },
      {
        text: "What are you waiting for?",
        meaning: "你还在等什么？",
        insight: "常用来催「还不快做」；真问「在等谁」时靠语气区分。",
        active: false,
        examples: [
          { en: "The light is green. What are you waiting for?", zh: "绿灯了。你还在等什么？" },
          { en: "What are you waiting for? Let's go.", zh: "还等什么？走吧。" },
        ],
      },
      {
        text: "Stay where you are.",
        meaning: "待在原地别动",
        insight: "位置别变，方便汇合或等救援/接应。",
        active: false,
        examples: [
          { en: "Stay where you are. I'll find you.", zh: "待在那里别动。我来找你。" },
          { en: "If you get lost, stay where you are.", zh: "如果迷路了，就待在原地。" },
        ],
      },
      {
        text: "Sit tight.",
        meaning: "先待着别动 / 再等一下",
        insight: "让对方原地等，自己去处理或马上到；不是训人「坐好」。",
        active: false,
        examples: [
          { en: "Sit tight. The bus is coming.", zh: "先别动。车快来了。" },
          { en: "Sit tight. I'll be five minutes.", zh: "再等一下。我五分钟到。" },
        ],
      },
      {
        text: "You should get back.",
        meaning: "你该回去了",
        insight: "建议对方回去。",
        active: false,
        examples: [
          { en: "It's late. You should get back.", zh: "很晚了。你该回去了。" },
          { en: "You should get back before dark.", zh: "天黑前你该回去。" },
        ],
      },
      {
        text: "We just caught the plane.",
        meaning: "我们刚好赶上了飞机",
        insight: "说明刚好赶上飞机。",
        active: false,
        examples: [
          { en: "We ran, and we just caught the plane.", zh: "我们跑着，刚好赶上飞机。" },
          { en: "Lucky us. We just caught the plane.", zh: "走运。我们刚好赶上飞机。" },
        ],
      },
    ],
  },
  {
    title: "想要、喜好与婉拒",
    promptEn: "Say what you want or like, and refuse softly when you need to.",
    promptZh: "说出想要或喜好，必要时礼貌婉拒。",
    description: "想要、需要、喜好，以及温和拒绝与推迟的短句。",
    knowledgePoints: "确认想要；表达需要；询问喜好；婉拒推迟",
    duration: 900,
    goal: "能说清想要与喜好，并用短句婉拒或推迟。",
    tip: "想要、喜好、拒绝分开记；同一意思只留一句最常用的。",
    docIntro: "想要什么、喜不喜欢、答不答应——把态度说清楚。",
    patterns: [
      { pattern: "Is that what you [want]?", meaning: "这就是你想要的吗？", slots: "want", example: "Is that what you want?" },
      { pattern: "Do you like [noun]?", meaning: "你喜欢……吗？", slots: "noun", example: "Do you like animals?" },
      { pattern: "It is just what I [need].", meaning: "这正是我所……的", slots: "need", example: "It is just what I need." },
      { pattern: "I wish I could.", meaning: "我希望我能……", slots: "", example: "I wish I could." },
      { pattern: "Maybe next [time].", meaning: "也许下次……", slots: "time", example: "Maybe next time." },
    ],
    vocabs: [],
    expressions: [
      {
        text: "Is that what you want?",
        meaning: "这就是你想要的吗",
        insight: "把选择摊开确认：对方就要这个。",
        active: true,
        examples: [
          { en: "Is that what you want? — Yes, this one.", zh: "你是要这个吗？——对，就要这个。" },
          { en: "Is that what you want, or should I change it?", zh: "你是要这个，还是要我换一个？" },
        ],
      },
      {
        text: "I want you to stay.",
        meaning: "我要你留下来",
        insight: "直接说出希望对方留下。",
        active: true,
        examples: [
          { en: "Don't go yet. I want you to stay.", zh: "先别走。我想让你留下来。" },
          { en: "I want you to stay for dinner.", zh: "我想让你留下来吃晚饭。" },
        ],
      },
      {
        text: "I do want to see him now.",
        meaning: "我现在就想见他",
        insight: "I do want：do 加强语气，强调「确实想、现在就要」。",
        active: true,
        examples: [
          { en: "Can it wait? — No. I do want to see him now.", zh: "能等等吗？——不行。我现在就想见他。" },
          { en: "I do want to see him now, before he leaves.", zh: "他走之前，我现在就想见他。" },
        ],
      },
      {
        text: "You do what you want.",
        meaning: "去做你想做的",
        insight: "把决定权交给对方，自己不再坚持。",
        active: true,
        examples: [
          { en: "I won't argue. You do what you want.", zh: "我不争了。你想怎样就怎样。" },
          { en: "You do what you want. I'll wait here.", zh: "你按自己的来。我在这儿等。" },
        ],
      },
      {
        text: "It is just what I need.",
        meaning: "这正是我所需要的",
        insight: "看到合适的东西或安排时，表示正合需要。",
        active: true,
        examples: [
          { en: "This size? — It is just what I need.", zh: "这个尺码？——正是我需要的。" },
          { en: "A quiet seat. It is just what I need.", zh: "安静的座位。正是我需要的。" },
        ],
      },
      {
        text: "No need.",
        meaning: "不用了",
        insight: "谢绝帮忙或表示没必要再做。",
        active: true,
        examples: [
          { en: "Should I carry that? — No need.", zh: "要我帮你拿吗？——不用。" },
          { en: "No need. I already booked one.", zh: "不用。我已经订好了。" },
        ],
      },
      {
        text: "Do you like animals?",
        meaning: "你喜欢小动物吗？",
        insight: "用具体对象打开喜好话题。",
        active: true,
        examples: [
          { en: "Do you like animals? — Yes, especially dogs.", zh: "你喜欢动物吗？——喜欢，尤其是狗。" },
          { en: "Do you like animals or quiet parks more?", zh: "你更喜欢动物，还是安静的公园？" },
        ],
      },
      {
        text: "Does she like ice-cream?",
        meaning: "她喜欢吃冰淇淋吗?",
        insight: "询问第三人的喜好，方便帮忙点或买。",
        active: true,
        examples: [
          { en: "Does she like ice-cream? — She loves it.", zh: "她喜欢冰淇淋吗？——超爱。" },
          { en: "Does she like ice-cream or cake?", zh: "她喜欢冰淇淋还是蛋糕？" },
        ],
      },
      {
        text: "I do, I love them.",
        meaning: "喜欢，而且很爱",
        insight: "先用 I do 接住问句，再补程度。",
        active: true,
        examples: [
          { en: "Do you like cats? — I do, I love them.", zh: "你喜欢猫吗？——喜欢，我超爱。" },
          { en: "I do, I love them. I have two at home.", zh: "喜欢，我超爱。家里养了两只。" },
        ],
      },
      {
        text: "Not in my book.",
        meaning: "在我这儿不算 / 我不这么看",
        insight: "惯用语：按自己的标准不认同。",
        active: true,
        examples: [
          { en: "Is that fair? — Not in my book.", zh: "这样公平吗？——在我这儿不算。" },
          { en: "Skipping the line? Not in my book.", zh: "插队？我看不惯。" },
        ],
      },
      {
        text: "I really enjoyed myself.",
        meaning: "我玩得很开心",
        insight: "事后回馈好感：玩得开心、体验不错。",
        active: false,
        examples: [
          { en: "How was the trip? — I really enjoyed myself.", zh: "旅行怎么样？——我玩得很开心。" },
          { en: "Thanks for inviting me. I really enjoyed myself.", zh: "谢谢邀请。我玩得很开心。" },
        ],
      },
      {
        text: "I wish I could.",
        meaning: "我也想啊（但不行）",
        insight: "想答应却做不到；重点在遗憾，不是单纯许愿。",
        active: false,
        examples: [
          { en: "Come with us? — I wish I could.", zh: "一起去？——我也想能去。" },
          { en: "I wish I could stay longer.", zh: "我也想能多待一会儿。" },
        ],
      },
      {
        text: "I hope so.",
        meaning: "希望如此",
        insight: "对还没发生的结果表示期待；比 I wish I could 更偏「但愿会这样」。",
        active: false,
        examples: [
          { en: "Will we make it on time? — I hope so.", zh: "我们赶得上吗？——希望可以。" },
          { en: "I hope so. Fingers crossed.", zh: "希望如此。加油。" },
        ],
      },
      {
        text: "Been dreaming about it.",
        meaning: "做梦都想",
        insight: "表示期待很久、非常想要。",
        active: false,
        examples: [
          { en: "This trip? Been dreaming about it.", zh: "这次旅行？做梦都想。" },
          { en: "A day off. Been dreaming about it.", zh: "放一天假。想很久了。" },
        ],
      },
      {
        text: "You wish.",
        meaning: "想得美",
        insight: "轻松回绝不切实际的愿望；带调侃，不是真祝福。",
        active: false,
        examples: [
          { en: "I'll finish in five minutes. — You wish.", zh: "我五分钟做完。——想得美。" },
          { en: "You wish. It takes an hour.", zh: "想得美。要一小时。" },
        ],
      },
      {
        text: "Not really.",
        meaning: "不太 / 说不上",
        insight: "温和否定：不太喜欢、不太想；比 No 软。",
        active: false,
        examples: [
          { en: "Do you like it? — Not really.", zh: "喜欢吗？——不太喜欢。" },
          { en: "Want more? — Not really.", zh: "还要吗？——不用了。" },
        ],
      },
      {
        text: "Maybe next time.",
        meaning: "下次吧",
        insight: "这次婉拒，把可能性留到以后；比 Not a chance 软。",
        active: false,
        examples: [
          { en: "Join us tonight? — Maybe next time.", zh: "今晚一起？——下次吧。" },
          { en: "Maybe next time. I'm busy today.", zh: "下次吧。我今天忙。" },
        ],
      },
      {
        text: "Not a chance.",
        meaning: "想都别想",
        insight: "强硬拒绝；没有商量余地。",
        active: false,
        examples: [
          { en: "Can we leave early? — Not a chance.", zh: "能早点走吗？——想都别想。" },
          { en: "Not a chance. We have to finish this.", zh: "没可能。我们得做完。" },
        ],
      },
      {
        text: "I'm not in the mood.",
        meaning: "我没心情",
        insight: "当下状态不对，不想参与。",
        active: false,
        examples: [
          { en: "Want to go out? — I'm not in the mood.", zh: "想出去吗？——没心情。" },
          { en: "I'm not in the mood for shopping today.", zh: "我今天没心情逛街。" },
        ],
      },
      {
        text: "I don't want to hear it.",
        meaning: "我不想听",
        insight: "拒绝继续听借口或某话题。",
        active: false,
        examples: [
          { en: "Let me explain. — I don't want to hear it.", zh: "让我解释。——我不想听。" },
          { en: "I don't want to hear it right now.", zh: "我现在不想听。" },
        ],
      },
    ],
  },
  {
    title: "请求重复、说慢一点和确认听懂",
    promptEn: "Ask for clarification and confirm you understand.",
    promptZh: "请求澄清并确认听懂。",
    description: "听不清、不明白、确认理解时的短句。",
    knowledgePoints: "请求再说；确认理解；不确定；追问细节",
    duration: 900,
    goal: "听不懂时能澄清，听懂时能确认。",
    tip: "听不清用请求澄清；听懂了用短确认即可。",
    docIntro: "没听清、不确定、想确认——先把沟通接住。",
    patterns: [
      { pattern: "What do you mean?", meaning: "你什么意思？", slots: "", example: "What do you mean?" },
      { pattern: "I'm not sure [yet / I can do it].", meaning: "我还不确定……", slots: "yet / I can do it", example: "I'm not sure yet." },
      { pattern: "What's the word for [it]?", meaning: "……怎么说来着？", slots: "it", example: "What's the word for it?" },
      { pattern: "May I ask [some questions]?", meaning: "我可以问……吗？", slots: "some questions", example: "May I ask some questions?" },
    ],
    vocabs: [],
    expressions: [
      {
        text: "I beg your pardon.",
        meaning: "对不起，请再说一遍？",
        insight: "没听清时请人重复；也可表示「抱歉？（你刚说什么）」；比 What? 礼貌。",
        active: true,
        examples: [
          { en: "I beg your pardon? I didn't catch that.", zh: "你能再说一遍吗？我没听清。" },
          { en: "I beg your pardon. Could you repeat the name?", zh: "抱歉。名字能再说一遍吗？" },
        ],
      },
      {
        text: "What do you mean?",
        meaning: "你是什么意思？",
        insight: "要求澄清；语气重时像在质问。",
        active: true,
        examples: [
          { en: "What do you mean by 'later'?", zh: "你说的「晚点」是什么意思？" },
          { en: "Sorry, what do you mean?", zh: "抱歉，你什么意思？" },
        ],
      },
      {
        text: "Is that clear?",
        meaning: "明白了吗？",
        insight: "确认对方是否明白。",
        active: true,
        examples: [
          { en: "Meet at six. Is that clear?", zh: "六点见。明白了吗？" },
          { en: "Is that clear, or should I say it again?", zh: "清楚了吗，还是要我再说一遍？" },
        ],
      },
      {
        text: "Is that so?",
        meaning: "是这样吗？",
        insight: "接住对方信息：可真好奇，也可略带怀疑。",
        active: true,
        examples: [
          { en: "He quit. — Is that so?", zh: "他辞职了。——是这样吗？" },
          { en: "Is that so? I didn't know.", zh: "是吗？我不知道。" },
        ],
      },
      {
        text: "I see.",
        meaning: "我明白",
        insight: "表示听懂了。",
        active: true,
        examples: [
          { en: "The shop closes at eight. — I see.", zh: "店八点关门。——明白了。" },
          { en: "I see. Thanks for explaining.", zh: "明白了。谢谢解释。" },
        ],
      },
      {
        text: "Gotcha.",
        meaning: "懂了 / 明白",
        insight: "口语确认听懂；偏随意，正式场合少用。",
        active: true,
        examples: [
          { en: "Turn left, then right. — Gotcha.", zh: "先左转，再右转。——懂了。" },
          { en: "Gotcha. I'll do that.", zh: "懂了。我会照做。" },
        ],
      },
      {
        text: "What's the word for it?",
        meaning: "那个字怎么说来着",
        insight: "一时想不起用词。",
        active: true,
        examples: [
          { en: "What's the word for it in English?", zh: "这个用英语怎么说来着？" },
          { en: "I know the thing. What's the word for it?", zh: "我知道是什么。那个词怎么说？" },
        ],
      },
      {
        text: "It's on the tip of my tongue.",
        meaning: "就在嘴边，一时想不起",
        insight: "知道但瞬间叫不出名字/单词。",
        active: true,
        examples: [
          { en: "Her name is… it's on the tip of my tongue.", zh: "她叫……话就在嘴边。" },
          { en: "Wait, it's on the tip of my tongue.", zh: "等等，就差一点点想起来。" },
        ],
      },
      {
        text: "May I ask some questions?",
        meaning: "我可以问几个问题吗?",
        insight: "礼貌请求提问。",
        active: true,
        examples: [
          { en: "Before we start, may I ask some questions?", zh: "开始前，我可以问几个问题吗？" },
          { en: "May I ask some questions about the price?", zh: "关于价格我可以问几个问题吗？" },
        ],
      },
      {
        text: "Could I have a moment of your time?",
        meaning: "我能占用你一点时间吗？",
        insight: "礼貌占用一点时间。",
        active: true,
        examples: [
          { en: "Excuse me, could I have a moment of your time?", zh: "打扰了，能占用你一点时间吗？" },
          { en: "Could I have a moment of your time after class?", zh: "下课后能占用你一点时间吗？" },
        ],
      },
      {
        text: "Hold on, let me think.",
        meaning: "等等，让我想一下",
        insight: "请对方稍等、自己想一想。",
        active: false,
        examples: [
          { en: "Hold on, let me think. What's the address?", zh: "等等，让我想想。地址是什么？" },
          { en: "Hold on, let me think before I answer.", zh: "等等，让我想想再回答。" },
        ],
      },
      {
        text: "I'm confused.",
        meaning: "我搞不懂",
        insight: "直接说自己没搞懂。",
        active: false,
        examples: [
          { en: "I'm confused. Which line is this?", zh: "我搞不懂。这是哪条线？" },
          { en: "Wait, I'm confused. Can you show me?", zh: "等等，我糊涂了。能指给我看吗？" },
        ],
      },
      {
        text: "Hard to say.",
        meaning: "不好说",
        insight: "信息不够、不愿下结论。",
        active: false,
        examples: [
          { en: "Will it rain? — Hard to say.", zh: "会下雨吗？——很难说。" },
          { en: "Hard to say without more information.", zh: "信息不够，很难说。" },
        ],
      },
      {
        text: "I'm not sure yet.",
        meaning: "我还不确定",
        insight: "表示还不确定。",
        active: false,
        examples: [
          { en: "Have you decided? — I'm not sure yet.", zh: "决定了吗？——还不确定。" },
          { en: "I'm not sure yet. Give me a minute.", zh: "还不确定。给我一分钟。" },
        ],
      },
      {
        text: "I don't know for sure.",
        meaning: "我不是很确定",
        insight: "表示没有把握。",
        active: false,
        examples: [
          { en: "Is this the right stop? — I don't know for sure.", zh: "这站对吗？——我不是很确定。" },
          { en: "I don't know for sure. Let's ask.", zh: "我没把握。问问吧。" },
        ],
      },
      {
        text: "What did I miss?",
        meaning: "我错过什么啦？",
        insight: "补问自己错过了什么。",
        active: false,
        examples: [
          { en: "I just arrived. What did I miss?", zh: "我刚到。我错过什么了？" },
          { en: "What did I miss in the meeting?", zh: "会上我错过什么了？" },
        ],
      },
      {
        text: "Where were we?",
        meaning: "我们刚才说到哪？",
        insight: "被打断后把话题拉回来。",
        active: false,
        examples: [
          { en: "Sorry about that. Where were we?", zh: "抱歉。我们说到哪了？" },
          { en: "Okay, where were we before the call?", zh: "好，打电话前我们说到哪了？" },
        ],
      },
      {
        text: "Are you serious?",
        meaning: "你是认真的吗？",
        insight: "确认对方是否认真。",
        active: false,
        examples: [
          { en: "Free tickets? Are you serious?", zh: "免费票？你是认真的吗？" },
          { en: "Are you serious about leaving now?", zh: "你是认真要现在走吗？" },
        ],
      },
      {
        text: "Says who?",
        meaning: "谁说的？",
        insight: "质疑权威或来源；语气冲，慎用。",
        active: false,
        examples: [
          { en: "That's the rule. — Says who?", zh: "那是规定。——谁说的？" },
          { en: "Says who? I didn't hear that.", zh: "谁说的？我没听说。" },
        ],
      },
      {
        text: "I'm not sure I can do it.",
        meaning: "这事我恐怕干不了",
        insight: "委婉说能力/条件不够；比 I can't 留一点余地。",
        active: false,
        examples: [
          { en: "Can you finish tonight? — I'm not sure I can do it.", zh: "今晚能做完吗？——恐怕我干不了。" },
          { en: "I'm not sure I can do it alone.", zh: "恐怕我一个人干不了。" },
        ],
      },
    ],
  },
  {
    title: "提醒、求助与鼓励",
    promptEn: "Ask for help and warn others when something goes wrong.",
    promptZh: "出事时求助、提醒并稳住场面。",
    description: "求助、提醒、麻烦与鼓励相关短句。",
    knowledgePoints: "求助请求；提醒危险；说明麻烦；鼓励安慰",
    duration: 900,
    goal: "能在困难时求助、提醒并回应支持。",
    tip: "先说问题，再明确要对方做什么；紧急时短句优先。",
    docIntro: "出事、求助、提醒别人小心——把关键短句说出口。",
    patterns: [
      { pattern: "Give me a [hand].", meaning: "帮我……", slots: "hand", example: "Give me a hand." },
      { pattern: "I can't find [thing].", meaning: "我找不到……", slots: "thing", example: "I can't find my book." },
      { pattern: "Do me a [favor].", meaning: "帮我个……", slots: "favor", example: "Do me a favor." },
      { pattern: "Tell me what to [verb].", meaning: "告诉我该……", slots: "verb", example: "Tell me what to do." },
    ],
    vocabs: [],
    expressions: [
      {
        text: "Watch out.",
        meaning: "当心！",
        insight: "突发危险时喊停；比 Be careful 更急、更短。",
        active: true,
        examples: [
          { en: "Watch out! The car is coming.", zh: "当心！车来了。" },
          { en: "Watch out for the step.", zh: "当心台阶。" },
        ],
      },
      {
        text: "Be careful.",
        meaning: "小心一点",
        insight: "提醒注意安全或别弄坏；可事先说，不必等危险已到眼前。",
        active: true,
        examples: [
          { en: "Be careful. The floor is wet.", zh: "小心。地板湿。" },
          { en: "Be careful with that bag.", zh: "那个包小心点。" },
        ],
      },
      {
        text: "Do me a favor.",
        meaning: "帮我个忙",
        insight: "请人做一件事（打电话、带话等）；Give me a hand 更偏动手帮忙。",
        active: true,
        examples: [
          { en: "Do me a favor. Hold this door.", zh: "帮个忙。扶一下门。" },
          { en: "Do me a favor and call them.", zh: "帮个忙，给他们打个电话。" },
        ],
      },
      {
        text: "Give me a hand.",
        meaning: "搭把手",
        insight: "请人上手帮忙搬、扶、拿；偏具体体力活。",
        active: true,
        examples: [
          { en: "Give me a hand with these bags.", zh: "帮我拿一下这些包。" },
          { en: "Can you give me a hand here?", zh: "能过来搭把手吗？" },
        ],
      },
      {
        text: "Hold up.",
        meaning: "等一下",
        insight: "让对方停一下/等自己；这里不是抢劫用语。",
        active: true,
        examples: [
          { en: "Hold up. I forgot my phone.", zh: "等一下。我忘带手机了。" },
          { en: "Hold up. One more thing.", zh: "等一下。还有一件事。" },
        ],
      },
      {
        text: "Something's wrong.",
        meaning: "有点不对劲",
        insight: "感觉情况异常，先示警再说明。",
        active: true,
        examples: [
          { en: "Something's wrong with my card.", zh: "我的卡好像有问题。" },
          { en: "Wait, something's wrong.", zh: "等等，有点不对劲。" },
        ],
      },
      {
        text: "It doesn't work.",
        meaning: "用不了 / 坏了",
        insight: "设备、按钮、方法没效果；不是说「这人没用」。",
        active: true,
        examples: [
          { en: "I pressed it, but it doesn't work.", zh: "我按了，但没用。" },
          { en: "The machine doesn't work.", zh: "这机器坏了。" },
        ],
      },
      {
        text: "I can't find my book.",
        meaning: "我找不到我的书",
        insight: "说明找不到物品。",
        active: true,
        examples: [
          { en: "I can't find my book. Did you see it?", zh: "我找不到书。你看见了吗？" },
          { en: "I can't find my book anywhere.", zh: "我到处找不到我的书。" },
        ],
      },
      {
        text: "We got a problem.",
        meaning: "我们有麻烦了",
        insight: "把已经出现的麻烦挑明；比 Something's wrong 更确定「出问题了」。",
        active: true,
        examples: [
          { en: "We got a problem. The gate is closed.", zh: "我们有麻烦了。门关了。" },
          { en: "Stop. We got a problem.", zh: "停。出问题了。" },
        ],
      },
      {
        text: "It's urgent.",
        meaning: "很急 / 有急事",
        insight: "强调时间紧，请对方优先处理。",
        active: true,
        examples: [
          { en: "I need to talk. It's urgent.", zh: "我需要谈谈。很紧急。" },
          { en: "Please help. It's urgent.", zh: "请帮忙。事情紧急。" },
        ],
      },
      {
        text: "Is there anything I can do?",
        meaning: "我能帮上什么忙吗？",
        insight: "主动提出帮忙；方向是「我帮你」，不是「你帮我」。",
        active: false,
        examples: [
          { en: "You look stuck. Is there anything I can do?", zh: "你看着为难。有什么我能帮忙的吗？" },
          { en: "Is there anything I can do to help?", zh: "有什么我可以帮忙的吗？" },
        ],
      },
      {
        text: "Mayday.",
        meaning: "求救（无线电用语）",
        insight: "紧急呼救信号；日常口语很少用，电影/航空语境更常见。",
        active: false,
        examples: [
          { en: "Mayday! We need help now!", zh: "求救！我们现在需要帮助！" },
          { en: "He shouted mayday on the radio.", zh: "他在无线电里喊求救。" },
        ],
      },
      {
        text: "I got your back.",
        meaning: "我撑着你 / 我站你这边",
        insight: "表示会支持、帮忙顶着；不是字面「看你的背」。",
        active: false,
        examples: [
          { en: "Don't worry. I got your back.", zh: "别担心。我支持你。" },
          { en: "Go ahead. I got your back.", zh: "去吧。我给你撑腰。" },
        ],
      },
      {
        text: "Hang in there.",
        meaning: "撑住 / 再坚持一下",
        insight: "鼓励对方熬过难关；偏打气。",
        active: false,
        examples: [
          { en: "Hang in there. Help is coming.", zh: "坚持住。支援马上到。" },
          { en: "It's hard, but hang in there.", zh: "很难，但撑住。" },
        ],
      },
      {
        text: "Don't panic.",
        meaning: "别慌",
        insight: "稳住情绪，先别乱；常接着给下一步。",
        active: false,
        examples: [
          { en: "Don't panic. Breathe.", zh: "别慌。深呼吸。" },
          { en: "Don't panic. We can fix this.", zh: "别慌。我们能搞定。" },
        ],
      },
      {
        text: "Don't give up.",
        meaning: "别放弃",
        insight: "鼓励继续尝试；和 Hang in there 近，但更强调「别停」。",
        active: false,
        examples: [
          { en: "Don't give up. Try once more.", zh: "别放弃。再试一次。" },
          { en: "You're close. Don't give up.", zh: "就差一点。别放弃。" },
        ],
      },
      {
        text: "I'm feeling a little under the weather today.",
        meaning: "今天有点不舒服",
        insight: "惯用语：身体不适；不是在评价天气。",
        active: false,
        examples: [
          { en: "I can't go out. I'm feeling a little under the weather today.", zh: "我出不了门。今天有点不舒服。" },
          { en: "I'm feeling a little under the weather today. Maybe tomorrow.", zh: "我今天有点不舒服。也许明天吧。" },
        ],
      },
      {
        text: "Fear not.",
        meaning: "别怕",
        insight: "安慰用语，略文/旧；日常更常说 Don't worry / It's okay。",
        active: false,
        examples: [
          { en: "Fear not. I'm right here.", zh: "别怕。我就在这儿。" },
          { en: "Fear not. We'll find a way.", zh: "别害怕。我们会有办法。" },
        ],
      },
      {
        text: "Tell me what to do.",
        meaning: "告诉我该怎么办",
        insight: "自己卡住时，请对方给明确指示。",
        active: false,
        examples: [
          { en: "I'm lost. Tell me what to do.", zh: "我迷路了。告诉我该怎么办。" },
          { en: "Tell me what to do next.", zh: "告诉我下一步该做什么。" },
        ],
      },
      {
        text: "I'm begging you.",
        meaning: "我求你了",
        insight: "强烈恳求；语气很重，用于真的很在意的事。",
        active: false,
        examples: [
          { en: "Please stay. I'm begging you.", zh: "请留下来。我求你了。" },
          { en: "I'm begging you. Just listen.", zh: "我求你了。听我说完。" },
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

function vocabZh(word) {
  const map = {
    going: "进行中/怎么了",
    rough: "艰难的",
    look: "看起来",
    great: "很棒",
    coincidence: "巧合",
    nice: "好的",
    shall: "要不要",
    sleep: "睡",
    tight: "稳住",
    have: "有/祝",
    fun: "开心",
    luck: "运气",
    easy: "轻松",
    time: "时间",
    home: "家",
    sweet: "甜蜜的",
    better: "更好",
    late: "晚",
    never: "从不",
    call: "打电话",
    break: "加油（口语）",
    leg: "腿",
    cheer: "振作",
    lucky: "幸运的",
    job: "工作/干得好",
    congratulations: "恭喜",
    proud: "骄傲",
    fault: "过错",
    way: "方式/好样的",
    impressed: "佩服的",
    apologies: "道歉",
    forgive: "原谅",
    well: "好地",
    done: "完成",
    bless: "保佑",
    amazing: "出色的",
    saved: "救了",
    life: "生活/性命",
    sorry: "抱歉",
    interrupt: "打断",
    impressive: "令人钦佩的",
    hard: "难的",
    feelings: "感觉",
    offense: "冒犯",
    matter: "要紧",
    blame: "责怪",
    anything: "任何事",
    else: "其他",
    keep: "保留",
    change: "零钱",
    accept: "接受",
    credit: "信用",
    cards: "卡",
    drink: "饮料",
    tonight: "今晚",
    would: "会",
    should: "应该",
    nicely: "不错地",
    finished: "完成的",
    already: "已经",
    gonna: "将要",
    miss: "错过",
    breakfast: "早餐",
    supper: "晚餐",
    ready: "准备好",
    six: "六",
    owe: "欠",
    dinner: "正餐",
    used: "习惯的",
    drinking: "喝酒",
    those: "那些",
    watermelons: "西瓜",
    reservation: "预订",
    first: "首先",
    come: "来",
    served: "接待",
    which: "哪一个",
    prefer: "更喜欢",
    settled: "定下来",
    just: "刚好",
    will: "会",
    sit: "坐",
    price: "价格",
    reasonable: "合理的",
    afford: "负担得起",
    worth: "值得",
    money: "钱",
    everything: "一切",
    true: "真的",
    check: "看看",
    guest: "客人",
    suit: "随……便",
    yourself: "你自己",
    means: "方式",
    sure: "确定",
    thing: "事情",
    bet: "当然",
    best: "最好",
    mine: "我的",
    yours: "你的",
    course: "当然",
    give: "给",
    try: "试",
    biggie: "大事",
    lost: "迷路",
    ticket: "票",
    train: "火车",
    bathroom: "洗手间",
    far: "远",
    town: "城镇",
    comer: "拐角",
    road: "路",
    divides: "分岔",
    pull: "靠边停",
    over: "过去/结束",
    pick: "接",
    walked: "走过",
    across: "穿过",
    park: "公园",
    waiting: "等待",
    stay: "待着",
    where: "哪里",
    back: "回去",
    caught: "赶上",
    plane: "飞机",
    animals: "动物",
    cream: "奶油",
    love: "爱",
    need: "需要",
    hope: "希望",
    really: "真的",
    absolutely: "当然",
    neither: "也不",
    maybe: "也许",
    next: "下一次",
    bored: "无聊的",
    tired: "累的",
    mood: "心情",
    wish: "希望",
    could: "能够",
    dreaming: "梦想",
    hear: "听",
    like: "像/喜欢",
    beg: "请求",
    pardon: "原谅/再说一遍",
    mean: "意思",
    clear: "清楚",
    gotcha: "懂了",
    word: "词",
    tip: "尖端",
    tongue: "舌头",
    ask: "问",
    questions: "问题",
    moment: "片刻",
    hold: "等一下",
    think: "想",
    confused: "困惑的",
    say: "说",
    were: "是",
    serious: "认真的",
    kidding: "开玩笑",
    watch: "当心",
    careful: "小心",
    favor: "忙",
    hand: "手",
    wrong: "不对",
    work: "运作",
    find: "找到",
    book: "书",
    problem: "问题",
    urgent: "紧急",
    mayday: "求救",
    hang: "坚持",
    panic: "惊慌",
    feeling: "感觉",
    weather: "天气",
    fear: "害怕",
    tell: "告诉",
    begging: "恳求",
  }
  return map[word] || word
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

  // 3) vocab_sentence_building — 前 4 个核心词，各挂到含该词的句块上
  const coreVocabs = (topic.vocabs || []).slice(0, 4)
  for (const word of coreVocabs) {
    const rx = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const related = topic.expressions.filter((e) => rx.test(e.text))
    const hosts = (related.length ? related : actives).slice(0, 2)
    if (hosts.length < 1) continue
    const patterns = hosts.map((expr) => {
      const items = expr.examples.slice(0, 2).map((ex) => ({
        zh: ex.zh,
        answer: ex.en,
        hint: `用到单词「${word}」`,
      }))
      while (items.length < 2) {
        items.push({
          zh: `${expr.meaning}（再用「${word}」说一次）`,
          answer: expr.text,
          hint: `关键词：${word}`,
        })
      }
      return { chunk: expr.text, items }
    })
    pipeline.push({
      id: id(),
      type: 'vocab_sentence_building',
      title: `${word} 造句`,
      vocabWord: word,
      vocabMeaning: vocabZh(word),
      direction: 'zh_to_en',
      patterns,
    })
  }

  // 4) pattern drill
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

  // 5) sentence decomposition on one full example
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
    '常用英语500句入门篇：在寒暄接话、用餐、判断取舍、出行和求助鼓励中，用短语和简单句完成听懂与立即回应。',
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

学习者能在寒暄接话、用餐、判断取舍、出行和求助鼓励中听懂常见表达，并用短语或简单句立即回应。

## 8 个场景组

1. 寒暄、接话与祝福（按生存场景重组的寒暄）
2. 感谢、简单道歉与回应
3. 约饭、结账与用餐回应
4. 评价价格、取舍与许可回应
5. 迷路、在路上与接人（路上/找位置/接人相关短句）
6. 想要、喜好与婉拒
7. 请求重复、说慢一点和确认听懂
8. 提醒、求助与鼓励

## 内容与训练标准

每组收录约 20 条表达，其中约 8–10 条标为「优先开口」。每课只新学 5–8 条，经过听辨、跟读、信息替换、两轮回应和变化场景复习。表达必须短、高频、低风险；较委婉或带语气色彩的说法放入后卷。

最终要求是在 8 秒内开始回答，并完成 2–4 轮基本交流，不要求一次背完全部表达。

## 文件清单

- \`scenes.csv\` / \`training_topics.csv\` / \`chunks.csv\`（仅 scene_title,topic_title,text,sort_order；释义/例句走语料库富化）
- \`scene_vocabulary.csv\`（仅 scene_title,topic_title,word,sort_order；释义/发音走语料库） / \`sentence_patterns.csv\`（仅 scene_title,topic_title,pattern,sort_order）
- \`warmup_pipeline.json\`（每话题含中译英、英译中、句型操练与句子拆解）
- \`teaching-docs/*.md\`（用户可见教学文档：意思、见解、例句、速查表）

## 数据说明

入门篇按「生存场景」重组：160 条句块均来自系列语料库短句，去掉同义反复与自造柜台模板（如一串 xxx, please）。影视脏话、高冲突、低频表达不进入本卷。冲突时以本卷教学文档为准。
`

writeFileSync(join(OUT, 'teaching-docs', '00-课程总设计.md'), design, 'utf8')

console.log(`OK: ${topics.length} topics, ${totalChunks} chunks, ${totalActive} active`)
