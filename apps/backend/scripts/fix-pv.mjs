const fs=require('fs'),path=require('path');
const d='c:/Users/z1309/Desktop/work/speakGuild/apps/backend/prisma/data/packages/course-phrasal-verbs';
const r={
  '动词短语 UP 篇':'动词短语·UP 篇',
  '动词短语 DOWN 篇':'动词短语·DOWN 篇',
  '动词短语 OUT 篇':'动词短语·OUT 篇',
  '动词短语 OFF 篇':'动词短语·OFF 篇',
  '动词短语 ON 篇':'动词短语·ON 篇',
  '动词短语 IN/OVER/BACK 篇':'动词短语·IN/OVER/BACK 篇',
  '动词搭配 MAKE/TAKE/HAVE/DO':'动词短语·MAKE/TAKE/HAVE/DO',
  '动词搭配 GET/KEEP/SET/COME':'动词短语·GET/KEEP/SET/COME',
};
for(const f of ['scene_vocabulary.csv','chunks.csv','sentence_patterns.csv']){
  const fp=path.join(d,f);
  let c=fs.readFileSync(fp,'utf-8'),m=false;
  for(const [o,n] of Object.entries(r)){
    if(c.includes(o)){c=c.split(o).join(n);m=true;console.log(f+': replaced "'+o+'"');}
  }
  if(m)fs.writeFileSync(fp,c);
}
console.log('Done');
