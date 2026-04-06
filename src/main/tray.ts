import { Menu, Tray, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { messages } from '../shared/i18n'
import type { SupportedLocale } from '../shared/i18n'
import { createWindow, getLocale } from './window-manager'
import { createEmptyLibrary } from './zq-file'

let tray: Tray | null = null

function getTrayIconDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'icons')
  return join(__dirname, '../../build')
}

function loadTrayIcon(): Electron.NativeImage {
  const dir = getTrayIconDir()

  if (process.platform === 'darwin') {
    const p1x = join(dir, 'tray-iconTemplate.png')
    const p2x = join(dir, 'tray-iconTemplate@2x.png')
    if (existsSync(p1x)) {
      const img = nativeImage.createFromPath(p1x)
      if (existsSync(p2x)) {
        img.addRepresentation({ scaleFactor: 2, dataURL: nativeImage.createFromPath(p2x).toDataURL() })
      }
      img.setTemplateImage(true)
      return img
    }
  }

  if (process.platform === 'win32') {
    const ico = join(dir, 'tray-icon.png')
    if (existsSync(ico)) return nativeImage.createFromPath(ico)
  }

  const png = join(dir, 'tray-icon.png')
  if (existsSync(png)) return nativeImage.createFromPath(png)

  const fallback = join(dir, 'icon.png')
  if (existsSync(fallback)) {
    console.warn('[tray] Using fallback icon.png')
    return nativeImage.createFromPath(fallback).resize({ width: 16, height: 16 })
  }

  console.warn('[tray] No tray icon found in:', dir)
  return nativeImage.createEmpty()
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
