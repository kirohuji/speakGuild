const fs = require('fs');
const path = require('path');

// MD-defined core words per topic for foundation-2-daily-life
// Extracted from MD vocabulary tables (after our fixes above)
const doc2CoreMap = {
  // Topic 01: like, coffee, tea, milk, rice, noodles
  'coffee': '喜欢的吃喝', 'tea': '喜欢的吃喝', 'milk': '喜欢的吃喝',
  'rice': '喜欢的吃喝', 'noodles': '喜欢的吃喝', 'like': '喜欢的吃喝',
  // Topic 02: read, watch, listen, music, movies, sports
  'read': '喜欢的活动', 'watch': '喜欢的活动', 'listen': '喜欢的活动',
  'music': '喜欢的活动', 'movies': '喜欢的活动', 'sports': '喜欢的活动',
  // Topic 03: do, don't, prefer, favorite, spicy
  'do': '喜欢还是不喜欢', "don't": '喜欢还是不喜欢', 'prefer': '喜欢还是不喜欢',
  'favorite': '喜欢还是不喜欢', 'spicy': '喜欢还是不喜欢',
  // Topic 04: want, food, drink, laptop, camera, ticket
  'want': '我想要什么', 'food': '我想要什么', 'drink': '我想要什么',
  'laptop': '我想要什么', 'camera': '我想要什么', 'ticket': '我想要什么',
  // Topic 05: go, eat, rest, leave, come, join
  'go': '我想做什么', 'eat': '我想做什么', 'rest': '我想做什么',
  'leave': '我想做什么', 'come': '我想做什么', 'join': '我想做什么',
  // Topic 06: need, help, time, break, information, anything
  'need': '我真正需要什么', 'help': '我真正需要什么', 'time': '我真正需要什么',
  'break': '我真正需要什么', 'information': '我真正需要什么', 'anything': '我真正需要什么',
  // Topic 07: would, order, menu, table, chicken, please
  'would': '礼貌点单', 'order': '礼貌点单', 'menu': '礼貌点单',
  'table': '礼貌点单', 'chicken': '礼貌点单', 'please': '礼貌点单',
  // Topic 08: some, any, more, or, enough
  'some': '接受与拒绝', 'any': '接受与拒绝', 'more': '接受与拒绝',
  'or': '接受与拒绝', 'enough': '接受与拒绝',
  // Topic 09: bill, glass, fork, spoon
  'bill': '追加与结账', 'glass': '追加与结账', 'fork': '追加与结账', 'spoon': '追加与结账',
  // Topic 10: get up, breakfast, early, seven, eight
  'get up': '早晨', 'breakfast': '早晨', 'early': '早晨', 'seven': '早晨', 'eight': '早晨',
  // Topic 11: work, study, lunch, bus, office, school
  'work': '白天', 'study': '白天', 'lunch': '白天', 'bus': '白天',
  'office': '白天', 'school': '白天',
  // Topic 12: relax, night, weekend, visit, friends, Saturday
  'relax': '晚上与周末', 'night': '晚上与周末', 'weekend': '晚上与周末',
  'visit': '晚上与周末', 'friends': '晚上与周末', 'Saturday': '晚上与周末',
  // Topic 13: have, charger, umbrella, minute, use, borrow
  'have': '我有什么', 'charger': '我有什么', 'umbrella': '我有什么',
  'minute': '我有什么', 'use': '我有什么', 'borrow': '我有什么',
  // Topic 14: price, size, color, larger, smaller, try on
  'price': '询问商品', 'size': '询问商品', 'color': '询问商品',
  'larger': '询问商品', 'smaller': '询问商品', 'try on': '询问商品',
  // Topic 15: take, expensive, one
  'take': '选择与决定', 'expensive': '选择与决定', 'one': '选择与决定',
  // Topic 16: call, send, message, address, photo, back
  'call': '打电话与发消息', 'send': '打电话与发消息', 'message': '打电话与发消息',
  'address': '打电话与发消息', 'photo': '打电话与发消息', 'back': '打电话与发消息',
  // Topic 17: free, together, café, station, tonight, right
  'free': '确认时间地点', 'together': '确认时间地点', 'café': '确认时间地点',
  'station': '确认时间地点', 'tonight': '确认时间地点', 'right': '确认时间地点',
  // Topic 18: way, almost, late, running, arrive, wait
  'way': '在路上与迟到', 'almost': '在路上与迟到', 'late': '在路上与迟到',
  'running': '在路上与迟到', 'arrive': '在路上与迟到', 'wait': '在路上与迟到',
};

function parseCsvRow(r) {
  const cols = [];
  let inQ = false, cur = '';
  for (let c of r) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur);
  return cols;
}

function dedupCsv(pkgDir) {
  const csvPath = path.join(pkgDir, 'scene_vocabulary.csv');
  const csv = fs.readFileSync(csvPath, 'utf8');
  const rows = csv.trim().split('\n');
  const header = rows[0];

  const seen = new Map(); // word -> rowIndex (0-based in data rows)
  const toKeep = new Set();

  for (let i = 1; i < rows.length; i++) {
    const cols = parseCsvRow(rows[i]);
    const word = cols[2] || '';
    const topic = cols[1] || '';
    if (!word) continue;

    const existing = seen.get(word);
    if (existing === undefined) {
      // First occurrence - keep
      seen.set(word, i - 1); // 0-based data index
      toKeep.add(i - 1);
    } else {
      // Duplicate - decide which to keep
      const existingTopic = parseCsvRow(rows[existing + 1])[1] || '';
      const coreTopic = doc2CoreMap[word];

      if (coreTopic) {
        // This word has a defined core topic
        if (topic === coreTopic) {
          // Current row IS the core topic, swap: keep this, remove previous
          toKeep.delete(existing);
          toKeep.add(i - 1);
          seen.set(word, i - 1);
        }
        // else: keep existing (which may or may not be core)
      }
      // If no coreTopic defined, keep first occurrence (already kept)
    }
  }

  // Rebuild CSV
  const deduped = [header];
  for (let i = 0; i < rows.length - 1; i++) {
    if (toKeep.has(i)) {
      deduped.push(rows[i + 1]);
    }
  }

  const removed = rows.length - deduped.length;
  console.log(pkgDir + ': ' + (rows.length - 1) + ' -> ' + (deduped.length - 1) + ' rows (removed ' + removed + ' duplicates)');

  return deduped.join('\n') + '\n';
}

// Process Doc 1 and Doc 2
const packagesDir = path.join(__dirname, '..', 'data', 'packages');

// Doc 2 (has doc2CoreMap)
const doc2Result = dedupCsv(path.join(packagesDir, 'foundation-2-daily-life'));
fs.writeFileSync(path.join(packagesDir, 'foundation-2-daily-life', 'scene_vocabulary.csv'), doc2Result);

// Doc 1 - simple dedup (keep first occurrence)
function simpleDedup(pkgDir) {
  const csvPath = path.join(pkgDir, 'scene_vocabulary.csv');
  const csv = fs.readFileSync(csvPath, 'utf8');
  const rows = csv.trim().split('\n');
  const header = rows[0];
  const seen = new Set();
  const deduped = [header];

  for (let i = 1; i < rows.length; i++) {
    const cols = parseCsvRow(rows[i]);
    const word = cols[2] || '';
    if (!word) { deduped.push(rows[i]); continue; }
    if (!seen.has(word)) {
      seen.add(word);
      deduped.push(rows[i]);
    }
  }

  const removed = rows.length - deduped.length;
  console.log(pkgDir + ': ' + (rows.length - 1) + ' -> ' + (deduped.length - 1) + ' rows (removed ' + removed + ' duplicates)');

  return deduped.join('\n') + '\n';
}

const doc1Result = simpleDedup(path.join(packagesDir, 'foundation-1-beginner'));
fs.writeFileSync(path.join(packagesDir, 'foundation-1-beginner', 'scene_vocabulary.csv'), doc1Result);

console.log('\nDone! Both CSVs deduplicated.');
