const fs = require('fs');
const path = require('path');
const base = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

// Add more foundation packages to reach 500+ sentences
const morePkgs = [
  {
    name: 'foundation-daily-work',
    cat: '基础·工作日常100句',
    scenes: [{
      title: '基础·办公室日常',
      lvl: 'L1',
      desc: '学习办公室日常交流的基础表达：问候同事、开会、安排日程。',
      topics: [
        {
          t: '办公室交流', dur: 30, lvl: 'L1', desc: '学习办公室基本交流。', kp: '办公室 交流 同事',
          sceneTitle: '基础·办公室日常',
          chunks: [
            {text:'Good morning, everyone!',meaning:'大家早上好！'},{text:'How was your weekend?',meaning:'你周末过得怎么样？'},{text:'Let\'s start the meeting.',meaning:'我们开始会议吧。'},{text:'I have a question.',meaning:'我有一个问题。'},{text:'What do you think about this?',meaning:'你觉得这个怎么样？'},{text:'I agree with your idea.',meaning:'我同意你的想法。'},{text:'Let me check my schedule.',meaning:'让我查一下我的日程。'},{text:'I\'m available on Monday.',meaning:'我星期一有空。'},{text:'Can we reschedule?',meaning:'我们能改时间吗？'},{text:'I\'ll send you an email.',meaning:'我会发邮件给你。'},{text:'Please review this document.',meaning:'请审阅这份文件。'},{text:'Thank you for your help.',meaning:'谢谢你的帮助。'},{text:'I\'ll finish it by Friday.',meaning:'我会在周五前完成。'},{text:'Let me know if you have questions.',meaning:'有问题请告诉我。'},{text:'Great job on the project!',meaning:'项目做得很好！'},
          ],
          patterns: [
            {pattern:'Let\'s start the ___.',meaning:'我们开始...吧',slots:'meeting, discussion, presentation',example:'Let\'s start the meeting.'},
            {pattern:'I\'m available on ___.',meaning:'我...有空',slots:'Monday, Tuesday, Friday',example:'I\'m available on Monday.'},
          ],
        },
        {
          t: '日程与安排', dur: 30, lvl: 'L1', desc: '学习安排日程的表达。', kp: '日程 安排 计划',
          sceneTitle: '基础·办公室日常',
          chunks: [
            {text:'What time is the meeting?',meaning:'会议几点了？'},{text:'The meeting is at 3 PM.',meaning:'会议在下午3点。'},{text:'Don\'t forget the appointment.',meaning:'别忘了预约。'},{text:'I need to prepare a report.',meaning:'我需要准备一份报告。'},{text:'Can you help me with this?',meaning:'你能帮我这个吗？'},{text:'I\'ll be there on time.',meaning:'我会准时到。'},{text:'Please confirm your attendance.',meaning:'请确认你是否出席。'},{text:'The deadline is next week.',meaning:'截止日期是下周。'},{text:'I need to work overtime today.',meaning:'我今天需要加班。'},{text:'Let me grab a coffee first.',meaning:'让我先喝杯咖啡。'},{text:'I\'ll print the documents.',meaning:'我会打印文件。'},{text:'Please sign here.',meaning:'请在这里签名。'},{text:'I\'ll file the report.',meaning:'我会归档报告。'},{text:'Can I take a day off?',meaning:'我能请一天假吗？'},{text:'Enjoy your lunch break!',meaning:'午餐愉快！'},
          ],
          patterns: [
            {pattern:'I need to ___ a ___.',meaning:'我需要...一份...',slots:'prepare / report, write / document, submit / proposal',example:'I need to prepare a report.'},
            {pattern:'What time is ___?',meaning:'...几点了？',slots:'the meeting, lunch, the appointment',example:'What time is the meeting?'},
          ],
        },
      ],
      vocab: [
        {w:'schedule',m:'日程',pos:'noun',ph:'/ˈskedʒuːl/',ph_uk:'/ˈʃedjuːl/',lv:'L1',desc:'日程安排。',ex:'[{"en":"Check my schedule.","zh":"查一下我的日程。"}]'},
        {w:'deadline',m:'截止日期',pos:'noun',ph:'/ˈdedlaɪn/',ph_uk:'/ˈdedlaɪn/',lv:'L1',desc:'截止日期。',ex:'[{"en":"The deadline is Friday.","zh":"截止日期是周五。"}]'},
        {w:'appointment',m:'预约',pos:'noun',ph:'/əˈpɔɪntmənt/',ph_uk:'/əˈpɔɪntmənt/',lv:'L1',desc:'预约。',ex:'[{"en":"I have a doctor\'s appointment.","zh":"我有个医生的预约。"}]'},
      ],
    }],
  },
  {
    name: 'foundation-weather-nature',
    cat: '基础·天气与自然100句',
    scenes: [{
      title: '基础·天气与季节',
      lvl: 'L1',
      desc: '学习讨论天气、季节和自然现象的基础表达。',
      topics: [
        {
          t: '谈论天气', dur: 25, lvl: 'L1', desc: '学习谈论天气的表达。', kp: '天气 温度 预报',
          sceneTitle: '基础·天气与季节',
          chunks: [
            {text:'What\'s the weather like today?',meaning:'今天天气怎么样？'},{text:'It\'s sunny today.',meaning:'今天是晴天。'},{text:'It\'s raining outside.',meaning:'外面在下雨。'},{text:'It\'s very cold today.',meaning:'今天很冷。'},{text:'It\'s hot and humid.',meaning:'又热又潮湿。'},{text:'It\'s cloudy today.',meaning:'今天是阴天。'},{text:'It\'s snowing heavily.',meaning:'正在下大雪。'},{text:'The temperature is 25 degrees.',meaning:'温度是25度。'},{text:'It\'s windy today.',meaning:'今天有风。'},{text:'Bring an umbrella!',meaning:'带把伞！'},{text:'The weather is nice today.',meaning:'今天天气真好。'},{text:'It\'s getting warmer.',meaning:'天气变暖了。'},{text:'What a beautiful day!',meaning:'多美好的一天！'},{text:'I hope it doesn\'t rain.',meaning:'我希望别下雨。'},{text:'The sun is shining.',meaning:'阳光明媚。'},
          ],
          patterns: [
            {pattern:'What\'s the weather like ___?',meaning:'...天气怎么样？',slots:'today, tomorrow, in summer',example:'What\'s the weather like today?'},
            {pattern:'It\'s ___ today.',meaning:'今天...',slots:'sunny, rainy, cold, hot, cloudy',example:'It\'s sunny today.'},
          ],
        },
        {
          t: '季节与自然', dur: 25, lvl: 'L1', desc: '学习表达季节和自然现象。', kp: '季节 自然 环境',
          sceneTitle: '基础·天气与季节',
          chunks: [
            {text:'My favorite season is spring.',meaning:'我最喜欢的季节是春天。'},{text:'Summer is very hot.',meaning:'夏天很热。'},{text:'Leaves fall in autumn.',meaning:'秋天树叶落下。'},{text:'It snows in winter.',meaning:'冬天会下雪。'},{text:'The flowers are blooming.',meaning:'花开了。'},{text:'Let\'s go for a walk.',meaning:'我们去散步吧。'},{text:'The air is fresh.',meaning:'空气很新鲜。'},{text:'I love the beach!',meaning:'我爱海滩！'},{text:'The stars are beautiful.',meaning:'星星很美。'},{text:'Let\'s enjoy the sunset.',meaning:'我们欣赏日落吧。'},{text:'The mountain is covered with snow.',meaning:'山被雪覆盖了。'},{text:'I like to hike in the forest.',meaning:'我喜欢在森林里徒步。'},{text:'The river is very clean.',meaning:'这条河很干净。'},{text:'Birds are singing.',meaning:'鸟儿在歌唱。'},{text:'What a lovely garden!',meaning:'多可爱的花园！'},
          ],
          patterns: [
            {pattern:'My favorite season is ___.',meaning:'我最喜欢的季节是...',slots:'spring, summer, autumn, winter',example:'My favorite season is spring.'},
            {pattern:'Let\'s go for a ___.',meaning:'我们去...吧',slots:'walk, hike, swim, run',example:'Let\'s go for a walk.'},
          ],
        },
      ],
      vocab: [
        {w:'weather',m:'天气',pos:'noun',ph:'/ˈweðər/',ph_uk:'/ˈweðə/',lv:'L1',desc:'天气。',ex:'[{"en":"The weather is nice.","zh":"天气很好。"}]'},
        {w:'temperature',m:'温度',pos:'noun',ph:'/ˈtemprətʃər/',ph_uk:'/ˈtemprətʃə/',lv:'L1',desc:'温度。',ex:'[{"en":"The temperature is high.","zh":"温度很高。"}]'},
        {w:'season',m:'季节',pos:'noun',ph:'/ˈsiːzən/',ph_uk:'/ˈsiːzən/',lv:'L1',desc:'季节。',ex:'[{"en":"My favorite season is spring.","zh":"我最喜欢的季节是春天。"}]'},
      ],
    }],
  },
];

// Reuse the createFoundationPkg function from gen-foundation.js
// Inline it here
function writeCsv(fp, rows) { fs.writeFileSync(fp, rows.join('\n') + '\n'); }

for (const pkg of morePkgs) {
  const name = pkg.name;
  const cat = pkg.cat;
  const scenes = pkg.scenes;
  const dir = path.join(base, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'ink-scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ink-scripts', '.gitkeep'), '');

  const allTopics = scenes.flatMap(s => s.topics || []);
  const totalVocab = scenes.reduce((sum, s) => sum + ((s.vocab || []).length * (s.topics || []).length), 0);

  const sc = ['category_name,title,location,required_output_level,required_user_level,description,package_type',
    ...scenes.map(s => `基础口语,${s.title},日常场景,${s.lvl || 'L1'},1,${s.desc},foundation`)];
  writeCsv(path.join(dir, 'scenes.csv'), sc);

  const ttHeader = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,ink_script_key';
  writeCsv(path.join(dir, 'training_topics.csv'), [ttHeader,
    ...allTopics.map(t => `"${t.sceneTitle}",${t.t},${t.p_en || 'Practice ' + t.t + ' in English.'},${t.desc}。,${t.dur},${t.lvl || 'L1'},${t.desc},${t.kp},`)]);

  const svHeader = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order';
  let svRows = [], svIdx = 0;
  for (const s of scenes) for (const t of (s.topics || [])) for (const v of (s.vocab || []))
    svRows.push(`"${s.title}",${t.t},${v.w},${v.m},${v.pos},${v.ph},${v.ph_uk},${v.lv || 'L1'},${v.desc},${v.ex},${svIdx++}`);
  writeCsv(path.join(dir, 'scene_vocabulary.csv'), [svHeader, ...svRows]);

  const chHeader = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json';
  writeCsv(path.join(dir, 'chunks.csv'), [chHeader,
    ...scenes.flatMap(s => s.topics.flatMap(t => (t.chunks || []).map(ch =>
      `"${s.title}",${t.t},${t.t},${ch.text},${ch.meaning},${t.lvl || 'L1'},${ch.desc || '日常口语表达。'},""`)))]);

  const spHeader = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order';
  let spRows = [], spIdx = 0;
  for (const s of scenes) for (const t of (s.topics || [])) for (const pat of (t.patterns || []))
    spRows.push(`"${s.title}",${t.t},"${pat.pattern}",${pat.meaning},${pat.slots},${pat.example},${t.lvl || 'L1'},${spIdx++}`);
  writeCsv(path.join(dir, 'sentence_patterns.csv'), [spHeader, ...spRows]);

  const seHeader = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json';
  const seRows = [];
  let seSceneIdx = 0;
  for (const s of scenes) {
    const tops = s.topics || [];
    const chId = `found_${name.replace(/[^a-z0-9]/g, '_')}_${seSceneIdx}`;
    tops.forEach((t, i) => {
      seRows.push(`${chId},${s.title.split('·')[1]},${i+1},${t.t},"${s.title}",${t.lvl||'L1'},1,2,${tops.length*((s.vocab||[]).length)},2,${(t.chunks||[]).length},"[""练习${t.t}相关表达""]",2,2,2,Tutor,口语教练,${i===0&&seSceneIdx===0},,{"xp":10}`);
    });
    seSceneIdx++;
  }
  writeCsv(path.join(dir, 'script_episodes.csv'), [seHeader, ...seRows]);

  const ecHeader = 'episode_chapter,episode_order,chunk_text_match,sort_order';
  const ecRows = [];
  seSceneIdx = 0;
  for (const s of scenes) {
    const tops = s.topics || [];
    const chId = `found_${name.replace(/[^a-z0-9]/g, '_')}_${seSceneIdx}`;
    tops.forEach((t, i) => {
      (t.chunks || []).forEach((ch, ci) => { ecRows.push(`${chId},${i+1},${ch.text},${ci}`); });
    });
    seSceneIdx++;
  }
  writeCsv(path.join(dir, 'episode_chunks.csv'), [ecHeader, ...ecRows]);

  const totalChunks = scenes.reduce((s, sc) => s + sc.topics.reduce((st, t) => st + (t.chunks||[]).length, 0), 0);
  const doc = `# ${cat}\n\n## 学习包概览\n\n> 本学习包是 **基础口语系列** 的重要组成部分。\n\n### 适用对象\n\n- **难度等级**：L1\n- **目标学习者**：英语初学者，需要大量口语输出练习\n\n### 包含场景\n\n${scenes.map(s => `- **${s.title}** — ${s.desc}`).join('\n')}\n\n### 数据规模\n\n| 维度 | 数量 |\n|------|:----:|\n| 场景 | ${scenes.length} |\n| 训练主题 | ${allTopics.length} |\n| 口语例句 | ${totalChunks} |\n\n### 关键词\n\n\`基础口语\` \`日常表达\` \`输出训练\` \`L1\``;
  fs.writeFileSync(path.join(dir, '学习包的功能介绍.md'), doc, 'utf-8');
  console.log(`✅ ${name}: ${scenes.length} scenes, ${allTopics.length} topics, ${totalVocab} vocab, ${totalChunks} chunks`);
}

console.log('\n=== EXTRA PACKAGES DONE ===');
console.log('Total now: 7 foundation packages (5 original + 2 extra)');
