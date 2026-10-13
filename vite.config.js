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
export default defineConfig({base: './', plugins: [offlineHtml], build: {target: 'es2022', assetsInlineLimit: 10000000}, server: {port: 5173, strictPort: true, watch: {ignored: ['**/.local/**','**/vendor/**']}}});
