import catalog from './major-catalog.json' with {type: 'json'};
import {normalized, clean} from './data.js';

export const majorCatalog = catalog;
export const educationLevels = ['大专','本科','硕士研究生','博士研究生'];
export const degreeLevels = ['无学位','学士','硕士','博士'];
export const serviceOptions = [['none','无上述经历'],['village','大学生村官'],['teacher','特岗教师'],['three','三支一扶'],['west','西部计划'],['soldier','高校毕业生退役士兵'],['unknown','其他 / 不确定']];
export const statusLabels = {matched:'基础匹配',review:'待核对',excluded:'已排除'};
export const national2027Source = 'https://www3.xinhuanet.com/edu/20261013/ce6bf7dc36474dd68ecd90aa8b722f06/c.html';
const unrestricted = value => /^(?:不限|无限制|无要求|无|不限制|专业不限|不作要求|不要求)[。.]?$/.test(normalized(value));
const majorByName = new Map(catalog.majors.map(m=>[normalized(m.name),m]));
const majorByCode = new Map(catalog.majors.flatMap(m=>[m.code,...m.previousCodes].flatMap(code=>[[code,m],[code.replace(/[A-Z]+$/,''),m]])));
const categoryNames=new Set(Object.values(catalog.categories));
export function lookupMajor(name, code='') {
  const found = majorByCode.get(normalized(code).toUpperCase()) || majorByName.get(normalized(name));
  if(!found || (name && normalized(name)!==normalized(found.name))) return null;
  return found;
}
export function newAcademicRecord() {return {level:'',degree:'',major:'',code:'',graduationYear:'',fullTime:''};}
export function newProfile() {return {version:1,gender:'',politics:'',fresh:'',birthMonth:'',workYears:'',service:'',serviceCompleted:'',militaryYears:'',cet4:'',cet6:'',law:'',household:'',origin:'',examRule:'table',records:[newAcademicRecord()]};}
export function validateProfile(p) {
  const errors=[];
  if(!p.records?.length) errors.push('请填写最高学历。');
  p.records?.forEach((r,i)=>{
    if(!educationLevels.includes(r.level)) errors.push(`第 ${i+1} 条学历：请选择学历。`);
    if(!degreeLevels.includes(r.degree)) errors.push(`第 ${i+1} 条学历：请选择学位。`);
    if(!normalized(r.major)) errors.push(`第 ${i+1} 条学历：请填写毕业证上的专业名称。`);
    if(!/^\d{4}$/.test(String(r.graduationYear)) || +r.graduationYear<1950 || +r.graduationYear>2100) errors.push(`第 ${i+1} 条学历：请填写有效毕业年份。`);
    if(r.code && !/^\d{4,6}[A-Z]{0,2}$/i.test(r.code)) errors.push(`第 ${i+1} 条学历：专业代码应为 4～6 位数字，可带 T/K 后缀。`);
    if(r.code && r.level==='本科' && !/^\d{6}[A-Z]{0,2}$/i.test(r.code)) errors.push('本科请填写具体专业的六位代码，不能用四位专业类代码代替。');
    const byCode=majorByCode.get(normalized(r.code).toUpperCase());
    if(r.level==='本科' && byCode && normalized(r.major)!==normalized(byCode.name)) errors.push(`专业代码 ${r.code} 对应“${byCode.name}”，与填写的专业名称不一致。`);
    if(i>0 && educationLevels.indexOf(r.level)>educationLevels.indexOf(p.records[0].level)) errors.push('其他学历不能高于第一条最高学历。');
    const expected=educationLevels.indexOf(r.level);
    if(degreeLevels.indexOf(r.degree)>expected) errors.push(`第 ${i+1} 条学历：学位不能高于对应学历。`);
  });
  if(!['男性','女性','unknown'].includes(p.gender)) errors.push('请选择性别。');
  if(!['中共党员','中共预备党员','共青团员','群众','民主党派成员','unknown'].includes(p.politics)) errors.push('请选择政治面貌。');
  if(!['yes','no','unknown'].includes(p.fresh)) errors.push('请选择本次招考的应届身份。');
  if(p.workYears==='' || !Number.isFinite(+p.workYears) || +p.workYears<0 || +p.workYears>60) errors.push('请填写有效基层工作年限，没有经历填 0。');
  if(!serviceOptions.some(([id])=>id===p.service)) errors.push('请选择服务基层项目 / 退役士兵经历。');
  if(['village','teacher','three','west'].includes(p.service) && !['yes','no','unknown'].includes(p.serviceCompleted)) errors.push('请选择是否服务期满且考核合格。');
  if(p.service==='soldier' && (p.militaryYears==='' || !Number.isFinite(+p.militaryYears) || +p.militaryYears<0 || +p.militaryYears>60)) errors.push('请填写服役年限。');
  for(const key of ['cet4','cet6']) if(p[key]!=='' && (!Number.isFinite(+p[key]) || +p[key]<0 || +p[key]>710)) errors.push('英语四 / 六级成绩应为 0～710 分，未取得可填 0。');
  if(p.birthMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.birthMonth)) errors.push('请填写有效出生年月。');
  return [...new Set(errors)];
}

function ranksIn(text) {
  const t=normalized(text);const ranks=[];
  if(/大专|专科/.test(t))ranks.push(0);if(/本科/.test(t))ranks.push(1);
  if(/硕士/.test(t))ranks.push(2);if(/博士/.test(t))ranks.push(3);
  if(/研究生/.test(t)&&!/(?:硕士|博士)/.test(t))ranks.push(2,3);
  return [...new Set(ranks)];
}
export function allowedEducation(text) {
  if(unrestricted(text))return [0,1,2,3];
  const ranks=ranksIn(text);if(!ranks.length)return null;
  if(/及以上|以上学历/.test(text))return [0,1,2,3].filter(n=>n>=Math.min(...ranks));
  return ranks;
}
function scopedMajors(text, record) {
  const t=normalized(text);const markers=[...t.matchAll(/(大学本科|大学专科|硕士研究生|博士研究生|本科|大专|专科|研究生|硕士|博士)[：:]/g)];
  if(!markers.length)return {text:t,missing:false,explicit:false};
  const rank=educationLevels.indexOf(record.level);
  const matching=markers.map((m,i)=>({ranks:ranksIn(m[1]),text:t.slice(m.index+m[0].length,markers[i+1]?.index ?? t.length)})).filter(s=>s.ranks.includes(rank));
  return {text:matching.map(s=>s.text).join('；'),missing:!matching.length,explicit:true};
}
const complexMajor = /相关|相近|方向|课程|本科.*研究生.*均|各学历.*均|所有学历/;
function matchMajor(text, record) {
  const scope=scopedMajors(text,record);
  if(scope.missing)return {state:'review',text:`专业栏没有明确列出${record.level}对应要求`};
  const t=scope.text;
  if(unrestricted(t))return {state:'pass',text:'专业不限'};
  const known=record.level==='本科'?lookupMajor(record.major,record.code):null;
  const enteredCode=normalized(record.code).toUpperCase();
  const code=enteredCode || known?.code || '';
  const categoryCode=record.level==='本科'?(known?.categoryCode || ''):code.length>=4?code.slice(0,4):'';
  const category=known?.category || '';
  // A category followed by a parenthesized list can narrow the scope; do not
  // treat every member of the category as accepted without reading the list.
  const excludedMajor=t.match(/(?:不含|不包括|排除)([^）)；;。]+)/)?.[1];
  if(excludedMajor&&excludedMajor.includes(normalized(record.major)))return {state:'fail',text:`专业要求明确排除${record.major}`};
  if(category) {
    const escaped=category.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const narrowed=t.match(new RegExp(`${escaped}[（(]([^）)]+)[）)]`));
    if(narrowed && !/^(?:不含|不包括|排除)/.test(narrowed[1])) {
      const listed=narrowed[1].replace(/^(?:仅限|只限|限|仅招|只招)/,'').split(/[、，,；;]/).map(n=>n.replace(/专业$/,''));
      if(listed.every(n=>majorByName.has(n)) && !listed.includes(normalized(record.major)))return {state:/^(?:仅限|只限|限|仅招|只招)/.test(narrowed[1])?'fail':'review',text:`${category}后括号列出了具体专业，未列出${record.major}，需核对是否限定范围`};
    }
  }
  const codes=[...t.matchAll(/(?<!\d)(\d{2}|\d{4}|\d{6})([A-Z]{0,2})(?!\d)/g)].map(m=>m[1]);
  const supplied=code.replace(/[A-Z]+$/,'');
  const names=t.split(/[、，,；;\n]/).map(v=>v.replace(/^\d{2,6}[A-Z]*/,'').replace(/[（(].*$/,'').replace(/[。.]$/,'').trim()).filter(Boolean);
  if(record.level!=='本科'&&!scope.explicit&&names.some(n=>categoryNames.has(n)))return {state:'review',text:'专业栏使用本科专业类，但未明确研究生 / 专科的对应范围；请补充本科专业或核对目录'};
  if(record.level!=='本科'&&!scope.explicit&&codes.some(c=>c.length===6&&majorByCode.has(c)))return {state:'review',text:'专业栏使用本科具体专业代码，未明确其他学历阶段的专业范围，请核对适用目录'};
  const exactName=names.includes(normalized(record.major));
  const codeMatch=codes.some(c=>c.length===2 ? categoryCode.startsWith(c) : c.length===4 ? c===categoryCode || supplied===c : c===supplied);
  const categoryMatch=category && names.includes(normalized(category));
  if(exactName || codeMatch || categoryMatch) {
    if(complexMajor.test(t))return {state:'review',text:`专业范围匹配，但还包含研究方向 / 课程等细化要求：${t}`};
    return {state:'pass',text:categoryMatch || (codeMatch && codes.includes(categoryCode))?`${record.major} → ${categoryCode}${category}`:`${record.level}专业${record.major}匹配`};
  }
  // A major absent from our catalog must never be rejected merely by a name substring.
  const recognizedNames=names.length && names.every(n=>majorByName.has(n) || categoryNames.has(n));
  const hasConcreteScope=codes.length>0 || recognizedNames;
  if(known?.previousCodes.some(old=>codes.includes(old.slice(0,4))))return {state:'review',text:'专业目录中该专业的代码 / 门类发生过调整，需核对原毕业专业代码及适用目录'};
  const profileCodeConfirmed=record.level==='本科'?!!known:!!enteredCode;
  if(hasConcreteScope && profileCodeConfirmed && !complexMajor.test(t))return {state:'fail',text:`${record.level}专业${record.major}${code?`（${code}）`:''}不在该学历阶段的专业范围内`};
  return {state:'review',text:`专业表述 / 分类未能完整确认：${t || text}`};
}
function minimumYears(text) {
  const t=normalized(text);const digits=t.match(/(\d+(?:\.\d+)?)年/);if(digits)return +digits[1];
  const cn={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
  const m=t.match(/([一二两三四五六七八九十])年/);return m?cn[m[1]]:null;
}
function englishCheck(notes, p, report) {
  const t=normalized(notes);
  const expressions=[...t.matchAll(/(?:大学|全国大学)?英语(?:四级|六级|4级|6级)|CET[-－]?[46]/gi)];
  if(!expressions.length)return;
  const hasAlternative=/雅思|托福|英语专业|专业(?:四|八)级|IELTS|TOEFL|任选/i.test(t);
  const kinds=[...new Set(expressions.map(m=>/四|4/.test(m[0])?'cet4':'cet6'))];
  if(kinds.length>1 || hasAlternative){report('review','英语水平','含多个英语等级或替代考试，请核对任选关系',notes);return;}
  const kind=kinds[0],expr=expressions[0];
  const clause=t.slice(Math.max(t.lastIndexOf('；',expr.index),t.lastIndexOf('。',expr.index),0),t.indexOf('；',expr.index)<0?t.length:t.indexOf('；',expr.index));
  if(/不要求|无需|不限|优先|或|之一/.test(clause)){report('review','英语水平','英语条件存在否定、倾向或任选表达',clause);return;}
  const threshold=t.slice(expr.index,expr.index+100).match(/(?<!\d)(\d{3})(?!\d)分/);
  if(!threshold){if(profileEnglishMissing(p[kind],clause))report('fail','英语水平',`填写为未取得${kind==='cet4'?'英语四级':'英语六级'}，备注明确要求通过 / 合格`,clause);else report('review','英语水平','未明确识别到分数门槛，请核对原文',clause);return;}
  const name=kind==='cet4'?'英语四级':'英语六级';
  if(p[kind]===''){report('review','英语水平',`未填写${name}成绩，岗位要求至少${threshold[1]}分`,clause);return;}
  report(+p[kind]>=+threshold[1]?'pass':'fail','英语水平',`${name} ${p[kind]} 分，岗位要求至少 ${threshold[1]} 分`,clause);
}
function profileEnglishMissing(score,clause) {return String(score)==='0'&&!/注明|填写|如|若|建议/.test(clause)&&/须|要求|必须|合格|通过|取得/.test(clause);}

export function assessRow(row, fields, profile) {
  const checks=[];
  const report=(state,field,message,evidence='')=>checks.push({state,field,message,evidence});
  const get=f=>clean(row.cells[fields[f]]);
  const highest=profile.records[0];const highestRank=educationLevels.indexOf(highest.level);
  const notes=get('notes'), note=normalized(notes); const requirements=row.requirements;
  const education=get('education'), allowed=allowedEducation(education);
  if(!education || !allowed)report('review','学历','未识别到明确学历范围',education);
  else report(allowed.includes(highestRank)?'pass':'fail','学历',`${highest.level}；岗位要求${education}`,education);

  const degree=get('degree');
  if(!degree)report('review','学位','学位栏未填写，请核对原表');
  else if(unrestricted(degree))report('pass','学位','学位不限',degree);
  else if(/与最高学历.*(?:对应|相应)|最高学历.*学位/.test(degree)) {
    const expected=degreeLevels[highestRank];report(highest.degree===expected?'pass':'fail','学位',`${highest.level}对应${expected}，填写为${highest.degree}`,degree);
  } else {
    const requested=degreeLevels.slice(1).filter(v=>degree.includes(v));
    const degrees=profile.records.filter(r=>!allowed||allowed.includes(educationLevels.indexOf(r.level))).map(r=>r.degree);
    const match=requested.some(d=>degrees.includes(d)) || /及以上/.test(degree)&&requested.some(d=>degreeLevels.indexOf(highest.degree)>=degreeLevels.indexOf(d));
    if(match)report('pass','学位',`已填写学位符合${degree}`,degree);
    else if(highest.degree==='无学位' || allowed?.length===1)report('fail','学位',`${highest.degree}不符合${degree}`,degree);
    else report('review','学位',`需核对是否具有岗位要求的${degree}，可补充其他学历学位`,degree);
  }

  const major=get('major');
  if(!major)report('review','专业','专业栏为空，请核对是否不限专业');
  else {
    const highestOnly=/专业(?:为|须为|必须为|要求为|要求是)?(?:报考者|报考人员|考生)?最高学历|以最高学历.{0,10}专业|最高学历对应专业/.test(note);
    const candidates=(highestOnly?[highest]:profile.records).filter(r=>!allowed||allowed.includes(educationLevels.indexOf(r.level)));
    const results=candidates.map(r=>matchMajor(major,r));
    const passed=results.find(r=>r.state==='pass');const unsure=results.find(r=>r.state==='review');
    if(passed)report('pass','专业',passed.text,major);
    else if(unsure || !results.length)report('review','专业',unsure?.text || '没有填写对应学历阶段的专业',major);
    else report('fail','专业',results.map(r=>r.text).join('；'),major);
    if(/各(?:个)?学历(?:阶段)?.{0,35}(?:均|全部|同时)|所有学历|本科.{0,20}研究生.{0,10}均|均须|均需|全部学习阶段/.test(note))report('review','学历阶段要求','备注对多个学历阶段另有要求，需要核对完整学习经历',notes);
  }

  const politics=get('politics');
  if(unrestricted(politics))report('pass','政治面貌','政治面貌不限',politics);
  else if(profile.politics==='unknown')report('review','政治面貌','政治面貌尚未确认',politics);
  else {
    let match=politics.includes(profile.politics) || profile.politics==='中共预备党员'&&politics.includes('中共党员');
    if(profile.politics==='中共预备党员'&&/正式党员|不含预备|预备党员除外/.test(politics+note))match=false;
    if(!politics)report('review','政治面貌','政治面貌要求未填写');else report(match?'pass':'fail','政治面貌',`${profile.politics}；岗位要求${politics}`,politics);
  }
  const requiredGender=requirements.gender;
  if(['限男性','限女性'].includes(requiredGender))report(profile.gender==='unknown'?'review':requiredGender===`限${profile.gender}`?'pass':'fail','性别',`${profile.gender==='unknown'?'性别尚未确认':profile.gender}；备注${requiredGender}`,requirements.evidence.male||requirements.evidence.female);
  else if(['适合男性','适合女性','需核对原文'].includes(requiredGender))report('review','性别','备注包含性别倾向或复杂表达',requirements.evidence.maleSuitable||requirements.evidence.femaleSuitable||notes);

  if(requirements.tags.includes('fresh'))report(profile.fresh==='unknown'?'review':profile.fresh==='yes'?'pass':'fail','应届身份',`岗位要求应届毕业生；填写为${profile.fresh==='yes'?'是':profile.fresh==='no'?'否':'不确定'}`,requirements.evidence.fresh);
  if(requirements.tags.includes('cohort')) {
    const year=requirements.evidence.cohort.match(/20\d{2}/)?.[0];
    report(String(highest.graduationYear)===year?'pass':'fail','毕业届别',`最高学历毕业年份${highest.graduationYear}；岗位限${year}届`,requirements.evidence.cohort);
    if(profile.fresh==='no')report('review','应届身份','毕业届别匹配，但填写为非应届，请核对该职位的毕业生身份认定',requirements.evidence.cohort);
    else if(profile.fresh==='unknown')report('review','应届身份','毕业年份匹配，但应届身份尚未确认',requirements.evidence.cohort);
  }
  const years=get('years');
  if(unrestricted(years))report('pass','基层工作年限','基层工作年限不限',years);
  else {const min=minimumYears(years);if(min===null)report('review','基层工作年限','年限要求未能明确识别',years);else report(+profile.workYears>=min?'pass':'fail','基层工作年限',`已填写${profile.workYears}年；岗位最低${min}年`,years);}

  const service=get('service');
  if(unrestricted(service))report('pass','定向经历','服务基层项目经历不限',service);
  else if(!service || profile.service==='unknown')report('review','定向经历','经历或岗位定向要求尚未确认',service);
  else {
    const patterns={village:/大学生村官/,teacher:/特设岗位|特岗/,three:/三支一扶/,west:/西部计划/,soldier:/退役士兵/};
    const match=patterns[profile.service]?.test(service) || false;
    if(!match)report('fail','定向经历',`填写为${serviceOptions.find(([id])=>id===profile.service)?.[1]}，不符合岗位定向经历`,service);
    else if(profile.service==='soldier') {
      const min=minimumYears(service.match(/(?:在军队)?服役[^、，；;]*/)?.[0]||service);
      report(min===null?'review':+profile.militaryYears>=min?'pass':'fail','服役经历',`服役${profile.militaryYears}年；要求${min===null?'请核对原文':`至少${min}年`}`,service);
      report('review','退役士兵身份','需核对高校毕业生身份、退役及其他证明材料',service);
    } else report(profile.serviceCompleted==='unknown'?'review':profile.serviceCompleted==='yes'?'pass':'fail','项目完成情况',`项目匹配；${profile.serviceCompleted==='yes'?'已服务期满且考核合格':profile.serviceCompleted==='no'?'未服务期满或考核未合格':'完成情况待确认'}`,service);
  }

  englishCheck(notes,profile,report);
  if(requirements.tags.includes('law')) {
    const clause=notes.split(/[；;。\n]/).find(s=>/法律职业资格|司法考试/.test(s)) || notes;
    if(/或|之一|优先|无需|不要求/.test(clause))report('review','法律职业资格','法律资格要求含任选、否定或倾向表达',clause);
    else if(!profile.law || profile.law==='unknown')report('review','法律职业资格','法律职业资格尚未填写 / 确认',clause);
    else if(profile.law==='none')report('fail','法律职业资格','未取得法律职业资格',clause);
    else if(/A类|Ａ类/.test(clause) && profile.law!=='A')report('fail','法律职业资格',`具有${profile.law}类，岗位要求A类`,clause);
    else report('pass','法律职业资格',`已填写${profile.law}类法律职业资格`,clause);
  }
  if(requirements.tags.includes('household'))report('review','户籍 / 生源',`需核对区域与户籍、生源任选关系；已填户籍${profile.household||'未填写'}，生源${profile.origin||'未填写'}`,requirements.evidence.household);
  if(requirements.tags.includes('certificate')&&!requirements.tags.includes('law'))report('review','资格证书','存在其他资格证书要求，需核对证书名称、级别和取得时间',requirements.evidence.certificate);
  if(requirements.tags.includes('physical'))report('review','体能测评','需参加体能测评，填写基础信息不能确认测评是否合格',requirements.evidence.physical);

  if(profile.examRule==='national2027') {
    if(!profile.birthMonth)report('review','公告年龄','未填写出生年月，2027国考公告年龄条件待核对');
    else {
      const freshGraduate=highestRank>=2&&String(highest.graduationYear)==='2027'&&profile.fresh==='yes';
      const baseFrom='1987-10', graduateFrom='1982-10', to='2008-10';
      if(profile.birthMonth>to || profile.birthMonth<graduateFrom)report('fail','公告年龄','出生年月不在2027国考公告的一般或应届硕博放宽范围内',national2027Source);
      else if(profile.birthMonth>=baseFrom)report('pass','公告年龄','出生年月在2027国考公告一般年龄范围内',national2027Source);
      else if(freshGraduate)report('pass','公告年龄','根据填写的2027届应届硕博身份，符合公告年龄放宽范围',national2027Source);
      else if(highestRank>=2&&String(highest.graduationYear)==='2027'&&profile.fresh==='unknown')report('review','公告年龄','处于应届硕博放宽年龄范围，但应届身份尚未确认',national2027Source);
      else report('fail','公告年龄','不符合2027国考一般年龄范围或应届硕博放宽条件',national2027Source);
    }
  }
  // Always expose supplemental notes. A keyword match cannot certify every clause.
  if(notes && !unrestricted(notes))report('review','备注补充条件','备注包含补充条件，需逐条核对；已识别条件的判断见下方',notes);
  const excluded=checks.filter(c=>c.state==='fail'), pending=checks.filter(c=>c.state==='review');
  const candidate=!excluded.length&&['专业','学历'].every(field=>checks.some(c=>c.field===field&&c.state==='pass'));
  return {status:excluded.length?'excluded':pending.length?'review':'matched',candidate,checks,excluded,pending,passed:checks.filter(c=>c.state==='pass')};
}
export function assessSheet(sheet,profile) {return new Map(sheet.rows.map(row=>[row.id,assessRow(row,sheet.fields,profile)]));}
