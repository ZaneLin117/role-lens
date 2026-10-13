import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseWorkbook,filterRows,emptyFilters,exportRows} from '../src/data.js';
const bytes=fs.readFileSync(process.argv[2]);const wb=parseWorkbook(bytes);const raw=XLSX.read(bytes);
for(const sheet of wb.sheets){
  const records=XLSX.utils.sheet_to_json(raw.Sheets[sheet.name],{range:sheet.headerRow-1,raw:false});
  assert.equal(sheet.rows.length,records.filter(r=>r.职位代码).length);
  const expected=records.filter(r=>(r.备注||'').includes('限应届毕业生报考')&&(r.备注||'').includes('限男性'));
  const actual=filterRows(sheet.rows,{...emptyFilters(),requirements:{fresh:'include',male:'include'}});
  for(const row of expected)assert.ok(actual.some(r=>r.cells.职位代码===row.职位代码));
  const exportBook=exportRows(sheet,actual);const exported=XLSX.utils.sheet_to_json(exportBook.Sheets.筛选结果);
  assert.equal(exported.length,actual.length);
  console.log(JSON.stringify({sheet:sheet.name,rows:sheet.rows.length,columns:sheet.columns.length,explicitFreshMale:expected.length,recognizedFreshMale:actual.length,verifiedExportRows:exported.length}));
}
console.log('跳过的工作表：'+wb.skipped.join('、'));
