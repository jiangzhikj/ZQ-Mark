import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'fs/promises'
import { createHash } from 'crypto'
import AdmZip from 'adm-zip'
import * as https from 'https'
import * as http from 'http'
import type { IncomingMessage } from 'http'
import { localPathToAssetUrl } from './asset-protocol'
import type {
  ExcalidrawBundleStatus,
  ExcalidrawInstallProgress,
  ExcalidrawPluginManifest,
} from '../shared/excalidraw-plugin'

const VERSION_FILE = '.zq-excalidraw-version'

export function getUserExcalidrawRoot(): string {
  return join(app.getPath('userData'), 'plugins', 'excalidraw')
}

/** 解析顺序：userData 已安装 → 打包内置 → 开发仓库 resources */
export function resolveExcalidrawIndexPath(): string | null {
  const userIndex = join(getUserExcalidrawRoot(), 'index.html')
  if (existsSync(userIndex)) {
    return userIndex
  }

  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, 'excalidraw', 'index.html')
    if (existsSync(bundled)) {
      return bundled
    }
  } else {
    const devIndex = join(__dirname, '../../resources/excalidraw/index.html')
    if (existsSync(devIndex)) {
      return devIndex
    }
  }

  return null
}

export function getExcalidrawIndexAssetUrl(): string | null {
  const p = resolveExcalidrawIndexPath()
  return p ? localPathToAssetUrl(p) : null
}

async function readInstalledVersion(): Promise<string | undefined> {
  const vf = join(getUserExcalidrawRoot(), VERSION_FILE)
  if (!existsSync(vf)) return undefined
  try {
    const raw = await readFile(vf, 'utf-8')
    const j = JSON.parse(raw) as { version?: string }
    return typeof j.version === 'string' ? j.version : undefined
  } catch {
    return undefined
  }
}

export async function getExcalidrawBundleStatus(): Promise<ExcalidrawBundleStatus> {
  const userIndex = join(getUserExcalidrawRoot(), 'index.html')
  const userInstalled = existsSync(userIndex)

  if (userInstalled) {
    const version = await readInstalledVersion()
    return { state: 'ready', version, userInstalled: true }
  }

  const resolved = resolveExcalidrawIndexPath()
  if (!resolved) {
    return { state: 'missing', userInstalled: false }
  }
  return {
    state: 'ready',
    version: app.isPackaged ? 'bundled' : 'dev',
    userInstalled: false,
  }
}

function trimBase(url: string): string {
  return url.trim().replace(/\/$/, '')
}

export function getExcalidrawManifestUrl(updateUrl: string): string {
  return `${trimBase(updateUrl)}/plugins/excalidraw/manifest.json`
}

function request(url: string, maxRedirects = 5): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client
      .get(
        url,
        { headers: { 'User-Agent': `zq-mark/${app.getVersion()}` } },
        (res: IncomingMessage) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            if (maxRedirects <= 0) {
              reject(new Error('Too many redirects'))
              return
            }
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
        },
      )
      .on('error', reject)
  })
}

async function fetchJSON<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request(url)
      .then((res) => {
        let data = ''
        res.on('data', (chunk: string) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T)
          } catch (e) {
            reject(e)
          }
        })
        res.on('error', reject)
      })
      .catch(reject)
  })
}

export async function fetchExcalidrawManifest(
  updateUrl: string,
): Promise<ExcalidrawPluginManifest> {
  const url = getExcalidrawManifestUrl(updateUrl)
  if (!url.startsWith('https://')) {
    throw new Error('Manifest URL must use HTTPS')
  }
  const m = await fetchJSON<ExcalidrawPluginManifest>(url)
  if (
    !m.version ||
    !m.zipUrl ||
    !m.sha256 ||
    typeof m.zipUrl !== 'string' ||
    typeof m.sha256 !== 'string'
  ) {
    throw new Error('Invalid Excalidraw manifest')
  }
  if (!m.zipUrl.startsWith('https://')) {
    throw new Error('zipUrl must use HTTPS')
  }
  return m
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

function assertMinAppVersion(minAppVersion: string | undefined): void {
  if (!minAppVersion) return
  const cur = app.getVersion()
  if (compareVersions(minAppVersion, cur) > 0) {
    throw new Error(
      `This plugin requires app version >= ${minAppVersion} (current ${cur})`,
    )
  }
}

async function sha256FileHex(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const rs = createReadStream(filePath)
    rs.on('data', (chunk: Buffer) => {
      hash.update(chunk)
    })
    rs.on('end', () => {
      resolve(hash.digest('hex'))
    })
    rs.on('error', reject)
  })
}

function sendExcalidrawProgress(payload: ExcalidrawInstallProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('excalidraw:install-progress', payload)
  }
}

function sendExcalidrawBundleReady(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('excalidraw:bundle-ready')
  }
}

async function downloadZip(
  zipUrl: string,
  destPath: string,
  expectedSize: number | undefined,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    request(zipUrl)
      .then((res) => {
        const total = parseInt(res.headers['content-length'] || '0', 10) || expectedSize || 0
        let received = 0
        let lastTime = Date.now()
        let lastTransferred = 0
        let lastBps = 0
        const fileStream = createWriteStream(destPath)
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          const percent = total > 0 ? Math.round((received / total) * 100) : 0
          const now = Date.now()
          const elapsed = (now - lastTime) / 1000
          if (elapsed >= 0.45) {
            lastBps = (received - lastTransferred) / elapsed
            lastTime = now
            lastTransferred = received
          }
          sendExcalidrawProgress({
            phase: 'downloading',
            percent,
            received,
            total,
            bytesPerSecond: lastBps > 0 ? lastBps : undefined,
          })
        })
        res.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          resolve()
        })
        fileStream.on('error', reject)
        res.on('error', reject)
      })
      .catch(reject)
  })
}

async function findIndexRoot(extractedDir: string): Promise<string | null> {
  const atRoot = join(extractedDir, 'index.html')
  if (existsSync(atRoot)) {
    return extractedDir
  }
  const entries = await readdir(extractedDir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) {
      const sub = join(extractedDir, e.name, 'index.html')
      if (existsSync(sub)) {
        return join(extractedDir, e.name)
      }
    }
  }
  return null
}

export async function installExcalidrawFromManifest(
  manifest: ExcalidrawPluginManifest,
): Promise<void> {
  assertMinAppVersion(manifest.minAppVersion)

  const pluginsRoot = join(app.getPath('userData'), 'plugins')
  const tmpRoot = join(pluginsRoot, '.excalidraw-install-staging')
  const tmpZip = join(tmpRoot, 'bundle.zip')
  const tmpExtract = join(tmpRoot, 'extracted')

  sendExcalidrawProgress({ phase: 'downloading', percent: 0, received: 0, total: 0 })

  await mkdir(tmpRoot, { recursive: true })
  if (existsSync(tmpExtract)) {
    await rm(tmpExtract, { recursive: true, force: true })
  }

  try {
    await downloadZip(manifest.zipUrl, tmpZip, manifest.size)

    sendExcalidrawProgress({ phase: 'verifying' })

    const gotHash = (await sha256FileHex(tmpZip)).toLowerCase()
    const wantHash = manifest.sha256.trim().toLowerCase()
    if (gotHash !== wantHash) {
      throw new Error(
        `Checksum mismatch: expected ${wantHash.slice(0, 12)}… got ${gotHash.slice(0, 12)}…`,
      )
    }

    sendExcalidrawProgress({ phase: 'extracting', percent: 0 })

    await mkdir(tmpExtract, { recursive: true })
    const zip = new AdmZip(tmpZip)
    zip.extractAllTo(tmpExtract, true)

    const root = await findIndexRoot(tmpExtract)
    if (!root) {
      throw new Error('Archive does not contain index.html')
    }

    const target = getUserExcalidrawRoot()
    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true })
    }
    await mkdir(join(pluginsRoot), { recursive: true })
    await cp(root, target, { recursive: true })

    const versionPayload = JSON.stringify({ version: manifest.version }, null, 0)
    await writeFile(join(target, VERSION_FILE), versionPayload, 'utf-8')

    sendExcalidrawProgress({ phase: 'done' })
    sendExcalidrawBundleReady()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    sendExcalidrawProgress({ phase: 'error', message })
    throw e
  } finally {
    try {
      if (existsSync(tmpRoot)) {
        await rm(tmpRoot, { recursive: true, force: true })
      }
    } catch {
      /* ignore */
    }
  }
}

export async function removeExcalidrawBundle(): Promise<void> {
  const root = getUserExcalidrawRoot()
  if (existsSync(root)) {
    await rm(root, { recursive: true, force: true })
  }
}

export async function installExcalidrawUsingUpdateUrl(
  updateUrl: string,
): Promise<void> {
  const manifest = await fetchExcalidrawManifest(updateUrl)
  await installExcalidrawFromManifest(manifest)
}
