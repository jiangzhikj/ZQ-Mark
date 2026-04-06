import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { ZqMeta } from '../../../shared/types'

const ZQ_VERSION = '2.0'

const ASSET_TYPE_MAP: Record<string, string> = {
  imageBlock: 'src',
  image: 'src',
  videoBlock: 'src',
  video: 'src',
  audioBlock: 'src',
  audio: 'src',
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
    const attrKey = ASSET_TYPE_MAP[node.type]
    if (attrKey && node.attrs?.[attrKey]) {
      const val = node.attrs[attrKey] as string
      if (typeof val === 'string' && (val.startsWith('blob:') || val.startsWith('http'))) {
        const data = await blobUrlToUint8(val)
        if (data) {
          const ext =
            node.type === 'videoBlock' || node.type === 'video'
              ? 'mp4'
              : node.type === 'audioBlock' || node.type === 'audio'
                ? 'mp3'
                : node.type === 'attachmentBlock' || node.type === 'attachment'
                  ? 'bin'
                  : 'png'
          let fname = `a_${Object.keys(assetEntries).length}.${ext}`
          while (assetEntries[`assets/${fname}`]) fname = `_${fname}`
          assetEntries[`assets/${fname}`] = data
          node.attrs[attrKey] = `assets/${fname}`
        }
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
