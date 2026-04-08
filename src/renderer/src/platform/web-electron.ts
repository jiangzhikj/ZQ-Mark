import type {
  AppSettings,
  ElectronAPI,
  LocalFileResult,
  OpenFileResult
} from '../../../preload/index'
import {
  buildZqZipBytes,
  downloadUint8Array,
  openZqDocumentFromFile
} from './web-zq'
import {
  buildZqlZipBytes,
  createEmptyLibraryWeb,
  detectZqTypeFromBuffer,
  getLibraryDocName,
  libraryCreateDocWeb,
  libraryCreateFolderWeb,
  libraryDeleteItemWeb,
  libraryGetDocWeb,
  libraryMoveItemWeb,
  libraryRenameItemWeb,
  librarySaveDocWeb,
  openZqlFromArrayBuffer,
  serializeWebLibraryRuntime,
  deserializeWebLibraryRuntime,
  type WebLibraryRuntime,
  type WebLibrarySerialized
} from './web-zql'

export type { WebLibrarySerialized }

export function serializeWebLibrarySnapshot(): WebLibrarySerialized | null {
  if (!webLibraryRuntime) return null
  return serializeWebLibraryRuntime(webLibraryRuntime)
}

export function restoreWebLibraryFromSnapshot(data: WebLibrarySerialized): void {
  webLibraryRuntime = deserializeWebLibraryRuntime(data)
  setWindowMode('library')
}

const SETTINGS_KEY = 'zq-mark-settings'
const MODE_KEY = 'zq-web-window-mode'
const LOCALE_KEY = 'zq-web-user-locale'

const defaultSettings = (): AppSettings => ({
  autoSave: true,
  updateUrl: '',
  codeTheme: 'intellij',
  telemetryEnabled: true,
  drawioUiLayout: 'full',
})

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings()
    return { ...defaultSettings(), ...JSON.parse(raw) }
  } catch {
    return defaultSettings()
  }
}

function basename(p: string): string {
  const parts = p.split(/[/\\]/)
  return parts[parts.length - 1] || p
}

/** 虚拟路径 -> 用户曾通过 File System Access API 打开/保存的文件句柄 */
const fileHandles = new Map<string, FileSystemFileHandle>()

let webLibraryRuntime: WebLibraryRuntime | null = null

const menuListeners = new Set<(action: string) => void>()
const settingsListeners = new Set<(s: AppSettings) => void>()
export function dispatchWebMenuAction(action: string): void {
  menuListeners.forEach((fn) => fn(action))
}

function getWindowModeSync(): 'document' | 'library' {
  const m = sessionStorage.getItem(MODE_KEY)
  if (m === 'library' || m === 'document') return m
  return webLibraryRuntime ? 'library' : 'document'
}

function setWindowMode(mode: 'document' | 'library'): void {
  sessionStorage.setItem(MODE_KEY, mode)
}

async function pickOpenFile(): Promise<{
  file: File
  virtualPath: string
} | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Documents',
            accept: {
              'application/octet-stream': ['.zq', '.zql'],
              'text/markdown': ['.md', '.markdown', '.txt'],
              'text/html': ['.html']
            }
          }
        ],
        multiple: false
      })
      const file = await handle.getFile()
      const virtualPath = `web:${file.name}`
      fileHandles.set(virtualPath, handle)
      return { file, virtualPath }
    } catch {
      return null
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zq,.zql,.md,.markdown,.txt,.html'
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f) resolve(null)
      else resolve({ file: f, virtualPath: `web:${f.name}` })
    }
    input.click()
  })
}

async function writeTextToVirtualPath(virtualPath: string, content: string): Promise<boolean> {
  const h = fileHandles.get(virtualPath)
  if (!h) return false
  const w = await h.createWritable()
  await w.write(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  await w.close()
  return true
}

async function writeBytesToVirtualPath(virtualPath: string, data: Uint8Array): Promise<boolean> {
  const h = fileHandles.get(virtualPath)
  if (!h) return false
  const w = await h.createWritable()
  await w.write(new Blob([data]))
  await w.close()
  return true
}

export function createWebElectronApi(): ElectronAPI {
  return {
    getSystemLocale: async () => navigator.language || 'zh-CN',

    getSystemTheme: async () =>
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',

    changeLocale: async (locale: string) => {
      localStorage.setItem(LOCALE_KEY, locale)
      window.dispatchEvent(new CustomEvent('web:locale-changed', { detail: locale }))
    },

    getWindowMode: async () => getWindowModeSync(),

    getSettings: async () => readSettings(),

    setSettings: async (partial) => {
      const next = { ...readSettings(), ...partial }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      settingsListeners.forEach((fn) => fn(next))
      return next
    },

    onSettingsChanged: (callback) => {
      settingsListeners.add(callback)
      return () => settingsListeners.delete(callback)
    },

    onThemeChanged: (callback) => {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => callback(media.matches ? 'dark' : 'light')
      callback(media.matches ? 'dark' : 'light')
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    },

    onMenuAction: (callback) => {
      menuListeners.add(callback)
      return () => menuListeners.delete(callback)
    },

    onCheckDirty: () => () => {},

    onLoadFile: () => () => {},

    getPendingFile: async () => null,

    onUnsavedDialogShow: () => () => {},

    sendUnsavedDialogResult: () => {},

    requestClose: () => {
      window.close()
    },

    newDocumentWindow: () => {
      window.open(`${window.location.pathname}?newDoc=1`, '_blank')
    },

    newLibraryWindow: () => {
      window.open(`${window.location.pathname}?mode=library&newLib=1`, '_blank')
    },

    openFile: async (): Promise<OpenFileResult | null> => {
      const picked = await pickOpenFile()
      if (!picked) return null
      const { file, virtualPath } = picked
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      const buf = await file.arrayBuffer()

      const isLibrary =
        ext === 'zql' || (ext === 'zq' && detectZqTypeFromBuffer(buf) === 'library')

      if (isLibrary) {
        webLibraryRuntime = await openZqlFromArrayBuffer(buf, virtualPath)
        setWindowMode('library')
        return { opened: 'library-in-place', filePath: virtualPath }
      }

      if (ext === 'zq') {
        const { json, meta } = await openZqDocumentFromFile(file)
        return { filePath: virtualPath, content: '', json, meta, isZq: true }
      }

      const content = await file.text()
      return { filePath: virtualPath, content, isZq: false }
    },

    saveFile: async ({ filePath, content }) => {
      let path = filePath
      if (path && (await writeTextToVirtualPath(path, content))) {
        return path
      }
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: path ? basename(path) : 'untitled.md',
            types: [{ accept: { 'text/markdown': ['.md'] } }]
          })
          const w = await handle.createWritable()
          await w.write(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
          await w.close()
          const f = await handle.getFile()
          const vp = `web:${f.name}`
          fileHandles.set(vp, handle)
          return vp
        } catch {
          return null
        }
      }
      const name = path ? basename(path) : 'untitled.md'
      downloadUint8Array(
        new TextEncoder().encode(content),
        name,
        'text/markdown;charset=utf-8'
      )
      return path || `web:${name}`
    },

    saveZqFile: async ({ filePath, json, title, existingMeta }) => {
      const bytes = await buildZqZipBytes(json, title, existingMeta || null)
      let path = filePath
      if (path && (await writeBytesToVirtualPath(path, bytes))) {
        return path
      }
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${title || 'untitled'}.zq`,
            types: [{ accept: { 'application/zip': ['.zq'] } }]
          })
          const w = await handle.createWritable()
          await w.write(new Blob([bytes]))
          await w.close()
          const f = await handle.getFile()
          const vp = `web:${f.name}`
          fileHandles.set(vp, handle)
          return vp
        } catch {
          return null
        }
      }
      downloadUint8Array(bytes, `${title || 'untitled'}.zq`, 'application/zip')
      return path || `web:${title || 'untitled'}.zq`
    },

    saveDroppedFile: async (buffer, fileName) => {
      const blob = new Blob([buffer])
      const url = URL.createObjectURL(blob)
      const id = crypto.randomUUID()
      return {
        id,
        path: '',
        url,
        name: fileName,
        size: buffer.byteLength
      }
    },

    openLocalFile: async () => {
      const picked = await pickOpenFile()
      if (!picked) return null
      const buf = await picked.file.arrayBuffer()
      const blob = new Blob([buf])
      const url = URL.createObjectURL(blob)
      const id = crypto.randomUUID()
      return {
        id,
        path: '',
        url,
        name: picked.file.name,
        size: picked.file.size
      }
    },

    exportFile: async ({ format, html, title }) => {
      if (format === 'html') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${title || 'export'}.html`
        a.click()
        URL.revokeObjectURL(a.href)
        return a.download
      }
      const wrap = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`
      const blob = new Blob([wrap], { type: 'text/html;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${title || 'export'}.${format === 'pdf' ? 'pdf' : format === 'word' ? 'doc' : 'html'}`
      a.click()
      URL.revokeObjectURL(a.href)
      return a.download
    },

    showInFolder: async () => {},

    openAssetUrl: async (url: string) => {
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return { ok: true as const }
      }
      return { ok: false as const, error: 'unsupported' }
    },

    initLibraryInPlace: async () => {
      webLibraryRuntime = createEmptyLibraryWeb('未命名文件库')
      setWindowMode('library')
      return true
    },

    createLibrary: async ({ name }) => {
      const title = name?.trim() || '未命名文件库'
      const runtime = createEmptyLibraryWeb(title)
      const bytes = await buildZqlZipBytes(runtime)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${title}.zql`,
            types: [{ accept: { 'application/zip': ['.zql'] } }]
          })
          const w = await handle.createWritable()
          await w.write(new Blob([bytes]))
          await w.close()
          const f = await handle.getFile()
          const vp = `web:${f.name}`
          fileHandles.set(vp, handle)
          runtime.filePath = vp
          webLibraryRuntime = runtime
          setWindowMode('library')
          return { opened: 'in-place', filePath: vp }
        } catch {
          return null
        }
      }
      downloadUint8Array(bytes, `${title}.zql`, 'application/zip')
      const vp = `web:${title}.zql`
      runtime.filePath = vp
      webLibraryRuntime = runtime
      setWindowMode('library')
      return { opened: 'in-place', filePath: vp }
    },

    selectDirectory: async () => null,

    getRecentFiles: async () => [],

    openRecentFile: async () => null,

    libraryGetTree: async () => webLibraryRuntime?.index.tree ?? [],

    libraryOpenDoc: async (docId) => {
      if (!webLibraryRuntime) return null
      const json = libraryGetDocWeb(webLibraryRuntime, docId)
      if (!json) return null
      const name = getLibraryDocName(webLibraryRuntime, docId)
      return { json, name }
    },

    librarySaveDoc: async ({ docId, json }) => {
      if (!webLibraryRuntime) return false
      librarySaveDocWeb(webLibraryRuntime, docId, json)
      return true
    },

    librarySave: async () => {
      if (!webLibraryRuntime) return null
      const rt = webLibraryRuntime
      const bytes = await buildZqlZipBytes(rt)
      let path = rt.filePath
      if (path && (await writeBytesToVirtualPath(path, bytes))) {
        rt.dirty = false
        rt.dirtyDocs.clear()
        return path
      }
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${rt.meta.title || 'untitled'}.zql`,
            types: [{ accept: { 'application/zip': ['.zql'] } }]
          })
          const w = await handle.createWritable()
          await w.write(new Blob([bytes]))
          await w.close()
          const f = await handle.getFile()
          path = `web:${f.name}`
          fileHandles.set(path, handle)
          rt.filePath = path
          rt.dirty = false
          rt.dirtyDocs.clear()
          return path
        } catch {
          return null
        }
      }
      downloadUint8Array(bytes, `${rt.meta.title || 'library'}.zql`, 'application/zip')
      path = path || `web:${rt.meta.title || 'library'}.zql`
      rt.filePath = path
      rt.dirty = false
      rt.dirtyDocs.clear()
      return path
    },

    libraryCreateDoc: async ({ parentId, name }) => {
      if (!webLibraryRuntime) return null
      return libraryCreateDocWeb(webLibraryRuntime, parentId, name)
    },

    libraryCreateFolder: async ({ parentId, name }) => {
      if (!webLibraryRuntime) return null
      return libraryCreateFolderWeb(webLibraryRuntime, parentId, name)
    },

    libraryRename: async ({ id, newName }) => {
      if (!webLibraryRuntime) return false
      return libraryRenameItemWeb(webLibraryRuntime, id, newName)
    },

    libraryDelete: async ({ id }) => {
      if (!webLibraryRuntime) return false
      return libraryDeleteItemWeb(webLibraryRuntime, id)
    },

    libraryMove: async ({ id, newParentId, index }) => {
      if (!webLibraryRuntime) return false
      return libraryMoveItemWeb(webLibraryRuntime, id, newParentId, index)
    },

    libraryIsDirty: async () => webLibraryRuntime?.dirty ?? false,

    libraryGetName: async () => webLibraryRuntime?.meta.title || '',

    librarySetName: async (name) => {
      if (!webLibraryRuntime) return false
      webLibraryRuntime.meta.title = name
      webLibraryRuntime.dirty = true
      return true
    },

    updateCheck: async () => {},
    updateDownload: async () => {},
    updateInstall: async () => {},
    updateGetVersion: async () => '0.0.0-web',
    onUpdateEvent: () => () => {},

    getPlatform: async () => 'web',

    windowMinimize: () => {},
    windowMaximizeToggle: () => {},
    windowClose: () => {
      window.close()
    },
    windowIsMaximized: async () => false,
    popupMenu: () => {
      window.dispatchEvent(new CustomEvent('web:app-menu-open'))
    },
    onMaximizeChange: () => () => {},

    getDrawioIndexUrl: async () => null,

    openDrawioStandalone: async () => ({ ok: false }),
    getDrawioStandaloneInitial: async () => null,
    drawioStandaloneCommit: async () => ({ ok: false }),
    onDrawioStandaloneCommit: () => () => {}
  }
}
