import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {ChevronDown, Check} from 'lucide-react';
import {majorCatalog} from './eligibility';
import {normalized} from './data';

const choices = [...majorCatalog.majors, {name:'数字媒体', code:'', category:'请确认毕业证全称', categoryCode:'ambiguous'}];
const categories = [...Object.entries(majorCatalog.categories), ['cross','交叉学科（未分专业类）']];

export default function MajorSelect({value, level, ariaLabel, onChange, children}) {
  const id = useId();
  const input = useRef(null); const container = useRef(null); const list = useRef(null);
  const pointerActive = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('');
  const [active, setActive] = useState(-1);
  const shown = useMemo(() => {
    const words = normalized(query).toLowerCase().split(/[,，、]/).filter(Boolean);
    return choices.filter(m => (!category || (m.categoryCode || 'cross') === category)
      && words.every(word => `${m.name}${m.code}${m.categoryCode}${m.category}`.toLowerCase().includes(word)));
  }, [query, category]);
  const openMenu = () => {setQuery(''); setCategory(''); setActive(-1); setOpen(true);};
  const choose = major => {onChange(major.name); input.current?.focus(); setOpen(false); setActive(-1);};
  useEffect(() => {if (list.current) list.current.scrollTop = 0;}, [open, query, category]);
  useEffect(() => {
    if (!open) return;
    // An inline list changes the form's height. Close after an outside click so
    // a button below the list does not move between pointerdown and pointerup.
    const pointerDown = () => {pointerActive.current = true;};
    const pointerUp = () => {pointerActive.current = false;};
    const outside = event => {if (!container.current?.contains(event.target)) setOpen(false);};
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('pointerup', pointerUp, true);
    document.addEventListener('pointercancel', pointerUp, true);
    document.addEventListener('click', outside);
    return () => {
      pointerActive.current = false;
      document.removeEventListener('pointerdown', pointerDown, true);
      document.removeEventListener('pointerup', pointerUp, true);
      document.removeEventListener('pointercancel', pointerUp, true);
      document.removeEventListener('click', outside);
    };
  }, [open]);
  useEffect(() => {
    if (!open || active < 0) return;
    const option = list.current?.children[active];
    if (!option) return;
    if (option.offsetTop < list.current.scrollTop) list.current.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.current.scrollTop + list.current.clientHeight)
      list.current.scrollTop = option.offsetTop + option.offsetHeight - list.current.clientHeight;
  }, [active, open]);
  const keyDown = event => {
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (!open) {openMenu(); setActive(event.key === 'ArrowDown' ? 0 : choices.length - 1);}
      else setActive(current => !shown.length ? -1 : event.key === 'ArrowDown' ? Math.min(current + 1, shown.length - 1) : current < 0 ? shown.length - 1 : Math.max(0, current - 1));
    } else if (open && event.key === 'Enter') {
      event.preventDefault();
      if (shown[active]) choose(shown[active]); else setOpen(false);
    } else if (open && event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    }
  };
  return <div className="profile-field wide">
    <label htmlFor={id}>专业名称（按毕业证）</label>
    <div className="major-picker" ref={container} onBlur={event => {if (!pointerActive.current && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}>
      <div className="major-input">
        <input id={id} ref={input} aria-label={ariaLabel} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && shown[active] ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" placeholder="输入专业名称、代码或专业类" value={value}
          onFocus={() => {if (!open) openMenu();}}
          onChange={event => {onChange(event.target.value); setQuery(event.target.value); setCategory(''); setActive(-1); setOpen(true);}} onKeyDown={keyDown}/>
        <button type="button" aria-label={`${open?'收起':'展开'}${ariaLabel}列表`} aria-expanded={open} aria-controls={`${id}-list`} onMouseDown={event => event.preventDefault()} onClick={() => {if (open) setOpen(false); else {openMenu(); input.current?.focus();}}}><ChevronDown size={17}/></button>
      </div>
      {open && <div className="major-menu">
        <div className="major-menu-toolbar"><select aria-label={`${ariaLabel}分类`} value={category} onChange={event => {setCategory(event.target.value); setActive(-1);}}><option value="">全部专业类</option>{categories.map(([code,name]) => <option key={code} value={code}>{code==='cross'?'':`${code} `}{name}</option>)}</select><span aria-live="polite">{shown.length} 个选项</span></div>
        <div className="major-list" role="listbox" id={`${id}-list`} aria-label={`${ariaLabel}选项`} ref={list}>
          {shown.map((major,index) => <button type="button" role="option" id={`${id}-option-${index}`} key={major.code || major.name} aria-selected={value === major.name} tabIndex={-1} className={active === index ? 'keyboard-active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(major)}>
            <span><strong>{major.name}</strong><small>{major.code ? `${major.code} · ` : ''}{major.category}</small></span>{value === major.name && <Check size={15}/>}
          </button>)}
        </div>
        {!shown.length && <p className="major-empty">没有找到对应专业，可保留输入的毕业证名称。</p>}
        <p className="major-menu-hint">按名称、代码或专业类搜索，↑↓ 选择，Enter 确认</p>
      </div>}
    </div>
    <small id={`${id}-hint`}>{majorCatalog.majors.length} 个本科专业可选，也可手动填写。{level && level !== '本科' ? '专科 / 研究生请按毕业证填写，专业代码需另行确认。' : '本科选择后自动带入专业代码。'}</small>
    {children}
  </div>;
}
