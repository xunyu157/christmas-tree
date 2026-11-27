import { defineConfig } from 'vite';

export default defineConfig({
  // 使用相对路径，确保部署到 GitHub Pages 子路径或 Vercel 都能正常加载资源
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096
  }
});
