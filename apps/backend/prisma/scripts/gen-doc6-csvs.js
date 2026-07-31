const fs = require('fs');
const path = require('path');
const pkgDir = path.join(__dirname, '..', 'data', 'packages', 'foundation-6-past-tense');
function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

// ===== SCENES (5) =====
const scenes = [
  { category_name:'时态基础', title:'过去的状态', location:'home/classroom', required_output_level:'L1', required_user_level:'beginner', description:'was/were 过去式，过去的状态、位置、感受、外表和天气', package_type:'foundation' },
  { category_name:'时态基础', title:'过去的动作', location:'home/school', required_output_level:'L1', required_user_level:'beginner', description:'不规则动词过去式、规则动词-ed、过去时间表达和过去频率', package_type:'foundation' },
  { category_name:'时态进阶', title:'讲述经历', location:'home/office', required_output_level:'L1', required_user_level:'beginner', description:"didn't 否定、Did 疑问、ago 表达、in 年份事件", package_type:'foundation' },
  { category_name:'时态进阶', title:'完成时入门', location:'home/classroom', required_output_level:'L1', required_user_level:'beginner', description:'have been to, ever/never, just/yet, for/since, 最高级+完成时', package_type:'foundation' },
  { category_name:'综合对比', title:'过去与现在对比', location:'home/café', required_output_level:'L1', required_user_level:'beginner', description:'used to, 回忆过去, 生活变化, 今昔对比', package_type:'foundation' },
];

// ===== TOPICS (25) =====
const topics = [
  { scene_title:'过去的状态', title:'我以前是/有', prompt_en:'What were you like before?', prompt_zh:'你以前是什么样的？', duration_sec:900, difficulty:'L1', description:'was/were 肯定句', knowledge_points:'was, were, was not, were not', ink_script_key:'practice_foundation-past_状态_以前是有' },
  { scene_title:'过去的状态', title:'昨天在哪里', prompt_en:'Where were you yesterday?', prompt_zh:'你昨天在哪里？', duration_sec:900, difficulty:'L1', description:'was/were 疑问句', knowledge_points:'Were you...?, Where were you...?, Yes I was, No I wasn\'t', ink_script_key:'practice_foundation-past_状态_昨天在哪里' },
  { scene_title:'过去的状态', title:'过去的感受', prompt_en:'How did you feel?', prompt_zh:'你当时感觉如何？', duration_sec:900, difficulty:'L1', description:'was/were + 感受形容词', knowledge_points:'How was...?, was/were + bored/excited/scared/satisfied', ink_script_key:'practice_foundation-past_状态_过去感受' },
  { scene_title:'过去的状态', title:'过去的外表', prompt_en:'What did you look like?', prompt_zh:'你以前长什么样？', duration_sec:900, difficulty:'L1', description:'was/were + 外表描述', knowledge_points:'I was..., He/She was..., I had..., 外表形容词', ink_script_key:'practice_foundation-past_状态_过去外表' },
  { scene_title:'过去的状态', title:'过去的天气和日子', prompt_en:'What was the weather like?', prompt_zh:'天气怎么样？', duration_sec:900, difficulty:'L1', description:'It was... / Was it...?', knowledge_points:'It was stormy/humid/dry, Was it...?, 天气描述', ink_script_key:'practice_foundation-past_状态_天气日子' },
  { scene_title:'过去的动作', title:'昨天做了什么', prompt_en:'What did you do yesterday?', prompt_zh:'你昨天做了什么？', duration_sec:900, difficulty:'L1', description:'不规则动词 went/ate/had', knowledge_points:'went, ate, had, saw, said, got, took, came, gave, drank', ink_script_key:'practice_foundation-past_动作_昨天做什么' },
  { scene_title:'过去的动作', title:'不规则动词专项', prompt_en:'Can you use irregular past tense verbs?', prompt_zh:'你会用不规则动词过去式吗？', duration_sec:900, difficulty:'L1', description:'第二组10个不规则动词', knowledge_points:'knew, thought, told, found, left, felt, sat, stood, ran, wrote', ink_script_key:'practice_foundation-past_动作_不规则动词' },
  { scene_title:'过去的动作', title:'规则动词 -ed', prompt_en:'How do you form regular past tense?', prompt_zh:'规则动词过去式怎么变？', duration_sec:900, difficulty:'L1', description:'规则动词 -ed 三种发音', knowledge_points:'worked, watched, cooked, helped, walked, talked, liked, finished, washed, brushed', ink_script_key:'practice_foundation-past_动作_规则动词' },
  { scene_title:'过去的动作', title:'过去的时间表达', prompt_en:'When did it happen?', prompt_zh:'什么时候发生的？', duration_sec:900, difficulty:'L1', description:'过去时间表达', knowledge_points:'the day before yesterday, a while ago, a decade ago, back then, in those days', ink_script_key:'practice_foundation-past_动作_时间表达' },
  { scene_title:'过去的动作', title:'过去频率', prompt_en:'How often did you do it?', prompt_zh:'你过去多久做一次？', duration_sec:900, difficulty:'L1', description:'过去频率表达', knowledge_points:'whenever, each time, every time, most days, all the time, once in a while', ink_script_key:'practice_foundation-past_动作_过去频率' },
  { scene_title:'讲述经历', title:'上个周末/去年', prompt_en:'What did you do last weekend?', prompt_zh:'你上个周末做了什么？', duration_sec:900, difficulty:'L1', description:'Last weekend/Last year + 过去式', knowledge_points:'visited, stayed, cleaned, traveled, moved, started, learned, drove, flew', ink_script_key:'practice_foundation-past_经历_周末去年' },
  { scene_title:'讲述经历', title:'ago 表达', prompt_en:'How long ago was it?', prompt_zh:'多久以前？', duration_sec:900, difficulty:'L1', description:'时间段 + ago', knowledge_points:'ago, earlier, shortly, promptly, swiftly, rapidly, momentarily, unexpectedly', ink_script_key:'practice_foundation-past_经历_ago表达' },
  { scene_title:'讲述经历', title:'某年某事', prompt_en:'What happened in that year?', prompt_zh:'那年发生了什么？', duration_sec:900, difficulty:'L1', description:'in 年份 + 过去式', knowledge_points:'raised, grew up, attended, joined, retired, resigned, promoted, transferred, enrolled', ink_script_key:'practice_foundation-past_经历_某年某事' },
  { scene_title:'讲述经历', title:'否定句 didn\'t', prompt_en:"What didn't you do?", prompt_zh:'你没做什么？', duration_sec:900, difficulty:'L1', description:"didn't + 动词原形", knowledge_points:"didn't, nowhere, none, whatsoever, nope, nah, negative, zero, zilch, nil", ink_script_key:'practice_foundation-past_经历_否定句' },
  { scene_title:'讲述经历', title:'疑问句 Did', prompt_en:'Did you...? Ask about the past.', prompt_zh:'用 Did 问过去的事。', duration_sec:900, difficulty:'L1', description:'Did...? / When did...?', knowledge_points:'did, whose, whom, howcome, whatfor, wherever, whatever, however', ink_script_key:'practice_foundation-past_经历_疑问句' },
  { scene_title:'完成时入门', title:'去过/做过', prompt_en:'Have you ever been to...?', prompt_zh:'你去过...吗？', duration_sec:900, difficulty:'L1', description:'have been to / have + 过去分词', knowledge_points:'been, gone, done, seen, eaten, taken, driven, written, spoken, broken', ink_script_key:'practice_foundation-past_完成时_去过做过' },
  { scene_title:'完成时入门', title:'刚刚/还没', prompt_en:'Have you just...? Not yet?', prompt_zh:'你刚刚...？还没？', duration_sec:900, difficulty:'L1', description:'just / yet / already', knowledge_points:'so far, up to now, until now, by now, lately, recently, prior, earlier on, beforehand', ink_script_key:'practice_foundation-past_完成时_刚刚还没' },
  { scene_title:'完成时入门', title:'持续多久', prompt_en:'How long have you...?', prompt_zh:'你...多久了？', duration_sec:900, difficulty:'L1', description:'for / since', knowledge_points:'for, since, during, over, within, beyond, until, till, throughout', ink_script_key:'practice_foundation-past_完成时_持续多久' },
  { scene_title:'完成时入门', title:'ever/never', prompt_en:'Have you ever...?', prompt_zh:'你曾经...吗？', duration_sec:900, difficulty:'L1', description:'Have you ever...? / I have never...', knowledge_points:'ever, hardly ever, rarely ever, seldom ever, several, numerous, countless, infinite, endless, unlimited', ink_script_key:'practice_foundation-past_完成时_evernever' },
  { scene_title:'完成时入门', title:'完成时混合表达', prompt_en:'What is the best thing you have ever done?', prompt_zh:'你做过的最棒的事是什么？', duration_sec:900, difficulty:'L1', description:'最高级 + I have ever...', knowledge_points:'the best, the worst, the most, the least, the first, the last, the only, the strangest, the funniest, the greatest', ink_script_key:'practice_foundation-past_完成时_混合表达' },
  { scene_title:'过去与现在对比', title:'回忆过去', prompt_en:'What do you remember from the past?', prompt_zh:'你记得过去的什么？', duration_sec:900, difficulty:'L1', description:'I remember when...', knowledge_points:'memory, childhood, youth, era, decade, century, milestone, nostalgia, reminisce, flashback', ink_script_key:'practice_foundation-past_对比_回忆过去' },
  { scene_title:'过去与现在对比', title:'used to 习惯', prompt_en:'What did you use to do?', prompt_zh:'你过去习惯做什么？', duration_sec:900, difficulty:'L1', description:'used to / didn\'t use to', knowledge_points:'used, at first, in the beginning, once upon a time, in earlier times, in former times, in the old days, yesteryear, back in time', ink_script_key:'practice_foundation-past_对比_usedto' },
  { scene_title:'过去与现在对比', title:'生活变化', prompt_en:'How has your life changed?', prompt_zh:'你的生活怎么变了？', duration_sec:900, difficulty:'L1', description:'have changed / have grown', knowledge_points:'mature, evolve, transform, adapt, adjust, deteriorate, restore, rebuild, renew, refresh', ink_script_key:'practice_foundation-past_对比_生活变化' },
  { scene_title:'过去与现在对比', title:'今昔对比', prompt_en:'How was life before? How is it now?', prompt_zh:'以前的生活怎样？现在呢？', duration_sec:900, difficulty:'L1', description:'Life was... Now...', knowledge_points:'simpler, busier, wealthier, healthier, lonelier, happier, tougher, gentler, safer, poorer', ink_script_key:'practice_foundation-past_对比_今昔对比' },
  { scene_title:'过去与现在对比', title:'今昔综合表达', prompt_en:'Looking back, what do you realize?', prompt_zh:'回顾过去，你意识到什么？', duration_sec:900, difficulty:'L1', description:'综合过去时与完成时', knowledge_points:'nowadays, these days, in modern times, in this era, generation, millennial, contemporary, traditional, historic, ancient', ink_script_key:'practice_foundation-past_对比_综合表达' },
];

// ===== CORE VOCABULARY (25 topics × 10 = 250) =====
// Only NEW core words, not words marked "复用包①-⑤"
const coreVocab = [
  // Topic 01
  ['was','是(过去式)','v.'],['were','是(过去式)','v.'],["wasn't","不是(过去式)","v."],["weren't","不是(过去式)","v."],['previously','以前','adv.'],['formerly','从前','adv.'],['originally','最初','adv.'],['initially','起初','adv.'],['thereafter','此后','adv.'],['henceforth','从此','adv.'],
  // Topic 02
  ['the day before','前一天','n.'],['the week before','前一周','n.'],['the month before','前一月','n.'],['the year before','前一年','n.'],['earlier that day','那天早些时候','adv.'],['that morning','那天早上','n.'],['that afternoon','那天下午','n.'],['that evening','那天晚上','n.'],['that night','那天夜里','n.'],['the previous','之前的','adj.'],
  // Topic 03
  ['bored','无聊的','adj.'],['excited','兴奋的','adj.'],['scared','害怕的','adj.'],['satisfied','满意的','adj.'],['disappointed','失望的','adj.'],['shocked','震惊的','adj.'],['embarrassed','尴尬的','adj.'],['amused','被逗乐的','adj.'],['annoyed','恼怒的','adj.'],['puzzled','困惑的','adj.'],
  // Topic 04
  ['skinny','极瘦的','adj.'],['chubby','圆胖的','adj.'],['muscular','肌肉发达的','adj.'],['bald','秃头的','adj.'],['curly','卷曲的','adj.'],['blonde','金发的','adj.'],['brunette','深褐色头发的','adj.'],['freckled','有雀斑的','adj.'],['wrinkled','有皱纹的','adj.'],['tanned','晒黑的','adj.'],
  // Topic 05
  ['stormy','暴风雨的','adj.'],['humid','潮湿的','adj.'],['dry','干燥的','adj.'],['breezy','微风的','adj.'],['mild','温和的','adj.'],['pleasant','宜人的','adj.'],['miserable','糟糕的','adj.'],['gloomy','阴沉的','adj.'],['chilly','寒冷的','adj.'],['damp','潮湿的','adj.'],
  // Topic 06
  ['went','去(过去式)','v.'],['ate','吃(过去式)','v.'],['had','有(过去式)','v.'],['saw','看见(过去式)','v.'],['said','说(过去式)','v.'],['got','得到(过去式)','v.'],['took','拿(过去式)','v.'],['came','来(过去式)','v.'],['gave','给(过去式)','v.'],['drank','喝(过去式)','v.'],
  // Topic 07
  ['knew','知道(过去式)','v.'],['thought','想(过去式)','v.'],['told','告诉(过去式)','v.'],['found','找到(过去式)','v.'],['left','离开(过去式)','v.'],['felt','感觉(过去式)','v.'],['sat','坐(过去式)','v.'],['stood','站(过去式)','v.'],['ran','跑(过去式)','v.'],['wrote','写(过去式)','v.'],
  // Topic 08
  ['worked','工作(过去式)','v.'],['watched','看(过去式)','v.'],['cooked','烹饪(过去式)','v.'],['helped','帮助(过去式)','v.'],['walked','走(过去式)','v.'],['talked','说话(过去式)','v.'],['liked','喜欢(过去式)','v.'],['finished','完成(过去式)','v.'],['washed','洗(过去式)','v.'],['brushed','刷(过去式)','v.'],
  // Topic 09
  ['the day before yesterday','前天','n.'],['a while ago','一阵子前','adv.'],['a decade ago','十年前','adv.'],['centuries ago','几个世纪前','adv.'],['ages ago','很久以前','adv.'],['back then','那时候','adv.'],['in those days','在那些日子里','adv.'],['at that time','那时','adv.'],['in the past','在过去','adv.'],['long ago','很久以前','adv.'],
  // Topic 10
  ['whenever','每当','conj.'],['each time','每次','adv.'],['every time','每次','adv.'],['most days','大多数日子','adv.'],['all the time','一直','adv.'],['from time to time','不时','adv.'],['now and then','偶尔','adv.'],['once in a while','偶尔','adv.'],['back in the day','当年','adv.'],['way back','很久以前','adv.'],
  // Topic 11
  ['visited','拜访(过去式)','v.'],['stayed','停留(过去式)','v.'],['cleaned','打扫(过去式)','v.'],['traveled','旅行(过去式)','v.'],['moved','搬家(过去式)','v.'],['started','开始(过去式)','v.'],['learned','学习(过去式)','v.'],['drove','开车(过去式)','v.'],['flew','飞(过去式)','v.'],['skied','滑雪(过去式)','v.'],
  // Topic 12
  ['ago','以前','adv.'],['earlier','更早','adv.'],['shortly','不久','adv.'],['promptly','迅速地','adv.'],['swiftly','飞快地','adv.'],['rapidly','快速地','adv.'],['momentarily','片刻地','adv.'],['unexpectedly','意外地','adv.'],
  // Topic 13
  ['raised','抚养(过去式)','v.'],['grew up','长大','v.'],['attended','参加(过去式)','v.'],['joined','加入(过去式)','v.'],['retired','退休(过去式)','v.'],['resigned','辞职(过去式)','v.'],['promoted','晋升(过去式)','v.'],['transferred','调转(过去式)','v.'],['enrolled','注册(过去式)','v.'],['enlisted','入伍(过去式)','v.'],
  // Topic 14
  ["didn't",'没(过去否定)','aux.'],['nowhere','无处','adv.'],['none','没有一个','pron.'],['whatsoever','无论什么','adv.'],['nope','不','interj.'],['nah','不','interj.'],['negative','否定的','adj.'],['zero','零','num.'],['zilch','零','n.'],['nil','零','n.'],
  // Topic 15
  ['did','做(过去式)','aux./v.'],['whose','谁的','pron.'],['whom','谁(宾格)','pron.'],['howcome','为什么','adv.'],['whatfor','为何','adv.'],['whereto','去哪里','adv.'],['whyever','究竟为什么','adv.'],['wherever','无论哪里','adv.'],['whatever','无论什么','pron.'],['however','然而','adv.'],
  // Topic 16
  ['been','是/在(过去分词)','v.'],['gone','去(过去分词)','v.'],['done','做(过去分词)','v.'],['seen','看见(过去分词)','v.'],['eaten','吃(过去分词)','v.'],['taken','拿(过去分词)','v.'],['driven','开车(过去分词)','v.'],['written','写(过去分词)','v.'],['spoken','说(过去分词)','v.'],['broken','打破(过去分词)','v.'],
  // Topic 17
  ['so far','到目前为止','adv.'],['up to now','到现在','adv.'],['until now','直到现在','adv.'],['till now','到现在','adv.'],['by now','到现在','adv.'],['lately','最近','adv.'],['recently','最近','adv.'],['prior','在先的','adj.'],['earlier on','早些时候','adv.'],['beforehand','事先','adv.'],
  // Topic 18
  ['for','(持续)','prep.'],['since','自从','prep.'],['during','在...期间','prep.'],['over','在...期间','prep.'],['within','在...之内','prep.'],['beyond','超出','prep.'],['until','直到','prep.'],['till','直到','prep.'],['throughout','贯穿','prep.'],
  // Topic 19
  ['ever','曾经','adv.'],['hardly ever','几乎从不','adv.'],['rarely ever','很少','adv.'],['seldom ever','极少','adv.'],['multiple','多个的','adj.'],['numerous','许多的','adj.'],['countless','无数的','adj.'],['infinite','无限的','adj.'],['endless','无尽的','adj.'],['unlimited','无限的','adj.'],
  // Topic 20
  ['the best','最好的','adj.'],['the worst','最差的','adj.'],['the most','最多的','adj.'],['the least','最少的','adj.'],['the first','第一个','adj.'],['the last','最后一个','adj.'],['the only','唯一的','adj.'],['the strangest','最奇怪的','adj.'],['the funniest','最好笑的','adj.'],['the greatest','最伟大的','adj.'],
  // Topic 21
  ['memory','记忆','n.'],['childhood','童年','n.'],['youth','青春','n.'],['era','时代','n.'],['decade','十年','n.'],['century','世纪','n.'],['milestone','里程碑','n.'],['nostalgia','怀旧','n.'],['reminisce','回忆','v.'],['flashback','闪回','n.'],
  // Topic 22
  ['used','曾经(used to)','adj.'],['at first','起初','adv.'],['in the beginning','一开始','adv.'],['once upon a time','从前','adv.'],['in earlier times','在更早的时候','adv.'],['in former times','在从前','adv.'],['in the old days','在过去','adv.'],['yesteryear','往昔','n.'],['back in time','回到过去','adv.'],
  // Topic 23
  ['mature','成熟','v.'],['evolve','演变','v.'],['transform','转变','v.'],['adapt','适应','v.'],['adjust','调整','v.'],['deteriorate','恶化','v.'],['restore','恢复','v.'],['rebuild','重建','v.'],['renew','更新','v.'],['revive','复兴','v.'],
  // Topic 24
  ['simpler','更简单的','adj.'],['busier','更忙的','adj.'],['wealthier','更富有的','adj.'],['healthier','更健康的','adj.'],['lonelier','更孤独的','adj.'],['happier','更快乐的','adj.'],['tougher','更艰难的','adj.'],['gentler','更温柔的','adj.'],['safer','更安全的','adj.'],['poorer','更穷的','adj.'],
  // Topic 25
  ['presently','目前','adv.'],['these days','这些天','adv.'],['in modern times','在现代','adv.'],['in this era','在这个时代','adv.'],['generation','一代人','n.'],['millennial','千禧一代','n.'],['contemporary','当代的','adj.'],['traditional','传统的','adj.'],['historic','有历史意义的','adj.'],['ancient','古代的','adj.'],
];

// ===== EPISODES (10) =====
const episodes = [
  { chapter_id:1,chapter_title:'过去的状态',episode_order:1,title:'我以前是/有',scene_title:'过去的状态',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["掌握was/were肯定和否定"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-past_状态_以前是有',rewards_json:'{"xp":50}' },
  { chapter_id:1,chapter_title:'过去的状态',episode_order:2,title:'昨天在哪里/怎么样',scene_title:'过去的状态',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用was/were完成疑问和描述"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'practice_foundation-past_状态_哪里怎样',rewards_json:'{"xp":50}' },
  { chapter_id:2,chapter_title:'过去的动作',episode_order:1,title:'昨天做了什么',scene_title:'过去的动作',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用不规则动词描述过去动作"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Lin',npc_role:'学员',is_preview:false,ink_script_key:'practice_foundation-past_动作_昨天做什么',rewards_json:'{"xp":50}' },
  { chapter_id:2,chapter_title:'过去的动作',episode_order:2,title:'不规则动词与规则-ed',scene_title:'过去的动作',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["区分不规则动词和规则-ed"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Ben',npc_role:'同事',is_preview:false,ink_script_key:'practice_foundation-past_动作_不规则规则',rewards_json:'{"xp":50}' },
  { chapter_id:3,chapter_title:'讲述经历',episode_order:1,title:'上个周末/去年',scene_title:'讲述经历',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用Last/ago/in年份讲述经历"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'practice_foundation-past_经历_周末去年',rewards_json:'{"xp":50}' },
  { chapter_id:3,chapter_title:'讲述经历',episode_order:2,title:'否定和疑问',scene_title:'讲述经历',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["掌握否定和Did问答"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Ben',npc_role:'同事',is_preview:false,ink_script_key:'practice_foundation-past_经历_否定疑问',rewards_json:'{"xp":50}' },
  { chapter_id:4,chapter_title:'完成时入门',episode_order:1,title:'去过/做过',scene_title:'完成时入门',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用have been to表达经历"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-past_完成时_去过做过',rewards_json:'{"xp":50}' },
  { chapter_id:4,chapter_title:'完成时入门',episode_order:2,title:'刚刚/还没/多久了',scene_title:'完成时入门',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用just/yet/for/since完成完成时"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Lin',npc_role:'学员',is_preview:false,ink_script_key:'practice_foundation-past_完成时_刚刚还没',rewards_json:'{"xp":50}' },
  { chapter_id:5,chapter_title:'过去与现在对比',episode_order:1,title:'回忆过去/used to',scene_title:'过去与现在对比',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用used to和remember对比过去"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'practice_foundation-past_对比_回忆usedto',rewards_json:'{"xp":50}' },
  { chapter_id:5,chapter_title:'过去与现在对比',episode_order:2,title:'今昔对比',scene_title:'过去与现在对比',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["完成今昔对比综合表达"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-past_对比_今昔综合',rewards_json:'{"xp":80}' },
];

// ===== WRITE CSVs =====
let csv;

csv = 'category_name,title,location,required_output_level,required_user_level,description,package_type\n';
scenes.forEach(s=>csv+=[s.category_name,s.title,s.location,s.required_output_level,s.required_user_level,q(s.description),s.package_type].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'scenes.csv'),csv);
console.log('scenes:',scenes.length);

csv = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key\n';
topics.forEach(t=>csv+=[t.scene_title,t.title,q(t.prompt_en),q(t.prompt_zh),t.duration_sec,t.difficulty,q(t.description),q(t.knowledge_points),'',t.ink_script_key].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'training_topics.csv'),csv);
console.log('topics:',topics.length);

csv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
let so=0;
coreVocab.forEach((vw,i)=>{
  const ti=Math.floor(i/10);
  const t=topics[ti];
  csv+=[t.scene_title,t.title,vw[0],vw[1],vw[2],'','',t.difficulty,'','[]',so++].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'scene_vocabulary.csv'),csv);
console.log('vocab:',coreVocab.length);

// Keep existing chunks, patterns, episode_chunks (already from MD)
// Only regenerate scripts_episodes
csv = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
episodes.forEach(e=>csv+=[e.chapter_id,e.chapter_title,e.episode_order,e.title,e.scene_title,e.required_output_level,e.required_user_level,e.vocab_required_count,e.vocab_total_count,e.chunk_required_count,e.chunk_total_count,q(e.objectives_json),e.pass_objective_count,e.pass_chunk_count,e.pass_min_dialogues,e.npc_name,e.npc_role,e.is_preview,e.ink_script_key,q(e.rewards_json)].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'script_episodes.csv'),csv);
console.log('episodes:',episodes.length);

console.log('✅ Doc6 CSVs updated!');
