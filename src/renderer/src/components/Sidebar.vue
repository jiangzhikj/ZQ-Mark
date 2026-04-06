<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Editor } from '@tiptap/vue-3'
import Outline from './Outline.vue'
import FileTree from './FileTree.vue'
import type { LibraryNode } from '../../../shared/types'


const props = defineProps<{
  editor?: Editor
  visible: boolean
  scrollContainer?: HTMLElement
  isLibraryMode: boolean
  libraryName: string
  tree: LibraryNode[]
  activeDocId: string | null
  expandedFolders: Set<string>
}>()

const emit = defineEmits<{
  'select-doc': [node: LibraryNode]
  'toggle-folder': [id: string]
  'create-doc': [parentId: string | null]
  'create-folder': [parentId: string | null]
  'rename-item': [id: string, oldName: string]
  'delete-item': [id: string]
  'move-item': [id: string, newParentId: string | null, index: number]
}>()

const { t } = useI18n()

const sidebarWidth = ref(240)
const isResizing = ref(false)
const MIN_WIDTH = 160
const MAX_WIDTH = 400

type TabId = 'files' | 'outline'
const activeTab = ref<TabId>(props.isLibraryMode ? 'files' : 'outline')

watch(() => props.isLibraryMode, (val) => {
  if (val) activeTab.value = 'files'
})

const tabs = computed(() => {
  const items: { id: TabId; label: string }[] = []
  if (props.isLibraryMode) {
    items.push({ id: 'files', label: t('sidebar.fileTree') })
  }
  items.push({ id: 'outline', label: t('sidebar.outline') })
  return items
})

const showTabs = computed(() => props.isLibraryMode)

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  function onMouseMove(ev: MouseEvent) {
    const delta = ev.clientX - startX
    sidebarWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
  }

  function onMouseUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <aside
    v-show="visible"
    class="sidebar"
    :style="{ width: sidebarWidth + 'px' }"
  >
    <div class="sidebar-header">
      <div v-if="showTabs" class="sidebar-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="sidebar-tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <span v-else class="sidebar-title">{{ t('sidebar.outline') }}</span>
    </div>

    <div class="sidebar-body">
      <FileTree
        v-if="isLibraryMode && activeTab === 'files'"
        :library-name="libraryName"
        :tree="tree"
        :active-doc-id="activeDocId"
        :expanded-folders="expandedFolders"
        @select-doc="emit('select-doc', $event)"
        @toggle-folder="emit('toggle-folder', $event)"
        @create-doc="emit('create-doc', $event)"
        @create-folder="emit('create-folder', $event)"
        @rename-item="(id, name) => emit('rename-item', id, name)"
        @delete-item="emit('delete-item', $event)"
        @move-item="(id, pid, idx) => emit('move-item', id, pid, idx)"
      />
      <Outline
        v-if="activeTab === 'outline'"
        :editor="editor"
        :scroll-container="scrollContainer"
      />
    </div>

    <div
      class="resize-handle"
      :class="{ active: isResizing }"
      @mousedown="startResize"
    />
  </aside>
</template>

<style scoped>
.sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  /* border-right: 1px solid var(--border-color); */
  overflow: hidden;
  position: relative;
  transition: width 0.01s;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
}

.resize-handle:hover,
.resize-handle.active {
  background: var(--accent-color);
  opacity: 0.3;
}

.sidebar-header {
  height: var(--titlebar-height);
  display: flex;
  align-items: flex-end;
  padding: 0 8px 0;
  flex-shrink: 0;
  margin-top: 20px;
  -webkit-app-region: drag;
}

:global([data-platform='win32']) .sidebar-header,
:global([data-platform='linux']) .sidebar-header,
:global([data-platform='web']) .sidebar-header {
  margin-top: 0;
}

.sidebar-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  pointer-events: none;
  padding: 0 8px 8px;
}

.sidebar-tabs {
  display: flex;
  gap: 0;
  width: 100%;
  -webkit-app-region: no-drag;
}

.sidebar-tab {
  flex: 1;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
  text-align: center;
}

.sidebar-tab:hover {
  color: var(--text-secondary);
}

.sidebar-tab.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.sidebar-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
