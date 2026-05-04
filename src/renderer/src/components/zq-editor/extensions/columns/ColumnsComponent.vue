<script setup lang="ts">
import { computed, ref } from 'vue';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3';
import { Trash2 } from '@/components/icons';

const props = defineProps<{ node: any; editor: any; deleteNode: () => void }>();

const columnCount = computed(() => props.node.attrs.count || 2);
const hovered = ref(false);

// When user hovers the outer wrapper, show tools; some delay to avoid flicker.
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
function onMouseEnter() {
  if (hoverTimer) clearTimeout(hoverTimer);
  hovered.value = true;
}
function onMouseLeave() {
  hoverTimer = setTimeout(() => {
    hovered.value = false;
  }, 200);
}

function setCount(n: number) {
  if (n < 2 || n > 4 || n === columnCount.value) return;
  const { editor } = props;
  const pos = editor.view.state.selection.$anchor.before(
    editor.view.state.selection.$anchor.depth
  );

  // Find the columnsBlock position
  let columnsPos = pos;
  const { state } = editor.view;
  for (let d = state.selection.$anchor.depth; d > 0; d--) {
    const node = state.selection.$anchor.node(d);
    if (node.type.name === 'columnsBlock') {
      columnsPos = state.selection.$anchor.before(d);
      break;
    }
  }

  const columnsNode = editor.view.state.doc.nodeAt(columnsPos);
  if (!columnsNode || columnsNode.type.name !== 'columnsBlock') return;

  const currentCount = columnsNode.childCount;
  const existingColumns: any[] = [];
  columnsNode.forEach((col: any) => {
    existingColumns.push(col.toJSON());
  });

  if (n > currentCount) {
    // Add columns
    const newCols = Array.from({ length: n - currentCount }, () => ({
      type: 'columnBlock',
      content: [{ type: 'paragraph' }],
    }));
    const tr = editor.view.state.tr;
    const endPos = columnsPos + columnsNode.nodeSize - 1;
    for (const col of newCols) {
      tr.insert(endPos, columnsNode.type.schema.nodeFromJSON(col));
    }
    tr.setNodeAttribute(columnsPos, 'count', n);
    editor.view.dispatch(tr);
  } else if (n < currentCount) {
    // Remove last columns
    const tr = editor.view.state.tr;
    let offset = columnsPos + 1;
    for (let i = 0; i < currentCount; i++) {
      const child = columnsNode.child(i);
      if (i >= n) {
        tr.delete(offset, offset + child.nodeSize);
      } else {
        offset += child.nodeSize;
      }
    }
    tr.setNodeAttribute(columnsPos, 'count', n);
    editor.view.dispatch(tr);
  }

  editor.commands.focus();
}
</script>

<template>
  <NodeViewWrapper
    class="zq-columns"
    :data-columns="columnCount"
    data-type="columns"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div v-show="hovered" class="zq-columns__toolbar" contenteditable="false">
      <button
        v-for="n in [2, 3, 4]"
        :key="n"
        class="zq-columns__toolbar-btn"
        :class="{ 'zq-columns__toolbar-btn--active': columnCount === n }"
        :title="`${n} 栏`"
        @click.prevent="setCount(n)"
        @mousedown.prevent
      >
        <span class="zq-columns__toolbar-btn-text">{{ n }}</span>
      </button>
      <span class="zq-columns__toolbar-divider" aria-hidden="true" />
      <button
        class="zq-columns__toolbar-btn zq-columns__toolbar-btn--danger"
        title="删除分栏"
        @click.prevent="props.deleteNode()"
        @mousedown.prevent
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>
    </div>
    <NodeViewContent class="zq-columns__inner" :class="`zq-columns__inner--${columnCount}`" />
  </NodeViewWrapper>
</template>

<style scoped>
.zq-columns {
  position: relative;
  margin: 0.75rem 0;
  border-radius: 8px;
}

.zq-columns__toolbar {
  position: absolute;
  top: -36px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.zq-columns__toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  color: var(--el-text-color-secondary, #909399);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.zq-columns__toolbar-btn:hover {
  background: var(--el-fill-color-light, #f5f7fa);
  color: var(--el-text-color-primary, #303133);
}

.zq-columns__toolbar-btn--active {
  color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, rgba(64, 158, 255, 0.1));
}

.zq-columns__toolbar-btn-text {
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1;
}

.zq-columns__toolbar-divider {
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: var(--el-border-color-light, #e4e7ed);
}

.zq-columns__toolbar-btn--danger {
  color: var(--el-color-danger, #f56c6c);
}

.zq-columns__toolbar-btn--danger:hover {
  background: var(--el-color-danger-light-9, rgba(245, 108, 108, 0.1));
  color: var(--el-color-danger, #f56c6c);
}

.zq-columns__inner {
  display: grid;
  gap: 12px;
}

.zq-columns__inner--2 {
  grid-template-columns: repeat(2, 1fr);
}

.zq-columns__inner--3 {
  grid-template-columns: repeat(3, 1fr);
}

.zq-columns__inner--4 {
  grid-template-columns: repeat(4, 1fr);
}

.zq-columns__inner :deep([data-type='column']) {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
  min-height: 64px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.zq-columns__inner :deep([data-type='column']:hover) {
  border-color: var(--el-border-color, #dcdfe6);
}

.zq-columns__inner :deep([data-type='column']:focus-within) {
  border-color: var(--el-color-primary-light-3, #a0cfff);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8, rgba(64, 158, 255, 0.15));
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .zq-columns__toolbar {
    background: #2c2c2c;
    border-color: #444;
  }

  .zq-columns__toolbar-btn:hover {
    background: #3a3a3a;
    color: #e0e0e0;
  }

  .zq-columns__toolbar-btn--active {
    color: #409eff;
    background: rgba(64, 158, 255, 0.15);
  }

  .zq-columns__inner :deep([data-type='column']) {
    border-color: #3a3a3a;
  }

  .zq-columns__inner :deep([data-type='column']:hover) {
    border-color: #555;
  }
}
</style>
