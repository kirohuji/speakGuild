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
        text: "Oh,you are kidding me.",
        meaning: "哦，你别拿我开玩笑了。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Oh,you are kidding me.", zh: "哦，你别拿我开玩笑了。" },
          { en: "She said, \"Oh,you are kidding me.\"", zh: "她说：「哦，你别拿我开玩笑了。」" },
        ],
      },
      {
        text: "That's always the case.",
        meaning: "习以为常了。",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "That's always the case.", zh: "习以为常了。" },
          { en: "She said, \"That's always the case.\"", zh: "她说：「习以为常了。」" },
        ],
      },
      {
        text: "It's the best of both worlds.",
        meaning: "真是两全其美的好办法",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "It's the best of both worlds.", zh: "真是两全其美的好办法" },
          { en: "She said, \"It's the best of both worlds.\"", zh: "她说：「真是两全其美的好办法」" },
        ],
      },
      {
        text: "He has a sense of humor.",
        meaning: "他有幽默感。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "He has a sense of humor.", zh: "他有幽默感。" },
          { en: "She said, \"He has a sense of humor.\"", zh: "她说：「他有幽默感。」" },
        ],
      },
      {
        text: "You suck.",
        meaning: "你太烂了",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "You suck.", zh: "你太烂了" },
          { en: "She said, \"You suck.\"", zh: "她说：「你太烂了」" },
        ],
      },
      {
        text: "Don't cry over spilled milk.",
        meaning: "不要做无益的后悔。",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "Don't cry over spilled milk.", zh: "不要做无益的后悔。" },
          { en: "She said, \"Don't cry over spilled milk.\"", zh: "她说：「不要做无益的后悔。」" },
        ],
      },
      {
        text: "give him the benefit of the doubt.",
        meaning: "姑且相信他吧",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "give him the benefit of the doubt.", zh: "姑且相信他吧" },
          { en: "She said, \"give him the benefit of the doubt.\"", zh: "她说：「姑且相信他吧」" },
        ],
      },
      {
        text: "You should have seen yourself.",
        meaning: "你应该亲眼看看才对",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "You should have seen yourself.", zh: "你应该亲眼看看才对" },
          { en: "She said, \"You should have seen yourself.\"", zh: "她说：「你应该亲眼看看才对」" },
        ],
      }
    ],
  },
  {
    title: "附和、补充与换角度看",
    promptEn: "Agree, add a thought, or reframe the angle.",
    promptZh: "附和、补充，或换角度看。",
    description: "接住对方话头，补一句观察或换个角度。",
    knowledgePoints: "附和；补充；换角度",
    duration: 900,
    goal: "能自然接话并补观察。",
    tip: "先接住，再补一句。",
    docIntro: "这一课练「接得住」：附和、补充、换角度看。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "I bet you do.",
        meaning: "我想也是",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "I bet you do.", zh: "我想也是" },
          { en: "She said, \"I bet you do.\"", zh: "她说：「我想也是」" },
        ],
      },
      {
        text: "I bet it felt good.",
        meaning: "我敢说感觉不错。",
        insight: "附和对方感受；It felt good 更短，本课不单列。",
        active: true,
        examples: [
          { en: "I bet it felt good.", zh: "我敢说感觉不错。" },
          { en: "Winning? I bet it felt good.", zh: "赢了？感觉一定不错。" },
        ],
      },
      {
        text: "You're really killing me!",
        meaning: "真是笑死我了!",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "You're really killing me!", zh: "真是笑死我了!" },
          { en: "She said, \"You're really killing me!\"", zh: "她说：「真是笑死我了!」" },
        ],
      },
      {
        text: "It rather surprised me.",
        meaning: "那事使我颇感惊讶。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "It rather surprised me.", zh: "那事使我颇感惊讶。" },
          { en: "She said, \"It rather surprised me.\"", zh: "她说：「那事使我颇感惊讶。」" },
        ],
      },
      {
        text: "They seem like nice people.",
        meaning: "他们看起来像好人",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "They seem like nice people.", zh: "他们看起来像好人" },
          { en: "She said, \"They seem like nice people.\"", zh: "她说：「他们看起来像好人」" },
        ],
      },
      {
        text: "Mark my words.",
        meaning: "记住我说的",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "Mark my words.", zh: "记住我说的" },
          { en: "She said, \"Mark my words.\"", zh: "她说：「记住我说的」" },
        ],
      },
      {
        text: "East,west,home is best.",
        meaning: "金窝，银窝，不如自己的草窝。",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "East,west,home is best.", zh: "金窝，银窝，不如自己的草窝。" },
          { en: "She said, \"East,west,home is best.\"", zh: "她说：「金窝，银窝，不如自己的草窝。」" },
        ],
      },
      {
        text: "All for one,one for all.",
        meaning: "我为人人，人人为我。",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "All for one,one for all.", zh: "我为人人，人人为我。" },
          { en: "She said, \"All for one,one for all.\"", zh: "她说：「我为人人，人人为我。」" },
        ],
      }
    ],
  },
  {
    title: "边界、缓和与轻度拒绝",
    promptEn: "Set boundaries or refuse firmly without escalating.",
    promptZh: "划边界，或坚定拒绝。",
    description: "把话说到为止：制止、拒绝、拉开距离。",
    knowledgePoints: "划边界；拒绝；制止",
    duration: 900,
    goal: "能清楚说停。",
    tip: "边界句要短；粗口不收录主动开口。",
    docIntro: "这一课练「到此为止」：边界、缓和与轻度拒绝。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "Don't talk to me like that.",
        meaning: "别这样跟我说话",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Don't talk to me like that.", zh: "别这样跟我说话" },
          { en: "She said, \"Don't talk to me like that.\"", zh: "她说：「别这样跟我说话」" },
        ],
      },
      {
        text: "Don't lie to me.",
        meaning: "不要对我说谎",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Don't lie to me.", zh: "不要对我说谎" },
          { en: "She said, \"Don't lie to me.\"", zh: "她说：「不要对我说谎」" },
        ],
      },
      {
        text: "None of your business.",
        meaning: "这不关你事",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "None of your business.", zh: "这不关你事" },
          { en: "She said, \"None of your business.\"", zh: "她说：「这不关你事」" },
        ],
      },
      {
        text: "Out of my way.",
        meaning: "给我让开",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Out of my way.", zh: "给我让开" },
          { en: "She said, \"Out of my way.\"", zh: "她说：「给我让开」" },
        ],
      },
      {
        text: "Get out of here.",
        meaning: "快离开这里",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Get out of here.", zh: "快离开这里" },
          { en: "She said, \"Get out of here.\"", zh: "她说：「快离开这里」" },
        ],
      },
      {
        text: "Get away from me.",
        meaning: "离我远点",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Get away from me.", zh: "离我远点" },
          { en: "She said, \"Get away from me.\"", zh: "她说：「离我远点」" },
        ],
      },
      {
        text: "Watch who you go accusing.",
        meaning: "别诬赖我",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Watch who you go accusing.", zh: "别诬赖我" },
          { en: "She said, \"Watch who you go accusing.\"", zh: "她说：「别诬赖我」" },
        ],
      },
      {
        text: "Leave me alone.",
        meaning: "离我远点",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Leave me alone.", zh: "离我远点" },
          { en: "She said, \"Leave me alone.\"", zh: "她说：「离我远点」" },
        ],
      },
      {
        text: "Cut it out.",
        meaning: "别闹了",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Cut it out.", zh: "别闹了" },
          { en: "She said, \"Cut it out.\"", zh: "她说：「别闹了」" },
        ],
      },
      {
        text: "What's your problem?",
        meaning: "你有毛病吧？",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "What's your problem? I need to know.", zh: "你有毛病吧？ 我需要知道。" },
          { en: "Wait—What's your problem?", zh: "等等——你有毛病吧？" },
        ],
      }
    ],
  },
  {
    title: "惊喜、吐槽与情绪接话",
    promptEn: "React with surprise, complaint, or quick emotion.",
    promptZh: "用惊喜、吐槽或情绪短句接话。",
    description: "听到意外时马上接得住。",
    knowledgePoints: "惊喜；吐槽；情绪接话",
    duration: 900,
    goal: "能用短句接住意外。",
    tip: "感叹句看关系亲疏。",
    docIntro: "这一课练「听到就接」：惊喜、吐槽与情绪接话。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "For crying out loud!",
        meaning: "我的天啊",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "For crying out loud!", zh: "我的天啊" },
          { en: "She said, \"For crying out loud!\"", zh: "她说：「我的天啊」" },
        ],
      },
      {
        text: "For god's sake.",
        meaning: "有没有搞错",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "For god's sake.", zh: "有没有搞错" },
          { en: "She said, \"For god's sake.\"", zh: "她说：「有没有搞错」" },
        ],
      },
      {
        text: "What kind of a person does that.",
        meaning: "怎么会有这样的人",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "What kind of a person does that.", zh: "怎么会有这样的人" },
          { en: "She said, \"What kind of a person does that.\"", zh: "她说：「怎么会有这样的人」" },
        ],
      },
      {
        text: "Pardon my French.",
        meaning: "原谅我说脏话",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "Pardon my French.", zh: "原谅我说脏话" },
          { en: "She said, \"Pardon my French.\"", zh: "她说：「原谅我说脏话」" },
        ],
      },
      {
        text: "You are a chicken.",
        meaning: "你是个胆小鬼。",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "You are a chicken.", zh: "你是个胆小鬼。" },
          { en: "She said, \"You are a chicken.\"", zh: "她说：「你是个胆小鬼。」" },
        ],
      },
      {
        text: "Set me up.",
        meaning: "陷害我",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "Set me up.", zh: "陷害我" },
          { en: "She said, \"Set me up.\"", zh: "她说：「陷害我」" },
        ],
      },
      {
        text: "He was caught red-handed.",
        meaning: "他被逮个正着",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "He was caught red-handed.", zh: "他被逮个正着" },
          { en: "She said, \"He was caught red-handed.\"", zh: "她说：「他被逮个正着」" },
        ],
      },
      {
        text: "I'm an open book.",
        meaning: "我没有什么秘密",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "I'm an open book.", zh: "我没有什么秘密" },
          { en: "She said, \"I'm an open book.\"", zh: "她说：「我没有什么秘密」" },
        ],
      },
      {
        text: "In a what?",
        meaning: "什么？",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "In a what? I need to know.", zh: "什么？ 我需要知道。" },
          { en: "Wait—In a what?", zh: "等等——什么？" },
        ],
      },
      {
        text: "Close your eyes.",
        meaning: "闭上眼睛",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Close your eyes.", zh: "闭上眼睛" },
          { en: "She said, \"Close your eyes.\"", zh: "她说：「闭上眼睛」" },
        ],
      },
      {
        text: "Please stop staring, dear.",
        meaning: "亲爱的别盯着我看了",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Please stop staring, dear.", zh: "亲爱的别盯着我看了" },
          { en: "She said, \"Please stop staring, dear.\"", zh: "她说：「亲爱的别盯着我看了」" },
        ],
      }
    ],
  },
  {
    title: "关系感受与疲惫表达",
    promptEn: "Talk about relationship feelings and exhaustion.",
    promptZh: "表达关系感受与疲惫。",
    description: "关系里的在意、疲惫与和解。",
    knowledgePoints: "疲惫；在意；关系态度；和解",
    duration: 900,
    goal: "能说出感受与态度。",
    tip: "先说感受，再谈行动。",
    docIntro: "这一课练关系里的感受与疲惫，以及和解说法。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "He doesn't care about me.",
        meaning: "他并不在乎我。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "He doesn't care about me.", zh: "他并不在乎我。" },
          { en: "She said, \"He doesn't care about me.\"", zh: "她说：「他并不在乎我。」" },
        ],
      },
      {
        text: "I would do anything for you.",
        meaning: "我愿意为你做任何事",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "I would do anything for you.", zh: "我愿意为你做任何事" },
          { en: "She said, \"I would do anything for you.\"", zh: "她说：「我愿意为你做任何事」" },
        ],
      },
      {
        text: "I felt no regret for it.",
        meaning: "对这件事我不觉得后悔。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "I felt no regret for it.", zh: "对这件事我不觉得后悔。" },
          { en: "She said, \"I felt no regret for it.\"", zh: "她说：「对这件事我不觉得后悔。」" },
        ],
      },
      {
        text: "The child sobbed sadly.",
        meaning: "小孩伤心地抽泣着。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "The child sobbed sadly.", zh: "小孩伤心地抽泣着。" },
          { en: "She said, \"The child sobbed sadly.\"", zh: "她说：「小孩伤心地抽泣着。」" },
        ],
      },
      {
        text: "Such a wonderful age.",
        meaning: "如此美好的年纪",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Such a wonderful age.", zh: "如此美好的年纪" },
          { en: "She said, \"Such a wonderful age.\"", zh: "她说：「如此美好的年纪」" },
        ],
      },
      {
        text: "We all desire happiness",
        meaning: "我们都想要幸福。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "We all desire happiness", zh: "我们都想要幸福。" },
          { en: "She said, \"We all desire happiness\"", zh: "她说：「我们都想要幸福。」" },
        ],
      },
      {
        text: "Let's bury the hatchet.",
        meaning: "我们握手言和吧",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "Let's bury the hatchet.", zh: "我们握手言和吧" },
          { en: "She said, \"Let's bury the hatchet.\"", zh: "她说：「我们握手言和吧」" },
        ],
      }
    ],
  },
  {
    title: "决定、行动与惯用提醒",
    promptEn: "Decide, act, and give practical reminders.",
    promptZh: "做决定、行动，并做惯用提醒。",
    description: "推动行动、提醒节点、接受结果。",
    knowledgePoints: "行动；提醒；决定",
    duration: 900,
    goal: "能推动行动落地。",
    tip: "决定句要落到下一步。",
    docIntro: "这一课练「定了就做」：决定、行动与惯用提醒。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "What's your goal in life?",
        meaning: "你的人生目标是什么?",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "What's your goal in life? I need to know.", zh: "你的人生目标是什么? 我需要知道。" },
          { en: "Wait—What's your goal in life?", zh: "等等——你的人生目标是什么?" },
        ],
      },
      {
        text: "He is looking for a job.",
        meaning: "他正在找工作。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "He is looking for a job.", zh: "他正在找工作。" },
          { en: "She said, \"He is looking for a job.\"", zh: "她说：「他正在找工作。」" },
        ],
      },
      {
        text: "I meet the boss himself.",
        meaning: "我见到了老板本人。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "I meet the boss himself.", zh: "我见到了老板本人。" },
          { en: "She said, \"I meet the boss himself.\"", zh: "她说：「我见到了老板本人。」" },
        ],
      },
      {
        text: "You mustn't aim too high",
        meaning: "你不可好高骛远。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "You mustn't aim too high", zh: "你不可好高骛远。" },
          { en: "She said, \"You mustn't aim too high\"", zh: "她说：「你不可好高骛远。」" },
        ],
      },
      {
        text: "And you know nothing.",
        meaning: "而你什么都不知道",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "And you know nothing.", zh: "而你什么都不知道" },
          { en: "She said, \"And you know nothing.\"", zh: "她说：「而你什么都不知道」" },
        ],
      }
    ],
  },
  {
    title: "态度、立场与口语惯用语",
    promptEn: "Show attitude with spoken set phrases.",
    promptZh: "用口语惯用语表明态度与立场。",
    description: "亮出立场与态度的常用说法。",
    knowledgePoints: "立场；惯用语；态度",
    duration: 900,
    goal: "能用短句亮态度。",
    tip: "惯用语先会听，再会挑场合用。",
    docIntro: "这一课练态度、立场与口语惯用语。强硬短句先识别，开口慎用。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "How dare you.",
        meaning: "你敢",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "How dare you.", zh: "你敢" },
          { en: "She said, \"How dare you.\"", zh: "她说：「你敢」" },
        ],
      },
      {
        text: "Shame on you.",
        meaning: "真不要脸",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Shame on you.", zh: "真不要脸" },
          { en: "She said, \"Shame on you.\"", zh: "她说：「真不要脸」" },
        ],
      },
      {
        text: "Don't touch me.",
        meaning: "别碰我",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Don't touch me.", zh: "别碰我" },
          { en: "She said, \"Don't touch me.\"", zh: "她说：「别碰我」" },
        ],
      },
      {
        text: "Shut up.",
        meaning: "闭嘴。",
        insight: "强硬制止；Zip it 同功能，本课不单列。识别即可，开口慎用。",
        active: false,
        examples: [
          { en: "Shut up. I'm trying to think.", zh: "闭嘴。我在想事。" },
          { en: "Hey—shut up for a second.", zh: "喂——闭嘴一下。" },
        ],
      },
      {
        text: "Cut the crap.",
        meaning: "废话少说",
        insight: "强硬/粗口边缘；先识别场合，开口慎用。",
        active: false,
        examples: [
          { en: "Cut the crap.", zh: "废话少说" },
          { en: "She said, \"Cut the crap.\"", zh: "她说：「废话少说」" },
        ],
      },
      {
        text: "Get over yourself.",
        meaning: "别自以为是了",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "Get over yourself.", zh: "别自以为是了" },
          { en: "She said, \"Get over yourself.\"", zh: "她说：「别自以为是了」" },
        ],
      },
      {
        text: "Get a life.",
        meaning: "做点有意义的事吧",
        insight: "惯用语/进阶说法；先听懂，再挑合适场合用。",
        active: true,
        examples: [
          { en: "Get a life.", zh: "做点有意义的事吧" },
          { en: "She said, \"Get a life.\"", zh: "她说：「做点有意义的事吧」" },
        ],
      },
      {
        text: "Do as I say.",
        meaning: "照我说的做",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Do as I say.", zh: "照我说的做" },
          { en: "She said, \"Do as I say.\"", zh: "她说：「照我说的做」" },
        ],
      }
    ],
  },
  {
    title: "说明情况、补救与确认",
    promptEn: "Explain a situation, fix it, and confirm.",
    promptZh: "说明情况、提出补救，并确认。",
    description: "把事情说清楚，补救，再确认对方理解。",
    knowledgePoints: "说明情况；补救；确认",
    duration: 900,
    goal: "能把状况讲清并补救。",
    tip: "先事实，再补救，最后确认。",
    docIntro: "这一课练说明情况、补救与确认。",
    patterns: [],
    vocabs: [],
    expressions: [
      {
        text: "Is the cut still painful?",
        meaning: "伤口还在痛吗?",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Is the cut still painful? I need to know.", zh: "伤口还在痛吗? 我需要知道。" },
          { en: "Wait—Is the cut still painful?", zh: "等等——伤口还在痛吗?" },
        ],
      },
      {
        text: "Remember what the doctor said.",
        meaning: "记得医生的叮嘱",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "Remember what the doctor said.", zh: "记得医生的叮嘱" },
          { en: "She said, \"Remember what the doctor said.\"", zh: "她说：「记得医生的叮嘱」" },
        ],
      },
      {
        text: "He owned himself defeated.",
        meaning: "他承认自己失败了。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "He owned himself defeated.", zh: "他承认自己失败了。" },
          { en: "She said, \"He owned himself defeated.\"", zh: "她说：「他承认自己失败了。」" },
        ],
      },
      {
        text: "I have the right to know",
        meaning: "我有权知道。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "I have the right to know", zh: "我有权知道。" },
          { en: "She said, \"I have the right to know\"", zh: "她说：「我有权知道。」" },
        ],
      },
      {
        text: "As he likes to remind me.",
        meaning: "他也经常提醒我说",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "As he likes to remind me.", zh: "他也经常提醒我说" },
          { en: "She said, \"As he likes to remind me.\"", zh: "她说：「他也经常提醒我说」" },
        ],
      },
      {
        text: "show it to me.",
        meaning: "给我看看。",
        insight: "比 show me 稍完整；短版 show me 本课不单列。",
        active: true,
        examples: [
          { en: "show it to me.", zh: "给我看看。" },
          { en: "Can you show it to me?", zh: "能给我看看吗？" },
        ],
      },
      {
        text: "He grasped both my hands",
        meaning: "他紧握住我的双手。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "He grasped both my hands", zh: "他紧握住我的双手。" },
          { en: "She said, \"He grasped both my hands\"", zh: "她说：「他紧握住我的双手。」" },
        ],
      },
      {
        text: "I will never forget it.",
        meaning: "我会记着的。",
        insight: "按场景选用；注意语气与关系距离。",
        active: true,
        examples: [
          { en: "I will never forget it.", zh: "我会记着的。" },
          { en: "She said, \"I will never forget it.\"", zh: "她说：「我会记着的。」" },
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

进阶篇按「保留评价、边界与惯用语」重组；句块选自常用英语500句语料，且不与入门篇、基础篇重复。影视脏话与高冲突表达不进入本卷。冲突时以本卷教学文档为准。
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
