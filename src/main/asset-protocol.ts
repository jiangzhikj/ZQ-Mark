export const ASSET_PROTOCOL = 'local-asset'

export function localPathToAssetUrl(localPath: string): string {
  return `${ASSET_PROTOCOL}://${encodeURI(localPath).replace(/#/g, '%23')}`
}

export function assetUrlToLocalPath(url: string): string | null {
  const prefix = `${ASSET_PROTOCOL}://`
  if (url.startsWith(prefix)) {
    return decodeURIComponent(url.slice(prefix.length))
  }
  return null
}
