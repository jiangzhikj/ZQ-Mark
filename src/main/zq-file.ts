import { join, basename, extname } from 'path'
import { writeFile, mkdir, readdir, rm, stat, rename } from 'fs/promises'
import { existsSync, createWriteStream } from 'fs'
import { app } from 'electron'
import archiver from 'archiver'
import AdmZip from 'adm-zip'
import { randomUUID } from 'crypto'
import { localPathToAssetUrl, assetUrlToLocalPath } from './asset-protocol'
import type { ZqMeta, LibraryIndex, LibraryNode } from '../shared/types'

const ZQ_VERSION = '2.0'
const ZQ_ASSETS_ROOT = () => join(app.getPath('userData'), 'editor-assets')
const MAX_TEMP_DIRS = 20
const TEMP_DIR_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type { ZqMeta, LibraryIndex, LibraryNode }

// ─── Asset helpers ───

/** 每种节点类型要打包进 .zq 的 attrs（多字段时逐项收集） */
const ASSET_ATTRS: Record<string, string | string[]> = {
  imageBlock: 'src',
  image: 'src',
  videoBlock: 'src',
  video: 'src',
  audioBlock: 'src',
  audio: 'src',
  attachmentBlock: 'url',
  attachment: 'url',
  /** 缩略图 SVG + 流程图源 XML */
  drawioBlock: ['preview', 'xml'],
  /** 缩略图 SVG + scene JSON */
  excalidrawBlock: ['preview', 'scene'],
}

function assetAttrKeysForType(nodeType: string): string[] {
  const v = ASSET_ATTRS[nodeType]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function urlToLocalPath(url: string): string | null {
  const fromAsset = assetUrlToLocalPath(url)
  if (fromAsset) return fromAsset
  if (url.startsWith('file://')) return decodeURIComponent(url.replace('file://', ''))
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return null
}

function collectAssetRefs(json: any): { attrKey: string; filePath: string; node: any }[] {
  const refs: { attrKey: string; filePath: string; node: any }[] = []
  function walk(node: any) {
    if (!node) return
    for (const attrKey of assetAttrKeysForType(node.type)) {
      const val = node.attrs?.[attrKey]
      if (typeof val === 'string') {
        const localPath = urlToLocalPath(val)
        if (localPath) refs.push({ attrKey, filePath: localPath, node })
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child)
    }
  }
  walk(json)
  return refs
}

function replaceAssetPathsInDoc(json: any, extractDir: string): void {
  function walk(node: any) {
    if (!node) return
    for (const attrKey of assetAttrKeysForType(node.type)) {
      const val = node.attrs?.[attrKey]
      if (typeof val === 'string' && val.startsWith('assets/')) {
        const assetName = val.replace('assets/', '')
        const localPath = join(extractDir, assetName)
        node.attrs[attrKey] = localPathToAssetUrl(localPath)
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child)
    }
  }
  walk(json)
}

function buildAssetMap(refs: { attrKey: string; filePath: string; node: any }[]): Map<string, string> {
  const assetMap = new Map<string, string>()
  const usedNames = new Set<string>()
  for (const ref of refs) {
    if (!assetMap.has(ref.filePath)) {
      const name = basename(ref.filePath)
      let uniqueName = name
      let counter = 1
      while (usedNames.has(uniqueName)) {
        const ext = extname(name)
        const base = name.slice(0, -ext.length || undefined)
        uniqueName = `${base}_${counter}${ext}`
        counter++
      }
      assetMap.set(ref.filePath, uniqueName)
      usedNames.add(uniqueName)
    }
    ref.node.attrs[ref.attrKey] = `assets/${assetMap.get(ref.filePath)}`
  }
  return assetMap
}

async function writeZip(
  tmpPath: string,
  entries: { name: string; content?: string; filePath?: string }[]
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(tmpPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    let finished = false
    const done = (err?: Error) => {
      if (finished) return
      finished = true
      err ? reject(err) : resolve()
    }
    output.on('close', () => done())
    output.on('error', (err) => done(err))
    archive.on('error', (err) => done(err))
    archive.on('warning', (err) => { if (err.code !== 'ENOENT') done(err) })
    archive.pipe(output)
    for (const entry of entries) {
      if (entry.content !== undefined) {
        archive.append(entry.content, { name: entry.name })
      } else if (entry.filePath && existsSync(entry.filePath)) {
        archive.file(entry.filePath, { name: entry.name })
      }
    }
    archive.finalize().catch((err) => done(err))
  })
}

// ─── Single document .zq ───

export async function saveZqDocument(
  savePath: string,
  json: any,
  title: string,
  existingMeta?: ZqMeta | null
): Promise<void> {
  const doc = JSON.parse(JSON.stringify(json))
  const refs = collectAssetRefs(doc)
  const assetMap = buildAssetMap(refs)

  const now = new Date().toISOString()
  const meta: ZqMeta = {
    version: ZQ_VERSION,
    type: 'document',
    createdAt: existingMeta?.createdAt || now,
    modifiedAt: now,
    title
  }

  const entries: { name: string; content?: string; filePath?: string }[] = [
    { name: 'meta.json', content: JSON.stringify(meta, null, 2) },
    { name: 'content.json', content: JSON.stringify(doc, null, 2) }
  ]
  for (const [localPath, assetName] of assetMap.entries()) {
    entries.push({ name: `assets/${assetName}`, filePath: localPath })
  }

  const tmpPath = savePath + '.tmp'
  await writeZip(tmpPath, entries)
  await rename(tmpPath, savePath)
}

export async function openZqDocument(
  zqPath: string
): Promise<{ json: any; meta: ZqMeta }> {
  const zip = new AdmZip(zqPath)

  const contentEntry = zip.getEntry('content.json')
  if (!contentEntry) throw new Error('Invalid .zq file: missing content.json')

  const metaEntry = zip.getEntry('meta.json')
  let meta: ZqMeta
  if (metaEntry) {
    const raw = JSON.parse(metaEntry.getData().toString('utf-8'))
    meta = { ...raw, type: raw.type || 'document' }
  } else {
    meta = { version: ZQ_VERSION, type: 'document', createdAt: '', modifiedAt: '', title: '' }
  }

  const json = JSON.parse(contentEntry.getData().toString('utf-8'))

  const extractDir = join(ZQ_ASSETS_ROOT(), `zq-${Date.now()}-${randomUUID().slice(0, 8)}`)
  await mkdir(extractDir, { recursive: true })

  const assetEntries = zip.getEntries().filter((e) => e.entryName.startsWith('assets/') && !e.isDirectory)
  for (const entry of assetEntries) {
    const assetName = entry.entryName.replace('assets/', '')
    await writeFile(join(extractDir, assetName), entry.getData())
  }

  replaceAssetPathsInDoc(json, extractDir)
  cleanupOldTempDirs().catch(() => {})

  return { json, meta }
}

// ─── Library .zql ───

export interface LibraryRuntime {
  filePath: string | null
  meta: ZqMeta
  index: LibraryIndex
  docs: Map<string, any>
  assetsDir: string
  dirtyDocs: Set<string>
  dirty: boolean
}

export function createEmptyLibrary(title: string): LibraryRuntime {
  const now = new Date().toISOString()
  return {
    filePath: null,
    meta: {
      version: ZQ_VERSION,
      type: 'library',
      createdAt: now,
      modifiedAt: now,
      title
    },
    index: { tree: [] },
    docs: new Map(),
    assetsDir: '',
    dirtyDocs: new Set(),
    dirty: true
  }
}

export async function openZqLibrary(zqPath: string): Promise<LibraryRuntime> {
  const zip = new AdmZip(zqPath)

  const metaEntry = zip.getEntry('meta.json')
  let meta: ZqMeta
  if (metaEntry) {
    const raw = JSON.parse(metaEntry.getData().toString('utf-8'))
    meta = { ...raw, type: 'library' }
  } else {
    meta = { version: ZQ_VERSION, type: 'library', createdAt: '', modifiedAt: '', title: '' }
  }

  const indexEntry = zip.getEntry('library.json')
  const index: LibraryIndex = indexEntry
    ? JSON.parse(indexEntry.getData().toString('utf-8'))
    : { tree: [] }

  const extractDir = join(ZQ_ASSETS_ROOT(), `zq-lib-${Date.now()}-${randomUUID().slice(0, 8)}`)
  await mkdir(extractDir, { recursive: true })

  const assetEntries = zip.getEntries().filter((e) => e.entryName.startsWith('assets/') && !e.isDirectory)
  for (const entry of assetEntries) {
    const assetName = entry.entryName.replace('assets/', '')
    await writeFile(join(extractDir, assetName), entry.getData())
  }

  const docs = new Map<string, any>()
  const docEntries = zip.getEntries().filter((e) => e.entryName.startsWith('docs/') && e.entryName.endsWith('.json'))
  for (const entry of docEntries) {
    const docId = basename(entry.entryName, '.json')
    const docJson = JSON.parse(entry.getData().toString('utf-8'))
    replaceAssetPathsInDoc(docJson, extractDir)
    docs.set(docId, docJson)
  }

  cleanupOldTempDirs().catch(() => {})

  return {
    filePath: zqPath,
    meta,
    index,
    docs,
    assetsDir: extractDir,
    dirtyDocs: new Set(),
    dirty: false
  }
}

export async function saveZqLibrary(
  savePath: string,
  runtime: LibraryRuntime
): Promise<void> {
  const now = new Date().toISOString()
  runtime.meta.modifiedAt = now

  const entries: { name: string; content?: string; filePath?: string }[] = [
    { name: 'meta.json', content: JSON.stringify(runtime.meta, null, 2) },
    { name: 'library.json', content: JSON.stringify(runtime.index, null, 2) }
  ]

  const allAssets = new Map<string, string>()
  const usedAssetNames = new Set<string>()

  for (const [docId, docJson] of runtime.docs.entries()) {
    const doc = JSON.parse(JSON.stringify(docJson))
    const refs = collectAssetRefs(doc)

    for (const ref of refs) {
      if (!allAssets.has(ref.filePath)) {
        const name = basename(ref.filePath)
        let uniqueName = name
        let counter = 1
        while (usedAssetNames.has(uniqueName)) {
          const ext = extname(name)
          const base = name.slice(0, -ext.length || undefined)
          uniqueName = `${base}_${counter}${ext}`
          counter++
        }
        allAssets.set(ref.filePath, uniqueName)
        usedAssetNames.add(uniqueName)
      }
      ref.node.attrs[ref.attrKey] = `assets/${allAssets.get(ref.filePath)}`
    }

    entries.push({ name: `docs/${docId}.json`, content: JSON.stringify(doc, null, 2) })
  }

  for (const [localPath, assetName] of allAssets.entries()) {
    entries.push({ name: `assets/${assetName}`, filePath: localPath })
  }

  const tmpPath = savePath + '.tmp'
  await writeZip(tmpPath, entries)
  await rename(tmpPath, savePath)

  runtime.filePath = savePath
  runtime.dirtyDocs.clear()
  runtime.dirty = false
}

export function libraryCreateDoc(
  runtime: LibraryRuntime,
  parentId: string | null,
  name: string
): LibraryNode {
  const id = randomUUID()
  const node: LibraryNode = { id, name, type: 'file' }

  runtime.docs.set(id, { type: 'doc', content: [{ type: 'paragraph' }] })
  runtime.dirtyDocs.add(id)
  runtime.dirty = true

  insertNode(runtime.index.tree, parentId, node)
  return node
}

export function libraryCreateFolder(
  runtime: LibraryRuntime,
  parentId: string | null,
  name: string
): LibraryNode {
  const id = randomUUID()
  const node: LibraryNode = { id, name, type: 'folder', children: [] }
  runtime.dirty = true
  insertNode(runtime.index.tree, parentId, node)
  return node
}

export function libraryRenameItem(
  runtime: LibraryRuntime,
  id: string,
  newName: string
): boolean {
  const node = findNode(runtime.index.tree, id)
  if (!node) return false
  node.name = newName
  runtime.dirty = true
  return true
}

export function libraryDeleteItem(
  runtime: LibraryRuntime,
  id: string
): boolean {
  const docIds = collectDocIds(runtime.index.tree, id)
  const removed = removeNode(runtime.index.tree, id)
  if (!removed) return false

  for (const docId of docIds) {
    runtime.docs.delete(docId)
    runtime.dirtyDocs.delete(docId)
  }
  runtime.dirty = true
  return true
}

export function libraryMoveItem(
  runtime: LibraryRuntime,
  id: string,
  newParentId: string | null,
  index: number
): boolean {
  const node = findNode(runtime.index.tree, id)
  if (!node) return false

  removeNode(runtime.index.tree, id)
  insertNodeAt(runtime.index.tree, newParentId, node, index)
  runtime.dirty = true
  return true
}

export function libraryGetDoc(
  runtime: LibraryRuntime,
  docId: string
): any | null {
  return runtime.docs.get(docId) || null
}

export function librarySaveDoc(
  runtime: LibraryRuntime,
  docId: string,
  json: any
): void {
  runtime.docs.set(docId, json)
  runtime.dirtyDocs.add(docId)
  runtime.dirty = true
}

// ─── Detect .zq/.zql type ───

export function detectZqType(zqPath: string): 'document' | 'library' {
  try {
    const zip = new AdmZip(zqPath)
    const metaEntry = zip.getEntry('meta.json')
    if (metaEntry) {
      const meta = JSON.parse(metaEntry.getData().toString('utf-8'))
      if (meta.type === 'library') return 'library'
    }
    if (zip.getEntry('library.json')) return 'library'
  } catch { /* fallback */ }
  return 'document'
}

// ─── Tree helpers ───

function findNode(tree: LibraryNode[], id: string): LibraryNode | null {
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

function removeNode(tree: LibraryNode[], id: string): boolean {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) {
      tree.splice(i, 1)
      return true
    }
    if (tree[i].children) {
      if (removeNode(tree[i].children!, id)) return true
    }
  }
  return false
}

function insertNode(tree: LibraryNode[], parentId: string | null, node: LibraryNode): void {
  if (!parentId) {
    tree.push(node)
    return
  }
  const parent = findNode(tree, parentId)
  if (parent && parent.type === 'folder') {
    if (!parent.children) parent.children = []
    parent.children.push(node)
  } else {
    tree.push(node)
  }
}

function insertNodeAt(tree: LibraryNode[], parentId: string | null, node: LibraryNode, index: number): void {
  if (!parentId) {
    tree.splice(Math.min(index, tree.length), 0, node)
    return
  }
  const parent = findNode(tree, parentId)
  if (parent && parent.type === 'folder') {
    if (!parent.children) parent.children = []
    parent.children.splice(Math.min(index, parent.children.length), 0, node)
  } else {
    tree.splice(Math.min(index, tree.length), 0, node)
  }
}

function collectDocIds(tree: LibraryNode[], id: string): string[] {
  const node = findNode(tree, id)
  if (!node) return []
  const ids: string[] = []
  function walk(n: LibraryNode) {
    if (n.type === 'file') ids.push(n.id)
    if (n.children) n.children.forEach(walk)
  }
  walk(node)
  return ids
}

// ─── Backward compat aliases ───

export const saveZqFile = saveZqDocument
export const openZqFile = openZqDocument

// ─── Cleanup ───

async function cleanupOldTempDirs(): Promise<void> {
  const root = ZQ_ASSETS_ROOT()
  if (!existsSync(root)) return

  const entries = await readdir(root, { withFileTypes: true })
  const zqDirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('zq-'))
    .map((e) => ({ name: e.name, path: join(root, e.name) }))

  if (zqDirs.length <= MAX_TEMP_DIRS) return

  const dirsWithTime = await Promise.all(
    zqDirs.map(async (d) => {
      try {
        const s = await stat(d.path)
        return { ...d, mtime: s.mtimeMs }
      } catch {
        return { ...d, mtime: 0 }
      }
    })
  )

  dirsWithTime.sort((a, b) => b.mtime - a.mtime)

  const now = Date.now()
  for (let i = MAX_TEMP_DIRS; i < dirsWithTime.length; i++) {
    const dir = dirsWithTime[i]
    if (now - dir.mtime > TEMP_DIR_MAX_AGE_MS) {
      await rm(dir.path, { recursive: true, force: true }).catch(() => {})
    }
  }
}
