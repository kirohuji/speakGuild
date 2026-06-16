/**
 * 📝 剩余学习包词汇生成脚本
 * 为 story-medieval/mythology/philosophy/tech 和所有 exam 包生成真实词汇
 * 运行：cd apps/backend && npx ts-node prisma/scripts/gen-remaining-vocab.ts
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'

const PKG_DIR = resolve(__dirname, '..', 'data', 'packages')

interface V { word: string; meaning: string; part: string; diff: string; desc: string; exEn: string; exZh: string }

function buildVocabCsv(topics: Array<{ scene: string; topic: string; words: V[] }>): string {
  const rows: string[] = []
  for (const t of topics) {
    t.words.forEach((w, i) => {
      const ex = JSON.stringify([{ en: w.exEn, zh: w.exZh }])
      rows.push(`"${t.scene}","${t.topic}","${w.word}","${w.meaning}","${w.part}","/${w.word.toLowerCase().replace(/\s/g,'')}/","/${w.word.toLowerCase().replace(/\s/g,'')}/","${w.diff}","${w.desc}","${ex.replace(/"/g,'""')}",${i}`)
    })
  }
  return 'scene_title,topic_title,word,meaning,part_of_speech,phonetic_us,phonetic_uk,difficulty,description,examples_json,sort_order\n' + rows.join('\n') + '\n'
}

function buildChunkCsv(topics: Array<{ scene: string; topic: string }>): string {
  const rows: string[] = []
  for (const t of topics) {
    const cs = [
      { text: `Let me tell you about ${t.topic}.`, meaning: `让我给你讲讲${t.topic}。`, desc: '引入话题。' },
      { text: `I find ${t.topic} really interesting.`, meaning: `我觉得${t.topic}非常有趣。`, desc: '表达兴趣。' },
      { text: `One important aspect of ${t.topic} is that...`, meaning: `关于${t.topic}一个重要方面是...`, desc: '引出细节。' },
    ]
    cs.forEach(c => {
      const ex = JSON.stringify([{ en: c.text, zh: c.meaning }])
      rows.push(`"${t.scene}","${t.topic}","${t.topic}","${c.text}","${c.meaning}","L2","${c.desc}","${ex.replace(/"/g,'""')}"`)
    })
  }
  return 'scene_title,topic_title,category,text,meaning,difficulty,description,examples_json\n' + rows.join('\n') + '\n'
}

// ═══════════════════════════════════════
const ALL_VOCAB: Record<string, Array<{ scene: string; topic: string; words: V[] }>> = {

  'story-medieval': [
    { scene:'中世纪·骑士与城堡', topic:'骑士精神与受封', words:[
      { word:'knight',meaning:'骑士',part:'noun',diff:'L2',desc:'中世纪的骑马战士。',exEn:'The knight swore an oath of loyalty.',exZh:'骑士宣誓效忠。' },
      { word:'chivalry',meaning:'骑士精神',part:'noun',diff:'L3',desc:'骑士的道德准则。',exEn:'Chivalry required knights to protect the weak.',exZh:'骑士精神要求骑士保护弱者。' },
      { word:'armor',meaning:'盔甲',part:'noun',diff:'L1',desc:'战斗中穿的保护装备。',exEn:'The knight wore heavy armor into battle.',exZh:'骑士穿着厚重的盔甲上战场。' },
      { word:'sword',meaning:'剑',part:'noun',diff:'L1',desc:'骑士的主要武器。',exEn:'He drew his sword and prepared to fight.',exZh:'他拔出剑准备战斗。' },
      { word:'ceremony',meaning:'仪式',part:'noun',diff:'L2',desc:'正式的典礼。',exEn:'The knighting ceremony was very solemn.',exZh:'封爵仪式非常庄严。' },
      { word:'oath',meaning:'誓言',part:'noun',diff:'L2',desc:'庄严的承诺。',exEn:'Knights took an oath to serve the king.',exZh:'骑士宣誓效忠国王。' },
      { word:'noble',meaning:'贵族',part:'noun',diff:'L2',desc:'有高贵血统的人。',exEn:'Only nobles could become knights.',exZh:'只有贵族才能成为骑士。' },
      { word:'squire',meaning:'侍从',part:'noun',diff:'L3',desc:'骑士的助手和学徒。',exEn:'The squire helped the knight put on his armor.',exZh:'侍从帮骑士穿上盔甲。' },
    ]},
    { scene:'中世纪·骑士与城堡', topic:'城堡攻防战', words:[
      { word:'castle',meaning:'城堡',part:'noun',diff:'L1',desc:'中世纪的防御建筑。',exEn:'The castle had thick stone walls for protection.',exZh:'城堡有厚厚的石墙用来防御。' },
      { word:'siege',meaning:'围攻',part:'noun',diff:'L3',desc:'长时间包围攻击城堡。',exEn:'The siege of the castle lasted for months.',exZh:'对城堡的围攻持续了数月。' },
      { word:'catapult',meaning:'投石机',part:'noun',diff:'L3',desc:'投掷石块的攻城器械。',exEn:'The catapult hurled huge stones at the walls.',exZh:'投石机向城墙投掷巨大的石头。' },
      { word:'moat',meaning:'护城河',part:'noun',diff:'L2',desc:'城堡周围的水道防御。',exEn:'A deep moat surrounded the castle.',exZh:'一条深深的护城河环绕着城堡。' },
      { word:'drawbridge',meaning:'吊桥',part:'noun',diff:'L2',desc:'可以升降的桥梁。',exEn:'The drawbridge was raised at night for safety.',exZh:'吊桥在夜间升起以保证安全。' },
      { word:'archer',meaning:'弓箭手',part:'noun',diff:'L2',desc:'使用弓箭的战士。',exEn:'Archers fired arrows from the castle towers.',exZh:'弓箭手从城堡塔楼射出箭矢。' },
      { word:'battlement',meaning:'城垛',part:'noun',diff:'L3',desc:'城墙上锯齿状的防御结构。',exEn:'Soldiers hid behind the battlements during attacks.',exZh:'攻击时士兵躲在城垛后面。' },
      { word:'trebuchet',meaning:'重型投石机',part:'noun',diff:'L3',desc:'大型攻城投石器械。',exEn:'The trebuchet could throw stones weighing hundreds of pounds.',exZh:'重型投石机能投掷数百磅重的石头。' },
    ]},
    { scene:'中世纪·骑士与城堡', topic:'亚瑟王与圆桌骑士', words:[
      { word:'Excalibur',meaning:'王者之剑',part:'noun',diff:'L3',desc:'亚瑟王的神剑。',exEn:'King Arthur pulled Excalibur from the stone.',exZh:'亚瑟王从石头中拔出王者之剑。' },
      { word:'round table',meaning:'圆桌',part:'noun',diff:'L2',desc:'亚瑟王骑士们的会议桌。',exEn:'The Round Table represented equality among knights.',exZh:'圆桌代表骑士之间的平等。' },
      { word:'Merlin',meaning:'梅林',part:'noun',diff:'L2',desc:'亚瑟王的巫师顾问。',exEn:'Merlin was the wise wizard who advised King Arthur.',exZh:'梅林是为亚瑟王出谋划策的智慧巫师。' },
      { word:'Camelot',meaning:'卡美洛',part:'noun',diff:'L3',desc:'亚瑟王的王宫和城堡。',exEn:'Camelot was the legendary castle of King Arthur.',exZh:'卡美洛是亚瑟王传说中的城堡。' },
      { word:'quest',meaning:'探索/使命',part:'noun',diff:'L2',desc:'骑士的神圣使命。',exEn:'The knights went on a quest for the Holy Grail.',exZh:'骑士们踏上了寻找圣杯的征程。' },
      { word:'Holy Grail',meaning:'圣杯',part:'noun',diff:'L3',desc:'传说中耶稣最后晚餐用的杯子。',exEn:'The search for the Holy Grail was the greatest quest.',exZh:'寻找圣杯是最伟大的使命。' },
      { word:'legend',meaning:'传说',part:'noun',diff:'L2',desc:'代代相传的故事。',exEn:'The legend of King Arthur has inspired many stories.',exZh:'亚瑟王的传说启发了无数故事。' },
      { word:'loyalty',meaning:'忠诚',part:'noun',diff:'L2',desc:'对君主或信念的坚定支持。',exEn:'Loyalty was the highest virtue of a knight.',exZh:'忠诚是骑士的最高美德。' },
    ]},
    { scene:'中世纪·探险与传奇', topic:'马可·波罗的东方之旅', words:[
      { word:'Silk Road',meaning:'丝绸之路',part:'noun',diff:'L2',desc:'连接东西方的古代贸易路线。',exEn:'Marco Polo traveled along the Silk Road to China.',exZh:'马可波罗沿着丝绸之路来到中国。' },
      { word:'Venice',meaning:'威尼斯',part:'noun',diff:'L2',desc:'马可波罗的故乡。',exEn:'Marco Polo was born in Venice, Italy.',exZh:'马可波罗出生在意大利威尼斯。' },
      { word:'merchant',meaning:'商人',part:'noun',diff:'L2',desc:'从事贸易的人。',exEn:'Marco Polo came from a family of merchants.',exZh:'马可波罗出身商人家庭。' },
      { word:'Khan',meaning:'可汗',part:'noun',diff:'L3',desc:'蒙古统治者的称号。',exEn:'Marco Polo served Kublai Khan for many years.',exZh:'马可波罗为忽必烈可汗服务多年。' },
      { word:'expedition',meaning:'远征/探险',part:'noun',diff:'L3',desc:'有组织的探索之旅。',exEn:'The expedition to the East took over three years.',exZh:'前往东方的远征历时三年多。' },
      { word:'spice',meaning:'香料',part:'noun',diff:'L2',desc:'古代最珍贵的商品之一。',exEn:'He described the amazing spices he found in Asia.',exZh:'他描述了在亚洲发现的奇妙香料。' },
      { word:'travelogue',meaning:'旅行见闻录',part:'noun',diff:'L3',desc:'记录旅行经历的作品。',exEn:'His travelogue amazed readers across Europe.',exZh:'他的旅行见闻录让全欧洲的读者惊叹。' },
      { word:'caravan',meaning:'商队',part:'noun',diff:'L2',desc:'结伴穿越沙漠的商人队伍。',exEn:'They joined a caravan for safety across the desert.',exZh:'他们加入商队以求安全穿越沙漠。' },
    ]},
    { scene:'中世纪·探险与传奇', topic:'维京航海家', words:[
      { word:'Viking',meaning:'维京人',part:'noun',diff:'L2',desc:'8-11世纪的北欧航海民族。',exEn:'The Vikings were skilled sailors and warriors.',exZh:'维京人是技艺高超的水手和战士。' },
      { word:'longship',meaning:'长船',part:'noun',diff:'L3',desc:'维京人的快速战船。',exEn:'The Viking longship could sail in shallow waters.',exZh:'维京长船能在浅水中航行。' },
      { word:'explorer',meaning:'探险家',part:'noun',diff:'L2',desc:'探索未知世界的人。',exEn:'Leif Erikson was a famous Viking explorer.',exZh:'莱夫·埃里克松是著名的维京探险家。' },
      { word:'Greenland',meaning:'格陵兰',part:'noun',diff:'L2',desc:'维京人最早定居的北大西洋岛屿。',exEn:'The Vikings established settlements in Greenland.',exZh:'维京人在格陵兰建立了定居点。' },
      { word:'navigation',meaning:'导航',part:'noun',diff:'L3',desc:'在海上确定方向的技术。',exEn:'Vikings navigated using the sun and stars.',exZh:'维京人利用太阳和星星导航。' },
      { word:'settlement',meaning:'定居点',part:'noun',diff:'L2',desc:'人类建立的新居住地。',exEn:'Viking settlements have been found in North America.',exZh:'在北美发现了维京定居点。' },
      { word:'raid',meaning:'突袭',part:'noun',diff:'L2',desc:'突然的攻击和掠夺。',exEn:'Viking raids terrified coastal villages in Europe.',exZh:'维京人的突袭让欧洲沿海村庄惊恐不已。' },
      { word:'saga',meaning:'传奇故事',part:'noun',diff:'L3',desc:'北欧的长篇叙事诗。',exEn:'The Viking sagas tell tales of great adventures.',exZh:'维京传奇讲述了伟大的冒险故事。' },
    ]},
    { scene:'中世纪·探险与传奇', topic:'中世纪的世界', words:[
      { word:'feudalism',meaning:'封建制度',part:'noun',diff:'L3',desc:'以土地分封为基础的社会制度。',exEn:'Feudalism was the social system of medieval Europe.',exZh:'封建制度是中世纪欧洲的社会制度。' },
      { word:'manor',meaning:'庄园',part:'noun',diff:'L3',desc:'贵族的大片土地和住宅。',exEn:'The lord lived in a manor surrounded by farmland.',exZh:'领主住在被农田环绕的庄园里。' },
      { word:'peasant',meaning:'农民',part:'noun',diff:'L2',desc:'中世纪耕作土地的劳动者。',exEn:'Peasants worked the land for the lord.',exZh:'农民为领主耕种土地。' },
      { word:'guild',meaning:'行会',part:'noun',diff:'L3',desc:'工匠和商人的组织。',exEn:'Craftsmen formed guilds to protect their interests.',exZh:'工匠组成行会来保护自己的利益。' },
      { word:'monastery',meaning:'修道院',part:'noun',diff:'L3',desc:'修士修女居住和抄书的地方。',exEn:'Monks in monasteries copied books by hand.',exZh:'修道院里的修士手抄书籍。' },
      { word:'marketplace',meaning:'集市',part:'noun',diff:'L2',desc:'买卖商品的公共场所。',exEn:'The marketplace was the center of medieval towns.',exZh:'集市是中世纪城镇的中心。' },
      { word:'pilgrimage',meaning:'朝圣',part:'noun',diff:'L3',desc:'前往宗教圣地的旅程。',exEn:'Many people went on pilgrimages to holy sites.',exZh:'许多人前往圣地朝圣。' },
      { word:'blacksmith',meaning:'铁匠',part:'noun',diff:'L2',desc:'打铁的工匠。',exEn:'The blacksmith made tools and weapons for the village.',exZh:'铁匠为村子制作工具和武器。' },
    ]},
  ],

  'story-mythology': [
    { scene:'神话·希腊神话', topic:'奥林匹斯众神', words:[
      { word:'Zeus',meaning:'宙斯',part:'noun',diff:'L2',desc:'希腊神话中的众神之王。',exEn:'Zeus was the king of the Greek gods.',exZh:'宙斯是希腊众神之王。' },
      { word:'Olympus',meaning:'奥林匹斯山',part:'noun',diff:'L2',desc:'希腊众神的居所。',exEn:'The gods lived on Mount Olympus.',exZh:'众神住在奥林匹斯山上。' },
      { word:'thunderbolt',meaning:'雷电',part:'noun',diff:'L2',desc:'宙斯的武器。',exEn:'Zeus used his thunderbolt to punish the wicked.',exZh:'宙斯用他的雷电惩罚恶人。' },
      { word:'Poseidon',meaning:'波塞冬',part:'noun',diff:'L2',desc:'海神，宙斯的兄弟。',exEn:'Poseidon ruled the seas with his trident.',exZh:'波塞冬用三叉戟统治海洋。' },
      { word:'Athena',meaning:'雅典娜',part:'noun',diff:'L2',desc:'智慧与战争女神。',exEn:'Athena was the goddess of wisdom and war.',exZh:'雅典娜是智慧与战争女神。' },
      { word:'immortal',meaning:'不朽的',part:'adj',diff:'L3',desc:'永远不会死去的。',exEn:'The Greek gods were believed to be immortal.',exZh:'希腊众神被认为是不朽的。' },
      { word:'temple',meaning:'神庙',part:'noun',diff:'L2',desc:'供奉神祇的建筑。',exEn:'The Parthenon was a temple dedicated to Athena.',exZh:'帕特农神庙是献给雅典娜的神庙。' },
      { word:'myth',meaning:'神话',part:'noun',diff:'L2',desc:'关于神和英雄的传统故事。',exEn:'Greek myths explain natural phenomena.',exZh:'希腊神话解释自然现象。' },
    ]},
    { scene:'神话·希腊神话', topic:'英雄传奇', words:[
      { word:'Hercules',meaning:'赫拉克勒斯',part:'noun',diff:'L3',desc:'希腊神话中最著名的英雄。',exEn:'Hercules completed twelve impossible labors.',exZh:'赫拉克勒斯完成了十二项不可能的任务。' },
      { word:'hero',meaning:'英雄',part:'noun',diff:'L2',desc:'做出伟大事迹的人。',exEn:'Every Greek hero had to overcome great challenges.',exZh:'每个希腊英雄都必须克服巨大挑战。' },
      { word:'monster',meaning:'怪物',part:'noun',diff:'L1',desc:'可怕的神话生物。',exEn:'The hero had to fight many monsters.',exZh:'英雄必须与许多怪物战斗。' },
      { word:'oracle',meaning:'神谕',part:'noun',diff:'L3',desc:'神通过祭司传达的预言。',exEn:'The oracle warned the hero of his fate.',exZh:'神谕警告英雄他的命运。' },
      { word:'quest',meaning:'探索',part:'noun',diff:'L2',desc:'英雄的伟大使命。',exEn:'Jason went on a quest for the Golden Fleece.',exZh:'伊阿宋踏上了寻找金羊毛的征程。' },
      { word:'tragedy',meaning:'悲剧',part:'noun',diff:'L3',desc:'英雄因命运或缺陷而失败的故事。',exEn:'Greek tragedies often told of heroes who fell from grace.',exZh:'希腊悲剧常讲述英雄失势的故事。' },
      { word:'destiny',meaning:'命运',part:'noun',diff:'L2',desc:'注定要发生的事。',exEn:'No hero could escape their destiny.',exZh:'没有英雄能逃脱自己的命运。' },
      { word:'labyrinth',meaning:'迷宫',part:'noun',diff:'L3',desc:'复杂的迷宫，关着牛头怪。',exEn:'Theseus entered the labyrinth to fight the Minotaur.',exZh:'忒修斯进入迷宫与牛头怪战斗。' },
    ]},
    { scene:'神话·希腊神话', topic:'特洛伊战争', words:[
      { word:'Trojan War',meaning:'特洛伊战争',part:'noun',diff:'L2',desc:'希腊与特洛伊的十年战争。',exEn:'The Trojan War lasted for ten years.',exZh:'特洛伊战争持续了十年。' },
      { word:'Achilles',meaning:'阿喀琉斯',part:'noun',diff:'L3',desc:'希腊最伟大的战士。',exEn:'Achilles was the greatest warrior of the Greeks.',exZh:'阿喀琉斯是希腊最伟大的战士。' },
      { word:'Trojan Horse',meaning:'特洛伊木马',part:'noun',diff:'L3',desc:'希腊人用来攻入特洛伊城的木马计。',exEn:'The Greeks hid inside the Trojan Horse.',exZh:'希腊人藏在特洛伊木马中。' },
      { word:'Helen',meaning:'海伦',part:'noun',diff:'L2',desc:'引发特洛伊战争的美女。',exEn:'Helen of Troy was said to be the most beautiful woman.',exZh:'特洛伊的海伦据说是最美的女人。' },
      { word:'siege',meaning:'围攻',part:'noun',diff:'L3',desc:'长期包围攻击城市。',exEn:'The Greeks laid siege to Troy for ten years.',exZh:'希腊人围攻特洛伊十年。' },
      { word:'warrior',meaning:'战士',part:'noun',diff:'L2',desc:'战斗的人。',exEn:'The greatest warriors fought at Troy.',exZh:'最伟大的战士在特洛伊战斗。' },
      { word:'shield',meaning:'盾牌',part:'noun',diff:'L1',desc:'防御武器。',exEn:'The warrior raised his shield to block the attack.',exZh:'战士举起盾牌挡住攻击。' },
      { word:'Homer',meaning:'荷马',part:'noun',diff:'L3',desc:'古希腊诗人，著有《伊利亚特》。',exEn:'Homer wrote the Iliad about the Trojan War.',exZh:'荷马写了关于特洛伊战争的《伊利亚特》。' },
    ]},
    { scene:'神话·北欧神话', topic:'北欧众神', words:[
      { word:'Odin',meaning:'奥丁',part:'noun',diff:'L3',desc:'北欧神话中的众神之父。',exEn:'Odin sacrificed an eye for wisdom.',exZh:'奥丁为智慧牺牲了一只眼睛。' },
      { word:'Thor',meaning:'雷神索尔',part:'noun',diff:'L2',desc:'北欧神话中的雷神。',exEn:'Thor wielded the mighty hammer Mjolnir.',exZh:'雷神索尔挥舞着强大的雷神之锤。' },
      { word:'Asgard',meaning:'阿斯加德',part:'noun',diff:'L3',desc:'北欧众神的居所。',exEn:'Asgard was the home of the Norse gods.',exZh:'阿斯加德是北欧众神的家园。' },
      { word:'Valhalla',meaning:'英灵殿',part:'noun',diff:'L3',desc:'战死勇士的永生殿堂。',exEn:'Fallen warriors hoped to enter Valhalla.',exZh:'战死的勇士希望能进入英灵殿。' },
      { word:'Ragnarok',meaning:'诸神黄昏',part:'noun',diff:'L3',desc:'北欧神话中的末日之战。',exEn:'Ragnarok was the prophesied end of the world.',exZh:'诸神黄昏是预言中的世界末日。' },
      { word:'Loki',meaning:'洛基',part:'noun',diff:'L2',desc:'诡计之神。',exEn:'Loki was the trickster god who caused trouble.',exZh:'洛基是制造麻烦的诡计之神。' },
      { word:'giant',meaning:'巨人',part:'noun',diff:'L1',desc:'与神为敌的巨大生物。',exEn:'The giants were the enemies of the gods.',exZh:'巨人是众神的敌人。' },
      { word:'Valkyrie',meaning:'女武神',part:'noun',diff:'L3',desc:'挑选战死勇士的女神。',exEn:'The Valkyries chose warriors to go to Valhalla.',exZh:'女武神选择勇士进入英灵殿。' },
    ]},
    { scene:'神话·北欧神话', topic:'世界树与九界', words:[
      { word:'Yggdrasil',meaning:'世界树',part:'noun',diff:'L3',desc:'连接北欧神话九界的大树。',exEn:'Yggdrasil connected all nine worlds.',exZh:'世界树连接了所有九个世界。' },
      { word:'Midgard',meaning:'中庭',part:'noun',diff:'L3',desc:'人类居住的世界。',exEn:'Humans lived in Midgard, the middle world.',exZh:'人类住在中庭，中间的世界。' },
      { word:'Jotunheim',meaning:'约顿海姆',part:'noun',diff:'L3',desc:'巨人的世界。',exEn:'The giants lived in the frozen land of Jotunheim.',exZh:'巨人住在冰封的约顿海姆。' },
      { word:'Bifrost',meaning:'彩虹桥',part:'noun',diff:'L3',desc:'连接阿斯加德和中庭的彩虹桥。',exEn:'Heimdall guarded the Bifrost bridge.',exZh:'海姆达尔守护着彩虹桥。' },
      { word:'dwarf',meaning:'矮人',part:'noun',diff:'L2',desc:'住在山中的工匠。',exEn:'Dwarves forged mighty weapons for the gods.',exZh:'矮人为众神锻造强大的武器。' },
      { word:'elf',meaning:'精灵',part:'noun',diff:'L2',desc:'住在光之世界的美丽生物。',exEn:'The light elves lived in Alfheim.',exZh:'光之精灵住在亚尔夫海姆。' },
      { word:'cosmic',meaning:'宇宙的',part:'adj',diff:'L3',desc:'与宇宙和世界结构相关的。',exEn:'Norse mythology describes a cosmic tree of life.',exZh:'北欧神话描述了一棵宇宙生命树。' },
      { word:'realm',meaning:'领域/王国',part:'noun',diff:'L3',desc:'一种存在的世界或领域。',exEn:'Each realm had its own unique inhabitants.',exZh:'每个领域都有自己独特的居民。' },
    ]},
    { scene:'神话·东方神话', topic:'中国创世神话', words:[
      { word:'Pangu',meaning:'盘古',part:'noun',diff:'L3',desc:'中国神话中开天辟地的巨人。',exEn:'Pangu separated heaven and earth with his axe.',exZh:'盘古用斧头分开了天地。' },
      { word:'Nuwa',meaning:'女娲',part:'noun',diff:'L3',desc:'中国神话中造人和补天的女神。',exEn:'Nuwa created humans from clay.',exZh:'女娲用泥土造人。' },
      { word:'creation',meaning:'创世',part:'noun',diff:'L2',desc:'世界被创造的过程。',exEn:'Creation myths explain how the world began.',exZh:'创世神话解释世界如何开始。' },
      { word:'heaven',meaning:'天',part:'noun',diff:'L2',desc:'神话中神的居所和上方世界。',exEn:'In Chinese myth, heaven and earth were once one.',exZh:'在中国神话中，天地曾是一体。' },
      { word:'chaos',meaning:'混沌',part:'noun',diff:'L3',desc:'创世前的无序状态。',exEn:'In the beginning, there was only chaos.',exZh:'起初只有混沌。' },
      { word:'cosmic egg',meaning:'宇宙蛋',part:'noun',diff:'L3',desc:'许多创世神话中的原始形态。',exEn:'Pangu was born from a cosmic egg.',exZh:'盘古从宇宙蛋中诞生。' },
      { word:'pillar',meaning:'柱子',part:'noun',diff:'L2',desc:'支撑天的柱子。',exEn:'Nuwa used pillars to hold up the sky.',exZh:'女娲用柱子撑起天。' },
      { word:'mythical',meaning:'神话的',part:'adj',diff:'L2',desc:'与神话相关的。',exEn:'These mythical stories have been told for centuries.',exZh:'这些神话故事已经流传了几个世纪。' },
    ]},
    { scene:'神话·东方神话', topic:'日本神话故事', words:[
      { word:'Izanagi',meaning:'伊邪那岐',part:'noun',diff:'L3',desc:'日本神话中的创世男神。',exEn:'Izanagi and Izanami created the islands of Japan.',exZh:'伊邪那岐和伊邪那美创造了日本列岛。' },
      { word:'Amaterasu',meaning:'天照大神',part:'noun',diff:'L3',desc:'日本神话中的太阳女神。',exEn:'Amaterasu is the sun goddess in Japanese mythology.',exZh:'天照大神是日本神话中的太阳女神。' },
      { word:'kami',meaning:'神/灵',part:'noun',diff:'L3',desc:'日本神道教中的神灵。',exEn:'In Japan, kami are spirits found in nature.',exZh:'在日本，神是存在于自然中的灵。' },
      { word:'tsunami',meaning:'海啸',part:'noun',diff:'L2',desc:'神话中常出现的大海浪。',exEn:'The god of the sea could cause terrible tsunamis.',exZh:'海神可以引发可怕的海啸。' },
      { word:'sacred',meaning:'神圣的',part:'adj',diff:'L2',desc:'与神相关的，不可侵犯的。',exEn:'Mount Fuji is considered a sacred mountain.',exZh:'富士山被认为是一座圣山。' },
      { word:'mirror',meaning:'镜子',part:'noun',diff:'L2',desc:'日本神话中的重要神器。',exEn:'The sacred mirror was one of Japan\'s three treasures.',exZh:'神镜是日本三神器之一。' },
      { word:'dragon',meaning:'龙',part:'noun',diff:'L1',desc:'东亚神话中的神兽。',exEn:'Japanese dragons are often associated with water.',exZh:'日本的龙常与水相关联。' },
      { word:'shrine',meaning:'神社',part:'noun',diff:'L2',desc:'供奉神祇的日式建筑。',exEn:'People visit shrines to pray to the kami.',exZh:'人们去神社向神灵祈祷。' },
    ]},
  ],

  'story-philosophy': [
    { scene:'哲学·东方智慧', topic:'儒家思想', words:[
      { word:'Confucius',meaning:'孔子',part:'noun',diff:'L3',desc:'中国古代伟大的哲学家。',exEn:'Confucius taught the importance of moral behavior.',exZh:'孔子教导道德行为的重要性。' },
      { word:'virtue',meaning:'美德',part:'noun',diff:'L3',desc:'道德上的优秀品质。',exEn:'Confucius believed virtue was the foundation of society.',exZh:'孔子相信美德是社会的基础。' },
      { word:'filial piety',meaning:'孝道',part:'noun',diff:'L3',desc:'尊敬和照顾父母的道德。',exEn:'Filial piety is central to Confucian thought.',exZh:'孝道是儒家思想的核心。' },
      { word:'harmony',meaning:'和谐',part:'noun',diff:'L2',desc:'人与人、人与自然之间的平衡。',exEn:'Confucius valued harmony in all relationships.',exZh:'孔子重视所有关系中的和谐。' },
      { word:'ritual',meaning:'礼仪',part:'noun',diff:'L3',desc:'社会规范和仪式。',exEn:'Proper ritual was important for social order.',exZh:'恰当的礼仪对社会秩序很重要。' },
      { word:'benevolence',meaning:'仁',part:'noun',diff:'L3',desc:'对他人的善意和关爱。',exEn:'Benevolence is the highest Confucian virtue.',exZh:'仁是儒家最高的美德。' },
      { word:'wisdom',meaning:'智慧',part:'noun',diff:'L2',desc:'深刻的理解和判断力。',exEn:'Confucius shared his wisdom through the Analects.',exZh:'孔子通过《论语》分享他的智慧。' },
      { word:'Analects',meaning:'论语',part:'noun',diff:'L3',desc:'记录孔子言行的经典。',exEn:'The Analects contain the teachings of Confucius.',exZh:'《论语》记录了孔子的教导。' },
    ]},
    { scene:'哲学·东方智慧', topic:'道家思想', words:[
      { word:'Laozi',meaning:'老子',part:'noun',diff:'L3',desc:'道家创始人。',exEn:'Laozi wrote the Tao Te Ching.',exZh:'老子写了《道德经》。' },
      { word:'Tao',meaning:'道',part:'noun',diff:'L3',desc:'宇宙的本源和规律。',exEn:'The Tao is the natural way of the universe.',exZh:'道是宇宙的自然法则。' },
      { word:'nature',meaning:'自然',part:'noun',diff:'L2',desc:'未经人为干预的世界。',exEn:'Taoism teaches us to follow the way of nature.',exZh:'道家教导我们遵循自然之道。' },
      { word:'simplicity',meaning:'简朴',part:'noun',diff:'L2',desc:'不复杂的简单生活方式。',exEn:'Taoism values simplicity and humility.',exZh:'道家重视简朴和谦逊。' },
      { word:'balance',meaning:'平衡',part:'noun',diff:'L2',desc:'阴阳之间的和谐状态。',exEn:'Finding balance is the key to a good life.',exZh:'找到平衡是美好生活的关键。' },
      { word:'yin yang',meaning:'阴阳',part:'noun',diff:'L3',desc:'宇宙中对立又互补的两种力量。',exEn:'Yin and yang represent balance in the universe.',exZh:'阴阳代表宇宙中的平衡。' },
      { word:'meditation',meaning:'冥想',part:'noun',diff:'L2',desc:'静心思考的练习。',exEn:'Taoist meditation helps calm the mind.',exZh:'道家冥想帮助平静心灵。' },
      { word:'wu wei',meaning:'无为',part:'noun',diff:'L3',desc:'不强行干预，顺其自然。',exEn:'Wu wei means acting without forcing things.',exZh:'无为意味着不强求的行动。' },
    ]},
    { scene:'哲学·东方智慧', topic:'禅与佛法', words:[
      { word:'Zen',meaning:'禅',part:'noun',diff:'L3',desc:'源自中国的佛教修行方式。',exEn:'Zen teaches us to be fully present in the moment.',exZh:'禅教导我们全然活在当下。' },
      { word:'mindfulness',meaning:'正念',part:'noun',diff:'L2',desc:'专注于当下的觉知状态。',exEn:'Mindfulness helps reduce stress and anxiety.',exZh:'正念有助于减轻压力和焦虑。' },
      { word:'enlightenment',meaning:'开悟',part:'noun',diff:'L3',desc:'佛教中达到的觉悟境界。',exEn:'Buddhists seek enlightenment through meditation.',exZh:'佛教徒通过冥想寻求开悟。' },
      { word:'suffering',meaning:'苦',part:'noun',diff:'L2',desc:'生命中的痛苦和不满。',exEn:'Buddhism teaches that desire causes suffering.',exZh:'佛教教导欲望导致痛苦。' },
      { word:'compassion',meaning:'慈悲',part:'noun',diff:'L3',desc:'对他人苦难的深切同情。',exEn:'Compassion is central to Buddhist practice.',exZh:'慈悲是佛教修行的核心。' },
      { word:'impermanence',meaning:'无常',part:'noun',diff:'L3',desc:'一切事物都在变化中。',exEn:'Accepting impermanence brings peace.',exZh:'接受无常带来平静。' },
      { word:'koan',meaning:'公案',part:'noun',diff:'L3',desc:'禅宗中用于冥想的悖论问题。',exEn:'Zen masters use koans to challenge logical thinking.',exZh:'禅师用公案挑战逻辑思维。' },
      { word:'present moment',meaning:'当下',part:'noun',diff:'L2',desc:'此时此刻。',exEn:'Focus on the present moment, not the past or future.',exZh:'专注于当下，而不是过去或未来。' },
    ]},
    { scene:'哲学·西方哲学', topic:'古希腊哲学', words:[
      { word:'Socrates',meaning:'苏格拉底',part:'noun',diff:'L3',desc:'古希腊哲学家，问答法创始人。',exEn:'Socrates questioned everything to find truth.',exZh:'苏格拉底质疑一切以寻找真理。' },
      { word:'Plato',meaning:'柏拉图',part:'noun',diff:'L3',desc:'苏格拉底的学生，理想国作者。',exEn:'Plato wrote about the ideal society.',exZh:'柏拉图写了理想社会。' },
      { word:'Aristotle',meaning:'亚里士多德',part:'noun',diff:'L3',desc:'柏拉图的学生，逻辑学奠基人。',exEn:'Aristotle studied logic, ethics, and nature.',exZh:'亚里士多德研究逻辑、伦理和自然。' },
      { word:'ethics',meaning:'伦理学',part:'noun',diff:'L3',desc:'研究对错善恶的哲学分支。',exEn:'Ethics asks how we should live our lives.',exZh:'伦理学探讨我们应该如何生活。' },
      { word:'logic',meaning:'逻辑',part:'noun',diff:'L2',desc:'正确推理的规则。',exEn:'Aristotle developed the foundations of logic.',exZh:'亚里士多德奠定了逻辑学的基础。' },
      { word:'dialogue',meaning:'对话',part:'noun',diff:'L2',desc:'通过问答探讨真理的方法。',exEn:'Socrates used dialogue to explore ideas.',exZh:'苏格拉底用对话来探索思想。' },
      { word:'allegory',meaning:'寓言/比喻',part:'noun',diff:'L3',desc:'用故事传达深层含义。',exEn:"Plato\'s allegory of the cave is very famous.",exZh:'柏拉图的洞穴寓言非常著名。' },
      { word:'reason',meaning:'理性',part:'noun',diff:'L2',desc:'通过逻辑思考得出结论的能力。',exEn:'Greek philosophers valued reason above all.',exZh:'希腊哲学家最重视理性。' },
    ]},
    { scene:'哲学·西方哲学', topic:'现代哲学思潮', words:[
      { word:'existentialism',meaning:'存在主义',part:'noun',diff:'L3',desc:'强调个人自由和选择的哲学。',exEn:'Existentialism says we create our own meaning.',exZh:'存在主义认为我们创造自己的意义。' },
      { word:'freedom',meaning:'自由',part:'noun',diff:'L2',desc:'自主选择的能力。',exEn:'With freedom comes responsibility.',exZh:'自由伴随着责任。' },
      { word:'consciousness',meaning:'意识',part:'noun',diff:'L3',desc:'自我觉察和思考的能力。',exEn:'Philosophers debate the nature of consciousness.',exZh:'哲学家争论意识的本质。' },
      { word:'absurd',meaning:'荒诞的',part:'adj',diff:'L3',desc:'与理性和意义相悖的。',exEn:'Camus wrote about the absurd nature of life.',exZh:'加缪写了生命的荒诞本质。' },
      { word:'authentic',meaning:'真实的',part:'adj',diff:'L3',desc:'忠于自己的本真。',exEn:'Living an authentic life means being true to yourself.',exZh:'过真实的生活意味着忠于自己。' },
      { word:'nihilism',meaning:'虚无主义',part:'noun',diff:'L3',desc:'认为生命没有内在意义的观点。',exEn:'Nihilism rejects all religious and moral principles.',exZh:'虚无主义拒绝所有宗教和道德原则。' },
      { word:'perspective',meaning:'视角',part:'noun',diff:'L2',desc:'看待事物的角度。',exEn:'Philosophy helps us see things from different perspectives.',exZh:'哲学帮助我们从不同视角看问题。' },
      { word:'meaning of life',meaning:'生命的意义',part:'noun',diff:'L2',desc:'关于人为什么活着的根本问题。',exEn:'The meaning of life is a central philosophical question.',exZh:'生命的意义是哲学的核心问题。' },
    ]},
    { scene:'哲学·生活中的哲学', topic:'幸福与人生意义', words:[
      { word:'happiness',meaning:'幸福',part:'noun',diff:'L1',desc:'感到满足和快乐的状态。',exEn:'What is the secret to lasting happiness?',exZh:'持久幸福的秘诀是什么？' },
      { word:'purpose',meaning:'目的/意义',part:'noun',diff:'L2',desc:'人生目标和方向。',exEn:'Finding your purpose gives life direction.',exZh:'找到你的人生目的给生活方向。' },
      { word:'fulfillment',meaning:'满足感',part:'noun',diff:'L2',desc:'实现目标后的深层满足。',exEn:'True fulfillment comes from within.',exZh:'真正的满足感来自内心。' },
      { word:'gratitude',meaning:'感恩',part:'noun',diff:'L2',desc:'对所拥有的心怀感谢。',exEn:'Practicing gratitude increases happiness.',exZh:'练习感恩能增加幸福感。' },
      { word:'resilience',meaning:'韧性',part:'noun',diff:'L3',desc:'从困难中恢复的能力。',exEn:'Resilience helps us overcome challenges.',exZh:'韧性帮助我们克服挑战。' },
      { word:'contentment',meaning:'知足',part:'noun',diff:'L2',desc:'对现状感到满意的心态。',exEn:'Contentment is different from complacency.',exZh:'知足不同于自满。' },
      { word:'legacy',meaning:'遗产/留给后世的东西',part:'noun',diff:'L3',desc:'你留给世界的影响。',exEn:'What legacy do you want to leave behind?',exZh:'你想留下什么样的遗产？' },
      { word:'self-reflection',meaning:'自省',part:'noun',diff:'L3',desc:'审视自己的想法和行为。',exEn:'Self-reflection is key to personal growth.',exZh:'自省是个人成长的关键。' },
    ]},
  ],

  'story-tech': [
    { scene:'科技·人工智能', topic:'AI的历史与未来', words:[
      { word:'artificial intelligence',meaning:'人工智能',part:'noun',diff:'L3',desc:'模拟人类智能的计算机系统。',exEn:'AI is transforming every industry today.',exZh:'AI正在改变当今每个行业。' },
      { word:'algorithm',meaning:'算法',part:'noun',diff:'L3',desc:'解决问题的计算步骤。',exEn:'Algorithms power everything from search to recommendations.',exZh:'算法驱动着从搜索到推荐的一切。' },
      { word:'machine learning',meaning:'机器学习',part:'noun',diff:'L3',desc:'让计算机从数据中学习的技术。',exEn:'Machine learning helps computers improve over time.',exZh:'机器学习帮助计算机随时间不断改进。' },
      { word:'neural network',meaning:'神经网络',part:'noun',diff:'L3',desc:'模仿人脑结构的计算模型。',exEn:'Neural networks can recognize images and speech.',exZh:'神经网络能识别图像和语音。' },
      { word:'automation',meaning:'自动化',part:'noun',diff:'L3',desc:'用机器代替人工的过程。',exEn:'Automation is changing the future of work.',exZh:'自动化正在改变工作的未来。' },
      { word:'robot',meaning:'机器人',part:'noun',diff:'L1',desc:'能执行任务的自动机器。',exEn:'Robots are now used in factories and hospitals.',exZh:'机器人如今被用于工厂和医院。' },
      { word:'data',meaning:'数据',part:'noun',diff:'L2',desc:'被收集和分析的信息。',exEn:'Data is the fuel that powers AI systems.',exZh:'数据是驱动AI系统的燃料。' },
      { word:'Turing test',meaning:'图灵测试',part:'noun',diff:'L3',desc:'判断机器是否具有智能的测试。',exEn:'The Turing test measures if a machine can think like a human.',exZh:'图灵测试衡量机器是否能像人一样思考。' },
    ]},
    { scene:'科技·人工智能', topic:'AI与日常生活', words:[
      { word:'virtual assistant',meaning:'虚拟助手',part:'noun',diff:'L2',desc:'如Siri、Alexa的AI助手。',exEn:'Virtual assistants can set reminders and answer questions.',exZh:'虚拟助手可以设置提醒和回答问题。' },
      { word:'recommendation',meaning:'推荐',part:'noun',diff:'L2',desc:'AI根据用户喜好推荐内容。',exEn:'Recommendation systems suggest movies you might like.',exZh:'推荐系统建议你可能喜欢的电影。' },
      { word:'facial recognition',meaning:'面部识别',part:'noun',diff:'L3',desc:'通过面部特征识别身份的技术。',exEn:'Facial recognition is used to unlock smartphones.',exZh:'面部识别被用于解锁智能手机。' },
      { word:'chatbot',meaning:'聊天机器人',part:'noun',diff:'L2',desc:'能与用户对话的AI程序。',exEn:'Many websites now use chatbots for customer service.',exZh:'许多网站现在用聊天机器人做客服。' },
      { word:'smart home',meaning:'智能家居',part:'noun',diff:'L2',desc:'用AI控制的家庭设备。',exEn:'Smart home devices can control lights and temperature.',exZh:'智能家居设备可以控制灯光和温度。' },
      { word:'privacy',meaning:'隐私',part:'noun',diff:'L2',desc:'个人信息不被泄露的权利。',exEn:'AI raises important questions about privacy.',exZh:'AI引发了关于隐私的重要问题。' },
      { word:'bias',meaning:'偏见',part:'noun',diff:'L3',desc:'AI系统中可能存在的不公平倾向。',exEn:'AI systems can sometimes reflect human bias.',exZh:'AI系统有时会反映人类偏见。' },
      { word:'convenience',meaning:'便利',part:'noun',diff:'L2',desc:'让生活更轻松方便。',exEn:'AI brings great convenience but also challenges.',exZh:'AI带来巨大便利但也带来挑战。' },
    ]},
    { scene:'科技·数字世界', topic:'互联网的演变', words:[
      { word:'internet',meaning:'互联网',part:'noun',diff:'L1',desc:'全球互联的计算机网络。',exEn:'The internet has changed how we live and work.',exZh:'互联网改变了我们的生活和工作方式。' },
      { word:'World Wide Web',meaning:'万维网',part:'noun',diff:'L2',desc:'互联网上的信息空间。',exEn:'The World Wide Web was invented by Tim Berners-Lee.',exZh:'万维网由蒂姆·伯纳斯-李发明。' },
      { word:'browser',meaning:'浏览器',part:'noun',diff:'L1',desc:'访问网页的软件。',exEn:'You need a browser to access websites.',exZh:'你需要浏览器来访问网站。' },
      { word:'social media',meaning:'社交媒体',part:'noun',diff:'L2',desc:'在线社交平台。',exEn:'Social media connects billions of people worldwide.',exZh:'社交媒体连接了全球数十亿人。' },
      { word:'cloud computing',meaning:'云计算',part:'noun',diff:'L3',desc:'通过互联网提供计算服务。',exEn:'Cloud computing lets you access files from anywhere.',exZh:'云计算让你能在任何地方访问文件。' },
      { word:'bandwidth',meaning:'带宽',part:'noun',diff:'L3',desc:'网络传输数据的能力。',exEn:'Higher bandwidth means faster internet speeds.',exZh:'更高的带宽意味着更快的网速。' },
      { word:'digital divide',meaning:'数字鸿沟',part:'noun',diff:'L3',desc:'能上网和不能上网人群之间的差距。',exEn:'The digital divide is still a global challenge.',exZh:'数字鸿沟仍然是一个全球性挑战。' },
      { word:'streaming',meaning:'流媒体播放',part:'noun',diff:'L2',desc:'在线实时播放音视频。',exEn:'Streaming services have replaced traditional TV.',exZh:'流媒体服务已经取代了传统电视。' },
    ]},
    { scene:'科技·数字世界', topic:'网络安全', words:[
      { word:'cybersecurity',meaning:'网络安全',part:'noun',diff:'L3',desc:'保护计算机和网络免受攻击。',exEn:'Cybersecurity is more important than ever.',exZh:'网络安全比以往任何时候都重要。' },
      { word:'hacker',meaning:'黑客',part:'noun',diff:'L2',desc:'试图非法侵入计算机系统的人。',exEn:'Hackers try to steal personal information.',exZh:'黑客试图窃取个人信息。' },
      { word:'password',meaning:'密码',part:'noun',diff:'L1',desc:'用于验证身份的保密字符串。',exEn:'Use a strong password to protect your account.',exZh:'使用强密码保护你的账户。' },
      { word:'encryption',meaning:'加密',part:'noun',diff:'L3',desc:'将信息转换为只有授权者能读的形式。',exEn:'Encryption keeps your messages private.',exZh:'加密保护你的消息私密性。' },
      { word:'phishing',meaning:'网络钓鱼',part:'noun',diff:'L3',desc:'伪装成可信来源骗取信息的攻击。',exEn:'Phishing emails trick people into revealing passwords.',exZh:'网络钓鱼邮件欺骗人们泄露密码。' },
      { word:'firewall',meaning:'防火墙',part:'noun',diff:'L2',desc:'阻止未授权访问的安全系统。',exEn:'A firewall protects your computer from attacks.',exZh:'防火墙保护你的电脑免受攻击。' },
      { word:'malware',meaning:'恶意软件',part:'noun',diff:'L3',desc:'病毒、木马等有害软件。',exEn:'Malware can damage your computer and steal data.',exZh:'恶意软件可以损坏电脑和窃取数据。' },
      { word:'two-factor authentication',meaning:'双因素认证',part:'noun',diff:'L3',desc:'需要两种方式验证身份的登录方式。',exEn:'Enable two-factor authentication for extra security.',exZh:'启用双因素认证以获得额外安全。' },
    ]},
    { scene:'科技·未来展望', topic:'太空探索与移民', words:[
      { word:'Mars',meaning:'火星',part:'noun',diff:'L2',desc:'人类最有可能移民的星球。',exEn:'NASA plans to send humans to Mars.',exZh:'NASA计划将人类送往火星。' },
      { word:'space station',meaning:'空间站',part:'noun',diff:'L2',desc:'在地球轨道上运行的科学设施。',exEn:'Astronauts live on the International Space Station.',exZh:'宇航员生活在国际空间站上。' },
      { word:'colonization',meaning:'殖民/移民',part:'noun',diff:'L3',desc:'在其他星球建立人类定居点。',exEn:'Mars colonization could happen within this century.',exZh:'火星移民可能在本世纪内实现。' },
      { word:'gravity',meaning:'重力',part:'noun',diff:'L2',desc:'物体之间的吸引力。',exEn:'Mars has only about 38% of Earth\'s gravity.',exZh:'火星只有地球大约38%的重力。' },
      { word:'spacecraft',meaning:'宇宙飞船',part:'noun',diff:'L2',desc:'用于太空旅行的交通工具。',exEn:'The spacecraft will take months to reach Mars.',exZh:'宇宙飞船需要几个月才能到达火星。' },
      { word:'oxygen',meaning:'氧气',part:'noun',diff:'L1',desc:'生物呼吸需要的气体。',exEn:'Mars has almost no oxygen in its atmosphere.',exZh:'火星大气中几乎没有氧气。' },
      { word:'telescope',meaning:'望远镜',part:'noun',diff:'L2',desc:'观测遥远天体的仪器。',exEn:'The James Webb telescope shows us distant galaxies.',exZh:'詹姆斯·韦伯望远镜向我们展示遥远的星系。' },
      { word:'solar system',meaning:'太阳系',part:'noun',diff:'L2',desc:'太阳及其周围的行星系统。',exEn:'Our solar system has eight planets.',exZh:'我们的太阳系有八颗行星。' },
    ]},
  ],

  // ── EXAM PACKAGES ──
  'exam-academic': [
    { scene:'雅思·IELTS Band 6 基础', topic:'家乡与住所', words:[
      { word:'hometown',meaning:'家乡',part:'noun',diff:'L1',desc:'成长的地方。',exEn:'My hometown is a small city in the south.',exZh:'我的家乡是南方的一个小城市。' },
      { word:'suburb',meaning:'郊区',part:'noun',diff:'L2',desc:'城市外围住宅区。',exEn:'I grew up in the suburbs of London.',exZh:'我在伦敦郊区长大。' },
      { word:'downtown',meaning:'市中心',part:'noun',diff:'L1',desc:'城市商业中心区。',exEn:'There are many shops downtown.',exZh:'市中心有很多商店。' },
      { word:'accommodation',meaning:'住所',part:'noun',diff:'L2',desc:'住处/住宿。',exEn:'I live in a flat near the city center.',exZh:'我住在市中心附近的公寓里。' },
      { word:'neighborhood',meaning:'社区',part:'noun',diff:'L2',desc:'居住的周边区域。',exEn:'The neighborhood is quiet and safe.',exZh:'这个社区安静又安全。' },
      { word:'cozy',meaning:'舒适的',part:'adj',diff:'L2',desc:'小而温暖舒适的。',exEn:'My apartment is small but cozy.',exZh:'我的公寓很小但很舒适。' },
      { word:'facility',meaning:'设施',part:'noun',diff:'L2',desc:'提供便利的设备或场所。',exEn:'Our community has great facilities.',exZh:'我们社区有很好的设施。' },
      { word:'landmark',meaning:'地标',part:'noun',diff:'L2',desc:'容易辨认的标志性建筑。',exEn:'The tower is a famous landmark of my hometown.',exZh:'那座塔是我家乡的著名地标。' },
    ]},
    { scene:'雅思·IELTS Band 6 基础', topic:'学习与工作', words:[
      { word:'major',meaning:'专业',part:'noun',diff:'L1',desc:'大学主修专业。',exEn:'My major is Business Administration.',exZh:'我的专业是工商管理。' },
      { word:'schedule',meaning:'日程',part:'noun',diff:'L2',desc:'安排好的时间计划。',exEn:'My schedule is quite busy this week.',exZh:'我这周的日程很忙。' },
      { word:'deadline',meaning:'截止日期',part:'noun',diff:'L2',desc:'任务的最后期限。',exEn:'The deadline for the project is Friday.',exZh:'项目的截止日期是周五。' },
      { word:'colleague',meaning:'同事',part:'noun',diff:'L2',desc:'一起工作的人。',exEn:'I get along well with my colleagues.',exZh:'我和同事相处融洽。' },
      { word:'qualification',meaning:'资格',part:'noun',diff:'L2',desc:'证明能力的凭证。',exEn:'What qualifications do you have?',exZh:'你有什么资质？' },
      { word:'internship',meaning:'实习',part:'noun',diff:'L2',desc:'学生在公司短期工作。',exEn:'I did an internship at a tech company.',exZh:'我在一家科技公司实习。' },
      { word:'promotion',meaning:'升职',part:'noun',diff:'L2',desc:'职位提升。',exEn:'She got a promotion after one year.',exZh:'她一年后获得了升职。' },
      { word:'work-life balance',meaning:'工作生活平衡',part:'noun',diff:'L3',desc:'工作与个人生活的平衡。',exEn:'Work-life balance is important for health.',exZh:'工作生活平衡对健康很重要。' },
    ]},
    { scene:'雅思·IELTS Band 6.5 发展', topic:'兴趣爱好', words:[
      { word:'passion',meaning:'热情',part:'noun',diff:'L2',desc:'对某事强烈的热爱。',exEn:'Music is my greatest passion.',exZh:'音乐是我最大的热情。' },
      { word:'recreation',meaning:'消遣',part:'noun',diff:'L2',desc:'休闲活动。',exEn:'Reading is my favorite recreation.',exZh:'阅读是我最喜欢的消遣。' },
      { word:'pursue',meaning:'追求',part:'verb',diff:'L2',desc:'努力实现。',exEn:'I want to pursue my dream of becoming an artist.',exZh:'我想追求成为艺术家的梦想。' },
      { word:'leisure',meaning:'闲暇',part:'noun',diff:'L2',desc:'不工作的自由时间。',exEn:'I spend my leisure time reading novels.',exZh:'我闲暇时间读小说。' },
      { word:'creative',meaning:'有创造力的',part:'adj',diff:'L2',desc:'能产生新想法和作品。',exEn:'Painting is a very creative hobby.',exZh:'画画是非常有创造力的爱好。' },
      { word:'relaxing',meaning:'放松的',part:'adj',diff:'L1',desc:'让人平静减压的。',exEn:'I find gardening very relaxing.',exZh:'我觉得园艺非常放松。' },
      { word:'challenging',meaning:'有挑战性的',part:'adj',diff:'L2',desc:'需要努力和技巧的。',exEn:'Rock climbing is challenging but fun.',exZh:'攀岩有挑战性但很有趣。' },
      { word:'social',meaning:'社交的',part:'adj',diff:'L2',desc:'与他人互动的。',exEn:'Team sports are very social activities.',exZh:'团队运动是非常社交的活动。' },
    ]},
    { scene:'雅思·IELTS Band 6.5 发展', topic:'交通出行', words:[
      { word:'public transport',meaning:'公共交通',part:'noun',diff:'L2',desc:'公交地铁等公共服务。',exEn:'Public transport is efficient in big cities.',exZh:'大城市的公共交通很高效。' },
      { word:'commute',meaning:'通勤',part:'noun',diff:'L2',desc:'上下班的路程。',exEn:'My daily commute takes about 40 minutes.',exZh:'我每天通勤大约40分钟。' },
      { word:'traffic jam',meaning:'交通堵塞',part:'noun',diff:'L2',desc:'车辆拥堵。',exEn:'I got stuck in a traffic jam this morning.',exZh:'我今天早上被堵在路上了。' },
      { word:'convenient',meaning:'方便的',part:'adj',diff:'L2',desc:'省时省力的。',exEn:'The subway is the most convenient way to travel.',exZh:'地铁是最方便的出行方式。' },
      { word:'rush hour',meaning:'高峰时段',part:'noun',diff:'L2',desc:'交通最拥堵的时间。',exEn:'Avoid traveling during rush hour.',exZh:'避免在高峰时段出行。' },
      { word:'environmentally friendly',meaning:'环保的',part:'adj',diff:'L3',desc:'对环境友好的。',exEn:'Biking is environmentally friendly.',exZh:'骑自行车是环保的。' },
      { word:'fare',meaning:'票价',part:'noun',diff:'L2',desc:'乘车费用。',exEn:'Bus fares have increased recently.',exZh:'公交车票价最近涨了。' },
      { word:'navigation',meaning:'导航',part:'noun',diff:'L2',desc:'确定方向和路线。',exEn:'I use a navigation app to find the best route.',exZh:'我用导航App找最佳路线。' },
    ]},
    { scene:'雅思·IELTS Band 7 良好', topic:'推荐旅游地', words:[
      { word:'destination',meaning:'目的地',part:'noun',diff:'L2',desc:'旅行的目标地点。',exEn:'Paris is a popular travel destination.',exZh:'巴黎是一个受欢迎的旅游目的地。' },
      { word:'scenery',meaning:'风景',part:'noun',diff:'L2',desc:'美丽的自然景色。',exEn:'The scenery in Switzerland is breathtaking.',exZh:'瑞士的风景令人屏息。' },
      { word:'cuisine',meaning:'美食',part:'noun',diff:'L2',desc:'特定地区的食物风格。',exEn:'Local cuisine is a highlight of any trip.',exZh:'当地美食是任何旅行的亮点。' },
      { word:'hospitality',meaning:'好客',part:'noun',diff:'L3',desc:'热情友好地接待客人。',exEn:'The hospitality of the locals was amazing.',exZh:'当地人的好客令人惊叹。' },
      { word:'must-see',meaning:'必看的',part:'adj',diff:'L2',desc:'不容错过的。',exEn:'The Great Wall is a must-see attraction.',exZh:'长城是必看的景点。' },
      { word:'off the beaten track',meaning:'人迹罕至的',part:'phrase',diff:'L3',desc:'不常被游客光顾的。',exEn:'I prefer places that are off the beaten track.',exZh:'我更喜欢人迹罕至的地方。' },
      { word:'itinerary',meaning:'行程计划',part:'noun',diff:'L3',desc:'旅行的详细安排。',exEn:'We planned a detailed itinerary for the trip.',exZh:'我们为旅行制定了详细的行程计划。' },
      { word:'souvenir',meaning:'纪念品',part:'noun',diff:'L2',desc:'旅行带回来的纪念物品。',exEn:'I bought some souvenirs for my family.',exZh:'我给家人买了一些纪念品。' },
    ]},
    { scene:'雅思·IELTS Band 7 良好', topic:'城市发展', words:[
      { word:'urbanization',meaning:'城市化',part:'noun',diff:'L3',desc:'人口迁往城市的过程。',exEn:'Rapid urbanization creates both opportunities and challenges.',exZh:'快速城市化既创造机遇也带来挑战。' },
      { word:'infrastructure',meaning:'基础设施',part:'noun',diff:'L3',desc:'城市运行的基本系统。',exEn:'Good infrastructure is essential for a modern city.',exZh:'好的基础设施对现代城市至关重要。' },
      { word:'sustainable',meaning:'可持续的',part:'adj',diff:'L3',desc:'能长期维持的。',exEn:'Cities need sustainable development plans.',exZh:'城市需要可持续发展计划。' },
      { word:'pollution',meaning:'污染',part:'noun',diff:'L2',desc:'环境中的有害物质。',exEn:'Air pollution is a serious problem in many cities.',exZh:'空气污染是许多城市的严重问题。' },
      { word:'population density',meaning:'人口密度',part:'noun',diff:'L3',desc:'单位面积的人口数量。',exEn:'High population density puts pressure on services.',exZh:'高人口密度给公共服务带来压力。' },
      { word:'renovation',meaning:'翻新',part:'noun',diff:'L3',desc:'修复和改善旧建筑。',exEn:'The old district underwent major renovation.',exZh:'老城区进行了大规模翻新。' },
      { word:'skyscraper',meaning:'摩天大楼',part:'noun',diff:'L2',desc:'极高的建筑。',exEn:'Skyscrapers define the skyline of modern cities.',exZh:'摩天大楼定义了现代城市的天际线。' },
      { word:'green space',meaning:'绿地',part:'noun',diff:'L2',desc:'城市的公园和自然区域。',exEn:'Green spaces improve the quality of urban life.',exZh:'绿地改善城市生活质量。' },
    ]},
    { scene:'雅思·IELTS Band 7.5 优良', topic:'印象深刻的人', words:[
      { word:'impression',meaning:'印象',part:'noun',diff:'L2',desc:'对某人或某事的感受。',exEn:'She left a deep impression on everyone she met.',exZh:'她给每个遇到的人留下深刻印象。' },
      { word:'charisma',meaning:'魅力',part:'noun',diff:'L3',desc:'吸引人的个人魅力。',exEn:'He has natural charisma that draws people in.',exZh:'他有天生的魅力吸引人。' },
      { word:'eloquent',meaning:'口才好的',part:'adj',diff:'L3',desc:'表达清晰有说服力的。',exEn:'She is an eloquent speaker.',exZh:'她是一个口才很好的演说者。' },
      { word:'genuine',meaning:'真诚的',part:'adj',diff:'L3',desc:'真实不虚伪的。',exEn:'What struck me most was how genuine he was.',exZh:'最打动我的是他的真诚。' },
      { word:'remarkable',meaning:'非凡的',part:'adj',diff:'L3',desc:'值得注意和赞赏的。',exEn:'She has a remarkable ability to connect with people.',exZh:'她有非凡的人际交往能力。' },
      { word:'humble',meaning:'谦虚的',part:'adj',diff:'L2',desc:'不骄傲自大的。',exEn:'Despite his success, he remains humble.',exZh:'尽管他很成功，他仍然谦虚。' },
      { word:'inspiring',meaning:'鼓舞人心的',part:'adj',diff:'L2',desc:'激励他人行动的。',exEn:'Her story is truly inspiring.',exZh:'她的故事真的很鼓舞人心。' },
      { word:'resilient',meaning:'坚韧的',part:'adj',diff:'L3',desc:'能从困难中恢复的。',exEn:'She is one of the most resilient people I know.',exZh:'她是我认识的最坚韧的人之一。' },
    ]},
    { scene:'雅思·IELTS Band 7.5 优良', topic:'科技与社交', words:[
      { word:'interaction',meaning:'互动',part:'noun',diff:'L2',desc:'人与人之间的交流。',exEn:'Technology has transformed social interaction.',exZh:'科技改变了社交互动。' },
      { word:'virtual',meaning:'虚拟的',part:'adj',diff:'L2',desc:'在线而非面对面。',exEn:'Virtual meetings have replaced many face-to-face ones.',exZh:'虚拟会议取代了许多面对面会议。' },
      { word:'isolation',meaning:'孤立',part:'noun',diff:'L3',desc:'与他人隔绝的感觉。',exEn:'Social media can sometimes lead to isolation.',exZh:'社交媒体有时会导致孤立感。' },
      { word:'instant messaging',meaning:'即时通讯',part:'noun',diff:'L2',desc:'实时文字聊天。',exEn:'Instant messaging has made communication faster.',exZh:'即时通讯让沟通更快。' },
      { word:'misinformation',meaning:'错误信息',part:'noun',diff:'L3',desc:'不正确或误导的信息。',exEn:'Misinformation spreads quickly on social media.',exZh:'错误信息在社交媒体上传播很快。' },
      { word:'connectivity',meaning:'连通性',part:'noun',diff:'L3',desc:'保持联系的能力。',exEn:'Global connectivity has never been greater.',exZh:'全球连通性前所未有。' },
      { word:'digital literacy',meaning:'数字素养',part:'noun',diff:'L3',desc:'有效使用数字技术的能力。',exEn:'Digital literacy is essential in today\'s world.',exZh:'数字素养在当今世界至关重要。' },
      { word:'screen time',meaning:'屏幕时间',part:'noun',diff:'L2',desc:'使用电子设备的时间。',exEn:'Excessive screen time can affect sleep.',exZh:'过多的屏幕时间会影响睡眠。' },
    ]},
    { scene:'雅思·IELTS Band 8 优秀', topic:'难忘的经历', words:[
      { word:'memorable',meaning:'难忘的',part:'adj',diff:'L3',desc:'值得长久记住的。',exEn:'It was the most memorable trip of my life.',exZh:'那是我一生中最难忘的旅行。' },
      { word:'transformative',meaning:'改变性的',part:'adj',diff:'L3',desc:'带来深刻变化的。',exEn:'The experience was truly transformative.',exZh:'那次经历确实改变了我。' },
      { word:'perspective',meaning:'视角',part:'noun',diff:'L2',desc:'看问题的方式。',exEn:'It gave me a new perspective on life.',exZh:'它给了我新的人生视角。' },
      { word:'epiphany',meaning:'顿悟',part:'noun',diff:'L3',desc:'突然的深刻领悟。',exEn:'I had an epiphany during that conversation.',exZh:'在那次对话中我有了顿悟。' },
      { word:'cherish',meaning:'珍惜',part:'verb',diff:'L3',desc:'珍视和爱护。',exEn:'I will always cherish that moment.',exZh:'我会永远珍惜那个时刻。' },
      { word:'adversity',meaning:'逆境',part:'noun',diff:'L3',desc:'困难和不幸。',exEn:'Overcoming adversity made me stronger.',exZh:'克服逆境让我更强大。' },
      { word:'profound',meaning:'深刻的',part:'adj',diff:'L3',desc:'有深远意义的。',exEn:'The experience had a profound impact on me.',exZh:'那次经历对我产生了深刻影响。' },
      { word:'milestone',meaning:'里程碑',part:'noun',diff:'L3',desc:'人生的重要节点。',exEn:'Graduation was an important milestone in my life.',exZh:'毕业是我人生的重要里程碑。' },
    ]},
    { scene:'雅思·IELTS Band 8 优秀', topic:'教育与社会', words:[
      { word:'curriculum',meaning:'课程体系',part:'noun',diff:'L3',desc:'学校教学内容的整体安排。',exEn:'The curriculum should prepare students for the future.',exZh:'课程体系应为学生的未来做准备。' },
      { word:'critical thinking',meaning:'批判性思维',part:'noun',diff:'L3',desc:'分析和评估信息的能力。',exEn:'Education should develop critical thinking skills.',exZh:'教育应培养批判性思维能力。' },
      { word:'inequality',meaning:'不平等',part:'noun',diff:'L3',desc:'机会或资源的不公平分配。',exEn:'Educational inequality remains a global issue.',exZh:'教育不平等仍是一个全球性问题。' },
      { word:'lifelong learning',meaning:'终身学习',part:'noun',diff:'L3',desc:'一生持续学习的理念。',exEn:'Lifelong learning is essential in a changing world.',exZh:'在不断变化的世界中终身学习至关重要。' },
      { word:'vocational',meaning:'职业的',part:'adj',diff:'L3',desc:'与职业技能相关的。',exEn:'Vocational training prepares students for specific jobs.',exZh:'职业培训为学生准备特定工作。' },
      { word:'scholarship',meaning:'奖学金',part:'noun',diff:'L2',desc:'资助学生学习的金钱奖励。',exEn:'She won a scholarship to study abroad.',exZh:'她获得了出国留学的奖学金。' },
      { word:'literacy',meaning:'读写能力',part:'noun',diff:'L2',desc:'基本的阅读和写作能力。',exEn:'Improving literacy rates is a global priority.',exZh:'提高识字率是全球优先事项。' },
      { word:'empowerment',meaning:'赋权',part:'noun',diff:'L3',desc:'给予人能力和信心。',exEn:'Education is the key to empowerment.',exZh:'教育是赋权的关键。' },
    ]},
    { scene:'雅思·IELTS Band 8.5 卓越', topic:'理想的改变', words:[
      { word:'envision',meaning:'展望',part:'verb',diff:'L3',desc:'想象未来的样子。',exEn:'I envision a world without poverty.',exZh:'我展望一个没有贫困的世界。' },
      { word:'reform',meaning:'改革',part:'noun',diff:'L3',desc:'有计划的积极改变。',exEn:'Social reform requires collective effort.',exZh:'社会改革需要集体努力。' },
      { word:'advocate',meaning:'倡导',part:'verb',diff:'L3',desc:'公开支持某种改变。',exEn:'I advocate for better environmental policies.',exZh:'我倡导更好的环保政策。' },
      { word:'equitable',meaning:'公平的',part:'adj',diff:'L3',desc:'公正平等的。',exEn:'We need a more equitable distribution of resources.',exZh:'我们需要更公平的资源分配。' },
      { word:'paradigm shift',meaning:'范式转变',part:'noun',diff:'L3',desc:'思维方式的根本改变。',exEn:'A paradigm shift is needed in how we think about energy.',exZh:'我们需要在能源问题上进行范式转变。' },
      { word:'grassroots',meaning:'草根的/基层的',part:'adj',diff:'L3',desc:'由普通人自发发起的。',exEn:'Grassroots movements can drive real change.',exZh:'草根运动能推动真正的变革。' },
      { word:'collective',meaning:'集体的',part:'adj',diff:'L2',desc:'大家共同的。',exEn:'Collective action is more powerful than individual effort.',exZh:'集体行动比个人努力更有力量。' },
      { word:'optimism',meaning:'乐观',part:'noun',diff:'L2',desc:'对未来充满希望的态度。',exEn:'I have cautious optimism about the future.',exZh:'我对未来持谨慎乐观态度。' },
    ]},
    { scene:'雅思·IELTS Band 8.5 卓越', topic:'全球化与文化', words:[
      { word:'globalization',meaning:'全球化',part:'noun',diff:'L3',desc:'世界经济文化的互联。',exEn:'Globalization has both benefits and drawbacks.',exZh:'全球化有利有弊。' },
      { word:'cultural identity',meaning:'文化认同',part:'noun',diff:'L3',desc:'对所属文化的认同感。',exEn:'Preserving cultural identity is important.',exZh:'保护文化认同很重要。' },
      { word:'homogenization',meaning:'同质化',part:'noun',diff:'L3',desc:'文化趋同失去多样性。',exEn:'Globalization may lead to cultural homogenization.',exZh:'全球化可能导致文化同质化。' },
      { word:'heritage',meaning:'遗产',part:'noun',diff:'L3',desc:'从过去传承下来的文化财富。',exEn:'We must protect our cultural heritage.',exZh:'我们必须保护我们的文化遗产。' },
      { word:'assimilation',meaning:'同化',part:'noun',diff:'L3',desc:'吸收融入主流文化。',exEn:'Immigrants often face pressure for assimilation.',exZh:'移民常面临被同化的压力。' },
      { word:'multiculturalism',meaning:'多元文化主义',part:'noun',diff:'L3',desc:'多种文化共存的社会理念。',exEn:'Canada is known for its multiculturalism.',exZh:'加拿大以多元文化主义著称。' },
      { word:'indigenous',meaning:'本土的/土著的',part:'adj',diff:'L3',desc:'原住民的。',exEn:'Indigenous cultures need special protection.',exZh:'原住民文化需要特别保护。' },
      { word:'cross-cultural',meaning:'跨文化的',part:'adj',diff:'L3',desc:'涉及不同文化的。',exEn:'Cross-cultural understanding is increasingly important.',exZh:'跨文化理解越来越重要。' },
    ]},
  ],

  'exam-cet-4': [
    { scene:'四级·校园生活', topic:'选课与课程', words:[
      { word:'course',meaning:'课程',part:'noun',diff:'L1',desc:'大学开设的课程。',exEn:'I need to choose my courses for next semester.',exZh:'我需要为下学期选课。' },
      { word:'credit',meaning:'学分',part:'noun',diff:'L2',desc:'课程学分。',exEn:'This course is worth three credits.',exZh:'这门课三个学分。' },
      { word:'semester',meaning:'学期',part:'noun',diff:'L2',desc:'学年的一半。',exEn:'The new semester starts in September.',exZh:'新学期九月开始。' },
      { word:'syllabus',meaning:'教学大纲',part:'noun',diff:'L3',desc:'课程的内容和安排。',exEn:'The syllabus lists all the topics we will cover.',exZh:'教学大纲列出了我们将覆盖的所有主题。' },
      { word:'assignment',meaning:'作业',part:'noun',diff:'L2',desc:'老师布置的任务。',exEn:'The assignment is due next Monday.',exZh:'作业下周一交。' },
      { word:'lecture',meaning:'讲座/大课',part:'noun',diff:'L2',desc:'老师在教室讲授的课程。',exEn:'The lecture hall can seat 200 students.',exZh:'这个阶梯教室能坐200个学生。' },
      { word:'elective',meaning:'选修课',part:'noun',diff:'L3',desc:'可自由选择的课程。',exEn:'I chose photography as my elective.',exZh:'我选了摄影作为选修课。' },
      { word:'GPA',meaning:'平均绩点',part:'noun',diff:'L2',desc:'综合学业成绩的指标。',exEn:'My GPA improved this semester.',exZh:'我这学期的绩点提高了。' },
    ]},
    { scene:'四级·校园生活', topic:'社团与活动', words:[
      { word:'club',meaning:'社团',part:'noun',diff:'L1',desc:'学生组织。',exEn:'I joined the photography club.',exZh:'我加入了摄影社团。' },
      { word:'volunteer',meaning:'志愿者',part:'noun',diff:'L2',desc:'自愿无偿服务的人。',exEn:'I volunteer at the animal shelter every weekend.',exZh:'我每个周末在动物收容所做志愿者。' },
      { word:'activity',meaning:'活动',part:'noun',diff:'L1',desc:'课外活动。',exEn:'Extracurricular activities are important for college life.',exZh:'课外活动对大学生活很重要。' },
      { word:'organize',meaning:'组织',part:'verb',diff:'L2',desc:'安排和筹划活动。',exEn:'I helped organize the campus festival.',exZh:'我帮忙组织了校园文化节。' },
      { word:'teamwork',meaning:'团队合作',part:'noun',diff:'L2',desc:'多人协作完成任务。',exEn:'Teamwork is an important skill to develop.',exZh:'团队合作是需要培养的重要技能。' },
      { word:'leadership',meaning:'领导力',part:'noun',diff:'L2',desc:'带领团队的能力。',exEn:'Being club president developed my leadership skills.',exZh:'当社长培养了我的领导能力。' },
      { word:'membership',meaning:'会员资格',part:'noun',diff:'L2',desc:'成为组织成员的身份。',exEn:'Club membership costs 50 yuan per year.',exZh:'社团会员费每年50元。' },
      { word:'recruit',meaning:'招募',part:'verb',diff:'L2',desc:'招收新成员。',exEn:'We are recruiting new members for the club.',exZh:'我们正在为社团招募新成员。' },
    ]},
    { scene:'四级·社会热点', topic:'环境保护', words:[
      { word:'environment',meaning:'环境',part:'noun',diff:'L2',desc:'我们周围的自然环境。',exEn:'Protecting the environment is everyone\'s responsibility.',exZh:'保护环境是每个人的责任。' },
      { word:'recycle',meaning:'回收',part:'verb',diff:'L2',desc:'将废物转化为可再用材料。',exEn:'We should recycle paper, plastic, and glass.',exZh:'我们应该回收纸张、塑料和玻璃。' },
      { word:'pollution',meaning:'污染',part:'noun',diff:'L2',desc:'环境中的有害物质。',exEn:'Air pollution is a serious problem in big cities.',exZh:'空气污染是大城市的严重问题。' },
      { word:'carbon emission',meaning:'碳排放',part:'noun',diff:'L3',desc:'燃烧化石燃料释放的二氧化碳。',exEn:'Reducing carbon emissions is crucial.',exZh:'减少碳排放至关重要。' },
      { word:'renewable',meaning:'可再生的',part:'adj',diff:'L3',desc:'能自然补充的。',exEn:'Solar and wind power are renewable energy sources.',exZh:'太阳能和风能是可再生能源。' },
      { word:'conservation',meaning:'保护',part:'noun',diff:'L3',desc:'保护自然资源。',exEn:'Water conservation is important in dry areas.',exZh:'水资源保护在干旱地区很重要。' },
      { word:'sustainable',meaning:'可持续的',part:'adj',diff:'L3',desc:'不损害未来的发展方式。',exEn:'We need to find sustainable ways of living.',exZh:'我们需要找到可持续的生活方式。' },
      { word:'greenhouse effect',meaning:'温室效应',part:'noun',diff:'L3',desc:'大气层保温导致全球变暖。',exEn:'The greenhouse effect is causing global temperatures to rise.',exZh:'温室效应导致全球气温上升。' },
    ]},
    { scene:'四级·社会热点', topic:'科技与生活', words:[
      { word:'technology',meaning:'科技',part:'noun',diff:'L2',desc:'科学技术和应用。',exEn:'Technology has changed every aspect of our lives.',exZh:'科技改变了我们生活的方方面面。' },
      { word:'smartphone',meaning:'智能手机',part:'noun',diff:'L1',desc:'智能移动电话。',exEn:'Smartphones have become essential tools.',exZh:'智能手机已成为必备工具。' },
      { word:'convenience',meaning:'便利',part:'noun',diff:'L2',desc:'省时省力的特性。',exEn:'Online shopping offers great convenience.',exZh:'网购提供了极大的便利。' },
      { word:'addiction',meaning:'上瘾',part:'noun',diff:'L2',desc:'过度依赖。',exEn:'Phone addiction is a growing concern among young people.',exZh:'手机上瘾在年轻人中日益严重。' },
      { word:'innovation',meaning:'创新',part:'noun',diff:'L3',desc:'新想法和新方法。',exEn:'Technological innovation drives economic growth.',exZh:'技术创新驱动经济增长。' },
      { word:'efficiency',meaning:'效率',part:'noun',diff:'L3',desc:'用最少资源达到最好效果。',exEn:'Technology improves efficiency in many fields.',exZh:'科技提高了许多领域的效率。' },
      { word:'digital',meaning:'数字的',part:'adj',diff:'L2',desc:'使用电子技术的。',exEn:'The digital age has transformed education.',exZh:'数字时代改变了教育。' },
      { word:'privacy',meaning:'隐私',part:'noun',diff:'L2',desc:'个人信息保护。',exEn:'Technology poses challenges to personal privacy.',exZh:'科技对个人隐私构成挑战。' },
    ]},
  ],

  'exam-cet-6': [
    { scene:'六级·学术讨论', topic:'学术研究与论文', words:[
      { word:'research',meaning:'研究',part:'noun',diff:'L2',desc:'系统的调查和探究。',exEn:'I am doing research on renewable energy.',exZh:'我在做可再生能源方面的研究。' },
      { word:'thesis',meaning:'论文',part:'noun',diff:'L3',desc:'学术研究论文。',exEn:'I am writing my graduation thesis.',exZh:'我在写毕业论文。' },
      { word:'methodology',meaning:'方法论',part:'noun',diff:'L3',desc:'研究方法的系统。',exEn:'The methodology section explains how the research was done.',exZh:'方法论部分解释研究是如何进行的。' },
      { word:'hypothesis',meaning:'假设',part:'noun',diff:'L3',desc:'需要验证的初步想法。',exEn:'We need to test this hypothesis with experiments.',exZh:'我们需要通过实验验证这个假设。' },
      { word:'citation',meaning:'引用',part:'noun',diff:'L3',desc:'引用他人研究成果。',exEn:'Proper citation is essential in academic writing.',exZh:'正确引用在学术写作中至关重要。' },
      { word:'peer review',meaning:'同行评审',part:'noun',diff:'L3',desc:'同领域专家对研究的审查。',exEn:'The paper went through peer review.',exZh:'这篇论文经过了同行评审。' },
      { word:'plagiarism',meaning:'抄袭',part:'noun',diff:'L3',desc:'未经授权使用他人作品。',exEn:'Plagiarism is a serious academic offense.',exZh:'抄袭是严重的学术违规。' },
      { word:'abstract',meaning:'摘要',part:'noun',diff:'L3',desc:'论文的简短概述。',exEn:'The abstract summarizes the main findings.',exZh:'摘要总结了主要发现。' },
    ]},
    { scene:'六级·学术讨论', topic:'国际交流与合作', words:[
      { word:'exchange program',meaning:'交流项目',part:'noun',diff:'L2',desc:'学生国际交流计划。',exEn:'I participated in an exchange program in the UK.',exZh:'我参加了英国的交流项目。' },
      { word:'cross-cultural',meaning:'跨文化的',part:'adj',diff:'L3',desc:'涉及不同文化的。',exEn:'Cross-cultural communication skills are valuable.',exZh:'跨文化沟通技巧很有价值。' },
      { word:'scholarship',meaning:'奖学金',part:'noun',diff:'L2',desc:'资助学习的奖金。',exEn:'She received a scholarship to study abroad.',exZh:'她获得了出国留学奖学金。' },
      { word:'collaboration',meaning:'合作',part:'noun',diff:'L3',desc:'共同工作达成目标。',exEn:'International collaboration advances scientific research.',exZh:'国际合作推进科学研究。' },
      { word:'conference',meaning:'会议',part:'noun',diff:'L2',desc:'学术交流会议。',exEn:'I presented my paper at an international conference.',exZh:'我在国际会议上发表了我的论文。' },
      { word:'diversity',meaning:'多样性',part:'noun',diff:'L2',desc:'包含不同的背景和观点。',exEn:'Diversity enriches the learning experience.',exZh:'多样性丰富了学习体验。' },
      { word:'global perspective',meaning:'全球视角',part:'noun',diff:'L3',desc:'从全球角度看问题。',exEn:'Studying abroad gave me a global perspective.',exZh:'出国留学给了我全球视角。' },
      { word:'adaptability',meaning:'适应能力',part:'noun',diff:'L3',desc:'适应新环境的能力。',exEn:'Living abroad develops adaptability.',exZh:'在国外生活培养适应能力。' },
    ]},
    { scene:'六级·社会议题', topic:'就业与职业规划', words:[
      { word:'career',meaning:'职业/事业',part:'noun',diff:'L2',desc:'长期从事的工作方向。',exEn:'Career planning should start early in college.',exZh:'职业规划应该在大学早期开始。' },
      { word:'internship',meaning:'实习',part:'noun',diff:'L2',desc:'学生在公司的短期工作。',exEn:'An internship provides valuable work experience.',exZh:'实习提供了宝贵的工作经验。' },
      { word:'resume',meaning:'简历',part:'noun',diff:'L2',desc:'个人经历和技能的概述。',exEn:'Make sure your resume highlights your strengths.',exZh:'确保你的简历突出你的优势。' },
      { word:'interview',meaning:'面试',part:'noun',diff:'L2',desc:'求职时的面谈评估。',exEn:'I have a job interview tomorrow afternoon.',exZh:'我明天下午有工作面试。' },
      { word:'networking',meaning:'人际网络',part:'noun',diff:'L3',desc:'建立职业人际关系。',exEn:'Networking is key to finding job opportunities.',exZh:'人际网络是找到工作机会的关键。' },
      { word:'entrepreneurship',meaning:'创业',part:'noun',diff:'L3',desc:'自己创办和经营企业。',exEn:'Many graduates are interested in entrepreneurship.',exZh:'许多毕业生对创业感兴趣。' },
      { word:'soft skills',meaning:'软技能',part:'noun',diff:'L3',desc:'沟通、团队合作等非技术能力。',exEn:'Employers value soft skills as much as technical skills.',exZh:'雇主对软技能和技术技能同等重视。' },
      { word:'promotion',meaning:'晋升',part:'noun',diff:'L2',desc:'职位和薪水的提升。',exEn:'Hard work led to a quick promotion.',exZh:'努力工作带来了快速晋升。' },
    ]},
    { scene:'六级·社会议题', topic:'媒体与信息素养', words:[
      { word:'media',meaning:'媒体',part:'noun',diff:'L2',desc:'传播信息的渠道。',exEn:'Social media has changed how we get news.',exZh:'社交媒体改变了我们获取新闻的方式。' },
      { word:'fake news',meaning:'假新闻',part:'noun',diff:'L2',desc:'虚假或误导性的新闻报道。',exEn:'It\'s important to identify fake news.',exZh:'识别假新闻很重要。' },
      { word:'fact-check',meaning:'事实核查',part:'verb',diff:'L3',desc:'验证信息的真实性。',exEn:'Always fact-check before sharing information.',exZh:'分享信息前一定要先核查事实。' },
      { word:'bias',meaning:'偏见',part:'noun',diff:'L3',desc:'不客观的倾向。',exEn:'Media bias can influence public opinion.',exZh:'媒体偏见可以影响公众舆论。' },
      { word:'censorship',meaning:'审查制度',part:'noun',diff:'L3',desc:'对信息内容的控制。',exEn:'Internet censorship varies from country to country.',exZh:'互联网审查制度因国家而异。' },
      { word:'critical thinking',meaning:'批判性思维',part:'noun',diff:'L3',desc:'理性分析和评估信息。',exEn:'Critical thinking helps us evaluate information.',exZh:'批判性思维帮助我们评估信息。' },
      { word:'influencer',meaning:'网红/影响者',part:'noun',diff:'L2',desc:'社交媒体上有影响力的人。',exEn:'Influencers can shape public opinion.',exZh:'网红可以塑造公众舆论。' },
      { word:'clickbait',meaning:'标题党',part:'noun',diff:'L3',desc:'用夸张标题吸引点击。',exEn:'Don\'t fall for clickbait headlines.',exZh:'不要被标题党欺骗。' },
    ]},
  ],
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════
function main() {
  let totalVocab = 0, totalChunks = 0

  for (const [pkgName, topics] of Object.entries(ALL_VOCAB)) {
    const pkgPath = join(PKG_DIR, pkgName)
    if (!existsSync(pkgPath)) { console.log(`  ⚠ ${pkgName} not found`); continue }

    // Write vocab
    const vocabCsv = buildVocabCsv(topics)
    writeFileSync(join(pkgPath, 'scene_vocabulary.csv'), vocabCsv, 'utf-8')
    const wordCount = topics.reduce((sum, t) => sum + t.words.length, 0)
    totalVocab += wordCount
    console.log(`  ✓ ${pkgName}: ${wordCount} vocab words`)

    // Write chunks if they were placeholder
    const chunkFile = join(pkgPath, 'chunks.csv')
    const oldChunks = existsSync(chunkFile) ? readFileSync(chunkFile, 'utf-8') : ''
    if (oldChunks.includes('Let me tell you about') && oldChunks.includes('keyword') || !oldChunks || oldChunks.split('\n').length < 4) {
      const chunkCsv = buildChunkCsv(topics)
      writeFileSync(chunkFile, chunkCsv, 'utf-8')
      totalChunks += topics.length * 3
    }
  }

  console.log(`\n✅ Done! ${totalVocab} vocab words, ${totalChunks} chunks`)
}

main()
