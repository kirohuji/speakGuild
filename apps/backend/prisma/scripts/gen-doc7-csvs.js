const fs = require('fs');
const path = require('path');
const pkgDir = path.join(__dirname, '..', 'data', 'packages', 'foundation-7-future-modals');
const q = s => '"' + String(s).replace(/"/g, '""') + '"';

const scenes = [
  {cn:'将来时',title:'计划与预测',loc:'home/classroom',lvl:'L1~L2',ulvl:'beginner',desc:'be going to / will 的计划、预测和将来时间表达',pkg:'foundation'},
  {cn:'情态动词',title:'能力与请求',loc:'home/office',lvl:'L1~L2',ulvl:'beginner',desc:'can/could 的能力表达、请求帮助和请求许可',pkg:'foundation'},
  {cn:'情态动词',title:'建议与义务',loc:'home/office',lvl:'L1~L2',ulvl:'beginner',desc:'should/must/have to 的建议、义务、禁止和推荐',pkg:'foundation'},
  {cn:'情态综合',title:'情态综合与礼貌表达',loc:'social/restaurant',lvl:'L1~L2',ulvl:'beginner',desc:'may/might/would/shall 的可能、邀请、提议和礼貌回应',pkg:'foundation'},
  {cn:'社交沟通',title:'祝愿与承诺',loc:'social/events',lvl:'L1~L2',ulvl:'beginner',desc:'祝福、鼓励、承诺和意愿表达',pkg:'foundation'},
];

const topicNames = [
  {s:0,n:'我打算…',kp:'be going to + 计划动词',ik:'fx_plan_01'},
  {s:0,n:'将会怎样',kp:'will + 预测/状态',ik:'fx_plan_02'},
  {s:0,n:'将来时间表达',kp:'将来时间词',ik:'fx_plan_03'},
  {s:0,n:'计划疑问句',kp:'What/Are you going to...?',ik:'fx_plan_04'},
  {s:0,n:'预测与迹象',kp:'It is going to... Look at...',ik:'fx_plan_05'},
  {s:1,n:'我能/会',kp:'can/cant 能力表达',ik:'fx_ability_06'},
  {s:1,n:'请求帮助',kp:'Can you...?',ik:'fx_ability_07'},
  {s:1,n:'请求许可',kp:'Can I...? / May I...?',ik:'fx_ability_08'},
  {s:1,n:'Can/Could礼貌程度',kp:'Could you...? 礼貌梯度',ik:'fx_ability_09'},
  {s:1,n:'能力程度表达',kp:'can...very well',ik:'fx_ability_10'},
  {s:2,n:'你应该/必须',kp:'should/must 建议与义务',ik:'fx_duty_11'},
  {s:2,n:'客观义务',kp:'have to / has to',ik:'fx_duty_12'},
  {s:2,n:'禁止与不必',kp:'mustnt / dont have to',ik:'fx_duty_13'},
  {s:2,n:'建议疑问句',kp:'Should I...? / What should I...?',ik:'fx_duty_14'},
  {s:2,n:'推荐表达',kp:'You should try...',ik:'fx_duty_15'},
  {s:3,n:'可能 may/might',kp:'It may... / She might...',ik:'fx_modal_16'},
  {s:3,n:'邀请与提议',kp:'Would you like...?',ik:'fx_modal_17'},
  {s:3,n:'主动提供',kp:'Shall I...? / Let me...',ik:'fx_modal_18'},
  {s:3,n:'委婉提议',kp:'How about...? / Why dont we...?',ik:'fx_modal_19'},
  {s:3,n:'礼貌接受与拒绝',kp:'Id love to / Thanks, but...',ik:'fx_modal_20'},
  {s:4,n:'祝福用语',kp:'Good luck! / Have a great...!',ik:'fx_wish_21'},
  {s:4,n:'承诺与保证',kp:'I promise / swear / guarantee',ik:'fx_wish_22'},
  {s:4,n:'提供帮助',kp:'Id be happy to / Let me know',ik:'fx_wish_23'},
  {s:4,n:'鼓励与支持',kp:'I believe in you / Keep going!',ik:'fx_wish_24'},
  {s:4,n:'意愿表达与社交祝愿',kp:'Im willing to / Congratulations!',ik:'fx_wish_25'},
];

const topics = topicNames.map(d => ({
  scene_title: scenes[d.s].title, title: d.n,
  prompt_en: 'Practice', prompt_zh: '练习', duration_sec: 900,
  difficulty: 'L1~L2', description: d.kp, knowledge_points: d.kp,
  teaching_markdown: '', ink_script_key: d.ik,
}));

const chunks = [
  [0,"I'm going to travel next month.",'我下个月打算去旅行。'],
  [0,"What are you going to do this weekend? — I'm going to visit my parents.",'你这周末打算做什么？'],
  [0,'Are you going to join us? — Yes, I am.','你要加入我们吗？'],
  [0,"I'll call you later.",'我晚点打给你。'],
  [0,'I will study harder this year.','我今年会更努力学习。'],
  [0,"I think I'll stay home today.",'我觉得我今天会待在家。'],
  [0,"She's going to have a baby.",'她快要生孩子了。'],
  [1,'It will rain tomorrow.','明天会下雨。'],
  [1,"It's going to rain. Look at those clouds!",'要下雨了。看那些云！'],
  [1,'I will be 25 next month.','我下个月就 25 岁了。'],
  [1,'Everything will be okay.','一切都会好起来的。'],
  [1,'The meeting will start at 3 pm.','会议下午 3 点开始。'],
  [1,'He will probably be late.','他可能会迟到。'],
  [1,'There will be a lot of people at the concert.','音乐会上会有很多人。'],
  [5,'I can swim.','我会游泳。'],
  [5,"I can't speak French.",'我不会说法语。'],
  [5,'He can run very fast.','他能跑得非常快。'],
  [5,"I can't find my keys.",'我找不到我的钥匙了。'],
  [6,'Can you help me? — Sure.','你能帮我吗？'],
  [7,'Can I use your phone? — Yes, of course.','我可以用你的手机吗？'],
  [7,'Can I have a glass of water? — Here you go.','我可以要一杯水吗？'],
  [8,'You can do it! I believe in you.','你能做到的！我相信你。'],
  [8,'You can park over there.','你可以在那边停车。'],
  [8,'Could you tell me how to get to the museum?','您能告诉我去博物馆怎么走吗？'],
  [8,'Could I have the bill, please?','请给我账单好吗？'],
  [8,'Could you speak more slowly, please?','您能说慢一点吗？'],
  [8,'Can I try this on?','我能试穿吗？'],
  [8,'Can I get a receipt, please?','能给我一张收据吗？'],
  [10,'You should see a doctor.','你应该去看医生。'],
  [10,"You shouldn't eat so much junk food.",'你不该吃那么多垃圾食品。'],
  [10,'You must wear a seatbelt in the car.','你在车里必须系安全带。'],
  [11,'I have to work tomorrow.','我明天必须上班。'],
  [11,'She has to take medicine every day.','她每天必须吃药。'],
  [11,'Do I have to bring my passport? — Yes, you do.','我必须带护照吗？'],
  [10,"We must be there by 8 o'clock.",'我们必须在8点前到。'],
  [12,"You mustn't park here.",'你不能在这里停车。'],
  [12,"I don't have to work on Sundays.",'我周日不必上班。'],
  [12,"You don't have to pay now. You can pay later.",'你不必现在付钱。'],
  [14,"You should try this dish. It's really good!",'你应该尝尝这道菜。'],
  [13,'What should I do? — You should call the police.','我该怎么办？'],
  [13,"I should go now. It's getting late.",'我该走了。'],
  [13,'Should I take a taxi or the subway?','我该打车还是坐地铁？'],
  [15,'It may rain later. Take an umbrella.','晚点可能会下雨。'],
  [15,"She might come to the party. I'm not sure.",'她可能会来派对。'],
  [15,'May I come in? — Yes, please.','我可以进来吗？'],
  [16,'Would you like some coffee? — Yes, please.','您要来点咖啡吗？'],
  [16,"Would you like to join us for dinner? — I'd love to!",'你愿意和我们一起吃饭吗？'],
  [16,'What would you like to drink? — Water, please.','您想喝点什么？'],
  [17,'Will you help me with this? — Sure, no problem.','你能帮我弄一下这个吗？'],
  [17,'Do you think I should go to the doctor?','你觉得我该去看医生吗？'],
  [18,'Shall I open the window? — Yes, please.','要我开窗吗？'],
  [18,'Let me help you with that.','让我帮你吧。'],
  [18,"Would you like to join us? — I'd love to!",'你想加入我们吗？'],
  [18,"Would you like some more tea? — Thanks, but I'm full.",'再来点茶吗？谢谢，饱了。'],
  [19,'How about going out for a walk? — Sounds great!','出去走走怎么样？'],
  [19,"Why don't we try that new restaurant? — Good idea!",'试试那家新餐厅？'],
  [19,'That sounds great! — Thank you for inviting me.','听起来很棒！谢谢邀请。'],
  [19,"I'd be happy to help. Just let me know if you need anything.",'我很乐意帮忙。'],
  [17,"Everything will be okay. Don't worry.",'一切都会好的。别担心。'],
  [17,"I'm going to travel next month. I will visit Japan.",'我下月旅行。会去日本。'],
  [20,"Good luck on your test! You'll do great.",'祝你考试好运！'],
  [20,'Have a great trip! I hope you have fun!','旅途愉快！'],
  [20,'Happy birthday! I hope you have a wonderful day!','生日快乐！'],
  [20,'Congratulations on your new job!','恭喜新工作！'],
  [20,'I believe in you. You can do it!','我相信你。你能做到！'],
  [20,"Keep going! Don't give up!",'继续加油！别放弃！'],
  [21,"I promise I'll be there on time.",'我保证准时到。'],
  [21,"I swear I won't tell anyone.",'我发誓不会告诉任何人。'],
  [22,"I'd be happy to help you with your project.",'我很乐意帮你做项目。'],
  [22,"I'm willing to try new things.",'我愿意尝试新事物。'],
  [22,'Let me know if you need anything.','如果你需要什么，告诉我。'],
];

const patterns = [
  [0,"I'm going to ___.",'打算','travel / study / buy / move','Im going to travel next month.'],
  [0,'What are you going to ___?','问打算','do / eat / wear / buy','What are you going to do this weekend?'],
  [0,'Are you going to ___? — Yes, I am.','确认计划','come / stay / join','Are you going to join us?'],
  [0,"I'll ___.",'即时决定','call you / be right back / see you',"Ill call you later."],
  [0,'I will ___.','决心','study harder / try my best','I will study harder.'],
  [0,"She's going to ___.",'即将发生','have a baby / start a job / graduate',"Shes going to have a baby."],
  [0,'It will ___ tomorrow.','预测','rain / snow / be hot','It will rain tomorrow.'],
  [0,"It's going to ___. Look at ___.",'迹象预测','rain / those clouds / snow / the sky',"Its going to rain."],
  [0,'I will be ___.','将来状态','25 / there / ready / on time','I will be 25 next month.'],
  [0,'Everything will be ___.','安慰','okay / fine / great / better','Everything will be okay.'],
  [0,'The ___ will start at ___.','安排','meeting / 3 pm / class / 9 am','The meeting will start at 3 pm.'],
  [0,'He will probably ___.','不确定预测','be late / come / call','He will probably be late.'],
  [0,'There will be ___.','将来存在','people / a test / free food','There will be a lot of people.'],
  [5,'I can ___.','能力','swim / speak English / drive','I can swim.'],
  [5,"I can't ___.",'不会','speak French / sing / dance',"I can't speak French."],
  [5,'She can ___ very ___.','程度','sing / well / draw / fast','She can sing very well.'],
  [6,'Can you ___? — Sure.','请求帮助','help / open / pass / wait','Can you help me?'],
  [7,'Can I ___? — Yes, of course.','请求许可','use / sit / come in / borrow','Can I use your phone?'],
  [7,'Can I have ___? — Here you go.','请求物品','water / menu / time','Can I have a glass of water?'],
  [8,'You can ___.','鼓励/许可','do it / park / sit','You can do it!'],
  [8,'Could you tell me how to get to ___?','礼貌问路','museum / airport / station','Could you tell me how to get to the museum?'],
  [8,'Could I have ___, please?','极礼貌请求','bill / water / menu / receipt','Could I have the bill, please?'],
  [8,'Could you ___?','礼貌请求','speak slowly / repeat / wait','Could you speak more slowly?'],
  [8,'Can I try ___ on?','试穿','jacket / shoes / dress / hat','Can I try this on?'],
  [10,'You should ___.','建议','see a doctor / rest / study','You should see a doctor.'],
  [10,"You shouldn't ___.",'不建议','eat junk / stay up / worry',"You shouldn't eat so much junk food."],
  [10,'You must ___.','强制','wear seatbelt / stop / follow','You must wear a seatbelt.'],
  [10,"You mustn't ___.",'禁止','park / smoke / be late',"You mustn't park here."],
  [10,'We must be ___.','必须状态','there by 8 / on time / quiet',"We must be there by 8."],
  [11,'I have to ___.','客观必须','work / go / finish / wake up','I have to work tomorrow.'],
  [11,'She has to ___.','第三人称必须','take medicine / wear glasses','She has to take medicine.'],
  [11,"I don't have to ___.",'不必','work on Sundays / cook / pay',"I don't have to work on Sundays."],
  [11,'Do I have to ___? — Yes, you do.','询问义务','bring / sign / stay / wear','Do I have to bring my passport?'],
  [14,'You should try ___.','推荐','this dish / coffee / app','You should try this dish.'],
  [13,'What should I ___?','征求意见','do / say / bring / wear','What should I do?'],
  [13,'I should ___.','该走了','go now / get going / head out','I should go now.'],
  [15,'It may ___ later.','可能','rain / snow / be cold','It may rain later.'],
  [15,'She might ___.','不确定','come / call / be late',"She might come to the party."],
  [15,'May I ___? — Yes, please.','正式许可','come in / sit / ask','May I come in?'],
  [16,'Would you like ___? — Yes, please.','礼貌提供','coffee / tea / water','Would you like some coffee?'],
  [16,"Would you like to ___? — I'd love to!",'礼貌邀请','join / watch / walk',"Would you like to join us?"],
  [16,'What would you like to ___?','问偏好','drink / eat / order / do','What would you like to drink?'],
  [17,'Will you ___? — Sure, no problem.','请求意愿','help / come / call','Will you help me?'],
  [17,'Do you think I should ___?','征求意见','go / tell / wait / apply','Do you think I should go?'],
  [18,'Shall I ___? — Yes, please.','主动提供','open / help / call / get','Shall I open the window?'],
  [18,'Let me ___.','主动帮忙','help / carry / open / show','Let me help you.'],
  [19,'How about ___? — Sounds great!','委婉提议','going out / ordering / watching','How about going out?'],
  [19,"Why don't we ___? — Good idea!",'提议','try / go / ask / start',"Why don't we try that?"],
  [19,"I'd love to ___.",'接受','join / come / help / try',"Id love to join you."],
  [19,'Thanks, but ___.','礼貌拒绝','Im full / I cant / Im busy',"Thanks, but I'm full."],
  [19,'That sounds ___. — Thank you for ___.','接受提议','great / wonderful / inviting me','That sounds great!'],
  [20,'Good luck on ___!','祝福','test / exam / interview','Good luck on your test!'],
  [20,'Have a great ___!','祝愿','trip / vacation / weekend','Have a great trip!'],
  [20,'Happy ___!','节日祝愿','birthday / New Year / anniversary','Happy birthday!'],
  [20,'Congratulations on ___!','祝贺','new job / promotion / graduation','Congratulations on your new job!'],
  [20,'I believe in you. You can ___!','鼓励','make it / pass / win / succeed','I believe in you!'],
  [20,"Keep ___! Don't give up!",'鼓励','going / trying / studying',"Keep going!"],
  [21,"I promise I'll ___.",'承诺','be there / call / finish',"I promise I'll be there."],
  [21,"I swear I won't ___.",'发誓','tell / forget / break',"I swear I won't tell."],
  [22,"I'd be happy to ___.",'乐意帮助','help / show / pick up',"Id be happy to help."],
  [22,"I'm willing to ___.",'愿意','try / learn / help / work',"Im willing to try."],
];

const vocabByTopic = [
  [['will','将','modal'],["'ll","将缩写","modal"],['gonna','将要','aux'],['shall','将要','modal'],['intend','打算','v'],['travel','旅行','v'],['visit','拜访','v']],
  [['probably','可能','adv'],['definitely','肯定','adv'],['certainly','当然','adv'],['absolutely','绝对','adv'],['possibly','可能','adv'],['likely','很可能','adj'],['unlikely','不太可能','adj'],['surely','必定','adv']],
  [['ultimately','最终','adv'],['by then','到那时','adv'],['before long','不久','adv'],['from now on','从现在起','adv'],['in the near future','在不久的将来','adv'],['one day','有一天','adv'],['the day after tomorrow','后天','n']],
  [['whether','是否','conj'],['guess','猜测','v'],['figure','认为','v']],
  [['shine','发光','v'],['become','变得','v'],['occur','发生','v'],['take place','发生','v'],['turn out','结果是','v'],['work out','解决','v'],['show up','出现','v']],
  [['drive','驾驶','v'],['sing','唱歌','v'],['draw','画画','v'],['paint','绘画','v'],['count','数数','v'],['solve','解决','v'],['explain','解释','v'],['type','打字','v'],['fix','修理','v'],['repair','维修','v'],['design','设计','v'],['program','编程','v'],['code','编码','v']],
  [['assist','协助','v'],['pass','传递','v'],['hand','递给','v'],['open','打开','v'],['close','关闭','v'],['lock','锁','v'],['unlock','解锁','v'],['kindly','请','adv'],['simply','简单地','adv']],
  [['leave','离开','v'],['wait','等待','v'],['stay','停留','v'],['snap','拍照','v'],['capture','捕捉','v'],['record','记录','v'],['reserve','预订','v'],['occupy','占用','v']],
  [['quickly','快速地','adv'],['slowly','慢慢地','adv'],['carefully','小心地','adv'],['safely','安全地','adv'],['directly','直接地','adv'],['conveniently','方便地','adv'],['comfortably','舒适地','adv'],['politely','礼貌地','adv'],['properly','适当地','adv'],['clearly','清楚地','adv'],['loudly','大声地','adv'],['quietly','安静地','adv'],['softly','轻柔地','adv'],['patiently','耐心地','adv'],['briefly','简短地','adv']],
  [['ski','滑雪','v'],['skate','滑冰','v'],['dive','潜水','v'],['climb','攀爬','v'],['jog','慢跑','v'],['communicate','交流','v'],['understand','理解','v']],
  [['stop','停止','v'],['follow','遵守','v'],['obey','服从','v'],['respect','尊重','v'],['study','学习','v'],['sleep','睡觉','v'],['practice','练习','v'],['behave','表现','v']],
  [['participate','参加','v'],['train','训练','v'],['qualify','取得资格','v'],['enroll','注册','v'],['register','登记','v'],['undertake','承担','v']],
  [['smoke','吸烟','v'],['drink','喝','v'],['park','停车','v'],['touch','触摸','v'],['feed','喂养','v'],['enter','进入','v'],['cross','穿过','v'],['shout','喊叫','v'],['litter','乱扔垃圾','v']],
  [['advise','建议','v'],['option','选项','n'],['choice','选择','n'],['decision','决定','n'],['opinion','意见','n'],['judgment','判断','n']],
  [['highly','高度地','adv'],['strongly','强烈地','adv'],['totally','完全地','adv'],['completely','彻底地','adv'],['entirely','完全地','adv'],['genuinely','真诚地','adv']],
  [['might','可能','modal'],['presumably','大概','adv'],['supposedly','据说','adv'],['seemingly','似乎','adv']],
  [['offer','提供','v'],['entertain','招待','v'],['socialize','社交','v']],
  [['allow','允许','v'],['let','让','v'],['permit','允许','v'],['arrange','安排','v'],['organize','组织','v'],['fetch','取来','v'],['deliver','递送','v']],
  [['alternative','替代方案','n'],['rather','宁愿','adv'],['fancy','想要','v'],['opt','选择','v']],
  [['sure','当然','adj'],['anytime','随时','adv'],['appreciate','感激','v'],['grateful','感激的','adj'],['unfortunately','不幸地','adv']],
  [['bless','祝福','v'],['congratulate','祝贺','v'],['godspeed','祝一路顺风','n']],
  [['promise','承诺','v'],['swear','发誓','v'],['vow','誓言','v'],['pledge','保证','v'],['faithfully','忠诚地','adv'],['sincerely','真诚地','adv']],
  [['contribute','贡献','v'],['cooperate','合作','v'],['coordinate','协调','v'],['facilitate','促进','v'],['aid','援助','v'],['donate','捐赠','v'],['serve','服务','v']],
  [['motivate','激励','v'],['inspire','鼓舞','v'],['believe','相信','v'],['trust','信任','v'],['confidence','信心','n'],['courage','勇气','n']],
  [['willing','愿意的','adj'],['eager','渴望的','adj'],['keen','热衷的','adj'],['enthusiastic','热情的','adj'],['determined','坚定的','adj'],['reluctant','不情愿的','adj'],['hesitant','犹豫的','adj']],
];

const epData = [
  {ch:1,ct:'计划与预测',eo:1,title:'我打算…/将会怎样',s:0,obj:'["计划与预测"]',npc:'Emma',role:'老师',ik:'fx_p1',tps:[0,1,2,3,4]},
  {ch:1,ct:'计划与预测',eo:2,title:'将来时间与预测迹象',s:0,obj:'["时间表达预测"]',npc:'Lin',role:'学员',ik:'fx_p2',tps:[0,1,2,3,4]},
  {ch:2,ct:'能力与请求',eo:1,title:'我能/会+请求帮助',s:1,obj:'["can能力"]',npc:'Mia',role:'朋友',ik:'fx_a1',tps:[5,6,7,8,9]},
  {ch:2,ct:'能力与请求',eo:2,title:'请求许可和礼貌程度',s:1,obj:'["Can/Could"]',npc:'Ben',role:'同事',ik:'fx_a2',tps:[5,6,7,8,9]},
  {ch:3,ct:'建议与义务',eo:1,title:'你应该/必须',s:2,obj:'["should/must"]',npc:'Emma',role:'老师',ik:'fx_d1',tps:[10,11,12,13,14]},
  {ch:3,ct:'建议与义务',eo:2,title:'禁止、不必和推荐',s:2,obj:'["mustnt/dont"]',npc:'Lin',role:'学员',ik:'fx_d2',tps:[10,11,12,13,14]},
  {ch:4,ct:'情态综合与礼貌',eo:1,title:'可能/邀请/提议',s:3,obj:'["may/would"]',npc:'Mia',role:'朋友',ik:'fx_m1',tps:[15,16,17,18,19]},
  {ch:4,ct:'情态综合与礼貌',eo:2,title:'主动提供和回应',s:3,obj:'["Shall/How"]',npc:'Ben',role:'同事',ik:'fx_m2',tps:[15,16,17,18,19]},
  {ch:5,ct:'祝愿与承诺',eo:1,title:'祝福与鼓励',s:4,obj:'["祝福鼓励"]',npc:'Emma',role:'老师',ik:'fx_w1',tps:[20,21,22,23,24]},
  {ch:5,ct:'祝愿与承诺',eo:2,title:'承诺与意愿',s:4,obj:'["承诺意愿"]',npc:'Mia',role:'朋友',ik:'fx_w2',tps:[20,21,22,23,24]},
];

// ===== WRITE ALL CSVs =====
let csv;
const d = pkgDir;

csv = 'category_name,title,location,required_output_level,required_user_level,description,package_type\n';
scenes.forEach(s => csv += [s.cn, s.title, s.loc, s.lvl, s.ulvl, q(s.desc), s.pkg].join(',') + '\n');
fs.writeFileSync(path.join(d, 'scenes.csv'), csv);

csv = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key\n';
topics.forEach(t => csv += [t.scene_title, t.title, q(t.prompt_en), q(t.prompt_zh), t.duration_sec, t.difficulty, q(t.description), q(t.knowledge_points), q(''), t.ink_script_key].join(',') + '\n');
fs.writeFileSync(path.join(d, 'training_topics.csv'), csv);

csv = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n';
chunks.forEach(([ti, text, meaning]) => {
  const t = topics[ti];
  csv += [t.scene_title, t.title, '核心句块', q(text), q(meaning), t.difficulty, '', '[]'].join(',') + '\n';
});
fs.writeFileSync(path.join(d, 'chunks.csv'), csv);

csv = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order\n';
patterns.forEach(([ti, pat, meaning, slots, example], i) => {
  const t = topics[ti];
  csv += [t.scene_title, t.title, q(pat), q(meaning), q(slots), q(example), t.difficulty, i].join(',') + '\n';
});
fs.writeFileSync(path.join(d, 'sentence_patterns.csv'), csv);

csv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
let so = 0;
vocabByTopic.forEach((words, ti) => {
  const t = topics[ti];
  words.forEach(([w, m, pos]) => {
    csv += [t.scene_title, t.title, w, m, pos, '', '', t.difficulty, '', '[]', so++].join(',') + '\n';
  });
});
fs.writeFileSync(path.join(d, 'scene_vocabulary.csv'), csv);

csv = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
epData.forEach(e => {
  csv += [e.ch, e.ct, e.eo, e.title, scenes[e.s].title, 'L1~L2', 'beginner', 15, 30, 7, 14, q(e.obj), 1, 5, 4, e.npc, e.role, false, e.ik, q('{"xp":' + (e.ch === 5 && e.eo === 2 ? 80 : 50) + '}')].join(',') + '\n';
});
fs.writeFileSync(path.join(d, 'script_episodes.csv'), csv);

csv = 'episode_chapter,episode_order,chunk_text_match,sort_order\n';
epData.forEach(ep => {
  let s = 0;
  chunks.forEach(([ti, text]) => {
    if (ep.tps.includes(ti)) csv += [ep.ch + '-' + ep.eo, ep.eo, q(text), s++].join(',') + '\n';
  });
});
fs.writeFileSync(path.join(d, 'episode_chunks.csv'), csv);

const vTotal = vocabByTopic.reduce((sum, w) => sum + w.length, 0);
console.log('scenes:5 | topics:25 | chunks:' + chunks.length + ' | patterns:' + patterns.length + ' | vocab:' + vTotal + ' | episodes:10');
console.log('Doc7 ALL CSVs regenerated from MD!');
