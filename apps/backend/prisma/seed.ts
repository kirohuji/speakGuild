import { PrismaClient } from '@prisma/client';
import { auth } from '../src/modules/auth/auth';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════
// SystemConfig 默认值
// ══════════════════════════════════════════════════════════

const defaultConfigs = [
  { key: 'app_name',        value: 'GuideReady',        group: 'basic', label: '应用名称',       type: 'string',   description: 'App 显示名称' },
  { key: 'app_logo_url',    value: '',                  group: 'basic', label: 'Logo URL',        type: 'string',   description: 'App Logo 图片链接' },
  { key: 'contact_email',   value: '',                  group: 'basic', label: '联系邮箱',       type: 'string',   description: '客服/联系邮箱地址' },
  { key: 'icp_number',      value: '',                  group: 'basic', label: 'ICP 备案号',     type: 'string',   description: 'ICP 备案号' },
  { key: 'registration_open',    value: 'true',  group: 'feature', label: '开放注册',         type: 'boolean',  description: '是否允许新用户注册' },
  { key: 'maintenance_mode',     value: 'false', group: 'feature', label: '维护模式',         type: 'boolean',  description: '开启后非管理员用户将看到维护提示' },
  { key: 'maintenance_message',  value: '系统维护中，请稍后再试。', group: 'feature', label: '维护提示文案', type: 'textarea', description: '维护模式下展示的提示信息' },
  { key: 'feature_ai_practice',  value: 'true',  group: 'feature', label: 'AI 练习',          type: 'boolean',  description: '启用/禁用 AI 练习功能' },
  { key: 'feature_leaderboard',  value: 'true',  group: 'feature', label: '排行榜',           type: 'boolean',  description: '启用/禁用排行榜功能' },
  { key: 'feature_mock_exam',    value: 'true',  group: 'feature', label: '模考',             type: 'boolean',  description: '启用/禁用模考功能' },
  { key: 'api_rate_limit',       value: '60',  group: 'technical', label: 'API 限流（次/分钟）',  type: 'number',  description: '每个 IP 每分钟最大请求数' },
  { key: 'upload_max_size_mb',   value: '10',  group: 'technical', label: '文件上传限制（MB）',   type: 'number',  description: '单文件上传最大大小（MB）' },
  { key: 'session_timeout_min',  value: '4320',group: 'technical', label: '会话超时（分钟）',     type: 'number',  description: '用户会话过期时间（默认 3 天）' },
];

async function seedSystemConfigs() {
  for (const cfg of defaultConfigs) {
    await prisma.systemConfig.create({ data: cfg });
  }
  console.log(`    ↳ ${defaultConfigs.length} 项系统配置`);
}

// ══════════════════════════════════════════════════════════
// ResourceNode 资料库数据
// ══════════════════════════════════════════════════════════

interface CategoryDetail {
  region: string; category: string; title: string; content: string; scope: string;
}

const nationalRequirements = [
  { name: '考试语种', description: '外语类包括英语、日语、俄语、法语、德语、西班牙语、朝鲜语、泰语等。' },
  { name: '考试方式', description: '现场考试（面试）以模拟考试方式进行，由省级考试单位根据考试大纲和《全国导游资格考试现场考试工作标准（试行）》组织。' },
  { name: '考试时长', description: '外语类考生每人不少于25分钟，备考旅游景区不少于5个。' },
  { name: '分值比例', description: '外语类分值比例为：礼貌礼仪占5%，语言表达占25%，景点讲解占30%，导游服务规范占10%，应变能力占5%，综合知识占5%，口译占20%。' },
];

// ─── ResourceNode 资料库数据 ────────────────────────────────

interface CategoryDetail {
  region: string; category: string; title: string; content: string; scope: string;
}

const regionOverviews = [
  { region: '北京市', page: '23-24', categories: '语言表达；景点讲解；综合能力；外语口译；知识问答', excerpt: '考查外语类考生在导游服务过程中，进行中文与外语之间口译的基本能力。' },
  { region: '天津市', page: '25-40', categories: '景点讲解；导游服务规范；文明旅游；应变能力；综合知识；语言表达；仪表礼仪', excerpt: '景点讲解；导游服务规范；文明旅游；应变能力；综合知识；语言表达；仪表礼仪。' },
  { region: '河北省', page: '41-45', categories: '景点讲解；专题讲解；口译', excerpt: '外语类考生现场考试内容包括：用所考语种进行景点讲解、专题讲解和口译测试。外语类考生考试时间25分钟。', scoreInfo: '外语类现场考试礼貌礼仪占5%，语言表达占25%，景点讲解占30%，导游服务规范占10%，应变能力占5%，综合知识占5%，口译占20%。' },
  { region: '山西省', page: '46-53', categories: '专题讲解；导游服务能力；应变能力；综合知识；口译', excerpt: '外语考生考试内容考试时长43分钟，其中：讲解环节8分钟，问答环节6分钟，口译环节4分钟，准备和音频回放时长25分钟。' },
  { region: '内蒙古自治区', page: '54-60', categories: '导游服务规范；应变能力；综合知识', excerpt: '外语类考生现场考试内容包括：用所考语种进行导游讲解、导游服务规范、应变能力、综合知识和口译测试（包括"中译外""外译中"）。' },
  { region: '辽宁省', page: '61-66', categories: '景点讲解；导游规范；应变能力；综合知识；口译', excerpt: '外语类考生全程使用所报考的外语语种应试和讲解，并具备中外口译能力。', scoreInfo: '外语类分值比例为：礼貌礼仪占5%，语言表达占25%，景点讲解占30%，导游服务规范占10%，应变能力占5%，综合知识占5%，口译占20%。' },
  { region: '吉林省', page: '67-69', categories: '语言表达；景点讲解；导游服务规范；应变能力；知识问答；口译', excerpt: '外语类考生现场考试内容包括：用报考语种进行景点讲解、导游服务规范问答、应变能力问答、综合知识问答和口译测试。', timeInfo: '外语类考生一般每人不少于25分钟。', scoreInfo: '外语类现场考试礼貌礼仪占5%，语言表达占25%，景点讲解占30%，导游服务规范占10%，应变能力占5%，综合知识占5%，口译占20%。' },
  { region: '黑龙江省', page: '70-72', categories: '景点讲解；导游规范；应变能力；综合知识；文明旅游；口译', excerpt: '考查外语类考生在中文和外语之间口头互译的能力，充分反映考生的真实外语水平。' },
  { region: '上海市', page: '73-80', categories: '概况讲解；景点讲解；综合知识问答；导游服务规范；应变能力；礼貌礼仪；口译；语言表达', excerpt: '主要类别：概况讲解；景点讲解；综合知识问答；导游服务规范；应变能力；礼貌礼仪；口译；语言表达。', timeInfo: '外语类考试答题时间不少于25分钟。' },
  { region: '江苏省', page: '81-83', categories: '', excerpt: '外语类考生现场考试内容包括：用所考语种讲述城市简介、景点讲解和知识问答题。' },
  { region: '浙江省', page: '84-87', categories: '礼貌礼仪；语言表达；景点讲解；概况讲解；导游服务规范问答；应变能力问答；综合知识问答；口译', excerpt: '考查外语类考生在中文和外语导游词之间口头互译的能力，"中译外""外译中"各1题，分值占比合计为20%。', timeInfo: '外语类考生每人考试时间25分钟，其中城市概况讲解2～3分钟，抽签景点讲解8～9分钟；3道问答题每题限时2分钟；2道口译题每题限时3.5分钟。' },
  { region: '安徽省', page: '88-92', categories: '景点讲解；语言表达；导游规范；应变能力；综合知识；口译', excerpt: '外语类考生现场考试内容包括用所报考语种的语言进行景点讲解、导游规范问答、应变能力问答、综合知识问答和口译测试。', timeInfo: '外语类考生现场考试时间每人25分钟，全程用所报考语种的语言进行现场考试。' },
  { region: '福建省', page: '93-97', categories: '景点讲解；导游规范；应变能力；综合知识；外语类口译', excerpt: '考查外语类考生在中文和外语之间口头互译的能力，充分反映考生的真实外语水平。' },
  { region: '江西省', page: '98-104', categories: '景点讲解；口译；语言表达；导游服务规范；应变能力；综合知识', excerpt: '主要类别：景点讲解；口译；语言表达；导游服务规范；应变能力；综合知识。', timeInfo: '外语类考生每人考试时间不少于25分钟，时间分配大致为：讲解约15分钟（江西文化专题4～5分钟，景区讲解10～11分钟），知识问答约5分钟，口译测试约5分钟。', scoreInfo: '外语类现场考试语言和仪表、礼仪占10%，景点讲解占55%，导游服务规范（含文明旅游）问答占5%，应变能力（含文明旅游）问答占5%，综合知识问答占5%，口译占20%。' },
  { region: '山东省', page: '105-108', categories: '景点讲解；导游规范；应变能力；综合知识；口译', excerpt: '外语类考生现场考试内容包括：用所考语种进行山东省省情、景点讲解（含景点知识问答）、导游规范、应变能力、"中译外""外译中"口译。' },
  { region: '河南省', page: '109-112', categories: '礼貌礼仪；语言表达；景点讲解；导游服务规范问答；应变能力问答；综合知识问答；口译', excerpt: '外语类考生景点讲解范围（5个）：河南嵩山少林寺景区等。', timeInfo: '外语类考生考试时长每人不少于25分钟。', scoreInfo: '外语类现场考试礼貌礼仪占5%、语言表达占25%、景点讲解占30%、导游服务规范占10%、应变能力占5%、综合知识占5%、口译占20%。' },
  { region: '湖北省', page: '113-116', categories: '景点讲解；导游规范；应变能力；综合知识；口译', excerpt: '考查外语类考生在中文和外语之间口头互译的能力。', timeInfo: '外语类考生一般每人不少于25分钟。' },
  { region: '湖南省', page: '117-122', categories: '讲解能力；导游服务规范；应变能力；综合知识；口译', excerpt: '外语类分值比例：湖南概况5%；景点讲解与景点知识问答占25%；导游服务规范占10%；应变能力占5%；综合知识占5%；口译占20%。', timeInfo: '外语类考生考试时间为25分钟，备考旅游景区5个。', scoreInfo: '外语类分值比例：湖南概况5%；景点讲解与景点知识问答占25%；导游服务规范占10%；应变能力占5%；综合知识占5%；口译占20%（其中，中译外10%，外译中10%）；礼貌礼仪占5%；语言表达占25%。' },
  { region: '广东省', page: '123-124', categories: '景点讲解；导游规范；应变能力；综合知识；口译', excerpt: '外语类考试景点讲解范围：丹霞山、开平碉楼与村落。口译（外语类考生）考查中译外和外译中能力。' },
  { region: '广西壮族自治区', page: '125-133', categories: '专题线路讲解；旅游景区讲解；知识问答；口译', excerpt: '外语类考生现场考试内容包括：用所报考的语种进行专题线路和旅游景区讲解、知识问答（包括服务规范问答、应变能力问答、综合知识问答）以及口译测试。' },
  { region: '海南省', page: '134-140', categories: '语言表达；景点讲解；导游规范知识问答；应变能力；综合知识；口译；概况讲解；导游服务规范', excerpt: '考查外语类考生在中文和外语之间口头互译的能力。' },
  { region: '重庆市', page: '141-149', categories: '景点讲解；知识问答；口译；语言表达；仪表礼仪', excerpt: '外语类考生景点讲解范围与要求（详见分类考纲）。' },
  { region: '四川省', page: '150-152', categories: '语言表达；景点讲解；导游规范；应变能力知识；综合知识；口译', excerpt: '考查外语类考生在中文和外语之间的口译能力。' },
  { region: '贵州省', page: '153-155', categories: '景点讲解；导游规范；应变能力；综合知识；口译', excerpt: '主要类别：景点讲解；导游规范；应变能力；综合知识；口译。' },
  { region: '云南省', page: '156-160', categories: '礼貌礼仪；景点讲解；导游服务规范；应变能力；综合知识；口译', excerpt: '外语类考生景点讲解范围（模拟团型与讲解顺序参照中文类），口译（外语类考生）考查中译外和外译中。' },
  { region: '西藏自治区', page: '161-166', categories: '大美西藏文旅推介；景点讲解；导游服务规范问答；应变能力问答；综合知识问答；口译', excerpt: '口译（外语类考生）考查中译外和外译中能力。' },
  { region: '陕西省', page: '167-169', categories: '景点讲解；综合知识；导游规范；应变能力；口译', excerpt: '外语类考生现场考试内容包括：景点讲解、综合知识问答、导游规范问答、应变能力问答及口译测试。', scoreInfo: '外语类现场考试语言和仪态占30%，景点讲解占30%，导游规范占10%，应变能力占5%，综合知识占5%，口译占20%。' },
  { region: '甘肃省', page: '170-175', categories: '礼貌礼仪；景点讲解；地方美食推介；导游规范；应变能力；综合知识；口译；甘肃美食推介', excerpt: '考查外语类考生使用中文和外语进行口头互译的基本能力。' },
  { region: '青海省', page: '176-180', categories: '景点讲解；综合知识；导游规范；应变能力；口译', excerpt: '考查外语类考生在中文和外语之间口头互译的能力。', scoreInfo: '外语类现场考试礼貌礼仪占5%，语言表达占25%，景点讲解占30%，导游服务规范占10%，应变能力占5%，综合知识占5%，口译占20%。' },
  { region: '宁夏回族自治区', page: '181-194', categories: '语言表达；仪表礼仪；沿途及景点讲解；导游规范；应变能力；综合知识；口译；沿途讲解；景点讲解', excerpt: '考查外语类考生在中文与外语之间口头互译的能力，外语口语的表达能力，语音语调的准确性，口语表达的流畅性。', timeInfo: '外语类考生每人讲解（沿途+景点）不少于25分钟。', scoreInfo: '外语类分值比例为：礼貌礼仪占5%，语言表达占25%，景点讲解占30%（沿途讲解占10%，景点讲解占20%），导游服务规范占10%，应变能力占5%，综合知识占5%，口译占20%。' },
  { region: '新疆维吾尔自治区', page: '195-201', categories: '语言表达；礼貌礼仪；景点讲解；导游规范；应变能力；综合知识；口译；外语口译', excerpt: '考查外语类考生在导游服务过程中，使用中文和外语之间口头互译的基本能力。' },
  { region: '新疆生产建设兵团', page: '202-209', categories: '语言表达；景点讲解；导游规范；应变能力；综合知识；口译；文明旅游；外语口译', excerpt: '考查外语类考生在导游服务过程中，使用中文和外语之间口头互译的基本能力。' },
];

const categoryDefinitions = [
  { code: '景点讲解', name: '景点讲解', sortOrder: 1 },
  { code: '语言表达', name: '语言表达', sortOrder: 2 },
  { code: '导游服务规范', name: '导游服务规范', sortOrder: 3 },
  { code: '应变能力', name: '应变能力', sortOrder: 4 },
  { code: '综合知识', name: '综合知识', sortOrder: 5 },
  { code: '外语口译', name: '外语口译', sortOrder: 6 },
  { code: '口译', name: '口译', sortOrder: 7 },
  { code: '仪表礼仪', name: '仪表礼仪', sortOrder: 8 },
  { code: '文明旅游', name: '文明旅游', sortOrder: 9 },
  { code: '专题讲解', name: '专题讲解', sortOrder: 10 },
  { code: '综合能力', name: '综合能力', sortOrder: 11 },
  { code: '知识问答', name: '知识问答', sortOrder: 12 },
  { code: '礼貌礼仪', name: '礼貌礼仪', sortOrder: 13 },
  { code: '概况讲解', name: '概况讲解', sortOrder: 14 },
  { code: '导游服务能力', name: '导游服务能力', sortOrder: 15 },
  { code: '导游规范', name: '导游规范', sortOrder: 16 },
  { code: '讲解能力', name: '讲解能力', sortOrder: 17 },
];

const categoryDetails: CategoryDetail[] = [
  { region: '北京市', category: '语言表达', title: '语言表达', content: '考查考生的语言能力，包括表达的准确性、流畅性、逻辑性、规范性和生动性等。', scope: '中外通用（外语类适用）' },
  { region: '北京市', category: '景点讲解', title: '景点讲解', content: '考查考生对北京市主要景点的历史沿革、文化内涵、建筑特点等内容讲解的正确性，讲解是否详略得当、重点突出、条理清晰，以及具备一定的讲解技巧。\n天安门及天安门广场、故宫、天坛、颐和园、长城、明十三陵。', scope: '中外通用（外语类适用）' },
  { region: '北京市', category: '综合能力', title: '综合能力', content: '考查考生对北京市的城市概况、主要景点知识、传统文化与民俗、经济社会发展等方面综合知识的掌握程度，以及导游应掌握的基本业务技能。\n城市概况：北京历史沿革、地理特点、城市规划与发展。\n传统文化与民俗：北京市的世界文化遗产、人类非物质文化遗产代表作、主要博物馆、红色教育基地、北京胡同及四合院、北京商业街及老字号。', scope: '中外通用（外语类适用）' },
  { region: '北京市', category: '外语口译', title: '外语口译', content: '考查外语类考生在导游服务过程中，进行中文与外语之间口译的基本能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '北京市', category: '知识问答', title: '景点知识问答', content: '天安门及天安门广场、故宫、天坛、颐和园、长城、明十三陵、周口店北京人遗址、大运河、中轴线、恭王府、北海、景山、雍和宫、奥林匹克公园、孔庙和国子监。\n《北京市旅游条例》相关知识。\n时事政治（2024～2025年上半年）。', scope: '中外通用（外语类适用）' },
  { region: '天津市', category: '景点讲解', title: '景点讲解', content: '考查考生对旅游景点、游览线、特色旅游资源的熟悉程度和运用导游讲解方法与技巧的能力。\n考查景点：天津旅游概况（中外文）；古文化街（中外文）；盘山（中外文）；五大道风情区；黄崖关长城；杨柳青古镇；渔阳古镇。\n经典游览线：市内经典游览线（从"天津之眼"摩天轮出发经古文化街、鼓楼、天大南开、天塔、文化中心、五大道、解放北路金融街、意风区至天津站）；海河游览线（永乐桥到大光明桥之间）；滨海经典游览线。\n特色旅游资源：红色记忆（平津战役纪念馆、周邓纪念馆、大沽口炮台遗址等）；现代工业旅游（海鸥表博物馆、长芦盐场、空客总装线等）。', scope: '中外通用（外语类适用）' },
  { region: '天津市', category: '导游服务规范', title: '导游服务规范', content: '考查考生对导游服务规范、工作程序、服务质量要求等方面的掌握程度和应用能力。\n1. 地陪导游的服务规范。\n2. 全陪导游的服务规范。\n3. 定点导游的服务规范。\n4. 散客旅游的服务规范。\n5. 出境领队的服务规范。', scope: '中外通用（外语类适用）' },
  { region: '天津市', category: '文明旅游', title: '文明旅游', content: '考查考生是否了解文明旅游的意义，熟悉相关的文明旅游公约，掌握应对个别旅游者的不文明言行的基本原则和处理方法。', scope: '中外通用（外语类适用）' },
  { region: '天津市', category: '应变能力', title: '导游应变能力', content: '考查考生是否掌握旅游者特殊情况的处理技巧，是否掌握由不同原因造成旅游活动计划变更时应采取的措施及是否具备处理各种突发事件和旅游事故的能力。', scope: '中外通用（外语类适用）' },
  { region: '天津市', category: '综合知识', title: '综合知识', content: '考查考生对时政、经济、文化、社会发展等方面综合知识、地方导游的综合知识以及旅游目的国（地区）/客源国（地区）的综合知识的了解、熟悉和掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '天津市', category: '语言表达', title: '语言表达与外语能力', content: '考查考生语言表达的能力及身体语言的运用能力；是否了解导游语言的功能和运用原则；能否运用外语进行导游讲解、回答问题及中外口语互译。', scope: '外语类专属或含外语特殊要求' },
  { region: '天津市', category: '仪表礼仪', title: '仪表礼仪', content: '考查考生是否掌握并运用导游服务工作所应具备的礼节、礼仪知识；举止行为是否端庄大方；服饰、化妆是否得体。', scope: '中外通用（外语类适用）' },
  { region: '河北省', category: '景点讲解', title: '景点讲解范围及要求', content: '考生从9个景点（含7个全省共讲景点和所在考区2个自选景点）中现场抽取一个进行讲解，时间6～7分钟。\n全省共讲景点：西柏坡、山海关、白洋淀、避暑山庄及周围寺庙、崇礼滑雪旅游度假区、白石山、清东陵。', scope: '中外通用（外语类适用）' },
  { region: '河北省', category: '专题讲解', title: '专题讲解', content: '考生从以下题目中抽取一个进行讲解，时间3～4分钟。\n讲解题目：（1）河北历史文化；（2）河北长城文化；（3）河北红色文化；（4）河北自然风光；（5）河北风物特产；（6）河北非遗文化。', scope: '中外通用（外语类适用）' },
  { region: '河北省', category: '口译', title: '口译及要求', content: '考生现场抽取"口译"试题卡进行口译。每位考生"中译外"和"外译中"的试题各不少于1个。', scope: '中外通用（外语类适用）' },
  { region: '山西省', category: '专题讲解', title: '专题讲解', content: '共计5个专题知识，由电脑随机抽取1题进行讲解。准备时间1分钟，讲解时长3分钟。\n讲解内容：①山西概况 ②晋商文化 ③古建文化 ④非遗文化 ⑤红色文化', scope: '中外通用（外语类适用）' },
  { region: '山西省', category: '导游服务能力', title: '导游服务能力', content: '电脑随机抽取1题，准备1分钟，答题时长2分钟。\n考查要点：全陪导游、地陪导游接待服务工作程序及各阶段工作要点。', scope: '中外通用（外语类适用）' },
  { region: '山西省', category: '应变能力', title: '应变能力', content: '电脑随机抽取1题，准备1分钟，答题时长2分钟。\n考查要点：①游客个别要求的处理 ②突发事件和常见问题的处理。', scope: '中外通用（外语类适用）' },
  { region: '山西省', category: '综合知识', title: '综合知识', content: '电脑随机抽取1题，准备1分钟，答题时长2分钟。\n考查要点：当前国际、国内和省内时政以及经济、社会、文旅融合等方面知识。', scope: '中外通用（外语类适用）' },
  { region: '山西省', category: '口译', title: '口译环节', content: '电脑随机抽取"中译外"和"外译中"试题各1个，考生分别回答，每题准备1分钟，答题时长2分钟。\n外语类景区讲解范围：云冈石窟、五台山、平遥古城、洪洞大槐树、晋祠博物馆（5个景区随机抽取1个）。', scope: '外语类专属或含外语特殊要求' },
  { region: '内蒙古自治区', category: '导游服务规范', title: '导游服务规范（占总分10%）', content: '考查考生掌握导游服务的要求和标准。\n考试内容：（1）准备工作（2）出发与迎接服务（3）交通服务（4）住宿服务（5）用餐服务（6）游览服务（7）购物服务与文化娱乐服务（8）送行服务及后续工作。', scope: '中外通用（外语类适用）' },
  { region: '内蒙古自治区', category: '应变能力', title: '导游应变能力（占总分10%）', content: '考查考生是否掌握突发事件和常见问题处理的能力。', scope: '中外通用（外语类适用）' },
  { region: '内蒙古自治区', category: '综合知识', title: '综合知识（占总分10%）', content: '考查考生对时政、经济、文化、社会发展等方面综合知识的了解、熟悉和掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '辽宁省', category: '景点讲解', title: '景点讲解', content: '主要考查考生导游讲解是否符合规范程序和讲解内容的正确性、全面性、条理性。\n抽选景点范围：沈阳故宫、辽宁省博物馆、"九一八"历史博物馆、老虎滩海洋公园、金石滩国家旅游度假区、鞍钢集团展览馆、抚顺雷锋纪念馆、五女山山城、鸭绿江断桥景区、辽沈战役纪念馆、红海滩国家风景廊道、九门口长城。', scope: '外语类专属或含外语特殊要求' },
  { region: '辽宁省', category: '导游规范', title: '导游规范', content: '主要考查考生对导游服务规范及工作程序的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '辽宁省', category: '应变能力', title: '应变能力', content: '主要考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '辽宁省', category: '综合知识', title: '综合知识', content: '主要考查考生对文化、旅游、时政、经济、社会发展等方面的综合知识是否全面了解。', scope: '中外通用（外语类适用）' },
  { region: '辽宁省', category: '口译', title: '中外口译', content: '中外口译内容主要以文化旅游相关的短文为主，考生按照随机抽取的题目进行中外文口译。此部分内容仅外语类考生作答。', scope: '外语类专属或含外语特殊要求' },
  { region: '吉林省', category: '语言表达', title: '语言表达', content: '主要考查考生的语言能力，包括语言表达的准确性、流畅性、逻辑性、生动性、感染力、说服力及身体语言的运用等。', scope: '中外通用（外语类适用）' },
  { region: '吉林省', category: '景点讲解', title: '景点讲解', content: '主要考察考生导游讲解是否符合规范程序，城市概况和景点讲解是否正确、全面、熟练。\n外语类景点讲解：吉林省概况、伪满皇宫博物院、防川景区、吉林雾淞、吉林省非物质文化遗产。', scope: '中外通用（外语类适用）' },
  { region: '吉林省', category: '导游服务规范', title: '导游服务规范', content: '主要考查考生对导游服务的术语和定义、服务能力要求、服务要求、入出境导游服务特别要求、突发事件和常见问题处理、导游服务质量评价与改进等内容的掌握和运用。', scope: '中外通用（外语类适用）' },
  { region: '吉林省', category: '应变能力', title: '应变能力', content: '主要考查考生对旅游者个别要求的处理、应急问题的处置和旅游突发事件的处理能力的掌握和运用。', scope: '中外通用（外语类适用）' },
  { region: '吉林省', category: '知识问答', title: '知识问答', content: '结合当前时政、经济、文化、历史及社会发展等方面情况，综合考查考生对本省历史文化知识、旅游地理常识、节日与民俗知识、饮食与民间工艺、文学、戏曲、书画知识及重要景点知识点的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '吉林省', category: '口译', title: '口译测试', content: '主要考查考生在中文和外语之间口头互译的能力（外语类考生）。', scope: '外语类专属或含外语特殊要求' },
  { region: '黑龙江省', category: '景点讲解', title: '景点讲解', content: '外语类景点讲解内容：（1）黑龙江省概况；（2）哈尔滨中央欧陆风情旅游区（中央大街）；（3）大庆铁人王进喜纪念馆景区；（4）雪乡旅游风景区；（5）太阳岛风景名胜区。', scope: '中外通用（外语类适用）' },
  { region: '黑龙江省', category: '导游规范', title: '导游规范', content: '1. 地陪导游服务程序；2. 全陪导游服务程序；3. 景区景点导游服务程序；4. 散客导游服务程序；5. 《中华人民共和国旅游法》相关知识。', scope: '中外通用（外语类适用）' },
  { region: '黑龙江省', category: '应变能力', title: '应变能力', content: '1. 旅游安全事故处理与预防；2. 急救、安全常识；3. 餐饮、住宿、娱乐、购物等方面个别要求的处理；4. 对"特殊"旅游者的服务等。', scope: '中外通用（外语类适用）' },
  { region: '黑龙江省', category: '综合知识', title: '综合知识', content: '1. 时事政治；2. 文明旅游相关知识；3. 地方导游基础知识；4. 全国导游基础知识；5. 导游业务相关知识。', scope: '中外通用（外语类适用）' },
  { region: '黑龙江省', category: '口译', title: '口译', content: '主要考查外语类考生在中文和外语之间口头互译的能力，充分反映考生的真实外语水平。', scope: '外语类专属或含外语特殊要求' },
  { region: '上海市', category: '概况讲解', title: '概况讲解', content: '包括上海概况讲解和游览区概况讲解。英语、日语、俄语、法语、德语、西班牙语类：（1）上海概况讲解（10分）；（2）游览区概况讲解（10分）重点突出外滩、人民广场、东方明珠、豫园、玉佛寺五大游览区。', scope: '外语类专属或含外语特殊要求' },
  { region: '上海市', category: '景点讲解', title: '景点讲解', content: '英语/日语/俄语/法语/德语/西班牙语类（2题，10分/题）：外滩、人民广场、东方明珠、豫园、玉佛寺五大游览区。', scope: '外语类专属或含外语特殊要求' },
  { region: '上海市', category: '综合知识问答', title: '综合知识问答', content: '英语/日语/俄语/法语/德语/西班牙语类（1题，5分/题）："一江一河"、南京路步行街、徐家汇源、朱家角古镇、上海国际旅游度假区、石库门建筑等。', scope: '外语类专属或含外语特殊要求' },
  { region: '上海市', category: '导游服务规范', title: '导游服务规范与应变能力', content: '包括导游服务接待程序、导游服务特殊问题处理及应变能力、导游服务技能等。', scope: '中外通用（外语类适用）' },
  { region: '上海市', category: '礼貌礼仪', title: '礼貌礼仪', content: '考查考生的仪容仪表、行为举止和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '上海市', category: '口译', title: '口译', content: '考查外语类考生在中文和外语之间口头互译的能力，充分反映考生真实外语水平。', scope: '外语类专属或含外语特殊要求' },
  { region: '浙江省', category: '礼貌礼仪', title: '礼貌礼仪', content: '考查考生的仪容仪表、行为举止和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '浙江省', category: '语言表达', title: '语言表达', content: '考查外语类考生语言表达的准确性、流畅性、逻辑性和生动性。', scope: '中外通用（外语类适用）' },
  { region: '浙江省', category: '景点讲解', title: '景点讲解', content: '考查外语类考生对浙江省主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '浙江省', category: '概况讲解', title: '概况讲解', content: '城市概况讲解2～3分钟，抽签景点讲解8～9分钟，讲解时间每少1分钟扣3分。', scope: '中外通用（外语类适用）' },
  { region: '浙江省', category: '导游服务规范', title: '导游服务规范问答', content: '考查导游服务规范相关知识的掌握和运用。', scope: '中外通用（外语类适用）' },
  { region: '浙江省', category: '应变能力', title: '应变能力问答', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '浙江省', category: '综合知识', title: '综合知识问答', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '浙江省', category: '口译', title: '口译', content: '"中译外""外译中"各1题，分值占比合计为20%，每题限时3.5分钟。', scope: '外语类专属或含外语特殊要求' },
  { region: '安徽省', category: '景点讲解', title: '景点讲解', content: '用所报考语种的语言进行景点讲解。', scope: '中外通用（外语类适用）' },
  { region: '安徽省', category: '语言表达', title: '语言表达', content: '考查外语类考生的语言表达能力，全程用所报考语种进行考试。', scope: '中外通用（外语类适用）' },
  { region: '安徽省', category: '导游规范', title: '导游规范', content: '导游规范问答，考查考生对导游服务规范的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '安徽省', category: '应变能力', title: '应变能力', content: '应变能力问答，考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '安徽省', category: '综合知识', title: '综合知识', content: '综合知识问答，考查考生对时政、经济、文化、社会发展等综合知识的掌握。', scope: '中外通用（外语类适用）' },
  { region: '安徽省', category: '口译', title: '口译', content: '口译测试包括"中译外"和"外译中"。', scope: '外语类专属或含外语特殊要求' },
  { region: '福建省', category: '景点讲解', title: '景点讲解', content: '考查考生对福建省主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '福建省', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '福建省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '福建省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '福建省', category: '外语口译', title: '外语类口译', content: '考查外语类考生在中文和外语之间口头互译的能力，充分反映考生的真实外语水平。', scope: '外语类专属或含外语特殊要求' },
  { region: '江西省', category: '景点讲解', title: '景点讲解', content: '外语类现场考试中景点讲解占55%。讲解约15分钟（江西文化专题4～5分钟，景区讲解10～11分钟）。', scope: '中外通用（外语类适用）' },
  { region: '江西省', category: '口译', title: '口译', content: '口译占20%，口译测试约5分钟。', scope: '外语类专属或含外语特殊要求' },
  { region: '江西省', category: '语言表达', title: '语言表达', content: '语言和仪表、礼仪占10%。', scope: '中外通用（外语类适用）' },
  { region: '江西省', category: '导游服务规范', title: '导游服务规范', content: '导游服务规范（含文明旅游）问答占5%。', scope: '中外通用（外语类适用）' },
  { region: '江西省', category: '应变能力', title: '应变能力', content: '应变能力（含文明旅游）问答占5%。', scope: '中外通用（外语类适用）' },
  { region: '江西省', category: '综合知识', title: '综合知识', content: '综合知识问答占5%。知识问答约5分钟。', scope: '中外通用（外语类适用）' },
  { region: '山东省', category: '景点讲解', title: '景点讲解', content: '用所考语种进行山东省省情、景点讲解（含景点知识问答）。', scope: '中外通用（外语类适用）' },
  { region: '山东省', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '山东省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '山东省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '山东省', category: '口译', title: '口译', content: '"中译外""外译中"口译测试。', scope: '外语类专属或含外语特殊要求' },
  { region: '河南省', category: '礼貌礼仪', title: '礼貌礼仪', content: '礼貌礼仪占5%。考查考生的仪容仪表、行为举止和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '河南省', category: '语言表达', title: '语言表达', content: '语言表达占25%。考查外语类考生语言表达的准确性、流畅性、逻辑性和生动性。', scope: '中外通用（外语类适用）' },
  { region: '河南省', category: '景点讲解', title: '景点讲解', content: '景点讲解占30%。外语类考生景点讲解范围（5个）：河南嵩山少林寺景区等。', scope: '中外通用（外语类适用）' },
  { region: '河南省', category: '导游服务规范', title: '导游服务规范问答', content: '导游服务规范占10%。考查导游服务规范相关知识的掌握和运用。', scope: '中外通用（外语类适用）' },
  { region: '河南省', category: '应变能力', title: '应变能力问答', content: '应变能力占5%。考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '河南省', category: '综合知识', title: '综合知识问答', content: '综合知识占5%。考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '河南省', category: '口译', title: '口译', content: '口译占20%。考查外语类考生中译外和外译中口译能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '湖北省', category: '景点讲解', title: '景点讲解', content: '考查外语类考生对湖北省主要景点的讲解能力。外语类考生一般每人不少于25分钟。', scope: '中外通用（外语类适用）' },
  { region: '湖北省', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '湖北省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '湖北省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '湖北省', category: '口译', title: '口译', content: '考查外语类考生在中文和外语之间口头互译的能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '湖南省', category: '讲解能力', title: '讲解能力', content: '外语类分值比例：湖南概况5%；景点讲解与景点知识问答占25%。备考旅游景区5个。', scope: '中外通用（外语类适用）' },
  { region: '湖南省', category: '导游服务规范', title: '导游服务规范', content: '导游服务规范占10%。', scope: '中外通用（外语类适用）' },
  { region: '湖南省', category: '应变能力', title: '应变能力', content: '应变能力占5%。', scope: '中外通用（外语类适用）' },
  { region: '湖南省', category: '综合知识', title: '综合知识', content: '综合知识占5%。', scope: '中外通用（外语类适用）' },
  { region: '湖南省', category: '口译', title: '口译', content: '口译占20%（其中，中译外10%，外译中10%）。礼貌礼仪占5%；语言表达占25%。', scope: '外语类专属或含外语特殊要求' },
  { region: '广东省', category: '景点讲解', title: '景点讲解', content: '外语类考试景点讲解范围：丹霞山、开平碉楼与村落。', scope: '中外通用（外语类适用）' },
  { region: '广东省', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '广东省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '广东省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '广东省', category: '口译', title: '口译', content: '考查外语类考生中译外和外译中口译能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '广西壮族自治区', category: '专题讲解', title: '专题线路讲解', content: '用所报考的语种进行专题线路讲解。', scope: '中外通用（外语类适用）' },
  { region: '广西壮族自治区', category: '景点讲解', title: '旅游景区讲解', content: '用所报考的语种进行旅游景区讲解。', scope: '中外通用（外语类适用）' },
  { region: '广西壮族自治区', category: '知识问答', title: '知识问答', content: '知识问答包括服务规范问答、应变能力问答、综合知识问答。', scope: '中外通用（外语类适用）' },
  { region: '广西壮族自治区', category: '口译', title: '口译测试', content: '考查外语类考生中译外和外译中口译能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '海南省', category: '语言表达', title: '语言表达', content: '考查外语类考生的语言表达能力。', scope: '中外通用（外语类适用）' },
  { region: '海南省', category: '景点讲解', title: '景点讲解', content: '考查外语类考生对海南主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '海南省', category: '导游服务规范', title: '导游规范知识问答', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '海南省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '海南省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '海南省', category: '口译', title: '口译', content: '考查外语类考生在中文和外语之间口头互译的能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '重庆市', category: '景点讲解', title: '景点讲解', content: '外语类考生景点讲解范围与要求。', scope: '中外通用（外语类适用）' },
  { region: '重庆市', category: '知识问答', title: '知识问答', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '重庆市', category: '口译', title: '口译', content: '考查外语类考生中译外和外译中口译能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '重庆市', category: '语言表达', title: '语言表达', content: '考查外语类考生的语言表达能力。', scope: '中外通用（外语类适用）' },
  { region: '重庆市', category: '仪表礼仪', title: '仪表礼仪', content: '考查考生的仪容仪表和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '四川省', category: '语言表达', title: '语言表达', content: '考查外语类考生的语言表达能力。', scope: '中外通用（外语类适用）' },
  { region: '四川省', category: '景点讲解', title: '景点讲解', content: '考查外语类考生对四川主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '四川省', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '四川省', category: '应变能力', title: '应变能力知识', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '四川省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '四川省', category: '口译', title: '口译', content: '考查外语类考生在中文和外语之间的口译能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '贵州省', category: '景点讲解', title: '景点讲解', content: '考查外语类考生对贵州主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '贵州省', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '贵州省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '贵州省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '贵州省', category: '口译', title: '口译', content: '考查外语类考生中译外和外译中口译能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '云南省', category: '礼貌礼仪', title: '礼貌礼仪', content: '考查考生的仪容仪表、行为举止和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '云南省', category: '景点讲解', title: '景点讲解', content: '外语类考生景点讲解范围（模拟团型与讲解顺序参照中文类）。', scope: '中外通用（外语类适用）' },
  { region: '云南省', category: '导游服务规范', title: '导游服务规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '云南省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '云南省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '云南省', category: '口译', title: '口译', content: '口译（外语类考生）考查中译外和外译中。', scope: '外语类专属或含外语特殊要求' },
  { region: '西藏自治区', category: '景点讲解', title: '大美西藏文旅推介与景点讲解', content: '外语类考生需进行大美西藏文旅推介和景点讲解。', scope: '中外通用（外语类适用）' },
  { region: '西藏自治区', category: '导游服务规范', title: '导游服务规范问答', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '西藏自治区', category: '应变能力', title: '应变能力问答', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '西藏自治区', category: '综合知识', title: '综合知识问答', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '西藏自治区', category: '口译', title: '口译', content: '口译（外语类考生）考查中译外和外译中能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '陕西省', category: '景点讲解', title: '景点讲解', content: '景点讲解占30%。考查外语类考生对陕西主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '陕西省', category: '综合知识', title: '综合知识', content: '综合知识占5%。考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '陕西省', category: '导游规范', title: '导游规范', content: '导游规范占10%。考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '陕西省', category: '应变能力', title: '应变能力', content: '应变能力占5%。考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '陕西省', category: '口译', title: '口译', content: '口译占20%。外语类现场考试语言和仪态占30%。', scope: '外语类专属或含外语特殊要求' },
  { region: '甘肃省', category: '礼貌礼仪', title: '礼貌礼仪', content: '考查考生的仪容仪表、行为举止和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '甘肃省', category: '景点讲解', title: '景点讲解与地方美食推介', content: '考查外语类考生对甘肃主要景点的讲解能力以及甘肃美食推介能力。', scope: '中外通用（外语类适用）' },
  { region: '甘肃省', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '甘肃省', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '甘肃省', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '甘肃省', category: '口译', title: '口译', content: '考查外语类考生使用中文和外语进行口头互译的基本能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '青海省', category: '景点讲解', title: '景点讲解', content: '景点讲解占30%。考查外语类考生对青海主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '青海省', category: '综合知识', title: '综合知识', content: '综合知识占5%。考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '青海省', category: '导游规范', title: '导游规范', content: '导游服务规范占10%。考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '青海省', category: '应变能力', title: '应变能力', content: '应变能力占5%。考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '青海省', category: '口译', title: '口译', content: '口译占20%。考查外语类考生在中文和外语之间口头互译的能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '宁夏回族自治区', category: '语言表达', title: '语言表达', content: '语言表达占25%。考查外语类考生的语言表达能力。', scope: '中外通用（外语类适用）' },
  { region: '宁夏回族自治区', category: '仪表礼仪', title: '仪表礼仪', content: '礼貌礼仪占5%。考查考生的仪容仪表和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '宁夏回族自治区', category: '景点讲解', title: '沿途及景点讲解', content: '景点讲解占30%（沿途讲解占10%，景点讲解占20%）。每人讲解（沿途+景点）不少于25分钟。', scope: '中外通用（外语类适用）' },
  { region: '宁夏回族自治区', category: '导游规范', title: '导游规范', content: '导游服务规范占10%。考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '宁夏回族自治区', category: '应变能力', title: '应变能力', content: '应变能力占5%。考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '宁夏回族自治区', category: '综合知识', title: '综合知识', content: '综合知识占5%。考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '宁夏回族自治区', category: '口译', title: '口译', content: '口译占20%。考查外语类考生在中文与外语之间口头互译的能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '新疆维吾尔自治区', category: '语言表达', title: '语言表达', content: '考查外语类考生的语言表达能力。', scope: '中外通用（外语类适用）' },
  { region: '新疆维吾尔自治区', category: '礼貌礼仪', title: '礼貌礼仪', content: '考查考生的仪容仪表、行为举止和礼貌礼节。', scope: '中外通用（外语类适用）' },
  { region: '新疆维吾尔自治区', category: '景点讲解', title: '景点讲解', content: '考查外语类考生对新疆主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '新疆维吾尔自治区', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '新疆维吾尔自治区', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '新疆维吾尔自治区', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '新疆维吾尔自治区', category: '口译', title: '口译', content: '考查外语类考生在导游服务过程中，使用中文和外语之间口头互译的基本能力。', scope: '外语类专属或含外语特殊要求' },
  { region: '新疆生产建设兵团', category: '语言表达', title: '语言表达', content: '考查外语类考生的语言表达能力。', scope: '中外通用（外语类适用）' },
  { region: '新疆生产建设兵团', category: '景点讲解', title: '景点讲解', content: '考查外语类考生对兵团主要景点的讲解能力。', scope: '中外通用（外语类适用）' },
  { region: '新疆生产建设兵团', category: '导游规范', title: '导游规范', content: '考查考生对导游服务规范的掌握和应用。', scope: '中外通用（外语类适用）' },
  { region: '新疆生产建设兵团', category: '应变能力', title: '应变能力', content: '考查考生处理突发事件和常见问题的能力。', scope: '中外通用（外语类适用）' },
  { region: '新疆生产建设兵团', category: '综合知识', title: '综合知识', content: '考查考生对综合知识的掌握程度。', scope: '中外通用（外语类适用）' },
  { region: '新疆生产建设兵团', category: '口译', title: '口译', content: '考查外语类考生在导游服务过程中，使用中文和外语之间口头互译的基本能力。', scope: '外语类专属或含外语特殊要求' },
];

// ══════════════════════════════════════════════════════════
// ResourceNode 考纲资料库
// ══════════════════════════════════════════════════════════

async function seedResourceLibrary(rootName: string) {
  const root = await prisma.resourceNode.create({
    data: {
      name: rootName,
      type: 'folder',
      description: '基于《全国导游资格考试现场考试大纲》整理的外语类考纲资料库，涵盖全国31个省市自治区的面试要求、考试类别、评分标准和考点信息。',
      sortOrder: 0,
    },
  });

  // 01-全国通用要求
  const reqFolder = await prisma.resourceNode.create({
    data: { parentId: root.id, name: '01-全国通用要求', type: 'folder', description: '全国外语类现场考试的通用要求，适用于所有地区。', sortOrder: 1 },
  });
  for (let i = 0; i < nationalRequirements.length; i++) {
    const item = nationalRequirements[i];
    await prisma.resourceNode.create({ data: { parentId: reqFolder.id, name: item.name, type: 'document', description: item.description, sortOrder: i + 1 } });
  }

  // 02-各省考纲速览
  const overviewFolder = await prisma.resourceNode.create({
    data: { parentId: root.id, name: '02-各省考纲速览', type: 'folder', description: '各省份外语面试考试概览，包含考试类别、考试时间、分值比例等关键信息。', sortOrder: 2 },
  });
  for (let i = 0; i < regionOverviews.length; i++) {
    const r = regionOverviews[i];
    let description = `**页码范围**：${r.page}\n\n**主要类别**：${r.categories || '（参见分类考纲详情）'}\n\n**考试要求**：${r.excerpt}`;
    if ((r as any).timeInfo) description += `\n\n**考试时间**：${(r as any).timeInfo}`;
    if ((r as any).scoreInfo) description += `\n\n**分值信息**：${(r as any).scoreInfo}`;
    await prisma.resourceNode.create({ data: { parentId: overviewFolder.id, name: `${r.region}考纲概览`, type: 'document', region: r.region, description, sortOrder: i + 1 } });
  }

  // 03-分类考纲详情
  const detailFolder = await prisma.resourceNode.create({
    data: { parentId: root.id, name: '03-分类考纲详情', type: 'folder', description: '按考试类别分组的详细考纲内容，适合针对性复习。', sortOrder: 3 },
  });
  let totalDocs = 0;
  for (const catDef of categoryDefinitions) {
    const items = categoryDetails.filter((d) => d.category === catDef.code);
    if (items.length === 0) continue;
    const catFolder = await prisma.resourceNode.create({
      data: { parentId: detailFolder.id, name: catDef.name, type: 'folder', description: `${catDef.name}类考纲要求，共涵盖${items.length}个地区。`, sortOrder: catDef.sortOrder },
    });
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await prisma.resourceNode.create({ data: { parentId: catFolder.id, name: `${item.region}-${item.title}`, type: 'document', region: item.region, description: `**适用范围**：${item.scope}\n\n${item.content}`, sortOrder: i + 1 } });
      totalDocs++;
    }
  }

  const totalNodes = await prisma.resourceNode.count();
  console.log(`    ↳ ${totalNodes} 条资源节点（${nationalRequirements.length}条全国通用 + ${regionOverviews.length}条省份概览 + ${totalDocs}条分类详情）`);
}

async function main() {
  await prisma.notificationRead.deleteMany();
  await prisma.notificationTarget.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.referralCode.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.order.updateMany({ data: { couponId: null } });
  await prisma.coupon.deleteMany();
  await prisma.dailyActivity.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  await prisma.mockExamRecord.deleteMany();
  await prisma.mockPaperQuestion.deleteMany();
  await prisma.mockPaper.deleteMany();
  await prisma.practiceRecord.deleteMany();
  await prisma.practiceProgress.deleteMany();
  await prisma.favoriteQuestion.deleteMany();
  await prisma.vocabularyWord.deleteMany();
  await prisma.questionContent.deleteMany();
  await prisma.questionItem.deleteMany();
  await prisma.questionTopic.deleteMany();
  await prisma.userBindingConfig.deleteMany();
  await prisma.userMembership.deleteMany();
  await prisma.order.deleteMany();
  await prisma.membershipPlan.deleteMany();
  await prisma.questionBank.deleteMany();

  // 清空资料库 & 系统配置
  await prisma.resourceNode.updateMany({ data: { parentId: null } });
  await prisma.resourceNode.deleteMany();
  await prisma.systemConfig.deleteMany();

  console.log('  ✓ 已清空所有数据');

  // ══════════════════════════════════════════════════════════
  // 1. 系统配置默认值
  // ══════════════════════════════════════════════════════════
  await seedSystemConfigs();
  console.log('  ✓ 系统配置已初始化');

  // 2. 资料库目录结构
  await seedResourceLibrary('全国导游资格外语面试考纲资料库');
  console.log('  ✓ 资料库已填充');

  const bankGdEn = await prisma.questionBank.create({
    data: {
      name: '广东省英语导游口试题库',
      province: '广东',
      language: '英语',
      examType: '笔试+面试',
      interviewForm: '标准面试',
      status: 'active',
    },
  });

  const bankGdJp = await prisma.questionBank.create({
    data: {
      name: '广东省日语导游口试题库',
      province: '广东',
      language: '日语',
      examType: '笔试+面试',
      interviewForm: '标准面试',
      status: 'active',
    },
  });

  const scenicEn = await prisma.questionTopic.create({
    data: { bankId: bankGdEn.id, code: 'scenic-intro', name: '景点介绍', sortOrder: 1 },
  });

  const welcomeEn = await prisma.questionTopic.create({
    data: { bankId: bankGdEn.id, code: 'welcome-speech', name: '欢迎词', sortOrder: 2 },
  });

  const scenicQuestions = [
    {
      title: 'Canton Tower (广州塔)',
      difficulty: 3,
      suggestedDurationSec: 120,
      keywords: ['landmark', 'architecture', 'Pearl River'],
      focusWords: ['skyscraper', 'observation deck', 'illuminated'],
      promptEn: 'Please introduce Canton Tower to our guests.',
      promptZh: '请向客人介绍广州塔。',
      answerEn:
        'Canton Tower, also known as Guangzhou TV Astronomical and Sightseeing Tower, stands at 600 meters tall, making it the tallest television tower in China. Located on the south bank of the Pearl River, it was completed in 2010 and features a stunning lattice-steel structure that twists 45 degrees along its height. The tower offers multiple observation decks, a restaurant, and a sky walk experience that attracts millions of visitors annually.',
      answerZh:
        '广州塔，又称广州电视观光塔，高达600米，是中国最高的电视塔。坐落于珠江南岸，建于2010年，其标志性的格栅钢结构沿高度扭转45度。塔内设有多个观光层、餐厅和高空步行体验，每年吸引数百万游客。',
      summary: '广州地标性建筑，高600米的电视塔',
    },
    {
      title: 'Shamian Island (沙面岛)',
      difficulty: 2,
      suggestedDurationSec: 90,
      keywords: ['colonial architecture', 'historical', 'Guangzhou'],
      focusWords: ['concession', 'European style', 'heritage'],
      promptEn: 'Can you tell us about Shamian Island?',
      promptZh: '请介绍一下沙面岛。',
      answerEn:
        'Shamian Island is a small sandbank island in Guangzhou that served as a foreign concession during the 19th and early 20th centuries. The island features over 150 well-preserved colonial buildings in European architectural styles, including Victorian, Baroque, and Neoclassical. Today it is a popular destination for photography and leisure, lined with banyan trees and peaceful boulevards.',
      answerZh:
        '沙面岛是广州的一座小沙洲岛，19至20世纪初曾作为外国租界。岛上保存着150余栋欧式殖民风格建筑，包括维多利亚式、巴洛克式和新古典主义风格。如今它是摄影和休闲的热门目的地，榕树成荫，街道宁静。',
      summary: '保存完好的欧式殖民建筑历史岛屿',
    },
    {
      title: 'Chen Clan Ancestral Hall (陈家祠)',
      difficulty: 3,
      suggestedDurationSec: 120,
      keywords: ['Lingnan architecture', 'folk art', 'ancestral hall'],
      focusWords: ['woodcarving', 'stone sculpture', 'Qing dynasty'],
      promptEn: 'Please introduce the Chen Clan Ancestral Hall.',
      promptZh: '请介绍陈家祠。',
      answerEn:
        'The Chen Clan Ancestral Hall, built between 1888 and 1894 during the Qing Dynasty, is a masterpiece of traditional Lingnan architecture. It was constructed by the Chen family clans from 72 counties across Guangdong Province. The hall is renowned for its elaborate decorative arts, including wood carvings, stone sculptures, brick carvings, iron castings, and ceramic moldings. Today it houses the Guangdong Folk Arts Museum.',
      answerZh:
        '陈家祠建于1888至1894年清朝时期，是岭南传统建筑的杰作。它由广东省72个县的陈氏家族共同出资兴建。该祠堂以精美的装饰艺术著称，包括木雕、石雕、砖雕、铁铸和陶塑。现为广东民间工艺博物馆。',
      summary: '清代岭南民间艺术建筑瑰宝',
    },
    {
      title: 'Sun Yat-sen Memorial Hall (中山纪念堂)',
      difficulty: 2,
      suggestedDurationSec: 100,
      keywords: ['Sun Yat-sen', 'Republican China', 'octagonal design'],
      focusWords: ['memorial', 'civic building', 'octagonal'],
      promptEn: 'Tell me about the Sun Yat-sen Memorial Hall.',
      promptZh: '请介绍中山纪念堂。',
      answerEn:
        'The Sun Yat-sen Memorial Hall in Guangzhou was built to commemorate Dr. Sun Yat-sen, the founding father of modern China. Completed in 1931, the hall features a distinctive octagonal design blending Chinese palace architecture with modern construction techniques. It seats around 5,000 people and has hosted major cultural and political events. The surrounding garden includes a statue of Dr. Sun Yat-sen.',
      answerZh:
        '广州中山纪念堂是为纪念中国近代民主革命先行者孙中山先生而建。建于1931年，以独特的八角形设计著称，融合了中国宫殿建筑与现代建造技术。可容纳约5000人，曾举办重大文化政治活动。周围园林内设有孙中山先生雕像。',
      summary: '纪念孙中山先生的标志性八角形礼堂',
    },
    {
      title: 'Baiyun Mountain (白云山)',
      difficulty: 2,
      suggestedDurationSec: 90,
      keywords: ['nature', 'hiking', 'city park'],
      focusWords: ['scenic area', 'summit', 'botanical garden'],
      promptEn: 'Please describe Baiyun Mountain to our visitors.',
      promptZh: '请向游客描述白云山。',
      answerEn:
        'Baiyun Mountain is a large nature park located in the northern part of Guangzhou. Covering over 20,000 acres, it includes 30 peaks, with Moxing Peak being the highest at 382 meters. The mountain is known for its lush greenery, fresh air, and scenic views of the city skyline. It features numerous hiking trails, gardens, cable cars, and recreational facilities, making it a favorite weekend destination for Guangzhou residents.',
      answerZh:
        '白云山是广州北部的一座大型自然公园，占地逾2万亩，包含30座山峰，其中摩星岭最高，海拔382米。白云山以葱郁的绿色植被、清新空气和俯瞰城市的壮阔景色著称，设有众多登山步道、园林、缆车和休闲设施，是广州市民周末出游的热门去处。',
      summary: '广州最大的城市自然公园，城市绿肺',
    },
    {
      title: 'Guangzhou Museum of Art (广州艺术博物馆)',
      difficulty: 3,
      suggestedDurationSec: 110,
      keywords: ['art', 'museum', 'Chinese painting'],
      focusWords: ['collection', 'contemporary art', 'exhibits'],
      promptEn: 'Can you introduce the Guangzhou Museum of Art?',
      promptZh: '请介绍广州艺术博物馆。',
      answerEn:
        'The Guangzhou Museum of Art is one of the leading art institutions in South China. Founded in 1957, it houses an extensive collection of Chinese paintings, calligraphy, and ceramic works spanning from ancient times to the modern era. The museum regularly hosts temporary exhibitions featuring works by prominent Chinese and international artists. It plays an important role in promoting art education and cultural exchange in the Pearl River Delta region.',
      answerZh:
        '广州艺术博物馆是华南地区重要的艺术机构之一，成立于1957年，珍藏中国画、书法和陶瓷等藏品，跨越古代至现代。博物馆定期举办国内外知名艺术家的临时展览，在珠三角地区艺术教育和文化交流中发挥重要作用。',
      summary: '华南重要艺术机构，中国书画陶瓷珍藏',
    },
    {
      title: 'Guangdong Provincial Museum (广东省博物馆)',
      difficulty: 3,
      suggestedDurationSec: 120,
      keywords: ['history', 'Guangdong', 'cultural relics'],
      focusWords: ['artifacts', 'exhibition hall', 'maritime trade'],
      promptEn: 'Please introduce the Guangdong Provincial Museum.',
      promptZh: '请介绍广东省博物馆。',
      answerEn:
        'The Guangdong Provincial Museum is the largest comprehensive museum in Guangdong Province. The current building, shaped like a Chinese treasure box, was inaugurated in 2010. The museum features permanent exhibitions on Guangdong history, natural history, and arts and crafts, with highlights including ancient maritime trade artifacts, Chaozhou woodcarving, and Cantonese opera costumes. It hosts millions of visitors each year.',
      answerZh:
        '广东省博物馆是广东省规模最大的综合性博物馆。现馆建于2010年，外形酷似中国古代宝盒。博物馆设有广东历史、自然史和工艺美术常设展览，重点展品包括古代海上贸易文物、潮州木雕和粤剧戏服，每年接待数百万观众。',
      summary: '广东最大综合博物馆，珍藏海丝文物',
    },
    {
      title: 'Yuexiu Park (越秀公园)',
      difficulty: 2,
      suggestedDurationSec: 90,
      keywords: ['Five Rams Statue', 'park', 'city legend'],
      focusWords: ['goat', 'legend', 'ancient city wall'],
      promptEn: 'Tell our guests about Yuexiu Park.',
      promptZh: '请介绍越秀公园。',
      answerEn:
        'Yuexiu Park is the largest park in Guangzhou and home to the iconic Five Rams Statue, a symbol of the city. According to legend, five immortals rode five rams bearing rice spikes to Guangzhou, blessing the city with prosperity and earning it the nickname "City of Rams." The park also contains a section of the ancient city wall from the Ming Dynasty and the Guangzhou Museum, making it an important cultural and recreational destination.',
      answerZh:
        '越秀公园是广州最大的公园，以标志性的五羊雕像而闻名，该雕像是广州的城市象征。传说中，五位仙人骑着五只衔着稻穗的羊降临广州，赐予这座城市繁荣，使其得名"羊城"。公园内还保存有明代古城墙遗址和广州博物馆，是重要的文化休闲圣地。',
      summary: '广州最大公园，五羊雕像城市地标',
    },
    {
      title: 'Chimelong Safari Park (长隆野生动物世界)',
      difficulty: 2,
      suggestedDurationSec: 100,
      keywords: ['wildlife', 'theme park', 'family'],
      focusWords: ['safari', 'giant panda', 'nocturnal animals'],
      promptEn: 'Please introduce Chimelong Safari Park.',
      promptZh: '请介绍长隆野生动物世界。',
      answerEn:
        "Chimelong Safari Park, located in Panyu District, Guangzhou, is one of China's premier wildlife theme parks. It is home to over 20,000 animals representing more than 700 species, including giant pandas, white lions, and African elephants. The park features drive-through safari zones, walk-through habitats, animal shows, and a dedicated giant panda breeding center. It consistently ranks among the top wildlife attractions in Asia.",
      answerZh:
        '长隆野生动物世界位于广州番禺区，是中国顶级野生动物主题公园之一。园内有超过20000只、700余种动物，包括大熊猫、白狮和非洲象。公园设有驾车穿越动物区、步行生态区、动物表演和大熊猫繁育中心，长期位居亚洲顶级野生动物景区之列。',
      summary: '中国顶级野生动物主题公园，700余种动物',
    },
    {
      title: 'Liwan Lake Park (荔湾湖公园)',
      difficulty: 1,
      suggestedDurationSec: 80,
      keywords: ['Cantonese culture', 'old Guangzhou', 'garden'],
      focusWords: ['lotus', 'traditional teahouse', 'Xiguan'],
      promptEn: 'Can you describe Liwan Lake Park?',
      promptZh: '请描述荔湾湖公园。',
      answerEn:
        'Liwan Lake Park is nestled in the heart of Liwan District, one of the oldest and most culturally rich areas of Guangzhou, also known as Xiguan. The park features a picturesque lotus lake surrounded by traditional Cantonese garden architecture, willow trees, and stone bridges. Visitors can enjoy traditional Cantonese tea house culture and folk performances. The park offers a glimpse into the leisurely lifestyle of old Guangzhou.',
      answerZh:
        '荔湾湖公园坐落于荔湾区中心，这里是广州历史最悠久、文化最丰富的地区之一，又称西关。公园以荷花湖为中心，四周是岭南传统园林建筑、杨柳和石桥。游客可体验传统粤式茶文化和民俗表演，感受旧广州的悠闲生活气息。',
      summary: '西关腹地的传统粤式园林，荷花湖景',
    },
  ];

  const questionItems: any[] = [];
  for (const q of scenicQuestions) {
    const item = await prisma.questionItem.create({
      data: {
        topicId: scenicEn.id,
        title: q.title,
        difficulty: q.difficulty,
        suggestedDurationSec: q.suggestedDurationSec,
        masteryScore: Math.floor(Math.random() * 60),
        keywords: q.keywords,
        focusWords: q.focusWords,
        content: {
          create: {
            promptEn: q.promptEn,
            promptZh: q.promptZh,
            answerEn: q.answerEn,
            answerZh: q.answerZh,
            summary: q.summary,
          },
        },
      },
    });
    questionItems.push(item);
  }

  const welcomeQuestions = [
    {
      title: 'Welcome Speech for a Group Tour',
      difficulty: 2,
      suggestedDurationSec: 90,
      keywords: ['greeting', 'introduction', 'itinerary'],
      focusWords: ['itinerary', 'accommodate', 'hospitality'],
      promptEn: 'Give a welcome speech for a group of foreign tourists arriving in Guangzhou.',
      promptZh: '给到达广州的外国旅游团致欢迎词。',
      answerEn:
        "Good morning, ladies and gentlemen! On behalf of our tour company, I warmly welcome you all to Guangzhou, the vibrant heart of South China. My name is [Guide Name], and I will be your guide throughout this wonderful journey. Over the next few days, we will explore the rich history, culture, and cuisine that make Guangzhou one of China's most fascinating cities. Please don't hesitate to ask if you need any assistance. I hope we will have a wonderful time together.",
      answerZh:
        '女士们先生们，早上好！我代表我们的旅行社热忱欢迎大家来到广州——华南充满活力的中心。我叫（导游姓名），将在这次精彩旅程中全程为您服务。在接下来的几天里，我们将探索广州丰富的历史、文化和美食，这正是广州成为中国最迷人城市之一的原因。如有任何需要，请随时告知。希望我们共度美好时光。',
      summary: '标准欢迎词，适用于抵达广州的旅游团',
    },
    {
      title: 'Welcome to a Cultural Heritage Tour',
      difficulty: 3,
      suggestedDurationSec: 100,
      keywords: ['cultural heritage', 'history', 'Lingnan'],
      focusWords: ['heritage', 'dynasty', 'preserve'],
      promptEn: 'Welcome the tourists to a cultural heritage tour of Guangdong.',
      promptZh: '欢迎游客参加广东文化遗产之旅。',
      answerEn:
        'Welcome, dear friends! You have chosen a truly extraordinary journey — a cultural heritage tour through the magnificent land of Guangdong. For centuries, this region has been a cradle of civilization, where the Lingnan culture flourished and where East met West in remarkable ways. Today we will walk through ancient ancestral halls, admire traditional architecture, and discover the stories that shaped this land. I am honored to be your guide on this voyage through history.',
      answerZh:
        '亲爱的朋友们，欢迎您！您选择了一段非凡的旅程——广东文化遗产之旅。数百年来，这片土地一直是文明的摇篮，岭南文化在此发扬光大，东西方文化在此交融碰撞。今天我们将漫步古老的宗祠，欣赏传统建筑，探寻塑造这片土地的历史故事。能作为您的导游踏上这段历史之旅，我深感荣幸。',
      summary: '文化遗产主题旅游欢迎词',
    },
  ];

  for (const q of welcomeQuestions) {
    await prisma.questionItem.create({
      data: {
        topicId: welcomeEn.id,
        title: q.title,
        difficulty: q.difficulty,
        suggestedDurationSec: q.suggestedDurationSec,
        masteryScore: 0,
        keywords: q.keywords,
        focusWords: q.focusWords,
        content: {
          create: {
            promptEn: q.promptEn,
            promptZh: q.promptZh,
            answerEn: q.answerEn,
            answerZh: q.answerZh,
            summary: q.summary,
          },
        },
      },
    });
  }

  const scenicJp = await prisma.questionTopic.create({
    data: { bankId: bankGdJp.id, code: 'scenic-intro', name: '観光地紹介', sortOrder: 1 },
  });
  await prisma.questionTopic.create({
    data: { bankId: bankGdJp.id, code: 'welcome-speech', name: 'ようこそスピーチ', sortOrder: 2 },
  });

  await prisma.questionItem.create({
    data: {
      topicId: scenicJp.id,
      title: '広州塔 (Canton Tower)',
      difficulty: 3,
      suggestedDurationSec: 120,
      masteryScore: 0,
      keywords: ['ランドマーク', '建築', '珠江'],
      focusWords: ['超高層ビル', '展望台', 'ライトアップ'],
      content: {
        create: {
          promptEn: '広州塔についてご紹介ください。',
          promptZh: '请向客人介绍广州塔（日语版）。',
          answerEn:
            '広州塔は高さ600メートルの電波塔で、中国で最も高いテレビ塔です。珠江南岸に位置し、2010年に完成しました。美しい格子鋼構造が特徴で、年間数百万人の観光客が訪れます。',
          answerZh: '（日语版）广州塔是高600米的电视塔，是中国最高的电视塔，位于珠江南岸，完成于2010年。',
          summary: '广州标志性建筑（日语版）',
        },
      },
    },
  });

  const standardPaper = await prisma.mockPaper.create({
    data: {
      bankId: bankGdEn.id,
      title: '广东英语导游标准模拟卷',
      paperType: 'standard',
      suggestedMinutes: 30,
      focus: ['景点介绍', '欢迎词', '文化知识'],
    },
  });

  const intensePaper = await prisma.mockPaper.create({
    data: {
      bankId: bankGdEn.id,
      title: '广东英语导游强化模拟卷',
      paperType: 'intensive',
      suggestedMinutes: 45,
      focus: ['景点介绍', '临场应变', '英语口语'],
    },
  });

  for (let i = 0; i < 5 && i < questionItems.length; i++) {
    await prisma.mockPaperQuestion.create({
      data: {
        paperId: standardPaper.id,
        questionId: questionItems[i].id,
        sortOrder: i,
      },
    });
  }

  for (let i = 2; i < 7 && i < questionItems.length; i++) {
    await prisma.mockPaperQuestion.create({
      data: {
        paperId: intensePaper.id,
        questionId: questionItems[i].id,
        sortOrder: i - 2,
      },
    });
  }

  await prisma.membershipPlan.create({
    data: {
      name: '标准会员',
      level: 'standard',
      price: 9800,
      yearlyPrice: 98000,
      period: 'month',
      durationDays: 30,
      features: ['完整题库', '模考练习', '练习记录', '收藏题目', '生词本', 'AI 点评'],
      sortOrder: 1,
      highlighted: false,
      revenueCatEntitlementId: 'pro_standard',
    },
  });

  await prisma.membershipPlan.create({
    data: {
      name: '进阶会员',
      level: 'advanced',
      price: 19800,
      yearlyPrice: 198000,
      period: 'month',
      durationDays: 30,
      features: ['所有标准功能', '无限 AI 点评', '录音上传', '错题分析', '专项突破', '优先客服'],
      sortOrder: 2,
      highlighted: true,
      revenueCatEntitlementId: 'pro_advanced',
    },
  });

  await auth.api.signUpEmail({
    body: {
      name: '普通用户',
      email: 'user@guideready.local',
      password: 'user123456',
    },
  });

  await auth.api.signUpEmail({
    body: {
      name: '管理员',
      email: 'z1309014381@gmail.com',
      password: 'admin123456',
    },
  });

  // 将管理员账号的 role 设为 admin
  const adminUser = await prisma.user.update({
    where: { email: 'z1309014381@gmail.com' },
    data: { role: 'admin' },
  });

  const normalUser = await prisma.user.findUnique({
    where: { email: 'user@guideready.local' },
  });

  // ──── 优惠券 Seed ────
  const couponNewUser = await prisma.coupon.create({
    data: {
      code: 'NEWUSER20',
      type: 'percentage',
      value: 20,
      minAmount: 9800,
      maxUses: 100,
      usedCount: 12,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2027-12-31'),
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: 'WELCOME10',
      type: 'fixed',
      value: 1000,
      maxUses: 50,
      usedCount: 8,
      validFrom: new Date(),
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: 'FREETRIAL7',
      type: 'free_trial',
      value: 7,
      maxUses: 200,
      usedCount: 45,
      validUntil: new Date('2027-06-30'),
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: 'VIP50',
      type: 'percentage',
      value: 50,
      minAmount: 19800,
      maxUses: 10,
      usedCount: 0,
      validFrom: new Date(),
      validUntil: new Date('2026-12-31'),
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: 'EXPIRED99',
      type: 'percentage',
      value: 99,
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-12-31'),
      isActive: false,
    },
  });

  // ──── 邀请码 Seed ────
  if (adminUser && normalUser) {
    const adminReferral = await prisma.referralCode.create({
      data: {
        userId: adminUser.id,
        code: 'ADMIN001',
        totalInvited: 3,
        totalReward: 9,
      },
    });

    const userReferral = await prisma.referralCode.create({
      data: {
        userId: normalUser.id,
        code: 'USER001',
        totalInvited: 1,
        totalReward: 3,
      },
    });

    // 模拟几个被邀请用户
    for (let i = 0; i < 3; i++) {
      const fakeEmail = `invited${i}@guideready.local`;
      const result = await auth.api.signUpEmail({
        body: {
          name: `被邀请用户${i + 1}`,
          email: fakeEmail,
          password: 'test123456',
        },
      });
      const invitedUserId = (result as any)?.user?.id;
      if (invitedUserId && adminReferral) {
        await prisma.referral.create({
          data: {
            referrerId: adminReferral.id,
            referredUserId: invitedUserId,
            rewardedAt: i < 2 ? new Date() : null,
          },
        });
      }
    }
  }

  // ──── 成就解锁 Seed ────
  if (adminUser && normalUser) {
    // 给管理员解锁大多数成就
    const allAchievements = [
      { key: 'first_practice', name: '初次练习', description: '完成第一次练习', icon: 'Play', category: 'practice', condition: { type: 'practice_count', threshold: 1 }, sortOrder: 1 },
      { key: 'practice_10', name: '学有所成', description: '累计完成 10 次练习', icon: 'BookOpen', category: 'practice', condition: { type: 'practice_count', threshold: 10 }, sortOrder: 2 },
      { key: 'practice_50', name: '勤奋刻苦', description: '累计完成 50 次练习', icon: 'PenLine', category: 'practice', condition: { type: 'practice_count', threshold: 50 }, sortOrder: 3 },
      { key: 'practice_100', name: '百题斩', description: '累计完成 100 次练习', icon: 'Zap', category: 'practice', condition: { type: 'practice_count', threshold: 100 }, sortOrder: 4 },
      { key: 'practice_500', name: '学神降临', description: '累计完成 500 次练习', icon: 'Crown', category: 'practice', condition: { type: 'practice_count', threshold: 500 }, sortOrder: 5 },
      { key: 'streak_3', name: '三日之约', description: '连续 3 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 3 }, sortOrder: 6 },
      { key: 'streak_7', name: '周而复始', description: '连续 7 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 7 }, sortOrder: 7 },
      { key: 'streak_30', name: '月度达人', description: '连续 30 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 30 }, sortOrder: 8 },
      { key: 'first_mock', name: '初试锋芒', description: '完成第一次模拟考试', icon: 'GraduationCap', category: 'mock', condition: { type: 'mock_count', threshold: 1 }, sortOrder: 9 },
      { key: 'mock_5', name: '身经百战', description: '完成 5 次模拟考试', icon: 'Trophy', category: 'mock', condition: { type: 'mock_count', threshold: 5 }, sortOrder: 10 },
      { key: 'mock_90', name: '九十分先生', description: '模拟考试得分 90 分以上', icon: 'Star', category: 'mock', condition: { type: 'mock_score', threshold: 90 }, sortOrder: 11 },
      { key: 'mock_100', name: '满分达人', description: '模拟考试满分 100 分', icon: 'Sparkles', category: 'mock', condition: { type: 'mock_score', threshold: 100 }, sortOrder: 12 },
      { key: 'favorite_10', name: '收藏达人', description: '收藏 10 道题目', icon: 'Heart', category: 'collection', condition: { type: 'favorite_count', threshold: 10 }, sortOrder: 13 },
      { key: 'word_20', name: '词汇大师', description: '生词本收集 20 个单词', icon: 'BookMarked', category: 'collection', condition: { type: 'word_count', threshold: 20 }, sortOrder: 14 },
    ];

    for (const a of allAchievements) {
      await prisma.achievement.upsert({
        where: { key: a.key },
        create: a,
        update: {},
      });
    }

    // 管理员解锁前 8 个成就
    const adminAchievements = await prisma.achievement.findMany({
      where: { sortOrder: { lte: 8 } },
    });
    for (const a of adminAchievements) {
      await prisma.userAchievement.create({
        data: {
          userId: adminUser.id,
          achievementId: a.id,
          unlockedAt: new Date(Date.now() - Math.random() * 30 * 86400000),
        },
      });
    }

    // 普通用户解锁前 3 个成就
    const userAchievements = await prisma.achievement.findMany({
      where: { sortOrder: { lte: 3 } },
    });
    for (const a of userAchievements) {
      await prisma.userAchievement.create({
        data: {
          userId: normalUser.id,
          achievementId: a.id,
          unlockedAt: new Date(),
        },
      });
    }
  }

  // ──── 反馈 Seed ────
  if (normalUser) {
    await prisma.feedback.create({
      data: {
        userId: normalUser.id,
        type: 'bug',
        content: '在练习页面中，TTS 自动播放有时会失效，需要手动点击播放按钮。希望修复这个问题。',
        contact: 'user@guideready.local',
        status: 'pending',
      },
    });

    await prisma.feedback.create({
      data: {
        userId: normalUser.id,
        type: 'suggestion',
        content: '建议增加夜间模式的自动切换功能，根据系统时间自动切换主题。',
        status: 'resolved',
        adminNote: '感谢建议！目前已经支持跟随系统主题（设置 → 外观 → 跟随系统）。',
      },
    });

    await prisma.feedback.create({
      data: {
        userId: normalUser.id,
        type: 'suggestion',
        content: '希望可以增加学习数据导出功能，方便打印和分享。',
        status: 'pending',
      },
    });
  }

  // ──── 排行榜 Seed：为所有用户生成练习记录和打卡数据 ────
  const allUsers = await prisma.user.findMany();
  for (const user of allUsers) {
    // 随机 0-30 条练习记录
    const practiceCount = Math.floor(Math.random() * 30) + 1;
    for (let i = 0; i < practiceCount; i++) {
      const randomQuestion = questionItems[Math.floor(Math.random() * questionItems.length)];
      if (randomQuestion) {
        try {
          await prisma.practiceRecord.create({
            data: {
              userId: user.id,
              questionId: randomQuestion.id,
              actionType: i % 3 === 0 ? 'listen' : i % 3 === 1 ? 'speak' : 'answer',
              createdAt: new Date(Date.now() - Math.random() * 30 * 86400000),
            },
          });
        } catch { /* ignore */ }
      }
    }

    // 全年随机天数的打卡（约 1/3 的天有记录）
    const uniqueDays = new Set<string>()
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const daysInYear = Math.floor((now.getTime() - yearStart.getTime()) / 86400000)
    const activeDayCount = Math.floor(Math.random() * daysInYear * 0.35) + 10 // ~35% active days
    for (let d = 0; d < activeDayCount; d++) {
      const day = new Date(yearStart)
      day.setDate(day.getDate() + Math.floor(Math.random() * daysInYear))
      const dayKey = day.toISOString().split('T')[0]
      if (!uniqueDays.has(dayKey)) {
        uniqueDays.add(dayKey)
        try {
          await prisma.dailyActivity.upsert({
            where: { userId_date: { userId: user.id, date: day } },
            create: { userId: user.id, date: day, count: Math.floor(Math.random() * 10) + 1 },
            update: {},
          })
        } catch { /* ignore */ }
      }
    }
  }

  // ──── 模拟考试记录 Seed ────
  for (const user of allUsers) {
    const examCount = Math.floor(Math.random() * 5);
    for (let i = 0; i < examCount; i++) {
      const paper = i % 2 === 0 ? standardPaper : intensePaper;
      try {
        await prisma.mockExamRecord.create({
          data: {
            userId: user.id,
            paperId: paper.id,
            score: Math.floor(Math.random() * 40) + 60,
            weakness: ['景点介绍', '应变能力'].slice(0, Math.random() > 0.5 ? 2 : 1),
            takenAt: new Date(Date.now() - Math.random() * 30 * 86400000),
          },
        });
      } catch { /* ignore */ }
    }
  }

  // ──── 收藏/生词 Seed ────
  for (const user of allUsers) {
    // 随机收藏题目
    const favCount = Math.floor(Math.random() * 8) + 1;
    const addedIds = new Set<string>();
    for (let i = 0; i < favCount; i++) {
      const q = questionItems[Math.floor(Math.random() * questionItems.length)];
      if (q && !addedIds.has(q.id)) {
        addedIds.add(q.id);
        try {
          await prisma.favoriteQuestion.create({
            data: { userId: user.id, questionId: q.id },
          });
        } catch { /* ignore */ }
      }
    }

    // 随机生词
    const wordCount = Math.floor(Math.random() * 10) + 1;
    const sampleWords = [
      { term: 'skyscraper', definition: '摩天大楼' },
      { term: 'heritage', definition: '遗产' },
      { term: 'concession', definition: '租界' },
      { term: 'artifacts', definition: '文物' },
      { term: 'itinerary', definition: '行程' },
      { term: 'hospitality', definition: '款待' },
      { term: 'dynasty', definition: '朝代' },
      { term: 'architecture', definition: '建筑' },
      { term: 'octagonal', definition: '八角形的' },
      { term: 'pavilion', definition: '亭子' },
      { term: 'memorial', definition: '纪念堂' },
      { term: 'observation deck', definition: '观景台' },
      { term: 'botanical garden', definition: '植物园' },
      { term: 'ancestral hall', definition: '宗祠' },
      { term: 'maritime trade', definition: '海上贸易' },
    ];
    const shuffled = [...sampleWords].sort(() => Math.random() - 0.5).slice(0, wordCount);
    for (const w of shuffled) {
      try {
        await prisma.vocabularyWord.create({
          data: { userId: user.id, term: w.term, definition: w.definition },
        });
      } catch { /* ignore */ }
    }
  }

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
