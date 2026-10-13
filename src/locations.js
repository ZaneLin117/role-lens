const normalize = value => String(value ?? '').trim().replace(/[\s\u3000]/g, '');

export function isLocationColumn(column) {
  return ['工作地点', '工作地区', '工作地', '落户地点'].includes(normalize(column));
}

// Derive ancestors from the address written in the workbook. Do not guess the
// province or city of a county whose parent is absent from the source text.
export function locationScopes(value) {
  const address = normalize(value);
  const scopes = new Set([address]);
  const province = address.match(/^(.+?(?:省|自治区)|北京市|天津市|上海市|重庆市|香港特别行政区|澳门特别行政区)/)?.[0];
  if (!province) return scopes;
  scopes.add(province);
  let prefix = province;
  let rest = address.slice(province.length);
  while (rest) {
    const part = rest.match(/^(.+?(?:自治州|地区|盟|市|自治县|自治旗|县|区|旗))/)?.[0];
    if (!part) break;
    prefix += part;
    scopes.add(prefix);
    rest = rest.slice(part.length);
  }
  return scopes;
}

export function matchesLocation(value, choices) {
  const scopes = locationScopes(value);
  return choices.some(choice => scopes.has(normalize(choice)));
}

export function filterOptions(rows, column) {
  const geographic = isLocationColumn(column);
  const counts = new Map();
  for (const row of rows) {
    const value = row.cells[column] || '';
    // Count a job once per option, even when a parent and child are both selected.
    const values = geographic ? locationScopes(value) : [value];
    for (const option of values) counts.set(option, (counts.get(option) || 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
}
