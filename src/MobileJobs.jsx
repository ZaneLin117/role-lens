import React from 'react';
import {Bookmark, ChevronRight} from 'lucide-react';
import {requirementOptions} from './data';
import {statusLabels} from './eligibility';

export default function MobileJobs({rows, fields, columns, favorites, onFavorite, onDetail, assessments, profileActive}) {
  const tagLabel = id => requirementOptions.find(([key]) => key === id)?.[1] || id;
  const titleColumn = fields.title || columns[0];
  const contentColumns = columns.filter(c => ![titleColumn, fields.department, fields.count].includes(c));
  return <div className="mobile-jobs" aria-label="手机岗位列表">
    {rows.map(row => <article className="mobile-job" key={row.id}>
      <div className="mobile-job-heading"><div><h2>{row.cells[titleColumn] || '岗位详情'}</h2><div className="mobile-job-code">{fields.code && <span>{row.cells[fields.code]}</span>}{profileActive && <span className={`eligibility-badge ${assessments.get(row.id)?.status}`}>{statusLabels[assessments.get(row.id)?.status]}</span>}</div></div><button className={`favorite-button ${favorites.has(row.id)?'bookmarked':''}`} aria-label={`${favorites.has(row.id)?'取消收藏':'收藏'} ${row.cells[fields.code] || row.sourceRow}`} onClick={() => onFavorite(row)}><Bookmark size={20} fill={favorites.has(row.id)?'currentColor':'none'}/></button></div>
      {fields.department && columns.includes(fields.department) && <p className="mobile-job-department">{row.cells[fields.department] || '—'}</p>}
      <dl className="mobile-job-fields">{contentColumns.map(column => <div className={column===fields.major?'wide':''} key={column}><dt>{column}</dt><dd>{row.cells[column] || '—'}</dd></div>)}</dl>
      <div className="tag-wrap mobile-job-tags">{row.requirements.tags.slice(0,3).map(id => <span className={`requirement-tag ${['fresh','cohort'].includes(id)?'fresh-tag':['male','female'].includes(id)?'gender-tag':''}`} key={id}>{tagLabel(id)}</span>)}{row.requirements.tags.length>3 && <span className="more-tags">+{row.requirements.tags.length-3}</span>}{!row.requirements.tags.length && <span className="no-tags">未识别到备注要求</span>}</div>
      <div className="mobile-job-footer">{fields.count && columns.includes(fields.count) && <span>招考 <strong>{row.cells[fields.count] || '—'}</strong> 人</span>}<button className="detail-button" onClick={() => onDetail(row)} aria-label={`查看岗位详情 ${row.cells[fields.code] || row.sourceRow}`}>查看详情 <ChevronRight size={16}/></button></div>
    </article>)}
  </div>;
}
