// Batch course dialogue generator for Courses 3-10
// Reads topic data from JSON and writes MD files
const fs = require('fs');
const path = require('path');
const baseDir = path.join(__dirname, '..', 'data', 'packages');

// Common topic count per scene
const T = (id, name, scenario, focus, vocab, ext, chunks, patterns, dialogue) =>
  [id, name, scenario, focus, vocab, ext, chunks, patterns, dialogue];

// ─── Helper: session notes / follow-up / practical scenarios ───
const D = (sp, ln) => [sp, ln];

function genCourse(dirName, courseNum, review, grammarNote, scenes) {
  const dir = path.join(baseDir, dirName, '学习包的功能介绍.md');
  if (!fs.existsSync(dir)) { console.log(`  SKIP ${dirName}`); return; }
  let content = fs.readFileSync(dir, 'utf8');
  const idx = content.indexOf('## 逐 Topic 完整教学设计');
  if (idx === -1) { console.log(`  SKIP ${dirName}: no section`); return; }
  
  let out = content.substring(0, idx) + '\n\n## 逐 Topic 完整教学设计\n\n';
  out += `> 下列内容是生成 CSV、Warmup 与 Ink 的权威 Topic 契约。每个 Topic 均复用：${review}。**注意：以下 20 个 Topic 的对话和句块均独立设计，请勿跨 Topic 复用模板。**\n\n`;
  out += `> ${grammarNote}\n\n`;
  
  let total = 0;
  scenes.forEach(([sceneName, topics], si) => {
    topics.forEach((t, ti) => {
      total++;
      const [id, name, scenario, focus, vocab, ext, chunks, patterns, dialogue] = t;
      const gi = si * 4 + ti + 1;
      const ol = gi <= 8 ? '2—5' : '3—5';
      const wl = gi <= 8 ? '120—250' : '180—250';
      const sf = gi <= 8 ? '' : '，并回答至少 2 个追问';
      
      out += `### Topic ${id} · ${name}\n\n`;
      out += `- **教学说明**：在"${scenario}"情境中学习${name}。本Topic聚焦：${focus}。\n`;
      out += `- **核心词（Vocabulary）**：${vocab}。\n`;
      out += `- **扩展词（Extension）**：${ext}。\n`;
      out += `- **核心句块（Chunks）**：` + chunks.map(c => `\`${c}\``).join('；') + `。\n`;
      out += `- **句型（Patterns）**：\`${patterns[0]}\`；\`${patterns[1]}\`。\n`;
      out += `- **完成标准**：能在陌生变体中完成 12—16 轮互动，使用至少 3 个核心句块和 1 个主句型，并形成结论、决定或下一步。\n`;
      out += `- **口语输出**：围绕"${scenario}"完成 ${ol} 分钟未准备任务；不得照读对话${sf}。\n`;
      out += `- **微写作**：写 ${wl} 词，内容必须重新组织，不得抄写口语稿。\n`;
      out += `- **反馈与重做**：按任务完成、结构、词汇、语法及发音/拼写反馈；完成第二次重说和重写，7 天后换情境复测。\n`;
      out += `- **跨包复习**：${review}；本 Topic 新表达须在本包后续至少两个 Topic 再次主动调用。\n`;
      out += `- **具体对话**：\n`;
      dialogue.forEach(([sp, ln], di) => { out += `  ${di + 1}. ${sp}: ${ln}\n`; });
      out += `\n`;
    });
  });
  fs.writeFileSync(dir, out, 'utf8');
  console.log(`  ✓ ${dirName} (${total} topics)`);
}

// ═══════════════════════════════════════════
// COURSE 3 - 海外独立生活 (remaining scenes 2-5)
// ═══════════════════════════════════════════
genCourse('course-3-independent-living', 3,
  'Foundation 2、7、9、10 的需求、礼貌请求、比较和间接问句',
  '本包新语法**使役结构**和**被动语态入门**已在各 Topic 的 Chunks 和对话中自然嵌入。',
  [
    ['租房入住', [
      T('01','说明住房需求','finding an affordable apartment','Clearly stating requirements and constraints','`appointment`,`document`,`requirement`,`fee`','`eligibility`,`availability`',
        ['I am looking for a one-bedroom apartment within walking distance of the station.','My budget is fairly tight, so I need something under eight hundred a month.','Do you have any units available that match those requirements?','I would also need the place to be furnished, if possible.'],
        ['I am looking for ___.','My budget is ___, so I need ___.'],
        [D('Staff','Good morning. How can I help you with your apartment search?'),D('Lin','I am looking for a one-bedroom apartment within walking distance of the station. My budget is tight, so I need something under eight hundred a month.'),D('Staff','I have a few options. Any other requirements?'),D('Lin','I would also need the place to be furnished, if possible. And I prefer a quiet building.'),D('Staff','That narrows it down. Let me show you two units that match.'),D('Lin','Do you have any units available right now? I am hoping to move in by the end of the month.')]),
      T('02','看房提问','inspecting a potential apartment','Asking the right questions during a viewing','`inspection`,`condition`,`utility`,`appliance`','`noticeable`,`functional`',
        ['Could you show me how the heating system works?','Are there any issues I should know about, like noise or plumbing problems?','What is included in the rent, and what utilities would I pay separately?','When was the last time the appliances were checked or replaced?'],
        ['Could you show me how ___ works?','What is included in ___, and what ___?'],
        [D('Agent','This is the unit. As you can see, it gets plenty of natural light.'),D('Lin','Could you show me how the heating system works? I want to make sure I can control the temperature.'),D('Agent','The thermostat is here. The radiators were serviced last winter.'),D('Lin','Are there any issues like noise or plumbing problems? What is included in the rent?'),D('Agent','Water is included. Electricity and internet are separate. The building is generally quiet.'),D('Lin','One more thing: when was the last time the appliances were checked? The refrigerator looks old.'),D('Agent','All appliances were inspected six months ago. Everything is in working order.')]),
      T('03','确认合同条件','reviewing a lease agreement','Understanding and confirming contract terms','`lease`,`clause`,`deposit`,`notice`','`legally`,`binding`',
        ['Before I sign, I would like to clarify a few points in the contract.','Could you explain what this clause means in plain language?','How much notice do I need to give if I decide to move out?','I want to make sure we are both clear on the terms before I commit.'],
        ['Before I sign, I would like to clarify ___.','How much notice ___?'],
        [D('Lin','Before I sign, I would like to clarify a few points. Could you explain the wear-and-tear clause in plain language?'),D('Agent','Normal use over time is the landlord\'s responsibility. You are only charged for actual damage.'),D('Lin','How much notice do I need to give if I decide to move out? Is the deposit fully refundable?'),D('Agent','Thirty days written notice. The deposit is refundable minus documented deductions.'),D('Lin','Good. I want to make sure we are both clear before I commit. Everything else looks straightforward.')]),
      T('04','报修沟通','reporting a broken water heater','Clearly describing a maintenance issue','`repair`,`fault`,`urgent`,`technician`','`temporarily`,`persistent`',
        ['I am calling to report a problem with the water heater in apartment 302.','It has not been working properly since yesterday evening.','The water only gets lukewarm, and there is a strange noise coming from the unit.','Is it possible to send someone to take a look this week?'],
        ['I am calling to report ___.','Is it possible to send someone ___?'],
        [D('Lin','Hello, I am calling to report a problem with the water heater. It has not been working properly since yesterday.'),D('Staff','Can you describe the issue?'),D('Lin','The water only gets lukewarm, and there is a humming noise. I have tried adjusting the settings.'),D('Staff','I will log that. How urgent is it?'),D('Lin','Not an emergency, but could you send someone this week? Is Thursday possible?'),D('Staff','I can schedule Thursday morning. Will someone be home?'),D('Lin','Yes, I will make sure I am there. Thank you.')])
    ]],
    ['医疗健康', [
      T('05','预约','booking a doctor appointment','Making and confirming medical appointments','`appointment`,`symptom`,`available`,`referral`','`urgent`,`routine`',
        ['I would like to schedule an appointment with a general practitioner.','Do you have any slots available this week, preferably in the morning?','I have been experiencing some discomfort for the past few days.','Could you confirm the date and time, and what I should bring?'],
        ['I would like to schedule ___.','Do you have any slots ___?'],
        [D('Lin','I would like to schedule an appointment with a GP. I have been experiencing some discomfort for the past few days.'),D('Receptionist','Do you have a preference for time of day?'),D('Lin','Do you have any slots this week, preferably in the morning?'),D('Receptionist','We have Wednesday at ten-fifteen. Does that work?'),D('Lin','Yes. Could you confirm what I should bring?'),D('Receptionist','Your insurance card and photo ID. You are booked for Wednesday at ten-fifteen.')]),
      T('06','描述症状经过','explaining symptoms to a doctor','Giving a clear timeline of medical symptoms','`symptom`,`duration`,`severity`,`trigger`','`persistent`,`gradual`',
        ['It started about a week ago with a mild headache that would not go away.','Over the past few days, the pain has moved to the back of my neck.','The discomfort gets worse when I sit at my desk for more than an hour.','I have not taken any medication yet because I wanted to check with you first.'],
        ['It started ___ ago with ___.','___ gets worse when ___.'],
        [D('Doctor','What brings you in today?'),D('Lin','It started about a week ago with a mild headache that would not go away. I thought it was just stress.'),D('Doctor','Has it changed over time?'),D('Lin','Over the past few days, the pain moved to the back of my neck. It gets worse when I sit at my desk for more than an hour.'),D('Doctor','Have you taken anything for it?'),D('Lin','No, I wanted to check with you first.'),D('Doctor','That was wise. Let me do a quick examination.')]),
      T('07','听懂建议','understanding medical advice','Making sure you understand the doctor\'s instructions','`prescription`,`dosage`,`instruction`,`follow-up`','`specifically`,`exactly`',
        ['Let me make sure I have understood: I should take this twice a day with food.','Could you explain what "apply sparingly" means in practice?','Is there anything I should avoid while taking this medication?','When should I come back if the symptoms do not improve?'],
        ['Let me make sure I have understood: ___.','When should I ___ if ___?'],
        [D('Doctor','Take one tablet twice a day with food. Apply this cream sparingly to the affected area.'),D('Lin','Let me make sure I understood: one tablet twice a day with food. But what does "sparingly" mean? A pea-sized amount?'),D('Doctor','Exactly. A pea-sized amount, rubbed in gently.'),D('Lin','Is there anything I should avoid? When should I come back if there is no improvement?'),D('Doctor','Avoid alcohol. Come back in ten days if there is no improvement.'),D('Lin','Got it. Thank you, doctor.')]),
      T('08','药物与复诊','picking up medication and scheduling follow-up','Handling pharmacy interactions and follow-ups','`prescription`,`refill`,`dosage`,`follow-up`','`over-the-counter`,`as needed`',
        ['I have a prescription to pick up. The name is Lin Zhang.','Are there any side effects I should watch out for with this medication?','Can I get a refill on this, or do I need a new prescription each time?','I would also like to schedule a follow-up appointment in two weeks.'],
        ['I have a prescription for ___.','Are there any side effects ___?'],
        [D('Pharmacist','How can I help you?'),D('Lin','I have a prescription to pick up. The name is Lin Zhang. Are there any side effects I should watch out for?'),D('Pharmacist','This may cause mild drowsiness. Avoid driving initially until you know how it affects you.'),D('Lin','Can I get a refill on this, or do I need a new prescription?'),D('Pharmacist','This includes one refill. After that, see your doctor again.'),D('Lin','Thanks. I would also like to call the clinic to schedule a follow-up in two weeks.')])
    ]],
    ['银行账单', [
      T('09','开户与验证','opening a bank account','Navigating account opening and ID verification','`account`,`verification`,`identification`,`deposit`','`eligible`,`valid`',
        ['I would like to open a basic checking account, please.','What documents do I need to provide for identification?','Is there a minimum deposit required to open the account?','How long does it typically take for the account to be activated?'],
        ['I would like to open ___.','What documents do I need for ___?'],
        [D('Banker','Welcome. How can I assist you?'),D('Lin','I would like to open a basic checking account. What documents do I need for identification?'),D('Banker','Your passport and a recent utility bill. I will also need your tax ID number.'),D('Lin','I have those here. Is there a minimum deposit? How long until the account is active?'),D('Banker','Twenty-five dollars minimum. The account will be active within one business day. Your debit card arrives by mail in about a week.'),D('Lin','Perfect. Let us proceed.')]),
      T('10','解释交易','disputing an unfamiliar charge','Explaining and questioning transactions','`transaction`,`charge`,`statement`,`dispute`','`unauthorised`,`legitimate`',
        ['I noticed a charge on my statement that I do not recognise.','It is for forty-five dollars, dated last Tuesday, from a merchant I have never used.','Could you look into this transaction and tell me what it is for?','If it is not something I authorised, I would like to dispute it.'],
        ['I noticed a charge ___.','Could you look into ___?'],
        [D('Lin','I noticed a charge on my statement I do not recognise. Forty-five dollars from "DigiServe" last Tuesday.'),D('Agent','I can look into that. Can you confirm the last four digits of your card?'),D('Lin','8721. Could you look into this transaction? If it is not authorised, I would like to dispute it.'),D('Agent','It appears to be a subscription renewal. Did you sign up for a free trial last month?'),D('Lin','Now that you mention it, yes. They must have started charging after the trial. I will cancel directly. Thank you.')]),
      T('11','询问费用','asking about account fees','Inquiring about fees and how to avoid them','`fee`,`charge`,`waive`,`overdraft`','`annually`,`automatically`',
        ['Could you explain what fees are associated with this account?','Is there a way to waive the monthly maintenance fee?','What happens if my balance drops below the minimum?','Are there any hidden charges I should be aware of?'],
        ['Could you explain what fees ___?','Is there a way to ___?'],
        [D('Lin','Before I finalise, could you explain what fees are associated with this account?'),D('Banker','There is a five-dollar monthly fee, waived if you maintain a five-hundred-dollar minimum balance or set up direct deposit.'),D('Lin','Is there a way to waive it without the minimum balance? What if my balance drops?'),D('Banker','Direct deposit is easiest. If your balance drops below five hundred, the fee applies that month. There are no hidden charges.'),D('Lin','I will set up the direct deposit then. That works for me.')]),
      T('12','处理账单差异','resolving a billing error','Addressing discrepancies in charges','`discrepancy`,`error`,`adjustment`,`refund`','`incorrectly`,`overcharged`',
        ['There seems to be a discrepancy between the amount I was quoted and what I was charged.','I was told the service would cost sixty dollars, but my bill shows eighty-five.','Could you review the charges and explain the difference?','If this was an error, I would appreciate an adjustment on my next bill.'],
        ['There seems to be a discrepancy between ___.','I was told ___, but ___.'],
        [D('Lin','There seems to be a discrepancy. I was told internet installation would be sixty dollars, but my bill shows eighty-five.'),D('Agent','Let me pull up your account and review the charges.'),D('Lin','Could you explain the difference? If this was an error, I would appreciate an adjustment.'),D('Agent','I can see the issue. An additional service was added by mistake. I will remove that charge and issue a twenty-five-dollar credit.'),D('Lin','Thank you. I appreciate the quick resolution.')])
    ]],
    ['交通出行', [
      T('13','规划路线','planning public transport across a new city','Using transit info to plan a route','`route`,`transfer`,`schedule`,`fare`','`direct`,`indirect`',
        ['What is the fastest way to get from the airport to the city centre?','Do I need to transfer, or is there a direct route?','How much is the fare, and can I pay with a contactless card?','Is there an app I can use to track schedules in real time?'],
        ['What is the fastest way from ___ to ___?','Do I need to ___, or ___?'],
        [D('Lin','Excuse me, what is the fastest way from the airport to the city centre?'),D('Staff','The express train takes thirty minutes. The bus is cheaper but takes twice as long.'),D('Lin','Do I need to transfer? How much is the fare and can I use a contactless card?'),D('Staff','The train is direct. Nine dollars. Contactless cards work. There is also an app called CityTransit for real-time schedules.'),D('Lin','Perfect. I will download that now. Thank you.')]),
      T('14','票务规则','understanding ticket types and restrictions','Asking about ticket options and rules','`ticket`,`valid`,`peak`,`off-peak`','`return`,`single`',
        ['Could you explain the difference between a single and a return ticket?','Is this ticket valid for the entire day, or just for one journey?','Are there any time restrictions I should know about?','What happens if I need to change my return date?'],
        ['Could you explain the difference between ___?','Is this ticket valid for ___?'],
        [D('Lin','Could you explain the difference between a single and a return ticket to Manchester?'),D('Agent','A single is one-way. A return covers both directions and is cheaper than two singles. An open return lets you come back any day within a month.'),D('Lin','Is the open return valid all day? Any time restrictions?'),D('Agent','Valid for any off-peak train. Peak hours are before nine-thirty. There is a small fee to change the return date.'),D('Lin','Good. One open return, please.')]),
      T('15','延误改签','dealing with a cancelled train','Handling travel disruptions','`delay`,`cancellation`,`alternative`,`compensation`','`unexpectedly`,`eligible`',
        ['My train has been cancelled. What are my options?','Am I eligible for a refund or compensation?','Is there another route I can take to get to my destination today?','How do I rebook my ticket for a later service?'],
        ['My ___ has been cancelled. What are my options?','Am I eligible for ___?'],
        [D('Lin','My train to Manchester has been cancelled. What are my options? Am I eligible for a refund?'),D('Agent','You can take the next available service with the same ticket, or request a full refund. Delays over an hour may qualify for compensation.'),D('Lin','Is there another route I can take today? How do I rebook?'),D('Agent','The next train leaves in forty minutes from platform three. I can rebook you now.'),D('Lin','Please do. Thank you for your help.')]),
      T('16','租车与保险','renting a car for a weekend trip','Understanding rental terms and insurance','`rental`,`insurance`,`excess`,`coverage`','`comprehensive`,`optional`',
        ['I would like to rent a compact car for the weekend.','Can you walk me through the insurance options?','What is the excess if there is an accident?','Is there a penalty for returning the car late?'],
        ['I would like to rent ___.','Can you walk me through ___?'],
        [D('Lin','I would like to rent a compact car from Friday to Sunday. Can you walk me through the insurance options?'),D('Agent','Basic coverage is included. Comprehensive is fifteen dollars extra per day and reduces your excess to zero.'),D('Lin','What is the excess on the basic plan? Is there a late return penalty?'),D('Agent','One thousand dollars excess on basic. A one-hour grace period for returns, then charged for an extra day.'),D('Lin','I will take the comprehensive coverage for peace of mind.')])
    ]],
    ['政务社区', [
      T('17','填表和材料','completing a residence registration form','Understanding official forms and documents','`application`,`document`,`requirement`,`supporting`','`mandatory`,`optional`',
        ['I need to complete a residence registration. Which form should I fill out?','What supporting documents do I need to submit with the application?','Is there anything I should double-check before submitting?','How long does the processing usually take?'],
        ['Which form should I fill out for ___?','What supporting documents ___?'],
        [D('Lin','I need to complete a residence registration. Which form should I fill out?'),D('Clerk','Form RC-1, available online or at the counter. You will need your passport, a utility bill as proof of address, and a passport photo.'),D('Lin','What should I double-check before submitting? How long does processing take?'),D('Clerk','Make sure your name matches across all documents, including middle names. Processing takes about ten working days.'),D('Lin','Thank you. I will prepare everything and come back.')]),
      T('18','电话咨询','calling a government office for information','Getting information efficiently over the phone','`inquiry`,`procedure`,`eligibility`,`reference`','`specifically`,`currently`',
        ['I am calling to inquire about the procedure for renewing my permit.','Could you direct me to the right department for this?','Is there a reference number I should note down for future calls?','Can you confirm that I have understood the process correctly?'],
        ['I am calling to inquire about ___.','Could you direct me to ___?'],
        [D('Lin','I am calling to inquire about renewing my residence permit. Could you direct me to the right department?'),D('Operator','That would be Immigration Services. Let me transfer you. Do you have a reference number?'),D('Lin','Not yet—this is my first inquiry.'),D('Operator','Let me give you a case number: IS-2026-4782. Note that for future calls. Anything else?'),D('Lin','No, that is all. Thank you for your help.')]),
      T('19','预约办理','scheduling an in-person appointment','Booking and preparing for official appointments','`appointment`,`slot`,`confirmation`,`preparation`','`available`,`required`',
        ['I would like to book an appointment to submit my application in person.','What is the earliest available slot you have?','What should I bring with me to the appointment?','Could you send me a confirmation email with the details?'],
        ['I would like to book an appointment for ___.','What should I bring ___?'],
        [D('Lin','I would like to book an appointment to submit my residence application in person. What is the earliest slot?'),D('Clerk','Next Tuesday at nine-fifteen, or Thursday at two. Which would you prefer?'),D('Lin','Tuesday morning works best. What should I bring? Could you send a confirmation email?'),D('Clerk','Bring all original documents plus one photocopy of each. I will send the confirmation now. You should receive it shortly.'),D('Lin','Perfect. I will see you on Tuesday.')]),
      T('20','社区资源','finding local community services','Asking about libraries, centres, and resources','`resource`,`facility`,`membership`,`access`','`freely`,`locally`',
        ['I just moved to the area. What community resources are available nearby?','Is there a public library within walking distance?','Do I need a membership to use the community centre?','Are there any free services or programmes I should know about?'],
        ['What community resources are available ___?','Do I need a membership to ___?'],
        [D('Lin','Hi, I just moved here. What community resources are available nearby? Is there a library?'),D('Staff','Welcome! The library is two blocks east—free to join with proof of address. There is also a community centre with a gym and language classes.'),D('Lin','Do I need a membership for the community centre? Any free programmes?'),D('Staff','Small annual fee, but quite affordable. The library runs free English conversation groups every Wednesday evening.'),D('Lin','That sounds perfect for me. I will check out both. Thank you!')])
    ]]
  ]
);

console.log('\n✓ Course 3 complete (20 topics)');
console.log('⏳ Courses 4-10 still need to be processed.');
console.log('   Run the companion script for courses 4-6, then 7-8, then 9-10.');
