<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { computed, ref } from 'vue';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
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
  MoveDown,
  MoveUp,
  Paintbrush,
  Plus,
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
  type: 'column' | 'row';
  position: { x: number; y: number };
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const showColorSubmenu = ref(false);
const showAlignSubmenu = ref(false);
const isRow = computed(() => props.type === 'row');

const colorTriggerRef = ref<HTMLElement>();
const alignTriggerRef = ref<HTMLElement>();
const colorSubmenuStyle = ref<Record<string, string>>({});
const alignSubmenuStyle = ref<Record<string, string>>({});

function calcSubmenuPos(triggerEl: HTMLElement | undefined) {
  if (!triggerEl) return { left: '0px', top: '0px' };
  const rect = triggerEl.getBoundingClientRect();
  let left = rect.right - 4;
  let top = rect.top - 4;
  if (left + 180 > window.innerWidth - 8) {
    left = rect.left - 180 + 4;
  }
  if (top + 200 > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - 200 - 8);
  }
  return { left: `${left}px`, top: `${top}px` };
}

function openSubmenu(type: 'color' | 'align') {
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

// -- Table context --

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

// -- Computed states --

const canMerge = computed(() => (props.editor as any).can().mergeCells());
const canSplit = computed(() => (props.editor as any).can().splitCell());

const canMoveBefore = computed(() => {
  const ctx = getTableContext();
  if (!ctx) return false;
  return isRow.value ? ctx.rowIndex > 0 : ctx.colIndex > 0;
});

const canMoveAfter = computed(() => {
  const ctx = getTableContext();
  if (!ctx) return false;
  if (isRow.value) return ctx.rowIndex < ctx.tableNode.childCount - 1;
  if (ctx.rowIndex < 0) return false;
  const row = ctx.tableNode.child(ctx.rowIndex);
  return ctx.colIndex < row.childCount - 1;
});

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

// -- Basic operations --

function insertBefore() {
  if (isRow.value) {
    (props.editor.chain().focus() as any).addRowBefore().run();
  } else {
    (props.editor.chain().focus() as any).addColumnBefore().run();
  }
  emit('close');
}

function insertAfter() {
  if (isRow.value) {
    (props.editor.chain().focus() as any).addRowAfter().run();
  } else {
    (props.editor.chain().focus() as any).addColumnAfter().run();
  }
  emit('close');
}

function deleteRowOrColumn() {
  if (isRow.value) {
    (props.editor.chain().focus() as any).deleteRow().run();
  } else {
    (props.editor.chain().focus() as any).deleteColumn().run();
  }
  emit('close');
}

function duplicateRowOrColumn() {
  if (isRow.value) {
    (props.editor.chain().focus() as any).addRowAfter().run();
  } else {
    (props.editor.chain().focus() as any).addColumnAfter().run();
  }
  emit('close');
}

function setCellBackground(color: string) {
  (props.editor.chain().focus() as any)
    .setCellAttribute('backgroundColor', color || null)
    .run();
  showColorSubmenu.value = false;
  emit('close');
}

// -- Merge / Split --

function mergeCells() {
  (props.editor.chain().focus() as any).mergeCells().run();
  emit('close');
}

function splitCell() {
  (props.editor.chain().focus() as any).splitCell().run();
  emit('close');
}

// -- Header toggles --

function toggleHeaderRow() {
  (props.editor.chain().focus() as any).toggleHeaderRow().run();
  emit('close');
}

function toggleHeaderColumn() {
  (props.editor.chain().focus() as any).toggleHeaderColumn().run();
  emit('close');
}

// -- Delete table --

function deleteTable() {
  (props.editor.chain().focus() as any).deleteTable().run();
  emit('close');
}

// -- Cell alignment --

function setCellAlign(align: string) {
  (props.editor.chain().focus() as any)
    .setCellAttribute('textAlign', align)
    .run();
  showAlignSubmenu.value = false;
  emit('close');
}

// -- Clear column content --

function clearColumnContent() {
  const ctx = getTableContext();
  if (!ctx || ctx.colIndex < 0) return;

  const { tableNode, tableStart, colIndex } = ctx;
  const { state } = props.editor.view;
  const tr = state.tr;
  const emptyParagraph = state.schema.nodes.paragraph.create();

  const cellsToClear: { from: number; to: number }[] = [];
  tableNode.forEach((row: any, rowOffset: number) => {
    if (colIndex >= row.childCount) return;
    let cellOffset = 0;
    for (let c = 0; c < colIndex; c++) {
      cellOffset += row.child(c).nodeSize;
    }
    const cell = row.child(colIndex);
    const cellPos = tableStart + rowOffset + 1 + cellOffset;
    cellsToClear.push({
      from: cellPos + 1,
      to: cellPos + cell.nodeSize - 1,
    });
  });

  for (let i = cellsToClear.length - 1; i >= 0; i--) {
    const { from, to } = cellsToClear[i];
    if (from < to) {
      tr.replaceWith(from, to, emptyParagraph);
    }
  }

  props.editor.view.dispatch(tr);
  emit('close');
}

// -- Move operations --

function moveRow(direction: 'up' | 'down') {
  const ctx = getTableContext();
  if (!ctx) return;

  const { tableNode, tableStart, rowIndex } = ctx;
  const swapIdx = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
  if (swapIdx < 0 || swapIdx >= tableNode.childCount) return;

  const firstIdx = Math.min(rowIndex, swapIdx);
  const secondIdx = Math.max(rowIndex, swapIdx);
  const firstRow = tableNode.child(firstIdx);
  const secondRow = tableNode.child(secondIdx);

  let firstRowPos = tableStart;
  for (let i = 0; i < firstIdx; i++) {
    firstRowPos += tableNode.child(i).nodeSize;
  }
  const rangeEnd = firstRowPos + firstRow.nodeSize + secondRow.nodeSize;

  const { tr } = props.editor.view.state;
  tr.replaceWith(firstRowPos, rangeEnd, [
    secondRow.copy(secondRow.content),
    firstRow.copy(firstRow.content),
  ]);
  props.editor.view.dispatch(tr);
  emit('close');
}

function moveColumn(direction: 'left' | 'right') {
  const ctx = getTableContext();
  if (!ctx) return;

  const { tableNode, tableStart, colIndex } = ctx;
  const swapIdx = direction === 'left' ? colIndex - 1 : colIndex + 1;
  if (swapIdx < 0) return;

  const firstIdx = Math.min(colIndex, swapIdx);
  const secondIdx = Math.max(colIndex, swapIdx);

  const { state } = props.editor.view;
  const tr = state.tr;

  const rowData: { rowPos: number; row: any }[] = [];
  tableNode.forEach((row: any, rowOffset: number) => {
    rowData.push({ rowPos: tableStart + rowOffset, row });
  });

  for (let r = rowData.length - 1; r >= 0; r--) {
    const { row, rowPos } = rowData[r];
    if (secondIdx >= row.childCount) continue;

    const firstCell = row.child(firstIdx);
    const secondCell = row.child(secondIdx);

    let firstCellPos = rowPos + 1;
    for (let c = 0; c < firstIdx; c++) {
      firstCellPos += row.child(c).nodeSize;
    }
    const rangeEnd =
      firstCellPos + firstCell.nodeSize + secondCell.nodeSize;

    tr.replaceWith(firstCellPos, rangeEnd, [
      secondCell.copy(secondCell.content),
      firstCell.copy(firstCell.content),
    ]);
  }

  props.editor.view.dispatch(tr);
  emit('close');
}

function handleMove(dir: 'before' | 'after') {
  if (isRow.value) {
    moveRow(dir === 'before' ? 'up' : 'down');
  } else {
    moveColumn(dir === 'before' ? 'left' : 'right');
  }
}

// -- Table display toggles --

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

// -- Column sort --

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
</script>

<template>
  <div
    class="zq-table-menu"
    :style="menuPositionStyle"
    @click.stop
  >
    <ZqScrollbar :height="menuScrollbarHeight">
    <!-- Move operations -->
    <button
      class="zq-table-menu__item"
      :disabled="!canMoveBefore"
      @click="handleMove('before')"
    >
      <component
        :is="isRow ? MoveUp : ArrowLeft"
        class="zq-table-menu__icon"
      />
      <span>{{
        isRow
          ? $t('zq-editor.table.moveUp')
          : $t('zq-editor.table.moveLeft')
      }}</span>
    </button>
    <button
      class="zq-table-menu__item"
      :disabled="!canMoveAfter"
      @click="handleMove('after')"
    >
      <component
        :is="isRow ? MoveDown : ArrowRight"
        class="zq-table-menu__icon"
      />
      <span>{{
        isRow
          ? $t('zq-editor.table.moveDown')
          : $t('zq-editor.table.moveRight')
      }}</span>
    </button>

    <div class="zq-table-menu__divider" />

    <!-- Insert -->
    <button class="zq-table-menu__item" @click="insertBefore">
      <component
        :is="isRow ? BetweenVerticalStart : BetweenHorizontalStart"
        class="zq-table-menu__icon"
      />
      <span>{{
        isRow
          ? $t('zq-editor.table.insertRowAbove')
          : $t('zq-editor.table.insertColumnLeft')
      }}</span>
    </button>
    <button class="zq-table-menu__item" @click="insertAfter">
      <component
        :is="isRow ? BetweenVerticalEnd : BetweenHorizontalEnd"
        class="zq-table-menu__icon"
      />
      <span>{{
        isRow
          ? $t('zq-editor.table.insertRowBelow')
          : $t('zq-editor.table.insertColumnRight')
      }}</span>
    </button>

    <div class="zq-table-menu__divider" />

    <!-- Color submenu -->
    <div
      ref="colorTriggerRef"
      class="zq-table-menu__submenu-wrapper"
      @mouseenter="openSubmenu('color')"
      @mouseleave="showColorSubmenu = false"
    >
      <button class="zq-table-menu__item">
        <Paintbrush class="zq-table-menu__icon" />
        <span>{{ $t('zq-editor.table.color') }}</span>
        <ChevronRight class="zq-table-menu__arrow" />
      </button>
    </div>
    <Teleport to="body">
      <div
        v-if="showColorSubmenu"
        class="zq-table-menu__submenu-fixed"
        :style="colorSubmenuStyle"
        @mouseenter="showColorSubmenu = true"
        @mouseleave="showColorSubmenu = false"
      >
        <button
          v-for="color in cellColors"
          :key="color.value"
          class="zq-table-menu__color-item"
          @click="setCellBackground(color.value)"
        >
          <span
            class="zq-table-menu__color-preview"
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

    <!-- Merge / Split -->
    <button
      class="zq-table-menu__item"
      :disabled="!canMerge"
      @click="mergeCells"
    >
      <MergeCells class="zq-table-menu__icon" />
      <span>{{ $t('zq-editor.table.mergeCells') }}</span>
    </button>
    <button
      class="zq-table-menu__item"
      :disabled="!canSplit"
      @click="splitCell"
    >
      <SplitSquareHorizontal class="zq-table-menu__icon" />
      <span>{{ $t('zq-editor.table.splitCell') }}</span>
    </button>

    <!-- Alignment submenu -->
    <div
      ref="alignTriggerRef"
      class="zq-table-menu__submenu-wrapper"
      @mouseenter="openSubmenu('align')"
      @mouseleave="showAlignSubmenu = false"
    >
      <button class="zq-table-menu__item">
        <AlignLeft class="zq-table-menu__icon" />
        <span>{{ $t('zq-editor.table.cellAlign') }}</span>
        <ChevronRight class="zq-table-menu__arrow" />
      </button>
    </div>
    <Teleport to="body">
      <div
        v-if="showAlignSubmenu"
        class="zq-table-menu__submenu-fixed"
        :style="alignSubmenuStyle"
        @mouseenter="showAlignSubmenu = true"
        @mouseleave="showAlignSubmenu = false"
      >
        <button
          class="zq-table-menu__submenu-item"
          @click="setCellAlign('left')"
        >
          <AlignLeft class="zq-table-menu__icon" />
          <span>{{ $t('zq-editor.table.cellAlignLeft') }}</span>
        </button>
        <button
          class="zq-table-menu__submenu-item"
          @click="setCellAlign('center')"
        >
          <AlignCenter class="zq-table-menu__icon" />
          <span>{{ $t('zq-editor.table.cellAlignCenter') }}</span>
        </button>
        <button
          class="zq-table-menu__submenu-item"
          @click="setCellAlign('right')"
        >
          <AlignRight class="zq-table-menu__icon" />
          <span>{{ $t('zq-editor.table.cellAlignRight') }}</span>
        </button>
      </div>
    </Teleport>

    <div class="zq-table-menu__divider" />

    <!-- Header & display toggles -->
    <button class="zq-table-menu__item" @click="toggleHeaderRow">
      <Rows2 class="zq-table-menu__icon" />
      <span>{{ $t('zq-editor.table.toggleHeaderRow') }}</span>
      <Check v-if="isHeaderRowActive" class="zq-table-menu__check" />
    </button>
    <button class="zq-table-menu__item" @click="toggleHeaderColumn">
      <Columns2 class="zq-table-menu__icon" />
      <span>{{ $t('zq-editor.table.toggleHeaderColumn') }}</span>
      <Check
        v-if="isHeaderColumnActive"
        class="zq-table-menu__check"
      />
    </button>
    <button class="zq-table-menu__item" @click="toggleFullWidth">
      <Maximize2 class="zq-table-menu__icon" />
      <span>{{ $t('zq-editor.table.fullWidth') }}</span>
      <Check v-if="isFullWidthActive" class="zq-table-menu__check" />
    </button>
    <button class="zq-table-menu__item" @click="toggleStriped">
      <Rows3 class="zq-table-menu__icon" />
      <span>{{ $t('zq-editor.table.stripedRows') }}</span>
      <Check v-if="isStripedActive" class="zq-table-menu__check" />
    </button>

    <!-- Column-specific operations -->
    <template v-if="!isRow">
      <div class="zq-table-menu__divider" />
      <button
        class="zq-table-menu__item"
        @click="clearColumnContent"
      >
        <X class="zq-table-menu__icon" />
        <span>{{ $t('zq-editor.table.clearColumn') }}</span>
      </button>
      <button class="zq-table-menu__item" @click="sortColumn('asc')">
        <ArrowUpNarrowWide class="zq-table-menu__icon" />
        <span>{{ $t('zq-editor.table.sortAsc') }}</span>
      </button>
      <button
        class="zq-table-menu__item"
        @click="sortColumn('desc')"
      >
        <ArrowDownWideNarrow class="zq-table-menu__icon" />
        <span>{{ $t('zq-editor.table.sortDesc') }}</span>
      </button>
    </template>

    <div class="zq-table-menu__divider" />

    <!-- Actions -->
    <button class="zq-table-menu__item" @click="duplicateRowOrColumn">
      <Plus class="zq-table-menu__icon" />
      <span>{{
        isRow
          ? $t('zq-editor.table.duplicateRow')
          : $t('zq-editor.table.duplicateColumn')
      }}</span>
    </button>
    <button
      class="zq-table-menu__item zq-table-menu__item--danger"
      @click="deleteRowOrColumn"
    >
      <Trash2 class="zq-table-menu__icon" />
      <span>{{
        isRow
          ? $t('zq-editor.table.deleteRow')
          : $t('zq-editor.table.deleteColumn')
      }}</span>
    </button>
    <button
      class="zq-table-menu__item zq-table-menu__item--danger"
      @click="deleteTable"
    >
      <TableProperties class="zq-table-menu__icon" />
      <span>{{ $t('zq-editor.table.deleteTable') }}</span>
    </button>
    </ZqScrollbar>
  </div>
</template>

<style scoped>
.zq-table-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
}

.zq-table-menu__item {
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

.zq-table-menu__item:hover:not(:disabled) {
  background-color: var(--el-fill-color-light);
}

.zq-table-menu__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-table-menu__item--danger {
  color: var(--el-color-danger);
}

.zq-table-menu__item--danger:hover:not(:disabled) {
  background-color: var(--el-color-danger-light-9);
}

.zq-table-menu__icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.zq-table-menu__arrow {
  width: 14px;
  height: 14px;
  margin-left: auto;
  opacity: 0.5;
}

.zq-table-menu__check {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--el-color-primary);
}

.zq-table-menu__divider {
  height: 1px;
  background-color: var(--el-border-color-lighter);
  margin: 3px 8px;
}

.zq-table-menu__submenu-wrapper {
  position: relative;
}

.zq-table-menu__submenu-item {
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

.zq-table-menu__submenu-item:hover {
  background-color: var(--el-fill-color-light);
}

.zq-table-menu__color-item {
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

.zq-table-menu__color-item:hover {
  background-color: var(--el-fill-color-light);
}

.zq-table-menu__color-preview {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}
</style>

<style>
.zq-table-menu__submenu-fixed {
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
