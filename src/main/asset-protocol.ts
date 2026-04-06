import { fileURLToPath, pathToFileURL } from 'node:url'

export const ASSET_PROTOCOL = 'local-asset'

/**
 * 与 `file://` 同构的 URL，仅将 scheme 换为 `local-asset`，避免
 * `local-asset://C:%5CUsers%5C...` 这类字符串被 Chromium 判为非法 URL
 *（导致 fetch / window.open 失败）。
 */
export function localPathToAssetUrl(localPath: string): string {
  return pathToFileURL(localPath).href.replace(/^file:/, `${ASSET_PROTOCOL}:`)
}

export function assetUrlToLocalPath(url: string): string | null {
  const scheme = `${ASSET_PROTOCOL}:`
  if (!url.startsWith(scheme)) return null

  const afterScheme = url.slice(scheme.length)
  // 新格式：local-asset:///C:/Users/... （与 file:/// 一一对应）
  if (afterScheme.startsWith('///')) {
    try {
      return fileURLToPath(`file:${afterScheme}`)
    } catch {
      return null
    }
  }

  // 旧格式：local-asset://C:%5CUsers%5C...（encodeURI 路径，非合法 file URL）
  const legacyPrefix = `${ASSET_PROTOCOL}://`
  if (url.startsWith(legacyPrefix)) {
    try {
      return decodeURIComponent(url.slice(legacyPrefix.length))
    } catch {
      return null
    }
  }

  return null
}
