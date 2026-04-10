/**
 * 将 draw.io / Excalidraw 的 SVG data URL 落盘为 editor-assets，
 * 返回 `local-asset:` URL，便于 .zq 保存时收集为 `assets/*.svg`。
 * Web 端无 IPC 时返回原 data URL，由 buildZqZipBytes 再打包进 zip。
 */
export async function persistDiagramPreviewDataUrl(
  dataUrl: string,
): Promise<string> {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl
  }
  const save = window.electron?.saveDataUrlAsset
  if (!save) {
    return dataUrl
  }
  try {
    const r = await save(dataUrl)
    if (r && typeof r === 'object' && 'url' in r && typeof r.url === 'string') {
      return r.url
    }
  } catch {
    /* ignore */
  }
  return dataUrl
}

/** 流程图 XML / Excalidraw scene JSON 等资源引用（桌面 local-asset 或 Web blob 等） */
export function isDiagramAssetUrl(s: string): boolean {
  return (
    typeof s === 'string' &&
    (s.startsWith('local-asset:') ||
      s.startsWith('blob:') ||
      s.startsWith('http://') ||
      s.startsWith('https://'))
  )
}

export async function fetchDiagramAssetText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

/**
 * 桌面端将正文写入 editor-assets，返回 local-asset URL；Web 无 IPC 时返回原文。
 */
export async function persistDiagramTextAsset(
  text: string,
  ext: '.xml' | '.json',
): Promise<string> {
  if (typeof text !== 'string') return text
  const save = window.electron?.saveTextAsset
  if (!save) return text
  try {
    const r = await save(text, ext)
    if (r && typeof r === 'object' && 'url' in r && typeof r.url === 'string') {
      return r.url
    }
  } catch {
    /* ignore */
  }
  return text
}

/** 块缩略图 img 可用的 URL：data / local-asset / blob */
export function diagramPreviewSrc(preview: unknown): string {
  if (typeof preview !== 'string') return ''
  if (
    preview.startsWith('data:') ||
    preview.startsWith('local-asset:') ||
    preview.startsWith('blob:')
  ) {
    return preview
  }
  return ''
}
