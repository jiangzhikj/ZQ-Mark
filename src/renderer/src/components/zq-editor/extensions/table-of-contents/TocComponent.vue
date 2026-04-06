<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { List } from '@/components/icons';

import { NodeViewWrapper } from '@tiptap/vue-3';

const props = defineProps<{
  editor: any;
}>();

interface TocItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

const headings = ref<TocItem[]>([]);
let updateTimer: ReturnType<typeof setTimeout> | null = null;

function collectHeadings() {
  if (!props.editor) return;
  const items: TocItem[] = [];
  props.editor.state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading') {
      items.push({
        id: `heading-${pos}`,
        level: node.attrs.level,
        text: node.textContent,
        pos,
      });
    }
  });
  headings.value = items;
}

function debouncedCollect() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(collectHeadings, 300);
}

function scrollToHeading(pos: number) {
  if (!props.editor) return;
  props.editor.chain().focus().setTextSelection(pos).run();
  const domAtPos = props.editor.view.domAtPos(pos);
  const el = domAtPos?.node as HTMLElement;
  el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

const indentStyle = (level: number) => ({
  paddingLeft: `${(level - 1) * 16}px`,
});

onMounted(() => {
  collectHeadings();
  props.editor?.on('update', debouncedCollect);
});

onUnmounted(() => {
  props.editor?.off('update', debouncedCollect);
  if (updateTimer) clearTimeout(updateTimer);
});
</script>

<template>
  <NodeViewWrapper class="zq-toc" data-type="toc" contenteditable="false">
    <div class="zq-toc__header">
      <List class="h-4 w-4" />
      <span class="zq-toc__title">{{ $t('zq-editor.toc.title') }}</span>
    </div>
    <div v-if="headings.length > 0" class="zq-toc__list">
      <button
        v-for="h in headings"
        :key="h.id"
        class="zq-toc__item"
        :class="`zq-toc__item--h${h.level}`"
        :style="indentStyle(h.level)"
        @click="scrollToHeading(h.pos)"
      >
        {{ h.text || $t('zq-editor.toc.untitled') }}
      </button>
    </div>
    <div v-else class="zq-toc__empty">
      {{ $t('zq-editor.toc.empty') }}
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-toc {
  margin: 0.75rem 0;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.zq-toc__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
}

.zq-toc__title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.zq-toc__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.zq-toc__item {
  display: block;
  width: 100%;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zq-toc__item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.zq-toc__item--h1 { font-weight: 600; }
.zq-toc__item--h2 { font-weight: 500; }
.zq-toc__item--h3 { font-weight: 400; font-size: 0.75rem; }

.zq-toc__empty {
  color: var(--el-text-color-placeholder);
  font-size: 0.8125rem;
  text-align: center;
  padding: 8px;
}
</style>
