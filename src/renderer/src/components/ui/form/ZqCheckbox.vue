<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <label class="zq-checkbox">
    <input
      type="checkbox"
      class="zq-checkbox__input"
      :checked="modelValue"
      @change="onChange"
    />
    <span class="zq-checkbox__text">
      <slot />
    </span>
  </label>
</template>

<style scoped>
.zq-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.zq-checkbox__input {
  margin-top: 2px;
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  accent-color: var(--accent-color);
  cursor: pointer;
}

.zq-checkbox__text {
  line-height: 1.45;
}
</style>
