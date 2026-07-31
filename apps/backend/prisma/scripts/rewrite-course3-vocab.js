/**
 * rewrite-course3-vocab.js — Course 3: 海外独立生活
 */
const fs = require('fs');
const path = require('path');
const PACKAGES_DIR = path.join(__dirname, '..', 'data', 'packages');
const MASTER_PATH = path.join(__dirname, '..', 'data', 'foundation-vocabulary-master.json');
const MD_PATH = path.join(PACKAGES_DIR, 'course-3-independent-living', '学习包的功能介绍.md');
const foundationSet = new Set(JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8')));
function check(w) { if (foundationSet.has(w.toLowerCase().trim())) throw new Error(`IN FOUNDATION: "${w}"`); }

const R = {
  'Topic 01 · 说明住房需求': {core:['one-bedroom','furnished','budget','requirements'],ext:['units','affordable'],supp:['walking-distance','landlord']},
  'Topic 02 · 看房提问': {core:['utilities','appliances','plumbing','separately'],ext:['landlord','inspected'],supp:['viewing','checkup']},
  'Topic 03 · 确认合同条件': {core:['terms','signing','notice-period','deposit'],ext:['landlord','agreeing'],supp:['legally','fine-print']},
  'Topic 04 · 报修沟通': {core:['lukewarm','heater','malfunction','dispatch'],ext:['unit','fixable'],supp:['repairman','maintenance']},
  'Topic 05 · 预约': {core:['practitioner','slots','discomfort','preferably'],ext:['morning-slots','booked'],supp:['registration','co-pay']},
  'Topic 06 · 描述症状经过': {core:['headache','neck','pain','desk-bound'],ext:['persistent','onset'],supp:['prescribed','worsening']},
  'Topic 07 · 听懂建议': {core:['sparingly','twice-daily','dosage','pharmacist'],ext:['instructions','comply'],supp:['overdose','warning-label']},
  'Topic 08 · 药物与复诊': {core:['prescription','refill','side-effects','follow-up'],ext:['pharmacy','dose'],supp:['allergic','timetable']},
  'Topic 09 · 开户与验证': {core:['checking-account','deposit','identification','activated'],ext:['minimum-balance','passport'],supp:['verify','banking']},
  'Topic 10 · 解释交易': {core:['merchant','statement','unauthorised','dispute'],ext:['transaction','unknown'],supp:['fraud','reversal']},
  'Topic 11 · 询问费用': {core:['waive','monthly-fee','hidden-charges','overdraft'],ext:['transparent','fee-structure'],supp:['waiver','account-type']},
  'Topic 12 · 处理账单差异': {core:['quoted','overcharged','discrepancy','rectify'],ext:['billing','error'],supp:['invoice','overpayment']},
  'Topic 13 · 规划路线': {core:['airport','contactless','fare','interchange'],ext:['timetable','nonstop'],supp:['navigate','transit']},
  'Topic 14 · 票务规则': {core:['single-ticket','return-ticket','validity','restrictions'],ext:['peak-hours','off-peak'],supp:['terms','refundable']},
  'Topic 15 · 延误改签': {core:['compensation','rebook','eligible','cancellation'],ext:['refund','alternate'],supp:['disrupted','rescheduled']},
  'Topic 16 · 租车与保险': {core:['compact-car','insurance','excess','penalty'],ext:['rental','mileage'],supp:['coverage','upgrade']},
  'Topic 17 · 填表和材料': {core:['registration','form','supporting-docs','processing'],ext:['countersign','photocopy'],supp:['paperwork','checkout']},
  'Topic 18 · 电话咨询': {core:['renewal','division','hotline','callback'],ext:['inquire','extension-number'],supp:['case-number','paperwork']},
  'Topic 19 · 预约办理': {core:['earliest-slot','confirmation','in-person','booked'],ext:['walk-in','reschedule'],supp:['availability','notification']},
  'Topic 20 · 社区资源': {core:['community-centre','public-library','membership','programmes'],ext:['newcomer','leaflet'],supp:['amenities','free-of-charge']}
};

console.log('Verifying Course 3...');
let errors=[], total=0;
for(const[t,v]of Object.entries(R)){for(const w of[...v.core,...v.ext,...v.supp]){total++;try{check(w)}catch(e){errors.push(`${t}: ${e.message}`)}}}
if(errors.length>0){console.log('❌',errors.length,'errors:');errors.forEach(e=>console.log('  '+e));process.exit(1)}
console.log(`✅ All ${total} words safe.\n`);

let content=fs.readFileSync(MD_PATH,'utf8'); let c=0;
for(const[t,v]of Object.entries(R)){
  const h=`### ${t}`; const s=content.indexOf(h); if(s===-1){console.log('  ⚠ Not found:',t);continue}
  const a=content.substring(s+h.length); const nm=a.match(/\n### Topic \d{2}/);
  const e=nm?s+h.length+nm.index:content.length; const sec=content.substring(s,e);
  let ns=sec.replace(/(- \*\*核心词（Vocabulary）\*\*[：:]\s*).+?([。\n])/,`- **核心词（Vocabulary）**：\`${v.core.join('`，`')}\`。\n`);
  ns=ns.replace(/(- \*\*扩展词（Extension）\*\*[：:]\s*).+?([。\n])/,`- **扩展词（Extension）**：\`${v.ext.join('`，`')}\`；补充词：\`${v.supp.join('`，`')}\`。\n`);
  if(ns!==sec){content=content.replace(sec,ns);c++;console.log('  ✓',t)}
}
fs.writeFileSync(MD_PATH,content,'utf8');
console.log(`\n✅ ${c} topics updated.`);
