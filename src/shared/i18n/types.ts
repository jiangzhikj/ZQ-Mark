export interface MenuLocale {
  app: {
    about: string
    preferences: string
    quit: string
    hide: string
    hideOthers: string
    showAll: string
  }
  file: {
    label: string
    new: string
    newLibrary: string
    open: string
    openRecent: string
    clearRecent: string
    save: string
    saveAs: string
    saveAsZq: string
    saveAsMd: string
    export: string
    exportPDF: string
    exportHTML: string
    exportWord: string
    exportImage: string
    close: string
  }
  edit: {
    label: string
    undo: string
    redo: string
    cut: string
    copy: string
    paste: string
    selectAll: string
    find: string
    replace: string
  }
  paragraph: {
    label: string
    heading1: string
    heading2: string
    heading3: string
    heading4: string
    heading5: string
    heading6: string
    paragraph: string
    table: string
    codeFences: string
    quote: string
    orderedList: string
    unorderedList: string
    indent: string
    outdent: string
  }
  format: {
    label: string
    bold: string
    italic: string
    underline: string
    strikethrough: string
    code: string
    hyperlink: string
    image: string
    clearFormat: string
  }
  view: {
    label: string
    toggleSidebar: string
    sourceCode: string
    zoomIn: string
    zoomOut: string
    actualSize: string
    fullscreen: string
  }
  help: {
    label: string
    markdownReference: string
    about: string
    devTools: string
  }
}

export interface AppLocale {
  app: {
    name: string
  }
  menu: MenuLocale
  editor: {
    placeholder: string
    untitled: string
  }
  welcome: {
    openFile: string
    openFileDesc: string
    newDocument: string
    newDocumentDesc: string
    newLibrary: string
    newLibraryDesc: string
    recentProjects: string
    viewAll: string
  }
  sidebar: {
    outline: string
    fileTree: string
    noHeadings: string
    toggle: string
  }
  library: {
    untitledLibrary: string
    untitledDoc: string
    untitledFolder: string
    newFile: string
    newFolder: string
    rename: string
    delete: string
    deleteConfirm: string
    showInFinder: string
    copyPath: string
    emptyLibrary: string
    selectOrCreateDoc: string
    newDocName: string
    createLibraryTitle: string
    libraryNameLabel: string
    libraryNamePlaceholder: string
    saveLocationLabel: string
    saveLocationPlaceholder: string
    createDocTitle: string
    createFolderTitle: string
    docNameLabel: string
    docNamePlaceholder: string
    folderNameLabel: string
    folderNamePlaceholder: string
  }
  settings: {
    title: string
    general: string
    appearance: string
    about: string
    language: string
    languageDesc: string
    languageSystem: string
    theme: string
    themeDesc: string
    themeLight: string
    themeDark: string
    themeSystem: string
    autoSave: string
    autoSaveDesc: string
    restartHint: string
    updateUrl: string
    updateUrlDesc: string
    updateUrlPlaceholder: string
  }
  update: {
    currentVersion: string
    checkUpdate: string
    checking: string
    updateAvailable: string
    noUpdate: string
    newVersion: string
    releaseNotes: string
    downloading: string
    downloadProgress: string
    downloadSpeed: string
    downloadComplete: string
    installNow: string
    installTip: string
    later: string
    error: string
    retry: string
    networkError: string
  }
  status: {
    characters: string
    lines: string
    words: string
    saved: string
    unsaved: string
    modified: string
  }
  common: {
    copy: string
    delete: string
  }
  exportMsg: {
    exporting: string
    success: string
    failed: string
  }
  titlebar: {
    menu: string
    minimize: string
    maximize: string
    close: string
  }
  dialog: {
    unsavedTitle: string
    unsavedMessage: string
    save: string
    dontSave: string
    cancel: string
    confirm: string
    sourceModeTitle: string
    sourceModeMessage: string
    sourceModeConfirm: string
    saveMdTitle: string
    saveMdMessage: string
    saveMdContinue: string
    saveMdSaveAsZq: string
  }
  'zq-editor': ZqEditorLocale
  draw: DrawLocale
}

export interface DrawLocale {
  tool: Record<string, string>
  action: Record<string, string>
  menu: Record<string, string>
  property: Record<string, string>
  fillStyle: Record<string, string>
  strokeStyle: Record<string, string>
  label: Record<string, string>
  arrowhead: Record<string, string>
  font: Record<string, string>
  verticalAlign: Record<string, string>
  stats: Record<string, string>
}

export interface ZqEditorLocale {
  placeholder: string
  bubble: Record<string, string>
  blockMenu: Record<string, string>
  turnInto: Record<string, string>
  search: Record<string, string>
  link: Record<string, string>
  color: Record<string, string>
  codeBlock: Record<string, string>
  slash: Record<string, string>
  table: Record<string, string>
  image: Record<string, string>
  attachment: Record<string, string>
  toc: Record<string, string>
  toggle: Record<string, string>
  upload: Record<string, string>
}

export type SupportedLocale = 'zh-CN' | 'zh-TW' | 'en'
