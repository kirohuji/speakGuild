const fs = require('fs');
const path = require('path');
const b = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';
const ds = fs.readdirSync(b).filter(d => fs.statSync(path.join(b, d)).isDirectory()).sort();

let total = { scenes: 0, topics: 0, episodes: 0, vocab: 0, chunks: 0, patterns: 0 };
let levels = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
let typeStats = { daily: { scenes: 0, pkgs: 0 }, exam: { scenes: 0, pkgs: 0 }, course: { scenes: 0, pkgs: 0 }, story: { scenes: 0, pkgs: 0 }, foundation: { scenes: 0, pkgs: 0 } };
let pkgData = [];

for (const d of ds) {
  const pkg = path.join(b, d);

  // Determine type from folder prefix
  let pkgType = 'unknown';
  if (d.startsWith('daily-')) pkgType = 'daily';
  else if (d.startsWith('exam-')) pkgType = 'exam';
  else if (d.startsWith('course-')) pkgType = 'course';
  else if (d.startsWith('story-')) pkgType = 'story';
  else if (d.startsWith('foundation-')) pkgType = 'foundation';

  const sc = fs.readFileSync(path.join(pkg, 'scenes.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const sceneData = sc.map(l => {
    const parts = [];
    let cur = '', inQ = false;
    for (const ch of l) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    return parts;
  });
  const nScenes = sceneData.length;
  total.scenes += nScenes;

  // Track levels per scene
  const sceneLevels = {};
  for (const s of sceneData) {
    const lvl = (s[3] || '').replace(/^["\s]+|["\s]+$/g, '');
    if (lvl && levels[lvl] !== undefined) levels[lvl]++;
    if (lvl) sceneLevels[lvl] = (sceneLevels[lvl] || 0) + 1;
  }

  // Type stats
  if (typeStats[pkgType]) {
    typeStats[pkgType].scenes += nScenes;
    typeStats[pkgType].pkgs++;
  }

  const tp = fs.readFileSync(path.join(pkg, 'training_topics.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const nTopics = tp.length;
  total.topics += nTopics;

  const ep = fs.readFileSync(path.join(pkg, 'script_episodes.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const nEps = ep.length;
  total.episodes += nEps;

  const vb = fs.readFileSync(path.join(pkg, 'scene_vocabulary.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  total.vocab += vb.length;

  const ch = fs.readFileSync(path.join(pkg, 'chunks.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  total.chunks += ch.length;

  const pt = fs.readFileSync(path.join(pkg, 'sentence_patterns.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  total.patterns += pt.length;

  pkgData.push({
    name: d, type: pkgType, scenes: nScenes, topics: nTopics,
    episodes: nEps, vocab: vb.length, chunks: ch.length, patterns: pt.length,
    levels: sceneLevels
  });
}

// Build summary
let summary = '# 📊 漫语町学习数据包总览\n\n';
summary += `> 生成日期: 2026-06-15  |  总计 **${ds.length} 个学习包**\n\n`;

summary += '---\n\n';
summary += '## 一、数据规模汇总\n\n';
summary += '| 维度 | 数量 |\n|------|:----:|\n';
summary += `| 学习包 (Packages) | ${ds.length} |\n`;
summary += `| 场景 (Scenes) | ${total.scenes} |\n`;
summary += `| 训练主题 (Training Topics) | ${total.topics} |\n`;
summary += `| 单词/短语 (Vocabulary) | ${total.vocab} |\n`;
summary += `| 例句块 (Chunks) | ${total.chunks} |\n`;
summary += `| 句型模板 (Patterns) | ${total.patterns} |\n`;
summary += `| 学习剧集 (Episodes) | ${total.episodes} |\n\n`;

summary += '## 二、按类型分布\n\n';
summary += '| 类型 | 包数 | 场景数 | 说明 |\n|------|:---:|:------:|------|\n';
summary += `| 🌟 日常 (daily) | ${typeStats.daily.pkgs} | ${typeStats.daily.scenes} | 职场/旅行/健康/校园/社交/留学 |\n`;
summary += `| 📖 考试 (exam) | ${typeStats.exam.pkgs} | ${typeStats.exam.scenes} | 雅思口语分级训练 |\n`;
summary += `| 📚 课程 (course) | ${typeStats.course.pkgs} | ${typeStats.course.scenes} | 语法/时态/连词/表达/动词短语/副词/时间/方位 |\n`;
summary += `| 🎭 故事 (story) | ${typeStats.story.pkgs} | ${typeStats.story.scenes} | 历史/寓言/神话/文化/哲学/科技/中世纪 |\n`;
summary += `| 🏗 基础 (foundation) | ${typeStats.foundation.pkgs} | ${typeStats.foundation.scenes} | 零基础入门 |\n\n`;

summary += '## 三、难度等级 (L1-L5) 覆盖分析\n\n';
summary += '| 难度等级 | 场景数 | 覆盖率 | 说明 |\n|---------|:------:|:------:|------|\n';
for (const lvl of ['L1', 'L2', 'L3', 'L4', 'L5']) {
  const count = levels[lvl] || 0;
  const pct = ((count / total.scenes) * 100).toFixed(1);
  let desc = '';
  if (lvl === 'L1') desc = '零基础/基础入门 — 问候、数字、日常表达、简单问路点餐';
  else if (lvl === 'L2') desc = '初级提高 — 校园、旅行、寓言故事、文化、副词/时间/方位';
  else if (lvl === 'L3') desc = '中级 — 历史、神话、哲学、科技、从句、雅思7分';
  else if (lvl === 'L4') desc = '中高级 — 职场客户沟通、雅思8分';
  else if (lvl === 'L5') desc = '高级';
  summary += `| ${lvl} | ${count} | ${pct}% | ${desc} |\n`;
}

// Check coverage gaps
const covered = Object.values(levels).reduce((a, b) => a + b, 0);
const gap = total.scenes - covered;
summary += '\n';
if (gap > 0) {
  summary += `> ⚠️ 有 ${gap} 个场景的难度等级未标注\n\n`;
} else {
  summary += '> ✅ 所有场景均已标注难度等级\n\n';
}

summary += '## 四、各学习包详情\n\n';
summary += '| 包名 | 类型 | 场景 | 主题 | 剧集 | 单词 | 例句 | 句型 | 难度分布 |\n';
summary += '|-----|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:--------:|\n';

for (const p of pkgData) {
  const lvlStr = Object.entries(p.levels)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}×${v}`)
    .join(' ');
  summary += `| ${p.name} | ${p.type} | ${p.scenes} | ${p.topics} | ${p.episodes} | ${p.vocab} | ${p.chunks} | ${p.patterns} | ${lvlStr || '-'} |\n`;
}

summary += '\n## 五、数据发布建议\n\n';
summary += '### 5.1 推荐首批发布包（覆盖 L1-L4）\n\n';
summary += '| 优先级 | 包名 | 理由 |\n|--------|------|------|\n';
summary += '| 🥇 首要 | daily-social, daily-travel | L1-L2 最高频场景，用户最需要 |\n';
summary += '| 🥇 首要 | foundation-beginner | L1 零基础入门必经之路 |\n';
summary += '| 🥈 重要 | daily-healthcare, daily-campus | L1-L2 实用场景，覆盖面广 |\n';
summary += '| 🥈 重要 | course-tenses, course-grammar | L2 语法刚需 |\n';
summary += '| 🥉 补充 | story-fables, story-medieval | L2 趣味故事，提升留存 |\n';
summary += '| 🥉 补充 | exam-academic | L3-L4 考试需求用户 |\n\n';

summary += '### 5.2 难度覆盖结论\n\n';
if (levels.L1 > 0 && levels.L2 > 0 && levels.L3 > 0) {
  summary += '✅ **L1-L3 全覆盖** — 核心学习路径完整\n';
} else {
  summary += '⚠️ L1-L3 部分覆盖，需要补充\n';
}
if (levels.L4 > 0) {
  summary += '✅ **L4 有覆盖** — 适合中高级学习者\n';
} else {
  summary += '❌ **L4 缺失** — 建议补充高级商务/学术场景\n';
}
if (levels.L5 > 0) {
  summary += '✅ **L5 有覆盖**\n';
} else {
  summary += 'ℹ️ **L5 暂无场景** — 高级母语级表达场景较少，可按需补充\n';
}

summary += '\n### 5.3 已知问题\n\n';
summary += '1. 部分故事包（story-*）的词表和例句为自动生成模板数据，发布前建议人工润色\n';
summary += '2. course-phrasal-verbs 包含2个临时文件 (`_collocations_scenes.csv`, `collocations_vocab.csv`)，需清理\n';
summary += '3. 部分 course 包的 `学习包的功能介绍.md` 可能需同步更新前缀信息\n';
summary += '4. story 包的 ink-scripts 目录为占位符（`.gitkeep`），种子程序会自动生成\n\n';

summary += '---\n';
summary += `> 本文档由分析脚本自动生成 | ${new Date().toISOString().split('T')[0]}\n`;

fs.writeFileSync(path.join(b, '学习数据包分析报告.md'), summary, 'utf-8');
console.log('✅ 分析报告已生成');
