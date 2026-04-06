import { BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { messages } from '../shared/i18n'
import type { SupportedLocale } from '../shared/i18n'
import type { WindowMode } from '../shared/types'
import type { LibraryRuntime } from './zq-file'
import { attachWindowMenu } from './menu'

export interface PendingFileData {
  filePath: string
  content: string
  json?: any
  meta?: any
  isZq: boolean
}

export interface WindowState {
  id: number
  window: BrowserWindow
  filePath: string | null
  mode: WindowMode
  libraryRuntime: LibraryRuntime | null
  isHandlingClose: boolean
  forceQuit: boolean
  pendingFile: PendingFileData | null
}

const windows = new Map<number, WindowState>()
let currentLocale: SupportedLocale = 'zh-CN'

export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale
}

export function getLocale(): SupportedLocale {
  return currentLocale
}

export function createWindow(opts?: {
  filePath?: string | null
  mode?: WindowMode
  libraryRuntime?: LibraryRuntime | null
  pendingFile?: PendingFileData | null
  newDoc?: boolean
}): BrowserWindow {
  const mode = opts?.mode || 'document'
  const filePath = opts?.filePath || null

  const isMac = process.platform === 'darwin'

  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 600,
    minHeight: 400,
    show: false,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 15, y: 15 } }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const state: WindowState = {
    id: win.id,
    window: win,
    filePath,
    mode,
    libraryRuntime: opts?.libraryRuntime || null,
    isHandlingClose: false,
    forceQuit: false,
    pendingFile: opts?.pendingFile || null
  }
  windows.set(win.id, state)

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('close', (e) => {
    const s = windows.get(win.id)
    if (!s || s.forceQuit) return

    e.preventDefault()
    if (!s.isHandlingClose) {
      handleWindowClose(s)
    }
  })

  win.on('closed', () => {
    windows.delete(win.id)
  })

  if (!isMac) {
    win.on('maximize', () => win.webContents.send('window:maximize-change', true))
    win.on('unmaximize', () => win.webContents.send('window:maximize-change', false))
  }

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  attachWindowMenu(win)

  const query: Record<string, string> = { windowId: String(win.id), mode }
  if (opts?.newDoc) query.newDoc = '1'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
    win.loadURL(url.toString())
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  return win
}

export function getWindowState(win: BrowserWindow): WindowState | undefined {
  return windows.get(win.id)
}

export function getStateByWebContents(webContents: Electron.WebContents): WindowState | undefined {
  const win = BrowserWindow.fromWebContents(webContents)
  if (!win) return undefined
  return windows.get(win.id)
}

export function getWindowByPath(filePath: string): WindowState | undefined {
  for (const state of windows.values()) {
    if (state.filePath === filePath) return state
  }
  return undefined
}

export function getAllStates(): WindowState[] {
  return Array.from(windows.values())
}

export function forceClose(state: WindowState): void {
  state.forceQuit = true
  state.isHandlingClose = false
  state.window.close()
}

async function handleWindowClose(state: WindowState): Promise<void> {
  state.isHandlingClose = true
  try {
    const rendererDirty = await checkRendererDirty(state)
    const libraryDirty = state.libraryRuntime?.dirty || false
    const isDirty = rendererDirty || libraryDirty
    if (!isDirty) {
      forceClose(state)
      return
    }

    const result = await showUnsavedDialog(state.window)
    if (result === 'save') {
      state.window.webContents.send('menu-action', 'file:save-and-close')
    } else if (result === 'discard') {
      forceClose(state)
    }
  } catch {
    forceClose(state)
  } finally {
    state.isHandlingClose = false
  }
}

function checkRendererDirty(state: WindowState): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 2000)
    const channel = `check-dirty-reply-${state.id}`

    ipcMain.once(channel, (_event, isDirty: boolean) => {
      clearTimeout(timeout)
      resolve(isDirty)
    })

    state.window.webContents.send('check-dirty')
  })
}

export function showUnsavedDialog(win: BrowserWindow): Promise<'save' | 'discard' | 'cancel'> {
  const m = messages[currentLocale].dialog
  return dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [m.save, m.dontSave, m.cancel],
    defaultId: 0,
    cancelId: 2,
    title: m.unsavedTitle,
    message: m.unsavedMessage
  }).then(({ response }) => {
    if (response === 0) return 'save'
    if (response === 1) return 'discard'
    return 'cancel'
  })
}
