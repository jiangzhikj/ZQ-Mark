<script setup lang="ts">
import { ref } from 'vue';

import { $t } from '../utils/i18n';

const emit = defineEmits<{
  select: [count: number];
}>();

const COLUMN_OPTIONS = [2, 3, 4];
const hoveredCount = ref(0);

function onSelect(count: number) {
  emit('select', count);
}
</script>

<template>
  <div class="zq-col-picker">
    <div class="zq-col-picker__label">
      {{ $t('zq-editor.slash.columns') }}
    </div>
    <div class="zq-col-picker__options">
      <button
        v-for="n in COLUMN_OPTIONS"
        :key="n"
        class="zq-col-picker__option"
        :class="{ 'is-hovered': hoveredCount === n }"
        @mouseenter="hoveredCount = n"
        @mouseleave="hoveredCount = 0"
        @click="onSelect(n)"
      >
        <div class="zq-col-picker__preview">
          <div
            v-for="i in n"
            :key="i"
            class="zq-col-picker__col"
          />
        </div>
        <span class="zq-col-picker__label-text">{{ n }} 栏</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.zq-col-picker {
  padding: 8px;
  min-width: 160px;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 8px 24px rgb(0 0 0 / 0.08);
}

.zq-col-picker__label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary, #909399);
  margin-bottom: 6px;
  font-weight: 500;
  padding: 0 4px;
}

.zq-col-picker__options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zq-col-picker__option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
  font-size: 0.8125rem;
  color: var(--el-text-color-regular, #606266);
}

.zq-col-picker__option:hover,
.zq-col-picker__option.is-hovered {
  background: var(--el-fill-color-light, #f5f7fa);
  border-color: var(--el-border-color, #dcdfe6);
}

.zq-col-picker__preview {
  display: flex;
  gap: 3px;
  width: 48px;
  height: 20px;
  flex-shrink: 0;
}

.zq-col-picker__col {
  flex: 1;
  border-radius: 3px;
  background: var(--el-border-color, #dcdfe6);
  transition: background-color 0.15s;
}

.zq-col-picker__option:hover .zq-col-picker__col,
.zq-col-picker__option.is-hovered .zq-col-picker__col {
  background: var(--el-color-primary-light-5, rgba(64, 158, 255, 0.35));
}

.zq-col-picker__label-text {
  white-space: nowrap;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .zq-col-picker {
    background: #2c2c2c;
    border-color: #444;
  }

  .zq-col-picker__option:hover,
  .zq-col-picker__option.is-hovered {
    background: #3a3a3a;
    border-color: #555;
  }

  .zq-col-picker__col {
    background: #555;
  }
}
</style>
