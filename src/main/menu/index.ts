import { Menu, BrowserWindow, app, shell, ipcMain } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { messages } from '../../shared/i18n'
import type { SupportedLocale, MenuLocale } from '../../shared/i18n'

let cachedLocale: SupportedLocale = 'zh-CN'

function sendAction(action: string): void {
  const win = BrowserWindow.getFocusedWindow()
  win?.webContents.send('menu-action', action)
}

function buildAppMenu(m: MenuLocale): MenuItemConstructorOptions {
  return {
    label: app.name,
    submenu: [
      { label: m.app.about, role: 'about' },
      { type: 'separator' },
      { label: m.app.preferences, accelerator: 'CmdOrCtrl+,', click: () => sendAction('app:preferences') },
      { type: 'separator' },
      { label: m.app.hide, role: 'hide' },
      { label: m.app.hideOthers, role: 'hideOthers' },
      { label: m.app.showAll, role: 'unhide' },
      { type: 'separator' },
      { label: m.app.quit, role: 'quit' }
    ]
  }
}

function buildFileMenu(m: MenuLocale): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    { label: m.file.new, accelerator: 'CmdOrCtrl+N', click: () => sendAction('file:new') },
    { label: m.file.newLibrary, click: () => sendAction('file:newLibrary') },
    { label: m.file.open, accelerator: 'CmdOrCtrl+O', click: () => sendAction('file:open') },
    { type: 'separator' },
    { label: m.file.save, accelerator: 'CmdOrCtrl+S', click: () => sendAction('file:save') },
    {
      label: m.file.saveAs,
      submenu: [
        { label: m.file.saveAsZq, accelerator: 'CmdOrCtrl+Shift+S', click: () => sendAction('file:saveAsZq') },
        { label: m.file.saveAsMd, click: () => sendAction('file:saveAsMd') }
      ]
    },
    { type: 'separator' },
    {
      label: m.file.export,
      submenu: [
        { label: m.file.exportPDF, click: () => sendAction('export:pdf') },
        { label: m.file.exportHTML, click: () => sendAction('export:html') },
        { label: m.file.exportWord, click: () => sendAction('export:word') },
        { label: m.file.exportImage, click: () => sendAction('export:image') },
      ]
    },
    { type: 'separator' }
  ]

  if (process.platform !== 'darwin') {
    submenu.push(
      { label: m.app.preferences, accelerator: 'CmdOrCtrl+,', click: () => sendAction('app:preferences') },
      { type: 'separator' }
    )
  }

  submenu.push({ label: m.file.close, role: 'close' })

  return { label: m.file.label, submenu }
}

function buildEditMenu(m: MenuLocale): MenuItemConstructorOptions {
  return {
    label: m.edit.label,
    submenu: [
      { label: m.edit.undo, role: 'undo' },
      { label: m.edit.redo, role: 'redo' },
      { type: 'separator' },
      { label: m.edit.cut, role: 'cut' },
      { label: m.edit.copy, role: 'copy' },
      { label: m.edit.paste, role: 'paste' },
      { label: m.edit.selectAll, role: 'selectAll' },
      { type: 'separator' },
      { label: m.edit.find, accelerator: 'CmdOrCtrl+F', click: () => sendAction('edit:find') },
      { label: m.edit.replace, accelerator: 'CmdOrCtrl+H', click: () => sendAction('edit:replace') }
    ]
  }
}

function buildViewMenu(m: MenuLocale): MenuItemConstructorOptions {
  return {
    label: m.view.label,
    submenu: [
      { label: m.view.toggleSidebar, accelerator: 'CmdOrCtrl+Shift+L', click: () => sendAction('view:toggleSidebar') },
      { type: 'separator' },
      { label: m.view.sourceCode, accelerator: 'CmdOrCtrl+/', click: () => sendAction('view:sourceCode') },
      { type: 'separator' },
      { label: m.view.zoomIn, role: 'zoomIn' },
      { label: m.view.zoomOut, role: 'zoomOut' },
      { label: m.view.actualSize, role: 'resetZoom' },
      { type: 'separator' },
      { label: m.view.fullscreen, role: 'togglefullscreen' }
    ]
  }
}

function buildHelpMenu(m: MenuLocale): MenuItemConstructorOptions {
  return {
    label: m.help.label,
    role: 'help',
    submenu: [
      {
        label: m.help.markdownReference,
        click: () => shell.openExternal('https://www.markdownguide.org/basic-syntax/')
      },
      { type: 'separator' },
      {
        label: m.help.about,
        click: () => sendAction('help:about')
      },
      { type: 'separator' },
      { label: m.help.devTools, accelerator: 'CmdOrCtrl+Alt+I', click: () => {
        const win = BrowserWindow.getFocusedWindow()
        win?.webContents.toggleDevTools()
      }}
    ]
  }
}

function buildPopupTemplate(m: MenuLocale): MenuItemConstructorOptions[] {
  return [
    buildFileMenu(m),
    buildEditMenu(m),
    buildViewMenu(m),
    buildHelpMenu(m)
  ]
}

export function buildMenu(locale: SupportedLocale): void {
  cachedLocale = locale
  const m = messages[locale].menu

  if (process.platform === 'darwin') {
    const template: MenuItemConstructorOptions[] = [
      buildAppMenu(m),
      buildFileMenu(m),
      buildEditMenu(m),
      buildViewMenu(m),
      buildHelpMenu(m)
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  } else {
    // Win/Linux: no native menu bar, register global shortcuts manually
    Menu.setApplicationMenu(null)
    registerNonMacShortcuts()
  }
}

function registerNonMacShortcuts(): void {
  // Keyboard shortcuts are handled via Electron's menu accelerators on macOS.
  // On Win/Linux with no application menu, we register them via a hidden menu
  // that is never displayed but still processes accelerators.
  const m = messages[cachedLocale].menu
  const template = buildPopupTemplate(m)
  const hiddenMenu = Menu.buildFromTemplate(template)
  // Attach as the window menu so accelerators still work
  for (const state of getAllWindowStates()) {
    state.window.setMenu(hiddenMenu)
  }
}

function getAllWindowStates(): { window: BrowserWindow }[] {
  return BrowserWindow.getAllWindows().map(w => ({ window: w }))
}

export function popupAppMenu(win: BrowserWindow): void {
  const m = messages[cachedLocale].menu
  const template = buildPopupTemplate(m)
  const menu = Menu.buildFromTemplate(template)
  menu.popup({ window: win })
}

export function registerMenuIPC(): void {
  ipcMain.on('menu:popup', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) popupAppMenu(win)
  })
}

export function attachWindowMenu(win: BrowserWindow): void {
  if (process.platform === 'darwin') return
  const m = messages[cachedLocale].menu
  const template = buildPopupTemplate(m)
  const hiddenMenu = Menu.buildFromTemplate(template)
  win.setMenu(hiddenMenu)
}
