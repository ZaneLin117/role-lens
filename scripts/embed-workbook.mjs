import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseWorkbook} from '../src/data.js';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/embed-workbook.mjs <2027 workbook path>');
const bytes = fs.readFileSync(source);
const workbook = parseWorkbook(bytes);
const metadata = {
  name: path.basename(source), year: 2027,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  originalBytes: bytes.length,
  sheets: workbook.sheets.map(s => ({name:s.name, rows:s.rows.length, columns:s.columns.length, headerRow:s.headerRow})),
  skipped: workbook.skipped,
};
const assets = fileURLToPath(new URL('../src/assets/', import.meta.url));
fs.mkdirSync(assets, {recursive:true});
const compressed = gzipSync(bytes, {level:9});
fs.writeFileSync(path.join(assets, 'national-2027.xls.gz'), compressed);
fs.writeFileSync(path.join(assets, 'national-2027.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({name:metadata.name, originalBytes:bytes.length, embeddedBytes:compressed.length, sheets:metadata.sheets}));
