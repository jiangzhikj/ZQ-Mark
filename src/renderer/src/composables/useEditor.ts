import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ZqMessage } from '@/components/ui'
import i18n from '@/i18n'
import type { PdfExportSettings } from '../../shared/pdf-export'
import {
  normalizeMdAssetSettings,
  buildAssetUrlReplacements,
  applyAssetUrlReplacementsInMarkdown,
} from '../../../shared/markdown-assets'

const markdownContent = ref('')
const filePath = ref<string | null>(null)
const fileName = ref('')
const isZqFormat = ref(false)
const zqMeta = ref<any>(null)
const editVersion = ref(0)
const savedVersion = ref(0)

const LARGE_FILE_LINE_THRESHOLD = 20000
const LOAD_MORE_LINES = 5000

const largeFileTruncated = ref(false)
const largeFileLoadedLines = ref(0)
const largeFileTotalLines = ref(0)
const largeFileLoading = ref(false)
let _fullContent: string | null = null

const windowMode = ref<'document' | 'library' | 'folder'>('document')
const libraryDocId = ref<string | null>(null)
const folderRootPath = ref<string | null>(null)
const dirtyDocIds = new Set<string>()
const autoSaveEnabled = ref(true)
/** 文档格式：'md' 为标准 Markdown，'zq' 为 ZQ 自定义格式 */
const documentFormat = ref<'md' | 'zq'>('md')

let _getMarkdown: (() => string) | null = null
let _getHTML: (() => string) | null = null
let _getJSON: (() => any) | null = null
let _setContent: ((content: string, resetHistory?: boolean) => void) | null = null
let _setContentJSON: ((json: any, resetHistory?: boolean) => void) | null = null

let _pendingContent: string | null = null
let _pendingJSON: any = null
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let _suppressUpdate = false
let _resolveSaveFormat: (() => Promise<'md' | 'zq' | 'cancel'>) | null = null
let _resolvePdfExport: (() => Promise<PdfExportSettings | null>) | null = null

let _unsavedDialog: (() => Promise<'save' | 'discard' | 'cancel'>) | null = null
let _saveInProgress = false
let _sourceModeActive = false
let _getSourceMarkdownIfActive: (() => string | null) | null = null
const AUTO_SAVE_DELAY = 1500

function t(key: string, params?: Record<string, unknown>): string {
  return (i18n.global as any).t(key, params)
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

function truncateByLines(content: string, maxLines: number): { truncated: string; totalLines: number } {
  const lines = content.split('\n')
  const totalLines = lines.length
  if (totalLines <= maxLines) return { truncated: content, totalLines }
  return { truncated: lines.slice(0, maxLines).join('\n'), totalLines }
}

function applyTruncation(content: string): string {
  const { truncated, totalLines } = truncateByLines(content, LARGE_FILE_LINE_THRESHOLD)
  if (totalLines > LARGE_FILE_LINE_THRESHOLD) {
    _fullContent = content
    largeFileTruncated.value = true
    largeFileTotalLines.value = totalLines
    largeFileLoadedLines.value = LARGE_FILE_LINE_THRESHOLD
    return truncated
  }
  resetTruncation()
  return content
}

function resetTruncation() {
  _fullContent = null
  largeFileTruncated.value = false
  largeFileLoadedLines.value = 0
  largeFileTotalLines.value = 0
  largeFileLoading.value = false
}

/** 对 Markdown 中的图片/链接路径做空格编码，避免 markdown-it 在空格处截断 URL */
function encodeUrlSpacesInMarkdown(md: string): string {
  return md.replace(
    /(!?\[[^\]]*\]\()([^)]*)(\))/g,
    (_match, prefix: string, url: string, suffix: string) => {
      return `${prefix}${url.replace(/ /g, '%20')}${suffix}`
    }
  )
}

function appendLargeFileTail(md: string): string {
  if (largeFileTruncated.value && _fullContent) {
    const remainingLines = _fullContent.split('\n').slice(largeFileLoadedLines.value)
    return md + '\n' + remainingLines.join('\n')
  }
  return md
}

async function resolveMdForLoad(md: string, _docPath: string): Promise<string> {
  if (!md) return md
  return encodeUrlSpacesInMarkdown(md)
}

async function prepareMdForSave(docPath: string): Promise<string> {
  const settings = await window.electron.getSettings()
  const assetSettings = normalizeMdAssetSettings(settings)

  if (assetSettings.mdAssetMode === 'absolute') {
    let md = _getMarkdown?.() || ''
    md = md.replace(/local-asset:\/\//g, 'file://')
    return appendLargeFileTail(md)
  }

  let md = _getMarkdown?.() || ''
  const raw = _getJSON?.()

  if (raw) {
    const originalJson = JSON.parse(JSON.stringify(raw))
    const { json: materialized } = await window.electron.materializeMdAssets({
      json: raw,
      docPath,
      settings: assetSettings,
    })
    const replacements = buildAssetUrlReplacements(originalJson, materialized)
    md = applyAssetUrlReplacementsInMarkdown(md, replacements)
  }

  if (md.includes('local-asset:') && window.electron.materializeMdContent) {
    md = await window.electron.materializeMdContent({
      md,
      docPath,
      settings: assetSettings,
    })
  }

  return appendLargeFileTail(md)
}

function isMdDocumentPath(path: string | null): boolean {
  if (!path || isZqFormat.value || documentFormat.value === 'zq') return false
  return getExtension(path) !== '.zq'
}

/** 源码模式展示：与落盘 .md 一致（相对路径），不暴露 local-asset */
async function getMarkdownForSourceView(): Promise<string> {
  const path = filePath.value
  if (!path || !isMdDocumentPath(path)) {
    return _getMarkdown?.() || ''
  }
  return prepareMdForSave(path)
}

/** 从源码模式写回编辑器：保持相对路径，由节点视图在渲染时解析 */
async function applyMarkdownFromSource(md: string): Promise<void> {
  _suppressUpdate = true
  if (_setContent) {
    _setContent(md, false)
  }
  _suppressUpdate = false
  markdownContent.value = md
}

function setSourceModeActive(active: boolean): void {
  _sourceModeActive = active
}

function registerSourceMarkdownProvider(fn: () => string | null): void {
  _getSourceMarkdownIfActive = fn
}

async function getMdContentForSave(docPath: string): Promise<string> {
  if (_sourceModeActive && _getSourceMarkdownIfActive) {
    const src = _getSourceMarkdownIfActive()
    if (src !== null) return appendLargeFileTail(src)
  }
  return prepareMdForSave(docPath)
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
    setContent: (content: string, resetHistory?: boolean) => void
    setContentJSON: (json: any, resetHistory?: boolean) => void
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
    if (!autoSaveEnabled.value || _sourceModeActive) return
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
    _autoSaveTimer = setTimeout(() => {
      _autoSaveTimer = null
      performAutoSave()
    }, AUTO_SAVE_DELAY)
  }

  async function performAutoSave() {
    if (_saveInProgress) return
    _saveInProgress = true
    try {
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

      if (windowMode.value === 'folder') {
        await flushFolderFile()
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
        if (!filePath.value) return
        const md = await getMdContentForSave(filePath.value)
        const result = await window.electron.saveFile({ filePath: filePath.value, content: md })
        if (result) markAsSaved()
      }
    } finally {
      _saveInProgress = false
    }
  }

  function onEditorUpdate(markdown: string) {
    markdownContent.value = markdown
    if (_suppressUpdate) return
    editVersion.value++
    if (windowMode.value === 'library' && libraryDocId.value) {
      dirtyDocIds.add(libraryDocId.value)
    }
    if (windowMode.value === 'folder' && filePath.value) {
      dirtyDocIds.add(filePath.value)
    }
    scheduleAutoSave()
  }

  function markAsSaved() {
    savedVersion.value = editVersion.value
  }

  function clearEditor() {
    filePath.value = null
    fileName.value = ''
    isZqFormat.value = false
    zqMeta.value = null
    markdownContent.value = ''
    resetTruncation()
    _suppressUpdate = true
    if (_setContent) {
      _setContent('')
    } else {
      _pendingContent = ''
      _pendingJSON = null
    }
    _suppressUpdate = false
    markAsSaved()
    dirtyDocIds.clear()
  }

  async function confirmUnsaved(): Promise<boolean> {
    const hasUnsaved = windowMode.value === 'library' || windowMode.value === 'folder'
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

  function setWindowMode(mode: 'document' | 'library' | 'folder') {
    windowMode.value = mode
  }

  async function flushFolderFile(): Promise<boolean> {
    if (windowMode.value !== 'folder' || !filePath.value) return false

    const ext = getExtension(filePath.value)
    if (ext === '.zq' || isZqFormat.value) {
      const raw = _getJSON?.()
      if (!raw) return false
      const json = JSON.parse(JSON.stringify(raw))
      const title = fileName.value?.replace(/\.[^.]+$/, '') || 'untitled'
      const meta = zqMeta.value ? JSON.parse(JSON.stringify(zqMeta.value)) : undefined
      const ok = await window.electron.folderWriteFile({
        filePath: filePath.value,
        json,
        title,
        meta,
      })
      if (ok) {
        markAsSaved()
        dirtyDocIds.delete(filePath.value)
      }
      return ok
    }

    let md = await getMdContentForSave(filePath.value)
    const ok = await window.electron.folderWriteFile({
      filePath: filePath.value,
      content: md,
    })
    if (ok) {
      markAsSaved()
      dirtyDocIds.delete(filePath.value)
    }
    return ok
  }

  async function switchFolderFile(
    targetPath: string,
    options?: { skipFlush?: boolean },
  ): Promise<boolean> {
    if (windowMode.value !== 'folder') return false

    if (!options?.skipFlush && filePath.value && isModified.value) {
      await flushFolderFile()
    }

    const result = await window.electron.folderReadFile(targetPath)
    if (!result) return false

    filePath.value = targetPath
    fileName.value = result.name
    documentFormat.value = result.isZq ? 'zq' : 'md'

    _suppressUpdate = true
    if (result.isZq && result.json) {
      isZqFormat.value = true
      zqMeta.value = result.meta || null
      resetTruncation()
      if (_setContentJSON) {
        _setContentJSON(result.json)
      } else {
        _pendingJSON = result.json
      }
    } else {
      isZqFormat.value = false
      zqMeta.value = null
      const fullMd = result.content ?? ''
      const resolved = await resolveMdForLoad(fullMd, targetPath)
      const md = applyTruncation(resolved)
      markdownContent.value = md
      if (_setContent) {
        _setContent(md)
      } else {
        _pendingContent = md
      }
    }
    _suppressUpdate = false
    markAsSaved()
    if (dirtyDocIds.has(targetPath)) {
      editVersion.value++
    }
    return true
  }

  async function saveFolderFile() {
    const ok = await flushFolderFile()
    if (ok) {
      ZqMessage.success(t('saveMsg.success'))
    }
  }

  async function switchLibraryDoc(
    docId: string,
    options?: { skipSave?: boolean },
  ): Promise<boolean> {
    if (windowMode.value !== 'library') return false

    if (!options?.skipSave && libraryDocId.value && _getJSON) {
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
      ZqMessage.success(t('saveMsg.success'))
    }
  }

  // ─── Document mode operations ───

  async function openFile(): Promise<'library-in-place' | 'folder-in-place' | 'opened' | null> {
    if (!(await confirmUnsaved())) return null

    const result = await window.electron.openFile()
    if (!result) return null

    if (result.opened === 'library-in-place') return 'library-in-place'
    if (result.opened === 'library-window') return null
    if (result.opened === 'folder-in-place') {
      folderRootPath.value = result.filePath ?? null
      windowMode.value = 'folder'
      clearEditor()
      return 'folder-in-place'
    }
    if (result.opened === 'folder-window') return null

    if (!result.filePath) return null

    windowMode.value = 'document'
    folderRootPath.value = null

    filePath.value = result.filePath
    fileName.value = fileNameFromPath(result.filePath)
    documentFormat.value = result.isZq ? 'zq' : 'md'

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
      const fullMd = result.content ?? ''
      const resolved = await resolveMdForLoad(fullMd, result.filePath)
      const md = applyTruncation(resolved)
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
    let savePath = path
    if (!savePath) {
      savePath = await window.electron.pickMdSavePath(null)
      if (!savePath) return
    }

    const md = await getMdContentForSave(savePath)
    const result = await window.electron.saveFile({
      filePath: savePath,
      content: md,
    })
    if (result) {
      filePath.value = result
      isZqFormat.value = getExtension(result) === '.zq'
      fileName.value = fileNameFromPath(result)
      markAsSaved()
      ZqMessage.success(t('saveMsg.success'))
    }
  }

  async function saveFile() {
    if (windowMode.value === 'library') {
      await saveLibraryDoc()
      return
    }

    if (windowMode.value === 'folder') {
      await saveFolderFile()
      return
    }

    const ext = filePath.value ? getExtension(filePath.value) : ''

    if (ext === '.zq' || isZqFormat.value) {
      await saveAsZq(filePath.value)
      return
    }

    if (documentFormat.value === 'zq') {
      await saveAsZq(filePath.value)
    } else {
      await doSaveMd(filePath.value)
    }
  }

  async function saveAsMd() {
    await doSaveMd(null)
  }

  function setSaveFormatResolver(fn: () => Promise<'md' | 'zq' | 'cancel'>) {
    _resolveSaveFormat = fn
  }

  function setPdfExportResolver(fn: () => Promise<PdfExportSettings | null>) {
    _resolvePdfExport = fn
  }

  function setUnsavedDialog(fn: () => Promise<'save' | 'discard' | 'cancel'>) {
    _unsavedDialog = fn
  }

  function setDocumentFormat(format: 'md' | 'zq') {
    documentFormat.value = format
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
      ZqMessage.success(t('saveMsg.success'))
    }
  }

  function newFile() {
    window.electron.newDocumentWindow()
  }

  async function newLibrary() {
    window.electron.newLibraryWindow()
  }

  async function loadFileResult(result: { filePath: string; content: string; json?: any; meta?: any; isZq: boolean }) {
    windowMode.value = 'document'
    folderRootPath.value = null
    filePath.value = result.filePath
    fileName.value = fileNameFromPath(result.filePath)
    documentFormat.value = result.isZq ? 'zq' : 'md'

    _suppressUpdate = true
    if (result.isZq && result.json) {
      isZqFormat.value = true
      zqMeta.value = result.meta || null
      resetTruncation()
      if (_setContentJSON) {
        _setContentJSON(result.json)
      } else {
        _pendingJSON = result.json
      }
    } else {
      isZqFormat.value = false
      zqMeta.value = null
      resetTruncation()
      const fullMd = result.content ?? ''
      const resolved = await resolveMdForLoad(fullMd, result.filePath)
      const md = applyTruncation(resolved)
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

    let pdfSettings: PdfExportSettings | undefined
    if (format === 'pdf') {
      if (!_resolvePdfExport) return
      const resolved = await _resolvePdfExport()
      if (!resolved) return
      pdfSettings = resolved
    }

    ZqMessage.info(t('exportMsg.exporting'))

    try {
      const result = await window.electron.exportFile({
        format,
        html,
        title,
        pdfSettings,
      })
      if (result) {
        ZqMessage.success(t('exportMsg.success'), {
          action: {
            label: t('exportMsg.openFolder'),
            onClick: () => {
              void window.electron.showInFolder(result)
            },
          },
        })
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
      if (windowMode.value === 'library' || windowMode.value === 'folder') {
        return isModified.value || dirtyDocIds.size > 0
      }
      return isModified.value
    })

    try {
      windowMode.value = await window.electron.getWindowMode()
      if (windowMode.value === 'folder') {
        folderRootPath.value = await window.electron.folderGetRoot()
      }
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

  async function loadMoreLines() {
    if (!_fullContent || !largeFileTruncated.value || largeFileLoading.value) return
    largeFileLoading.value = true
    ZqMessage.info(t('largeFile.loading'))
    await new Promise(r => setTimeout(r, 50))
    const newTarget = largeFileLoadedLines.value + LOAD_MORE_LINES
    await _loadUpToLine(newTarget)
    largeFileLoading.value = false
    ZqMessage.success(t('largeFile.loadSuccess', { loaded: largeFileLoadedLines.value }))
  }

  async function loadAllLines() {
    if (!_fullContent || !largeFileTruncated.value || largeFileLoading.value) return
    largeFileLoading.value = true
    ZqMessage.info(t('largeFile.loading'))
    await new Promise(r => setTimeout(r, 50))
    await _loadUpToLine(largeFileTotalLines.value)
    largeFileLoading.value = false
    ZqMessage.success(t('largeFile.loadSuccess', { loaded: largeFileLoadedLines.value || largeFileTotalLines.value }))
  }

  async function _loadUpToLine(targetLines: number) {
    if (!_fullContent) return
    const lines = _fullContent.split('\n')
    const total = lines.length
    const loadTo = Math.min(targetLines, total)
    const content = lines.slice(0, loadTo).join('\n')

    _suppressUpdate = true
    if (_setContent) {
      _setContent(content, false)
    }
    _suppressUpdate = false
    markdownContent.value = content
    largeFileLoadedLines.value = loadTo

    if (loadTo >= total) {
      resetTruncation()
    }
  }

  async function prepareWorkspaceDocSwitch(): Promise<void> {
    if (windowMode.value === 'folder') {
      if (filePath.value && isModified.value) {
        await flushFolderFile()
      }
      return
    }
    if (windowMode.value === 'library' && libraryDocId.value && _getJSON) {
      const raw = _getJSON()
      if (raw) {
        const json = JSON.parse(JSON.stringify(raw))
        await window.electron.librarySaveDoc({ docId: libraryDocId.value, json })
      }
    }
  }

  return {
    markdownContent,
    filePath,
    fileName,
    isModified,
    isZqFormat,
    documentFormat,
    zqMeta,
    stats,
    windowMode,
    libraryDocId,
    folderRootPath,
    autoSaveEnabled,
    largeFileTruncated,
    largeFileLoadedLines,
    largeFileTotalLines,
    largeFileLoading,
    registerEditorApi,
    onEditorUpdate,
    openFile,
    saveFile,
    saveAsMd,
    saveAsZq,
    setDocumentFormat,
    setSaveFormatResolver,
    setPdfExportResolver,
    setUnsavedDialog,
    newFile,
    newLibrary,
    switchLibraryDoc,
    switchFolderFile,
    saveLibraryDoc,
    saveFolderFile,
    loadFileResult,
    setWindowMode,
    clearEditor,
    loadMoreLines,
    loadAllLines,
    prepareWorkspaceDocSwitch,
    getMarkdownForSourceView,
    applyMarkdownFromSource,
    setSourceModeActive,
    registerSourceMarkdownProvider,
  }
}
