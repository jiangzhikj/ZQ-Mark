<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'
import ZqInput from './ZqInput.vue'

defineProps<{
  modelValue: string
  placeholder?: string
  error?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

async function onBrowse() {
  const dir = await window.electron.selectDirectory()
  if (dir) emit('update:modelValue', dir)
}
</script>

<template>
  <div class="zq-dir-picker">
    <ZqInput
      :model-value="modelValue"
      :placeholder="placeholder"
      :error="error"
      readonly
      class="zq-dir-picker__input"
      @click="onBrowse"
    />
    <button class="zq-dir-picker__btn" @click="onBrowse">
      <FolderOpen :size="16" />
    </button>
  </div>
</template>

<style scoped>
.zq-dir-picker {
  display: flex;
  gap: 8px;
}

.zq-dir-picker__input {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  text-overflow: ellipsis;
}

.zq-dir-picker__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.zq-dir-picker__btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}
</style>
