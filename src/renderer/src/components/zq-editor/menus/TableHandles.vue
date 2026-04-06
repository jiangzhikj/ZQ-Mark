<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { CellSelection } from '@tiptap/pm/tables';
import { GripVertical } from '@/components/icons';

import TableMenu from './TableMenu.vue';

interface Props {
  editor: Editor;
}

const props = defineProps<Props>();

const showRowHandle = ref(false);
const showColumnHandle = ref(false);
const rowHandlePosition = ref({ top: 0, left: 0, height: 0 });
const columnHandlePosition = ref({ top: 0, left: 0, width: 0 });
const currentRowIndex = ref(-1);
const currentColumnIndex = ref(-1);

let currentCell: HTMLElement | null = null;
let currentTable: HTMLElement | null = null;
let currentRow: HTMLElement | null = null;

const showMenu = ref(false);
const menuType = ref<'column' | 'row'>('row');
const menuPosition = ref({ x: 0, y: 0 });

const isMouseOverHandle = ref(false);
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let editorElement: HTMLElement | null = null;
let scrollAncestors: HTMLElement[] = [];
let boundMouseLeave: (() => void) | null = null;

function updateHandlePositions() {
  if (!currentCell || !currentTable || !currentRow) return;

  if (!document.body.contains(currentCell)) {
    hideHandles();
    return;
  }

  const tableRect = currentTable.getBoundingClientRect();
  const rowRect = currentRow.getBoundingClientRect();
  const cellRect = currentCell.getBoundingClientRect();

  rowHandlePosition.value = {
    top: rowRect.top,
    left: tableRect.left - 20,
    height: rowRect.height,
  };
  columnHandlePosition.value = {
    top: tableRect.top - 20,
    left: cellRect.left,
    width: cellRect.width,
  };
}

function hideHandles() {
  showRowHandle.value = false;
  showColumnHandle.value = false;
  currentCell = null;
  currentTable = null;
  currentRow = null;
}

function handleMouseMove(e: MouseEvent) {
  if (!props.editor || !editorElement) return;

  const target = e.target as HTMLElement;
  const cell = target.closest('td, th') as HTMLElement;
  const table = target.closest('table') as HTMLElement;

  if (!cell || !table) {
    scheduleHide();
    return;
  }

  cancelHide();
  const row = cell.closest('tr') as HTMLElement;
  if (!row) return;

  const rows = [...table.querySelectorAll('tr')] as HTMLElement[];
  currentRowIndex.value = rows.indexOf(row);
  const cells = [...row.querySelectorAll('td, th')];
  currentColumnIndex.value = cells.indexOf(cell);
  currentCell = cell;
  currentTable = table;
  currentRow = row;

  updateHandlePositions();

  showRowHandle.value = true;
  showColumnHandle.value = true;
}

function handleScroll() {
  if (!showRowHandle.value && !showColumnHandle.value) return;

  if (showMenu.value) return;

  if (currentCell && currentTable && currentRow) {
    updateHandlePositions();
  } else {
    hideHandles();
  }
}

function scheduleHide() {
  if (hideTimeout) return;
  hideTimeout = setTimeout(() => {
    if (!isMouseOverHandle.value && !showMenu.value) {
      hideHandles();
    }
    hideTimeout = null;
  }, 300);
}

function cancelHide() {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function focusCurrentCell() {
  if (!currentCell || !props.editor) return;
  const pos = props.editor.view.posAtDOM(currentCell, 0);
  if (pos >= 0) {
    props.editor.chain().focus().setTextSelection(pos).run();
  }
}

function selectRowOrColumn(type: 'column' | 'row') {
  if (!currentCell || !props.editor) return;

  const pos = props.editor.view.posAtDOM(currentCell, 0);
  if (pos < 0) return;

  const { state } = props.editor.view;
  const $cellPos = state.doc.resolve(pos);

  let tableDepth = -1;
  let rowDepth = -1;
  let cellDepth = -1;

  for (let d = $cellPos.depth; d > 0; d--) {
    const name = $cellPos.node(d).type.name;
    if (
      (name === 'tableCell' || name === 'tableHeader') &&
      cellDepth < 0
    )
      cellDepth = d;
    if (name === 'tableRow' && rowDepth < 0) rowDepth = d;
    if (name === 'table' && tableDepth < 0) {
      tableDepth = d;
      break;
    }
  }

  if (tableDepth < 0 || rowDepth < 0 || cellDepth < 0) return;

  const tableNode = $cellPos.node(tableDepth);
  const tableStart = $cellPos.start(tableDepth);
  const rowIndex = $cellPos.index(tableDepth);
  const colIndex = $cellPos.index(rowDepth);

  try {
    if (type === 'row') {
      const row = tableNode.child(rowIndex);
      let rowPos = tableStart;
      for (let i = 0; i < rowIndex; i++) {
        rowPos += tableNode.child(i).nodeSize;
      }
      const firstCellPos = rowPos + 1;
      let lastCellPos = firstCellPos;
      for (let c = 0; c < row.childCount - 1; c++) {
        lastCellPos += row.child(c).nodeSize;
      }
      const $anchor = state.doc.resolve(firstCellPos);
      const $head = state.doc.resolve(lastCellPos);
      props.editor.view.dispatch(
        state.tr.setSelection(new CellSelection($anchor, $head)),
      );
    } else {
      let firstCellPos = -1;
      let lastCellPos = -1;
      tableNode.forEach((row: any, rowOffset: number) => {
        if (colIndex >= row.childCount) return;
        let cellOffset = 0;
        for (let c = 0; c < colIndex; c++) {
          cellOffset += row.child(c).nodeSize;
        }
        const cellPos = tableStart + rowOffset + 1 + cellOffset;
        if (firstCellPos < 0) firstCellPos = cellPos;
        lastCellPos = cellPos;
      });
      if (firstCellPos >= 0 && lastCellPos >= 0) {
        const $anchor = state.doc.resolve(firstCellPos);
        const $head = state.doc.resolve(lastCellPos);
        props.editor.view.dispatch(
          state.tr.setSelection(new CellSelection($anchor, $head)),
        );
      }
    }
  } catch {
    focusCurrentCell();
  }
}

function openMenu(e: MouseEvent, type: 'column' | 'row') {
  e.stopPropagation();
  selectRowOrColumn(type);

  menuType.value = type;
  menuPosition.value = { x: e.clientX, y: e.clientY };
  showMenu.value = true;

  const closeMenu = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('.zq-table-menu'))
      return;
    showMenu.value = false;
    showRowHandle.value = false;
    showColumnHandle.value = false;
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function collectScrollAncestors(el: HTMLElement | null): HTMLElement[] {
  const result: HTMLElement[] = [];
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflow + style.overflowY)) {
      result.push(node);
    }
    node = node.parentElement;
  }
  return result;
}

onMounted(() => {
  nextTick(() => {
    editorElement = props.editor?.view?.dom as HTMLElement | null;
    if (editorElement) {
      boundMouseLeave = () => scheduleHide();
      editorElement.addEventListener('mousemove', handleMouseMove);
      editorElement.addEventListener('mouseleave', boundMouseLeave);

      scrollAncestors = collectScrollAncestors(editorElement);
      for (const el of scrollAncestors) {
        el.addEventListener('scroll', handleScroll, { passive: true });
      }
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
  });
});

onBeforeUnmount(() => {
  if (editorElement) {
    editorElement.removeEventListener('mousemove', handleMouseMove);
    if (boundMouseLeave) {
      editorElement.removeEventListener('mouseleave', boundMouseLeave);
    }
  }
  for (const el of scrollAncestors) {
    el.removeEventListener('scroll', handleScroll);
  }
  scrollAncestors = [];
  window.removeEventListener('scroll', handleScroll);
  cancelHide();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showRowHandle"
      class="zq-table-handle zq-table-handle--row"
      :style="{
        top: `${rowHandlePosition.top}px`,
        left: `${rowHandlePosition.left}px`,
        height: `${rowHandlePosition.height}px`,
      }"
      @click="openMenu($event, 'row')"
      @mouseenter="isMouseOverHandle = true; cancelHide()"
      @mouseleave="isMouseOverHandle = false; scheduleHide()"
    >
      <GripVertical class="zq-table-handle__icon" />
    </div>
  </Teleport>
  <Teleport to="body">
    <div
      v-if="showColumnHandle"
      class="zq-table-handle zq-table-handle--column"
      :style="{
        top: `${columnHandlePosition.top}px`,
        left: `${columnHandlePosition.left}px`,
        width: `${columnHandlePosition.width}px`,
      }"
      @click="openMenu($event, 'column')"
      @mouseenter="isMouseOverHandle = true; cancelHide()"
      @mouseleave="isMouseOverHandle = false; scheduleHide()"
    >
      <GripVertical class="zq-table-handle__icon zq-table-handle__icon--rotated" />
    </div>
  </Teleport>
  <Teleport to="body">
    <TableMenu
      v-if="showMenu"
      :editor="editor"
      :type="menuType"
      :position="menuPosition"
      @close="showMenu = false"
    />
  </Teleport>
</template>

<style scoped>
.zq-table-handle {
  position: fixed;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.zq-table-handle:hover {
  background: var(--el-fill-color);
}

.zq-table-handle--row {
  width: 16px;
}

.zq-table-handle--column {
  height: 16px;
}

.zq-table-handle__icon {
  width: 12px;
  height: 12px;
  color: var(--el-text-color-secondary);
}

.zq-table-handle__icon--rotated {
  transform: rotate(90deg);
}
</style>
