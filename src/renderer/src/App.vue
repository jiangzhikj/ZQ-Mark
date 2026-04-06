<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Editor } from '@tiptap/vue-3'
import TitleBar from '@/components/TitleBar.vue'
import Sidebar from '@/components/Sidebar.vue'
import StatusBar from '@/components/StatusBar.vue'
import Settings from '@/components/Settings.vue'
import WelcomeScreen from '@/components/WelcomeScreen.vue'
import { InputDialog, ConfirmDialog, ZqScrollbar } from '@/components/ui'
import type { InputDialogField, InputDialogResult } from '@/components/ui'
import AboutDialog from '@/components/AboutDialog.vue'
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
  registerEditorApi,
  onEditorUpdate,
  switchLibraryDoc,
  openFile,
  newLibrary,
  loadFileResult,
  setWindowMode,
  setBeforeSaveMd,
  setUnsavedDialog
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
const updateUrl = ref('')
const editorRef = ref<InstanceType<typeof ZqEditor>>()
const localeMode = ref<'system' | string>('system')
const tiptapEditor = ref<Editor>()
const editorScrollbarRef = ref<ComponentPublicInstance | null>(null)
const editorAreaRef = computed(() => {
  const el = editorScrollbarRef.value?.$el
  return el instanceof HTMLElement ? el : undefined
})
const isNewDocWindow = new URLSearchParams(window.location.search).get('newDoc') === '1'
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

const saveMdConfirmVisible = ref(false)
let saveMdResolve: ((choice: 'md' | 'zq' | 'cancel') => void) | null = null

const unsavedDialogVisible = ref(false)
let unsavedResolve: ((choice: 'save' | 'discard' | 'cancel') => void) | null = null

function showUnsavedDialogPromise(): Promise<'save' | 'discard' | 'cancel'> {
  return new Promise((resolve) => {
    unsavedResolve = resolve
    unsavedDialogVisible.value = true
  })
}

setUnsavedDialog(() => showUnsavedDialogPromise())

setBeforeSaveMd(() => {
  return new Promise<'md' | 'zq' | 'cancel'>((resolve) => {
    saveMdResolve = resolve
    saveMdConfirmVisible.value = true
  })
})

function onSaveMdCancel() {
  saveMdConfirmVisible.value = false
  saveMdResolve?.('cancel')
  saveMdResolve = null
}

function onSaveMdContinue() {
  saveMdConfirmVisible.value = false
  saveMdResolve?.('md')
  saveMdResolve = null
}

function onSaveMdAsZq() {
  saveMdConfirmVisible.value = false
  saveMdResolve?.('zq')
  saveMdResolve = null
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

async function onChangeLocale(newLocale: string) {
  localeMode.value = newLocale
  if (newLocale === 'system') {
    const sys = await window.electron.getSystemLocale()
    locale.value = sys
    await window.electron.changeLocale(sys)
  } else {
    locale.value = newLocale
    await window.electron.changeLocale(newLocale)
  }
}

function onChangeTheme(mode: string) {
  setThemeMode(mode as 'system' | 'light' | 'dark')
}

async function onChangeAutoSave(enabled: boolean) {
  await window.electron.setSettings({ autoSave: enabled })
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

function onWebLocaleChanged(e: Event) {
  const d = (e as CustomEvent<string>).detail
  if (typeof d === 'string' && d) locale.value = d
}

let cleanupWebLocale: (() => void) | null = null

onMounted(async () => {
  const platform = await window.electron.getPlatform()
  document.documentElement.setAttribute('data-platform', platform)
  appPlatform.value = platform

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
  updateUrl.value = settings.updateUrl || ''

  cleanupMenuAction = window.electron.onMenuAction((action) => {
    if (action === 'view:toggleSidebar') {
      toggleSidebar()
    } else if (action === 'view:sourceCode') {
      toggleSourceMode()
    } else if (action === 'app:preferences') {
      openSettings()
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
  })

  cleanupUnsavedFromMain = window.electron.onUnsavedDialogShow(() => {
    showUnsavedDialogPromise().then((r) => {
      window.electron.sendUnsavedDialogResult(r)
    })
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
  cleanupWebLocale?.()
  cleanupBeforeUnload?.()
  if (webPersistTimer) {
    clearTimeout(webPersistTimer)
    webPersistTimer = null
  }
})
</script>

<template>
  <div class="app-shell">
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
      @close="settingsVisible = false"
      @change-locale="onChangeLocale"
      @change-theme="onChangeTheme"
      @change-auto-save="onChangeAutoSave"
      @check-update="aboutDialogVisible = true"
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
      :update-url="updateUrl"
      @close="aboutDialogVisible = false"
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
    <ConfirmDialog
      :visible="saveMdConfirmVisible"
      :title="$t('dialog.saveMdTitle')"
      :message="$t('dialog.saveMdMessage')"
      :cancel-text="$t('dialog.cancel')"
      :alternate-text="$t('dialog.saveMdContinue')"
      :confirm-text="$t('dialog.saveMdSaveAsZq')"
      width="440px"
      @cancel="onSaveMdCancel"
      @alternate="onSaveMdContinue"
      @confirm="onSaveMdAsZq"
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
</style>
