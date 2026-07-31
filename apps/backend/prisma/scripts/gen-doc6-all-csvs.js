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
  { scene_title:'过去的状态', title:'我以前是/有', prompt_en:'What were you like before?', prompt_zh:'你以前是什么样的？', duration_sec:900, difficulty:'L1', description:'was/were 肯定句', knowledge_points:'was, were, was not, were not', ink_script_key:'past_state_be' },
  { scene_title:'过去的状态', title:'昨天在哪里', prompt_en:'Where were you yesterday?', prompt_zh:'你昨天在哪里？', duration_sec:900, difficulty:'L1', description:'was/were 疑问句', knowledge_points:'Were you...?, Where were you...?, Yes I was, No I wasn\'t', ink_script_key:'past_state_where' },
  { scene_title:'过去的状态', title:'过去的感受', prompt_en:'How did you feel?', prompt_zh:'你当时感觉如何？', duration_sec:900, difficulty:'L1', description:'was/were + 感受形容词', knowledge_points:'How was...?, was/were + bored/excited/scared/satisfied', ink_script_key:'past_state_feeling' },
  { scene_title:'过去的状态', title:'过去的外表', prompt_en:'What did you look like?', prompt_zh:'你以前长什么样？', duration_sec:900, difficulty:'L1', description:'was/were + 外表描述', knowledge_points:'I was..., He/She was..., 外表形容词', ink_script_key:'past_state_look' },
  { scene_title:'过去的状态', title:'过去的天气和日子', prompt_en:'What was the weather like?', prompt_zh:'天气怎么样？', duration_sec:900, difficulty:'L1', description:'It was... / Was it...?', knowledge_points:'It was stormy/humid/dry, 天气描述', ink_script_key:'past_state_weather' },
  { scene_title:'过去的动作', title:'昨天做了什么', prompt_en:'What did you do yesterday?', prompt_zh:'你昨天做了什么？', duration_sec:900, difficulty:'L1', description:'不规则动词 went/ate/had', knowledge_points:'went, ate, had, saw, said, got, took, came, gave, drank', ink_script_key:'past_action_yday' },
  { scene_title:'过去的动作', title:'不规则动词专项', prompt_en:'Can you use irregular past tense?', prompt_zh:'你会用不规则动词过去式吗？', duration_sec:900, difficulty:'L1', description:'第二组不规则动词', knowledge_points:'knew, thought, told, found, left, felt, sat, stood, ran, wrote', ink_script_key:'past_action_irreg' },
  { scene_title:'过去的动作', title:'规则动词 -ed', prompt_en:'How do you form regular past tense?', prompt_zh:'规则动词过去式怎么变？', duration_sec:900, difficulty:'L1', description:'规则动词 -ed 三种发音', knowledge_points:'worked, watched, cooked, helped, walked, talked, liked, finished, washed, brushed', ink_script_key:'past_action_reged' },
  { scene_title:'过去的动作', title:'过去的时间表达', prompt_en:'When did it happen?', prompt_zh:'什么时候发生的？', duration_sec:900, difficulty:'L1', description:'过去时间表达', knowledge_points:'the day before yesterday, a while ago, back then, in those days', ink_script_key:'past_action_time' },
  { scene_title:'过去的动作', title:'过去频率', prompt_en:'How often did you do it?', prompt_zh:'你过去多久做一次？', duration_sec:900, difficulty:'L1', description:'过去频率表达', knowledge_points:'whenever, each time, every time, most days, all the time, once in a while', ink_script_key:'past_action_freq' },
  { scene_title:'讲述经历', title:'上个周末/去年', prompt_en:'What did you do last weekend?', prompt_zh:'你上个周末做了什么？', duration_sec:900, difficulty:'L1', description:'Last weekend/Last year + 过去式', knowledge_points:'visited, stayed, cleaned, traveled, moved, started, learned, drove, flew', ink_script_key:'past_exp_weekend' },
  { scene_title:'讲述经历', title:'ago 表达', prompt_en:'How long ago was it?', prompt_zh:'多久以前？', duration_sec:900, difficulty:'L1', description:'时间段 + ago', knowledge_points:'ago, earlier, shortly, promptly, swiftly, rapidly, momentarily, unexpectedly', ink_script_key:'past_exp_ago' },
  { scene_title:'讲述经历', title:'某年某事', prompt_en:'What happened in that year?', prompt_zh:'那年发生了什么？', duration_sec:900, difficulty:'L1', description:'in 年份 + 过去式', knowledge_points:'raised, grew up, attended, joined, retired, resigned, promoted, transferred, enrolled', ink_script_key:'past_exp_year' },
  { scene_title:'讲述经历', title:'否定句 didn\'t', prompt_en:"What didn't you do?", prompt_zh:'你没做什么？', duration_sec:900, difficulty:'L1', description:"didn't + 动词原形", knowledge_points:"didn't, nowhere, none, whatsoever, negative", ink_script_key:'past_exp_neg' },
  { scene_title:'讲述经历', title:'疑问句 Did', prompt_en:'Did you...? Ask about the past.', prompt_zh:'用 Did 问过去的事。', duration_sec:900, difficulty:'L1', description:'Did...? / When did...?', knowledge_points:'did, whose, whom, whatever, however', ink_script_key:'past_exp_did' },
  { scene_title:'完成时入门', title:'去过/做过', prompt_en:'Have you ever been to...?', prompt_zh:'你去过...吗？', duration_sec:900, difficulty:'L1', description:'have been to / have + 过去分词', knowledge_points:'been, gone, done, seen, eaten, taken, driven, written, spoken, broken', ink_script_key:'past_perf_been' },
  { scene_title:'完成时入门', title:'刚刚/还没', prompt_en:'Have you just...? Not yet?', prompt_zh:'你刚刚...？还没？', duration_sec:900, difficulty:'L1', description:'just / yet / already', knowledge_points:'so far, up to now, until now, by now, lately, recently, prior', ink_script_key:'past_perf_yet' },
  { scene_title:'完成时入门', title:'持续多久', prompt_en:'How long have you...?', prompt_zh:'你...多久了？', duration_sec:900, difficulty:'L1', description:'for / since', knowledge_points:'for, since, during, over, within, beyond, until, till, throughout', ink_script_key:'past_perf_for' },
  { scene_title:'完成时入门', title:'ever/never', prompt_en:'Have you ever...?', prompt_zh:'你曾经...吗？', duration_sec:900, difficulty:'L1', description:'Have you ever...? / I have never...', knowledge_points:'ever, hardly ever, rarely ever, multiple, numerous, countless, infinite, endless, unlimited', ink_script_key:'past_perf_ever' },
  { scene_title:'完成时入门', title:'完成时混合表达', prompt_en:'What is the best thing you have ever done?', prompt_zh:'你做过的最棒的事是什么？', duration_sec:900, difficulty:'L1', description:'最高级 + I have ever...', knowledge_points:'the best, the worst, the most, the least, the first, the last, the only', ink_script_key:'past_perf_best' },
  { scene_title:'过去与现在对比', title:'回忆过去', prompt_en:'What do you remember?', prompt_zh:'你记得过去的什么？', duration_sec:900, difficulty:'L1', description:'I remember when...', knowledge_points:'memory, childhood, youth, era, decade, century, milestone, nostalgia, reminisce, flashback', ink_script_key:'past_comp_memory' },
  { scene_title:'过去与现在对比', title:'used to 习惯', prompt_en:'What did you use to do?', prompt_zh:'你过去习惯做什么？', duration_sec:900, difficulty:'L1', description:'used to / didn\'t use to', knowledge_points:'used, at first, in the beginning, once upon a time, yesteryear', ink_script_key:'past_comp_usedto' },
  { scene_title:'过去与现在对比', title:'生活变化', prompt_en:'How has your life changed?', prompt_zh:'你的生活怎么变了？', duration_sec:900, difficulty:'L1', description:'have changed / have grown', knowledge_points:'mature, evolve, transform, adapt, adjust, deteriorate, restore, rebuild, renew, revive', ink_script_key:'past_comp_change' },
  { scene_title:'过去与现在对比', title:'今昔对比', prompt_en:'How was life before? Now?', prompt_zh:'以前的生活怎样？现在呢？', duration_sec:900, difficulty:'L1', description:'Life was... Now...', knowledge_points:'simpler, busier, wealthier, healthier, lonelier, happier, tougher, gentler, safer, poorer', ink_script_key:'past_comp_thennow' },
  { scene_title:'过去与现在对比', title:'今昔综合表达', prompt_en:'Looking back, what do you realize?', prompt_zh:'回顾过去，你意识到什么？', duration_sec:900, difficulty:'L1', description:'综合过去时与完成时', knowledge_points:'presently, these days, in modern times, generation, contemporary, traditional, historic, ancient', ink_script_key:'past_comp_lookback' },
];

// ===== CHUNKS (72) mapped to topics =====
const chunkData = [
  // Scene A - 第1课 (7 chunks) → Topic 01-03
  {tp:0, cat:'核心句块', text:'I was a student last year.', meaning:'我去年是学生。', desc:'was + 职业身份'},
  {tp:0, cat:'核心句块', text:'He was very shy before.', meaning:'他以前很害羞。', desc:'was + 形容词描述'},
  {tp:0, cat:'核心句块', text:'They were at home yesterday.', meaning:'他们昨天在家。', desc:'were + 地点'},
  {tp:0, cat:'核心句块', text:'I had a dog when I was a child.', meaning:'我小时候有一只狗。', desc:'had + 拥有物'},
  {tp:0, cat:'核心句块', text:'She had long hair last year.', meaning:'她去年是长发。', desc:'had + 特征'},
  {tp:0, cat:'核心句块', text:'It was a nice day yesterday.', meaning:'昨天天气很好。', desc:'It was + 天气'},
  {tp:0, cat:'核心句块', text:'I was happy with the result.', meaning:'我对结果很满意。', desc:'I was + 感受'},
  // 第2课 (7)→ Topics 01-04
  {tp:1, cat:'核心句块', text:'I was at the office all day.', meaning:'我一整天都在办公室。', desc:'was at + 地点'},
  {tp:1, cat:'核心句块', text:'Were you at home last night? — Yes, I was.', meaning:'你昨晚在家吗？——在。', desc:'Were you...? 问答'},
  {tp:1, cat:'核心句块', text:'Was she at the party? — No, she wasn\'t.', meaning:'她在派对上吗？——不在。', desc:'Was he/she...? 否定回答'},
  {tp:1, cat:'核心句块', text:'How was your weekend? — It was great!', meaning:'你周末怎么样？——很棒！', desc:'How was...? 问答'},
  {tp:1, cat:'核心句块', text:'The movie was really boring.', meaning:'那部电影真的很无聊。', desc:'The ___ was ___ 评价'},
  {tp:1, cat:'核心句块', text:'Was it cold yesterday?', meaning:'昨天冷吗？', desc:'Was it...? 天气'},
  {tp:1, cat:'核心句块', text:'Where were you last night? — I was at home.', meaning:'你昨晚在哪？——在家。', desc:'Where were you...?'},
  // Scene B - 第3课 (7)→ Topics 05-06
  {tp:5, cat:'核心句块', text:'I got up at 8 yesterday.', meaning:'我昨天 8 点起床。', desc:'got up at + 时间'},
  {tp:5, cat:'核心句块', text:'I went to the supermarket.', meaning:'我去了超市。', desc:'went to + 地点'},
  {tp:5, cat:'核心句块', text:'I ate noodles for lunch.', meaning:'我午饭吃了面条。', desc:'ate + 食物'},
  {tp:5, cat:'核心句块', text:'I watched a movie last night.', meaning:'我昨晚看了一部电影。', desc:'规则动词 -ed'},
  {tp:5, cat:'核心句块', text:'I played basketball with my friends.', meaning:'我和朋友打了篮球。', desc:'played with'},
  {tp:5, cat:'核心句块', text:'I studied for two hours.', meaning:'我学习了两个小时。', desc:'studied for + 时长'},
  {tp:5, cat:'核心句块', text:'I cooked dinner for my family.', meaning:'我给家人做了晚饭。', desc:'cooked for'},
  // 第4课 (8)→ Topics 06-08
  {tp:6, cat:'核心句块', text:'I saw a friend at the mall.', meaning:'我在商场看到一个朋友。', desc:'see→saw'},
  {tp:6, cat:'核心句块', text:'She said hello to me.', meaning:'她跟我打了招呼。', desc:'say→said'},
  {tp:6, cat:'核心句块', text:'I got a new phone last week.', meaning:'我上周买了新手机。', desc:'get→got'},
  {tp:6, cat:'核心句块', text:'He made a big cake for the party.', meaning:'他为派对做了大蛋糕。', desc:'make→made'},
  {tp:6, cat:'核心句块', text:'I did my homework after school.', meaning:'我放学后做了作业。', desc:'do→did'},
  {tp:6, cat:'核心句块', text:'We had a great time at the beach.', meaning:'我们在海滩玩得很开心。', desc:'have→had'},
  {tp:6, cat:'核心句块', text:'She took a lot of photos.', meaning:'她拍了很多照片。', desc:'take→took'},
  {tp:6, cat:'核心句块', text:'He came home very late.', meaning:'他很晚才回家。', desc:'come→came'},
  // Scene C - 第5课 (7)→ Topics 10-12
  {tp:10, cat:'核心句块', text:'Last weekend I visited my grandparents.', meaning:'上周末我看望了祖父母。', desc:'Last weekend'},
  {tp:10, cat:'核心句块', text:'Last year I traveled to Japan.', meaning:'去年我去了日本旅行。', desc:'Last year'},
  {tp:11, cat:'核心句块', text:'I lived in Shanghai two years ago.', meaning:'两年前我住在上海。', desc:'ago 表达'},
  {tp:11, cat:'核心句块', text:'I started this job three months ago.', meaning:'我三个月前开始这份工作。', desc:'started ... ago'},
  {tp:12, cat:'核心句块', text:'We moved to this city in 2018.', meaning:'我们 2018 年搬到了这个城市。', desc:'in 年份'},
  {tp:12, cat:'核心句块', text:'I met my best friend in college.', meaning:'我在大学认识了好朋友。', desc:'met in/at'},
  {tp:12, cat:'核心句块', text:'She started learning English when she was 10.', meaning:'她 10 岁开始学英语。', desc:'started when'},
  // 第6课 (7)→ Topics 13-14
  {tp:13, cat:'核心句块', text:"I didn't go to school yesterday. I was sick.", meaning:'我昨天没去上学。', desc:"didn't + 原形"},
  {tp:13, cat:'核心句块', text:"She didn't like the movie. She said it was boring.", meaning:'她不喜欢那部电影。', desc:"didn't like"},
  {tp:14, cat:'核心句块', text:'Did you have a good weekend? — Yes, I did!', meaning:'你周末过得好吗？——很好！', desc:'Did you...? 肯定'},
  {tp:14, cat:'核心句块', text:'Did she call you yesterday? — No, she didn\'t.', meaning:'她昨天给你打电话了吗？——没有。', desc:'Did she...? 否定'},
  {tp:14, cat:'核心句块', text:'When did you arrive? — I arrived at 3 pm.', meaning:'你什么时候到的？——下午3点。', desc:'When did...?'},
  {tp:14, cat:'核心句块', text:'Where did you go last night? — I went to a concert.', meaning:'你昨晚去哪了？——我去了一场音乐会。', desc:'Where did...?'},
  {tp:14, cat:'核心句块', text:'What did you do yesterday? — I stayed home.', meaning:'你昨天做了什么？——我在家。', desc:'What did...?'},
  // Scene D - 第7课 (8)→ Topics 15-16
  {tp:15, cat:'核心句块', text:'I have been to Beijing.', meaning:'我去过北京。', desc:'have been to'},
  {tp:15, cat:'核心句块', text:'Have you ever been to Shanghai? — Yes, I have.', meaning:'你去过上海吗？——去过。', desc:'Have you ever been to...?'},
  {tp:15, cat:'核心句块', text:'I have never tried hot pot.', meaning:'我从来没试过火锅。', desc:'have never...'},
  {tp:15, cat:'核心句块', text:'She has seen that movie three times.', meaning:'那部电影她看过三次了。', desc:'has seen + 次数'},
  {tp:15, cat:'核心句块', text:'Have you finished your homework? — Yes, I have.', meaning:'你做完作业了吗？——做完了。', desc:'Have you finished...?'},
  {tp:15, cat:'核心句块', text:'I have lost my keys! Do you see them?', meaning:'我钥匙丢了！你看到了吗？', desc:'have lost'},
  {tp:15, cat:'核心句块', text:'She has already left the office.', meaning:'她已经离开办公室了。', desc:'has already...'},
  {tp:16, cat:'核心句块', text:'I have just arrived at the station.', meaning:'我刚到车站。', desc:'have just...'},
  // 第8课 (8)→ Topics 16-19
  {tp:16, cat:'核心句块', text:"I haven't eaten lunch yet.", meaning:'我还没吃午饭。', desc:"haven't ... yet"},
  {tp:16, cat:'核心句块', text:'Have you eaten yet? — No, not yet.', meaning:'你吃了吗？——还没。', desc:'Have you ... yet?'},
  {tp:17, cat:'核心句块', text:'I have lived here for five years.', meaning:'我在这里住了五年了。', desc:'for + 时间段'},
  {tp:17, cat:'核心句块', text:'She has worked here since 2020.', meaning:'她 2020 年以来一直在这里工作。', desc:'since + 起点'},
  {tp:17, cat:'核心句块', text:'How long have you been here? — For about an hour.', meaning:'你在这里多久了？——大约一小时。', desc:'How long have you...?'},
  {tp:19, cat:'核心句块', text:'This is the best movie I have ever seen!', meaning:'这是我看过的最好的电影！', desc:'最高级+完成时'},
  {tp:19, cat:'核心句块', text:'I have been to Japan. I went there last year.', meaning:'我去过日本。我去年去的。', desc:'完成时 vs 过去时'},
  // Scene E - 第9课 (7)→ Topics 20-21
  {tp:20, cat:'核心句块', text:'I remember when I was a child, I played outside every day.', meaning:'我记得小时候每天都在外面玩。', desc:'I remember when...'},
  {tp:20, cat:'核心句块', text:'Those were the good old days.', meaning:'那些是美好的旧时光。', desc:'good old days'},
  {tp:21, cat:'核心句块', text:'I used to play the piano, but now I don\'t.', meaning:'我以前弹钢琴，但现在不弹了。', desc:'used to, but now'},
  {tp:21, cat:'核心句块', text:'She used to have long hair, but now she has short hair.', meaning:'她以前留长发，但现在剪短了。', desc:'used to have, but now'},
  {tp:21, cat:'核心句块', text:"I didn't use to like vegetables, but now I love them.", meaning:'我以前不喜欢吃蔬菜，但现在很喜欢。', desc:"didn't use to"},
  {tp:21, cat:'核心句块', text:'Did you use to live here? — Yes, I did.', meaning:'你以前住这里吗？——是的。', desc:'Did you use to...?'},
  {tp:21, cat:'核心句块', text:'Life was simpler before. Now everything is so fast.', meaning:'以前生活更简单。现在一切都太快了。', desc:'Life was... Now...'},
  // 第10课 (7)→ Topics 22-24
  {tp:22, cat:'核心句块', text:'When I was young, I stayed up late. Now I go to bed early.', meaning:'我年轻时熬夜。现在我早睡。', desc:'When I was..., Now I...'},
  {tp:22, cat:'核心句块', text:'I always watched TV after school when I was a kid.', meaning:'我小时候放学总看电视。', desc:'I always... when I was'},
  {tp:22, cat:'核心句块', text:'I have changed a lot since then.', meaning:'从那时起我变了很多。', desc:'have changed since'},
  {tp:22, cat:'核心句块', text:'Things have changed so much in the past ten years.', meaning:'过去十年变化太大了。', desc:'have changed so much'},
  {tp:23, cat:'核心句块', text:"There used to be a park here, but now it's a shopping mall.", meaning:'这里以前是个公园，现在成了购物中心。', desc:'There used to be...but now'},
  {tp:23, cat:'核心句块', text:"I used to think this was difficult, but now I know it's easy.", meaning:'我以前觉得这很难，现在知道很简单。', desc:'I used to think...but now I know'},
  {tp:24, cat:'核心句块', text:'Looking back, I realize how much I have grown.', meaning:'回望过去，我意识到自己成长了多少。', desc:'Looking back, I realize'},
];

// ===== PATTERNS (55) =====
const patternData = [
  {tp:0,pattern:'I was ___.',meaning:'我过去是/在___',slots:'a student / happy / at home / tired / sick',example:'I was a student last year.'},
  {tp:0,pattern:'He/She was ___.',meaning:'他/她过去___',slots:'shy / tall / at work / late / kind / busy',example:'He was very shy before.'},
  {tp:0,pattern:'They were ___.',meaning:'他们过去在/是___',slots:'at home / happy / busy / tired / students',example:'They were at home yesterday.'},
  {tp:0,pattern:'It was ___.',meaning:'那时候___',slots:'a nice day / cold / fun / great / rainy / hot',example:'It was a nice day yesterday.'},
  {tp:0,pattern:'I had ___.',meaning:'我过去有___',slots:'a dog / a car / a bike / long hair / a cold',example:'I had a dog when I was a child.'},
  {tp:0,pattern:'She had ___.',meaning:'她过去有/是___',slots:'short hair / glasses / a meeting / a dream',example:'She had long hair last year.'},
  {tp:0,pattern:'Were you ___? — Yes, I was. / No, I wasn\'t.',meaning:'你那时___吗？',slots:'at home / tired / busy / late / happy',example:'Were you at home last night?'},
  {tp:0,pattern:'Was he/she ___? — Yes, he/she was.',meaning:'他/她那时___吗？',slots:'at the party / in class / on time / sick',example:'Was she at the party?'},
  {tp:0,pattern:'How was ___? — It was ___.',meaning:'___怎么样？',slots:'your weekend / great / the movie / boring / your day / good',example:'How was your weekend? — It was great!'},
  {tp:0,pattern:'The ___ was ___.',meaning:'那个___很___',slots:'movie / boring / food / delicious / party / fun',example:'The movie was really boring.'},
  {tp:0,pattern:'Where were you ___?',meaning:'你___在哪？',slots:'yesterday / last night / at 8 pm / last weekend',example:'Where were you last night? — I was at home.'},
  {tp:5,pattern:'I ___ at ___.',meaning:'我___在___',slots:'got up / 8 / went to bed / 11 / left / 7',example:'I got up at 8 yesterday.'},
  {tp:5,pattern:'I went to ___.',meaning:'我去了___',slots:'the supermarket / the park / a restaurant / work / school',example:'I went to the supermarket.'},
  {tp:5,pattern:'I ate ___ for ___.',meaning:'我___吃了___',slots:'noodles / lunch / rice / dinner / bread / breakfast',example:'I ate noodles for lunch.'},
  {tp:5,pattern:'I ___ed ___ last ___.',meaning:'我昨晚___了___',slots:'watched / a movie / night / played / basketball / weekend',example:'I watched a movie last night.'},
  {tp:5,pattern:'I ___ed ___ with ___.',meaning:'我和___一起___了___',slots:'played / basketball / my friends / cooked / dinner / my family',example:'I played basketball with my friends.'},
  {tp:6,pattern:'I saw ___ at ___.',meaning:'我在___看到___',slots:'a friend / the mall / my teacher / school / him / the party',example:'I saw a friend at the mall.'},
  {tp:6,pattern:'She said ___.',meaning:'她说了___',slots:'hello / goodbye / thank you / sorry / nothing / yes',example:'She said hello to me.'},
  {tp:6,pattern:'He made ___.',meaning:'他做了___',slots:'a cake / dinner / a mistake / a phone call / a plan',example:'He made a big cake for the party.'},
  {tp:6,pattern:'I did ___.',meaning:'我做了___',slots:'my homework / the dishes / exercise / my best / nothing',example:'I did my homework after school.'},
  {tp:6,pattern:'We had ___.',meaning:'我们有/度过了___',slots:'a great time / a meeting / lunch / fun / a party',example:'We had a great time at the beach.'},
  {tp:6,pattern:'She took ___.',meaning:'她___了___',slots:'a lot of photos / a taxi / a break / the bus / a shower',example:'She took a lot of photos.'},
  {tp:10,pattern:'Last weekend I ___.',meaning:'上周末我___',slots:'visited my grandparents / stayed home / went shopping / cleaned my room',example:'Last weekend I visited my grandparents.'},
  {tp:10,pattern:'Last year I ___.',meaning:'去年我___',slots:'traveled to Japan / started a new job / moved to Beijing / learned to drive',example:'Last year I traveled to Japan.'},
  {tp:11,pattern:'I ___ ___ ago.',meaning:'我___前___',slots:'lived in Shanghai / two years / started this job / three months',example:'I lived in Shanghai two years ago.'},
  {tp:12,pattern:'We moved to ___ in ___.',meaning:'我们___年搬到了___',slots:'Beijing / 2015 / this apartment / last month / this city / 2020',example:'We moved to this city in 2018.'},
  {tp:12,pattern:'She started ___ when she was ___.',meaning:'她___岁时开始___',slots:'learning English / 10 / playing piano / 6 / working here / 2020',example:'She started learning English when she was 10.'},
  {tp:12,pattern:'I met ___ in/at ___.',meaning:'我在___认识了___',slots:'my best friend / college / my wife / work / him / a party',example:'I met my best friend in college.'},
  {tp:13,pattern:"I didn't ___.",meaning:'我没有___',slots:'go to school / eat breakfast / sleep well / watch TV / call her',example:"I didn't go to school yesterday."},
  {tp:13,pattern:"She didn't ___.",meaning:'她没有___',slots:'like the movie / come to class / call me / eat anything',example:"She didn't like the movie."},
  {tp:14,pattern:'Did you ___? — Yes, I did. / No, I didn\'t.',meaning:'你___了吗？',slots:'have a good weekend / eat lunch / finish work / call her',example:'Did you have a good weekend? — Yes, I did!'},
  {tp:14,pattern:'Did she ___? — Yes, she did. / No, she didn\'t.',meaning:'她___了吗？',slots:'call you / come to class / bring the book / tell you the news',example:'Did she call you yesterday?'},
  {tp:14,pattern:'When did you ___? — I ___ at ___.',meaning:'你什么时候___的？',slots:'arrive / arrived / 3 / leave / left / 5 / start / started / 9',example:'When did you arrive? — I arrived at 3 pm.'},
  {tp:14,pattern:'Where did you ___? — I ___ to ___.',meaning:'你在哪里___的？',slots:'go / went / a concert / eat / ate / a restaurant',example:'Where did you go last night? — I went to a concert.'},
  {tp:14,pattern:'What did you ___? — I ___.',meaning:'你___了什么？',slots:'do yesterday / stayed home / eat for breakfast / had toast',example:'What did you do yesterday? — I stayed home.'},
  {tp:15,pattern:'I have been to ___.',meaning:'我去过___',slots:'Beijing / Japan / the US / Hong Kong / three countries / abroad',example:'I have been to Beijing.'},
  {tp:15,pattern:'Have you ever been to ___? — Yes, I have. / No, I haven\'t.',meaning:'你去过___吗？',slots:'Shanghai / Paris / a concert / this restaurant / abroad',example:'Have you ever been to Shanghai?'},
  {tp:15,pattern:'I have never ___.',meaning:'我从来没___过',slots:'been abroad / driven a car / seen snow / eaten Indian food / tried it',example:'I have never tried hot pot.'},
  {tp:15,pattern:'Have you ___? — Yes, I have. / Not yet.',meaning:'你___了吗？',slots:'finished your homework / eaten / called her / seen this / decided',example:'Have you finished your homework?'},
  {tp:15,pattern:'She has already ___.',meaning:'她已经___了',slots:'left / finished / eaten / called / gone home / paid the bill',example:'She has already left the office.'},
  {tp:16,pattern:'I have just ___.',meaning:'我刚___',slots:'arrived / finished / eaten / heard the news / talked to him / seen her',example:'I have just arrived at the station.'},
  {tp:16,pattern:"I haven't ___ yet.",meaning:'我还没___',slots:'eaten lunch / decided / finished / told him / started / gotten a reply',example:"I haven't eaten lunch yet."},
  {tp:17,pattern:'I have ___ for ___.',meaning:'我已经___了___',slots:'lived here / five years / worked here / three years / known her / a long time',example:'I have lived here for five years.'},
  {tp:17,pattern:'He/She has ___ since ___.',meaning:'他/她从___开始___',slots:'worked here / 2020 / been a teacher / 2018 / played piano / he was 6',example:'She has worked here since 2020.'},
  {tp:21,pattern:'I used to ___, but now I ___.',meaning:'我以前___，但现在___',slots:'play the piano / don\'t / live in a small town / live in the city',example:'I used to play the piano, but now I don\'t.'},
  {tp:21,pattern:'She used to ___, but now she ___.',meaning:'她以前___，但现在___',slots:'have long hair / has short hair / wear glasses / wears contacts / be shy / is outgoing',example:'She used to have long hair, but now she has short hair.'},
  {tp:21,pattern:"I didn't use to ___, but now I ___.",meaning:'我以前不___，但现在___',slots:'like vegetables / love them / get up early / do / drink coffee / drink tea',example:"I didn't use to like vegetables, but now I love them."},
  {tp:21,pattern:'Did you use to ___? — Yes, I did. / No, I didn\'t.',meaning:'你以前___吗？',slots:'live here / play soccer / study at this school / have a pet',example:'Did you use to live here? — Yes, I did.'},
  {tp:20,pattern:'I remember when I was a child, I ___ every day.',meaning:'我记得小时候每天都___',slots:'played outside / went fishing / rode my bike / watched cartoons',example:'I remember when I was a child, I played outside every day.'},
  {tp:22,pattern:'When I was ___, I ___. Now I ___.',meaning:'我___时___。现在我___。',slots:'young / stayed up late / go to bed early / a kid / was afraid / am not',example:'When I was young, I stayed up late. Now I go to bed early.'},
  {tp:22,pattern:'I always ___ when I was a ___.',meaning:'我___时总是___',slots:'watched TV / kid / played outside / child / studied hard / student',example:'I always watched TV after school when I was a kid.'},
  {tp:23,pattern:'Life was ___ before. Now ___.',meaning:'以前生活___。现在___。',slots:'simpler / everything is so fast / cheaper / prices are higher',example:'Life was simpler before. Now everything is so fast.'},
  {tp:23,pattern:"There used to be ___, but now it's ___.",meaning:'以前有___，现在变成___了',slots:'a park / a shopping mall / a cinema / a supermarket / a school / an apartment',example:"There used to be a park here, but now it's a shopping mall."},
  {tp:24,pattern:'I used to think ___, but now I know ___.',meaning:'我以前以为___，现在知道___',slots:'this was difficult / it\'s easy / he was unfriendly / he\'s nice',example:"I used to think this was difficult, but now I know it's easy."},
  {tp:24,pattern:'Things have changed so much in the past ___.',meaning:'过去___变化太大了',slots:'ten years / five years / few months / decade / century',example:'Things have changed so much in the past ten years.'},
];

// ===== CORE VOCABULARY (25 topics × ~10) =====
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

// ===== WRITE ALL CSVs =====
let csv;

// scenes.csv
csv = 'category_name,title,location,required_output_level,required_user_level,description,package_type\n';
scenes.forEach(s=>csv+=[s.category_name,s.title,s.location,s.required_output_level,s.required_user_level,q(s.description),s.package_type].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'scenes.csv'),csv);

// training_topics.csv
csv = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key\n';
topics.forEach(t=>csv+=[t.scene_title,t.title,q(t.prompt_en),q(t.prompt_zh),t.duration_sec,t.difficulty,q(t.description),q(t.knowledge_points),'',t.ink_script_key].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'training_topics.csv'),csv);

// chunks.csv
csv = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n';
chunkData.forEach(c=>{
  const t=topics[c.tp];
  csv+=[t.scene_title,t.title,c.cat,q(c.text),q(c.meaning),t.difficulty,q(c.desc),'[]'].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'chunks.csv'),csv);

// sentence_patterns.csv
csv = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order\n';
patternData.forEach((p,i)=>{
  const t=topics[p.tp];
  csv+=[t.scene_title,t.title,q(p.pattern),q(p.meaning),q(p.slots),q(p.example),t.difficulty,i].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'sentence_patterns.csv'),csv);

// scene_vocabulary.csv
csv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
let so=0;
coreVocab.forEach((vw,i)=>{
  const t=topics[Math.floor(i/10)];
  csv+=[t.scene_title,t.title,vw[0],vw[1],vw[2],'','',t.difficulty,'','[]',so++].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'scene_vocabulary.csv'),csv);

console.log('scenes:',scenes.length,'| topics:',topics.length,'| chunks:',chunkData.length,'| patterns:',patternData.length,'| vocab:',coreVocab.length);

// ===== EPISODES (10) =====
const episodes = [
  { chapter_id:1,chapter_title:'过去的状态',episode_order:1,title:'我以前是/有',scene_title:'过去的状态',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["掌握was/were肯定和否定"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'past_state_be',rewards_json:'{"xp":50}' },
  { chapter_id:1,chapter_title:'过去的状态',episode_order:2,title:'昨天在哪里/怎么样',scene_title:'过去的状态',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用was/were完成疑问和描述"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'past_state_where',rewards_json:'{"xp":50}' },
  { chapter_id:2,chapter_title:'过去的动作',episode_order:1,title:'昨天做了什么',scene_title:'过去的动作',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用不规则动词描述过去动作"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Lin',npc_role:'学员',is_preview:false,ink_script_key:'past_action_yday',rewards_json:'{"xp":50}' },
  { chapter_id:2,chapter_title:'过去的动作',episode_order:2,title:'不规则动词与规则-ed',scene_title:'过去的动作',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["区分不规则动词和规则-ed"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Ben',npc_role:'同事',is_preview:false,ink_script_key:'past_action_irreg',rewards_json:'{"xp":50}' },
  { chapter_id:3,chapter_title:'讲述经历',episode_order:1,title:'上个周末/去年',scene_title:'讲述经历',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用Last/ago/in年份讲述经历"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'past_exp_weekend',rewards_json:'{"xp":50}' },
  { chapter_id:3,chapter_title:'讲述经历',episode_order:2,title:'否定和疑问',scene_title:'讲述经历',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["掌握否定和Did问答"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Ben',npc_role:'同事',is_preview:false,ink_script_key:'past_exp_did',rewards_json:'{"xp":50}' },
  { chapter_id:4,chapter_title:'完成时入门',episode_order:1,title:'去过/做过',scene_title:'完成时入门',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用have been to表达经历"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'past_perf_been',rewards_json:'{"xp":50}' },
  { chapter_id:4,chapter_title:'完成时入门',episode_order:2,title:'刚刚/还没/多久了',scene_title:'完成时入门',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用just/yet/for/since完成完成时"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Lin',npc_role:'学员',is_preview:false,ink_script_key:'past_perf_yet',rewards_json:'{"xp":50}' },
  { chapter_id:5,chapter_title:'过去与现在对比',episode_order:1,title:'回忆过去/used to',scene_title:'过去与现在对比',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["用used to和remember对比过去"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'past_comp_memory',rewards_json:'{"xp":50}' },
  { chapter_id:5,chapter_title:'过去与现在对比',episode_order:2,title:'今昔对比',scene_title:'过去与现在对比',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:25,vocab_total_count:50,chunk_required_count:7,chunk_total_count:14,objectives_json:'["完成今昔对比综合表达"]',pass_objective_count:1,pass_chunk_count:5,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'past_comp_lookback',rewards_json:'{"xp":80}' },
];

// script_episodes.csv
csv = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
episodes.forEach(e=>csv+=[e.chapter_id,e.chapter_title,e.episode_order,e.title,e.scene_title,e.required_output_level,e.required_user_level,e.vocab_required_count,e.vocab_total_count,e.chunk_required_count,e.chunk_total_count,q(e.objectives_json),e.pass_objective_count,e.pass_chunk_count,e.pass_min_dialogues,e.npc_name,e.npc_role,e.is_preview,e.ink_script_key,q(e.rewards_json)].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'script_episodes.csv'),csv);

// episode_chunks.csv - map chunks to episodes based on topic indices
// Episode → topic ranges: Ep1=[0], Ep2=[1,2,3,4], Ep3=[5,6], Ep4=[7,8], Ep5=[10,11,12], Ep6=[13,14], Ep7=[15,16], Ep8=[17,18,19], Ep9=[20,21], Ep10=[22,23,24]
const epTopicMap = [
  [0], [1,2,3,4], [5,6], [7,8], [10,11,12], [13,14], [15,16], [17,18,19], [20,21], [22,23,24]
];
csv = 'episode_chapter,episode_order,chunk_text_match,sort_order\n';
episodes.forEach((ep, ei) => {
  const tps = epTopicMap[ei];
  let so = 0;
  chunkData.forEach(c => {
    if (tps.includes(c.tp)) {
      csv += [ep.chapter_id+'-'+ep.episode_order, ep.episode_order, q(c.text), so++].join(',') + '\n';
    }
  });
});
fs.writeFileSync(path.join(pkgDir,'episode_chunks.csv'),csv);

console.log('episodes:',episodes.length,'| ep_chunks generated');
console.log('✅ Doc6 ALL CSVs regenerated from MD!');
