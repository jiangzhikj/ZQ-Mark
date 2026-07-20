<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FilePlus, FolderPlus, LibraryBig } from '@/components/icons'
import FileTreeItem from './FileTreeItem.vue'
import { ContextMenu } from './ui'
import type { ContextMenuItem } from './ui'
import type { LibraryNode } from '../../../shared/types'

const props = defineProps<{
  mode: 'library' | 'folder'
  treeName: string
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
const contextMenuRef = ref<InstanceType<typeof ContextMenu>>()
const contextTarget = ref<LibraryNode | null>(null)

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = []
  if (contextTarget.value?.type === 'folder') {
    items.push(
      { id: 'new-file', label: t('library.newFile') },
      { id: 'new-folder', label: t('library.newFolder') },
      { id: 'sep1', label: '', separator: true }
    )
  }
  items.push(
    { id: 'rename', label: t('library.rename') },
    { id: 'delete', label: t('library.delete') }
  )
  return items
})

function onContextMenu(event: MouseEvent, node: LibraryNode) {
  contextTarget.value = node
  contextMenuRef.value?.show(event)
}

function onBackgroundContextMenu(event: MouseEvent) {
  contextTarget.value = null
  const items: ContextMenuItem[] = [
    { id: 'new-file', label: t('library.newFile') },
    { id: 'new-folder', label: t('library.newFolder') }
  ]
  backgroundMenuItems.value = items
  backgroundMenuRef.value?.show(event)
}

const backgroundMenuRef = ref<InstanceType<typeof ContextMenu>>()
const backgroundMenuItems = ref<ContextMenuItem[]>([])

function onContextMenuSelect(id: string) {
  if (!contextTarget.value) return

  switch (id) {
    case 'new-file':
      emit('create-doc', contextTarget.value.type === 'folder' ? contextTarget.value.id : null)
      break
    case 'new-folder':
      emit('create-folder', contextTarget.value.type === 'folder' ? contextTarget.value.id : null)
      break
    case 'rename':
      emit('rename-item', contextTarget.value.id, contextTarget.value.name)
      break
    case 'delete':
      emit('delete-item', contextTarget.value.id)
      break
  }
}

function onBackgroundMenuSelect(id: string) {
  switch (id) {
    case 'new-file':
      emit('create-doc', null)
      break
    case 'new-folder':
      emit('create-folder', null)
      break
  }
}

function onDrop(dragId: string, targetId: string | null, position: 'before' | 'inside' | 'after') {
  if (position === 'inside') {
    emit('move-item', dragId, targetId, 0)
  } else {
    const parentId = findParentId(props.tree, targetId!)
    const siblings = parentId ? findNode(props.tree, parentId)?.children || [] : props.tree
    const targetIndex = siblings.findIndex((n) => n.id === targetId)
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    emit('move-item', dragId, parentId, Math.max(0, insertIndex))
  }
}

function findNode(tree: LibraryNode[], id: string): LibraryNode | null {
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

function findParentId(tree: LibraryNode[], childId: string, parentId: string | null = null): string | null {
  for (const node of tree) {
    if (node.id === childId) return parentId
    if (node.children) {
      const found = findParentId(node.children, childId, node.id)
      if (found !== undefined && found !== null) return found
      if (node.children.some((c) => c.id === childId)) return node.id
    }
  }
  return null
}
</script>

<template>
  <div class="file-tree" @contextmenu.self="onBackgroundContextMenu">
    <div class="file-tree-header">
      <span class="header-library-name" :title="treeName">{{ treeName }}</span>
      <div class="header-actions">
        <button class="header-btn" :title="t('library.newFile')" @click.stop="emit('create-doc', null)">
          <FilePlus :size="15" />
        </button>
        <button class="header-btn" :title="t('library.newFolder')" @click.stop="emit('create-folder', null)">
          <FolderPlus :size="15" />
        </button>
      </div>
    </div>

    <div class="file-tree-content" @contextmenu.self="onBackgroundContextMenu">
      <div v-if="tree.length === 0" class="file-tree-empty">
        <div class="file-tree-empty__inner">
          <div class="file-tree-empty__icon-wrap" aria-hidden="true">
            <LibraryBig class="file-tree-empty__icon" :size="40" :stroke-width="1.35" />
          </div>
          <p class="file-tree-empty__text">{{
            mode === 'folder' ? t('folder.emptyFolder') : t('library.emptyLibrary')
          }}</p>
        </div>
      </div>
      <FileTreeItem
        v-for="node in tree"
        :key="node.id"
        :node="node"
        :depth="0"
        :active-doc-id="activeDocId"
        :expanded-folders="expandedFolders"
        @select="emit('select-doc', $event)"
        @toggle="emit('toggle-folder', $event)"
        @contextmenu="onContextMenu"
        @drop="onDrop"
      />
    </div>

    <ContextMenu
      ref="contextMenuRef"
      :items="contextMenuItems"
      @select="onContextMenuSelect"
    />
    <ContextMenu
      ref="backgroundMenuRef"
      :items="backgroundMenuItems"
      @select="onBackgroundMenuSelect"
    />
  </div>
</template>

<style scoped>
.file-tree {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.file-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 14px;
  flex-shrink: 0;
  min-height: 28px;
}

.header-library-name {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.file-tree:hover .header-actions {
  opacity: 1;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s;
}

.header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.file-tree-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 0 0 4px;
}

.file-tree-content::-webkit-scrollbar {
  width: 5px;
}

.file-tree-content::-webkit-scrollbar-track {
  background: transparent;
}

.file-tree-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.2s;
}

.file-tree-content:hover::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}

.file-tree-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  min-height: 120px;
}

.file-tree-empty__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  max-width: 240px;
  transform: translateY(-58px);
}

.file-tree-empty__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: var(--bg-hover);
  /* border: 1px solid var(--border-color); */
  color: var(--text-tertiary);
  box-shadow: none;
}

.file-tree-empty__icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.file-tree-empty__text {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.65;
  white-space: pre-line;
}
</style>
