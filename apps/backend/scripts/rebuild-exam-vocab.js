const fs = require('fs');
const path = require('path');

function csvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // Only wrap in quotes if needed for CSV safety
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Rebuild scene_vocabulary.csv for exam packages from scratch
const pkgs = [
  {
    name: 'exam-cet-4',
    scenes: ['四级·校园生活', '四级·社会热点'],
    topics: ['选课与课程', '社团与活动', '环境保护', '科技与生活'],
    vocab: [
      { w: 'curriculum', m: '课程', pos: 'noun', ph: '/kəˈrɪkjələm/', ph2: '/kəˈrɪkjələm/', lv: 'L2', desc: '全部课程。', en: 'The curriculum is very flexible.', zh: '课程设置非常灵活。' },
      { w: 'extracurricular', m: '课外的', pos: 'adj', ph: '/ˌekstrəkəˈrɪkjələr/', ph2: '/ˌekstrəkəˈrɪkjələ/', lv: 'L2', desc: '课外的。', en: 'I joined several extracurricular activities.', zh: '我参加了几个课外活动。' },
    ]
  },
  {
    name: 'exam-cet-6',
    scenes: ['六级·社会发展', '六级·文化教育'],
    topics: ['城市化进程', '经济与就业', '文化交流', '教育改革'],
    vocab: [
      { w: 'urbanization', m: '城市化', pos: 'noun', ph: '/ˌɜːrbənɪˈzeɪʃən/', ph2: '/ˌɜːbənaɪˈzeɪʃən/', lv: 'L3', desc: '城市化过程。', en: 'Urbanization has accelerated in recent decades.', zh: '近几十年来城市化加速了。' },
      { w: 'employment', m: '就业', pos: 'noun', ph: '/ɪmˈplɔɪmənt/', ph2: '/ɪmˈplɔɪmənt/', lv: 'L3', desc: '就业、工作。', en: 'The employment rate has been rising.', zh: '就业率一直在上升。' },
    ]
  },
];

for (const pkg of pkgs) {
  const dir = path.join('c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages', pkg.name);
  const fp = path.join(dir, 'scene_vocabulary.csv');
  
  const header = ['scene_title', 'topic_title', 'word', 'meaning', 'part_of_speech', 'phonetic_us', 'phonetic_uk', 'difficulty', 'description', 'examples_json', 'sort_order'];
  const rows = [header.map(csvField).join(',')];
  let sortIdx = 0;
  
  for (const s of pkg.scenes) {
    for (const t of pkg.topics) {
      for (const v of pkg.vocab) {
        const exJson = JSON.stringify([{ en: v.en, zh: v.zh }]);
        const field = [s, t, v.w, v.m, v.pos, v.ph, v.ph2, v.lv, v.desc, exJson, String(sortIdx++)];
        rows.push(field.map(csvField).join(','));
      }
    }
  }
  
  fs.writeFileSync(fp, rows.join('\n'));
  console.log('Regenerated ' + pkg.name + ' (' + (rows.length - 1) + ' rows)');
}

// For IELTS band packages, they have simple vocab already
// Just need to rewrite with proper quoting
const ieltsPkgs = ['exam-ielts-6', 'exam-ielts-6-5', 'exam-ielts-7', 'exam-ielts-7-5', 'exam-ielts-8', 'exam-ielts-8-5', 'exam-toefl'];
for (const p of ieltsPkgs) {
  const fp = path.join('c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages', p, 'scene_vocabulary.csv');
  if (!fs.existsSync(fp)) continue;
  
  const content = fs.readFileSync(fp, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  // Re-encode each line properly
  const output = [];
  for (const line of lines) {
    // Simple split for these files (no commas in early fields)
    const fields = line.split(',');
    // Re-encode each field
    output.push(fields.map(csvField).join(','));
  }
  fs.writeFileSync(fp, output.join('\n'));
  console.log('Re-encoded ' + p);
}

console.log('All done');
