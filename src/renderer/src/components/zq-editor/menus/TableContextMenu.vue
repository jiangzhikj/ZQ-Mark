<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { CellSelection } from '@tiptap/pm/tables';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Check,
  ChevronRight,
  Columns2,
  Maximize2,
  MergeCells,
  Paintbrush,
  Rows2,
  Rows3,
  SplitSquareHorizontal,
  TableProperties,
  Trash2,
  X,
} from '@/components/icons';
import { ZqScrollbar } from '@/components/ui';
import { $t } from '../utils/i18n';

interface Props {
  editor: Editor;
  position: { x: number; y: number };
  cellElement: HTMLElement;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const showColorSubmenu = ref(false);
const showAlignSubmenu = ref(false);

const colorTriggerRef = ref<HTMLElement>();
const alignTriggerRef = ref<HTMLElement>();
const colorSubmenuStyle = ref<Record<string, string>>({});
const alignSubmenuStyle = ref<Record<string, string>>({});

function calcSubmenuPos(triggerEl: HTMLElement | undefined): Record<string, string> {
  if (!triggerEl) return { left: '0px', top: '0px' };
  const rect = triggerEl.getBoundingClientRect();
  const openRight = rect.right + 140 <= window.innerWidth - 8;
  let top = rect.top - 4;
  if (top + 200 > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - 200 - 8);
  }
  if (openRight) {
    return { left: `${rect.right - 0}px`, top: `${top}px` };
  }
  return { right: `${window.innerWidth - rect.left - 0}px`, top: `${top}px` };
}

function openSubmenu(type: 'align' | 'color') {
  if (type === 'color') {
    colorSubmenuStyle.value = calcSubmenuPos(colorTriggerRef.value);
    showColorSubmenu.value = true;
  } else {
    alignSubmenuStyle.value = calcSubmenuPos(alignTriggerRef.value);
    showAlignSubmenu.value = true;
  }
}

const menuScrollbarHeight = computed(() => `${window.innerHeight * 0.75}px`);

const menuPositionStyle = computed(() => {
  const maxH = window.innerHeight * 0.75;
  let top = props.position.y;
  let left = props.position.x;
  if (top + maxH > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - maxH - 8);
  }
  if (left + 220 > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - 220 - 8);
  }
  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

interface TableContext {
  tableNode: any;
  tablePos: number;
  tableStart: number;
  rowIndex: number;
  colIndex: number;
}

function getTableContext(): TableContext | null {
  const { state } = props.editor.view;
  const $pos = state.doc.resolve(state.selection.from);
  let tableDepth = -1;
  let rowDepth = -1;
  let cellDepth = -1;

  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name;
    if (
      (name === 'tableCell' || name === 'tableHeader') &&
      cellDepth < 0
    ) {
      cellDepth = d;
    }
    if (name === 'tableRow' && rowDepth < 0) rowDepth = d;
    if (name === 'table' && tableDepth < 0) {
      tableDepth = d;
      break;
    }
  }

  if (tableDepth < 0) return null;

  return {
    tableNode: $pos.node(tableDepth),
    tablePos: $pos.before(tableDepth),
    tableStart: $pos.start(tableDepth),
    rowIndex: rowDepth > 0 ? $pos.index(tableDepth) : -1,
    colIndex:
      cellDepth > 0 && rowDepth > 0 ? $pos.index(rowDepth) : -1,
  };
}

const hasMultiCellSelection = computed(() => {
  const { state } = props.editor.view;
  return state.selection instanceof CellSelection;
});

const canMerge = computed(() => (props.editor as any).can().mergeCells());
const canSplit = computed(() => (props.editor as any).can().splitCell());

const isHeaderRowActive = computed(() => {
  const ctx = getTableContext();
  if (!ctx || ctx.tableNode.childCount === 0) return false;
  const firstRow = ctx.tableNode.child(0);
  return (
    firstRow.childCount > 0 &&
    firstRow.child(0).type.name === 'tableHeader'
  );
});

const isHeaderColumnActive = computed(() => {
  const ctx = getTableContext();
  if (!ctx) return false;
  for (let i = 0; i < ctx.tableNode.childCount; i++) {
    const row = ctx.tableNode.child(i);
    if (
      row.childCount > 0 &&
      row.child(0).type.name !== 'tableHeader'
    ) {
      return false;
    }
  }
  return true;
});

const isFullWidthActive = computed(() => {
  const ctx = getTableContext();
  return ctx?.tableNode.attrs.fullWidth ?? false;
});

const isStripedActive = computed(() => {
  const ctx = getTableContext();
  return ctx?.tableNode.attrs.striped ?? false;
});

const cellColors = computed(() => [
  { name: $t('zq-editor.table.defaultColor'), value: '' },
  { name: $t('zq-editor.table.lightGray'), value: '#f1f5f9' },
  { name: $t('zq-editor.table.lightRed'), value: '#fee2e2' },
  { name: $t('zq-editor.table.lightOrange'), value: '#ffedd5' },
  { name: $t('zq-editor.table.lightYellow'), value: '#fef9c3' },
  { name: $t('zq-editor.table.lightGreen'), value: '#dcfce7' },
  { name: $t('zq-editor.table.lightBlue'), value: '#dbeafe' },
  { name: $t('zq-editor.table.lightPurple'), value: '#f3e8ff' },
  { name: $t('zq-editor.table.lightPink'), value: '#fce7f3' },
]);

function insertRowAbove() {
  (props.editor.chain().focus() as any).addRowBefore().run();
  emit('close');
}

function insertRowBelow() {
  (props.editor.chain().focus() as any).addRowAfter().run();
  emit('close');
}

function insertColumnLeft() {
  (props.editor.chain().focus() as any).addColumnBefore().run();
  emit('close');
}

function insertColumnRight() {
  (props.editor.chain().focus() as any).addColumnAfter().run();
  emit('close');
}

function deleteRow() {
  (props.editor.chain().focus() as any).deleteRow().run();
  emit('close');
}

function deleteColumn() {
  (props.editor.chain().focus() as any).deleteColumn().run();
  emit('close');
}

function setCellBackground(color: string) {
  (props.editor.chain().focus() as any)
    .setCellAttribute('backgroundColor', color || null)
    .run();
  showColorSubmenu.value = false;
  emit('close');
}

function mergeCells() {
  (props.editor.chain().focus() as any).mergeCells().run();
  emit('close');
}

function splitCell() {
  (props.editor.chain().focus() as any).splitCell().run();
  emit('close');
}

function toggleHeaderRow() {
  (props.editor.chain().focus() as any).toggleHeaderRow().run();
  emit('close');
}

function toggleHeaderColumn() {
  (props.editor.chain().focus() as any).toggleHeaderColumn().run();
  emit('close');
}

function deleteTable() {
  (props.editor.chain().focus() as any).deleteTable().run();
  emit('close');
}

function setCellAlign(align: string) {
  (props.editor.chain().focus() as any)
    .setCellAttribute('textAlign', align)
    .run();
  showAlignSubmenu.value = false;
  emit('close');
}

function clearCellContent() {
  const { state } = props.editor.view;
  const sel = state.selection;

  if (sel instanceof CellSelection) {
    const tr = state.tr;
    const emptyParagraph = state.schema.nodes.paragraph.create();
    sel.forEachCell((node: any, pos: number) => {
      tr.replaceWith(pos + 1, pos + node.nodeSize - 1, emptyParagraph);
    });
    props.editor.view.dispatch(tr);
  } else {
    const ctx = getTableContext();
    if (!ctx) return;
    const { state: st } = props.editor.view;
    const $pos = st.doc.resolve(st.selection.from);
    let cellDepth = -1;
    for (let d = $pos.depth; d > 0; d--) {
      const name = $pos.node(d).type.name;
      if (name === 'tableCell' || name === 'tableHeader') {
        cellDepth = d;
        break;
      }
    }
    if (cellDepth < 0) return;
    const cellNode = $pos.node(cellDepth);
    const cellPos = $pos.before(cellDepth);
    const tr = st.tr;
    const emptyParagraph = st.schema.nodes.paragraph.create();
    tr.replaceWith(cellPos + 1, cellPos + cellNode.nodeSize - 1, emptyParagraph);
    props.editor.view.dispatch(tr);
  }
  emit('close');
}

function toggleFullWidth() {
  const ctx = getTableContext();
  if (!ctx) return;
  const { state } = props.editor.view;
  const tr = state.tr;
  tr.setNodeMarkup(ctx.tablePos, undefined, {
    ...ctx.tableNode.attrs,
    fullWidth: !ctx.tableNode.attrs.fullWidth,
  });
  props.editor.view.dispatch(tr);
  emit('close');
}

function toggleStriped() {
  const ctx = getTableContext();
  if (!ctx) return;
  const { state } = props.editor.view;
  const tr = state.tr;
  tr.setNodeMarkup(ctx.tablePos, undefined, {
    ...ctx.tableNode.attrs,
    striped: !ctx.tableNode.attrs.striped,
  });
  props.editor.view.dispatch(tr);
  emit('close');
}

function sortColumn(direction: 'asc' | 'desc') {
  const ctx = getTableContext();
  if (!ctx || ctx.colIndex < 0) return;

  const { tableNode, tableStart, colIndex } = ctx;

  const headerRows: any[] = [];
  const dataRows: { node: any; text: string }[] = [];

  tableNode.forEach((row: any) => {
    if (
      row.childCount > 0 &&
      row.child(0).type.name === 'tableHeader'
    ) {
      headerRows.push(row);
    } else {
      const text =
        colIndex < row.childCount
          ? row.child(colIndex).textContent
          : '';
      dataRows.push({ node: row, text });
    }
  });

  dataRows.sort((a, b) => {
    const numA = Number(a.text);
    const numB = Number(b.text);
    if (
      !Number.isNaN(numA) &&
      !Number.isNaN(numB) &&
      a.text !== '' &&
      b.text !== ''
    ) {
      return direction === 'asc' ? numA - numB : numB - numA;
    }
    return direction === 'asc'
      ? a.text.localeCompare(b.text)
      : b.text.localeCompare(a.text);
  });

  const newRows = [
    ...headerRows.map((r: any) => r.copy(r.content)),
    ...dataRows.map((r) => r.node.copy(r.node.content)),
  ];

  const { state } = props.editor.view;
  const tr = state.tr;
  const tableEnd = tableStart + tableNode.content.size;
  tr.replaceWith(tableStart, tableEnd, newRows);
  props.editor.view.dispatch(tr);
  emit('close');
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (
    target.closest('.zq-table-context-menu') ||
    target.closest('.zq-table-context-menu__submenu-fixed')
  ) {
    return;
  }
  emit('close');
}

onMounted(() => {
  setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <div
    class="zq-table-context-menu"
    :style="menuPositionStyle"
    @click.stop
    @contextmenu.prevent
  >
    <ZqScrollbar :height="menuScrollbarHeight">
    <!-- Merge / Split (prominent when multi-cell selected) -->
    <template v-if="hasMultiCellSelection">
      <button
        class="zq-table-context-menu__item"
        :class="{ 'zq-table-context-menu__item--primary': canMerge }"
        :disabled="!canMerge"
        @click="mergeCells"
      >
        <MergeCells class="zq-table-context-menu__icon" />
        <span>{{ $t('zq-editor.table.mergeCells') }}</span>
      </button>
      <button
        class="zq-table-context-menu__item"
        :disabled="!canSplit"
        @click="splitCell"
      >
        <SplitSquareHorizontal class="zq-table-context-menu__icon" />
        <span>{{ $t('zq-editor.table.splitCell') }}</span>
      </button>
      <div class="zq-table-context-menu__divider" />
    </template>
    <template v-else>
      <button
        v-if="canSplit"
        class="zq-table-context-menu__item"
        @click="splitCell"
      >
        <SplitSquareHorizontal class="zq-table-context-menu__icon" />
        <span>{{ $t('zq-editor.table.splitCell') }}</span>
      </button>
      <div v-if="canSplit" class="zq-table-context-menu__divider" />
    </template>

    <!-- Insert row/column -->
    <button class="zq-table-context-menu__item" @click="insertRowAbove">
      <BetweenVerticalStart class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.insertRowAbove') }}</span>
    </button>
    <button class="zq-table-context-menu__item" @click="insertRowBelow">
      <BetweenVerticalEnd class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.insertRowBelow') }}</span>
    </button>
    <button class="zq-table-context-menu__item" @click="insertColumnLeft">
      <BetweenHorizontalStart class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.insertColumnLeft') }}</span>
    </button>
    <button class="zq-table-context-menu__item" @click="insertColumnRight">
      <BetweenHorizontalEnd class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.insertColumnRight') }}</span>
    </button>

    <div class="zq-table-context-menu__divider" />

    <!-- Color submenu -->
    <div
      ref="colorTriggerRef"
      class="zq-table-context-menu__submenu-wrapper"
      @mouseenter="openSubmenu('color')"
      @mouseleave="showColorSubmenu = false"
    >
      <button class="zq-table-context-menu__item">
        <Paintbrush class="zq-table-context-menu__icon" />
        <span>{{ $t('zq-editor.table.color') }}</span>
        <ChevronRight class="zq-table-context-menu__arrow" />
      </button>
    </div>
    <Teleport to="body">
      <div
        v-if="showColorSubmenu"
        class="zq-table-context-menu__submenu-fixed"
        :style="colorSubmenuStyle"
        @mouseenter="showColorSubmenu = true"
        @mouseleave="showColorSubmenu = false"
      >
        <button
          v-for="color in cellColors"
          :key="color.value"
          class="zq-table-context-menu__color-item"
          @click="setCellBackground(color.value)"
        >
          <span
            class="zq-table-context-menu__color-preview"
            :style="{
              backgroundColor: color.value || '#ffffff',
              border: color.value
                ? 'none'
                : '1px solid var(--el-border-color)',
            }"
          />
          <span>{{ color.name }}</span>
        </button>
      </div>
    </Teleport>

    <!-- Alignment submenu -->
    <div
      ref="alignTriggerRef"
      class="zq-table-context-menu__submenu-wrapper"
      @mouseenter="openSubmenu('align')"
      @mouseleave="showAlignSubmenu = false"
    >
      <button class="zq-table-context-menu__item">
        <AlignLeft class="zq-table-context-menu__icon" />
        <span>{{ $t('zq-editor.table.cellAlign') }}</span>
        <ChevronRight class="zq-table-context-menu__arrow" />
      </button>
    </div>
    <Teleport to="body">
      <div
        v-if="showAlignSubmenu"
        class="zq-table-context-menu__submenu-fixed"
        :style="alignSubmenuStyle"
        @mouseenter="showAlignSubmenu = true"
        @mouseleave="showAlignSubmenu = false"
      >
        <button
          class="zq-table-context-menu__submenu-item"
          @click="setCellAlign('left')"
        >
          <AlignLeft class="zq-table-context-menu__icon" />
          <span>{{ $t('zq-editor.table.cellAlignLeft') }}</span>
        </button>
        <button
          class="zq-table-context-menu__submenu-item"
          @click="setCellAlign('center')"
        >
          <AlignCenter class="zq-table-context-menu__icon" />
          <span>{{ $t('zq-editor.table.cellAlignCenter') }}</span>
        </button>
        <button
          class="zq-table-context-menu__submenu-item"
          @click="setCellAlign('right')"
        >
          <AlignRight class="zq-table-context-menu__icon" />
          <span>{{ $t('zq-editor.table.cellAlignRight') }}</span>
        </button>
      </div>
    </Teleport>

    <div class="zq-table-context-menu__divider" />

    <!-- Clear cell content -->
    <button class="zq-table-context-menu__item" @click="clearCellContent">
      <X class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.clearCell') }}</span>
    </button>

    <!-- Sort (only when not multi-cell selection) -->
    <template v-if="!hasMultiCellSelection">
      <button class="zq-table-context-menu__item" @click="sortColumn('asc')">
        <ArrowUpNarrowWide class="zq-table-context-menu__icon" />
        <span>{{ $t('zq-editor.table.sortAsc') }}</span>
      </button>
      <button class="zq-table-context-menu__item" @click="sortColumn('desc')">
        <ArrowDownWideNarrow class="zq-table-context-menu__icon" />
        <span>{{ $t('zq-editor.table.sortDesc') }}</span>
      </button>
    </template>

    <div class="zq-table-context-menu__divider" />

    <!-- Header & display toggles -->
    <button class="zq-table-context-menu__item" @click="toggleHeaderRow">
      <Rows2 class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.toggleHeaderRow') }}</span>
      <Check v-if="isHeaderRowActive" class="zq-table-context-menu__check" />
    </button>
    <button class="zq-table-context-menu__item" @click="toggleHeaderColumn">
      <Columns2 class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.toggleHeaderColumn') }}</span>
      <Check v-if="isHeaderColumnActive" class="zq-table-context-menu__check" />
    </button>
    <button class="zq-table-context-menu__item" @click="toggleFullWidth">
      <Maximize2 class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.fullWidth') }}</span>
      <Check v-if="isFullWidthActive" class="zq-table-context-menu__check" />
    </button>
    <button class="zq-table-context-menu__item" @click="toggleStriped">
      <Rows3 class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.stripedRows') }}</span>
      <Check v-if="isStripedActive" class="zq-table-context-menu__check" />
    </button>

    <div class="zq-table-context-menu__divider" />

    <!-- Delete operations -->
    <button
      class="zq-table-context-menu__item zq-table-context-menu__item--danger"
      @click="deleteRow"
    >
      <Trash2 class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.deleteRow') }}</span>
    </button>
    <button
      class="zq-table-context-menu__item zq-table-context-menu__item--danger"
      @click="deleteColumn"
    >
      <Trash2 class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.deleteColumn') }}</span>
    </button>
    <button
      class="zq-table-context-menu__item zq-table-context-menu__item--danger"
      @click="deleteTable"
    >
      <TableProperties class="zq-table-context-menu__icon" />
      <span>{{ $t('zq-editor.table.deleteTable') }}</span>
    </button>
    </ZqScrollbar>
  </div>
</template>

<style scoped>
.zq-table-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
}

.zq-table-context-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--el-text-color-primary);
  border-radius: 5px;
  transition: background-color 0.12s;
  text-align: left;
}

.zq-table-context-menu__item:hover:not(:disabled) {
  background-color: var(--el-fill-color-light);
}

.zq-table-context-menu__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-table-context-menu__item--primary {
  color: var(--el-color-primary);
  font-weight: 500;
}

.zq-table-context-menu__item--primary:hover:not(:disabled) {
  background-color: var(--el-color-primary-light-9);
}

.zq-table-context-menu__item--danger {
  color: var(--el-color-danger);
}

.zq-table-context-menu__item--danger:hover:not(:disabled) {
  background-color: var(--el-color-danger-light-9);
}

.zq-table-context-menu__icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.zq-table-context-menu__arrow {
  width: 14px;
  height: 14px;
  margin-left: auto;
  opacity: 0.5;
}

.zq-table-context-menu__check {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--el-color-primary);
}

.zq-table-context-menu__divider {
  height: 1px;
  background-color: var(--el-border-color-lighter);
  margin: 3px 8px;
}

.zq-table-context-menu__submenu-wrapper {
  position: relative;
}

.zq-table-context-menu__submenu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--el-text-color-primary);
  border-radius: 5px;
  transition: background-color 0.12s;
}

.zq-table-context-menu__submenu-item:hover {
  background-color: var(--el-fill-color-light);
}

.zq-table-context-menu__color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--el-text-color-primary);
  border-radius: 5px;
  transition: background-color 0.12s;
}

.zq-table-context-menu__color-item:hover {
  background-color: var(--el-fill-color-light);
}

.zq-table-context-menu__color-preview {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}
</style>

<style>
.zq-table-context-menu__submenu-fixed {
  position: fixed;
  z-index: 10000;
  min-width: 140px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
}
</style>
