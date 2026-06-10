import { readFileSync, writeFileSync } from 'fs';

const PKG_DIR = 'apps/backend/prisma/data/packages/study-abroad';

// --- chunks.csv ---
let chunks = readFileSync(`${PKG_DIR}/chunks.csv`, 'utf8');
chunks = chunks.replace('scene_title,category,text', 'scene_title,topic_title,category,text');

const chunkTopicMap = {
  "宿舍入住,I'm here to check in.": '办理入住',
  '宿舍入住,My booking is under the name': '办理入住',
  '宿舍入住,Here is my student ID': '办理入住',
  '宿舍入住,Could you tell me where my room': '办理入住',
  "宿舍入住,I'm looking for my room": '办理入住',
  '宿舍入住,Is there Wi-Fi': '询问设施',
  '宿舍入住,Where is the laundry': '询问设施',
  '宿舍入住,Is there a shared kitchen': '询问设施',
  '宿舍入住,Can I have a tour': '询问设施',
  '宿舍入住,How do I get to the campus': '询问设施',
  '宿舍入住,I need to report a maintenance': '描述宿舍问题',
  '宿舍入住,Can I get an extra key': '申请换房间',
  "机场入境,I'm here to study": '说明来访目的',
  '机场入境,I will be staying': '说明来访目的',
  "机场入境,What's the purpose of your visit": '说明来访目的',
  '机场入境,Can I see your passport': '说明来访目的',
  '机场入境,My luggage is': '行李丢失申报',
  '机场入境,Where is the baggage': '行李丢失申报',
  '机场入境,I have a connecting': '转机问路',
  "认识室友,I'm from": '初次见面',
  '认识室友,My major is': '初次见面',
  "认识室友,It's nice to meet you": '初次见面',
  '认识室友,How long have you been': '聊家乡',
  '认识室友,Would you like to grab': '邀请一起吃饭',
  '认识室友,What do you do in your free': '分享兴趣爱好',
  '认识室友,Let me know if you need': '商量宿舍规则',
  "银行开户,I'd like to open a bank": '开立账户',
  '银行开户,What documents do I need': '开立账户',
  '银行开户,What types of accounts': '咨询利率',
  '银行开户,Is there a monthly': '咨询利率',
  "银行开户,What's the interest": '咨询利率',
  '银行开户,How do I set up online': '咨询利率',
  "买 SIM 卡,I'd like to get a SIM": '选择套餐',
  '买 SIM 卡,What plans do you have': '选择套餐',
  '买 SIM 卡,How much data': '选择套餐',
  '买 SIM 卡,Can I keep my number': '选择套餐',
  '买 SIM 卡,How do I activate': '激活SIM卡',
  '买 SIM 卡,Does it work internationally': '激活SIM卡',
};

let lines = chunks.split('\n');
let updated = [lines[0]];
for (let i = 1; i < lines.length; i++) {
  let line = lines[i].trim();
  if (!line) continue;
  let topicTitle = '';
  for (const [prefix, topic] of Object.entries(chunkTopicMap)) {
    if (line.includes(prefix)) { topicTitle = topic; break; }
  }
  let firstComma = line.indexOf(',');
  line = line.substring(0, firstComma + 1) + topicTitle + ',' + line.substring(firstComma + 1);
  updated.push(line);
}
writeFileSync(`${PKG_DIR}/chunks.csv`, updated.join('\n'), 'utf8');
console.log('chunks.csv: ' + (updated.length - 1) + ' rows');

// --- scene_vocabulary.csv ---
let vocabs = readFileSync(`${PKG_DIR}/scene_vocabulary.csv`, 'utf8');
vocabs = vocabs.replace('scene_title,word,', 'scene_title,topic_title,word,');

const vocabTopicMap = {
  // 宿舍入住 - 办理入住
  '宿舍入住,dormitory': '办理入住',
  '宿舍入住,reception': '办理入住',
  '宿舍入住,check in': '办理入住',
  '宿舍入住,booking': '办理入住',
  '宿舍入住,room key': '办理入住',
  '宿舍入住,student ID': '办理入住',
  '宿舍入住,registration form': '办理入住',
  '宿舍入住,move in': '办理入住',
  // 宿舍入住 - 询问设施
  '宿舍入住,Wi-Fi': '询问设施',
  '宿舍入住,laundry room': '询问设施',
  '宿舍入住,shared kitchen': '询问设施',
  '宿舍入住,elevator': '询问设施',
  '宿舍入住,laundry card': '询问设施',
  '宿舍入住,common room': '询问设施',
  '宿舍入住,floor plan': '询问设施',
  '宿舍入住,recycling bin': '询问设施',
  // 宿舍入住 - 描述宿舍问题
  '宿舍入住,maintenance': '描述宿舍问题',
  '宿舍入住,air conditioner': '描述宿舍问题',
  '宿舍入住,heater': '描述宿舍问题',
  '宿舍入住,fire alarm': '描述宿舍问题',
  '宿舍入住,emergency exit': '描述宿舍问题',
  '宿舍入住,noise complaint': '描述宿舍问题',
  // 宿舍入住 - 申请换房间
  '宿舍入住,single room': '申请换房间',
  '宿舍入住,shared room': '申请换房间',
  '宿舍入住,contract': '申请换房间',
  '宿舍入住,deposit': '申请换房间',
  '宿舍入住,lease agreement': '申请换房间',
  '宿舍入住,accommodation': '申请换房间',
  '宿舍入住,move out': '申请换房间',
  '宿舍入住,landlord': '申请换房间',
  // 宿舍入住 - shared (empty = all topics)
  // '宿舍入住,curfew' -> shared
  // '宿舍入住,bedding' -> shared
  // '宿舍入住,quiet hours' -> shared
  // '宿舍入住,visitor policy' -> shared
  // '宿舍入住,resident' -> shared
  // '宿舍入住,security guard' -> shared
  // '宿舍入住,key card' -> shared
  // '宿舍入住,room number' -> shared
  // '宿舍入住,neighbor' -> shared
  // '宿舍入住,utility bill' -> shared

  // 机场入境 - 说明来访目的
  '机场入境,passport': '说明来访目的',
  '机场入境,visa': '说明来访目的',
  '机场入境,immigration': '说明来访目的',
  '机场入境,purpose of visit': '说明来访目的',
  '机场入境,duration of stay': '说明来访目的',
  '机场入境,return ticket': '说明来访目的',
  '机场入境,entry permit': '说明来访目的',
  '机场入境,travel document': '说明来访目的',
  '机场入境,landing card': '说明来访目的',
  '机场入境,immigration officer': '说明来访目的',
  '机场入境,boarding pass': '说明来访目的',
  // 机场入境 - 行李丢失申报
  '机场入境,luggage': '行李丢失申报',
  '机场入境,suitcase': '行李丢失申报',
  '机场入境,baggage claim': '行李丢失申报',
  '机场入境,lost and found': '行李丢失申报',
  '机场入境,checked baggage': '行李丢失申报',
  '机场入境,carry-on': '行李丢失申报',
  // 机场入境 - 转机问路
  '机场入境,transit': '转机问路',
  '机场入境,connecting flight': '转机问路',
  '机场入境,departure lounge': '转机问路',
  '机场入境,arrival hall': '转机问路',
  // 机场入境 - shared
  // '机场入境,customs' -> shared
  // '机场入境,declare' -> shared
  // '机场入境,customs declaration' -> shared
  // '机场入境,duty-free' -> shared
  // '机场入境,security check' -> shared

  // 认识室友 - 初次见面
  '认识室友,introduce': '初次见面',
  '认识室友,hometown': '初次见面',
  '认识室友,major': '初次见面',
  '认识室友,freshman': '初次见面',
  '认识室友,originally from': '初次见面',
  // 认识室友 - 聊家乡
  '认识室友,get used to': '聊家乡',
  '认识室友,culture shock': '聊家乡',
  '认识室友,adapt': '聊家乡',
  '认识室友,campus': '聊家乡',
  // 认识室友 - 邀请一起吃饭
  '认识室友,hang out': '邀请一起吃饭',
  '认识室友,semester': '邀请一起吃饭',
  '认识室友,schedule': '邀请一起吃饭',
  // 认识室友 - 商量宿舍规则
  '认识室友,privacy': '商量宿舍规则',
  '认识室友,polite': '商量宿舍规则',
  '认识室友,share': '商量宿舍规则',
  // 认识室友 - 分享兴趣爱好
  '认识室友,hobby': '分享兴趣爱好',
  '认识室友,personality': '分享兴趣爱好',
  '认识室友,common interest': '分享兴趣爱好',
  '认识室友,conversation': '分享兴趣爱好',
  '认识室友,spoken language': '分享兴趣爱好',
  // 认识室友 - shared
  // '认识室友,roommate' -> shared
};

lines = vocabs.split('\n');
updated = [lines[0]];
for (let i = 1; i < lines.length; i++) {
  let line = lines[i].trim();
  if (!line) continue;
  let topicTitle = '';
  for (const [prefix, topic] of Object.entries(vocabTopicMap)) {
    if (line.includes(prefix)) { topicTitle = topic; break; }
  }
  let firstComma = line.indexOf(',');
  line = line.substring(0, firstComma + 1) + topicTitle + ',' + line.substring(firstComma + 1);
  updated.push(line);
}
writeFileSync(`${PKG_DIR}/scene_vocabulary.csv`, updated.join('\n'), 'utf8');
console.log('scene_vocabulary.csv: ' + (updated.length - 1) + ' rows');
