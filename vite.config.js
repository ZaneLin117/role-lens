import { defineConfig } from 'vite';
// Bundle into one offline HTML file, including the inline parsing worker.
const offlineHtml = {name: 'offline-html', enforce: 'post', generateBundle(_, bundle) {
  const html = bundle['index.html'];
  if (!html) return;
  html.source = String(html.source).replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, path) => {
    const key = path.replace(/^\.?\//, ''); const chunk = bundle[key];
    if (!chunk || chunk.type !== 'chunk') return _;
    delete bundle[key]; return `<script type="module">${chunk.code.replace(/<\/script/gi, '<\\/script')}</script>`;
  }).replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g, (_, path) => {
    const key = path.replace(/^\.?\//, ''); const asset = bundle[key];
    if (!asset) return _;
    delete bundle[key]; return `<style>${asset.source}</style>`;
  });
}};
export default defineConfig(({mode}) => {
  const web = mode === 'web';
  // A .gz URL can be served with Content-Encoding:gzip and decompressed by the
  // browser before our worker receives it. Keep the workbook as opaque bytes.
  const output = web ? {assetFileNames: asset => asset.names.some(name => name.endsWith('.xls.gz')) ? 'assets/[name]-[hash].bin' : 'assets/[name]-[hash][extname]'} : {};
  return {base: './', plugins: web ? [] : [offlineHtml], build: {target: 'es2022', outDir: web ? 'dist-web' : 'dist', assetsInlineLimit: web ? 4096 : 10000000, rollupOptions: {output}}, server: {port: 5173, strictPort: true, watch: {ignored: ['**/.local/**','**/vendor/**']}}};
});
