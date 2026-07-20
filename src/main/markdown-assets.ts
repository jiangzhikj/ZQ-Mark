import { join, basename, extname, resolve as pathResolve } from 'path'
import { writeFile, mkdir, copyFile, access, stat, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'node:url'
import { assetUrlToLocalPath, localPathToAssetUrl } from './asset-protocol'
import {
  type MdAssetSettings,
  normalizeMdAssetSettings,
  resolveMdAssetDir,
  toMdRelativePath,
  makeUniqueFileName,
  isEmbeddableAssetUrl,
  isRelativeAssetPath,
  mdAssetAttrKeysForType,
  resolveRelativeAssetPath,
  resolveMdContentAssetUrls,
  extractEmbeddableUrlsFromMarkdown,
  replaceEmbeddableUrlsInMarkdown,
} from '../shared/markdown-assets'

export interface MdAssetSaveResult {
  id: string
  path: string
  url: string
  name: string
  size: number
  relativePath: string
}

function urlToLocalPath(url: string): string | null {
  const fromAsset = assetUrlToLocalPath(url)
  if (fromAsset) return fromAsset
  if (url.startsWith('file://')) {
    try {
      return fileURLToPath(url)
    } catch {
      return null
    }
  }
  return null
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

async function seedUsedNamesFromDir(assetDir: string, usedNames: Set<string>): Promise<void> {
  try {
    const entries = await readdir(assetDir)
    for (const name of entries) {
      usedNames.add(name)
    }
  } catch {
    /* directory may not exist yet */
  }
}

function pickFileName(
  originalName: string,
  settings: MdAssetSettings,
  usedNames: Set<string>,
): string {
  const ext = extname(originalName) || '.bin'
  if (settings.mdAssetFileName === 'uuid') {
    return makeUniqueFileName(`${randomUUID()}${ext}`, usedNames)
  }
  const baseName = basename(originalName) || `file${ext}`
  return makeUniqueFileName(baseName, usedNames)
}

async function pickAvailableFileName(
  assetDir: string,
  originalName: string,
  settings: MdAssetSettings,
  usedNames: Set<string>,
): Promise<string> {
  await seedUsedNamesFromDir(assetDir, usedNames)
  let name = pickFileName(originalName, settings, usedNames)
  const ext = extname(name)
  const base = ext ? name.slice(0, -ext.length) : name
  let counter = 1
  while (existsSync(join(assetDir, name))) {
    name = `${base}_${counter}${ext}`
    counter++
  }
  usedNames.add(name)
  return name
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function buildResult(
  absolutePath: string,
  docPath: string,
  fileName: string,
  size: number,
): MdAssetSaveResult {
  const relativePath = toMdRelativePath(docPath, absolutePath)
  return {
    id: fileName,
    path: absolutePath,
    url: localPathToAssetUrl(absolutePath),
    name: fileName,
    size,
    relativePath,
  }
}

/** 将 buffer 写入文档资源目录 */
export async function saveBufferToDocFolder(
  buffer: Buffer,
  fileName: string,
  docPath: string,
  partialSettings?: Partial<MdAssetSettings>,
  usedNames?: Set<string>,
): Promise<MdAssetSaveResult> {
  const settings = normalizeMdAssetSettings(partialSettings)
  const assetDir = resolveMdAssetDir(docPath, settings)
  await ensureDir(assetDir)
  const names = usedNames ?? new Set<string>()
  const localName = await pickAvailableFileName(assetDir, fileName, settings, names)
  const absolutePath = join(assetDir, localName)
  await writeFile(absolutePath, buffer)
  return buildResult(absolutePath, docPath, localName, buffer.byteLength)
}

/** 将已有本地文件复制到文档资源目录 */
export async function copyAssetToDocFolder(
  srcPath: string,
  docPath: string,
  partialSettings?: Partial<MdAssetSettings>,
  usedNames?: Set<string>,
): Promise<MdAssetSaveResult> {
  const settings = normalizeMdAssetSettings(partialSettings)
  const assetDir = resolveMdAssetDir(docPath, settings)
  await ensureDir(assetDir)
  const names = usedNames ?? new Set<string>()
  const localName = await pickAvailableFileName(assetDir, basename(srcPath), settings, names)
  const absolutePath = join(assetDir, localName)
  await copyFile(srcPath, absolutePath)
  const { size } = await stat(absolutePath)
  return buildResult(absolutePath, docPath, localName, size)
}

function isAlreadyInDocAssets(localPath: string, docPath: string, settings: MdAssetSettings): boolean {
  const assetDir = pathResolve(resolveMdAssetDir(docPath, settings))
  const normAsset = assetDir.replace(/\\/g, '/').toLowerCase()
  const normLocal = pathResolve(localPath).replace(/\\/g, '/').toLowerCase()
  const assetPrefix = normAsset.replace(/\/$/, '') + '/'
  return normLocal === normAsset.replace(/\/$/, '') || normLocal.startsWith(assetPrefix)
}

async function materializeUrl(
  url: string,
  docPath: string,
  settings: MdAssetSettings,
  usedNames: Set<string>,
): Promise<string | null> {
  if (!isEmbeddableAssetUrl(url)) return null

  if (isRelativeAssetPath(url)) {
    const abs = resolveRelativeAssetPath(docPath, url)
    if (await fileExists(abs)) {
      return url.replace(/\\/g, '/')
    }
    return null
  }

  const localPath = urlToLocalPath(url)
  if (!localPath) {
    if (url.startsWith('/') || /^[A-Za-z]:[\\/]/.test(url)) {
      const abs = url
      if (!(await fileExists(abs))) return null
      if (isAlreadyInDocAssets(abs, docPath, settings)) {
        return toMdRelativePath(docPath, abs)
      }
      const result = await copyAssetToDocFolder(abs, docPath, settings, usedNames)
      return result.relativePath
    }
    return null
  }

  if (!(await fileExists(localPath))) return null

  if (isAlreadyInDocAssets(localPath, docPath, settings)) {
    return toMdRelativePath(docPath, localPath)
  }

  const result = await copyAssetToDocFolder(localPath, docPath, settings, usedNames)
  return result.relativePath
}

/** 遍历 TipTap JSON，将可本地化资源复制到文档目录并改写为相对路径 */
export async function materializeMdAssetsInDoc(
  json: any,
  docPath: string,
  partialSettings?: Partial<MdAssetSettings>,
): Promise<any> {
  const settings = normalizeMdAssetSettings(partialSettings)
  if (settings.mdAssetMode === 'absolute') {
    return json
  }

  const doc = JSON.parse(JSON.stringify(json))
  const usedNames = new Set<string>()

  async function walk(node: any): Promise<void> {
    if (!node) return
    for (const attrKey of mdAssetAttrKeysForType(node.type)) {
      const val = node.attrs?.[attrKey]
      if (typeof val === 'string') {
        const rel = await materializeUrl(val, docPath, settings, usedNames)
        if (rel) {
          node.attrs[attrKey] = rel
        }
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        await walk(child)
      }
    }
  }

  await walk(doc)
  return doc
}

/** 打开 .md 前：将 JSON 内相对路径转为 local-asset URL 供编辑器渲染 */
export function resolveMdAssetsInDoc(json: any, docPath: string): any {
  const doc = JSON.parse(JSON.stringify(json))

  function walk(node: any): void {
    if (!node) return
    for (const attrKey of mdAssetAttrKeysForType(node.type)) {
      const val = node.attrs?.[attrKey]
      if (typeof val === 'string' && isRelativeAssetPath(val)) {
        const abs = pathResolve(resolveRelativeAssetPath(docPath, val))
        if (existsSync(abs)) {
          node.attrs[attrKey] = localPathToAssetUrl(abs)
        }
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child)
    }
  }

  walk(doc)
  return doc
}

export async function copyLocalFileToDocFolder(
  filePath: string,
  docPath: string,
  partialSettings?: Partial<MdAssetSettings>,
): Promise<MdAssetSaveResult> {
  const result = await copyAssetToDocFolder(filePath, docPath, partialSettings)
  const { size } = await stat(result.path)
  return { ...result, size }
}

/** 保存 .md 前：将 Markdown / HTML 内 local-asset 等 URL 转为相对路径 */
export async function materializeMdContentForSave(
  md: string,
  docPath: string,
  partialSettings?: Partial<MdAssetSettings>,
): Promise<string> {
  const settings = normalizeMdAssetSettings(partialSettings)
  if (settings.mdAssetMode === 'absolute') return md

  const usedNames = new Set<string>()
  const cache = new Map<string, string>()

  async function resolve(url: string): Promise<string | null> {
    if (cache.has(url)) return cache.get(url)!
    const rel = await materializeUrl(url, docPath, settings, usedNames)
    if (rel) cache.set(url, rel)
    return rel
  }

  const urls = extractEmbeddableUrlsFromMarkdown(md)
  for (const url of urls) {
    await resolve(url)
  }

  return replaceEmbeddableUrlsInMarkdown(md, (url) => cache.get(url) ?? null)
}

/** 主进程：打开 .md 时将 Markdown/HTML 内资源 URL 转为 local-asset */
export function resolveMdContentForLoad(md: string, docPath: string): string {
  return resolveMdContentAssetUrls(
    md,
    docPath,
    (absPath) => {
      const normalized = pathResolve(absPath)
      if (!existsSync(normalized)) return absPath
      return localPathToAssetUrl(normalized)
    },
    (fileUrl) => {
      try {
        return fileURLToPath(fileUrl)
      } catch {
        return null
      }
    },
  )
}
