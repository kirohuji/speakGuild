const fs = require('fs');
const path = require('path');

const pkgDir = path.join(__dirname, '..', 'data', 'packages', 'foundation-4-essential-phrases');

function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

// ============ SCENES (4) ============
const scenes = [
  { category_name:'每日动作', title:'动作、状态与整理', location:'home/office', required_output_level:'L1', required_user_level:'beginner', description:'UP/DOWN小品词的方向、完成和状态变化', package_type:'foundation' },
  { category_name:'每日动作', title:'进出、开关与移动', location:'home/office/transit', required_output_level:'L1', required_user_level:'beginner', description:'IN/OUT/ON/OFF小品词的进出和开关动作', package_type:'foundation' },
  { category_name:'每日动作', title:'返回、重新处理与物品操作', location:'home/office', required_output_level:'L1~L2', required_user_level:'beginner', description:'BACK/OVER/AWAY/AROUND的返回、重新和物品处理', package_type:'foundation' },
  { category_name:'信息与社交', title:'信息、沟通与问题处理', location:'office/café/classroom', required_output_level:'L1~L2', required_user_level:'beginner', description:'动词+介词的查看、沟通和问题处理', package_type:'foundation' },
];

// ============ TOPICS (16) ============
const topics = [
  // Scene A
  { scene_title:'动作、状态与整理', title:'起身与开口', prompt_en:'What do you do in the morning?', prompt_zh:'你早上做什么？', duration_sec:900, difficulty:'L1', description:'学习用 up 表达向上、开始和提高声音', knowledge_points:'wake up, stand up, sit up, hurry up, speak up', teaching_markdown:'## 起身与开口\n\nwake up, stand up, sit up, hurry up, speak up — 不带宾语。', ink_script_key:'practice_foundation-essential-phrases_基础_动作状态整理_起身与开口' },
  { scene_title:'动作、状态与整理', title:'整理与完成', prompt_en:'How do you clean up?', prompt_zh:'你怎么整理？', duration_sec:900, difficulty:'L1', description:'学习用 up 表达整理干净、全部用完、改善情绪', knowledge_points:'clean up, tidy up, use up, eat up, cheer up (可分)', teaching_markdown:'## 整理与完成\n\nclean up, tidy up, use up, eat up, cheer up — 可分短语，代词放中间。', ink_script_key:'practice_foundation-essential-phrases_基础_动作状态整理_整理与完成' },
  { scene_title:'动作、状态与整理', title:'坐下与放慢', prompt_en:'How do you rest?', prompt_zh:'你怎么休息？', duration_sec:900, difficulty:'L1', description:'学习用 down 表达向下、降低速度、平静和记录', knowledge_points:'sit down, lie down, slow down, calm down, write down', teaching_markdown:'## 坐下与放慢\n\nsit down, lie down, slow down, calm down — 不带宾语；write down — 可分。', ink_script_key:'practice_foundation-essential-phrases_基础_动作状态整理_坐下与放慢' },
  { scene_title:'动作、状态与整理', title:'降低与停止', prompt_en:'How do you turn things down or off?', prompt_zh:'你怎么降低或关掉东西？', duration_sec:900, difficulty:'L1', description:'学习放低、调小、关闭、冷却和停止运转', knowledge_points:'put down, turn down, shut down, cool down, break down', teaching_markdown:'## 降低与停止\n\nput down, turn down, shut down — 可分；cool down, break down — 不带宾语。', ink_script_key:'practice_foundation-essential-phrases_基础_动作状态整理_降低与停止' },
  // Scene B
  { scene_title:'进出、开关与移动', title:'进入与加入', prompt_en:'How do you enter and join?', prompt_zh:'你怎么进入和加入？', duration_sec:900, difficulty:'L1', description:'学习用 in 表达进入空间、车辆、填写和参加', knowledge_points:'come in, go in, get in, fill in, join in', teaching_markdown:'## 进入与加入\n\ncome in, go in, get in — 不带宾语；fill in — 可分；join in — 不可分。', ink_script_key:'practice_foundation-essential-phrases_基础_进出开关移动_进入与加入' },
  { scene_title:'进出、开关与移动', title:'外出与发现', prompt_en:'How do you go out and find things?', prompt_zh:'你怎么外出和发现信息？', duration_sec:900, difficulty:'L1', description:'学习用 out 表达出去、拿出、查明和外出用餐', knowledge_points:'go out, get out, take out, find out, eat out', teaching_markdown:'## 外出与发现\n\ngo out, get out, eat out — 不带宾语；take out, find out — 可分。', ink_script_key:'practice_foundation-essential-phrases_基础_进出开关移动_外出与发现' },
  { scene_title:'进出、开关与移动', title:'打开与继续', prompt_en:'How do you turn things on and continue?', prompt_zh:'你怎么打开和继续？', duration_sec:900, difficulty:'L1', description:'学习用 on 表达打开、穿上、登上、继续和等待', knowledge_points:'turn on, put on, get on, carry on, hold on', teaching_markdown:'## 打开与继续\n\nturn on, put on — 可分；get on, carry on — 不可分；hold on — 不带宾语。', ink_script_key:'practice_foundation-essential-phrases_基础_进出开关移动_打开与继续' },
  { scene_title:'进出、开关与移动', title:'关闭与离开', prompt_en:'How do you turn things off and leave?', prompt_zh:'你怎么关闭和离开？', duration_sec:900, difficulty:'L1', description:'学习用 off 表达关闭、脱下、下车、送达和出发', knowledge_points:'turn off, take off, get off, drop off, set off', teaching_markdown:'## 关闭与离开\n\nturn off, take off, drop off — 可分；get off — 不可分；set off — 不带宾语。', ink_script_key:'practice_foundation-essential-phrases_基础_进出开关移动_关闭与离开' },
  // Scene C
  { scene_title:'返回、重新处理与物品操作', title:'返回与归还', prompt_en:'How do you come back and return things?', prompt_zh:'你怎么回来和归还？', duration_sec:900, difficulty:'L1~L2', description:'学习用 back 表达回来、回去、取回、带回和偿还', knowledge_points:'come back, go back, get back, bring back, pay back', teaching_markdown:'## 返回与归还\n\ncome back, go back, get back — 不带宾语；bring back, pay back — 可分。', ink_script_key:'practice_foundation-essential-phrases_基础_返回处理物品_返回与归还' },
  { scene_title:'返回、重新处理与物品操作', title:'拜访与重新处理', prompt_en:'How do you come over and start over?', prompt_zh:'你怎么过来和重新开始？', duration_sec:900, difficulty:'L1~L2', description:'学习用 over 表达过来、让位、重新开始、考虑和检查', knowledge_points:'come over, move over, start over, think over, go over', teaching_markdown:'## 拜访与重新处理\n\ncome over, move over, start over — 不带宾语；think over — 可分；go over — 不可分。', ink_script_key:'practice_foundation-essential-phrases_基础_返回处理物品_拜访与重新处理' },
  { scene_title:'返回、重新处理与物品操作', title:'收纳与四处活动', prompt_en:'How do you put things away and look around?', prompt_zh:'你怎么收纳和四处看？', duration_sec:900, difficulty:'L1~L2', description:'学习用 away/around 表达收好、丢弃、离开和在周围活动', knowledge_points:'put away, throw away, move away, look around, walk around', teaching_markdown:'## 收纳与四处活动\n\nput away, throw away — 可分；move away — 不可分；look around, walk around — 不带宾语。', ink_script_key:'practice_foundation-essential-phrases_基础_返回处理物品_收纳与四处活动' },
  { scene_title:'返回、重新处理与物品操作', title:'拿取与组合', prompt_en:'How do you pick up and put things together?', prompt_zh:'你怎么拿取和组合物品？', duration_sec:900, difficulty:'L1~L2', description:'学习拿起、放回、拆开、组合和交出物品', knowledge_points:'pick up, put back, take apart, put together, hand over', teaching_markdown:'## 拿取与组合\n\n5个短语都可带宾语；代词必须放在可分短语中间。', ink_script_key:'practice_foundation-essential-phrases_基础_返回处理物品_拿取与组合' },
  // Scene D
  { scene_title:'信息、沟通与问题处理', title:'查看与留意', prompt_en:'What do you look at and look for?', prompt_zh:'你看什么、找什么？', duration_sec:900, difficulty:'L1~L2', description:'学习查看、寻找、照看、浏览和提醒注意', knowledge_points:'look at, look for, look after, look through, watch out', teaching_markdown:'## 查看与留意\n\nlook at, look for, look after, look through — 不可分；watch out — 可单独或接 for。', ink_script_key:'practice_foundation-essential-phrases_基础_信息沟通_查看与留意' },
  { scene_title:'信息、沟通与问题处理', title:'日常沟通', prompt_en:'How do you talk and ask on the phone?', prompt_zh:'你怎么在电话中交谈和询问？', duration_sec:900, difficulty:'L1~L2', description:'学习结束通话、谈论、请求、交谈和收到消息', knowledge_points:'hang up, talk about, ask for, speak to, hear from', teaching_markdown:'## 日常沟通\n\nhang up — 不带宾语；其余不可分，介词与宾语保持在一起。', ink_script_key:'practice_foundation-essential-phrases_基础_信息沟通_日常沟通' },
  { scene_title:'信息、沟通与问题处理', title:'工作与学习', prompt_en:'How do you hand in and look up information?', prompt_zh:'你怎么提交和查阅信息？', duration_sec:900, difficulty:'L1~L2', description:'学习提交、分发、查阅、通读和弄明白信息', knowledge_points:'hand in, hand out, look up, read over, figure out', teaching_markdown:'## 工作与学习\n\nhand in, hand out, look up — 可分；read over, figure out — 练习代词位置。', ink_script_key:'practice_foundation-essential-phrases_基础_信息沟通_工作与学习' },
  { scene_title:'信息、沟通与问题处理', title:'社交与解决问题', prompt_en:'How do you get along and work things out?', prompt_zh:'你怎么相处和解决问题？', duration_sec:900, difficulty:'L1~L2', description:'学习与人相处、一起活动、到场、放弃和解决问题', knowledge_points:'get along, hang out, show up, give up, work out', teaching_markdown:'## 社交与解决问题\n\nget along — 不可分；hang out, show up — 不带宾语；give up, work out — 可分。', ink_script_key:'practice_foundation-essential-phrases_基础_信息沟通_社交与解决问题' },
];

// ============ CHUNKS (160: 80 phrases × 2) ============
// Data from MD comprehensive table: Phrase | ChunkA | ChunkB | Type
const chunkTable = [
  // Scene A - Topic 01
  ['wake up','I wake up at seven every day.','The alarm is loud. Wake up.','不带宾语'],['stand up','Please stand up for a moment.','Emma is at the door. Stand up and greet her.','不带宾语'],['sit up','Please sit up straight.','He sits up when the teacher enters.','不带宾语'],['hurry up','Hurry up. The bus is here.','We start at eight. Please hurry up.','不带宾语'],['speak up','Please speak up in class.','I do not hear you well. Speak up, please.','不带宾语'],
  // Topic 02
  ['clean up','Please clean up the table.','The table is dirty. Clean it up.','可分'],['tidy up','She tidies up her desk every day.','These papers are everywhere. Tidy them up.','可分'],['use up','Do not use up all the water.','This paper is old. Use it up first.','可分'],['eat up','Please eat up your breakfast.','The food is still warm. Eat it up.','可分'],['cheer up','Cheer up. You are okay.','Mia looks sad. Let us cheer her up.','可分'],
  // Topic 03
  ['sit down','Please sit down by the window.','Your chair is ready. Sit down.','不带宾语'],['lie down','Lie down on the sofa and rest.','He lies down when his back hurts.','不带宾语'],['slow down','Please slow down near the door.','You speak very fast. Slow down.','不带宾语'],['calm down','Calm down. Everything is okay.','He takes a minute to calm down.','不带宾语'],['write down','Write down these three words.','This address is important. Write it down.','可分'],
  // Topic 04
  ['put down','Please put down the heavy box.','The box is too heavy. Put it down.','可分'],['turn down','Please turn down the music.','The TV is loud. Turn it down.','可分'],['shut down','Shut down the computer before you leave.','The computer is hot. Shut it down.','可分'],['cool down','The machine needs time to cool down.','The computer cools down after ten minutes.','不带宾语'],['break down','Old printers sometimes break down.','The machine breaks down every month.','不带宾语'],
  // Scene B - Topic 05
  ['come in','The door is open. Come in.','Please come in and sit by the window.','不带宾语'],['go in','The room is ready. Please go in.','They go in through the front door.','不带宾语'],['get in','Get in the car at the front gate.','The door is open. Get in.','不带宾语'],['fill in','Please fill in this form.','The form is on the desk. Fill it in.','可分'],['join in','The group game starts now. Join in.','She joins in every class activity.','不可分'],
  // Topic 06
  ['go out','We go out after work on Friday.','The weather is good. Let us go out.','不带宾语'],['get out','Please get out through this door.','The car is at the park. Get out carefully.','不带宾语'],['take out','Please take out the city guide.','The guide is in my bag. I take it out.','可分'],['find out','We need to find out the opening time.','We need the answer. Please find it out.','可分'],['eat out','We eat out near the park on Friday.','I do not cook tonight. Let us eat out.','不带宾语'],
  // Topic 07
  ['turn on','Please turn on the light.','The room is dark. Turn it on.','可分'],['put on','Put on your coat before you go out.','It is cold outside. Put it on.','可分'],['get on','Get on the bus at this stop.','The bus is here. Let us get on.','不可分'],['carry on','Please carry on with your work.','The task is not finished. Carry on.','不可分'],['hold on','Hold on, please.','Please hold on for a moment.','不带宾语'],
  // Topic 08
  ['turn off','Please turn off the computer.','The screen is bright. Turn it off.','可分'],['take off','Take off your coat inside.','Your coat is wet. Take it off.','可分'],['get off','We get off the bus at the station.','This is our stop. Get off here.','不可分'],['drop off','Please drop off the box at the front desk.','Emma needs this file. Drop it off today.','可分'],['set off','We set off at three.','Everything is ready. Let us set off.','不带宾语'],
  // Scene C - Topic 09
  ['come back','Please come back before five.','She comes back after lunch.','不带宾语'],['go back','Go back to the front desk.','He goes back for the blue folder.','不带宾语'],['get back','I get back to the office at four.','Please get back before the meeting.','不带宾语'],['bring back','Please bring back the blue folder.','This book belongs here. Bring it back.','可分'],['pay back','I need to pay back Ben.','Ben paid for lunch. I pay him back today.','可分'],
  // Topic 10
  ['come over','Please come over after lunch.','Mia comes over at two.','不带宾语'],['move over','Please move over and make some space.','The sofa is small. Move over a little.','不带宾语'],['start over','The plan is not clear. Start over.','We start over with a clean page.','不带宾语'],['think over','Please think over the new plan.','This choice is important. Think it over.','可分'],['go over','Let us go over the details.','The final list is ready. Go over it carefully.','不可分'],
  // Topic 11
  ['put away','Please put away the chairs.','The chairs belong by the wall. Put them away.','可分'],['throw away','Throw away these empty cups.','This paper is useless. Throw it away.','可分'],['move away','Please move away from the door.','The table is in the way. Move away from it.','不可分'],['look around','Look around for more paper.','We look around the room after class.','不带宾语'],['walk around','Walk around the room one more time.','They walk around the park after lunch.','不带宾语'],
  // Topic 12
  ['pick up','Please pick up the small box.','The box is on the floor. Pick it up.','可分'],['put back','Put back the cable after you use it.','The cable belongs here. Put it back.','可分'],['take apart','Take apart this simple stand.','The stand has two parts. Take it apart.','可分'],['put together','Put together the two main parts.','These parts make one stand. Put them together.','可分'],['hand over','Please hand over the final box to Emma.','Emma needs the box. Hand it over.','可分'],
  // Scene D - Topic 13
  ['look at','Look at this list, please.','The first line is important. Look at it.','不可分'],['look for','I am here to look for the blue folder.','The folder is missing. Look for it near the desk.','不可分'],['look after','Please look after my bag.','This is Mia\'s bag. I look after it for her.','不可分'],['look through','Please look through the event guide.','The guide is short. I look through it now.','不可分'],['watch out','Watch out. The floor is wet.','Watch out for the wet floor.','可接for'],
  // Topic 14
  ['hang up','Please do not hang up.','The call is over. I hang up now.','不带宾语'],['talk about','We need to talk about the activity plan.','The problem is important. Let us talk about it.','不可分'],['ask for','I want to ask for Ben\'s notes.','The form is not here. Ask for it at the desk.','不可分'],['speak to','Please speak to Emma first.','Emma is in the office. I speak to her there.','不可分'],['hear from','I hear from Mia every Friday.','Ben is away, but I hear from him online.','不可分'],
  // Topic 15
  ['hand in','Please hand in your short report.','The report is ready. Hand it in today.','可分'],['hand out','Hand out these worksheets to the group.','Everyone needs one. Hand them out.','可分'],['look up','Look up the new words in the dictionary.','This word is new. Look it up.','可分'],['read over','Read over your answers carefully.','The report is short. Read it over.','可分'],['figure out','We need to figure out the final question.','This problem has an answer. Figure it out.','可分'],
  // Topic 16
  ['get along','Lin and Ben get along well.','She gets along with everyone in the group.','不可分'],['hang out','We hang out after class on Friday.','Do you want to hang out at the café?','不带宾语'],['show up','Ben shows up at six.','Please show up before the activity starts.','不带宾语'],['give up','Do not give up on this task.','This plan still matters. Do not give it up.','可分'],['work out','We work out the problem together.','The plan is difficult, but we work it out.','可分'],
];

// ============ PATTERNS (80) ============
const patternTable = [
  // Scene A - Topic 01 (5)
  {tp:0,phrase:'wake up',pattern:'___ wakes up at ___.',slots:'Lin / Mia / seven / eight',example:'Lin wakes up at seven.'},
  {tp:0,phrase:'stand up',pattern:'Please stand up ___.',slots:'here / for a moment / by the desk',example:'Please stand up for a moment.'},
  {tp:0,phrase:'sit up',pattern:'Sit up ___.',slots:'straight / in bed / on the sofa',example:'Sit up straight.'},
  {tp:0,phrase:'hurry up',pattern:'Hurry up. ___ starts at ___.',slots:'class / work / eight / nine',example:'Hurry up. Class starts at eight.'},
  {tp:0,phrase:'speak up',pattern:'Please speak up ___.',slots:'in class / on the phone / a little',example:'Please speak up in class.'},
  // Topic 02 (5)
  {tp:1,phrase:'clean up',pattern:'Clean up ___. / Clean ___ up.',slots:'the table / the floor / it',example:'Clean up the table.'},
  {tp:1,phrase:'tidy up',pattern:'Tidy up ___. / Tidy ___ up.',slots:'your desk / the room / them',example:'Tidy up your desk.'},
  {tp:1,phrase:'use up',pattern:'Do not use up ___. / Use ___ up first.',slots:'all the water / the paper / it',example:'Do not use up all the water.'},
  {tp:1,phrase:'eat up',pattern:'Eat up ___. / Eat ___ up.',slots:'your breakfast / the food / it',example:'Eat up your breakfast.'},
  {tp:1,phrase:'cheer up',pattern:'Cheer up ___. / Cheer ___ up.',slots:'Mia / your friend / her',example:'Cheer up Mia.'},
  // Topic 03 (5)
  {tp:2,phrase:'sit down',pattern:'Sit down ___.',slots:'here / by the window / on this chair',example:'Sit down by the window.'},
  {tp:2,phrase:'lie down',pattern:'Lie down ___.',slots:'on the sofa / in bed / for a moment',example:'Lie down on the sofa.'},
  {tp:2,phrase:'slow down',pattern:'Slow down ___.',slots:'near the door / on this street / a little',example:'Slow down near the door.'},
  {tp:2,phrase:'calm down',pattern:'Calm down before ___.',slots:'class / the meeting / you answer',example:'Calm down before class.'},
  {tp:2,phrase:'write down',pattern:'Write down ___. / Write ___ down.',slots:'the address / these words / it',example:'Write down the address.'},
  // Topic 04 (5)
  {tp:3,phrase:'put down',pattern:'Put down ___. / Put ___ down.',slots:'the box / your bag / it',example:'Put down the box.'},
  {tp:3,phrase:'turn down',pattern:'Turn down ___. / Turn ___ down.',slots:'the music / the TV / it',example:'Turn down the music.'},
  {tp:3,phrase:'shut down',pattern:'Shut down ___. / Shut ___ down.',slots:'the computer / the system / it',example:'Shut down the computer.'},
  {tp:3,phrase:'cool down',pattern:'___ needs time to cool down.',slots:'the machine / the room / Ben',example:'The machine needs time to cool down.'},
  {tp:3,phrase:'break down',pattern:'___ breaks down ___.',slots:'the printer / the machine / often',example:'The printer breaks down often.'},
  // Scene B - Topic 05 (5)
  {tp:4,phrase:'come in',pattern:'Come in through ___.',slots:'the front door / this entrance',example:'Come in through the front door.'},
  {tp:4,phrase:'go in',pattern:'Go in and ___.',slots:'sit down / find Emma / fill in the form',example:'Go in and sit down.'},
  {tp:4,phrase:'get in',pattern:'Get in ___.',slots:'the car / through this door / at the front gate',example:'Get in the car.'},
  {tp:4,phrase:'fill in',pattern:'Fill in ___. / Fill ___ in.',slots:'this form / the details / it',example:'Fill in this form.'},
  {tp:4,phrase:'join in',pattern:'Join in ___.',slots:'the game / the activity / after lunch',example:'Join in the game.'},
  // Topic 06 (5)
  {tp:5,phrase:'go out',pattern:'___ goes out ___.',slots:'Lin / Mia / after work / on Friday',example:'Lin goes out after work.'},
  {tp:5,phrase:'get out',pattern:'Get out through ___.',slots:'this door / the back entrance',example:'Get out through this door.'},
  {tp:5,phrase:'take out',pattern:'Take out ___. / Take ___ out.',slots:'the guide / the box / it',example:'Take out the guide.'},
  {tp:5,phrase:'find out',pattern:'Find out ___. / Find ___ out.',slots:'the time / the address / it',example:'Find out the time.'},
  {tp:5,phrase:'eat out',pattern:'___ eats out ___.',slots:'Lin / the group / on Friday / near the park',example:'Lin eats out on Friday.'},
  // Topic 07 (5)
  {tp:6,phrase:'turn on',pattern:'Turn on ___. / Turn ___ on.',slots:'the light / the TV / it',example:'Turn on the light.'},
  {tp:6,phrase:'put on',pattern:'Put on ___. / Put ___ on.',slots:'your coat / the jacket / it',example:'Put on your coat.'},
  {tp:6,phrase:'get on',pattern:'Get on ___ at ___.',slots:'the bus / the train / this stop',example:'Get on the bus at this stop.'},
  {tp:6,phrase:'carry on',pattern:'Carry on with ___.',slots:'your work / the task / the activity',example:'Carry on with your work.'},
  {tp:6,phrase:'hold on',pattern:'Hold on for ___.',slots:'a moment / one minute / Emma',example:'Hold on for a moment.'},
  // Topic 08 (5)
  {tp:7,phrase:'turn off',pattern:'Turn off ___. / Turn ___ off.',slots:'the computer / the light / it',example:'Turn off the computer.'},
  {tp:7,phrase:'take off',pattern:'Take off ___. / Take ___ off.',slots:'your coat / the badge / it',example:'Take off your coat.'},
  {tp:7,phrase:'get off',pattern:'Get off ___ at ___.',slots:'the bus / the train / the station',example:'Get off the bus at the station.'},
  {tp:7,phrase:'drop off',pattern:'Drop off ___ at ___. / Drop ___ off there.',slots:'the box / the file / the desk / it',example:'Drop off the box at the desk.'},
  {tp:7,phrase:'set off',pattern:'___ sets off at ___.',slots:'the group / the bus / three / eight',example:'The group sets off at three.'},
  // Scene C - Topic 09 (5)
  {tp:8,phrase:'come back',pattern:'Come back at/before ___.',slots:'four / five / lunch',example:'Come back before five.'},
  {tp:8,phrase:'go back',pattern:'Go back to/for ___.',slots:'the desk / the office / the folder',example:'Go back to the desk.'},
  {tp:8,phrase:'get back',pattern:'___ gets back at ___.',slots:'Lin / Mia / four / five',example:'Lin gets back at four.'},
  {tp:8,phrase:'bring back',pattern:'Bring back ___. / Bring ___ back.',slots:'the folder / the book / it',example:'Bring back the folder.'},
  {tp:8,phrase:'pay back',pattern:'Pay back ___. / Pay ___ back.',slots:'Ben / the money / him',example:'Pay back Ben.'},
  // Topic 10 (5)
  {tp:9,phrase:'come over',pattern:'Come over at/after ___.',slots:'two / lunch / work',example:'Come over after lunch.'},
  {tp:9,phrase:'move over',pattern:'Move over ___.',slots:'a little / to the left / on the sofa',example:'Move over a little.'},
  {tp:9,phrase:'start over',pattern:'Start over with ___.',slots:'a clean page / a new plan / Topic 01',example:'Start over with a clean page.'},
  {tp:9,phrase:'think over',pattern:'Think over ___. / Think ___ over.',slots:'the plan / this choice / it',example:'Think over the plan.'},
  {tp:9,phrase:'go over',pattern:'Go over ___.',slots:'the details / the list / it',example:'Go over the details.'},
  // Topic 11 (5)
  {tp:10,phrase:'put away',pattern:'Put away ___. / Put ___ away.',slots:'the chairs / the books / them',example:'Put away the chairs.'},
  {tp:10,phrase:'throw away',pattern:'Throw away ___. / Throw ___ away.',slots:'the cups / this paper / it',example:'Throw away the cups.'},
  {tp:10,phrase:'move away',pattern:'Move away from ___.',slots:'the door / the table / it',example:'Move away from the door.'},
  {tp:10,phrase:'look around',pattern:'Look around ___.',slots:'the room / the store / for more paper',example:'Look around the room.'},
  {tp:10,phrase:'walk around',pattern:'Walk around ___.',slots:'the room / the park / after lunch',example:'Walk around the room.'},
  // Topic 12 (5)
  {tp:11,phrase:'pick up',pattern:'Pick up ___. / Pick ___ up.',slots:'the box / your bag / it',example:'Pick up the box.'},
  {tp:11,phrase:'put back',pattern:'Put back ___. / Put ___ back.',slots:'the cable / the book / it',example:'Put back the cable.'},
  {tp:11,phrase:'take apart',pattern:'Take apart ___. / Take ___ apart.',slots:'the stand / the device / it',example:'Take apart the stand.'},
  {tp:11,phrase:'put together',pattern:'Put together ___. / Put ___ together.',slots:'the parts / the stand / them',example:'Put together the parts.'},
  {tp:11,phrase:'hand over',pattern:'Hand over ___ to ___. / Hand ___ over.',slots:'the box / Emma / it',example:'Hand over the box to Emma.'},
  // Scene D - Topic 13 (5)
  {tp:12,phrase:'look at',pattern:'Look at ___.',slots:'this list / the first line / it',example:'Look at this list.'},
  {tp:12,phrase:'look for',pattern:'Look for ___ near ___.',slots:'the folder / it / the desk',example:'Look for the folder near the desk.'},
  {tp:12,phrase:'look after',pattern:'Look after ___ for ___.',slots:'the bag / it / Mia',example:'Look after the bag for Mia.'},
  {tp:12,phrase:'look through',pattern:'Look through ___ before ___.',slots:'the guide / it / class',example:'Look through the guide before class.'},
  {tp:12,phrase:'watch out',pattern:'Watch out for ___.',slots:'the wet floor / the step / the bike',example:'Watch out for the wet floor.'},
  // Topic 14 (5)
  {tp:13,phrase:'hang up',pattern:'Do not hang up until ___.',slots:'the call ends / Emma answers',example:'Do not hang up until the call ends.'},
  {tp:13,phrase:'talk about',pattern:'Talk about ___ with ___.',slots:'the plan / it / Ben',example:'Talk about the plan with Ben.'},
  {tp:13,phrase:'ask for',pattern:'Ask for ___ at ___.',slots:'the notes / it / the front desk',example:'Ask for the notes at the front desk.'},
  {tp:13,phrase:'speak to',pattern:'Speak to ___ about ___.',slots:'Emma / her / the plan',example:'Speak to Emma about the plan.'},
  {tp:13,phrase:'hear from',pattern:'___ hears from ___ every ___.',slots:'Lin / Mia / her / Friday',example:'Lin hears from Mia every Friday.'},
  // Topic 15 (5)
  {tp:14,phrase:'hand in',pattern:'Hand in ___. / Hand ___ in.',slots:'the report / the answer / it',example:'Hand in the report.'},
  {tp:14,phrase:'hand out',pattern:'Hand out ___. / Hand ___ out.',slots:'the worksheets / the papers / them',example:'Hand out the worksheets.'},
  {tp:14,phrase:'look up',pattern:'Look up ___ in ___. / Look ___ up.',slots:'the word / the dictionary / it',example:'Look up the word in the dictionary.'},
  {tp:14,phrase:'read over',pattern:'Read over ___. / Read ___ over.',slots:'your answers / the report / it',example:'Read over your answers.'},
  {tp:14,phrase:'figure out',pattern:'Figure out ___. / Figure ___ out.',slots:'the question / the problem / it',example:'Figure out the question.'},
  // Topic 16 (5)
  {tp:15,phrase:'get along',pattern:'___ gets along with ___.',slots:'Lin / Mia / everyone / Ben',example:'Lin gets along with Mia.'},
  {tp:15,phrase:'hang out',pattern:'Hang out with ___ at ___.',slots:'Mia / friends / the café',example:'Hang out with Mia at the café.'},
  {tp:15,phrase:'show up',pattern:'___ shows up at ___.',slots:'Ben / everyone / six / the café',example:'Ben shows up at six.'},
  {tp:15,phrase:'give up',pattern:'Do not give up ___. / Do not give ___ up.',slots:'the task / the plan / it',example:'Do not give up the task.'},
  {tp:15,phrase:'work out',pattern:'Work out ___. / Work ___ out.',slots:'the problem / the plan / it',example:'Work out the problem.'},
];

// ============ VOCABULARY (112: 80 core + 32 extension) ============
// Extension phrases per topic (2 each)
const extPhrases = [
  ['grow up','line up'],['wash up','warm up'],['settle down','bend down'],['fall down','knock down'],
  ['move in','check in'],['check out','point out'],['keep on','move on'],['call off','go off'],
  ['take back','write back'],['look over','talk over'],['run away','give away'],['plug in','pull out'],
  ['look into','listen for'],['chat with','ask about'],['catch up','sort out'],['help out','deal with'],
];

// Generate vocabulary list
const vocabEntries = [];
chunkTable.forEach(([phrase, chunkA, chunkB, ptype], i) => {
  const topicIdx = Math.floor(i / 5);
  const topic = topics[topicIdx];
  let meaning = phrase;
  vocabEntries.push({
    scene_title: topic.scene_title, topic_title: topic.title, word: phrase,
    meaning: meaning, part_of_speech: 'phr.v.',
    difficulty: topic.difficulty, is_core: '核心短语', description: ptype,
  });
});
// Add extension phrases
topics.forEach((topic, topicIdx) => {
  extPhrases[topicIdx].forEach(phrase => {
    vocabEntries.push({
      scene_title: topic.scene_title, topic_title: topic.title, word: phrase,
      meaning: phrase, part_of_speech: 'phr.v.',
      difficulty: topic.difficulty, is_core: '扩展短语', description: '',
    });
  });
});

// ============ EPISODES (8) ============
const episodes = [
  { chapter_id:1,chapter_title:'UP与DOWN',episode_order:1,title:'起身、整理与完成',scene_title:'动作、状态与整理',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个UP短语完成早晨整理"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_动作状态整理_UP',rewards_json:'{"xp":50,"gems":5}' },
  { chapter_id:1,chapter_title:'UP与DOWN',episode_order:2,title:'坐下、放慢与降低停止',scene_title:'动作、状态与整理',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个DOWN短语完成休息和设备处理"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_动作状态整理_DOWN',rewards_json:'{"xp":50,"gems":5}' },
  { chapter_id:2,chapter_title:'IN、OUT、ON、OFF',episode_order:1,title:'进入加入与外出发现',scene_title:'进出、开关与移动',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个IN/OUT短语完成报名和外出"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_进出移动_INOUT',rewards_json:'{"xp":50,"gems":5}' },
  { chapter_id:2,chapter_title:'IN、OUT、ON、OFF',episode_order:2,title:'打开继续与关闭离开',scene_title:'进出、开关与移动',required_output_level:'L1',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个ON/OFF短语完成开关和乘车"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Ben',npc_role:'同事',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_进出移动_ONOFF',rewards_json:'{"xp":50,"gems":5}' },
  { chapter_id:3,chapter_title:'BACK、OVER、AWAY与物品',episode_order:1,title:'返回归还与拜访重新',scene_title:'返回、重新处理与物品操作',required_output_level:'L1~L2',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个BACK/OVER短语完成归还和复查"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_返回处理_BACKOVER',rewards_json:'{"xp":50,"gems":5}' },
  { chapter_id:3,chapter_title:'BACK、OVER、AWAY与物品',episode_order:2,title:'收纳活动与拿取组合',scene_title:'返回、重新处理与物品操作',required_output_level:'L1~L2',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个AWAY/物品短语完成整理和组装"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Ben',npc_role:'同事',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_返回处理_AWAY物品',rewards_json:'{"xp":50,"gems":5}' },
  { chapter_id:4,chapter_title:'信息、沟通与问题处理',episode_order:1,title:'查看留意与日常沟通',scene_title:'信息、沟通与问题处理',required_output_level:'L1~L2',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个LOOK/TALK短语完成查看和沟通"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Mia',npc_role:'朋友',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_信息沟通_LOOKTALK',rewards_json:'{"xp":50,"gems":5}' },
  { chapter_id:4,chapter_title:'信息、沟通与问题处理',episode_order:2,title:'工作学习与社交解决问题',scene_title:'信息、沟通与问题处理',required_output_level:'L1~L2',required_user_level:'beginner',vocab_required_count:10,vocab_total_count:20,chunk_required_count:20,chunk_total_count:40,objectives_json:'["用10个HAND/WORK短语完成任务和社交"]',pass_objective_count:1,pass_chunk_count:15,pass_min_dialogues:4,npc_name:'Emma',npc_role:'老师',is_preview:false,ink_script_key:'practice_foundation-essential-phrases_基础_信息沟通_HANDWORK',rewards_json:'{"xp":80,"gems":10}' },
];

// ============ WRITE CSVs ============

// scenes.csv
let csv = 'category_name,title,location,required_output_level,required_user_level,description,package_type\n';
scenes.forEach(s => csv += [s.category_name,s.title,s.location,s.required_output_level,s.required_user_level,q(s.description),s.package_type].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'scenes.csv'),csv);
console.log('scenes.csv:',scenes.length);

// training_topics.csv
csv = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key\n';
topics.forEach(t => csv += [t.scene_title,t.title,q(t.prompt_en),q(t.prompt_zh),t.duration_sec,t.difficulty,q(t.description),q(t.knowledge_points),q(t.teaching_markdown),t.ink_script_key].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'training_topics.csv'),csv);
console.log('training_topics.csv:',topics.length);

// chunks.csv (160: each phrase has 2 chunks)
csv = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n';
chunkTable.forEach(([phrase,chunkA,chunkB,ptype],i) => {
  const topicIdx = Math.floor(i/5);
  const t = topics[topicIdx];
  // Chunk A
  csv += [t.scene_title,t.title,'核心句块',q(chunkA),q(phrase+' — 句块A'),t.difficulty,q(ptype),q('[]')].join(',')+'\n';
  // Chunk B
  csv += [t.scene_title,t.title,'核心句块',q(chunkB),q(phrase+' — 句块B'),t.difficulty,q(ptype),q('[]')].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'chunks.csv'),csv);
console.log('chunks.csv:',chunkTable.length*2);

// sentence_patterns.csv
csv = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order\n';
patternTable.forEach((p,i) => {
  const t = topics[p.tp];
  csv += [t.scene_title,t.title,q(p.pattern),q(p.phrase),q(p.slots),q(p.example),t.difficulty,i].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'sentence_patterns.csv'),csv);
console.log('sentence_patterns.csv:',patternTable.length);

// scene_vocabulary.csv
csv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
vocabEntries.forEach((v,i) => {
  csv += [v.scene_title,v.topic_title,v.word,v.meaning,v.part_of_speech,'','',v.difficulty,v.description,'[]',i].join(',')+'\n';
});
fs.writeFileSync(path.join(pkgDir,'scene_vocabulary.csv'),csv);
console.log('scene_vocabulary.csv:',vocabEntries.length);

// script_episodes.csv
csv = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
episodes.forEach(e => csv += [e.chapter_id,e.chapter_title,e.episode_order,e.title,e.scene_title,e.required_output_level,e.required_user_level,e.vocab_required_count,e.vocab_total_count,e.chunk_required_count,e.chunk_total_count,q(e.objectives_json),e.pass_objective_count,e.pass_chunk_count,e.pass_min_dialogues,e.npc_name,e.npc_role,e.is_preview,e.ink_script_key,q(e.rewards_json)].join(',')+'\n');
fs.writeFileSync(path.join(pkgDir,'script_episodes.csv'),csv);
console.log('script_episodes.csv:',episodes.length);

// episode_chunks.csv
csv = 'episode_chapter,episode_order,chunk_text_match,sort_order\n';
let ci=0;
episodes.forEach((ep,ei) => {
  const start=ei*20, end=start+20;
  for(let i=start;i<end&&i<chunkTable.length*2;i++){
    const [phrase,chunkA,chunkB]=chunkTable[Math.floor(i/2)];
    const text=i%2===0?chunkA:chunkB;
    csv += [ep.chapter_id+'-'+ep.episode_order,ep.episode_order,q(text),ci++].join(',')+'\n';
  }
});
fs.writeFileSync(path.join(pkgDir,'episode_chunks.csv'),csv);
console.log('episode_chunks.csv:',ci);

console.log('\n✅ All CSVs generated!');
