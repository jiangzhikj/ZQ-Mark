<script setup lang="ts">
import { ref } from 'vue';

import { $t } from '../utils/i18n';

const emit = defineEmits<{
  select: [rows: number, cols: number];
}>();

const MAX = 10;
const hoveredRow = ref(0);
const hoveredCol = ref(0);

function onHover(r: number, c: number) {
  hoveredRow.value = r;
  hoveredCol.value = c;
}

function onSelect(r: number, c: number) {
  emit('select', r, c);
}

function onReset() {
  hoveredRow.value = 0;
  hoveredCol.value = 0;
}
</script>

<template>
  <div class="zq-table-size-picker" @mouseleave="onReset">
    <div class="zq-table-size-picker__label">
      {{ $t('zq-editor.table.sizePicker') }}
    </div>
    <div class="zq-table-size-picker__grid">
      <div v-for="r in MAX" :key="r" class="zq-table-size-picker__row">
        <div
          v-for="c in MAX"
          :key="c"
          class="zq-table-size-picker__cell"
          :class="{
            'is-active': r <= hoveredRow && c <= hoveredCol,
          }"
          @mouseenter="onHover(r, c)"
          @click="onSelect(r, c)"
        />
      </div>
    </div>
    <div class="zq-table-size-picker__hint">
      <template v-if="hoveredRow > 0 && hoveredCol > 0">
        {{ hoveredRow }} × {{ hoveredCol }}
      </template>
      <template v-else>&nbsp;</template>
    </div>
  </div>
</template>

<style scoped>
.zq-table-size-picker {
  padding: 8px;
  min-width: 200px;
}

.zq-table-size-picker__label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.zq-table-size-picker__grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.zq-table-size-picker__row {
  display: flex;
  gap: 2px;
}

.zq-table-size-picker__cell {
  width: 16px;
  height: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 2px;
  cursor: pointer;
  transition:
    background-color 0.1s,
    border-color 0.1s;
}

.zq-table-size-picker__cell:hover,
.zq-table-size-picker__cell.is-active {
  background-color: var(--el-color-primary-light-7);
  border-color: var(--el-color-primary);
}

.zq-table-size-picker__hint {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  text-align: center;
  margin-top: 6px;
  min-height: 1em;
}
</style>
