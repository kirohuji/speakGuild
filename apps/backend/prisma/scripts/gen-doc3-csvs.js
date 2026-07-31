const fs = require('fs');
const path = require('path');

const pkgDir = path.join(__dirname, '..', 'data', 'packages', 'foundation-3-daily-work');

// ============ SCENES ============
const scenes = [
  { category_name: '日常工作', title: '认识同事与团队', location: 'office', required_output_level: 'L1', required_user_level: 'beginner', description: '学习用 he/she 介绍同事、岗位、部门与联系信息', package_type: 'foundation' },
  { category_name: '日常工作', title: '工作职责与安排', location: 'office', required_output_level: 'L1', required_user_level: 'beginner', description: '学习用第三人称肯定句描述工作动作、通讯和客户服务', package_type: 'foundation' },
  { category_name: '日常工作', title: '询问、否定与确认', location: 'office', required_output_level: 'L1', required_user_level: 'beginner', description: '学习 Does/doesn\'t/has 进行第三人称问答与信息修正', package_type: 'foundation' },
  { category_name: '日常工作', title: '个人与团队协作', location: 'office', required_output_level: 'L1', required_user_level: 'beginner', description: '学习对比单复数主语、指派任务、状态说明与同事档案', package_type: 'foundation' },
];

// ============ TOPICS ============
const topics = [
  // Scene A: 认识同事与团队
  { scene_title: '认识同事与团队', title: '同事与岗位', prompt_en: 'Look at the team. Who is this person?', prompt_zh: '看看这个团队。这个人是谁？', duration_sec: 900, difficulty: 'L1', description: '学习用 he/she 介绍同事及其岗位', knowledge_points: 'he/she is, job titles (designer, manager, assistant, receptionist, engineer)', teaching_markdown: '## 同事与岗位\n\n学习用第三人称 he/she 介绍同事及其岗位身份。\n\n### 核心句块\n- Mia is our colleague and designer.\n- Emma is our manager.\n- Ben is a front desk assistant.\n- Sofia is the receptionist, and Alex is the engineer.\n\n### 教学重点\n- He/She is our...\n- 名字 + is a/an...\n- 区分 he 和 she 的使用', ink_script_key: 'practice_foundation-daily-work_基础_认识团队_同事与岗位' },
  { scene_title: '认识同事与团队', title: '部门与地点', prompt_en: 'Where does each person work?', prompt_zh: '每个人在哪里工作？', duration_sec: 900, difficulty: 'L1', description: '学习用肯定句说明同事所属部门和工作位置', knowledge_points: 'works in/at/for, department names (sales, support, design)', teaching_markdown: '## 部门与地点\n\n学习说明同事的工作部门、位置和公司。\n\n### 核心句块\n- Sofia works in the sales department.\n- Ben works in customer support.\n- Mia works in design.\n- He works at the front desk for a small company.\n\n### 教学重点\n- works in + 部门\n- works at + 具体位置\n- works for + 公司', ink_script_key: 'practice_foundation-daily-work_基础_认识团队_部门与地点' },
  { scene_title: '认识同事与团队', title: '介绍一位同事', prompt_en: 'Introduce a colleague: their role and background.', prompt_zh: '介绍一位同事：角色和背景。', duration_sec: 900, difficulty: 'L1', description: '学习用 his/her/our 说明同事的角色和背景', knowledge_points: 'his/her/our, role, background', teaching_markdown: '## 介绍一位同事\n\n学习用 his/her/our 说明同事的角色和特点。\n\n### 核心句块\n- His role is customer support.\n- Her background is in visual design.\n- She is our friendly colleague.\n- Our manager knows his role and her background.\n\n### 教学重点\n- His/Her role is...\n- His/Her background is...\n- Our colleague is...', ink_script_key: 'practice_foundation-daily-work_基础_认识团队_介绍同事' },
  { scene_title: '认识同事与团队', title: '联系信息', prompt_en: 'How can you reach this colleague?', prompt_zh: '你怎么联系这位同事？', duration_sec: 900, difficulty: 'L1', description: '学习说明同事的分机、工位和联系方式', knowledge_points: 'reach at, extension, desk, directory, contact details', teaching_markdown: '## 联系信息\n\n学习说明如何联系某位同事。\n\n### 核心句块\n- These are Ben\'s contact details.\n- His extension is 204.\n- His desk is beside the entrance.\n- You can reach him through the staff directory.\n\n### 教学重点\n- You can reach him/her at...\n- His/Her extension is...\n- check the directory', ink_script_key: 'practice_foundation-daily-work_基础_认识团队_联系信息' },

  // Scene B: 工作职责与安排
  { scene_title: '工作职责与安排', title: '开始一天', prompt_en: 'How does this person start the day?', prompt_zh: '这个人怎么开始一天的工作？', duration_sec: 900, difficulty: 'L1', description: '学习用肯定句描述同事开始工作时的基础动作', knowledge_points: 'starts, checks, opens, logs in, 第三人称 -s', teaching_markdown: '## 开始一天\n\n学习描述同事开始工作的流程。\n\n### 核心句块\n- She starts work at nine.\n- He checks the schedule first.\n- She opens the calendar.\n- He logs in before the first task.\n\n### 教学重点\n- 规则动词 +s\n- 动作顺序描述', ink_script_key: 'practice_foundation-daily-work_基础_工作职责_开始一天' },
  { scene_title: '工作职责与安排', title: '电话与邮件', prompt_en: 'What communication duties does each person have?', prompt_zh: '每个人有什么通讯职责？', duration_sec: 900, difficulty: 'L1', description: '学习用第三人称肯定句描述接听、书写、转发等通讯职责', knowledge_points: 'answers, writes, forwards, attaches, prints, 第三人称 -s/-es', teaching_markdown: '## 电话与邮件\n\n学习描述接听、书写、转发等通讯职责。\n\n### 核心句块\n- He answers the main line.\n- She writes the daily report.\n- She forwards the report and attaches the document.\n- He prints one copy for the front desk.\n\n### 教学重点\n- answers / writes / forwards / attaches / prints\n- 第三人称 -s/-es', ink_script_key: 'practice_foundation-daily-work_基础_工作职责_电话与邮件' },
  { scene_title: '工作职责与安排', title: '帮助客户', prompt_en: 'How does this person help customers?', prompt_zh: '这个人怎么帮助客户？', duration_sec: 900, difficulty: 'L1', description: '学习描述服务人员如何接待、解释、提供方案并引导客户', knowledge_points: 'guides, explains, solves, offers, 第三人称 -s/-es', teaching_markdown: '## 帮助客户\n\n学习描述接待客户、解释问题、提供方案。\n\n### 核心句块\n- He guides each customer to the right place.\n- She explains the question clearly.\n- He offers a simple solution.\n- She solves basic customer problems.\n\n### 教学重点\n- guides / explains / solves\n- 服务场景动词', ink_script_key: 'practice_foundation-daily-work_基础_工作职责_帮助客户' },
  { scene_title: '工作职责与安排', title: '完成与跟进', prompt_en: 'How does this person finish and follow up?', prompt_zh: '这个人怎么完成和跟进工作？', duration_sec: 900, difficulty: 'L1', description: '学习描述完成任务、赶截止时间和跟进', knowledge_points: 'finishes, tries, carries, follows up, 第三人称 -es/-ies', teaching_markdown: '## 完成与跟进\n\n学习描述完成和跟进工作。\n\n### 核心句块\n- She finishes the task before the deadline.\n- He tries to complete it by four.\n- She follows up after she completes the report.\n- He carries the copies downstairs.\n\n### 教学重点\n- finishes / tries / carries / follows up\n- -es / -ies 变化', ink_script_key: 'practice_foundation-daily-work_基础_工作职责_完成与跟进' },

  // Scene C: 询问、否定与确认
  { scene_title: '询问、否定与确认', title: 'Does 问答', prompt_en: 'Ask and answer about this person\'s duties using Does.', prompt_zh: '用 Does 询问和回答这个人的职责。', duration_sec: 900, difficulty: 'L1', description: '学习用 Does...? 询问第三人称工作信息并作简短回答', knowledge_points: 'Does, Yes he/she does, No he/she doesn\'t, confirms', teaching_markdown: '## Does 问答\n\n学习用 Does 询问第三人称信息。\n\n### 核心句块\n- Does Ben start at eight? — No, he doesn\'t.\n- Does Mia write the report? — Yes, she does.\n- Please confirm the correct shift.\n- This confirms each person\'s duty.\n\n### 教学重点\n- Does 后动词还原原形\n- 简短回答', ink_script_key: 'practice_foundation-daily-work_基础_询问确认_Does问答' },
  { scene_title: '询问、否定与确认', title: '询问具体信息', prompt_en: 'Ask about specific work details using question words.', prompt_zh: '用疑问词询问具体工作信息。', duration_sec: 900, difficulty: 'L1', description: '学习使用 What/Where/When/Who does...? 获取具体信息', knowledge_points: 'What does, Where does, When does, Who does', teaching_markdown: '## 询问具体信息\n\n学习用疑问词获取工作信息。\n\n### 核心句块\n- What task does she complete first?\n- Where is her work location?\n- When does he finish?\n- Who is the right person for this detail?\n\n### 教学重点\n- 疑问词 + does + 动词原形\n- 回答恢复第三人称', ink_script_key: 'practice_foundation-daily-work_基础_询问确认_具体信息' },
  { scene_title: '询问、否定与确认', title: '否定与纠正', prompt_en: 'Correct the wrong information about this person.', prompt_zh: '纠正关于这个人的错误信息。', duration_sec: 900, difficulty: 'L1', description: '学习用 doesn\'t + 动词原形否定错误信息并补充准确事实', knowledge_points: "doesn't + base form, actually, instead, correction", teaching_markdown: '## 否定与纠正\n\n学习否定错误信息和纠正。\n\n### 核心句块\n- That information is a mistake.\n- She doesn\'t answer the line; she writes instead.\n- He actually works at the front desk.\n- This correction makes the fact accurate.\n\n### 教学重点\n- doesn\'t + 动词原形（不能 doesn\'t + 三单）\n- actually / instead 自然纠正', ink_script_key: 'practice_foundation-daily-work_基础_询问确认_否定与纠正' },
  { scene_title: '询问、否定与确认', title: 'have 与 has', prompt_en: 'Ask and answer about what this person has.', prompt_zh: '询问和回答这个人拥有什么。', duration_sec: 900, difficulty: 'L1', description: '学习用 has 表达某人持有物品，在 Does 问句中还原为 have', knowledge_points: 'has, Does ... have, I have / She has / Does she have', teaching_markdown: '## have 与 has\n\n学习 has 和 Does ... have 的转换。\n\n### 核心句块\n- She has a meeting at ten.\n- He has the presentation equipment.\n- Does she have the main file? — Yes, she does.\n- The document is on her device.\n\n### 教学重点\n- have → has（第三人称）\n- Does ... have?（have 还原）', ink_script_key: 'practice_foundation-daily-work_基础_询问确认_have与has' },

  // Scene D: 个人与团队协作
  { scene_title: '个人与团队协作', title: '一个人与一组人', prompt_en: 'Compare one person and a group.', prompt_zh: '对比一个人和一组人。', duration_sec: 900, difficulty: 'L1', description: '学习对比单个人和一组人作主语的动词形式', knowledge_points: 'She works / They work, He has / They have', teaching_markdown: '## 一个人与一组人\n\n学习单复数主语动词对比。\n\n### 核心句块\n- One individual writes; the group reviews.\n- She is a staff member; they are staff members.\n- Several members have different duties.\n- The group works as one team.\n\n### 教学重点\n- She works / They work\n- He has / They have', ink_script_key: 'practice_foundation-daily-work_基础_团队协作_单人与团队' },
  { scene_title: '个人与团队协作', title: '谁负责', prompt_en: 'Who handles this task? Assign it.', prompt_zh: '谁负责这个任务？请指派。', duration_sec: 900, difficulty: 'L1', description: '学习询问谁负责某项工作并完成任务指派', knowledge_points: 'Who handles, responsible for, assign to, transfer to', teaching_markdown: '## 谁负责\n\n学习询问负责人和指派工作。\n\n### 核心句块\n- Who handles this? — Mia does.\n- She is responsible for this task.\n- Emma assigns the work to him.\n- Please transfer the copies to them.\n\n### 教学重点\n- Who handles...?\n- be responsible for...\n- assign/transfer ... to him/her/them', ink_script_key: 'practice_foundation-daily-work_基础_团队协作_谁负责' },
  { scene_title: '个人与团队协作', title: '当前工作状态', prompt_en: 'Is this person available? What is their status?', prompt_zh: '这个人有空吗？什么状态？', duration_sec: 900, difficulty: 'L1', description: '学习说明同事是否可联系、忙碌、紧急程度及返回时间', knowledge_points: 'available, occupied, urgent, delay, return, waiting', teaching_markdown: '## 当前工作状态\n\n学习说明同事的工作状态。\n\n### 核心句块\n- Is she available now? — No, she is occupied.\n- The request is not urgent.\n- A short delay is okay.\n- She returns at three, so he is waiting.\n\n### 教学重点\n- available / occupied\n- urgent / delay / return', ink_script_key: 'practice_foundation-daily-work_基础_团队协作_当前状态' },
  { scene_title: '个人与团队协作', title: '同事工作档案', prompt_en: 'Create a complete work profile for a colleague.', prompt_zh: '为一位同事创建完整的工作档案。', duration_sec: 900, difficulty: 'L1', description: '综合岗位、地点、职责、has 和团队对比制作同事档案', knowledge_points: 'introduce, describe, main, overall, summary, profile', teaching_markdown: '## 同事工作档案\n\n学习综合制作同事档案。\n\n### 核心句块\n- Let me introduce her work profile.\n- I can describe her main role.\n- Overall, she supports the whole team.\n- In summary, this profile is complete.\n\n### 教学重点\n- introduce / describe / main / overall / summary / profile\n- 综合输出 8-10 句', ink_script_key: 'practice_foundation-daily-work_基础_团队协作_工作档案' },
];

// ============ CHUNKS ============
// 16 topics × 4 chunks each = 64
const chunks = [
  // Scene A - 认识同事与团队
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', category: '核心句块', text: 'Mia is our colleague and designer.', meaning: 'Mia 是我们的同事兼设计师。', difficulty: 'L1', description: '介绍同事岗位', examples_json: '[{"en":"Emma is our manager.","zh":"Emma 是我们的经理。"},{"en":"Ben is our assistant.","zh":"Ben 是我们的助理。"}]' },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', category: '核心句块', text: 'Emma is our manager.', meaning: 'Emma 是我们的经理。', difficulty: 'L1', description: '介绍经理', examples_json: '[{"en":"Mia is our designer.","zh":"Mia 是我们的设计师。"},{"en":"Alex is our engineer.","zh":"Alex 是我们的工程师。"}]' },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', category: '核心句块', text: 'Ben is a front desk assistant.', meaning: 'Ben 是前台助理。', difficulty: 'L1', description: '介绍助理岗位', examples_json: '[{"en":"Sofia is a manager.","zh":"Sofia 是经理。"},{"en":"Alex is a technician.","zh":"Alex 是技术员。"}]' },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', category: '核心句块', text: 'Sofia is the receptionist, and Alex is the engineer.', meaning: 'Sofia 是接待员，Alex 是工程师。', difficulty: 'L1', description: '并列介绍多人岗位', examples_json: '[{"en":"Mia is the designer, and Ben is the assistant.","zh":"Mia 是设计师，Ben 是助理。"}]' },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', category: '核心句块', text: 'Sofia works in the sales department.', meaning: 'Sofia 在销售部工作。', difficulty: 'L1', description: 'works in + 部门', examples_json: '[{"en":"Ben works in support.","zh":"Ben 在支持部工作。"},{"en":"Mia works in design.","zh":"Mia 在设计部工作。"}]' },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', category: '核心句块', text: 'Ben works in customer support.', meaning: 'Ben 在客户支持部门工作。', difficulty: 'L1', description: 'works in + 部门', examples_json: '[{"en":"Sofia works in sales.","zh":"Sofia 在销售部工作。"},{"en":"Mia works in design.","zh":"Mia 在设计部工作。"}]' },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', category: '核心句块', text: 'Mia works in design.', meaning: 'Mia 在设计部门工作。', difficulty: 'L1', description: 'works in + 部门', examples_json: '[{"en":"Ben works in sales.","zh":"Ben 在销售部工作。"},{"en":"Sofia works in support.","zh":"Sofia 在支持部工作。"}]' },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', category: '核心句块', text: 'He works at the front desk for a small company.', meaning: '他在一家小公司的前台工作。', difficulty: 'L1', description: 'works at + 位置 + for + 公司', examples_json: '[{"en":"She works at a branch for a local company.","zh":"她在一家本地公司的分部工作。"}]' },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', category: '核心句块', text: 'His role is customer support.', meaning: '他的角色是客户支持。', difficulty: 'L1', description: 'His role is...', examples_json: '[{"en":"Her role is design.","zh":"她的角色是设计。"},{"en":"His role is sales.","zh":"他的角色是销售。"}]' },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', category: '核心句块', text: 'Her background is in visual design.', meaning: '她有视觉设计背景。', difficulty: 'L1', description: 'Her background is in...', examples_json: '[{"en":"His background is in engineering.","zh":"他有工程背景。"},{"en":"Her background is in service.","zh":"她有服务背景。"}]' },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', category: '核心句块', text: 'She is our friendly colleague.', meaning: '她是我们友善的同事。', difficulty: 'L1', description: 'our + 形容词 + colleague', examples_json: '[{"en":"He is our experienced colleague.","zh":"他是我们经验丰富的同事。"},{"en":"She is our creative colleague.","zh":"她是我们有创意的同事。"}]' },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', category: '核心句块', text: 'Our manager knows his role and her background.', meaning: '我们的经理了解他的角色和她的背景。', difficulty: 'L1', description: '综合 his/her 所有格', examples_json: '[{"en":"Our colleague knows his role and her background.","zh":"我们的同事了解他的角色和她的背景。"}]' },
  { scene_title: '认识同事与团队', topic_title: '联系信息', category: '核心句块', text: 'These are Ben\'s contact details.', meaning: '这些是 Ben 的联系信息。', difficulty: 'L1', description: 'contact details', examples_json: '[{"en":"These are Mia\'s contact details.","zh":"这些是 Mia 的联系信息。"}]' },
  { scene_title: '认识同事与团队', topic_title: '联系信息', category: '核心句块', text: 'His extension is 204.', meaning: '他的分机号是204。', difficulty: 'L1', description: 'extension', examples_json: '[{"en":"Her extension is 305.","zh":"她的分机号是305。"},{"en":"His extension is 410.","zh":"他的分机号是410。"}]' },
  { scene_title: '认识同事与团队', topic_title: '联系信息', category: '核心句块', text: 'His desk is beside the entrance.', meaning: '他的工位在入口旁边。', difficulty: 'L1', description: 'desk location', examples_json: '[{"en":"Her desk is beside the window.","zh":"她的工位在窗户旁边。"},{"en":"His desk is beside the stairs.","zh":"他的工位在楼梯旁边。"}]' },
  { scene_title: '认识同事与团队', topic_title: '联系信息', category: '核心句块', text: 'You can reach him through the staff directory.', meaning: '你可以通过员工通讯录联系他。', difficulty: 'L1', description: 'reach through directory', examples_json: '[{"en":"You can reach her through voicemail.","zh":"你可以通过语音信箱联系她。"}]' },

  // Scene B - 工作职责与安排
  { scene_title: '工作职责与安排', topic_title: '开始一天', category: '核心句块', text: 'She starts work at nine.', meaning: '她九点开始工作。', difficulty: 'L1', description: 'starts + 时间', examples_json: '[{"en":"He starts work at eight.","zh":"他八点开始工作。"},{"en":"She starts at nine thirty.","zh":"她九点半开始。"}]' },
  { scene_title: '工作职责与安排', topic_title: '开始一天', category: '核心句块', text: 'He checks the schedule first.', meaning: '他先查看日程。', difficulty: 'L1', description: 'checks', examples_json: '[{"en":"She checks the calendar first.","zh":"她先查看日历。"},{"en":"He checks the inbox first.","zh":"他先查看收件箱。"}]' },
  { scene_title: '工作职责与安排', topic_title: '开始一天', category: '核心句块', text: 'She opens the calendar.', meaning: '她打开日历。', difficulty: 'L1', description: 'opens', examples_json: '[{"en":"He opens the system.","zh":"他打开系统。"},{"en":"She opens the inbox.","zh":"她打开收件箱。"}]' },
  { scene_title: '工作职责与安排', topic_title: '开始一天', category: '核心句块', text: 'He logs in before the first task.', meaning: '他在第一个任务前登录。', difficulty: 'L1', description: 'logs in', examples_json: '[{"en":"She logs in to the team account.","zh":"她登录团队账号。"},{"en":"He logs in to the design system.","zh":"他登录设计系统。"}]' },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', category: '核心句块', text: 'He answers the main line.', meaning: '他接听总机。', difficulty: 'L1', description: 'answers', examples_json: '[{"en":"She answers customer questions.","zh":"她回答客户问题。"},{"en":"He answers customer requests.","zh":"他回答客户请求。"}]' },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', category: '核心句块', text: 'She writes the daily report.', meaning: '她写每日报告。', difficulty: 'L1', description: 'writes', examples_json: '[{"en":"He writes the daily note.","zh":"他写每日笔记。"},{"en":"She writes the summary.","zh":"她写摘要。"}]' },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', category: '核心句块', text: 'She forwards the report and attaches the document.', meaning: '她转发报告并添加文件附件。', difficulty: 'L1', description: 'forwards + attaches', examples_json: '[{"en":"He forwards the spreadsheet and attaches the copy.","zh":"他转发电子表格并附加副本。"}]' },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', category: '核心句块', text: 'He prints one copy for the front desk.', meaning: '他为前台打印一份。', difficulty: 'L1', description: 'prints', examples_json: '[{"en":"She prints the report for the manager.","zh":"她为经理打印报告。"},{"en":"He prints the document for the team.","zh":"他为团队打印文件。"}]' },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', category: '核心句块', text: 'He guides each customer to the right place.', meaning: '他把每位客户引导到正确地点。', difficulty: 'L1', description: 'guides', examples_json: '[{"en":"She guides each guest to the right room.","zh":"她把每位客人引导到正确房间。"}]' },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', category: '核心句块', text: 'She explains the question clearly.', meaning: '她清楚地解释问题。', difficulty: 'L1', description: 'explains', examples_json: '[{"en":"He explains the request clearly.","zh":"他清楚地解释请求。"},{"en":"She explains the issue clearly.","zh":"她清楚地解释问题。"}]' },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', category: '核心句块', text: 'He offers a simple solution.', meaning: '他提供一个简单方案。', difficulty: 'L1', description: 'offers + solution', examples_json: '[{"en":"She offers a simple option.","zh":"她提供一个简单选择。"},{"en":"He offers the next step.","zh":"他提供下一步。"}]' },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', category: '核心句块', text: 'She solves basic customer problems.', meaning: '她解决基础客户问题。', difficulty: 'L1', description: 'solves', examples_json: '[{"en":"He solves basic customer requests.","zh":"他解决基础客户请求。"},{"en":"She solves common issues.","zh":"她解决常见问题。"}]' },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', category: '核心句块', text: 'She finishes the task before the deadline.', meaning: '她在截止时间前完成任务。', difficulty: 'L1', description: 'finishes', examples_json: '[{"en":"He finishes the report before the deadline.","zh":"他在截止时间前完成报告。"}]' },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', category: '核心句块', text: 'He tries to complete it by four.', meaning: '他争取四点前完成。', difficulty: 'L1', description: 'tries to', examples_json: '[{"en":"She tries to finish it by five.","zh":"她争取五点前完成。"}]' },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', category: '核心句块', text: 'She follows up after she completes the report.', meaning: '她完成报告后继续跟进。', difficulty: 'L1', description: 'follows up', examples_json: '[{"en":"He follows up after he completes the task.","zh":"他完成任务后继续跟进。"}]' },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', category: '核心句块', text: 'He carries the copies downstairs.', meaning: '他把材料搬到楼下。', difficulty: 'L1', description: 'carries (y→ies)', examples_json: '[{"en":"She carries the boxes downstairs.","zh":"她把箱子搬到楼下。"}]' },

  // Scene C - 询问、否定与确认
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', category: '核心句块', text: 'Does Ben start at eight? — No, he doesn\'t.', meaning: 'Ben 八点开始吗？不是。', difficulty: 'L1', description: 'Does 问句 + 否定回答', examples_json: '[{"en":"Does Mia print the report? — No, she doesn\'t.","zh":"Mia 打印报告吗？不是。"}]' },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', category: '核心句块', text: 'Does Mia write the report? — Yes, she does.', meaning: 'Mia 写报告吗？是。', difficulty: 'L1', description: 'Does 问句 + 肯定回答', examples_json: '[{"en":"Does Ben answer the main line? — Yes, he does.","zh":"Ben 接总机吗？是。"}]' },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', category: '核心句块', text: 'Please confirm the correct shift.', meaning: '请确认正确班次。', difficulty: 'L1', description: 'confirm + shift', examples_json: '[{"en":"Please confirm the correct duty.","zh":"请确认正确职责。"}]' },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', category: '核心句块', text: 'This confirms each person\'s duty.', meaning: '这确认了每个人的职责。', difficulty: 'L1', description: 'confirms + duty', examples_json: '[{"en":"This confirms each person\'s shift.","zh":"这确认了每个人的班次。"}]' },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', category: '核心句块', text: 'What task does she complete first?', meaning: '她先完成什么任务？', difficulty: 'L1', description: 'What does ...?', examples_json: '[{"en":"What report does he write first?","zh":"他先写什么报告？"}]' },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', category: '核心句块', text: 'Where is her work location?', meaning: '她的工作地点在哪里？', difficulty: 'L1', description: 'Where is ...?', examples_json: '[{"en":"Where is his department?","zh":"他的部门在哪里？"}]' },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', category: '核心句块', text: 'When does he finish?', meaning: '他什么时候结束？', difficulty: 'L1', description: 'When does ...?', examples_json: '[{"en":"When does she start?","zh":"她什么时候开始？"}]' },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', category: '核心句块', text: 'Who is the right person for this detail?', meaning: '谁是处理这项细节的合适人员？', difficulty: 'L1', description: 'Who is ...?', examples_json: '[{"en":"Who is the right person for this task?","zh":"谁是处理这项任务的合适人员？"}]' },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', category: '核心句块', text: 'That information is a mistake.', meaning: '那条信息是错误的。', difficulty: 'L1', description: 'mistake', examples_json: '[{"en":"That note is a mistake.","zh":"那条笔记是错误的。"}]' },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', category: '核心句块', text: 'She doesn\'t answer the line; she writes instead.', meaning: '她不接总机，而是负责书写。', difficulty: 'L1', description: "doesn't ... instead", examples_json: '[{"en":"He doesn\'t print; he attaches instead.","zh":"他不打印，而是负责添加附件。"}]' },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', category: '核心句块', text: 'He actually works at the front desk.', meaning: '他实际上在前台工作。', difficulty: 'L1', description: 'actually', examples_json: '[{"en":"She actually works in sales.","zh":"她实际上在销售部工作。"}]' },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', category: '核心句块', text: 'This correction makes the fact accurate.', meaning: '这项纠正让事实准确。', difficulty: 'L1', description: 'correction + accurate', examples_json: '[{"en":"This correction makes the duty accurate.","zh":"这项纠正让职责准确。"}]' },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', category: '核心句块', text: 'She has a meeting at ten.', meaning: '她十点有会议。', difficulty: 'L1', description: 'has + meeting', examples_json: '[{"en":"He has a document at noon.","zh":"他中午有文件。"}]' },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', category: '核心句块', text: 'He has the presentation equipment.', meaning: '他有演示设备。', difficulty: 'L1', description: 'has + equipment', examples_json: '[{"en":"She has the main device.","zh":"她有主要设备。"}]' },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', category: '核心句块', text: 'Does she have the main file? — Yes, she does.', meaning: '她有主要文件吗？有。', difficulty: 'L1', description: 'Does ... have? + 肯定回答', examples_json: '[{"en":"Does he have the contract? — Yes, he does.","zh":"他有合同吗？有。"}]' },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', category: '核心句块', text: 'The document is on her device.', meaning: '文件在她的设备上。', difficulty: 'L1', description: 'on her device', examples_json: '[{"en":"The file is on her tablet.","zh":"文件在她的平板上。"}]' },

  // Scene D - 个人与团队协作
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', category: '核心句块', text: 'One individual writes; the group reviews.', meaning: '一个人负责写，小组负责审核。', difficulty: 'L1', description: '单数 vs 复数主语', examples_json: '[{"en":"One individual prints; the group checks.","zh":"一个人负责打印，小组负责检查。"}]' },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', category: '核心句块', text: 'She is a staff member; they are staff members.', meaning: '她是一名员工；他们是员工。', difficulty: 'L1', description: 'a member vs members', examples_json: '[{"en":"He is a designer; they are designers.","zh":"他是一名设计师；他们是设计师。"}]' },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', category: '核心句块', text: 'Several members have different duties.', meaning: '几名成员的职责不同。', difficulty: 'L1', description: 'Several + plural', examples_json: '[{"en":"Several members have different schedules.","zh":"几名成员的日程不同。"}]' },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', category: '核心句块', text: 'The group works as one team.', meaning: '这个小组作为一个团队工作。', difficulty: 'L1', description: 'group as singular', examples_json: '[{"en":"The crew works as one team.","zh":"这个团队作为一个团队工作。"}]' },
  { scene_title: '个人与团队协作', topic_title: '谁负责', category: '核心句块', text: 'Who handles this? — Mia does.', meaning: '谁负责这个？Mia。', difficulty: 'L1', description: 'Who handles ...?', examples_json: '[{"en":"Who handles this? — Ben does.","zh":"谁负责这个？Ben。"}]' },
  { scene_title: '个人与团队协作', topic_title: '谁负责', category: '核心句块', text: 'She is responsible for this task.', meaning: '她负责这项任务。', difficulty: 'L1', description: 'responsible for', examples_json: '[{"en":"He is responsible for this document.","zh":"他负责这份文件。"}]' },
  { scene_title: '个人与团队协作', topic_title: '谁负责', category: '核心句块', text: 'Emma assigns the work to him.', meaning: 'Emma 把工作指派给他。', difficulty: 'L1', description: 'assigns to him', examples_json: '[{"en":"Emma assigns the task to her.","zh":"Emma 把任务指派给她。"}]' },
  { scene_title: '个人与团队协作', topic_title: '谁负责', category: '核心句块', text: 'Please transfer the copies to them.', meaning: '请把材料转交给他们。', difficulty: 'L1', description: 'transfer to them', examples_json: '[{"en":"Please transfer the document to him.","zh":"请把文件转交给他。"}]' },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', category: '核心句块', text: 'Is she available now? — No, she is occupied.', meaning: '她现在方便吗？不，她正忙于别的事。', difficulty: 'L1', description: 'available / occupied', examples_json: '[{"en":"Is he online now? — No, he is away.","zh":"他现在在线吗？不，他离开了。"}]' },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', category: '核心句块', text: 'The request is not urgent.', meaning: '这项请求不紧急。', difficulty: 'L1', description: 'not urgent', examples_json: '[{"en":"The task is not urgent.","zh":"这项任务不紧急。"}]' },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', category: '核心句块', text: 'A short delay is okay.', meaning: '短暂延迟没关系。', difficulty: 'L1', description: 'delay is okay', examples_json: '[{"en":"A ten-minute delay is okay.","zh":"十分钟延迟没关系。"}]' },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', category: '核心句块', text: 'She returns at three, so he is waiting.', meaning: '她三点返回，所以他在等待。', difficulty: 'L1', description: 'returns + waiting', examples_json: '[{"en":"She returns at four, so he is waiting.","zh":"她四点返回，所以他在等待。"}]' },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', category: '核心句块', text: 'Let me introduce her work profile.', meaning: '让我介绍她的工作档案。', difficulty: 'L1', description: 'introduce + profile', examples_json: '[{"en":"Let me introduce his work profile.","zh":"让我介绍他的工作档案。"}]' },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', category: '核心句块', text: 'I can describe her main role.', meaning: '我可以描述她的主要职责。', difficulty: 'L1', description: 'describe + main role', examples_json: '[{"en":"I can describe her main location.","zh":"我可以描述她的主要地点。"}]' },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', category: '核心句块', text: 'Overall, she supports the whole team.', meaning: '总体来说，她支持整个团队。', difficulty: 'L1', description: 'Overall', examples_json: '[{"en":"Overall, he supports the whole department.","zh":"总体来说，他支持整个部门。"}]' },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', category: '核心句块', text: 'In summary, this profile is complete.', meaning: '总结来说，这份档案完整了。', difficulty: 'L1', description: 'In summary', examples_json: '[{"en":"In summary, this profile is accurate.","zh":"总结来说，这份档案准确。"}]' },
];

// ============ PATTERNS ============
// 16 topics × 2 patterns each = 32
const patterns = [
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', pattern: 'He/She is our ___.', meaning: '他/她是我们的___.', slots: 'colleague / manager / assistant / designer / receptionist / engineer', example: 'She is our designer.', difficulty: 'L1', sort_order: 0 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', pattern: '___ is the ___ for this team.', meaning: '___ 是这个团队的___.', slots: 'Mia / Ben / designer / engineer', example: 'Mia is the designer for this team.', difficulty: 'L1', sort_order: 1 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', pattern: 'He/She works in the ___ department.', meaning: '他/她在___部门工作。', slots: 'sales / support / design', example: 'She works in the sales department.', difficulty: 'L1', sort_order: 2 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', pattern: 'He/She works at ___ for a ___ company.', meaning: '他/她在___为一家___公司工作。', slots: 'the front desk / a branch / small / local', example: 'He works at the front desk for a small company.', difficulty: 'L1', sort_order: 3 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', pattern: 'His/Her role is ___; the background is ___.', meaning: '他/她的角色是___；背景是___.', slots: 'support / design / technical / creative', example: 'Her role is design; the background is creative.', difficulty: 'L1', sort_order: 4 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', pattern: 'Our ___ is ___.', meaning: '我们的___是___.', slots: 'colleague / manager / friendly / experienced', example: 'Our colleague is friendly.', difficulty: 'L1', sort_order: 5 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', pattern: 'You can reach him/her at ___.', meaning: '你可以通过___联系他/她。', slots: 'extension 204 / the front desk', example: 'You can reach him at extension 204.', difficulty: 'L1', sort_order: 6 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', pattern: 'His/Her ___ is in the directory.', meaning: '他/她的___在通讯录里。', slots: 'contact details / extension / desk', example: 'His extension is in the directory.', difficulty: 'L1', sort_order: 7 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', pattern: 'He/She starts by ___ing ___.', meaning: '他/她从___开始。', slots: 'checking / opening / the schedule / the calendar', example: 'She starts by checking the schedule.', difficulty: 'L1', sort_order: 8 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', pattern: 'He/She opens ___ and logs in at ___.', meaning: '他/她打开___并在___登录。', slots: 'the calendar / the system / nine', example: 'He opens the calendar and logs in at nine.', difficulty: 'L1', sort_order: 9 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', pattern: 'He/She answers ___ and writes ___.', meaning: '他/她接听___并写___.', slots: 'the main line / a report', example: 'He answers the main line and writes a report.', difficulty: 'L1', sort_order: 10 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', pattern: 'He/She forwards ___, attaches ___, and prints ___.', meaning: '他/她转发___、附加___并打印___.', slots: 'the report / the document / one copy', example: 'She forwards the report and attaches the document.', difficulty: 'L1', sort_order: 11 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', pattern: 'He/She guides each ___ through the ___.', meaning: '他/她引导每位___完成___.', slots: 'customer / guest / question / request', example: 'He guides each customer through the request.', difficulty: 'L1', sort_order: 12 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', pattern: 'He/She explains ___ and solves ___.', meaning: '他/她解释___并解决___.', slots: 'the question / the solution / the problem', example: 'She explains the solution and solves the problem.', difficulty: 'L1', sort_order: 13 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', pattern: 'He/She tries to complete ___ before the ___.', meaning: '他/她争取在___前完成___.', slots: 'the task / report / deadline', example: 'She tries to complete the task before the deadline.', difficulty: 'L1', sort_order: 14 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', pattern: 'He/She finishes ___, follows up, and carries ___.', meaning: '他/她完成___、跟进并搬运___.', slots: 'the report / the copies / boxes', example: 'He finishes the report and carries the copies.', difficulty: 'L1', sort_order: 15 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', pattern: 'Does he/she ___? — Yes, he/she does. / No, he/she doesn\'t.', meaning: '他/她___吗？ — 是/不是。', slots: 'start / answer / print', example: 'Does he start at eight?', difficulty: 'L1', sort_order: 16 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', pattern: 'Please confirm the correct ___ and ___.', meaning: '请确认正确的___和___.', slots: 'shift / duty / schedule', example: 'Please confirm the correct shift and duty.', difficulty: 'L1', sort_order: 17 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', pattern: 'When does he/she ___, and what task comes first?', meaning: '他/她何时___，先做什么任务？', slots: 'start / finish / return', example: 'When does she finish?', difficulty: 'L1', sort_order: 18 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', pattern: 'Who is the right person, and where is the work location?', meaning: '谁是合适的人，工作地点在哪？', slots: 'person / detail / department', example: 'Who is the right person for this detail?', difficulty: 'L1', sort_order: 19 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', pattern: 'He/She doesn\'t ___; he/she ___s instead.', meaning: '他/她不___；而是___.', slots: 'answer / write / work / print', example: 'She doesn\'t answer; she writes instead.', difficulty: 'L1', sort_order: 20 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', pattern: 'Actually, the ___ is a mistake; this correction is accurate.', meaning: '实际上，___是错的；这项纠正是准确的。', slots: 'note / role / fact', example: 'Actually, the note is a mistake.', difficulty: 'L1', sort_order: 21 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', pattern: 'He/She has ___ and ___.', meaning: '他/她有___和___.', slots: 'a meeting / the file / a device / equipment', example: 'She has a meeting and the main file.', difficulty: 'L1', sort_order: 22 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', pattern: 'Does he/she have the ___ document?', meaning: '他/她有___文件吗？', slots: 'meeting / final / printed', example: 'Does she have the meeting document?', difficulty: 'L1', sort_order: 23 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', pattern: 'One individual ___s; the group ___.', meaning: '一个人___；小组___.', slots: 'writes / write / reviews / review', example: 'One individual writes; the group reviews.', difficulty: 'L1', sort_order: 24 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', pattern: 'Several staff members have different ___.', meaning: '几名员工的___不同。', slots: 'roles / duties / schedules', example: 'Several staff members have different duties.', difficulty: 'L1', sort_order: 25 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', pattern: 'Who handles ___, and who is responsible for ___?', meaning: '谁处理___，谁负责___？', slots: 'this task / the document', example: 'Who handles this task?', difficulty: 'L1', sort_order: 26 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', pattern: 'He/She assigns ___ to him/her and transfers ___ to them.', meaning: '他/她把___指派给他/她，并把___转交给他们。', slots: 'the task / the copies', example: 'She assigns the task to him.', difficulty: 'L1', sort_order: 27 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', pattern: 'Is he/she available or occupied?', meaning: '他/她现在有空还是忙于别的事？', slots: 'now / after lunch', example: 'Is she available now?', difficulty: 'L1', sort_order: 28 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', pattern: 'The ___ is urgent, so he/she returns after a short delay; ___ is waiting.', meaning: '___很紧急，所以他/她短暂延迟后返回；___在等。', slots: 'request / task / Lin', example: 'The request is urgent, so she returns after a short delay.', difficulty: 'L1', sort_order: 29 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', pattern: 'Let me introduce this profile and describe the main ___.', meaning: '让我介绍这份档案并描述主要___.', slots: 'role / routine / strength', example: 'Let me introduce this profile.', difficulty: 'L1', sort_order: 30 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', pattern: 'Overall, ___; in summary, ___.', meaning: '总体来说，___；总结来说，___.', slots: 'she supports the team / the profile is complete', example: 'Overall, she supports the team.', difficulty: 'L1', sort_order: 31 },
];

// ============ VOCABULARY ============
// 16 topics: 96 core + 64 extension = 160
// Core = 6 per topic, Extension = 4 per topic
const vocabulary = [
  // Scene A: 认识同事与团队
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'colleague', meaning: '同事', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'manager', meaning: '经理', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'assistant', meaning: '助理', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'designer', meaning: '设计师', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'receptionist', meaning: '接待员', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'engineer', meaning: '工程师', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'nurse', meaning: '护士', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'driver', meaning: '司机', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'cashier', meaning: '收银员', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '同事与岗位', word: 'technician', meaning: '技术员', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'sales', meaning: '销售', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'support', meaning: '支持', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'design', meaning: '设计', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'front desk', meaning: '前台', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'company', meaning: '公司', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'department', meaning: '部门', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'warehouse', meaning: '仓库', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'branch', meaning: '分店/分支', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'floor', meaning: '楼层', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '部门与地点', word: 'headquarters', meaning: '总部', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'his', meaning: '他的', part_of_speech: 'pron.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'her', meaning: '她的', part_of_speech: 'pron.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'our', meaning: '我们的', part_of_speech: 'pron.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'role', meaning: '角色/职责', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'background', meaning: '背景', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'friendly', meaning: '友善的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'experienced', meaning: '有经验的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'organized', meaning: '有条理的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'patient', meaning: '耐心的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '介绍一位同事', word: 'creative', meaning: '有创意的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'contact', meaning: '联系', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'extension', meaning: '分机号', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'desk', meaning: '工位/办公桌', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'directory', meaning: '通讯录', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'reach', meaning: '联系到', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'details', meaning: '详细信息', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'voicemail', meaning: '语音信箱', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'website', meaning: '网站', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'line', meaning: '电话线/线路', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '认识同事与团队', topic_title: '联系信息', word: 'QR code', meaning: '二维码', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  // Scene B: 工作职责与安排
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'start', meaning: '开始', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'check', meaning: '检查', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'schedule', meaning: '日程', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'open', meaning: '打开', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'log in', meaning: '登录', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'calendar', meaning: '日历', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'unlock', meaning: '解锁', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'prepare', meaning: '准备', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'review', meaning: '审查/回顾', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '开始一天', word: 'inbox', meaning: '收件箱', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'answer', meaning: '回答/接听', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'write', meaning: '写', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'forward', meaning: '转发', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'attach', meaning: '附加/添加附件', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'print', meaning: '打印', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'report', meaning: '报告', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'copy', meaning: '复制/副本', part_of_speech: 'v./n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'scan', meaning: '扫描', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'upload', meaning: '上传', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '电话与邮件', word: 'spreadsheet', meaning: '电子表格', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'customer', meaning: '客户', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'question', meaning: '问题', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'explain', meaning: '解释', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'solution', meaning: '解决方案', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'guide', meaning: '引导', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'solve', meaning: '解决', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'guest', meaning: '客人', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'request', meaning: '请求', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'issue', meaning: '问题/议题', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '帮助客户', word: 'option', meaning: '选项', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'finish', meaning: '完成', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'try', meaning: '尝试', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'carry', meaning: '搬运', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'follow up', meaning: '跟进', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'complete', meaning: '完成', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'deadline', meaning: '截止时间', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'close', meaning: '关闭/结束', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'update', meaning: '更新', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'parcel', meaning: '包裹', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '工作职责与安排', topic_title: '完成与跟进', word: 'checklist', meaning: '检查清单', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  // Scene C: 询问、否定与确认
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'does', meaning: '（第三人称助动词）', part_of_speech: 'aux.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: "doesn't", meaning: '不（第三人称否定）', part_of_speech: 'aux.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'confirm', meaning: '确认', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'correct', meaning: '正确的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'duty', meaning: '职责', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'shift', meaning: '班次/轮班', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'operate', meaning: '操作', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'manage', meaning: '管理', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'inspect', meaning: '检查', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: 'Does 问答', word: 'organize', meaning: '组织', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'when', meaning: '何时', part_of_speech: 'adv.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'who', meaning: '谁', part_of_speech: 'pron.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'task', meaning: '任务', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'location', meaning: '地点', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'person', meaning: '人/人员', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'detail', meaning: '细节', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'which', meaning: '哪一个', part_of_speech: 'pron.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'reason', meaning: '原因', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'project', meaning: '项目', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: '询问具体信息', word: 'client', meaning: '客户', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'correction', meaning: '纠正/更正', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'actually', meaning: '实际上', part_of_speech: 'adv.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'instead', meaning: '反而/代替', part_of_speech: 'adv.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'mistake', meaning: '错误', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'accurate', meaning: '准确的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'fact', meaning: '事实', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'wrong', meaning: '错误的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'true', meaning: '真实的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'exact', meaning: '确切的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: '否定与纠正', word: 'clarification', meaning: '澄清', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'has', meaning: '有（第三人称）', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'meeting', meaning: '会议', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'file', meaning: '文件', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'device', meaning: '设备', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'equipment', meaning: '设备/器材', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'document', meaning: '文件/文档', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'folder', meaning: '文件夹', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'badge', meaning: '工牌/徽章', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'tablet', meaning: '平板电脑', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '询问、否定与确认', topic_title: 'have 与 has', word: 'contract', meaning: '合同', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  // Scene D: 个人与团队协作
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'staff', meaning: '员工（总称）', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'member', meaning: '成员', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'group', meaning: '小组/团体', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'individual', meaning: '个人/个体', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'different', meaning: '不同的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'several', meaning: '几个的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'pair', meaning: '一对/一双', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'crew', meaning: '团队/乘务组', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'employee', meaning: '员工', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '一个人与一组人', word: 'people', meaning: '人们', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'handle', meaning: '处理', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'responsible', meaning: '负责的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'assign', meaning: '指派/分配', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'transfer', meaning: '转交/转移', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'him', meaning: '他（宾格）', part_of_speech: 'pron.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'them', meaning: '他们（宾格）', part_of_speech: 'pron.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'direct', meaning: '指导/引导', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'notify', meaning: '通知', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'involve', meaning: '涉及/参与', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '谁负责', word: 'supervisor', meaning: '主管', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'available', meaning: '可联系/有空', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'occupied', meaning: '忙碌/被占用', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'urgent', meaning: '紧急的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'delay', meaning: '延迟', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'return', meaning: '返回', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'waiting', meaning: '等待', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'unavailable', meaning: '不可联系', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'away', meaning: '离开/不在', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'online', meaning: '在线', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '当前工作状态', word: 'offline', meaning: '离线', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },

  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'introduce', meaning: '介绍', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'describe', meaning: '描述', part_of_speech: 'v.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'main', meaning: '主要的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'overall', meaning: '总体的', part_of_speech: 'adj.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'summary', meaning: '总结', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'profile', meaning: '档案/简介', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '核心词', tier: 1 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'experience', meaning: '经验', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'skill', meaning: '技能', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'achievement', meaning: '成就', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
  { scene_title: '个人与团队协作', topic_title: '同事工作档案', word: 'example', meaning: '例子', part_of_speech: 'n.', difficulty: 'L1', description: '', examples_json: '', is_core: '扩展词', tier: 2 },
];

// ============ EPISODES ============
// 4 chapters × 2 lessons = 8 episodes
const episodes = [
  { chapter_id: 1, chapter_title: '认识团队', episode_order: 1, title: '同事、岗位与部门', scene_title: '认识同事与团队', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["介绍两位同事的岗位和部门"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Emma', npc_role: '团队经理', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_认识团队', rewards_json: '{"xp":50,"gems":5}' },
  { chapter_id: 1, chapter_title: '认识团队', episode_order: 2, title: '介绍与联系信息', scene_title: '认识同事与团队', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["介绍同事背景并说明联系方式"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Mia', npc_role: '设计师', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_联系信息', rewards_json: '{"xp":50,"gems":5}' },
  { chapter_id: 2, chapter_title: '他/她负责什么', episode_order: 1, title: '日常职责与通讯', scene_title: '工作职责与安排', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["描述5项同事的工作职责"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Emma', npc_role: '团队经理', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_工作职责', rewards_json: '{"xp":50,"gems":5}' },
  { chapter_id: 2, chapter_title: '他/她负责什么', episode_order: 2, title: '帮助客户与收尾', scene_title: '工作职责与安排', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["描述客户服务和任务跟进"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Ben', npc_role: '前台助理', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_客户服务', rewards_json: '{"xp":50,"gems":5}' },
  { chapter_id: 3, chapter_title: '询问和确认', episode_order: 1, title: 'Does 问答与信息确认', scene_title: '询问、否定与确认', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["完成8轮 Does 信息问答"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Emma', npc_role: '团队经理', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_询问确认', rewards_json: '{"xp":50,"gems":5}' },
  { chapter_id: 3, chapter_title: '询问和确认', episode_order: 2, title: '否定纠正与 has', scene_title: '询问、否定与确认', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["完成3组否定纠正和 has 转换"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Mia', npc_role: '设计师', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_否定与has', rewards_json: '{"xp":50,"gems":5}' },
  { chapter_id: 4, chapter_title: '个人与团队', episode_order: 1, title: '单复数和负责人', scene_title: '个人与团队协作', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["对比个人与团队并完成工作指派"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Emma', npc_role: '团队经理', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_单人与团队', rewards_json: '{"xp":50,"gems":5}' },
  { chapter_id: 4, chapter_title: '个人与团队', episode_order: 2, title: '状态与同事档案', scene_title: '个人与团队协作', required_output_level: 'L1', required_user_level: 'beginner', vocab_required_count: 20, vocab_total_count: 40, chunk_required_count: 8, chunk_total_count: 16, objectives_json: '["完成8-10句同事工作档案"]', pass_objective_count: 1, pass_chunk_count: 6, pass_min_dialogues: 4, npc_name: 'Mia', npc_role: '设计师', is_preview: false, ink_script_key: 'practice_foundation-daily-work_基础_办公室日常_同事档案', rewards_json: '{"xp":80,"gems":10}' },
];

// ============ WRITE CSVs ============
function quote(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

// scenes.csv
let csv = 'category_name,title,location,required_output_level,required_user_level,description,package_type\n';
scenes.forEach(s => {
  csv += [s.category_name, s.title, s.location, s.required_output_level, s.required_user_level, quote(s.description), s.package_type].join(',') + '\n';
});
fs.writeFileSync(path.join(pkgDir, 'scenes.csv'), csv);
console.log('scenes.csv:', scenes.length, 'rows');

// training_topics.csv
csv = 'scene_title,title,prompt_en,prompt_zh,duration_sec,difficulty,description,knowledge_points,teaching_markdown,ink_script_key\n';
topics.forEach(t => {
  csv += [t.scene_title, t.title, quote(t.prompt_en), quote(t.prompt_zh), t.duration_sec, t.difficulty, quote(t.description), quote(t.knowledge_points), quote(t.teaching_markdown), t.ink_script_key].join(',') + '\n';
});
fs.writeFileSync(path.join(pkgDir, 'training_topics.csv'), csv);
console.log('training_topics.csv:', topics.length, 'rows');

// chunks.csv
csv = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n';
chunks.forEach(c => {
  csv += [c.scene_title, c.topic_title, c.category, quote(c.text), quote(c.meaning), c.difficulty, quote(c.description), quote(c.examples_json)].join(',') + '\n';
});
fs.writeFileSync(path.join(pkgDir, 'chunks.csv'), csv);
console.log('chunks.csv:', chunks.length, 'rows');

// sentence_patterns.csv
csv = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order\n';
patterns.forEach(p => {
  csv += [p.scene_title, p.topic_title, quote(p.pattern), quote(p.meaning), quote(p.slots), quote(p.example), p.difficulty, p.sort_order].join(',') + '\n';
});
fs.writeFileSync(path.join(pkgDir, 'sentence_patterns.csv'), csv);
console.log('sentence_patterns.csv:', patterns.length, 'rows');

// scene_vocabulary.csv
csv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
let sortOrder = 0;
vocabulary.forEach(v => {
  csv += [v.scene_title, v.topic_title, v.word, v.meaning, v.part_of_speech, '', '', v.difficulty, v.description, v.examples_json, sortOrder++].join(',') + '\n';
});
fs.writeFileSync(path.join(pkgDir, 'scene_vocabulary.csv'), csv);
console.log('scene_vocabulary.csv:', vocabulary.length, 'rows');

// script_episodes.csv
csv = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
episodes.forEach(e => {
  csv += [e.chapter_id, e.chapter_title, e.episode_order, e.title, e.scene_title, e.required_output_level, e.required_user_level, e.vocab_required_count, e.vocab_total_count, e.chunk_required_count, e.chunk_total_count, quote(e.objectives_json), e.pass_objective_count, e.pass_chunk_count, e.pass_min_dialogues, e.npc_name, e.npc_role, e.is_preview, e.ink_script_key, quote(e.rewards_json)].join(',') + '\n';
});
fs.writeFileSync(path.join(pkgDir, 'script_episodes.csv'), csv);
console.log('script_episodes.csv:', episodes.length, 'rows');

// episode_chunks.csv - link episodes to chunks (simple sequential mapping)
csv = 'episode_chapter,episode_order,chunk_text_match,sort_order\n';
// Ep1 chunks: 1-8, Ep2: 9-16, etc.
let chunkIdx = 0;
episodes.forEach(ep => {
  for (let i = 0; i < 8 && chunkIdx < chunks.length; i++) {
    csv += [ep.chapter_id + '-' + ep.episode_order, ep.episode_order, quote(chunks[chunkIdx].text), i].join(',') + '\n';
    chunkIdx++;
  }
});
fs.writeFileSync(path.join(pkgDir, 'episode_chunks.csv'), csv);
console.log('episode_chunks.csv:', chunkIdx, 'rows');
console.log('\nAll CSVs generated!');
