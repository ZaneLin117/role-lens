import React, {useEffect, useRef, useState, useId} from 'react';
import {UserRound, X, Plus, Trash2, ShieldCheck, Check} from 'lucide-react';
import {newProfile,newAcademicRecord,educationLevels,degreeLevels,serviceOptions,lookupMajor,majorCatalog,validateProfile,national2027Source} from './eligibility';
import {normalized} from './data';
import MajorSelect from './MajorSelect';

const clone = p => JSON.parse(JSON.stringify(p));
const digitalMediaChoices=['数字媒体技术','数字媒体艺术'].map(name=>lookupMajor(name)).filter(Boolean);
function Field({label,children,wide=false,hint}) {const id=useId();const controls=React.Children.map(children,child=>React.isValidElement(child)&&['input','select','textarea'].includes(child.type)?React.cloneElement(child,{'aria-label':child.props['aria-label']||label,'aria-describedby':child.props['aria-describedby']||(hint?`${id}-hint`:undefined)}):child);return <label className={`profile-field ${wide?'wide':''}`}><span>{label}</span>{controls}{hint&&<small id={`${id}-hint`}>{hint}</small>}</label>;}

export default function ProfileDialog({profile,remember,filename,onClose,onSave,onDelete}) {
  const ref=useRef(null);
  const [draft,setDraft]=useState(()=>{if(profile)return clone(profile);const p=newProfile();p.records[0].major='网络工程';if(/2027.*国考|国考.*2027/.test(filename))p.examRule='national2027';return p;});
  const [keep,setKeep]=useState(remember);const [errors,setErrors]=useState([]);
  useEffect(()=>{ref.current.showModal();ref.current.querySelector('select')?.focus();},[]);
  useEffect(()=>{if(errors.length){const alert=ref.current.querySelector('.profile-errors');alert?.focus();alert?.scrollIntoView({block:'nearest'});}},[errors]);
  const change=(key,value)=>{setErrors([]);setDraft(p=>({...p,[key]:value}));};
  const changeRecord=(i,key,value)=>{setErrors([]);setDraft(p=>{
    const records=p.records.map((r,index)=>{
      if(index!==i)return r;
      const next={...r,[key]:value};
      if((key==='major'||key==='level')&&next.level==='本科') {const known=lookupMajor(next.major);next.code=known?.code||'';}
      else if(key==='level') next.code='';
      return next;
    });return {...p,records};
  });};
  const save=e=>{e.preventDefault();const issues=validateProfile(draft);if(issues.length){setErrors(issues);ref.current.querySelector('.profile-errors')?.scrollIntoView({block:'nearest'});return;}onSave({...draft,records:draft.records.map(r=>({...r,major:r.major.trim(),code:r.code.trim().toUpperCase(),graduationYear:String(r.graduationYear)}))},keep);ref.current.close();};
  return <dialog ref={ref} className="profile-dialog" aria-labelledby="profile-title" onClose={onClose} onClick={e=>{if(e.target!==e.currentTarget)return;const rect=ref.current.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)ref.current.close();}}>
    <form onSubmit={save} noValidate>
      <header className="profile-dialog-header"><div><h2 id="profile-title"><UserRound size={20}/>个人基础信息</h2><p>填写后自动排除明确不符的岗位，并列出需要进一步核对的条件。</p></div><button type="button" className="icon-button" aria-label="关闭个人信息" onClick={()=>ref.current.close()}><X size={21}/></button></header>
      <div className="profile-dialog-body">
        <p className="profile-privacy"><ShieldCheck size={14}/>不需要姓名或身份证号，信息只在本地浏览器处理。</p>
        <div className="profile-errors" role="alert" tabIndex="-1">{errors.length>0&&<><strong>请补充或修正以下信息</strong><ul>{errors.map(e=><li key={e}>{e}</li>)}</ul></>}</div>
        <section className="profile-section"><h3>学历与专业</h3><p>第一条填写最高学历。其他学历用于岗位允许的跨学历阶段专业匹配。</p>
          {draft.records.map((r,i)=>{const known=r.level==='本科'?lookupMajor(r.major,r.code):null;const prefix=i===0?'最高学历':`其他学历 ${i}`;return <div className="academic-record" key={i}>
            <div className="academic-record-heading"><strong>{prefix}</strong>{i>0&&<button type="button" className="text-button" aria-label={`删除${prefix}`} onClick={()=>change('records',draft.records.filter((_,j)=>j!==i))}><Trash2 size={13}/>删除</button>}</div>
            <div className="profile-grid">
              <Field label={i===0?'最高学历':'学历层次'}><select aria-label={`${prefix}层次`} value={r.level} onChange={e=>changeRecord(i,'level',e.target.value)}><option value="">请选择</option>{educationLevels.map(v=><option key={v}>{v}</option>)}</select></Field>
              <Field label="取得 / 预计取得的学位"><select aria-label={`${prefix}学位`} value={r.degree} onChange={e=>changeRecord(i,'degree',e.target.value)}><option value="">请选择</option>{degreeLevels.map(v=><option key={v}>{v}</option>)}</select></Field>
              <MajorSelect ariaLabel={`${prefix}专业`} level={r.level} value={r.major} onChange={value=>changeRecord(i,'major',value)}>{known?<small className="major-recognized"><Check size={12}/>{known.code} {known.name} → {known.categoryCode} {known.category}</small>:normalized(r.major)!=='数字媒体'&&<small>未确认专业类时保留为“待核对”，不会按名称猜测类别。</small>}</MajorSelect>
              {normalized(r.major)==='数字媒体'&&<div className="major-disambiguation" role="group" aria-label="确认数字媒体专业全称"><p>请按毕业证确认“数字媒体”的完整专业名称。</p>{r.level==='本科'&&<div className="digital-media-choices">{digitalMediaChoices.map(m=><button key={m.code} type="button" aria-label={`选择${m.name}`} onClick={()=>changeRecord(i,'major',m.name)}><strong>{m.name}</strong><span>{m.code} · {m.category}</span></button>)}</div>}<small>若毕业证确实写“数字媒体”，可保留此名称；未确认专业类时按待核对处理。</small></div>}
              <Field label="专业代码（可选）" hint={r.level==='本科'?'本科专业名称识别后自动带入':'研究生 / 专科代码需按适用目录填写'}><input aria-label={`${prefix}专业代码`} placeholder={r.level==='本科'?'如：080903':'如：0812'} value={r.code} onChange={e=>changeRecord(i,'code',e.target.value)}/></Field>
              <Field label="毕业年份（含预计年份）"><input aria-label={`${prefix}毕业年份`} type="number" min="1950" max="2100" placeholder="例如：2027" value={r.graduationYear} onChange={e=>changeRecord(i,'graduationYear',e.target.value)}/></Field>
            </div>
          </div>;})}
          {draft.records.length<3&&<button type="button" className="secondary add-academic" onClick={()=>change('records',[...draft.records,newAcademicRecord()])}><Plus size={14}/>添加其他学历</button>}
          <p className="catalog-source">本科专业分类依据：<a href={majorCatalog.source} target="_blank" rel="noreferrer">教育部2026年本科专业目录</a>。不混用本科与研究生代码。</p>
        </section>
        <section className="profile-section"><h3>身份与工作经历</h3><div className="profile-grid">
          <Field label="性别"><select value={draft.gender} onChange={e=>change('gender',e.target.value)}><option value="">请选择</option><option>男性</option><option>女性</option><option value="unknown">暂不确定</option></select></Field>
          <Field label="政治面貌"><select value={draft.politics} onChange={e=>change('politics',e.target.value)}><option value="">请选择</option>{['中共党员','中共预备党员','共青团员','群众','民主党派成员'].map(v=><option key={v}>{v}</option>)}<option value="unknown">暂不确定</option></select></Field>
          <Field label="本次招考是否具有应届身份" hint="毕业年份不直接等同于应届身份，按本次公告认定"><select value={draft.fresh} onChange={e=>change('fresh',e.target.value)}><option value="">请选择</option><option value="yes">是（符合本次招考应届条件）</option><option value="no">否</option><option value="unknown">暂不确定</option></select></Field>
          <Field label="基层工作年限" hint="按公告口径计算，普通工作不一定都计入"><input type="number" min="0" max="60" step="0.1" placeholder="没有经历填 0" value={draft.workYears} onChange={e=>change('workYears',e.target.value)}/></Field>
          <Field label="服务基层项目 / 退役士兵经历" wide><select value={draft.service} onChange={e=>change('service',e.target.value)}><option value="">请选择</option>{serviceOptions.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></Field>
          {['village','teacher','three','west'].includes(draft.service)&&<Field label="是否服务期满且考核合格" wide><select value={draft.serviceCompleted} onChange={e=>change('serviceCompleted',e.target.value)}><option value="">请选择</option><option value="yes">是</option><option value="no">否</option><option value="unknown">暂不确定</option></select></Field>}
          {draft.service==='soldier'&&<Field label="在军队服役年限" wide><input type="number" min="0" max="60" step="0.1" value={draft.militaryYears} placeholder="例如：5" onChange={e=>change('militaryYears',e.target.value)}/></Field>}
        </div></section>
        <details className="profile-extra"><summary>补充信息：年龄、英语成绩、证书与户籍</summary><div className="profile-grid">
          <Field label="年龄匹配规则"><select value={draft.examRule} onChange={e=>change('examRule',e.target.value)}><option value="table">只按表格判断，不推定通用年龄条件</option><option value="national2027">2027国家公务员招考公告</option></select></Field>
          <Field label="出生年月（可选）"><input type="month" value={draft.birthMonth} onChange={e=>change('birthMonth',e.target.value)}/></Field>
          <Field label="英语四级成绩" hint="未取得填 0，不清楚留空"><input type="number" min="0" max="710" value={draft.cet4} onChange={e=>change('cet4',e.target.value)}/></Field>
          <Field label="英语六级成绩" hint="未取得填 0，不清楚留空"><input type="number" min="0" max="710" value={draft.cet6} onChange={e=>change('cet6',e.target.value)}/></Field>
          <Field label="法律职业资格"><select value={draft.law} onChange={e=>change('law',e.target.value)}><option value="">未填写</option><option value="none">未取得</option><option value="A">A 类</option><option value="B">B 类</option><option value="C">C 类</option><option value="unknown">暂不确定</option></select></Field>
          <Field label="户籍所在地（可选）"><input value={draft.household} placeholder="如：福建省厦门市" onChange={e=>change('household',e.target.value)}/></Field>
          <Field label="生源地（可选）" wide><input value={draft.origin} placeholder="如：福建省福州市" onChange={e=>change('origin',e.target.value)}/></Field>
        </div>{draft.examRule==='national2027'&&<p className="catalog-source">年龄范围依据<a href={national2027Source} target="_blank" rel="noreferrer">2027国考公告</a>；职位单独设置的年龄、体检条件仍需核对。</p>}</details>
        <label className="remember-profile"><input type="checkbox" checked={keep} onChange={e=>setKeep(e.target.checked)}/>记住本机个人信息，下次导入表格继续使用</label>
      </div>
      <footer className="profile-dialog-footer"><div>{profile&&<button type="button" className="text-button delete-profile" onClick={()=>{onDelete();ref.current.close();}}><Trash2 size={13}/>清除个人信息</button>}</div><div><button type="button" className="secondary" onClick={()=>ref.current.close()}>取消</button><button type="submit" className="primary"><Check size={15}/>保存并自动筛选</button></div></footer>
    </form>
  </dialog>;
}
