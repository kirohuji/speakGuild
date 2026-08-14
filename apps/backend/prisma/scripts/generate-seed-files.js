/**
 * 为 common-500-sentences 生成可导入数据库的 seed 文件：
 *   - scenes.csv   (4 个场景，分类复用「基础入门」)
 *   - chunks.csv   (500 句 → 500 个句块，按话题归属)
 *
 * 用法: node apps/backend/prisma/scripts/generate-seed-files.js
 * 之后: SEED_PACKAGE=common-500-sentences node prisma/seed.ts  （追加模式）
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'data', 'packages', 'common-500-sentences');
const CATEGORY = '基础入门';

// 单一学习包 = 单一场景「常用英语500句」，内含 8 个话题
const SCENE = {
  title: '常用英语500句',
  desc: '500 个高频英语口语单句，按 8 个话题组织，覆盖问候、请求、观点、情绪、疑问、日常与惯用表达',
};

// ── 读取最终 500-sentences.csv ──
function readSentences() {
  const lines = fs.readFileSync(path.join(OUT_DIR, '500-sentences.csv'), 'utf8').trim().split('\n');
  const rows = [];
  for (const line of lines.slice(1)) {
    const i = line.lastIndexOf('",');
    const head = line.slice(0, i + 1);
    const diff = line.slice(i + 2);
    const m = head.match(/^(\d+),"((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)"$/);
    if (!m) continue;
    rows.push({ id: +m[1], en: m[2].replace(/""/g, '"'), zh: m[3].replace(/""/g, '"'), topic: m[4].replace(/""/g, '"'), diff });
  }
  return rows;
}

function csvField(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function main() {
  const sentences = readSentences();
  if (sentences.length !== 500) throw new Error(`句子数 ${sentences.length} ≠ 500`);

  // 话题 → 场景 映射（与 training_topics.csv 一致，用完整 CSV 解析器）
  const topicScene = {};
  const rawTt = fs.readFileSync(path.join(OUT_DIR, 'training_topics.csv'), 'utf8');
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < rawTt.length; i++) {
    const c = rawTt[i];
    if (inQ) { if (c === '"') { if (rawTt[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { if (row.length >= 2 && row[0] !== 'scene_title') topicScene[row[1]] = row[0]; row = []; cur = ''; }
    else if (c === '\r') {}
    else cur += c;
  }

  // ── scenes.csv（单一场景 = 单一学习包） ──
  const sceneLines = ['category_name,title,location,required_output_level,required_user_level,description,package_type'];
  sceneLines.push(`${CATEGORY},${SCENE.title},general,L1,1,${csvField(SCENE.desc)},daily`);
  fs.writeFileSync(path.join(OUT_DIR, 'scenes.csv'), sceneLines.join('\n'), 'utf8');
  console.log(`✅ scenes.csv (1 场景「${SCENE.title}」, 分类=${CATEGORY})`);

  // ── chunks.csv ──
  const chunkLines = ['scene_title,topic_title,category,text,meaning,difficulty,description,examples_json'];
  for (const s of sentences) {
    if (!topicScene[s.topic]) throw new Error(`话题「${s.topic}」未匹配`);
    const examples = JSON.stringify([{ en: s.en, zh: s.zh }]);
    chunkLines.push(`${SCENE.title},${s.topic},核心句块,${csvField(s.en)},${csvField(s.zh)},${s.diff},,${csvField(examples)}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'chunks.csv'), chunkLines.join('\n'), 'utf8');
  console.log(`✅ chunks.csv (${sentences.length} 句块)`);

  console.log('\n下一步: SEED_PACKAGE=common-500-sentences node prisma/seed.ts （追加模式，不动其他数据）');
}

main();
