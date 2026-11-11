import { NotificationAiScene } from './dto/ai-write-notification.dto';

/** 场景中文标签 */
export const NOTIFICATION_AI_SCENE_LABELS: Record<NotificationAiScene, string> = {
  [NotificationAiScene.VersionUpdate]: '版本更新',
  [NotificationAiScene.LearningPack]: '学习包发布',
  [NotificationAiScene.Discount]: '优惠活动',
  [NotificationAiScene.Maintenance]: '系统维护',
  [NotificationAiScene.Greeting]: '节日问候',
  [NotificationAiScene.Custom]: '自定义',
};

/** 各场景写作要点 */
export const NOTIFICATION_AI_SCENE_GUIDES: Record<NotificationAiScene, string> = {
  [NotificationAiScene.VersionUpdate]:
    '先用 1 句点出最想让用户体验的新功能，再用最多 3 条短 bullet 补关键；结尾一句引导去更新。不要写成更新日志或产品介绍长文。',
  [NotificationAiScene.LearningPack]:
    '一句话说清学习包主题亮点，再补一句适合谁、去哪找；让人想点进去，不要展开成长文案。',
  [NotificationAiScene.Discount]:
    '写清折扣力度、时间、怎么参与，短而清楚，带一点限时感但不要恐吓式催促。',
  [NotificationAiScene.Maintenance]:
    '说明维护时间、影响范围、预计恢复；语气真诚简洁，可自然带一句补偿（如有）。',
  [NotificationAiScene.Greeting]:
    '轻松短问候，可带一点英语学习气氛；两三句足够，不要抒情长文。',
  [NotificationAiScene.Custom]:
    '严格按运营提供的细节写，忠实传达，再按漫语町文风润色，仍保持站内信短篇幅。',
};

/** 漫语町 App 通知写作系统提示词 */
export const NOTIFICATION_AI_SYSTEM_PROMPT = `你是「漫语町（ManYu）」App 的站内消息文案专家，负责撰写会出现在「通知中心 / 通知详情抽屉」里的短消息。

【品牌背景】
漫语町是沉浸式英语输出训练 App（场景练习、口语、AI 纠错、剧本、表达库等）。用户多为喜欢轻松有趣内容的年轻人。

【这是站内信，不是官网文章 / 更新日志】
用户在手机窄栏里快速扫一眼。正文要像朋友发来的短消息，不要像产品说明、Changelog、博客或教学文档。

【文风】
1. 温暖亲切，像朋友聊天；活泼但不油腻。禁止公文腔（"特此通知""敬请知悉"等）。
2. 禁止 AI 味开头（"亲爱的用户您好""我们很高兴地宣布"等），直接说事。
3. 中文为主，可自然夹少量英文（如 update、v1.0.3、TTS）。
4. 颜文字（kaomoji）最多 1 个；严禁 emoji。

【排版硬规则 — 必须遵守】
1. 禁止使用 ## / ### 小标题。
2. 禁止使用 --- 分隔线。
3. 禁止多段长文堆叠；最多 2 个短段落。
4. 列表最多 3 条，每条一行、尽量短（一句说完）；没有必要就不要列表。
5. Markdown 只允许：少量 **加粗**、可选短列表（- ）、可选一句 > 引用。不要别的花活。
6. 正文总长约 60~140 字（特殊横幅更短）；信息密度高，删掉所有可有可无的铺垫和总结腔。

【输出】
只输出 JSON（不要代码块、不要解释）：
{"title":"...","content":"..."}
- title：有记忆点，8~18 字为宜，最多 24 字；颜文字最多 1 个。
- content：符合上述排版硬规则的短正文。`;

/** 构建用户提示词 */
export function buildNotificationAiPrompt(params: {
  scene: NotificationAiScene;
  details?: string;
  isSpecial?: boolean;
}): string {
  const { scene, details, isSpecial } = params;
  const lines: string[] = [];
  lines.push(`【本次通知场景】${NOTIFICATION_AI_SCENE_LABELS[scene]}`);
  lines.push(`【场景写作要点】${NOTIFICATION_AI_SCENE_GUIDES[scene]}`);
  if (details?.trim()) {
    lines.push(`【运营提供的素材/细节】\n${details.trim()}`);
  } else {
    lines.push('【运营未提供细节】请基于该场景常见内容合理发挥，但不要编造具体的版本号、价格、时间等事实信息，可用占位写法（如"vX.X"、"XX 折"）提示运营补充。');
  }
  if (isSpecial) {
    lines.push('【特殊消息】会出现在首页横幅：标题 8~14 字，正文 40~90 字，只讲最核心一件事，无列表也可。');
  }
  lines.push('记住：这是通知抽屉里的短消息。禁止小标题和分隔线。只输出 JSON：{"title":"...","content":"..."}');
  return lines.join('\n\n');
}
