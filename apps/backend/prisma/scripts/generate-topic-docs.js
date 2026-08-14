/**
 * 为 common-500-sentences 生成教学文档：
 *   1. training_topics.csv — 8 话题（教学说明 + 本话题全部要学句子的表格）
 *   2. topics/<nn>-<话题名>.md — 每个话题一个教学文档（含全部句子表格）
 *
 * 读取 500-sentences.csv (id/en/zh/topic/difficulty)，话题教学内容定义在本文件 TOPIC_TEACHING 中。
 *
 * 用法: node apps/backend/prisma/scripts/generate-topic-docs.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'data', 'packages', 'common-500-sentences');
const TOPICS_DIR = path.join(OUT_DIR, 'topics');

const SCENE_TITLE = '常用英语500句';
const DURATION_SEC = 900;

// ── 每个话题的教学内容（标题、难度、教学说明、核心句块、教学重点） ──
const TOPIC_TEACHING = [
  {
    title: '问候与寒暄',
    difficulty: 'L1',
    promptEn: 'Greet someone, make small talk, and say goodbye naturally.',
    promptZh: '自然地问候、寒暄并道别。',
    description: '学会用简短句块开启、维持和结束对话',
    knowledgePoints: 'greetings, farewells, small talk, conversation linkers, 问候, 告别, 寒暄',
    intro: '学会用简短句块自然开启、维持和结束对话，涵盖问候、告别、寒暄和话轮衔接。',
    coreChunks: [
      'What\'s up? 你好/怎么啦？',
      'How\'s it going! 最近怎么样',
      'How have you been. 最近怎么样',
      'See you later. 待会见',
      'Take care. 保重',
      'Keep in touch. 保持联系',
      'Make yourself at home. 请随意',
      'Speaking of which. 话说到这',
    ],
    keyPoints: [
      '问候语区分正式与随意（How have you been / What\'s up）',
      '告别语与祝福语搭配使用（See you later / Take care）',
      '用 Speaking of which、One more thing、Before I forget 衔接话轮',
    ],
  },
  {
    title: '感谢、道歉与祝福',
    difficulty: 'L1',
    promptEn: 'Thank, apologize, congratulate, and send good wishes.',
    promptZh: '表达感谢、道歉、祝贺与美好祝愿。',
    description: '学习表达感谢、道歉、祝贺、称赞与祝愿',
    knowledgePoints: 'thanks, apologies, congratulations, wishes, compliments, 感谢, 道歉, 祝福',
    intro: '学习表达感谢、道歉、祝贺、称赞与美好祝愿，并自然回应他人。',
    coreChunks: [
      'Good job. 做得好',
      'Well done. 干得好',
      'Congratulations. 恭喜',
      'Thank you so much for helping me move yesterday. 非常感谢你昨天帮我搬家',
      'My apologies. 我向你道歉',
      'Forgive me. 原谅我',
      'Good luck. 祝你好运',
      'Happy birthday. 生日快乐',
    ],
    keyPoints: [
      '感谢表达：Thank you / Thanks a lot / Thank you so much',
      '道歉分级：Sorry / My apologies / I am so sorry',
      '祝福与称赞用固定句型（Good luck / Well done / You look great）',
    ],
  },
  {
    title: '请求、指令与许可',
    difficulty: 'L1',
    promptEn: 'Ask for help, give instructions, and ask permission.',
    promptZh: '请求帮助、下达指令与征求许可。',
    description: '学会礼貌请求、下达指令与征求许可',
    knowledgePoints: 'requests, commands, permission, imperatives, 请求, 指令, 许可',
    intro: '学会礼貌请求帮助、下达或服从指令，以及征求和给予许可。',
    coreChunks: [
      'Do me a favor. 帮我个忙',
      'Give me a hand. 帮个忙',
      'Allow me. 让我来',
      'Be careful. 小心',
      'Watch out. 当心',
      'Just do it. 尽管去做',
      'Could I have a moment of your time? 我能占用你一点时间吗？',
      'May I ask some questions? 我可以问几个问题吗？',
    ],
    keyPoints: [
      '请求帮助用 favor / hand / Could I...?',
      '指令多用祈使句并注意语气（Watch out / Calm down）',
      '征求许可用 May I...? / Can I...? / Could I...?',
    ],
  },
  {
    title: '疑问、澄清与确认',
    difficulty: 'L2',
    promptEn: 'Ask questions and clarify information.',
    promptZh: '提问并澄清、确认信息。',
    description: '学习用疑问句获取信息、澄清误解并确认事实',
    knowledgePoints: 'wh-questions, yes/no questions, clarification, confirmation, 疑问, 澄清, 确认',
    intro: '学习用疑问句获取信息、澄清误解并确认事实。',
    coreChunks: [
      'What\'s going on? 怎么回事？',
      'What do you mean? 你什么意思？',
      'Are you serious? 你是认真的吗？',
      'Is that so? 是这样吗？',
      'Anything else? 还有什么',
      'Where can I buy a ticket? 在哪里能买到票？',
      'When is the next train? 下趟火车什么时候到？',
    ],
    keyPoints: [
      '特殊疑问词 What / Where / When / Who / Why / How 引导问句',
      '一般疑问句配合简短回答（Yes / No / Not yet）',
      '澄清表达：I beg your pardon / What do you mean / Is that clear',
    ],
  },
  {
    title: '观点、同意与评价',
    difficulty: 'L1',
    promptEn: 'Agree, disagree, and react to what you hear.',
    promptZh: '表示同意、反对并回应他人说法。',
    description: '学习表达同意、反对、判断与反应',
    knowledgePoints: 'agreement, disagreement, opinions, reactions, evaluation, 观点, 同意, 评价',
    intro: '学习表达同意、反对、判断与反应，在对话中表明自己的立场。',
    coreChunks: [
      'Absolutely. 当然',
      'I think so. 我想是的',
      'Me neither. 我也是',
      'That\'s for sure. 那是肯定的',
      'That\'s weird. 太奇怪了',
      'It doesn\'t make sense. 这没道理',
      'It\'s a big deal. 这是大事',
      'I doubt it. 我深表怀疑',
    ],
    keyPoints: [
      '同意：Absolutely / You bet / I think so / That\'s for sure',
      '反对与怀疑：I doubt it / Not really / Hard to say',
      '评价句型：That\'s + 形容词（weird / ridiculous / amazing）',
    ],
  },
  {
    title: '情绪与安慰',
    difficulty: 'L1',
    promptEn: 'Talk about feelings and comfort others.',
    promptZh: '谈论感受并安慰、鼓励他人。',
    description: '学习谈论自身感受并安慰、鼓励他人',
    knowledgePoints: 'feelings, emotions, comfort, encouragement, 情绪, 安慰, 鼓励',
    intro: '学习谈论自己的感受，并用鼓励与安慰回应他人。',
    coreChunks: [
      'I miss you. 我想你',
      'I\'m tired. 我累了',
      'I\'m bored. 我很无聊',
      'Take it easy. 放轻松',
      'Cheer up. 开心点',
      'Hang in there. 坚持住',
      'Don\'t panic. 别慌',
      'That was close. 好险啊',
    ],
    keyPoints: [
      '用 I\'m + 情绪词 表达感受（tired / bored / confused）',
      '安慰他人：Take it easy / Cheer up / Don\'t worry',
      '鼓励他人：Hang in there / Go for it / You can do it',
    ],
  },
  {
    title: '日常陈述与事务',
    difficulty: 'L2',
    promptEn: 'Describe daily routines, situations, and facts.',
    promptZh: '描述日常作息、状况与事实。',
    description: '学习陈述日常作息、描述人物事物并报告状况',
    knowledgePoints: 'routines, descriptions, situations, promises, 日常, 陈述, 事务',
    intro: '学习陈述日常作息、描述人物与事物、报告状况并作出承诺。',
    coreChunks: [
      'On my way. 我在路上了',
      'I\'m home. 我回来了',
      'I promise. 我保证',
      'Time\'s up. 时间到了',
      'Here we are. 我们到了',
      'I get up at six o\'clock. 我六点起床',
      'We are all busy with work. 我们都忙于工作',
      'He was born in New York. 他出生在纽约',
    ],
    keyPoints: [
      '一般现在时陈述日常动作与事实',
      '简短状况句：On my way / Time\'s up / Something\'s wrong',
      '承诺表达：I promise / You have my word / Will do',
    ],
  },
  {
    title: '惯用语与俚语',
    difficulty: 'L3',
    promptEn: 'Use common idioms and slang naturally.',
    promptZh: '自然使用常见惯用语与俚语。',
    description: '学习高频惯用语、谚语与俚语的整体含义与得体使用',
    knowledgePoints: 'idioms, slang, proverbs, set phrases, 惯用语, 俚语, 谚语',
    intro: '学习英语口语中高频惯用语、谚语与俚语，理解其整体含义并得体使用。',
    coreChunks: [
      'Break a leg. 祝你好运',
      'It\'s not rocket science. 这没那么难',
      'Let bygones be bygones. 过去的就让它过去吧',
      'Better late than never. 晚到总比不到好',
      'No biggie. 不要紧',
      'The ball is in your court. 该你采取行动了',
      'Don\'t cry over spilled milk. 不要做无益的后悔',
      'You have to bite the bullet. 你得硬着头皮去做',
    ],
    keyPoints: [
      '惯用语按整体记忆，不逐词直译',
      '区分正式与非正式语境（俚语谨慎使用）',
      '谚语常用于安慰与劝诫（Let bygones be bygones / Better late than never）',
    ],
  },
];

// ── 读取最终 500-sentences.csv ──
function readSentences() {
  const lines = fs.readFileSync(path.join(OUT_DIR, '500-sentences.csv'), 'utf8').trim().split('\n');
  const rows = [];
  for (const line of lines.slice(1)) {
    const i = line.lastIndexOf('",');
    const head = line.slice(0, i + 1);
    const diff = line.slice(i + 2);
    const m = head.match(/^(\d+),"((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)"$/);
    if (!m) continue;
    rows.push({
      id: +m[1],
      en: m[2].replace(/""/g, '"'),
      zh: m[3].replace(/""/g, '"'),
      topic: m[4].replace(/""/g, '"'),
      diff,
    });
  }
  return rows;
}

function csvField(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function sentenceTable(list) {
  const head = '| # | 英文 | 中文 | 难度 |\n|---|------|------|:----:|';
  const body = list
    .sort((a, b) => a.id - b.id)
    .map(s => `| ${s.id} | ${s.en} | ${s.zh} | ${s.diff} |`)
    .join('\n');
  return `${head}\n${body}`;
}

// 构建入库的 teaching_markdown（含全部句子表格，一一对应中文）
function buildTeachingMarkdown(t, list) {
  const parts = [];
  parts.push(`## ${t.title}`);
  parts.push('');
  parts.push(t.intro);
  parts.push('');
  parts.push('### 核心句块');
  parts.push(t.coreChunks.map(c => `- ${c}`).join('\n'));
  parts.push('');
  parts.push('### 教学重点');
  parts.push(t.keyPoints.map(k => `- ${k}`).join('\n'));
  parts.push('');
  parts.push(`### 本话题要学的句子（${list.length} 句）`);
  parts.push('');
  parts.push(sentenceTable(list));
  return parts.join('\n');
}

// 构建每话题 md 教学文档
function buildTopicMd(t, list, seq, seqPad) {
  const teaching = buildTeachingMarkdown(t, list)
    .replace(/^##\s*[^\n]+\n+/, ''); // md 文件里话题标题已在文件标题中
  return `# 话题 ${seqPad} · ${t.title}

> **所属学习包**：${SCENE_TITLE} ｜ **难度**：${t.difficulty} ｜ **要学的句子**：${list.length} 句
> **学习进度**：第 ${seq} 课（共 ${TOPIC_TEACHING.length} 课）

## 教学说明

${teaching}

## 完成标准

> ${t.promptZh}

${t.promptEn}
`;
}

function main() {
  const sentences = readSentences();
  if (sentences.length !== 500) throw new Error(`句子数 ${sentences.length} ≠ 500`);
  if (TOPIC_TEACHING.length !== 8) throw new Error(`话题数 ${TOPIC_TEACHING.length} ≠ 8`);

  fs.mkdirSync(TOPICS_DIR, { recursive: true });

  const csvRows = ['scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key'];
  let total = 0;

  TOPIC_TEACHING.forEach((t, idx) => {
    const seq = idx + 1;
    const seqPad = String(seq).padStart(2, '0');
    const list = sentences.filter(s => s.topic === t.title);
    total += list.length;
    const inkKey = `practice_common500_常用口语_${t.title}`;

    // topics/<nn>-<title>.md
    const md = buildTopicMd(t, list, seq, seqPad);
    fs.writeFileSync(path.join(TOPICS_DIR, `${seqPad}-${t.title}.md`), md, 'utf8');
    console.log(`✅ ${seqPad}-${t.title}.md (${list.length} 句)`);

    // training_topics.csv 行（teaching_markdown 含全部句子表格）
    const teaching = buildTeachingMarkdown(t, list);
    csvRows.push([
      SCENE_TITLE,
      t.title,
      csvField(t.promptEn),
      csvField(t.promptZh),
      DURATION_SEC,
      t.difficulty,
      csvField(t.description),
      csvField(t.knowledgePoints),
      csvField(teaching),
      inkKey,
    ].join(','));
  });

  fs.writeFileSync(path.join(OUT_DIR, 'training_topics.csv'), csvRows.join('\n') + '\n', 'utf8');
  console.log(`\n✅ training_topics.csv (${TOPIC_TEACHING.length} 话题, 共 ${total} 句)`);
  if (total !== 500) throw new Error(`话题句子合计 ${total} ≠ 500`);
}

main();
