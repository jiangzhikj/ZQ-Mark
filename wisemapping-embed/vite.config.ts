import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { resolve, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

function resolveWmImportsViaEmbedDeps(embedPkgJson: string, wmRoot: string): Plugin {
  const req = createRequire(embedPkgJson)
  const wmNorm = normalize(wmRoot)
  return {
    name: 'zq-resolve-wm-via-embed-deps',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer) return null
      if (!normalize(importer).includes(wmNorm)) return null
      if (id.startsWith('.') || id.startsWith('\0')) return null
      if (id.startsWith('@wisemapping')) return null
      try {
        return req.resolve(id)
      } catch {
        return null
      }
    },
  }
}

const rootDir = fileURLToPath(new URL('.', import.meta.url))
/** 与 zq-mark 同级的 wisemapping-frontend 源码目录（本仓库默认名 wisemapping-frontend-main） */
const wmRoot = resolve(rootDir, '..', '..', 'wisemapping-frontend-main')

if (!existsSync(join(wmRoot, 'packages', 'editor', 'package.json'))) {
  console.error(
    '[wisemapping-embed] 未找到 WiseMapping 源码：请将仓库置于与 zq-mark 同级目录，例如：',
 wmRoot,
  )
  process.exit(1)
}

export default defineConfig({
  plugins: [react(), resolveWmImportsViaEmbedDeps(join(rootDir, 'package.json'), wmRoot)],
  base: './',
  resolve: {
    alias: [
      {
        find: /^lodash\/([^/]+)$/,
        replacement: join(rootDir, 'node_modules/lodash/$1.js'),
      },
      {
        find: /^@wisemapping\/editor\/src\/(.*)/,
        replacement: join(wmRoot, 'packages/editor/src/$1'),
      },
      { find: /^@wisemapping\/editor$/, replacement: join(wmRoot, 'packages/editor/src/index.ts') },
      {
        find: /^@wisemapping\/mindplot\/src\/(.*)/,
        replacement: join(wmRoot, 'packages/mindplot/src/$1'),
      },
      { find: /^@wisemapping\/mindplot$/, replacement: join(wmRoot, 'packages/mindplot/src/index.ts') },
      {
        find: /^@wisemapping\/web2d\/src\/(.*)/,
        replacement: join(wmRoot, 'packages/web2d/src/$1'),
      },
      { find: /^@wisemapping\/web2d$/, replacement: join(wmRoot, 'packages/web2d/src/index.ts') },
    ],
  },
  server: {
    fs: {
      allow: [rootDir, wmRoot, join(wmRoot, 'packages')],
    },
  },
  define: {
    'process.env': {},
    global: 'window',
  },
  optimizeDeps: {
    include: ['lodash', 'react-intl', '@emotion/react', '@emotion/styled', '@mui/material'],
  },
  build: {
    outDir: resolve(rootDir, '../resources/wisemapping'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
})
