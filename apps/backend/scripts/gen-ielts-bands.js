const fs = require('fs');
const path = require('path');
const base = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

// IELTS band packages config
const bands = [
  {
    name: 'exam-ielts-6',
    title: '雅思·IELTS Band 6 基础',
    cat: '雅思口语',
    loc: '雅思口语考场',
    lvl: 'L2',
    desc: '对应雅思口语6分水平：能用基本词汇和简单句型回答熟悉话题。',
    topics: [
      { t: '家乡与住所', p_en: 'Answer simple questions about your hometown and home.', p_zh: '回答关于家乡和住所的简单问题。', dur: 45, desc: '6分基础题：用简单句描述家乡和住所，掌握基本词汇。', kp: 'P1 家乡 住所 基础词汇' },
      { t: '学习与工作', p_en: 'Answer basic questions about your study or job.', p_zh: '回答关于学习或工作的基本问题。', dur: 45, desc: '6分基础题：能说专业/职业、日常工作内容，使用简单连接词。', kp: 'P1 学习 工作 日常' },
    ],
    vocab: [
      { w: 'hometown', m: '家乡', pos: 'noun', ph: '/ˈhoʊmtaʊn/', ph_uk: '/ˈhəʊmtaʊn/', lv: 'L1', desc: '你的出生地或成长的地方。', ex: '[{"en":"My hometown is a small city in the south.","zh":"我的家乡是南方的一个小城市。"}]' },
      { w: 'accommodation', m: '住所', pos: 'noun', ph: '/əˌkɑːməˈdeɪʃən/', ph_uk: '/əˌkɒməˈdeɪʃən/', lv: 'L2', desc: '住处/住宿。', ex: '[{"en":"I live in a flat near the city center.","zh":"我住在市中心附近的一套公寓里。"}]' },
      { w: 'major', m: '专业', pos: 'noun', ph: '/ˈmeɪdʒər/', ph_uk: '/ˈmeɪdʒə/', lv: 'L1', desc: '大学主修专业。', ex: '[{"en":"My major is Business Administration.","zh":"我的专业是工商管理。"}]' },
      { w: 'colleague', m: '同事', pos: 'noun', ph: '/ˈkɑːliːɡ/', ph_uk: '/ˈkɒliːɡ/', lv: 'L2', desc: '一起工作的人。', ex: '[{"en":"I get along well with my colleagues.","zh":"我和同事相处融洽。"}]' },
    ],
  },
  {
    name: 'exam-ielts-6-5',
    title: '雅思·IELTS Band 6.5 发展',
    cat: '雅思口语',
    loc: '雅思口语考场',
    lvl: 'L2',
    desc: '对应雅思口语6.5分水平：词汇量扩大，能使用一些复杂句。',
    topics: [
      { t: '兴趣爱好', p_en: 'Describe a hobby or activity you enjoy.', p_zh: '描述你喜欢的爱好或活动。', dur: 60, desc: '6.5分：能较详细描述爱好，使用一些复杂句和连接词。', kp: 'P2 爱好 描述 原因' },
      { t: '交通出行', p_en: 'Answer questions about transportation in your city.', p_zh: '回答关于城市交通的问题。', dur: 50, desc: '6.5分：能讨论交通方式、优缺点，表达个人偏好。', kp: 'P1 交通 城市 偏好' },
    ],
    vocab: [
      { w: 'hobby', m: '爱好', pos: 'noun', ph: '/ˈhɑːbi/', ph_uk: '/ˈhɒbi/', lv: 'L1', desc: '业余爱好。', ex: '[{"en":"My hobby is playing the guitar.","zh":"我的爱好是弹吉他。"}]' },
      { w: 'relaxing', m: '放松的', pos: 'adj', ph: '/rɪˈlæksɪŋ/', ph_uk: '/rɪˈlæksɪŋ/', lv: 'L2', desc: '让人放松的。', ex: '[{"en":"I find swimming very relaxing.","zh":"我觉得游泳很放松。"}]' },
      { w: 'transportation', m: '交通', pos: 'noun', ph: '/ˌtrænspɔːrˈteɪʃən/', ph_uk: '/ˌtrænspɔːˈteɪʃən/', lv: 'L2', desc: '交通方式。', ex: '[{"en":"Public transportation in my city is convenient.","zh":"我市的公共交通很方便。"}]' },
      { w: 'convenient', m: '方便的', pos: 'adj', ph: '/kənˈviːniənt/', ph_uk: '/kənˈviːniənt/', lv: 'L2', desc: '方便、便利的。', ex: '[{"en":"The subway is very convenient.","zh":"地铁非常方便。"}]' },
    ],
  },
  {
    name: 'exam-ielts-7',
    title: '雅思·IELTS Band 7 良好',
    cat: '雅思口语',
    loc: '雅思口语考场',
    lvl: 'L3',
    desc: '对应雅思口语7分水平：词汇灵活，能讨论抽象话题。',
    topics: [
      { t: '推荐旅游地', p_en: 'Describe a place you would recommend to visitors.', p_zh: '描述一个你想推荐给游客的地方。', dur: 90, desc: '7分：能按cue card要点组织描述，使用丰富词汇和复杂句型。', kp: 'P2 地点 旅游 描述' },
      { t: '城市发展', p_en: 'Discuss how cities can attract more tourists.', p_zh: '讨论城市如何吸引更多游客。', dur: 60, desc: '7分：能就抽象话题展开讨论，表达观点并有支撑。', kp: 'P3 城市 旅游 发展' },
    ],
    vocab: [
      { w: 'scenic', m: '风景优美的', pos: 'adj', ph: '/ˈsiːnɪk/', ph_uk: '/ˈsiːnɪk/', lv: 'L3', desc: '景色优美的。', ex: '[{"en":"The scenic spots are worth visiting.","zh":"这些风景点值得一看。"}]' },
      { w: 'recommend', m: '推荐', pos: 'verb', ph: '/ˌrekəˈmend/', ph_uk: '/ˌrekəˈmend/', lv: 'L2', desc: '推荐。', ex: '[{"en":"I highly recommend visiting the Great Wall.","zh":"我强烈推荐去长城。"}]' },
      { w: 'attract', m: '吸引', pos: 'verb', ph: '/əˈtrækt/', ph_uk: '/əˈtrækt/', lv: 'L2', desc: '吸引。', ex: '[{"en":"The city attracts millions of tourists.","zh":"这座城市吸引了数百万游客。"}]' },
      { w: 'diverse', m: '多样化的', pos: 'adj', ph: '/daɪˈvɜːrs/', ph_uk: '/daɪˈvɜːs/', lv: 'L3', desc: '多元的、多样的。', ex: '[{"en":"The city has a diverse culture.","zh":"这座城市有多元文化。"}]' },
    ],
  },
  {
    name: 'exam-ielts-7-5',
    title: '雅思·IELTS Band 7.5 优良',
    cat: '雅思口语',
    loc: '雅思口语考场',
    lvl: 'L3',
    desc: '对应雅思口语7.5分水平：语言使用灵活，能使用习语。',
    topics: [
      { t: '印象深刻的人', p_en: 'Describe a person you met recently who left a deep impression.', p_zh: '描述一个你最近遇到的印象深刻的人。', dur: 90, desc: '7.5分：能生动描述人物，使用习语和较高级词汇。', kp: 'P2 人物 描述 印象' },
      { t: '科技与社交', p_en: 'Discuss how technology has changed the way people interact.', p_zh: '讨论科技如何改变了人们交流的方式。', dur: 70, desc: '7.5分：能就科技话题展开深入讨论，使用对比、让步等论证。', kp: 'P3 科技 社交 影响' },
    ],
    vocab: [
      { w: 'impression', m: '印象', pos: 'noun', ph: '/ɪmˈpreʃən/', ph_uk: '/ɪmˈpreʃən/', lv: 'L3', desc: '印象、感受。', ex: '[{"en":"She left a lasting impression on me.","zh":"她给我留下了持久的印象。"}]' },
      { w: 'interact', m: '互动', pos: 'verb', ph: '/ˌɪntərˈækt/', ph_uk: '/ˌɪntərˈækt/', lv: 'L3', desc: '相互作用、交流。', ex: '[{"en":"People interact differently online.","zh":"人们在网上互动方式不同。"}]' },
      { w: 'significant', m: '重要的', pos: 'adj', ph: '/sɪɡˈnɪfɪkənt/', ph_uk: '/sɪɡˈnɪfɪkənt/', lv: 'L3', desc: '重要的、有意义的。', ex: '[{"en":"Technology has had a significant impact.","zh":"技术产生了重大影响。"}]' },
      { w: 'evolve', m: '演变', pos: 'verb', ph: '/ɪˈvɑːlv/', ph_uk: '/ɪˈvɒlv/', lv: 'L3', desc: '进化、发展。', ex: '[{"en":"Social norms have evolved over time.","zh":"社会规范随着时间演变。"}]' },
    ],
  },
  {
    name: 'exam-ielts-8',
    title: '雅思·IELTS Band 8 优秀',
    cat: '雅思口语',
    loc: '雅思口语考场',
    lvl: 'L4',
    desc: '对应雅思口语8分水平：词汇精准，句型丰富。',
    topics: [
      { t: '难忘的经历', p_en: 'Describe a memorable experience that taught you something.', p_zh: '描述一次让你学到东西的难忘经历。', dur: 90, desc: '8分：能流畅叙述经历，使用精准词汇和多种句型。', kp: 'P2 经历 叙述 感悟' },
      { t: '教育与社会', p_en: 'Discuss the role of education in society and how it has evolved.', p_zh: '讨论教育在社会中的作用以及它如何演变。', dur: 75, desc: '8分：能深度分析教育话题，使用高级词汇和复杂论证结构。', kp: 'P3 教育 社会 变革' },
    ],
    vocab: [
      { w: 'memorable', m: '难忘的', pos: 'adj', ph: '/ˈmemərəbəl/', ph_uk: '/ˈmemərəbəl/', lv: 'L3', desc: '值得记忆的、难忘的。', ex: '[{"en":"It was a truly memorable experience.","zh":"那真是一次难忘的经历。"}]' },
      { w: 'perspective', m: '视角', pos: 'noun', ph: '/pərˈspektɪv/', ph_uk: '/pəˈspektɪv/', lv: 'L4', desc: '观点、视角。', ex: '[{"en":"This changed my perspective on life.","zh":"这改变了我对生活的看法。"}]' },
      { w: 'profound', m: '深刻的', pos: 'adj', ph: '/prəˈfaʊnd/', ph_uk: '/prəˈfaʊnd/', lv: 'L4', desc: '深刻的、意义深远的。', ex: '[{"en":"The experience had a profound effect on me.","zh":"这次经历对我产生了深远的影响。"}]' },
      { w: 'critical', m: '批判性的', pos: 'adj', ph: '/ˈkrɪtɪkəl/', ph_uk: '/ˈkrɪtɪkəl/', lv: 'L4', desc: '批判的、关键的。', ex: '[{"en":"Critical thinking is essential in education.","zh":"批判性思维在教育中至关重要。"}]' },
    ],
  },
  {
    name: 'exam-ielts-8-5',
    title: '雅思·IELTS Band 8.5 卓越',
    cat: '雅思口语',
    loc: '雅思口语考场',
    lvl: 'L4',
    desc: '对应雅思口语8.5分水平：接近母语者表达，词汇地道。',
    topics: [
      { t: '理想的改变', p_en: 'Describe a positive change you would like to see in the world.', p_zh: '描述一个你希望看到的世界的积极改变。', dur: 90, desc: '8.5分：能表达抽象观点，使用地道词汇和习语。', kp: 'P2 改变 理想 展望' },
      { t: '全球化与文化', p_en: 'Discuss the impact of globalization on local cultures.', p_zh: '讨论全球化对地方文化的影响。', dur: 80, desc: '8.5分：能进行深入批判性讨论，使用高级论证技巧。', kp: 'P3 全球化 文化 影响' },
    ],
    vocab: [
      { w: 'transformative', m: '变革性的', pos: 'adj', ph: '/trænsˈfɔːrmətɪv/', ph_uk: '/trænsˈfɔːmətɪv/', lv: 'L4', desc: '具有变革能力的。', ex: '[{"en":"Education can be transformative.","zh":"教育可以带来变革。"}]' },
      { w: 'globalization', m: '全球化', pos: 'noun', ph: '/ˌɡloʊbəlaɪˈzeɪʃən/', ph_uk: '/ˌɡləʊbəlaɪˈzeɪʃən/', lv: 'L4', desc: '全球化进程。', ex: '[{"en":"Globalization affects every aspect of our lives.","zh":"全球化影响着我们生活的方方面面。"}]' },
      { w: 'inevitable', m: '不可避免的', pos: 'adj', ph: '/ɪnˈevɪtəbəl/', ph_uk: '/ɪnˈevɪtəbəl/', lv: 'L4', desc: '不可避免的。', ex: '[{"en":"Change is inevitable in a globalized world.","zh":"在全球化的世界中变化是不可避免的。"}]' },
      { w: 'sustainable', m: '可持续的', pos: 'adj', ph: '/səˈsteɪnəbəl/', ph_uk: '/səˈsteɪnəbəl/', lv: 'L4', desc: '可持续的。', ex: '[{"en":"We need sustainable development.","zh":"我们需要可持续发展。"}]' },
    ],
  },
];

function writeCsv(fp, rows) {
  fs.writeFileSync(fp, rows.join('\n') + '\n');
}

for (const b of bands) {
  const dir = path.join(base, b.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'ink-scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ink-scripts', '.gitkeep'), '');

  // 1. scenes.csv
  const sc = [
    'category_name,title,location,required_output_level,required_user_level,description,package_type',
    `${b.cat},${b.title},${b.loc},${b.lvl},1,${b.desc},exam`
  ];
  writeCsv(path.join(dir, 'scenes.csv'), sc);

  // 2. training_topics.csv
  const ttHeader = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,ink_script_key';
  const ttRows = b.topics.map(t =>
    `"${b.title}",${t.t},${t.p_en},${t.p_zh},${t.dur},${b.lvl},${t.desc},${t.kp},`
  );
  writeCsv(path.join(dir, 'training_topics.csv'), [ttHeader, ...ttRows]);

  // 3. scene_vocabulary.csv
  const svHeader = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order';
  let svRows = [];
  let sortOrd = 0;
  for (const topic of b.topics) {
    for (const v of b.vocab) {
      svRows.push(`"${b.title}",${topic.t},${v.w},${v.m},${v.pos},${v.ph},${v.ph_uk},${v.lv},${v.desc},${v.ex},${sortOrd}`);
      sortOrd++;
    }
  }
  writeCsv(path.join(dir, 'scene_vocabulary.csv'), [svHeader, ...svRows]);

  // 4. chunks.csv
  const chHeader = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json';
  const chRows = [];
  for (const topic of b.topics) {
    // Simple chunks
    chRows.push(`"${b.title}",${topic.t},${topic.t},Let me talk about ${topic.t}.,让我谈谈${topic.t}。,${b.lvl},引入话题的标准表达。,"[{""en"":""Let me talk about this topic."",""zh"":""让我谈谈这个话题。""}]"`);
    chRows.push(`"${b.title}",${topic.t},${topic.t},I would like to talk about...,我想谈谈...,${b.lvl},更正式地引入话题。,"[{""en"":""I would like to talk about my hometown."",""zh"":""我想谈谈我的家乡。""}]"`);
  }
  writeCsv(path.join(dir, 'chunks.csv'), [chHeader, ...chRows]);

  // 5. sentence_patterns.csv
  const spHeader = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order';
  const spRows = [];
  for (let i = 0; i < b.topics.length; i++) {
    spRows.push(`"${b.title}",${b.topics[i].t},"I would like to talk about ___.",引入话题,${b.topics[i].t},"I would like to talk about ${b.topics[i].t}.",${b.lvl},${i}`);
  }
  writeCsv(path.join(dir, 'sentence_patterns.csv'), [spHeader, ...spRows]);

  // 6. script_episodes.csv
  const seHeader = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json';
  const seChapterId = `ielts_${b.name.replace('exam-ielts-', '').replace('-', '_')}`;
  const seTitle = b.title.replace('雅思·IELTS ', '');
  const seRows = [];
  // Episode 1: first topic
  seRows.push(`${seChapterId},${seTitle},1,${b.topics[0].t},"${b.title}",${b.lvl},1,2,4,2,2,"[""学习${b.topics[0].t}相关表达""]",2,2,2,Tutor,口语考官,true,,{"xp":20}`);
  // Episode 2: second topic
  seRows.push(`${seChapterId},${seTitle},2,${b.topics[1].t},"${b.title}",${b.lvl},1,2,4,2,2,"[""学习${b.topics[1].t}相关表达""]",2,2,2,Tutor,口语考官,false,,{"xp":20}`);
  writeCsv(path.join(dir, 'script_episodes.csv'), [seHeader, ...seRows]);

  // 7. episode_chunks.csv
  const ecHeader = 'episode_chapter,episode_order,chunk_text_match,sort_order';
  const ecRows = [];
  ecRows.push(`${seChapterId},1,Let me talk about ${b.topics[0].t}.,0`);
  ecRows.push(`${seChapterId},1,I would like to talk about...,1`);
  ecRows.push(`${seChapterId},2,Let me talk about ${b.topics[1].t}.,0`);
  ecRows.push(`${seChapterId},2,I would like to talk about...,1`);
  writeCsv(path.join(dir, 'episode_chunks.csv'), [ecHeader, ...ecRows]);

  // 8. 学习包的功能介绍.md
  const doc = `# ${b.title}

## 学习包概览

本学习包是 **雅思口语专项系列** 的重要组成部分。

### 适用对象

- **难度等级**：${b.lvl}
- **目标分数**：${b.title.replace('雅思·IELTS ', '').replace('IELTS Band ', 'Band ')}
- **前置要求**：${b.lvl === 'L2' ? '掌握基础语法和日常词汇' : b.lvl === 'L3' ? '能进行较流利的日常对话' : '能讨论抽象话题，词汇量较丰富'}
- **目标学习者**：备战雅思口语考试，目标${b.title.replace('雅思·IELTS ', '')}分的考生

### 包含主题

| 主题 | 类型 | 时长 |
|------|:----:|:----:|
${b.topics.map(t => `| ${t.t} | P1/P2/P3 口语题 | ${t.dur}秒 |`).join('\n')}

### 核心词汇

${b.vocab.map(v => `- **${v.w}** (${v.m}) — ${v.desc}`).join('\n')}

### 数据文件

| 文件 | 内容 |
|------|------|
| \`scenes.csv\` | 场景定义 |
| \`training_topics.csv\` | ${b.topics.length} 个训练主题 |
| \`scene_vocabulary.csv\` | ${b.vocab.length} 个核心词汇 |
| \`chunks.csv\` | 核心表达例句 |
| \`sentence_patterns.csv\` | 句型模板 |
| \`script_episodes.csv\` | 2 个学习剧集 |
| \`episode_chunks.csv\` | 剧集-例句关联 |

### 关键词

\`雅思\` \`IELTS\` \`口语\` \`${b.lvl}\` \`留学\`
`;
  fs.writeFileSync(path.join(dir, '学习包的功能介绍.md'), doc, 'utf-8');

  console.log(`✅ ${b.name} created`);
}

console.log('\n=== IELTS BAND PACKAGES DONE ===');
