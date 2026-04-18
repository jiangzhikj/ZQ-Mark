import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { ZqMeta } from '../../../shared/types'

const ZQ_VERSION = '2.0'

const ASSET_ATTRS: Record<string, string | string[]> = {
  imageBlock: 'src',
  image: 'src',
  videoBlock: 'src',
  video: 'src',
  audioBlock: 'src',
  audio: 'src',
  attachmentBlock: 'url',
  attachment: 'url',
  drawioBlock: ['preview', 'xml'],
  excalidrawBlock: ['preview', 'scene'],
  wisemappingBlock: ['preview', 'mapXml'],
}

function assetAttrKeysForType(nodeType: string): string[] {
  const v = ASSET_ATTRS[nodeType]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function walkReplaceAssets(
  node: any,
  getUrl: (assetPath: string) => string | null
): void {
  if (!node) return
  for (const attrKey of assetAttrKeysForType(node.type)) {
    if (node.attrs?.[attrKey]) {
      const val = node.attrs[attrKey] as string
      if (typeof val === 'string' && val.startsWith('assets/')) {
        const url = getUrl(val)
        if (url) node.attrs[attrKey] = url
      }
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkReplaceAssets(child, getUrl)
  }
}

/** 从解压后的 zip 条目构建资源名 -> Blob */
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
                    : ext === 'mp3' || ext === 'mpeg'
                      ? 'audio/mpeg'
                      : ext === 'wav'
                        ? 'audio/wav'
                        : ext === 'ogg'
                          ? 'audio/ogg'
                          : ext === 'm4a' || ext === 'aac'
                            ? 'audio/mp4'
                            : ext === 'flac'
                              ? 'audio/flac'
                              : ext === 'opus'
                                ? 'audio/opus'
                                : ext === 'webm'
                                  ? 'video/webm'
                                  : ext === 'xml'
                                    ? 'application/xml'
                                    : ext === 'json'
                                      ? 'application/json'
                                      : 'application/octet-stream'
      m.set(shortName, new Blob([data], { type: mime }))
    }
  }
  return m
}

export async function openZqDocumentFromFile(file: File): Promise<{ json: any; meta: ZqMeta }> {
  const buf = await file.arrayBuffer()
  const files = unzipSync(new Uint8Array(buf))
  const contentEntry = files['content.json']
  if (!contentEntry) throw new Error('Invalid .zq file: missing content.json')

  const metaEntry = files['meta.json']
  let meta: ZqMeta
  if (metaEntry) {
    const raw = JSON.parse(strFromU8(metaEntry))
    meta = { ...raw, type: raw.type || 'document' }
  } else {
    meta = {
      version: ZQ_VERSION,
      type: 'document',
      createdAt: '',
      modifiedAt: '',
      title: ''
    }
  }

  const json = JSON.parse(strFromU8(contentEntry))
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
  walkReplaceAssets(json, getUrl)

  return { json, meta }
}

export async function blobUrlToUint8(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url)
    const ab = await r.arrayBuffer()
    return new Uint8Array(ab)
  } catch {
    return null
  }
}

/** 从 data URL 解码为字节（用于 Web 端打包 .zq 内嵌 diagram 预览） */
function dataUrlToUint8(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith('data:')) return null
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  const isBase64 = /;base64/i.test(meta)
  try {
    if (isBase64) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes
    }
    return new TextEncoder().encode(decodeURIComponent(payload))
  } catch {
    return null
  }
}

function looksLikeDrawioXml(s: string): boolean {
  const t = s.trim()
  if (t.length < 12) return false
  if (
    t.startsWith('local-asset:') ||
    t.startsWith('blob:') ||
    t.startsWith('http://') ||
    t.startsWith('https://')
  ) {
    return false
  }
  return (
    t.includes('<mxfile') ||
    t.includes('<mxGraphModel') ||
    (t.includes('<diagram') && t.includes('mxGraphModel'))
  )
}

function looksLikeExcalidrawSceneJson(s: string): boolean {
  const t = s.trim()
  if (!t.startsWith('{')) return false
  if (
    t.startsWith('local-asset:') ||
    t.startsWith('blob:') ||
    t.startsWith('http://') ||
    t.startsWith('https://')
  ) {
    return false
  }
  try {
    const o = JSON.parse(t) as { elements?: unknown }
    return Array.isArray(o.elements)
  } catch {
    return false
  }
}

function looksLikeWisemappingMapXml(s: string): boolean {
  const t = s.trim()
  if (
    t.startsWith('local-asset:') ||
    t.startsWith('blob:') ||
    t.startsWith('http://') ||
    t.startsWith('https://')
  ) {
    return false
  }
  return /<map[\s>]/.test(t) && /version\s*=\s*["']tango["']/.test(t)
}

function extForWebPackedAsset(nodeType: string, attrKey: string): string {
  if (
    attrKey === 'preview' &&
    (nodeType === 'drawioBlock' ||
      nodeType === 'excalidrawBlock' ||
      nodeType === 'wisemappingBlock')
  ) {
    return nodeType === 'wisemappingBlock' ? 'png' : 'svg'
  }
  if (attrKey === 'xml') return 'xml'
  if (attrKey === 'mapXml') return 'xml'
  if (attrKey === 'scene') return 'json'
  if (nodeType === 'videoBlock' || nodeType === 'video') return 'mp4'
  if (nodeType === 'audioBlock' || nodeType === 'audio') return 'mp3'
  if (nodeType === 'attachmentBlock' || nodeType === 'attachment') return 'bin'
  return 'png'
}

export async function buildZqZipBytes(
  json: any,
  title: string,
  existingMeta?: ZqMeta | null
): Promise<Uint8Array> {
  const now = new Date().toISOString()
  const meta: ZqMeta = {
    version: ZQ_VERSION,
    type: 'document',
    createdAt: existingMeta?.createdAt || now,
    modifiedAt: now,
    title
  }

  const doc = JSON.parse(JSON.stringify(json))
  const assetEntries: Record<string, Uint8Array> = {}

  async function walk(node: any) {
    if (!node) return
    for (const attrKey of assetAttrKeysForType(node.type)) {
      const val = node.attrs?.[attrKey]
      if (typeof val !== 'string') continue

      if (val.startsWith('data:')) {
        const data =
          node.type === 'drawioBlock' ||
          node.type === 'excalidrawBlock' ||
          node.type === 'wisemappingBlock'
            ? dataUrlToUint8(val)
            : null
        if (data && attrKey === 'preview') {
          const ext =
            node.type === 'wisemappingBlock' ? 'png' : 'svg'
          let fname = `diagram_${Object.keys(assetEntries).length}.${ext}`
          while (assetEntries[`assets/${fname}`]) fname = `_${fname}`
          assetEntries[`assets/${fname}`] = data
          node.attrs[attrKey] = `assets/${fname}`
        }
        continue
      }

      if (val.startsWith('blob:') || val.startsWith('http://') || val.startsWith('https://')) {
        const data = await blobUrlToUint8(val)
        if (data) {
          const ext = extForWebPackedAsset(node.type, attrKey)
          let fname = `a_${Object.keys(assetEntries).length}.${ext}`
          while (assetEntries[`assets/${fname}`]) fname = `_${fname}`
          assetEntries[`assets/${fname}`] = data
          node.attrs[attrKey] = `assets/${fname}`
        }
        continue
      }

      if (node.type === 'drawioBlock' && attrKey === 'xml' && looksLikeDrawioXml(val)) {
        const data = new TextEncoder().encode(val)
        let fname = `diagram_${Object.keys(assetEntries).length}.xml`
        while (assetEntries[`assets/${fname}`]) fname = `_${fname}`
        assetEntries[`assets/${fname}`] = data
        node.attrs[attrKey] = `assets/${fname}`
        continue
      }

      if (
        node.type === 'excalidrawBlock' &&
        attrKey === 'scene' &&
        looksLikeExcalidrawSceneJson(val)
      ) {
        const data = new TextEncoder().encode(val)
        let fname = `diagram_${Object.keys(assetEntries).length}.json`
        while (assetEntries[`assets/${fname}`]) fname = `_${fname}`
        assetEntries[`assets/${fname}`] = data
        node.attrs[attrKey] = `assets/${fname}`
      }

      if (
        node.type === 'wisemappingBlock' &&
        attrKey === 'mapXml' &&
        looksLikeWisemappingMapXml(val)
      ) {
        const data = new TextEncoder().encode(val)
        let fname = `diagram_${Object.keys(assetEntries).length}.xml`
        while (assetEntries[`assets/${fname}`]) fname = `_${fname}`
        assetEntries[`assets/${fname}`] = data
        node.attrs[attrKey] = `assets/${fname}`
      }
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) await walk(c)
    }
  }
  await walk(doc)

  const zipObj: Record<string, Uint8Array> = {
    'meta.json': strToU8(JSON.stringify(meta, null, 2)),
    'content.json': strToU8(JSON.stringify(doc, null, 2)),
    ...assetEntries
  }

  return zipSync(zipObj, { level: 6 })
}

export function downloadUint8Array(data: Uint8Array, filename: string, mime: string): void {
  const blob = new Blob([data], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
