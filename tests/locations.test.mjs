import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatrix, filterRows, emptyFilters, exportRows} from '../src/data.js';
import {filterOptions} from '../src/locations.js';
import * as XLSX from 'xlsx';

const locations = ['福建省', '福建省福州市', '福建省福州市仓山区', '福建省福州市福清市', '福建省厦门市思明区', '福建省平潭县', '江西省抚州市临川区', '', '福州市'];
const sheet = parseMatrix([
  ['职位代码', '工作地点', '落户地点', '部门名称'],
  ...locations.map((location, i) => [String(i), location, location, location]),
], '地点');
const select = (choices, column = '工作地点') => filterRows(sheet.rows, {...emptyFilters(), columns: {[column]: choices}});

test('province and city include descendants; county-only addresses belong to their explicit province', () => {
  assert.deepEqual(select(['福建省']).map(r => r.cells.职位代码), ['0', '1', '2', '3', '4', '5']);
  assert.deepEqual(select(['福建省福州市']).map(r => r.cells.职位代码), ['1', '2', '3']);
  assert.equal(select(['福建省', '福建省福州市', '福建省福州市仓山区']).length, 6);
  assert.equal(select(['福建省福州市仓山区']).length, 1);
  assert.equal(select(['福建省'], '落户地点').length, 6);
  assert.equal(select(['福建省'], '部门名称').length, 1);
  assert.equal(select(['']).length, 1);
  // A bare city name has no source evidence of which province it belongs to.
  assert.equal(select(['福州市']).length, 1);
});

test('option counts match results and generate missing province/city parents', () => {
  for (const [value, count] of filterOptions(sheet.rows, '工作地点')) assert.equal(count, select([value]).length, value);
  const descendantOnly = sheet.rows.filter(r => r.cells.职位代码 === '2');
  assert.deepEqual(new Map(filterOptions(descendantOnly, '工作地点')), new Map([
    ['福建省', 1], ['福建省福州市', 1], ['福建省福州市仓山区', 1],
  ]));
  assert.deepEqual(new Map(filterOptions(descendantOnly, '部门名称')), new Map([['福建省福州市仓山区', 1]]));
});

test('municipalities and autonomous regions include explicit subregions', () => {
  const s = parseMatrix([['职位代码', '工作地点'], ['1', '北京市海淀区'], ['2', '广西壮族自治区南宁市青秀区'], ['3', '新疆维吾尔自治区伊犁哈萨克自治州霍城县']], '自治区');
  const options = new Map(filterOptions(s.rows, '工作地点'));
  for (const region of ['北京市', '广西壮族自治区', '广西壮族自治区南宁市', '新疆维吾尔自治区', '新疆维吾尔自治区伊犁哈萨克自治州']) {
    assert.equal(options.get(region), 1, region);
    assert.equal(filterRows(s.rows, {...emptyFilters(), columns: {工作地点: [region]}}).length, 1);
  }
});

test('export keeps original location text after a province selection', () => {
  const exported = exportRows(sheet, select(['福建省']));
  const records = XLSX.utils.sheet_to_json(exported.Sheets.筛选结果);
  assert.deepEqual(records.map(r => r.工作地点), locations.slice(0, 6));
});
