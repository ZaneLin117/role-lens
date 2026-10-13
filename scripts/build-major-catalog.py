"""Extract the public Ministry of Education undergraduate catalog, never infer codes."""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader

groups = {}
majors = []
for page in PdfReader(sys.argv[1]).pages:
    for line in page.extract_text(extraction_mode='layout').splitlines():
        match = re.match(r'^\s*(\d{4}(?:\d{2}[A-Z]*)?)\s+(.+)$', line)
        if not match:
            continue
        code, name = match.groups()
        raw_name = re.sub(r'\s+', '', name)
        name = raw_name.split('（注')[0].split('(注')[0]
        if len(code) == 4 and name.endswith('类'):
            groups[code] = name
        elif len(code) >= 6:
            majors.append({'code': code, 'name': name, 'categoryCode': code[:4], 'previousCodes': re.findall(r'原专业代码为(\d{6}[A-Z]*)', raw_name)})
for major in majors:
    if major['categoryCode'] in groups:
        major['category'] = groups[major['categoryCode']]
    else:
        assert major['categoryCode'] == '1400'
        major['categoryCode'] = ''
        major['category'] = '交叉学科（未分专业类）'
assert len(majors) >= 850, len(majors)
assert len(groups) >= 90, len(groups)
assert next(m for m in majors if m['code'] == '080903')['name'] == '网络工程'
assert len({m['code'] for m in majors}) == len(majors)
data = {'year': 2026, 'source': 'https://www.moe.gov.cn/srcsite/A08/moe_1034/s3882/202604/W020260427440749576927.pdf', 'categories': groups, 'majors': majors}
Path(sys.argv[2]).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Validated {len(majors)} undergraduate majors in {len(groups)} categories.')
