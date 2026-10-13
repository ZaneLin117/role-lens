import { parseWorkbook } from './data';
self.onmessage = ({data}) => {
  try {self.postMessage({ok: true, workbook: parseWorkbook(data)});}
  catch(error) {self.postMessage({ok: false, error: error.message || '表格读取失败，请检查文件格式。'});}
};
