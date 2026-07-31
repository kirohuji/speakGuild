const fs = require('fs');
const path = require('path');
const pkgDir = path.join(__dirname, '..', 'data', 'packages', 'foundation-5-present-time-grammar');
function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

// ===== SCENES (2 actual) =====
const scenes = [
  { category_name:'语法基础', title:'频率与现在进行时', location:'home/classroom', required_output_level:'L1~L2', required_user_level:'beginner', description:'频率副词含义、位置和频率问句；现在进行时肯定、否定和疑问句', package_type:'foundation' },
  { category_name:'语法基础', title:'状态、活动与变化', location:'office/home', required_output_level:'L1~L2', required_user_level:'beginner', description:'区分习惯与此刻、状态动词与动作动词、have的状态与活动、get的三种含义', package_type:'foundation' },
];

// ===== TOPICS (8) =====
const topics = [
  { scene_title:'频率与现在进行时', title:'用频率支持观点', prompt_en:'How often do you do these activities?', prompt_zh:'你做这些活动的频率如何？', duration_sec:900, difficulty:'L1', description:'频率副词含义和高低排序', knowledge_points:'always, usually, often, sometimes, rarely, never', teaching_markdown:'## 频率副词\n\nalways 100% → usually 80-90% → often 60-70% → sometimes 30-50% → rarely 5-10% → never 0%', ink_script_key:'practice_foundation-present_频率_用频率支持观点' },
  { scene_title:'频率与现在进行时', title:'频率副词的位置与频率问句', prompt_en:'Where do frequency adverbs go in a sentence?', prompt_zh:'频率副词放在句子的什么位置？', duration_sec:900, difficulty:'L1', description:'频率副词在一般动词前、be动词后；频率问句', knowledge_points:'How often, once/twice a..., is always, is sometimes', teaching_markdown:'## 频率位置\n\n一般动词前：I usually practice.\nbe动词后：Emma is always ready.\n问句：How often do you...?', ink_script_key:'practice_foundation-present_频率_位置与问句' },
  { scene_title:'频率与现在进行时', title:'现在进行时肯定句', prompt_en:'What are you doing right now?', prompt_zh:'你现在正在做什么？', duration_sec:900, difficulty:'L1~L2', description:'am/is/are + 动词-ing 系统掌握', knowledge_points:'I am...ing, He/She is...ing, We/They are...ing, It is...ing', teaching_markdown:'## 进行时肯定\n\nI am reading.\nHe is talking.\nThey are waiting.\nIt is raining.', ink_script_key:'practice_foundation-present_进行时_肯定句' },
  { scene_title:'频率与现在进行时', title:'现在进行时否定句与疑问句', prompt_en:'What is NOT happening? Are you studying?', prompt_zh:'什么没在发生？你在学习吗？', duration_sec:900, difficulty:'L1~L2', description:'否定和疑问的现在进行时', knowledge_points:"I'm not...ing, isn't...ing, Are you...ing?, What is...doing?", teaching_markdown:'## 进行时否定与疑问\n\nI\'m not working.\nShe isn\'t cooking.\nAre you studying?\nWhat is Ben doing?', ink_script_key:'practice_foundation-present_进行时_否定疑问' },
  { scene_title:'状态、活动与变化', title:'区分习惯、此刻和临时变化', prompt_en:'Is this a habit or happening right now?', prompt_zh:'这是习惯还是正在发生？', duration_sec:900, difficulty:'L1~L2', description:'一般现在时 vs 现在进行时的对比', knowledge_points:'一般现在 vs 进行时, right now, today, this week, for now', teaching_markdown:'## 习惯vs此刻\n\n习惯：I take the bus every day.\n此刻：I am walking right now.\n临时：I am working at home this week.', ink_script_key:'practice_foundation-present_状态_习惯vs此刻' },
  { scene_title:'状态、活动与变化', title:'状态动词与动作动词', prompt_en:'Is this a state or an action?', prompt_zh:'这是状态还是动作？', duration_sec:900, difficulty:'L1~L2', description:'区分think/know/look/feel的状态与动作意义', knowledge_points:'think vs thinking about, feel vs feeling, look vs looking at, know (no -ing)', teaching_markdown:'## 状态vs动作\n\nI think it is useful. (状态)\nI\'m thinking about it. (动作)\nI know the answer. (状态，不用进行时)', ink_script_key:'practice_foundation-present_状态_状态动词' },
  { scene_title:'状态、活动与变化', title:'用have区分状态与活动', prompt_en:'Do you have something, or are you having an activity?', prompt_zh:'你拥有某物，还是正在进行活动？', duration_sec:900, difficulty:'L1~L2', description:'have表示拥有和have表示活动的区分', knowledge_points:'I have (拥有), I\'m having (活动), has, We\'re having', teaching_markdown:'## have双重用法\n\nI have a desk. (拥有)\nI\'m having lunch. (进行活动)\n❌ I\'m having a car.', ink_script_key:'practice_foundation-present_状态_have区分' },
  { scene_title:'状态、活动与变化', title:'用get描述到达、收到和变得', prompt_en:'How do you use get?', prompt_zh:'怎么用get？', duration_sec:900, difficulty:'L1~L2', description:'get + 地点/名词/形容词的三种含义', knowledge_points:'get + 地点(到达), get + 名词(收到), get + 形容词(变得), be getting + 形容词', teaching_markdown:'## get三种含义\n\nget home (到达)\nget feedback (收到)\nget easier (变得)\nIt\'s getting late. (正在变)', ink_script_key:'practice_foundation-present_状态_get' },
];

// ===== CHUNKS: 32 expressions × 2 = 64 =====
const chunkData = [
  // Topic 01: I always..., I usually..., I often..., ...is never...
  {tp:0, exp:'I always...', a:'I always review after class.', b:'I always write down new phrases.'},
  {tp:0, exp:'I usually...', a:'I usually practice in the morning.', b:'I usually study for twenty minutes.'},
  {tp:0, exp:'I often...', a:'I often speak with a partner.', b:'I often use short dialogues.'},
  {tp:0, exp:'...is never...', a:'The practice is never boring.', b:'Emma is never late for class.'},
  // Topic 02: How often, once/twice a..., is always, is sometimes
  {tp:1, exp:'How often do you...?', a:'How often do you practice speaking?', b:'How often do you review your notes?'},
  {tp:1, exp:'I...once/twice a...', a:'I practice speaking twice a week.', b:'I review my notes once a day.'},
  {tp:1, exp:'...is always...', a:'Emma is always ready for class.', b:'The weekly meeting is always useful.'},
  {tp:1, exp:'...is sometimes...', a:'The bus is sometimes late.', b:'The afternoon class is sometimes noisy.'},
  // Topic 03: I am...ing, He/She is...ing, We/They are...ing, It is...ing
  {tp:2, exp:'I am...ing', a:'I am reading the activity guide.', b:'I am waiting by the front desk.'},
  {tp:2, exp:'He/She is...ing', a:'Ben is talking to the teacher.', b:'Mia is writing down the time.'},
  {tp:2, exp:'We/They are...ing', a:'We are waiting for the class.', b:'They are reading the new guide.'},
  {tp:2, exp:'It is...ing', a:'It is raining outside.', b:'The class is starting now.'},
  // Topic 04: I'm not...ing, ...isn't...ing, Are you...ing?, What is...doing?
  {tp:3, exp:"I'm not...ing", a:"I'm not working at the office today.", b:"I'm not calling about the meeting."},
  {tp:3, exp:"...isn't...ing", a:"Ben isn't working outside.", b:"Mia isn't cooking right now."},
  {tp:3, exp:'Are you...ing?', a:'Are you studying right now?', b:'Are you calling from home?'},
  {tp:3, exp:'What is...doing?', a:'What is Ben doing now?', b:'What is Mia doing outside?'},
  // Topic 05: I normally...but right now..., Today...is...ing, This week I'm...ing, For now I'm...ing
  {tp:4, exp:'I normally..., but right now I\'m...ing', a:'I normally take the bus, but right now I\'m walking.', b:'I normally work inside, but right now I\'m sitting outside.'},
  {tp:4, exp:'Today,...is...ing', a:'Today, Ben is working at home.', b:'Today, the bus is running slowly.'},
  {tp:4, exp:"This week, I'm...ing", a:"This week, I'm trying a new route.", b:"This week, I'm leaving home earlier."},
  {tp:4, exp:"For now, I'm...ing", a:"For now, I'm walking to work.", b:"For now, I'm using a different route."},
  // Topic 06: I think/I'm thinking, I feel/I'm feeling, It looks/is looking, I know
  {tp:5, exp:'I think... / I\'m thinking about...', a:'I think the activity is useful.', b:"I'm thinking about joining the group."},
  {tp:5, exp:'I feel... / I\'m feeling...', a:'I feel this plan is right.', b:"I'm feeling tired right now."},
  {tp:5, exp:'It looks... / ...is looking at...', a:'It looks interesting to me.', b:'Emma is looking at the activity list.'},
  {tp:5, exp:'I know...', a:'I know the class starts at two.', b:'I know this bag belongs to Mia.'},
  // Topic 07: I have..., ...has..., I'm having..., We're having...
  {tp:6, exp:'I have...', a:'I have a desk by the window.', b:'I have a headache today.'},
  {tp:6, exp:'...has...', a:'The office has a quiet room.', b:'Mia has two meetings today.'},
  {tp:6, exp:"I'm having...", a:"I'm having lunch in the shared kitchen.", b:"I'm having a short meeting now."},
  {tp:6, exp:"We're having...", a:"We're having a good experience here.", b:"We're having coffee with the team."},
  // Topic 08: I get..., I'm getting..., It's getting..., My final view is...
  {tp:7, exp:'I get...', a:'I get home at six.', b:'I get useful feedback every day.'},
  {tp:7, exp:"I'm getting...", a:"I'm getting better at speaking.", b:"I'm getting tired after long lessons."},
  {tp:7, exp:"It's getting...", a:"It's getting easier every day.", b:"It's getting late, so we need to finish."},
  {tp:7, exp:'My final view is...', a:'My final view is that the plan works.', b:'My final view is that short practice is better.'},
];

// ===== PATTERNS (32) =====
const patternData = [
  {tp:0,exp:'I always...',pattern:'I always ___.',slots:'review / practice / write',example:'I always review after class.'},
  {tp:0,exp:'I usually...',pattern:'I usually ___ at/in ___.',slots:'practice / study / the morning / the evening',example:'I usually practice in the morning.'},
  {tp:0,exp:'I often...',pattern:'I often ___.',slots:'speak / read / use',example:'I often speak with a partner.'},
  {tp:0,exp:'...is never...',pattern:'___ is never ___.',slots:'the class / Emma / late / boring',example:'Emma is never late.'},
  {tp:1,exp:'How often do you...?',pattern:'How often do you ___?',slots:'practice / review / study',example:'How often do you practice?'},
  {tp:1,exp:'I...once/twice a...',pattern:'I ___ once/twice a ___.',slots:'practice / review / week / day',example:'I practice twice a week.'},
  {tp:1,exp:'...is always...',pattern:'___ is always ___.',slots:'Emma / the meeting / ready / useful',example:'Emma is always ready.'},
  {tp:1,exp:'...is sometimes...',pattern:'___ is sometimes ___.',slots:'the bus / the class / late / noisy',example:'The bus is sometimes late.'},
  {tp:2,exp:'I am...ing',pattern:'I am ___ing ___.',slots:'read / wait / the guide / by the desk',example:'I am reading the guide.'},
  {tp:2,exp:'He/She is...ing',pattern:'___ is ___ing ___.',slots:'Ben / Mia / talk / write / the teacher / the time',example:'Ben is talking to the teacher.'},
  {tp:2,exp:'We/They are...ing',pattern:'___ are ___ing ___.',slots:'We / They / wait / read / for the class / the guide',example:'They are waiting for the class.'},
  {tp:2,exp:'It is...ing',pattern:'It/The ___ is ___ing ___.',slots:'rain / the class / start / outside / now',example:'It is raining outside.'},
  {tp:3,exp:"I'm not...ing",pattern:"I'm not ___ing ___.",slots:'work / call / at the office / about the meeting',example:"I'm not working today."},
  {tp:3,exp:"...isn't...ing",pattern:"___ isn't ___ing ___.",slots:'Ben / Mia / work / cook / outside / right now',example:"Mia isn't cooking right now."},
  {tp:3,exp:'Are you...ing?',pattern:'Are you ___ing ___?',slots:'study / call / right now / from home',example:'Are you studying right now?'},
  {tp:3,exp:'What is...doing?',pattern:'What is ___ doing ___?',slots:'Ben / Mia / now / outside',example:'What is Ben doing now?'},
  {tp:4,exp:'I normally..., but right now I\'m...ing',pattern:'I normally ___, but right now I\'m ___ing.',slots:'take the bus / walk / work inside / sit outside',example:'I normally take the bus, but right now I\'m walking.'},
  {tp:4,exp:'Today,...is...ing',pattern:'Today, ___ is ___ing ___.',slots:'Ben / the bus / work / run / at home / slowly',example:'Today, Ben is working at home.'},
  {tp:4,exp:"This week, I'm...ing",pattern:"This week, I'm ___ing ___.",slots:'try / leave / a new route / home earlier',example:"This week, I'm trying a new route."},
  {tp:4,exp:"For now, I'm...ing",pattern:"For now, I'm ___ing ___.",slots:'walk / use / to work / a different route',example:"For now, I'm walking to work."},
  {tp:5,exp:'I think... / I\'m thinking about...',pattern:'I think ___. / I\'m thinking about ___.',slots:'it is useful / joining',example:'I think it is useful.'},
  {tp:5,exp:'I feel... / I\'m feeling...',pattern:'I feel ___. / I\'m feeling ___.',slots:'it is right / tired',example:'I feel it is right.'},
  {tp:5,exp:'It looks... / ...is looking at...',pattern:'It looks ___. / ___ is looking at ___.',slots:'interesting / Emma / the list',example:'It looks interesting.'},
  {tp:5,exp:'I know...',pattern:'I know ___.',slots:'the time / the answer / this belongs to...',example:'I know the class starts at two.'},
  {tp:6,exp:'I have...',pattern:'I have ___, so I think ___.',slots:'a desk / a headache / it is good / I need rest',example:'I have a desk by the window.'},
  {tp:6,exp:'...has...',pattern:'___ has ___.',slots:'the office / Mia / a quiet room / two meetings',example:'The office has a quiet room.'},
  {tp:6,exp:"I'm having...",pattern:"I'm having ___ now.",slots:'lunch / a meeting / coffee',example:"I'm having lunch now."},
  {tp:6,exp:"We're having...",pattern:"We're having ___ with/in ___.",slots:'coffee / a good experience / the team / the kitchen',example:"We're having coffee with the team."},
  {tp:7,exp:'I get...',pattern:'I get ___ at/every ___.',slots:'home / feedback / six / day',example:'I get home at six.'},
  {tp:7,exp:"I'm getting...",pattern:"I'm getting ___ at/after ___.",slots:'better / tired / speaking / long lessons',example:"I'm getting better at speaking."},
  {tp:7,exp:"It's getting...",pattern:"It's getting ___.",slots:'easier / late / better / warmer',example:"It's getting easier."},
  {tp:7,exp:'My final view is...',pattern:'My final view is that ___.',slots:'the plan works / practice helps / short practice is better',example:'My final view is that the plan works.'},
];

// ===== VOCABULARY (112 core + 48 extension = 160) =====
const coreVocab = [
  // Topic 01 (14)
  ['always','副词'],['usually','副词'],['often','副词'],['sometimes','副词'],['rarely','副词'],['never','副词'],
  ['habit','名词'],['routine','名词'],['regular','形容词'],['typical','形容词'],['frequent','形容词'],['occasional','形容词'],['daily','形容词'],['weekly','形容词'],
  // Topic 02 (14)
  ['once','副词'],['twice','副词'],['times','名词'],['per','介词'],['practice','动词'],['attend','动词'],
  ['miss','动词'],['skip','动词'],['repeat','动词'],['count','动词'],['method','名词'],['track','动词'],['record','动词'],['revise','动词'],
  // Topic 03 (14)
  ['type','动词'],['draw','动词'],['search','动词'],['browse','动词'],['pack','动词'],['load','动词'],['download','动词'],
  ['charge','动词'],['refresh','动词'],['share','动词'],['create','动词'],['build','动词'],['fix','动词'],['post','动词'],
  // Topic 04 (14)
  ['comment','动词'],['respond','动词'],['connect','动词'],['ring','动词'],['buzz','动词'],['tap','动词'],['press','动词'],
  ['push','动词'],['lift','动词'],['roll','动词'],['fold','动词'],['tie','动词'],['drag','动词'],['release','动词'],
  // Topic 05 (14) - fixed: removed typical/regular/occasional/frequent (dup w/ Topic01)
  ['commute','动词'],['route','名词'],['transport','名词'],['vehicle','名词'],['journey','名词'],['normal','形容词'],['temporary','形容词'],
  ['sudden','形容词'],['recent','形容词'],['extra','形容词'],['primary','形容词'],['steady','形容词'],['flexible','形容词'],['rapid','形容词'],
  // Topic 06 (14)
  ['know','动词'],['believe','动词'],['remember','动词'],['forget','动词'],['understand','动词'],['mean','动词'],['suppose','动词'],
  ['realize','动词'],['recognize','动词'],['agree','动词'],['disagree','动词'],['doubt','动词'],['imagine','动词'],['wonder','动词'],
  // Topic 07 (14) - fixed: removed break (dup w/ Doc2)
  ['own','动词'],['possess','动词'],['belong','动词'],['property','名词'],['item','名词'],['tool','名词'],['appliance','名词'],
  ['furniture','名词'],['meal','名词'],['snack','名词'],['interval','名词'],['discussion','名词'],['celebration','名词'],['gathering','名词'],
  // Topic 08 (14)
  ['approach','动词'],['enter','动词'],['receive','动词'],['obtain','动词'],['collect','动词'],['deliver','动词'],['package','名词'],
  ['improve','动词'],['worsen','动词'],['strengthen','动词'],['weaken','动词'],['notice','动词'],['warning','名词'],['gain','动词'],
];
const extVocab = [
  ['normally','副词'],['generally','副词'],['constantly','副词'],['seldom','副词'],['hardly','副词'],['monthly','形容词'],
  ['fortnight','名词'],['quarterly','形容词'],['annually','副词'],['semester','名词'],['reminder','名词'],['punctual','形容词'],
  ['scroll','动词'],['stream','动词'],['install','动词'],['delete','动词'],['pause','动词'],['edit','动词'],
  ['alert','动词'],['remind','动词'],['cancel','动词'],['ignore','动词'],['accept','动词'],['refuse','动词'],
  ['detour','名词'],['rush','名词'],['alternative','名词'],['adjustment','名词'],['unexpected','形容词'],['nowadays','副词'],
  ['seem','动词'],['appear','动词'],['matter','动词'],['consider','动词'],['assume','动词'],['guess','动词'],
  ['gear','名词'],['supply','名词'],['resource','名词'],['chat','动词'],['argument','名词'],['party','名词'],
  ['destination','名词'],['terminal','名词'],['platform','名词'],['shipment','名词'],['progress','名词'],['decline','名词'],
];

// Build vocab entries
const vocabEntries = [];
topics.forEach((t, ti) => {
  const ci = ti * 14, ei = ti * 6;
  coreVocab.slice(ci, ci+14).forEach(([w,pos]) => {
    vocabEntries.push({ scene_title:t.scene_title, topic_title:t.title, word:w, meaning:w, part_of_speech:pos, difficulty:t.difficulty, is_core:'核心词' });
  });
  extVocab.slice(ei, ei+6).forEach(([w,pos]) => {
    vocabEntries.push({ scene_title:t.scene_title, topic_title:t.title, word:w, meaning:w, part_of_speech:pos, difficulty:t.difficulty, is_core:'扩展词' });
  });
});

// ===== EPISODES (4) =====
const episodes = [
  { chapter_id:1,chapter_title:'频率与现在进行时',episode_order:1,title:'频率副词与问句',scene_title:'频率与现在进行时',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:28,vocab_total_count:40,chunk_required_count:16,chunk_total_count:16,objectives_json:'["描述6种频率并完成频率问句"]',pass_objective_count:1,pass_chunk_count:12,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-present_频率_综合',rewards_json:'{"xp":50}' },
  { chapter_id:1,chapter_title:'频率与现在进行时',episode_order:2,title:'现在进行时',scene_title:'频率与现在进行时',required_output_level:'L1~L2',required_user_level:'beginner',vocab_required_count:28,vocab_total_count:40,chunk_required_count:16,chunk_total_count:16,objectives_json:'["用进行时描述此刻和问答"]',pass_objective_count:1,pass_chunk_count:12,pass_min_dialogues:4,npc_name:'Ben',npc_role:'同事',is_preview:false,ink_script_key:'practice_foundation-present_进行时_综合',rewards_json:'{"xp":50}' },
  { chapter_id:2,chapter_title:'状态、活动与变化',episode_order:1,title:'状态动词与have',scene_title:'状态、活动与变化',required_output_level:'L1~L2',required_user_level:'beginner',vocab_required_count:28,vocab_total_count:40,chunk_required_count:16,chunk_total_count:16,objectives_json:'["区分状态动词和have的双重用法"]',pass_objective_count:1,pass_chunk_count:12,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'practice_foundation-present_状态_have',rewards_json:'{"xp":50}' },
  { chapter_id:2,chapter_title:'状态、活动与变化',episode_order:2,title:'get与综合',scene_title:'状态、活动与变化',required_output_level:'L1~L2',required_user_level:'beginner',vocab_required_count:28,vocab_total_count:40,chunk_required_count:16,chunk_total_count:16,objectives_json:'["掌握get三种含义并完成综合输出"]',pass_objective_count:1,pass_chunk_count:12,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-present_get_综合',rewards_json:'{"xp":80}' },
];

// ===== WRITE CSVs =====
let csv;

// scenes.csv
csv = 'category_name,title,location,required_output_level,required_user_level,description,package_type\n';
scenes.forEach(s => csv += [s.category_name,s.title,s.location,s.required_output_level,s.required_user_level,q(s.description),s.package_type].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'scenes.csv'),csv);
console.log('scenes:',scenes.length);

// training_topics.csv
csv = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key\n';
topics.forEach(t => csv += [t.scene_title,t.title,q(t.prompt_en),q(t.prompt_zh),t.duration_sec,t.difficulty,q(t.description),q(t.knowledge_points),q(t.teaching_markdown),t.ink_script_key].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'training_topics.csv'),csv);
console.log('topics:',topics.length);

// chunks.csv
csv = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n';
chunkData.forEach(c => {
  const t = topics[c.tp];
  csv += [t.scene_title,t.title,'核心句块',q(c.a),q(c.exp+' — 句块A'),t.difficulty,'',q('[]')].join(',')+'\n';
  csv += [t.scene_title,t.title,'核心句块',q(c.b),q(c.exp+' — 句块B'),t.difficulty,'',q('[]')].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'chunks.csv'),csv);
console.log('chunks:',chunkData.length*2);

// sentence_patterns.csv
csv = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order\n';
patternData.forEach((p,i) => {
  const t = topics[p.tp];
  csv += [t.scene_title,t.title,q(p.pattern),q(p.exp),q(p.slots),q(p.example),t.difficulty,i].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'sentence_patterns.csv'),csv);
console.log('patterns:',patternData.length);

// scene_vocabulary.csv
csv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
vocabEntries.forEach((v,i) => {
  csv += [v.scene_title,v.topic_title,v.word,v.meaning,v.part_of_speech,'','',v.difficulty,'','[]',i].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'scene_vocabulary.csv'),csv);
console.log('vocab:',vocabEntries.length);

// script_episodes.csv
csv = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
episodes.forEach(e => csv += [e.chapter_id,e.chapter_title,e.episode_order,e.title,e.scene_title,e.required_output_level,e.required_user_level,e.vocab_required_count,e.vocab_total_count,e.chunk_required_count,e.chunk_total_count,q(e.objectives_json),e.pass_objective_count,e.pass_chunk_count,e.pass_min_dialogues,e.npc_name,e.npc_role,e.is_preview,e.ink_script_key,q(e.rewards_json)].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'script_episodes.csv'),csv);
console.log('episodes:',episodes.length);

// episode_chunks.csv
csv = 'episode_chapter,episode_order,chunk_text_match,sort_order\n';
let ci=0;
episodes.forEach((ep,ei) => {
  const start=ei*16, end=start+16;
  for(let i=start;i<end&&i<chunkData.length*2;i++){
    const c=chunkData[Math.floor(i/2)];
    const text=i%2===0?c.a:c.b;
    csv += [ep.chapter_id+'-'+ep.episode_order,ep.episode_order,q(text),ci++].join(',')+'\n';
  }
});
fs.writeFileSync(path.join(pkgDir,'episode_chunks.csv'),csv);
console.log('ep_chunks:',ci);

console.log('\n✅ Doc5 done!');
