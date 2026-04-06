<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { computed } from 'vue';

import { $t } from '../utils/i18n';

interface Props {
  editor: Editor;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const textColors = computed(() => [
  { color: 'inherit', label: $t('zq-editor.color.default') },
  { color: '#6b7280', label: $t('zq-editor.color.gray') },
  { color: '#92400e', label: $t('zq-editor.color.brown') },
  { color: '#c2410c', label: $t('zq-editor.color.orange') },
  { color: '#ca8a04', label: $t('zq-editor.color.yellow') },
  { color: '#16a34a', label: $t('zq-editor.color.green') },
  { color: '#0284c7', label: $t('zq-editor.color.blue') },
  { color: '#7c3aed', label: $t('zq-editor.color.purple') },
  { color: '#db2777', label: $t('zq-editor.color.pink') },
  { color: '#dc2626', label: $t('zq-editor.color.red') },
]);

const highlightColors = computed(() => [
  { color: '', label: $t('zq-editor.color.none') },
  { color: '#f3f4f6', label: $t('zq-editor.color.gray') },
  { color: '#fef3c7', label: $t('zq-editor.color.yellow') },
  { color: '#d1fae5', label: $t('zq-editor.color.green') },
  { color: '#dbeafe', label: $t('zq-editor.color.blue') },
  { color: '#ede9fe', label: $t('zq-editor.color.purple') },
  { color: '#fce7f3', label: $t('zq-editor.color.pink') },
  { color: '#fee2e2', label: $t('zq-editor.color.red') },
  { color: '#ffedd5', label: $t('zq-editor.color.orange') },
  { color: '#e0f2fe', label: $t('zq-editor.color.cyan') },
]);

const currentTextColor = computed(
  () => props.editor.getAttributes('textStyle').color || 'inherit',
);

function setTextColor(color: string) {
  if (color === 'inherit') {
    props.editor.chain().focus().unsetColor().run();
  } else {
    props.editor.chain().focus().setColor(color).run();
  }
  emit('close');
}

function setHighlightColor(color: string) {
  if (color) {
    props.editor.chain().focus().setHighlight({ color }).run();
  } else {
    props.editor.chain().focus().unsetHighlight().run();
  }
  emit('close');
}
</script>

<template>
  <div class="zq-color-picker">
    <div class="zq-color-picker__section">
      <div class="zq-color-picker__label">
        {{ $t('zq-editor.color.textColor') }}
      </div>
      <div class="zq-color-picker__grid">
        <button
          v-for="item in textColors"
          :key="item.color"
          class="zq-color-picker__item"
          :class="{ 'is-active': currentTextColor === item.color }"
          :title="item.label"
          @click="setTextColor(item.color)"
        >
          <span
            class="zq-color-picker__letter"
            :style="{
              color:
                item.color === 'inherit'
                  ? 'var(--el-text-color-primary)'
                  : item.color,
            }"
          >
            A
          </span>
        </button>
      </div>
    </div>
    <div class="zq-color-picker__section">
      <div class="zq-color-picker__label">
        {{ $t('zq-editor.color.highlightColor') }}
      </div>
      <div class="zq-color-picker__grid">
        <button
          v-for="item in highlightColors"
          :key="item.color || 'none'"
          class="zq-color-picker__item zq-color-picker__item--highlight"
          :class="{
            'is-active': editor.isActive('highlight', { color: item.color }),
          }"
          :title="item.label"
          @click="setHighlightColor(item.color)"
        >
          <span
            class="zq-color-picker__circle"
            :style="{
              backgroundColor: item.color || 'transparent',
              border: !item.color
                ? '1px dashed var(--el-border-color)'
                : 'none',
            }"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zq-color-picker {
  min-width: 220px;
  padding: 10px;
}

.zq-color-picker__section {
  margin-bottom: 10px;
}

.zq-color-picker__section:last-child {
  margin-bottom: 0;
}

.zq-color-picker__label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.zq-color-picker__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.zq-color-picker__item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.zq-color-picker__item:hover {
  border-color: var(--el-color-primary);
  transform: scale(1.1);
}

.zq-color-picker__item.is-active {
  border-color: var(--el-color-primary);
  border-width: 2px;
}

.zq-color-picker__letter {
  font-size: 0.875rem;
  font-weight: 600;
}

.zq-color-picker__circle {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
}
</style>
