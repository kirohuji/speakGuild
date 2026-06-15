const fs = require('fs');
const path = require('path');
const base = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

function writeCsv(fp, rows) { fs.writeFileSync(fp, rows.join('\n') + '\n'); }

// Helper to create a package
function createPkg(name, cat, scenes, lvl) {
  const dir = path.join(base, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'ink-scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ink-scripts', '.gitkeep'), '');

  const scenesCsv = [
    'category_name,title,location,required_output_level,required_user_level,description,package_type',
    ...scenes.map(s => `${cat},${s.title},${s.loc || '通用'},${s.lvl || lvl},1,${s.desc},exam`)
  ];
  writeCsv(path.join(dir, 'scenes.csv'), scenesCsv);

  const topics = scenes.flatMap(s => s.topics || []);
  const ttHeader = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,ink_script_key';
  const ttRows = topics.map(t => `"${t.sceneTitle}",${t.t},${t.p_en},${t.p_zh},${t.dur},${t.lvl || lvl},${t.desc},${t.kp},`);
  writeCsv(path.join(dir, 'training_topics.csv'), [ttHeader, ...ttRows]);

  const svHeader = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order';
  let svRows = [], sIdx = 0;
  for (const s of scenes) {
    for (const t of (s.topics || [])) {
      for (const v of (s.vocab || [])) {
        svRows.push(`"${s.title}",${t.t},${v.w},${v.m},${v.pos},${v.ph},${v.ph_uk},${v.lv || lvl},${v.desc},${v.ex},${sIdx++}`);
      }
    }
  }
  writeCsv(path.join(dir, 'scene_vocabulary.csv'), [svHeader, ...svRows]);

  const chHeader = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json';
  const chRows = [];
  for (const s of scenes) {
    for (const t of (s.topics || [])) {
      chRows.push(`"${s.title}",${t.t},${t.t},Let me talk about ${t.t}.,让我谈谈${t.t}。,${t.lvl || lvl},"标准表达。","[{""en"":""Let me talk about this.",""zh"":""让我谈谈这个。""}]"`);
    }
  }
  writeCsv(path.join(dir, 'chunks.csv'), [chHeader, ...chRows]);

  const spHeader = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order';
  const spRows = [];
  for (const s of scenes) {
    (s.topics || []).forEach((t, i) => {
      spRows.push(`"${s.title}",${t.t},"Let me talk about ___.",引入话题,${t.t},"Let me talk about ${t.t}.",${t.lvl || lvl},${i}`);
    });
  }
  writeCsv(path.join(dir, 'sentence_patterns.csv'), [spHeader, ...spRows]);

  const seHeader = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json';
  const seRows = [];
  let eIdx = 0;
  for (const s of scenes) {
    const tops = s.topics || [];
    const chId = `exam_${name.replace(/[^a-z0-9]/g, '_')}_${eIdx}`;
    const chTitle = s.shortTitle || s.title;
    tops.forEach((t, i) => {
      seRows.push(`${chId},${chTitle},${i + 1},${t.t},"${s.title}",${t.lvl || lvl},1,2,2,2,2,"[""学习${t.t}相关表达""]",2,2,2,Tutor,${cat === '大学英语' ? '考官' : '考官'},${i === 0 && eIdx === 0},,{"xp":20}`);
    });
    eIdx++;
  }
  writeCsv(path.join(dir, 'script_episodes.csv'), [seHeader, ...seRows]);

  const ecHeader = 'episode_chapter,episode_order,chunk_text_match,sort_order';
  const ecRows = [];
  eIdx = 0;
  for (const s of scenes) {
    const tops = s.topics || [];
    const chId = `exam_${name.replace(/[^a-z0-9]/g, '_')}_${eIdx}`;
    tops.forEach((t, i) => {
      ecRows.push(`${chId},${i + 1},Let me talk about ${t.t}.,0`);
    });
    eIdx++;
  }
  writeCsv(path.join(dir, 'episode_chunks.csv'), [ecHeader, ...ecRows]);

  const doc = `# ${cat} · ${scenes.map(s => s.shortTitle || s.title).join(' / ')}

## 学习包概览

本学习包是 **${cat}专项** 学习材料。

### 适用对象

- **难度等级**：${lvl}
- **目标学习者**：准备${cat}考试的学习者

### 包含场景

${scenes.map(s => `- **${s.title}**${s.desc ? ' — ' + s.desc : ''}`).join('\n')}

### 数据文件

| 文件 | 内容 |
|------|------|
| \`scenes.csv\` | ${scenes.length} 个场景 |
| \`training_topics.csv\` | ${topics.length} 个训练主题 |
| \`scene_vocabulary.csv\` | 核心词汇 |
| \`chunks.csv\` | 表达例句 |
| \`sentence_patterns.csv\` | 句型模板 |
| \`script_episodes.csv\` | 学习剧集 |
| \`episode_chunks.csv\` | 剧集-例句关联 |
`;
  fs.writeFileSync(path.join(dir, '学习包的功能介绍.md'), doc, 'utf-8');
  console.log(`✅ ${name} created`);
}

// ===== CET-4 大学英语四级 =====
createPkg('exam-cet-4', '大学英语', [
  {
    title: '四级·校园生活',
    shortTitle: '校园生活',
    lvl: 'L2',
    desc: 'CET-4常考话题：校园生活、选课、社团活动。掌握四级核心词汇和基本议论文表达。',
    topics: [
      { t: '选课与课程', sceneTitle: '四级·校园生活', p_en: 'Talk about course selection and academic life.', p_zh: '谈论选课和学术生活。', dur: 50, lvl: 'L2', desc: '四级常考话题：用英语讨论课程选择和学术规划。', kp: 'CET4 选课 课程' },
      { t: '社团与活动', sceneTitle: '四级·校园生活', p_en: 'Describe campus clubs and extracurricular activities.', p_zh: '描述校园社团和课外活动。', dur: 50, lvl: 'L2', desc: '四级常考话题：介绍社团活动和团队合作经历。', kp: 'CET4 社团 活动' },
    ],
    vocab: [
      { w: 'curriculum', m: '课程', pos: 'noun', ph: '/kəˈrɪkjələm/', ph_uk: '/kəˈrɪkjələm/', lv: 'L2', desc: '全部课程。', ex: '[{"en":"The curriculum is very flexible.","zh":"课程设置非常灵活。"}]' },
      { w: 'extracurricular', m: '课外的', pos: 'adj', ph: '/ˌekstrəkəˈrɪkjələr/', ph_uk: '/ˌekstrəkəˈrɪkjələ/', lv: 'L2', desc: '课外的。', ex: '[{"en":"I joined several extracurricular activities.","zh":"我参加了几个课外活动。"}]' },
      { w: 'semester', m: '学期', pos: 'noun', ph: '/sɪˈmestər/', ph_uk: '/sɪˈmestə/', lv: 'L2', desc: '学期。', ex: '[{"en":"This semester I have five courses.","zh":"这学期我有五门课。"}]' },
    ],
  },
  {
    title: '四级·社会热点',
    shortTitle: '社会热点',
    lvl: 'L2',
    desc: 'CET-4写作和翻译常考话题：环保、科技、文化。掌握四级高频词汇和议论文结构。',
    topics: [
      { t: '环境保护', sceneTitle: '四级·社会热点', p_en: 'Discuss environmental protection and green living.', p_zh: '讨论环境保护和绿色生活。', dur: 55, lvl: 'L2', desc: '四级常考：用英语讨论环保措施和个人责任。', kp: 'CET4 环保 绿色' },
      { t: '科技与生活', sceneTitle: '四级·社会热点', p_en: 'Talk about how technology affects daily life.', p_zh: '谈论科技如何影响日常生活。', dur: 55, lvl: 'L2', desc: '四级常考：讨论科技对生活的利弊影响。', kp: 'CET4 科技 生活' },
    ],
    vocab: [
      { w: 'environment', m: '环境', pos: 'noun', ph: '/ɪnˈvaɪrənmənt/', ph_uk: '/ɪnˈvaɪrənmənt/', lv: 'L2', desc: '自然环境。', ex: '[{"en":"We should protect the environment.","zh":"我们应该保护环境。"}]' },
      { w: 'technology', m: '技术', pos: 'noun', ph: '/tekˈnɑːlədʒi/', ph_uk: '/tekˈnɒlədʒi/', lv: 'L2', desc: '科技。', ex: '[{"en":"Technology has changed our lives.","zh":"科技改变了我们的生活。"}]' },
    ],
  },
], 'L2');

// ===== CET-6 大学英语六级 =====
createPkg('exam-cet-6', '大学英语', [
  {
    title: '六级·社会发展',
    shortTitle: '社会发展',
    lvl: 'L3',
    desc: 'CET-6高频话题：城市化、人口、经济发展。掌握六级核心词汇和深度议论文表达。',
    topics: [
      { t: '城市化进程', sceneTitle: '六级·社会发展', p_en: 'Discuss urbanization and its impact on society.', p_zh: '讨论城市化及其对社会的影响。', dur: 60, lvl: 'L3', desc: '六级常考：用英语分析城市化的利与弊。', kp: 'CET6 城市化 发展' },
      { t: '经济与就业', sceneTitle: '六级·社会发展', p_en: 'Talk about economic development and job market trends.', p_zh: '谈论经济发展和就业市场趋势。', dur: 60, lvl: 'L3', desc: '六级常考：讨论经济变化对就业的影响。', kp: 'CET6 经济 就业' },
    ],
    vocab: [
      { w: 'urbanization', m: '城市化', pos: 'noun', ph: '/ˌɜːrbənɪˈzeɪʃən/', ph_uk: '/ˌɜːbənaɪˈzeɪʃən/', lv: 'L3', desc: '城市化过程。', ex: '[{"en":"Urbanization has accelerated in recent decades.","zh":"近几十年来城市化加速了。"}]' },
      { w: 'employment', m: '就业', pos: 'noun', ph: '/ɪmˈplɔɪmənt/', ph_uk: '/ɪmˈplɔɪmənt/', lv: 'L3', desc: '就业、工作。', ex: '[{"en":"The employment rate has been rising.","zh":"就业率一直在上升。"}]' },
    ],
  },
  {
    title: '六级·文化教育',
    shortTitle: '文化教育',
    lvl: 'L3',
    desc: 'CET-6写作翻译常考：文化交流、教育改革。掌握六级高级词汇和论证技巧。',
    topics: [
      { t: '文化交流', sceneTitle: '六级·文化教育', p_en: 'Discuss cultural exchange and globalization.', p_zh: '讨论文化交流和全球化。', dur: 60, lvl: 'L3', desc: '六级常考：用英语分析文化融合与多样性。', kp: 'CET6 文化 交流' },
      { t: '教育改革', sceneTitle: '六级·文化教育', p_en: 'Talk about education reform and modern teaching methods.', p_zh: '谈论教育改革和现代教学方法。', dur: 60, lvl: 'L3', desc: '六级常考：讨论教育体系改革和创新教学。', kp: 'CET6 教育 改革' },
    ],
    vocab: [
      { w: 'diversity', m: '多样性', pos: 'noun', ph: '/daɪˈvɜːrsəti/', ph_uk: '/daɪˈvɜːsəti/', lv: 'L3', desc: '多样性。', ex: '[{"en":"Cultural diversity enriches our society.","zh":"文化多样性丰富了我们的社会。"}]' },
      { w: 'innovation', m: '创新', pos: 'noun', ph: '/ˌɪnəˈveɪʃən/', ph_uk: '/ˌɪnəˈveɪʃən/', lv: 'L3', desc: '创新、革新。', ex: '[{"en":"Innovation in education is essential.","zh":"教育创新至关重要。"}]' },
    ],
  },
], 'L3');

// ===== TOEFL 托福 =====
createPkg('exam-toefl', '托福', [
  {
    title: '托福·学术讨论',
    shortTitle: '学术讨论',
    lvl: 'L3',
    desc: 'TOEFL Speaking Task 1-2：校园场景、学术讨论。掌握托福口语评分标准和答题框架。',
    topics: [
      { t: '校园学术场景', sceneTitle: '托福·学术讨论', p_en: 'Discuss campus academic scenarios for TOEFL speaking.', p_zh: '讨论托福口语中的校园学术场景。', dur: 60, lvl: 'L3', desc: '托福Task 1-2：应对校园学术相关口语题。', kp: 'TOEFL 学术 校园' },
      { t: '观点表达与论证', sceneTitle: '托福·学术讨论', p_en: 'Express and support your opinion on various topics.', p_zh: '就各种话题表达和支撑你的观点。', dur: 60, lvl: 'L3', desc: '托福Task 3-4：学习观点表达和论证结构。', kp: 'TOEFL 观点 论证' },
    ],
    vocab: [
      { w: 'academic', m: '学术的', pos: 'adj', ph: '/ˌækəˈdemɪk/', ph_uk: '/ˌækəˈdemɪk/', lv: 'L3', desc: '学术的。', ex: '[{"en":"Academic writing requires clear structure.","zh":"学术写作需要清晰的结构。"}]' },
      { w: 'argument', m: '论点', pos: 'noun', ph: '/ˈɑːrɡjumənt/', ph_uk: '/ˈɑːɡjumənt/', lv: 'L3', desc: '论点、论证。', ex: '[{"en":"Develop a strong argument with examples.","zh":"用例子构建有力的论点。"}]' },
    ],
  },
  {
    title: '托福·综合口语',
    shortTitle: '综合口语',
    lvl: 'L3',
    desc: 'TOEFL Speaking Task 3-4：综合阅读、听力与口语。掌握笔记技巧和信息整合表达。',
    topics: [
      { t: '信息整合表达', sceneTitle: '托福·综合口语', p_en: 'Integrate information from reading and listening.', p_zh: '整合阅读和听力中的信息。', dur: 65, lvl: 'L3', desc: '托福Task 3：整合阅读+听力内容进行口语表达。', kp: 'TOEFL 整合 表达' },
      { t: '学术讲座复述', sceneTitle: '托福·综合口语', p_en: 'Summarize an academic lecture in your own words.', p_zh: '用自己的话总结学术讲座。', dur: 65, lvl: 'L3', desc: '托福Task 4：复述学术讲座的核心内容和例证。', kp: 'TOEFL 讲座 复述' },
    ],
    vocab: [
      { w: 'summarize', m: '总结', pos: 'verb', ph: '/ˈsʌməraɪz/', ph_uk: '/ˈsʌməraɪz/', lv: 'L3', desc: '总结、概括。', ex: '[{"en":"Summarize the main points of the lecture.","zh":"总结讲座的要点。"}]' },
      { w: 'integrate', m: '整合', pos: 'verb', ph: '/ˈɪntɪɡreɪt/', ph_uk: '/ˈɪntɪɡreɪt/', lv: 'L3', desc: '整合、融合。', ex: '[{"en":"Integrate information from multiple sources.","zh":"整合来自多个来源的信息。"}]' },
    ],
  },
], 'L3');

console.log('\n=== EXAM PACKAGES DONE ===');
