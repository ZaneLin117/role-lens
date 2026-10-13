import React, {useState, useMemo, useRef, useEffect, useDeferredValue} from 'react';
import {createRoot} from 'react-dom/client';
import {FileSpreadsheet, Upload, Search, SlidersHorizontal, X, ChevronDown, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, Bookmark, RotateCcw, Check, CheckCheck, FolderOpen, ShieldCheck, CircleHelp, Filter, LoaderCircle, Columns3, ListFilter} from 'lucide-react';
import * as XLSX from 'xlsx';
import ParseWorker from './parser.worker?worker&inline';
import {filterRows, emptyFilters, requirementOptions, exportRows, parseMatrix} from './data';
import {filterOptions, isLocationColumn} from './locations';
import './style.css';
import ProfileDialog from './ProfileDialog';
import {assessSheet,validateProfile,statusLabels} from './eligibility';
import {UserRound} from 'lucide-react';

const format = n => new Intl.NumberFormat('zh-CN').format(n);
const label = id => requirementOptions.find(([key]) => key === id)?.[1] || id;
const storageRead = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
const storageWrite = (key, data) => {try {localStorage.setItem(key, JSON.stringify(data));} catch { /* Storage is optional in private browsing. */ }};
const initialColumns = ['title','department','location','education','major','count'];

function MatchingDetails({assessment}) {
  if(!assessment)return null;
  return <section className="matching-details"><div className="matching-details-title"><h3>个人条件匹配依据</h3><span className={`eligibility-badge ${assessment.status}`}>{statusLabels[assessment.status]}</span></div>
    {[['fail','不符合的条件'],['review','需要核对的条件']].map(([state,title])=>{const checks=assessment.checks.filter(c=>c.state===state);return checks.length>0&&<div className={`matching-checks ${state}`} key={state}><h4>{title}</h4>{checks.map((c,i)=><div className="matching-check" key={i}><strong>{c.field}</strong><p>{c.message}</p>{c.evidence&&c.field!=='备注补充条件'&&<small>依据：{c.evidence}</small>}</div>)}</div>;})}
    {assessment.passed.length>0&&<details className="matching-passed"><summary>已匹配的基础条件（{assessment.passed.length} 项）</summary>{assessment.passed.map((c,i)=><div className="matching-check" key={i}><strong>{c.field}</strong><p>{c.message}</p>{c.evidence&&!c.evidence.startsWith('https://')&&<small>依据：{c.evidence}</small>}</div>)}</details>}
  </section>;
}

function MultiFilter({column, rows, selected = [], onChange}) {
  const [search, setSearch] = useState(''); const ref = useRef(null);
  const options = useMemo(() => filterOptions(rows, column), [rows, column]);
  useEffect(() => {const listener = e => {if(ref.current && !ref.current.contains(e.target)) ref.current.open = false;};document.addEventListener('click', listener); return () => document.removeEventListener('click', listener);}, []);
  const shown = options.filter(([v]) => v.toLowerCase().includes(search.toLowerCase()));
  return <div className="field"><label>{column}</label><details className="multi" ref={ref}><summary aria-label={`筛选${column}`}><span>{selected.length ? selected.length === 1 ? selected[0] || '（空白）' : `已选 ${selected.length} 项` : '不限'}</span><ChevronDown size={15}/></summary><div className="options-panel">
    <div className="option-search"><Search size={14}/><input aria-label={`搜索${column}选项`} placeholder="搜索选项" value={search} onChange={e => setSearch(e.target.value)}/></div>
    <div className="option-actions"><span>{format(options.length)} 项</span><button onClick={() => onChange([...new Set([...selected,...shown.map(([v])=>v)])])}>选择匹配项</button><button onClick={() => onChange([])}>清除</button></div>
    {isLocationColumn(column) && <p className="location-hint">省、市包含下属地区；多选合并，岗位不重复</p>}
    <div className="option-list">{shown.slice(0, 150).map(([value, count]) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value])}/><span>{value || '（空白）'}</span><small>{count}</small></label>)}{shown.length > 150 && <p className="helper">输入关键词查找其余选项</p>}{!shown.length && <p className="helper">没有符合的选项</p>}</div>
  </div></details></div>;
}

function demoWorkbook() {
  const columns = ['部门名称','用人司局','招考职位','职位代码','招考人数','专业','学历','学位','政治面貌','基层工作最低年限','服务基层项目工作经历','工作地点','备注'];
  const values = [
    ['某市税务局','基层税务分局','一级行政执法员','DEMO001','3','计算机类、电子信息类','本科及以上','学士及以上','不限','无限制','无限制','福建省厦门市','限应届毕业生报考，限男性，在本单位最低服务年限为5年。'],
    ['某市税务局','基层税务分局','一级行政执法员','DEMO002','2','计算机类、软件工程','本科及以上','学士及以上','不限','无限制','无限制','福建省福州市','应届高校毕业生，女性，大学英语四级425分及以上。'],
    ['某市统计调查队','业务科','一级科员','DEMO003','1','统计学、数学类','本科及以上','学士及以上','不限','无限制','无限制','福建省泉州市','需经常出差。'],
    ['某省通信管理部门','行业管理处','一级主任科员及以下','DEMO004','1','计算机科学与技术、信息与通信工程','硕士研究生及以上','硕士及以上','中共党员','二年','无限制','福建省福州市','本科及研究生阶段均须取得相应学历学位。'],
    ['某铁路公安部门','基层所队','基层民警','DEMO005','5','法学、公安学类','本科及以上','学士及以上','中共党员或共青团员','无限制','无限制','福建省厦门市','限应届毕业生报考；限男性；须参加体能测评。'],
    ['某海关','监管科','监管岗位','DEMO006','2','英语、国际贸易','本科及以上','学士及以上','不限','无限制','无限制','广东省深圳市','大学英语六级425分及以上，需夜班轮班。'],
    ['某司法部门','法制科','法制岗位','DEMO007','1','法学类','硕士研究生及以上','硕士及以上','中共党员','二年','无限制','北京市','取得法律职业资格证书，户籍限北京市。'],
    ['某市税务局','基层税务分局','一级行政执法员','DEMO008','4','经济学类、财政学类','本科及以上','学士及以上','不限','无限制','无限制','福建省漳州市','限2027届高校毕业生报考，在本单位最低服务年限为5年。'],
  ];
  return {sheets: [parseMatrix([columns, ...values], '示例岗位')], skipped: []};
}

function App() {
  const [workbook, setWorkbook] = useState(null); const [sheetIndex, setSheetIndex] = useState(0); const [filename, setFilename] = useState(''); const [isDemo, setIsDemo] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [drag, setDrag] = useState(false); const [filters, setFilters] = useState(emptyFilters); const deferred = useDeferredValue(filters);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(50); const [sort, setSort] = useState({column: '', direction: 'asc'}); const [detail, setDetail] = useState(null);
  const [showHelp, setShowHelp] = useState(false); const [visibleColumns, setVisibleColumns] = useState([]); const [extraColumn, setExtraColumn] = useState('');
  const [showSearch, setShowSearch] = useState(false); const [searchDraft, setSearchDraft] = useState('');
  const [profile,setProfile]=useState(()=>{const p=storageRead('position-filter-profile-v1',null);try{return p&&validateProfile(p).length===0?p:null;}catch{return null;}});
  const [profileEnabled,setProfileEnabled]=useState(()=>!!storageRead('position-filter-profile-v1',null));
  const [profileMode,setProfileMode]=useState('candidate');const [showProfile,setShowProfile]=useState(false);
  const [rememberProfile,setRememberProfile]=useState(()=>!!storageRead('position-filter-profile-v1',null));
  const [favorites, setFavorites] = useState(new Set()); const [saved, setSaved] = useState(() => storageRead('position-filter-presets', [])); const [toast, setToast] = useState('');
  const fileInput = useRef(null); const workerRef = useRef(null); const dialogRef = useRef(null); const helpDialogRef = useRef(null);
  const searchDialogRef = useRef(null);
  const sheet = workbook?.sheets[sheetIndex]; const rows = sheet?.rows || []; const fields = sheet?.fields || {};
  const favoritesKey = `position-filter-favorites:${filename}:${sheet?.name || ''}`;
  useEffect(() => {setFavorites(new Set(storageRead(favoritesKey, [])));}, [favoritesKey]);
  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {if(!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t);}, [toast]);
  useEffect(() => {if(detail && dialogRef.current) dialogRef.current.showModal();}, [detail]);
  useEffect(() => {if(showHelp && helpDialogRef.current) helpDialogRef.current.showModal();}, [showHelp]);
  useEffect(() => {if(showSearch && searchDialogRef.current) {searchDialogRef.current.showModal();searchDialogRef.current.querySelector('input')?.focus();}}, [showSearch]);
  const initialize = (data, name, demo = false) => {
    setWorkbook(data); setSheetIndex(0); setFilename(name); setIsDemo(demo); setFilters(emptyFilters()); setPage(1); setDetail(null); setSort({column:'',direction:'asc'}); setExtraColumn('');
    const s = data.sheets[0]; setVisibleColumns(initialColumns.map(f => s.fields[f]).filter(Boolean).length ? initialColumns.map(f => s.fields[f]).filter(Boolean) : s.columns.slice(0,6));
  };
  const importFile = async file => {
    if (!file || busy) return;
    setError(''); if(!/\.(xlsx?|csv)$/i.test(file.name)) {setError('请选择 .xls、.xlsx 或 .csv 表格文件。'); return;}
    if(file.size > 60*1024*1024) {setError('文件超过 60 MB，请拆分工作表后导入。'); return;}
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer(); const worker = new ParseWorker(); workerRef.current = worker;
      const data = await new Promise((resolve, reject) => {worker.onmessage = e => e.data.ok ? resolve(e.data.workbook) : reject(new Error(e.data.error));worker.onerror = () => reject(new Error('解析失败，请使用最新版本的 Chrome 或 Edge 重试。')); worker.postMessage(buffer, [buffer]);});
      worker.terminate(); workerRef.current = null; initialize(data, file.name); setToast(`导入成功，共 ${data.sheets.length} 个有效工作表`);
    } catch(e) {workerRef.current?.terminate(); workerRef.current = null; setError(`无法导入：${e.message}`);} finally {setBusy(false); if(fileInput.current) fileInput.current.value = '';}
  };
  const update = (key, value) => {setFilters(prev => ({...prev, [key]: value})); setPage(1);};
  const updateMap = (key, column, value) => {setFilters(prev => ({...prev, [key]: {...prev[key], [column]: value}})); setPage(1);};
  const assessments=useMemo(()=>sheet&&profile?assessSheet(sheet,profile):new Map(),[sheet,profile]);
  const profileActive=!!profile&&profileEnabled;
  const assessmentCounts=useMemo(()=>{const counts={matched:0,review:0,excluded:0,candidate:0};for(const a of assessments.values()){counts[a.status]++;if(a.candidate)counts.candidate++;}return counts;},[assessments]);
  const candidates=useMemo(()=>!profileActive||profileMode==='all'?rows:rows.filter(r=>profileMode==='candidate'?assessments.get(r.id)?.candidate:assessments.get(r.id)?.status===profileMode),[rows,profileActive,profileMode,assessments]);
  const filtered = useMemo(() => filterRows(candidates, {...deferred, countColumn: fields.count}, favorites), [candidates, deferred, fields.count, favorites]);
  const sorted = useMemo(() => sort.column ? [...filtered].sort((a,b) => {
    const av = a.cells[sort.column], bv = b.cells[sort.column]; const difference = sort.column === fields.count ? Number(av) - Number(bv) : (av || '').localeCompare(bv || '', 'zh-CN', {numeric:true}); return difference * (sort.direction === 'asc' ? 1 : -1);
  }) : profileActive?[...filtered].sort((a,b)=>({matched:0,review:1,excluded:2}[assessments.get(a.id)?.status]??3)-({matched:0,review:1,excluded:2}[assessments.get(b.id)?.status]??3)):filtered, [filtered, sort, fields.count,profileActive,assessments]);
  const totalPeople = useMemo(() => filtered.reduce((sum,row) => sum + (Number(row.cells[fields.count]) || 0),0), [filtered, fields.count]);
  const maxPage = Math.max(1,Math.ceil(sorted.length/pageSize)); const currentPage = Math.min(page,maxPage); const pageRows = sorted.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const tagCounts = useMemo(() => Object.fromEntries(requirementOptions.map(([id]) => [id,rows.filter(r => r.requirements.tags.includes(id)).length])), [rows]);
  const activeChips = [
    ...(filters.query ? [{text:`关键词：${filters.query}`, clear:()=>update('query','')}] : []),
    ...Object.entries(filters.columns).filter(([,v])=>v.length).map(([c,v])=>({text:`${c}：${v.join('、') || '空白'}`,clear:()=>updateMap('columns',c,[])})),
    ...Object.entries(filters.text).filter(([,v])=>v).map(([c,v])=>({text:`${c}包含：${v}`,clear:()=>updateMap('text',c,'')})),
    ...Object.entries(filters.requirements).filter(([,v])=>v).map(([id,v])=>({text:`${v==='exclude'?'排除':'包含'}${label(id)}`,clear:()=>updateMap('requirements',id,'')})),
    ...(filters.gender ? [{text:`性别：${filters.gender}`,clear:()=>update('gender','')}] : []), ...(filters.fresh ? [{text:`应届 / 届别：${filters.fresh}`,clear:()=>update('fresh','')}] : []),
    ...(filters.minCount!=='' ? [{text:`招考人数 ≥ ${filters.minCount}`,clear:()=>update('minCount','')}] : []),
  ];
  const toggleFavorite = row => {setFavorites(prev => {const next = new Set(prev); next.has(row.id) ? next.delete(row.id) : next.add(row.id); storageWrite(favoritesKey,[...next]); return next;});};
  const exportResult = () => {try {XLSX.writeFile(exportRows(sheet, sorted,profileActive?assessments:undefined), `${isDemo?'示例-':''}${sheet.name}-筛选结果.xlsx`); setToast(`已导出 ${format(sorted.length)} 个岗位`);} catch(e) {setError(`导出失败：${e.message}`);}};
  const saveProfile=(p,remember)=>{setProfile(p);setRememberProfile(remember);setProfileEnabled(true);setProfileMode('candidate');setFilters(emptyFilters());setSort({column:'',direction:'asc'});setPage(1);if(remember)storageWrite('position-filter-profile-v1',p);else{try{localStorage.removeItem('position-filter-profile-v1');}catch{}}setToast(sheet?'已按个人信息自动匹配岗位':'个人信息已保存，导入表格后自动匹配');};
  const deleteProfile=()=>{setProfile(null);setProfileEnabled(false);setRememberProfile(false);setProfileMode('candidate');setPage(1);try{localStorage.removeItem('position-filter-profile-v1');}catch{}setToast('已清除个人信息');};
  const savePreset = () => {const entry = {id:Date.now(), name: `${sheet.name} · ${activeChips.length} 个条件`, filters, columns: sheet.columns};const next = [entry,...saved].slice(0,8); setSaved(next);storageWrite('position-filter-presets',next);setToast('筛选方案已保存到此浏览器');};
  const changeSheet = i => {setSheetIndex(i); setFilters(emptyFilters());setPage(1);setSort({column:'',direction:'asc'});setExtraColumn('');const s=workbook.sheets[i];setVisibleColumns(initialColumns.map(f=>s.fields[f]).filter(Boolean).length?initialColumns.map(f=>s.fields[f]).filter(Boolean):s.columns.slice(0,6));};
  const commonColumns = ['location','education','degree','politics','years','service','department','bureau','category','test'].map(f=>fields[f]).filter(Boolean);
  const hasData = !!sheet;

  return <div className="app" onDragOver={e => {if(!e.dataTransfer.types.includes('Files'))return;e.preventDefault(); if(!busy) setDrag(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDrag(false);}} onDrop={e => {e.preventDefault();setDrag(false);importFile(e.dataTransfer.files[0]);}}>
    <input ref={fileInput} data-testid="file-input" type="file" accept=".xls,.xlsx,.csv" hidden onChange={e=>importFile(e.target.files[0])}/>
    <header className="topbar"><div className="brand"><span className="brand-icon"><FileSpreadsheet size={23}/></span><strong>岗位筛选台</strong><span className="brand-sub">让每一项报考条件，都有迹可循</span></div><div className="top-actions"><span className="local-note"><ShieldCheck size={15}/>本地处理</span><button className="secondary profile-button" aria-label="个人信息" aria-haspopup="dialog" title="填写个人信息并自动匹配" onClick={()=>setShowProfile(true)}><UserRound size={16}/><span>{profile?'修改个人信息':'个人信息'}</span></button><button className="icon-button" aria-label="使用说明" onClick={()=>setShowHelp(true)}><CircleHelp size={19}/></button><button className="primary" onClick={()=>fileInput.current.click()} disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Upload size={16}/>} {busy?'正在读取…':hasData?'导入新表格':'导入表格'}</button></div></header>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" aria-label="关闭错误提示" onClick={()=>setError('')}><X size={17}/></button></div>}
    {hasData ? <div className="workspace">
      <aside className="sidebar"><div className="source-card"><div className="source-icon"><FileSpreadsheet size={21}/></div><div><small>{isDemo?'演示数据 · 非真实岗位':'当前表格'}</small><strong title={filename}>{filename}</strong><span>{format(rows.length)} 个岗位 · {sheet.columns.length} 列</span></div></div>
        <div className="field sheet-selector"><label>工作表</label><select aria-label="工作表" value={sheetIndex} onChange={e=>changeSheet(Number(e.target.value))}>{workbook.sheets.map((s,i)=><option key={s.name} value={i}>{s.name}（{format(s.rows.length)}）</option>)}</select>{workbook.skipped.length>0&&<p className="helper">已跳过 {workbook.skipped.length} 个空白或无数据工作表</p>}</div>
        <div className="filter-title"><h2><SlidersHorizontal size={17}/>筛选条件</h2><button className="text-button" onClick={()=>{setFilters(emptyFilters());setPage(1);}}><RotateCcw size={13}/>重置</button></div>
        <div className="remark-quick"><span>备注快捷筛选</span><div><button aria-pressed={filters.fresh==='有要求'} className={filters.fresh==='有要求'?'active':''} onClick={()=>update('fresh',filters.fresh==='有要求'?'':'有要求')}>应届 / 届别</button>{['限男性','限女性'].map(v=><button key={v} aria-pressed={filters.gender===v} className={filters.gender===v?'active':''} onClick={()=>update('gender',filters.gender===v?'':v)}>{v}</button>)}</div></div>
        <div className="filter-scroll"><section className="filter-section"><h3>岗位条件 <span>同一字段可多选</span></h3>
          {fields.major&&<div className="field"><label htmlFor="major">专业关键词</label><input id="major" placeholder="如：计算机" value={filters.text[fields.major]||''} onChange={e=>updateMap('text',fields.major,e.target.value)}/><p className="helper">按文字包含匹配，请核对专业代码与学历阶段</p></div>}
          {commonColumns.slice(0,5).map(c=><MultiFilter key={c} column={c} rows={rows} selected={filters.columns[c]} onChange={v=>updateMap('columns',c,v)}/>)}
          <details className="section-details"><summary>更多常见条件 <ChevronDown size={14}/></summary><div>{commonColumns.slice(5).map(c=><MultiFilter key={c} column={c} rows={rows} selected={filters.columns[c]} onChange={v=>updateMap('columns',c,v)}/>)}{fields.count&&<div className="field"><label htmlFor="min-count">最低招考人数</label><input id="min-count" type="number" min="0" placeholder="不限" value={filters.minCount} onChange={e=>update('minCount',e.target.value)}/></div>}</div></details>
        </section>
        <section className="filter-section"><h3>备注里的要求 <span className="identified">自动识别</span></h3><p className="helper">“未注明”仅表示未识别到文字要求。结果请结合备注原文核对。</p>
          <div className="field"><label htmlFor="fresh">应届 / 毕业届别</label><select id="fresh" value={filters.fresh} onChange={e=>update('fresh',e.target.value)}><option value="">不限</option><option value="有要求">有应届或指定届别要求</option><option value="未注明">未注明应届 / 届别要求</option></select></div>
          <div className="field"><label htmlFor="gender">性别要求</label><select id="gender" value={filters.gender} onChange={e=>update('gender',e.target.value)}><option value="">不限</option>{['限男性','限女性','未注明','明确不限','适合男性','适合女性','需核对原文'].map(v=><option key={v}>{v}</option>)}</select></div>
          <details className="section-details" open><summary>包含或排除具体要求 <ChevronDown size={14}/></summary><div className="requirement-list">{requirementOptions.filter(([id])=>tagCounts[id]>0||filters.requirements[id]).map(([id,text])=><div className="requirement-row" key={id}><span>{text}<small>{format(tagCounts[id])}</small></span><select aria-label={`${text}筛选方式`} value={filters.requirements[id]||''} onChange={e=>updateMap('requirements',id,e.target.value)}><option value="">不限</option><option value="include">包含</option><option value="exclude">排除</option></select></div>)}</div></details>
          {fields.notes&&<div className="field"><label htmlFor="notes-keyword">备注关键词</label><input id="notes-keyword" placeholder="补充查找：英语八级、年龄等" value={filters.text[fields.notes]||''} onChange={e=>updateMap('text',fields.notes,e.target.value)}/></div>}
        </section>
        <section className="filter-section"><h3>任意列筛选</h3><p className="helper">表格中的每一列都可以筛选</p><div className="field"><label htmlFor="extra-column">选择列</label><select id="extra-column" value={extraColumn} onChange={e=>setExtraColumn(e.target.value)}><option value="">选择需要筛选的列</option>{sheet.columns.map(c=><option key={c}>{c}</option>)}</select></div>{extraColumn&&<><MultiFilter column={extraColumn} rows={rows} selected={filters.columns[extraColumn]} onChange={v=>updateMap('columns',extraColumn,v)}/><div className="field"><label htmlFor="extra-text">包含文字</label><input id="extra-text" placeholder="输入关键词" value={filters.text[extraColumn]||''} onChange={e=>updateMap('text',extraColumn,e.target.value)}/></div></>}</section>
        <section className="filter-section"><h3>已保存的筛选</h3>{saved.length?saved.map(p=><div className="preset" key={p.id}><button onClick={()=>{const available=new Set(sheet.columns);setFilters({...emptyFilters(),...p.filters,columns:Object.fromEntries(Object.entries(p.filters.columns).filter(([c])=>available.has(c))),text:Object.fromEntries(Object.entries(p.filters.text).filter(([c])=>available.has(c)))});setPage(1);setToast('已应用筛选方案');}}>{p.name}</button><button className="icon-button" aria-label={`删除${p.name}`} onClick={()=>{const next=saved.filter(s=>s.id!==p.id);setSaved(next);storageWrite('position-filter-presets',next);}}><X size={13}/></button></div>):<p className="helper">保存常用条件，下次导入后可直接应用。</p>}</section>
        </div><div className="sidebar-bottom"><ShieldCheck size={14}/><span>文件在浏览器内解析，不上传</span></div>
      </aside>
      <main className="results"><div className="page-heading"><div><div className="eyebrow">{isDemo?'功能预览':'岗位检索'}<span>/</span>{sheet.name}</div><h1>找到适合你的岗位</h1><p>从基础条件到备注要求，逐步缩小选择范围。</p></div><div className="heading-actions"><button className={`secondary search-trigger ${filters.query?'has-query':''}`} aria-label="搜索岗位" aria-haspopup="dialog" onClick={()=>{setSearchDraft(filters.query);setShowSearch(true);}}><Search size={15}/>搜索{filters.query&&<span className="search-active-dot" aria-label="已有搜索关键词"/>}</button><button className="secondary" onClick={savePreset} disabled={!activeChips.length}><Bookmark size={15}/>保存筛选</button></div></div>
        {isDemo&&<div className="demo-banner"><CircleHelp size={16}/><span>正在展示虚构的示例数据。导入你的岗位表后开始实际筛选。</span><button className="text-button" onClick={()=>fileInput.current.click()}>导入岗位表 <Upload size={14}/></button></div>}
        {profile&&<div className={`profile-statusbar ${profileActive?'enabled':''}`}><UserRound size={15}/><span title={`${profile.records[0].level} · ${profile.records[0].major}`}>{profileActive?'个人匹配已开启':'个人匹配已暂停'} · {profile.records[0].level} / {profile.records[0].major}</span><div><button className="text-button" onClick={()=>setShowProfile(true)}>修改</button><button className="text-button" onClick={()=>{setProfileEnabled(!profileEnabled);setPage(1);}}>{profileActive?'暂停匹配':'开启匹配'}</button></div></div>}
        {activeChips.length>0&&<div className="active-filters"><div className="active-label"><Filter size={14}/><span>已选条件</span></div>{activeChips.map((chip,i)=><button className="filter-chip" key={i} title={chip.text} onClick={chip.clear}>{chip.text}<X size={12}/></button>)}<button className="text-button clear-all" onClick={()=>{setFilters(emptyFilters());setPage(1);}}>清除全部</button></div>}
        <section className="table-card"><div className="result-toolbar"><div className="result-tabs"><button className={!filters.onlyFavorites?'selected':''} onClick={()=>update('onlyFavorites',false)}><ListFilter size={16}/>{profileActive?'匹配结果':'全部岗位'}</button><button className={filters.onlyFavorites?'selected':''} onClick={()=>update('onlyFavorites',true)}><Bookmark size={15}/>我的收藏 <span>{rows.filter(r=>favorites.has(r.id)).length}</span></button></div><div className="result-actions"><details className="column-picker"><summary><Columns3 size={16}/>显示列</summary><div className="column-panel">{sheet.columns.map(c=><label key={c}><input type="checkbox" checked={visibleColumns.includes(c)} onChange={()=>setVisibleColumns(prev=>prev.includes(c)?prev.filter(v=>v!==c):[...prev,c])}/>{c}</label>)}</div></details><button className="secondary export-button" disabled={!sorted.length} onClick={exportResult}><Download size={15}/>导出结果</button></div></div>
          <div className="result-summary" aria-live="polite"><span>匹配 <strong data-testid="result-count">{format(filtered.length)}</strong> 个岗位 <span className="summary-total">/ {format(rows.length)}</span></span>{fields.count&&<span>招考 <strong>{format(totalPeople)}</strong> 人</span>}{profileActive?<label className="eligibility-mode">个人匹配范围<select aria-label="个人匹配范围" value={profileMode} onChange={e=>{setProfileMode(e.target.value);setPage(1);}}><option value="candidate">可报候选（{format(assessmentCounts.candidate)}）</option><option value="matched">基础匹配（{format(assessmentCounts.matched)}）</option><option value="review">待核对（{format(assessmentCounts.review)}）</option><option value="excluded">已排除（{format(assessmentCounts.excluded)}）</option><option value="all">所有岗位</option></select></label>:<span className="summary-note">{deferred!==filters?'正在筛选…':'不同字段同时满足 · 同一字段任一满足'}</span>}</div>
          <div className="table-scroll"><table><thead><tr><th className="favorite-cell">收藏</th>{visibleColumns.map(c=><th key={c} className={c===fields.major?'major-col':c===fields.title?'title-col':''}><button onClick={()=>{setSort(prev=>({column:c,direction:prev.column===c&&prev.direction==='asc'?'desc':'asc'}));setPage(1);}}>{c}{sort.column===c?(sort.direction==='asc'?<ArrowUp size={13}/>:<ArrowDown size={13}/>):<ArrowUpDown size={12}/>}</button></th>)}<th className="requirements-col">备注要求</th><th className="detail-cell">详情</th></tr></thead><tbody>{pageRows.map(row=><tr key={row.id}><td className="favorite-cell"><button className={`favorite-button ${favorites.has(row.id)?'bookmarked':''}`} aria-label={`${favorites.has(row.id)?'取消收藏':'收藏'} ${row.cells[fields.code]||row.sourceRow}`} onClick={()=>toggleFavorite(row)}><Bookmark size={17} fill={favorites.has(row.id)?'currentColor':'none'}/></button></td>{visibleColumns.map(c=><td key={c} className={c===fields.title?'title-text':c===fields.major?'major-text':c===fields.count?'count-text':''} title={row.cells[c]}><span>{row.cells[c]||'—'}</span>{c===fields.title&&<small className="job-code job-meta">{fields.code&&<span>{row.cells[fields.code]}</span>}{profileActive&&<span className={`eligibility-badge ${assessments.get(row.id)?.status}`} title={(assessments.get(row.id)?.excluded[0]||assessments.get(row.id)?.pending[0])?.message||'已填写的基础条件匹配'}>{statusLabels[assessments.get(row.id)?.status]}</span>}</small>}</td>)}<td className="requirements-col"><div className="tag-wrap">{row.requirements.tags.slice(0,3).map(id=><span className={`requirement-tag ${['fresh','cohort'].includes(id)?'fresh-tag':['male','female'].includes(id)?'gender-tag':''}`} key={id}>{label(id)}</span>)}{row.requirements.tags.length>3&&<span className="more-tags">+{row.requirements.tags.length-3}</span>}{!row.requirements.tags.length&&<span className="no-tags">未识别到要求</span>}</div></td><td className="detail-cell"><button className="detail-button" onClick={()=>setDetail(row)}>查看 <ChevronRight size={13}/></button></td></tr>)}</tbody></table>{!pageRows.length&&<div className="no-results"><Search size={30}/><h3>{filters.onlyFavorites&&!favorites.size?'还没有收藏岗位':profileActive&&profileMode==='candidate'?'尚未找到基础条件匹配的候选岗位':'没有找到符合条件的岗位'}</h3><p>{filters.onlyFavorites&&!favorites.size?'点击岗位前的书签图标，保存你想进一步了解的岗位。':profileActive&&profileMode==='candidate'?'可以补充专业代码或其他学历，或切换“待核对”查看未确认的岗位。':'减少一个筛选条件，或换一个关键词试试。'}</p><button className="secondary" onClick={()=>{setFilters(emptyFilters());setProfileMode('all');setPage(1);}}>查看全部岗位</button></div>}</div>
          <div className="pagination"><span>{sorted.length?`${format((currentPage-1)*pageSize+1)}–${format(Math.min(currentPage*pageSize,sorted.length))} / ${format(sorted.length)} 个岗位`:'0 个岗位'}</span><div><label>每页 <select aria-label="每页岗位数" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[20,50,100].map(n=><option key={n}>{n}</option>)}</select> 项</label><button className="icon-button" aria-label="上一页" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={17}/></button><span>{currentPage} / {maxPage}</span><button className="icon-button" aria-label="下一页" disabled={currentPage===maxPage} onClick={()=>setPage(currentPage+1)}><ChevronRight size={17}/></button></div></div>
        </section><p className="results-footer">{profileActive?'可报候选已匹配专业与学历，并排除明确不符的条件。未确认专业范围的岗位可在“待核对”中查看；备注和通用资格仍需审核。':'备注筛选根据原文关键词识别；英语等级等可能存在任选条件，请打开详情核对完整要求。'}</p>
      </main>
    </div> : <main className="empty-main"><div className="empty-heading"><div className="eyebrow">国考 · 省考 · 招聘岗位表</div><h1>把一张表，变成你的岗位清单。</h1><p>导入岗位表，组合筛选学历、专业、地区与备注要求。<br/>从数千个岗位中，找到值得进一步了解的选择。</p></div><button className="dropzone" onClick={()=>fileInput.current.click()} disabled={busy}><span className="upload-art"><FileSpreadsheet size={34}/><span><Upload size={15}/></span></span><strong>{busy?'正在读取表格…':'点击导入，或拖入岗位表'}</strong><span>支持 .xls、.xlsx、.csv · 最大 60 MB</span><span className="import-cta">{busy?<LoaderCircle className="spin" size={16}/>:<FolderOpen size={16}/>}选择表格</span></button><div className="empty-features"><div><SlidersHorizontal size={20}/><strong>常见列组合筛选</strong><span>地区、学历、学位、专业、政治面貌</span></div><div><CheckCheck size={20}/><strong>读懂备注要求</strong><span>应届、性别、英语等级、资格证书</span></div><div><Download size={20}/><strong>留下你的候选清单</strong><span>收藏岗位，导出所有匹配结果</span></div></div><div className="empty-bottom"><ShieldCheck size={15}/><span>所有文件在本地浏览器处理</span><button className="text-button" onClick={()=>initialize(demoWorkbook(),'示例岗位表',true)}>先用示例体验 <ChevronRight size={14}/></button></div></main>}
    {detail&&<dialog ref={dialogRef} className="detail-dialog" onClose={()=>setDetail(null)} onClick={e=>{if(e.target===e.currentTarget){dialogRef.current.close();}}}><div className="detail-header"><div><div className="eyebrow">{sheet.name} · 原表第 {detail.sourceRow} 行</div><h2>{detail.cells[fields.title]||'岗位详情'}</h2><p>{detail.cells[fields.department]} {detail.cells[fields.code]&&`· ${detail.cells[fields.code]}`}</p></div><button className="icon-button" aria-label="关闭岗位详情" autoFocus onClick={()=>dialogRef.current.close()}><X size={21}/></button></div><div className="detail-content">{profileActive&&<MatchingDetails assessment={assessments.get(detail.id)}/>}<section className="note-section"><h3>备注原文</h3><p className="original-note">{detail.cells[fields.notes]||'此岗位没有填写备注。'}</p>{detail.requirements.tags.length>0&&<><h4>识别到的要求与依据</h4><div className="evidence-list">{detail.requirements.tags.map(id=><div key={id}><span className="requirement-tag">{label(id)}</span><span>{detail.requirements.evidence[id]}</span></div>)}</div></>}<p className="helper">识别结果用于辅助筛选。最终条件以原表、招录公告和招录单位解释为准。</p></section><h3>全部岗位信息</h3><dl className="detail-fields">{sheet.columns.filter(c=>c!==fields.notes).map(c=><div key={c}><dt>{c}</dt><dd>{detail.cells[c]||'—'}</dd></div>)}</dl></div><div className="detail-footer"><button className="secondary" onClick={()=>toggleFavorite(detail)}><Bookmark size={15}/>{favorites.has(detail.id)?'取消收藏':'收藏此岗位'}</button><button className="primary" onClick={()=>dialogRef.current.close()}>完成</button></div></dialog>}
    {showHelp&&<dialog ref={helpDialogRef} className="help-dialog" aria-label="使用说明" onClose={()=>setShowHelp(false)} onClick={e=>{if(e.target===e.currentTarget)helpDialogRef.current.close();}}><button className="icon-button help-close" aria-label="关闭使用说明" autoFocus onClick={()=>helpDialogRef.current.close()}><X size={20}/></button><h2>从岗位表到候选清单</h2><ol><li><strong>导入表格</strong><p>支持 Excel 与 CSV，自动寻找前 40 行中的表头。多个工作表分别筛选，避免重复计算。</p></li><li><strong>组合筛选</strong><p>不同条件同时满足，同一列多选时任一值满足。专业及备注支持包含关键词；全局搜索多个词用逗号分隔，所有词均需出现。</p></li><li><strong>核对备注</strong><p>支持“限男性”和独立列举的“男性”等写法。“适合男性”单独标注；“未注明”代表未识别到限制。指定毕业届别与一般应届要求分开标记。</p></li><li><strong>收藏并导出</strong><p>导出当前筛选的全部岗位，保留所有原始列、识别标签及来源行号。收藏和筛选方案保存在此浏览器，导入文件不会上传。</p></li></ol><button className="primary" onClick={()=>helpDialogRef.current.close()}>开始使用</button></dialog>}
    {showSearch&&<dialog ref={searchDialogRef} className="search-dialog" aria-labelledby="search-dialog-title" onClose={()=>setShowSearch(false)} onClick={e=>{if(e.target!==e.currentTarget)return;const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)searchDialogRef.current.close();}}>
      <form onSubmit={e=>{e.preventDefault();update('query',searchDraft.trim());searchDialogRef.current.close();}}>
        <div className="search-dialog-header"><h2 id="search-dialog-title"><Search size={19}/>搜索岗位</h2><button type="button" className="icon-button" aria-label="关闭搜索框" onClick={()=>searchDialogRef.current.close()}><X size={20}/></button></div>
        <div className="search-dialog-content"><label htmlFor="job-search">关键词</label><div className="search-bar"><Search size={17}/><input id="job-search" aria-label="搜索全部岗位字段" aria-describedby="search-dialog-hint" autoFocus placeholder="搜索职位、单位、地点、专业…" value={searchDraft} onChange={e=>setSearchDraft(e.target.value)}/>{searchDraft&&<button type="button" className="icon-button" aria-label="清除关键词" onClick={()=>setSearchDraft('')}><X size={16}/></button>}</div><p id="search-dialog-hint" className="helper">搜索全部字段。多个关键词用逗号分隔，结果需同时包含所有关键词。</p></div>
        <div className="search-dialog-footer"><button type="button" className="secondary" onClick={()=>searchDialogRef.current.close()}>取消</button><button type="submit" className="primary"><Search size={15}/>搜索</button></div>
      </form>
    </dialog>}
    {showProfile&&<ProfileDialog profile={profile} remember={rememberProfile} filename={filename} onClose={()=>setShowProfile(false)} onSave={saveProfile} onDelete={deleteProfile}/>}
    {drag&&<div className="drag-overlay"><Upload size={42}/><h2>松开鼠标，导入岗位表</h2></div>}
    {busy&&<div className="loading-overlay" role="status"><LoaderCircle size={32} className="spin"/><h2>正在读取岗位表</h2><p>解析工作表与备注要求，请稍候…</p></div>}
    {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
