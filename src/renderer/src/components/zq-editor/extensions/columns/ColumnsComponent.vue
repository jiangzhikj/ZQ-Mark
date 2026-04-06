<script setup lang="ts">
import { computed } from 'vue';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3';

const props = defineProps<{
  node: any;
}>();

const columnCount = computed(() => props.node.attrs.count || 2);
</script>

<template>
  <NodeViewWrapper
    class="zq-columns"
    :style="{ '--columns': columnCount }"
    data-type="columns"
  >
    <NodeViewContent class="zq-columns__inner" />
  </NodeViewWrapper>
</template>

<style scoped>
.zq-columns {
  margin: 0.75rem 0;
}

.zq-columns__inner {
  display: grid;
  grid-template-columns: repeat(var(--columns, 2), 1fr);
  gap: 16px;
}

.zq-columns__inner :deep([data-type='column']) {
  padding: 8px;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 6px;
  min-height: 60px;
  transition: border-color 0.15s;
}

.zq-columns__inner :deep([data-type='column']:hover) {
  border-color: var(--el-border-color);
}

.zq-columns__inner :deep([data-type='column']:focus-within) {
  border-color: var(--el-color-primary-light-5);
}
</style>
