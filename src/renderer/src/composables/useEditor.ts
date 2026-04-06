import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ZqMessage } from '@/components/ui'
import i18n from '@/i18n'

const markdownContent = ref('')
const filePath = ref<string | null>(null)
const fileName = ref('')
const isZqFormat = ref(false)
const zqMeta = ref<any>(null)
const editVersion = ref(0)
const savedVersion = ref(0)

const windowMode = ref<'document' | 'library'>('document')
const libraryDocId = ref<string | null>(null)
const dirtyDocIds = new Set<string>()
const autoSaveEnabled = ref(true)

let _getMarkdown: (() => string) | null = null
let _getHTML: (() => string) | null = null
let _getJSON: (() => any) | null = null
let _setContent: ((content: string) => void) | null = null
let _setContentJSON: ((json: any) => void) | null = null

let _pendingContent: string | null = null
let _pendingJSON: any = null
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let _suppressUpdate = false
let _beforeSaveMd: (() => Promise<'md' | 'zq' | 'cancel'>) | null = null

let _unsavedDialog: (() => Promise<'save' | 'discard' | 'cancel'>) | null = null
const AUTO_SAVE_DELAY = 1500

function t(key: string): string {
  return (i18n.global as any).t(key)
}

/** 显示用文件名（支持 `web:xxx.md` 与 Windows 路径） */
function fileNameFromPath(path: string): string {
  const base = path.replace(/^web:/, '')
  const seg = base.split(/[/\\]/).pop() || base
  return seg || ''
}

function getExtension(path: string): string {
  const name = fileNameFromPath(path)
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

export function useEditor() {
  const isModified = computed(() => editVersion.value !== savedVersion.value)

  const stats = computed(() => {
    const text = markdownContent.value
    const characters = text.length
    const lines = text ? text.split('\n').length : 0
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    return { characters, lines, words }
  })

  function registerEditorApi(api: {
    getMarkdown: () => string
    getHTML: () => string
    getJSON: () => any
    setContent: (content: string) => void
    setContentJSON: (json: any) => void
  }) {
    _getMarkdown = api.getMarkdown
    _getHTML = api.getHTML
    _getJSON = api.getJSON
    _setContent = api.setContent
    _setContentJSON = api.setContentJSON

    if (_pendingJSON) {
      _suppressUpdate = true
      _setContentJSON(_pendingJSON)
      _suppressUpdate = false
      _pendingJSON = null
      markAsSaved()
    } else if (_pendingContent !== null) {
      _suppressUpdate = true
      _setContent(_pendingContent)
      _suppressUpdate = false
      _pendingContent = null
      markAsSaved()
    }
  }

  function scheduleAutoSave() {
    if (!autoSaveEnabled.value) return
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
    _autoSaveTimer = setTimeout(() => {
      _autoSaveTimer = null
      performAutoSave()
    }, AUTO_SAVE_DELAY)
  }

  async function performAutoSave() {
    if (windowMode.value === 'library') {
      if (!libraryDocId.value) return
      const raw = _getJSON?.()
      if (!raw) return
      const json = JSON.parse(JSON.stringify(raw))
      await window.electron.librarySaveDoc({ docId: libraryDocId.value, json })
      const savePath = await window.electron.librarySave()
      if (savePath) {
        filePath.value = savePath
        markAsSaved()
        dirtyDocIds.clear()
      }
      return
    }

    if (!filePath.value) return
    const ext = filePath.value ? getExtension(filePath.value) : ''
    if (ext === '.zq' || isZqFormat.value) {
      const raw = _getJSON?.()
      if (!raw) return
      const json = JSON.parse(JSON.stringify(raw))
      const title = fileName.value?.replace(/\.[^.]+$/, '') || 'untitled'
      const meta = zqMeta.value ? JSON.parse(JSON.stringify(zqMeta.value)) : undefined
      const result = await window.electron.saveZqFile({ filePath: filePath.value, json, title, existingMeta: meta })
      if (result) {
        isZqFormat.value = true
        markAsSaved()
      }
    } else {
      const md = _getMarkdown?.() || ''
      const result = await window.electron.saveFile({ filePath: filePath.value, content: md })
      if (result) markAsSaved()
    }
  }

  function onEditorUpdate(markdown: string) {
    markdownContent.value = markdown
    if (_suppressUpdate) return
    editVersion.value++
    if (windowMode.value === 'library' && libraryDocId.value) {
      dirtyDocIds.add(libraryDocId.value)
    }
    scheduleAutoSave()
  }

  function markAsSaved() {
    savedVersion.value = editVersion.value
  }

  async function confirmUnsaved(): Promise<boolean> {
    const hasUnsaved = windowMode.value === 'library'
      ? isModified.value || dirtyDocIds.size > 0
      : isModified.value
    if (!hasUnsaved) return true

    const result = _unsavedDialog
      ? await _unsavedDialog()
      : 'cancel'
    if (result === 'save') {
      await saveFile()
      return true
    }
    if (result === 'discard') {
      return true
    }
    return false
  }

  // ─── Library mode: switch doc within the library ───

  function setWindowMode(mode: 'document' | 'library') {
    windowMode.value = mode
  }

  async function switchLibraryDoc(docId: string): Promise<boolean> {
    if (windowMode.value !== 'library') return false

    if (libraryDocId.value && _getJSON) {
      const raw = _getJSON()
      if (raw) {
        const json = JSON.parse(JSON.stringify(raw))
        await window.electron.librarySaveDoc({ docId: libraryDocId.value, json })
      }
    }

    const result = await window.electron.libraryOpenDoc(docId)
    if (!result) return false

    libraryDocId.value = docId
    fileName.value = result.name
    _suppressUpdate = true
    if (_setContentJSON) {
      _setContentJSON(result.json)
    } else {
      _pendingJSON = result.json
    }
    _suppressUpdate = false
    markAsSaved()
    if (dirtyDocIds.has(docId)) {
      editVersion.value++
    }
    return true
  }

  async function saveLibraryDoc() {
    if (!libraryDocId.value) return
    const raw = _getJSON?.()
    if (!raw) return
    const json = JSON.parse(JSON.stringify(raw))
    await window.electron.librarySaveDoc({ docId: libraryDocId.value, json })
    const savePath = await window.electron.librarySave()
    if (savePath) {
      filePath.value = savePath
      markAsSaved()
      dirtyDocIds.clear()
    }
  }

  // ─── Document mode operations ───

  async function openFile(): Promise<'library-in-place' | 'opened' | null> {
    if (!(await confirmUnsaved())) return null

    const result = await window.electron.openFile()
    if (!result) return null

    if ((result as any).opened === 'library-in-place') return 'library-in-place'
    if ((result as any).opened === 'library-window') return null

    if (!result.filePath) return null

    filePath.value = result.filePath
    fileName.value = fileNameFromPath(result.filePath)

    _suppressUpdate = true
    if (result.isZq && result.json) {
      isZqFormat.value = true
      zqMeta.value = result.meta || null
      if (_setContentJSON) {
        _setContentJSON(result.json)
      } else {
        _pendingJSON = result.json
      }
    } else {
      isZqFormat.value = false
      zqMeta.value = null
      const md = result.content ?? ''
      markdownContent.value = md
      if (_setContent) {
        _setContent(md)
      } else {
        _pendingContent = md
      }
    }
    _suppressUpdate = false
    markAsSaved()
    return 'opened'
  }

  async function doSaveMd(path: string | null) {
    const md = _getMarkdown?.() || ''
    const result = await window.electron.saveFile({
      filePath: path,
      content: md
    })
    if (result) {
      filePath.value = result
      isZqFormat.value = getExtension(result) === '.zq'
      fileName.value = fileNameFromPath(result)
      markAsSaved()
    }
  }

  async function confirmAndSaveMd(path: string | null) {
    if (_beforeSaveMd) {
      const choice = await _beforeSaveMd()
      if (choice === 'cancel') return
      if (choice === 'zq') {
        await saveAsZq(null)
        return
      }
    }
    await doSaveMd(path)
  }

  async function saveFile() {
    if (windowMode.value === 'library') {
      await saveLibraryDoc()
      return
    }

    const ext = filePath.value ? getExtension(filePath.value) : ''

    if (ext === '.zq' || isZqFormat.value) {
      await saveAsZq(filePath.value)
      return
    }

    if (!filePath.value) {
      await saveAsZq(null)
      return
    }

    await confirmAndSaveMd(filePath.value)
  }

  async function saveAsMd() {
    await confirmAndSaveMd(null)
  }

  function setBeforeSaveMd(fn: () => Promise<'md' | 'zq' | 'cancel'>) {
    _beforeSaveMd = fn
  }

  function setUnsavedDialog(fn: () => Promise<'save' | 'discard' | 'cancel'>) {
    _unsavedDialog = fn
  }

  async function saveAsZq(path: string | null) {
    const raw = _getJSON?.()
    if (!raw) return

    const json = JSON.parse(JSON.stringify(raw))
    const title = fileName.value?.replace(/\.[^.]+$/, '') || 'untitled'
    const meta = zqMeta.value ? JSON.parse(JSON.stringify(zqMeta.value)) : undefined
    const result = await window.electron.saveZqFile({
      filePath: path,
      json,
      title,
      existingMeta: meta
    })
    if (result) {
      filePath.value = result
      isZqFormat.value = true
      fileName.value = fileNameFromPath(result)
      markAsSaved()
    }
  }

  function newFile() {
    window.electron.newDocumentWindow()
  }

  async function newLibrary() {
    window.electron.newLibraryWindow()
  }

  function loadFileResult(result: { filePath: string; content: string; json?: any; meta?: any; isZq: boolean }) {
    filePath.value = result.filePath
    fileName.value = fileNameFromPath(result.filePath)

    _suppressUpdate = true
    if (result.isZq && result.json) {
      isZqFormat.value = true
      zqMeta.value = result.meta || null
      if (_setContentJSON) {
        _setContentJSON(result.json)
      } else {
        _pendingJSON = result.json
      }
    } else {
      isZqFormat.value = false
      zqMeta.value = null
      const md = result.content ?? ''
      markdownContent.value = md
      if (_setContent) {
        _setContent(md)
      } else {
        _pendingContent = md
      }
    }
    _suppressUpdate = false
    markAsSaved()
  }

  async function exportAs(format: string) {
    const html = _getHTML?.()
    if (!html) return

    const title = fileName.value?.replace(/\.[^.]+$/, '') || 'untitled'

    ZqMessage.info(t('exportMsg.exporting'))

    try {
      const result = await window.electron.exportFile({ format, html, title })
      if (result) {
        ZqMessage.success(t('exportMsg.success'))
      }
    } catch {
      ZqMessage.error(t('exportMsg.failed'))
    }
  }

  async function saveAndClose() {
    try {
      await saveFile()
    } catch (e) {
      console.error('Save before close failed:', e)
    }
    window.electron.requestClose()
  }

  function handleMenuAction(action: string) {
    switch (action) {
      case 'file:new': newFile(); break
      case 'file:newLibrary': newLibrary(); break
      case 'file:open': openFile(); break
      case 'file:save': saveFile(); break
      case 'file:saveAsMd': saveAsMd(); break
      case 'file:saveAsZq': saveAsZq(null); break
      case 'file:save-and-close': saveAndClose(); break
      case 'export:pdf': exportAs('pdf'); break
      case 'export:html': exportAs('html'); break
      case 'export:word': exportAs('word'); break
      case 'export:image': exportAs('image'); break
    }
  }

  let cleanupMenu: (() => void) | null = null
  let cleanupDirty: (() => void) | null = null
  let cleanupSettings: (() => void) | null = null

  onMounted(async () => {
    cleanupMenu = window.electron.onMenuAction(handleMenuAction)
    cleanupDirty = window.electron.onCheckDirty(() => {
      if (windowMode.value === 'library') {
        return isModified.value || dirtyDocIds.size > 0
      }
      return isModified.value
    })

    try {
      windowMode.value = await window.electron.getWindowMode()
    } catch {
      windowMode.value = 'document'
    }

    try {
      const settings = await window.electron.getSettings()
      autoSaveEnabled.value = settings.autoSave
    } catch { /* use default */ }

    cleanupSettings = window.electron.onSettingsChanged((settings) => {
      autoSaveEnabled.value = settings.autoSave
    })
  })

  onUnmounted(() => {
    cleanupMenu?.()
    cleanupDirty?.()
    cleanupSettings?.()
    if (_autoSaveTimer) {
      clearTimeout(_autoSaveTimer)
      _autoSaveTimer = null
    }
  })

  return {
    markdownContent,
    filePath,
    fileName,
    isModified,
    isZqFormat,
    zqMeta,
    stats,
    windowMode,
    libraryDocId,
    autoSaveEnabled,
    registerEditorApi,
    onEditorUpdate,
    openFile,
    saveFile,
    saveAsMd,
    saveAsZq,
    setBeforeSaveMd,
    setUnsavedDialog,
    newFile,
    newLibrary,
    switchLibraryDoc,
    saveLibraryDoc,
    loadFileResult,
    setWindowMode
  }
}
