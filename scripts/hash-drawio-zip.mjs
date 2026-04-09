#!/usr/bin/env node
/**
 * 计算 draw.io 插件 zip 的 sha256 与 size，便于更新 resources/plugins/drawio/manifest.json
 * 用法：node scripts/hash-drawio-zip.mjs [path/to/archive.zip]
 * 默认：resources/drawio-1.0.0.zip
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultZip = path.join(root, 'resources', 'drawio-1.0.0.zip')
const zipPath = path.resolve(process.argv[2] || defaultZip)

if (!fs.existsSync(zipPath)) {
  console.error('File not found:', zipPath)
  process.exit(1)
}

const hash = createHash('sha256')
await new Promise((resolve, reject) => {
  fs.createReadStream(zipPath)
    .on('data', (chunk) => hash.update(chunk))
    .on('end', resolve)
    .on('error', reject)
})

const st = fs.statSync(zipPath)
const out = {
  path: zipPath,
  sha256: hash.digest('hex'),
  size: st.size,
}
console.log(JSON.stringify(out, null, 2))
