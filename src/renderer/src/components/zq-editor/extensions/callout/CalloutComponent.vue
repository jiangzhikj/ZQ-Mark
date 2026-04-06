<script setup lang="ts">
import { computed } from 'vue';

import {
  AlertCircle,
  CheckCircle,
  Info,
  TriangleAlert,
} from '@/components/icons';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
}>();

const calloutType = computed(() => props.node.attrs.type || 'info');

const iconMap: Record<string, any> = {
  info: Info,
  warning: TriangleAlert,
  success: CheckCircle,
  error: AlertCircle,
};

const currentIcon = computed(() => iconMap[calloutType.value] || Info);

const typeOptions: { type: string; icon: any }[] = [
  { type: 'info', icon: Info },
  { type: 'warning', icon: TriangleAlert },
  { type: 'success', icon: CheckCircle },
  { type: 'error', icon: AlertCircle },
];

function changeType(type: string) {
  props.updateAttributes({ type });
}
</script>

<template>
  <NodeViewWrapper
    class="callout-block"
    :class="`callout-block--${calloutType}`"
    data-type="callout"
  >
    <div class="callout-icon-wrapper" contenteditable="false">
      <div class="callout-icon-trigger">
        <component :is="currentIcon" class="callout-icon" />
      </div>
      <div class="callout-type-picker">
        <button
          v-for="opt in typeOptions"
          :key="opt.type"
          class="callout-type-btn"
          :class="{ 'is-active': calloutType === opt.type }"
          @click="changeType(opt.type)"
        >
          <component :is="opt.icon" class="h-4 w-4" />
        </button>
      </div>
    </div>
    <NodeViewContent class="callout-content" />
  </NodeViewWrapper>
</template>

<style scoped>
.callout-icon-wrapper {
  position: relative;
  flex-shrink: 0;
}

.callout-icon-trigger {
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.callout-icon-trigger:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.callout-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.callout-block--info .callout-icon {
  color: var(--el-color-primary);
}

.callout-block--warning .callout-icon {
  color: var(--el-color-warning);
}

.callout-block--success .callout-icon {
  color: var(--el-color-success);
}

.callout-block--error .callout-icon {
  color: var(--el-color-danger);
}

.callout-type-picker {
  display: none;
  position: absolute;
  top: 100%;
  left: -4px;
  z-index: 10;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 4px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  gap: 2px;
  flex-direction: row;
}

.callout-icon-wrapper:hover .callout-type-picker {
  display: flex;
}

.callout-type-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.15s;
}

.callout-type-btn:hover {
  background-color: var(--el-fill-color-light);
}

.callout-type-btn.is-active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.callout-content {
  flex: 1;
  min-width: 0;
}
</style>
