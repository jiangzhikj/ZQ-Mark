import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/** 仅构建/运行渲染进程，用于浏览器（无 Electron 主进程） */
export default defineConfig({
  root: resolve(process.cwd(), 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(process.cwd(), 'dist/web'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src/renderer/src')
    }
  },
  plugins: [tailwindcss(), vue()]
})
