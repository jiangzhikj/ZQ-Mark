<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { ChevronRight } from '@/components/icons';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
}>();

const isOpen = ref(props.node.attrs.open !== false);
const summaryRef = ref<HTMLElement>();
let isInternalUpdate = false;

watch(
  () => props.node.attrs.open,
  (val) => { isOpen.value = val !== false; },
);

watch(
  () => props.node.attrs.summary,
  (val) => {
    if (isInternalUpdate) return;
    const el = summaryRef.value;
    if (el && el.textContent !== val) {
      el.textContent = val || '';
    }
  },
);

onMounted(() => {
  nextTick(() => {
    const el = summaryRef.value;
    if (el && props.node.attrs.summary) {
      el.textContent = props.node.attrs.summary;
    }
  });
});

function toggleOpen() {
  isOpen.value = !isOpen.value;
  props.updateAttributes({ open: isOpen.value });
}

function onSummaryInput(e: Event) {
  const text = (e.target as HTMLElement).textContent || '';
  isInternalUpdate = true;
  props.updateAttributes({ summary: text });
  nextTick(() => { isInternalUpdate = false; });
}

const arrowClass = computed(() =>
  isOpen.value ? 'toggle-arrow toggle-arrow--open' : 'toggle-arrow',
);
</script>

<template>
  <NodeViewWrapper class="toggle-block" data-type="toggle">
    <div class="toggle-header" contenteditable="false">
      <button class="toggle-trigger" @click="toggleOpen">
        <ChevronRight :class="arrowClass" />
      </button>
      <div
        ref="summaryRef"
        class="toggle-summary"
        contenteditable="true"
        :data-placeholder="$t('zq-editor.toggle.placeholder')"
        @input="onSummaryInput"
      />
    </div>
    <div v-show="isOpen" class="toggle-content">
      <NodeViewContent />
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.toggle-block {
  margin: 0.5rem 0;
  border-radius: 6px;
}

.toggle-header {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.toggle-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  transition: all 0.15s;
}

.toggle-trigger:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.toggle-arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
}

.toggle-arrow--open {
  transform: rotate(90deg);
}

.toggle-summary {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  font-weight: 500;
  line-height: 1.5;
  outline: none;
  color: var(--el-text-color-primary);
}

.toggle-summary:empty::before {
  content: attr(data-placeholder);
  color: var(--el-text-color-placeholder);
}

.toggle-content {
  padding-left: 26px;
  border-left: 2px solid var(--el-border-color-lighter);
  margin-left: 10px;
}
</style>
