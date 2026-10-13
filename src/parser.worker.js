import { parseWorkbook } from './data';
self.onmessage = async ({data}) => {
  try {
    let bytes = data;
    if (data.gzip) {
      if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器不支持内置表加载，请更新 Chrome / Edge，或手动导入岗位表。');
      const stream = new Blob([data.buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = await new Response(stream).arrayBuffer();
    }
    self.postMessage({ok: true, workbook: parseWorkbook(bytes)});
  }
  catch(error) {self.postMessage({ok: false, error: error.message || '表格读取失败，请检查文件格式。'});}
};
