import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { LibraryIndex, LibraryNode, ZqMeta } from '../../../shared/types'
import { blobUrlToUint8 } from './web-zq'

const ZQ_VERSION = '2.0'

const ASSET_TYPE_MAP: Record<string, string> = {
  imageBlock: 'src',
  image: 'src',
  videoBlock: 'src',
  video: 'src',
  attachmentBlock: 'url',
  attachment: 'url'
}

function walkReplaceAssets(
  node: any,
  getUrl: (assetPath: string) => string | null
): void {
  if (!node) return
  const attrKey = ASSET_TYPE_MAP[node.type]
  if (attrKey && node.attrs?.[attrKey]) {
    const val = node.attrs[attrKey] as string
    if (typeof val === 'string' && val.startsWith('assets/')) {
      const url = getUrl(val)
      if (url) node.attrs[attrKey] = url
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkReplaceAssets(child, getUrl)
  }
}

function buildAssetBlobMap(files: Record<string, Uint8Array>): Map<string, Blob> {
  const m = new Map<string, Blob>()
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('assets/') && !name.endsWith('/')) {
      const shortName = name.replace(/^assets\//, '')
      const ext = shortName.split('.').pop()?.toLowerCase() || ''
      const mime =
        ext === 'png'
          ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'gif'
              ? 'image/gif'
              : ext === 'webp'
                ? 'image/webp'
                : ext === 'svg'
                  ? 'image/svg+xml'
                  : ext === 'mp4'
                    ? 'video/mp4'
                    : 'application/octet-stream'
      m.set(shortName, new Blob([data], { type: mime }))
    }
  }
  return m
}

export interface WebLibraryRuntime {
  filePath: string | null
  meta: ZqMeta
  index: LibraryIndex
  docs: Map<string, any>
  dirtyDocs: Set<string>
  dirty: boolean
}

/** JSON 可序列化的文件库快照（sessionStorage） */
export interface WebLibrarySerialized {
  filePath: string | null
  meta: ZqMeta
  index: LibraryIndex
  docs: Record<string, unknown>
  dirtyDocs: string[]
  dirty: boolean
}

export function serializeWebLibraryRuntime(rt: WebLibraryRuntime): WebLibrarySerialized {
  return {
    filePath: rt.filePath,
    meta: rt.meta,
    index: rt.index,
    docs: Object.fromEntries(rt.docs),
    dirtyDocs: [...rt.dirtyDocs],
    dirty: rt.dirty
  }
}

export function deserializeWebLibraryRuntime(data: WebLibrarySerialized): WebLibraryRuntime {
  return {
    filePath: data.filePath,
    meta: data.meta,
    index: data.index,
    docs: new Map(Object.entries(data.docs)),
    dirtyDocs: new Set(data.dirtyDocs),
    dirty: data.dirty
  }
}

export function createEmptyLibraryWeb(title: string): WebLibraryRuntime {
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
    dirtyDocs: new Set(),
    dirty: true
  }
}

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

export function libraryCreateDocWeb(
  runtime: WebLibraryRuntime,
  parentId: string | null,
  name: string
): LibraryNode {
  const id = crypto.randomUUID()
  const node: LibraryNode = { id, name, type: 'file' }
  runtime.docs.set(id, { type: 'doc', content: [{ type: 'paragraph' }] })
  runtime.dirtyDocs.add(id)
  runtime.dirty = true
  insertNode(runtime.index.tree, parentId, node)
  return node
}

export function libraryCreateFolderWeb(
  runtime: WebLibraryRuntime,
  parentId: string | null,
  name: string
): LibraryNode {
  const id = crypto.randomUUID()
  const node: LibraryNode = { id, name, type: 'folder', children: [] }
  runtime.dirty = true
  insertNode(runtime.index.tree, parentId, node)
  return node
}

export function libraryRenameItemWeb(runtime: WebLibraryRuntime, id: string, newName: string): boolean {
  const node = findNode(runtime.index.tree, id)
  if (!node) return false
  node.name = newName
  runtime.dirty = true
  return true
}

export function libraryDeleteItemWeb(runtime: WebLibraryRuntime, id: string): boolean {
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

export function libraryMoveItemWeb(
  runtime: WebLibraryRuntime,
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

export function libraryGetDocWeb(runtime: WebLibraryRuntime, docId: string): any | null {
  return runtime.docs.get(docId) || null
}

export function getLibraryDocName(runtime: WebLibraryRuntime, docId: string): string {
  return findNode(runtime.index.tree, docId)?.name || ''
}

export function librarySaveDocWeb(runtime: WebLibraryRuntime, docId: string, json: any): void {
  runtime.docs.set(docId, json)
  runtime.dirtyDocs.add(docId)
  runtime.dirty = true
}

function detectZqTypeFromZip(files: Record<string, Uint8Array>): 'document' | 'library' {
  const metaEntry = files['meta.json']
  if (metaEntry) {
    try {
      const meta = JSON.parse(strFromU8(metaEntry))
      if (meta.type === 'library') return 'library'
    } catch { /* ignore */ }
  }
  if (files['library.json']) return 'library'
  return 'document'
}

export function detectZqTypeFromBuffer(buf: ArrayBuffer): 'document' | 'library' {
  try {
    const files = unzipSync(new Uint8Array(buf))
    return detectZqTypeFromZip(files)
  } catch {
    return 'document'
  }
}

export async function openZqlFromArrayBuffer(buf: ArrayBuffer, virtualPath: string): Promise<WebLibraryRuntime> {
  const files = unzipSync(new Uint8Array(buf))
  const metaEntry = files['meta.json']
  let meta: ZqMeta
  if (metaEntry) {
    const raw = JSON.parse(strFromU8(metaEntry))
    meta = { ...raw, type: 'library' }
  } else {
    meta = { version: ZQ_VERSION, type: 'library', createdAt: '', modifiedAt: '', title: '' }
  }

  const indexEntry = files['library.json']
  const index: LibraryIndex = indexEntry ? JSON.parse(strFromU8(indexEntry)) : { tree: [] }

  const blobMap = buildAssetBlobMap(files)
  const urlCache = new Map<string, string>()
  const getUrl = (assetPath: string): string | null => {
    const name = assetPath.replace(/^assets\//, '')
    if (!blobMap.has(name)) return null
    if (!urlCache.has(name)) {
      urlCache.set(name, URL.createObjectURL(blobMap.get(name)!))
    }
    return urlCache.get(name) ?? null
  }

  const docs = new Map<string, any>()
  for (const name of Object.keys(files)) {
    if (name.startsWith('docs/') && name.endsWith('.json')) {
      const docId = name.replace(/^docs\//, '').replace(/\.json$/, '')
      const json = JSON.parse(strFromU8(files[name]))
      walkReplaceAssets(json, getUrl)
      docs.set(docId, json)
    }
  }

  return {
    filePath: virtualPath,
    meta,
    index,
    docs,
    dirtyDocs: new Set(),
    dirty: false
  }
}

interface RefItem {
  attrKey: string
  node: any
  url: string
}

function collectBrowserRefs(doc: any): RefItem[] {
  const refs: RefItem[] = []
  function walk(node: any) {
    if (!node) return
    const attrKey = ASSET_TYPE_MAP[node.type]
    if (attrKey) {
      const val = node.attrs?.[attrKey]
      if (typeof val === 'string' && (val.startsWith('blob:') || val.startsWith('http') || val.startsWith('assets/'))) {
        refs.push({ attrKey, node, url: val })
      }
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c)
    }
  }
  walk(doc)
  return refs
}

function uniqueAssetName(base: string, used: Set<string>): string {
  let name = base
  let counter = 1
  const extMatch = base.match(/^(.+)(\.[^.]+)$/)
  const stem = extMatch ? extMatch[1] : base
  const ext = extMatch ? extMatch[2] : ''
  while (used.has(name)) {
    name = `${stem}_${counter}${ext}`
    counter++
  }
  used.add(name)
  return name
}

export async function buildZqlZipBytes(runtime: WebLibraryRuntime): Promise<Uint8Array> {
  const now = new Date().toISOString()
  runtime.meta.modifiedAt = now

  const zipObj: Record<string, Uint8Array> = {
    'meta.json': strToU8(JSON.stringify(runtime.meta, null, 2)),
    'library.json': strToU8(JSON.stringify(runtime.index, null, 2))
  }

  const allAssets = new Map<string, string>()
  const usedNames = new Set<string>()

  for (const [docId, docJson] of runtime.docs.entries()) {
    const doc = JSON.parse(JSON.stringify(docJson))
    const refs = collectBrowserRefs(doc)
    for (const ref of refs) {
      const url = ref.node.attrs[ref.attrKey] as string
      if (!allAssets.has(url)) {
        const guessed =
          url.startsWith('assets/')
            ? url.replace(/^assets\//, '')
            : `asset_${allAssets.size}.bin`
        const unique = uniqueAssetName(guessed, usedNames)
        allAssets.set(url, unique)
      }
      ref.node.attrs[ref.attrKey] = `assets/${allAssets.get(url)}`
    }
    zipObj[`docs/${docId}.json`] = strToU8(JSON.stringify(doc, null, 2))
  }

  for (const [url, assetName] of allAssets.entries()) {
    if (url.startsWith('assets/')) continue
    const bytes = await blobUrlToUint8(url)
    if (bytes) zipObj[`assets/${assetName}`] = bytes
  }

  return zipSync(zipObj, { level: 6 })
}
