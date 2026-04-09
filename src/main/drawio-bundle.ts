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
  DrawioBundleStatus,
  DrawioInstallProgress,
  DrawioPluginManifest,
} from '../shared/drawio-plugin'

const VERSION_FILE = '.zq-drawio-version'

export function getUserDrawioRoot(): string {
  return join(app.getPath('userData'), 'plugins', 'drawio')
}

/** 解析顺序：userData 已安装 → 打包内置 → 开发仓库 resources */
export function resolveDrawioIndexPath(): string | null {
  const userIndex = join(getUserDrawioRoot(), 'index.html')
  if (existsSync(userIndex)) {
    return userIndex
  }

  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, 'drawio', 'index.html')
    if (existsSync(bundled)) {
      return bundled
    }
  } else {
    const devIndex = join(__dirname, '../../resources/drawio/index.html')
    if (existsSync(devIndex)) {
      return devIndex
    }
  }

  return null
}

export function getDrawioIndexAssetUrl(): string | null {
  const p = resolveDrawioIndexPath()
  return p ? localPathToAssetUrl(p) : null
}

async function readInstalledVersion(): Promise<string | undefined> {
  const vf = join(getUserDrawioRoot(), VERSION_FILE)
  if (!existsSync(vf)) return undefined
  try {
    const raw = await readFile(vf, 'utf-8')
    const j = JSON.parse(raw) as { version?: string }
    return typeof j.version === 'string' ? j.version : undefined
  } catch {
    return undefined
  }
}

export async function getDrawioBundleStatus(): Promise<DrawioBundleStatus> {
  const userIndex = join(getUserDrawioRoot(), 'index.html')
  const userInstalled = existsSync(userIndex)

  if (userInstalled) {
    const version = await readInstalledVersion()
    return { state: 'ready', version, userInstalled: true }
  }

  const resolved = resolveDrawioIndexPath()
  if (!resolved) {
    return { state: 'missing', userInstalled: false }
  }
  /** 无用户安装副本时回退到开发目录 resources/drawio 或打包内置：仍可用，但不可「卸载」 */
  return {
    state: 'ready',
    version: app.isPackaged ? 'bundled' : 'dev',
    userInstalled: false,
  }
}

function trimBase(url: string): string {
  return url.trim().replace(/\/$/, '')
}

export function getDrawioManifestUrl(updateUrl: string): string {
  return `${trimBase(updateUrl)}/plugins/drawio/manifest.json`
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

export async function fetchDrawioManifest(
  updateUrl: string,
): Promise<DrawioPluginManifest> {
  const url = getDrawioManifestUrl(updateUrl)
  if (!url.startsWith('https://')) {
    throw new Error('Manifest URL must use HTTPS')
  }
  const m = await fetchJSON<DrawioPluginManifest>(url)
  if (
    !m.version ||
    !m.zipUrl ||
    !m.sha256 ||
    typeof m.zipUrl !== 'string' ||
    typeof m.sha256 !== 'string'
  ) {
    throw new Error('Invalid draw.io manifest')
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

function sendDrawioProgress(payload: DrawioInstallProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('drawio:install-progress', payload)
  }
}

function sendDrawioBundleReady(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('drawio:bundle-ready')
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
          sendDrawioProgress({
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

export async function installDrawioFromManifest(
  manifest: DrawioPluginManifest,
): Promise<void> {
  assertMinAppVersion(manifest.minAppVersion)

  const pluginsRoot = join(app.getPath('userData'), 'plugins')
  const tmpRoot = join(pluginsRoot, '.drawio-install-staging')
  const tmpZip = join(tmpRoot, 'bundle.zip')
  const tmpExtract = join(tmpRoot, 'extracted')

  sendDrawioProgress({ phase: 'downloading', percent: 0, received: 0, total: 0 })

  await mkdir(tmpRoot, { recursive: true })
  if (existsSync(tmpExtract)) {
    await rm(tmpExtract, { recursive: true, force: true })
  }

  try {
    await downloadZip(manifest.zipUrl, tmpZip, manifest.size)

    sendDrawioProgress({ phase: 'verifying' })

    const gotHash = (await sha256FileHex(tmpZip)).toLowerCase()
    const wantHash = manifest.sha256.trim().toLowerCase()
    if (gotHash !== wantHash) {
      throw new Error(
        `Checksum mismatch: expected ${wantHash.slice(0, 12)}… got ${gotHash.slice(0, 12)}…`,
      )
    }

    sendDrawioProgress({ phase: 'extracting', percent: 0 })

    await mkdir(tmpExtract, { recursive: true })
    const zip = new AdmZip(tmpZip)
    zip.extractAllTo(tmpExtract, true)

    const drawioRoot = await findIndexRoot(tmpExtract)
    if (!drawioRoot) {
      throw new Error('Archive does not contain index.html')
    }

    const target = getUserDrawioRoot()
    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true })
    }
    await mkdir(join(pluginsRoot), { recursive: true })
    await cp(drawioRoot, target, { recursive: true })

    const versionPayload = JSON.stringify({ version: manifest.version }, null, 0)
    await writeFile(join(target, VERSION_FILE), versionPayload, 'utf-8')

    sendDrawioProgress({ phase: 'done' })
    sendDrawioBundleReady()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    sendDrawioProgress({ phase: 'error', message })
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

export async function removeDrawioBundle(): Promise<void> {
  const root = getUserDrawioRoot()
  if (existsSync(root)) {
    await rm(root, { recursive: true, force: true })
  }
}

export async function installDrawioUsingUpdateUrl(
  updateUrl: string,
): Promise<void> {
  const manifest = await fetchDrawioManifest(updateUrl)
  await installDrawioFromManifest(manifest)
}
