import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseWorkbook, filterRows, emptyFilters} from '../src/data.js';

test('built-in 2027 workbook retains original bytes, both sheets and regional rows', () => {
  const metadata = JSON.parse(fs.readFileSync(new URL('../src/assets/national-2027.json', import.meta.url)));
  const bytes = gunzipSync(fs.readFileSync(new URL('../src/assets/national-2027.xls.gz', import.meta.url)));
  assert.equal(bytes.length, metadata.originalBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256);
  if (process.env.POSITION_WORKBOOK) assert.deepEqual(bytes, fs.readFileSync(process.env.POSITION_WORKBOOK));
  const workbook = parseWorkbook(bytes);
  assert.deepEqual(workbook.sheets.map(s => ({name:s.name, rows:s.rows.length, columns:s.columns.length, headerRow:s.headerRow})), metadata.sheets);
  assert.deepEqual(workbook.sheets.map(s => [s.name, s.rows.length]), [['总表',19426],['福建',686]]);
  const national = workbook.sheets[0];
  const fujian = filterRows(national.rows, {...emptyFilters(), columns:{工作地点:['福建省']}});
  assert.equal(fujian.length,686);
  assert.deepEqual(fujian.map(r=>r.cells), workbook.sheets[1].rows.map(r=>r.cells));
  assert.ok(national.rows.every(r=>r.cells.职位代码 && r.sourceRow >= 3));
});
