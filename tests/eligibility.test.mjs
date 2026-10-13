import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {parseMatrix,parseWorkbook,exportRows} from '../src/data.js';
import {newProfile,lookupMajor,allowedEducation,assessRow,assessSheet,validateProfile} from '../src/eligibility.js';

const columns=['职位代码','专业','学历','学位','政治面貌','基层工作最低年限','服务基层项目工作经历','备注'];
function makeRow(overrides={}){const values={职位代码:'001',专业:'0809计算机类',学历:'本科及以上',学位:'与最高学历相对应的学位',政治面貌:'不限',基层工作最低年限:'无限制',服务基层项目工作经历:'无限制',备注:'',...overrides};const sheet=parseMatrix([columns,columns.map(c=>values[c])],'test');return {row:sheet.rows[0],fields:sheet.fields,sheet};}
function person(overrides={}){return {...newProfile(),gender:'男性',politics:'群众',fresh:'yes',workYears:'0',service:'none',records:[{level:'本科',degree:'学士',major:'网络工程',code:'080903',graduationYear:'2027',fullTime:'yes'}],...overrides};}
function result(overrides={},profile=person()){const {row,fields}=makeRow(overrides);return assessRow(row,fields,profile);}

test('network engineering resolves to undergraduate computer class; exact major is not interchangeable',()=>{
  assert.equal(lookupMajor('网络工程').categoryCode,'0809');
  assert.equal(result().status,'matched');
  assert.equal(result().candidate,true);
  assert.equal(result({专业:'0301法学类、0305马克思主义理论类、0807电子信息类、0809计算机类'}).status,'matched');
  assert.equal(result({专业:'080901计算机科学与技术'}).status,'excluded');
  assert.equal(result({专业:'0807电子信息类'}).status,'excluded');
  assert.equal(result({专业:'网络工程'}).status,'matched');
  assert.equal(result({专业:'0809计算机类（仅限网络安全方向）'}).status,'review');
  assert.equal(result({专业:'0809计算机类（软件工程、计算机科学与技术）'}).checks.find(c=>c.field==='专业').state,'review');
  assert.equal(result({专业:'0809计算机类（软件工程、计算机科学与技术）'}).candidate,false);
  assert.equal(result({专业:'0809计算机类（仅限软件工程）'}).status,'excluded');
  assert.equal(result({专业:'0809计算机类（不含网络工程）'}).status,'excluded');
});
test('education exact/OR/minimum scopes and corresponding degree differ',()=>{
  assert.deepEqual(allowedEducation('仅限本科'),[1]);assert.deepEqual(allowedEducation('本科或硕士研究生'),[1,2]);assert.deepEqual(allowedEducation('硕士研究生及以上'),[2,3]);
  const master=person({records:[{level:'硕士研究生',degree:'硕士',major:'计算机科学与技术',code:'0812',graduationYear:'2027',fullTime:'yes'}]});
  assert.equal(result({学历:'仅限本科'},master).status,'excluded');
  assert.equal(result({学位:'与最高学历相对应的学位'},person({records:[{...person().records[0],degree:'无学位'}]})).status,'excluded');
  assert.ok(result({学位:''}).pending.some(c=>c.field==='学位'));
});
test('undergraduate and postgraduate codes cannot be conflated; per-stage majors are matched',()=>{
  const electronic=person({records:[{level:'硕士研究生',degree:'硕士',major:'电子科学与技术',code:'0809',graduationYear:'2027'}]});
  assert.equal(result({},electronic).checks.find(c=>c.field==='专业').state,'review');
  assert.equal(result({专业:'本科：0809计算机类；研究生：0809电子科学与技术'},electronic).checks.find(c=>c.field==='专业').state,'pass');
  assert.equal(result({专业:'本科：0809计算机类；研究生：0301法学'},electronic).status,'excluded');
});
test('additional academic records help only when stage allowed; highest-degree restriction overrides',()=>{
  const p=person({records:[{level:'硕士研究生',degree:'硕士',major:'法学',code:'0301',graduationYear:'2027'},...person().records]});
  assert.equal(result({专业:'本科：0809计算机类；研究生：0812计算机科学与技术'},p).checks.find(c=>c.field==='专业').state,'pass');
  assert.equal(result({专业:'本科：0809计算机类；研究生：0812计算机科学与技术',备注:'职位要求专业为报考者最高学历对应专业。'},p).status,'excluded');
});
test('fresh status is not inferred from year; unknowns remain review',()=>{
  assert.equal(result({备注:'限应届毕业生报考'},person({fresh:'no'})).status,'excluded');
  assert.equal(result({备注:'限应届毕业生报考'},person({fresh:'unknown'})).status,'review');
  assert.equal(result({备注:'限2027届高校毕业生'},person({records:[{...person().records[0],graduationYear:'2026'}]})).status,'excluded');
  assert.ok(!result({备注:'限2027届高校毕业生'},person({fresh:'no'})).excluded.some(c=>c.field==='应届身份'));
  assert.ok(!result({备注:'非应届毕业生须有2年相关工作经历'},person({fresh:'no'})).excluded.some(c=>c.field==='应届身份'));
});
test('gender, party membership including probationary status, and work minima are enforced',()=>{
  assert.equal(result({备注:'限女性'}).status,'excluded');
  assert.equal(result({备注:'适合男性报考'},person({gender:'女性'})).status,'review');
  assert.equal(result({政治面貌:'中共党员或共青团员'}).status,'excluded');
  assert.equal(result({政治面貌:'中共党员'},person({politics:'中共预备党员'})).status,'matched');
  assert.equal(result({政治面貌:'中共党员',备注:'仅限正式党员'},person({politics:'中共预备党员'})).status,'excluded');
  assert.equal(result({基层工作最低年限:'二年'},person({workYears:'1.9'})).status,'excluded');
  assert.equal(result({基层工作最低年限:'二年'},person({workYears:'2'})).status,'matched');
});
test('directional projects are OR; no experience, incomplete service and short military service exclude',()=>{
  const project='大学生村官、“三支一扶”计划、大学生志愿服务西部计划、在军队服役5年（含）以上的高校毕业生退役士兵';
  assert.equal(result({服务基层项目工作经历:project}).status,'excluded');
  assert.equal(result({服务基层项目工作经历:project},person({service:'three',serviceCompleted:'yes'})).status,'matched');
  assert.equal(result({服务基层项目工作经历:project},person({service:'three',serviceCompleted:'no'})).status,'excluded');
  assert.equal(result({服务基层项目工作经历:project},person({service:'soldier',militaryYears:'4'})).status,'excluded');
  assert.equal(result({服务基层项目工作经历:project},person({service:'soldier',militaryYears:'5'})).status,'review');
});
test('explicit English thresholds and legal grades match; OR alternatives do not falsely exclude',()=>{
  assert.equal(result({备注:'大学英语六级成绩达到425分及以上'},person({cet6:'400'})).status,'excluded');
  assert.equal(result({备注:'须通过大学英语六级'},person({cet6:'0'})).status,'excluded');
  assert.ok(result({备注:'大学英语六级成绩达到425分及以上'},person({cet6:'425'})).passed.some(c=>c.field==='英语水平'));
  assert.ok(!result({备注:'大学英语六级成绩425分及以上或雅思6.5分及以上'},person({cet6:'0'})).excluded.some(c=>c.field==='英语水平'));
  assert.ok(!result({备注:'大学英语四级425分或英语六级425分'},person({cet4:'500',cet6:'0'})).excluded.some(c=>c.field==='英语水平'));
  assert.equal(result({备注:'取得A类法律职业资格证书'},person({law:'B'})).status,'excluded');
});
test('unrecognized major, household and supplemental requirements stay review',()=>{
  const p=person({records:[{...person().records[0],major:'学校自设网络技术专业',code:''}]});
  assert.equal(result({},p).status,'review');
  assert.equal(result({},p).candidate,false);
  assert.equal(result({备注:'限福建省户籍'},person({household:'北京市'})).status,'review');
  assert.equal(result({备注:'其他报名条件详见补充公告。'}).status,'review');
});
test('2027 national age is explicit, scope-specific, with graduating masters exception',()=>{
  assert.equal(result({},person({examRule:'national2027',birthMonth:'2010-01'})).status,'excluded');
  assert.equal(result({},person({examRule:'table',birthMonth:'2010-01'})).status,'matched');
  assert.equal(result({},person({examRule:'national2027',birthMonth:'1998-06'})).status,'matched');
  const master=person({examRule:'national2027',birthMonth:'1985-06',records:[{level:'硕士研究生',degree:'硕士',major:'计算机科学与技术',code:'0812',graduationYear:'2027',fullTime:'yes'}]});
  assert.ok(result({专业:'研究生：0812计算机科学与技术'},master).passed.some(c=>c.field==='公告年龄'));
  assert.ok(result({专业:'研究生：0812计算机科学与技术'}, {...master,fresh:'unknown'}).pending.some(c=>c.field==='公告年龄'));
});
test('profile validation rejects inconsistent major code, impossible degree, incomplete service',()=>{
  assert.deepEqual(validateProfile(person()),[]);
  assert.ok(validateProfile(person({records:[{...person().records[0],code:'080902'}]})).some(e=>e.includes('不一致')));
  assert.ok(validateProfile(person({records:[{...person().records[0],degree:'博士'}]})).some(e=>e.includes('学位不能高于')));
  assert.ok(validateProfile(person({service:'soldier',militaryYears:''})).length>0);
});
test('export matching decisions without personal details and leave original export shape unchanged',()=>{
  const {sheet}=makeRow();const p=person({birthMonth:'1998-06'});const a=assessSheet(sheet,p);const wb=exportRows(sheet,sheet.rows,a);const raw=XLSX.utils.sheet_to_json(wb.Sheets.筛选结果);
  assert.equal(raw[0].个人匹配状态,'基础匹配');assert.ok(!JSON.stringify(raw).includes('1998-06'));
  assert.ok(!XLSX.utils.sheet_to_json(exportRows(sheet,sheet.rows).Sheets.筛选结果)[0].个人匹配状态);
});

test('provided workbook excludes all three directional Fujian railway positions for ordinary network graduate',()=>{
  if(!process.env.POSITION_WORKBOOK)return;
  const sheet=parseWorkbook(fs.readFileSync(process.env.POSITION_WORKBOOK)).sheets.find(s=>s.name==='福建');
  const assessments=assessSheet(sheet,person({politics:'共青团员'}));
  for(const code of ['300130855020','300130855021','300130855032']) {const r=sheet.rows.find(r=>r.cells.职位代码===code);const a=assessments.get(r.id);assert.equal(a.status,'excluded');assert.ok(a.passed.some(c=>c.field==='专业'));assert.ok(a.excluded.some(c=>c.field==='定向经历'));}
});
