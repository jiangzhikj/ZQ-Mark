import { contextBridge, ipcRenderer } from 'electron'
import type { LibraryNode } from '../shared/types'

export interface LocalFileResult {
  id: string
  path: string
  url: string
  name: string
  size?: number
}

export interface OpenFileResult {
  filePath?: string
  content?: string
  json?: any
  meta?: any
  isZq?: boolean
  opened?: 'library-window' | 'library-in-place'
}

export interface AppSettings {
  autoSave: boolean
  updateUrl: string
}

export interface ElectronAPI {
  getSystemLocale: () => Promise<string>
  getSystemTheme: () => Promise<'light' | 'dark'>
  changeLocale: (locale: string) => Promise<void>
  getWindowMode: () => Promise<'document' | 'library'>
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void
  onMenuAction: (callback: (action: string) => void) => () => void
  onCheckDirty: (callback: () => boolean) => () => void
  onLoadFile: (callback: (data: { filePath: string; content: string; json?: any; meta?: any; isZq: boolean }) => void) => () => void
  getPendingFile: () => Promise<{ filePath: string; content: string; json?: any; meta?: any; isZq: boolean } | null>
  onUnsavedDialogShow: (callback: () => void) => () => void
  sendUnsavedDialogResult: (result: 'save' | 'discard' | 'cancel') => void
  requestClose: () => void
  newDocumentWindow: () => void
  newLibraryWindow: () => void
  openFile: () => Promise<OpenFileResult | null>
  saveFile: (data: { filePath: string | null; content: string }) => Promise<string | null>
  saveZqFile: (data: { filePath: string | null; json: any; title: string; existingMeta?: any }) => Promise<string | null>
  saveDroppedFile: (buffer: ArrayBuffer, fileName: string) => Promise<LocalFileResult>
  openLocalFile: (options: { filters?: { name: string; extensions: string[] }[] }) => Promise<LocalFileResult | null>
  exportFile: (options: { format: string; html: string; title: string; css?: string }) => Promise<string | null>
  showInFolder: (filePath: string) => Promise<void>
  openAssetUrl: (url: string) => Promise<{ ok: boolean; error?: string }>
  initLibraryInPlace: () => Promise<boolean>
  createLibrary: (data: { name: string; dirPath: string }) => Promise<{ opened: string; filePath: string } | null>
  selectDirectory: () => Promise<string | null>
  getRecentFiles: () => Promise<string[]>
  openRecentFile: (filePath: string) => Promise<any>

  // Library API
  libraryGetTree: () => Promise<LibraryNode[]>
  libraryOpenDoc: (docId: string) => Promise<{ json: any; name: string } | null>
  librarySaveDoc: (data: { docId: string; json: any }) => Promise<boolean>
  librarySave: () => Promise<string | null>
  libraryCreateDoc: (data: { parentId: string | null; name: string }) => Promise<LibraryNode | null>
  libraryCreateFolder: (data: { parentId: string | null; name: string }) => Promise<LibraryNode | null>
  libraryRename: (data: { id: string; newName: string }) => Promise<boolean>
  libraryDelete: (data: { id: string }) => Promise<boolean>
  libraryMove: (data: { id: string; newParentId: string | null; index: number }) => Promise<boolean>
  libraryIsDirty: () => Promise<boolean>
  libraryGetName: () => Promise<string>
  librarySetName: (name: string) => Promise<boolean>

  // Update API
  updateCheck: (updateUrl: string) => Promise<void>
  updateDownload: (updateUrl: string) => Promise<void>
  updateInstall: () => Promise<void>
  updateGetVersion: () => Promise<string>
  onUpdateEvent: (callback: (payload: any) => void) => () => void

  // Platform & window controls
  getPlatform: () => Promise<string>
  windowMinimize: () => void
  windowMaximizeToggle: () => void
  windowClose: () => void
  windowIsMaximized: () => Promise<boolean>
  popupMenu: () => void
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
}

const windowId = new URLSearchParams(window.location.search).get('windowId') || '0'

const api: ElectronAPI = {
  getSystemLocale: () => ipcRenderer.invoke('get-system-locale'),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  changeLocale: (locale) => ipcRenderer.invoke('change-locale', locale),
  getWindowMode: () => ipcRenderer.invoke('get-window-mode'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  onSettingsChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings)
    ipcRenderer.on('settings-changed', handler)
    return () => ipcRenderer.removeListener('settings-changed', handler)
  },
  onThemeChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: 'light' | 'dark') => callback(theme)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },
  onMenuAction: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu-action', handler)
    return () => ipcRenderer.removeListener('menu-action', handler)
  },
  onCheckDirty: (callback) => {
    const handler = () => {
      const isDirty = callback()
      ipcRenderer.send(`check-dirty-reply-${windowId}`, isDirty)
    }
    ipcRenderer.on('check-dirty', handler)
    return () => ipcRenderer.removeListener('check-dirty', handler)
  },
  onLoadFile: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('load-file', handler)
    return () => ipcRenderer.removeListener('load-file', handler)
  },
  getPendingFile: () => ipcRenderer.invoke('get-pending-file'),
  onUnsavedDialogShow: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('dialog:unsaved-show', handler)
    return () => ipcRenderer.removeListener('dialog:unsaved-show', handler)
  },
  sendUnsavedDialogResult: (result) => {
    ipcRenderer.send('dialog:unsaved-result', result)
  },
  requestClose: () => ipcRenderer.send('request-close'),
  newDocumentWindow: () => ipcRenderer.send('window:new-document'),
  newLibraryWindow: () => ipcRenderer.send('window:new-library'),
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  saveFile: (data) => ipcRenderer.invoke('dialog:save-file', data),
  saveZqFile: (data) => ipcRenderer.invoke('zq:save', data),
  saveDroppedFile: (buffer, fileName) => ipcRenderer.invoke('editor:save-dropped-file', buffer, fileName),
  openLocalFile: (options) => ipcRenderer.invoke('editor:open-local-file', options),
  exportFile: (options) => ipcRenderer.invoke('export:run', options),
  showInFolder: (filePath) => ipcRenderer.invoke('shell:show-in-folder', filePath),
  openAssetUrl: (url) => ipcRenderer.invoke('shell:open-asset-url', url),
  initLibraryInPlace: () => ipcRenderer.invoke('window:init-library-in-place'),
  createLibrary: (data) => ipcRenderer.invoke('window:create-library', data),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  getRecentFiles: () => ipcRenderer.invoke('recent:get'),
  openRecentFile: (filePath) => ipcRenderer.invoke('recent:open', filePath),

  // Library
  libraryGetTree: () => ipcRenderer.invoke('library:get-tree'),
  libraryOpenDoc: (docId) => ipcRenderer.invoke('library:open-doc', docId),
  librarySaveDoc: (data) => ipcRenderer.invoke('library:save-doc', data),
  librarySave: () => ipcRenderer.invoke('library:save'),
  libraryCreateDoc: (data) => ipcRenderer.invoke('library:create-doc', data),
  libraryCreateFolder: (data) => ipcRenderer.invoke('library:create-folder', data),
  libraryRename: (data) => ipcRenderer.invoke('library:rename', data),
  libraryDelete: (data) => ipcRenderer.invoke('library:delete', data),
  libraryMove: (data) => ipcRenderer.invoke('library:move', data),
  libraryIsDirty: () => ipcRenderer.invoke('library:is-dirty'),
  libraryGetName: () => ipcRenderer.invoke('library:get-name'),
  librarySetName: (name) => ipcRenderer.invoke('library:set-name', name),

  // Update
  updateCheck: (updateUrl) => ipcRenderer.invoke('update:check', updateUrl),
  updateDownload: (updateUrl) => ipcRenderer.invoke('update:download', updateUrl),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateGetVersion: () => ipcRenderer.invoke('update:get-version'),
  onUpdateEvent: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on('update-event', handler)
    return () => ipcRenderer.removeListener('update-event', handler)
  },

  // Platform & window controls
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  popupMenu: () => ipcRenderer.send('menu:popup'),
  onMaximizeChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window:maximize-change', handler)
    return () => ipcRenderer.removeListener('window:maximize-change', handler)
  }
}

contextBridge.exposeInMainWorld('electron', api)
