const fs = require('fs');
const path = require('path');
const b = 'c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';
const ds = fs.readdirSync(b).filter(d => fs.statSync(path.join(b, d)).isDirectory()).sort();

function parseCSVLine(l) {
  const parts = []; let cur = '', q = false;
  for (const ch of l) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

let md = [
  '# 📚 漫语町学习包内容清单',
  '',
  '> 本文档按学习包列出每个包的核心场景、训练主题和数据规模。',
  '> 用于快速了解每个包「有什么内容、练什么、多少量」。',
  '',
  '---',
  '',
  '## 📊 速查总表',
  '',
  '| 包名 | 类型 | 场景 | 主题 | 例句 | 单词 | 剧集 |',
  '|------|:----:|:----:|:----:|:----:|:----:|:----:|',
];

for (const d of ds) {
  const pkg = path.join(b, d);

  const sc = fs.readFileSync(path.join(pkg, 'scenes.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const scenes = sc.map(parseCSVLine);

  const tp = fs.readFileSync(path.join(pkg, 'training_topics.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const topics = tp.map(parseCSVLine);

  const chFile = fs.readFileSync(path.join(pkg, 'chunks.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const nChunks = chFile.length;

  const vbFile = fs.readFileSync(path.join(pkg, 'scene_vocabulary.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const nVocab = vbFile.length;

  const epFile = fs.readFileSync(path.join(pkg, 'script_episodes.csv'), 'utf-8').trim().split('\n').slice(1).filter(l => l.trim());
  const nEps = epFile.length;

  let type = '?';
  if (d.startsWith('daily-')) type = '日常';
  else if (d.startsWith('exam-')) type = '考试';
  else if (d.startsWith('course-')) type = '课程';
  else if (d.startsWith('story-')) type = '故事';
  else if (d.startsWith('foundation-')) type = '基础';

  const sceneList = scenes.map(s => ({
    title: s[1] || '?',
    lvl: (s[3] || '').replace(/^"|"$/g, ''),
    desc: (s[5] || '').replace(/^"|"$/g, '')
  }));

  const topicList = topics.map(t => ({
    name: (t[1] || '?').replace(/^"|"$/g, ''),
    scene: (t[0] || '').replace(/^"|"$/g, '')
  }));

  // Type icon
  const icons = { '日常': '🌟', '考试': '📖', '课程': '📚', '故事': '🎭', '基础': '🏗' };
  const icon = icons[type] || '📦';
  const shortName = d.replace(/^(daily-|exam-|course-|story-|foundation-)/, '');

  md.push(`| ${icon} ${d} | ${type} | ${scenes.length} | ${topics.length} | ${nChunks} | ${nVocab} | ${nEps} |`);

  // Store detail for later
  md.details = md.details || [];
  md.details.push({
    name: d, type, icon, shortName,
    scenes: sceneList, topics: topicList,
    nChunks, nVocab, nEps, nScenes: scenes.length, nTopics: topics.length
  });
}

md.push('', '---', '');

// Detail sections
for (const p of md.details) {
  md.push(`## ${p.icon} ${p.name}`);
  md.push('');
  md.push(`**${p.type}包**　|　场景 ${p.nScenes}　|　主题 ${p.nTopics}　|　例句 ${p.nChunks}　|　单词 ${p.nVocab}　|　剧集 ${p.nEps}`);
  md.push('');

  md.push('### 🎯 场景');
  md.push('');
  for (const s of p.scenes) {
    md.push(`- **${s.title}** [${s.lvl}] ${s.desc ? '— ' + s.desc : ''}`);
  }
  md.push('');

  md.push('### 📝 训练主题');
  md.push('');
  for (const t of p.topics) {
    md.push(`- ${t.name}`);
  }
  md.push('');

  md.push('---');
  md.push('');
}

fs.writeFileSync(path.join(b, '学习包内容清单.md'), md.join('\n'), 'utf-8');
console.log('✅ 学习包内容清单已生成');
