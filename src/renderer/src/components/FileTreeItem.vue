<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-vue-next'
import type { LibraryNode } from '../../../shared/types'

const props = defineProps<{
  node: LibraryNode
  depth: number
  activeDocId: string | null
  expandedFolders: Set<string>
}>()

const emit = defineEmits<{
  select: [node: LibraryNode]
  toggle: [id: string]
  contextmenu: [event: MouseEvent, node: LibraryNode]
  drop: [dragId: string, targetId: string | null, position: 'before' | 'inside' | 'after']
}>()

const isDragOver = ref(false)
const dragPosition = ref<'before' | 'inside' | 'after'>('inside')

const isExpanded = computed(() => props.expandedFolders.has(props.node.id))
const isActive = computed(() => props.node.type === 'file' && props.node.id === props.activeDocId)

function onClick() {
  if (props.node.type === 'folder') {
    emit('toggle', props.node.id)
  } else {
    emit('select', props.node)
  }
}

function onContextMenu(e: MouseEvent) {
  emit('contextmenu', e, props.node)
}

function onDragStart(e: DragEvent) {
  e.dataTransfer!.setData('text/plain', props.node.id)
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  isDragOver.value = true

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  const h = rect.height

  if (props.node.type === 'folder') {
    if (y < h * 0.25) dragPosition.value = 'before'
    else if (y > h * 0.75) dragPosition.value = 'after'
    else dragPosition.value = 'inside'
  } else {
    dragPosition.value = y < h * 0.5 ? 'before' : 'after'
  }
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const dragId = e.dataTransfer!.getData('text/plain')
  if (dragId && dragId !== props.node.id) {
    emit('drop', dragId, props.node.id, dragPosition.value)
  }
}
</script>

<template>
  <div class="tree-item-wrapper">
    <div
      class="tree-item"
      :class="{
        active: isActive,
        'drag-over': isDragOver,
        [`drag-${dragPosition}`]: isDragOver
      }"
      :style="{ paddingLeft: (depth * 16 + 8) + 'px' }"
      draggable="true"
      @click="onClick"
      @contextmenu="onContextMenu"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <span
        v-if="node.type === 'folder'"
        class="tree-arrow"
        :class="{ expanded: isExpanded }"
        @click.stop="emit('toggle', node.id)"
      >
        <ChevronRight :size="14" />
      </span>
      <span v-else class="tree-arrow-placeholder" />

      <component
        :is="node.type === 'folder' ? (isExpanded ? FolderOpen : Folder) : File"
        :size="15"
        class="tree-icon"
        :class="node.type"
      />

      <span class="tree-label">{{ node.name }}</span>
    </div>

    <div v-if="node.type === 'folder' && isExpanded && node.children?.length" class="tree-children">
      <FileTreeItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :active-doc-id="activeDocId"
        :expanded-folders="expandedFolders"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
        @contextmenu="(ev, nd) => emit('contextmenu', ev, nd)"
        @drop="(dragId, targetId, pos) => emit('drop', dragId, targetId, pos)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding-right: 8px;
  margin: 0 20px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.1s;
  position: relative;
  border-radius: 8px;
}

.tree-item:hover {
  background: var(--bg-hover);
}

.tree-item.active {
  background: var(--accent-shadow);
  color: var(--accent-color);
}

.tree-item.active:hover {
  background: var(--accent-shadow);
}

.tree-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2.5px;
  //background: var(--accent-color);
  border-radius: 0 1px 1px 0;
}

.tree-item.drag-over.drag-before::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  top: -1px;
  height: 2px;
  background: var(--accent-color);
  border-radius: 1px;
}

.tree-item.drag-over.drag-after::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 2px;
  background: var(--accent-color);
  border-radius: 1px;
}

.tree-item.drag-over.drag-inside {
  background: var(--bg-active);
  outline: 1px solid var(--accent-color);
  outline-offset: -1px;
  border-radius: 3px;
}

.tree-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: transform 0.15s ease;
  color: var(--text-tertiary);
}

.tree-arrow.expanded {
  transform: rotate(90deg);
}

.tree-arrow-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.tree-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.tree-icon.folder {
  //color: var(--accent-color);
  opacity: 0.8;
}

.tree-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.tree-item.active .tree-label {
  color: var(--accent-color);
  font-weight: 500;
}

.tree-item.active .tree-icon {
  color: var(--accent-color);
}

.tree-children {
  /* no extra styles needed */
}
</style>
