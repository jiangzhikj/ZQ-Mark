<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  type ComponentPublicInstance
} from 'vue'
import { useI18n } from 'vue-i18n'
import type { Editor } from '@tiptap/vue-3'
import TitleBar from '@/components/TitleBar.vue'
import Sidebar from '@/components/Sidebar.vue'
import StatusBar from '@/components/StatusBar.vue'
import Settings from '@/components/Settings.vue'
import WelcomeScreen from '@/components/WelcomeScreen.vue'
import DrawioStandaloneView from '@/components/zq-editor/extensions/drawio/DrawioStandaloneView.vue'
import ExcalidrawStandaloneView from '@/components/zq-editor/extensions/excalidraw/ExcalidrawStandaloneView.vue'
import {
  DRAWIO_UI_LAYOUT_INJECT_KEY,
  type DrawioUiLayout
} from '@/components/zq-editor/extensions/drawio/drawio-embed'
import { InputDialog, ConfirmDialog, ZqScrollbar } from '@/components/ui'
import type { InputDialogField, InputDialogResult } from '@/components/ui'
import AboutDialog from '@/components/AboutDialog.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import SaveFormatDialog from '@/components/SaveFormatDialog.vue'
import WebAppMenu from '@/components/WebAppMenu.vue'
import { ZqEditor } from '@/components/zq-editor'
import { useTheme } from '@/composables/useTheme'
import { useEditor } from '@/composables/useEditor'
import { useLibrary } from '@/composables/useLibrary'
import type { LibraryNode } from '../../shared/types'
import { FileText } from '@/components/icons'
import {
  ensureWebSessionInUrl,
  loadWebPageState,
  saveWebPageState,
  setWebStoredWindowMode,
  setWebUrlView,
  type WebPageStateV1
} from '@/platform/web-session'
import { setSlashDrawioAvailable } from '@/components/zq-editor/extensions/slash-command/slash-drawio-state'
import { setSlashExcalidrawAvailable } from '@/components/zq-editor/extensions/slash-command/slash-excalidraw-state'
import { restoreWebLibraryFromSnapshot, serializeWebLibrarySnapshot } from '@/platform/web-electron'

const { themeMode, setThemeMode } = useTheme()
const { t, locale } = useI18n()

const {
  fileName,
  filePath,
  isModified,
  isZqFormat,
  zqMeta,
  stats,
  windowMode,
  autoSaveEnabled,
  largeFileTruncated,
  largeFileLoadedLines,
  largeFileTotalLines,
  largeFileLoading,
  registerEditorApi,
  onEditorUpdate,
  switchLibraryDoc,
  openFile,
  newLibrary,
  loadFileResult,
  setWindowMode,
  setSaveFormatResolver,
  setUnsavedDialog,
  loadMoreLines,
  loadAllLines
} = useEditor()

const {
  tree,
  activeDocId,
  activeDocName,
  libraryName,
  expandedFolders,
  isLibraryMode,
  initLibrary,
  refreshTree,
  refreshLibraryName,
  openDoc,
  createDoc,
  createFolder,
  renameItem,
  deleteItem,
  moveItem,
  toggleFolder,
  setActiveDocId
} = useLibrary()

const sidebarVisible = ref(true)
const settingsVisible = ref(false)
const aboutDialogVisible = ref(false)
const updateDialogVisible = ref(false)
const updateUrl = ref('')
const telemetryEnabled = ref(true)
const codeTheme = ref('intellij')
const drawioUiLayout = ref<DrawioUiLayout>('full')
provide(DRAWIO_UI_LAYOUT_INJECT_KEY, drawioUiLayout)
/** 是否已在插件中心安装流程图（diagrams.net）资源 */
const drawioBundleReady = ref(false)
const editorRef = ref<InstanceType<typeof ZqEditor>>()
const localeMode = ref<'system' | string>('system')
const tiptapEditor = ref<Editor>()
const editorScrollbarRef = ref<ComponentPublicInstance | null>(null)
const editorAreaRef = computed(() => {
  const el = editorScrollbarRef.value?.$el
  return el instanceof HTMLElement ? el : undefined
})
const urlSearchParams = new URLSearchParams(window.location.search)
const isNewDocWindow = urlSearchParams.get('newDoc') === '1'
/** 独立 draw.io 子窗口（仅 Electron） */
const drawioStandaloneMode = urlSearchParams.get('drawioStandalone') === '1'
/** 独立 Excalidraw 子窗口（仅 Electron） */
const excalidrawStandaloneMode = urlSearchParams.get('excalidrawStandalone') === '1'
/** 主进程在创建独立窗口时附带 appLocale，与主窗口语言一致（先于首帧渲染） */
if (drawioStandaloneMode || excalidrawStandaloneMode) {
  const al = urlSearchParams.get('appLocale')
  if (al === 'zh-CN' || al === 'zh-TW' || al === 'en') {
    locale.value = al
  }
}
const hasOpenedFile = ref(isNewDocWindow)
const appPlatform = ref('')
/** 网页版刷新后恢复库内当前打开的文档 */
const pendingWebLibraryDocId = ref<string | null>(null)
const skipWebPersist = ref(true)
let webPersistTimer: ReturnType<typeof setTimeout> | null = null
let cleanupBeforeUnload: (() => void) | null = null

function findNodeNameById(nodes: LibraryNode[], id: string): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.name
    if (n.children) {
      const r = findNodeNameById(n.children, id)
      if (r) return r
    }
  }
  return null
}

function buildWebPageSnapshot(): WebPageStateV1 {
  if (showWelcome.value) {
    return { v: 1, view: 'welcome' }
  }
  if (isLibraryMode.value) {
    const lib = serializeWebLibrarySnapshot()
    return {
      v: 1,
      view: 'library',
      library: lib,
      activeLibraryDocId: activeDocId.value
    }
  }
  const ed = editorRef.value as { getJSON?: () => unknown; getMarkdown?: () => string } | undefined
  const docJson = ed?.getJSON?.() ?? null
  const md = ed?.getMarkdown?.() ?? ''
  return {
    v: 1,
    view: 'document',
    filePath: filePath.value,
    fileName: fileName.value,
    isZq: isZqFormat.value,
    zqMeta: zqMeta.value,
    docJson: isZqFormat.value ? docJson : undefined,
    markdown: isZqFormat.value ? undefined : md
  }
}

function flushWebPersist() {
  if (appPlatform.value !== 'web' || skipWebPersist.value) return
  const snap = buildWebPageSnapshot()
  saveWebPageState(snap)
  setWebUrlView(snap.view)
}

function schedulePersistWebState() {
  if (appPlatform.value !== 'web' || skipWebPersist.value) return
  if (webPersistTimer) clearTimeout(webPersistTimer)
  webPersistTimer = setTimeout(() => {
    webPersistTimer = null
    flushWebPersist()
  }, 500)
}

const sourceMode = ref(false)
const sourceContent = ref('')
const sourceTextareaRef = ref<HTMLTextAreaElement>()
let suppressSourceSync = false

const saveFormatDialogVisible = ref(false)
let saveFormatResolve: ((choice: 'md' | 'zq' | 'cancel') => void) | null = null
const saveFormatAskDialog = ref(true)
const saveFormatDefault = ref<'md' | 'zq'>('md')

const unsavedDialogVisible = ref(false)
let unsavedResolve: ((choice: 'save' | 'discard' | 'cancel') => void) | null = null

function showUnsavedDialogPromise(): Promise<'save' | 'discard' | 'cancel'> {
  return new Promise((resolve) => {
    unsavedResolve = resolve
    unsavedDialogVisible.value = true
  })
}

setUnsavedDialog(() => showUnsavedDialogPromise())

setSaveFormatResolver(async () => {
  const settings = await window.electron.getSettings()
  const ask = settings.saveFormatAskDialog !== false
  const def = settings.saveFormatDefault === 'zq' ? 'zq' : 'md'
  if (!ask) {
    return def
  }
  return new Promise<'md' | 'zq' | 'cancel'>((resolve) => {
    saveFormatResolve = resolve
    saveFormatDialogVisible.value = true
  })
})

function onSaveFormatCancel() {
  saveFormatDialogVisible.value = false
  saveFormatResolve?.('cancel')
  saveFormatResolve = null
}

async function onSaveFormatPick(payload: { format: 'md' | 'zq'; remember: boolean }) {
  saveFormatDialogVisible.value = false
  if (payload.remember) {
    await window.electron.setSettings({
      saveFormatAskDialog: false,
      saveFormatDefault: payload.format
    })
  }
  saveFormatResolve?.(payload.format)
  saveFormatResolve = null
}

function onUnsavedSave() {
  unsavedDialogVisible.value = false
  unsavedResolve?.('save')
  unsavedResolve = null
}

function onUnsavedDiscard() {
  unsavedDialogVisible.value = false
  unsavedResolve?.('discard')
  unsavedResolve = null
}

function onUnsavedCancel() {
  unsavedDialogVisible.value = false
  unsavedResolve?.('cancel')
  unsavedResolve = null
}

const inputDialogVisible = ref(false)
const inputDialogTitle = ref('')
const inputDialogFields = ref<InputDialogField[]>([])
const inputDialogResolve = ref<((result: InputDialogResult | null) => void) | null>(null)

function showInputDialog(title: string, fields: InputDialogField[]): Promise<InputDialogResult | null> {
  return new Promise((resolve) => {
    inputDialogTitle.value = title
    inputDialogFields.value = fields
    inputDialogResolve.value = resolve
    inputDialogVisible.value = true
  })
}

function onInputDialogConfirm(result: InputDialogResult) {
  inputDialogVisible.value = false
  inputDialogResolve.value?.(result)
  inputDialogResolve.value = null
}

function onInputDialogCancel() {
  inputDialogVisible.value = false
  inputDialogResolve.value?.(null)
  inputDialogResolve.value = null
}

const showWelcome = computed(() => {
  if (isLibraryMode.value) return false
  return !hasOpenedFile.value && !fileName.value
})

const displayFileName = computed(() => {
  if (isLibraryMode.value) return activeDocName.value || ''
  return fileName.value
})

const showLibraryEmptyState = computed(() => {
  return isLibraryMode.value && !activeDocId.value
})

watch(fileName, (val) => {
  if (val) hasOpenedFile.value = true
  if (appPlatform.value === 'web') schedulePersistWebState()
})

watch(
  () => [isLibraryMode.value, activeDocId.value, libraryName.value],
  () => {
    if (appPlatform.value === 'web') schedulePersistWebState()
  }
)

watch(
  tree,
  () => {
    if (appPlatform.value === 'web') schedulePersistWebState()
  },
  { deep: true }
)

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
}

const sourceModeConfirmVisible = ref(false)

function toggleSourceMode() {
  if (sourceMode.value) {
    // Switching back to rich text: show editor first, then set content
    const md = sourceContent.value
    sourceMode.value = false
    nextTick(() => {
      if (tiptapEditor.value) {
        suppressSourceSync = true
        tiptapEditor.value.commands.setContent(md)
        suppressSourceSync = false
      }
    })
  } else {
    // Show confirmation dialog before switching to source mode
    sourceModeConfirmVisible.value = true
  }
}

function onConfirmSourceMode() {
  sourceModeConfirmVisible.value = false
  if (editorRef.value) {
    sourceContent.value = (editorRef.value as any).getMarkdown?.() || ''
  }
  sourceMode.value = true
  nextTick(() => {
    sourceTextareaRef.value?.focus()
  })
}

function onCancelSourceMode() {
  sourceModeConfirmVisible.value = false
}

function onSourceInput() {
  onEditorUpdate(sourceContent.value)
}

function openSettings() {
  settingsVisible.value = true
}

function triggerCheckUpdate() {
  updateDialogVisible.value = true
  if (updateUrl.value) {
    window.electron.updateCheck(updateUrl.value)
  }
}

async function onChangeLocale(newLocale: string) {
  localeMode.value = newLocale
  if (newLocale === 'system') {
    const sys = await window.electron.getSystemLocale()
    locale.value = sys
    await window.electron.changeLocale(sys)
    await window.electron.setSettings({ uiLocale: 'system' })
  } else {
    locale.value = newLocale
    await window.electron.changeLocale(newLocale)
    await window.electron.setSettings({ uiLocale: newLocale as any })
  }
}

async function onChangeTheme(mode: string) {
  const m = mode as 'system' | 'light' | 'dark'
  setThemeMode(m)
  await window.electron.setSettings({ uiThemeMode: m })
}

async function onChangeAutoSave(enabled: boolean) {
  await window.electron.setSettings({ autoSave: enabled })
}

async function onChangeTelemetry(enabled: boolean) {
  await window.electron.setSettings({ telemetryEnabled: enabled })
}

async function onChangeCodeTheme(theme: string) {
  codeTheme.value = theme
  document.documentElement.setAttribute('data-code-theme', theme)
  await window.electron.setSettings({ codeTheme: theme })
}

async function onChangeSaveFormatAsk(enabled: boolean) {
  saveFormatAskDialog.value = enabled
  await window.electron.setSettings({ saveFormatAskDialog: enabled })
}

async function onChangeSaveFormatDefault(format: 'md' | 'zq') {
  saveFormatDefault.value = format
  await window.electron.setSettings({ saveFormatDefault: format })
}

async function onChangeDrawioUiLayout(layout: DrawioUiLayout) {
  drawioUiLayout.value = layout
  await window.electron.setSettings({ drawioUiLayout: layout })
}

function onEditorReady(editor: any) {
  tiptapEditor.value = editor as Editor
  registerEditorApi({
    getMarkdown: () => editor.storage?.markdown?.getMarkdown() || '',
    getHTML: () => editor.getHTML?.() || '',
    getJSON: () => editor.getJSON?.() || {},
    setContent: (content: string) => editor.commands.setContent(content),
    setContentJSON: (json: any) => editor.commands.setContent(json)
  })

  if (pendingWebLibraryDocId.value) {
    const id = pendingWebLibraryDocId.value
    pendingWebLibraryDocId.value = null
    void nextTick(async () => {
      const ok = await switchLibraryDoc(id)
      if (ok) {
        const name = findNodeNameById(tree.value, id)
        setActiveDocId(id, name || undefined)
      } else if (isLibraryMode.value && tree.value.length > 0 && !activeDocId.value) {
        await autoOpenFirstDoc()
      }
    })
    return
  }

  if (isLibraryMode.value && tree.value.length > 0 && !activeDocId.value) {
    autoOpenFirstDoc()
  }
}

function onEditorChange() {
  if (suppressSourceSync) return
  if (editorRef.value) {
    const md = (editorRef.value as any).getMarkdown?.() || ''
    onEditorUpdate(md)
  }
  if (appPlatform.value === 'web') {
    schedulePersistWebState()
  }
}

async function autoOpenFirstDoc() {
  const firstFile = findFirstFile(tree.value)
  if (firstFile) {
    const ok = await switchLibraryDoc(firstFile.id)
    if (ok) setActiveDocId(firstFile.id, firstFile.name)
  }
}

function findFirstFile(nodes: LibraryNode[]): LibraryNode | null {
  for (const node of nodes) {
    if (node.type === 'file') return node
    if (node.children) {
      const found = findFirstFile(node.children)
      if (found) return found
    }
  }
  return null
}

async function onSelectDoc(node: LibraryNode) {
  if (node.type !== 'file') return
  const ok = await switchLibraryDoc(node.id)
  if (ok) setActiveDocId(node.id, node.name)
}

async function onCreateDoc(parentId: string | null) {
  const result = await showInputDialog(t('library.createDocTitle'), [
    {
      key: 'name',
      label: t('library.docNameLabel'),
      placeholder: t('library.docNamePlaceholder'),
      defaultValue: ''
    }
  ])
  if (!result) return
  const name = result.name.trim() || t('library.untitledDoc')
  const node = await createDoc(parentId, name)
  if (node) {
    const ok = await switchLibraryDoc(node.id)
    if (ok) setActiveDocId(node.id, node.name)
  }
}

async function onCreateFolder(parentId: string | null) {
  const result = await showInputDialog(t('library.createFolderTitle'), [
    {
      key: 'name',
      label: t('library.folderNameLabel'),
      placeholder: t('library.folderNamePlaceholder'),
      defaultValue: ''
    }
  ])
  if (!result) return
  const name = result.name.trim() || t('library.untitledFolder')
  await createFolder(parentId, name)
}

async function onRenameItem(id: string, oldName: string) {
  const isFolder = findNodeType(tree.value, id) === 'folder'
  const result = await showInputDialog(
    t('library.rename'),
    [{
      key: 'name',
      label: isFolder ? t('library.folderNameLabel') : t('library.docNameLabel'),
      placeholder: isFolder ? t('library.folderNamePlaceholder') : t('library.docNamePlaceholder'),
      defaultValue: oldName
    }]
  )
  if (!result) return
  const name = result.name.trim()
  if (!name || name === oldName) return
  await renameItem(id, name)
}

function findNodeType(nodes: LibraryNode[], id: string): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.type
    if (n.children) {
      const found = findNodeType(n.children, id)
      if (found) return found
    }
  }
  return null
}

async function onDeleteItem(id: string) {
  await deleteItem(id)
}

async function onMoveItem(id: string, newParentId: string | null, index: number) {
  await moveItem(id, newParentId, index)
}

async function onWelcomeOpenFile() {
  const result = await openFile()
  if (result === 'library-in-place') {
    isLibraryMode.value = true
    setWindowMode('library')
    if (appPlatform.value === 'web') setWebStoredWindowMode('library')
    await refreshTree()
    await refreshLibraryName()
    hasOpenedFile.value = true
    if (tree.value.length > 0) {
      await autoOpenFirstDoc()
    }
    if (appPlatform.value === 'web') schedulePersistWebState()
  } else if (result === 'opened' && appPlatform.value === 'web') {
    setWebStoredWindowMode('document')
    schedulePersistWebState()
  }
}

function onWelcomeNewDocument() {
  hasOpenedFile.value = true
}

async function onWelcomeNewLibrary() {
  const isWeb = (await window.electron.getPlatform()) === 'web'
  const result = await showInputDialog(
    t('library.createLibraryTitle'),
    isWeb
      ? [
          {
            key: 'name',
            label: t('library.libraryNameLabel'),
            placeholder: t('library.libraryNamePlaceholder'),
            defaultValue: '',
            required: true
          }
        ]
      : [
          {
            key: 'name',
            label: t('library.libraryNameLabel'),
            placeholder: t('library.libraryNamePlaceholder'),
            defaultValue: '',
            required: true
          },
          {
            key: 'dirPath',
            label: t('library.saveLocationLabel'),
            placeholder: t('library.saveLocationPlaceholder'),
            type: 'directory',
            required: true
          }
        ]
  )
  if (!result) return
  const name = result.name.trim()
  const dirPath = isWeb ? '' : result.dirPath

  const res = await window.electron.createLibrary({ name, dirPath })
  if (res) {
    if (res.opened === 'in-place') {
      isLibraryMode.value = true
      setWindowMode('library')
      if (appPlatform.value === 'web') setWebStoredWindowMode('library')
      await refreshTree()
      await refreshLibraryName()
      hasOpenedFile.value = true
      if (appPlatform.value === 'web') schedulePersistWebState()
    }
  }
}

async function onWelcomeOpenRecent(fp: string) {
  try {
    const result = await window.electron.openRecentFile(fp)
    if (!result) return

    if (result.opened === 'library-in-place') {
      isLibraryMode.value = true
      setWindowMode('library')
      await refreshTree()
      await refreshLibraryName()
      hasOpenedFile.value = true
      if (tree.value.length > 0) {
        await autoOpenFirstDoc()
      }
      return
    }

    if (result.opened === 'library-window') return

    loadFileResult(result)
    hasOpenedFile.value = true
  } catch (e) {
    console.error('Open recent failed:', e)
  }
}

let cleanupMenuAction: (() => void) | null = null
let cleanupLoadFile: (() => void) | null = null
let cleanupSettingsChanged: (() => void) | null = null
let cleanupUnsavedFromMain: (() => void) | null = null
let cleanupUpdateListener: (() => void) | null = null

function onWebLocaleChanged(e: Event) {
  const d = (e as CustomEvent<string>).detail
  if (typeof d === 'string' && d) locale.value = d
}

let cleanupWebLocale: (() => void) | null = null

async function refreshDrawioBundleStatus() {
  if (appPlatform.value === 'web') {
    drawioBundleReady.value = false
    setSlashDrawioAvailable(false)
    return
  }
  try {
    const s = await window.electron.getDrawioBundleStatus()
    drawioBundleReady.value = s.state === 'ready'
  } catch {
    drawioBundleReady.value = false
  }
  setSlashDrawioAvailable(drawioBundleReady.value)
}

async function refreshExcalidrawBundleStatus() {
  if (appPlatform.value === 'web') {
    setSlashExcalidrawAvailable(false)
    return
  }
  let ready = false
  try {
    const s = await window.electron.getExcalidrawBundleStatus()
    ready = s.state === 'ready'
  } catch {
    ready = false
  }
  setSlashExcalidrawAvailable(ready)
}

let cleanupDrawioBundleReady: (() => void) | null = null
let cleanupExcalidrawBundleReady: (() => void) | null = null

onMounted(async () => {
  const platform = await window.electron.getPlatform()
  document.documentElement.setAttribute('data-platform', platform)
  appPlatform.value = platform

  if ((drawioStandaloneMode || excalidrawStandaloneMode) && platform !== 'web') {
    const settings = await window.electron.getSettings()
    codeTheme.value = settings.codeTheme || 'intellij'
    document.documentElement.setAttribute('data-code-theme', codeTheme.value)
    drawioUiLayout.value =
      settings.drawioUiLayout === 'minimal' ? 'minimal' : 'full'
    return
  }

  if (platform === 'web') {
    const saved = localStorage.getItem('zq-web-user-locale')
    locale.value = saved || (await window.electron.getSystemLocale())
    window.addEventListener('web:locale-changed', onWebLocaleChanged)
    cleanupWebLocale = () => window.removeEventListener('web:locale-changed', onWebLocaleChanged)
  } else {
    const systemLocale = await window.electron.getSystemLocale()
    locale.value = systemLocale
  }

  const params = new URLSearchParams(window.location.search)
  const isNewLibWindow = params.get('mode') === 'library' && params.get('newLib') === '1'

  let webSnap: WebPageStateV1 | null = null
  if (platform === 'web') {
    ensureWebSessionInUrl()
    if (!isNewDocWindow && !isNewLibWindow) {
      webSnap = loadWebPageState()
      if (webSnap?.v === 1 && webSnap.view === 'library' && webSnap.library) {
        restoreWebLibraryFromSnapshot(webSnap.library)
        pendingWebLibraryDocId.value = webSnap.activeLibraryDocId ?? null
      }
    }
  }

  if (isNewLibWindow) {
    await window.electron.initLibraryInPlace()
    history.replaceState({}, '', window.location.pathname + window.location.hash)
  }

  await initLibrary()

  if (platform === 'web' && !isNewDocWindow && !isNewLibWindow && webSnap?.v === 1) {
    if (webSnap.view === 'document') {
      const isZq = webSnap.isZq ?? false
      if (isZq && webSnap.docJson == null) {
        /* 快照不完整则放弃恢复为文档 */
      } else {
        setWebStoredWindowMode('document')
        setWindowMode('document')
        loadFileResult({
          filePath: webSnap.filePath || 'web:untitled',
          content: (webSnap.markdown as string) ?? '',
          json: webSnap.docJson,
          meta: webSnap.zqMeta,
          isZq
        })
        hasOpenedFile.value = true
        setWebUrlView('document')
      }
    } else if (webSnap.view === 'library') {
      hasOpenedFile.value = true
      setWebUrlView('library')
    } else if (webSnap.view === 'welcome') {
      setWebUrlView('welcome')
    }
  }

  // Check if this window was opened with a file from the system (double-click, open-with, etc.)
  const pendingFile = await window.electron.getPendingFile()
  if (pendingFile) {
    loadFileResult(pendingFile)
    hasOpenedFile.value = true
  }

  const settings = await window.electron.getSettings()
  // 恢复用户选择的 UI 语言/主题（关闭重开后不会回退）
  localeMode.value = (settings.uiLocale ?? 'system') as any
  if (settings.uiThemeMode) {
    setThemeMode(settings.uiThemeMode as 'system' | 'light' | 'dark')
  }
  if (localeMode.value === 'system') {
    const sysLocale = await window.electron.getSystemLocale()
    locale.value = sysLocale
    if (platform !== 'web') {
      await window.electron.changeLocale(sysLocale)
    }
  } else {
    locale.value = localeMode.value
    if (platform !== 'web') {
      await window.electron.changeLocale(localeMode.value as any)
    }
  }

  updateUrl.value = settings.updateUrl || ''
  telemetryEnabled.value = settings.telemetryEnabled !== false
  codeTheme.value = settings.codeTheme || 'intellij'
  document.documentElement.setAttribute('data-code-theme', codeTheme.value)
  drawioUiLayout.value =
    settings.drawioUiLayout === 'minimal' ? 'minimal' : 'full'
  saveFormatAskDialog.value = settings.saveFormatAskDialog !== false
  saveFormatDefault.value = settings.saveFormatDefault === 'zq' ? 'zq' : 'md'

  await refreshDrawioBundleStatus()
  await refreshExcalidrawBundleStatus()
  cleanupDrawioBundleReady = window.electron.onDrawioBundleReady(() => {
    void refreshDrawioBundleStatus()
  })
  cleanupExcalidrawBundleReady = window.electron.onExcalidrawBundleReady(() => {
    void refreshExcalidrawBundleStatus()
  })

  cleanupMenuAction = window.electron.onMenuAction((action) => {
    if (action.startsWith('file:openRecent:')) {
      const enc = action.slice('file:openRecent:'.length)
      try {
        const fp = decodeURIComponent(enc)
        void onWelcomeOpenRecent(fp)
      } catch (e) {
        console.error('Open recent from menu failed:', e)
      }
      return
    }
    if (action === 'view:toggleSidebar') {
      toggleSidebar()
    } else if (action === 'view:sourceCode') {
      toggleSourceMode()
    } else if (action === 'app:preferences') {
      openSettings()
    } else if (action === 'help:checkUpdate') {
      triggerCheckUpdate()
    } else if (action === 'help:about') {
      aboutDialogVisible.value = true
    }
  })

  cleanupLoadFile = window.electron.onLoadFile((data) => {
    loadFileResult(data)
    hasOpenedFile.value = true
  })

  cleanupSettingsChanged = window.electron.onSettingsChanged((s) => {
    updateUrl.value = s.updateUrl || ''
    telemetryEnabled.value = s.telemetryEnabled !== false
    if (s.codeTheme && s.codeTheme !== codeTheme.value) {
      codeTheme.value = s.codeTheme
      document.documentElement.setAttribute('data-code-theme', s.codeTheme)
    }
    if (s.drawioUiLayout === 'minimal' || s.drawioUiLayout === 'full') {
      drawioUiLayout.value = s.drawioUiLayout
    }
    if (s.saveFormatAskDialog !== undefined) {
      saveFormatAskDialog.value = s.saveFormatAskDialog !== false
    }
    if (s.saveFormatDefault !== undefined) {
      saveFormatDefault.value = s.saveFormatDefault === 'zq' ? 'zq' : 'md'
    }
  })

  cleanupUnsavedFromMain = window.electron.onUnsavedDialogShow(() => {
    showUnsavedDialogPromise().then((r) => {
      window.electron.sendUnsavedDialogResult(r)
    })
  })

  cleanupUpdateListener = window.electron.onUpdateEvent((payload) => {
    if (payload.type === 'available' || payload.type === 'downloaded' || payload.type === 'error') {
      updateDialogVisible.value = true
    }
  })

  if (platform === 'web') {
    const onBeforeUnload = () => flushWebPersist()
    window.addEventListener('beforeunload', onBeforeUnload)
    cleanupBeforeUnload = () => window.removeEventListener('beforeunload', onBeforeUnload)
    await nextTick()
    skipWebPersist.value = false
  }
})

onUnmounted(() => {
  cleanupMenuAction?.()
  cleanupLoadFile?.()
  cleanupSettingsChanged?.()
  cleanupUnsavedFromMain?.()
  cleanupUpdateListener?.()
  cleanupDrawioBundleReady?.()
  cleanupExcalidrawBundleReady?.()
  cleanupWebLocale?.()
  cleanupBeforeUnload?.()
  if (webPersistTimer) {
    clearTimeout(webPersistTimer)
    webPersistTimer = null
  }
})
</script>

<template>
  <ExcalidrawStandaloneView v-if="excalidrawStandaloneMode" />
  <DrawioStandaloneView v-else-if="drawioStandaloneMode" />
  <div v-else class="app-shell">
    <WebAppMenu v-if="appPlatform === 'web'" />
    <Sidebar
      :editor="tiptapEditor"
      :visible="sidebarVisible && !showWelcome"
      :scroll-container="editorAreaRef"
      :is-library-mode="isLibraryMode"
      :library-name="libraryName"
      :tree="tree"
      :active-doc-id="activeDocId"
      :expanded-folders="expandedFolders"
      @select-doc="onSelectDoc"
      @toggle-folder="toggleFolder"
      @create-doc="onCreateDoc"
      @create-folder="onCreateFolder"
      @rename-item="onRenameItem"
      @delete-item="onDeleteItem"
      @move-item="onMoveItem"
    />
    <div class="app-right">
      <template v-if="showWelcome">
        <TitleBar
          file-name=""
          hide-default-title
          :is-modified="false"
          :sidebar-visible="false"
          @toggle-sidebar="toggleSidebar"
        />
        <WelcomeScreen
          @open-file="onWelcomeOpenFile"
          @new-document="onWelcomeNewDocument"
          @new-library="onWelcomeNewLibrary"
          @open-recent="onWelcomeOpenRecent"
        />
      </template>
      <template v-else>
        <TitleBar
          :file-name="displayFileName"
          :is-modified="isModified"
          :sidebar-visible="sidebarVisible"
          @toggle-sidebar="toggleSidebar"
        />
        <div v-if="showLibraryEmptyState" class="library-empty-state">
          <div class="library-empty-icon">
            <FileText
              class="library-empty-icon__lucide"
              :size="48"
              :stroke-width="1.2"
            />
          </div>
          <p class="library-empty-text">{{ $t('library.selectOrCreateDoc') }}</p>
        </div>
        <template v-else>
          <div v-show="sourceMode" class="editor-area source-mode-area">
            <textarea
              ref="sourceTextareaRef"
              v-model="sourceContent"
              class="source-textarea"
              spellcheck="false"
              @input="onSourceInput"
            />
          </div>
          <div v-show="!sourceMode" class="editor-area">
            <ZqScrollbar ref="editorScrollbarRef" height="100%">
              <ZqEditor
                ref="editorRef"
                mode="full"
                @ready="onEditorReady"
                @change="onEditorChange"
              />
            </ZqScrollbar>
            <div v-if="largeFileTruncated" class="large-file-banner">
              <span class="large-file-banner__text">
                {{ $t('largeFile.truncatedWarning') }}
                —
                {{ $t('largeFile.loadedLines', { loaded: largeFileLoadedLines }) }}
                / {{ $t('largeFile.totalLines', { total: largeFileTotalLines }) }}
              </span>
              <template v-if="largeFileLoading">
                <span class="large-file-banner__loading">{{ $t('largeFile.loading') }}</span>
              </template>
              <template v-else>
                <button class="large-file-banner__btn" @click="loadMoreLines">{{ $t('largeFile.loadMore') }}</button>
                <!-- <button class="large-file-banner__btn large-file-banner__btn--secondary" @click="loadAllLines">{{ $t('largeFile.loadAll') }}</button> -->
              </template>
            </div>
          </div>
          <StatusBar
            :characters="stats.characters"
            :lines="stats.lines"
            :words="stats.words"
            :is-modified="isModified"
          />
        </template>
      </template>
    </div>
    <Settings
      :visible="settingsVisible"
      :current-locale="localeMode"
      :current-theme="themeMode"
      :auto-save="autoSaveEnabled"
      :code-theme="codeTheme"
      :telemetry-enabled="telemetryEnabled"
      :drawio-ui-layout="drawioUiLayout"
      :save-format-ask-dialog="saveFormatAskDialog"
      :save-format-default="saveFormatDefault"
      :drawio-bundle-ready="drawioBundleReady"
      :show-plugin-center="appPlatform !== 'web'"
      @close="settingsVisible = false"
      @change-locale="onChangeLocale"
      @change-theme="onChangeTheme"
      @change-auto-save="onChangeAutoSave"
      @change-telemetry="onChangeTelemetry"
      @change-code-theme="onChangeCodeTheme"
      @change-save-format-ask="onChangeSaveFormatAsk"
      @change-save-format-default="onChangeSaveFormatDefault"
      @change-drawio-ui-layout="onChangeDrawioUiLayout"
      @check-update="triggerCheckUpdate"
      @drawio-bundle-changed="refreshDrawioBundleStatus"
      @excalidraw-bundle-changed="refreshExcalidrawBundleStatus"
    />
    <InputDialog
      :visible="inputDialogVisible"
      :title="inputDialogTitle"
      :fields="inputDialogFields"
      @confirm="onInputDialogConfirm"
      @cancel="onInputDialogCancel"
    />
    <AboutDialog
      :visible="aboutDialogVisible"
      @close="aboutDialogVisible = false"
    />
    <UpdateDialog
      :visible="updateDialogVisible"
      :update-url="updateUrl"
      @close="updateDialogVisible = false"
    />
    <ConfirmDialog
      :visible="sourceModeConfirmVisible"
      :title="$t('dialog.sourceModeTitle')"
      :message="$t('dialog.sourceModeMessage')"
      :confirm-text="$t('dialog.sourceModeConfirm')"
      :cancel-text="$t('dialog.cancel')"
      @confirm="onConfirmSourceMode"
      @cancel="onCancelSourceMode"
    />
    <SaveFormatDialog
      :visible="saveFormatDialogVisible"
      @pick="onSaveFormatPick"
      @cancel="onSaveFormatCancel"
    />
    <ConfirmDialog
      :visible="unsavedDialogVisible"
      :title="$t('dialog.unsavedTitle')"
      :message="$t('dialog.unsavedMessage')"
      :cancel-text="$t('dialog.cancel')"
      :alternate-text="$t('dialog.dontSave')"
      :confirm-text="$t('dialog.save')"
      confirm-variant="primary"
      @cancel="onUnsavedCancel"
      @alternate="onUnsavedDiscard"
      @confirm="onUnsavedSave"
    />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.app-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.editor-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-editor);

}

.editor-area :deep(.zq-scrollbar) {
  flex: 1;
  min-height: 0;
  margin-right: 6px;

}

.library-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--bg-editor);
  color: var(--text-tertiary);
}

.source-mode-area {
  display: flex;
}

.source-textarea {
  flex: 1;
  width: 100%;
  padding: 24px 48px;
  border: none;
  outline: none;
  resize: none;
  background: var(--bg-editor);
  color: var(--text-primary);
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.7;
  tab-size: 2;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.source-textarea::placeholder {
  color: var(--text-placeholder);
}

.library-empty-icon {
  opacity: 0.3;
  color: currentColor;
}

.library-empty-icon__lucide {
  display: block;
}

.library-empty-text {
  font-size: 14px;
  white-space: pre-line;
  text-align: center;
  line-height: 1.6;
}

.large-file-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--bg-warning, #fef3cd);
  color: var(--text-warning, #856404);
  font-size: 13px;
  flex-shrink: 0;
  margin: 0 16px;
  border-radius: 8px;
}

.large-file-banner__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.large-file-banner__loading {
  font-size: 12px;
  opacity: 0.7;
}

.large-file-banner__btn {
  padding: 3px 12px;
  border: 1px solid var(--border-warning, #ffc107);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.large-file-banner__btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.large-file-banner__btn--secondary {
  opacity: 0.7;
}
</style>
