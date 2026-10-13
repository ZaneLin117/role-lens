import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {detectHeader,parseMatrix,parseWorkbook,extractRequirements,filterRows,emptyFilters,exportRows} from '../src/data.js';

test('find header after title, preserve codes, ignore repeated headers and summary rows',()=>{
  const matrix=[['说明文字'],[],['部门名称','职位代码','招考人数','学历','备注'],['税务局','001020','3','本科及以上','应届高校毕业生，男性'],['部门名称','职位代码','招考人数','学历','备注'],['合计','','3']];
  const sheet=parseMatrix(matrix,'总表');assert.equal(detectHeader(matrix),2);assert.equal(sheet.rows.length,1);assert.equal(sheet.rows[0].cells.职位代码,'001020');assert.equal(sheet.rows[0].sourceRow,4);assert.deepEqual(sheet.rows[0].requirements.tags,['fresh','male']);
});
test('blank workbooks are rejected; duplicate header names remain addressable',()=>{
  assert.equal(parseMatrix([],'empty'),null); const s=parseMatrix([['名称','名称'],['A','B']],'generic');assert.deepEqual(s.columns,['名称','名称 (2)']);assert.equal(s.rows[0].cells['名称 (2)'],'B');
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([]),'空白');assert.throws(()=>parseWorkbook(XLSX.write(wb,{type:'array',bookType:'xlsx'})),/没有找到/);
});
test('explicit and standalone requirements, specified cohorts and suitability stay distinct',()=>{
  assert.deepEqual(extractRequirements('限应届毕业生报考；工作强度大，限男性').tags,['fresh','male']);
  assert.deepEqual(extractRequirements('应届高校毕业生，在本单位最低服务年限为5年，女性').tags,['fresh','female','serviceYears']);
  assert.deepEqual(extractRequirements('1.限2027届高校毕业生报考；2.男性；3.参加体能测评').tags,['cohort','male','physical']);
  assert.equal(extractRequirements('适合男性报考').gender,'适合男性');assert.equal(extractRequirements('限女性').gender,'限女性');
});
test('negative or conditional graduation and gender mentions are not restrictions',()=>{
  for(const text of ['非应届毕业生须有2年以上工作经历','招考对象可为应届高校毕业生，非应届毕业生须有2年工作经历','不限应届毕业生','不只限应届毕业生','不限2027届高校毕业生','如考生为2027届高校毕业生，请注明']) assert.equal(extractRequirements(text).fresh,'未注明',text);
  for(const text of ['男女不限','不限男性','不只限男性','男性和女性均可']) assert.ok(!extractRequirements(text).tags.includes('male'),text);
  assert.equal(extractRequirements('男女不限').gender,'明确不限');assert.equal(extractRequirements('男性优先').gender,'未注明');
});
const sheet=parseMatrix([['部门名称','职位代码','招考人数','学历','专业','备注'],['甲','001','2','本科','计算机','限应届毕业生报考；限男性'],['乙','002','5','硕士','法学','限女性；英语六级'],['甲','003','1','本科','软件工程','无限制']],'样表');
test('filters combine AND across fields and OR within selected values, include/exclude remarks',()=>{
  assert.equal(filterRows(sheet.rows,{...emptyFilters(),columns:{学历:['本科','硕士']}}).length,3);
  assert.deepEqual(filterRows(sheet.rows,{...emptyFilters(),columns:{学历:['本科']},text:{专业:'计算机'},requirements:{fresh:'include',female:'exclude'}}).map(r=>r.cells.职位代码),['001']);
  assert.equal(filterRows(sheet.rows,{...emptyFilters(),requirements:{male:'include',female:'include'}}).length,0);
  assert.equal(filterRows(sheet.rows,{...emptyFilters(),countColumn:'招考人数',minCount:'3'})[0].cells.职位代码,'002');
  assert.equal(filterRows(sheet.rows,{...emptyFilters(),onlyFavorites:true},new Set(['样表:4']))[0].cells.职位代码,'003');
  assert.equal(filterRows(sheet.rows,{...emptyFilters(),query:'甲,计算机'}).length,1);
});
test('export includes all source columns, rows beyond current page, provenance and string codes',()=>{
  const wb=exportRows(sheet,sheet.rows);const reimport= XLSX.read(XLSX.write(wb,{type:'array',bookType:'xlsx'}),{type:'array'});const raw=XLSX.utils.sheet_to_json(reimport.Sheets.筛选结果,{header:1,raw:false});
  assert.equal(raw.length,4);assert.equal(raw[1][1],'001');assert.deepEqual(raw[0],sheet.columns.concat(['识别的备注要求','来源工作表','原表行号']));assert.equal(raw[1].at(-2),'样表');assert.equal(raw[1].at(-1),'2');
});
