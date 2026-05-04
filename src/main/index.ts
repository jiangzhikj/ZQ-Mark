import { app, shell, BrowserWindow, ipcMain, dialog, nativeTheme, protocol, net } from 'electron'
import { join, basename, extname } from 'path'
import { readFile, writeFile, mkdir, copyFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { pathToFileURL } from 'url'
import { buildMenu, registerMenuIPC } from './menu'
import { runExport } from './export'
import type { ExportFormat } from './export'
import {
  saveZqDocument, openZqDocument,
  openZqLibrary, saveZqLibrary, createEmptyLibrary, detectZqType,
  libraryCreateDoc, libraryCreateFolder, libraryRenameItem,
  libraryDeleteItem, libraryMoveItem, libraryGetDoc, librarySaveDoc
} from './zq-file'
import { ASSET_PROTOCOL, localPathToAssetUrl, assetUrlToLocalPath } from './asset-protocol'
import { messages } from '../shared/i18n'
import type { SupportedLocale } from '../shared/i18n'
import { registerUpdaterIPC, checkForUpdate } from './updater'
import { reportInstallationTelemetry } from './telemetry'
import {
  createWindow,
  getStateByWebContents,
  getWindowByPath,
  forceClose,
  setLocale,
  getLocale,
  getAllStates,
  createDrawioStandaloneWindow,
  getDrawioStandaloneSession,
  deleteDrawioStandaloneSession,
  createExcalidrawStandaloneWindow,
  getExcalidrawStandaloneSession,
  deleteExcalidrawStandaloneSession,
  createWisemappingStandaloneWindow,
  getWisemappingStandaloneSession,
  deleteWisemappingStandaloneSession,
} from './window-manager'
import { createTray, rebuildTrayMenu, destroyTray, showOrCreateMainWindow } from './tray'
import {
  getDrawioIndexAssetUrl,
  getDrawioBundleStatus,
  fetchDrawioManifest,
  installDrawioUsingUpdateUrl,
  removeDrawioBundle,
} from './drawio-bundle'
import {
  getExcalidrawIndexAssetUrl,
  getExcalidrawBundleStatus,
  fetchExcalidrawManifest,
  installExcalidrawUsingUpdateUrl,
  removeExcalidrawBundle,
} from './excalidraw-bundle'
import {
  getWisemappingIndexAssetUrl,
  getWisemappingBundleStatus,
  fetchWisemappingManifest,
  installWisemappingUsingUpdateUrl,
  removeWisemappingBundle,
} from './wisemapping-bundle'

const MAX_RECENT = 10
let recentFiles: string[] = []

const SUPPORTED_EXTENSIONS = new Set(['.zq', '.zql', '.md', '.markdown', '.txt', '.html'])

function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return SUPPORTED_EXTENSIONS.has(ext)
}

let pendingFileOpen: string | null = null

async function openFileFromSystem(filePath: string): Promise<void> {
  if (!filePath || !existsSync(filePath)) return

  const ext = extname(filePath).toLowerCase()
  const isLibrary = ext === '.zql' || (ext === '.zq' && detectZqType(filePath) === 'library')

  const existing = getWindowByPath(filePath)
  if (existing) {
    existing.window.focus()
    addRecentFile(filePath)
    return
  }

  if (isLibrary) {
    const runtime = await openZqLibrary(filePath)
    createWindow({ filePath, mode: 'library', libraryRuntime: runtime })
    addRecentFile(filePath)
    return
  }

  if (ext === '.zq') {
    const { json, meta } = await openZqDocument(filePath)
    createWindow({
      filePath,
      mode: 'document',
      pendingFile: { filePath, content: '', json, meta, isZq: true }
    })
    addRecentFile(filePath)
    return
  }

  const content = await readFile(filePath, 'utf-8')
  createWindow({
    filePath,
    mode: 'document',
    pendingFile: { filePath, content, isZq: false }
  })
  addRecentFile(filePath)
}

function extractFilePathFromArgs(argv: string[]): string | null {
  for (let i = argv.length - 1; i >= 0; i--) {
    const arg = argv[i]
    if (arg.startsWith('-') || arg.startsWith('--')) continue
    if (isSupportedFile(arg) && existsSync(arg)) return arg
  }
  return null
}

// ─── Single instance lock ───

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractFilePathFromArgs(argv)
    if (filePath) {
      openFileFromSystem(filePath)
    } else {
      const allWindows = BrowserWindow.getAllWindows()
      if (allWindows.length > 0) {
        const win = allWindows[0]
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      } else {
        // 窗口已全部关闭但进程仍在托盘时，任务栏/快捷方式会再起一次进程；
        // 第二实例会退出，须在此处打开主窗口（与托盘左键一致）。
        showOrCreateMainWindow()
      }
    }
  })
}

// ─── App settings ───

interface AppSettings {
  autoSave: boolean
  updateUrl: string
  codeTheme: string

  telemetryEnabled: boolean
  drawioUiLayout: 'full' | 'minimal'
  /** 桌面端：UI 语言选择（可为 system，渲染侧会解析为具体 locale） */
  uiLocale: 'system' | SupportedLocale
  /** 桌面端：UI 主题选择（system/light/dark） */
  uiThemeMode: 'system' | 'light' | 'dark'
  /** 单文件保存时是否弹出 Markdown / ZQ 格式选择 */
  saveFormatAskDialog: boolean
  /** 关闭询问后默认保存格式 */
  saveFormatDefault: 'md' | 'zq'
  /** 拼写检查 */
  spellcheck: boolean
}

/** Base URL for `{base}/latest.json`. */
const defaultSettings: AppSettings = {
  autoSave: true,
  updateUrl: 'https://minio-api.fuadmin.cn/zq-mark',
  codeTheme: 'intellij',
  telemetryEnabled: true,
  drawioUiLayout: 'full',
  uiLocale: 'system',
  uiThemeMode: 'system',
  saveFormatAskDialog: true,
  saveFormatDefault: 'md',
  spellcheck: false
}

/** 历史内置默认，启动时自动迁往当前 `defaultSettings.updateUrl` */
const LEGACY_UPDATE_URLS = [
  'https://gitee.com/zq-platform/zq-mark/raw/master',
  'https://raw.githubusercontent.com/zq-platform/zq-mark/master',
  'https://raw.githubusercontent.com/jiangzhikj/ZQ-Mark/master',
  'https://minio-api.fuadmin.cn/zq-mark'
]

function migrateUpdateUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '')
  if (LEGACY_UPDATE_URLS.includes(trimmed)) {
    return defaultSettings.updateUrl
  }
  return url
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  try {
    const fs = require('fs')
    const p = getSettingsPath()
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
      const merged: AppSettings = { ...defaultSettings, ...parsed }
      const before = merged.updateUrl
      merged.updateUrl = migrateUpdateUrl(merged.updateUrl)
      if (merged.updateUrl !== before) {
        saveSettings(merged)
      }
      return merged
    }
  } catch { /* ignore */ }
  return { ...defaultSettings }
}

function saveSettings(settings: AppSettings): void {
  try {
    const fs = require('fs')
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

let appSettings = loadSettings()

function loadRecentFiles(): void {
  try {
    const stored = require('electron').app.getPath('userData')
    const fs = require('fs')
    const p = join(stored, 'recent-files.json')
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
      if (Array.isArray(parsed)) {
        recentFiles = parsed.slice(0, MAX_RECENT)
        if (parsed.length > MAX_RECENT) saveRecentFiles()
      } else {
        recentFiles = []
      }
    }
  } catch { recentFiles = [] }
}

function saveRecentFiles(): void {
  try {
    const stored = app.getPath('userData')
    const fs = require('fs')
    fs.writeFileSync(join(stored, 'recent-files.json'), JSON.stringify(recentFiles), 'utf-8')
  } catch { /* ignore */ }
}

function notifyRecentFilesChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('recent-files-changed')
  }
}

function clearRecentFilesFromMenu(): void {
  recentFiles = []
  saveRecentFiles()
  rebuildApplicationMenu()
  notifyRecentFilesChanged()
}

function rebuildApplicationMenu(): void {
  buildMenu(getLocale(), recentFiles, clearRecentFilesFromMenu)
}

function addRecentFile(fp: string): void {
  recentFiles = recentFiles.filter((f) => f !== fp)
  recentFiles.unshift(fp)
  if (recentFiles.length > MAX_RECENT) recentFiles = recentFiles.slice(0, MAX_RECENT)
  saveRecentFiles()
  rebuildApplicationMenu()
  notifyRecentFilesChanged()
}

function getSystemLocale(): SupportedLocale {
  const locale = app.getLocale()
  if (locale.startsWith('zh-TW') || locale.startsWith('zh-HK') || locale.startsWith('zh-Hant')) return 'zh-TW'
  if (locale.startsWith('zh')) return 'zh-CN'
  return 'en'
}

function getWinFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

// ─── IPC: System ───

ipcMain.handle('get-system-locale', () => getSystemLocale())

ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})

ipcMain.handle('change-locale', (_event, locale: SupportedLocale) => {
  setLocale(locale)
  buildMenu(locale, recentFiles, clearRecentFilesFromMenu)
  rebuildTrayMenu(locale)
})

ipcMain.handle('get-window-mode', (event) => {
  const state = getStateByWebContents(event.sender)
  return state?.mode || 'document'
})

ipcMain.handle('get-pending-file', (event) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.pendingFile) return null
  const data = state.pendingFile
  state.pendingFile = null
  return data
})

ipcMain.handle('settings:get', () => appSettings)

ipcMain.handle('settings:set', (_event, partial: Partial<AppSettings>) => {
  appSettings = { ...appSettings, ...partial }
  saveSettings(appSettings)
  for (const state of getAllStates()) {
    state.window.webContents.send('settings-changed', appSettings)
  }
  return appSettings
})

// ─── IPC: Window management ───

ipcMain.on('request-close', (event) => {
  const state = getStateByWebContents(event.sender)
  if (state) forceClose(state)
})

ipcMain.on('window:new-document', () => {
  createWindow({ mode: 'document', newDoc: true })
})

ipcMain.on('window:new-library', () => {
  const runtime = createEmptyLibrary('未命名文件库')
  createWindow({ mode: 'library', libraryRuntime: runtime })
})

// ─── IPC: Window controls (Win/Linux frameless) ───

ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.on('window:maximize-toggle', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
})

ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.handle('window:is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win?.isMaximized() || false
})

ipcMain.handle('get-platform', () => process.platform)

ipcMain.handle('drawio:get-index-url', () => {
  const url = getDrawioIndexAssetUrl()
  if (!url) {
    console.warn('[drawio] draw.io webapp not found (install from Settings → Plugins)')
  }
  return url
})

ipcMain.handle('drawio:get-bundle-status', () => getDrawioBundleStatus())

ipcMain.handle('drawio:fetch-manifest', async () => {
  return await fetchDrawioManifest(appSettings.updateUrl)
})

ipcMain.handle('drawio:install-bundle', async () => {
  await installDrawioUsingUpdateUrl(appSettings.updateUrl)
  return { ok: true as const }
})

ipcMain.handle('drawio:remove-bundle', async () => {
  await removeDrawioBundle()
  return { ok: true as const }
})

ipcMain.handle('excalidraw:get-index-url', () => {
  const url = getExcalidrawIndexAssetUrl()
  if (!url) {
    console.warn('[excalidraw] embed bundle not found (install from Settings → Plugins)')
  }
  return url
})

ipcMain.handle('excalidraw:get-bundle-status', () => getExcalidrawBundleStatus())

ipcMain.handle('excalidraw:fetch-manifest', async () => {
  return await fetchExcalidrawManifest(appSettings.updateUrl)
})

ipcMain.handle('excalidraw:install-bundle', async () => {
  await installExcalidrawUsingUpdateUrl(appSettings.updateUrl)
  return { ok: true as const }
})

ipcMain.handle('excalidraw:remove-bundle', async () => {
  await removeExcalidrawBundle()
  return { ok: true as const }
})

ipcMain.handle('wisemapping:get-index-url', () => {
  const url = getWisemappingIndexAssetUrl()
  if (!url) {
    console.warn('[wisemapping] embed bundle not found (install from Settings → Plugins)')
  }
  return url
})

ipcMain.handle('wisemapping:get-bundle-status', () => getWisemappingBundleStatus())

ipcMain.handle('wisemapping:fetch-manifest', async () => {
  return await fetchWisemappingManifest(appSettings.updateUrl)
})

ipcMain.handle('wisemapping:install-bundle', async () => {
  await installWisemappingUsingUpdateUrl(appSettings.updateUrl)
  return { ok: true as const }
})

ipcMain.handle('wisemapping:remove-bundle', async () => {
  await removeWisemappingBundle()
  return { ok: true as const }
})

ipcMain.handle(
  'drawio:open-standalone',
  (
    event,
    opts: { xml: string; token: string },
  ): { ok: boolean } => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    if (!parent) return { ok: false }
    createDrawioStandaloneWindow({
      parentId: parent.id,
      token: opts.token,
      xml: opts.xml,
    })
    return { ok: true }
  },
)

ipcMain.handle(
  'drawio:get-standalone-initial',
  (event): { xml: string; token: string } | null => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const s = getDrawioStandaloneSession(win.id)
    if (!s) return null
    return { xml: s.xml, token: s.token }
  },
)

ipcMain.handle(
  'drawio:standalone-commit',
  (
    event,
    payload: { xml: string; preview: string; token: string },
  ): { ok: boolean } => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false }
    const s = getDrawioStandaloneSession(win.id)
    if (!s || s.token !== payload.token) return { ok: false }
    const parent = BrowserWindow.fromId(s.parentId)
    if (parent && !parent.isDestroyed()) {
      parent.webContents.send('drawio:standalone-commit', {
        token: payload.token,
        xml: payload.xml,
        preview: payload.preview,
      })
    }
    deleteDrawioStandaloneSession(win.id)
    return { ok: true }
  },
)

ipcMain.handle(
  'excalidraw:open-standalone',
  (
    event,
    opts: { scene: string; token: string },
  ): { ok: boolean } => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    if (!parent) return { ok: false }
    createExcalidrawStandaloneWindow({
      parentId: parent.id,
      token: opts.token,
      scene: opts.scene,
    })
    return { ok: true }
  },
)

ipcMain.handle(
  'excalidraw:get-standalone-initial',
  (event): { scene: string; token: string } | null => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const s = getExcalidrawStandaloneSession(win.id)
    if (!s) return null
    return { scene: s.scene, token: s.token }
  },
)

ipcMain.handle(
  'excalidraw:standalone-commit',
  (
    event,
    payload: { scene: string; preview: string; token: string },
  ): { ok: boolean } => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false }
    const s = getExcalidrawStandaloneSession(win.id)
    if (!s || s.token !== payload.token) return { ok: false }
    const parent = BrowserWindow.fromId(s.parentId)
    if (parent && !parent.isDestroyed()) {
      parent.webContents.send('excalidraw:standalone-commit', {
        token: payload.token,
        scene: payload.scene,
        preview: payload.preview,
      })
    }
    deleteExcalidrawStandaloneSession(win.id)
    return { ok: true }
  },
)

ipcMain.handle(
  'wisemapping:open-standalone',
  (
    event,
    opts: { mapXml: string; token: string },
  ): { ok: boolean } => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    if (!parent) return { ok: false }
    createWisemappingStandaloneWindow({
      parentId: parent.id,
      token: opts.token,
      mapXml: opts.mapXml,
    })
    return { ok: true }
  },
)

ipcMain.handle(
  'wisemapping:get-standalone-initial',
  (event): { mapXml: string; token: string } | null => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const s = getWisemappingStandaloneSession(win.id)
    if (!s) return null
    return { mapXml: s.mapXml, token: s.token }
  },
)

ipcMain.handle(
  'wisemapping:standalone-commit',
  (
    event,
    payload: { mapXml: string; preview: string; token: string },
  ): { ok: boolean } => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false }
    const s = getWisemappingStandaloneSession(win.id)
    if (!s || s.token !== payload.token) return { ok: false }
    const parent = BrowserWindow.fromId(s.parentId)
    if (parent && !parent.isDestroyed()) {
      parent.webContents.send('wisemapping:standalone-commit', {
        token: payload.token,
        mapXml: payload.mapXml,
        preview: payload.preview,
      })
    }
    deleteWisemappingStandaloneSession(win.id)
    return { ok: true }
  },
)

ipcMain.handle('window:create-library', async (event, { name, dirPath }: { name: string; dirPath: string }) => {
  const title = name || '未命名文件库'
  const runtime = createEmptyLibrary(title)
  const savePath = join(dirPath, `${title}.zql`)
  await saveZqLibrary(savePath, runtime)
  runtime.filePath = savePath

  const state = getStateByWebContents(event.sender)
  if (state && !state.filePath && state.mode === 'document') {
    state.mode = 'library'
    state.libraryRuntime = runtime
    state.filePath = savePath
    addRecentFile(savePath)
    return { opened: 'in-place', filePath: savePath }
  }

  createWindow({ filePath: savePath, mode: 'library', libraryRuntime: runtime })
  addRecentFile(savePath)
  return { opened: 'new-window', filePath: savePath }
})

ipcMain.handle('dialog:select-directory', async (event) => {
  const win = getWinFromEvent(event)
  if (!win) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
})

ipcMain.handle('window:init-library-in-place', (event) => {
  const state = getStateByWebContents(event.sender)
  if (!state) return false
  const runtime = createEmptyLibrary('未命名文件库')
  state.mode = 'library'
  state.libraryRuntime = runtime
  state.filePath = null
  return true
})

ipcMain.handle('library:get-name', (event) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return ''
  return state.libraryRuntime.meta.title || ''
})

ipcMain.handle('library:set-name', (event, name: string) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return false
  state.libraryRuntime.meta.title = name
  state.libraryRuntime.dirty = true
  return true
})

// ─── IPC: Open file (auto-detect type) ───

ipcMain.handle('dialog:open-file', async (event) => {
  const win = getWinFromEvent(event)
  if (!win) return null

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'ZQ Files', extensions: ['zq', 'zql', 'md', 'html'] },
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (canceled || filePaths.length === 0) return null

  const fp = filePaths[0]
  const ext = extname(fp).toLowerCase()

  const isLibrary = ext === '.zql' || (ext === '.zq' && detectZqType(fp) === 'library')

  if (isLibrary) {
    const existing = getWindowByPath(fp)
    if (existing) {
      existing.window.focus()
      addRecentFile(fp)
      return { opened: 'library-window', filePath: fp }
    }
    const state = getStateByWebContents(event.sender)
    if (state && !state.filePath && state.mode === 'document') {
      const runtime = await openZqLibrary(fp)
      state.mode = 'library'
      state.libraryRuntime = runtime
      state.filePath = fp
      addRecentFile(fp)
      return { opened: 'library-in-place', filePath: fp }
    }
    const runtime = await openZqLibrary(fp)
    createWindow({ filePath: fp, mode: 'library', libraryRuntime: runtime })
    addRecentFile(fp)
    return { opened: 'library-window', filePath: fp }
  }

  if (ext === '.zq') {
    const { json, meta } = await openZqDocument(fp)
    addRecentFile(fp)
    return { filePath: fp, content: '', json, meta, isZq: true }
  }

  const content = await readFile(fp, 'utf-8')
  addRecentFile(fp)
  return { filePath: fp, content, isZq: false }
})

ipcMain.handle('recent:get', () => {
  return recentFiles
})

ipcMain.handle('recent:open', async (event, fp: string) => {
  const ext = extname(fp).toLowerCase()
  const isLibrary = ext === '.zql' || (ext === '.zq' && detectZqType(fp) === 'library')

  if (isLibrary) {
    const existing = getWindowByPath(fp)
    if (existing) {
      existing.window.focus()
      return { opened: 'library-window', filePath: fp }
    }
    const state = getStateByWebContents(event.sender)
    if (state) {
      const runtime = await openZqLibrary(fp)
      state.mode = 'library'
      state.libraryRuntime = runtime
      state.filePath = fp
      addRecentFile(fp)
      return { opened: 'library-in-place', filePath: fp }
    }
    return null
  }

  if (ext === '.zq') {
    const { json, meta } = await openZqDocument(fp)
    addRecentFile(fp)
    return { filePath: fp, content: '', json, meta, isZq: true }
  }

  const content = await readFile(fp, 'utf-8')
  addRecentFile(fp)
  return { filePath: fp, content, isZq: false }
})

// ─── IPC: Save document ───

ipcMain.handle('dialog:save-file', async (event, { filePath, content }: { filePath: string | null; content: string }) => {
  const win = getWinFromEvent(event)
  if (!win) return null

  let savePath = filePath
  if (!savePath) {
    const { canceled, filePath: chosen } = await dialog.showSaveDialog(win, {
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'ZQ Document', extensions: ['zq'] }
      ],
      defaultPath: 'untitled.md'
    })
    if (canceled || !chosen) return null
    savePath = chosen
  }
  await writeFile(savePath, content, 'utf-8')
  return savePath
})

ipcMain.handle('zq:save', async (event, { filePath, json, title, existingMeta }: { filePath: string | null; json: any; title: string; existingMeta?: any }) => {
  const win = getWinFromEvent(event)
  if (!win) return null

  let savePath = filePath
  if (!savePath) {
    const { canceled, filePath: chosen } = await dialog.showSaveDialog(win, {
      filters: [
        { name: 'ZQ Document', extensions: ['zq'] }
      ],
      defaultPath: `${title || 'untitled'}.zq`
    })
    if (canceled || !chosen) return null
    savePath = chosen
  }

  await saveZqDocument(savePath, json, title, existingMeta || null)

  const state = getStateByWebContents(event.sender)
  if (state) state.filePath = savePath

  return savePath
})

// ─── IPC: Library operations ───

ipcMain.handle('library:get-tree', (event) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return []
  return state.libraryRuntime.index.tree
})

ipcMain.handle('library:open-doc', (event, docId: string) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return null
  const json = libraryGetDoc(state.libraryRuntime, docId)
  if (!json) return null
  const node = findNodeInTree(state.libraryRuntime.index.tree, docId)
  return { json, name: node?.name || '' }
})

ipcMain.handle('library:save-doc', (event, { docId, json }: { docId: string; json: any }) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return false
  librarySaveDoc(state.libraryRuntime, docId, json)
  return true
})

ipcMain.handle('library:save', async (event) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return null

  let savePath = state.libraryRuntime.filePath
  if (!savePath) {
    const win = getWinFromEvent(event)
    if (!win) return null
    const { canceled, filePath: chosen } = await dialog.showSaveDialog(win, {
      filters: [{ name: 'ZQ Document Library', extensions: ['zql'] }],
      defaultPath: `${state.libraryRuntime.meta.title || 'untitled'}.zql`
    })
    if (canceled || !chosen) return null
    savePath = chosen
  }

  await saveZqLibrary(savePath, state.libraryRuntime)
  state.filePath = savePath
  return savePath
})

ipcMain.handle('library:create-doc', (event, { parentId, name }: { parentId: string | null; name: string }) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return null
  return libraryCreateDoc(state.libraryRuntime, parentId, name)
})

ipcMain.handle('library:create-folder', (event, { parentId, name }: { parentId: string | null; name: string }) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return null
  return libraryCreateFolder(state.libraryRuntime, parentId, name)
})

ipcMain.handle('library:rename', (event, { id, newName }: { id: string; newName: string }) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return false
  return libraryRenameItem(state.libraryRuntime, id, newName)
})

ipcMain.handle('library:delete', (event, { id }: { id: string }) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return false
  return libraryDeleteItem(state.libraryRuntime, id)
})

ipcMain.handle('library:move', (event, { id, newParentId, index }: { id: string; newParentId: string | null; index: number }) => {
  const state = getStateByWebContents(event.sender)
  if (!state?.libraryRuntime) return false
  return libraryMoveItem(state.libraryRuntime, id, newParentId, index)
})

ipcMain.handle('library:is-dirty', (event) => {
  const state = getStateByWebContents(event.sender)
  return state?.libraryRuntime?.dirty || false
})

// ─── IPC: Local file handling for editor ───

const assetsDir = join(app.getPath('userData'), 'editor-assets')

async function ensureAssetsDir() {
  await mkdir(assetsDir, { recursive: true })
}

function extFromDataUrlMime(mime: string): string {
  const m = mime.split(';')[0].trim().toLowerCase()
  if (m === 'image/svg+xml') return '.svg'
  if (m === 'image/png') return '.png'
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg'
  if (m === 'image/gif') return '.gif'
  if (m === 'image/webp') return '.webp'
  return '.bin'
}

function parseDataUrlToBuffer(dataUrl: string): { buffer: Buffer; ext: string } | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const meta = dataUrl.slice(5, comma)
  const payload = dataUrl.slice(comma + 1)
  const mimeMatch = /^([^;,]+)/.exec(meta)
  const mime = mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream'
  const isBase64 = /;base64(?:;|$)/i.test(meta) || /^[^;]+;base64/i.test(meta)
  let buffer: Buffer
  try {
    if (isBase64) {
      buffer = Buffer.from(payload, 'base64')
    } else {
      buffer = Buffer.from(decodeURIComponent(payload), 'utf8')
    }
  } catch {
    return null
  }
  return { buffer, ext: extFromDataUrlMime(mime) }
}

ipcMain.handle('editor:save-dropped-file', async (_event, buffer: ArrayBuffer, fileName: string) => {
  await ensureAssetsDir()
  const ext = extname(fileName) || '.bin'
  const id = randomUUID()
  const localName = `${id}${ext}`
  const localPath = join(assetsDir, localName)
  await writeFile(localPath, Buffer.from(buffer))
  const byteLength = buffer.byteLength
  return {
    id: localName,
    path: localPath,
    url: localPathToAssetUrl(localPath),
    name: fileName,
    size: byteLength
  }
})

ipcMain.handle(
  'editor:save-array-buffer-as',
  async (event, buffer: ArrayBuffer, defaultFileName: string) => {
    const win = getWinFromEvent(event)
    if (!win) return null
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultFileName || 'image.png',
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, Buffer.from(buffer))
    return filePath
  },
)

/** 将 data URL（如 SVG 预览）写入 editor-assets，返回 local-asset URL，供 .zq 打包时收集为 assets/ */
ipcMain.handle('editor:save-data-url-asset', async (_event, dataUrl: string) => {
  await ensureAssetsDir()
  const parsed = parseDataUrlToBuffer(dataUrl)
  if (!parsed) return null
  const id = randomUUID()
  const localName = `${id}${parsed.ext}`
  const localPath = join(assetsDir, localName)
  await writeFile(localPath, parsed.buffer)
  return {
    id: localName,
    path: localPath,
    url: localPathToAssetUrl(localPath),
    name: localName,
    size: parsed.buffer.length,
  }
})

const TEXT_ASSET_EXT = new Set(['.xml', '.json'])

/** 将 UTF-8 文本写入 editor-assets（流程图 XML / Excalidraw scene），供 .zq 打包 */
ipcMain.handle(
  'editor:save-text-asset',
  async (_event, text: string, ext: string) => {
    await ensureAssetsDir()
    if (typeof text !== 'string') return null
    const normalized = ext.startsWith('.') ? ext : `.${ext}`
    if (!TEXT_ASSET_EXT.has(normalized)) return null
    const id = randomUUID()
    const localName = `${id}${normalized}`
    const localPath = join(assetsDir, localName)
    await writeFile(localPath, text, 'utf8')
    const size = Buffer.byteLength(text, 'utf8')
    return {
      id: localName,
      path: localPath,
      url: localPathToAssetUrl(localPath),
      name: localName,
      size,
    }
  },
)

ipcMain.handle('editor:open-local-file', async (event, options: { filters?: { name: string; extensions: string[] }[] }) => {
  const win = getWinFromEvent(event)
  if (!win) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: options.filters
  })
  if (canceled || filePaths.length === 0) return null
  const filePath = filePaths[0]
  await ensureAssetsDir()
  const ext = extname(filePath)
  const id = randomUUID()
  const localName = `${id}${ext}`
  const localPath = join(assetsDir, localName)
  await copyFile(filePath, localPath)
  const { size } = await stat(localPath)
  return {
    id: localName,
    path: localPath,
    url: localPathToAssetUrl(localPath),
    name: basename(filePath),
    size
  }
})

// ─── IPC: Import local file by absolute path ───

ipcMain.handle('editor:import-local-path', async (_event, localSrc: string) => {
  if (typeof localSrc !== 'string') return null
  const absPath = decodeURIComponent(localSrc.replace(/^file:\/\//, ''))
  if (!absPath.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(absPath)) return null
  try {
    await ensureAssetsDir()
    const ext = extname(absPath) || '.png'
    const id = randomUUID()
    const localName = `${id}${ext}`
    const localPath = join(assetsDir, localName)
    await copyFile(absPath, localPath)
    const { size } = await stat(localPath)
    return {
      id: localName,
      path: localPath,
      url: localPathToAssetUrl(localPath),
      name: basename(absPath),
      size,
    }
  } catch {
    return null
  }
})

// ─── IPC: Show in Finder ───

ipcMain.handle('shell:show-in-folder', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('shell:open-asset-url', async (_event, url: string) => {
  const filePath = assetUrlToLocalPath(url)
  if (!filePath) return { ok: false as const, error: 'invalid-url' }
  const err = await shell.openPath(filePath)
  return err === '' ? { ok: true as const } : { ok: false as const, error: err }
})

// ─── IPC: Export ───

ipcMain.handle('export:run', async (event, options: { format: ExportFormat; html: string; title: string; css?: string }) => {
  const win = getWinFromEvent(event)
  if (!win) return null
  try {
    return await runExport(win, options)
  } catch (err) {
    console.error('Export failed:', err)
    return null
  }
})

// ─── Theme ───

nativeTheme.on('updated', () => {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  for (const state of getAllStates()) {
    state.window.webContents.send('theme-changed', theme)
  }
})

// ─── Custom protocol ───

protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_PROTOCOL,
    privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, stream: true }
  }
])

// ─── Tree helper ───

function findNodeInTree(tree: any[], id: string): any | null {
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

// ─── App lifecycle ───

// macOS: open-file fires before ready when double-clicking a file to launch the app
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (app.isReady()) {
    openFileFromSystem(filePath)
  } else {
    pendingFileOpen = filePath
  }
})

app.whenReady().then(async () => {
  protocol.handle(ASSET_PROTOCOL, (request) => {
    const filePath = assetUrlToLocalPath(request.url)
    if (!filePath) {
      return new Response('Bad Request', { status: 400 })
    }
    return net.fetch(pathToFileURL(filePath).href)
  })

  loadRecentFiles()
  registerUpdaterIPC()
  registerMenuIPC()

  appSettings = loadSettings()
  const sysLocale = getSystemLocale()
  setLocale(sysLocale)
  buildMenu(sysLocale, recentFiles, clearRecentFilesFromMenu)
  createTray(sysLocale)

  const effectiveLocale = appSettings.uiLocale === 'system' ? sysLocale : appSettings.uiLocale
  setLocale(effectiveLocale)
  buildMenu(effectiveLocale, recentFiles, clearRecentFilesFromMenu)
  rebuildTrayMenu(effectiveLocale)
  void reportInstallationTelemetry(appSettings.telemetryEnabled !== false)

  // Auto-check for updates on launch (delayed by 10s) and every 4 hours
  if (appSettings.updateUrl) {
    setTimeout(() => checkForUpdate(appSettings.updateUrl), 10000)
  }
  setInterval(() => {
    appSettings = loadSettings()
    if (appSettings.updateUrl) checkForUpdate(appSettings.updateUrl)
  }, 4 * 60 * 60 * 1000)

  // Determine if there's a file to open from launch arguments or pending macOS open-file
  const fileFromArgs = pendingFileOpen || extractFilePathFromArgs(process.argv)
  if (fileFromArgs) {
    pendingFileOpen = null
    await openFileFromSystem(fileFromArgs)
  } else {
    createWindow({ mode: 'document' })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow({ mode: 'document' })
    }
  })
})

app.on('before-quit', () => {
  destroyTray()
  for (const state of getAllStates()) {
    state.forceQuit = true
  }
})

// Windows / Linux：关闭所有窗口后进程保留在系统托盘；从托盘「退出」才会真正退出
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    return
  }
})
