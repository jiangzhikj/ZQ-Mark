import { Menu, Tray, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { messages } from '../shared/i18n'
import type { SupportedLocale } from '../shared/i18n'
import { createWindow, getLocale } from './window-manager'
import { createEmptyLibrary } from './zq-file'

let tray: Tray | null = null

function getTrayIconPath(): string {
  if (app.isPackaged) {
    const base = join(process.resourcesPath, 'icons')
    if (process.platform === 'win32') return join(base, 'icon.ico')
    return join(base, 'icon.png')
  }
  const root = join(__dirname, '../../build')
  if (process.platform === 'win32') return join(root, 'icon.ico')
  return join(root, 'icon.png')
}

function loadTrayIcon(): Electron.NativeImage {
  const path = getTrayIconPath()
  if (!existsSync(path)) {
    console.warn('[tray] Icon not found:', path)
    return nativeImage.createEmpty()
  }
  return nativeImage.createFromPath(path)
}

function showOrCreateMainWindow(): void {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    const w = wins[0]
    if (w.isMinimized()) w.restore()
    w.show()
    w.focus()
    return
  }
  createWindow({ mode: 'document' })
}

function newDocumentFromTray(): void {
  createWindow({ mode: 'document', newDoc: true })
}

function newLibraryFromTray(): void {
  const locale = getLocale()
  const title = messages[locale].library.untitledLibrary
  const runtime = createEmptyLibrary(title)
  createWindow({ mode: 'library', libraryRuntime: runtime })
}

export function rebuildTrayMenu(locale: SupportedLocale): void {
  if (!tray) return
  const t = messages[locale].menu.tray
  const menu = Menu.buildFromTemplate([
    { label: t.show, click: () => showOrCreateMainWindow() },
    { type: 'separator' },
    { label: t.newDocument, click: () => newDocumentFromTray() },
    { label: t.newLibrary, click: () => newLibraryFromTray() },
    { type: 'separator' },
    { label: t.quit, click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
}

export function createTray(locale: SupportedLocale): void {
  if (tray) return
  const icon = loadTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip(app.name)
  rebuildTrayMenu(locale)

  tray.on('click', () => showOrCreateMainWindow())
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
