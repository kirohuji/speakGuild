// Generator: reads topic JSON, writes Course MD files
const fs=require('fs'),p=require('path'),base=p.join(__dirname,'..','data','packages');

function genCourse(dirName, review, grammarNote, topicsJsonFile) {
  const topics = JSON.parse(fs.readFileSync(p.join(__dirname, topicsJsonFile), 'utf8'));
  const fp = p.join(base, dirName, '学习包的功能介绍.md');
  if (!fs.existsSync(fp)) { console.log('SKIP ' + dirName); return; }
  
  let c = fs.readFileSync(fp, 'utf8');
  const idx = c.indexOf('## 逐 Topic 完整教学设计');
  if (idx === -1) { console.log('SKIP ' + dirName + ': no section'); return; }
  
  let o = c.substring(0, idx) + '\n\n## 逐 Topic 完整教学设计\n\n';
  o += `> 下列内容是生成 CSV、Warmup 与 Ink 的权威 Topic 契约。每个 Topic 均复用：${review}。**注意：以下 20 个 Topic 的对话和句块均独立设计，请勿跨 Topic 复用模板。**\n\n> ${grammarNote}\n\n`;
  
  topics.forEach((t, gi) => {
    const num = gi + 1;
    const ol = num <= 8 ? '2—5' : '3—5';
    const wl = num <= 8 ? '120—250' : '180—250';
    const sf = num <= 8 ? '' : '，并回答至少 2 个追问';
    
    o += `### Topic ${t.id} · ${t.name}\n\n`;
    o += `- **教学说明**：在"${t.scenario}"情境中学习${t.name}。本Topic聚焦：${t.focus}。\n`;
    o += `- **核心词（Vocabulary）**：${t.vocab}。\n`;
    o += `- **扩展词（Extension）**：${t.ext}。\n`;
    o += `- **核心句块（Chunks）**：` + t.chunks.map(c => '`' + c + '`').join('；') + `。\n`;
    o += `- **句型（Patterns）**：\`${t.patterns[0]}\`；\`${t.patterns[1]}\`。\n`;
    o += `- **完成标准**：能在陌生变体中完成 12—16 轮互动，使用至少 3 个核心句块和 1 个主句型，并形成结论、决定或下一步。\n`;
    o += `- **口语输出**：围绕"${t.scenario}"完成 ${ol} 分钟未准备任务；不得照读对话${sf}。\n`;
    o += `- **微写作**：写 ${wl} 词，内容必须重新组织，不得抄写口语稿。\n`;
    o += `- **反馈与重做**：按任务完成、结构、词汇、语法及发音/拼写反馈；完成第二次重说和重写，7 天后换情境复测。\n`;
    o += `- **跨包复习**：${review}；本 Topic 新表达须在本包后续至少两个 Topic 再次主动调用。\n`;
    o += `- **具体对话**：\n`;
    t.dialogue.forEach((d, di) => { o += `  ${di + 1}. ${d[0]}: ${d[1]}\n`; });
    o += `\n`;
  });
  
  fs.writeFileSync(fp, o, 'utf8');
  console.log('  ✓ ' + dirName + ' (' + topics.length + ' topics)');
}

// Generate Course 5
genCourse('course-5-workplace-collaboration',
  'Foundation 3、7、8 与 Course 1 的工作描述、建议和观点互动',
  '本包新语法**被动语态进阶**和**间接引语(backshift)**已在各 Topic 的 Chunks 和对话中自然嵌入。',
  'topics-c5.json');

// Generate Course 6
genCourse('course-6-information-media',
  'Course 1—5 的观点、叙事、生活事务和职场转述',
  '本包新语法**被动语态高级**和**情态+完成体**已在各 Topic 的 Chunks 和对话中自然嵌入。',
  'topics-c6.json');

console.log('\n✓ C5-C6 generated');
