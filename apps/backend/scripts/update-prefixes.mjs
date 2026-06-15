import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pkgs = path.resolve(dir, '../prisma/data/packages');
const logF = path.resolve(dir, 'prefix-log.txt');

const PRE = {
  workplace:'职场',travel:'旅行',healthcare:'健康',academic:'雅思',
  campus:'校园','daily-social':'日常','study-abroad':'留学',
  'foundation-beginner':'基础','course-grammar':'语法','course-tenses':'时态',
  'course-linking':'连词','course-expressions':'表达','course-phrasal-verbs':'动词短语',
  'course-connectors':'连接词','course-adverbs':'副词','course-time':'时间','course-location':'方位',
};

function pc(l) {
  const r=[];let c='',q=false;
  for(let i=0;i<l.length;i++){
    const ch=l[i];
    if(ch==='"'){if(q&&i+1<l.length&&l[i+1]==='"'){c+='"';i++;}else q=!q;}
    else if(ch===','&&!q){r.push(c);c='';}else c+=ch;
  }
  r.push(c);return r;
}
function tc(v){if(!v)return '';if(v.includes(',')||v.includes('"')||v.includes('·'))return '"'+v.replace(/"/g,'""')+'"';return v;}
function fi(h,n){return h.map(h=>h.replace(/^"|"$/g,'')).indexOf(n);}

function rd(fp){
  try{
    const c=fs.readFileSync(fp,'utf-8').trim();
    if(!c)return null;
    const l=c.split('\n');
    return{h:pc(l[0]),r:l.slice(1).filter(x=>x.trim()).map(pc)};
  }catch(e){return null;}
}
function wr(fp,h,r){
  const l=[h.map(tc).join(',')];
  for(const w of r){if(w.every(x=>!x||!x.trim()))continue;l.push(w.map(tc).join(','));}
  fs.writeFileSync(fp,l.join('\n')+'\n');
}

function lg(m){fs.appendFileSync(logF,m+'\n');console.log(m);}

lg('=== START ===');

// Build map from scenes.csv for packages we already manually updated
const map = new Map();
for(const [pkg,pre] of Object.entries(PRE)){
  const sp = path.join(pkgs,pkg,'scenes.csv');
  if(!fs.existsSync(sp))continue;
  const d = rd(sp);if(!d)continue;
  const ti = fi(d.h,'title');if(ti<0)continue;
  for(const r of d.r){
    const t = (r[ti]||'').replace(/^"|"$/g,'');
    if(!t||!t.includes('·'))continue;
    // Extract old title by removing prefix
    const old = pre==='雅思' ? t.replace('雅思·','') : t.replace(pre+'·','');
    if(old!==t){map.set(old,t);lg(`  map: "${old}" → "${t}"`);}
  }
}
lg(`Map size: ${map.size}`);

// Update scene_title in all CSV files
const F = ['training_topics.csv','scene_vocabulary.csv','chunks.csv','sentence_patterns.csv','script_episodes.csv'];
const dirs = fs.readdirSync(pkgs).filter(d=>fs.statSync(path.join(pkgs,d)).isDirectory());

for(const pkg of dirs){
  for(const f of F){
    const fp = path.join(pkgs,pkg,f);
    if(!fs.existsSync(fp))continue;
    const d = rd(fp);if(!d)continue;
    const si = fi(d.h,'scene_title');
    const ti = fi(d.h,'title');
    let m=false;
    for(const r of d.r){
      if(si>=0){const v=(r[si]||'').replace(/^"|"$/g,'');const n=map.get(v);if(n){r[si]=n;m=true;}}
      if(ti>=0&&ti!==si){const v=(r[ti]||'').replace(/^"|"$/g,'');const n=map.get(v);if(n){r[ti]=n;m=true;}}
    }
    if(m){wr(fp,d.h,d.r);lg(`  OK ${pkg}/${f}`);}
  }
}

lg('=== DONE ===');
