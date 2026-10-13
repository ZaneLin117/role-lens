import * as XLSX from 'xlsx';
import {isLocationColumn, matchesLocation} from './locations.js';

export const clean = value => String(value ?? '').replace(/\r/g, '').trim();
export const normalized = value => clean(value).replace(/[\s\u3000]/g, '');
const aliases = {
  department: ['部门名称','招录机关','招录单位','单位名称'], bureau: ['用人司局','用人单位'],
  title: ['招考职位','职位名称','岗位名称','招录职位'], code: ['职位代码','岗位代码'],
  count: ['招考人数','招录人数','招聘人数'], major: ['专业','专业要求'], education: ['学历','学历要求'],
  degree: ['学位','学位要求'], politics: ['政治面貌'], years: ['基层工作最低年限','基层工作经历','工作年限'],
  service: ['服务基层项目工作经历'], location: ['工作地点','工作地区','工作地'], notes: ['备注','其他条件','其他要求'],
  category: ['考试类别'], test: ['是否在面试阶段组织专业能力测试','专业能力测试'],
};
export function columnFor(columns, field) {return columns.find(c => (aliases[field] || []).includes(normalized(c))) || '';}
const headerWords = new Set(Object.values(aliases).flat().concat(['部门代码','机构性质','机构层级','职位属性','职位分布','职位简介','面试人员比例']));
export function detectHeader(matrix) {
  let best = -1, score = 0;
  matrix.slice(0, 40).forEach((row, index) => {
    const words = row.map(normalized); const matches = words.filter(w => headerWords.has(w)).length;
    if (matches > score) {score = matches; best = index;}
  });
  // Generic tables: use the first row with at least two populated labels.
  if (score < 2) best = matrix.slice(0, 40).findIndex(row => row.filter(v => clean(v)).length >= 2);
  return best;
}

export function extractRequirements(text) {
  const t = normalized(clean(text).replace(/\n/g, '；')).replace(/不(?:仅|只)?限(?:应届(?:高校)?毕业生|20\d{2}(?:年)?届(?:高校)?毕业生)/g, '未限定毕业身份'); const tags = []; const evidence = {};
  const add = (id, pattern) => {const match = t.match(pattern); if (match) {tags.push(id); evidence[id] = match[0];}};
  add('fresh', /(?<!不)(?:仅限|只限|限|须为|必须为|招录对象为|招考对象为|面向)(?:(?:20\d{2}|当年|本年度)年?)?(?:普通高校|普通高等学校|高校)?应届(?:高校)?毕业生(?:报考)?|(?:^|[；;。，,]|\d[.、])应届(?:高校)?毕业生(?=$|[，,；;。:：（(]|报考)/);
  add('cohort', /(?<!不)(?:仅限|只限|限|须为|必须为|招录对象为|招考对象为|面向)20\d{2}(?:年)?届(?:普通高校|高校)?毕业生(?:报考)?|(?:^|[；;。，,]|\d[.、])20\d{2}(?:年)?届(?:普通高校|高校)?毕业生(?=$|[，,；;。:：（(])/);
  add('male', /(?<!不|无)(?:仅限|只限|限|须为|必须为|招录对象为)男性(?:报考)?|(?:^|[；;。，,]|\d[.、])男性(?=$|[；;。，,])/);
  add('female', /(?<!不|无)(?:仅限|只限|限|须为|必须为|招录对象为)女性(?:报考)?|(?:^|[；;。，,]|\d[.、])女性(?=$|[；;。，,])/);
  add('maleSuitable', /适合男性(?:报考)?/); add('femaleSuitable', /适合女性(?:报考)?/);
  add('cet4', /(?:大学)?英语(?:四级|4级)|CET[-－]?4/i);
  add('cet6', /(?:大学)?英语(?:六级|6级)|CET[-－]?6/i);
  add('law', /(?:法律职业资格|司法考试|法律资格)/);
  add('certificate', /(?:取得|持有|具有|具备|须有|须取得).{0,18}(?:资格证|执业证|职业资格|资格考试)/);
  add('household', /(?:限|须|要求|具有|具备).{0,24}(?:户籍|户口|生源)|(?:户籍|生源).{0,18}(?:限|要求|须)|[^，,；;。]{1,12}(?:市|省|区|县)(?:户口|户籍|生源)/);
  add('serviceYears', /(?:最低|最短|至少)?服务(?:期|年限)(?:为|满|不少于|不低于|至少|最低)?[一二三四五六七八九十\d]+年/);
  add('physical', /体能(?:测评|测试)|体能考核/);
  add('night', /夜班|夜间值班|倒班|轮班/);
  add('travel', /经常出差|长期出差|频繁出差/);
  let gender = tags.includes('male') && tags.includes('female') ? '需核对原文' : tags.includes('male') ? '限男性' : tags.includes('female') ? '限女性' : tags.includes('maleSuitable') ? '适合男性' : tags.includes('femaleSuitable') ? '适合女性' : /性别不限|不限性别|男女不限/.test(t) ? '明确不限' : '未注明';
  if (/不(?:仅|只)限(?:男性|女性)|(?:男性|女性).{0,5}均可/.test(t)) {gender = '明确不限'; for (const id of ['male','female']) {const idx=tags.indexOf(id); if(idx>=0) tags.splice(idx,1); delete evidence[id];}}
  return {tags, evidence, gender, fresh: tags.includes('fresh') || tags.includes('cohort') ? '有要求' : '未注明'};
}
export const requirementOptions = [
  ['fresh','限应届毕业生'],['cohort','指定毕业届别'],['male','限男性'],['female','限女性'],['maleSuitable','适合男性'],['femaleSuitable','适合女性'],
  ['cet4','英语四级'],['cet6','英语六级'],['law','法律职业资格'],['certificate','资格证书'],['household','户籍 / 生源要求'],
  ['serviceYears','最低服务年限'],['physical','体能测评'],['night','夜班 / 轮班'],['travel','经常出差'],
];

export function parseMatrix(matrix, name) {
  const header = detectHeader(matrix); if (header < 0) return null;
  const seen = new Map();
  const columns = matrix[header].map((value, i) => {
    const base = normalized(value) || `未命名列${i + 1}`;
    const n = (seen.get(base) || 0) + 1; seen.set(base, n); return n > 1 ? `${base} (${n})` : base;
  });
  const fields = Object.fromEntries(Object.keys(aliases).map(f => [f, columnFor(columns, f)]));
  const rows = [];
  for (let i = header + 1; i < matrix.length; i++) {
    const values = matrix[i]; if (!values.some(v => clean(v))) continue;
    if (values.filter(v => headerWords.has(normalized(v))).length >= 3) continue;
    const cells = Object.fromEntries(columns.map((col, j) => [col, clean(values[j])]));
    if (fields.code && !cells[fields.code]) continue;
    const notes = cells[fields.notes] || '';
    rows.push({id: `${name}:${i + 1}`, sourceRow: i + 1, cells, requirements: extractRequirements(notes), search: Object.values(cells).join(' ').toLowerCase()});
  }
  return rows.length ? {name, columns, fields, rows, headerRow: header + 1} : null;
}
export function parseWorkbook(bytes) {
  const wb = XLSX.read(bytes, {type: 'array', cellDates: false});
  const sheets = [], skipped = [];
  for (const name of wb.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], {header: 1, defval: '', raw: false, blankrows: true});
    const sheet = parseMatrix(matrix, name); if (sheet) sheets.push(sheet); else skipped.push(name);
  }
  if (!sheets.length) throw new Error('没有找到可读取的数据。请确认工作表包含表头和数据行。');
  return {sheets, skipped};
}
export function filterRows(rows, filters, favorites = new Set()) {
  const words = normalized(filters.query).toLowerCase().split(/[，,]/).filter(Boolean);
  return rows.filter(row => {
    if (filters.onlyFavorites && !favorites.has(row.id)) return false;
    if (words.some(w => !normalized(row.search).includes(w))) return false;
    if (Object.entries(filters.columns || {}).some(([col, choices]) => choices.length && !(isLocationColumn(col) ? matchesLocation(row.cells[col], choices) : choices.includes(row.cells[col] || '')))) return false;
    if (Object.entries(filters.text || {}).some(([col, term]) => term && !normalized(row.cells[col]).toLowerCase().includes(normalized(term).toLowerCase()))) return false;
    if (filters.gender && row.requirements.gender !== filters.gender) return false;
    if (filters.fresh && row.requirements.fresh !== filters.fresh) return false;
    if (Object.entries(filters.requirements || {}).some(([id, mode]) => mode === 'include' ? !row.requirements.tags.includes(id) : mode === 'exclude' && row.requirements.tags.includes(id))) return false;
    const count = Number(row.cells[filters.countColumn]);
    if (filters.minCount !== '' && filters.minCount !== undefined && (!Number.isFinite(count) || count < Number(filters.minCount))) return false;
    return true;
  });
}
export const emptyFilters = () => ({query: '', columns: {}, text: {}, requirements: {}, gender: '', fresh: '', minCount: '', onlyFavorites: false});
export function exportRows(sheet, rows, assessments) {
  const matchingHeaders=assessments?['个人匹配状态','排除原因','待核对条件','已匹配条件']:[];
  const names={matched:'基础匹配',review:'待核对',excluded:'已排除'};
  const matrix = [sheet.columns.concat(['识别的备注要求','来源工作表','原表行号'],matchingHeaders), ...rows.map(row => {
    const a=assessments?.get(row.id);
    const matchingValues=assessments?[names[a?.status]||'未评估',a?.excluded.map(c=>`${c.field}：${c.message}`).join('；')||'',a?.pending.map(c=>`${c.field}：${c.message}`).join('；')||'',a?.passed.map(c=>`${c.field}：${c.message}`).join('；')||'']:[];
    return sheet.columns.map(c => row.cells[c]).concat([requirementOptions.filter(([id]) => row.requirements.tags.includes(id)).map(([, label]) => label).join('、'), sheet.name, row.sourceRow],matchingValues);
  })];
  const result = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(matrix);
  ws['!cols'] = matrix[0].map(c => ({wch: /备注|专业|简介/.test(c) ? 60 : 24}));
  ws['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: rows.length, c: matrix[0].length - 1}})};
  XLSX.utils.book_append_sheet(result, ws, '筛选结果'); return result;
}
