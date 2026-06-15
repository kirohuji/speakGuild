const fs = require('fs');
const path = require('path');
const base = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

function writeCsv(fp, rows) { fs.writeFileSync(fp, rows.join('\n') + '\n'); }

function createFoundationPkg(name, cat, scenes) {
  const dir = path.join(base, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'ink-scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ink-scripts', '.gitkeep'), '');

  const allTopics = scenes.flatMap(s => s.topics || []);
  const totalVocab = scenes.reduce((sum, s) => sum + ((s.vocab || []).length * (s.topics || []).length), 0);

  // 1. scenes.csv
  const sc = [
    'category_name,title,location,required_output_level,required_user_level,description,package_type',
    ...scenes.map(s => `基础口语,${s.title},日常场景,${s.lvl || 'L1'},1,${s.desc},foundation`)
  ];
  writeCsv(path.join(dir, 'scenes.csv'), sc);

  // 2. training_topics.csv
  const ttHeader = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,ink_script_key';
  const ttRows = allTopics.map(t => `"${t.sceneTitle}",${t.t},${t.p_en},${t.p_zh},${t.dur},${t.lvl || 'L1'},${t.desc},${t.kp},`);
  writeCsv(path.join(dir, 'training_topics.csv'), [ttHeader, ...ttRows]);

  // 3. scene_vocabulary.csv
  const svHeader = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order';
  const svRows = [];
  let svIdx = 0;
  for (const s of scenes) {
    for (const t of (s.topics || [])) {
      for (const v of (s.vocab || [])) {
        svRows.push(`"${s.title}",${t.t},${v.w},${v.m},${v.pos},${v.ph},${v.ph_uk},${v.lv || 'L1'},${v.desc},${v.ex},${svIdx++}`);
      }
    }
  }
  writeCsv(path.join(dir, 'scene_vocabulary.csv'), [svHeader, ...svRows]);

  // 4. chunks.csv - RICH content, many sentences!
  const chHeader = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json';
  const chRows = [];
  for (const s of scenes) {
    for (const t of (s.topics || [])) {
      for (const ch of (t.chunks || [])) {
        chRows.push(`"${s.title}",${t.t},${t.t},${ch.text},${ch.meaning},${t.lvl || 'L1'},${ch.desc || '日常口语表达。'},${ch.ex || '""'}`);
      }
    }
  }
  writeCsv(path.join(dir, 'chunks.csv'), [chHeader, ...chRows]);

  // 5. sentence_patterns.csv
  const spHeader = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order';
  const spRows = [];
  let spIdx = 0;
  for (const s of scenes) {
    for (const t of (s.topics || [])) {
      for (const pat of (t.patterns || [])) {
        spRows.push(`"${s.title}",${t.t},"${pat.pattern}",${pat.meaning},${pat.slots},${pat.example},${t.lvl || 'L1'},${spIdx++}`);
      }
    }
  }
  writeCsv(path.join(dir, 'sentence_patterns.csv'), [spHeader, ...spRows]);

  // 6. script_episodes.csv
  const seHeader = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json';
  const seRows = [];
  let seSceneIdx = 0;
  for (const s of scenes) {
    const tops = s.topics || [];
    const chId = `found_${name.replace(/[^a-z0-9]/g, '_')}_${seSceneIdx}`;
    const shortTitle = s.title.split('·')[1] || s.title.replace(/^基础·/, '');
    tops.forEach((t, i) => {
      const obj = `[""练习${t.t}相关表达""]`;
      seRows.push(`${chId},${shortTitle},${i + 1},${t.t},"${s.title}",${t.lvl || 'L1'},1,2,${tops.length * ((s.vocab || []).length)},2,${(t.chunks || []).length},"${obj}",2,2,2,Tutor,口语教练,${i === 0 && seSceneIdx === 0},,{"xp":10}`);
    });
    seSceneIdx++;
  }
  writeCsv(path.join(dir, 'script_episodes.csv'), [seHeader, ...seRows]);

  // 7. episode_chunks.csv
  const ecHeader = 'episode_chapter,episode_order,chunk_text_match,sort_order';
  const ecRows = [];
  seSceneIdx = 0;
  for (const s of scenes) {
    const tops = s.topics || [];
    const chId = `found_${name.replace(/[^a-z0-9]/g, '_')}_${seSceneIdx}`;
    tops.forEach((t, i) => {
      (t.chunks || []).forEach((ch, ci) => {
        ecRows.push(`${chId},${i + 1},${ch.text},${ci}`);
      });
    });
    seSceneIdx++;
  }
  writeCsv(path.join(dir, 'episode_chunks.csv'), [ecHeader, ...ecRows]);

  // 8. 文档
  const totalChunks = scenes.reduce((s, sc) => s + sc.topics.reduce((st, t) => st + (t.chunks || []).length, 0), 0);
  const totalPatterns = scenes.reduce((s, sc) => s + sc.topics.reduce((st, t) => st + (t.patterns || []).length, 0), 0);
  const sceneList = scenes.map(s => `- **${s.title}** — ${s.desc}`).join('\n');
  const topicList = allTopics.map(t => `- ${t.t}（${t.desc}）`).join('\n');
  
  const doc = `# ${cat}

## 学习包概览

> 本学习包是 **基础口语系列** 的核心组成部分，专为英语输出训练设计。

### 适用对象

- **难度等级**：L1（零基础~初级）
- **目标学习者**：英语初学者，需要大量口语输出练习的学习者
- **学习方式**：跟读模仿 → 替换练习 → 自主输出

### 包含场景

${sceneList}

### 训练主题

${topicList}

### 数据规模

| 维度 | 数量 |
|------|:----:|
| 场景 (Scenes) | ${scenes.length} |
| 训练主题 (Topics) | ${allTopics.length} |
| 核心词汇 (Vocabulary) | ${totalVocab} |
| 口语例句 (Chunks) | ${totalChunks} |
| 句型模板 (Patterns) | ${totalPatterns} |
| 学习剧集 (Episodes) | ${allTopics.length} |

### 关键词

\`基础口语\` \`日常表达\` \`输出训练\` \`L1\` \`模仿跟读\`
`;
  fs.writeFileSync(path.join(dir, '学习包的功能介绍.md'), doc, 'utf-8');

  const stats = {
    scenes: scenes.length,
    topics: allTopics.length,
    vocab: totalVocab,
    chunks: scenes.reduce((s, sc) => s + sc.topics.reduce((st, t) => st + (t.chunks || []).length, 0), 0),
    patterns: totalPatterns,
  };
  console.log(`✅ ${name}: ${stats.scenes} scenes, ${stats.topics} topics, ${stats.vocab} vocab, ${stats.chunks} chunks, ${stats.patterns} patterns`);
  return stats;
}

// =============================================
// 1. foundation-daily-life 日常起居100句
// =============================================
const dailyLife = {
  name: 'foundation-daily-life',
  cat: '基础·日常起居100句',
  scenes: [
    {
      title: '基础·起床与洗漱',
      lvl: 'L1',
      desc: '学习从起床到出门的日常表达：闹钟、洗漱、穿衣、早餐。掌握最基础的晨间口语。',
      topics: [
        {
          t: '起床与洗漱', sceneTitle: '基础·起床与洗漱', dur: 30, lvl: 'L1',
          desc: '学习起床到洗漱的常用英语表达。', kp: '起床 洗漱 早晨',
          chunks: [
            { text: 'Time to wake up!', meaning: '该起床了！', desc: '叫醒他人的表达。' },
            { text: 'I\'m still sleepy.', meaning: '我还很困。', desc: '表达困倦。' },
            { text: 'Did you sleep well?', meaning: '你睡得好吗？', desc: '问候睡眠质量。' },
            { text: 'I slept like a baby.', meaning: '我睡得像个婴儿。', desc: '表达睡得好。' },
            { text: 'I need to brush my teeth.', meaning: '我需要刷牙。', desc: '日常洗漱。' },
            { text: 'I need to wash my face.', meaning: '我需要洗脸。', desc: '洗脸。' },
            { text: 'Please turn off the alarm.', meaning: '请关掉闹钟。', desc: '关闹钟。' },
            { text: 'I hit the snooze button.', meaning: '我按了贪睡按钮。', desc: '再睡一会儿。' },
            { text: 'What time did you get up?', meaning: '你几点起床的？', desc: '询问起床时间。' },
            { text: 'I get up at 7 every morning.', meaning: '我每天早上7点起床。', desc: '描述起床时间。' },
            { text: 'I\'m going to take a shower.', meaning: '我去洗个澡。', desc: '洗澡。' },
            { text: 'The water is too hot.', meaning: '水太烫了。', desc: '调节水温。' },
            { text: 'I need to comb my hair.', meaning: '我需要梳头。', desc: '梳头。' },
            { text: 'I\'m almost ready.', meaning: '我快准备好了。', desc: '准备中。' },
            { text: 'Let me put on some clothes.', meaning: '让我穿衣服。', desc: '穿衣。' },
          ],
          patterns: [
            { pattern: 'Time to ___.', meaning: '该...了', slots: 'wake up, get up, go', example: 'Time to wake up!' },
            { pattern: 'I need to ___.', meaning: '我需要...', slots: 'brush my teeth, wash my face, comb my hair', example: 'I need to brush my teeth.' },
            { pattern: 'I ___ at 7 every morning.', meaning: '我每天早上7点...', slots: 'get up, wake up, have breakfast', example: 'I get up at 7 every morning.' },
          ],
        },
        {
          t: '早餐与出门', sceneTitle: '基础·起床与洗漱', dur: 30, lvl: 'L1',
          desc: '学习早餐和出门前的常用表达。', kp: '早餐 出门 准备',
          chunks: [
            { text: 'What\'s for breakfast?', meaning: '早餐吃什么？', desc: '询问早餐。' },
            { text: 'I\'ll have toast and eggs.', meaning: '我吃吐司和鸡蛋。', desc: '点早餐。' },
            { text: 'Please pass the milk.', meaning: '请把牛奶递过来。', desc: '请人递东西。' },
            { text: 'I like my coffee black.', meaning: '我喜欢黑咖啡。', desc: '咖啡偏好。' },
            { text: 'Breakfast is ready!', meaning: '早餐好了！', desc: '通知开饭。' },
            { text: 'I\'m not hungry right now.', meaning: '我现在不饿。', desc: '不饿。' },
            { text: 'Don\'t forget your keys!', meaning: '别忘了你的钥匙！', desc: '提醒带钥匙。' },
            { text: 'I\'m leaving now.', meaning: '我现在出门了。', desc: '出门招呼。' },
            { text: 'Have a nice day!', meaning: '祝你有美好的一天！', desc: '告别祝福。' },
            { text: 'I\'ll be back at 6.', meaning: '我6点回来。', desc: '告知回家时间。' },
            { text: 'Lock the door when you leave.', meaning: '离开时锁门。', desc: '提醒锁门。' },
            { text: 'Did you have breakfast?', meaning: '你吃早餐了吗？', desc: '询问早餐。' },
            { text: 'I\'m in a hurry.', meaning: '我很赶时间。', desc: '匆忙。' },
            { text: 'What should I wear today?', meaning: '我今天该穿什么？', desc: '选择衣服。' },
            { text: 'It looks nice on you!', meaning: '你穿很好看！', desc: '夸奖穿着。' },
          ],
          patterns: [
            { pattern: 'What\'s for ___?', meaning: '...吃什么？', slots: 'breakfast, lunch, dinner', example: 'What\'s for breakfast?' },
            { pattern: 'I\'ll have ___ and ___.', meaning: '我吃...和...', slots: 'toast / eggs, cereal / milk, bread / butter', example: 'I\'ll have toast and eggs.' },
            { pattern: 'Have a nice ___!', meaning: '祝...愉快！', slots: 'day, weekend, trip', example: 'Have a nice day!' },
          ],
        },
      ],
      vocab: [
        { w: 'alarm', m: '闹钟', pos: 'noun', ph: '/əˈlɑːrm/', ph_uk: '/əˈlɑːm/', lv: 'L1', desc: '闹钟。', ex: '[{"en":"I set the alarm for 7.","zh":"我把闹钟设到7点。"}]' },
        { w: 'shower', m: '淋浴', pos: 'noun', ph: '/ˈʃaʊər/', ph_uk: '/ˈʃaʊə/', lv: 'L1', desc: '淋浴。', ex: '[{"en":"I take a shower every morning.","zh":"我每天早上淋浴。"}]' },
        { w: 'breakfast', m: '早餐', pos: 'noun', ph: '/ˈbrekfəst/', ph_uk: '/ˈbrekfəst/', lv: 'L1', desc: '早餐。', ex: '[{"en":"I had breakfast at 8.","zh":"我8点吃了早餐。"}]' },
        { w: 'hurry', m: '匆忙', pos: 'noun', ph: '/ˈhɜːri/', ph_uk: '/ˈhʌri/', lv: 'L1', desc: '匆忙。', ex: '[{"en":"I\'m in a hurry.","zh":"我很匆忙。"}]' },
      ],
    },
    {
      title: '基础·家务与居家',
      lvl: 'L1',
      desc: '学习家务劳动和居家生活的常用英语：打扫、洗衣、整理、休息。',
      topics: [
        {
          t: '家务劳动', sceneTitle: '基础·家务与居家', dur: 35, lvl: 'L1',
          desc: '学习做家务的常用表达。', kp: '家务 打扫 整理',
          chunks: [
            { text: 'I need to clean the room.', meaning: '我需要打扫房间。' },
            { text: 'Could you help me with the dishes?', meaning: '你能帮我洗碗吗？' },
            { text: 'I\'ll do the laundry today.', meaning: '我今天洗衣服。' },
            { text: 'Please sweep the floor.', meaning: '请扫地。' },
            { text: 'I need to mop the floor.', meaning: '我需要拖地。' },
            { text: 'The trash is full.', meaning: '垃圾满了。' },
            { text: 'Please take out the trash.', meaning: '请把垃圾拿出去。' },
            { text: 'I\'ll make the bed.', meaning: '我来铺床。' },
            { text: 'Please fold the clothes.', meaning: '请叠衣服。' },
            { text: 'The room is so messy!', meaning: '房间太乱了！' },
            { text: 'Let\'s tidy up the living room.', meaning: '我们来整理客厅吧。' },
            { text: 'I need to vacuum the carpet.', meaning: '我需要用吸尘器吸地毯。' },
            { text: 'Can you water the plants?', meaning: '你能给植物浇水吗？' },
            { text: 'I\'ll wash the dishes.', meaning: '我来洗碗。' },
            { text: 'Please put things back in place.', meaning: '请把东西放回原位。' },
          ],
          patterns: [
            { pattern: 'I need to ___ the ___.', meaning: '我需要...', slots: 'clean / room, wash / dishes, sweep / floor', example: 'I need to clean the room.' },
            { pattern: 'Please ___ the ___.', meaning: '请...', slots: 'take out / trash, fold / clothes, water / plants', example: 'Please take out the trash.' },
          ],
        },
        {
          t: '居家休息', sceneTitle: '基础·家务与居家', dur: 30, lvl: 'L1',
          desc: '学习在家休息放松的表达。', kp: '休息 放松 居家',
          chunks: [
            { text: 'I\'m just relaxing at home.', meaning: '我就在家放松。' },
            { text: 'Let\'s watch a movie.', meaning: '我们看电影吧。' },
            { text: 'I like to read books.', meaning: '我喜欢看书。' },
            { text: 'What TV show are you watching?', meaning: '你在看什么电视节目？' },
            { text: 'This is my favorite show.', meaning: '这是我最喜欢的节目。' },
            { text: 'I\'m going to take a nap.', meaning: '我去小睡一会儿。' },
            { text: 'I feel very tired.', meaning: '我觉得很累。' },
            { text: 'Let\'s order takeout.', meaning: '我们点外卖吧。' },
            { text: 'I\'ll cook dinner tonight.', meaning: '今晚我做饭。' },
            { text: 'What do you want to eat?', meaning: '你想吃什么？' },
            { text: 'The food smells great!', meaning: '食物闻起来真香！' },
            { text: 'I need a break.', meaning: '我需要休息一下。' },
            { text: 'Let\'s listen to some music.', meaning: '我们听点音乐吧。' },
            { text: 'I\'ll play some video games.', meaning: '我玩会儿游戏。' },
            { text: 'It\'s time to go to bed.', meaning: '该睡觉了。' },
          ],
          patterns: [
            { pattern: 'Let\'s ___ a ___.', meaning: '我们...吧', slots: 'watch / movie, listen to / song, play / game', example: 'Let\'s watch a movie.' },
            { pattern: 'I\'m going to ___.', meaning: '我去...', slots: 'take a nap, cook dinner, read a book', example: 'I\'m going to take a nap.' },
          ],
        },
      ],
      vocab: [
        { w: 'laundry', m: '洗衣', pos: 'noun', ph: '/ˈlɔːndri/', ph_uk: '/ˈlɔːndri/', lv: 'L1', desc: '要洗的衣服。', ex: '[{"en":"I need to do the laundry.","zh":"我需要洗衣服。"}]' },
        { w: 'tidy', m: '整理', pos: 'verb', ph: '/ˈtaɪdi/', ph_uk: '/ˈtaɪdi/', lv: 'L1', desc: '整理、收拾。', ex: '[{"en":"Please tidy your room.","zh":"请整理你的房间。"}]' },
        { w: 'trash', m: '垃圾', pos: 'noun', ph: '/træʃ/', ph_uk: '/træʃ/', lv: 'L1', desc: '垃圾。', ex: '[{"en":"Take out the trash.","zh":"把垃圾拿出去。"}]' },
      ],
    },
  ],
};

// =============================================
// 2. foundation-social-express 社交表达100句
// =============================================
const socialExpress = {
  name: 'foundation-social-express',
  cat: '基础·社交表达100句',
  scenes: [
    {
      title: '基础·问候与介绍',
      lvl: 'L1',
      desc: '学习见面问候、自我介绍和介绍他人的基本表达，掌握社交第一步。',
      topics: [
        {
          t: '见面问候', sceneTitle: '基础·问候与介绍', dur: 30, lvl: 'L1',
          desc: '学习各种见面问候语。', kp: '问候 打招呼 礼貌',
          chunks: [
            { text: 'Hello! How are you?', meaning: '你好！你好吗？' },
            { text: 'Hi! Long time no see.', meaning: '嗨！好久不见。' },
            { text: 'Nice to meet you!', meaning: '很高兴认识你！' },
            { text: 'How\'s it going?', meaning: '最近怎么样？' },
            { text: 'Pretty good, thanks!', meaning: '挺好的，谢谢！' },
            { text: 'What have you been up to?', meaning: '你最近在忙什么？' },
            { text: 'Good morning!', meaning: '早上好！' },
            { text: 'Good afternoon!', meaning: '下午好！' },
            { text: 'Good evening!', meaning: '晚上好！' },
            { text: 'It\'s been a while!', meaning: '有一阵子不见了！' },
            { text: 'How have you been?', meaning: '你最近怎么样？' },
            { text: 'I\'m doing great!', meaning: '我很好！' },
            { text: 'Not bad, how about you?', meaning: '还不错，你呢？' },
            { text: 'Same as always.', meaning: '老样子。' },
            { text: 'Glad to see you again!', meaning: '很高兴再次见到你！' },
          ],
          patterns: [
            { pattern: 'How ___ you?', meaning: '你...怎么样？', slots: 'are, have, were', example: 'How are you?' },
            { pattern: 'Nice to ___ you!', meaning: '很高兴...你！', slots: 'meet, see', example: 'Nice to meet you!' },
          ],
        },
        {
          t: '自我介绍', sceneTitle: '基础·问候与介绍', dur: 35, lvl: 'L1',
          desc: '学习自我介绍的基本表达。', kp: '介绍 姓名 来自',
          chunks: [
            { text: 'My name is...', meaning: '我的名字是...' },
            { text: 'I\'m from China.', meaning: '我来自中国。' },
            { text: 'I live in Beijing.', meaning: '我住在北京。' },
            { text: 'I\'m a student.', meaning: '我是一个学生。' },
            { text: 'I work as a teacher.', meaning: '我是一名老师。' },
            { text: 'I\'m 25 years old.', meaning: '我25岁。' },
            { text: 'I have two brothers.', meaning: '我有两个兄弟。' },
            { text: 'This is my friend, Tom.', meaning: '这是我的朋友汤姆。' },
            { text: 'We\'re classmates.', meaning: '我们是同学。' },
            { text: 'I\'m from a small town.', meaning: '我来自一个小镇。' },
            { text: 'I study at university.', meaning: '我在大学学习。' },
            { text: 'My major is English.', meaning: '我的专业是英语。' },
            { text: 'I like traveling and reading.', meaning: '我喜欢旅行和阅读。' },
            { text: 'I\'m here on vacation.', meaning: '我来这里度假。' },
            { text: 'I\'m happy to be here.', meaning: '我很高兴来到这里。' },
          ],
          patterns: [
            { pattern: 'I\'m from ___.', meaning: '我来自...', slots: 'China, Beijing, a small town', example: 'I\'m from China.' },
            { pattern: 'I like ___ and ___.', meaning: '我喜欢...和...', slots: 'traveling / reading, singing / dancing, sports / music', example: 'I like traveling and reading.' },
          ],
        },
      ],
      vocab: [
        { w: 'introduce', m: '介绍', pos: 'verb', ph: '/ˌɪntrəˈduːs/', ph_uk: '/ˌɪntrəˈdjuːs/', lv: 'L1', desc: '介绍。', ex: '[{"en":"Let me introduce myself.","zh":"让我自我介绍。"}]' },
        { w: 'classmate', m: '同学', pos: 'noun', ph: '/ˈklæsmeɪt/', ph_uk: '/ˈklɑːsmeɪt/', lv: 'L1', desc: '同班同学。', ex: '[{"en":"She is my classmate.","zh":"她是我的同学。"}]' },
        { w: 'vacation', m: '假期', pos: 'noun', ph: '/veɪˈkeɪʃən/', ph_uk: '/vəˈkeɪʃən/', lv: 'L1', desc: '假期、休假。', ex: '[{"en":"I\'m on vacation.","zh":"我在度假。"}]' },
      ],
    },
    {
      title: '基础·礼貌与请求',
      lvl: 'L1',
      desc: '学习礼貌用语和日常请求表达，让交流更加得体和顺畅。',
      topics: [
        {
          t: '礼貌用语', sceneTitle: '基础·礼貌与请求', dur: 30, lvl: 'L1',
          desc: '学习最基本的礼貌用语。', kp: '礼貌 感谢 道歉',
          chunks: [
            { text: 'Thank you very much!', meaning: '非常感谢！' },
            { text: 'You\'re welcome.', meaning: '不客气。' },
            { text: 'I\'m sorry.', meaning: '对不起。' },
            { text: 'That\'s okay.', meaning: '没关系。' },
            { text: 'Excuse me.', meaning: '打扰一下/对不起。' },
            { text: 'No problem!', meaning: '没问题！' },
            { text: 'I appreciate your help.', meaning: '我很感谢你的帮助。' },
            { text: 'Thanks for your time.', meaning: '谢谢你的时间。' },
            { text: 'Sorry to bother you.', meaning: '抱歉打扰你。' },
            { text: 'That\'s very kind of you!', meaning: '你太好了！' },
            { text: 'Please.', meaning: '请。' },
            { text: 'After you.', meaning: '您先请。' },
            { text: 'Bless you! (after sneeze)', meaning: '保佑你！(打喷嚏后)' },
            { text: 'My apologies.', meaning: '我的歉意。' },
            { text: 'Don\'t worry about it.', meaning: '别担心。' },
          ],
          patterns: [
            { pattern: 'Thank you for ___.', meaning: '谢谢你的...', slots: 'your help, your time, your kindness', example: 'Thank you for your help.' },
            { pattern: 'Sorry to ___.', meaning: '抱歉...', slots: 'bother you, interrupt, be late', example: 'Sorry to bother you.' },
          ],
        },
        {
          t: '请求与帮助', sceneTitle: '基础·礼貌与请求', dur: 35, lvl: 'L1',
          desc: '学习请求帮助和提供帮助的表达。', kp: '请求 帮助 允许',
          chunks: [
            { text: 'Can you help me?', meaning: '你能帮我吗？' },
            { text: 'Could you please open the door?', meaning: '你能开门吗？' },
            { text: 'May I come in?', meaning: '我可以进来吗？' },
            { text: 'Would you mind helping me?', meaning: '你介意帮我吗？' },
            { text: 'Is it okay if I sit here?', meaning: '我可以坐这里吗？' },
            { text: 'Can I borrow your pen?', meaning: '我能借你的笔吗？' },
            { text: 'Could you speak more slowly?', meaning: '你能说慢一点吗？' },
            { text: 'Do you need a hand?', meaning: '你需要帮忙吗？' },
            { text: 'Let me help you!', meaning: '让我帮你！' },
            { text: 'Can I get you something?', meaning: '要我帮你拿点什么吗？' },
            { text: 'Would you like some water?', meaning: '你想要点水吗？' },
            { text: 'Please come in.', meaning: '请进。' },
            { text: 'Take a seat, please.', meaning: '请坐。' },
            { text: 'Make yourself at home.', meaning: '别客气，像在自己家一样。' },
            { text: 'Let me know if you need anything.', meaning: '如果你需要什么告诉我。' },
          ],
          patterns: [
            { pattern: 'Can you ___?', meaning: '你能...吗？', slots: 'help me, open the door, come here', example: 'Can you help me?' },
            { pattern: 'Would you like ___?', meaning: '你想要...吗？', slots: 'some water, some tea, a break', example: 'Would you like some water?' },
          ],
        },
      ],
      vocab: [
        { w: 'welcome', m: '欢迎', pos: 'adj', ph: '/ˈwelkəm/', ph_uk: '/ˈwelkəm/', lv: 'L1', desc: '受欢迎的。', ex: '[{"en":"You\'re welcome.","zh":"不客气。"}]' },
        { w: 'appreciate', m: '感激', pos: 'verb', ph: '/əˈpriːʃieɪt/', ph_uk: '/əˈpriːʃieɪt/', lv: 'L2', desc: '感激、感谢。', ex: '[{"en":"I appreciate it.","zh":"我很感激。"}]' },
        { w: 'borrow', m: '借', pos: 'verb', ph: '/ˈbɑːroʊ/', ph_uk: '/ˈbɒrəʊ/', lv: 'L1', desc: '借入。', ex: '[{"en":"Can I borrow your pen?","zh":"我可以借你的笔吗？"}]' },
      ],
    },
  ],
};

// =============================================
// 3. foundation-travel-basic 旅行基础100句
// =============================================
const travelBasic = {
  name: 'foundation-travel-basic',
  cat: '基础·旅行基础100句',
  scenes: [
    {
      title: '基础·问路与交通',
      lvl: 'L1',
      desc: '学习在外国问路和乘坐交通工具的基础表达。',
      topics: [
        {
          t: '问路指路', sceneTitle: '基础·问路与交通', dur: 35, lvl: 'L1',
          desc: '学习问路和指路的基本表达。', kp: '问路 方向 指路',
          chunks: [
            { text: 'Excuse me, where is the station?', meaning: '打扰一下，车站在哪里？' },
            { text: 'How do I get to the museum?', meaning: '我怎么去博物馆？' },
            { text: 'Is it far from here?', meaning: '离这里远吗？' },
            { text: 'Go straight ahead.', meaning: '一直往前走。' },
            { text: 'Turn left at the corner.', meaning: '在拐角左转。' },
            { text: 'Turn right at the traffic lights.', meaning: '在红绿灯右转。' },
            { text: 'It\'s next to the bank.', meaning: '在银行旁边。' },
            { text: 'It\'s across from the park.', meaning: '在公园对面。' },
            { text: 'It\'s on your left.', meaning: '在你的左边。' },
            { text: 'Walk for about 5 minutes.', meaning: '走大约5分钟。' },
            { text: 'You can take the bus.', meaning: '你可以坐公交车。' },
            { text: 'It\'s about 2 blocks away.', meaning: '大约两个街区远。' },
            { text: 'I\'m lost. Can you help me?', meaning: '我迷路了。你能帮我吗？' },
            { text: 'Is there a toilet near here?', meaning: '这附近有厕所吗？' },
            { text: 'I\'m looking for this address.', meaning: '我在找这个地址。' },
          ],
          patterns: [
            { pattern: 'Where is the ___?', meaning: '...在哪里？', slots: 'station, museum, toilet, bank', example: 'Where is the station?' },
            { pattern: 'How do I get to ___?', meaning: '我怎么去...？', slots: 'the museum, the station, the airport', example: 'How do I get to the museum?' },
          ],
        },
        {
          t: '乘坐交通', sceneTitle: '基础·问路与交通', dur: 35, lvl: 'L1',
          desc: '学习乘坐公交地铁出租车的表达。', kp: '公交 地铁 出租车',
          chunks: [
            { text: 'Which bus goes to the airport?', meaning: '哪路公交车去机场？' },
            { text: 'How much is the fare?', meaning: '车费多少钱？' },
            { text: 'Please take me to this address.', meaning: '请带我去这个地址。' },
            { text: 'Where is the nearest subway station?', meaning: '最近的地铁站在哪里？' },
            { text: 'Which line goes to the city center?', meaning: '哪条线去市中心？' },
            { text: 'How many stops to the hotel?', meaning: '到酒店有几站？' },
            { text: 'Please stop here.', meaning: '请在这里停。' },
            { text: 'Can I have a ticket to London?', meaning: '我能买一张去伦敦的票吗？' },
            { text: 'How long does it take?', meaning: '需要多长时间？' },
            { text: 'The train is delayed.', meaning: '火车晚点了。' },
            { text: 'Which platform does the train leave from?', meaning: '火车从哪个站台出发？' },
            { text: 'I need to buy a ticket.', meaning: '我需要买票。' },
            { text: 'One-way or round-trip?', meaning: '单程还是往返？' },
            { text: 'Do I need to transfer?', meaning: '我需要换乘吗？' },
            { text: 'Please call a taxi for me.', meaning: '请帮我叫一辆出租车。' },
          ],
          patterns: [
            { pattern: 'How much is ___?', meaning: '...多少钱？', slots: 'the fare, a ticket, this', example: 'How much is the fare?' },
            { pattern: 'How long does ___ take?', meaning: '...需要多长时间？', slots: 'it, the trip, the journey', example: 'How long does it take?' },
          ],
        },
      ],
      vocab: [
        { w: 'station', m: '车站', pos: 'noun', ph: '/ˈsteɪʃən/', ph_uk: '/ˈsteɪʃən/', lv: 'L1', desc: '火车站/地铁站。', ex: '[{"en":"Where is the train station?","zh":"火车站在哪里？"}]' },
        { w: 'ticket', m: '票', pos: 'noun', ph: '/ˈtɪkɪt/', ph_uk: '/ˈtɪkɪt/', lv: 'L1', desc: '车票、门票。', ex: '[{"en":"I need a ticket.","zh":"我需要一张票。"}]' },
        { w: 'transfer', m: '换乘', pos: 'verb', ph: '/trænsˈfɜːr/', ph_uk: '/trænsˈfɜː/', lv: 'L1', desc: '换乘。', ex: '[{"en":"You need to transfer at the next stop.","zh":"你需要在下一站换乘。"}]' },
      ],
    },
    {
      title: '基础·餐厅与购物',
      lvl: 'L1',
      desc: '学习在餐厅点餐和商店购物的基础表达。',
      topics: [
        {
          t: '餐厅点餐', sceneTitle: '基础·餐厅与购物', dur: 35, lvl: 'L1',
          desc: '学习在餐厅点餐的常用表达。', kp: '餐厅 点餐 买单',
          chunks: [
            { text: 'A table for two, please.', meaning: '请给我两人桌。' },
            { text: 'I\'d like to order now.', meaning: '我想现在点餐。' },
            { text: 'What would you recommend?', meaning: '你推荐什么？' },
            { text: 'I\'ll have the steak.', meaning: '我要牛排。' },
            { text: 'Could I have the menu?', meaning: '能给我菜单吗？' },
            { text: 'What\'s today\'s special?', meaning: '今天的特色菜是什么？' },
            { text: 'I\'m allergic to nuts.', meaning: '我对坚果过敏。' },
            { text: 'This is not what I ordered.', meaning: '这不是我点的。' },
            { text: 'The food is delicious!', meaning: '食物很美味！' },
            { text: 'Could I have the check, please?', meaning: '请给我账单。' },
            { text: 'Keep the change.', meaning: '不用找零了。' },
            { text: 'Can I pay by card?', meaning: '我可以用卡支付吗？' },
            { text: 'I\'d like a glass of water.', meaning: '我想要一杯水。' },
            { text: 'Is service charge included?', meaning: '服务费包括在内吗？' },
            { text: 'We\'d like to split the bill.', meaning: '我们想AA制。' },
          ],
          patterns: [
            { pattern: 'I\'d like to ___.', meaning: '我想要...', slots: 'order, pay, have the steak', example: 'I\'d like to order.' },
            { pattern: 'Could I have ___?', meaning: '能给我...吗？', slots: 'the menu, the check, a glass of water', example: 'Could I have the menu?' },
          ],
        },
        {
          t: '购物逛街', sceneTitle: '基础·餐厅与购物', dur: 35, lvl: 'L1',
          desc: '学习购物时的常用表达。', kp: '购物 价格 试穿',
          chunks: [
            { text: 'How much is this?', meaning: '这个多少钱？' },
            { text: 'Is there a discount?', meaning: '有折扣吗？' },
            { text: 'Can I try this on?', meaning: '我能试穿这个吗？' },
            { text: 'Where is the fitting room?', meaning: '试衣间在哪里？' },
            { text: 'Do you have this in a smaller size?', meaning: '这个有小号吗？' },
            { text: 'I\'m just looking, thanks.', meaning: '我只是看看，谢谢。' },
            { text: 'I\'ll take it.', meaning: '我买了。' },
            { text: 'Do you accept credit cards?', meaning: '你们接受信用卡吗？' },
            { text: 'Can I get a receipt?', meaning: '能给我收据吗？' },
            { text: 'I\'d like to return this.', meaning: '我想退这个。' },
            { text: 'It doesn\'t fit me.', meaning: '这个不适合我。' },
            { text: 'Is this on sale?', meaning: '这个在打折吗？' },
            { text: 'Do you have this in other colors?', meaning: '这个有其他颜色吗？' },
            { text: 'That\'s too expensive.', meaning: '太贵了。' },
            { text: 'I\'m looking for a gift.', meaning: '我在找礼物。' },
          ],
          patterns: [
            { pattern: 'How much is ___?', meaning: '...多少钱？', slots: 'this, that, it', example: 'How much is this?' },
            { pattern: 'Do you have this in ___?', meaning: '这个有...吗？', slots: 'a smaller size, other colors, a larger size', example: 'Do you have this in a smaller size?' },
          ],
        },
      ],
      vocab: [
        { w: 'menu', m: '菜单', pos: 'noun', ph: '/ˈmenjuː/', ph_uk: '/ˈmenjuː/', lv: 'L1', desc: '菜单。', ex: '[{"en":"Can I see the menu?","zh":"我能看看菜单吗？"}]' },
        { w: 'discount', m: '折扣', pos: 'noun', ph: '/ˈdɪskaʊnt/', ph_uk: '/ˈdɪskaʊnt/', lv: 'L1', desc: '折扣。', ex: '[{"en":"Is there any discount?","zh":"有折扣吗？"}]' },
        { w: 'receipt', m: '收据', pos: 'noun', ph: '/rɪˈsiːt/', ph_uk: '/rɪˈsiːt/', lv: 'L1', desc: '收据、小票。', ex: '[{"en":"Please give me a receipt.","zh":"请给我一张收据。"}]' },
      ],
    },
  ],
};

// =============================================
// 4. foundation-opinion-basics 观点表达100句
// =============================================
const opinionBasics = {
  name: 'foundation-opinion-basics',
  cat: '基础·观点表达100句',
  scenes: [
    {
      title: '基础·喜好与感受',
      lvl: 'L1',
      desc: '学习表达喜欢、不喜欢、感受和情绪的基本句型。',
      topics: [
        {
          t: '表达喜好', sceneTitle: '基础·喜好与感受', dur: 30, lvl: 'L1',
          desc: '学习表达喜欢和不喜欢的表达。', kp: '喜好 喜欢 不喜欢',
          chunks: [
            { text: 'I like this very much.', meaning: '我非常喜欢这个。' },
            { text: 'I love playing basketball.', meaning: '我爱打篮球。' },
            { text: 'I enjoy reading books.', meaning: '我喜欢读书。' },
            { text: 'I\'m interested in music.', meaning: '我对音乐感兴趣。' },
            { text: 'I don\'t like coffee.', meaning: '我不喜欢咖啡。' },
            { text: 'I hate being late.', meaning: '我讨厌迟到。' },
            { text: 'I prefer tea over coffee.', meaning: '比起咖啡我更喜欢茶。' },
            { text: 'My favorite food is pizza.', meaning: '我最喜欢的食物是披萨。' },
            { text: 'I\'m crazy about dogs.', meaning: '我超级喜欢狗。' },
            { text: 'I can\'t stand the noise.', meaning: '我受不了噪音。' },
            { text: 'It\'s okay, I guess.', meaning: '还行吧，我想。' },
            { text: 'I don\'t mind waiting.', meaning: '我不介意等待。' },
            { text: 'I feel happy when I sing.', meaning: '我唱歌时感到快乐。' },
            { text: 'This is amazing!', meaning: '这太棒了！' },
            { text: 'That\'s terrible!', meaning: '太糟糕了！' },
          ],
          patterns: [
            { pattern: 'I like ___ very much.', meaning: '我非常喜欢...', slots: 'this, music, sports', example: 'I like this very much.' },
            { pattern: 'I prefer ___ over ___.', meaning: '比起...我更喜欢...', slots: 'tea / coffee, cats / dogs, summer / winter', example: 'I prefer tea over coffee.' },
          ],
        },
        {
          t: '表达感受', sceneTitle: '基础·喜好与感受', dur: 30, lvl: 'L1',
          desc: '学习表达各种感受和情绪。', kp: '感受 情绪 状态',
          chunks: [
            { text: 'I feel great today!', meaning: '我今天感觉很好！' },
            { text: 'I\'m so happy!', meaning: '我很开心！' },
            { text: 'I\'m tired after work.', meaning: '我下班后很累。' },
            { text: 'I feel bored.', meaning: '我觉得无聊。' },
            { text: 'I\'m excited about the trip!', meaning: '我对这次旅行很兴奋！' },
            { text: 'I\'m worried about the exam.', meaning: '我担心考试。' },
            { text: 'That makes me sad.', meaning: '那让我难过。' },
            { text: 'I\'m surprised to see you!', meaning: '我很惊讶见到你！' },
            { text: 'I feel nervous.', meaning: '我感到紧张。' },
            { text: 'I\'m really angry!', meaning: '我真的很生气！' },
            { text: 'Take it easy.', meaning: '放轻松。' },
            { text: 'Don\'t worry, be happy!', meaning: '别担心，开心点！' },
            { text: 'I feel much better now.', meaning: '我现在感觉好多了。' },
            { text: 'That\'s wonderful news!', meaning: '真是好消息！' },
            { text: 'I\'m proud of you!', meaning: '我为你骄傲！' },
          ],
          patterns: [
            { pattern: 'I feel ___.', meaning: '我感觉...', slots: 'great, tired, happy, bored', example: 'I feel great today!' },
            { pattern: 'I\'m ___ about ___.', meaning: '我对...感到...', slots: 'excited / the trip, worried / the exam, happy / the news', example: 'I\'m excited about the trip!' },
          ],
        },
      ],
      vocab: [
        { w: 'favorite', m: '最喜欢的', pos: 'adj', ph: '/ˈfeɪvərɪt/', ph_uk: '/ˈfeɪvərɪt/', lv: 'L1', desc: '最喜欢的。', ex: '[{"en":"This is my favorite song.","zh":"这是我最喜欢的歌。"}]' },
        { w: 'excited', m: '兴奋的', pos: 'adj', ph: '/ɪkˈsaɪtɪd/', ph_uk: '/ɪkˈsaɪtɪd/', lv: 'L1', desc: '兴奋的。', ex: '[{"en":"I\'m so excited!","zh":"我好兴奋！"}]' },
        { w: 'nervous', m: '紧张的', pos: 'adj', ph: '/ˈnɜːrvəs/', ph_uk: '/ˈnɜːvəs/', lv: 'L1', desc: '紧张的。', ex: '[{"en":"I feel nervous.","zh":"我感到紧张。"}]' },
      ],
    },
    {
      title: '基础·简单观点',
      lvl: 'L1',
      desc: '学习表达简单观点、同意不同意的表达。',
      topics: [
        {
          t: '同意与不同意', sceneTitle: '基础·简单观点', dur: 30, lvl: 'L1',
          desc: '学习表达同意和不同意。', kp: '同意 不同意 观点',
          chunks: [
            { text: 'I think so too.', meaning: '我也这么认为。' },
            { text: 'I agree with you.', meaning: '我同意你。' },
            { text: 'That\'s a good idea!', meaning: '好主意！' },
            { text: 'You\'re right.', meaning: '你是对的。' },
            { text: 'I don\'t think so.', meaning: '我不这么认为。' },
            { text: 'I\'m not sure about that.', meaning: '我不太确定。' },
            { text: 'That\'s true.', meaning: '那是真的。' },
            { text: 'I disagree.', meaning: '我不同意。' },
            { text: 'In my opinion...', meaning: '在我看来...' },
            { text: 'From my point of view...', meaning: '从我的角度来看...' },
            { text: 'I believe that\'s correct.', meaning: '我相信那是正确的。' },
            { text: 'That makes sense.', meaning: '有道理。' },
            { text: 'I see what you mean.', meaning: '我明白你的意思。' },
            { text: 'Not exactly.', meaning: '不完全是。' },
            { text: 'Let\'s agree to disagree.', meaning: '我们求同存异吧。' },
          ],
          patterns: [
            { pattern: 'I think ___.', meaning: '我认为...', slots: 'so, not, you\'re right', example: 'I think so.' },
            { pattern: 'I agree with ___.', meaning: '我同意...', slots: 'you, that, your opinion', example: 'I agree with you.' },
          ],
        },
        {
          t: '提建议', sceneTitle: '基础·简单观点', dur: 30, lvl: 'L1',
          desc: '学习提建议和回应的表达。', kp: '建议 提议 回应',
          chunks: [
            { text: 'Let\'s go to the park.', meaning: '我们去公园吧。' },
            { text: 'How about having coffee?', meaning: '喝杯咖啡怎么样？' },
            { text: 'What do you think?', meaning: '你觉得怎么样？' },
            { text: 'Why don\'t we go together?', meaning: '我们为什么不一起去呢？' },
            { text: 'Do you want to join us?', meaning: '你想加入我们吗？' },
            { text: 'That sounds great!', meaning: '听起来很棒！' },
            { text: 'I\'d love to!', meaning: '我很乐意！' },
            { text: 'Maybe next time.', meaning: '也许下次吧。' },
            { text: 'Count me in!', meaning: '算我一个！' },
            { text: 'I\'m afraid I can\'t.', meaning: '恐怕我不能。' },
            { text: 'Let me think about it.', meaning: '让我想想。' },
            { text: 'Good idea!', meaning: '好主意！' },
            { text: 'I\'d rather not.', meaning: '我宁愿不要。' },
            { text: 'It\'s up to you.', meaning: '由你决定。' },
            { text: 'Whatever you think is fine.', meaning: '你觉得怎么好都行。' },
          ],
          patterns: [
            { pattern: 'How about ___?', meaning: '...怎么样？', slots: 'having coffee, going out, taking a break', example: 'How about having coffee?' },
            { pattern: 'Why don\'t we ___?', meaning: '我们为什么不...？', slots: 'go together, try it, start now', example: 'Why don\'t we go together?' },
          ],
        },
      ],
      vocab: [
        { w: 'opinion', m: '观点', pos: 'noun', ph: '/əˈpɪnjən/', ph_uk: '/əˈpɪnjən/', lv: 'L1', desc: '观点、看法。', ex: '[{"en":"In my opinion, it\'s good.","zh":"在我看来这很好。"}]' },
        { w: 'agree', m: '同意', pos: 'verb', ph: '/əˈɡriː/', ph_uk: '/əˈɡriː/', lv: 'L1', desc: '同意。', ex: '[{"en":"I agree with you.","zh":"我同意你。"}]' },
        { w: 'suggestion', m: '建议', pos: 'noun', ph: '/səɡˈdʒestʃən/', ph_uk: '/səˈdʒestʃən/', lv: 'L1', desc: '建议。', ex: '[{"en":"That\'s a good suggestion.","zh":"这是个好建议。"}]' },
      ],
    },
  ],
};

// =============================================
// 5. foundation-essential-phrases 高频短语100句
// =============================================
const essentialPhrases = {
  name: 'foundation-essential-phrases',
  cat: '基础·高频短语100句',
  scenes: [
    {
      title: '基础·日常高频短语',
      lvl: 'L1',
      desc: '学习英语中最常用的高频短语和固定搭配，覆盖日常交流的方方面面。',
      topics: [
        {
          t: '常用动词短语', sceneTitle: '基础·日常高频短语', dur: 30, lvl: 'L1',
          desc: '学习最常用的动词短语搭配。', kp: '动词短语 搭配 常用',
          chunks: [
            { text: 'I get up at 7.', meaning: '我7点起床。' },
            { text: 'Please sit down.', meaning: '请坐下。' },
            { text: 'I\'m looking for my keys.', meaning: '我在找我的钥匙。' },
            { text: 'Can you pick me up?', meaning: '你能来接我吗？' },
            { text: 'Let\'s turn on the TV.', meaning: '我们打开电视吧。' },
            { text: 'Please turn off the lights.', meaning: '请关灯。' },
            { text: 'I need to find out.', meaning: '我需要弄清楚。' },
            { text: 'Don\'t give up!', meaning: '不要放弃！' },
            { text: 'Calm down, please.', meaning: '请冷静。' },
            { text: 'I\'ll call you back.', meaning: '我会回电话给你。' },
            { text: 'Come over to my place.', meaning: '来我家吧。' },
            { text: 'I\'m running out of time.', meaning: '我的时间不够了。' },
            { text: 'Put on your coat.', meaning: '穿上你的外套。' },
            { text: 'Take off your shoes.', meaning: '脱掉你的鞋子。' },
            { text: 'I\'m looking forward to it.', meaning: '我很期待。' },
          ],
          patterns: [
            { pattern: 'I\'m looking for ___.', meaning: '我在找...', slots: 'my keys, my phone, the station', example: 'I\'m looking for my keys.' },
            { pattern: 'Don\'t give up on ___.', meaning: '不要放弃...', slots: 'your dreams, your goal, hope', example: 'Don\'t give up on your dreams.' },
          ],
        },
        {
          t: '情景常用语', sceneTitle: '基础·日常高频短语', dur: 30, lvl: 'L1',
          desc: '学习各种常见情景下的短语表达。', kp: '情景 常用 短语',
          chunks: [
            { text: 'What\'s the matter?', meaning: '怎么了？' },
            { text: 'Are you okay?', meaning: '你还好吗？' },
            { text: 'Take your time.', meaning: '慢慢来。' },
            { text: 'No worries!', meaning: '别担心！' },
            { text: 'Good luck!', meaning: '祝你好运！' },
            { text: 'Have fun!', meaning: '玩得开心！' },
            { text: 'Take care!', meaning: '保重！' },
            { text: 'See you later!', meaning: '回头见！' },
            { text: 'That\'s too bad.', meaning: '那太糟糕了。' },
            { text: 'What a pity!', meaning: '真可惜！' },
            { text: 'Congratulations!', meaning: '恭喜你！' },
            { text: 'Well done!', meaning: '做得好！' },
            { text: 'Cheers!', meaning: '干杯！/谢谢！' },
            { text: 'Same to you!', meaning: '你也一样！' },
            { text: 'I really mean it.', meaning: '我是认真的。' },
          ],
          patterns: [
            { pattern: 'What\'s the ___?', meaning: '...怎么了？', slots: 'matter, problem, time', example: 'What\'s the matter?' },
            { pattern: 'Take your ___.', meaning: '慢慢...', slots: 'time, seat, turn', example: 'Take your time.' },
          ],
        },
      ],
      vocab: [
        { w: 'matter', m: '事情', pos: 'noun', ph: '/ˈmætər/', ph_uk: '/ˈmætə/', lv: 'L1', desc: '事情、问题。', ex: '[{"en":"What\'s the matter?","zh":"怎么了？"}]' },
        { w: 'congratulations', m: '恭喜', pos: 'noun', ph: '/kənˌɡrætʃuˈleɪʃənz/', ph_uk: '/kənˌɡrætʃuˈleɪʃənz/', lv: 'L1', desc: '祝贺。', ex: '[{"en":"Congratulations on your success!","zh":"祝贺你的成功！"}]' },
        { w: 'cheers', m: '干杯', pos: 'noun', ph: '/tʃɪrz/', ph_uk: '/tʃɪəz/', lv: 'L1', desc: '干杯/谢谢。', ex: '[{"en":"Cheers!","zh":"干杯！"}]' },
      ],
    },
    {
      title: '基础·电话与应急',
      lvl: 'L1',
      desc: '学习打电话和紧急情况下的基础表达。',
      topics: [
        {
          t: '电话用语', sceneTitle: '基础·电话与应急', dur: 35, lvl: 'L1',
          desc: '学习打电话的基本表达。', kp: '电话 通话 留言',
          chunks: [
            { text: 'Hello, who\'s speaking?', meaning: '你好，请问是哪位？' },
            { text: 'This is Tom speaking.', meaning: '我是汤姆。' },
            { text: 'Can I speak to Mary?', meaning: '我能和玛丽通话吗？' },
            { text: 'Hold on a moment, please.', meaning: '请稍等。' },
            { text: 'I\'ll call you back later.', meaning: '我稍后打给你。' },
            { text: 'Sorry, I have to go now.', meaning: '对不起，我现在得挂了。' },
            { text: 'Can you hear me?', meaning: '你能听到我吗？' },
            { text: 'I can\'t hear you well.', meaning: '我听不太清楚。' },
            { text: 'Please speak slowly.', meaning: '请说慢一点。' },
            { text: 'I\'ll text you.', meaning: '我发短信给你。' },
            { text: 'Send me a message.', meaning: '给我发消息。' },
            { text: 'I missed your call.', meaning: '我错过了你的电话。' },
            { text: 'Let me call you back.', meaning: '让我回电话给你。' },
            { text: 'Please leave a message.', meaning: '请留言。' },
            { text: 'I\'ll get back to you soon.', meaning: '我很快回复你。' },
          ],
          patterns: [
            { pattern: 'Can I speak to ___?', meaning: '我能和...通话吗？', slots: 'Mary, the manager, Mr. Smith', example: 'Can I speak to Mary?' },
            { pattern: 'I\'ll call you ___.', meaning: '我...打给你', slots: 'back later, tomorrow, tonight', example: 'I\'ll call you back later.' },
          ],
        },
        {
          t: '紧急求助', sceneTitle: '基础·电话与应急', dur: 30, lvl: 'L1',
          desc: '学习紧急情况下的求助表达。', kp: '紧急 求助 安全',
          chunks: [
            { text: 'Help!', meaning: '救命！' },
            { text: 'Call the police!', meaning: '报警！' },
            { text: 'I need a doctor!', meaning: '我需要医生！' },
            { text: 'It\'s an emergency!', meaning: '这是紧急情况！' },
            { text: 'I\'m lost.', meaning: '我迷路了。' },
            { text: 'I need help.', meaning: '我需要帮助。' },
            { text: 'Please call an ambulance!', meaning: '请叫救护车！' },
            { text: 'There\'s a fire!', meaning: '着火了！' },
            { text: 'I lost my passport.', meaning: '我丢了护照。' },
            { text: 'My wallet was stolen.', meaning: '我的钱包被偷了。' },
            { text: 'I had an accident.', meaning: '我出了事故。' },
            { text: 'Is there a hospital nearby?', meaning: '附近有医院吗？' },
            { text: 'I don\'t feel well.', meaning: '我感觉不舒服。' },
            { text: 'It hurts here.', meaning: '这里疼。' },
            { text: 'Please take me to the hospital.', meaning: '请带我去医院。' },
          ],
          patterns: [
            { pattern: 'I need a ___.', meaning: '我需要一个...', slots: 'doctor, police, lawyer', example: 'I need a doctor!' },
            { pattern: 'I lost my ___.', meaning: '我丢了...', slots: 'passport, wallet, phone, keys', example: 'I lost my passport.' },
          ],
        },
      ],
      vocab: [
        { w: 'emergency', m: '紧急情况', pos: 'noun', ph: '/iˈmɜːrdʒənsi/', ph_uk: '/iˈmɜːdʒənsi/', lv: 'L1', desc: '紧急情况。', ex: '[{"en":"Call me in an emergency.","zh":"紧急情况给我打电话。"}]' },
        { w: 'ambulance', m: '救护车', pos: 'noun', ph: '/ˈæmbjələns/', ph_uk: '/ˈæmbjələns/', lv: 'L1', desc: '救护车。', ex: '[{"en":"Please call an ambulance!","zh":"请叫救护车！"}]' },
        { w: 'passport', m: '护照', pos: 'noun', ph: '/ˈpæspɔːrt/', ph_uk: '/ˈpæspɔːt/', lv: 'L1', desc: '护照。', ex: '[{"en":"I lost my passport.","zh":"我丢了护照。"}]' },
      ],
    },
  ],
};

// Generate all packages
console.log('=== Generating Foundation Packages ===\n');

let totalStats = { name: 'TOTAL', scenes: 0, topics: 0, vocab: 0, chunks: 0, patterns: 0 };

for (const pkg of [dailyLife, socialExpress, travelBasic, opinionBasics, essentialPhrases]) {
  const stats = createFoundationPkg(pkg.name, pkg.cat, pkg.scenes);
  totalStats.scenes += stats.scenes;
  totalStats.topics += stats.topics;
  totalStats.vocab += stats.vocab;
  totalStats.chunks += stats.chunks;
  totalStats.patterns += stats.patterns;
}

console.log(`\n=== ALL DONE ===`);
console.log(`Total: ${totalStats.scenes} scenes, ${totalStats.topics} topics, ${totalStats.vocab} vocab, ${totalStats.chunks} chunks, ${totalStats.patterns} patterns`);
console.log(`Estimated total sentences (chunks): ${totalStats.chunks}`);
