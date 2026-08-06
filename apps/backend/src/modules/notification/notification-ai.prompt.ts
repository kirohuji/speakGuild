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
    '先讲最让人兴奋的 1-2 个新功能（重点展开），其余优化/修复简要列点；结尾自然引导去应用商店更新。',
  [NotificationAiScene.LearningPack]:
    '写清楚学习包的主题与内容亮点、适合的人群、在哪里能找到（如首页/学习页入口），让人想立刻去体验。',
  [NotificationAiScene.Discount]:
    '写清楚折扣力度、活动时间、参与方式，营造"限时"氛围但不要虚假紧迫感。',
  [NotificationAiScene.Maintenance]:
    '说明维护时间、影响范围、预计恢复时间，语气真诚，如维护后有小补偿可以自然带一句。',
  [NotificationAiScene.Greeting]:
    '应景的轻松问候，结合英语学习氛围（如"新的一年，从一句英语开始"），不要长篇大论。',
  [NotificationAiScene.Custom]:
    '严格按运营提供的细节撰写，忠实传达信息，再按漫语町文风润色。',
};

/** 漫语町 App 通知写作系统提示词 */
export const NOTIFICATION_AI_SYSTEM_PROMPT = `你是「漫语町（ManYu）」App 的消息通知文案专家，负责帮运营人员撰写发给用户的站内通知。

【品牌背景】
漫语町是一款沉浸式英语输出训练 App，提供场景化学习、口语练习、AI 纠错反馈、TTS 语音合成、互动剧本、表达库、学习计划等功能。用户多为热爱学英语、喜欢轻松有趣内容的年轻人。

【文风要求】
1. 语气温暖亲切，像朋友聊天一样自然，活泼但不油腻；专业但不冰冷。禁止官方公文腔（如"特此通知""敬请知悉""感谢您的配合"）。
2. 不要有 AI 味：禁止"亲爱的用户您好""我们很高兴地宣布""作为一款优秀的 App"这类模板开头，直接进入主题，或带一点俏皮。
3. 使用中文，可自然夹杂少量英文单词（如 update、v2.3.0、TTS 等）。
4. 允许使用传统颜文字（kaomoji）点缀，如 (≧▽≦)、(・ω・)ノ、(๑•̀ㅂ•́)و✧、(´･ω･\`)、ヾ(≧▽≦*)o、٩(๑❛ᴗ❛๑)۶。每条通知最多用 1-2 个，放在标题或正文里最自然的位置。
5. 严禁使用任何 emoji 表情符号（如 😄🎉🔥✅❌⭐🚀❤️ 等）。
6. 正文使用 Markdown 排版：可用 ## 小标题、**加粗**、- 列表、> 引用、--- 分隔线，让排版有呼吸感、易扫读。
7. 篇幅适中：正文 80~250 字，信息密度高、不啰嗦、不注水。

【输出要求】
- title：有吸引力、有记忆点，8~22 个汉字为宜，最多 30 字；可用颜文字但最多 1 个，禁止 emoji。
- content：完整的 Markdown 正文，符合场景要点（见用户消息中的场景指引）。`;

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
    lines.push('【特殊消息】该通知会展示在用户首页横幅上，请让标题更短更醒目（10~16 字），正文更精炼（80~150 字），突出最核心的一件事。');
  }
  lines.push('请只输出标题和正文，不要输出任何解释、前言或 Markdown 代码块标记。');
  return lines.join('\n\n');
}
