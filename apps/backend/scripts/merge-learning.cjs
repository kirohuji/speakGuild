const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const docsRoot = path.resolve(__dirname, '../../docs-md');
const canonical = (value) => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  return typeof value === 'string' ? value.normalize('NFC').trim() : value;
}
function merge(left, right, location = 'learning') {
  if (left === undefined) {
    if (Array.isArray(right)) return merge([], right, location);
    if (right && typeof right === 'object') return merge({}, right, location);
    return right;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const result = [...left];
    for (const entry of right) {
      if (location === 'learning.exercises.pipeline') {
        if (!entry || typeof entry.key !== 'string' || !entry.key.trim()) throw new Error(`${location}: 题组缺少稳定 key`);
        const index = result.findIndex(item => item.key === entry.key);
        if (index >= 0) { result[index] = merge(result[index], entry, `${location}[${entry.key}]`); continue; }
      }
      const cleaned = merge(undefined, entry, `${location}[]`);
      if (!result.some(item => canonical(item) === canonical(cleaned))) result.push(cleaned);
    }
    return result;
  }
  if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    const result = { ...left };
    for (const [key, value] of Object.entries(right)) result[key] = merge(result[key], value, `${location}.${key}`);
    return result;
  }
  if (canonical(left) !== canonical(right)) throw new Error(`${location}: 配置冲突，请先统一分组文件中的值`);
  return left;
}
function walk(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (predicate(file, entry)) return [file];
    return entry.isDirectory() ? walk(file, predicate) : [];
  });
}
function build(directory) {
  const files = walk(directory, (file, entry) => entry.isFile() && /\.ya?ml$/i.test(file));
  if (!files.length) throw new Error(`${directory}: 没有 YAML 分组文件`);
  let learning = {};
  for (const file of files) {
    try {
      const doc = yaml.load(fs.readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA });
      if (!doc || typeof doc.learning !== 'object' || Array.isArray(doc.learning) || doc.learning === null || Object.keys(doc).some(key => key !== 'learning')) throw new Error('文件必须只包含 learning 对象');
      learning = merge(learning, doc.learning);
    } catch (error) { throw new Error(`${file}: ${error.message}`); }
  }
  const output = `${directory}.md`;
  if (!fs.existsSync(directory.replace(/\.learning$/, '.md'))) throw new Error(`${directory}: 缺少对应教学正文`);
  return { output, content: `---\n${yaml.dump({ learning }, { lineWidth: -1, noRefs: true, quotingType: "'" })}---\n` };
}
function main(args) {
  const check = args.includes('--check');
  const targets = args.filter(arg => arg !== '--check');
  const directories = targets.length ? targets.map(target => path.resolve(process.env.INIT_CWD || process.cwd(), target).replace(/\.learning\.md$/, '.learning')) : walk(docsRoot, (file, entry) => entry.isDirectory() && file.endsWith('.learning'));
  // 全部解析成功后才写入，配置冲突不会留下部分更新。
  const outputs = directories.map(build);
  let stale = false;
  for (const { output, content } of outputs) {
    if (fs.existsSync(output) && fs.readFileSync(output, 'utf8') === content) continue;
    if (check) { console.error(`需要合并：${output}`); stale = true; }
    else fs.writeFileSync(output, content);
  }
  console.log(`${check ? '检查' : '合并去重'}完成：${outputs.length} 个话题`);
  if (stale) process.exitCode = 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { merge, build };
