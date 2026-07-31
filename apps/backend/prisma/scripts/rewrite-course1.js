// Generate rewritten Course 1 with unique dialogues per Topic
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'packages', 'course-1-opinion-communication', '学习包的功能介绍.md');
let content = fs.readFileSync(filePath, 'utf8');

// Find the boundary: "## 逐 Topic 完整教学设计" to end of file
const sectionStart = content.indexOf('## 逐 Topic 完整教学设计');
const header = content.substring(0, sectionStart);

// ============ NEW TOPIC CONTENT ============

const topics = [
// ── Scene A: 建立观点 ──
{
  id: '01', name: '询问看法',
  scene: 'A neutral survey of opinions before taking a position',
  scenario: 'the new class schedule',
  vocab: '`opinion`, `reason`, `example`, `evidence`',
  ext: '`arguably`, `relevant`',
  chunks: [
    'From my point of view, the new schedule makes a lot of sense.',
    'I see several advantages worth considering.',
    'What does everyone else think about this?',
    'It seems practical, but I would like to hear other views first.'
  ],
  patterns: ['From my point of view, ___.', 'What does everyone else think about ___?'],
  dialogue: [
    ['Emma', 'We need to decide on the new class schedule. Lin, what is your first impression?'],
    ['Lin', 'From my point of view, the new schedule makes a lot of sense.'],
    ['Emma', 'Can you tell us more about why you think so?'],
    ['Lin', 'I see several advantages worth considering. But I would like to hear other views first.'],
    ['Mia', 'I have not looked at it closely yet. Could you point out the main change?'],
    ['Lin', 'The main change is that classes now start an hour later.'],
    ['Emma', 'That could affect students who have morning commitments.'],
    ['Lin', 'That is a fair point. What does everyone else think about this?'],
    ['Ben', 'I think we should ask more students before deciding.'],
    ['Lin', 'That is a good idea. Let us gather more opinions first.']
  ]
},
{
  id: '02', name: '清楚表态',
  scene: 'Taking a clear, well-supported position',
  scenario: 'daily English practice',
  vocab: '`evidence`, `benefit`, `drawback`, `choice`',
  ext: '`partly`, `balanced`',
  chunks: [
    'I do believe that daily practice makes a real difference.',
    'My position is based on what I have seen work.',
    'The evidence supports taking this seriously.',
    'I am convinced this is the right direction.'
  ],
  patterns: ['I do believe that ___.', 'My position is based on ___.'],
  dialogue: [
    ['Lin', 'I have been thinking about daily English practice, and I do believe it makes a real difference.'],
    ['Ben', 'That is a strong position. What convinced you?'],
    ['Lin', 'My position is based on what I have seen work. The learners who practice daily improve much faster.'],
    ['Ben', 'I am not sure everyone has that much time.'],
    ['Lin', 'I understand the concern, but even fifteen minutes a day helps. The evidence supports taking this seriously.'],
    ['Ben', 'Fifteen minutes does sound manageable.'],
    ['Lin', 'Exactly. I am convinced this is the right direction.'],
    ['Ben', 'You make a strong case. I will try it myself.'],
    ['Lin', 'That is great to hear. Let me know how it goes.']
  ]
},
{
  id: '03', name: '表达确定程度',
  scene: 'Expressing degrees of certainty rather than all-or-nothing claims',
  scenario: 'online learning',
  vocab: '`choice`, `issue`, `effect`, `experience`',
  ext: '`convincing`, `practical`',
  chunks: [
    'I am fairly confident that online learning is here to stay.',
    'There is some evidence for that, but I am not entirely sure.',
    'I lean toward the second option, though I could be wrong.',
    'That may be the case in some situations, but not all.'
  ],
  patterns: ['I am fairly confident that ___.', 'I lean toward ___, though ___.'],
  dialogue: [
    ['Mia', 'Lin, how do you feel about online learning compared to classroom learning?'],
    ['Lin', 'I am fairly confident that online learning is here to stay, but I am not entirely sure it works for everyone.'],
    ['Mia', 'What makes you uncertain?'],
    ['Lin', 'There is some evidence for its effectiveness, but I have also seen students struggle with motivation.'],
    ['Mia', 'So you would not recommend it for all subjects?'],
    ['Lin', 'That may be the case in some situations, but not all. I lean toward a mixed approach, though I could be wrong.'],
    ['Mia', 'That sounds reasonable. I appreciate that you are not oversimplifying it.'],
    ['Lin', 'I think it is important to be honest about what we do not know yet.']
  ]
},
{
  id: '04', name: '补充个人经验',
  scene: 'Using personal stories to strengthen an opinion',
  scenario: 'group projects',
  vocab: '`experience`, `view`, `point`, `agreement`',
  ext: '`relevant`, `reasonable`',
  chunks: [
    'From my own experience, group projects taught me more than lectures ever did.',
    'Let me share something that happened to me last semester.',
    'That experience shaped how I see this issue now.',
    'I know not everyone has the same experience, but here is what I learned.'
  ],
  patterns: ['From my own experience, ___.', 'That experience shaped how I see ___.'],
  dialogue: [
    ['Lin', 'You know, from my own experience, group projects taught me more than lectures ever did.'],
    ['Emma', 'That is interesting. Can you give me an example?'],
    ['Lin', 'Let me share something that happened to me last semester. We had to design a presentation together. At first, no one agreed on anything. But after three meetings, we found a way to combine everyone\'s ideas.'],
    ['Emma', 'That sounds like a valuable learning process.'],
    ['Lin', 'It was. That experience shaped how I see this issue now. I used to prefer working alone, but now I see the value of collaboration.'],
    ['Emma', 'Do you think every student has a similar experience?'],
    ['Lin', 'I know not everyone has the same experience, but here is what I learned: the struggle itself was the lesson.']
  ]
},

// ── Scene B: 展开理由 ──
{
  id: '05', name: '说明主要原因',
  scene: 'Structuring a single strong reason with cause and effect',
  scenario: 'part-time work during studies',
  vocab: '`agreement`, `difference`, `solution`, `conclusion`',
  ext: '`balanced`, `overall`',
  chunks: [
    'The main reason I support part-time work is that it builds real responsibility.',
    'When students earn their own money, they learn to manage it.',
    'That one change leads to better habits in other areas too.',
    'This is not just my opinion—research shows the same pattern.'
  ],
  patterns: ['The main reason is that ___.', 'When ___, it leads to ___.'],
  dialogue: [
    ['Ben', 'Lin, what do you think about students working part-time while studying?'],
    ['Lin', 'The main reason I support it is that it builds real responsibility.'],
    ['Ben', 'How exactly does that work?'],
    ['Lin', 'When students earn their own money, they learn to manage it. They start thinking about how many hours they need to work to afford something.'],
    ['Ben', 'Does that affect their studies?'],
    ['Lin', 'Surprisingly, that one change often leads to better habits in other areas too. They become more organised with their study time.'],
    ['Ben', 'Is there any evidence for that?'],
    ['Lin', 'This is not just my opinion. Research shows the same pattern among students who work up to fifteen hours a week.']
  ]
},
{
  id: '06', name: '给具体例子',
  scene: 'Making an abstract point concrete with vivid examples',
  scenario: 'living in a big city',
  vocab: '`conclusion`, `opinion`, `reason`, `example`',
  ext: '`practical`, `arguably`',
  chunks: [
    'Let me give you a concrete example of what I mean.',
    'Take my neighbour, for instance. She commutes two hours every day.',
    'A good illustration of this problem happened just last week.',
    'That is one case, but I could list several more.'
  ],
  patterns: ['Let me give you a concrete example. ___.', 'Take ___, for instance.'],
  dialogue: [
    ['Mia', 'Lin, you said living in a big city is stressful. Can you explain why?'],
    ['Lin', 'Let me give you a concrete example of what I mean.'],
    ['Mia', 'Please do.'],
    ['Lin', 'Take my neighbour, for instance. She commutes two hours every day. By the time she gets home, she has no energy for anything else.'],
    ['Mia', 'That sounds exhausting. Is her case typical?'],
    ['Lin', 'A good illustration of this problem happened just last week. Three colleagues all mentioned similar experiences in one conversation.'],
    ['Mia', 'So it is a widespread issue, not just one person.'],
    ['Lin', 'Exactly. That is one case, but I could list several more. Commuting really affects quality of life.']
  ]
},
{
  id: '07', name: '解释影响',
  scene: 'Tracing a chain of consequences from a single decision',
  scenario: 'using phones in class',
  vocab: '`example`, `evidence`, `benefit`, `drawback`',
  ext: '`reasonable`, `partly`',
  chunks: [
    'If we allow phones in class, the first consequence would be more distractions.',
    'That would then lead to lower participation in discussions.',
    'Over time, the overall learning atmosphere would suffer.',
    'So the short-term convenience comes with a long-term cost.'
  ],
  patterns: ['If ___, the first consequence would be ___.', 'Over time, ___.'],
  dialogue: [
    ['Emma', 'Lin, you seem concerned about the proposal to allow phones in class. Walk me through your thinking.'],
    ['Lin', 'If we allow phones in class, the first consequence would be more distractions.'],
    ['Emma', 'What kind of distractions?'],
    ['Lin', 'Notifications, messages, the temptation to check social media. That would then lead to lower participation in discussions.'],
    ['Emma', 'Do you think it would affect the whole class or just individuals?'],
    ['Lin', 'Over time, the overall learning atmosphere would suffer. Even students who try to focus get distracted by others. So the short-term convenience comes with a long-term cost.'],
    ['Emma', 'That is a thoughtful analysis. Have you considered any solutions?'],
    ['Lin', 'Maybe a middle ground: phones face down during discussion, but available for research tasks.']
  ]
},
{
  id: '08', name: '排列多个理由',
  scene: 'Weighing pros and cons in a structured comparison',
  scenario: 'working from home vs the office',
  vocab: '`drawback`, `choice`, `issue`, `effect`',
  ext: '`overall`, `convincing`',
  chunks: [
    'There are at least three reasons to consider this carefully.',
    'The first reason is flexibility. The second is cost. And the third is focus.',
    'On the other hand, the office offers something that home cannot replace.',
    'Weighing both sides, I would say the benefits slightly outweigh the drawbacks.'
  ],
  patterns: ['The first reason is ___. The second is ___.', 'Weighing both sides, ___.'],
  dialogue: [
    ['Lin', 'Ben, we need to decide whether the team should work from home or the office. Here is how I see it.'],
    ['Ben', 'Go ahead.'],
    ['Lin', 'There are at least three reasons to consider this carefully. The first reason is flexibility. The second is cost savings on commuting. And the third is better focus for individual tasks.'],
    ['Ben', 'Those are strong points for working from home. What about the office?'],
    ['Lin', 'On the other hand, the office offers something that home cannot replace: spontaneous conversations that lead to new ideas.'],
    ['Ben', 'So how do you weigh the two?'],
    ['Lin', 'Weighing both sides, I would say the benefits of flexibility slightly outweigh the drawbacks. But we need at least one office day per week.']
  ]
},

// ── Scene C: 回应观点 ──
{
  id: '09', name: '明确同意',
  scene: 'Enthusiastically agreeing and building on someone else\'s idea',
  scenario: 'morning exercise routine',
  vocab: '`effect`, `experience`, `view`, `point`',
  ext: '`arguably`, `relevant`',
  chunks: [
    'I completely agree with that. You have put it very well.',
    'That is exactly what I was thinking, but you said it better.',
    'Building on your point, I would add one more thing.',
    'We are clearly on the same page about this.'
  ],
  patterns: ['I completely agree with ___.', 'Building on your point, ___.'],
  dialogue: [
    ['Mia', 'I think a short morning exercise routine would help everyone feel more energetic.'],
    ['Lin', 'I completely agree with that. You have put it very well.'],
    ['Mia', 'Really? Do you have anything to add?'],
    ['Lin', 'Building on your point, I would add one more thing: it does not have to be long. Even ten minutes makes a difference.'],
    ['Mia', 'That is exactly what I was thinking, but you said it better! Ten minutes is manageable for almost everyone.'],
    ['Lin', 'We are clearly on the same page about this. Should we propose it to the group?'],
    ['Mia', 'Yes, let us do that.']
  ]
},
{
  id: '10', name: '部分同意',
  scene: 'Agreeing in principle but expressing a specific reservation',
  scenario: 'public transport expansion',
  vocab: '`point`, `agreement`, `difference`, `solution`',
  ext: '`partly`, `balanced`',
  chunks: [
    'I agree with the general direction, but I have one specific concern.',
    'You make a valid point about accessibility. However, the cost is a real issue.',
    'I am with you on the goal, but I question whether the timeline is realistic.',
    'So I support the idea in principle, with that one condition.'
  ],
  patterns: ['I agree with the general direction, but ___.', 'I am with you on ___, but ___.'],
  dialogue: [
    ['Ben', 'The city is planning a major public transport expansion. I think it is a great idea overall.'],
    ['Lin', 'I agree with the general direction, but I have one specific concern.'],
    ['Ben', 'What concerns you?'],
    ['Lin', 'You make a valid point about accessibility. However, the cost is a real issue. The project is already over budget.'],
    ['Ben', 'So you do not support it?'],
    ['Lin', 'I am with you on the goal. Better transport is necessary. But I question whether the current timeline is realistic. So I support the idea in principle, with that one condition: we need a clearer funding plan.'],
    ['Ben', 'That is fair. Let us ask for a revised budget before we give full approval.']
  ]
},
{
  id: '11', name: '礼貌不同意',
  scene: 'Disagreeing without damaging the relationship',
  scenario: 'school uniforms',
  vocab: '`solution`, `conclusion`, `opinion`, `reason`',
  ext: '`convincing`, `practical`',
  chunks: [
    'I see your point, but I have a different perspective on this.',
    'That is an interesting argument, though I am not fully convinced.',
    'I respect that view, but I would argue the opposite is true.',
    'Perhaps we can agree to disagree on this particular point.'
  ],
  patterns: ['I see your point, but ___.', 'I respect that view, but ___.'],
  dialogue: [
    ['Mia', 'I think school uniforms are good because they reduce social pressure. Everyone looks the same.'],
    ['Lin', 'I see your point, but I have a different perspective on this.'],
    ['Mia', 'How so?'],
    ['Lin', 'That is an interesting argument, though I am not fully convinced. In my experience, uniforms do not stop students from judging each other. They just find other things to compare.'],
    ['Mia', 'So you think uniforms have no benefit at all?'],
    ['Lin', 'I respect that view, but I would argue the real issue is not clothing—it is how we teach respect. Perhaps we can agree to disagree on this particular point.'],
    ['Mia', 'Fair enough. I can see where you are coming from.']
  ]
},
{
  id: '12', name: '承接并追问',
  scene: 'Picking up on someone\'s point and deepening the discussion',
  scenario: 'team meeting effectiveness',
  vocab: '`reason`, `example`, `evidence`, `benefit`',
  ext: '`relevant`, `reasonable`',
  chunks: [
    'That is a fascinating point. Could you elaborate on that?',
    'You mentioned something important earlier. I would like to go back to it.',
    'If I understand you correctly, you are saying that meetings could be shorter. What would you cut?',
    'Following up on what you just said, have you seen this work elsewhere?'
  ],
  patterns: ['Could you elaborate on ___?', 'If I understand you correctly, ___.'],
  dialogue: [
    ['Lin', 'Ben, you mentioned earlier that most team meetings feel like a waste of time. That is a fascinating point. Could you elaborate on that?'],
    ['Ben', 'Sure. I think we spend too long on updates that could be an email, and not enough time on actual decisions.'],
    ['Lin', 'If I understand you correctly, you are saying that meetings could be shorter. What would you cut first?'],
    ['Ben', 'The round-table updates. Everyone just reads what they could have written down.'],
    ['Lin', 'Following up on what you just said, have you seen a team do this differently?'],
    ['Ben', 'Yes, my previous team sent updates in a shared document before the meeting. The meeting itself was only for discussion.'],
    ['Lin', 'That sounds like something we should try.']
  ]
},

// ── Scene D: 澄清分歧 ──
{
  id: '13', name: '请求解释',
  scene: 'Asking for clarification when something is unclear',
  scenario: 'a flexible schedule proposal',
  vocab: '`benefit`, `drawback`, `choice`, `issue`',
  ext: '`balanced`, `overall`',
  chunks: [
    'I am not sure I follow. Could you explain that in a different way?',
    'When you say "flexible," what exactly do you mean?',
    'Help me understand the practical side of this.',
    'I want to make sure I have understood correctly before I respond.'
  ],
  patterns: ['When you say "___,", what exactly do you mean?', 'Help me understand ___.'],
  dialogue: [
    ['Emma', 'I am proposing a flexible schedule where team members choose their own hours.'],
    ['Lin', 'I am not sure I follow. Could you explain that in a different way?'],
    ['Emma', 'Of course. Instead of everyone working nine to five, each person picks the hours that suit them best.'],
    ['Lin', 'When you say "flexible," what exactly do you mean? Are there any core hours when everyone must be available?'],
    ['Emma', 'Good question. Yes, I propose a core window from ten to two when everyone should be reachable.'],
    ['Lin', 'Help me understand the practical side. How would we handle client meetings outside that window?'],
    ['Emma', 'Each team would set their own client-facing hours. I want to make sure I have explained this clearly before we vote on it.']
  ]
},
{
  id: '14', name: '重述理解',
  scene: 'Paraphrasing to confirm you understood correctly',
  scenario: 'healthy eating guidelines',
  vocab: '`issue`, `effect`, `experience`, `view`',
  ext: '`practical`, `arguably`',
  chunks: [
    'So what you are saying is that small changes matter more than big diets.',
    'Let me see if I have this right. You are suggesting we start with one meal, not everything at once.',
    'If I am hearing you correctly, the key is consistency, not perfection.',
    'Just to confirm, you are not saying people should give up their favourite foods.'
  ],
  patterns: ['So what you are saying is ___.', 'Let me see if I have this right. ___.'],
  dialogue: [
    ['Mia', 'I think healthy eating is less about strict rules and more about building small, consistent habits.'],
    ['Lin', 'So what you are saying is that small changes matter more than big diets.'],
    ['Mia', 'Exactly. Most people try to change everything at once and give up after a week.'],
    ['Lin', 'Let me see if I have this right. You are suggesting we start with one meal, not everything at once.'],
    ['Mia', 'Yes. Pick breakfast, make it healthy for two weeks. Then move to lunch.'],
    ['Lin', 'If I am hearing you correctly, the key is consistency, not perfection. And just to confirm, you are not saying people should give up their favourite foods entirely.'],
    ['Mia', 'Correct. It is about balance, not restriction.']
  ]
},
{
  id: '15', name: '区分事实与观点',
  scene: 'Separating objective facts from subjective evaluations',
  scenario: 'social media limits for teenagers',
  vocab: '`view`, `point`, `agreement`, `difference`',
  ext: '`reasonable`, `partly`',
  chunks: [
    'The fact is that screen time has increased. Whether that is harmful is a matter of opinion.',
    'We need to separate what the data shows from how we feel about it.',
    'That is a factual claim. Do we have evidence for it?',
    'Your concern is valid, but it is based on personal observation, not systematic data.'
  ],
  patterns: ['The fact is that ___. Whether that is ___ is a matter of opinion.', 'We need to separate ___ from ___.'],
  dialogue: [
    ['Ben', 'Social media is destroying teenagers\' mental health. We need strict limits.'],
    ['Lin', 'I think we need to separate what the data shows from how we feel about it.'],
    ['Ben', 'What do you mean?'],
    ['Lin', 'The fact is that screen time has increased over the last decade. That is measurable. Whether that is harmful in every case is a matter of interpretation.'],
    ['Ben', 'But I have seen it with my own eyes. Teenagers are more anxious now.'],
    ['Lin', 'Your concern is valid, but it is based on personal observation, not systematic data. The studies show a more mixed picture. Some teens benefit from online communities.'],
    ['Ben', 'So you are saying my concern is not legitimate?'],
    ['Lin', 'Not at all. I am saying we need to be precise about what is fact and what is our opinion about those facts.']
  ]
},
{
  id: '16', name: '修正自己的表达',
  scene: 'Realising you were misunderstood and rephrasing',
  scenario: 'weekend study habits',
  vocab: '`difference`, `solution`, `conclusion`, `opinion`',
  ext: '`overall`, `convincing`',
  chunks: [
    'I may not have expressed that clearly. Let me try again.',
    'What I meant was different from how it sounded.',
    'Let me rephrase that. I was not suggesting we cancel weekends entirely.',
    'Sorry, that came out wrong. Here is what I actually think.'
  ],
  patterns: ['What I meant was ___. Let me try again.', 'Sorry, that came out wrong. ___.'],
  dialogue: [
    ['Mia', 'Lin, you said students should study every weekend. That sounds really strict.'],
    ['Lin', 'I may not have expressed that clearly. Let me try again.'],
    ['Mia', 'Please do, because I was about to disagree strongly.'],
    ['Lin', 'What I meant was different from how it sounded. I was not suggesting we cancel weekends entirely. Let me rephrase: I think a short review session on Sunday evening helps consolidate what you learned during the week.'],
    ['Mia', 'Oh, that is very different from "study every weekend."'],
    ['Lin', 'Sorry, that came out wrong. Here is what I actually think: thirty minutes of light review on Sunday, not hours of intense study.'],
    ['Mia', 'That makes much more sense. I could actually get behind that.']
  ]
},

// ── Scene E: 得出结论 ──
{
  id: '17', name: '比较两种立场',
  scene: 'Presenting both sides before reaching a conclusion',
  scenario: 'two travel plans for the school trip',
  vocab: '`opinion`, `reason`, `example`, `evidence`',
  ext: '`arguably`, `relevant`',
  chunks: [
    'On one hand, Plan A is cheaper. On the other hand, Plan B offers more activities.',
    'Both options have their strengths, and both have weaknesses.',
    'The key difference between them is what kind of experience students would have.',
    'Having compared them side by side, I lean toward Plan B.'
  ],
  patterns: ['On one hand, ___. On the other hand, ___.', 'The key difference is ___.'],
  dialogue: [
    ['Emma', 'Lin, we have two travel plans for the school trip. Can you compare them?'],
    ['Lin', 'On one hand, Plan A is cheaper and easier to organise. On the other hand, Plan B offers more educational value.'],
    ['Emma', 'What are the weaknesses of each?'],
    ['Lin', 'Both options have their strengths, and both have weaknesses. Plan A is mostly sightseeing without much interaction. Plan B costs more but includes workshops with local students.'],
    ['Emma', 'So what is the key trade-off?'],
    ['Lin', 'The key difference is what kind of experience students would have: passive tourism versus active cultural exchange. Having compared them side by side, I lean toward Plan B, despite the higher cost.'],
    ['Emma', 'That is a well-reasoned comparison. Thank you.']
  ]
},
{
  id: '18', name: '寻找共同点',
  scene: 'Finding shared ground even when positions differ',
  scenario: 'shared community space rules',
  vocab: '`evidence`, `benefit`, `drawback`, `choice`',
  ext: '`partly`, `balanced`',
  chunks: [
    'Even though we disagree on the details, we both want the same outcome.',
    'There is actually more common ground here than it first appeared.',
    'We may differ on the method, but we share the same goal.',
    'Let us start from what we agree on and work outward from there.'
  ],
  patterns: ['Even though we disagree on ___, we both want ___.', 'Let us start from what we agree on. ___.'],
  dialogue: [
    ['Ben', 'Lin, the discussion about community space rules is getting heated. People are focusing on what divides them.'],
    ['Lin', 'Even though we disagree on the details, I think we both want the same outcome: a space that everyone can enjoy.'],
    ['Ben', 'That is true. No one wants the space to be unusable.'],
    ['Lin', 'There is actually more common ground here than it first appeared. Everyone agrees on quiet hours after ten. Everyone agrees the kitchen should be cleaned after use.'],
    ['Ben', 'So the only real disagreement is about guest policies?'],
    ['Lin', 'Exactly. We may differ on the method, but we share the same goal. Let us start from what we agree on and work outward from there. The guest policy is the only issue left to resolve.'],
    ['Ben', 'That makes the problem feel much smaller.']
  ]
},
{
  id: '19', name: '提出折中方案',
  scene: 'Creating a compromise that neither side initially proposed',
  scenario: 'a mixed online-offline course plan',
  vocab: '`choice`, `issue`, `effect`, `experience`',
  ext: '`convincing`, `practical`',
  chunks: [
    'What if we combined the best parts of both proposals?',
    'Neither option is perfect, but a hybrid approach might work.',
    'Here is a middle-ground solution that I think addresses both concerns.',
    'Would you be willing to try this as a pilot for one term?'
  ],
  patterns: ['What if we combined ___ and ___?', 'Here is a middle-ground solution: ___.'],
  dialogue: [
    ['Lin', 'Emma, the team is split. Half want fully online courses and half want fully in-person. We are stuck.'],
    ['Emma', 'What do you suggest?'],
    ['Lin', 'What if we combined the best parts of both proposals? Neither option is perfect on its own, but a hybrid approach might work.'],
    ['Emma', 'What would that look like?'],
    ['Lin', 'Here is a middle-ground solution: lectures are online and can be watched anytime. But discussions and group work happen in person twice a week. That addresses the flexibility concern and the connection concern.'],
    ['Emma', 'That is creative. I had not considered that combination.'],
    ['Lin', 'Would you be willing to try this as a pilot for one term? We can evaluate the results and adjust.'],
    ['Emma', 'A pilot is a low-risk way to test it. I am open to that.']
  ]
},
{
  id: '20', name: '总结讨论',
  scene: 'Wrapping up a discussion with a balanced summary and next steps',
  scenario: 'the final class proposal',
  vocab: '`experience`, `view`, `point`, `agreement`',
  ext: '`relevant`, `reasonable`',
  chunks: [
    'To summarise, we have covered three main points in this discussion.',
    'The key takeaway is that most of us support the proposal with some adjustments.',
    'Before we wrap up, is there anything important we have not addressed?',
    'Here is what we have decided and what happens next.'
  ],
  patterns: ['To summarise, ___.', 'The key takeaway is ___. Here is what happens next: ___.'],
  dialogue: [
    ['Lin', 'Emma, before we end, let me summarise where we are on the final class proposal.'],
    ['Emma', 'Please do.'],
    ['Lin', 'To summarise, we have covered three main points. First, the start time should move to nine. Second, the break should be twenty minutes, not ten. Third, Friday should be a review day, not a new content day.'],
    ['Emma', 'Is there general agreement on those three?'],
    ['Lin', 'The key takeaway is that most of us support the proposal with those adjustments. Before we wrap up, is there anything important we have not addressed?'],
    ['Emma', 'One thing: who will communicate the changes to the students?'],
    ['Lin', 'Good catch. Here is what we have decided and what happens next: I will draft the announcement by Wednesday, Emma will review it, and we will send it out on Friday.'],
    ['Emma', 'Perfect. That is a clear plan.']
  ]
}
];

// ============ BUILD NEW CONTENT ============

let newContent = header + '\n\n## 逐 Topic 完整教学设计\n\n';

// Common prefix
newContent += '> 下列内容是生成 CSV、Warmup 与 Ink 的权威 Topic 契约。Vocabulary 只登记词项；完整表达进入 Chunk；带槽位的生成结构进入 Pattern。';
newContent += '每个 Topic 均复用 Foundation 8—10 的连接、比较和从句。**注意：以下 20 个 Topic 的对话和句块均独立设计，请勿跨 Topic 复用模板。**\n\n';

const sceneNames = [
  '🅰️ 建立观点', '🅱️ 展开理由', '🅲 回应观点', '🅳 澄清分歧', '🅴 得出结论'
];
const assessment = (topicNum) => {
  const outLen = topicNum <= 8 ? '2—5' : '3—5';
  const writeLen = topicNum <= 8 ? '120—250' : '180—250';
  const suffix = topicNum <= 8 ? '' : '，并回答至少 2 个追问';
  const person = ['Mia', 'Ben', 'Emma', 'Mia', 'Ben'][Math.floor((topicNum-1)/4)];
  return { outLen, writeLen, suffix, person };
};

topics.forEach((t, i) => {
  const sceneIdx = Math.floor(i / 4);
  const ass = assessment(i + 1);

  newContent += `### Topic ${t.id} · ${t.name}\n\n`;
  newContent += `- **教学说明**：在"${t.scenario}"情境中学习${t.name}。本Topic聚焦：${t.scene}。\n`;
  newContent += `- **核心词（Vocabulary）**：${t.vocab}。\n`;
  newContent += `- **扩展词（Extension）**：${t.ext}。\n`;
  newContent += `- **核心句块（Chunks）**：`;
  t.chunks.forEach((c, ci) => {
    newContent += `\`${c}\`` + (ci < t.chunks.length - 1 ? '；' : '。');
  });
  newContent += `\n`;
  newContent += `- **句型（Patterns）**：\`${t.patterns[0]}\`；\`${t.patterns[1]}\`。\n`;
  newContent += `- **完成标准**：能在陌生变体中完成 12—16 轮互动，主动使用至少 3 个核心句块、1 个主句型，并完成追问、澄清或确认。\n`;
  newContent += `- **口语输出**：围绕"${t.scenario}"完成 ${ass.outLen} 分钟未准备任务；不得照读对话${ass.suffix}。\n`;
  newContent += `- **微写作**：写 ${ass.writeLen} 词，把同一能力迁移为观点段落或讨论总结。\n`;
  newContent += `- **反馈与重做**：第一次输出后按任务完成、连贯、词汇、语法及发音/拼写反馈；不看完整范文完成第二次重说和重写，7 天后换情境复测。\n`;
  newContent += `- **跨包复习**：Foundation 8—10 的连接、比较和从句；本 Topic 新表达须在本包后续至少两个 Topic 再次主动调用。\n`;
  newContent += `- **具体对话**：\n`;
  t.dialogue.forEach((d, di) => {
    newContent += `  ${di + 1}. ${d[0]}: ${d[1]}\n`;
  });
  newContent += `\n`;
});

// Write
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Course 1 rewritten successfully. Topics:', topics.length);
