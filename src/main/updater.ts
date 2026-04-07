import { app, BrowserWindow, ipcMain, shell } from 'electron'
import * as https from 'https'
import * as http from 'http'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import type { IncomingMessage } from 'http'

export interface UpdateInfo {
  version: string
  notes: string
  pub_date: string
  platforms: Record<string, { url: string; size?: number }>
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

type UpdateEventPayload =
  | { type: 'checking' }
  | { type: 'available'; info: UpdateInfo }
  | { type: 'not-available'; version: string }
  | { type: 'progress'; progress: DownloadProgress }
  | { type: 'downloaded'; filePath: string }
  | { type: 'error'; message: string }

export function getPlatformKey(): string {
  switch (process.platform) {
    case 'darwin':
      return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
    case 'win32':
      return process.arch === 'x64' ? 'win32-x64' : 'win32-ia32'
    case 'linux':
      return process.arch === 'x64' ? 'linux-x64' : 'linux-arm64'
    default:
      return `${process.platform}-${process.arch}`
  }
}

function sendUpdateEvent(payload: UpdateEventPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update-event', payload)
  }
}

function request(url: string, maxRedirects = 5): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': `zq-mark/${app.getVersion()}` } }, (res: IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) { reject(new Error('Too many redirects')); return }
        res.resume()
        request(res.headers.location, maxRedirects - 1).then(resolve, reject)
        return
      }
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`HTTP ${res.statusCode}`))
        res.resume()
        return
      }
      resolve(res)
    }).on('error', reject)
  })
}

function fetchJSON(url: string): Promise<UpdateInfo> {
  return new Promise((resolve, reject) => {
    request(url).then((res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    }).catch(reject)
  })
}

function downloadFile(url: string, destPath: string, onProgress: (p: DownloadProgress) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    request(url).then((res) => {
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let transferred = 0
      let lastTime = Date.now()
      let lastTransferred = 0

      const fileStream = createWriteStream(destPath)
      res.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        const now = Date.now()
        const elapsed = (now - lastTime) / 1000
        let bytesPerSecond = 0
        if (elapsed > 0.5) {
          bytesPerSecond = (transferred - lastTransferred) / elapsed
          lastTime = now
          lastTransferred = transferred
        }
        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0
        onProgress({ percent, transferred, total, bytesPerSecond })
      })
      res.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close()
        resolve(destPath)
      })
      fileStream.on('error', reject)
      res.on('error', reject)
    }).catch(reject)
  })
}

let isChecking = false
let downloadedFilePath: string | null = null

export async function checkForUpdate(updateUrl: string): Promise<void> {
  if (isChecking) return
  isChecking = true

  try {
    sendUpdateEvent({ type: 'checking' })

    const manifestUrl = updateUrl.endsWith('/')
      ? `${updateUrl}latest.json`
      : `${updateUrl}/latest.json`

    const info = await fetchJSON(manifestUrl)
    const currentVersion = app.getVersion()

    if (compareVersions(info.version, currentVersion) > 0) {
      sendUpdateEvent({ type: 'available', info })
    } else {
      sendUpdateEvent({ type: 'not-available', version: currentVersion })
    }
  } catch (err: any) {
    sendUpdateEvent({ type: 'error', message: err?.message || String(err) })
  } finally {
    isChecking = false
  }
}

export async function downloadUpdate(updateUrl: string): Promise<void> {
  try {
    const manifestUrl = updateUrl.endsWith('/')
      ? `${updateUrl}latest.json`
      : `${updateUrl}/latest.json`

    const info = await fetchJSON(manifestUrl)
    const platformKey = getPlatformKey()
    const platformInfo = info.platforms[platformKey]

    if (!platformInfo) {
      sendUpdateEvent({ type: 'error', message: `No update available for platform: ${platformKey}` })
      return
    }

    const downloadDir = join(app.getPath('temp'), 'zq-mark-updates')
    if (!existsSync(downloadDir)) {
      mkdirSync(downloadDir, { recursive: true })
    }

    const fileName = basename(new URL(platformInfo.url).pathname)
    const destPath = join(downloadDir, fileName)

    await downloadFile(platformInfo.url, destPath, (progress) => {
      sendUpdateEvent({ type: 'progress', progress })
    })

    downloadedFilePath = destPath
    sendUpdateEvent({ type: 'downloaded', filePath: destPath })
  } catch (err: any) {
    sendUpdateEvent({ type: 'error', message: err?.message || String(err) })
  }
}

export function installUpdate(): void {
  if (!downloadedFilePath || !existsSync(downloadedFilePath)) {
    sendUpdateEvent({ type: 'error', message: 'No downloaded update found' })
    return
  }
  shell.openPath(downloadedFilePath)
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export function registerUpdaterIPC(): void {
  ipcMain.handle('update:check', async (_event, updateUrl: string) => {
    await checkForUpdate(updateUrl)
  })

  ipcMain.handle('update:download', async (_event, updateUrl: string) => {
    await downloadUpdate(updateUrl)
  })

  ipcMain.handle('update:install', () => {
    installUpdate()
  })

  ipcMain.handle('update:get-version', () => {
    return app.getVersion()
  })
}
