<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Maximize2,
  MergeCells,
  Rows2,
  Rows3,
  SplitSquareHorizontal,
  Trash2,
} from '@/components/icons';
import { $t } from '../utils/i18n';

interface Props {
  editor: Editor;
}

const props = defineProps<Props>();

const visible = ref(false);
const toolbarPos = ref({ top: 0, left: 0 });

function getTableContext() {
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
    )
      cellDepth = d;
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
  };
}

const isInsideTable = computed(() => {
  return getTableContext() !== null;
});

const canMerge = computed(() =>
  (props.editor as any).can().mergeCells(),
);
const canSplit = computed(() =>
  (props.editor as any).can().splitCell(),
);

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
    )
      return false;
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

function updatePosition() {
  if (!props.editor || !isInsideTable.value) {
    visible.value = false;
    return;
  }

  const dom = props.editor.view.dom;
  const tableEl = dom.querySelector('table');
  if (!tableEl) {
    visible.value = false;
    return;
  }

  const { state } = props.editor.view;
  const $pos = state.doc.resolve(state.selection.from);
  let tableDepth = -1;
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'table') {
      tableDepth = d;
      break;
    }
  }
  if (tableDepth < 0) {
    visible.value = false;
    return;
  }

  const tablePos = $pos.before(tableDepth);
  const tableDomNode = props.editor.view.nodeDOM(tablePos);
  if (!tableDomNode) {
    visible.value = false;
    return;
  }

  const tableElement = (
    tableDomNode instanceof HTMLElement
      ? tableDomNode.querySelector('table') || tableDomNode
      : tableDomNode
  ) as HTMLElement;
  const rect = tableElement.getBoundingClientRect();

  toolbarPos.value = {
    top: rect.top - 40,
    left: rect.left + rect.width / 2,
  };
  visible.value = true;
}

function mergeCells() {
  (props.editor.chain().focus() as any).mergeCells().run();
}

function splitCell() {
  (props.editor.chain().focus() as any).splitCell().run();
}

function setCellAlign(align: string) {
  (props.editor.chain().focus() as any)
    .setCellAttribute('textAlign', align)
    .run();
}

function toggleHeaderRow() {
  (props.editor.chain().focus() as any).toggleHeaderRow().run();
}

function toggleHeaderColumn() {
  (props.editor.chain().focus() as any).toggleHeaderColumn().run();
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
}

function deleteTable() {
  (props.editor.chain().focus() as any).deleteTable().run();
}

let updateTimer: ReturnType<typeof setTimeout> | null = null;
let scrollAncestors: HTMLElement[] = [];

function debouncedUpdate() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(updatePosition, 100);
}

function handleScroll() {
  updatePosition();
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

watch(
  () => props.editor?.state?.selection,
  () => debouncedUpdate(),
  { deep: true },
);

onMounted(() => {
  props.editor?.on('selectionUpdate', debouncedUpdate);
  props.editor?.on('transaction', debouncedUpdate);
  debouncedUpdate();

  nextTick(() => {
    const editorEl = props.editor?.view?.dom as HTMLElement | null;
    scrollAncestors = collectScrollAncestors(editorEl);
    for (const el of scrollAncestors) {
      el.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
  });
});

onBeforeUnmount(() => {
  props.editor?.off('selectionUpdate', debouncedUpdate);
  props.editor?.off('transaction', debouncedUpdate);
  if (updateTimer) clearTimeout(updateTimer);
  for (const el of scrollAncestors) {
    el.removeEventListener('scroll', handleScroll);
  }
  scrollAncestors = [];
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="zq-table-toolbar"
      :style="{
        top: `${toolbarPos.top}px`,
        left: `${toolbarPos.left}px`,
      }"
    >
      <button
        class="zq-table-toolbar__btn"
        :disabled="!canMerge"
        :title="$t('zq-editor.table.mergeCells')"
        @click="mergeCells"
      >
        <MergeCells />
      </button>
      <button
        class="zq-table-toolbar__btn"
        :disabled="!canSplit"
        :title="$t('zq-editor.table.splitCell')"
        @click="splitCell"
      >
        <SplitSquareHorizontal />
      </button>

      <span class="zq-table-toolbar__sep" />

      <button
        class="zq-table-toolbar__btn"
        :title="$t('zq-editor.table.cellAlignLeft')"
        @click="setCellAlign('left')"
      >
        <AlignLeft />
      </button>
      <button
        class="zq-table-toolbar__btn"
        :title="$t('zq-editor.table.cellAlignCenter')"
        @click="setCellAlign('center')"
      >
        <AlignCenter />
      </button>
      <button
        class="zq-table-toolbar__btn"
        :title="$t('zq-editor.table.cellAlignRight')"
        @click="setCellAlign('right')"
      >
        <AlignRight />
      </button>

      <span class="zq-table-toolbar__sep" />

      <button
        class="zq-table-toolbar__btn"
        :class="{ 'is-active': isHeaderRowActive }"
        :title="$t('zq-editor.table.toggleHeaderRow')"
        @click="toggleHeaderRow"
      >
        <Rows2 />
      </button>
      <button
        class="zq-table-toolbar__btn"
        :class="{ 'is-active': isHeaderColumnActive }"
        :title="$t('zq-editor.table.toggleHeaderColumn')"
        @click="toggleHeaderColumn"
      >
        <Columns2 />
      </button>

      <span class="zq-table-toolbar__sep" />

      <button
        class="zq-table-toolbar__btn"
        :class="{ 'is-active': isFullWidthActive }"
        :title="$t('zq-editor.table.fullWidth')"
        @click="toggleFullWidth"
      >
        <Maximize2 />
      </button>
      <button
        class="zq-table-toolbar__btn"
        :class="{ 'is-active': isStripedActive }"
        :title="$t('zq-editor.table.stripedRows')"
        @click="toggleStriped"
      >
        <Rows3 />
      </button>

      <span class="zq-table-toolbar__sep" />

      <button
        class="zq-table-toolbar__btn zq-table-toolbar__btn--danger"
        :title="$t('zq-editor.table.deleteTable')"
        @click="deleteTable"
      >
        <Trash2 />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.zq-table-toolbar {
  position: fixed;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transform: translateX(-50%);
}

.zq-table-toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 5px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  transition:
    background-color 0.12s,
    color 0.12s;
}

.zq-table-toolbar__btn svg {
  width: 15px;
  height: 15px;
}

.zq-table-toolbar__btn:hover:not(:disabled) {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.zq-table-toolbar__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.zq-table-toolbar__btn.is-active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.zq-table-toolbar__btn--danger:hover:not(:disabled) {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.zq-table-toolbar__sep {
  width: 1px;
  height: 18px;
  background-color: var(--el-border-color-lighter);
  margin: 0 2px;
}
</style>
