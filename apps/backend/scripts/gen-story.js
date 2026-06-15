const fs=require('fs'),path=require('path');
const base='c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages';

// All story packages with their scene→topics mapping
const pkgs = {
  'story-history': {
    scenes: ['英国历史·从罗马到诺曼征服','英国历史·都铎王朝到工业革命','美国历史·独立与建国','美国历史·西进到民权运动'],
    topics: {
      '英国历史·从罗马到诺曼征服':['罗马不列颠','盎格鲁-撒克逊时代','维京人与诺曼征服'],
      '英国历史·都铎王朝到工业革命':['都铎王朝','英国内战与光荣革命','工业革命'],
      '美国历史·独立与建国':['美国独立战争','建国与宪法'],
      '美国历史·西进到民权运动':['西进运动与南北战争','工业时代与民权运动'],
    },
    prefix:'历史',
    epPrefix:'hist',
  },
  'story-fables': {
    scenes: ['伊索寓言·动物与智慧','伊索寓言·教训与反思'],
    topics: {
      '伊索寓言·动物与智慧':['龟兔赛跑','狐狸与葡萄','狼来了'],
      '伊索寓言·教训与反思':['蚂蚁和蚱蜢','乌鸦和水罐','牧童和狼与反思'],
    },
    prefix:'寓言',
    epPrefix:'fable',
  },
  'story-mythology': {
    scenes: ['希腊神话·诸神与英雄','希腊神话·特洛伊与奥德赛','北欧神话·诸神黄昏'],
    topics: {
      '希腊神话·诸神与英雄':['奥林匹斯众神','普罗米修斯与潘多拉','赫拉克勒斯十二任务'],
      '希腊神话·特洛伊与奥德赛':['特洛伊战争','奥德赛历险'],
      '北欧神话·诸神黄昏':['北欧诸神与创世','诸神黄昏与重生'],
    },
    prefix:'神话',
    epPrefix:'myth',
  },
  'story-culture': {
    scenes: ['英国文化·传统与现代','美国文化·节日与生活方式','全球文化·节日与习俗','现代文化·数字时代'],
    topics: {
      '英国文化·传统与现代':['王室与君主制','下午茶与美食文化','英国体育与娱乐'],
      '美国文化·节日与生活方式':['美国主要节日','美国流行文化'],
      '全球文化·节日与习俗':['亚洲文化与传统','世界各地的文化'],
      '现代文化·数字时代':['社交媒体与数字生活','当代社会议题'],
    },
    prefix:'文化',
    epPrefix:'cult',
  },
  'story-philosophy': {
    scenes: ['哲学·古希腊哲学','哲学·近现代哲学'],
    topics: {
      '哲学·古希腊哲学':['苏格拉底与问答法','柏拉图的理想国','亚里士多德的智慧'],
      '哲学·近现代哲学':['笛卡尔与理性主义','康德与道德哲学','尼采与存在主义'],
    },
    prefix:'哲学',
    epPrefix:'phil',
  },
  'story-tech': {
    scenes: ['科技·改变世界的发明','科技·数字革命与未来'],
    topics: {
      '科技·改变世界的发明':['印刷术与知识传播','蒸汽机与工业革命','电力与通信革命'],
      '科技·数字革命与未来':['计算机与互联网','人工智能与未来科技'],
    },
    prefix:'科技',
    epPrefix:'tech',
  },
  'story-medieval': {
    scenes: ['中世纪·骑士与城堡','中世纪·探险与传奇'],
    topics: {
      '中世纪·骑士与城堡':['骑士精神与受封','城堡攻防战','亚瑟王与圆桌骑士'],
      '中世纪·探险与传奇':['马可·波罗的东方之旅','维京航海家','中世纪的世界'],
    },
    prefix:'冒险',
    epPrefix:'med',
  },
};

function generateFiles(pkgName, pkg) {
  const dir = path.join(base, pkgName);
  fs.mkdirSync(path.join(dir,'ink-scripts'), {recursive:true});
  fs.writeFileSync(path.join(dir,'ink-scripts','.gitkeep'), '');

  // All scene×topic combinations
  const allRows = [];
  for(const sc of pkg.scenes){
    const tops = pkg.topics[sc];
    for(const tp of tops){
      allRows.push({scene:sc, topic:tp});
    }
  }

  // 1. scene_vocabulary.csv
  let sv = 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n';
  let idx=0;
  for(const r of allRows){
    sv += `${r.scene},${r.topic},keyword,关键词,noun,/kiːwɜːrd/,/kiːwɜːd/,L2,学习与${r.topic}相关的核心词汇。,"[{""en"":""This is an example sentence."",""zh"":""这是一个例句。""}]",${idx}\n`;
    idx++;
  }
  fs.writeFileSync(path.join(dir,'scene_vocabulary.csv'), sv);

  // 2. chunks.csv
  let ch = 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n';
  for(const r of allRows){
    ch += `${r.scene},${r.topic},${r.topic},Let me tell you about ${r.topic}.,让我给你讲讲${r.topic}。,L2,引入话题的标准表达。,"[{""en"":""Let me tell you about this topic."",""zh"":""让我给你讲讲这个话题。""}]"\n`;
  }
  fs.writeFileSync(path.join(dir,'chunks.csv'), ch);

  // 3. sentence_patterns.csv
  let sp = 'scene_title,topic_title,pattern,meaning,slots,example,difficulty,sort_order\n';
  for(let i=0;i<allRows.length;i++){
    const r=allRows[i];
    sp += `${r.scene},${r.topic},"Let me tell you about ___.",引入话题,"${r.topic}","Let me tell you about ${r.topic}.",L2,${i}\n`;
  }
  fs.writeFileSync(path.join(dir,'sentence_patterns.csv'), sp);

  // 4. script_episodes.csv
  let se = 'chapter_id,chapter_title,episode_order,title,scene_title,required_output_level,required_user_level,vocab_required_count,vocab_total_count,chunk_required_count,chunk_total_count,objectives_json,pass_objective_count,pass_chunk_count,pass_min_dialogues,npc_name,npc_role,is_preview,ink_script_key,rewards_json\n';
  let epOrder=0;
  for(const sc of pkg.scenes){
    const tops = pkg.topics[sc];
    const chId = `${pkg.epPrefix}_${epOrder}`;
    const chTitle = sc.split('·')[1] || sc;
    const isFirst = epOrder===0;
    se += `${chId},${chTitle},1,${tops[0]},${sc},L2,1,2,${tops.length},2,2,"[""学习${tops[0]}相关表达""]",2,2,2,Tutor,故事导师,${isFirst},,"{""xp"":20}"\n`;
    if(tops.length>1){
      const subTops = tops.slice(1);
      se += `${chId},${chTitle},2,${subTops[0]},${sc},L2,1,2,${subTops.length},2,2,"[""学习${subTops[0]}相关表达""]",2,2,2,Tutor,故事导师,false,,"{""xp"":20}"\n`;
    }
    epOrder++;
  }
  fs.writeFileSync(path.join(dir,'script_episodes.csv'), se);

  // 5. episode_chunks.csv
  let ec = 'episode_chapter,episode_order,chunk_text_match,sort_order\n';
  epOrder=0;
  for(const sc of pkg.scenes){
    const tops = pkg.topics[sc];
    const chId = `${pkg.epPrefix}_${epOrder}`;
    let sortOrd=0;
    for(const tp of tops){
      ec += `${chId},1,Let me tell you about ${tp}.,${sortOrd}\n`;
      sortOrd++;
    }
    epOrder++;
  }
  fs.writeFileSync(path.join(dir,'episode_chunks.csv'), ec);

  console.log(`✅ ${pkgName}: all files generated`);
}

for(const [name,pkg] of Object.entries(pkgs)){
  generateFiles(name,pkg);
}
console.log('ALL DONE');
