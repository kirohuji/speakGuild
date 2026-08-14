/**
 * 为 500 句标注话题（8 个）与难度，生成最终 500-sentences.csv
 *
 * 用法: node apps/backend/prisma/scripts/annotate-500-sentences.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'data', 'packages', 'common-500-sentences');
const entries = JSON.parse(fs.readFileSync(path.join(OUT_DIR, '500-sentences.json'), 'utf8'));

// 话题定义（key, 中文标题, 英文标题, 教学定位）
const TOPICS = {
  t01_greetings: { zh: '问候与寒暄', en: 'Greetings & Small Talk' },
  t02_thanks_wishes: { zh: '感谢、道歉与祝福', en: 'Thanks, Apologies & Wishes' },
  t03_requests: { zh: '请求、指令与许可', en: 'Requests, Commands & Permission' },
  t04_opinions: { zh: '观点、同意与评价', en: 'Opinions, Agreement & Reactions' },
  t05_emotions: { zh: '情绪与安慰', en: 'Emotions, Comfort & Encouragement' },
  t06_questions: { zh: '疑问、澄清与确认', en: 'Questions & Clarification' },
  t07_daily: { zh: '日常陈述与事务', en: 'Daily Statements & Situations' },
  t08_idioms: { zh: '惯用语与俚语', en: 'Idioms & Slang' },
};

// 平衡性微调（在人工初分基础上把少数句子归入更贴切的邻近话题，
// 同时让各话题规模更均衡）：
//   t04 观点(111) → t02 感谢祝福(称赞)、t05 情绪(感受式反应)、t01(话轮衔接)
//   t07 日常(105) → t01(会话管理)、t05(心情表达)
//   t08 惯用语  → t01(口语衔接短语)
const REBALANCE = {
  29: 't05_emotions', 38: 't05_emotions', 56: 't02_thanks_wishes',
  62: 't01_greetings', 67: 't01_greetings', 78: 't02_thanks_wishes',
  90: 't01_greetings', 93: 't05_emotions', 99: 't01_greetings',
  100: 't01_greetings', 109: 't01_greetings', 112: 't02_thanks_wishes',
  128: 't01_greetings', 129: 't01_greetings', 140: 't01_greetings',
  152: 't01_greetings', 155: 't05_emotions', 162: 't05_emotions',
  165: 't05_emotions', 178: 't01_greetings', 184: 't05_emotions',
  190: 't05_emotions', 230: 't02_thanks_wishes', 231: 't01_greetings',
  241: 't01_greetings', 270: 't05_emotions', 309: 't05_emotions',
  315: 't02_thanks_wishes', 316: 't02_thanks_wishes', 409: 't08_idioms',
  412: 't05_emotions', 421: 't07_daily', 432: 't05_emotions', 490: 't05_emotions',
  // 话题归属校正（2026-08-14 逐句复核）
  67: 't07_daily',    // As always 日常回应语
  90: 't04_opinions', // To be honest 引入观点
  99: 't07_daily',    // Just in time 时间状态
  128: 't07_daily',   // At this point 时间短语
  129: 't07_daily',   // In the meantime 时间短语
  140: 't07_daily',   // For your own good 劝告理由
  182: 't07_daily',   // All of a sudden 字面义时间短语
};

// id → topic key（人工分类）
const TOPIC = {
  1: 't01_greetings', 2: 't04_opinions', 3: 't03_requests', 4: 't04_opinions',
  5: 't07_daily', 6: 't05_emotions', 7: 't07_daily', 8: 't06_questions',
  9: 't01_greetings', 10: 't02_thanks_wishes', 11: 't06_questions', 12: 't07_daily',
  13: 't07_daily', 14: 't04_opinions', 15: 't04_opinions', 16: 't07_daily',
  17: 't06_questions', 18: 't03_requests', 19: 't03_requests', 20: 't04_opinions',
  21: 't02_thanks_wishes', 22: 't03_requests', 23: 't02_thanks_wishes', 24: 't03_requests',
  25: 't02_thanks_wishes', 26: 't04_opinions', 27: 't01_greetings', 28: 't06_questions',
  29: 't04_opinions', 30: 't04_opinions', 31: 't05_emotions', 32: 't06_questions',
  33: 't01_greetings', 34: 't06_questions', 35: 't05_emotions', 36: 't05_emotions',
  37: 't03_requests', 38: 't04_opinions', 39: 't03_requests', 40: 't06_questions',
  41: 't04_opinions', 42: 't03_requests', 43: 't04_opinions', 44: 't04_opinions',
  45: 't04_opinions', 46: 't04_opinions', 47: 't04_opinions', 48: 't04_opinions',
  49: 't05_emotions', 50: 't02_thanks_wishes', 51: 't04_opinions', 52: 't08_idioms',
  53: 't04_opinions', 54: 't08_idioms', 55: 't04_opinions', 56: 't04_opinions',
  57: 't04_opinions', 58: 't03_requests', 59: 't03_requests', 60: 't04_opinions',
  61: 't07_daily', 62: 't08_idioms', 63: 't03_requests', 64: 't04_opinions',
  65: 't08_idioms', 66: 't01_greetings', 67: 't07_daily', 68: 't06_questions',
  69: 't05_emotions', 70: 't08_idioms', 71: 't06_questions', 72: 't07_daily',
  73: 't05_emotions', 74: 't03_requests', 75: 't04_opinions', 76: 't06_questions',
  77: 't06_questions', 78: 't04_opinions', 79: 't04_opinions', 80: 't04_opinions',
  81: 't04_opinions', 82: 't05_emotions', 83: 't06_questions', 84: 't05_emotions',
  85: 't03_requests', 86: 't04_opinions', 87: 't04_opinions', 88: 't04_opinions',
  89: 't06_questions', 90: 't04_opinions', 91: 't06_questions', 92: 't03_requests',
  93: 't04_opinions', 94: 't07_daily', 95: 't07_daily', 96: 't05_emotions',
  97: 't08_idioms', 98: 't04_opinions', 99: 't07_daily', 100: 't07_daily',
  101: 't02_thanks_wishes', 102: 't08_idioms', 103: 't03_requests', 104: 't03_requests',
  105: 't04_opinions', 106: 't05_emotions', 107: 't05_emotions', 108: 't08_idioms',
  109: 't08_idioms', 110: 't07_daily', 111: 't08_idioms', 112: 't02_thanks_wishes',
  113: 't05_emotions', 114: 't04_opinions', 115: 't05_emotions', 116: 't08_idioms',
  117: 't03_requests', 118: 't03_requests', 119: 't03_requests', 120: 't05_emotions',
  121: 't02_thanks_wishes', 122: 't04_opinions', 123: 't07_daily', 124: 't05_emotions',
  125: 't08_idioms', 126: 't06_questions', 127: 't04_opinions', 128: 't07_daily',
  129: 't07_daily', 130: 't03_requests', 131: 't06_questions', 132: 't05_emotions',
  133: 't04_opinions', 134: 't04_opinions', 135: 't06_questions', 136: 't03_requests',
  137: 't04_opinions', 138: 't03_requests', 139: 't04_opinions', 140: 't07_daily',
  141: 't07_daily', 142: 't08_idioms', 143: 't03_requests', 144: 't05_emotions',
  145: 't07_daily', 146: 't08_idioms', 147: 't04_opinions', 148: 't03_requests',
  149: 't01_greetings', 150: 't03_requests', 151: 't04_opinions', 152: 't08_idioms',
  153: 't03_requests', 154: 't07_daily', 155: 't04_opinions', 156: 't08_idioms',
  157: 't04_opinions', 158: 't05_emotions', 159: 't02_thanks_wishes', 160: 't04_opinions',
  161: 't02_thanks_wishes', 162: 't04_opinions', 163: 't04_opinions', 164: 't02_thanks_wishes',
  165: 't04_opinions', 166: 't07_daily', 167: 't07_daily', 168: 't04_opinions',
  169: 't04_opinions', 170: 't06_questions', 171: 't03_requests', 172: 't07_daily',
  173: 't02_thanks_wishes', 174: 't07_daily', 175: 't04_opinions', 176: 't02_thanks_wishes',
  177: 't08_idioms', 178: 't07_daily', 179: 't02_thanks_wishes', 180: 't03_requests',
  181: 't07_daily', 182: 't08_idioms', 183: 't06_questions', 184: 't04_opinions',
  185: 't07_daily', 186: 't05_emotions', 187: 't05_emotions', 188: 't07_daily',
  189: 't02_thanks_wishes', 190: 't04_opinions', 191: 't06_questions', 192: 't05_emotions',
  193: 't04_opinions', 194: 't07_daily', 195: 't07_daily', 196: 't08_idioms',
  197: 't06_questions', 198: 't07_daily', 199: 't04_opinions', 200: 't07_daily',
  201: 't04_opinions', 202: 't08_idioms', 203: 't03_requests', 204: 't03_requests',
  205: 't04_opinions', 206: 't03_requests', 207: 't08_idioms', 208: 't03_requests',
  209: 't07_daily', 210: 't04_opinions', 211: 't07_daily', 212: 't04_opinions',
  213: 't04_opinions', 214: 't06_questions', 215: 't04_opinions', 216: 't04_opinions',
  217: 't08_idioms', 218: 't04_opinions', 219: 't03_requests', 220: 't04_opinions',
  221: 't04_opinions', 222: 't04_opinions', 223: 't06_questions', 224: 't03_requests',
  225: 't04_opinions', 226: 't05_emotions', 227: 't05_emotions', 228: 't03_requests',
  229: 't04_opinions', 230: 't02_thanks_wishes', 231: 't07_daily', 232: 't03_requests',
  233: 't06_questions', 234: 't07_daily', 235: 't07_daily', 236: 't08_idioms',
  237: 't06_questions', 238: 't04_opinions', 239: 't07_daily', 240: 't01_greetings',
  241: 't07_daily', 242: 't08_idioms', 243: 't06_questions', 244: 't04_opinions',
  245: 't03_requests', 246: 't03_requests', 247: 't03_requests', 248: 't04_opinions',
  249: 't07_daily', 250: 't04_opinions', 251: 't07_daily', 252: 't03_requests',
  253: 't04_opinions', 254: 't04_opinions', 255: 't06_questions', 256: 't08_idioms',
  257: 't07_daily', 258: 't03_requests', 259: 't07_daily', 260: 't03_requests',
  261: 't02_thanks_wishes', 262: 't08_idioms', 263: 't06_questions', 264: 't03_requests',
  265: 't03_requests', 266: 't08_idioms', 267: 't03_requests', 268: 't01_greetings',
  269: 't06_questions', 270: 't04_opinions', 271: 't03_requests', 272: 't07_daily',
  273: 't04_opinions', 274: 't04_opinions', 275: 't05_emotions', 276: 't02_thanks_wishes',
  277: 't06_questions', 278: 't04_opinions', 279: 't01_greetings', 280: 't05_emotions',
  281: 't04_opinions', 282: 't05_emotions', 283: 't04_opinions', 284: 't04_opinions',
  285: 't05_emotions', 286: 't06_questions', 287: 't05_emotions', 288: 't05_emotions',
  289: 't06_questions', 290: 't05_emotions', 291: 't03_requests', 292: 't06_questions',
  293: 't05_emotions', 294: 't07_daily', 295: 't04_opinions', 296: 't08_idioms',
  297: 't04_opinions', 298: 't04_opinions', 299: 't04_opinions', 300: 't06_questions',
  301: 't07_daily', 302: 't07_daily', 303: 't03_requests', 304: 't03_requests',
  305: 't07_daily', 306: 't08_idioms', 307: 't06_questions', 308: 't07_daily',
  309: 't07_daily', 310: 't06_questions', 311: 't07_daily', 312: 't03_requests',
  313: 't03_requests', 314: 't04_opinions', 315: 't04_opinions', 316: 't04_opinions',
  317: 't04_opinions', 318: 't03_requests', 319: 't07_daily', 320: 't06_questions',
  321: 't08_idioms', 322: 't07_daily', 323: 't06_questions', 324: 't03_requests',
  325: 't07_daily', 326: 't03_requests', 327: 't01_greetings', 328: 't06_questions',
  329: 't06_questions', 330: 't04_opinions', 331: 't07_daily', 332: 't07_daily',
  333: 't06_questions', 334: 't04_opinions', 335: 't03_requests', 336: 't03_requests',
  337: 't07_daily', 338: 't06_questions', 339: 't07_daily', 340: 't03_requests',
  341: 't03_requests', 342: 't07_daily', 343: 't07_daily', 344: 't03_requests',
  345: 't05_emotions', 346: 't08_idioms', 347: 't08_idioms', 348: 't03_requests',
  349: 't05_emotions', 350: 't07_daily', 351: 't06_questions', 352: 't03_requests',
  353: 't07_daily', 354: 't03_requests', 355: 't06_questions', 356: 't08_idioms',
  357: 't07_daily', 358: 't04_opinions', 359: 't03_requests', 360: 't07_daily',
  361: 't08_idioms', 362: 't08_idioms', 363: 't08_idioms', 364: 't08_idioms',
  365: 't08_idioms', 366: 't08_idioms', 367: 't08_idioms', 368: 't08_idioms',
  369: 't08_idioms', 370: 't08_idioms', 371: 't08_idioms', 372: 't08_idioms',
  373: 't08_idioms', 374: 't08_idioms', 375: 't08_idioms', 376: 't08_idioms',
  377: 't08_idioms', 378: 't08_idioms', 379: 't08_idioms', 380: 't08_idioms',
  381: 't08_idioms', 382: 't08_idioms', 383: 't08_idioms', 384: 't08_idioms',
  385: 't05_emotions', 386: 't05_emotions', 387: 't08_idioms', 388: 't08_idioms',
  389: 't04_opinions', 390: 't08_idioms', 391: 't08_idioms', 392: 't08_idioms',
  393: 't08_idioms', 394: 't08_idioms', 395: 't08_idioms', 396: 't08_idioms',
  397: 't06_questions', 398: 't06_questions', 399: 't06_questions', 400: 't06_questions',
  401: 't06_questions', 402: 't02_thanks_wishes', 403: 't05_emotions', 404: 't03_requests',
  405: 't01_greetings', 406: 't07_daily', 407: 't04_opinions', 408: 't07_daily',
  409: 't04_opinions', 410: 't07_daily', 411: 't07_daily', 412: 't04_opinions',
  413: 't06_questions', 414: 't08_idioms', 415: 't01_greetings', 416: 't07_daily',
  417: 't07_daily', 418: 't07_daily', 419: 't07_daily', 420: 't07_daily',
  421: 't04_opinions', 422: 't05_emotions', 423: 't08_idioms', 424: 't07_daily',
  425: 't08_idioms', 426: 't07_daily', 427: 't04_opinions', 428: 't07_daily',
  429: 't04_opinions', 430: 't07_daily', 431: 't04_opinions', 432: 't04_opinions',
  433: 't06_questions', 434: 't06_questions', 435: 't08_idioms', 436: 't08_idioms',
  437: 't07_daily', 438: 't07_daily', 439: 't07_daily', 440: 't05_emotions',
  441: 't07_daily', 442: 't05_emotions', 443: 't07_daily', 444: 't07_daily',
  445: 't07_daily', 446: 't05_emotions', 447: 't05_emotions', 448: 't04_opinions',
  449: 't05_emotions', 450: 't07_daily', 451: 't07_daily', 452: 't07_daily',
  453: 't07_daily', 454: 't07_daily', 455: 't08_idioms', 456: 't08_idioms',
  457: 't07_daily', 458: 't07_daily', 459: 't02_thanks_wishes', 460: 't07_daily',
  461: 't05_emotions', 462: 't07_daily', 463: 't07_daily', 464: 't04_opinions',
  465: 't07_daily', 466: 't08_idioms', 467: 't04_opinions', 468: 't07_daily',
  469: 't06_questions', 470: 't08_idioms', 471: 't07_daily', 472: 't03_requests',
  473: 't03_requests', 474: 't04_opinions', 475: 't07_daily', 476: 't03_requests',
  477: 't04_opinions', 478: 't04_opinions', 479: 't07_daily', 480: 't07_daily',
  481: 't07_daily', 482: 't07_daily', 483: 't06_questions', 484: 't06_questions',
  485: 't06_questions', 486: 't06_questions', 487: 't03_requests', 488: 't08_idioms',
  489: 't04_opinions', 490: 't04_opinions', 491: 't06_questions', 492: 't06_questions',
  493: 't08_idioms', 494: 't08_idioms', 495: 't07_daily', 496: 't05_emotions',
  497: 't07_daily', 498: 't06_questions', 499: 't03_requests', 500: 't07_daily',
};

// 难度: 惯用语/俚语 → L3；其余按词数: ≤3 → L1, 4–6 → L2, ≥7 → L3
function difficulty(en, topicKey) {
  if (topicKey === 't08_idioms') return 'L3';
  const words = en.trim().split(/\s+/).length;
  if (words <= 3) return 'L1';
  if (words <= 6) return 'L2';
  return 'L3';
}

// 校验: 全部 500 个 id 都有话题
const missing = [];
for (let i = 1; i <= entries.length; i++) {
  if (!TOPIC[i]) missing.push(i);
}
if (missing.length) {
  console.error('缺少话题标注的 id:', missing.join(','));
  process.exit(1);
}
if (entries.length !== 500) {
  console.error(`条目数 ${entries.length} ≠ 500`);
  process.exit(1);
}

// 应用平衡性微调
function topicOf(id) {
  return REBALANCE[id] || TOPIC[id];
}

// 生成最终 CSV
const rows = ['id,en,zh,topic,difficulty'];
entries.forEach((e, idx) => {
  const id = idx + 1;
  const key = topicOf(id);
  const topicZh = TOPICS[key].zh;
  const diff = difficulty(e.en, key);
  rows.push(`${id},"${e.en.replace(/"/g, '""')}","${e.zh.replace(/"/g, '""')}","${topicZh}",${diff}`);
});

// 同时写入 topics.json 供教学文档使用
fs.writeFileSync(
  path.join(OUT_DIR, 'topics.json'),
  JSON.stringify(
    Object.entries(TOPICS).map(([key, v]) => ({ key, zh: v.zh, en: v.en })),
    null,
    2
  ),
  'utf8'
);

fs.writeFileSync(path.join(OUT_DIR, '500-sentences.csv'), rows.join('\n'), 'utf8');

// 分布统计
const dist = {};
entries.forEach((e, idx) => {
  const key = topicOf(idx + 1);
  dist[key] = (dist[key] || 0) + 1;
});
console.log('话题分布:');
Object.entries(dist).forEach(([k, n]) => {
  console.log(`  ${k} (${TOPICS[k].zh}): ${n}`);
});
console.log('已写入:', path.join(OUT_DIR, '500-sentences.csv'));
console.log('已写入:', path.join(OUT_DIR, 'topics.json'));
